import { useEffect } from 'react'
import '../styles/sidePanel.css'

// Same shape as Modal.jsx (title/subtitle/onClose/children) plus a `footer` slot for sticky
// action buttons, and docked to the right instead of centered — for a form long enough to need
// its own scroll region without the action buttons scrolling out of view.
export default function SidePanel({ title, subtitle, onClose, footer, children }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="side-panel-backdrop" onClick={onClose}>
      <div className="side-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="side-panel-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="side-panel-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="side-panel-body">{children}</div>
        {footer && <div className="side-panel-footer">{footer}</div>}
      </div>
    </div>
  )
}
