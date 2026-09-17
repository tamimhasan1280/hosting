import React, { useState, useEffect, useMemo } from 'react';
import { 
  Folder, Lock, Unlock, Shield, ShieldCheck, ShieldAlert, Key, 
  User, UserPlus, Users, Trash2, RefreshCw, Search, ChevronRight, 
  AlertTriangle, Check, X, ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import Modal from '../components/ui/Modal';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';

export default function DirectoryPrivacy({ onOpenFileManager }) {
  const [directories, setDirectories] = useState([]);
  const [selectedDir, setSelectedDir] = useState('public_html');
  const [currentStatus, setCurrentStatus] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState(null);

  // Settings form state
  const [protectEnabled, setProtectEnabled] = useState(false);
  const [authName, setAuthName] = useState('Restricted Directory');
  const [savingProtection, setSavingProtection] = useState(false);
  const [showDangerousModal, setShowDangerousModal] = useState(false);

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  // Change password modal
  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [changePasswordVal, setChangePasswordVal] = useState('');
  const [confirmChangeVal, setConfirmChangeVal] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete user modal
  const [deleteModalUser, setDeleteModalUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === msg ? null : prev));
    }, 4500);
  };

  // Load all directories with status
  const loadDirectories = async () => {
    setLoadingList(true);
    try {
      const dirs = await api.getPrivacyDirectories();
      setDirectories(dirs || []);
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to list directories', 'error');
    } finally {
      setLoadingList(false);
    }
  };

  // Load detailed status for selected directory
  const loadStatus = async (dirPath) => {
    setLoadingStatus(true);
    try {
      const data = await api.getDirectoryPrivacyStatus(dirPath);
      setCurrentStatus(data);
      setProtectEnabled(data.isProtected);
      setAuthName(data.authName || 'Restricted Directory');
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to get directory status', 'error');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadDirectories();
  }, []);

  useEffect(() => {
    if (selectedDir) {
      loadStatus(selectedDir);
    }
  }, [selectedDir]);

  // Filter directories by search query
  const filteredDirectories = useMemo(() => {
    if (!searchQuery.trim()) return directories;
    const q = searchQuery.toLowerCase();
    return directories.filter(d => 
      d.name.toLowerCase().includes(q) || 
      d.relPath.toLowerCase().includes(q)
    );
  }, [directories, searchQuery]);

  // Handle Save Protection
  const handleSaveProtection = async (force = false) => {
    if (!selectedDir) return;

    // Check for dangerous directory confirmation (public_html or root)
    if (protectEnabled && (selectedDir === 'public_html' || selectedDir === '') && !force) {
      setShowDangerousModal(true);
      return;
    }

    setSavingProtection(true);
    try {
      await api.setDirectoryPrivacyProtection(selectedDir, protectEnabled, authName);
      showNotification(
        protectEnabled 
          ? `Protection enabled for "${selectedDir}" with realm "${authName}"` 
          : `Protection disabled for "${selectedDir}"`
      );
      setShowDangerousModal(false);
      await loadStatus(selectedDir);
      await loadDirectories();
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to update protection', 'error');
    } finally {
      setSavingProtection(false);
    }
  };

  // Handle Add User
  const handleAddUser = async (e) => {
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

    setAddingUser(true);
    try {
      await api.addPrivacyUser(selectedDir, newUsername.trim(), newPassword);
      showNotification(`Authorized user "${newUsername.trim()}" added successfully`);
      setNewUsername('');
      setNewPassword('');
      setConfirmPassword('');
      await loadStatus(selectedDir);
      await loadDirectories();
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to add user', 'error');
    } finally {
      setAddingUser(false);
    }
  };

  // Handle Change Password Submit
  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    if (changePasswordVal.length < 5) {
      showNotification('New password must be at least 5 characters', 'error');
      return;
    }
    if (changePasswordVal !== confirmChangeVal) {
      showNotification('Passwords do not match', 'error');
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePrivacyUserPassword(selectedDir, passwordModalUser, changePasswordVal);
      showNotification(`Password for "${passwordModalUser}" updated successfully`);
      setPasswordModalUser(null);
      setChangePasswordVal('');
      setConfirmChangeVal('');
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to change password', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  // Handle Delete User Submit
  const handleDeleteUserSubmit = async () => {
    if (!deleteModalUser) return;
    setDeletingUser(true);
    try {
      await api.deletePrivacyUser(selectedDir, deleteModalUser);
      showNotification(`User "${deleteModalUser}" removed from directory`);
      setDeleteModalUser(null);
      await loadStatus(selectedDir);
      await loadDirectories();
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to remove user', 'error');
    } finally {
      setDeletingUser(false);
    }
  };

  // Password strength helper
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { label: 'Empty', color: 'bg-gray-200', percent: 0 };
    if (pwd.length < 5) return { label: 'Too short', color: 'bg-red-500', percent: 25 };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: 'Weak', color: 'bg-amber-500', percent: 50 };
    if (score === 2) return { label: 'Good', color: 'bg-blue-500', percent: 75 };
    return { label: 'Strong', color: 'bg-emerald-500', percent: 100 };
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Top Banner Alert */}
      {notification && (
        <div className="fixed top-16 right-6 z-50 max-w-md shadow-lg animate-in fade-in slide-in-from-top-4">
          <Alert 
            variant={notification.type === 'error' ? 'error' : 'success'} 
            dismissible 
            onDismiss={() => setNotification(null)}
          >
            {notification.message}
          </Alert>
        </div>
      )}

      {/* Page Header Area */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b] mb-1">
              <span>Tools</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span>Files</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[#27235C]">Directory Privacy</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#ff6c2c]/10 text-[#ff6c2c] rounded-lg">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#0f172a] leading-tight">Directory Privacy</h1>
                <p className="text-xs text-[#64748b] mt-0.5">
                  Protect specific directories of your web hosting account with HTTP Basic Authentication passwords.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => { loadDirectories(); if (selectedDir) loadStatus(selectedDir); }}
              loading={loadingList}
              icon={RefreshCw}
            >
              Refresh
            </Button>
            {onOpenFileManager && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onOpenFileManager}
                icon={ExternalLink}
              >
                File Manager
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Split Layout: Directory Browser (Left) + Privacy Settings (Right) */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Left Panel: Directory Browser */}
        <div className="w-full md:w-80 lg:w-96 bg-white border-r border-[#e2e8f0] flex flex-col shrink-0">
          {/* Search Box */}
          <div className="p-4 border-b border-[#f1f5f9]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Filter directories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-md pl-9 pr-3 py-1.5 text-xs text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/20 focus:border-[#ff6c2c]"
              />
            </div>
          </div>

          {/* Directory Tree List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#f8fafc]">
            {loadingList ? (
              <div className="p-8 text-center text-xs text-[#64748b]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#ff6c2c]" />
                Loading directories...
              </div>
            ) : filteredDirectories.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#94a3b8]">
                No directories found.
              </div>
            ) : (
              filteredDirectories.map((dir) => {
                const isSelected = selectedDir === dir.relPath;
                return (
                  <button
                    key={dir.relPath}
                    onClick={() => setSelectedDir(dir.relPath)}
                    className={`w-full text-left p-3.5 flex items-center justify-between transition-colors ${
                      isSelected 
                        ? 'bg-[#ff6c2c]/10 border-l-4 border-[#ff6c2c]' 
                        : 'hover:bg-[#f8fafc] border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-md shrink-0 ${dir.isProtected ? 'bg-emerald-100 text-emerald-700' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
                        {dir.isProtected ? <Lock className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#0f172a] truncate flex items-center gap-1.5">
                          <span>{dir.name}</span>
                          {dir.isDocumentRoot && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.2 rounded">
                              Root
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#64748b] truncate mt-0.5">
                          /{dir.relPath}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end">
                      {dir.isProtected ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                          Protected
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-medium">
                          Public
                        </span>
                      )}
                      {dir.userCount > 0 && (
                        <span className="text-[10px] text-[#64748b] mt-1">
                          {dir.userCount} {dir.userCount === 1 ? 'user' : 'users'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Protection & User Management */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingStatus ? (
            <div className="flex flex-col items-center justify-center h-64 text-xs text-[#64748b]">
              <RefreshCw className="w-6 h-6 animate-spin text-[#ff6c2c] mb-2" />
              Loading directory configuration...
            </div>
          ) : currentStatus ? (
            <div className="max-w-3xl space-y-6">
              {/* Directory Context Header Card */}
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                      Selected Directory
                    </span>
                    <h2 className="text-base font-bold text-[#0f172a] flex items-center gap-2 mt-0.5 font-mono">
                      <span>/{selectedDir}</span>
                      {selectedDir === 'public_html' && (
                        <span className="text-xs font-sans bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
                          Primary Document Root
                        </span>
                      )}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentStatus.isProtected ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Protected by HTTP Basic Auth</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-semibold">
                        <Unlock className="w-3.5 h-3.5 text-gray-500" />
                        <span>Publicly Accessible</span>
                      </div>
                    )}
                  </div>
                </div>

                {currentStatus.hasOtherRules && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <strong>Existing .htaccess detected:</strong> This folder contains existing application rules (e.g. WordPress or URL rewrites). Directory Privacy will safely manage its own authentication block without touching any of your other directives.
                    </div>
                  </div>
                )}
              </div>

              {/* Security Settings Form Card */}
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-xs">
                <h3 className="text-sm font-bold text-[#0f172a] mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#ff6c2c]" />
                  <span>Security Settings</span>
                </h3>

                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
                    <input
                      type="checkbox"
                      id="enableProtectionToggle"
                      checked={protectEnabled}
                      onChange={(e) => setProtectEnabled(e.target.checked)}
                      className="mt-0.5 rounded border-[#cbd5e1] text-[#ff6c2c] focus:ring-[#ff6c2c] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <label htmlFor="enableProtectionToggle" className="text-xs font-bold text-[#0f172a] cursor-pointer">
                        Password protect this directory
                      </label>
                      <p className="text-[11px] text-[#64748b] mt-0.5 leading-relaxed">
                        Visitors opening this directory through your website will be prompted for a username and password before being granted access.
                      </p>
                    </div>
                  </div>

                  {protectEnabled && (
                    <div className="space-y-1.5 animate-in fade-in">
                      <label className="block text-xs font-bold text-[#334155]">
                        Name of Protected Directory (Auth Realm Prompt)
                      </label>
                      <input
                        type="text"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="e.g. Restricted Area, Admin Zone"
                        className="w-full bg-white border border-[#cbd5e1] rounded-md px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/30 focus:border-[#ff6c2c]"
                      />
                      <p className="text-[11px] text-[#64748b]">
                        This label is displayed in the visitor's browser authentication challenge dialogue box.
                      </p>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleSaveProtection(false)}
                      loading={savingProtection}
                    >
                      Save Protection Settings
                    </Button>
                  </div>
                </div>
              </div>

              {/* Authorized Users Card */}
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-xs">
                <h3 className="text-sm font-bold text-[#0f172a] mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#ff6c2c]" />
                    <span>Authorized Users ({currentStatus.users.length})</span>
                  </div>
                </h3>

                {/* Users Table */}
                {currentStatus.users.length === 0 ? (
                  <div className="p-6 bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded-lg text-center mb-6">
                    <User className="w-8 h-8 text-[#94a3b8] mx-auto mb-2" />
                    <p className="text-xs font-semibold text-[#0f172a] mb-1">No Authorized Users</p>
                    <p className="text-[11px] text-[#64748b]">
                      Create a user below to allow access to this directory once protection is active.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden border border-[#e2e8f0] rounded-lg mb-6">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#64748b] font-semibold">
                        <tr>
                          <th className="py-2.5 px-4">Authorized Username</th>
                          <th className="py-2.5 px-4">Authentication Type</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f5f9]">
                        {currentStatus.users.map((username) => (
                          <tr key={username} className="hover:bg-[#f8fafc] transition-colors">
                            <td className="py-2.5 px-4 font-bold text-[#0f172a] flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-[#ff6c2c]" />
                              <span>{username}</span>
                            </td>
                            <td className="py-2.5 px-4 text-[#64748b]">
                              <span className="px-2 py-0.5 bg-[#f1f5f9] rounded text-[10px] font-mono text-[#334155]">
                                bcrypt ($2b$)
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => setPasswordModalUser(username)}
                                  icon={Key}
                                >
                                  Change Password
                                </Button>
                                <Button
                                  variant="danger"
                                  size="xs"
                                  onClick={() => setDeleteModalUser(username)}
                                  icon={Trash2}
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Create An Authorized User Form */}
                <div className="pt-4 border-t border-[#f1f5f9]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#334155] mb-3 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-[#ff6c2c]" />
                    <span>Create An Authorized User</span>
                  </h4>

                  <form onSubmit={handleAddUser} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#475569] mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          required
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="e.g. member, admin"
                          className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-md px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/30 focus:border-[#ff6c2c]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#475569] mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/30 focus:border-[#ff6c2c]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#475569] mb-1">
                          Confirm Password
                        </label>
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/30 focus:border-[#ff6c2c]"
                        />
                      </div>
                    </div>

                    {/* Password Strength Indicator */}
                    {newPassword && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="w-32 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full transition-all ${strength.color}`} style={{ width: `${strength.percent}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-[#64748b]">
                          Strength: {strength.label}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 flex justify-end">
                      <Button
                        variant="primary"
                        size="sm"
                        type="submit"
                        loading={addingUser}
                        icon={UserPlus}
                      >
                        Add User
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[#64748b]">
              Select a directory from the left panel to configure its privacy settings.
            </div>
          )}
        </div>
      </div>

      {/* --- DANGEROUS DIRECTORY CONFIRMATION MODAL --- */}
      {showDangerousModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowDangerousModal(false)}
          title="Important: Protecting Website Root"
          size="sm"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setShowDangerousModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => handleSaveProtection(true)} loading={savingProtection}>
                Yes, Protect Document Root
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold mb-1">Warning: Entire Website Access Restricted</strong>
                Protecting <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">public_html</code> will require HTTP authentication for every visitor accessing your domain's homepage and all subpages.
              </div>
            </div>
            <p className="text-xs text-[#475569]">
              Are you sure you want to require password authentication for the primary document root?
            </p>
          </div>
        </Modal>
      )}

      {/* --- CHANGE PASSWORD MODAL --- */}
      {passwordModalUser && (
        <Modal
          isOpen={true}
          onClose={() => !changingPassword && setPasswordModalUser(null)}
          title={`Change Password for "${passwordModalUser}"`}
          size="sm"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setPasswordModalUser(null)} disabled={changingPassword}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleChangePasswordSubmit} loading={changingPassword}>
                Update Password
              </Button>
            </div>
          }
        >
          <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={changePasswordVal}
                onChange={(e) => setChangePasswordVal(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/30 focus:border-[#ff6c2c]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmChangeVal}
                onChange={(e) => setConfirmChangeVal(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/30 focus:border-[#ff6c2c]"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* --- DELETE USER MODAL --- */}
      {deleteModalUser && (
        <Modal
          isOpen={true}
          onClose={() => !deletingUser && setDeleteModalUser(null)}
          title="Confirm Delete User"
          size="sm"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setDeleteModalUser(null)} disabled={deletingUser}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleDeleteUserSubmit} loading={deletingUser}>
                Delete User
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-xs">
            <p className="text-[#475569]">
              Are you sure you want to remove authorized user <strong className="text-[#0f172a]">"{deleteModalUser}"</strong> from <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">/{selectedDir}</code>?
            </p>
            {currentStatus?.users.length === 1 && currentStatus?.isProtected && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <strong>Warning:</strong> This is the last remaining user for this protected folder. Removing them will prevent anyone from logging in until another user is added.
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
