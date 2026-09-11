// Piloto interno del agente de WhatsApp — Fase 1.
// A diferencia de asistente-busqueda (JWT de usuario, RLS filtra), acá no
// hay sesión de Supabase — un mensaje de WhatsApp no trae JWT. La única
// verificación de identidad es la firma HMAC del webhook (dueña de Meta) +
// el número de origen contra whatsapp_users. empresa_id y rol se resuelven
// UNA VEZ server-side (resolverAcceso) y quedan fijos para toda la
// conversación — nunca se infieren del mensaje ni los decide el modelo.
// Cliente Supabase con service_role: única excepción del proyecto, cada
// query fuerza el filtro de empresa explícito (ver _shared/asistente-tools.ts).
// Desde 2026-09-10 ya no es 100% solo-lectura: crear_tarea y
// cambiar_estado_tarea existen, pero NUNCA mutan datos cuando el modelo
// las invoca — arman una "propuesta" en whatsapp_sesiones (estado
// 'esperando_confirmacion_tarea' + contexto) y devuelven el texto de
// confirmación para que el modelo lo relaye. La ejecución real del
// INSERT/UPDATE solo ocurre cuando el CÓDIGO (no el modelo) detecta una
// respuesta afirmativa al mensaje siguiente — ver procesarMensaje.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.68";
import {
  CATEGORIAS_GASTO,
  TOOLS_BUSQUEDA,
  TOOL_RESUMEN_FINANCIERO,
  TOOL_BUSCAR_TAREAS,
  TOOL_CREAR_TAREA,
  TOOL_CAMBIAR_ESTADO_TAREA,
  TOOL_ELIMINAR_TAREA,
  ejecutarTool,
  resolverObraId,
} from "../_shared/asistente-tools.ts";

const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-5";
const MAX_TOOL_ROUNDS = 4;
const GRAPH_API_VERSION = "v21.0";

// ── Dedup de reintentos de Meta por message_id ──────────────────
// En memoria, sin tabla nueva (fuera del alcance de esta Fase 1 — ver
// RESTRICCIONES). Limitación conocida: se resetea si la instancia de la
// Edge Function se reinicia (cold start) entre el mensaje original y el
// reintento — aceptable para un piloto interno de bajo volumen, no es una
// garantía dura. Si en el futuro hace falta dedup persistente de verdad,
// evaluar una tabla dedicada (decisión aparte, no tomada acá).
const MENSAJES_PROCESADOS = new Set<string>();
const MAX_DEDUP = 500;
function yaProcesado(messageId: string): boolean {
  if (MENSAJES_PROCESADOS.has(messageId)) return true;
  MENSAJES_PROCESADOS.add(messageId);
  if (MENSAJES_PROCESADOS.size > MAX_DEDUP) {
    const primero = MENSAJES_PROCESADOS.values().next().value;
    if (primero) MENSAJES_PROCESADOS.delete(primero);
  }
  return false;
}

// ── Memoria de sesión por número, persistida en whatsapp_sesiones ──
// Primer intento fue un Map en memoria del proceso: los logs de staging
// mostraron que la Edge Function arranca fría en casi cada invocación
// real (cada mensaje trae su propio evento "booted"), así que esa
// memoria no sobrevivía de un mensaje al siguiente — el bot se volvía a
// presentar en cada respuesta. Se pasó a una tabla (deny-all por RLS,
// solo la Edge Function con service_role la toca). Solo se guarda texto
// limpio de cada turno (nunca bloques tool_use/tool_result) para que
// recortar el historial nunca deje un tool_use colgando sin su
// resultado. "Conversación nueva" = más de 2 horas sin actividad. ──
const MAX_MENSAJES_SESION = 12; // últimos 6 intercambios usuario/bot
const VENTANA_SESION_MS = 2 * 60 * 60 * 1000; // 2 horas

type PropuestaTarea =
  | { accion: "crear_tarea"; obra_id: string; obra_nombre: string; tarea_texto: string }
  | { accion: "cambiar_estado_tarea"; tarea_id: string; tarea_texto: string; obra: string; nuevo_estado: string }
  | { accion: "eliminar_tarea"; tarea_id: string; tarea_texto: string; obra: string };

type TareaMostrada = { id: string; tarea: string; obraNombre: string; status: string };

