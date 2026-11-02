import { describe, expect, it } from 'vitest'
import { moverRango, resumirFicha } from './fichaTrabajador'

const r = (id, fecha, projectId, nombre, costo, salida = true) => ({
  id, fecha, project_id: projectId, projects: { nombre },
  entrada: `${fecha}T08:00:00`, salida: salida ? `${fecha}T18:00:00` : null,
  costo_total: salida ? costo : null, valor_hora: 50000,
})

const registros = [
  r(1, '2026-10-01', 'A', 'Quillayes 19', 50000),
  r(2, '2026-10-02', 'A', 'Quillayes 19', 50000),
  r(3, '2026-10-02', 'B', 'Vale Canepa', 20000),   // mismo día, otra obra
  r(4, '2026-10-05', 'B', 'Vale Canepa', 55000),   // con bono
  r(5, '2026-10-06', 'A', 'Quillayes 19', 0, false), // turno abierto
]

describe('resumirFicha', () => {
  const f = resumirFicha(registros)

  it('días distintos, turnos y total sin los turnos abiertos', () => {
    expect(f).toMatchObject({ dias: 3, turnos: 4, total: 175000, abiertos: 1 })
  })

  it('desglose por obra con primera y última fecha', () => {
    expect(f.porObra).toEqual([
      { projectId: 'A', nombre: 'Quillayes 19', dias: 2, turnos: 2, total: 100000, primera: '2026-10-01', ultima: '2026-10-02' },
      { projectId: 'B', nombre: 'Vale Canepa', dias: 2, turnos: 2, total: 75000, primera: '2026-10-02', ultima: '2026-10-05' },
    ])
  })

  it('el total por obra cuadra con la suma de los registros de esa obra', () => {
    const sumaA = registros.filter(x => x.project_id === 'A').reduce((s, x) => s + (x.costo_total ?? 0), 0)
    expect(f.porObra.find(o => o.projectId === 'A').total).toBe(sumaA)
  })

  it('lista de días: todos (incluido el abierto), del más reciente al más antiguo', () => {
    expect(f.registros).toHaveLength(5)
    expect(f.registros[0].id).toBe(5)
    expect(f.registros.at(-1).id).toBe(1)
  })

  it('sin registros', () => {
    expect(resumirFicha([])).toMatchObject({ dias: 0, turnos: 0, total: 0, abiertos: 0, porObra: [] })
  })
})

describe('moverRango', () => {
  it('modo mes: mes anterior y siguiente, cruzando el año', () => {
    expect(moverRango({ desde: '2026-01-01', hasta: '2026-01-31', modo: 'mes' }, -1)).toEqual({ desde: '2025-12-01', hasta: '2025-12-31', modo: 'mes' })
    expect(moverRango({ desde: '2026-02-01', hasta: '2026-02-28', modo: 'mes' }, 1)).toEqual({ desde: '2026-03-01', hasta: '2026-03-31', modo: 'mes' })
  })
  it('modo rango: se mueve por el mismo largo', () => {
    expect(moverRango({ desde: '2026-10-05', hasta: '2026-10-11', modo: 'rango' }, -1)).toEqual({ desde: '2026-09-28', hasta: '2026-10-04', modo: 'rango' })
    expect(moverRango({ desde: '2026-10-05', hasta: '2026-10-11', modo: 'rango' }, 1)).toEqual({ desde: '2026-10-12', hasta: '2026-10-18', modo: 'rango' })
  })
})
