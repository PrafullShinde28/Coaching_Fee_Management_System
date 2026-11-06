import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AccountsProtectedRoute } from './components/accounts/AccountsProtectedRoute';
import { ParentLayout } from './components/layout/ParentLayout';
import { AccountsLayout } from './components/accounts/AccountsLayout';
import { LoginPage } from './pages/LoginPage';

// Parent pages
import { DashboardPage } from './pages/parent/DashboardPage';
import { ChildrenPage } from './pages/parent/ChildrenPage';
import { StudentDetailPage } from './pages/parent/StudentDetailPage';
import { FeeLedgerPage } from './pages/parent/FeeLedgerPage';
import { ReceiptsPage } from './pages/parent/ReceiptsPage';
import { ProfilePage } from './pages/parent/ProfilePage';

// Accounts pages
import { AccountsDashboardPage } from './pages/accounts/AccountsDashboardPage';
import { AccountsStudentsPage } from './pages/accounts/AccountsStudentsPage';
import { AccountsStudentDetailPage } from './pages/accounts/AccountsStudentDetailPage';
import { AccountsCollectionsPage } from './pages/accounts/AccountsCollectionsPage';
import { AccountsUnmatchedPage } from './pages/accounts/AccountsUnmatchedPage';
import { AccountsRefundsPage } from './pages/accounts/AccountsRefundsPage';
import { AccountsRemindersPage } from './pages/accounts/AccountsRemindersPage';
import { AccountsRiskPage } from './pages/accounts/AccountsRiskPage';
import { AccountsReportsPage } from './pages/accounts/AccountsReportsPage';

import { NotFoundPage } from './pages/NotFoundPage';

function IndexRoute() {
  const { user, isAccounts, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (isAccounts) return <Navigate to="/accounts/dashboard" replace />;
  return <Navigate to="/parent/dashboard" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<IndexRoute />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Parent Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<ParentLayout />}>
          <Route path="/parent/dashboard" element={<DashboardPage />} />
          <Route path="/parent/children" element={<ChildrenPage />} />
          <Route path="/parent/children/:studentId" element={<StudentDetailPage />} />
          <Route path="/parent/children/:studentId/fees" element={<FeeLedgerPage />} />
          <Route path="/parent/receipts" element={<ReceiptsPage />} />
          <Route path="/parent/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Protected Accounts Staff Routes */}
      <Route element={<AccountsProtectedRoute />}>
        <Route element={<AccountsLayout />}>
          <Route path="/accounts" element={<Navigate to="/accounts/dashboard" replace />} />
          <Route path="/accounts/dashboard" element={<AccountsDashboardPage />} />
          <Route path="/accounts/students" element={<AccountsStudentsPage />} />
          <Route path="/accounts/students/:studentId" element={<AccountsStudentDetailPage />} />
          <Route path="/accounts/collections" element={<AccountsCollectionsPage />} />
          <Route path="/accounts/unmatched-payments" element={<AccountsUnmatchedPage />} />
          <Route path="/accounts/refunds" element={<AccountsRefundsPage />} />
          <Route path="/accounts/reminders" element={<AccountsRemindersPage />} />
          <Route path="/accounts/risk-flags" element={<AccountsRiskPage />} />
          <Route path="/accounts/reports" element={<AccountsReportsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
