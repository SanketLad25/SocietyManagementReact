import { useState } from 'react'
import Icon from './Icon.jsx'
import { applyTheme, persistTheme, resolveInitialTheme } from '../theme.js'
import '../styles/themeToggle.css'

const SUN_PATHS = [
  'M12 4.5v-1',
  'M12 20.5v-1',
  'M4.5 12h-1',
  'M20.5 12h-1',
  'M6.3 6.3l-.7-.7',
  'M18.4 18.4l-.7-.7',
  'M17.7 6.3l.7-.7',
  'M5.6 18.4l.7-.7',
  'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
]

const MOON_PATHS = ['M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z']

export default function ThemeToggle() {
  const [theme, setTheme] = useState(resolveInitialTheme)
  const isDark = theme === 'dark'

  const toggle = () => {
    const next = isDark ? 'light' : 'dark'
    applyTheme(next)
    persistTheme(next)
    setTheme(next)
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
    >
      <Icon paths={isDark ? MOON_PATHS : SUN_PATHS} size={18} />
    </button>
  )
}
