// Invocada por pg_cron cada 5 minutos (vía pg_net, ver migración
// 20261002180100_whatsapp_reminders.sql) -- nunca por un cliente real, así
// que se protege con un secreto compartido en el header X-Cron-Secret
// (CRON_SHARED_SECRET), no con JWT de Supabase (verify_jwt=false en
// config.toml, mismo criterio que whatsapp-agente con su firma HMAC).
//
// Reclama recordatorios vencidos de forma atómica (reclamar_recordatorios_pendientes,
// FOR UPDATE SKIP LOCKED + avance temporal en la misma sentencia) para que
// dos ejecuciones del cron en simultáneo nunca procesen la misma fila dos
// veces. Por cada uno: si el día local no corresponde, solo recalcula; si
// no hay tareas pendientes, no manda nada (no se paga mensaje); si hay,
// manda la plantilla de Meta "resumen_tareas_diario". Un fallo de envío
// se reintenta UNA sola vez (5 minutos después, el próximo tick) -- si
// vuelve a fallar, se da por perdido para hoy y se avanza al próximo día
// programado.
import { createClient } from "npm:@supabase/supabase-js@2";
import { calcularNextRunAt } from "../_shared/recordatorios.ts";

const GRAPH_API_VERSION = "v21.0";
const MAX_TAREAS_TEMPLATE = 5;
const MAX_CHARS_LISTA = 200;

const DIA_ISO: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
function diaIsoLocal(zona: string, instante: Date): number {
  const dia = new Intl.DateTimeFormat("en-US", { timeZone: zona, weekday: "short" }).format(instante);
  return DIA_ISO[dia] ?? 1;
}

// {{3}} de la plantilla: títulos separados por "; ", máximo 5, con "y N
// más" si sobran, truncado duro a ~200 caracteres, sin saltos de línea
// (las plantillas de Meta no los soportan bien en el body).
function construirListaTareas(tareas: { tarea: string }[]): string {
  const titulos = tareas.map((t) => t.tarea.replace(/\s+/g, " ").trim());
  const primeras = titulos.slice(0, MAX_TAREAS_TEMPLATE);
  const resto = titulos.length - primeras.length;
  let lista = primeras.join("; ");
  if (resto > 0) lista += ` y ${resto} más`;
  if (lista.length > MAX_CHARS_LISTA) lista = `${lista.slice(0, MAX_CHARS_LISTA - 1).trimEnd()}…`;
  return lista;
}