type Contexto = { tareas_mostradas?: TareaMostrada[] } & Partial<PropuestaTarea>;

type SesionCargada = {
  mensajes: Anthropic.MessageParam[];
  esNueva: boolean;
  estado: string;
  contexto: Contexto;
};

async function cargarSesion(supabase: any, phoneE164: string): Promise<SesionCargada> {
  const { data, error } = await supabase
    .from("whatsapp_sesiones")
    .select("mensajes, ultima_actividad, estado, contexto")
    .eq("phone_e164", phoneE164)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { mensajes: [], esNueva: true, estado: "idle", contexto: {} };
  const esNueva = Date.now() - new Date(data.ultima_actividad).getTime() > VENTANA_SESION_MS;
  if (esNueva) return { mensajes: [], esNueva: true, estado: "idle", contexto: {} };
  return {
    mensajes: data.mensajes as Anthropic.MessageParam[],
    esNueva: false,
    estado: (data.estado as string) || "idle",
    contexto: (data.contexto as Contexto) || {},
  };
}

async function guardarSesion(
  supabase: any,
  phoneE164: string,
  whatsappUserId: string,
  mensajes: Anthropic.MessageParam[],
  estado: string,
  contexto: Contexto,
) {
  const recortados = mensajes.length > MAX_MENSAJES_SESION ? mensajes.slice(-MAX_MENSAJES_SESION) : mensajes;
  const { error } = await supabase
    .from("whatsapp_sesiones")
    .upsert({
      phone_e164: phoneE164,
      whatsapp_user_id: whatsappUserId,
      mensajes: recortados,
      estado,
      contexto,
      ultima_actividad: new Date().toISOString(),
    });
  if (error) console.error("whatsapp-agente: error guardando sesión", error);
}

// ── Propuestas de tareas: nunca ejecutan el INSERT/UPDATE directo ──
// Llamadas desde el loop de tool-use cuando el modelo invoca crear_tarea o
// cambiar_estado_tarea. Devuelven el texto a relayar + (si corresponde)
// la "propuesta" que se guarda en la sesión, pendiente de confirmación.
async function prepararCrearTarea(supabase: any, empresaId: string, input: Record<string, unknown>) {
  const tareaTexto = typeof input.tarea === "string" ? input.tarea.trim() : "";
  const obraNombre = typeof input.obraNombre === "string" ? input.obraNombre.trim() : "";
  if (!tareaTexto || !obraNombre) {
    return { mensaje: "Me falta el texto de la tarea o el nombre de la obra." };
  }

  const resuelto = await resolverObraId(supabase, empresaId, obraNombre);
  if (resuelto.ids.length === 0) {
    const sugerencias = (resuelto as any).sugerencias?.join(", ") || "ninguna obra cargada";
    return { mensaje: `No encontré ninguna obra parecida a "${obraNombre}". Las obras de la empresa son: ${sugerencias}.` };
  }
  if (resuelto.ids.length > 1) {
    return { mensaje: `Encontré varias obras parecidas a "${obraNombre}": ${resuelto.nombres.join(", ")}. ¿Cuál es?` };
  }

  const obraId = resuelto.ids[0];
  const obraNombreReal = resuelto.nombres[0];
  const propuesta: PropuestaTarea = { accion: "crear_tarea", obra_id: obraId, obra_nombre: obraNombreReal, tarea_texto: tareaTexto };
  return { mensaje: `¿Confirmás crear la tarea "${tareaTexto}" en ${obraNombreReal}? Respondé SÍ o NO.`, propuesta };
}

