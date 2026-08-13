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
// que el PDF cuadre exacto con la suma de sus propias líneas. Toda línea
// agregada cuenta — si no aplica a la obra, se borra (no hay estados).
export function calcularSubtotalNeto(lineas) {
  return lineas.reduce((acc, l) => acc + l.totalLinea, 0);
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
export function lineasSinPrecio(lineas) {
  return lineas.filter((l) => l.costoUnitario == null);
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

function lineasDeDestino(capitulos, destino) {
  if (destino.capitulo_id) {
    const cap = capitulos.find((c) => c.id === destino.capitulo_id);
    return cap ? cap.sub_bloque.flatMap((sb) => sb.linea) : [];
  }
  const cap = capitulos.find((c) => c.sub_bloque.some((sb) => sb.id === destino.sub_bloque_id));
  const sb = cap?.sub_bloque.find((s) => s.id === destino.sub_bloque_id);
  return sb ? sb.linea : [];
}

function regimenDeDestino(capitulos, destino) {
  if (destino.capitulo_id) return capitulos.find((c) => c.id === destino.capitulo_id)?.regimen_iva;
  return capitulos.find((c) => c.sub_bloque.some((sb) => sb.id === destino.sub_bloque_id))?.regimen_iva;
}

// Orquesta todo el cálculo de una cotización completa (capítulos → líneas,
// paquetes → hitos) a partir de los datos crudos tal como los devuelve
// getCotizacionCompleta(). Única fuente de verdad para el builder, la vista
// cliente y el PDF — evita que cada uno recalcule (y eventualmente diverja).
export function calcularCotizacion({ capitulos, paquetes, config }) {
  const capitulosCalculados = capitulos.map((cap) => ({
    ...cap,
    sub_bloque: cap.sub_bloque.map((sb) => ({
      ...sb,
      linea: sb.linea.map((l) => {
        if (l.costo_unit_usado == null) return { ...l, precioUnitario: null, totalLinea: 0 };
        const { precioUnitario, totalLinea } = calcularLinea({
          costoUnitario: l.costo_unit_usado,
          margenPct: cap.margen_pct ?? 0,
          cantidad: l.cantidad,
        });
        return { ...l, precioUnitario, totalLinea };
      }),
    })),
  }));

  const todasLasLineas = capitulosCalculados.flatMap((cap) => cap.sub_bloque.flatMap((sb) => sb.linea));
  const totalCotizacion = calcularSubtotalNeto(todasLasLineas);
  const sinPrecio = lineasSinPrecio(
    todasLasLineas.map((l) => ({ ...l, costoUnitario: l.costo_unit_usado }))
  );
  const capitulosSinPaquete = capitulosSinPaqueteCompleto(
    capitulosCalculados,
    paquetes.flatMap((p) => p.paquete_capitulo)
  );

  const paquetesCalculados = paquetes.map((p) => {
    const lineaIds = new Set(
      p.paquete_capitulo.flatMap((d) => lineasDeDestino(capitulosCalculados, d).map((l) => l.id))
    );
    const lineas = todasLasLineas.filter((l) => lineaIds.has(l.id));
    const netoPaquete = calcularSubtotalNeto(lineas);
    const regimenes = new Set(
      p.paquete_capitulo.map((d) => regimenDeDestino(capitulosCalculados, d)).filter(Boolean)
    );
    const regimenValido = regimenes.size <= 1;
    const regimen = regimenValido ? [...regimenes][0] ?? 'obra' : null;
    const sumaCuotas = sumaPorcentajesHitos(p.hito_pago);
    const cuotasValidas = p.hito_pago.length > 0 && sumaCuotas === 100;
    const resultado = regimenValido && cuotasValidas
      ? calcularHitosPaquete({ netoPaquete, hitos: p.hito_pago, regimen, ...config })
      : null;
    return { ...p, netoPaquete, regimenValido, regimen, sumaCuotas, cuotasValidas, resultado };
  });

  const todosLosPaquetesValidos = paquetesCalculados.length > 0 && paquetesCalculados.every((p) => p.resultado);
  const totalGeneral = todosLosPaquetesValidos
    ? paquetesCalculados.reduce((acc, p) => acc + p.resultado.total, 0)
    : null;

  return {
    capitulos: capitulosCalculados,
    paquetes: paquetesCalculados,
    todasLasLineas,
    totalCotizacion,
    lineasSinPrecio: sinPrecio,
    capitulosSinPaquete,
    totalGeneral,
  };
}

// ── Validaciones de emisión (sección 9) ───────────────────────────

export function capitulosSinMargen(capitulos) {
  return capitulos.filter((c) => c.margen_pct == null);
}

export function paquetesConCuotasInvalidas(paquetesCalculados) {
  return paquetesCalculados.filter((p) => !p.cuotasValidas);
}

// Las 5 validaciones bloqueantes de la sección 9. `calculado` es el resultado
// de calcularCotizacion(); `cotizacion` es la fila cruda (para validez_dias).
export function validarEmision(cotizacion, calculado) {
  const bloqueantes = [];
  if (calculado.lineasSinPrecio.length > 0) {
    bloqueantes.push({ tipo: 'lineas_sin_precio', cantidad: calculado.lineasSinPrecio.length });
  }
  const capSinMargen = capitulosSinMargen(calculado.capitulos);
  if (capSinMargen.length > 0) {
    bloqueantes.push({ tipo: 'capitulos_sin_margen', cantidad: capSinMargen.length, detalle: capSinMargen });
  }
  const paqCuotasInvalidas = paquetesConCuotasInvalidas(calculado.paquetes);
  if (paqCuotasInvalidas.length > 0) {
    bloqueantes.push({ tipo: 'cuotas_invalidas', cantidad: paqCuotasInvalidas.length, detalle: paqCuotasInvalidas });
  }
  if (calculado.capitulosSinPaquete.length > 0) {
    bloqueantes.push({ tipo: 'capitulos_sin_paquete', cantidad: calculado.capitulosSinPaquete.length, detalle: calculado.capitulosSinPaquete });
  }
  if (!cotizacion.validez_dias) {
    bloqueantes.push({ tipo: 'sin_validez' });
  }
  return { bloqueantes, puedeEmitir: bloqueantes.length === 0 };
}

// Las 2 de las 3 advertencias no bloqueantes que se pueden calcular con los
// datos disponibles. La tercera ("precio de catálogo lleva más de X meses sin
// actualizar") NO está implementada: partida_catalogo no tiene un
// updated_at — costo_unitario_ref se pisa con UPDATE y no queda rastro de
// cuándo cambió por última vez. Requeriría una columna nueva + trigger o
// actualizarla a mano en cada edición de catálogo.
export function advertenciasEmision(calculado, config) {
  const advertencias = [];
  const umbral = config.umbral_desvio_precio_pct ?? 15;
  const lineasDesviadas = calculado.todasLasLineas.filter((l) => {
    if (l.costo_unit_catalogo == null || l.costo_unit_usado == null || l.costo_unit_catalogo === 0) return false;
    const desvioPct = Math.abs(l.costo_unit_usado - l.costo_unit_catalogo) / l.costo_unit_catalogo * 100;
    return desvioPct > umbral;
  });
  if (lineasDesviadas.length > 0) {
    advertencias.push({ tipo: 'precio_desviado', cantidad: lineasDesviadas.length, detalle: lineasDesviadas });
  }

  const lineasConNotaInterna = calculado.todasLasLineas.filter((l) => l.nota_interna);
  if (lineasConNotaInterna.length > 0) {
    advertencias.push({ tipo: 'nota_interna', cantidad: lineasConNotaInterna.length, detalle: lineasConNotaInterna });
  }

  return advertencias;
}

// Snapshot inmutable de una emisión (sección 10) — solo lo que se necesita
// para mostrar la versión y compararla con otra, no el árbol completo.
export function snapshotCotizacion(calculado) {
  return {
    lineas: calculado.todasLasLineas.map((l) => ({
      id: l.id,
      descripcion: l.descripcion,
      unidad: l.unidad,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
      totalLinea: l.totalLinea,
    })),
    totalCotizacion: calculado.totalCotizacion,
    totalGeneral: calculado.totalGeneral,
  };
}

// Compara dos snapshots (sección 10: "qué líneas se agregaron, sacaron o
// cambiaron de precio"). `anterior`/`nueva` son snapshots de
// snapshotCotizacion(), o null si no hay versión anterior.
export function compararVersiones(anterior, nueva) {
  const lineasAnteriores = anterior?.lineas ?? [];
  const lineasNuevas = nueva?.lineas ?? [];
  const idsAnteriores = new Set(lineasAnteriores.map((l) => l.id));
  const idsNuevas = new Set(lineasNuevas.map((l) => l.id));

  const agregadas = lineasNuevas.filter((l) => !idsAnteriores.has(l.id));
  const eliminadas = lineasAnteriores.filter((l) => !idsNuevas.has(l.id));
  const cambiosPrecio = lineasNuevas
    .filter((l) => idsAnteriores.has(l.id))
    .map((l) => ({ actual: l, anterior: lineasAnteriores.find((a) => a.id === l.id) }))
    .filter(({ actual, anterior: a }) => actual.precioUnitario !== a.precioUnitario);

  return { agregadas, eliminadas, cambiosPrecio };
}
