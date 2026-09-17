import React, { useState, useEffect } from 'react';
import { 
  Globe, ExternalLink, RefreshCw, Shield, AlertTriangle, CheckCircle2, 
  Settings, Database, Layers, FileCode, Lock, HardDrive, Info, 
  ChevronDown, ChevronRight, ToggleLeft, ToggleRight, Sparkles, Search
} from 'lucide-react';
import { api } from '../services/api';

export default function WordPressManagement({ onBack, user = 'cpanel_user' }) {
  const [installations, setInstallations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedInst, setExpandedInst] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'plugins' | 'themes' | 'config'
  const [toast, setToast] = useState(null);
  const [updatingConfig, setUpdatingConfig] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInstallations = async () => {
    try {
      setLoading(true);
      const res = await api.getWordPressInstallations(user);
      if (res && res.installations) {
        setInstallations(res.installations);
        if (res.installations.length > 0 && !expandedInst) {
          setExpandedInst(res.installations[0].id);
        }
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to load WordPress installations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstallations();
  }, [user]);

  const handleScan = async () => {
    try {
      setScanning(true);
      const res = await api.scanWordPress(user);
      if (res && res.installations) {
        setInstallations(res.installations);
        showToast(`Scan complete. Found ${res.installations.length} WordPress installation(s).`);
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to scan for installations', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleToggleMaintenance = async (inst) => {
    try {
      setUpdatingConfig(true);
      const newStatus = !inst.isMaintenance;
      const res = await api.toggleWordPressMaintenance({
        path: inst.path,
        enable: newStatus,
        cpanelUser: user
      });
      if (res.success) {
        setInstallations(prev => prev.map(i => i.id === inst.id ? { ...i, isMaintenance: newStatus } : i));
        showToast(`Maintenance mode ${newStatus ? 'enabled' : 'disabled'} for ${inst.domain}`);
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to toggle maintenance mode', 'error');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleConfigUpdate = async (inst, key, value) => {
    try {
      setUpdatingConfig(true);
      const updates = { [key]: value };
      const res = await api.updateWordPressConfig({
        path: inst.path,
        updates,
        cpanelUser: user
      });
      if (res.success && res.installation) {
        setInstallations(prev => prev.map(i => i.id === inst.id ? res.installation : i));
        showToast(`Updated setting for ${inst.domain}`);
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to update setting', 'error');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const filteredInstallations = installations.filter(inst => {
    const q = searchQuery.toLowerCase();
    return inst.name.toLowerCase().includes(q) || inst.path.toLowerCase().includes(q) || inst.domain.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all ${
          toast.type === 'error' 
            ? 'bg-rose-50 border-rose-200 text-rose-800' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span className="hover:text-slate-800 cursor-pointer" onClick={onBack}>cPanel</span>
            <span>/</span>
            <span>Domains</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">WordPress Management</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-[#ff6c2c]" />
            WordPress Management
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Discover, inspect, and configure WordPress installations located across your domains and document roots.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleScan}
            disabled={scanning || loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin text-[#ff6c2c]' : 'text-slate-500'}`} />
            {scanning ? 'Scanning Filesystem...' : 'Scan for Installations'}
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-[#ff6c2c] rounded-lg">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{installations.length}</div>
            <div className="text-xs text-slate-500 font-medium">Active Installations</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {installations.reduce((acc, i) => acc + (i.plugins?.length || 0), 0)}
            </div>
            <div className="text-xs text-slate-500 font-medium">Installed Plugins</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">92%</div>
            <div className="text-xs text-slate-500 font-medium">Average Security Score</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {installations[0]?.diskUsage?.formatted || '0 MB'}
            </div>
            <div className="text-xs text-slate-500 font-medium">Total Disk Footprint</div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Filter installations by domain or path..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
        />
      </div>

      {/* Installations List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <RefreshCw className="w-8 h-8 text-[#ff6c2c] animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">Inspecting WordPress installations...</p>
          <p className="text-xs text-slate-400 mt-1">Reading wp-config.php and site configurations</p>
        </div>
      ) : filteredInstallations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <Globe className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No WordPress Installations Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
            No WordPress directories were detected in your public_html or document roots. Click scan to search recursively.
          </p>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#ff6c2c] text-white rounded-lg text-sm font-semibold hover:bg-[#e05819] transition"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            Scan Account Now
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInstallations.map((inst) => {
            const isExpanded = expandedInst === inst.id;
            return (
              <div key={inst.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                {/* Header Summary */}
                <div 
                  onClick={() => setExpandedInst(isExpanded ? null : inst.id)}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 border-b border-transparent"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-orange-100/60 text-[#ff6c2c] rounded-xl mt-0.5">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-slate-900">{inst.name}</h2>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full">
                          v{inst.version}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                          {inst.phpVersion}
                        </span>
                        {inst.isMaintenance && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Maintenance Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                        <span><strong>Root:</strong> {inst.path}</span>
                        <span>•</span>
                        <span><strong>Database:</strong> {inst.database.name} ({inst.database.host})</span>
                        <span>•</span>
                        <span><strong>Size:</strong> {inst.diskUsage?.formatted}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end lg:self-center" onClick={e => e.stopPropagation()}>
                    <a
                      href={inst.adminUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ff6c2c] hover:bg-[#e05819] text-white text-xs font-semibold rounded-lg shadow-sm transition"
                    >
                      <span>WP Admin</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <a
                      href={inst.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition"
                    >
                      <span>Visit Site</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <button
                      onClick={() => setExpandedInst(isExpanded ? null : inst.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                    >
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50/40 p-5 space-y-5">
                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                      <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                          activeTab === 'overview'
                            ? 'bg-white text-[#ff6c2c] shadow-sm border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Overview & Health
                      </button>

                      <button
                        onClick={() => setActiveTab('plugins')}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                          activeTab === 'plugins'
                            ? 'bg-white text-[#ff6c2c] shadow-sm border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Plugins ({inst.plugins?.length || 0})
                      </button>

                      <button
                        onClick={() => setActiveTab('themes')}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                          activeTab === 'themes'
                            ? 'bg-white text-[#ff6c2c] shadow-sm border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Themes ({inst.themes?.length || 0})
                      </button>

                      <button
                        onClick={() => setActiveTab('config')}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                          activeTab === 'config'
                            ? 'bg-white text-[#ff6c2c] shadow-sm border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Settings className="w-3.5 h-3.5" />
                        wp-config Settings
                      </button>
                    </div>

                    {/* Tab 1: Overview & Health */}
                    {activeTab === 'overview' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Shield className="w-4 h-4 text-emerald-600" /> Security & Health Checks
                          </h4>
                          <div className="space-y-2">
                            {inst.health?.checks?.map(check => (
                              <div key={check.id} className="flex items-start gap-2.5 text-xs py-1.5 border-b border-slate-100 last:border-none">
                                {check.status === 'passed' ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                )}
                                <div>
                                  <div className="font-semibold text-slate-800">{check.title}</div>
                                  <div className="text-slate-500">{check.detail}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Database className="w-4 h-4 text-blue-600" /> Environment Details
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1.5 border-b border-slate-100">
                              <span className="text-slate-500">Database Name:</span>
                              <span className="font-mono font-medium text-slate-800">{inst.database.name}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-slate-100">
                              <span className="text-slate-500">Database User:</span>
                              <span className="font-mono font-medium text-slate-800">{inst.database.user}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-slate-100">
                              <span className="text-slate-500">Table Prefix:</span>
                              <span className="font-mono font-medium text-slate-800">{inst.tablePrefix}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-slate-100">
                              <span className="text-slate-500">Active Theme:</span>
                              <span className="font-medium text-slate-800">{inst.activeTheme}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-slate-100">
                              <span className="text-slate-500">SSL Certificate:</span>
                              <span className="font-medium text-emerald-600">{inst.sslStatus}</span>
                            </div>
                            <div className="flex justify-between py-1.5">
                              <span className="text-slate-500">PHP Version:</span>
                              <span className="font-medium text-slate-800">{inst.phpVersion}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Plugins */}
                    {activeTab === 'plugins' && (
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="p-3">Plugin Name</th>
                              <th className="p-3">Version</th>
                              <th className="p-3">Author</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {inst.plugins?.map((p, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/60">
                                <td className="p-3 font-semibold text-slate-800">{p.name}</td>
                                <td className="p-3 font-mono">{p.version || '1.0.0'}</td>
                                <td className="p-3">{p.author || 'WordPress Community'}</td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded-full">
                                    {p.status || 'Active'}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-500 max-w-xs truncate">{p.description || 'No description available.'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Tab 3: Themes */}
                    {activeTab === 'themes' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {inst.themes?.map((t, idx) => (
                          <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-slate-800">{t.name}</span>
                              {t.active && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-full">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">v{t.version || '1.0.0'} • by {t.author || 'WordPress Community'}</div>
                            <p className="text-xs text-slate-600 line-clamp-2">{t.description}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tab 4: wp-config Settings */}
                    {activeTab === 'config' && (
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Settings className="w-4 h-4 text-[#ff6c2c]" /> Configurable Directives
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Maintenance Mode */}
                          <div className="p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-xs text-slate-800">Maintenance Mode</div>
                              <div className="text-[11px] text-slate-500">Temporarily displays maintenance splash to visitors</div>
                            </div>
                            <button
                              onClick={() => handleToggleMaintenance(inst)}
                              disabled={updatingConfig}
                              className="text-slate-600 hover:text-slate-900 transition"
                            >
                              {inst.isMaintenance ? (
                                <ToggleRight className="w-8 h-8 text-[#ff6c2c]" />
                              ) : (
                                <ToggleLeft className="w-8 h-8 text-slate-300" />
                              )}
                            </button>
                          </div>

                          {/* WP Debug */}
                          <div className="p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-xs text-slate-800">WP_DEBUG</div>
                              <div className="text-[11px] text-slate-500">Enable PHP debug logging for developers</div>
                            </div>
                            <button
                              onClick={() => handleConfigUpdate(inst, 'wpDebug', !inst.wpDebug)}
                              disabled={updatingConfig}
                              className="text-slate-600 hover:text-slate-900 transition"
                            >
                              {inst.wpDebug ? (
                                <ToggleRight className="w-8 h-8 text-[#ff6c2c]" />
                              ) : (
                                <ToggleLeft className="w-8 h-8 text-slate-300" />
                              )}
                            </button>
                          </div>

                          {/* File Editor Protection */}
                          <div className="p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-xs text-slate-800">DISALLOW_FILE_EDIT</div>
                              <div className="text-[11px] text-slate-500">Disable code editing inside WP Admin</div>
                            </div>
                            <button
                              onClick={() => handleConfigUpdate(inst, 'disallowFileEdit', !inst.disallowFileEdit)}
                              disabled={updatingConfig}
                              className="text-slate-600 hover:text-slate-900 transition"
                            >
                              {inst.disallowFileEdit ? (
                                <ToggleRight className="w-8 h-8 text-[#ff6c2c]" />
                              ) : (
                                <ToggleLeft className="w-8 h-8 text-slate-300" />
                              )}
                            </button>
                          </div>

                          {/* Auto Updates */}
                          <div className="p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-xs text-slate-800">Automatic Updates</div>
                              <div className="text-[11px] text-slate-500">Auto-install minor core security updates</div>
                            </div>
                            <button
                              onClick={() => handleConfigUpdate(inst, 'autoUpdates', !inst.autoUpdates)}
                              disabled={updatingConfig}
                              className="text-slate-600 hover:text-slate-900 transition"
                            >
                              {inst.autoUpdates ? (
                                <ToggleRight className="w-8 h-8 text-[#ff6c2c]" />
                              ) : (
                                <ToggleLeft className="w-8 h-8 text-slate-300" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
