import React, { useState, useEffect, useMemo } from 'react';
import { 
  HardDrive, Folder, Key, Trash2, RefreshCw, Search, Plus, 
  ExternalLink, Copy, Check, X, AlertTriangle, CheckCircle, 
  Wifi, Shield, Lock, Laptop, Terminal, Smartphone, HelpCircle, Eye, EyeOff
} from 'lucide-react';
import { api } from '../services/api';
import Modal from '../components/ui/Modal';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';

export default function WebDisk({ onOpenFileManager }) {
  const [accounts, setAccounts] = useState([]);
  const [statusInfo, setStatusInfo] = useState(null);
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // OS Instructions tab: 'windows' | 'mac' | 'linux' | 'mobile'
  const [osTab, setOsTab] = useState('windows');

  // Modals state
  const [createModal, setCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDirectory, setNewDirectory] = useState('');
  const [newPermissions, setNewPermissions] = useState('read-write');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  // Change Password Modal
  const [passwordModalAcct, setPasswordModalAcct] = useState(null);
  const [editPassword, setEditPassword] = useState('');
  const [editConfirm, setEditConfirm] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete Modal
  const [deleteModalAcct, setDeleteModalAcct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Test Connection Modal
  const [testModalAcct, setTestModalAcct] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

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
      showNotification('Clipboard access unavailable in browser', 'error');
    }
  };

  // Load accounts, status, and directory list
  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [acctRes, statRes, dirRes] = await Promise.all([
        api.getWebDiskAccounts(),
        api.getWebDiskStatus(),
        api.getWebDiskDirectories()
      ]);

      if (acctRes?.success) {
        setAccounts(acctRes.accounts || []);
      }
      if (statRes?.success) {
        setStatusInfo(statRes);
      }
      if (dirRes?.success) {
        setDirectories(dirRes.directories || []);
      }

      if (isRefresh) {
        showNotification('Web Disk accounts refreshed.', 'success');
      }
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to load Web Disk data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  // Password strength calculator
  const calculateStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'None', color: 'bg-slate-200' };
    let s = 0;
    if (pwd.length >= 6) s += 25;
    if (pwd.length >= 10) s += 25;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s += 25;
    if (/[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) s += 25;
    if (s <= 25) return { score: 25, label: 'Weak', color: 'bg-red-500' };
    if (s <= 50) return { score: 50, label: 'Fair', color: 'bg-amber-500' };
    if (s <= 75) return { score: 75, label: 'Good', color: 'bg-blue-500' };
    return { score: 100, label: 'Strong', color: 'bg-emerald-500' };
  };

  // Create Account handler
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      showNotification('Username is required', 'error');
      return;
    }
    if (newPassword.length < 5) {
      showNotification('Password must be at least 5 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification('Passwords do not match', 'error');
      return;
    }

    setCreating(true);
    try {
      const res = await api.createWebDiskAccount({
        username: newUsername.trim(),
        password: newPassword,
        directory: newDirectory,
        permissions: newPermissions
      });
      if (res.success) {
        showNotification(`Web Disk account '${newUsername}' created successfully.`, 'success');
        setCreateModal(false);
        setNewUsername('');
        setNewPassword('');
        setConfirmPassword('');
        setNewDirectory('');
        setNewPermissions('read-write');
        loadData(false);
      }
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to create Web Disk account', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Change Password handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (editPassword.length < 5) {
      showNotification('Password must be at least 5 characters', 'error');
      return;
    }
    if (editPassword !== editConfirm) {
      showNotification('Passwords do not match', 'error');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await api.changeWebDiskPassword({
        accountId: passwordModalAcct.id,
        newPassword: editPassword
      });
      if (res.success) {
        showNotification('Password updated successfully', 'success');
        setPasswordModalAcct(null);
        setEditPassword('');
        setEditConfirm('');
      }
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to update password', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  // Toggle Status handler (Enable / Disable)
  const handleToggle = async (account) => {
    const nextState = account.status !== 'enabled';
    try {
      const res = await api.toggleWebDiskStatus({
        accountId: account.id,
        enabled: nextState
      });
      if (res.success) {
        setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, status: res.status } : a));
        showNotification(`Account '${account.username}' is now ${res.status}.`, 'success');
      }
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to toggle account status', 'error');
    }
  };

  // Delete Account handler
  const handleDelete = async () => {
    if (!deleteModalAcct) return;
    setDeleting(true);
    try {
      const res = await api.deleteWebDiskAccount({ accountId: deleteModalAcct.id });
      if (res.success) {
        showNotification(res.message || 'Web Disk account removed successfully', 'success');
        setDeleteModalAcct(null);
        loadData(false);
      }
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to delete Web Disk account', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Test Connection handler
  const handleTestConnection = async (account) => {
    setTestModalAcct(account);
    setTestResult(null);
    setTesting(true);

    try {
      const res = await api.testWebDiskConnection({ accountId: account.id });
      setTestResult(res);
    } catch (err) {
      setTestResult({
        success: false,
        error: err.response?.data?.error || err.message || 'Connection test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  // Filter accounts by search query
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;
    const q = searchQuery.toLowerCase().trim();
    return accounts.filter(a => 
      a.username.toLowerCase().includes(q) || 
      (a.directory && a.directory.toLowerCase().includes(q))
    );
  }, [accounts, searchQuery]);

  const webdavUrl = statusInfo?.endpoint || `http://${window.location.host}/webdav`;

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-fade-in">
          <Alert variant={notification.type} onClose={() => setNotification(null)}>
            {notification.message}
          </Alert>
        </div>
      )}

      {/* Header & Breadcrumb */}
      <div className="bg-white border-b border-slate-200 -mx-6 -mt-6 px-6 py-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center text-xs text-slate-500 mb-1 space-x-2">
              <span className="hover:text-slate-700 cursor-pointer" onClick={() => onOpenFileManager && onOpenFileManager('')}>Home</span>
              <span>/</span>
              <span className="hover:text-slate-700 cursor-pointer" onClick={() => onOpenFileManager && onOpenFileManager('')}>Files</span>
              <span>/</span>
              <span className="text-slate-800 font-medium">Web Disk</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-[#27235C] flex items-center justify-center border border-indigo-100 shadow-sm">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Web Disk</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Access and manage your website files remotely over WebDAV like a local drive.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenFileManager && onOpenFileManager('')}
              className="flex items-center space-x-2 text-slate-700 border-slate-300 hover:bg-slate-50"
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
      </div>

      {/* WebDAV Status & Connection Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">WebDAV Server Endpoint</h2>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-semibold flex items-center space-x-1">
              <CheckCircle className="w-3 h-3" />
              <span>Service Active</span>
            </span>
          </div>
          <span className="text-xs text-slate-500">RFC 4918 WebDAV Compliant</span>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500 mb-1">Web Disk Connection URL</div>
              <div className="font-mono text-sm text-slate-900 bg-white px-3 py-1.5 rounded border border-slate-200 select-all">
                {webdavUrl}
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(webdavUrl, 'url')}
                className="flex items-center space-x-1.5 text-xs text-slate-700 bg-white"
              >
                {copiedField === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copiedField === 'url' ? 'Copied URL!' : 'Copy URL'}</span>
              </Button>
            </div>
          </div>

          {/* OS Connection Instructions Accordion / Tabs */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100/70 px-4 py-2 border-b border-slate-200 flex items-center space-x-2 text-xs font-medium text-slate-600">
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>Connect From Your Computer:</span>
              <div className="flex space-x-1 ml-auto">
                <button
                  onClick={() => setOsTab('windows')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${osTab === 'windows' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Windows
                </button>
                <button
                  onClick={() => setOsTab('mac')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${osTab === 'mac' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  macOS
                </button>
                <button
                  onClick={() => setOsTab('linux')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${osTab === 'linux' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Linux
                </button>
              </div>
            </div>

            <div className="p-4 bg-white text-xs text-slate-600 leading-relaxed">
              {osTab === 'windows' && (
                <div className="space-y-1.5">
                  <p><strong>Windows 10 / 11 Setup:</strong></p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Open <strong>File Explorer</strong> and click <strong>This PC</strong>.</li>
                    <li>Click the <strong>...</strong> (or Computer tab) and choose <strong>Add a network location</strong>.</li>
                    <li>Enter Web Disk URL: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-indigo-700">{webdavUrl}</code></li>
                    <li>When prompted, enter your Web Disk <strong>Username</strong> and <strong>Password</strong>.</li>
                  </ol>
                </div>
              )}
              {osTab === 'mac' && (
                <div className="space-y-1.5">
                  <p><strong>macOS Finder Setup:</strong></p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>In <strong>Finder</strong>, press <kbd className="bg-slate-100 px-1 rounded">⌘K</kbd> (or select <strong>Go &gt; Connect to Server</strong>).</li>
                    <li>Enter Server Address: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-indigo-700">{webdavUrl}</code></li>
                    <li>Click <strong>Connect</strong> and enter your Web Disk credentials when requested.</li>
                  </ol>
                </div>
              )}
              {osTab === 'linux' && (
                <div className="space-y-1.5">
                  <p><strong>Linux (GNOME Files / Nautilus / Dolphin):</strong></p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Open File Manager and click <strong>Other Locations</strong> &gt; <strong>Connect to Server</strong>.</li>
                    <li>Enter URL: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-indigo-700">{webdavUrl.replace(/^http/, 'dav')}</code></li>
                    <li>Or mount via command line with <code>davfs2</code>: <code className="bg-slate-100 px-1 rounded font-mono">sudo mount -t davfs {webdavUrl} /mnt/webdisk</code></li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Web Disk Accounts Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Card Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Web Disk accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 focus:bg-white transition-all"
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

          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCreateModal(true)}
              className="flex items-center space-x-1.5 bg-[#27235C] hover:bg-[#1b183f] text-white"
            >
              <Plus className="w-4 h-4" />
              <span>Create Web Disk Account</span>
            </Button>
          </div>
        </div>

        {/* Accounts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4 w-3/12">Web Disk Login</th>
                <th className="py-3 px-4 w-3/12">Directory Scope</th>
                <th className="py-3 px-4 w-2/12">Permissions</th>
                <th className="py-3 px-4 w-2/12">Status</th>
                <th className="py-3 px-4 w-2/12 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#27235C] mx-auto mb-2" />
                    <span>Loading Web Disk accounts...</span>
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <HardDrive className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-base font-medium text-slate-700">No Web Disk accounts found</p>
                    <p className="text-xs text-slate-400 mt-1">Create an account to connect your computer remotely</p>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(acct => (
                  <tr key={acct.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-[#27235C] flex items-center justify-center font-bold text-xs">
                          {acct.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{acct.username}</div>
                          <div className="text-xs text-slate-400">Created: {new Date(acct.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div 
                        className="flex items-center space-x-1.5 text-slate-700 hover:text-indigo-600 cursor-pointer group"
                        onClick={() => onOpenFileManager && onOpenFileManager(acct.directory === '/' ? '' : acct.directory)}
                        title="Click to open this directory in File Manager"
                      >
                        <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="font-mono text-xs underline decoration-dotted underline-offset-2">
                          {acct.displayDirectory || `/${acct.directory}`}
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {acct.permissions === 'read-write' ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold">
                          Read-Write
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs font-semibold">
                          Read-Only
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggle(acct)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                          acct.status === 'enabled' 
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                        title={`Click to ${acct.status === 'enabled' ? 'disable' : 'enable'}`}
                      >
                        <span className={`w-2 h-2 rounded-full mr-1.5 ${acct.status === 'enabled' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span>{acct.status === 'enabled' ? 'Enabled' : 'Disabled'}</span>
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestConnection(acct)}
                          className="text-slate-600 hover:text-indigo-600 p-1.5"
                          title="Test Connection"
                        >
                          <Wifi className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPasswordModalAcct(acct)}
                          className="text-slate-600 hover:text-indigo-600 p-1.5"
                          title="Change Password"
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteModalAcct(acct)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5"
                          title="Delete Web Disk Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Create Account Modal */}
      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Create Web Disk Account"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="e.g. webuser"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-slate-400 mt-1">3-32 letters, numbers, dashes, underscores</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Directory Scope
            </label>
            <select
              value={newDirectory}
              onChange={(e) => setNewDirectory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono text-xs"
            >
              {directories.map(d => (
                <option key={d.path} value={d.path}>
                  {d.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">WebDAV user cannot navigate above this directory</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Permissions
            </label>
            <div className="flex items-center space-x-4 text-xs font-medium text-slate-700 mt-1">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="perm"
                  value="read-write"
                  checked={newPermissions === 'read-write'}
                  onChange={() => setNewPermissions('read-write')}
                  className="text-indigo-600"
                />
                <span>Read-Write (Full Access)</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="perm"
                  value="read-only"
                  checked={newPermissions === 'read-only'}
                  onChange={() => setNewPermissions('read-only')}
                  className="text-indigo-600"
                />
                <span>Read-Only (View &amp; Download)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 5 characters"
                required
                className="w-full pl-3 pr-9 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && (
              <div className="mt-1.5 flex items-center space-x-2">
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full ${calculateStrength(newPassword).color} transition-all`} style={{ width: `${calculateStrength(newPassword).score}%` }} />
                </div>
                <span className="text-xs font-medium text-slate-500">{calculateStrength(newPassword).label}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setCreateModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={creating} className="bg-[#27235C] text-white">
              {creating ? 'Creating...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. Change Password Modal */}
      <Modal
        isOpen={!!passwordModalAcct}
        onClose={() => setPasswordModalAcct(null)}
        title={`Change Password for "${passwordModalAcct?.username}"`}
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Min 5 characters"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {editPassword && (
              <div className="mt-1.5 flex items-center space-x-2">
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full ${calculateStrength(editPassword).color} transition-all`} style={{ width: `${calculateStrength(editPassword).score}%` }} />
                </div>
                <span className="text-xs font-medium text-slate-500">{calculateStrength(editPassword).label}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={editConfirm}
              onChange={(e) => setEditConfirm(e.target.value)}
              placeholder="Re-enter new password"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setPasswordModalAcct(null)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={changingPassword} className="bg-[#27235C] text-white">
              {changingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. Delete Account Modal */}
      <Modal
        isOpen={!!deleteModalAcct}
        onClose={() => setDeleteModalAcct(null)}
        title="Delete Web Disk Account"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3 text-sm text-red-800">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Are you sure you want to delete the Web Disk account "{deleteModalAcct?.username}"?</p>
              <p className="text-xs text-red-700 mt-2">
                <strong>Reassurance:</strong> This action will revoke remote WebDAV credentials, but will <strong>NEVER delete any files or directories</strong> in <code>/{deleteModalAcct?.directory || ''}</code>.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setDeleteModalAcct(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Web Disk Account'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 4. Test Connection Modal */}
      <Modal
        isOpen={!!testModalAcct}
        onClose={() => setTestModalAcct(null)}
        title={`Connection Test: ${testModalAcct?.username}`}
      >
        <div className="space-y-4 text-sm">
          {testing ? (
            <div className="py-8 text-center space-y-3">
              <Wifi className="w-8 h-8 text-[#27235C] animate-pulse mx-auto" />
              <p className="text-slate-700 font-medium">Testing WebDAV endpoint connectivity...</p>
              <p className="text-xs text-slate-400">Verifying port, directory scope and service status</p>
            </div>
          ) : testResult ? (
            <div className="space-y-3">
              <div className={`p-4 rounded-lg border flex items-center space-x-3 ${
                testResult.connectionOk ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {testResult.connectionOk ? (
                  <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                )}
                <div>
                  <div className="font-bold">
                    {testResult.connectionOk ? 'WebDAV Connection Verified' : 'Connection Test Failed'}
                  </div>
                  <div className="text-xs mt-0.5">
                    {testResult.connectionOk 
                      ? 'The server endpoint is active and directory scope is ready for remote access.' 
                      : (testResult.error || 'Account is disabled or target directory is missing.')}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1.5 font-mono text-slate-700">
                <div>Endpoint: <span className="font-semibold">{testResult.webdavEndpoint}</span></div>
                <div>Account: <span className="font-semibold">{testResult.account}</span></div>
                <div>Status: <span className="font-semibold">{testResult.status}</span></div>
                <div>Directory Exists: <span className="font-semibold">{testResult.directoryExists ? 'Yes' : 'No'}</span></div>
                <div>Ping Latency: <span className="font-semibold">{testResult.latencyMs} ms</span></div>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button variant="primary" onClick={() => setTestModalAcct(null)} className="bg-[#27235C] text-white">
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
