export default function PasswordToggle({ visible, onToggle, controlsId }) {
  return (
    <button
      type="button"
      className="password-toggle"
      onClick={onToggle}
      aria-label={visible ? 'Hide password' : 'Show password'}
      aria-controls={controlsId}
      aria-pressed={visible}
    >
      {visible ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M6.5 6.7C4.4 8.1 2.9 10 2 12c1.6 3.9 5.5 7 10 7 1.6 0 3.1-.4 4.4-1.1M9.9 4.2A10.4 10.4 0 0112 4c4.5 0 8.4 3.1 10 7-.5 1.2-1.2 2.4-2.1 3.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M2 12c1.6-3.9 5.5-7 10-7s8.4 3.1 10 7c-1.6 3.9-5.5 7-10 7s-8.4-3.1-10-7z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )}
    </button>
  )
}
