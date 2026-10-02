// Módulo compartido entre asistente-busqueda (chat in-app, cliente con JWT
// de usuario, RLS es la única línea de defensa) y whatsapp-agente (cliente
// service_role, sin JWT de usuario — el empresa_id se resuelve server-side
// y se pasa explícito acá, nunca se confía en RLS).
//
// `ejecutarTool(supabase, name, input, opts)`:
// - Sin `opts.empresaId` (uso de asistente-busqueda): comportamiento
//   idéntico al original, RLS filtra por empresa vía el JWT del cliente.
// - Con `opts.empresaId` (uso de whatsapp-agente): además de los filtros
//   normales, cada query fuerza `.eq('empresa_id', empresaId)` (o su
//   equivalente vía project_id para additional_sales, que no tiene columna
//   empresa_id propia) — defensa explícita porque service_role sortea RLS.
import type Anthropic from "npm:@anthropic-ai/sdk@0.68";

export const MAX_ROWS = 50;
export const MAX_SUM_ROWS = 5000; // tope de seguridad para sumar_egresos, no de negocio

// `attendance.entrada` es timestamptz (UTC en la base) — nunca devolverlo
// crudo a un modelo, el modelo no convierte huso horario de forma
// confiable. Se formatea acá, server-side, a HH:MM hora de Chile, mismo
// criterio que usa el kiosco (Asistencia.jsx, toLocaleTimeString('es-CL')).
function horaChile(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

export const CATEGORIAS_GASTO = {
  materiales: "Materiales", subcontratos: "Subcontratos", equipos: "Equipos",
  aridos: "Áridos", retiro_escombros: "Retiro escombros", banio_quimico: "Baño químico",
  flete: "Flete", otros_operacion: "Otros (operación)", sueldos: "Sueldos",
  publicidad: "Publicidad", marketing: "Marketing", bencina: "Bencina",
  herramientas: "Herramientas", arriendo: "Arriendo", cuentas: "Cuentas",
  retiros: "Retiros", imposiciones: "Imposiciones", iva: "IVA", autopistas: "Autopistas",
  otros: "Otros", mano_obra: "Mano de obra",
  transporte: "Transporte (legacy)",
};

// ── Filtros comunes ─────────────────────────────────────────────
export function aplicarFiltrosBase(query: any, f: Record<string, unknown>, cols: {
  obra?: string; proveedor?: string; categoria?: string; fecha?: string;
  monto?: string; estado?: string; medioPago?: string;
}) {
  if (cols.obra && f.obraId) query = query.eq(cols.obra, f.obraId);
  if (cols.proveedor && f.proveedor) query = query.ilike(cols.proveedor, `%${f.proveedor}%`);
  if (cols.categoria && f.categoria) query = query.eq(cols.categoria, f.categoria);
  if (cols.fecha && f.fechaDesde) query = query.gte(cols.fecha, f.fechaDesde);
  if (cols.fecha && f.fechaHasta) query = query.lte(cols.fecha, f.fechaHasta);
  if (cols.monto && f.montoMin != null) query = query.gte(cols.monto, f.montoMin);
  if (cols.monto && f.montoMax != null) query = query.lte(cols.monto, f.montoMax);
  if (cols.estado && f.estado) query = query.eq(cols.estado, f.estado);
  if (cols.medioPago && f.medioPago) query = query.eq(cols.medioPago, f.medioPago);
  return query;
}

// ── Definición de las tools ───────────────────────────────────
const OBRA_ID_DESC = "UUID de la obra, o directamente su nombre (o parte del nombre) si no conocés el UUID — se resuelve por coincidencia parcial antes de buscar.";

const FILTROS_EGRESOS_SCHEMA = {
  obraId: { type: "string", description: OBRA_ID_DESC },
  categoria: { type: "string", description: `Una de: ${Object.keys(CATEGORIAS_GASTO).join(", ")}` },
  proveedor: { type: "string", description: "Nombre del proveedor (búsqueda parcial)" },
  fechaDesde: { type: "string", description: "Fecha ISO YYYY-MM-DD" },
  fechaHasta: { type: "string", description: "Fecha ISO YYYY-MM-DD" },
  montoMin: { type: "number" },
  montoMax: { type: "number" },
  medioPago: { type: "string", enum: ["contado", "credito"] },
  estado: { type: "string", enum: ["pendiente", "pagado", "vencido"] },
};

// Las 7 tools del asistente in-app. Disponibles para cualquier rol
// autorizado (dueño o administrativo) en ambos canales.
export const TOOLS_BUSQUEDA: Anthropic.Tool[] = [
  {
    name: "buscar_egresos",
    description: "Busca egresos (gastos) de la empresa. Devuelve hasta 50 filas con proveedor, monto, fecha, categoría, obra y link a comprobante si tiene.",
    input_schema: { type: "object", properties: FILTROS_EGRESOS_SCHEMA },
  },
  {
    name: "sumar_egresos",
    description: "Suma y cuenta egresos que cumplan los filtros dados. Usar SIEMPRE esta tool (nunca sumar a mano) cuando la pregunta pida un total, promedio o conteo de egresos.",
    input_schema: { type: "object", properties: FILTROS_EGRESOS_SCHEMA },
  },
  {
    name: "buscar_documentos",
    description: "Busca documentos/archivos subidos (facturas, boletas, contratos, fotos, permisos, comprobantes). Devuelve hasta 50 filas.",
    input_schema: {
      type: "object",
      properties: {
        obraId: { type: "string", description: OBRA_ID_DESC },
        tipo: { type: "string", enum: ["factura", "boleta", "contrato", "cotizacion", "foto", "permiso", "comprobante"] },
        proveedor: { type: "string" },
        categoria: { type: "string" },
        fechaDesde: { type: "string" },
        fechaHasta: { type: "string" },
        montoMin: { type: "number" },
        montoMax: { type: "number" },
        textoLibre: { type: "string", description: "Busca coincidencia parcial en el nombre del documento" },
      },
    },
  },
  {
    name: "buscar_cuentas_por_pagar",
    description: "Busca cuentas por pagar (créditos con proveedores, egresos a plazo). Devuelve hasta 50 filas.",
    input_schema: {
      type: "object",
      properties: {
        obraId: { type: "string", description: OBRA_ID_DESC },
        proveedor: { type: "string" },
        estado: { type: "string", enum: ["pendiente", "pagado", "vencido"] },
        fechaVencimientoDesde: { type: "string" },
        fechaVencimientoHasta: { type: "string" },
      },
    },
  },
  {
    name: "buscar_cuentas_por_cobrar",
    description: "Busca cuentas por cobrar (dinero que clientes deben por una obra). Devuelve hasta 50 filas.",
    input_schema: {
      type: "object",
      properties: {
        obraId: { type: "string", description: OBRA_ID_DESC },
        clientId: { type: "string" },
        estado: { type: "string" },
      },
    },
  },
  {
    name: "buscar_ventas_adicionales",
    description: "Busca ventas/trabajos adicionales cotizados sobre una obra (fuera del presupuesto original). Devuelve hasta 50 filas.",
    input_schema: {
      type: "object",
      properties: {
        obraId: { type: "string", description: OBRA_ID_DESC },
        tipo: { type: "string" },
      },
    },
  },
  {
    name: "buscar_asistencia_activa",
    description: "Devuelve los trabajadores que tienen el turno abierto ahora mismo (marcaron 'Llegué' en el kiosco y todavía no 'Me voy'), con la obra y la hora de entrada. El campo 'entrada' ya viene formateado como HH:MM en hora de Chile — relayalo tal cual, NUNCA lo recalcules ni asumas que está en UTC. Usar para preguntas tipo '¿quién está en obra ahora?' o '¿cuánta gente hay en la obra X ahora mismo?'. No sirve para historial de días pasados.",
    input_schema: {
      type: "object",
      properties: {
        obraId: { type: "string", description: OBRA_ID_DESC },
      },
    },
  },
];

// Tool extra — solo para rol dueño (in-app no la usa; whatsapp-agente la
// agrega al set de tools únicamente cuando el rol resuelto es 'dueno').
export const TOOL_RESUMEN_FINANCIERO: Anthropic.Tool = {
  name: "obtener_resumen_financiero",
  description: "Devuelve el resumen financiero (Venta Total, CDO, MOD, GAV, Margen/Utilidad) de una obra puntual, o de toda la empresa si no se indica obraId. Todos los cálculos se hacen en el backend con las fórmulas oficiales — nunca calcules esto vos mismo a partir de otras tools.",
  input_schema: {
    type: "object",
    properties: {
      obraId: { type: "string", description: `${OBRA_ID_DESC} Si se omite, devuelve el resumen de toda la empresa.` },
    },
  },
};

// Tools de tareas (Control y Gestión) — igual alcance de permisos que las
// de TOOLS_BUSQUEDA (cualquier rol autorizado, dueño o administrativo; la
// página web tampoco restringe esto solo a dueño).
//
// crear_tarea, cambiar_estado_tarea y eliminar_tarea son PROPUESTAS, no
// ejecuciones: al llamarlas, whatsapp-agente NO inserta/actualiza/borra
// nada en `tasks` — arma una "propuesta" pendiente en whatsapp_sesiones y
// le devuelve al modelo el texto de confirmación para que lo relaye tal
// cual. La ejecución real solo ocurre cuando el código (no el modelo)
// detecta una respuesta afirmativa al mensaje siguiente. Ver
// whatsapp-agente/index.ts — estas 3 tools NO tienen case en ejecutarTool
// a propósito, así que si algo las invoca fuera de ese flujo, fallan con
// "Tool desconocida" en vez de mutar datos sin confirmación.
export const TOOL_BUSCAR_TAREAS: Anthropic.Tool = {
  name: "buscar_tareas",
  description: "Busca tareas de Control y Gestión. Devuelve hasta 15 filas con id, tarea, obra, estado (pendiente/finalizado) y fecha de completado si aplica. Si totalCount es mayor a las filas devueltas, pedile al usuario que acote la búsqueda.",
  input_schema: {
    type: "object",
    properties: {
      obraId: { type: "string", description: OBRA_ID_DESC },
      estado: { type: "string", enum: ["pendiente", "finalizado"] },
      texto: { type: "string", description: "Busca coincidencia parcial en el texto de la tarea" },
    },
  },
};

export const TOOL_CREAR_TAREA: Anthropic.Tool = {
  name: "crear_tarea",
  description: "Propone crear una tarea nueva en una obra. Llamala apenas tengas el texto de la tarea y el nombre de la obra (no hace falta el UUID, se resuelve solo) — el sistema pide confirmación antes de crearla de verdad. Relayá el mensaje que te devuelve tal cual, no lo reformules.",
  input_schema: {
    type: "object",
    properties: {
      obraNombre: { type: "string", description: "Nombre (o parte del nombre) de la obra donde va la tarea." },
      tarea: { type: "string", description: "Texto de la tarea a crear." },
    },
    required: ["obraNombre", "tarea"],
  },
};

export const TOOL_CAMBIAR_ESTADO_TAREA: Anthropic.Tool = {
  name: "cambiar_estado_tarea",
  description: "Propone cambiar el estado de UNA tarea puntual (con el id exacto que devolvió buscar_tareas) a 'pendiente' o 'finalizado'. Llamala apenas el usuario pida el cambio — el sistema pide confirmación antes de aplicarlo de verdad. Relayá el mensaje que te devuelve tal cual, no lo reformules.",
  input_schema: {
    type: "object",
    properties: {
      tareaId: { type: "string", description: "UUID exacto de la tarea, tal como lo devolvió buscar_tareas — nunca lo inventes." },
      nuevoEstado: { type: "string", enum: ["pendiente", "finalizado"] },
    },
    required: ["tareaId", "nuevoEstado"],
  },
};

export const TOOL_ELIMINAR_TAREA: Anthropic.Tool = {
  name: "eliminar_tarea",
  description: "Propone eliminar UNA tarea puntual (con el id exacto que devolvió buscar_tareas) — borrado definitivo, no se puede deshacer. Llamala apenas el usuario lo pida — el sistema pide confirmación antes de borrar de verdad. Relayá el mensaje que te devuelve tal cual, no lo reformules.",
  input_schema: {
    type: "object",
    properties: {
      tareaId: { type: "string", description: "UUID exacto de la tarea, tal como lo devolvió buscar_tareas — nunca lo inventes." },
    },
    required: ["tareaId"],
  },
};

// Logging de uso de tokens (costo del asistente) — compartido entre los
// dos canales para no duplicar la llamada a la RPC. Nunca lanza: un fallo
// acá no debe romper la respuesta real al usuario (mismo criterio que
// log_app_error, que también se traga sus propios errores).
export async function logUsoAsistente(
  supabase: any,
  canal: "in-app" | "whatsapp",
  inputTokens: number,
  outputTokens: number,
  empresaId?: string,
) {
  try {
    await supabase.rpc("log_asistente_uso", {
      p_canal: canal,
      p_model: Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-5",
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_empresa_id: empresaId ?? null,
    });
  } catch (err) {
    console.error("logUsoAsistente: no se pudo registrar el uso", err);
  }
}

type EmpresaScope = { empresaId?: string };

// Ids de obras de la empresa — único caso (additional_sales) sin columna
// empresa_id propia, necesita resolverse vía project_id.
async function proyectoIdsDeEmpresa(supabase: any, empresaId: string): Promise<string[]> {
  const { data, error } = await supabase.from("projects").select("id").eq("empresa_id", empresaId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.id);
}

// ── Resolución de obra por nombre parcial ──────────────────────
// Todas las tools reciben `obraId` tipado como string libre (el modelo no
// siempre tiene el UUID a mano, solo el nombre que escribió el usuario).
// Si lo que llega no es un UUID, se busca por ILIKE en projects.nombre
// antes de filtrar — así "quillayes" resuelve a "QUILLAYES 20" sin que el
// modelo necesite conocer el id de antemano.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Exportada para que whatsapp-agente la reuse en crear_tarea (resolución
// de obra por nombre, misma lógica que el resto de las tools).
export async function resolverObraId(supabase: any, empresaId: string | undefined, texto: string) {
  let q = supabase.from("projects").select("id, nombre").ilike("nombre", `%${texto}%`);
  if (empresaId) q = q.eq("empresa_id", empresaId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length > 0) return { ids: rows.map((r: any) => r.id), nombres: rows.map((r: any) => r.nombre) };

  // Sin coincidencias — devolver las obras existentes como sugerencia,
  // para que el modelo pueda orientar al usuario en vez de decir "no existe".
  let qTodas = supabase.from("projects").select("nombre");
  if (empresaId) qTodas = qTodas.eq("empresa_id", empresaId);
  const { data: todas } = await qTodas;
  return { ids: [] as string[], nombres: [] as string[], sugerencias: (todas ?? []).map((r: any) => r.nombre) };
}

// ── Ejecutor de cada tool contra Supabase ──
// Sin `opts.empresaId`: RLS filtra (cliente con JWT de usuario).
// Con `opts.empresaId`: además, cada query fuerza el filtro de empresa
// (cliente service_role, RLS no aplica).
export async function ejecutarTool(supabase: any, name: string, input: Record<string, unknown>, opts: EmpresaScope = {}) {
  const { empresaId } = opts;

  // Pre-procesamiento común: todas las tools que reciben obraId lo usan
  // como filtro exacto de project_id — si no es un UUID, resolverlo antes
  // de llegar al switch de abajo.
  if (typeof input.obraId === "string" && input.obraId && !UUID_RE.test(input.obraId)) {
    const resuelto = await resolverObraId(supabase, empresaId, input.obraId);
    if (resuelto.ids.length === 1) {
      input = { ...input, obraId: resuelto.ids[0] };
    } else if (resuelto.ids.length > 1) {
      return { obraAmbigua: true, coincidencias: resuelto.nombres };
    } else {
      return { obraNoEncontrada: true, sugerencias: resuelto.sugerencias };
    }
  }

  switch (name) {
    case "buscar_egresos": {
      let q = supabase.from("expenses")
        .select("id, monto, categoria, proveedor, fecha, medio_pago, estado, documento_url, project_id, projects(nombre)")
        .order("fecha", { ascending: false })
        .limit(MAX_ROWS);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      q = aplicarFiltrosBase(q, input, { obra: "project_id", proveedor: "proveedor", categoria: "categoria", fecha: "fecha", monto: "monto", estado: "estado", medioPago: "medio_pago" });
      let countQ = supabase.from("expenses").select("id", { count: "exact", head: true });
      if (empresaId) countQ = countQ.eq("empresa_id", empresaId);
      const { count } = await aplicarFiltrosBase(
        countQ, input, { obra: "project_id", proveedor: "proveedor", categoria: "categoria", fecha: "fecha", monto: "monto", estado: "estado", medioPago: "medio_pago" },
      );
      const { data, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], totalCount: count ?? data?.length ?? 0 };
    }
    case "sumar_egresos": {
      let q = supabase.from("expenses").select("monto").limit(MAX_SUM_ROWS);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      q = aplicarFiltrosBase(q, input, { obra: "project_id", proveedor: "proveedor", categoria: "categoria", fecha: "fecha", monto: "monto", estado: "estado", medioPago: "medio_pago" });
      const { data, error } = await q;
      if (error) throw error;
      const total = (data ?? []).reduce((acc: number, r: any) => acc + Number(r.monto || 0), 0);
      return { count: data?.length ?? 0, total };
    }
    case "buscar_documentos": {
      let q = supabase.from("documents")
        .select("id, nombre, tipo, proveedor, categoria, monto, fecha, archivo_url, project_id, projects(nombre)")
        .order("fecha", { ascending: false })
        .limit(MAX_ROWS);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      q = aplicarFiltrosBase(q, input, { obra: "project_id", proveedor: "proveedor", categoria: "categoria", fecha: "fecha", monto: "monto" });
      if (input.tipo) q = q.eq("tipo", input.tipo);
      if (input.textoLibre) q = q.ilike("nombre", `%${input.textoLibre}%`);
      const { data, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], totalCount: data?.length ?? 0 };
    }
    case "buscar_cuentas_por_pagar": {
      let q = supabase.from("accounts_payable")
        .select("id, proveedor, monto, fecha_emision, fecha_vencimiento, estado, documento_url, descripcion, project_id, projects(nombre)")
        .order("fecha_vencimiento", { ascending: true })
        .limit(MAX_ROWS);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      q = aplicarFiltrosBase(q, input, { obra: "project_id", proveedor: "proveedor", estado: "estado" });
      if (input.fechaVencimientoDesde) q = q.gte("fecha_vencimiento", input.fechaVencimientoDesde);
      if (input.fechaVencimientoHasta) q = q.lte("fecha_vencimiento", input.fechaVencimientoHasta);
      const { data, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], totalCount: data?.length ?? 0 };
    }
    case "buscar_cuentas_por_cobrar": {
      let q = supabase.from("accounts_receivable")
        .select("id, monto_contrato, cobrado, saldo_pendiente, fecha_compromiso, estado, descripcion, project_id, client_id, projects(nombre)")
        .order("fecha_compromiso", { ascending: true })
        .limit(MAX_ROWS);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      q = aplicarFiltrosBase(q, input, { obra: "project_id", estado: "estado" });
      if (input.clientId) q = q.eq("client_id", input.clientId);
      const { data, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], totalCount: data?.length ?? 0 };
    }
    case "buscar_ventas_adicionales": {
      // additional_sales no tiene empresa_id propio — hereda multi-tenancy
      // vía project_id. Con RLS (empresaId no seteado) la policy de la
      // tabla ya filtra por eso (ver additional_sales_rls, Fase 1). Con
      // service_role hay que acotar explícito a los project_id de la
      // empresa resuelta.
      let q = supabase.from("additional_sales")
        .select("id, descripcion, monto, tipo, documento_url, created_at, project_id, projects(nombre)")
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS);
      if (empresaId) {
        const ids = await proyectoIdsDeEmpresa(supabase, empresaId);
        q = q.in("project_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
      }
      if (input.obraId) q = q.eq("project_id", input.obraId);
      if (input.tipo) q = q.eq("tipo", input.tipo);
      const { data, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], totalCount: data?.length ?? 0 };
    }
    case "buscar_asistencia_activa": {
      // attendance no tiene empresa_id propio — hereda multi-tenancy vía
      // project_id, mismo patrón que additional_sales.
      let q = supabase.from("attendance")
        .select("id, entrada, worker_id, workers(nombre), project_id, projects(nombre)")
        .is("salida", null)
        .order("entrada", { ascending: true })
        .limit(MAX_ROWS);
      if (empresaId) {
        const ids = await proyectoIdsDeEmpresa(supabase, empresaId);
        q = q.in("project_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
      }
      if (input.obraId) q = q.eq("project_id", input.obraId);
      const { data, error } = await q;
      if (error) throw error;
      // entrada cruda (UTC) se reemplaza por la hora ya formateada en
      // Chile — el modelo la relaya tal cual, nunca la calcula él mismo.
      const rows = (data ?? []).map((r: any) => ({ ...r, entrada: horaChile(r.entrada) }));
      return { rows, totalCount: rows.length };
    }
    case "obtener_resumen_financiero": {
      if (!empresaId) throw new Error("obtener_resumen_financiero requiere empresaId resuelto server-side");
      return await obtenerResumenFinanciero(supabase, empresaId, input);
    }
    case "buscar_tareas": {
      const MAX_TAREAS = 15;
      let q = supabase.from("tasks")
        .select("id, tarea, status, completed_at, created_at, obra_id, projects(nombre)")
        .order("created_at", { ascending: true })
        .limit(MAX_TAREAS);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      if (input.obraId) q = q.eq("obra_id", input.obraId);
      if (input.estado) q = q.eq("status", input.estado);
      if (input.texto) q = q.ilike("tarea", `%${input.texto}%`);
      let countQ = supabase.from("tasks").select("id", { count: "exact", head: true });
      if (empresaId) countQ = countQ.eq("empresa_id", empresaId);
      if (input.obraId) countQ = countQ.eq("obra_id", input.obraId);
      if (input.estado) countQ = countQ.eq("status", input.estado);
      if (input.texto) countQ = countQ.ilike("tarea", `%${input.texto}%`);
      const { count } = await countQ;
      const { data, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], totalCount: count ?? data?.length ?? 0 };
    }
    // No hay case para "crear_tarea" ni "cambiar_estado_tarea" a propósito
    // — son solo propuestas, gestionadas por whatsapp-agente/index.ts con
    // confirmación verificada por código. Si algo las invoca por acá,
    // caen en el "Tool desconocida" de abajo en vez de mutar sin confirmar.
    default:
      throw new Error(`Tool desconocida: ${name}`);
  }
}