function prepararCambiarEstadoTarea(input: Record<string, unknown>, tareasMostradas: TareaMostrada[]) {
  const tareaId = typeof input.tareaId === "string" ? input.tareaId : "";
  const nuevoEstado = typeof input.nuevoEstado === "string" ? input.nuevoEstado : "";
  if (!tareaId || (nuevoEstado !== "pendiente" && nuevoEstado !== "finalizado")) {
    return { mensaje: "Falta el id de la tarea o el estado no es válido." };
  }
  const tarea = tareasMostradas.find((t) => t.id === tareaId);
  if (!tarea) {
    return { mensaje: "Esa tarea no está entre los últimos resultados de esta conversación — buscala de nuevo con buscar_tareas primero." };
  }
  if (tarea.status === nuevoEstado) {
    return { mensaje: `"${tarea.tarea}" ya está ${nuevoEstado === "finalizado" ? "finalizada" : "pendiente"} — no hay nada que cambiar.` };
  }
  const propuesta: PropuestaTarea = {
    accion: "cambiar_estado_tarea", tarea_id: tareaId, tarea_texto: tarea.tarea, obra: tarea.obraNombre, nuevo_estado: nuevoEstado,
  };
  const verbo = nuevoEstado === "finalizado" ? "finalizada" : "pendiente";
  return { mensaje: `¿Confirmás marcar "${tarea.tarea}" (obra: ${tarea.obraNombre}) como ${verbo}? Respondé SÍ o NO.`, propuesta };
}

function prepararEliminarTarea(input: Record<string, unknown>, tareasMostradas: TareaMostrada[]) {
  const tareaId = typeof input.tareaId === "string" ? input.tareaId : "";
  if (!tareaId) return { mensaje: "Falta el id de la tarea a eliminar." };
  const tarea = tareasMostradas.find((t) => t.id === tareaId);
  if (!tarea) {
    return { mensaje: "Esa tarea no está entre los últimos resultados de esta conversación — buscala de nuevo con buscar_tareas primero." };
  }
  const propuesta: PropuestaTarea = { accion: "eliminar_tarea", tarea_id: tareaId, tarea_texto: tarea.tarea, obra: tarea.obraNombre };
  return { mensaje: `¿Confirmás ELIMINAR la tarea "${tarea.tarea}" (obra: ${tarea.obraNombre})? Esto no se puede deshacer. Respondé SÍ o NO.`, propuesta };
}

// ── Ejecución real — SOLO se llama desde el chequeo de confirmación por
// código en procesarMensaje, nunca desde el loop de tool-use del modelo. ──
async function ejecutarPropuestaConfirmada(supabase: any, empresaId: string, contexto: Contexto): Promise<string> {
  if (contexto.accion === "crear_tarea") {
    const { error } = await supabase.from("tasks").insert({
      empresa_id: empresaId, obra_id: (contexto as any).obra_id, tarea: (contexto as any).tarea_texto, status: "pendiente",
    });
    if (error) {
      console.error("whatsapp-agente: error creando tarea", error);
      return "Hubo un error creando la tarea. Probá de nuevo.";
    }
    return `Listo, tarea creada en ${(contexto as any).obra_nombre}.`;
  }
  if (contexto.accion === "cambiar_estado_tarea") {
    const nuevoEstado = (contexto as any).nuevo_estado as string;
    const updates = nuevoEstado === "finalizado"
      ? { status: "finalizado", completed_at: new Date().toISOString() }
      : { status: "pendiente", completed_at: null };
    const { error, data } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", (contexto as any).tarea_id)
      .eq("empresa_id", empresaId) // nunca confiar solo en el id — service_role sortea RLS
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("whatsapp-agente: error actualizando tarea", error);
      return "Hubo un error actualizando la tarea. Probá de nuevo.";
    }
    if (!data) return "No encontré esa tarea en tu empresa — probá buscarla de nuevo.";
    return `Listo, tarea marcada como ${nuevoEstado === "finalizado" ? "finalizada" : "pendiente"}.`;
  }
  if (contexto.accion === "eliminar_tarea") {
    const { error, data } = await supabase
      .from("tasks")
      .delete()
      .eq("id", (contexto as any).tarea_id)
      .eq("empresa_id", empresaId) // nunca confiar solo en el id — service_role sortea RLS
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("whatsapp-agente: error eliminando tarea", error);
      return "Hubo un error eliminando la tarea. Probá de nuevo.";
    }
    if (!data) return "No encontré esa tarea en tu empresa — probá buscarla de nuevo.";
    return "Listo, tarea eliminada.";
  }
  return "No tengo ningún cambio pendiente para confirmar.";
}

function fechaChile(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(d);
}

function listarHerramientas(tools: Anthropic.Tool[]): string {
  return tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");
}

