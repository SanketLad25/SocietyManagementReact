const THEME_KEY = 'shubhangi-chsl.theme'

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveInitialTheme() {
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'dark' || stored === 'light' ? stored : systemPrefersDark() ? 'dark' : 'light'
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function persistTheme(theme) {
  localStorage.setItem(THEME_KEY, theme)
}
