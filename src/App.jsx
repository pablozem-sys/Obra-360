import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import { Loader2 } from 'lucide-react'

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
import Gastos           from './pages/Gastos'
import ControlAsistencia from './pages/ControlAsistencia'
import Usuarios         from './pages/Usuarios'
import ResetPassword    from './pages/ResetPassword'
import BanosQuimicos    from './pages/BanosQuimicos'
import Gestion         from './pages/Gestion'

// Detecta token de recovery en cualquier ruta y redirige a /reset-password
function RecoveryRedirect() {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (location.pathname === '/reset-password') return
    const code = new URLSearchParams(location.search).get('code')
    const hash = new URLSearchParams(window.location.hash.replace('#', '?'))
    if (code || hash.get('type') === 'recovery') {
      navigate('/reset-password' + location.search + window.location.hash, { replace: true })
    }
  }, [location])
  return null
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  )
}

function SinAcceso() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={{ background: 'var(--bg-base)' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-3xl"
        style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,69,96,0.25)' }}>
        🔒
      </div>
      <h2 className="font-display font-bold text-xl mb-2" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
        Sin acceso
      </h2>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Tu cuenta no tiene acceso a esta empresa.
      </p>
    </div>
  )
}

// Protege rutas admin — redirige al landing si no hay sesión, muestra "sin acceso" si el usuario no pertenece a la empresa de este despliegue
function ProtectedRoute({ children, roles }) {
  const { isAuth, rol, loading, empresa } = useAuth()
  if (loading) return <Spinner />
  if (!isAuth) return <Navigate to="/" replace />
  if (!empresa) return <SinAcceso />
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
    <>
    <RecoveryRedirect />
    <Routes>
      {/* ── Públicas ──────────────────────────────── */}
      <Route path="/"                      element={<Landing />} />
      <Route path="/login"                 element={<Login />} />
      <Route path="/reset-password"         element={<ResetPassword />} />
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
        <Route path="/gastos"           element={<Gastos />} />
        <Route path="/documentos"       element={<Biblioteca />} />
        <Route path="/banos-quimicos"   element={<BanosQuimicos />} />
        <Route path="/gestion"          element={<Gestion />} />

        {/* Solo dueño */}
        <Route path="/cuentas-cobrar"   element={<DuenoRoute><CuentasCobrar /></DuenoRoute>} />
        <Route path="/eerr"             element={<DuenoRoute><EstadoResultado /></DuenoRoute>} />
        <Route path="/flujo-caja"       element={<DuenoRoute><FlujoCaja /></DuenoRoute>} />
        <Route path="/usuarios"         element={<DuenoRoute><Usuarios /></DuenoRoute>} />

        <Route path="*"                 element={<Navigate to="/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
