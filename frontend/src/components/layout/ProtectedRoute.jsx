import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/index.js'
import Spinner from '../ui/Spinner.jsx'

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" className="text-blue-600" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to={`/login?from=${encodeURIComponent(location.pathname)}`} replace />
  }

  return <Outlet />
}
