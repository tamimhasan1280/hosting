import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Server, Globe, ExternalLink, Key, Shield, ShieldCheck, HardDrive, Cpu, 
  Clock, ArrowLeft, Mail, Folder, Database, RefreshCw, AlertTriangle, 
  CheckCircle2, Lock, X, Layers, Activity, FileText, Settings, Sparkles
} from 'lucide-react';

export default function DomainHostingDashboard({ 
  serviceId = null, 
  domainName = null, 
  onNavigate, 
  onOpenCpanel 
}) {
  const [loading, setLoading] = useState(true);
  const [hostingInfo, setHostingInfo] = useState(null);
  const [error, setError] = useState('');

  // Change Password Modal
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passSubmitting, setPassSubmitting] = useState(false);
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getHostingInfo(serviceId, domainName);
      if (res && res.hostingInfo) {
        setHostingInfo(res.hostingInfo);
      } else {
        setError('Could not retrieve hosting information for this domain.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load domain dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [serviceId, domainName]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPassMsg({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setPassSubmitting(true);
    setPassMsg({ type: '', text: '' });
    try {
      const targetSvcId = serviceId || hostingInfo?.serviceId;
      const res = await api.changeServicePassword(targetSvcId, newPassword);
      if (res.success) {
        setPassMsg({ type: 'success', text: res.message || 'cPanel password updated successfully!' });
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setIsPassModalOpen(false);
          setPassMsg({ type: '', text: '' });
        }, 2000);
      } else {
        setPassMsg({ type: 'error', text: res.message || 'Failed to update password.' });
      }
    } catch (err) {
      setPassMsg({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to change password.' });
    } finally {
      setPassSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-purple-300/70">Loading Domain Hosting Environment...</p>
        </div>
      </div>
    );
  }

  if (error || !hostingInfo) {
    return (
      <div className="max-w-2xl mx-auto p-8 rounded-2xl bg-[#1c0830]/90 border border-purple-800/40 text-center space-y-4 shadow-2xl">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h3 className="text-base font-bold text-white">Domain Hosting Not Found</h3>
        <p className="text-xs text-purple-300/70">{error || 'This hosting service is either not active or does not belong to your account.'}</p>
        <button
          type="button"
          onClick={() => onNavigate('my_services')}
          className="px-4 py-2 rounded-xl bg-purple-900/60 hover:bg-purple-800 text-white font-bold text-xs cursor-pointer"
        >
          Return to My Hosting
        </button>
      </div>
    );
  }

  const rawStatus = (hostingInfo.rawStatus || hostingInfo.serviceStatus || 'active').toLowerCase();
  const isActive = rawStatus === 'active';
  const isPending = rawStatus === 'pending';
  const isSuspended = rawStatus === 'suspended';
  const isExpired = rawStatus === 'expired';

  const hostingTools = [
    { id: 'files', label: 'File Manager', desc: 'Browse, edit, and upload website files', icon: Folder, target: 'files' },
    { id: 'email', label: 'Email Accounts', desc: 'Create and manage domain mailboxes', icon: Mail, target: 'email' },
    { id: 'databases', label: 'MySQL Databases', desc: 'Manage databases and database users', icon: Database, target: 'databases' },
    { id: 'phpmyadmin', label: 'phpMyAdmin', desc: 'Direct phpMyAdmin database GUI', icon: ExternalLink, target: 'phpmyadmin' },
    { id: 'ftp_accounts', label: 'FTP Accounts', desc: 'Isolated FTP credentials and paths', icon: Server, target: 'ftp_accounts' },
    { id: 'ssl', label: 'SSL / TLS', desc: 'AutoSSL certificates & HTTPS redirect', icon: ShieldCheck, target: 'ssl' },
    { id: 'zone_editor', label: 'DNS Zone Editor', desc: 'Manage A, CNAME, MX, TXT records', icon: Globe, target: 'zone_editor' },
    { id: 'cron', label: 'Cron Jobs', desc: 'Automate scheduled system tasks', icon: Clock, target: 'cron' },
    { id: 'backup', label: 'Backup & Restore', desc: 'Full website & database snapshots', icon: Layers, target: 'backup' },
    { id: 'errors', label: 'Error Logs', desc: 'PHP errors and web server access logs', icon: FileText, target: 'errors' },
    { id: 'resource_usage', label: 'Resource Usage', desc: 'Disk, bandwidth, and CPU statistics', icon: Activity, target: 'resource_usage' },
    { id: 'ip_blocker', label: 'Security & IP Blocker', desc: 'Directory privacy & IP restrictions', icon: Shield, target: 'ip_blocker' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => onNavigate('my_services')}
            className="p-2 rounded-xl bg-purple-950/60 border border-purple-800/40 text-purple-300 hover:text-white transition cursor-pointer"
            title="Back to My Hosting"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-400" />
                <span className="font-mono">{hostingInfo.domain}</span>
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                isActive ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50' :
                isPending ? 'bg-amber-950/80 text-amber-300 border-amber-700/50' :
                'bg-rose-950/80 text-rose-300 border-rose-700/50'
              }`}>
                {hostingInfo.serviceStatus}
              </span>
            </div>
            <p className="text-xs text-purple-300/70">
              Dedicated Hosting Management Dashboard &bull; {hostingInfo.package}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadData}
            title="Refresh Status"
            className="p-2.5 rounded-xl bg-purple-950/50 border border-purple-800/40 text-purple-300 hover:text-white cursor-pointer transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lock Notice if Not Active (Section 13, 21, 42) */}
      {!isActive && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/50 text-amber-200 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-bold">cPanel & Hosting Access Locked</p>
            <p className="text-[11px] text-amber-200/80">
              {isPending && 'Your hosting service is pending admin review and activation. cPanel tools, FTP, and Mail will unlock automatically once approved.'}
              {isSuspended && 'This hosting service is suspended. Please contact TAMIM HOSTING administration for assistance.'}
              {isExpired && 'This hosting service has expired. Please renew your plan to restore full cPanel and website access.'}
            </p>
          </div>
        </div>
      )}

      {/* Domain Information Panel (Section 20 & 43) */}
      <div className="p-6 rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/40 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-purple-900/50 pb-4">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Domain Information</h2>
          </div>
          <span className="text-[11px] text-purple-300/60 font-mono">
            ID: {hostingInfo.serviceId || 'N/A'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-[#240939]/60 border border-purple-900/30 space-y-1">
            <span className="text-purple-300/60 text-[10px] uppercase font-bold tracking-wider">Domain</span>
            <p className="font-bold text-white font-mono truncate">{hostingInfo.domain}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#240939]/60 border border-purple-900/30 space-y-1">
            <span className="text-purple-300/60 text-[10px] uppercase font-bold tracking-wider">Server Name</span>
            <p className="font-bold text-white font-mono truncate">{hostingInfo.serverName || 'server1.tamimhosting.com'}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#240939]/60 border border-purple-900/30 space-y-1">
            <span className="text-purple-300/60 text-[10px] uppercase font-bold tracking-wider">Server IP</span>
            <p className="font-bold text-emerald-300 font-mono">{hostingInfo.hostingIp || '127.0.0.1'}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#240939]/60 border border-purple-900/30 space-y-1">
            <span className="text-purple-300/60 text-[10px] uppercase font-bold tracking-wider">Nameservers</span>
            <p className="font-bold text-white font-mono text-[11px] truncate">
              {(hostingInfo.nameservers || ['ns1.tamimhosting.com', 'ns2.tamimhosting.com']).join(', ')}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#240939]/60 border border-purple-900/30 space-y-1 sm:col-span-2">
            <span className="text-purple-300/60 text-[10px] uppercase font-bold tracking-wider">Document Root</span>
            <p className="font-bold text-emerald-300 font-mono text-[11px] truncate">{hostingInfo.documentRoot}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#240939]/60 border border-purple-900/30 space-y-1">
            <span className="text-purple-300/60 text-[10px] uppercase font-bold tracking-wider">PHP Version</span>
            <p className="font-bold text-white">{hostingInfo.phpVersion || 'PHP 8.2'}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#240939]/60 border border-purple-900/30 space-y-1">
            <span className="text-purple-300/60 text-[10px] uppercase font-bold tracking-wider">Hosting Package</span>
            <p className="font-bold text-white truncate">{hostingInfo.package}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#240939]/60 border border-purple-900/30 space-y-1">
            <span className="text-purple-300/60 text-[10px] uppercase font-bold tracking-wider">Disk Storage</span>
            <p className="font-bold text-white">{hostingInfo.storage}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#240939]/60 border border-purple-900/30 space-y-1">
            <span className="text-purple-300/60 text-[10px] uppercase font-bold tracking-wider">Bandwidth</span>
            <p className="font-bold text-white">{hostingInfo.bandwidth}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#240939]/60 border border-purple-900/30 space-y-1">
            <span className="text-purple-300/60 text-[10px] uppercase font-bold tracking-wider">Start Date</span>
            <p className="font-bold text-white">{hostingInfo.startDate || 'N/A'}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#240939]/60 border border-purple-900/30 space-y-1">
            <span className="text-purple-300/60 text-[10px] uppercase font-bold tracking-wider">Expiry Date</span>
            <p className="font-bold text-amber-300">{hostingInfo.expiryDate || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* QUICK ACCESS ACTION ROW (Section 21, 23, 28) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* cPanel Access Button (LOCKED vs ACTIVE) */}
        {isActive ? (
          <button
            type="button"
            onClick={() => {
              const ctx = {
                user: hostingInfo.details?.user,
                serviceId: hostingInfo.serviceId,
                domain: hostingInfo.domain,
                package: hostingInfo.package,
                features: hostingInfo.packageFeatures || []
              };
              if (onOpenCpanel) {
                onOpenCpanel(ctx);
              } else {
                onNavigate('dashboard');
              }
            }}
            className="p-4 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white font-extrabold text-xs shadow-xl flex items-center justify-center gap-2.5 cursor-pointer transition transform active:scale-95"
            title="Direct 1-Click Login to cPanel Jupiter for this domain"
          >
            <ExternalLink className="w-4 h-4" />
            <span>LOGIN TO CPANEL</span>
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="p-4 rounded-2xl bg-purple-950/40 border border-purple-900/50 text-purple-400 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-75"
            title={hostingInfo.cpanelStatusMessage}
          >
            <Lock className="w-4 h-4 text-amber-400" />
            <span>
              {isPending ? '[ CPANEL LOCKED ] Waiting for activation' :
               isSuspended ? '[ CPANEL SUSPENDED ] Contact Admin' :
               '[ SERVICE EXPIRED ] Renew service'}
            </span>
          </button>
        )}

        {/* Email Login (Webmail) */}
        <button
          type="button"
          disabled={!isActive}
          onClick={() => onNavigate('email', 'webmail')}
          className={`p-4 rounded-2xl bg-[#1c0830]/90 border border-purple-800/40 hover:border-emerald-500/50 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2.5 transition ${
            !isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-purple-900/30'
          }`}
        >
          <Mail className="w-4 h-4 text-emerald-400" />
          <span>Email Login</span>
        </button>

        {/* FTP Accounts */}
        <button
          type="button"
          disabled={!isActive}
          onClick={() => onNavigate('ftp_accounts')}
          className={`p-4 rounded-2xl bg-[#1c0830]/90 border border-purple-800/40 hover:border-purple-600/50 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2.5 transition ${
            !isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-purple-900/30'
          }`}
        >
          <Server className="w-4 h-4 text-purple-400" />
          <span>FTP Accounts</span>
        </button>

        {/* Change cPanel Password Modal Trigger */}
        <button
          type="button"
          onClick={() => {
            setIsPassModalOpen(true);
            setNewPassword('');
            setConfirmPassword('');
            setPassMsg({ type: '', text: '' });
          }}
          className="p-4 rounded-2xl bg-[#1c0830]/90 border border-purple-800/40 hover:border-amber-500/50 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2.5 cursor-pointer hover:bg-purple-900/30 transition"
        >
          <Key className="w-4 h-4 text-amber-400" />
          <span>Change Password</span>
        </button>
      </div>

      {/* CORE CPANEL HOSTING TOOLS (Section 24) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Hosting Management Tools</span>
          </h2>
          <span className="text-xs text-purple-300/60">
            {isActive ? 'Click any tool to manage directly' : 'Locked until service is active'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {hostingTools.map(tool => {
            const IconComp = tool.icon;
            return (
              <div
                key={tool.id}
                onClick={() => {
                  if (isActive) {
                    const ctx = {
                      user: hostingInfo.details?.user,
                      serviceId: hostingInfo.serviceId,
                      domain: hostingInfo.domain,
                      package: hostingInfo.package,
                      features: hostingInfo.packageFeatures || []
                    };
                    if (onOpenCpanel) {
                      onOpenCpanel(ctx, tool.target);
                    } else {
                      onNavigate(tool.target);
                    }
                  }
                }}
                className={`p-4 rounded-2xl bg-[#1b082e]/80 border border-purple-800/40 transition shadow-lg flex items-start space-x-3 ${
                  isActive
                    ? 'hover:border-emerald-500/50 hover:bg-[#220a3a] cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-purple-900/40 border border-purple-700/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <IconComp className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-xs text-white truncate">{tool.label}</h3>
                  <p className="text-[11px] text-purple-300/60 line-clamp-2 mt-0.5">{tool.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Change cPanel Password Modal */}
      {isPassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#1c0830] border border-purple-700/60 rounded-2xl p-6 shadow-2xl space-y-4 text-white relative">
            <button 
              onClick={() => setIsPassModalOpen(false)} 
              className="absolute top-4 right-4 text-purple-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-900/60 flex items-center justify-center text-amber-400 border border-purple-700/50">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Change cPanel Password</h3>
                <p className="text-xs text-purple-300/70 font-mono">{hostingInfo.domain}</p>
              </div>
            </div>

            <div className="p-3 bg-purple-950/60 rounded-xl border border-purple-800/40 text-xs space-y-1 text-purple-300/80">
              <div className="flex justify-between">
                <span>Domain:</span>
                <strong className="text-white font-mono">{hostingInfo.domain}</strong>
              </div>
              <div className="flex justify-between">
                <span>cPanel User:</span>
                <strong className="text-emerald-300 font-mono">{hostingInfo.details?.user || 'cpanel_user'}</strong>
              </div>
            </div>

            {passMsg.text && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                passMsg.type === 'success' 
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50' 
                  : 'bg-rose-950/80 text-rose-300 border border-rose-700/50'
              }`}>
                {passMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{passMsg.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-purple-200">New cPanel Password</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter strong password (min 6 chars)"
                    className="w-full px-3.5 py-2.5 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white focus:outline-none focus:border-purple-400"
                  />
                  <Lock className="w-4 h-4 text-purple-400 absolute right-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-purple-200">Confirm New Password</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-3.5 py-2.5 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white focus:outline-none focus:border-purple-400"
                  />
                  <Lock className="w-4 h-4 text-purple-400 absolute right-3 top-3" />
                </div>
              </div>

              <div className="text-[10px] text-purple-300/60 flex items-center gap-1.5 pt-1">
                <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Password is hashed with bcryptjs (salt cost 10). Plaintext is never stored.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-800/40">
                <button
                  type="button"
                  onClick={() => setIsPassModalOpen(false)}
                  className="px-4 py-2 bg-purple-900/50 hover:bg-purple-800 text-purple-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {passSubmitting ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
