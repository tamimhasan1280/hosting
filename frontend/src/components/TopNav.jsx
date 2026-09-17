import React, { useState, useEffect } from 'react';
import { Search, Bell, User, ExternalLink, ShieldCheck, Home, ChevronDown, Check, Users } from 'lucide-react';
import { api } from '../services/api';

export default function TopNav({ searchQuery, setSearchQuery, onNavigate, currentView, onUserChange }) {
  const [activeUser, setActiveUser] = useState(() => {
    // Check URL params first e.g. ?user=client_1
    const params = new URLSearchParams(window.location.search);
    const paramUser = params.get('user');
    if (paramUser) {
      localStorage.setItem('cpanel_active_user', paramUser);
      return paramUser;
    }
    return localStorage.getItem('cpanel_active_user') || 'cpanel_user';
  });

  const [accounts, setAccounts] = useState([]);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    api.getAccounts()
      .then(res => {
        const list = res.data?.acct || [];
        setAccounts(list);
      })
      .catch(() => {});
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

  const currentAcct = accounts.find(a => a.user === activeUser) || {
    user: activeUser,
    domain: activeUser === 'cpanel_user' ? 'example.com' : `${activeUser}.com`,
    plan: 'Standard Shared'
  };

  return (
    <header className="sticky top-0 z-30 bg-[#1e293b] text-white shadow-md border-b border-slate-700 px-4 py-2.5 flex items-center justify-between">
      {/* Brand & Home */}
      <div className="flex items-center space-x-4">
        <button 
          onClick={() => onNavigate('dashboard')} 
          className="flex items-center space-x-2 text-left focus:outline-none group cursor-pointer"
        >
          <div className="w-8 h-8 rounded bg-[#ff6c2c] flex items-center justify-center font-bold text-white shadow">
            cP
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-[#ff6c2c] transition-colors">cPanel</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-slate-700 text-slate-300">Jupiter</span>
          </div>
        </button>

        {currentView !== 'dashboard' && (
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center space-x-1 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded transition cursor-pointer"
          >
            <Home className="w-4 h-4 text-[#ff6c2c]" />
            <span>Tools Home</span>
          </button>
        )}
      </div>

      {/* Instant Search Bar */}
      <div className="flex-1 max-w-xl mx-6">
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools, files, domains, emails, databases... (Ctrl + /)"
            className="w-full bg-slate-900/80 text-sm text-slate-100 placeholder-slate-400 pl-10 pr-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-[#ff6c2c] focus:ring-1 focus:ring-[#ff6c2c] transition"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Right User Actions & Multi-Account Switcher */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => onNavigate('whmcs')}
          className="flex items-center space-x-1.5 text-xs bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 px-3 py-1.5 rounded font-medium transition cursor-pointer"
          title="Open WHMCS Server Bridge & Account Provisioning"
        >
          <span>WHMCS Bridge</span>
        </button>

        <a
          href={`/site?user=${activeUser}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1.5 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 px-3 py-1.5 rounded font-medium transition"
          title={`Open hosted website for ${activeUser} in a new tab`}
        >
          <span>Site Preview</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        <div className="h-4 w-px bg-slate-700"></div>

        <button 
          onClick={() => alert(`All services operational for ${activeUser}. No system alerts.`)}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition relative cursor-pointer"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#ff6c2c] rounded-full"></span>
        </button>

        {/* Account Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setAccountMenuOpen(!accountMenuOpen)}
            className="flex items-center space-x-2 pl-2 pr-1.5 py-1 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg transition cursor-pointer text-left"
            title="Switch hosting account"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-orange-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow uppercase">
              {activeUser.slice(0, 2)}
            </div>
            <div className="hidden sm:block text-left pr-1">
              <div className="text-xs font-semibold text-slate-200 leading-tight flex items-center gap-1">
                {activeUser}
              </div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="truncate max-w-[90px] text-slate-400 font-mono">{currentAcct.domain}</span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Accounts Dropdown Menu */}
          {accountMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 animate-fade">
              <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#ff6c2c]" /> Hosting Accounts
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">
                  {accounts.length || 1} Total
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-800/50">
                {/* Default cpanel_user option if not in accounts list */}
                {!accounts.find(a => a.user === 'cpanel_user') && (
                  <button
                    onClick={() => handleSwitchAccount('cpanel_user')}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition cursor-pointer ${
                      activeUser === 'cpanel_user' ? 'bg-slate-800/70 text-[#ff6c2c] font-semibold' : 'text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">cpanel_user</div>
                      <div className="text-[10px] text-slate-400 font-mono">example.com • 10 GB</div>
                    </div>
                    {activeUser === 'cpanel_user' && <Check className="w-4 h-4 text-[#ff6c2c]" />}
                  </button>
                )}

                {accounts.map(acct => (
                  <button
                    key={acct.user}
                    onClick={() => handleSwitchAccount(acct.user)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition cursor-pointer ${
                      activeUser === acct.user ? 'bg-slate-800/70 text-[#ff6c2c] font-semibold' : 'text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        {acct.user}
                        {acct.suspended ? (
                          <span className="text-[9px] bg-red-900/50 text-red-300 px-1 rounded">Suspended</span>
                        ) : null}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
                        {acct.domain} • {acct.disklimit || '10240M'}
                      </div>
                    </div>
                    {activeUser === acct.user && <Check className="w-4 h-4 text-[#ff6c2c]" />}
                  </button>
                ))}
              </div>

              <div className="px-3 pt-2 border-t border-slate-800">
                <button
                  onClick={() => { setAccountMenuOpen(false); onNavigate('whmcs'); }}
                  className="w-full text-center text-[11px] text-[#ff6c2c] hover:underline font-semibold py-1 cursor-pointer"
                >
                  + Add New Hosting Account (WHMCS)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
