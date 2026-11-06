import React, { forwardRef } from 'react';

export const Input = forwardRef(function Input(
  {
    label,
    id,
    type = 'text',
    error,
    hint,
    required = false,
    className = '',
    style = {},
    ...props
  },
  ref
) {
  const inputId = id || props.name || Math.random().toString(36).substring(2, 8);

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    width: '100%'
  };

  const labelStyle = {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-1)'
  };

  const inputStyle = {
    width: '100%',
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family)',
    color: 'var(--color-text)',
    backgroundColor: 'var(--color-surface)',
    border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius-md)',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    ...style
  };

  const errorStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-danger)',
    marginTop: 'var(--space-1)'
  };

  const hintStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
    marginTop: 'var(--space-1)'
  };

  return (
    <div style={containerStyle} className={`input-group ${className}`}>
      {label && (
        <label htmlFor={inputId} style={labelStyle}>
          {label}
          {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        required={required}
        aria-invalid={Boolean(error)}
        style={inputStyle}
        {...props}
      />
      {error && <p style={errorStyle}>{error}</p>}
      {!error && hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
});
