import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  Folder,
  FolderLock,
  FolderOpen,
  Globe,
  HelpCircle,
  Info,
  Layers,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Unlock,
  UserCheck,
  UserX,
  Users,
  Wrench,
  X,
  Zap
} from 'lucide-react';
import { api } from '../services/api';

export default function LeechProtectionManager({ onBack, onNavigate, user }) {
  const cpanelUser = user || 'cpanel_user';

  // Data states
  const [capabilities, setCapabilities] = useState(null);
  const [directories, setDirectories] = useState([]);
  const [activeBlocks, setActiveBlocks] = useState([]);
  const [events, setEvents] = useState([]);

  // Selection & Config states
  const [selectedDirectory, setSelectedDirectory] = useState('public_html');
  const [dirConfig, setDirConfig] = useState({
    directory: 'public_html',
    enabled: false,
    threshold: 4,
    timeWindowMinutes: 120,
    emailAlert: '',
    redirectUrl: '',
    disableCompromisedAccounts: false,
    blockDurationMinutes: 120,
    whitelist: [],
    inSync: true,
    htaccessSnippet: '',
    privacyStatus: null
  });

  // Form states
  const [thresholdInput, setThresholdInput] = useState('4');
  const [windowInput, setWindowInput] = useState('120');
  const [emailInput, setEmailInput] = useState('');
  const [redirectInput, setRedirectInput] = useState('');
  const [disableAccountsCheck, setDisableAccountsCheck] = useState(false);
  const [blockDurationInput, setBlockDurationInput] = useState('120');
  const [whitelistText, setWhitelistText] = useState('');

  // UI states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [unblockingIp, setUnblockingIp] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showHtaccessPreview, setShowHtaccessPreview] = useState(false);
  const [copiedHtaccess, setCopiedHtaccess] = useState(false);
  const [activeTab, setActiveTab] = useState('config'); // 'config' | 'blocks' | 'events' | 'simulator'

  // Simulator states
  const [simIp, setSimIp] = useState('198.51.100.25');
  const [simUser, setSimUser] = useState('member1');
  const [simSimulating, setSimSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);

  // Load directories, active blocks, and capabilities
  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setErrorMessage(null);

    try {
      const [capsRes, dirsRes, blocksRes, eventsRes] = await Promise.all([
        api.getLeechCapabilities().catch(e => ({ success: false, error: e.message })),
        api.getLeechDirectories(cpanelUser).catch(e => ({ success: false, error: e.message, directories: [] })),
        api.getLeechActiveBlocks(cpanelUser).catch(e => ({ success: false, error: e.message, blocks: [] })),
        api.getLeechEvents(cpanelUser, 30).catch(e => ({ success: false, error: e.message, events: [] }))
      ]);

      if (capsRes && capsRes.success) {
        setCapabilities(capsRes);
      }
      if (dirsRes && dirsRes.success) {
        setDirectories(dirsRes.directories || []);
      }
      if (blocksRes && blocksRes.success) {
        setActiveBlocks(blocksRes.blocks || []);
      }
      if (eventsRes && eventsRes.success) {
        setEvents(eventsRes.events || []);
      }
    } catch (err) {
      console.error('Error loading Leech Protection data:', err);
      setErrorMessage(err.message || 'Error communicating with Leech Protection API.');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  // Load config for the currently selected directory
  const loadDirConfig = async (dir) => {
    try {
      const res = await api.getLeechConfig(cpanelUser, dir);
      if (res && res.success) {
        setDirConfig(res);
        setThresholdInput(String(res.threshold || 4));
        setWindowInput(String(res.timeWindowMinutes || 120));
        setEmailInput(res.emailAlert || '');
        setRedirectInput(res.redirectUrl || '');
        setDisableAccountsCheck(!!res.disableCompromisedAccounts);
        setBlockDurationInput(String(res.blockDurationMinutes || 120));
        setWhitelistText((res.whitelist || []).join('\n'));
      }
    } catch (err) {
      console.error('Error loading directory config:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [cpanelUser]);

  useEffect(() => {
    if (selectedDirectory) {
      loadDirConfig(selectedDirectory);
    }
  }, [selectedDirectory]);

  // Handle Save
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const whitelist = whitelistText
        .split('\n')
        .map(ip => ip.trim())
        .filter(Boolean);

      const res = await api.saveLeechConfig({
        cpanelUser,
        directory: selectedDirectory,
        enabled: dirConfig.enabled,
        threshold: parseInt(thresholdInput, 10) || 4,
        timeWindowMinutes: parseInt(windowInput, 10) || 120,
        emailAlert: emailInput.trim(),
        redirectUrl: redirectInput.trim(),
        disableCompromisedAccounts: disableAccountsCheck,
        blockDurationMinutes: parseInt(blockDurationInput, 10) || 120,
        whitelist
      });

      if (res && res.success) {
        setSuccessMessage(res.message || `Leech protection for "${selectedDirectory}" saved.`);
        if (res.config) {
          setDirConfig(res.config);
        }
        loadData();
      } else {
        setErrorMessage(res?.error || 'Failed to save configuration.');
      }
    } catch (err) {
      console.error('Error saving leech config:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Error saving configuration.');
    } finally {
      setSaving(false);
    }
  };

  // Handle Toggle
  const handleToggle = async (desiredState) => {
    setToggling(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.toggleLeechProtection({
        cpanelUser,
        directory: selectedDirectory,
        enabled: desiredState
      });

      if (res && res.success) {
        setSuccessMessage(res.message || `Leech protection has been ${desiredState ? 'enabled' : 'disabled'}.`);
        if (res.config) {
          setDirConfig(res.config);
        }
        loadData();
      } else {
        setErrorMessage(res?.error || 'Failed to toggle protection.');
      }
    } catch (err) {
      console.error('Error toggling leech protection:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Error updating status.');
    } finally {
      setToggling(false);
    }
  };

  // Handle Repair / Sync .htaccess
  const handleRepair = async () => {
    setRepairing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.repairLeechConfig({
        cpanelUser,
        directory: selectedDirectory
      });

      if (res && res.success) {
        setSuccessMessage(res.message || '.htaccess directives synchronized successfully.');
        if (res.config) {
          setDirConfig(res.config);
        }
        loadData();
      } else {
        setErrorMessage(res?.error || 'Failed to repair .htaccess directives.');
      }
    } catch (err) {
      console.error('Error repairing leech directives:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Error repairing .htaccess.');
    } finally {
      setRepairing(false);
    }
  };

  // Handle Unblock IP
  const handleUnblock = async (block) => {
    setUnblockingIp(block.id || block.ip);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.removeLeechBlock({
        cpanelUser,
        ip: block.ip,
        id: block.id
      });

      if (res && res.success) {
        setSuccessMessage(res.message || `Unblocked IP ${block.ip} successfully.`);
        loadData();
      } else {
        setErrorMessage(res?.error || 'Failed to unblock IP.');
      }
    } catch (err) {
      console.error('Error unblocking IP:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Error removing block.');
    } finally {
      setUnblockingIp(null);
    }
  };

  // Copy .htaccess block
  const handleCopyHtaccess = () => {
    if (dirConfig.htaccessSnippet) {
      navigator.clipboard.writeText(dirConfig.htaccessSnippet);
      setCopiedHtaccess(true);
      setTimeout(() => setCopiedHtaccess(false), 2500);
    }
  };

  // Live Simulator Test
  const handleSimulate = async () => {
    setSimSimulating(true);
    setSimResult(null);

    try {
      const res = await api.verifyLeechAccess({
        user: cpanelUser,
        directory: selectedDirectory,
        ip: simIp.trim(),
        authUser: simUser.trim()
      });

      setSimResult(res);
      loadData();
    } catch (err) {
      setSimResult({
        success: false,
        blocked: false,
        error: err.message
      });
    } finally {
      setSimSimulating(false);
    }
  };

  // Filtered directories
  const filteredDirectories = useMemo(() => {
    if (!searchQuery.trim()) return directories;
    const q = searchQuery.toLowerCase();
    return directories.filter(d =>
      d.name.toLowerCase().includes(q) || d.canonicalRel.toLowerCase().includes(q)
    );
  }, [directories, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-xs text-slate-500">
        <button
          onClick={onBack}
          className="hover:text-slate-900 transition-colors cursor-pointer font-medium"
        >
          cPanel Home
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-400 font-medium">Security</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800 font-semibold">Leech Protection</span>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-600 mt-1">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-slate-900">Leech Protection</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                Active Engine
              </span>
              {activeBlocks.length > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                  <Ban className="w-3 h-3 mr-1" />
                  {activeBlocks.length} Active Block{activeBlocks.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1.5 max-w-3xl leading-relaxed">
              Leech Protect prevents users from publicly posting or sharing passwords to restricted directories on your website.
              When excessive logins occur within a 2-hour window, the engine automatically triggers email notifications, redirects leeching sessions, disables compromised accounts in <span className="font-mono text-slate-800">.htpasswd</span>, and enforces temporary IP blocks.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0 self-start md:self-auto">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center px-3 py-2 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'config'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FolderLock className="w-4 h-4" />
          <span>Directory Protection</span>
        </button>

        <button
          onClick={() => setActiveTab('blocks')}
          className={`pb-3 border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'blocks'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Ban className="w-4 h-4" />
          <span>Active IP Blocks ({activeBlocks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`pb-3 border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'events'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Violation Events ({events.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`pb-3 border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'simulator'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Live Simulator</span>
        </button>
      </div>

      {/* TAB 1: Directory Configuration */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Directory Explorer Tree (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200 shadow-xs flex flex-col h-[650px] overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xs font-bold text-slate-800 flex items-center">
                <Folder className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Account Directories
              </h2>
              <div className="relative mt-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter folders..."
                  className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-50">
              {filteredDirectories.map(dir => {
                const isSelected = selectedDirectory === dir.canonicalRel;
                return (
                  <div
                    key={dir.canonicalRel}
                    onClick={() => setSelectedDirectory(dir.canonicalRel)}
                    className={`p-2.5 rounded-md cursor-pointer transition-colors text-xs flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50 text-blue-900 font-bold border border-blue-200'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {dir.leechProtected ? (
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : dir.hasPrivacyProtection ? (
                        <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : (
                        <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate font-mono">{dir.name}</span>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      {dir.leechProtected && (
                        <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-emerald-100 text-emerald-800">
                          Leech On
                        </span>
                      )}
                      {dir.hasPrivacyProtection && (
                        <span className="px-1.5 py-0.5 rounded text-3xs font-medium bg-amber-100 text-amber-800">
                          Auth
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Leech Configuration for Selected Directory (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Drift Banner if Applicable */}
            {!dirConfig.inSync && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start justify-between shadow-xs">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">Apache .htaccess Directives Mismatch</h4>
                    <p className="text-xs text-amber-700 mt-0.5">
                      The directives in <span className="font-mono text-amber-900 font-semibold">{dirConfig.htaccessPath}</span> differ from database state. Click repair to synchronize.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRepair}
                  disabled={repairing}
                  className="inline-flex items-center px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium shadow-xs shrink-0 ml-4 transition-colors"
                >
                  <Wrench className="w-3.5 h-3.5 mr-1" />
                  {repairing ? 'Repairing...' : 'Repair .htaccess'}
                </button>
              </div>
            )}

            <form onSubmit={handleSave} className="bg-white rounded-lg border border-slate-200 shadow-xs divide-y divide-slate-100">
              {/* Directory Title & Status Switch */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <FolderLock className="w-5 h-5 text-purple-600" />
                    <h2 className="text-sm font-bold text-slate-800">
                      Configure: <span className="font-mono text-blue-600">/{selectedDirectory}</span>
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage login frequency detection and automated protective actions for this folder.
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`text-xs font-bold ${dirConfig.enabled ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {dirConfig.enabled ? 'Protection Active' : 'Disabled'}
                  </span>
                  {dirConfig.enabled ? (
                    <button
                      type="button"
                      onClick={() => handleToggle(false)}
                      disabled={toggling}
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors shadow-xs"
                    >
                      <ToggleLeft className="w-4 h-4 inline mr-1" />
                      {toggling ? 'Disabling...' : 'Disable'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggle(true)}
                      disabled={toggling}
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
                    >
                      <ToggleRight className="w-4 h-4 inline mr-1" />
                      {toggling ? 'Enabling...' : 'Enable'}
                    </button>
                  )}
                </div>
              </div>

              {/* Directory Privacy Info Notice */}
              <div className="p-5 bg-slate-50/50 flex items-start space-x-3">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800">Directory Privacy Status: </span>
                  {dirConfig.privacyStatus?.isProtected ? (
                    <span className="text-emerald-700 font-medium">
                      Password Protected (Realm: &quot;{dirConfig.privacyStatus.authName}&quot; with {dirConfig.privacyStatus.userCount || 0} user accounts)
                    </span>
                  ) : (
                    <span className="text-amber-700 font-medium">
                      Not currently password protected. (Leech Protection will monitor access frequency and client request floods).
                    </span>
                  )}
                </div>
              </div>

              {/* Threshold & Time Window */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Number of Logins Per Time Period (Threshold)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={thresholdInput}
                      onChange={(e) => setThresholdInput(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-1.5 mt-2">
                      {[4, 8, 16, 32].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setThresholdInput(String(n))}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-2xs font-mono transition-colors"
                        >
                          {n} Logins
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Detection Time Window
                    </label>
                    <select
                      value={windowInput}
                      onChange={(e) => setWindowInput(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="30">30 Minutes</option>
                      <option value="60">1 Hour</option>
                      <option value="120">2 Hours (cPanel Standard)</option>
                      <option value="240">4 Hours</option>
                      <option value="720">12 Hours</option>
                      <option value="1440">24 Hours</option>
                    </select>
                    <p className="text-2xs text-slate-500 mt-1">
                      Logins exceeding the threshold within this window will trigger protective actions.
                    </p>
                  </div>
                </div>
              </div>

              {/* Protective Actions Section */}
              <div className="p-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  How to Handle Violations (Protective Actions)
                </h3>

                {/* Email Alert */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Send Email Alert To:
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="webmaster@example.com"
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-2xs text-slate-500 mt-1">
                    Receive an immediate email notification whenever the login threshold is exceeded.
                  </p>
                </div>

                {/* Redirect URL */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL to Redirect Leech Users To (Optional):
                  </label>
                  <input
                    type="url"
                    value={redirectInput}
                    onChange={(e) => setRedirectInput(e.target.value)}
                    placeholder="https://example.com/unauthorized.html"
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-2xs text-slate-500 mt-1">
                    If specified, requests violating policy are redirected (302) to this page. Otherwise, HTTP 403 Forbidden is returned.
                  </p>
                </div>

                {/* Disable Compromised Accounts Checkbox */}
                <div className="pt-2">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={disableAccountsCheck}
                      onChange={(e) => setDisableAccountsCheck(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Disable Compromised Accounts
                      </span>
                      <p className="text-2xs text-slate-500 mt-0.5">
                        If checked, the account credentials used to breach the threshold will be immediately suspended in <span className="font-mono text-slate-700">.htpasswd</span> to prevent further abuse.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Temporary Block Duration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Temporary IP Block Duration
                    </label>
                    <select
                      value={blockDurationInput}
                      onChange={(e) => setBlockDurationInput(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="60">1 Hour</option>
                      <option value="120">2 Hours (Default)</option>
                      <option value="360">6 Hours</option>
                      <option value="1440">24 Hours</option>
                      <option value="10080">7 Days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Whitelist IPs (One per line)
                    </label>
                    <textarea
                      rows={2}
                      value={whitelistText}
                      onChange={(e) => setWhitelistText(e.target.value)}
                      placeholder="198.51.100.10&#10;203.0.113.5"
                      className="w-full text-xs font-mono p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="p-5 bg-slate-50/50 flex items-center justify-between rounded-b-lg">
                <div className="text-xs text-slate-500 flex items-center space-x-1.5">
                  <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Updates <span className="font-mono text-slate-700">.htaccess</span> and sliding window detection immediately.</span>
                </div>
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-xs text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>

            {/* Directives Inspector */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div
                onClick={() => setShowHtaccessPreview(!showHtaccessPreview)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <FileCode className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Active Apache .htaccess Managed Block
                  </span>
                  <span className="text-2xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                    {dirConfig.rulesOnDisk ? 'Directives Enforced' : 'No Active Directives'}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showHtaccessPreview ? 'rotate-180' : ''}`} />
              </div>

              {showHtaccessPreview && (
                <div className="border-t border-slate-200 p-4 bg-slate-900 text-slate-200">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                    <span className="text-2xs font-mono text-slate-400">
                      File: {dirConfig.htaccessPath}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyHtaccess}
                      className="inline-flex items-center px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-2xs font-medium transition-colors"
                    >
                      {copiedHtaccess ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          Copy Directives
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="font-mono text-2xs overflow-x-auto p-2 bg-slate-950 rounded border border-slate-800 text-purple-400 whitespace-pre">
                    {dirConfig.htaccessSnippet || '# No active leech directives generated on disk.'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Active IP Blocks */}
      {activeTab === 'blocks' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center">
                <Ban className="w-4 h-4 mr-2 text-red-600" />
                Active Leech IP Blocks
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Client IPs currently blocked from accessing your protected directories due to threshold violations.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              Total: {activeBlocks.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-2.5 px-4">Blocked IP</th>
                  <th className="py-2.5 px-4">Directory</th>
                  <th className="py-2.5 px-4">Compromised User</th>
                  <th className="py-2.5 px-4">Attempts</th>
                  <th className="py-2.5 px-4">Blocked At</th>
                  <th className="py-2.5 px-4">Expires At</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {activeBlocks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                      <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      No active IP blocks. Client traffic is currently within safe limits.
                    </td>
                  </tr>
                ) : (
                  activeBlocks.map(b => (
                    <tr key={b.id || b.ip} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-red-700">{b.ip}</td>
                      <td className="py-2.5 px-4 text-slate-700 font-sans">{b.directory}</td>
                      <td className="py-2.5 px-4 text-slate-600">{b.authUser || '-'}</td>
                      <td className="py-2.5 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold border border-red-100">
                          {b.attemptsCount}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-2xs">
                        {new Date(b.blockedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-2xs">
                        {new Date(b.expiresAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleUnblock(b)}
                          disabled={unblockingIp === (b.id || b.ip)}
                          className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-2xs font-sans font-medium transition-colors"
                        >
                          {unblockingIp === (b.id || b.ip) ? 'Unblocking...' : 'Unblock'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Violation Events History */}
      {activeTab === 'events' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center">
                <Bell className="w-4 h-4 mr-2 text-amber-500" />
                Recent Leech Violation Events
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit history of threshold violations detected across your account directories.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              Total: {events.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Directory</th>
                  <th className="py-2.5 px-4">Offending IP</th>
                  <th className="py-2.5 px-4">Compromised User</th>
                  <th className="py-2.5 px-4">Action Taken</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                      <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      No violation events recorded yet.
                    </td>
                  </tr>
                ) : (
                  events.map(ev => (
                    <tr key={ev.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 text-slate-500 text-2xs">
                        {new Date(ev.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-slate-800 font-sans font-medium">{ev.directory}</td>
                      <td className="py-2.5 px-4 font-bold text-red-600">{ev.ip}</td>
                      <td className="py-2.5 px-4 text-slate-700">{ev.authUser}</td>
                      <td className="py-2.5 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded text-3xs font-bold uppercase bg-amber-100 text-amber-800">
                          {ev.actionTaken}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-sans text-2xs">{ev.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Live Simulator Console */}
      {activeTab === 'simulator' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-6 space-y-6 max-w-2xl">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
            <Zap className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-sm font-bold text-slate-800">Live Leech Protection Simulator</h2>
              <p className="text-xs text-slate-500">
                Simulate rapid authentication requests to verify sliding window threshold enforcement and protective actions.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Directory
              </label>
              <input
                type="text"
                value={selectedDirectory}
                readOnly
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 bg-slate-50 rounded-md text-slate-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Simulated Client IP
                </label>
                <input
                  type="text"
                  value={simIp}
                  onChange={(e) => setSimIp(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Auth User
                </label>
                <input
                  type="text"
                  value={simUser}
                  onChange={(e) => setSimUser(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSimulate}
              disabled={simSimulating}
              className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-xs text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Play className={`w-3.5 h-3.5 mr-1.5 ${simSimulating ? 'animate-spin' : ''}`} />
              {simSimulating ? 'Simulating...' : 'Simulate Login Request'}
            </button>

            {simResult && (
              <div
                className={`p-4 rounded-lg border text-xs space-y-2 mt-4 ${
                  simResult.blocked
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>
                    {simResult.blocked
                      ? 'LEECH DETECTED - ACCESS BLOCKED'
                      : 'REQUEST ALLOWED (WITHIN LIMITS)'}
                  </span>
                  <span className="font-mono text-2xs px-1.5 py-0.5 rounded bg-white/70">
                    HTTP {simResult.blocked ? (simResult.statusCode || 403) : 200}
                  </span>
                </div>
                {simResult.reason && (
                  <p className="text-2xs leading-relaxed">{simResult.reason}</p>
                )}
                {!simResult.blocked && (
                  <p className="text-2xs font-mono">
                    Current attempts: {simResult.currentAttempts} / {simResult.threshold} (Remaining before block: {simResult.remaining})
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
