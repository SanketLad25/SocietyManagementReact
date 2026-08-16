export default function FormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  autoComplete,
  rightSlot,
  hint,
  disabled,
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`field-control ${error ? 'has-error' : ''}`}>
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {rightSlot}
      </div>
      {!error && hint && <p className="field-hint">{hint}</p>}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

// Shares the .field-control styled-select treatment (custom chevron, focus ring,
// error state) from styles/auth.css — use this instead of a bare <select> anywhere
// in the app so every dropdown looks consistent.
export function SelectField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  disabled,
  children,
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`field-control ${error ? 'has-error' : ''}`}>
        <select
          id={id}
          name={id}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        >
          {children}
        </select>
      </div>
      {!error && hint && <p className="field-hint">{hint}</p>}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}
