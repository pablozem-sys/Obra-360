// Cálculo de next_run_at para whatsapp_reminders — una sola implementación,
// compartida entre whatsapp-agente (creación/reactivación de un
// recordatorio) y enviar_recordatorios (recalcular tras cada envío o
// cuando el día local no corresponde). Nunca duplicar esta lógica.
//
// El huso horario de Chile cambia de offset con el horario de verano —
// nunca hardcodear -3/-4, siempre derivarlo de Intl para la fecha real en
// cuestión (mismo criterio que horaChile()/fechaChile() del resto del
// proyecto, pero acá en la dirección inversa: de hora local a instante UTC).

const DIA_ISO: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

// Offset de `zona` respecto a UTC, en minutos, en el instante dado (negativo
// para zonas detrás de UTC, ej. -240 = UTC-4).
function offsetMinutos(instanteUtc: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: zona, timeZoneName: "longOffset" }).formatToParts(instanteUtc);
  const tz = partes.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const m = tz.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const signo = m[1] === "-" ? -1 : 1;
  return signo * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

// Año/mes/día/día-ISO-de-semana de `instanteUtc`, tal como se ven en `zona`.
function fechaLocal(instanteUtc: Date, zona: string): { y: number; m: number; d: number; diaIso: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(instanteUtc);
  const obj: Record<string, string> = {};
  for (const p of partes) if (p.type !== "literal") obj[p.type] = p.value;
  return { y: Number(obj.year), m: Number(obj.month), d: Number(obj.day), diaIso: DIA_ISO[obj.weekday] ?? 1 };
}

/**
 * Calcula, en UTC, el próximo instante en que corresponde enviar un
 * recordatorio con `horaLocal` ("HH:MM" o "HH:MM:SS") en `zona`, cayendo en
 * uno de los días ISO de `dias` (1=lunes..7=domingo) y estrictamente
 * posterior a `desde`.
 */
export function calcularNextRunAt(horaLocal: string, dias: number[], zona: string, desde: Date): Date {
  const [hh, mm] = horaLocal.split(":").map((n) => parseInt(n, 10));
  for (let i = 0; i < 8; i++) {
    // Ancla al mediodía UTC del día candidato, lejos de cualquier
    // medianoche, para que offsetMinutos nunca quede del lado equivocado
    // de un cambio de horario que ocurra esa misma madrugada.
    const candidatoAproximado = new Date(desde.getTime() + i * 24 * 60 * 60 * 1000);
    const { y, m, d, diaIso } = fechaLocal(candidatoAproximado, zona);
    if (!dias.includes(diaIso)) continue;
    const ancla = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const offset = offsetMinutos(ancla, zona);
    const candidato = new Date(Date.UTC(y, m - 1, d, hh, mm, 0) - offset * 60 * 1000);
    if (candidato.getTime() > desde.getTime()) return candidato;
  }
  // No debería alcanzarse nunca con `dias` no vacío (recorre 8 días
  // calendario) — fallback defensivo, nunca debe tirar.
  return new Date(desde.getTime() + 24 * 60 * 60 * 1000);
}
