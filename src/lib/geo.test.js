import { describe, it, expect } from 'vitest'
import { distanciaM, estadoUbicacion, formatDistancia, RADIO_OBRA_M } from './geo'

const obra = { lat: -33.4100, lng: -70.5700 }

describe('estadoUbicacion', () => {
  it('sin coordenadas del marcaje = no activó la ubicación', () => {
    expect(estadoUbicacion(null, null, obra).estado).toBe('sin_gps')
  })
  it('obra sin coordenadas = no se puede comparar', () => {
    expect(estadoUbicacion(-33.41, -70.57, { lat: null, lng: null }).estado).toBe('sin_obra')
  })
  it('dentro del radio', () => {
    const r = estadoUbicacion(-33.4105, -70.5702, obra)
    expect(r.estado).toBe('ok')
    expect(r.distancia).toBeLessThan(RADIO_OBRA_M)
  })
  it('fuera del radio', () => {
    const r = estadoUbicacion(-33.4300, -70.5700, obra)
    expect(r.estado).toBe('lejos')
    expect(r.distancia).toBeGreaterThan(2000)
  })
  it('acepta numeric de Postgres como string', () => {
    expect(estadoUbicacion('-33.4101', '-70.5700', { lat: '-33.41', lng: '-70.57' }).estado).toBe('ok')
  })
})

describe('distancia', () => {
  it('1 grado de latitud ≈ 111 km', () => {
    expect(distanciaM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -2)
  })
  it('formato', () => {
    expect(formatDistancia(84)).toBe('80 m')
    expect(formatDistancia(2340)).toBe('2,3 km')
    expect(formatDistancia(15400)).toBe('15 km')
  })
})
