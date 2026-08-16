import { Navigate } from 'react-router-dom'
import { getSession } from '../api/session.js'

export default function RequireRole({ roles, children, redirectTo = '/dashboard' }) {
  const session = getSession()

  if (!roles.includes(session?.role)) {
    return <Navigate to={redirectTo} replace />
  }

  return children
}
