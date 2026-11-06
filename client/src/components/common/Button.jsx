import React from 'react';

/**
 * Reusable Button component with multiple variants:
 * 'primary' | 'secondary' | 'outline' | 'danger'
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  icon = null,
  ...props
}) {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    fontFamily: 'var(--font-family)',
    fontWeight: 'var(--font-weight-medium)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid transparent',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
    textDecoration: 'none',
    whiteSpace: 'nowrap'
  };

  const sizeStyles = {
    sm: { padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--font-size-xs)' },
    md: { padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--font-size-sm)' },
    lg: { padding: 'var(--space-3) var(--space-6)', fontSize: 'var(--font-size-base)' }
  };

  const variantStyles = {
    primary: {
      backgroundColor: 'var(--color-primary)',
      color: 'var(--color-text-inverse)',
      borderColor: 'var(--color-primary)',
      boxShadow: 'var(--shadow-xs)'
    },
    secondary: {
      backgroundColor: 'var(--color-surface-subtle)',
      color: 'var(--color-text)',
      borderColor: 'var(--color-border)'
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--color-primary)',
      borderColor: 'var(--color-primary)'
    },
    danger: {
      backgroundColor: 'var(--color-danger)',
      color: 'var(--color-text-inverse)',
      borderColor: 'var(--color-danger)'
    }
  };

  const combinedStyle = {
    ...baseStyle,
    ...sizeStyles[size],
    ...variantStyles[variant]
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      style={combinedStyle}
      className={`btn btn-${variant} ${className}`}
      {...props}
    >
      {loading ? (
        <span
          style={{
            display: 'inline-block',
            width: '1em',
            height: '1em',
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite'
          }}
        />
      ) : icon}
      {children}
    </button>
  );
}
