import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, ChevronDown, Check, Home, LogOut } from 'lucide-react';
import { api } from '../services/api';

/**
 * Modernized cPanel Top Navigation Bar
 * Features glassmorphic purple backdrop, responsive search (/ shortcut),
 * alerts notification drawer, and seamless user switcher.
 */
export default function TopNav({
  searchQuery = '',
  setSearchQuery,
  onNavigate,
  currentView = 'dashboard',
  onUserChange,
  onLogout,
  className = ''
}) {
  const [activeUser, setActiveUser] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('user') || localStorage.getItem('cpanel_active_user') || 'tamimhasan1281';
  });

  const [accounts, setAccounts] = useState([]);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    api.getAccounts()
      .then(res => {
        const list = res.data?.acct || [];
        setAccounts(list);
      })
      .catch(() => {});
  }, []);

  // Global '/' keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSwitchAccount = (user) => {
    setActiveUser(user);
    localStorage.setItem('cpanel_active_user', user);
    setAccountMenuOpen(false);
    if (onUserChange) {
      onUserChange(user);
    } else {
      window.location.reload();
    }
  };

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

          {/* Account Switcher Dropdown */}
          {accountMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[#1c0830] border border-purple-800/50 rounded-xl shadow-2xl py-2 text-left z-50 backdrop-blur-xl animate-in fade-in duration-150">
              <div className="px-3 py-2 border-b border-purple-900/40 mb-1">
                <div className="text-[10px] uppercase font-bold text-purple-300/60 tracking-wider">Active Account</div>
                <div className="text-[13px] font-bold text-white mt-0.5">{activeUser}</div>
              </div>

              <div className="px-3 py-1 text-[10px] uppercase font-bold text-purple-300/60 tracking-wider">
                Switch Hosting Account
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-purple-900/20">
                {accounts.map((acct) => (
                  <button
                    key={acct.user}
                    type="button"
                    onClick={() => handleSwitchAccount(acct.user)}
                    className={`w-full px-3 py-2 text-left text-[12px] flex items-center justify-between transition cursor-pointer hover:bg-purple-900/30 ${
                      activeUser === acct.user ? 'bg-purple-900/40 font-semibold text-emerald-300' : 'text-purple-200'
                    }`}
                  >
                    <div className="truncate">
                      <div className="text-white">{acct.user}</div>
                      <div className="text-[10px] text-purple-300/60 truncate">{acct.domain}</div>
                    </div>
                    {activeUser === acct.user && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </button>
                ))}
              </div>

              <div className="border-t border-purple-900/40 mt-1 pt-1 px-2">
                <button
                  type="button"
                  onClick={() => { setAccountMenuOpen(false); onLogout && onLogout(); }}
                  className="w-full text-left px-2 py-1.5 text-[11.5px] text-rose-400 hover:bg-rose-950/40 rounded-lg font-medium cursor-pointer flex items-center gap-2 transition"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
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