async function enviarPlantilla(
  to: string, nombre: string, cantidad: number, lista: string, phoneNumberId: string, accessToken: string,
): Promise<boolean> {
  try {
    const resp = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: "resumen_tareas_diario",
          language: { code: "es" },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: nombre },
              { type: "text", text: String(cantidad) },
              { type: "text", text: lista },
            ],
          }],
        },
      }),
    });
    if (!resp.ok) {
      console.error("enviar_recordatorios: error enviando plantilla por Graph API", resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("enviar_recordatorios: excepción enviando plantilla por Graph API", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const secretoEsperado = Deno.env.get("CRON_SHARED_SECRET");
  const secretoRecibido = req.headers.get("X-Cron-Secret");
  if (!secretoEsperado || !secretoRecibido || secretoRecibido !== secretoEsperado) {
    console.warn("enviar_recordatorios: secreto inválido o ausente, request descartado");
    return new Response("No autorizado", { status: 401 });
  }

  const waToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const waPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!waToken || !waPhoneId) {
    console.error("enviar_recordatorios: faltan secrets requeridos (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)");
    return new Response("Server misconfigured", { status: 500 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: reclamados, error: errReclamo } = await supabase.rpc("reclamar_recordatorios_pendientes");
  if (errReclamo) {
    console.error("enviar_recordatorios: error reclamando recordatorios pendientes", errReclamo);
    return new Response("Error reclamando recordatorios", { status: 500 });
  }

  const ahora = new Date();
  let procesados = 0;

  for (const r of reclamados ?? []) {
    procesados++;
    try {
      const diaLocal = diaIsoLocal(r.zona_horaria, ahora);
      if (!(r.dias as number[]).includes(diaLocal)) {
        // Defensa: no debería pasar si calcularNextRunAt está bien --
        // nunca manda nada en un día que no corresponde.
        const next = calcularNextRunAt(r.hora_local, r.dias, r.zona_horaria, ahora);
        await supabase.from("whatsapp_reminders").update({ next_run_at: next.toISOString() }).eq("id", r.id);
        continue;
      }

      const { data: wu, error: errWu } = await supabase
        .from("whatsapp_users")
        .select("phone_e164, user_id, users(nombre)")
        .eq("id", r.whatsapp_user_id)
        .maybeSingle();
      if (errWu || !wu) {
        console.error("enviar_recordatorios: no se pudo resolver whatsapp_user del recordatorio", r.id, errWu);
        const next = calcularNextRunAt(r.hora_local, r.dias, r.zona_horaria, ahora);
        await supabase.from("whatsapp_reminders").update({ next_run_at: next.toISOString() }).eq("id", r.id);
        continue;
      }

      const { data: tareas, error: errTareas } = await supabase
        .from("tasks")
        .select("tarea")
        .eq("empresa_id", r.empresa_id)
        .is("deleted_at", null)
        .neq("status", "finalizado")
        // Las asignadas a esta persona + las generales (asignado_a NULL).
        // Las asignadas a otro no le llegan.
        .or(`asignado_a.is.null,asignado_a.eq.${wu.user_id}`)
        .order("created_at", { ascending: true });
      if (errTareas) {
        console.error("enviar_recordatorios: error consultando tareas pendientes", r.id, errTareas);
        const next = calcularNextRunAt(r.hora_local, r.dias, r.zona_horaria, ahora);
        await supabase.from("whatsapp_reminders").update({ next_run_at: next.toISOString() }).eq("id", r.id);
        continue;
      }

      const cantidad = tareas?.length ?? 0;
      const nextRunAt = calcularNextRunAt(r.hora_local, r.dias, r.zona_horaria, ahora);

      if (cantidad === 0) {
        // No se envía -- no se "paga" un mensaje de plantilla sin tareas.
        await supabase.from("whatsapp_reminders").update({
          last_sent_at: null,
          last_error_at: null,
          next_run_at: nextRunAt.toISOString(),
        }).eq("id", r.id);
        continue;
      }

      const lista = construirListaTareas(tareas!);
      const nombre = (wu.users as unknown as { nombre?: string } | null)?.nombre || "usuario";
      const ok = await enviarPlantilla(wu.phone_e164, nombre, cantidad, lista, waPhoneId, waToken);

      if (ok) {
        await supabase.from("whatsapp_reminders").update({
          last_sent_at: ahora.toISOString(),
          last_error_at: null,
          next_run_at: nextRunAt.toISOString(),
        }).eq("id", r.id);
        continue;
      }

      // Falló el envío: como mucho 1 reintento (el próximo tick de cron,
      // 5 minutos después). Si ya había un error sin resolver de este
      // mismo ciclo, se da por perdido y se avanza al próximo día.
      if (r.last_error_at) {
        console.error("enviar_recordatorios: segundo fallo consecutivo, se da por perdido el envío de hoy", r.id);
        await supabase.from("whatsapp_reminders").update({
          last_error_at: null,
          next_run_at: nextRunAt.toISOString(),
        }).eq("id", r.id);
      } else {
        await supabase.from("whatsapp_reminders").update({
          last_error_at: ahora.toISOString(),
          next_run_at: new Date(ahora.getTime() + 5 * 60 * 1000).toISOString(),
        }).eq("id", r.id);
      }
    } catch (err) {
      console.error("enviar_recordatorios: excepción procesando recordatorio", r.id, err);
      // Resguardo: nunca dejar la fila con el next_run_at temporal de
      // +10min que puso reclamar_recordatorios_pendientes() -- avanzar al
      // próximo día programado para no reintentar en loop.
      try {
        const next = calcularNextRunAt(r.hora_local, r.dias, r.zona_horaria, ahora);
        await supabase.from("whatsapp_reminders").update({ next_run_at: next.toISOString() }).eq("id", r.id);
      } catch {
        // No bloquear el resto del lote por esto.
      }
    }
  }

  return new Response(JSON.stringify({ procesados }), { status: 200, headers: { "Content-Type": "application/json" } });
});
