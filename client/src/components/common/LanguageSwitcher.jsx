import React from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../../i18n';

export function LanguageSwitcher({ className = '' }) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('hi') ? 'hi' : 'en';

  const toggleLanguage = () => {
    const next = currentLang === 'en' ? 'hi' : 'en';
    changeLanguage(next);
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={`Switch language. Current: ${currentLang === 'en' ? 'English' : 'Hindi'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: 'var(--space-1) var(--space-2)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)',
        color: 'var(--color-primary)',
        backgroundColor: 'var(--color-primary-light)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all 0.15s ease'
      }}
      className={`lang-switcher ${className}`}
    >
      <span style={{ fontSize: '13px' }}>🌐</span>
      <span>{currentLang === 'en' ? 'हिन्दी' : 'English'}</span>
    </button>
  );
}
