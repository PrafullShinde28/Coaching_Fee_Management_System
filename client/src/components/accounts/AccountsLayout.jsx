import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AccountsSidebar } from './AccountsSidebar';
import { AccountsHeader } from './AccountsHeader';
import { AccountsMobileNav } from './AccountsMobileNav';
import { ToastContainer } from '../common/Toast';

export function AccountsLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="app-container">
      <AccountsSidebar />
      <AccountsMobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="main-content">
        <AccountsHeader onToggleMobileNav={() => setMobileNavOpen(true)} />
        <main className="page-container">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
