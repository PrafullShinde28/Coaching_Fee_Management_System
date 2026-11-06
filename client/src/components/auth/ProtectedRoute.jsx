import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ConsentModal } from './ConsentModal';

export function ProtectedRoute() {
  const { user, loading, isAuthenticated, isParent, consentRequired } = useAuth();
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
        <LoadingSpinner size="lg" label="Authenticating session..." />
      </div>
    );
  }

  if (!isAuthenticated || !isParent) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <>
      <ConsentModal isOpen={consentRequired} />
      <Outlet />
    </>
  );
}
