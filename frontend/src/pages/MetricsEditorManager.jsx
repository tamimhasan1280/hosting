import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  HardDrive,
  HelpCircle,
  History,
  Info,
  Layers,
  PieChart,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Shield,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Users,
  X
} from 'lucide-react';
import { api } from '../services/api';

export default function MetricsEditorManager({ onBack, onNavigate, user }) {
  const cpanelUser = user || 'cpanel_user';

  // State
  const [configData, setConfigData] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('example.com');

  // Working draft state for modifications
  const [defaultMetric, setDefaultMetric] = useState('awstats');
  const [domainSettings, setDomainSettings] = useState({});
  const [accountMetrics, setAccountMetrics] = useState({ webalizer_ftp: true });
  const [configVersion, setConfigVersion] = useState(1);

  // UI States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Fetch configuration
  const loadConfig = () => {
    setLoading(true);
    setErrorMessage(null);

    api.getMetricsEditorConfig(cpanelUser)
      .then(res => {
        if (res && res.success) {
          const cfg = res.config || {};
          setConfigData(cfg);
          setCapabilities(res.capabilities || {});
          const domList = res.domains || [{ name: 'example.com', type: 'Primary Domain' }];
          setDomains(domList);

          if (domList.length > 0 && !domList.some(d => d.name === selectedDomain)) {
            setSelectedDomain(domList[0].name);
          }

          setDefaultMetric(cfg.defaultMetric || 'awstats');
          setDomainSettings(cfg.domains || {});
          setAccountMetrics(cfg.accountMetrics || { webalizer_ftp: true });
          setConfigVersion(cfg.version || 1);
          setIsDirty(false);
        } else {
          setErrorMessage(res?.error || 'Failed to load Metrics Editor configuration.');
        }
      })
      .catch(err => {
        console.error('Failed to load metrics config:', err);
        setErrorMessage(err.response?.data?.error || err.message || 'Error communicating with Metrics Editor.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadConfig();
  }, [cpanelUser]);

  // Load audit logs
  const loadAuditLogs = () => {
    setLoadingAudit(true);
    api.getMetricsEditorAudit(cpanelUser)
      .then(res => {
        if (res && res.success) {
          setAuditLogs(res.logs || []);
        }
      })
      .catch(err => {
        console.error('Failed to load audit logs:', err);
      })
      .finally(() => {
        setLoadingAudit(false);
      });
  };

  // Toggle domain metric setting
  const handleToggleDomainMetric = (domName, metricId) => {
    const current = domainSettings[domName]?.[metricId] !== false;
    const newSettings = {
      ...domainSettings,
      [domName]: {
        ...(domainSettings[domName] || {}),
        [metricId]: !current
      }
    };
    setDomainSettings(newSettings);
    setIsDirty(true);
  };

  // Toggle account-level metric setting
  const handleToggleAccountMetric = (metricId) => {
    const current = accountMetrics[metricId] !== false;
    setAccountMetrics({
      ...accountMetrics,
      [metricId]: !current
    });
    setIsDirty(true);
  };

  // Set default statistics software
  const handleSelectDefaultMetric = (metricId) => {
    if (defaultMetric !== metricId) {
      setDefaultMetric(metricId);
      setIsDirty(true);
    }
  };

  // Save changes
  const handleSave = () => {
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    api.updateMetricsEditorConfig({
      cpanelUser,
      defaultMetric,
      domainSettings,
      accountSettings: accountMetrics,
      expectedVersion: configVersion
    })
      .then(res => {
        if (res && res.success) {
          setStatusMessage('Metrics configuration updated successfully.');
          setConfigData(res.config);
          setConfigVersion(res.config.version);
          setIsDirty(false);
          setTimeout(() => setStatusMessage(null), 5000);
        } else {
          setErrorMessage(res?.error || 'Failed to save metrics configuration.');
        }
      })
      .catch(err => {
        console.error('Failed to save metrics config:', err);
        setErrorMessage(err.response?.data?.error || err.message || 'Save failed. Concurrency conflict or validation error.');
      })
      .finally(() => {
        setSaving(false);
      });
  };

  // Reset to system defaults
  const handleReset = () => {
    setResetting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    api.resetMetricsEditorConfig({ cpanelUser })
      .then(res => {
        if (res && res.success) {
          setShowResetConfirm(false);
          setStatusMessage('Metrics configuration has been reset to system defaults.');
          const cfg = res.config;
          setConfigData(cfg);
          setDefaultMetric(cfg.defaultMetric);
          setDomainSettings(cfg.domains);
          setAccountMetrics(cfg.accountMetrics);
          setConfigVersion(cfg.version);
          setIsDirty(false);
          setTimeout(() => setStatusMessage(null), 5000);
        } else {
          setErrorMessage(res?.error || 'Failed to reset metrics configuration.');
        }
      })
      .catch(err => {
        console.error('Failed to reset metrics config:', err);
        setErrorMessage(err.response?.data?.error || err.message || 'Reset failed.');
      })
      .finally(() => {
        setResetting(false);
      });
  };

  const activeDomainSettings = domainSettings[selectedDomain] || {
    awstats: true,
    webalizer: true,
    analog_stats: true
  };

  const defaultMetricOptions = [
    {
      id: 'awstats',
      name: 'Awstats',
      tagline: 'Advanced Visual Analytics',
      desc: 'Comprehensive visitor tracking, country/region maps, operating systems, search engines, and automated bot separation.',
      icon: PieChart,
      color: 'text-purple-600 dark:text-purple-400',
      badge: 'Recommended'
    },
    {
      id: 'webalizer',
      name: 'Webalizer',
      tagline: 'Standard Hourly Statistics',
      desc: 'Classic visual server statistics, hourly breakdown graphs, total hits, and entry/exit URL analyses.',
      icon: BarChart3,
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      id: 'analog_stats',
      name: 'Analog Stats',
      tagline: 'Lightweight & Ultra-Fast',
      desc: 'High-speed textual summary statistics, status code breakdowns, and low-overhead daily activity reports.',
      icon: BarChart2,
      color: 'text-emerald-600 dark:text-emerald-400'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <nav className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
            <button
              onClick={() => onNavigate && onNavigate('dashboard')}
              className="hover:text-blue-600 transition-colors"
            >
              cPanel
            </button>
            <ChevronRight className="w-3 h-3" />
            <span className="hover:text-blue-600 cursor-pointer" onClick={onBack}>Metrics</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-800 dark:text-gray-200 font-semibold">Metrics Editor</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Metrics Editor
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 font-normal">
                  Log Program Preferences
                </span>
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Choose which metrics programs run for your domains and select your account's default statistics software
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              ← Go Back
            </button>
          )}
          <button
            onClick={loadConfig}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              setShowAuditDrawer(true);
              loadAuditLogs();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <History className="w-3.5 h-3.5 text-gray-500" />
            <span>Audit Trail</span>
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={loading || saving || resetting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/60 transition disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving || loading}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
            <span>{saving ? 'Saving Changes...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-800 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Dirty state floating bar */}
      {isDirty && (
        <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 p-3 rounded-lg flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>You have unsaved changes to your metrics configuration. Click <strong>Save Changes</strong> to apply them.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadConfig}
              className="px-2.5 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 flex items-center gap-1"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>
          </div>
        </div>
      )}

      {/* Section 1: Default Statistics Software Selector */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-500" />
              Default Statistics Software
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Select which analytics tool opens by default when accessing general web metrics
            </p>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            Version #{configVersion}
          </span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {defaultMetricOptions.map(opt => {
            const isSelected = defaultMetric === opt.id;
            const Icon = opt.icon;
            return (
              <div
                key={opt.id}
                onClick={() => handleSelectDefaultMetric(opt.id)}
                className={`border rounded-lg p-4 cursor-pointer transition-all relative ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm ring-1 ring-blue-600'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-md bg-gray-100 dark:bg-gray-700 ${opt.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        {opt.name}
                        {opt.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 font-normal">
                            {opt.badge}
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                        {opt.tagline}
                      </p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mt-2">
                  {opt.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Domain-Level Web Analytics Software Configuration */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              Domain-Level Log Programs
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Select which log analysis software processes web traffic data for this domain
            </p>
          </div>

          {/* Domain Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Domain:
            </label>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
            >
              {domains.map(d => (
                <option key={d.name} value={d.name}>
                  {d.name} ({d.type || 'Domain'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Programs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 font-medium">
              <tr>
                <th className="px-4 py-2.5">Program Name</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Engine / Version</th>
                <th className="px-4 py-2.5">Current Status</th>
                <th className="px-4 py-2.5 text-right">Action / Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {/* Awstats */}
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-purple-500" />
                    <div>
                      <strong className="text-gray-900 dark:text-white">Awstats</strong>
                      <p className="text-[11px] text-gray-500">Advanced graphical analytics and visitor tracking</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Web Traffic Analytics</td>
                <td className="px-4 py-3 font-mono text-[11px] text-gray-500">cPanel Embedded (Awstats 7.9)</td>
                <td className="px-4 py-3">
                  {activeDomainSettings.awstats !== false ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold">
                      Enabled
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 font-semibold">
                      Disabled
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleToggleDomainMetric(selectedDomain, 'awstats')}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition ${
                      activeDomainSettings.awstats !== false
                        ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    }`}
                  >
                    {activeDomainSettings.awstats !== false ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>

              {/* Webalizer */}
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    <div>
                      <strong className="text-gray-900 dark:text-white">Webalizer</strong>
                      <p className="text-[11px] text-gray-500">Standard visual server statistics and hourly logs</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Web Traffic Analytics</td>
                <td className="px-4 py-3 font-mono text-[11px] text-gray-500">cPanel Embedded (Webalizer 2.23)</td>
                <td className="px-4 py-3">
                  {activeDomainSettings.webalizer !== false ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold">
                      Enabled
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 font-semibold">
                      Disabled
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleToggleDomainMetric(selectedDomain, 'webalizer')}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition ${
                      activeDomainSettings.webalizer !== false
                        ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    }`}
                  >
                    {activeDomainSettings.webalizer !== false ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>

              {/* Analog Stats */}
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-emerald-500" />
                    <div>
                      <strong className="text-gray-900 dark:text-white">Analog Stats</strong>
                      <p className="text-[11px] text-gray-500">Lightweight, ultra-fast summary and daily stats</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Web Traffic Analytics</td>
                <td className="px-4 py-3 font-mono text-[11px] text-gray-500">cPanel Embedded (Analog 6.0)</td>
                <td className="px-4 py-3">
                  {activeDomainSettings.analog_stats !== false ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold">
                      Enabled
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 font-semibold">
                      Disabled
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleToggleDomainMetric(selectedDomain, 'analog_stats')}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition ${
                      activeDomainSettings.analog_stats !== false
                        ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    }`}
                  >
                    {activeDomainSettings.analog_stats !== false ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Account-Level FTP Analytics Program */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-500" />
            Account-Level Metrics Software
          </h2>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Configure log analysis programs that operate across all FTP and server accounts
          </p>
        </div>

        <div className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  Webalizer FTP
                  {accountMetrics.webalizer_ftp !== false ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold">
                      Enabled
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 font-semibold">
                      Disabled
                    </span>
                  )}
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Processes RFC 959 xferlog records for all FTP accounts assigned to your hosting user.
                </p>
              </div>
            </div>

            <div>
              <button
                onClick={() => handleToggleAccountMetric('webalizer_ftp')}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  accountMetrics.webalizer_ftp !== false
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                }`}
              >
                {accountMetrics.webalizer_ftp !== false ? 'Disable Webalizer FTP' : 'Enable Webalizer FTP'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Server-Managed Infrastructure Metrics (Always Active) */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-gray-500" />
              Core Server Metrics (Server-Managed)
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Core logging and quota accounting features that operate continuously at the web server level
            </p>
          </div>
          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-[11px] font-medium">
            Always Active
          </span>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {[
            {
              id: 'visitors',
              name: 'Visitors',
              icon: Users,
              color: 'text-indigo-500',
              desc: 'Real-time HTTP access logging and recent visitor trace inspection.',
              rationale: 'Active web server logging is required for operational integrity and access auditing.'
            },
            {
              id: 'errors',
              name: 'Errors',
              icon: AlertCircle,
              color: 'text-red-500',
              desc: 'Apache / Nginx error logging and HTTP diagnostic log inspection.',
              rationale: 'Error logging is managed at web server level and cannot be disabled per account.'
            },
            {
              id: 'bandwidth',
              name: 'Bandwidth',
              icon: Globe,
              color: 'text-blue-500',
              desc: 'Network transfer monitoring, billing cycle tracking, and quota accounting.',
              rationale: 'Bandwidth accounting is an essential hosting quota management system.'
            },
            {
              id: 'raw_access',
              name: 'Raw Access',
              icon: FileText,
              color: 'text-emerald-500',
              desc: 'Raw Apache web server access log storage and automatic compression archival.',
              rationale: 'Raw access log generation is an integral web server function.'
            }
          ].map(m => {
            const Icon = m.icon;
            return (
              <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded bg-gray-100 dark:bg-gray-700 ${m.color} mt-0.5`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {m.name}
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-semibold">
                        Managed by server
                      </span>
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.desc}</p>
                    <p className="text-[11px] text-gray-400 italic mt-0.5">{m.rationale}</p>
                  </div>
                </div>
                <div className="sm:text-right">
                  <span className="text-[11px] text-gray-400 font-mono">Non-configurable</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit History Drawer Modal */}
      {showAuditDrawer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-blue-500" />
                Metrics Configuration Audit Trail
              </h3>
              <button
                onClick={() => setShowAuditDrawer(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingAudit ? (
                <div className="p-8 text-center text-gray-500 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                  Loading audit events...
                </div>
              ) : auditLogs.length > 0 ? (
                auditLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                      <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-mono font-semibold">
                        {log.action}
                      </span>
                    </div>
                    <div className="text-gray-800 dark:text-gray-200">
                      <strong>User:</strong> {log.user}
                    </div>
                    {log.details && (
                      <pre className="p-2 bg-gray-100 dark:bg-gray-800 rounded font-mono text-[10px] text-gray-600 dark:text-gray-400 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 text-xs">
                  No configuration change events logged yet.
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-right">
              <button
                onClick={() => setShowAuditDrawer(false)}
                className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Reset Metrics Configuration?
              </h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              This will reset all metrics configuration back to system defaults. Awstats will be set as your default statistics application, and all available log programs will be enabled for your domains.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded shadow-sm flex items-center gap-1.5"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
                <span>{resetting ? 'Resetting...' : 'Confirm Reset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