// ── Firma del webhook (X-Hub-Signature-256) ─────────────────────
async function verificarFirmaMeta(rawBody: string, signatureHeader: string | null, appSecret: string): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const esperado = signatureHeader.slice("sha256=".length).toLowerCase();
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const firma = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const calculado = Array.from(new Uint8Array(firma)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (calculado.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < calculado.length; i++) diff |= calculado.charCodeAt(i) ^ esperado.charCodeAt(i);
  return diff === 0;
}

// ── Resolver acceso: número → user_id/empresa_id/rol, fijo para toda la conversación ──
// El rol REAL multi-tenant vive en user_companies.rol, no en users.rol
// (users.rol es legacy/global y puede estar desalineado — mismo gotcha que
// el bug histórico de is_dueno(), ver memoria del proyecto). Trabajador
// (o sin membresía real en la empresa declarada) se trata igual que
// "no registrado": mismo criterio que PERMISOS.trabajador.soloAsistencia
// en AuthContext.jsx.
async function resolverAcceso(supabase: any, phoneE164: string) {
  const { data: wu, error: wuErr } = await supabase
    .from("whatsapp_users")
    .select("id, user_id, empresa_id, activo")
    .eq("phone_e164", phoneE164)
    .maybeSingle();
  if (wuErr) throw wuErr;
  if (!wu || !wu.activo) return null;

  const { data: uc, error: ucErr } = await supabase
    .from("user_companies")
    .select("rol, users(nombre), companies(nombre)")
    .eq("user_id", wu.user_id)
    .eq("empresa_id", wu.empresa_id)
    .maybeSingle();
  if (ucErr) throw ucErr;
  if (!uc || uc.rol === "trabajador") return null;

  return {
    whatsappUserId: wu.id as string,
    userId: wu.user_id as string,
    empresaId: wu.empresa_id as string,
    rol: uc.rol as string,
    nombreUsuario: (uc.users?.nombre as string) || "usuario",
    empresaNombre: (uc.companies?.nombre as string) || "tu empresa",
  };
}

// ── Envío de respuesta vía Graph API de Meta ────────────────────
async function enviarWhatsApp(to: string, texto: string, phoneNumberId: string, accessToken: string) {
  try {
    const resp = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: texto } }),
    });
    if (!resp.ok) {
      console.error("whatsapp-agente: error enviando respuesta por Graph API", resp.status, await resp.text());
    }
  } catch (err) {
    console.error("whatsapp-agente: excepción enviando respuesta por Graph API", err);
  }
}

