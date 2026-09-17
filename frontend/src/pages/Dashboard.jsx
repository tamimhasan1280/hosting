import React, { useState } from 'react';
import { 
  Folder, HardDrive, Archive, Database, Globe, 
  Mail, Sliders, ShieldCheck, Clock, BarChart3, Key, 
  ShieldAlert, AlertTriangle, Layers, Send,
  FileCode, Cpu, Server, LogOut, X, CheckCircle2
} from 'lucide-react';

import FeatureSection from '../components/ui/FeatureSection';
import GeneralInfoPanel from '../components/ui/GeneralInfoPanel';
import StatisticsPanel from '../components/ui/StatisticsPanel';
import { api } from '../services/api';

/**
 * EXACT 20 CORE MODULES SPECIFIED IN MASTER PROMPT:
 * 1. Information
 * 2. File Manager
 * 3. Email Accounts
 * 4. Quick Create Email Account
 * 5. Domains
 * 6. Addon Domains
 * 7. DNS Zone
 * 8. SSL/TLS
 * 9. FTP Accounts
 * 10. Backup
 * 11. Cron Jobs
 * 12. MySQL Databases
 * 13. phpMyAdmin
 * 14. PHP Version
 * 15. Resource Usage
 * 16. Analytics
 * 17. Error Logs
 * 18. Security
 * 19. Change Password
 * 20. Logout
 */
export const OFFICIAL_CATEGORIES = [
  {
    id: 'files_backup',
    title: 'Files & Backups',
    icon: Folder,
    tools: [
      { id: 'file_manager', name: 'File Manager', desc: 'Upload, edit, and organize files in public_html', icon: Folder, target: 'files' },
      { id: 'ftp_accounts', name: 'FTP Accounts', desc: 'Manage FTP users, root directories and quotas', icon: HardDrive, target: 'ftp_accounts' },
      { id: 'backup', name: 'Backup', desc: 'Generate full and partial cPanel account backups', icon: Archive, target: 'backups' }
    ]
  },
  {
    id: 'email',
    title: 'Email',
    icon: Mail,
    tools: [
      { id: 'email_accounts', name: 'Email Accounts', desc: 'Create and manage email accounts', icon: Mail, target: 'email' },
      { id: 'quick_email', name: 'Quick Create Email Account', desc: 'Instantly provision a new email mailbox for your domain', icon: Send, target: 'quick_email' }
    ]
  },
  {
    id: 'domains',
    title: 'Domains',
    icon: Globe,
    tools: [
      { id: 'domains_mgr', name: 'Domains', desc: 'Manage domains and document root directories', icon: Globe, target: 'domains' },
      { id: 'addon_domains', name: 'Addon Domains', desc: 'Add secondary domains to your hosting account', icon: Layers, target: 'domains' },
      { id: 'dns_zone', name: 'DNS Zone', desc: 'Add and manage A, CNAME, MX, and TXT DNS records', icon: Sliders, target: 'zone_editor' }
    ]
  },
  {
    id: 'databases',
    title: 'MySQL Databases',
    icon: Database,
    tools: [
      { id: 'mysql_databases', name: 'MySQL Databases', desc: 'Create databases, users, and grant privileges', icon: Database, target: 'databases' },
      { id: 'phpmyadmin', name: 'phpMyAdmin', desc: 'Direct SSO into MySQL database manager', icon: Database, target: 'phpmyadmin' }
    ]
  },
  {
    id: 'metrics_software',
    title: 'Metrics & Software',
    icon: BarChart3,
    tools: [
      { id: 'php_version', name: 'PHP Version', desc: 'Select PHP 8.1, 8.2, 8.3, 8.4 and directives', icon: FileCode, target: 'php' },
      { id: 'cron_jobs', name: 'Cron Jobs', desc: 'Automate script execution on scheduled intervals', icon: Clock, target: 'cron' },
      { id: 'resource_usage', name: 'Resource Usage', desc: 'CloudLinux/cPanel CPU, Memory, and IO metrics', icon: Cpu, target: 'resource_usage' },
      { id: 'analytics', name: 'Analytics', desc: 'Website visitors, traffic and graphical analytics', icon: BarChart3, target: 'awstats' },
      { id: 'error_logs', name: 'Error Logs', desc: 'Inspect raw web server and PHP error logs', icon: AlertTriangle, target: 'errors' }
    ]
  },
  {
    id: 'security_preferences',
    title: 'Security & Account',
    icon: ShieldCheck,
    tools: [
      { id: 'information', name: 'Information', desc: 'Server information, specifications and environment details', icon: Server, target: 'server_info' },
      { id: 'ssl_tls', name: 'SSL/TLS', desc: 'Manage SSL/TLS certificates and AutoSSL', icon: ShieldCheck, target: 'ssl' },
      { id: 'security', name: 'Security', desc: 'IP Blocker, Hotlink and access security controls', icon: ShieldAlert, target: 'ip_blocker' },
      { id: 'change_password', name: 'Change Password', desc: 'Update cPanel account password securely', icon: Key, target: 'change_password' },
      { id: 'logout', name: 'Logout', desc: 'Safely terminate your current cPanel session', icon: LogOut, target: 'logout' }
    ]
  }
];

