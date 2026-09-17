import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  Globe,
  HelpCircle,
  Info,
  Layers,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Save,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Wrench,
  X,
  Zap
} from 'lucide-react';
import { api } from '../services/api';

export default function HotlinkProtectionManager({ onBack, onNavigate, user }) {
  const cpanelUser = user || 'cpanel_user';

  // Data states
  const [capabilities, setCapabilities] = useState(null);
  const [config, setConfig] = useState({
    enabled: false,
    allowedDomains: [],
    protectedExtensions: [],
    allowEmptyReferer: true,
    redirectUrl: '',
    accountDomains: [],
    htaccessPath: '',
    htaccessExists: false,
    rulesActive: false,
    inSync: true
  });

  // Form states
  const [allowedDomainsText, setAllowedDomainsText] = useState('');
  const [extensionsText, setExtensionsText] = useState('');
  const [allowEmptyReferer, setAllowEmptyReferer] = useState(true);
  const [redirectUrl, setRedirectUrl] = useState('');

  // UI states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [copiedHtaccess, setCopiedHtaccess] = useState(false);
  const [showHtaccessPreview, setShowHtaccessPreview] = useState(false);

  // Simulator states
  const [testPath, setTestPath] = useState('/site/images/logo.png');
  const [testReferer, setTestReferer] = useState('https://unauthorized-stealer.com');
  const [testTesting, setTestTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Load config & capabilities
  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setErrorMessage(null);

    try {
      const [capsRes, cfgRes] = await Promise.all([
        api.getHotlinkCapabilities().catch(e => ({ success: false, error: e.message })),
        api.getHotlinkConfig(cpanelUser).catch(e => ({ success: false, error: e.message }))
      ]);

      if (capsRes && capsRes.success) {
        setCapabilities(capsRes);
      }
      if (cfgRes && cfgRes.success && cfgRes.config) {
        const c = cfgRes.config;
        setConfig(c);
        setAllowedDomainsText(c.allowedDomains.join('\n'));
        setExtensionsText(c.protectedExtensions.join(','));
        setAllowEmptyReferer(c.allowEmptyReferer);
        setRedirectUrl(c.redirectUrl || '');
      } else if (cfgRes && !cfgRes.success) {
        setErrorMessage(cfgRes.error || 'Failed to load Hotlink Protection settings.');
      }
    } catch (err) {
      console.error('Error loading hotlink protection data:', err);
      setErrorMessage(err.message || 'Error communicating with Hotlink Protection API.');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [cpanelUser]);

  // Handle Save
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const domains = allowedDomainsText
        .split('\n')
        .map(d => d.trim())
        .filter(Boolean);

      const exts = extensionsText
        .split(',')
        .map(e => e.trim().replace(/^\./, '').toLowerCase())
        .filter(Boolean);

      const res = await api.saveHotlinkConfig({
        cpanelUser,
        enabled: config.enabled,
        allowedDomains: domains,
        protectedExtensions: exts,
        allowEmptyReferer,
        redirectUrl: redirectUrl.trim()
      });

      if (res && res.success) {
        setSuccessMessage(res.message || 'Hotlink protection configuration saved successfully!');
        if (res.config) {
          setConfig(res.config);
          setAllowedDomainsText(res.config.allowedDomains.join('\n'));
          setExtensionsText(res.config.protectedExtensions.join(','));
          setAllowEmptyReferer(res.config.allowEmptyReferer);
          setRedirectUrl(res.config.redirectUrl || '');
        }
      } else {
        setErrorMessage(res?.error || 'Failed to save configuration.');
      }
    } catch (err) {
      console.error('Error saving hotlink config:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Error saving configuration.');
    } finally {
      setSaving(false);
    }
  };

  // Handle Enable / Disable Toggle
  const handleToggle = async (desiredState) => {
    setToggling(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.toggleHotlinkProtection({
        cpanelUser,
        enabled: desiredState
      });

      if (res && res.success) {
        setSuccessMessage(res.message || `Hotlink protection has been ${desiredState ? 'enabled' : 'disabled'}.`);
        if (res.config) {
          setConfig(res.config);
        } else {
          loadData();
        }
      } else {
        setErrorMessage(res?.error || 'Failed to toggle protection state.');
      }
    } catch (err) {
      console.error('Error toggling hotlink protection:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Error updating protection status.');
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
      const res = await api.repairHotlinkConfig(cpanelUser);
      if (res && res.success) {
        setSuccessMessage(res.message || '.htaccess hotlink rewrite block synchronized successfully!');
        if (res.config) {
          setConfig(res.config);
        } else {
          loadData();
        }
      } else {
        setErrorMessage(res?.error || 'Failed to repair .htaccess rules.');
      }
    } catch (err) {
      console.error('Error repairing hotlink rules:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Error repairing .htaccess.');
    } finally {
      setRepairing(false);
    }
  };

  // Add default account domains helper
  const handleAddAccountDomains = () => {
    const existing = new Set(allowedDomainsText.split('\n').map(d => d.trim().toLowerCase()).filter(Boolean));
    const toAdd = [];

    (config.accountDomains || []).forEach(dom => {
      const d = dom.toLowerCase();
      if (!existing.has(d)) toAdd.push(d);
      if (!existing.has(`http://${d}`)) toAdd.push(`http://${d}`);
      if (!existing.has(`https://${d}`)) toAdd.push(`https://${d}`);
      if (!existing.has(`http://www.${d}`)) toAdd.push(`http://www.${d}`);
      if (!existing.has(`https://www.${d}`)) toAdd.push(`https://www.${d}`);
    });

    if (toAdd.length > 0) {
      const newText = allowedDomainsText ? `${allowedDomainsText.trim()}\n${toAdd.join('\n')}` : toAdd.join('\n');
      setAllowedDomainsText(newText);
      setSuccessMessage(`Added ${toAdd.length} standard URL variations for your authorized domains.`);
    } else {
      setSuccessMessage('All account domains are already present in the list.');
    }
  };

  // Extension presets
  const applyPreset = (presetExtensions) => {
    const current = new Set(extensionsText.split(',').map(e => e.trim().toLowerCase()).filter(Boolean));
    presetExtensions.forEach(ext => current.add(ext.toLowerCase()));
    setExtensionsText(Array.from(current).join(','));
  };

  // Live Access Tester
  const handleRunTest = async () => {
    setTestTesting(true);
    setTestResult(null);

    try {
      const res = await api.verifyHotlinkAccess({
        path: testPath.trim(),
        referer: testReferer.trim(),
        user: cpanelUser
      });

      if (res && res.success) {
        setTestResult(res);
      } else {
        setTestResult({
          allowed: false,
          statusCode: 500,
          reason: res?.error || 'Test query failed'
        });
      }
    } catch (err) {
      setTestResult({
        allowed: false,
        statusCode: 500,
        reason: err.message || 'Error executing access verification'
      });
    } finally {
      setTestTesting(false);
    }
  };

  // Copy .htaccess block
  const handleCopyHtaccess = () => {
    if (config.htaccessSnippet) {
      navigator.clipboard.writeText(config.htaccessSnippet);
      setCopiedHtaccess(true);
      setTimeout(() => setCopiedHtaccess(false), 2500);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Breadcrumb Navigation */}
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
        <span className="text-slate-800 font-semibold">Hotlink Protection</span>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-600 mt-1">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-slate-900">Hotlink Protection</h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  config.enabled
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {config.enabled ? 'Enabled' : 'Disabled'}
              </span>
              {!config.inSync && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Configuration Drift
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1.5 max-w-3xl leading-relaxed">
              Hotlink protection prevents other websites from directly linking to files (such as images and media) on your website.
              When enabled, incoming requests containing unauthorized Referer headers are blocked with <span className="font-mono text-slate-800">403 Forbidden</span> or redirected to a custom warning image.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0 self-start md:self-auto">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center px-3 py-2 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-xs"
            title="Refresh Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {config.enabled ? (
            <button
              onClick={() => handleToggle(false)}
              disabled={toggling || saving}
              className="inline-flex items-center px-4 py-2 border border-red-300 text-xs font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 transition-colors shadow-xs"
            >
              <ToggleLeft className="w-4 h-4 mr-1.5" />
              {toggling ? 'Disabling...' : 'Disable'}
            </button>
          ) : (
            <button
              onClick={() => handleToggle(true)}
              disabled={toggling || saving}
              className="inline-flex items-center px-4 py-2 border border-emerald-600 text-xs font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <ToggleRight className="w-4 h-4 mr-1.5" />
              {toggling ? 'Enabling...' : 'Enable'}
            </button>
          )}
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

      {/* Configuration Drift Warning Banner */}
      {!config.inSync && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start justify-between shadow-xs">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-amber-900">Apache .htaccess Configuration Drift Detected</h4>
              <p className="text-xs text-amber-700 mt-0.5">
                The hotlink rewrite rules in your document root <span className="font-mono text-amber-900 font-semibold">{config.htaccessPath}</span> do not match the database state (or the file was modified externally). Click repair to synchronize the rules without modifying other directives.
              </p>
            </div>
          </div>
          <button
            onClick={handleRepair}
            disabled={repairing}
            className="inline-flex items-center px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium shadow-xs shrink-0 ml-4 transition-colors"
          >
            <Wrench className="w-3.5 h-3.5 mr-1" />
            {repairing ? 'Repairing...' : 'Repair & Sync'}
          </button>
        </div>
      )}

      {/* Main Grid: Settings & Live Access Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Configuration Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="bg-white rounded-lg border border-slate-200 shadow-xs divide-y divide-slate-100">
            {/* Section Header */}
            <div className="p-5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Configure Hotlink Protection</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Specify domains allowed to embed files and select the file extensions to protect.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500">Status:</span>
                <span className={`text-xs font-bold ${config.enabled ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {config.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Allowed Domains Textarea */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  URLs to allow access:
                </label>
                <button
                  type="button"
                  onClick={handleAddAccountDomains}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add All Account Domains & Variations
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Enter all URLs and domains authorized to link to your files (one per line). Include both HTTP, HTTPS, and www variants as applicable.
              </p>
              <textarea
                rows={6}
                value={allowedDomainsText}
                onChange={(e) => setAllowedDomainsText(e.target.value)}
                placeholder="http://example.com&#10;https://example.com&#10;http://www.example.com&#10;https://www.example.com"
                className="w-full font-mono text-xs p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50/50"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-xs text-slate-400 font-medium self-center">Quick Add:</span>
                {config.accountDomains && config.accountDomains.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      const lines = allowedDomainsText.split('\n').map(l => l.trim()).filter(Boolean);
                      if (!lines.includes(d)) lines.push(d);
                      if (!lines.includes(`https://${d}`)) lines.push(`https://${d}`);
                      setAllowedDomainsText(lines.join('\n'));
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-2xs font-mono transition-colors"
                  >
                    + {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Protected Extensions */}
            <div className="p-5 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Block direct access for the following extensions:
              </label>
              <p className="text-xs text-slate-500">
                Comma-separated file extensions that will be protected against external bandwidth theft.
              </p>
              <input
                type="text"
                value={extensionsText}
                onChange={(e) => setExtensionsText(e.target.value)}
                placeholder="jpg,jpeg,gif,png,bmp,webp,svg,mp4"
                className="w-full font-mono text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="flex flex-wrap gap-2 pt-1 items-center">
                <span className="text-xs text-slate-400 font-medium">Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPreset(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'avif'])}
                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-2xs font-medium transition-colors"
                >
                  + Web Images
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(['mp4', 'webm', 'mp3', 'wav', 'ogg', 'mov'])}
                  className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-2xs font-medium transition-colors"
                >
                  + Media & Video
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(['pdf', 'zip', 'tar', 'gz', 'iso'])}
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-2xs font-medium transition-colors"
                >
                  + Documents & Archives
                </button>
                <button
                  type="button"
                  onClick={() => setExtensionsText('jpg,jpeg,gif,png,bmp,webp,svg,avif,mp4,webm,mp3,pdf')}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-2xs font-medium transition-colors"
                >
                  Reset Defaults
                </button>
              </div>
            </div>

            {/* Blank Referer Option */}
            <div className="p-5">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowEmptyReferer}
                  onChange={(e) => setAllowEmptyReferer(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    Allow direct requests (e.g. entering URL in browser with blank Referer)
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Check this box if you want users to be able to view files directly when pasting URLs in their browser address bar, or via clients that omit the Referer header. (Recommended: checked)
                  </p>
                </div>
              </label>
            </div>

            {/* Custom Redirect URL */}
            <div className="p-5 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Redirect requests to this URL (optional):
              </label>
              <p className="text-xs text-slate-500">
                If specified, hotlinked requests will be redirected to this URL (for example, a banner stating &quot;Hotlinking is prohibited&quot;). If left empty, a standard <span className="font-mono text-slate-800">403 Forbidden</span> error is returned.
              </p>
              <input
                type="url"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="https://example.com/hotlink-warning.jpg"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
            </div>

            {/* Action Bar */}
            <div className="p-5 bg-slate-50/50 flex items-center justify-between rounded-b-lg">
              <div className="text-xs text-slate-500 flex items-center space-x-1.5">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Changes will update <span className="font-mono font-medium text-slate-700">.htaccess</span> immediately upon saving.</span>
              </div>
              <button
                type="submit"
                disabled={saving || loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-xs text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Save className="w-4 h-4 mr-1.5" />
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>

          {/* Active .htaccess Directives Inspector */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div
              onClick={() => setShowHtaccessPreview(!showHtaccessPreview)}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center space-x-2.5">
                <FileCode className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-bold text-slate-800">
                  Active Apache .htaccess Directives
                </span>
                <span className="text-2xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                  {config.rulesActive ? 'Enforcing' : 'Standby / Inactive'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">
                  {showHtaccessPreview ? 'Hide Directives' : 'Show Directives'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showHtaccessPreview ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {showHtaccessPreview && (
              <div className="border-t border-slate-200 p-4 bg-slate-900 text-slate-200">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                  <span className="text-2xs font-mono text-slate-400">
                    File: {config.htaccessPath}
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
                        Copy Rules
                      </>
                    )}
                  </button>
                </div>
                <pre className="font-mono text-2xs overflow-x-auto p-2 bg-slate-950 rounded border border-slate-800 text-emerald-400 whitespace-pre">
                  {config.htaccessSnippet || '# No active hotlink rules generated.'}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Live Access Simulator & Technical Details */}
        <div className="space-y-6">
          {/* Live Access Simulator */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-800">Live Hotlink Simulator</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Verify how your server responds to incoming requests with various Referer headers in real time.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-2xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Target Resource Path
                </label>
                <input
                  type="text"
                  value={testPath}
                  onChange={(e) => setTestPath(e.target.value)}
                  placeholder="/site/images/logo.png"
                  className="w-full text-xs font-mono px-3 py-1.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Simulated HTTP Referer
                </label>
                <input
                  type="text"
                  value={testReferer}
                  onChange={(e) => setTestReferer(e.target.value)}
                  placeholder="https://external-stealer.com (or leave empty)"
                  className="w-full text-xs font-mono px-3 py-1.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setTestReferer('')}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-3xs font-medium"
                  >
                    Direct (Blank)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestReferer('https://default.com')}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-3xs font-medium"
                  >
                    Authorized
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestReferer('https://pirate-embedder.org')}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-3xs font-medium"
                  >
                    Unauthorized
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunTest}
                disabled={testTesting}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-slate-300 shadow-xs text-xs font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                <Play className={`w-3.5 h-3.5 mr-1.5 text-blue-600 ${testTesting ? 'animate-spin' : ''}`} />
                {testTesting ? 'Evaluating...' : 'Simulate Request'}
              </button>

              {/* Test Output Badge */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-lg border text-xs space-y-2 mt-3 ${
                    testResult.allowed
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : testResult.statusCode === 302
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>
                      {testResult.allowed
                        ? 'ALLOW (200 OK)'
                        : testResult.statusCode === 302
                        ? 'REDIRECT (302 Found)'
                        : 'FORBIDDEN (403 Forbidden)'}
                    </span>
                    <span className="font-mono text-2xs px-1.5 py-0.5 rounded bg-white/70">
                      HTTP {testResult.statusCode}
                    </span>
                  </div>
                  <p className="text-2xs leading-relaxed opacity-90">
                    {testResult.reason}
                  </p>
                  {testResult.redirectUrl && (
                    <p className="text-2xs font-mono truncate">
                      Redirecting to: {testResult.redirectUrl}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Engine & Environment Info */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
              <Server className="w-4 h-4 text-slate-600" />
              <h3 className="text-xs font-bold text-slate-800">Engine Capabilities</h3>
            </div>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <dt className="text-slate-500">Web Server:</dt>
                <dd className="font-medium text-slate-800 text-right">
                  {capabilities?.webServer || 'Apache / LiteSpeed'}
                </dd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <dt className="text-slate-500">Enforcement:</dt>
                <dd className="font-medium text-slate-800 text-right">mod_rewrite directives</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <dt className="text-slate-500">Scope:</dt>
                <dd className="font-medium text-slate-800 text-right">public_html (.htaccess)</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <dt className="text-slate-500">Account:</dt>
                <dd className="font-mono text-slate-800 font-semibold">{cpanelUser}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-slate-500">Sync Status:</dt>
                <dd className="text-right">
                  {config.inSync ? (
                    <span className="text-emerald-600 font-bold flex items-center justify-end">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      In Sync
                    </span>
                  ) : (
                    <span className="text-red-600 font-bold flex items-center justify-end">
                      <AlertCircle className="w-3.5 h-3.5 mr-1" />
                      Drift Detected
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Help & Best Practices */}
          <div className="bg-blue-50/50 rounded-lg border border-blue-100 p-4 space-y-2">
            <div className="flex items-center space-x-2 text-blue-900 font-bold text-xs">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Hotlink Best Practices</span>
            </div>
            <ul className="text-2xs text-blue-800 space-y-1.5 list-disc list-inside">
              <li>Always include both naked domains (<span className="font-mono">example.com</span>) and www (<span className="font-mono">www.example.com</span>).</li>
              <li>Keep direct requests allowed so users can click on full images or download links in new tabs.</li>
              <li>Search engines (Google Images, Bing) will respect hotlink settings, but can be whitelisted by adding their domain names.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
