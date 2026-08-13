import { capitulos as capitulosQuillayes } from './quillayes19.fixture.js'

// Plantilla por defecto de toda cotización nueva: los 9 capítulos reales del
// presupuesto de referencia (Matías Quillayes 19), con sus sub-bloques y
// líneas — porque las cotizaciones de VA Constructora repiten casi siempre
// la misma estructura (piscina, quincho, terraza, etc.), y la persona que
// cotiza solo necesita ajustar cantidades/precios y borrar lo que no
// aplique (ej. una obra sin piscina), no armar todo desde cero.
//
// No incluye el 10° capítulo del fixture ("Cierre ventanal Arquiglass") —
// ese fue la "partida fantasma" del hallazgo de la spec (existía solo en
// el EEPP, nunca fue un capítulo real del presupuesto), no una plantilla.
export const CAPITULOS_PLANTILLA = capitulosQuillayes.slice(0, 9)

export function normalizarTexto(texto) {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.:-]+|[\s.:-]+$/g, '')
}
