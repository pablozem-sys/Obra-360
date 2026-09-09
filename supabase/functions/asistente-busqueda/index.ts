// Asistente de búsqueda por lenguaje natural — Fase 1 (metadata, sin OCR).
// Corre 100% con el JWT del usuario que llama (nunca service role) — RLS es
// la única línea de defensa del multi-tenant. Ver mejoras/asistente-busqueda-
// egresos-documentos.md para la spec funcional completa.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.68";
import { CATEGORIAS_GASTO, TOOLS_BUSQUEDA, ejecutarTool } from "../_shared/asistente-tools.ts";

const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-5";
const MAX_TOOL_ROUNDS = 4;

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
- Redactá la respuesta final en 2-4 líneas como máximo. Los resultados detallados los muestra la interfaz en tarjetas, vos solo resumís.
- Texto plano, sin markdown — nada de **negrita**, _cursiva_ ni bullets con guiones. La interfaz no lo renderiza, se vería el asterisco literal.`;
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
        tools: TOOLS_BUSQUEDA,
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
