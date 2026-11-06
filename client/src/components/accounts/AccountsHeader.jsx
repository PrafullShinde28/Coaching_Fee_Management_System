import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { formatPhone } from '../../utils/formatters';

export function AccountsHeader({ onToggleMobileNav }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <header
      style={{
        height: 'var(--header-height)',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-6)',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}
    >
      {/* Left: Mobile hamburger & title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <button
          type="button"
          onClick={onToggleMobileNav}
          aria-label="Toggle navigation menu"
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            fontSize: '22px',
            cursor: 'pointer',
            padding: 'var(--space-1)',
            color: 'var(--color-text)'
          }}
          className="accounts-mobile-hamburger"
        >
          ☰
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
            FEETrack Accounts Desk
          </span>
          <span style={{ fontSize: '11px', backgroundColor: '#e8f5e9', color: '#1b4332', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
            Staff
          </span>
        </div>
      </div>

      {/* Right: Phone, LanguageSwitcher, Staff info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <LanguageSwitcher />

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>
                {formatPhone(user.phone)}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                Accounts Officer
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Log Out"
              title={t('nav.logout', 'Log Out')}
              style={{
                background: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-1) var(--space-2)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-danger)'
              }}
              className="accounts-desktop-logout-btn"
            >
              {t('nav.logout', 'Log Out')}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .accounts-mobile-hamburger {
            display: block !important;
          }
          .accounts-desktop-logout-btn {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