// ── Resumen financiero — mismas fórmulas canónicas que Obras.jsx/Dashboard.jsx ──
async function obtenerResumenFinanciero(supabase: any, empresaId: string, input: Record<string, unknown>) {
  const obraId = input.obraId ? String(input.obraId) : null;

  if (obraId) {
    const { data: proyecto, error: pErr } = await supabase
      .from("projects").select("id, nombre, presupuesto")
      .eq("empresa_id", empresaId).eq("id", obraId).maybeSingle();
    if (pErr) throw pErr;
    if (!proyecto) return { error: "Obra no encontrada en esta empresa." };

    const { data: metricas, error: mErr } = await supabase.rpc("get_obra_metrics", { p_empresa_id: empresaId });
    if (mErr) throw mErr;
    const m = (metricas ?? []).find((r: any) => r.project_id === obraId) ?? {};
    const cdo = Number(m.cdo || 0);
    const mod = Number(m.costo_mod || 0);
    const adicionales = Number(m.adicionales || 0);
    const descuentos = Number(m.descuentos || 0);
    const abonos = Number(m.abonos || 0);
    const presupuesto = Number(proyecto.presupuesto || 0);
    const ventaTotal = presupuesto + (adicionales - descuentos);
    const saldoPendiente = ventaTotal - abonos;
    const margen = ventaTotal - cdo - mod;
    const margenPct = ventaTotal > 0 ? Number(((margen / ventaTotal) * 100).toFixed(1)) : null;

    return {
      nivel: "obra", obra: proyecto.nombre,
      ventaTotal, cdo, mod, abonos, saldoPendiente, margen, margenPct,
    };
  }

  const { data: proyectos, error: pErr } = await supabase.from("projects").select("presupuesto").eq("empresa_id", empresaId);
  if (pErr) throw pErr;
  const ventaObras = (proyectos ?? []).reduce((s: number, p: any) => s + Number(p.presupuesto || 0), 0);

  const { data: kpis, error: kErr } = await supabase
    .rpc("get_dashboard_kpis", { p_empresa_id: empresaId, p_month: null }).single();
  if (kErr) throw kErr;

  const ventaAdicional = Number(kpis?.venta_adicional || 0);
  const totalAbonos = Number(kpis?.total_abonos || 0);
  const totalManoObra = Number(kpis?.total_mano_obra || 0);
  const gastosCDO = Number(kpis?.gastos_cdo || 0);
  const gastosGAV = Number(kpis?.gastos_gav || 0);
  const totalGastos = Number(kpis?.total_gastos || 0);

  const totalIngresos = ventaObras + ventaAdicional;
  const egresos = totalGastos + totalManoObra;
  const utilidad = totalIngresos - egresos;
  const pctUtilidad = totalIngresos > 0 ? Number(((utilidad / totalIngresos) * 100).toFixed(1)) : 0;

  return {
    nivel: "empresa",
    ventaTotal: totalIngresos, cdo: gastosCDO, gav: gastosGAV, mod: totalManoObra,
    abonos: totalAbonos, egresos, utilidad, pctUtilidad,
  };
}