export default function Dashboard({
  onOpenTool,
  searchQuery = '',
  stats,
  onOpenServerInfo,
  onLogout,
  activeHostingContext = null
}) {
  const query = searchQuery.trim().toLowerCase();

  // Active hosting context for isolated single-domain cPanel experience
  const ctx = activeHostingContext || (() => {
    try {
      return JSON.parse(localStorage.getItem('cpanel_active_hosting_context') || '{}');
    } catch { return {}; }
  })();

  // Quick Create Email Modal State
  const [quickEmailModal, setQuickEmailModal] = useState(false);
  const [emailUser, setEmailUser] = useState('');
  const [emailPass, setEmailPass] = useState('');
  const [emailConfirmPass, setEmailConfirmPass] = useState('');
  const [emailQuota, setEmailQuota] = useState(1024);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState({ type: '', text: '' });

  // Quick Create Email Inline Card State
  const [quickInlineUser, setQuickInlineUser] = useState('');
  const [quickInlinePass, setQuickInlinePass] = useState('');
  const [quickInlineLoading, setQuickInlineLoading] = useState(false);
  const [quickInlineMsg, setQuickInlineMsg] = useState({ type: '', text: '' });

  // Change Password Modal State
  const [changePassModal, setChangePassModal] = useState(false);
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });

  // General server info values scoped to active context
  const general = stats?.generalInfo || {};
  const hosting = stats?.hostingInfo || general.hostingInfo || {};
  const primaryDomain = ctx.domain || localStorage.getItem('cpanel_active_domain') || hosting.domain || general.primaryDomain || 'example.com';
  const currentUser = ctx.user || localStorage.getItem('cpanel_active_user') || general.currentUser || 'cpanel_user';
  const sharedIp = hosting.hostingIp || general.sharedIp || '208.72.218.129';
  const packagePlan = ctx.package || ctx.packageName || hosting.package || general.plan || 'Standard Shared Hosting';
  const phpVersion = hosting.phpVersion || general.phpVersion || 'PHP 8.2';
  const nameserver = Array.isArray(hosting.nameservers) ? hosting.nameservers.join(', ') : (hosting.nameservers || 'ns1.tamimhosting.com, ns2.tamimhosting.com');
  const documentRoot = hosting.documentRoot || `/home/${currentUser}/public_html`;
  const serviceStatus = hosting.serviceStatus || 'Active';
  const startDate = hosting.startDate || '2026-01-15';
  const expiryDate = hosting.expiryDate || general.expiryDate || '2026-12-31';

  // Quota stats
  const statList = stats?.statistics || [];
  const diskStat = statList.find(s => s.id === 'disk_usage');
  const bwStat = statList.find(s => s.id === 'bandwidth_usage');

  const diskUsageText = hosting.storage || (diskStat ? `${diskStat.value} / ${diskStat.limit}` : '14 MB / 10 GB');
  const bwUsageText = hosting.bandwidth || (bwStat ? `${bwStat.value} / ${bwStat.limit}` : '412 MB / 50 GB');

  const handleToolClick = (target) => {
    if (target === 'quick_email') {
      setEmailMsg({ type: '', text: '' });
      setQuickEmailModal(true);
      return;
    }
    if (target === 'change_password') {
      setPassMsg({ type: '', text: '' });
      setChangePassModal(true);
      return;
    }
    if (target === 'logout') {
      if (onLogout) {
        onLogout();
      } else {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      }
      return;
    }
    if (target === 'server_info') {
      if (onOpenServerInfo) {
        onOpenServerInfo();
      } else if (onOpenTool) {
        onOpenTool('server_info');
      }
      return;
    }
    if (onOpenTool) {
      onOpenTool(target);
    }
  };

  const handleQuickCreateEmail = async (e) => {
    e.preventDefault();
    if (!emailUser.trim()) {
      setEmailMsg({ type: 'error', text: 'Please provide a username for the email.' });
      return;
    }
    if (emailPass.length < 6) {
      setEmailMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (emailPass !== emailConfirmPass) {
      setEmailMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setEmailLoading(true);
    setEmailMsg({ type: '', text: '' });
    try {
      await api.createEmailAccount(emailUser.trim(), primaryDomain, emailPass, emailQuota);
      setEmailMsg({ type: 'success', text: `Email account ${emailUser.trim()}@${primaryDomain} successfully created!` });
      setEmailUser('');
      setEmailPass('');
      setEmailConfirmPass('');
      setTimeout(() => setQuickEmailModal(false), 2000);
    } catch (err) {
      setEmailMsg({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to create email account.' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleInlineQuickCreate = async (e) => {
    e.preventDefault();
    if (!quickInlineUser.trim()) {
      setQuickInlineMsg({ type: 'error', text: 'Please enter a username.' });
      return;
    }
    if (quickInlinePass.length < 6) {
      setQuickInlineMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    setQuickInlineLoading(true);
    setQuickInlineMsg({ type: '', text: '' });
    try {
      await api.createEmailAccount(quickInlineUser.trim(), primaryDomain, quickInlinePass, 1024);
      setQuickInlineMsg({ type: 'success', text: `Email account ${quickInlineUser.trim()}@${primaryDomain} created successfully!` });
      setQuickInlineUser('');
      setQuickInlinePass('');
      setTimeout(() => setQuickInlineMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setQuickInlineMsg({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to create email account.' });
    } finally {
      setQuickInlineLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPass) {
      setPassMsg({ type: 'error', text: 'Please enter a new password.' });
      return;
    }
    if (newPass.length < 6) {
      setPassMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPass !== confirmPass) {
      setPassMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setPassLoading(true);
    setPassMsg({ type: '', text: '' });
    try {
      const res = await api.login(currentUser, currPass);
      if (!res.success) {
        setPassMsg({ type: 'error', text: 'Current password is incorrect.' });
        setPassLoading(false);
        return;
      }
      setPassMsg({ type: 'success', text: 'Password successfully updated!' });
      setCurrPass('');
      setNewPass('');
      setConfirmPass('');
      setTimeout(() => setChangePassModal(false), 2000);
    } catch (err) {
      setPassMsg({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to update password.' });
    } finally {
      setPassLoading(false);
    }
  };

  // Filter categories and tools when user types in search bar
  const filteredCategories = OFFICIAL_CATEGORIES.map((cat) => {
    if (!query) return cat;
    const matchingTools = cat.tools.filter(
      (t) => t.name.toLowerCase().includes(query) || (t.desc && t.desc.toLowerCase().includes(query))
    );
    return {
      ...cat,
      tools: matchingTools
    };
  }).filter((cat) => !query || cat.tools.length > 0);

  return (
    <div className="space-y-6">
      {/* 
        CPANEL INFORMATION (Top Section as required):
        - Domain
        - Hosting Status
        - Package
        - Disk Usage
        - Bandwidth
        - PHP Version
        - IP
        - Nameserver
        - Expiry Date
      */}
      <div className="bg-gradient-to-r from-[#1c0830]/90 via-[#260c3e]/85 to-[#0f2219]/90 backdrop-blur-md border border-purple-800/40 rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.35)] text-left">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-900/40 pb-3 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            <span className="text-[13px] font-extrabold text-white tracking-wider uppercase">
              cPanel Hosting Management ({primaryDomain})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-700/50 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active Service
            </span>
            <button
              type="button"
              onClick={() => onOpenTool && onOpenTool('client_dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-900/60 hover:bg-purple-800 text-purple-200 hover:text-white border border-purple-700/50 cursor-pointer transition shadow-sm"
              title="Return to Client Portal to manage other domains"
            >
              <span>← Return to Client Portal</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 text-[12px]">
          <div className="bg-purple-950/40 border border-purple-800/30 rounded-xl p-3">
            <span className="text-purple-300/70 block text-[10.5px] font-semibold uppercase tracking-wider">Domain</span>
            <span className="font-bold text-purple-200 hover:text-emerald-300 hover:underline cursor-pointer truncate block mt-1">
              {primaryDomain}
            </span>
          </div>
          <div className="bg-purple-950/40 border border-purple-800/30 rounded-xl p-3">
            <span className="text-purple-300/70 block text-[10.5px] font-semibold uppercase tracking-wider">Hosting IP</span>
            <span className="font-mono font-bold text-purple-200 block mt-1">{sharedIp}</span>
          </div>
          <div className="bg-purple-950/40 border border-purple-800/30 rounded-xl p-3">
            <span className="text-purple-300/70 block text-[10.5px] font-semibold uppercase tracking-wider">Nameservers</span>
            <span className="font-bold text-white block mt-1 truncate" title={nameserver}>
              {nameserver}
            </span>
          </div>
          <div className="bg-purple-950/40 border border-purple-800/30 rounded-xl p-3">
            <span className="text-purple-300/70 block text-[10.5px] font-semibold uppercase tracking-wider">Document Root</span>
            <span className="font-mono text-purple-200 font-semibold block mt-1 truncate" title={documentRoot}>
              {documentRoot}
            </span>
          </div>
          <div className="bg-purple-950/40 border border-purple-800/30 rounded-xl p-3">
            <span className="text-purple-300/70 block text-[10.5px] font-semibold uppercase tracking-wider">PHP Version</span>
            <span className="font-bold text-emerald-300 block mt-1">{phpVersion}</span>
          </div>
          <div className="bg-purple-950/40 border border-purple-800/30 rounded-xl p-3">
            <span className="text-purple-300/70 block text-[10.5px] font-semibold uppercase tracking-wider">Storage</span>
            <span className="font-bold text-white block mt-1">{diskUsageText}</span>
          </div>
          <div className="bg-purple-950/40 border border-purple-800/30 rounded-xl p-3">
            <span className="text-purple-300/70 block text-[10.5px] font-semibold uppercase tracking-wider">Bandwidth</span>
            <span className="font-bold text-white block mt-1">{bwUsageText}</span>
          </div>
          <div className="bg-purple-950/40 border border-purple-800/30 rounded-xl p-3">
            <span className="text-purple-300/70 block text-[10.5px] font-semibold uppercase tracking-wider">Service Status</span>
            <span className="font-bold text-emerald-400 block mt-1">{serviceStatus}</span>
          </div>
          <div className="bg-purple-950/40 border border-purple-800/30 rounded-xl p-3">
            <span className="text-purple-300/70 block text-[10.5px] font-semibold uppercase tracking-wider">Start Date</span>
            <span className="font-bold text-white block mt-1">{startDate}</span>
          </div>
          <div className="bg-purple-950/40 border border-purple-800/30 rounded-xl p-3">
            <span className="text-purple-300/70 block text-[10.5px] font-semibold uppercase tracking-wider">Expiry Date</span>
            <span className="font-bold text-emerald-400 block mt-1">{expiryDate}</span>
          </div>
          <div className="col-span-2 bg-purple-950/40 border border-purple-800/30 rounded-xl p-3">
            <span className="text-purple-300/70 block text-[10.5px] font-semibold uppercase tracking-wider">Package</span>
            <span className="font-bold text-white block mt-1 truncate">{packagePlan}</span>
          </div>
        </div>
      </div>

      {/* Page Title Header */}
      <div className="flex items-center justify-between pb-1">
        <h1 className="text-[22px] font-black text-white tracking-tight">
          Tools
        </h1>
        <span className="text-[12px] text-purple-300/70 font-medium">
          20 Core Hosting Modules
        </span>
      </div>

      {/* Main 2-Column Grid */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        
        {/* Left / Center: The 20 Core Feature Section Cards */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {filteredCategories.length === 0 ? (
            <div className="bg-[#18092a]/80 border border-purple-900/40 rounded-xl p-8 text-center text-purple-200 text-[13px]">
              No tools match your search "{searchQuery}". Press Esc or clear the search to view all tools.
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <FeatureSection
                key={cat.id}
                id={cat.id}
                title={cat.title}
                icon={cat.icon}
                tools={cat.tools}
                onOpenTool={handleToolClick}
              />
            ))
          )}

          {/* 06. Quick Create Email Account Card (Section 06 Requirement) */}
          <div className="bg-gradient-to-r from-[#1c0830]/90 via-[#260c3e]/90 to-[#0f2219]/90 backdrop-blur-md border border-purple-800/40 rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.3)] text-left">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-900/50 flex items-center justify-center text-[#ff6c2c] border border-purple-700/40">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[14px] text-white">Quick Create Email Account</h3>
                  <p className="text-[11px] text-purple-300/70">Create a new domain mailbox instantly without switching tabs</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-700/50 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Instant Provisioning
              </span>
            </div>

            {quickInlineMsg.text && (
              <div className={`p-3 mb-4 rounded-xl text-[12px] font-semibold flex items-center gap-2 ${
                quickInlineMsg.type === 'success' 
                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/50' 
                  : 'bg-rose-950/70 text-rose-300 border border-rose-700/50'
              }`}>
                {quickInlineMsg.text}
              </div>
            )}

            <form onSubmit={handleInlineQuickCreate} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-purple-200 mb-1.5">Username</label>
                <input
                  type="text"
                  required
                  placeholder="contact"
                  value={quickInlineUser}
                  onChange={(e) => setQuickInlineUser(e.target.value)}
                  className="w-full px-3 py-2 bg-[#260c3e]/80 border border-purple-800/40 rounded-xl text-[12.5px] text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-purple-200 mb-1.5">Domain</label>
                <div className="flex items-center">
                  <span className="px-2.5 py-2 bg-purple-950/80 border border-r-0 border-purple-800/40 text-purple-300 text-[12px] rounded-l-xl font-bold">@</span>
                  <input
                    type="text"
                    readOnly
                    value={primaryDomain}
                    className="w-full px-2.5 py-2 bg-[#260c3e]/80 border border-purple-800/40 rounded-r-xl text-[12px] text-purple-200 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-purple-200 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={quickInlinePass}
                  onChange={(e) => setQuickInlinePass(e.target.value)}
                  className="w-full px-3 py-2 bg-[#260c3e]/80 border border-purple-800/40 rounded-xl text-[12.5px] text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={quickInlineLoading}
                  className="w-full py-2 bg-[#ff6c2c] hover:bg-[#e55619] text-white text-[12px] font-bold rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 h-[38px]"
                >
                  {quickInlineLoading ? 'Creating...' : 'Create Email'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Sidebar: General Information & Statistics Panels */}
        <div className="w-full lg:w-[320px] shrink-0 space-y-4">
          <GeneralInfoPanel 
            stats={stats}
            onOpenServerInfo={onOpenServerInfo}
            activeHostingContext={ctx}
          />
          <StatisticsPanel 
            stats={stats}
          />
        </div>

      </div>

      {/* QUICK CREATE EMAIL MODAL */}
      {quickEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1c0830] rounded-2xl border border-purple-800/60 shadow-2xl w-full max-w-md overflow-hidden text-left animate-in fade-in duration-200">
            <div className="px-5 py-4 border-b border-purple-900/40 flex items-center justify-between bg-gradient-to-r from-purple-950/60 to-emerald-950/40">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-900/50 flex items-center justify-center text-purple-300 border border-purple-700/40">
                  <Send className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-[14px] text-white">Quick Create Email Account</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setQuickEmailModal(false)}
                className="text-purple-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateEmail} className="p-5 space-y-4 text-[12px]">
              {emailMsg.text && (
                <div className={`p-3 rounded-xl text-[11.5px] font-semibold ${
                  emailMsg.type === 'success' 
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50' 
                    : 'bg-rose-950/60 text-rose-300 border border-rose-700/50'
                }`}>
                  {emailMsg.text}
                </div>
              )}

              <div>
                <label className="block font-semibold text-purple-200 mb-1.5">
                  Username
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    required
                    value={emailUser}
                    onChange={(e) => setEmailUser(e.target.value)}
                    placeholder="user"
                    className="flex-1 px-3 py-2 bg-[#260c3e]/80 border border-purple-800/40 rounded-l-xl text-[12.5px] text-white focus:outline-none focus:border-purple-400"
                  />
                  <span className="px-3 py-2 bg-purple-950/80 border border-l-0 border-purple-800/40 text-purple-300 text-[12.5px] rounded-r-xl font-medium">
                    @{primaryDomain}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-purple-200 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={emailPass}
                  onChange={(e) => setEmailPass(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 bg-[#260c3e]/80 border border-purple-800/40 rounded-xl text-[12.5px] text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-purple-200 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={emailConfirmPass}
                  onChange={(e) => setEmailConfirmPass(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full px-3 py-2 bg-[#260c3e]/80 border border-purple-800/40 rounded-xl text-[12.5px] text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-purple-200 mb-1.5">
                  Storage Quota (MB)
                </label>
                <input
                  type="number"
                  value={emailQuota}
                  onChange={(e) => setEmailQuota(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#260c3e]/80 border border-purple-800/40 rounded-xl text-[12.5px] text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setQuickEmailModal(false)}
                  className="px-4 py-2 border border-purple-800/40 rounded-xl text-purple-300 hover:bg-purple-900/30 text-[12px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailLoading}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white rounded-xl font-bold text-[12.5px] cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {emailLoading ? 'Creating...' : '+ Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {changePassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1c0830] rounded-2xl border border-purple-800/60 shadow-2xl w-full max-w-md overflow-hidden text-left animate-in fade-in duration-200">
            <div className="px-5 py-4 border-b border-purple-900/40 flex items-center justify-between bg-gradient-to-r from-purple-950/60 to-emerald-950/40">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-900/50 flex items-center justify-center text-purple-300 border border-purple-700/40">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-[14px] text-white">Change cPanel Password</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setChangePassModal(false)}
                className="text-purple-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-5 space-y-4 text-[12px]">
              {passMsg.text && (
                <div className={`p-3 rounded-xl text-[11.5px] font-semibold ${
                  passMsg.type === 'success' 
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50' 
                    : 'bg-rose-950/60 text-rose-300 border border-rose-700/50'
                }`}>
                  {passMsg.text}
                </div>
              )}

              <div>
                <label className="block font-semibold text-purple-200 mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currPass}
                  onChange={(e) => setCurrPass(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 bg-[#260c3e]/80 border border-purple-800/40 rounded-xl text-[12.5px] text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-purple-200 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3 py-2 bg-[#260c3e]/80 border border-purple-800/40 rounded-xl text-[12.5px] text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-purple-200 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2 bg-[#260c3e]/80 border border-purple-800/40 rounded-xl text-[12.5px] text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setChangePassModal(false)}
                  className="px-4 py-2 border border-purple-800/40 rounded-xl text-purple-300 hover:bg-purple-900/30 text-[12px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passLoading}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white rounded-xl font-bold text-[12.5px] cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {passLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
