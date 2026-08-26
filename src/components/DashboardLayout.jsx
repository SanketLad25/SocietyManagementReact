import { useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearSession, getSession } from '../api/session.js'
import { getVisibleNavItems, LOGOUT_ICON } from '../config/dashboardNav.js'
import Icon from './Icon.jsx'
import NoticeBell from './NoticeBell.jsx'
import ComplaintSiren from './ComplaintSiren.jsx'
import EventBell from './EventBell.jsx'
import VisitorBell from './VisitorBell.jsx'
import ChatWidget from './ChatWidget.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import '../styles/dashboard.css'

const COLLAPSE_KEY = 'shubhangi-chsl.sidebar-collapsed'
const COLLAPSE_ICON = ['M15 18l-6-6 6-6']
const EXPAND_ICON = ['M9 18l6-6-6-6']

export default function DashboardLayout() {
  const navigate = useNavigate()
  const session = getSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === 'true')

  const visibleNavItems = getVisibleNavItems(session?.role)

  if (session?.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  const handleLogout = () => {
    clearSession()
    navigate('/login', { replace: true })
  }

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(COLLAPSE_KEY, String(next))
      return next
    })
  }

  return (
    <div className={`dash-shell ${sidebarOpen ? 'sidebar-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="dash-sidebar">
        <div className="dash-sidebar-brand">
          <span className="auth-logo-mark">S</span>
          <span className="dash-sidebar-brand-text">{session?.societyName || 'Platform Admin'}</span>
        </div>

        <nav className="dash-nav">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `dash-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? item.label : undefined}
            >
              <Icon paths={item.icon} size={18} />
              <span className="dash-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="dash-nav-link dash-logout"
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
        >
          <Icon paths={LOGOUT_ICON} size={18} />
          <span className="dash-nav-label">Logout</span>
        </button>

        <button
          type="button"
          className="dash-collapse-toggle"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleCollapsed}
        >
          <Icon paths={collapsed ? EXPAND_ICON : COLLAPSE_ICON} size={16} />
        </button>
      </aside>

      <div className="dash-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />

      <div className="dash-main">
        <header className="dash-topbar">
          <button
            type="button"
            className="dash-menu-toggle"
            aria-label="Toggle menu"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            <Icon paths={['M4 7h16', 'M4 12h16', 'M4 17h16']} size={20} />
          </button>

          <div className="dash-topbar-spacer" />

          <ThemeToggle />

          {session?.role !== 'SuperAdmin' && (
            <div className="dash-topbar-alerts">
              <NoticeBell />
              <ComplaintSiren />
              <EventBell />
              <VisitorBell />
            </div>
          )}

          <div className="dash-user">
            <span className="dash-user-name">{session?.fullName || session?.email}</span>
            <span className="dash-user-role">{session?.role}</span>
          </div>
        </header>

        <main className="dash-content">
          <Outlet />
        </main>
      </div>

      {/* Same session?.role !== 'SuperAdmin' guard as the bells above — UX only, the real boundary is
          the backend's [Authorize(Roles = RoleNames.ChattableRoles)] on ChatController. Rendered
          outside dash-main since it's a floating overlay, not part of the topbar's icon row. */}
      {session?.role !== 'SuperAdmin' && <ChatWidget />}
    </div>
  )
}
