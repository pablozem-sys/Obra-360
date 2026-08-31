// Asistente de búsqueda por lenguaje natural — Fase 1 (metadata, sin OCR).
// Corre 100% con el JWT del usuario que llama (nunca service role) — RLS es
// la única línea de defensa del multi-tenant. Ver mejoras/asistente-busqueda-
// egresos-documentos.md para la spec funcional completa.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.68";

const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-5";
const MAX_ROWS = 50;
const MAX_SUM_ROWS = 5000; // tope de seguridad para sumar_egresos, no de negocio
const MAX_TOOL_ROUNDS = 4;

const CATEGORIAS_GASTO = {
  materiales: "Materiales", subcontratos: "Subcontratos", equipos: "Equipos",
  aridos: "Áridos", retiro_escombros: "Retiro escombros", banio_quimico: "Baño químico",
  flete: "Flete", otros_operacion: "Otros (operación)", sueldos: "Sueldos",
  publicidad: "Publicidad", marketing: "Marketing", bencina: "Bencina",
  herramientas: "Herramientas", arriendo: "Arriendo", cuentas: "Cuentas",
  retiros: "Retiros", otros: "Otros", mano_obra: "Mano de obra",
  transporte: "Transporte (legacy)",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Filtros comunes ─────────────────────────────────────────────
function aplicarFiltrosBase(query: any, f: Record<string, unknown>, cols: {
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

// ── Definición de las 6 tools ───────────────────────────────────
const FILTROS_EGRESOS_SCHEMA = {
  obraId: { type: "string", description: "UUID de la obra/proyecto" },
  categoria: { type: "string", description: `Una de: ${Object.keys(CATEGORIAS_GASTO).join(", ")}` },
  proveedor: { type: "string", description: "Nombre del proveedor (búsqueda parcial)" },
  fechaDesde: { type: "string", description: "Fecha ISO YYYY-MM-DD" },
  fechaHasta: { type: "string", description: "Fecha ISO YYYY-MM-DD" },
  montoMin: { type: "number" },
  montoMax: { type: "number" },
  medioPago: { type: "string", enum: ["contado", "credito"] },
  estado: { type: "string", enum: ["pendiente", "pagado", "vencido"] },
};

const tools: Anthropic.Tool[] = [
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
        obraId: { type: "string" },
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
        obraId: { type: "string" },
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
        obraId: { type: "string" },
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
        obraId: { type: "string" },
        tipo: { type: "string" },
      },
    },
  },
];

// ── Ejecutor de cada tool contra Supabase (RLS aplica siempre) ──
async function ejecutarTool(supabase: any, name: string, input: Record<string, unknown>) {
  switch (name) {
    case "buscar_egresos": {
      let q = supabase.from("expenses")
        .select("id, monto, categoria, proveedor, fecha, medio_pago, estado, documento_url, project_id, projects(nombre)")
        .order("fecha", { ascending: false })
        .limit(MAX_ROWS);
      q = aplicarFiltrosBase(q, input, { obra: "project_id", proveedor: "proveedor", categoria: "categoria", fecha: "fecha", monto: "monto", estado: "estado", medioPago: "medio_pago" });
      const { count } = await aplicarFiltrosBase(
        supabase.from("expenses").select("id", { count: "exact", head: true }),
        input, { obra: "project_id", proveedor: "proveedor", categoria: "categoria", fecha: "fecha", monto: "monto", estado: "estado", medioPago: "medio_pago" },
      );
      const { data, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], totalCount: count ?? data?.length ?? 0 };
    }
    case "sumar_egresos": {
      let q = supabase.from("expenses").select("monto").limit(MAX_SUM_ROWS);
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
      q = aplicarFiltrosBase(q, input, { obra: "project_id", estado: "estado" });
      if (input.clientId) q = q.eq("client_id", input.clientId);
      const { data, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], totalCount: data?.length ?? 0 };
    }
    case "buscar_ventas_adicionales": {
      // additional_sales no tiene empresa_id propio — hereda multi-tenancy
      // vía project_id, RLS de la tabla ya filtra por eso (ver policy
      // additional_sales_rls en la migración de Fase 1).
      let q = supabase.from("additional_sales")
        .select("id, descripcion, monto, tipo, documento_url, created_at, project_id, projects(nombre)")
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS);
      if (input.obraId) q = q.eq("project_id", input.obraId);
      if (input.tipo) q = q.eq("tipo", input.tipo);
      const { data, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], totalCount: data?.length ?? 0 };
    }
    default:
      throw new Error(`Tool desconocida: ${name}`);
  }
}

