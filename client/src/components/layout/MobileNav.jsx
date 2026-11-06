import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export function MobileNav({ isOpen, onClose }) {
  const { t } = useTranslation();
  const { logout } = useAuth();

  if (!isOpen) return null;

  const navItems = [
    { to: '/parent/dashboard', label: t('nav.dashboard', 'Dashboard'), icon: '📊' },
    { to: '/parent/children', label: t('nav.children', 'My Children'), icon: '👨‍🎓' },
    { to: '/parent/receipts', label: t('nav.receipts', 'GST Receipts'), icon: '🧾' },
    { to: '/parent/profile', label: t('nav.profile', 'Profile'), icon: '👤' }
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(15, 30, 22, 0.5)',
        backdropFilter: 'blur(2px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '280px',
          height: '100%',
          backgroundColor: 'var(--color-surface)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          padding: 'var(--space-4)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-base)', color: 'var(--color-primary)' }}>
            FEETrack
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '22px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)'
            }}
          >
            &times;
          </button>
        </div>

        {/* Links */}
        <nav style={{ flex: 1, paddingTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-base)',
                fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                backgroundColor: isActive ? 'var(--color-primary-light)' : 'transparent',
                textDecoration: 'none'
              })}
            >
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
          <button
            type="button"
            onClick={() => {
              onClose();
              logout();
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--color-danger)',
              fontSize: 'var(--font-size-base)',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <span>🚪</span>
            <span>{t('nav.logout', 'Log Out')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
