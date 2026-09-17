import React from 'react';
import { 
  Wrench, Folder, Mail, Globe, Database, ShieldCheck, Clock, BarChart3, ShieldAlert,
  Server, User, CheckCircle2, ShoppingCart, FileText, CreditCard, LayoutDashboard, ExternalLink, LogOut
} from 'lucide-react';

/**
 * Modernized cPanel & Client Portal Left Sidebar
 * Features the signature Dark Purple to Emerald Gradient inspired by the user design,
 * enhanced typography, sleek category grouping, and active user card.
 */
export default function Sidebar({
  currentView = 'client_dashboard',
  onNavigate,
  onLogout,
  className = '',
  activeHostingContext = null
}) {
  const activeUser = localStorage.getItem('cpanel_active_user') || 'tamimhasan1281';
  const userEmail = localStorage.getItem('cpanel_user_email') || '';
  const userRole = localStorage.getItem('cpanel_user_role') || 'client';
  const isAdmin = userRole === 'admin';

  // Client Portal Views vs Domain cPanel Tools Views
  const clientPortalViews = [
    'client_dashboard', 'new_order', 'my_services', 'my_domains',
    'domain_hosting', 'invoices', 'payments', 'my_orders', 'admin_dashboard'
  ];
  const isClientPortal = clientPortalViews.includes(currentView);

  // Active domain context when inside domain cPanel
  const currentDomain = activeHostingContext?.domain || localStorage.getItem('cpanel_active_domain') || '';
  const currentPackage = activeHostingContext?.package || localStorage.getItem('cpanel_active_package') || '';

  // Nav sections strictly isolated: In Client Portal, NEVER show cPanel tools!
  const navSections = isClientPortal ? [
    ...(isAdmin ? [{
      heading: 'ADMINISTRATION (WHM)',
      items: [
        { id: 'admin_panel', label: 'Admin Control Center', icon: ShieldCheck, target: 'admin_dashboard' }
      ]
    }] : []),
    {
      heading: 'CLIENT PORTAL',
      items: [
        { id: 'client_dash', label: 'Client Dashboard', icon: LayoutDashboard, target: 'client_dashboard' },
        { id: 'new_order', label: 'New Order / Packages', icon: ShoppingCart, target: 'new_order' },
        { id: 'my_services', label: 'My Services', icon: Server, target: 'my_services' },
        { id: 'my_domains', label: 'My Domains', icon: Globe, target: 'my_domains' },
        { id: 'invoices', label: 'Invoices', icon: FileText, target: 'invoices' },
        { id: 'payments', label: 'Payments', icon: CreditCard, target: 'payments' }
      ]
    }
  ] : [
    // Inside Domain cPanel Mode
    {
      heading: `CPANEL — ${currentDomain ? currentDomain.toUpperCase() : 'HOSTING TOOLS'}`,
      items: [
        { id: 'tools', label: 'All 20 cPanel Tools', icon: Wrench, target: 'dashboard' },
        { id: 'files', label: 'File Manager', icon: Folder, target: 'files' },
        { id: 'email', label: 'Email Accounts', icon: Mail, target: 'email' },
        { id: 'databases', label: 'MySQL Databases', icon: Database, target: 'databases' },
        { id: 'ssl', label: 'SSL / TLS', icon: ShieldCheck, target: 'ssl' },
        { id: 'cron', label: 'Cron Jobs', icon: Clock, target: 'cron' },
        { id: 'security', label: 'Security & IP Blocker', icon: ShieldAlert, target: 'ip_blocker' }
      ]
    }
  ];

  return (
    <aside 
      aria-label="cPanel Sidebar Navigation"
      className={`w-[245px] bg-gradient-to-b from-[#180529] via-[#240939] to-[#0e1d17] text-white flex flex-col shrink-0 h-screen sticky top-0 z-40 select-none border-r border-purple-900/30 shadow-[4px_0_24px_rgba(0,0,0,0.35)] ${className}`}
    >
      {/* Top Logo & Brand Area */}
      <div className="h-[60px] px-5 flex items-center justify-between border-b border-purple-900/40 shrink-0 bg-[#160427]/60 backdrop-blur-md">
        <button
          type="button"
          onClick={() => onNavigate && onNavigate(isClientPortal ? 'client_dashboard' : 'dashboard')}
          className="flex items-center space-x-2.5 focus:outline-none cursor-pointer group text-left"
          title={isClientPortal ? 'Client Portal Home' : 'cPanel Jupiter Home'}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 via-fuchsia-600 to-emerald-500 p-0.5 shadow-md group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#180529] rounded-[6px] flex items-center justify-center font-black text-[15px] text-white">
              cP
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[14px] font-extrabold tracking-tight bg-gradient-to-r from-purple-200 via-pink-200 to-emerald-300 bg-clip-text text-transparent">
                TAMIM HOSTING
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {isClientPortal ? 'Client Portal' : 'cPanel Pro v136'}
            </span>
          </div>
        </button>
      </div>

      {/* Return to Client Portal button & Scoped Domain Badge (Only in cPanel Mode) */}
      {!isClientPortal && (
        <div className="px-3 pt-3 pb-1 space-y-2">
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('client_dashboard')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-purple-900/50 hover:bg-purple-800 border border-purple-700/50 text-purple-200 hover:text-white text-xs font-bold transition cursor-pointer shadow"
          >
            <span>&larr; Return to Client Portal</span>
          </button>
          {currentDomain && (
            <div className="p-2.5 rounded-xl bg-[#140324]/80 border border-emerald-500/30 space-y-0.5">
              <div className="text-[10px] text-purple-300/70 uppercase tracking-wider font-bold flex items-center justify-between">
                <span>Active Domain</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="text-xs font-bold text-emerald-300 font-mono truncate">{currentDomain}</div>
              {currentPackage && (
                <div className="text-[10px] text-purple-200/80 font-medium truncate">{currentPackage}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto" aria-label="Main menu">
        {navSections.map((sec, secIdx) => (
          <div key={secIdx} className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-purple-300/50 uppercase">
              {sec.heading}
            </div>

            {sec.items.map((item) => {
              const IconComp = item.icon;
              const isActive = (item.id === 'tools' && currentView === 'dashboard') || currentView === item.target;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate && onNavigate(item.target)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12.5px] font-medium transition-all text-left cursor-pointer outline-none ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600/35 to-emerald-600/20 text-white font-semibold shadow-[0_2px_12px_rgba(168,85,247,0.25)] border-l-[3px] border-purple-400'
                      : 'text-purple-200/75 hover:text-white hover:bg-purple-900/20 hover:translate-x-0.5'
                  }`}
                  title={item.label}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? 'bg-purple-500/30 text-emerald-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                      : 'bg-purple-950/40 text-purple-300/80 group-hover:text-white'
                  }`}>
                    <IconComp className="w-4 h-4 stroke-[2]" />
                  </div>
                  <span className="truncate leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Modern Sidebar User Card Footer */}
      <div className="p-3 border-t border-purple-900/40 bg-[#120422]/70 shrink-0">
        <div className="flex items-center space-x-2.5 p-2 rounded-xl bg-purple-950/30 border border-purple-800/30">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-emerald-500 p-0.5 shrink-0 shadow">
            <div className="w-full h-full rounded-full bg-[#180529] flex items-center justify-center text-purple-200">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] font-bold text-white truncate">
              {activeUser}
            </div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>Active Hosting</span>
            </div>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="Log Out"
              className="p-1.5 rounded-lg text-purple-400 hover:text-rose-400 hover:bg-purple-900/40 cursor-pointer transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