function systemPromptWhatsApp(
  hoy: string,
  nombreUsuario: string,
  rol: string,
  empresaNombre: string,
  esSesionNueva: boolean,
  toolsActivas: Anthropic.Tool[],
) {
  const tieneResumen = rol === "dueno";
  return `# Identidad
Sos el asistente de WhatsApp de VAION para ${empresaNombre}. Hablás con ${nombreUsuario}, rol ${rol}. Tu trabajo es responder consultas sobre obras, egresos, documentos, cuentas y tareas${tieneResumen ? ", y resumen financiero" : ""} — todo con datos reales de la plataforma, nunca inventados.

Fecha de hoy: ${hoy}.

# Cómo hablar (WhatsApp, celular, en terreno)
- Respuestas cortas: 3-4 líneas salvo que el dato pedido sea una lista.
- Sin saludo ni presentación en cada mensaje — ${esSesionNueva ? "ESTE es el primer mensaje de una conversación nueva (más de 2 horas sin hablar), así que sí correspondería presentarte" : "esta conversación ya viene de antes, NO te presentes de nuevo"} — salvo que el usuario salude explícitamente ("hola", "buenas"), ahí respondé el saludo.
- Nunca repitas la lista de lo que podés hacer a menos que el usuario esté perdido (mensaje que no matchea ninguna intención reconocible) o la pida explícitamente ("qué podés hacer", "ayuda").
- Sin relleno corporativo ("¡Claro que sí!", "¡Con gusto te ayudo!"). Directo al dato.
- Texto plano, nada de markdown ni asteriscos, salvo *así* (negrita de WhatsApp) para destacar el dato más importante de un registro (ver formato abajo).
- Si el usuario responde con un número suelto (ej. "1") sin que vos hayas mostrado una lista numerada en tu mensaje anterior, tratalo como mensaje ambiguo — no asumas que se refiere a un menú que no mostraste.

${esSesionNueva ? `# Primer mensaje de esta conversación
Presentate en una frase y seguí directo, sin pedir que elija un número:
"Hola, soy el asistente de VAION. Preguntame por egresos, documentos, cuentas por cobrar/pagar, ventas adicionales, tareas${tieneResumen ? " o resumen financiero" : ""}. ¿Qué necesitás?"
Si su mensaje ya es una pregunta clara, respondela y no hace falta repetir la presentación completa.

` : ""}# Herramientas disponibles
Usá las tools para responder, nunca inventes cifras.
${listarHerramientas(toolsActivas)}

Para buscar por obra podés pasar el nombre (o parte del nombre) tal como lo escribió el usuario — la tool lo resuelve por coincidencia parcial. Si encuentra una sola obra parecida, usala directo sin pedir confirmación (ej. "quillayes" → "QUILLAYES 20"). Si el resultado trae "obraAmbigua", preguntale al usuario cuál de las coincidencias quiere decir. Si trae "obraNoEncontrada", decíselo y mostrale las obras sugeridas.

Categorías de egreso válidas (clave → nombre): ${JSON.stringify(CATEGORIAS_GASTO)}. Mapeá sinónimos del usuario (ej. "sueldos", "pago de personal" → sueldos; "mano de obra", "jornales" → mano_obra) a la clave exacta antes de llamar una tool.

# Formato de respuesta para registros y datos
Cuando la respuesta incluya un registro o una lista de registros (egresos, documentos, cuentas, tareas, etc.), NUNCA lo pongas todo en una sola línea separada por guiones. Usá saltos de línea, uno por dato relevante, y negrita de WhatsApp (*así*) solo en el monto o el dato más importante.

Para UN registro:
<fecha> · *<monto>* · <categoría>
<forma de pago>, <estado de pago>
<obra o "sin obra asignada">
<comprobante o "sin comprobante">

Para VARIOS registros (2 o más): numerá cada uno en una sola línea compacta por ítem, y cerrá con el total si aplica. No expandas cada uno en formato largo si son varios — se hace ilegible en el celular.

Omití un campo solo si de verdad no aplica al tipo de registro (una tarea no tiene "forma de pago", por ejemplo) — no omitas campos que sí existen aunque estén vacíos, decilos explícito ("sin obra asignada"), pero en su propia línea, no encadenados con "y".

# Acciones que cambian datos (crear_tarea, cambiar_estado_tarea, eliminar_tarea)
Estas dos tools NUNCA aplican el cambio directo — son propuestas. Llamalas apenas tengas los datos necesarios (no hace falta que vos le preguntes "confirmás" antes de llamarlas): el sistema arma la propuesta y te devuelve un mensaje de confirmación en el resultado de la tool. Tu única tarea ahí es **relayar ese mensaje tal cual al usuario, sin reformularlo**. La ejecución real (crear la tarea, cambiar el estado) la hace el sistema en el siguiente mensaje, cuando el usuario confirma — vos no volvés a llamar la tool para eso, solo seguís la conversación con naturalidad si el usuario pregunta algo más.

Para cambiar_estado_tarea y eliminar_tarea específicamente: primero llamá a buscar_tareas si todavía no sabés el id exacto de la tarea (nunca inventes un tareaId). eliminar_tarea es un borrado definitivo — no aclares de más ni agregues advertencias propias, la tool ya te devuelve un mensaje de confirmación que avisa que no se puede deshacer.

Si el usuario responde a una pregunta de confirmación con algo que no es un simple "sí"/"no" (ej. "no, mejor en la obra X" o "cambiale el texto a Y"), la propuesta anterior ya se canceló sola — entendé que te está corrigiendo, volvé a llamar la tool correspondiente con los datos ajustados y pedí confirmación de nuevo. No asumas que ya confirmó nada.

# Qué no hacer
- No muestres menús numerados para que el usuario elija — dejá que escriba en lenguaje natural.
- No saludes ni te reintroduzcas en cada respuesta.
- No mandes un registro completo en una sola línea con guiones — separá por saltos de línea, como en la sección de formato de arriba.
- No inventes datos si una tool no devuelve resultados — decilo explícito y sugerí ampliar el rango.
- No reformules ni "adelantes" el mensaje de confirmación de crear_tarea/cambiar_estado_tarea — relayalo tal cual lo devuelve la tool.
- Si la pregunta pide algo fuera de estas fuentes (ej. asistencia, sueldos por hora, cotizaciones), decilo explícito: "Eso no está disponible en este asistente todavía."
- Para cualquier suma, total o conteo de egresos, SIEMPRE llamá a sumar_egresos — nunca sumes vos los montos a mano.${tieneResumen ? "\n- Para Venta Total, CDO, MOD, GAV, Margen o Utilidad, SIEMPRE llamá a obtener_resumen_financiero — nunca calcules esos números combinando otras tools vos mismo." : ""}
- Nunca reveles IDs internos (UUID) en la respuesta, ni menciones datos de otra empresa.

# Ejemplos

Usuario (primer mensaje de una conversación nueva): "Hola"
Vos: "Hola, soy el asistente de VAION. Preguntame por egresos, documentos, cuentas, tareas${tieneResumen ? ", resumen financiero" : ""}. ¿Qué necesitás?"

Usuario: "quiero ver los egresos de quillayes en agosto"
[llamás a buscar_egresos con obraId="quillayes" y fechas de agosto — la tool resuelve el nombre parcial a la obra real]
Vos: "En QUILLAYES 20, agosto 2026: $X en Y egresos. ¿Querés el detalle?"

Usuario: "qué egresos tiene Ignacio Farías"
Vos: "Ignacio Farías — 1 egreso registrado

29-08-2026 · *$200.000* · Retiros
Contado, pagado
Sin obra asignada
Sin comprobante"

Usuario: "marca como lista la tarea de pedir fierro"
[llamás a buscar_tareas con texto "pedir fierro", encontrás 1 resultado. Llamás a cambiar_estado_tarea con ese tareaId y nuevoEstado "finalizado" — la tool te devuelve el mensaje de confirmación, no aplica el cambio todavía]
Vos: "¿Confirmás marcar "Pedir fierro" (obra: QUILLAYES 20) como finalizada? Respondé SÍ o NO."
[el sistema espera la respuesta del usuario en el siguiente mensaje — vos no hacés nada más acá]

Usuario: "quiero crear una tarea en quillayes: pedir cemento"
[llamás a crear_tarea con obraNombre "quillayes" y tarea "pedir cemento" — la tool resuelve la obra y te devuelve el mensaje de confirmación]
Vos: "¿Confirmás crear la tarea "pedir cemento" en QUILLAYES 20? Respondé SÍ o NO."

Usuario: "borrame la tarea de pedir fierro"
[llamás a buscar_tareas con texto "pedir fierro", encontrás 1 resultado. Llamás a eliminar_tarea con ese tareaId]
Vos: "¿Confirmás ELIMINAR la tarea "Pedir fierro" (obra: QUILLAYES 20)? Esto no se puede deshacer. Respondé SÍ o NO."

Usuario: "asdasd" (no matchea ninguna intención)
Vos: "No te entendí bien. Puedo ayudarte con egresos, documentos, cuentas, tareas${tieneResumen ? ", resumen financiero" : ""} — contame qué necesitás."`;
}

