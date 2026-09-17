import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { 
  Database, UserPlus, Key, Trash2, CheckCircle2, AlertCircle, 
  RefreshCw, Plus, Settings, Server, Check, X, ExternalLink,
  Shield, Wrench, Search, Eye, EyeOff, Sparkles, Copy, ChevronDown, ChevronUp, Lock
} from 'lucide-react';

const ALL_PRIVILEGES_LIST = [
  'ALTER',
  'ALTER ROUTINE',
  'CREATE',
  'CREATE ROUTINE',
  'CREATE TEMPORARY TABLES',
  'CREATE VIEW',
  'DELETE',
  'DROP',
  'EVENT',
  'EXECUTE',
  'INDEX',
  'INSERT',
  'LOCK TABLES',
  'REFERENCES',
  'SELECT',
  'SHOW VIEW',
  'TRIGGER',
  'UPDATE'
];

export default function DatabaseManager({ initialJumpDb, onNavigate }) {
  const [data, setData] = useState({ databases: [], users: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [serverStatus, setServerStatus] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Search & Filter
  const [dbSearch, setDbSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Create DB Form
  const [newDbName, setNewDbName] = useState('');
  const [showAdvancedCharset, setShowAdvancedCharset] = useState(false);
  const [selectedCharset, setSelectedCharset] = useState('utf8mb4');
  const [selectedCollation, setSelectedCollation] = useState('utf8mb4_unicode_ci');
  const [creatingDb, setCreatingDb] = useState(false);

  // Check / Repair DB
  const [checkDbTarget, setCheckDbTarget] = useState('');
  const [repairDbTarget, setRepairDbTarget] = useState('');
  const [runningMaintenance, setRunningMaintenance] = useState(false);
  const [maintenanceResult, setMaintenanceResult] = useState(null);

  // Create User Form
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  // Assign User to DB
  const [assignUser, setAssignUser] = useState('');
  const [assignDb, setAssignDb] = useState('');

  // Modals
  const [privilegeModal, setPrivilegeModal] = useState(null); // { user, database, privileges: [] }
  const [savingPrivileges, setSavingPrivileges] = useState(false);
  
  const [deleteDbModal, setDeleteDbModal] = useState(null); // dbName
  const [deletingDb, setDeletingDb] = useState(false);

  const [deleteUserModal, setDeleteUserModal] = useState(null); // username
  const [deletingUser, setDeletingUser] = useState(false);

  const [changePasswordModal, setChangePasswordModal] = useState(null); // username
  const [newPassVal, setNewPassVal] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const [passwordGenModal, setPasswordGenModal] = useState(null); // 'create' | 'change'
  const [genPassLength, setGenPassLength] = useState(16);
  const [generatedPassword, setGeneratedPassword] = useState('');

  // MariaDB Settings Modal
  const [configModal, setConfigModal] = useState(false);
  const [dbHost, setDbHost] = useState('127.0.0.1');
  const [dbPort, setDbPort] = useState('3306');
  const [dbUser, setDbUser] = useState('root');
  const [dbPassword, setDbPassword] = useState('');
  const [testingConfig, setTestingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState(null);

  const activeUser = localStorage.getItem('cpanel_active_user') || 'cpanel_user';
  const dbPrefix = `${activeUser}_`;

  const showSuccess = (msg) => {
    setStatusMsg(msg);
    setErrorMsg('');
    setTimeout(() => setStatusMsg(''), 4000);
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 6000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [dbData, status] = await Promise.all([
        api.getDatabases(),
        api.getDatabaseServerStatus()
      ]);
      setData(dbData);
      setServerStatus(status);
      if (status) {
        setDbHost(status.host || '127.0.0.1');
        setDbPort(String(status.port || 3306));
        setDbUser(status.user || 'root');
      }
      if (dbData.databases?.length > 0) {
        if (!checkDbTarget) setCheckDbTarget(dbData.databases[0].name);
        if (!repairDbTarget) setRepairDbTarget(dbData.databases[0].name);
        if (!assignDb) setAssignDb(dbData.databases[0].name);
      }
      if (dbData.users?.length > 0) {
        if (!assignUser) setAssignUser(dbData.users[0].username);
      }
    } catch (err) {
      showError('Error loading databases: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered lists
  const filteredDatabases = useMemo(() => {
    if (!dbSearch.trim()) return data.databases || [];
    const q = dbSearch.toLowerCase();
    return (data.databases || []).filter(d => 
      d.name.toLowerCase().includes(q) || 
      (d.users || []).some(u => u.toLowerCase().includes(q))
    );
  }, [data.databases, dbSearch]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return data.users || [];
    const q = userSearch.toLowerCase();
    return (data.users || []).filter(u => 
      u.username.toLowerCase().includes(q) || 
      (u.databases || []).some(d => d.toLowerCase().includes(q))
    );
  }, [data.users, userSearch]);

  // Password Generator
  const generateSecurePassword = (len = 16) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    let res = '';
    const array = new Uint32Array(len);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < len; i++) {
      res += chars[array[i] % chars.length];
    }
    return res;
  };

  const openPasswordGenerator = (target) => {
    setPasswordGenModal(target);
    setGeneratedPassword(generateSecurePassword(genPassLength));
  };

  const applyGeneratedPassword = () => {
    if (passwordGenModal === 'create') {
      setNewUserPassword(generatedPassword);
    } else if (passwordGenModal === 'change') {
      setNewPassVal(generatedPassword);
    }
    setPasswordGenModal(null);
    showSuccess('Generated password applied!');
  };

  const calculatePasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: 'None', color: 'bg-slate-200' };
    let score = 0;
    if (pass.length >= 8) score += 25;
    if (pass.length >= 12) score += 15;
    if (/[A-Z]/.test(pass)) score += 20;
    if (/[0-9]/.test(pass)) score += 20;
    if (/[^A-Za-z0-9]/.test(pass)) score += 20;
    
    if (score < 40) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score < 70) return { score, label: 'Medium', color: 'bg-amber-500' };
    return { score, label: 'Strong', color: 'bg-emerald-500' };
  };

  // Jump into phpMyAdmin
  const handleJumpPhpMyAdmin = async (dbName) => {
    try {
      const res = await api.createPhpMyAdminSession(dbName);
      showSuccess(`phpMyAdmin SSO Active (${res.token}) for "${dbName}"`);
      if (onNavigate) {
        onNavigate('phpmyadmin', { jump: 'phpmyadmin', db: dbName, token: res.token });
      } else {
        window.location.search = `?jump=phpmyadmin&db=${encodeURIComponent(dbName)}&token=${res.token}`;
      }
    } catch (err) {
      showError('phpMyAdmin SSO error: ' + err.message);
    }
  };

  // Create Database
  const handleCreateDatabase = async (e) => {
    e.preventDefault();
    if (!newDbName.trim()) return;
    setCreatingDb(true);
    try {
      await api.createDatabase({
        name: newDbName.trim(),
        charset: selectedCharset,
        collation: selectedCollation
      });
      setNewDbName('');
      showSuccess(`Database "${dbPrefix}${newDbName.trim()}" created successfully!`);
      await loadData();
    } catch (err) {
      showError(err.message);
    } finally {
      setCreatingDb(false);
    }
  };

  // Delete Database
  const confirmDeleteDatabase = async () => {
    if (!deleteDbModal) return;
    setDeletingDb(true);
    try {
      await api.deleteDatabase(deleteDbModal);
      showSuccess(`Database "${deleteDbModal}" permanently deleted.`);
      setDeleteDbModal(null);
      await loadData();
    } catch (err) {
      showError(err.message);
    } finally {
      setDeletingDb(false);
    }
  };

  // Check Database
  const handleCheckDatabase = async (target) => {
    const dbToTest = target || checkDbTarget;
    if (!dbToTest) return;
    setRunningMaintenance(true);
    try {
      const res = await api.checkDatabase(dbToTest);
      setMaintenanceResult({
        title: `Database Check: ${dbToTest}`,
        type: 'check',
        database: dbToTest,
        tablesCount: res.tablesChecked,
        status: res.status,
        details: res.details,
        timestamp: res.timestamp
      });
    } catch (err) {
      showError('Check database failed: ' + err.message);
    } finally {
      setRunningMaintenance(false);
    }
  };

  // Repair Database
  const handleRepairDatabase = async (target) => {
    const dbToTest = target || repairDbTarget;
    if (!dbToTest) return;
    setRunningMaintenance(true);
    try {
      const res = await api.repairDatabase(dbToTest);
      setMaintenanceResult({
        title: `Database Repair: ${dbToTest}`,
        type: 'repair',
        database: dbToTest,
        tablesCount: res.tablesRepaired,
        status: res.status,
        details: res.details,
        timestamp: res.timestamp
      });
    } catch (err) {
      showError('Repair database failed: ' + err.message);
    } finally {
      setRunningMaintenance(false);
    }
  };

  // Create User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newUserPassword) return;
    setCreatingUser(true);
    try {
      await api.createUser(newUsername.trim(), newUserPassword);
      setNewUsername('');
      setNewUserPassword('');
      showSuccess(`Database user "${dbPrefix}${newUsername.trim()}" created successfully!`);
      await loadData();
    } catch (err) {
      showError(err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  // Delete User
  const confirmDeleteUser = async () => {
    if (!deleteUserModal) return;
    setDeletingUser(true);
    try {
      await api.deleteDatabaseUser(deleteUserModal);
      showSuccess(`Database user "${deleteUserModal}" deleted successfully.`);
      setDeleteUserModal(null);
      await loadData();
    } catch (err) {
      showError(err.message);
    } finally {
      setDeletingUser(false);
    }
  };

  // Change Password
  const confirmChangePassword = async (e) => {
    e.preventDefault();
    if (!changePasswordModal || !newPassVal) return;
    setChangingPass(true);
    try {
      await api.changeDatabaseUserPassword(changePasswordModal, newPassVal);
      showSuccess(`Password changed for database user "${changePasswordModal}".`);
      setChangePasswordModal(null);
      setNewPassVal('');
    } catch (err) {
      showError(err.message);
    } finally {
      setChangingPass(false);
    }
  };

  // Open Privilege Modal for Assign or Edit
  const openPrivilegesModal = async (username, dbName) => {
    try {
      const res = await api.getDatabasePrivileges(username, dbName);
      setPrivilegeModal({
        username,
        database: dbName,
        privileges: res.privileges || ['ALL PRIVILEGES']
      });
    } catch (err) {
      // Default fallback
      setPrivilegeModal({
        username,
        database: dbName,
        privileges: ['ALL PRIVILEGES']
      });
    }
  };

  const handleStartAssignUser = (e) => {
    e.preventDefault();
    if (!assignUser || !assignDb) {
      showError('Please select both a User and a Database');
      return;
    }
    openPrivilegesModal(assignUser, assignDb);
  };

  const togglePrivilege = (priv) => {
    if (!privilegeModal) return;
    let curr = [...privilegeModal.privileges];
    if (priv === 'ALL PRIVILEGES') {
      if (curr.includes('ALL PRIVILEGES')) {
        curr = [];
      } else {
        curr = ['ALL PRIVILEGES', ...ALL_PRIVILEGES_LIST];
      }
    } else {
      curr = curr.filter(p => p !== 'ALL PRIVILEGES');
      if (curr.includes(priv)) {
        curr = curr.filter(p => p !== priv);
      } else {
        curr.push(priv);
      }
      if (ALL_PRIVILEGES_LIST.every(p => curr.includes(p))) {
        curr = ['ALL PRIVILEGES', ...ALL_PRIVILEGES_LIST];
      }
    }
    setPrivilegeModal({ ...privilegeModal, privileges: curr });
  };

  const handleSavePrivileges = async () => {
    if (!privilegeModal) return;
    setSavingPrivileges(true);
    try {
      const { username, database, privileges } = privilegeModal;
      const isAll = privileges.includes('ALL PRIVILEGES');
      const toSend = isAll ? ['ALL PRIVILEGES'] : privileges;
      await api.assignUser(username, database, toSend);
      showSuccess(`Privileges updated for ${username} on ${database}!`);
      setPrivilegeModal(null);
      await loadData();
    } catch (err) {
      showError('Failed to save privileges: ' + err.message);
    } finally {
      setSavingPrivileges(false);
    }
  };

  // Revoke User from DB
  const handleRevokeUser = async (username, dbName) => {
    if (!window.confirm(`Remove database user "${username}" from database "${dbName}"?`)) return;
    try {
      await api.revokeDatabaseUser(username, dbName);
      showSuccess(`User ${username} unlinked from ${dbName}.`);
      await loadData();
    } catch (err) {
      showError(err.message);
    }
  };

  // Save MariaDB Server Settings
  const handleSaveMariaDbConfig = async (e) => {
    e.preventDefault();
    setTestingConfig(true);
    setConfigFeedback(null);
    try {
      const res = await api.updateDatabaseConfig({
        host: dbHost.trim(),
        port: parseInt(dbPort, 10) || 3306,
        user: dbUser.trim(),
        password: dbPassword
      });
      setServerStatus(res.status);
      if (res.status?.connected) {
        setConfigFeedback({
          success: true,
          message: `Connected successfully to MariaDB (${res.status.version})!`
        });
        showSuccess('Connected to live MariaDB server!');
        loadData();
      } else {
        setConfigFeedback({
          success: false,
          message: res.status?.lastError || 'Could not connect to port 3306. Check that MariaDB is running.'
        });
      }
    } catch (err) {
      setConfigFeedback({ success: false, message: err.message });
    } finally {
      setTestingConfig(false);
    }
  };

  const strength = calculatePasswordStrength(newUserPassword);

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="rounded-2xl p-6 bg-[#1c0830]/95 backdrop-blur-xl border border-purple-800/40 shadow-xl text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-purple-300/70 mb-1">
              <span>Home</span>
              <span>/</span>
              <span>Databases</span>
              <span>/</span>
              <span className="text-emerald-400 font-semibold">MySQL® Databases</span>
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Database className="w-6 h-6 text-purple-400" />
              Manage My Databases
            </h1>
            <p className="text-xs text-purple-300/75 mt-1">
              Create, manage, and inspect MySQL / MariaDB databases, database users, and privilege mappings.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setConfigModal(true)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-purple-700/40 bg-purple-950/50 hover:bg-purple-900/50 text-purple-200 text-xs font-semibold transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-purple-400" />
              <span>MariaDB Settings</span>
            </button>
            <button
              onClick={loadData}
              className="p-2 rounded-xl border border-purple-700/40 bg-purple-950/50 hover:bg-purple-900/50 text-purple-200 hover:text-white transition cursor-pointer"
              title="Refresh databases"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {statusMsg && (
          <div className="mt-4 bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 bg-red-950/70 text-red-300 border border-red-500/40 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Overview Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-purple-800/30 text-xs">
          <div className="bg-purple-950/40 p-3.5 rounded-xl border border-purple-800/30">
            <span className="text-purple-300/80 font-medium block">Current Databases</span>
            <span className="text-base font-bold text-white mt-0.5 block">
              {data.databases?.length || 0} <span className="text-emerald-400 font-normal text-xs ml-1">/ Unlimited</span>
            </span>
          </div>
          <div className="bg-purple-950/40 p-3.5 rounded-xl border border-purple-800/30">
            <span className="text-purple-300/80 font-medium block">Database Users</span>
            <span className="text-base font-bold text-white mt-0.5 block">
              {data.users?.length || 0} <span className="text-emerald-400 font-normal text-xs ml-1">/ Unlimited</span>
            </span>
          </div>
          <div className="bg-purple-950/40 p-3.5 rounded-xl border border-purple-800/30">
            <span className="text-purple-300/80 font-medium block">Database Disk Usage</span>
            <span className="text-base font-bold text-white mt-0.5 block">
              {data.stats?.totalSize || '0.00 MB'}
            </span>
          </div>
          <div className="bg-purple-950/40 p-3.5 rounded-xl border border-purple-800/30">
            <span className="text-purple-300/80 font-medium block">Database Engine</span>
            <span className="text-base font-bold text-white mt-0.5 block truncate" title={serverStatus?.engine}>
              {serverStatus?.connected ? 'MariaDB Live' : 'Local Sandbox'}
            </span>
          </div>
        </div>
      </div>

      {/* Engine Status Banner */}
      <div className={`rounded-2xl p-4 border flex items-center justify-between transition-colors ${
        serverStatus?.connected 
          ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200' 
          : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl ${serverStatus?.connected ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-600/40' : 'bg-amber-900/60 text-amber-400 border border-amber-600/40'}`}>
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                {serverStatus?.connected ? 'MariaDB Online' : 'cPanel Local Sandbox Engine'}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                serverStatus?.connected ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
              }`}>
                {serverStatus?.connected ? 'Live Port 3306' : 'Sandbox Ready'}
              </span>
            </div>
            <p className="text-xs text-purple-200/80 mt-0.5">
              {serverStatus?.connected 
                ? `Connected to ${serverStatus.engine} on ${serverStatus.host}:${serverStatus.port}. Database queries and user privileges are executed live.`
                : 'All database features and user privileges run smoothly in the local sandbox. Connect MariaDB anytime in Settings.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setConfigModal(true)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md transition cursor-pointer ${
            serverStatus?.connected
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
              : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white'
          }`}
        >
          {serverStatus?.connected ? 'Connection Info' : 'Connect MariaDB'}
        </button>
      </div>

      {/* Grid: Create Database & Modify Databases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create New Database */}
        <div className="rounded-2xl p-6 bg-[#1c0830]/95 backdrop-blur-xl border border-purple-800/40 shadow-xl flex flex-col justify-between text-white">
          <div>
            <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-purple-400" /> Create New Database
            </h2>
            <p className="text-xs text-purple-300/75 mb-4 leading-relaxed">
              Enter a name for your new MySQL database. The database name will automatically be prefixed with <code className="bg-[#180529] px-2 py-0.5 rounded-md font-mono text-emerald-400 font-bold border border-purple-700/40">{dbPrefix}</code> for multi-tenant account isolation.
            </p>

            <form onSubmit={handleCreateDatabase} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1.5">New Database Name:</label>
                <div className="flex items-center rounded-xl overflow-hidden border border-purple-700/50 shadow-inner bg-[#250c3d]/90 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-500/30 transition-all">
                  <span className="bg-[#180529] px-3.5 py-2.5 text-xs font-mono font-bold text-emerald-400 border-r border-purple-700/50 select-none flex items-center gap-1.5 shrink-0 tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {dbPrefix}
                  </span>
                  <input
                    type="text"
                    value={newDbName}
                    onChange={(e) => setNewDbName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="database_name"
                    className="w-full bg-transparent px-3 py-2.5 text-xs font-mono text-white placeholder-purple-400/40 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Advanced Charset & Collation Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedCharset(!showAdvancedCharset)}
                  className="text-purple-300/80 hover:text-purple-100 text-xs font-medium flex items-center gap-1 cursor-pointer transition"
                >
                  {showAdvancedCharset ? <ChevronUp className="w-3.5 h-3.5 text-purple-400" /> : <ChevronDown className="w-3.5 h-3.5 text-purple-400" />}
                  <span>Advanced Collation &amp; Charset</span>
                </button>

                {showAdvancedCharset && (
                  <div className="grid grid-cols-2 gap-3 mt-2.5 p-3.5 bg-[#160527] rounded-xl border border-purple-800/40">
                    <div>
                      <label className="block text-[11px] font-semibold text-purple-300 mb-1">Character Set:</label>
                      <select
                        value={selectedCharset}
                        onChange={(e) => setSelectedCharset(e.target.value)}
                        className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-2 py-1.5 text-xs rounded-lg text-white font-mono focus:outline-none focus:border-purple-400"
                      >
                        {(data.charsets || ['utf8mb4', 'utf8', 'latin1']).map(c => (
                          <option key={c} value={c} className="bg-[#1c0830] text-white">{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-purple-300 mb-1">Collation:</label>
                      <select
                        value={selectedCollation}
                        onChange={(e) => setSelectedCollation(e.target.value)}
                        className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-2 py-1.5 text-xs rounded-lg text-white font-mono focus:outline-none focus:border-purple-400"
                      >
                        {(data.collations || ['utf8mb4_unicode_ci', 'utf8mb4_general_ci', 'utf8_general_ci']).map(col => (
                          <option key={col} value={col} className="bg-[#1c0830] text-white">{col}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={creatingDb || !newDbName.trim()}
                  className="bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  {creatingDb ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Create Database</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Modify Databases (Check & Repair) */}
        <div className="rounded-2xl p-6 bg-[#1c0830]/95 backdrop-blur-xl border border-purple-800/40 shadow-xl flex flex-col justify-between text-white">
          <div>
            <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-purple-400" /> Modify Databases (Maintenance)
            </h2>
            <p className="text-xs text-purple-300/75 mb-4 leading-relaxed">
              Run automated integrity checks or index repairs across all tables in a selected database.
            </p>

            <div className="space-y-4">
              {/* Check Database */}
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">Check Database:</label>
                <div className="flex gap-2">
                  <select
                    value={checkDbTarget}
                    onChange={(e) => setCheckDbTarget(e.target.value)}
                    disabled={!data.databases?.length}
                    className="flex-1 bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs font-mono text-white rounded-xl focus:outline-none focus:border-purple-400"
                  >
                    {!data.databases?.length && <option value="" className="bg-[#1c0830] text-purple-300">No databases available</option>}
                    {data.databases?.map(d => (
                      <option key={d.name} value={d.name} className="bg-[#1c0830] text-white">{d.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleCheckDatabase(checkDbTarget)}
                    disabled={runningMaintenance || !checkDbTarget}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {runningMaintenance ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                    <span>Check DB</span>
                  </button>
                </div>
              </div>

              {/* Repair Database */}
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">Repair Database:</label>
                <div className="flex gap-2">
                  <select
                    value={repairDbTarget}
                    onChange={(e) => setRepairDbTarget(e.target.value)}
                    disabled={!data.databases?.length}
                    className="flex-1 bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2 text-xs font-mono text-white rounded-xl focus:outline-none focus:border-purple-400"
                  >
                    {!data.databases?.length && <option value="" className="bg-[#1c0830] text-purple-300">No databases available</option>}
                    {data.databases?.map(d => (
                      <option key={d.name} value={d.name} className="bg-[#1c0830] text-white">{d.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRepairDatabase(repairDbTarget)}
                    disabled={runningMaintenance || !repairDbTarget}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {runningMaintenance ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
                    <span>Repair DB</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Databases Table */}
      <div className="rounded-2xl bg-[#1c0830]/95 backdrop-blur-xl border border-purple-800/40 shadow-xl overflow-hidden text-white">
        <div className="bg-[#1b082e] border-b border-purple-800/40 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-white tracking-wide">
              Current Databases ({filteredDatabases.length})
            </span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-purple-400/60" />
            <input
              type="text"
              value={dbSearch}
              onChange={(e) => setDbSearch(e.target.value)}
              placeholder="Search databases..."
              className="w-full bg-[#250c3d]/90 border border-purple-700/40 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 font-mono"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1f0933] text-purple-200 border-b border-purple-800/40 font-semibold">
              <tr>
                <th className="py-3 px-6">Database</th>
                <th className="py-3 px-6">Size</th>
                <th className="py-3 px-6">Tables</th>
                <th className="py-3 px-6">Privileged Users</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-900/20">
              {filteredDatabases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-purple-300/50">
                    No databases found matching your search.
                  </td>
                </tr>
              ) : (
                filteredDatabases.map((db) => (
                  <tr key={db.name} className="hover:bg-purple-900/25 transition-colors">
                    <td className="py-3.5 px-6 font-semibold text-white font-mono">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <div>
                          <span className="text-white font-bold">{db.name}</span>
                          <div className="text-[10px] text-purple-400/60 font-sans font-normal">
                            {db.collation || 'utf8mb4_unicode_ci'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 font-mono text-purple-200">{db.size}</td>
                    <td className="py-3.5 px-6 font-mono text-purple-200">{db.tablesCount || 0}</td>
                    <td className="py-3.5 px-6">
                      {db.users?.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {db.users.map((u) => (
                            <span 
                              key={u} 
                              className="inline-flex items-center gap-1.5 bg-purple-950/80 text-purple-200 px-2.5 py-1 rounded-lg text-[11px] font-mono border border-purple-700/40 hover:border-purple-400 transition"
                            >
                              <button
                                onClick={() => openPrivilegesModal(u, db.name)}
                                className="hover:underline cursor-pointer text-emerald-400 font-semibold"
                                title="Click to manage privileges"
                              >
                                {u}
                              </button>
                              <button
                                onClick={() => handleRevokeUser(u, db.name)}
                                className="text-purple-400 hover:text-red-400 ml-0.5 cursor-pointer"
                                title={`Revoke ${u} from ${db.name}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-purple-400/50 italic">None</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleJumpPhpMyAdmin(db.name)}
                        className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 rounded-lg font-semibold text-[11px] inline-flex items-center gap-1 border border-amber-600/40 transition cursor-pointer"
                        title="Jump to phpMyAdmin for this database"
                      >
                        <span>phpMyAdmin</span>
                        <ExternalLink className="w-3 h-3 text-amber-400" />
                      </button>
                      <button
                        onClick={() => handleCheckDatabase(db.name)}
                        className="px-2 py-1 bg-purple-950/60 hover:bg-purple-900/60 text-purple-200 rounded-lg text-[11px] font-medium border border-purple-700/40 transition cursor-pointer"
                        title="Check Database Integrity"
                      >
                        Check
                      </button>
                      <button
                        onClick={() => handleRepairDatabase(db.name)}
                        className="px-2 py-1 bg-purple-950/60 hover:bg-purple-900/60 text-purple-200 rounded-lg text-[11px] font-medium border border-purple-700/40 transition cursor-pointer"
                        title="Repair Database Tables"
                      >
                        Repair
                      </button>
                      <button
                        onClick={() => setDeleteDbModal(db.name)}
                        className="px-2 py-1 bg-red-950/60 text-red-300 hover:bg-red-900/60 rounded-lg text-[11px] font-medium border border-red-800/40 transition cursor-pointer"
                        title="Delete Database"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline text-red-400" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section: MySQL Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add New User */}
        <div className="rounded-2xl p-6 bg-[#1c0830]/95 backdrop-blur-xl border border-purple-800/40 shadow-xl text-white flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-purple-400" /> MySQL Users (Add New User)
            </h2>
            <p className="text-xs text-purple-300/75 mb-4 leading-relaxed">
              Create an independent MySQL database user account. The username will be automatically prefixed with <code className="bg-[#180529] px-2 py-0.5 rounded-md font-mono text-emerald-400 font-bold border border-purple-700/40">{dbPrefix}</code>.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1.5">Username:</label>
                <div className="flex items-center rounded-xl overflow-hidden border border-purple-700/50 shadow-inner bg-[#250c3d]/90 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-500/30 transition-all">
                  <span className="bg-[#180529] px-3.5 py-2.5 text-xs font-mono font-bold text-emerald-400 border-r border-purple-700/50 select-none flex items-center gap-1.5 shrink-0 tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {dbPrefix}
                  </span>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="username"
                    className="w-full bg-transparent px-3 py-2.5 text-xs font-mono text-white placeholder-purple-400/40 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-purple-200">Password:</label>
                  <button
                    type="button"
                    onClick={() => openPasswordGenerator('create')}
                    className="text-xs text-purple-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer transition"
                  >
                    <Sparkles className="w-3 h-3 text-purple-400" /> Generate Password
                  </button>
                </div>
                <div className="relative flex items-center rounded-xl border border-purple-700/50 shadow-inner bg-[#250c3d]/90 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-500/30 transition-all">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Enter strong password"
                    className="w-full bg-transparent pl-3 pr-10 py-2.5 text-xs font-mono text-white placeholder-purple-400/40 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-purple-400 hover:text-white transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {newUserPassword && (
                  <div className="mt-2.5 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-purple-300/70">Strength:</span>
                      <span className="font-semibold text-white">{strength.label} ({strength.score}/100)</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#180529] rounded-full overflow-hidden border border-purple-800/40">
                      <div 
                        className={`h-full transition-all duration-300 ${strength.color}`} 
                        style={{ width: `${strength.score}%` }} 
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={creatingUser || !newUsername.trim() || !newUserPassword}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  {creatingUser ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>Create User</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Add User To Database */}
        <div className="rounded-2xl p-6 bg-[#1c0830]/95 backdrop-blur-xl border border-purple-800/40 shadow-xl text-white flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-emerald-400" /> Add User To Database
            </h2>
            <p className="text-xs text-purple-300/75 mb-4 leading-relaxed">
              Associate a database user with a database and select granular SQL privileges.
            </p>

            <form onSubmit={handleStartAssignUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1.5">User:</label>
                <select
                  value={assignUser}
                  onChange={(e) => setAssignUser(e.target.value)}
                  disabled={!data.users?.length}
                  className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2.5 text-xs font-mono text-white rounded-xl focus:outline-none focus:border-purple-400"
                >
                  {!data.users?.length && <option value="" className="bg-[#1c0830] text-purple-300">No users available</option>}
                  {data.users?.map(u => (
                    <option key={u.username} value={u.username} className="bg-[#1c0830] text-white">{u.username}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1.5">Database:</label>
                <select
                  value={assignDb}
                  onChange={(e) => setAssignDb(e.target.value)}
                  disabled={!data.databases?.length}
                  className="w-full bg-[#250c3d]/90 border border-purple-700/40 px-3 py-2.5 text-xs font-mono text-white rounded-xl focus:outline-none focus:border-purple-400"
                >
                  {!data.databases?.length && <option value="" className="bg-[#1c0830] text-purple-300">No databases available</option>}
                  {data.databases?.map(d => (
                    <option key={d.name} value={d.name} className="bg-[#1c0830] text-white">{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!assignUser || !assignDb}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Add (Set Privileges)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Current Users Table */}
      <div className="rounded-2xl bg-[#1c0830]/95 backdrop-blur-xl border border-purple-800/40 shadow-xl overflow-hidden text-white">
        <div className="bg-[#1b082e] border-b border-purple-800/40 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-white tracking-wide">
              Current Users ({filteredUsers.length})
            </span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-purple-400/60" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full bg-[#250c3d]/90 border border-purple-700/40 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 font-mono"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1f0933] text-purple-200 border-b border-purple-800/40 font-semibold">
              <tr>
                <th className="py-3 px-6">Username</th>
                <th className="py-3 px-6">Assigned Databases</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-900/20">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-purple-300/50">
                    No database users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.username} className="hover:bg-purple-900/25 transition-colors">
                    <td className="py-3.5 px-6 font-semibold text-white font-mono flex items-center gap-2">
                      <Lock className="w-4 h-4 text-purple-400" /> {u.username}
                    </td>
                    <td className="py-3.5 px-6">
                      {u.databases?.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {u.databases.map(d => (
                            <button
                              key={d}
                              onClick={() => openPrivilegesModal(u.username, d)}
                              className="bg-purple-950/80 hover:bg-purple-900 text-purple-200 px-2.5 py-1 rounded-lg text-[11px] font-mono border border-purple-700/40 hover:border-purple-400 cursor-pointer transition"
                              title="Click to edit privileges"
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-purple-400/50 italic">None</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setChangePasswordModal(u.username);
                          setNewPassVal('');
                        }}
                        className="px-2.5 py-1 bg-purple-950/60 hover:bg-purple-900/60 text-purple-200 rounded-lg text-[11px] font-medium border border-purple-700/40 transition cursor-pointer inline-flex items-center gap-1"
                        title="Change User Password"
                      >
                        <Key className="w-3 h-3 text-purple-400" />
                        <span>Change Password</span>
                      </button>
                      <button
                        onClick={() => setDeleteUserModal(u.username)}
                        className="px-2 py-1 bg-red-950/60 text-red-300 hover:bg-red-900/60 rounded-lg text-[11px] font-medium border border-red-800/40 transition cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline text-red-400" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL: PRIVILEGES MANAGER --- */}
      {privilegeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-600" /> Manage User Privileges
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  User: <span className="font-bold text-slate-800">{privilegeModal.username}</span> | Database: <span className="font-bold text-slate-800">{privilegeModal.database}</span>
                </p>
              </div>
              <button 
                onClick={() => setPrivilegeModal(null)} 
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* All Privileges Master Checkbox */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="all-privs"
                checked={privilegeModal.privileges.includes('ALL PRIVILEGES')}
                onChange={() => togglePrivilege('ALL PRIVILEGES')}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="all-privs" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                ALL PRIVILEGES
              </label>
            </div>

            {/* Individual Granular Privileges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1">
              {ALL_PRIVILEGES_LIST.map((priv) => {
                const checked = privilegeModal.privileges.includes('ALL PRIVILEGES') || privilegeModal.privileges.includes(priv);
                return (
                  <label
                    key={priv}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition ${
                      checked ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePrivilege(priv)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="font-mono text-[11px] font-medium">{priv}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end space-x-2 pt-5 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setPrivilegeModal(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePrivileges}
                disabled={savingPrivileges}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingPrivileges ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Make Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: MAINTENANCE / CHECK / REPAIR REPORT --- */}
      {maintenanceResult && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {maintenanceResult.type === 'check' ? (
                  <Shield className="w-5 h-5 text-indigo-600" />
                ) : (
                  <Wrench className="w-5 h-5 text-blue-600" />
                )}
                {maintenanceResult.title}
              </h3>
              <button onClick={() => setMaintenanceResult(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3 font-mono">
              Database: <span className="font-bold text-slate-800">{maintenanceResult.database}</span> | Tables Analyzed: <span className="font-bold text-slate-800">{maintenanceResult.tablesCount}</span>
            </p>

            <div className="bg-slate-900 rounded-lg p-3 max-h-60 overflow-y-auto font-mono text-xs text-slate-200 space-y-1.5">
              {maintenanceResult.details?.map((row, idx) => (
                <div key={idx} className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-300 truncate">{row.table} ... {row.op}</span>
                  <span className={`font-bold ${
                    row.msgText?.includes('OK') ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {row.msgText}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setMaintenanceResult(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-900 text-white cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CHANGE USER PASSWORD --- */}
      {changePasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600" /> Set MySQL User Password
              </h3>
              <button onClick={() => setChangePasswordModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3 font-mono">
              Target User: <span className="font-bold text-slate-800">{changePasswordModal}</span>
            </p>

            <form onSubmit={confirmChangePassword} className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-700">New Password:</label>
                  <button
                    type="button"
                    onClick={() => openPasswordGenerator('change')}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" /> Generate Password
                  </button>
                </div>
                <input
                  type="password"
                  value={newPassVal}
                  onChange={(e) => setNewPassVal(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setChangePasswordModal(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPass || !newPassVal}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {changingPass ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  <span>Change Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: PASSWORD GENERATOR --- */}
      {passwordGenModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" /> Password Generator
              </h3>
              <button onClick={() => setPasswordGenModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Generated Password:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedPassword}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono select-all font-bold text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPassword);
                      showSuccess('Password copied to clipboard!');
                    }}
                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                    title="Copy password"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Length:</span>
                  <span className="font-bold font-mono">{genPassLength} characters</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="32"
                  value={genPassLength}
                  onChange={(e) => {
                    const l = parseInt(e.target.value, 10);
                    setGenPassLength(l);
                    setGeneratedPassword(generateSecurePassword(l));
                  }}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setGeneratedPassword(generateSecurePassword(genPassLength))}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </button>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setPasswordGenModal(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyGeneratedPassword}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
              >
                Use Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: DELETE DATABASE CONFIRMATION --- */}
      {deleteDbModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-scale-up">
            <div className="flex items-center space-x-3 text-red-600 mb-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Drop Database?</h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-2">
              Are you sure you wish to permanently drop the database <code className="bg-slate-100 px-1 py-0.5 rounded font-bold font-mono text-red-600">{deleteDbModal}</code>?
            </p>
            <p className="text-[11px] text-slate-500 bg-red-50 p-2.5 rounded-lg border border-red-200">
              ⚠️ <strong>Warning:</strong> This operation is permanent and will completely delete all tables and data inside this database.
            </p>

            <div className="flex justify-end space-x-2 pt-4">
              <button
                type="button"
                onClick={() => setDeleteDbModal(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteDatabase}
                disabled={deletingDb}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deletingDb ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Database</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: DELETE USER CONFIRMATION --- */}
      {deleteUserModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-scale-up">
            <div className="flex items-center space-x-3 text-red-600 mb-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete MySQL User?</h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-2">
              Are you sure you wish to delete the MySQL user <code className="bg-slate-100 px-1 py-0.5 rounded font-bold font-mono text-red-600">{deleteUserModal}</code>?
            </p>
            <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              The user account will be dropped and unlinked from all databases. Physical databases and tables will remain intact.
            </p>

            <div className="flex justify-end space-x-2 pt-4">
              <button
                type="button"
                onClick={() => setDeleteUserModal(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={deletingUser}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deletingUser ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete User</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: MARIADB SERVER SETTINGS --- */}
      {configModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600" /> MariaDB / MySQL Server Settings
              </h3>
              <button onClick={() => setConfigModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Enter your MariaDB or MySQL connection credentials to connect cPanel directly to your local or remote database server.
            </p>

            <form onSubmit={handleSaveMariaDbConfig} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Host:</label>
                <input
                  type="text"
                  value={dbHost}
                  onChange={(e) => setDbHost(e.target.value)}
                  placeholder="127.0.0.1"
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Port:</label>
                  <input
                    type="number"
                    value={dbPort}
                    onChange={(e) => setDbPort(e.target.value)}
                    placeholder="3306"
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Username:</label>
                  <input
                    type="text"
                    value={dbUser}
                    onChange={(e) => setDbUser(e.target.value)}
                    placeholder="root"
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password:</label>
                <input
                  type="password"
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  placeholder="Leave blank if no password"
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                />
              </div>

              {configFeedback && (
                <div className={`p-3 rounded-lg text-xs font-medium ${
                  configFeedback.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {configFeedback.message}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfigModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={testingConfig}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {testingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Test & Connect</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
