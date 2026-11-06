import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export function AccountsSidebar() {
  const { t } = useTranslation();
  const { logout } = useAuth();

  const navItems = [
    { to: '/accounts/dashboard', label: t('accountsNav.dashboard', 'Dashboard'), icon: '📊' },
    { to: '/accounts/students', label: t('accountsNav.students', 'Students & Fees'), icon: '👥' },
    { to: '/accounts/collections', label: t('accountsNav.collections', 'Record Payment'), icon: '💳' },
    { to: '/accounts/unmatched-payments', label: t('accountsNav.unmatched', 'Unmatched Queue'), icon: '🔍' },
    { to: '/accounts/refunds', label: t('accountsNav.refunds', 'Refunds Management'), icon: '↩️' },
    { to: '/accounts/reminders', label: t('accountsNav.reminders', 'Fee Reminders'), icon: '🔔' },
    { to: '/accounts/risk-flags', label: t('accountsNav.riskFlags', 'Dropout Risk Triage'), icon: '⚠️' },
    { to: '/accounts/reports', label: t('accountsNav.reports', 'Reports & CSV'), icon: '📑' }
  ];

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        backgroundColor: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 50
      }}
      className="accounts-desktop-sidebar"
    >
      {/* Brand Header */}
      <div
        style={{
          height: 'var(--header-height)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: '0 var(--space-5)',
          borderBottom: '1px solid var(--color-border-subtle)'
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#1b4332',
            color: 'var(--color-text-inverse)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '18px'
          }}
        >
          A
        </div>
        <div>
          <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-base)', color: 'var(--color-primary)' }}>
            Accounts Portal
          </div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Apex Academy Jaipur
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <nav
        style={{
          flex: 1,
          padding: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
          overflowY: 'auto'
        }}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              backgroundColor: isActive ? 'var(--color-primary-light)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.12s ease'
            })}
          >
            <span style={{ fontSize: '16px' }}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer / Logout */}
      <div style={{ padding: 'var(--space-3)', borderTop: '1px solid var(--color-border-subtle)' }}>
        <button
          type="button"
          onClick={logout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--color-danger)',
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <span>🚪</span>
          <span>{t('nav.logout', 'Log Out')}</span>
        </button>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .accounts-desktop-sidebar {
            display: none !important;
          }
        }
      `}</style>
    </aside>
  );
}
