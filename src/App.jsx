import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Obras from './pages/Obras'
import DetalleObra from './pages/DetalleObra'
import NuevoGasto from './pages/NuevoGasto'
import CuentasPagar from './pages/CuentasPagar'
import CuentasCobrar from './pages/CuentasCobrar'
import EstadoResultado from './pages/EstadoResultado'
import FlujoCaja from './pages/FlujoCaja'
import Biblioteca from './pages/Biblioteca'
import Mapa from './pages/Mapa'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="obras" element={<Obras />} />
        <Route path="obras/:id" element={<DetalleObra />} />
        <Route path="gastos/nuevo" element={<NuevoGasto />} />
        <Route path="cuentas-pagar" element={<CuentasPagar />} />
        <Route path="cuentas-cobrar" element={<CuentasCobrar />} />
        <Route path="eerr" element={<EstadoResultado />} />
        <Route path="flujo-caja" element={<FlujoCaja />} />
        <Route path="documentos" element={<Biblioteca />} />
        <Route path="mapa" element={<Mapa />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
