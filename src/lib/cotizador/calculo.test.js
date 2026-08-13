import { describe, it, expect } from 'vitest';
import {
  redondear,
  calcularPrecioUnitario,
  calcularLinea,
  calcularSubtotalNeto,
  calcularIva,
  calcularHitosPaquete,
  sumaPorcentajesHitos,
  capitulosSinPaqueteCompleto,
  calcularCotizacion,
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

describe('capitulosSinPaqueteCompleto', () => {
  const capitulos = [
    { id: 'cap1', sub_bloque: [{ id: 'sb1' }, { id: 'sb2' }] },
    { id: 'cap2', sub_bloque: [{ id: 'sb3' }] },
  ];

  it('un capítulo cubierto directo por capitulo_id no aparece', () => {
    const destinos = [{ capitulo_id: 'cap1' }, { capitulo_id: 'cap2' }];
    expect(capitulosSinPaqueteCompleto(capitulos, destinos)).toEqual([]);
  });

  it('un capítulo con todos sus sub-bloques cubiertos (split, como el Quincho real) no aparece', () => {
    const destinos = [{ sub_bloque_id: 'sb1' }, { sub_bloque_id: 'sb2' }, { capitulo_id: 'cap2' }];
    expect(capitulosSinPaqueteCompleto(capitulos, destinos)).toEqual([]);
  });

  it('un capítulo con solo parte de sus sub-bloques cubiertos queda marcado', () => {
    const destinos = [{ sub_bloque_id: 'sb1' }, { capitulo_id: 'cap2' }];
    const faltantes = capitulosSinPaqueteCompleto(capitulos, destinos);
    expect(faltantes.map((c) => c.id)).toEqual(['cap1']);
  });

  it('un capítulo sin ningún destino queda marcado', () => {
    const destinos = [{ capitulo_id: 'cap1' }];
    const faltantes = capitulosSinPaqueteCompleto(capitulos, destinos);
    expect(faltantes.map((c) => c.id)).toEqual(['cap2']);
  });
});

describe('calcularCotizacion — orquestación', () => {
  const config = { ivaPct: 19, ivaObraFactor: 0.5 };

  it('compone líneas, capítulos y paquetes en un solo resultado consistente', () => {
    const capitulos = [
      {
        id: 'cap1', margen_pct: 10, regimen_iva: 'obra',
        sub_bloque: [
          { id: 'sb1', linea: [{ id: 'l1', estado: 'firme', costo_unit_usado: 1000, cantidad: 2 }] },
        ],
      },
    ];
    const paquetes = [
      { id: 'p1', paquete_capitulo: [{ capitulo_id: 'cap1' }], hito_pago: [{ porcentaje: 50 }, { porcentaje: 50 }] },
    ];

    const resultado = calcularCotizacion({ capitulos, paquetes, config });

    expect(resultado.todasLasLineas[0].totalLinea).toBe(2200); // (1000*1.1)*2
    expect(resultado.totalCotizacion).toBe(2200);
    expect(resultado.paquetes[0].netoPaquete).toBe(2200);
    expect(resultado.paquetes[0].resultado.total).toBe(redondear(2200 * 0.19 * 0.5) + 2200);
    expect(resultado.capitulosSinPaquete).toEqual([]);
    expect(resultado.totalGeneral).toBe(resultado.paquetes[0].resultado.total);
  });

  it('totalGeneral es null si algún paquete tiene cuotas inválidas', () => {
    const capitulos = [{ id: 'cap1', margen_pct: 0, regimen_iva: 'obra', sub_bloque: [] }];
    const paquetes = [{ id: 'p1', paquete_capitulo: [{ capitulo_id: 'cap1' }], hito_pago: [{ porcentaje: 40 }] }];
    const resultado = calcularCotizacion({ capitulos, paquetes, config });
    expect(resultado.paquetes[0].cuotasValidas).toBe(false);
    expect(resultado.totalGeneral).toBeNull();
  });
});
