export function redondear(valor) {
  return Math.round(valor);
}

export function calcularPrecioUnitario(costoUnitario, margenPct) {
  return redondear(costoUnitario * (1 + margenPct / 100));
}

export function calcularTotalLinea(precioUnitario, cantidad) {
  return redondear(precioUnitario * cantidad);
}

export function calcularLinea({ costoUnitario, margenPct, cantidad }) {
  const precioUnitario = calcularPrecioUnitario(costoUnitario, margenPct);
  const totalLinea = calcularTotalLinea(precioUnitario, cantidad);
  return { precioUnitario, totalLinea };
}

// Suma líneas ya redondeadas (no recalcula sobre el subtotal de costos) para
// que el PDF cuadre exacto con la suma de sus propias líneas. Solo 'firme' suma.
export function calcularSubtotalNeto(lineas) {
  return lineas
    .filter((l) => l.estado === 'firme')
    .reduce((acc, l) => acc + l.totalLinea, 0);
}

export function calcularFactorIva({ regimen, ivaPct, ivaObraFactor }) {
  return regimen === 'obra' ? (ivaPct / 100) * ivaObraFactor : ivaPct / 100;
}

export function calcularIva({ neto, regimen, ivaPct, ivaObraFactor }) {
  return redondear(neto * calcularFactorIva({ regimen, ivaPct, ivaObraFactor }));
}

export function sumaPorcentajesHitos(hitos) {
  return hitos.reduce((acc, h) => acc + h.porcentaje, 0);
}

// Sección 8 regla 4: "todo capítulo debe pertenecer a exactamente un
// paquete". El capítulo 8 de Quillayes 19 se reparte en dos paquetes por
// sub-bloque (sección 8), así que un capítulo cuenta como cubierto si TODOS
// sus sub-bloques quedaron asignados a algún paquete — directo (capitulo_id)
// o por sub-bloque (sub_bloque_id) — no solo si el capítulo entero lo está.
export function capitulosSinPaqueteCompleto(capitulos, destinos) {
  return capitulos.filter((cap) => {
    const cubiertoCompleto = destinos.some((d) => d.capitulo_id === cap.id)
    if (cubiertoCompleto) return false
    const subBloqueIds = cap.sub_bloque.map((sb) => sb.id)
    if (subBloqueIds.length === 0) return true
    const todosCubiertos = subBloqueIds.every((id) => destinos.some((d) => d.sub_bloque_id === id))
    return !todosCubiertos
  })
}

// Sección 9, primera validación bloqueante. El resto de las validaciones de
// emisión (capítulo sin margen, cuotas != 100%, capítulos sin paquete, sin
// fecha de validez) se implementan en la Etapa 9, junto al resto del flujo
// de emisión — esta se adelanta porque el test de aceptación de la Etapa 5
// depende de ella.
export function lineasFirmesSinPrecio(lineas) {
  return lineas.filter((l) => l.estado === 'firme' && l.costoUnitario == null);
}

// Redondeo acumulativo: cada hito redondea su propio neto/IVA (cumple sección
// 6.3, "por hito, no sobre el total"), pero contra el % ACUMULADO hasta ese
// hito, restando lo ya asignado a hitos anteriores. Así ningún hito deja de
// tener su propio monto redondeado, pero la suma de los 4 (o N) hitos siempre
// cuadra exacto con neto_paquete × factor — sin el error de ±$1 que deja
// redondear cada hito de forma aislada (verificado contra los 6 paquetes de
// Quillayes 19: redondeo aislado falla por $1 en 2 de los 6).
export function calcularHitosPaquete({ netoPaquete, hitos, regimen, ivaPct, ivaObraFactor }) {
  const factor = calcularFactorIva({ regimen, ivaPct, ivaObraFactor });
  let cumPct = 0;
  let netoAcumPrevio = 0;
  let ivaAcumPrevio = 0;

  const detalle = hitos.map((h) => {
    cumPct += h.porcentaje;
    const netoAcum = redondear(netoPaquete * (cumPct / 100));
    const ivaAcum = redondear(netoPaquete * factor * (cumPct / 100));
    const neto = netoAcum - netoAcumPrevio;
    const iva = ivaAcum - ivaAcumPrevio;
    netoAcumPrevio = netoAcum;
    ivaAcumPrevio = ivaAcum;
    return { ...h, neto, iva, total: neto + iva };
  });

  return {
    hitos: detalle,
    neto: netoAcumPrevio,
    iva: ivaAcumPrevio,
    total: netoAcumPrevio + ivaAcumPrevio,
  };
}
