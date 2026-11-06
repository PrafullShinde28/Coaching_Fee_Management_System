import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher';
import { formatPhone } from '../../utils/formatters';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();

  const currentLang = i18n.language?.startsWith('hi') ? 'हिन्दी (Hindi)' : 'English (English)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '720px' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
          {t('profile.title', 'Parent Profile')}
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {t('profile.subtitle', 'Account credentials and portal preferences.')}
        </p>
      </div>

      <Card title="Account Information">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {t('profile.mobile', 'Mobile Number')}
              </div>
              <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-medium)' }}>
                {formatPhone(user?.phone)}
              </div>
            </div>
            <Badge status="active" label="Verified" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {t('profile.role', 'Account Role')}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                {t('profile.parentRole', 'Parent / Guardian')}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {t('profile.language', 'Preferred Language')}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                {currentLang}
              </div>
            </div>
            <LanguageSwitcher />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {t('profile.consentStatus', 'Parental Consent Status')}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                {user?.consentRequired ? t('profile.consentPending', 'Pending') : t('profile.consentGiven', 'Recorded & Active')}
              </div>
            </div>
            <Badge status={user?.consentRequired ? 'due_soon' : 'paid'} label={user?.consentRequired ? 'Pending' : 'Active'} />
          </div>
        </div>
      </Card>

      <Card title={t('profile.sessionSecurity', 'Security & Session')}>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
          {t('profile.sessionNote', 'Your session is secured using httpOnly authentication cookies. Tokens are never stored in browser memory.')}
        </p>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button variant="danger" size="sm" onClick={logout}>
            {t('nav.logout', 'Log Out of Account')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
