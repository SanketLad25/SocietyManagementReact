const FEATURES = [
  'Pay maintenance bills online, on time',
  'Raise and track complaints instantly',
  'Stay updated with society notices & events',
  'Manage visitor and gate entries securely',
]

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <div className="auth-brand-content">
          <div className="auth-logo">
            <span className="auth-logo-mark">S</span>
            Society Manager
          </div>
          <h1>Your society, managed in one place.</h1>
          <p>The resident portal for your society — everything it needs, online.</p>
          <ul className="auth-feature-list">
            {FEATURES.map((feature) => (
              <li key={feature}>
                <span className="auth-feature-check" aria-hidden="true">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <div className="auth-brand-glow" aria-hidden="true" />
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
