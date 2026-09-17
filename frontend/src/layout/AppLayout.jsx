import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import Footer from './Footer';

/**
 * Master AppLayout Component
 * Implements the official cPanel Jupiter Desktop & Responsive Grid Layout:
 * Fixed Left Sidebar (Navy #27235C) + Sticky Top Navigation + Main Content Area + Footer
 */
export default function AppLayout({
  children,
  currentView = 'dashboard',
  onNavigate,
  searchQuery = '',
  setSearchQuery,
  onUserChange,
  onLogout,
  version = '136.0.40',
  sidebarOpenMobile,
  setSidebarOpenMobile,
  activeHostingContext = null
}) {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--page-bg)] flex flex-col font-sans text-[var(--text-primary)]">
      <div className="flex-1 flex">
        {/* Fixed Desktop Left Sidebar */}
        <Sidebar 
          currentView={currentView}
          activeHostingContext={activeHostingContext}
          onNavigate={(target) => {
            if (onNavigate) onNavigate(target);
            setMobileMenu(false);
          }}
          onLogout={onLogout}
          className="hidden md:flex"
        />

        {/* Mobile Sidebar Overlay */}
        {mobileMenu && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div 
              className="fixed inset-0 bg-black/50" 
              onClick={() => setMobileMenu(false)}
            />
            <Sidebar 
              currentView={currentView}
              activeHostingContext={activeHostingContext}
              onNavigate={(target) => {
                if (onNavigate) onNavigate(target);
                setMobileMenu(false);
              }}
              onLogout={onLogout}
              className="relative z-10 w-[230px]"
            />
          </div>
        )}

        {/* Main Content Column (TopNav + Page Body + Footer) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Sticky White Top Navigation */}
          <TopNav
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onNavigate={onNavigate}
            currentView={currentView}
            onUserChange={onUserChange}
            onLogout={onLogout}
          />

          {/* Page Content Container */}
          <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
            {children}
          </main>

          {/* Jupiter Theme Footer */}
          <Footer 
            version={version}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </div>
  );
}
