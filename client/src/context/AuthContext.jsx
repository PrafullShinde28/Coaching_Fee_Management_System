import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { changeLanguage } from '../i18n';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [consentRequired, setConsentRequired] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.auth.getMe();
      if (res?.user) {
        setUser(res.user);
        setConsentRequired(Boolean(res.user.consentRequired));
        if (res.user.language) {
          changeLanguage(res.user.language);
        }
      } else {
        setUser(null);
        setConsentRequired(false);
      }
    } catch (_err) {
      setUser(null);
      setConsentRequired(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (phone, otp) => {
    const res = await api.auth.verifyOtp(phone, otp);
    if (res?.user) {
      setUser(res.user);
      setConsentRequired(Boolean(res.user.consentRequired));
      if (res.user.language) {
        changeLanguage(res.user.language);
      }
    }
    return res;
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
      setConsentRequired(false);
    }
  };

  const submitConsent = async (version = '2026.1') => {
    const res = await api.auth.submitConsent(version);
    setConsentRequired(false);
    if (user) {
      setUser({ ...user, consentRequired: false });
    }
    return res;
  };

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    isParent: user?.role === 'parent',
    isAccounts: user?.role === 'accounts',
    consentRequired,
    login,
    logout,
    submitConsent,
    refreshUser: checkAuth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
