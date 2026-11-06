import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';

export function LoginPage() {
  const { t } = useTranslation();
  const { login, isAuthenticated, isAccounts } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [phone, setPhone] = useState('+919900000041'); // Seed parent default
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [demoOtp, setDemoOtp] = useState(null);

  const from = location.state?.from?.pathname || (isAccounts ? '/accounts/dashboard' : '/parent/dashboard');

  if (isAuthenticated) {
    const target = isAccounts ? '/accounts/dashboard' : '/parent/dashboard';
    navigate(from && from !== '/' && !from.includes('login') ? from : target, { replace: true });
    return null;
  }

  const handleRequestOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError(null);
    if (!phone || phone.trim().length < 10) {
      setError(t('auth.invalidPhone', 'Please enter a valid phone number'));
      return;
    }

    try {
      setLoading(true);
      const res = await api.auth.requestOtp(phone.trim());
      if (res.demoOtp) {
        setDemoOtp(res.demoOtp);
        setOtp(res.demoOtp); // Auto-populate demo OTP for smooth testing
      }
      setStep('otp');
      addToast(`${t('auth.otpSentTo', 'OTP sent to')} ${phone}`, 'success');
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Check phone number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    if (!otp || otp.trim().length !== 6) {
      setError(t('auth.invalidOtp', 'Please enter a 6-digit OTP'));
      return;
    }

    try {
      setLoading(true);
      const res = await login(phone.trim(), otp.trim());
      addToast(t('dashboard.welcome', 'Welcome back!'), 'success');
      const userRole = res?.user?.role;
      if (userRole === 'accounts') {
        const dest = from.startsWith('/accounts') ? from : '/accounts/dashboard';
        navigate(dest, { replace: true });
      } else {
        const dest = from.startsWith('/parent') ? from : '/parent/dashboard';
        navigate(dest, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Incorrect or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        backgroundColor: 'var(--color-bg)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-xl)',
          padding: 'var(--space-8)'
        }}
      >
        {/* Header with Brand & Language Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '20px'
              }}
            >
              F
            </div>
            <div>
              <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-base)', color: 'var(--color-primary)' }}>
                FEETrack
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                {t('brand.coachingInstitute', 'Apex Academy Jaipur')}
              </div>
            </div>
          </div>
          <LanguageSwitcher />
        </div>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
            {t('auth.loginTitle', 'Sign In to FEETrack')}
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            {t('auth.loginSubtitle', 'Enter your registered mobile number to receive a secure OTP')}
          </p>
        </div>

        {/* Quick Demo Switcher Buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <button
            type="button"
            onClick={() => {
              setPhone('+919900000041');
              setStep('phone');
              setOtp('');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              border: phone === '+919900000041' ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
              backgroundColor: phone === '+919900000041' ? 'var(--color-primary-light)' : 'transparent',
              color: phone === '+919900000041' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Demo Parent
          </button>
          <button
            type="button"
            onClick={() => {
              setPhone('+919900000001');
              setStep('phone');
              setOtp('');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              border: phone === '+919900000001' ? '1px solid #1b4332' : '1px solid var(--color-border)',
              backgroundColor: phone === '+919900000001' ? '#e8f5e9' : 'transparent',
              color: phone === '+919900000001' ? '#1b4332' : 'var(--color-text-secondary)',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Demo Accounts Staff
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-danger)',
              fontSize: 'var(--font-size-sm)',
              marginBottom: 'var(--space-4)'
            }}
          >
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Input
              label={t('auth.phoneLabel', 'Mobile Number')}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919900000041"
              required
              hint={phone.includes('0001') ? 'Accounts staff seeded user: +919900000001' : 'Parent seeded user: +919900000041'}
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
            >
              {loading ? t('auth.sendingOtp', 'Sending OTP...') : t('auth.sendOtp', 'Send OTP')}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('auth.otpSentTo', 'OTP sent to')} <strong>{phone}</strong></span>
              <button
                type="button"
                onClick={() => { setStep('phone'); setOtp(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}
              >
                Change
              </button>
            </div>

            {demoOtp && (
              <div
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'var(--color-primary-light)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{t('auth.demoOtpNotice', 'Demo OTP')}: <strong>{demoOtp}</strong></span>
                <button
                  type="button"
                  onClick={() => setOtp(demoOtp)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Apply
                </button>
              </div>
            )}

            <Input
              label={t('auth.otpLabel', 'Enter 6-digit OTP')}
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="246810"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
            >
              {loading ? t('auth.verifyingOtp', 'Verifying...') : t('auth.verifyOtp', 'Verify & Sign In')}
            </Button>

            <button
              type="button"
              onClick={handleRequestOtp}
              disabled={loading}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                textAlign: 'center',
                marginTop: 'var(--space-2)'
              }}
            >
              {t('auth.resendOtp', 'Resend OTP')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
