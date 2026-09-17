import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Folder, Key, Trash2, RefreshCw, Search, Plus, 
  ExternalLink, Copy, Check, X, AlertTriangle, CheckCircle, 
  Wifi, Shield, Lock, Laptop, Terminal, Smartphone, HelpCircle, 
  Eye, EyeOff, Download, HardDrive, Settings, Sliders, ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import Modal from '../components/ui/Modal';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';

export default function FtpAccounts({ onOpenFileManager }) {
  const [accounts, setAccounts] = useState([]);
  const [capabilities, setCapabilities] = useState(null);
  const [directories, setDirectories] = useState([]);
  const [domains, setDomains] = useState([]);
  const [primaryDomain, setPrimaryDomain] = useState('example.com');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Form State
  const [newUsername, setNewUsername] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [newDirectory, setNewDirectory] = useState('public_html/');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [quotaType, setQuotaType] = useState('unlimited'); // 'unlimited' | 'custom'
  const [customQuotaMb, setCustomQuotaMb] = useState('1000');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  // Modals
  const [passwordModalAcct, setPasswordModalAcct] = useState(null);
  const [editPassword, setEditPassword] = useState('');
  const [editConfirm, setEditConfirm] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [quotaModalAcct, setQuotaModalAcct] = useState(null);
  const [editQuotaType, setEditQuotaType] = useState('unlimited');
  const [editQuotaMb, setEditQuotaMb] = useState('1000');
  const [changingQuota, setChangingQuota] = useState(false);

  const [dirModalAcct, setDirModalAcct] = useState(null);
  const [editDir, setEditDir] = useState('');
  const [changingDir, setChangingDir] = useState(false);

  const [clientModalAcct, setClientModalAcct] = useState(null);
  const [clientInfo, setClientInfo] = useState(null);
  const [loadingClientInfo, setLoadingClientInfo] = useState(false);

  const [testModalAcct, setTestModalAcct] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const [deleteModalAcct, setDeleteModalAcct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification(prev => (prev?.message === msg ? null : prev));
    }, 4500);
  };

  const copyToClipboard = (text, fieldName) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2500);
    } else {
      showNotification('Clipboard access unavailable', 'error');
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
    let pass = '';
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
    setConfirmPassword(pass);
    showNotification('Secure password generated and applied!', 'info');
  };

  const calculatePasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: 'None', color: 'bg-slate-200' };
    let score = 0;
    if (pass.length >= 6) score += 20;
    if (pass.length >= 10) score += 25;
    if (/[A-Z]/.test(pass)) score += 20;
    if (/[0-9]/.test(pass)) score += 20;
    if (/[^A-Za-z0-9]/.test(pass)) score += 15;

    if (score < 40) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score < 75) return { score, label: 'Moderate', color: 'bg-amber-500' };
    return { score: 100, label: 'Very Strong', color: 'bg-emerald-500' };
  };

  const passwordStrength = useMemo(() => calculatePasswordStrength(newPassword), [newPassword]);

  // Load all initial data
  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [capsRes, acctsRes, dirsRes, domsRes] = await Promise.all([
        api.getFtpCapabilities().catch(() => ({ success: false })),
        api.getFtpAccounts().catch(() => ({ success: false, accounts: [] })),
        api.getFtpDirectories().catch(() => ({ success: false, directories: [] })),
        api.getDomains().catch(() => ({ primaryDomain: 'example.com', domains: [] }))
      ]);

      if (capsRes.success) setCapabilities(capsRes.capabilities);
      if (acctsRes.success) setAccounts(acctsRes.accounts || []);
      if (dirsRes.success) setDirectories(dirsRes.directories || []);
      
      if (domsRes) {
        const pDom = domsRes.primaryDomain || 'example.com';
        setPrimaryDomain(pDom);
        const list = [pDom, ...(domsRes.domains || []).map(d => d.name), ...(domsRes.subdomains || []).map(s => s.name)].filter(Boolean);
        const unique = Array.from(new Set(list));
        setDomains(unique);
        if (!selectedDomain && unique.length > 0) {
          setSelectedDomain(unique[0]);
        }
      }

      if (isRefresh) showNotification('FTP accounts refreshed', 'info');
    } catch (err) {
      showNotification('Failed to load FTP data: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update default directory when username changes
  const handleUsernameChange = (val) => {
    const clean = val.replace(/[^a-zA-Z0-9_.-]/g, '');
    setNewUsername(clean);
    if (clean) {
      setNewDirectory(`public_html/${clean}`);
    } else {
      setNewDirectory('public_html/');
    }
  };

  // Create FTP Account Handler
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      showNotification('Please enter an FTP username', 'error');
      return;
    }
    if (newPassword.length < 5) {
      showNotification('Password must be at least 5 characters long', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification('Passwords do not match', 'error');
      return;
    }

    setCreating(true);
    try {
      const quota = quotaType === 'unlimited' ? 'Unlimited' : `${customQuotaMb} MB`;
      const res = await api.createFtpAccount({
        username: newUsername.trim(),
        domain: selectedDomain || primaryDomain,
        password: newPassword,
        directory: newDirectory.trim(),
        quota
      });

      if (res.success) {
        showNotification(`FTP account '${res.account.username}' created successfully!`, 'success');
        setNewUsername('');
        setNewPassword('');
        setConfirmPassword('');
        setNewDirectory('public_html/');
        setQuotaType('unlimited');
        loadData();
      }
    } catch (err) {
      showNotification(err.response?.data?.error || err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  // Change Password
  const handleChangePassword = async () => {
    if (editPassword.length < 5) {
      showNotification('Password must be at least 5 characters long', 'error');
      return;
    }
    if (editPassword !== editConfirm) {
      showNotification('Passwords do not match', 'error');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await api.changeFtpPassword({
        accountId: passwordModalAcct.id,
        newPassword: editPassword
      });
      if (res.success) {
        showNotification('Password updated successfully for ' + passwordModalAcct.username, 'success');
        setPasswordModalAcct(null);
        setEditPassword('');
        setEditConfirm('');
        loadData();
      }
    } catch (err) {
      showNotification(err.response?.data?.error || err.message, 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  // Change Quota
  const handleChangeQuota = async () => {
    setChangingQuota(true);
    try {
      const quota = editQuotaType === 'unlimited' ? 'Unlimited' : `${editQuotaMb} MB`;
      const res = await api.changeFtpQuota({
        accountId: quotaModalAcct.id,
        quota
      });
      if (res.success) {
        showNotification('Quota updated successfully for ' + quotaModalAcct.username, 'success');
        setQuotaModalAcct(null);
        loadData();
      }
    } catch (err) {
      showNotification(err.response?.data?.error || err.message, 'error');
    } finally {
      setChangingQuota(false);
    }
  };

  // Change Directory
  const handleChangeDirectory = async () => {
    if (!editDir.trim()) {
      showNotification('Directory cannot be empty', 'error');
      return;
    }

    setChangingDir(true);
    try {
      const res = await api.changeFtpDirectory({
        accountId: dirModalAcct.id,
        directory: editDir.trim()
      });
      if (res.success) {
        showNotification('Directory updated successfully for ' + dirModalAcct.username, 'success');
        setDirModalAcct(null);
        loadData();
      }
    } catch (err) {
      showNotification(err.response?.data?.error || err.message, 'error');
    } finally {
      setChangingDir(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (acct) => {
    try {
      const nextStatus = acct.status === 'enabled' ? 'disabled' : 'enabled';
      const res = await api.toggleFtpStatus({
        accountId: acct.id,
        enabled: nextStatus === 'enabled'
      });
      if (res.success) {
        showNotification(`Account ${acct.username} is now ${res.status}`, 'info');
        loadData();
      }
    } catch (err) {
      showNotification(err.response?.data?.error || err.message, 'error');
    }
  };

  // Delete Account
  const handleDeleteAccount = async () => {
    if (!deleteModalAcct) return;
    setDeleting(true);
    try {
      const res = await api.deleteFtpAccount({
        accountId: deleteModalAcct.id
      });
      if (res.success) {
        showNotification(res.message || 'FTP account deleted', 'success');
        setDeleteModalAcct(null);
        loadData();
      }
    } catch (err) {
      showNotification(err.response?.data?.error || err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Test Connection
  const handleOpenTest = async (acct) => {
    setTestModalAcct(acct);
    setTestResult(null);
    setTesting(true);
    try {
      const res = await api.testFtpConnection({ accountId: acct.id });
      setTestResult(res);
    } catch (err) {
      setTestResult({ connectionOk: false, error: err.response?.data?.error || err.message });
    } finally {
      setTesting(false);
    }
  };

  // Configure Client
  const handleOpenClientInfo = async (acct) => {
    setClientModalAcct(acct);
    setLoadingClientInfo(true);
    try {
      const res = await api.getFtpConnectionInfo({ accountId: acct.id });
      if (res.success) {
        setClientInfo(res.info);
      }
    } catch (err) {
      showNotification('Failed to fetch client configuration', 'error');
    } finally {
      setLoadingClientInfo(false);
    }
  };

  // Download FileZilla XML Configuration Profile
  const downloadFileZillaXml = (info) => {
    if (!info) return;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FileZilla3 version="3.66.0" platform="windows">
  <Servers>
    <Server>
      <Host>${info.server}</Host>
      <Port>${info.ftpPort}</Port>
      <Protocol>0</Protocol>
      <Type>0</Type>
      <User>${info.username}</User>
      <Logontype>1</Logontype>
      <PasvMode>MODE_DEFAULT</PasvMode>
      <EncodingType>Auto</EncodingType>
      <Name>${info.username}</Name>
      <RemoteDir>${info.directory}</RemoteDir>
    </Server>
  </Servers>
</FileZilla3>`;

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${info.username}-FileZilla.xml`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('FileZilla configuration profile downloaded!', 'success');
  };

  // Filter accounts by search query
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;
    const q = searchQuery.toLowerCase();
    return accounts.filter(a => 
      a.username.toLowerCase().includes(q) ||
      a.directory.toLowerCase().includes(q) ||
      a.quota.toLowerCase().includes(q)
    );
  }, [accounts, searchQuery]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {notification && (
        <Alert
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
          className="fixed top-4 right-4 z-50 shadow-xl max-w-md animate-in slide-in-from-top-2"
        />
      )}

      {/* Page Header with Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <button onClick={() => onOpenFileManager && onOpenFileManager('public_html')} className="hover:text-indigo-600">Home</button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-700 font-medium">Files</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-indigo-600 font-semibold">FTP Accounts</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-3">
            <Users className="w-7 h-7 text-[#27235C]" />
            <span>FTP Accounts</span>
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Create and manage FTP user logins to upload and download files using FTP clients like FileZilla, Cyberduck, and WinSCP.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenFileManager && onOpenFileManager('public_html')}
            className="flex items-center space-x-2 bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
          >
            <ExternalLink className="w-4 h-4 text-slate-500" />
            <span>Open in File Manager</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="flex items-center space-x-2 bg-[#27235C] hover:bg-[#1b183f] text-white"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      {/* FTP Service Status Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">FTP Server Status</h2>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-semibold">
              {capabilities?.status === 'running' ? 'Service Active' : 'Active'}
            </span>
          </div>
          <div className="text-xs text-slate-500 flex items-center space-x-2">
            <span>Daemon: <strong className="text-slate-700">{capabilities?.daemon || 'cPanel RFC 959 FTP Daemon'}</strong></span>
            <span>•</span>
            <span>Port: <strong className="text-indigo-600 font-mono">{capabilities?.port || 21}</strong></span>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 bg-white text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500 font-semibold block uppercase tracking-wider mb-1">FTP Host</span>
            <span className="font-mono text-slate-900 font-bold text-sm select-all">ftp.{primaryDomain}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500 font-semibold block uppercase tracking-wider mb-1">Standard Port</span>
            <span className="font-mono text-slate-900 font-bold text-sm">{capabilities?.port || 21} (FTP)</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500 font-semibold block uppercase tracking-wider mb-1">Encryption Mode</span>
            <span className="text-slate-900 font-medium">Plain FTP / Explicit TLS</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500 font-semibold block uppercase tracking-wider mb-1">Total FTP Users</span>
            <span className="font-bold text-slate-900 text-sm">{accounts.length} / 20 Max</span>
          </div>
        </div>
      </div>

      {/* Add FTP Account Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <Plus className="w-5 h-5 text-indigo-600" />
            <span>Add FTP Account</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure a dedicated FTP login for yourself, your web developer, or automated deployment pipelines.
          </p>
        </div>

        <form onSubmit={handleCreateAccount} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Username & Domain */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Log in <span className="text-red-500">*</span>
              </label>
              <div className="flex rounded-lg shadow-sm border border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 overflow-hidden">
                <input
                  type="text"
                  placeholder="username"
                  value={newUsername}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className="block w-full px-3 py-2 text-sm bg-white focus:outline-none"
                  required
                />
                <span className="inline-flex items-center px-3 bg-slate-100 text-slate-500 text-sm border-l border-slate-300 font-medium">
                  @
                </span>
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none border-l border-slate-300 font-medium cursor-pointer"
                >
                  {domains.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-500 mt-1">Full login will be: <strong className="text-indigo-600 font-mono">{newUsername || 'user'}@{selectedDomain || primaryDomain}</strong></p>
            </div>

            {/* Directory Scope */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Directory / Path <span className="text-red-500">*</span>
              </label>
              <div className="flex rounded-lg shadow-sm border border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 overflow-hidden">
                <span className="inline-flex items-center px-3 bg-slate-100 text-slate-500 text-sm border-r border-slate-300">
                  <Folder className="w-4 h-4 mr-1 text-amber-500" /> /
                </span>
                <input
                  type="text"
                  value={newDirectory}
                  onChange={(e) => setNewDirectory(e.target.value)}
                  className="block w-full px-3 py-2 text-sm bg-white focus:outline-none font-mono"
                  required
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">FTP client will be chrooted strictly into this folder.</p>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Password <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Generate Password</span>
                </button>
              </div>
              <div className="relative rounded-lg shadow-sm">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pr-10 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength Meter */}
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>Strength:</span>
                    <span className="font-bold">{passwordStrength.label}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${passwordStrength.score}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Password Confirmation */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            {/* Quota */}
            <div className="md:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                FTP Storage Quota
              </label>
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="radio"
                    name="quotaType"
                    value="unlimited"
                    checked={quotaType === 'unlimited'}
                    onChange={() => setQuotaType('unlimited')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Unlimited Quota</span>
                </label>
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-800">
                    <input
                      type="radio"
                      name="quotaType"
                      value="custom"
                      checked={quotaType === 'custom'}
                      onChange={() => setQuotaType('custom')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Custom Limit:</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={customQuotaMb}
                    onChange={(e) => setCustomQuotaMb(e.target.value)}
                    disabled={quotaType !== 'custom'}
                    className="w-28 px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <span className="text-slate-500 font-semibold text-xs">MB</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={creating}
              className="flex items-center space-x-2 bg-[#27235C] hover:bg-[#1b183f] text-white px-6"
            >
              <Plus className="w-4 h-4" />
              <span>{creating ? 'Creating FTP Account...' : 'Create FTP Account'}</span>
            </Button>
          </div>
        </form>
      </div>

      {/* FTP Accounts List Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header & Search */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search FTP accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500">
            Showing <strong className="text-slate-800">{filteredAccounts.length}</strong> of <strong className="text-slate-800">{accounts.length}</strong> accounts
          </div>
        </div>

        {/* Accounts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="py-3.5 px-4 w-3/12">FTP Login</th>
                <th className="py-3.5 px-4 w-3/12">Directory Scope</th>
                <th className="py-3.5 px-4 w-2/12">Disk Usage / Quota</th>
                <th className="py-3.5 px-4 w-1/12">Status</th>
                <th className="py-3.5 px-4 w-3/12 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#27235C] mx-auto mb-2" />
                    <span>Loading FTP accounts...</span>
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No FTP accounts found</p>
                    <p className="text-xs text-slate-400 mt-1">Create an FTP account above to allow direct file upload access.</p>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acct) => (
                  <tr key={acct.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Login */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <span className="font-mono font-semibold text-slate-900">{acct.username}</span>
                          {acct.isMain && (
                            <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold uppercase tracking-wider">
                              Main Account
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Directory */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => onOpenFileManager && onOpenFileManager(acct.directory)}
                        className="flex items-center space-x-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-mono hover:underline group"
                        title="Click to open this folder in File Manager"
                      >
                        <Folder className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                        <span>/{acct.directory}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>

                    {/* Usage / Quota */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-800 flex justify-between">
                          <span>{acct.usageFormatted}</span>
                          <span className="text-slate-500">/ {acct.quota}</span>
                        </div>
                        {acct.quotaBytes ? (
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full ${acct.percentage > 85 ? 'bg-red-500' : acct.percentage > 60 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                              style={{ width: `${Math.min(100, acct.percentage || 0)}%` }}
                            />
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleStatus(acct)}
                        disabled={acct.isMain}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 transition-colors ${
                          acct.status === 'enabled' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                        title={acct.isMain ? 'Main account cannot be disabled' : 'Click to toggle status'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${acct.status === 'enabled' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        <span className="capitalize">{acct.status}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            setPasswordModalAcct(acct);
                            setEditPassword('');
                            setEditConfirm('');
                          }}
                          className="text-xs text-slate-700 hover:text-slate-900 border-slate-200"
                        >
                          Change Password
                        </Button>

                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            setQuotaModalAcct(acct);
                            setEditQuotaType(acct.quota === 'Unlimited' ? 'unlimited' : 'custom');
                            setEditQuotaMb(acct.quotaBytes ? String(Math.round(acct.quotaBytes / (1024 * 1024))) : '1000');
                          }}
                          className="text-xs text-slate-700 hover:text-slate-900 border-slate-200"
                        >
                          Change Quota
                        </Button>

                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            setDirModalAcct(acct);
                            setEditDir(acct.directory);
                          }}
                          className="text-xs text-slate-700 hover:text-slate-900 border-slate-200"
                        >
                          Directory
                        </Button>

                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleOpenClientInfo(acct)}
                          className="text-xs text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
                        >
                          Configure Client
                        </Button>

                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleOpenTest(acct)}
                          className="text-xs text-slate-600 border-slate-200 hover:bg-slate-50"
                          title="Test live FTP server socket connection"
                        >
                          Test
                        </Button>

                        {!acct.isMain && (
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => setDeleteModalAcct(acct)}
                            className="text-xs bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 p-1.5"
                            title="Delete FTP account (Preserves files on disk)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Special FTP Accounts Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>Special FTP Accounts</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              These administrative accounts are tied directly to your cPanel user profile and cannot be deleted.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4 w-4/12">Account Login</th>
                <th className="py-3 px-4 w-4/12">Path / Scope</th>
                <th className="py-3 px-4 w-2/12">Quota</th>
                <th className="py-3 px-4 w-2/12 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              <tr className="hover:bg-slate-50/60">
                <td className="py-3 px-4 font-mono font-bold text-indigo-900 flex items-center space-x-2">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{currentCpanelUser}</span>
                </td>
                <td className="py-3 px-4 font-mono text-slate-600">/home/{currentCpanelUser}</td>
                <td className="py-3 px-4 text-slate-500 font-medium">Unlimited</td>
                <td className="py-3 px-4 text-right">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleOpenClientInfo(accounts.find(a => a.isMain) || { id: 'ftp_main', username: `${currentCpanelUser}@${primaryDomain}`, directory: 'public_html', quota: 'Unlimited' })}
                    className="text-xs text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
                  >
                    Configure Client
                  </Button>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60">
                <td className="py-3 px-4 font-mono font-bold text-slate-700 flex items-center space-x-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>{currentCpanelUser}_logs</span>
                </td>
                <td className="py-3 px-4 font-mono text-slate-500">/usr/local/apache/domlogs</td>
                <td className="py-3 px-4 text-slate-500 font-medium">Unlimited</td>
                <td className="py-3 px-4 text-right">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleOpenClientInfo({ id: 'ftp_logs', username: `${currentCpanelUser}_logs@${primaryDomain}`, directory: 'logs', quota: 'Unlimited' })}
                    className="text-xs text-slate-600 border-slate-200 hover:bg-slate-50"
                  >
                    Configure Client
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Change Password Modal */}
      {passwordModalAcct && (
        <Modal
          isOpen={true}
          onClose={() => setPasswordModalAcct(null)}
          title={`Change Password for ${passwordModalAcct.username}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Enter a new secure password for this FTP account.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                New Password
              </label>
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={editConfirm}
                onChange={(e) => setEditConfirm(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="outline" onClick={() => setPasswordModalAcct(null)}>Cancel</Button>
            <Button variant="primary" disabled={changingPassword} onClick={handleChangePassword} className="bg-[#27235C] text-white">
              {changingPassword ? 'Updating Password...' : 'Save Password'}
            </Button>
          </div>
        </Modal>
      )}

      {/* 2. Change Quota Modal */}
      {quotaModalAcct && (
        <Modal
          isOpen={true}
          onClose={() => setQuotaModalAcct(null)}
          title={`Change Quota for ${quotaModalAcct.username}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Adjust the disk storage quota allocated to this FTP account.
            </p>
            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-800 text-sm">
                <input
                  type="radio"
                  name="editQuotaType"
                  value="unlimited"
                  checked={editQuotaType === 'unlimited'}
                  onChange={() => setEditQuotaType('unlimited')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Unlimited Quota</span>
              </label>
              <div className="flex items-center space-x-2 text-sm">
                <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="radio"
                    name="editQuotaType"
                    value="custom"
                    checked={editQuotaType === 'custom'}
                    onChange={() => setEditQuotaType('custom')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Custom Limit:</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={editQuotaMb}
                  onChange={(e) => setEditQuotaMb(e.target.value)}
                  disabled={editQuotaType !== 'custom'}
                  className="w-28 px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                />
                <span className="text-slate-500 font-semibold text-xs">MB</span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="outline" onClick={() => setQuotaModalAcct(null)}>Cancel</Button>
            <Button variant="primary" disabled={changingQuota} onClick={handleChangeQuota} className="bg-[#27235C] text-white">
              {changingQuota ? 'Saving Quota...' : 'Save Quota'}
            </Button>
          </div>
        </Modal>
      )}

      {/* 3. Change Directory Modal */}
      {dirModalAcct && (
        <Modal
          isOpen={true}
          onClose={() => setDirModalAcct(null)}
          title={`Change Directory for ${dirModalAcct.username}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Update the root folder this FTP user is locked inside. <strong className="text-amber-700">Note: Existing files will remain in their original directories and will not be moved.</strong>
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                New Directory Scope
              </label>
              <div className="flex rounded-lg shadow-sm border border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500 overflow-hidden">
                <span className="inline-flex items-center px-3 bg-slate-100 text-slate-500 text-sm border-r border-slate-300">
                  /
                </span>
                <input
                  type="text"
                  value={editDir}
                  onChange={(e) => setEditDir(e.target.value)}
                  className="block w-full px-3 py-2 text-sm bg-white focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="outline" onClick={() => setDirModalAcct(null)}>Cancel</Button>
            <Button variant="primary" disabled={changingDir} onClick={handleChangeDirectory} className="bg-[#27235C] text-white">
              {changingDir ? 'Updating Directory...' : 'Save Directory'}
            </Button>
          </div>
        </Modal>
      )}

      {/* 4. Configure Client / Connection Info Modal */}
      {clientModalAcct && (
        <Modal
          isOpen={true}
          onClose={() => setClientModalAcct(null)}
          title="FTP Client Manual Configuration"
        >
          {loadingClientInfo ? (
            <div className="py-8 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#27235C]" />
              <span>Loading configuration...</span>
            </div>
          ) : clientInfo ? (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2.5 font-mono">
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-sans font-semibold">FTP Username:</span>
                  <span className="font-bold text-slate-900 select-all">{clientInfo.username}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-sans font-semibold">FTP Server:</span>
                  <span className="font-bold text-slate-900 select-all">{clientInfo.server}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-sans font-semibold">FTP Port:</span>
                  <span className="font-bold text-indigo-700">{clientInfo.ftpPort}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-sans font-semibold">SFTP Port (SSH):</span>
                  <span className="font-bold text-slate-700">{clientInfo.sftpPort}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-sans font-semibold">Home Directory:</span>
                  <span className="font-bold text-slate-900">{clientInfo.directory}</span>
                </div>
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-indigo-900">FileZilla Quick Configuration Profile</div>
                  <div className="text-indigo-700 text-[11px]">Download XML profile for 1-click import in FileZilla (Site Manager).</div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => downloadFileZillaXml(clientInfo)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Download XML</span>
                </Button>
              </div>
            </div>
          ) : null}
          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={() => setClientModalAcct(null)}>Close</Button>
          </div>
        </Modal>
      )}

      {/* 5. Test Connection Modal */}
      {testModalAcct && (
        <Modal
          isOpen={true}
          onClose={() => setTestModalAcct(null)}
          title={`Test Connection — ${testModalAcct.username}`}
        >
          <div className="space-y-4">
            {testing ? (
              <div className="py-8 text-center text-slate-600">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
                <p className="font-medium text-sm">Probing FTP daemon on port {capabilities?.port || 21}...</p>
                <p className="text-xs text-slate-400 mt-1">Verifying socket handshake and directory status...</p>
              </div>
            ) : testResult ? (
              <div className="space-y-3">
                <div className={`p-4 rounded-lg border flex items-start space-x-3 ${testResult.connectionOk ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  {testResult.connectionOk ? (
                    <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h3 className={`font-bold text-sm ${testResult.connectionOk ? 'text-emerald-900' : 'text-red-900'}`}>
                      {testResult.connectionOk ? 'FTP Connection Successful' : 'FTP Connection Issue Detected'}
                    </h3>
                    <p className={`text-xs mt-1 ${testResult.connectionOk ? 'text-emerald-700' : 'text-red-700'}`}>
                      {testResult.connectionOk 
                        ? `The FTP daemon responded on port ${testResult.port} in ${testResult.latencyMs}ms. Account is enabled and directory is accessible.`
                        : (testResult.error || 'The server could not establish a connection to the FTP service.')}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Daemon Status:</span>
                    <span className="font-bold text-slate-800">{testResult.daemonRunning ? 'Running' : 'Offline'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Account Status:</span>
                    <span className="font-bold text-slate-800">{testResult.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Directory On Disk:</span>
                    <span className="font-bold text-slate-800">{testResult.directoryExists ? 'Verified' : 'Missing'}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={() => setTestModalAcct(null)}>Close</Button>
          </div>
        </Modal>
      )}

      {/* 6. Delete Account Confirmation Modal */}
      {deleteModalAcct && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteModalAcct(null)}
          title="Delete FTP Account"
        >
          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3 text-red-800 text-xs">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Are you sure you want to delete FTP account {deleteModalAcct.username}?</p>
                <p className="mt-1 text-red-700">
                  This will remove FTP login access. <strong className="font-bold underline">The physical directory (/{deleteModalAcct.directory}) and all files stored inside will NOT be deleted.</strong>
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="outline" onClick={() => setDeleteModalAcct(null)}>Cancel</Button>
            <Button variant="danger" disabled={deleting} onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting ? 'Deleting Account...' : 'Delete FTP Account'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
