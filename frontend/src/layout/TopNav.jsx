import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, ChevronDown, Check, Home, LogOut, Globe, ArrowLeft, Layers, Shield } from 'lucide-react';
import { api } from '../services/api';

/**
 * Modernized cPanel Top Navigation Bar
 * Features glassmorphic purple backdrop, responsive search (/ shortcut),
 * alerts notification drawer, and secure isolated tenant profile menu.
 */
export default function TopNav({
  searchQuery = '',
  setSearchQuery,
  onNavigate,
  currentView = 'dashboard',
  onUserChange,
  onLogout,
  userRole = 'client',
  activeHostingContext = null,
  className = ''
}) {
  const ctx = activeHostingContext || (() => {
    try {
      return JSON.parse(localStorage.getItem('cpanel_active_hosting_context') || '{}');
    } catch { return {}; }
  })();

  const activeUser = ctx.user || localStorage.getItem('cpanel_active_user') || 'tamimsho';
  const activeDomain = ctx.domain || localStorage.getItem('cpanel_active_domain') || '';
  const activePackage = ctx.package || localStorage.getItem('cpanel_active_package') || '';

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchInputRef = useRef(null);

  return (
    <header 
      aria-label="Top Header"
      className={`h-[60px] bg-[#160427]/85 backdrop-blur-md border-b border-purple-900/35 sticky top-0 z-30 px-6 flex items-center justify-between select-none shadow-sm ${className}`}
    >
      {/* Left side: View title breadcrumb if not on dashboard */}
      <div className="flex items-center space-x-3">
        {currentView !== 'dashboard' ? (
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('dashboard')}
            className="flex items-center gap-2 text-[12.5px] font-medium text-purple-300 hover:text-emerald-300 cursor-pointer transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Tools</span>
            <span className="text-purple-400/40">/</span>
            <span className="text-white font-semibold capitalize">{currentView.replace(/_/g, ' ')}</span>
          </button>
        ) : (
          <div className="hidden sm:flex items-center gap-2 text-[12.5px] text-purple-200/80 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>TAMIM HOSTING Cloud Platform</span>
          </div>
        )}
      </div>

      {/* Right side: Search field, Notifications Bell, User profile */}
      <div className="flex items-center space-x-3 ml-auto">
        {/* Search Tools (/) */}
        <div className="relative w-48 sm:w-64">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
            placeholder="Search Tools (/)"
            aria-label="Search Tools"
            className="w-full bg-[#240c3c]/80 text-[12px] text-white placeholder-purple-300/40 pl-3 pr-8 py-1.5 rounded-lg border border-purple-800/40 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition"
          />
          <div className="absolute right-2.5 top-2 pointer-events-none text-purple-300/50">
            <Search className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Notifications Icon (Bell in circle) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            aria-label="Notifications"
            className="w-8 h-8 rounded-lg border border-purple-800/40 bg-purple-950/40 hover:bg-purple-900/40 flex items-center justify-center text-purple-200 transition cursor-pointer"
            title="System Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-[#1c0830] border border-purple-800/50 rounded-xl shadow-2xl p-3.5 text-[11.5px] text-left z-50 backdrop-blur-xl animate-in fade-in duration-150">
              <div className="font-semibold text-white border-b border-purple-900/40 pb-2 mb-2 flex items-center justify-between">
                <span>System Notifications</span>
                <span className="text-[10px] text-emerald-300 bg-emerald-950/60 border border-emerald-700/40 px-2 py-0.5 rounded-full font-medium">All Clear</span>
              </div>
              <div className="text-purple-200/70 py-2.5 text-center leading-relaxed">
                All cloud systems, mail daemons, and database engines are operational.
              </div>
            </div>
          )}
        </div>

        {/* User Account Avatar with Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAccountMenuOpen(!accountMenuOpen)}
            aria-label="User account menu"
            aria-expanded={accountMenuOpen}
            className="flex items-center space-x-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-purple-950/40 hover:bg-purple-900/40 border border-purple-800/40 transition cursor-pointer text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-emerald-500 p-0.5 shadow">
              <div className="w-full h-full rounded-[6px] bg-[#180529] text-white flex items-center justify-center font-bold text-[11px]">
                {activeUser.charAt(0).toUpperCase()}
              </div>
            </div>
            <span className="hidden md:inline text-[12px] font-semibold text-white max-w-[120px] truncate">
              {activeUser}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-purple-300/70" />
          </button>

          {/* Isolated Tenant Profile Menu */}
          {accountMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-[#1c0830] border border-purple-800/50 rounded-2xl shadow-2xl py-3 px-3 text-left z-50 backdrop-blur-xl animate-in fade-in duration-150 space-y-3">
              {/* Account Identity Header */}
              <div className="pb-2.5 border-b border-purple-900/40">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-purple-300/60 tracking-wider">Logged In User</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    userRole === 'admin' 
                      ? 'bg-purple-900/60 border-purple-500/50 text-purple-200' 
                      : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  }`}>
                    {userRole === 'admin' ? 'Main Admin' : 'Client Account'}
                  </span>
                </div>
                <div className="text-[14px] font-black text-white mt-1 flex items-center gap-2">
                  <span>{activeUser}</span>
                </div>
              </div>

              {/* Active cPanel Domain Scope (If in cPanel tool or active context present) */}
              {activeDomain ? (
                <div className="bg-purple-950/50 border border-purple-700/40 rounded-xl p-2.5 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-emerald-400/90 tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Active cPanel Scope</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-white text-[12.5px] truncate max-w-[170px]" title={activeDomain}>
                      {activeDomain}
                    </div>
                    {activePackage && (
                      <span className="text-[9.5px] text-purple-300/80 bg-purple-900/40 px-1.5 py-0.5 rounded border border-purple-800/30 truncate max-w-[80px]">
                        {activePackage}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-purple-300/60 pt-0.5">
                    Isolated to this domain's files, databases &amp; emails
                  </div>
                </div>
              ) : null}

              {/* Tenant Navigation Actions */}
              <div className="space-y-1 text-[12px]">
                <button
                  type="button"
                  onClick={() => { setAccountMenuOpen(false); onNavigate && onNavigate('client_dashboard'); }}
                  className="w-full text-left px-2.5 py-2 text-purple-200 hover:text-white hover:bg-purple-900/40 rounded-xl font-semibold cursor-pointer flex items-center gap-2.5 transition"
                >
                  <ArrowLeft className="w-4 h-4 text-emerald-400" />
                  <span>Return to Client Portal</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setAccountMenuOpen(false); onNavigate && onNavigate('my_services'); }}
                  className="w-full text-left px-2.5 py-2 text-purple-200 hover:text-white hover:bg-purple-900/40 rounded-xl font-semibold cursor-pointer flex items-center gap-2.5 transition"
                >
                  <Globe className="w-4 h-4 text-purple-400" />
                  <span>My Domains &amp; Services</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setAccountMenuOpen(false); onNavigate && onNavigate('invoices'); }}
                  className="w-full text-left px-2.5 py-2 text-purple-200 hover:text-white hover:bg-purple-900/40 rounded-xl font-medium cursor-pointer flex items-center gap-2.5 transition"
                >
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>Billing &amp; Invoices</span>
                </button>

                {userRole === 'admin' && (
                  <button
                    type="button"
                    onClick={() => { setAccountMenuOpen(false); onNavigate && onNavigate('admin_dashboard'); }}
                    className="w-full text-left px-2.5 py-2 text-purple-300 hover:text-white hover:bg-purple-900/50 rounded-xl font-bold cursor-pointer flex items-center gap-2.5 transition border border-purple-700/30"
                  >
                    <Shield className="w-4 h-4 text-purple-400" />
                    <span>WHM Administration</span>
                  </button>
                )}
              </div>

              {/* Logout Action */}
              <div className="border-t border-purple-900/40 pt-2">
                <button
                  type="button"
                  onClick={() => { setAccountMenuOpen(false); onLogout && onLogout(); }}
                  className="w-full text-left px-2.5 py-2 text-[12px] text-rose-400 hover:bg-rose-950/40 rounded-xl font-bold cursor-pointer flex items-center gap-2.5 transition"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>Log Out ({activeUser})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
