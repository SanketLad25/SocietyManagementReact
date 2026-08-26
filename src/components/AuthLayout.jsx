const FEATURES = [
  'Pay maintenance bills online, on time',
  'Raise and track complaints instantly',
  'Stay updated with society notices & events',
  'Manage visitor and gate entries securely',
]

// A shield (protection/trust) enclosing a small isometric skyline — each building is a real
// front/top/side face trio (light roof, mid-tone front, darker side) rather than a flat rect, for
// a genuine 3D block look, in a soft light-blue "glass tower" palette with warm lit-window
// accents. The shield itself stays on this app's translucent-white convention (matching the
// feature checkmarks below); only the buildings get color, so the mark still reads as this app's
// own brand panel rather than a copy of any particular reference image's palette.
function BrandMarkIcon() {
  return (
    <svg width="128" height="128" viewBox="0 0 120 120" fill="none" aria-hidden="true" className="auth-brand-mark-svg">
      <defs>
        <linearGradient id="bmShield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
        </linearGradient>
        <linearGradient id="bmFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EAF3FF" />
          <stop offset="100%" stopColor="#8FB8F5" />
        </linearGradient>
        <linearGradient id="bmTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#DCEBFF" />
        </linearGradient>
        <linearGradient id="bmSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6E9BE0" />
          <stop offset="100%" stopColor="#5680C4" />
        </linearGradient>
      </defs>

      <path
        d="M60 8 L104 26 V58 C104 88 84 106 60 112 C36 106 16 88 16 58 V26 Z"
        fill="url(#bmShield)"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Left building */}
      <g strokeLinejoin="round">
        <polygon points="28,62 44,62 50,56 34,56" fill="url(#bmTop)" />
        <polygon points="44,62 50,56 50,86 44,92" fill="url(#bmSide)" />
        <rect x="28" y="62" width="16" height="30" fill="url(#bmFront)" />
        <rect x="32" y="68" width="3" height="3" fill="#FFE9B0" />
        <rect x="38" y="68" width="3" height="3" fill="#FFE9B0" />
        <rect x="32" y="76" width="3" height="3" fill="#FFE9B0" />
        <rect x="38" y="76" width="3" height="3" fill="#FFE9B0" />
        <rect x="32" y="84" width="3" height="3" fill="#FFE9B0" />
      </g>

      {/* Center building (tallest) */}
      <g strokeLinejoin="round">
        <polygon points="50,48 68,48 75,41 57,41" fill="url(#bmTop)" />
        <polygon points="68,48 75,41 75,85 68,92" fill="url(#bmSide)" />
        <rect x="50" y="48" width="18" height="44" fill="url(#bmFront)" />
        <rect x="54" y="54" width="3" height="3" fill="#FFE9B0" />
        <rect x="61" y="54" width="3" height="3" fill="#FFE9B0" />
        <rect x="54" y="62" width="3" height="3" fill="#FFE9B0" />
        <rect x="61" y="62" width="3" height="3" fill="#FFE9B0" />
        <rect x="54" y="70" width="3" height="3" fill="#FFE9B0" />
        <rect x="61" y="70" width="3" height="3" fill="#FFE9B0" />
        <rect x="54" y="78" width="3" height="3" fill="#FFE9B0" />
        <rect x="61" y="78" width="3" height="3" fill="#FFE9B0" />
      </g>

      {/* Right building */}
      <g strokeLinejoin="round">
        <polygon points="74,68 88,68 94,62 80,62" fill="url(#bmTop)" />
        <polygon points="88,68 94,62 94,86 88,92" fill="url(#bmSide)" />
        <rect x="74" y="68" width="14" height="24" fill="url(#bmFront)" />
        <rect x="78" y="74" width="3" height="3" fill="#FFE9B0" />
        <rect x="83" y="74" width="3" height="3" fill="#FFE9B0" />
        <rect x="78" y="82" width="3" height="3" fill="#FFE9B0" />
        <rect x="83" y="82" width="3" height="3" fill="#FFE9B0" />
      </g>
    </svg>
  )
}

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <div className="auth-brand-mark">
          <BrandMarkIcon />
          <span className="auth-brand-wordmark">Society Manager</span>
        </div>
        <div className="auth-brand-content">
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
