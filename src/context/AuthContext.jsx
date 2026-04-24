import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export const PERMISOS = {
  dueno: {
    verIngresos: true,
    verMargen: true,
    verEERR: true,
    verFlujoCaja: true,
    verCxC: true,
    verCxP: true,
    verAsistencia: true,
    verObras: true,
    verDocumentos: true,
    verMapa: true,
    subirGastos: true,
    editarTodo: true,
  },
  administrativo: {
    verIngresos: false,
    verMargen: false,
    verEERR: false,
    verFlujoCaja: false,
    verCxC: false,
    verCxP: true,
    verAsistencia: true,
    verObras: true,
    verDocumentos: true,
    verMapa: true,
    subirGastos: true,
    editarTodo: false,
  },
  trabajador: {
    soloAsistencia: true,
  },
}

const MOCK_USERS = {
  dueno:         { id: '1', nombre: 'Pedro Torres',   rol: 'dueno',         avatar: 'PT', email: 'pedro@obra360.cl' },
  administrativo:{ id: '2', nombre: 'María González', rol: 'administrativo', avatar: 'MG', email: 'maria@obra360.cl' },
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)

  const loginAdmin = (rol) => {
    setSession({ user: MOCK_USERS[rol] })
    return true
  }

  const loginTrabajador = (trabajador) => {
    setSession({ user: { ...trabajador, rol: 'trabajador' } })
  }

  const logout = () => setSession(null)

  const can = (permiso) => {
    if (!session?.user) return false
    return PERMISOS[session.user.rol]?.[permiso] ?? false
  }

  const rol = session?.user?.rol ?? null
  const user = session?.user ?? null
  const isAuth = !!session

  return (
    <AuthContext.Provider value={{ user, rol, isAuth, loginAdmin, loginTrabajador, logout, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
