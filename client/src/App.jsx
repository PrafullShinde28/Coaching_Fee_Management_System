import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ParentLayout } from './components/layout/ParentLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/parent/DashboardPage';
import { ChildrenPage } from './pages/parent/ChildrenPage';
import { StudentDetailPage } from './pages/parent/StudentDetailPage';
import { FeeLedgerPage } from './pages/parent/FeeLedgerPage';
import { ReceiptsPage } from './pages/parent/ReceiptsPage';
import { ProfilePage } from './pages/parent/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/parent/dashboard" replace />} />
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

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
