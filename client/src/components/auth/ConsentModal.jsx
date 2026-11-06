import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';

export function ConsentModal({ isOpen }) {
  const { t } = useTranslation();
  const { submitConsent } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleAccept = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await submitConsent('2026.1');
    } catch (err) {
      setError(err.message || 'Failed to submit consent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        backgroundColor: 'rgba(15, 30, 22, 0.7)',
        backdropFilter: 'blur(3px)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--color-border)',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}
          >
            📋
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
              {t('auth.consentTitle', 'Parental Consent & Portal Agreement')}
            </h3>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {t('auth.consentVersion', 'Policy v2026.1')}
            </span>
          </div>
        </div>

        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          {t('auth.consentBody', 'To access student fee ledgers, online payment receipts, and automated notifications under coaching institute policies, please confirm your consent as the registered parent or guardian.')}
        </p>

        {error && (
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
          <Button
            variant="primary"
            onClick={handleAccept}
            loading={submitting}
          >
            {t('auth.consentAgree', 'I Understand and Accept')}
          </Button>
        </div>
      </div>
    </div>
  );
}
