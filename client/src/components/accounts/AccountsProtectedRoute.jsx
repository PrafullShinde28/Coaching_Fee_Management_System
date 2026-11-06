import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function AccountsProtectedRoute() {
  const { user, loading, isAuthenticated, isAccounts } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg)'
        }}
      >
        <LoadingSpinner size="lg" label="Verifying accounts credentials..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAccounts) {
    // If authenticated user is a parent, protect accounts routes and redirect to parent portal
    return <Navigate to="/parent/dashboard" replace />;
  }

  return <Outlet />;
}
