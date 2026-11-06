import React from 'react';

export function Card({
  children,
  title,
  subtitle,
  headerAction,
  footer,
  className = '',
  style = {},
  onClick,
  ...props
}) {
  const cardStyle = {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
    transition: onClick ? 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.1s ease' : 'none',
    cursor: onClick ? 'pointer' : 'default',
    ...style
  };

  const headerStyle = {
    padding: 'var(--space-4) var(--space-5)',
    borderBottom: '1px solid var(--color-border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-4)'
  };

  const bodyStyle = {
    padding: 'var(--space-5)'
  };

  const footerStyle = {
    padding: 'var(--space-3) var(--space-5)',
    backgroundColor: 'var(--color-surface-subtle)',
    borderTop: '1px solid var(--color-border-subtle)'
  };

  return (
    <div
      style={cardStyle}
      className={`card ${className}`}
      onClick={onClick}
      {...props}
    >
      {(title || headerAction) && (
        <div style={headerStyle}>
          <div>
            {title && (
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div style={bodyStyle}>{children}</div>
      {footer && <div style={footerStyle}>{footer}</div>}
    </div>
  );
}
