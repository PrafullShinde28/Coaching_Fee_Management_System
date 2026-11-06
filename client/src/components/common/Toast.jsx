import React from 'react';
import { useToast } from '../../context/ToastContext';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  const typeStyles = {
    success: {
      bg: 'var(--color-success-bg)',
      border: 'var(--color-success-border)',
      color: 'var(--color-success)',
      icon: '✓'
    },
    error: {
      bg: 'var(--color-danger-bg)',
      border: 'var(--color-danger-border)',
      color: 'var(--color-danger)',
      icon: '✕'
    },
    warning: {
      bg: 'var(--color-warning-bg)',
      border: 'var(--color-warning-border)',
      color: 'var(--color-warning)',
      icon: '!'
    },
    info: {
      bg: 'var(--color-info-bg)',
      border: 'var(--color-info-border)',
      color: 'var(--color-info)',
      icon: 'ℹ'
    }
  };

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'var(--space-6)',
        right: 'var(--space-6)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        maxWidth: '380px',
        width: 'calc(100% - var(--space-8))'
      }}
    >
      {toasts.map((toast) => {
        const style = typeStyles[toast.type] || typeStyles.info;
        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: style.bg,
              border: `1px solid ${style.border}`,
              color: style.color,
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              fontSize: 'var(--font-size-sm)',
              animation: 'slideUp 0.2s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontWeight: 'bold' }}>{style.icon}</span>
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss toast"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'currentColor',
                cursor: 'pointer',
                fontSize: 'var(--font-size-base)',
                lineHeight: 1,
                padding: '2px'
              }}
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}
