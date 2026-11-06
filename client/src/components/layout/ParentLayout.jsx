import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { ToastContainer } from '../common/Toast';

export function ParentLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="app-container">
      <Sidebar />
      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="main-content">
        <Header onToggleMobileNav={() => setMobileNavOpen(true)} />
        <main className="page-container">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
