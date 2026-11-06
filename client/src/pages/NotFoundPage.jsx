import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/common/Button';

export function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-6)'
      }}
    >
      <div style={{ fontSize: '48px', fontWeight: 'bold', color: 'var(--color-primary)' }}>404</div>
      <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>
        {t('common.notFoundTitle', 'Page Not Found')}
      </h1>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', maxWidth: '400px' }}>
        {t('common.notFoundMessage', 'The page you are looking for does not exist or has been moved.')}
      </p>
      <Button variant="primary" onClick={() => navigate('/parent/dashboard')}>
        {t('common.backToDashboard', 'Back to Dashboard')}
      </Button>
    </div>
  );
}
