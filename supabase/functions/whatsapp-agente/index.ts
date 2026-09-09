// Piloto interno del agente de WhatsApp — Fase 1 (solo lectura).
// A diferencia de asistente-busqueda (JWT de usuario, RLS filtra), acá no
// hay sesión de Supabase — un mensaje de WhatsApp no trae JWT. La única
// verificación de identidad es la firma HMAC del webhook (dueña de Meta) +
// el número de origen contra whatsapp_users. empresa_id y rol se resuelven
// UNA VEZ server-side (resolverAcceso) y quedan fijos para toda la
// conversación — nunca se infieren del mensaje ni los decide el modelo.
// Cliente Supabase con service_role: única excepción del proyecto, cada
// query fuerza el filtro de empresa explícito (ver _shared/asistente-tools.ts).
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.68";
import { CATEGORIAS_GASTO, TOOLS_BUSQUEDA, TOOL_RESUMEN_FINANCIERO, ejecutarTool } from "../_shared/asistente-tools.ts";

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
    .select("user_id, empresa_id, activo")
    .eq("phone_e164", phoneE164)
    .maybeSingle();
  if (wuErr) throw wuErr;
  if (!wu || !wu.activo) return null;

  const { data: uc, error: ucErr } = await supabase
    .from("user_companies")
    .select("rol")
    .eq("user_id", wu.user_id)
    .eq("empresa_id", wu.empresa_id)
    .maybeSingle();
  if (ucErr) throw ucErr;
  if (!uc || uc.rol === "trabajador") return null;

  return { userId: wu.user_id as string, empresaId: wu.empresa_id as string, rol: uc.rol as string };
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

function systemPromptWhatsApp(hoy: string, rol: string) {
  const tieneResumen = rol === "dueno";
  return `Sos el asistente interno de VAION por WhatsApp — piloto Fase 1. Respondés en español de Chile, corto y directo, en TEXTO PLANO (esto se lee en WhatsApp, nada de markdown ni asteriscos).

Fecha de hoy: ${hoy}. Rol de quien te escribe: ${rol}.

Categorías de egreso válidas (clave → nombre): ${JSON.stringify(CATEGORIAS_GASTO)}. Mapeá sinónimos del usuario (ej. "sueldos", "pago de personal" → sueldos; "mano de obra", "jornales" → mano_obra) a la clave exacta antes de llamar una tool.

Reglas estrictas:
- Tenés tools de búsqueda: egresos, documentos, cuentas por pagar, cuentas por cobrar, ventas adicionales.${tieneResumen ? " Además tenés obtener_resumen_financiero (Venta Total, CDO, MOD, GAV, Margen/Utilidad de una obra o de toda la empresa)." : ""}
- Si la pregunta pide algo fuera de estas fuentes (ej. asistencia, sueldos por hora, cotizaciones), decilo explícito: "Eso no está disponible en este asistente todavía." No inventes.
- Para cualquier suma, total o conteo de egresos, SIEMPRE llamá a sumar_egresos — nunca sumes vos los montos a mano.${tieneResumen ? "\n- Para Venta Total, CDO, MOD, GAV, Margen o Utilidad, SIEMPRE llamá a obtener_resumen_financiero — nunca calcules esos números combinando otras tools vos mismo." : ""}
- Si una búsqueda no da resultados, decilo explícito y sugerí ampliar el rango — no aproximes ni inventes.
- Nunca reveles IDs internos (UUID) en la respuesta, ni menciones datos de otra empresa.
- Respuesta final en 2-4 líneas como máximo, texto plano.`;
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

  const toolsPermitidas = acceso.rol === "dueno" ? [...TOOLS_BUSQUEDA, TOOL_RESUMEN_FINANCIERO] : TOOLS_BUSQUEDA;
  const nombresPermitidos = new Set(toolsPermitidas.map((t) => t.name));

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: texto }];
  let respuestaTexto = "";

  try {
    for (let ronda = 0; ronda < MAX_TOOL_ROUNDS; ronda++) {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPromptWhatsApp(hoy, acceso.rol),
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
        try {
          const result = await ejecutarTool(supabase, tu.name, tu.input as Record<string, unknown>, { empresaId: acceso.empresaId });
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

  await enviarWhatsApp(from, respuestaTexto || "No pude generar una respuesta. Probá de nuevo.", waPhoneId, waToken);
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
  const hoy = new Date().toISOString().split("T")[0];

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
