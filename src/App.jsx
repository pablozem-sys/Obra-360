import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import Landing           from './pages/Landing'
import Login             from './pages/Login'
import AccesoTrabajador  from './pages/AccesoTrabajador'
import Asistencia        from './pages/Asistencia'

import AppLayout         from './components/layout/AppLayout'
import Dashboard         from './pages/Dashboard'
import Obras             from './pages/Obras'
import DetalleObra       from './pages/DetalleObra'
import NuevoGasto        from './pages/NuevoGasto'
import CuentasPagar      from './pages/CuentasPagar'
import CuentasCobrar     from './pages/CuentasCobrar'
import EstadoResultado   from './pages/EstadoResultado'
import FlujoCaja         from './pages/FlujoCaja'
import Biblioteca        from './pages/Biblioteca'
import Mapa              from './pages/Mapa'
import ControlAsistencia from './pages/ControlAsistencia'

// Protege rutas admin — redirige al landing si no hay sesión
function ProtectedRoute({ children, roles }) {
  const { isAuth, rol } = useAuth()
  if (!isAuth) return <Navigate to="/" replace />
  if (roles && !roles.includes(rol)) return <Navigate to="/dashboard" replace />
  return children
}

// Ruta solo para dueño — muestra mensaje bloqueado si es admin
function DuenoRoute({ children }) {
  const { rol } = useAuth()
  if (rol !== 'dueno') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-3xl"
          style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,69,96,0.25)' }}>
          🔒
        </div>
        <h2 className="font-display font-bold text-xl mb-2" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
          Acceso restringido
        </h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Esta sección solo está disponible para el Dueño / Gerente.
        </p>
      </div>
    )
  }
  return children
}

export default function App() {
  return (
    <Routes>
      {/* ── Públicas ──────────────────────────────── */}
      <Route path="/"                      element={<Landing />} />
      <Route path="/login"                 element={<Login />} />
      <Route path="/trabajador"            element={<AccesoTrabajador />} />
      <Route path="/trabajador/asistencia" element={<Asistencia />} />

      {/* ── Admin / Dueño (layout con sidebar) ───── */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard"        element={<Dashboard />} />
        <Route path="/obras"            element={<Obras />} />
        <Route path="/obras/:id"        element={<DetalleObra />} />
        <Route path="/gastos/nuevo"     element={<NuevoGasto />} />
        <Route path="/cuentas-pagar"    element={<CuentasPagar />} />
        <Route path="/asistencia-control" element={<ControlAsistencia />} />
        <Route path="/documentos"       element={<Biblioteca />} />
        <Route path="/mapa"             element={<Mapa />} />

        {/* Solo dueño */}
        <Route path="/cuentas-cobrar"   element={<DuenoRoute><CuentasCobrar /></DuenoRoute>} />
        <Route path="/eerr"             element={<DuenoRoute><EstadoResultado /></DuenoRoute>} />
        <Route path="/flujo-caja"       element={<DuenoRoute><FlujoCaja /></DuenoRoute>} />

        <Route path="*"                 element={<Navigate to="/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