function systemPrompt(hoy: string, projectId: string | null) {
  return `Sos el asistente de búsqueda de VAION, una app de gestión de obras de construcción. Respondés en español de Chile, corto y directo.

Fecha de hoy: ${hoy}.
${projectId ? `El usuario está viendo el detalle de la obra ${projectId} — si la pregunta no menciona otra obra, asumí que se refiere a esta.` : "El usuario no está dentro de ninguna obra en particular."}

Categorías de egreso válidas (clave → nombre): ${JSON.stringify(CATEGORIAS_GASTO)}. Mapeá sinónimos del usuario (ej. "sueldos", "pago de personal" → sueldos; "materiales", "insumos" → materiales; "mano de obra", "jornales" → mano_obra) a la clave exacta antes de llamar una tool.

Reglas estrictas:
- Solo tenés 6 tools: egresos, documentos, cuentas por pagar, cuentas por cobrar, ventas adicionales. Si la pregunta pide algo fuera de estas 5 fuentes (ej. asistencia, sueldos de trabajadores por hora, cotizaciones), decilo explícito: "Eso no está disponible en este buscador todavía." No inventes.
- Para cualquier suma, total o conteo de egresos, SIEMPRE llamá a sumar_egresos — nunca sumes vos los montos de buscar_egresos a mano.
- Si la pregunta es ambigua sin obra ni fecha (ej. "los gastos"), asumí "todas las obras, últimos 30 días" y decilo explícito en la respuesta.
- Si una búsqueda no da resultados, decilo explícito y sugerí ampliar el rango — no aproximes ni inventes un resultado parecido.
- Nunca uses ni menciones datos de otra empresa — no es algo que decidas vos, RLS ya lo garantiza, pero nunca asumas ni inventes qué vería otro usuario.
- Redactá la respuesta final en 2-4 líneas como máximo. Los resultados detallados los muestra la interfaz en tarjetas, vos solo resumís.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autorizado" }, 401);

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) return json({ error: "El asistente no está configurado (falta ANTHROPIC_API_KEY)." }, 500);

  let pregunta: string, projectId: string | null;
  try {
    const body = await req.json();
    pregunta = String(body.pregunta ?? "").trim();
    projectId = body.projectId ? String(body.projectId) : null;
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  if (!pregunta) return json({ error: "Falta la pregunta" }, 400);

  // Cliente con el JWT del usuario — RLS aplica como si la query viniera
  // directo del frontend. NUNCA service role acá.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return json({ error: "Sesión inválida o expirada" }, 401);

  const anthropic = new Anthropic({ apiKey: anthropicKey, timeout: 30000 });
  const hoy = new Date().toISOString().split("T")[0];

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: pregunta }];
  const resultados: Array<Record<string, unknown> & { _tool: string }> = [];
  let respuestaTexto = "";

  try {
    for (let ronda = 0; ronda < MAX_TOOL_ROUNDS; ronda++) {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt(hoy, projectId),
        tools,
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
        try {
          const result = await ejecutarTool(supabase, tu.name, tu.input as Record<string, unknown>);
          if ("rows" in result) {
            for (const row of result.rows) resultados.push({ ...row, _tool: tu.name });
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
        respuestaTexto = "No pude terminar de resolver la pregunta en el tiempo disponible — probá acotarla más (con obra, fecha o proveedor).";
      }
    }
  } catch (err) {
    console.error("asistente-busqueda error:", err);
    const msg = err instanceof Anthropic.APIError
      ? `El asistente no pudo responder ahora mismo (${err.status ?? "error"}). Probá de nuevo en un momento.`
      : "El asistente no pudo responder ahora mismo. Probá de nuevo en un momento.";
    return json({ error: msg }, 502);
  }

  return json({ respuesta: respuestaTexto, resultados });
});
