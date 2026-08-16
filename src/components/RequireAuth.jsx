import { Navigate, useLocation } from 'react-router-dom'
import { clearSession, getSession, isSessionValid } from '../api/session.js'

export default function RequireAuth({ children }) {
  const location = useLocation()
  const session = getSession()

  if (!isSessionValid(session)) {
    clearSession()
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