async function procesarMensaje(
  supabase: any,
  anthropic: Anthropic,
  from: string,
  texto: string,
  hoy: string,
  waPhoneId: string,
  waToken: string,
) {
  let acceso;
  try {
    acceso = await resolverAcceso(supabase, from);
  } catch (err) {
    console.error("whatsapp-agente: error resolviendo acceso", err);
    await enviarWhatsApp(from, "Hubo un error interno. Probá de nuevo en un momento.", waPhoneId, waToken);
    return;
  }

  if (!acceso) {
    console.log(`whatsapp-agente: número ${from} sin acceso (no registrado, inactivo o rol trabajador)`);
    await enviarWhatsApp(from, "No tenés acceso a este asistente. Contactá a tu administrador si creés que es un error.", waPhoneId, waToken);
    return;
  }

  const sesion = await cargarSesion(supabase, from);

  // ── Confirmación pendiente: la ejecución SIEMPRE se resuelve 100% por
  // código, nunca por el modelo — esto no cambia. Lo que sí admite ahora
  // es una tercera salida: si la respuesta no es un "sí"/"no" limpio,
  // puede ser una corrección ("no, mejor en la obra X") en vez de un
  // simple rechazo. En ese caso se cancela la propuesta vieja en
  // silencio y el mensaje sigue el flujo normal con el modelo más abajo
  // — que puede volver a proponer algo ajustado, siempre con una
  // confirmación nueva antes de ejecutar nada. ──
  if (sesion.estado === "esperando_confirmacion_tarea") {
    const normalizado = texto.trim().toLowerCase();
    const esAfirmativo = /^(s[ií]|dale|ok(ay)?|confirmo|correcto)\b/.test(normalizado);
    const esNegativoPuro = /^no[.!]?\s*$/.test(normalizado); // "no" solo, sin nada más

    if (esAfirmativo || esNegativoPuro) {
      const respuesta = esAfirmativo
        ? await ejecutarPropuestaConfirmada(supabase, acceso.empresaId, sesion.contexto)
        : "Listo, no se hizo ningún cambio.";

      await enviarWhatsApp(from, respuesta, waPhoneId, waToken);
      await guardarSesion(
        supabase, from, acceso.whatsappUserId,
        [...sesion.mensajes, { role: "user", content: texto }, { role: "assistant", content: respuesta }],
        "idle",
        { tareas_mostradas: sesion.contexto.tareas_mostradas ?? [] },
      );
      return;
    }

    // Ni sí ni no puro → probable corrección. Se cancela la propuesta
    // pendiente (nunca queda una ejecución colgada) y se sigue el flujo
    // normal de abajo con estado ya en 'idle'.
    sesion.estado = "idle";
    sesion.contexto = { tareas_mostradas: sesion.contexto.tareas_mostradas ?? [] };
  }

  const toolsBase = [...TOOLS_BUSQUEDA, TOOL_BUSCAR_TAREAS, TOOL_CREAR_TAREA, TOOL_CAMBIAR_ESTADO_TAREA, TOOL_ELIMINAR_TAREA];
  const toolsPermitidas = acceso.rol === "dueno" ? [...toolsBase, TOOL_RESUMEN_FINANCIERO] : toolsBase;
  const nombresPermitidos = new Set(toolsPermitidas.map((t) => t.name));

  const messages: Anthropic.MessageParam[] = [...sesion.mensajes, { role: "user", content: texto }];
  let respuestaTexto = "";
  let tareasMostradas: TareaMostrada[] = sesion.contexto.tareas_mostradas ?? [];
  let propuestaPendiente: PropuestaTarea | null = null;

  try {
    for (let ronda = 0; ronda < MAX_TOOL_ROUNDS; ronda++) {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPromptWhatsApp(hoy, acceso.nombreUsuario, acceso.rol, acceso.empresaNombre, sesion.esNueva, toolsPermitidas),
        tools: toolsPermitidas,
        messages,
      });
      messages.push({ role: "assistant", content: resp.content });

      const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (toolUses.length === 0) {
        respuestaTexto = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        if (!nombresPermitidos.has(tu.name)) {
          // No debería pasar (la tool ni se expuso al modelo) — defensa extra
          // por si el rol se resolvió a último momento distinto de lo esperado.
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: "Tool no disponible para tu rol." });
          continue;
        }

        // crear_tarea/cambiar_estado_tarea: nunca pasan por ejecutarTool —
        // se resuelven acá como PROPUESTA, nunca como ejecución directa.
        if (tu.name === "crear_tarea") {
          const r = await prepararCrearTarea(supabase, acceso.empresaId, tu.input as Record<string, unknown>);
          if (r.propuesta) propuestaPendiente = r.propuesta;
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify({ mensaje: r.mensaje }) });
          continue;
        }
        if (tu.name === "cambiar_estado_tarea") {
          const r = prepararCambiarEstadoTarea(tu.input as Record<string, unknown>, tareasMostradas);
          if (r.propuesta) propuestaPendiente = r.propuesta;
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify({ mensaje: r.mensaje }) });
          continue;
        }
        if (tu.name === "eliminar_tarea") {
          const r = prepararEliminarTarea(tu.input as Record<string, unknown>, tareasMostradas);
          if (r.propuesta) propuestaPendiente = r.propuesta;
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify({ mensaje: r.mensaje }) });
          continue;
        }

        try {
          const result = await ejecutarTool(supabase, tu.name, tu.input as Record<string, unknown>, { empresaId: acceso.empresaId });
          if (tu.name === "buscar_tareas") {
            tareasMostradas = (result.rows ?? []).map((r: any) => ({
              id: r.id, tarea: r.tarea, obraNombre: r.projects?.nombre ?? "sin obra asignada", status: r.status,
            }));
          }
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
        } catch (toolErr) {
          toolResults.push({
            type: "tool_result", tool_use_id: tu.id, is_error: true,
            content: `Error ejecutando la búsqueda: ${String(toolErr)}`,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });

      if (ronda === MAX_TOOL_ROUNDS - 1) {
        respuestaTexto = "No pude terminar de resolver la pregunta — probá acotarla más (con obra, fecha o proveedor).";
      }
    }
  } catch (err) {
    console.error("whatsapp-agente: error de Anthropic", err);
    respuestaTexto = "El asistente no pudo responder ahora mismo. Probá de nuevo en un momento.";
  }

  const respuestaFinal = respuestaTexto || "No pude generar una respuesta. Probá de nuevo.";
  await enviarWhatsApp(from, respuestaFinal, waPhoneId, waToken);

  // Guardar el intercambio limpio (solo texto) en la sesión — nunca los
  // bloques tool_use/tool_result de la ronda, ver comentario arriba.
  const nuevoContexto: Contexto = { tareas_mostradas: tareasMostradas, ...(propuestaPendiente ?? {}) };
  await guardarSesion(
    supabase, from, acceso.whatsappUserId,
    [...sesion.mensajes, { role: "user", content: texto }, { role: "assistant", content: respuestaFinal }],
    propuestaPendiente ? "esperando_confirmacion_tarea" : "idle",
    nuevoContexto,
  );
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // ── Verificación del webhook (handshake inicial de Meta) ──
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    if (mode === "subscribe" && verifyToken && token === verifyToken) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
  if (!appSecret) {
    console.error("whatsapp-agente: falta WHATSAPP_APP_SECRET");
    return new Response("Server misconfigured", { status: 500 });
  }

  // Body crudo primero — la firma se calcula sobre los bytes exactos
  // recibidos, no sobre el JSON re-serializado.
  const rawBody = await req.text();
  const firmaValida = await verificarFirmaMeta(rawBody, req.headers.get("X-Hub-Signature-256"), appSecret);
  if (!firmaValida) {
    console.warn("whatsapp-agente: firma inválida, mensaje descartado sin procesar");
    return new Response("Firma inválida", { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Body inválido", { status: 400 });
  }

  const mensajes: Array<{ from: string; id: string; texto: string | null }> = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const msg of change?.value?.messages ?? []) {
        mensajes.push({
          from: String(msg.from),
          id: String(msg.id),
          texto: msg.type === "text" ? String(msg.text?.body ?? "") : null,
        });
      }
    }
  }

  // Sin mensajes de usuario (ej. status de entrega/lectura) — ack sin procesar.
  if (mensajes.length === 0) return new Response("EVENT_RECEIVED", { status: 200 });

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const waToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const waPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!anthropicKey || !waToken || !waPhoneId) {
    console.error("whatsapp-agente: faltan secrets requeridos (ANTHROPIC_API_KEY / WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)");
    return new Response("Server misconfigured", { status: 500 });
  }

  // service_role — sin JWT de usuario que RLS pueda evaluar. Cada query de
  // ejecutarTool recibe empresaId explícito para acotar (ver _shared).
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const anthropic = new Anthropic({ apiKey: anthropicKey, timeout: 30000 });
  const hoy = fechaChile();

  for (const m of mensajes) {
    if (yaProcesado(m.id)) {
      console.log(`whatsapp-agente: mensaje ${m.id} ya procesado, ignorando reintento`);
      continue;
    }
    if (m.texto === null) {
      await enviarWhatsApp(m.from, "Por ahora solo puedo leer mensajes de texto.", waPhoneId, waToken);
      continue;
    }
    await procesarMensaje(supabase, anthropic, m.from, m.texto, hoy, waPhoneId, waToken);
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
});
