import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

export function ErrorState({
  title,
  message,
  onRetry,
  className = ''
}) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8) var(--space-6)',
        backgroundColor: 'var(--color-danger-bg)',
        border: '1px solid var(--color-danger-border)',
        borderRadius: 'var(--radius-xl)',
        textAlign: 'center',
        gap: 'var(--space-3)'
      }}
      className={className}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: '#fee2e2',
          color: 'var(--color-danger)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          fontWeight: 'bold'
        }}
      >
        !
      </div>
      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-danger)' }}>
        {title || t('common.errorTitle', 'Something went wrong')}
      </h4>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', maxWidth: '440px', margin: 0 }}>
        {message || t('common.errorMessage', 'Unable to load data. Please verify your connection or try again.')}
      </p>
      {onRetry && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <Button variant="danger" size="sm" onClick={onRetry}>
            {t('common.retry', 'Try Again')}
          </Button>
        </div>
      )}
    </div>
  );
}
