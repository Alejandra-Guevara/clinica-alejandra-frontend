import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="screen-loading"><span className="spinner" />Comprobando sesión…</div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.some((role) => user.roles.includes(role))) return <Navigate to="/403" replace />
  return <Outlet />
}
