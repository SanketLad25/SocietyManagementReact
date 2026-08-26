import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { applyTheme, resolveInitialTheme } from './theme.js'

// Applied before the first paint, not inside a component effect, so there's no flash of the
// wrong theme on load — every page (including login/register, which have no toggle of their own)
// picks up the persisted/system theme immediately.
applyTheme(resolveInitialTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
