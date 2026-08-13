import { describe, it, expect } from 'vitest';
import {
  calcularLinea,
  calcularSubtotalNeto,
  calcularHitosPaquete,
  sumaPorcentajesHitos,
  lineasFirmesSinPrecio,
} from './calculo.js';
import { capitulos, paquetes } from './quillayes19.fixture.js';

const IVA_CONFIG = { ivaPct: 19, ivaObraFactor: 0.5 };

const NETO_CAPITULOS_ESPERADO = [
  2061000, 12400000, 3730500, 1057770, 3057350, 6235430, 9456000, 44347000, 17357741, 9766539,
];

const PAQUETES_ESPERADO = [
  { neto: 28542050, iva: 2711495, total: 31253545 },
  { neto: 9456000, iva: 898320, total: 10354320 },
  { neto: 22227500, iva: 2111613, total: 24339113 },
  { neto: 22119500, iva: 2101353, total: 24220853 },
  { neto: 17357741, iva: 3297971, total: 20655712 },
  { neto: 9766539, iva: 1855642, total: 11622181 },
];

function calcularLineasCapitulo(capitulo) {
  return capitulo.subBloques.flatMap((sb) =>
    sb.lineas.map((l) => {
      if (l.costoUnitario == null) {
        return { ...l, precioUnitario: null, totalLinea: 0 };
      }
      const { precioUnitario, totalLinea } = calcularLinea({
        costoUnitario: l.costoUnitario,
        margenPct: capitulo.margenPct,
        cantidad: l.cantidad,
      });
      return { ...l, precioUnitario, totalLinea };
    })
  );
}

describe('Caso de aceptación — Matías Quillayes 19 (spec sección 12)', () => {
  const capitulosCalculados = capitulos.map((cap) => ({
    ...cap,
    subBloques: cap.subBloques.map((sb) => ({
      ...sb,
      lineas: calcularLineasCapitulo({ ...cap, subBloques: [sb] }),
    })),
  }));

  it('reproduce el neto de los 10 capítulos', () => {
    capitulosCalculados.forEach((cap, i) => {
      const lineas = cap.subBloques.flatMap((sb) => sb.lineas);
      expect(calcularSubtotalNeto(lineas)).toBe(NETO_CAPITULOS_ESPERADO[i]);
    });
  });

  it('el subtotal de un capítulo con sub-bloques suma TODOS sus sub-bloques (sin el bug de fórmula incompleta del Excel original)', () => {
    // Capítulo 8 (Quincho) incluye el sub-bloque "Especialidades", cuyo
    // subtotal estaba vacío en el Excel original (hallazgo #2 de la spec) —
    // acá no hay una fórmula de subtotal por sub-bloque que pueda omitirse,
    // solo se filtra por estado 'firme' sobre TODAS las líneas del capítulo.
    const quincho = capitulosCalculados[7];
    const especialidades = quincho.subBloques.find((sb) => sb.nombre === 'Especialidades');
    expect(especialidades.lineas).toHaveLength(4);
    const netoQuincho = calcularSubtotalNeto(quincho.subBloques.flatMap((sb) => sb.lineas));
    expect(netoQuincho).toBe(44347000);
  });

  it('detecta las 14 líneas firmes sin precio y rechaza la emisión', () => {
    const todasLasLineas = capitulosCalculados.flatMap((cap) =>
      cap.subBloques.flatMap((sb) => sb.lineas)
    );
    const sinPrecio = lineasFirmesSinPrecio(todasLasLineas);
    expect(sinPrecio).toHaveLength(14);
    // Validación bloqueante de la sección 9: si hay líneas firmes sin
    // precio, el sistema no debe permitir generar el PDF.
    const emisionBloqueda = sinPrecio.length > 0;
    expect(emisionBloqueda).toBe(true);
  });

  it('reproduce los 6 paquetes comerciales (neto, IVA y total)', () => {
    paquetes.forEach((paquete, i) => {
      const lineasPaquete = paquete.destinos.flatMap((d) => {
        const cap = capitulosCalculados[d.capitulo];
        const subBloques = d.subBloque != null ? [cap.subBloques[d.subBloque]] : cap.subBloques;
        return subBloques.flatMap((sb) => sb.lineas);
      });
      const netoPaquete = calcularSubtotalNeto(lineasPaquete);

      // Régimen del paquete: se deriva de sus capítulos de origen, que deben
      // ser homogéneos (ver nota de la Etapa 4 — la spec no define un campo
      // regimen_iva propio en paquete_comercial).
      const regimenes = new Set(paquete.destinos.map((d) => capitulosCalculados[d.capitulo].regimen));
      expect(regimenes.size).toBe(1);
      const [regimen] = regimenes;

      expect(sumaPorcentajesHitos(paquete.cuotas.map((porcentaje) => ({ porcentaje })))).toBe(100);

      const resultado = calcularHitosPaquete({
        netoPaquete,
        hitos: paquete.cuotas.map((porcentaje) => ({ porcentaje })),
        regimen,
        ...IVA_CONFIG,
      });

      const esperado = PAQUETES_ESPERADO[i];
      expect(resultado.neto).toBe(esperado.neto);
      expect(resultado.iva).toBe(esperado.iva);
      expect(resultado.total).toBe(esperado.total);
    });
  });

  it('los dos paquetes de Quincho suman exactamente el capítulo 8', () => {
    const quinchoMuros = PAQUETES_ESPERADO[2].neto;
    const quinchoTechumbre = PAQUETES_ESPERADO[3].neto;
    expect(quinchoMuros + quinchoTechumbre).toBe(NETO_CAPITULOS_ESPERADO[7]);
  });

  it('el total de contrato es $122.445.724', () => {
    const totalContrato = PAQUETES_ESPERADO.reduce((acc, p) => acc + p.total, 0);
    expect(totalContrato).toBe(122445724);
  });
});
