import { describe, it, expect } from 'vitest';
import {
  redondear,
  calcularPrecioUnitario,
  calcularLinea,
  calcularSubtotalNeto,
  calcularIva,
  calcularHitosPaquete,
  sumaPorcentajesHitos,
} from './calculo.js';

describe('redondear', () => {
  it('redondea .5 hacia arriba', () => {
    expect(redondear(8678870.5)).toBe(8678871);
  });
});

describe('calcularPrecioUnitario', () => {
  it('aplica el margen del capítulo', () => {
    expect(calcularPrecioUnitario(1000, 20)).toBe(1200);
  });

  it('con margen 0% el precio queda igual al costo', () => {
    expect(calcularPrecioUnitario(45990, 0)).toBe(45990);
  });
});

describe('calcularLinea', () => {
  it('calcula precio unitario y total (dato real: mármol borde piscina)', () => {
    const { precioUnitario, totalLinea } = calcularLinea({
      costoUnitario: 45990,
      margenPct: 0,
      cantidad: 20,
    });
    expect(precioUnitario).toBe(45990);
    expect(totalLinea).toBe(919800);
  });
});

describe('calcularSubtotalNeto', () => {
  const base = { costoUnitario: 100, margenPct: 0, cantidad: 1 };

  it('solo suma líneas en estado firme', () => {
    const lineas = [
      { ...base, estado: 'firme', totalLinea: 100 },
      { ...base, estado: 'opcional', totalLinea: 500 },
      { ...base, estado: 'por_definir', totalLinea: 0 },
      { ...base, estado: 'excluido', totalLinea: 0 },
      { ...base, estado: 'descartado', totalLinea: 9999 },
    ];
    expect(calcularSubtotalNeto(lineas)).toBe(100);
  });

  it('suma líneas ya redondeadas, sin volver a aplicar margen sobre el subtotal', () => {
    const lineas = [
      { estado: 'firme', totalLinea: 1200 },
      { estado: 'firme', totalLinea: 801 },
    ];
    expect(calcularSubtotalNeto(lineas)).toBe(2001);
  });
});

describe('calcularIva', () => {
  const config = { ivaPct: 19, ivaObraFactor: 0.5 };

  it('régimen obra: neto × 19% × 50%', () => {
    expect(calcularIva({ neto: 1000000, regimen: 'obra', ...config })).toBe(95000);
  });

  it('régimen pleno: neto × 19%', () => {
    expect(calcularIva({ neto: 1000000, regimen: 'pleno', ...config })).toBe(190000);
  });

  it('el 19% y el 50% vienen de config, no están hardcodeados', () => {
    const otraConfig = { ivaPct: 21, ivaObraFactor: 0.4 };
    expect(calcularIva({ neto: 1000000, regimen: 'obra', ...otraConfig })).toBe(84000);
  });
});

describe('calcularHitosPaquete — redondeo acumulativo', () => {
  const config = { ivaPct: 19, ivaObraFactor: 0.5 };

  it('reproduce exacto el paquete Piscina de Quillayes 19 (falla con redondeo aislado por hito)', () => {
    const hitos = [
      { porcentaje: 40 },
      { porcentaje: 30 },
      { porcentaje: 20 },
      { porcentaje: 10 },
    ];
    const resultado = calcularHitosPaquete({
      netoPaquete: 28542050,
      hitos,
      regimen: 'obra',
      ...config,
    });
    expect(resultado.neto).toBe(28542050);
    expect(resultado.iva).toBe(2711495);
    expect(resultado.total).toBe(31253545);
  });

  it('reproduce exacto el paquete Mobiliario (50/50, régimen pleno)', () => {
    const hitos = [{ porcentaje: 50 }, { porcentaje: 50 }];
    const resultado = calcularHitosPaquete({
      netoPaquete: 17357741,
      hitos,
      regimen: 'pleno',
      ...config,
    });
    expect(resultado.iva).toBe(3297971);
    expect(resultado.total).toBe(20655712);
  });

  it('la suma de los hitos individuales siempre cuadra con el total del paquete', () => {
    const hitos = [{ porcentaje: 40 }, { porcentaje: 30 }, { porcentaje: 20 }, { porcentaje: 10 }];
    const resultado = calcularHitosPaquete({
      netoPaquete: 22227500,
      hitos,
      regimen: 'obra',
      ...config,
    });
    const sumaHitos = resultado.hitos.reduce((acc, h) => acc + h.total, 0);
    expect(sumaHitos).toBe(resultado.total);
  });
});

describe('sumaPorcentajesHitos', () => {
  it('detecta cuotas que no suman 100%', () => {
    expect(sumaPorcentajesHitos([{ porcentaje: 40 }, { porcentaje: 30 }])).toBe(70);
  });
});
