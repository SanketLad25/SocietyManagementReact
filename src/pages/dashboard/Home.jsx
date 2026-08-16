import { Link } from 'react-router-dom'
import { getSession } from '../../api/session.js'
import { getVisibleNavItems } from '../../config/dashboardNav.js'
import Icon from '../../components/Icon.jsx'

export default function Home() {
  const session = getSession()
  const quickLinks = getVisibleNavItems(session?.role).filter((item) => item.key !== 'home')

  return (
    <div className="dash-home">
      <div className="dash-welcome">
        <h2>Welcome, {session?.fullName || session?.email || 'there'}.</h2>
        <p>
          {session?.societyName
            ? `Here's quick access to everything at ${session.societyName}.`
            : "Here's quick access to platform administration."}
        </p>
      </div>

      <div className="dash-grid">
        {quickLinks.map((item) => (
          <Link key={item.key} to={item.path} className="dash-card">
            <span className="dash-card-icon">
              <Icon paths={item.icon} size={22} />
            </span>
            <span className="dash-card-body">
              <span className="dash-card-title">{item.label}</span>
              <span className="dash-card-description">{item.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
