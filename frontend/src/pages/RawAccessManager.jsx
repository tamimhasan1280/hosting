import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  FileArchive,
  FileCode,
  FileText,
  Filter,
  Globe,
  HardDrive,
  Info,
  Layers,
  RefreshCw,
  Save,
  Search,
  Server,
  Settings,
  ShieldAlert,
  Sliders,
  X
} from 'lucide-react';
import { api } from '../services/api';

export default function RawAccessManager({ onBack, onNavigate, user }) {
  const cpanelUser = user || 'cpanel_user';

  // Data states
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search filter
  const [searchCurrent, setSearchCurrent] = useState('');
  const [searchArchived, setSearchArchived] = useState('');

  // Config states
  const [config, setConfig] = useState({ archiveLogs: true, discardPreviousMonth: false });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(null);
  const [configError, setConfigError] = useState(null);

  // Preview Modal State
  const [previewLog, setPreviewLog] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLimit, setPreviewLimit] = useState(100);
  const [previewError, setPreviewError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Load Inventory & Config
  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await api.getRawAccessInventory({ user: cpanelUser });
      if (res && res.success) {
        setInventory(res);
        if (res.config) {
          setConfig(res.config);
        }
      } else {
        throw new Error(res?.error || 'Failed to load raw access logs inventory');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error connecting to Raw Access service');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save Configuration
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSuccess(null);
    setConfigError(null);

    try {
      const res = await api.updateRawAccessConfig({
        cpanelUser,
        archiveLogs: config.archiveLogs,
        discardPreviousMonth: config.discardPreviousMonth
      });
      if (res && res.success) {
        setConfigSuccess('Raw access configuration saved successfully.');
        if (res.config) {
          setConfig(res.config);
        }
        setTimeout(() => setConfigSuccess(null), 5000);
      } else {
        throw new Error(res?.error || 'Failed to save configuration');
      }
    } catch (err) {
      setConfigError(err.response?.data?.error || err.message || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  // Open Preview Modal
  const handleOpenPreview = async (logItem, limit = 100) => {
    setPreviewLog(logItem);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    setCopied(false);

    try {
      const res = await api.getRawAccessPreview(logItem.id, { user: cpanelUser, limit });
      if (res && res.success) {
        setPreviewData(res);
      } else {
        throw new Error(res?.error || 'Failed to preview log');
      }
    } catch (err) {
      setPreviewError(err.response?.data?.error || err.message || 'Error loading log preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Change Preview Limit
  const handlePreviewLimitChange = (newLimit) => {
    setPreviewLimit(newLimit);
    if (previewLog) {
      handleOpenPreview(previewLog, newLimit);
    }
  };

  // Handle Log Download
  const handleDownload = (logId) => {
    const url = `/api/raw-access/download/${encodeURIComponent(logId)}?user=${encodeURIComponent(cpanelUser)}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy Preview Lines to Clipboard
  const handleCopyClipboard = () => {
    if (!previewData || !previewData.rawPreview) return;
    navigator.clipboard.writeText(previewData.rawPreview).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  // Filter current logs
  const filteredCurrentLogs = useMemo(() => {
    if (!inventory || !inventory.currentLogs) return [];
    if (!searchCurrent.trim()) return inventory.currentLogs;
    const q = searchCurrent.toLowerCase();
    return inventory.currentLogs.filter(
      l => (l.domain && l.domain.toLowerCase().includes(q)) ||
           (l.filename && l.filename.toLowerCase().includes(q)) ||
           (l.type && l.type.toLowerCase().includes(q))
    );
  }, [inventory, searchCurrent]);

  // Filter archived logs
  const filteredArchivedLogs = useMemo(() => {
    if (!inventory || !inventory.archivedLogs) return [];
    if (!searchArchived.trim()) return inventory.archivedLogs;
    const q = searchArchived.toLowerCase();
    return inventory.archivedLogs.filter(
      l => (l.filename && l.filename.toLowerCase().includes(q)) ||
           (l.domain && l.domain.toLowerCase().includes(q))
    );
  }, [inventory, searchArchived]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-5">
        <nav className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
          <span>cPanel</span>
          <ChevronRight className="w-3 h-3" />
          <span>Metrics</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-800 dark:text-gray-200 font-semibold">Raw Access</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <FileArchive className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              Raw Access
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-3xl">
              Raw Access logs allow you to see who has visited your website without displaying graphs, charts, or other graphics. You can use the Raw Access Logs menu to download a zipped version of the server&apos;s access log for your site.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm disabled:opacity-50"
              title="Refresh Log Inventory"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-red-800 dark:text-red-300 font-medium">
            {error}
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Configure Logs Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Configure Logs</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Configure how the server handles raw log archiving and rotation in your account directory.
        </p>

        {configSuccess && (
          <div className="mb-4 p-3 rounded bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-sm text-green-800 dark:text-green-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            {configSuccess}
          </div>
        )}

        {configError && (
          <div className="mb-4 p-3 rounded bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            {configError}
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              id="chk-archive-logs"
              checked={config.archiveLogs}
              onChange={(e) => setConfig(c => ({ ...c, archiveLogs: e.target.checked }))}
              className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:bg-gray-700"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Archive logs</strong> in your home directory at the end of each stats run (every 24 hours)
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              id="chk-discard-prev"
              checked={config.discardPreviousMonth}
              onChange={(e) => setConfig(c => ({ ...c, discardPreviousMonth: e.target.checked }))}
              className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:bg-gray-700"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Remove</strong> the previous month&apos;s archived logs from your home directory at the end of each month
            </span>
          </label>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingConfig}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition disabled:opacity-50"
            >
              {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Configuration
            </button>
          </div>
        </form>
      </div>

      {/* 2. Download Current Raw Access Logs Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Download Current Raw Access Logs
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Click on a domain name or master log below to download or preview the current uncompressed access log.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search domains or files..."
              value={searchCurrent}
              onChange={(e) => setSearchCurrent(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Scanning log directories...</p>
          </div>
        ) : filteredCurrentLogs.length === 0 ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
            <FileText className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="font-medium text-sm">No raw access logs found matching your search filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left">Domain / Scope</th>
                  <th scope="col" className="px-4 py-3 text-left">Log File</th>
                  <th scope="col" className="px-4 py-3 text-left">Size</th>
                  <th scope="col" className="px-4 py-3 text-left">Last Modified</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {filteredCurrentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap flex items-center gap-2">
                      {log.id.startsWith('master:') ? (
                        <Server className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      ) : (
                        <Globe className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      )}
                      <div>
                        <div>{log.domain}</div>
                        {log.type && (
                          <span className="text-xs text-gray-400 font-normal">{log.type}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs whitespace-nowrap">
                      {log.filename}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        log.sizeBytes > 0
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {log.formattedSize}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                      {log.lastModified ? new Date(log.lastModified).toLocaleString() : 'No activity recorded yet'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenPreview(log, 100)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition"
                          title="Preview last 100 lines inline"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Preview
                        </button>
                        <button
                          onClick={() => handleDownload(log.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-sm"
                          title="Stream download entire raw log"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Archived Raw Access Logs Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Archived Raw Access Logs
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Historical and rotated access log archives stored in your account.
            </p>
          </div>
          {inventory && inventory.archivedLogs && inventory.archivedLogs.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search archives..."
                value={searchArchived}
                onChange={(e) => setSearchArchived(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-600 mb-2" />
            <p className="text-xs">Loading archives...</p>
          </div>
        ) : filteredArchivedLogs.length === 0 ? (
          <div className="py-10 text-center text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
            <Archive className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="font-medium text-sm text-gray-700 dark:text-gray-300">
              There are no archived raw access logs currently available for your account.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-md mx-auto">
              When log archiving is enabled, rotated logs and compressed monthly logs (.gz) will appear in this section.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left">Archive File</th>
                  <th scope="col" className="px-4 py-3 text-left">Associated Domain</th>
                  <th scope="col" className="px-4 py-3 text-left">Format</th>
                  <th scope="col" className="px-4 py-3 text-left">Size</th>
                  <th scope="col" className="px-4 py-3 text-left">Archived Date</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {filteredArchivedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition">
                    <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-white whitespace-nowrap flex items-center gap-2">
                      <FileArchive className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      {log.filename}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {log.domain || 'All Domains'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        log.compressed
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {log.compressed ? 'GZIP (.gz)' : 'Plain Text'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-700 dark:text-gray-300">
                      {log.formattedSize}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                      {log.lastModified ? new Date(log.lastModified).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {!log.compressed && (
                          <button
                            onClick={() => handleOpenPreview(log, 100)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Preview
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(log.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded transition shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Inline / Modal Log Preview */}
      {previewLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 w-full max-w-5xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCode className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Raw Access Preview: <span className="font-mono text-sm text-blue-600 dark:text-blue-400">{previewLog.filename}</span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Domain: {previewLog.domain} &bull; Size: {previewData?.formattedSize || previewLog.formattedSize}
                    {previewData?.totalLines !== undefined && ` • Total Log Lines: ${previewData.totalLines}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Lines Selector */}
                <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 mr-2">
                  <span>Tail lines:</span>
                  <select
                    value={previewLimit}
                    onChange={(e) => handlePreviewLimitChange(Number(e.target.value))}
                    disabled={previewLoading}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                  </select>
                </div>

                <button
                  onClick={handleCopyClipboard}
                  disabled={previewLoading || !previewData || previewData.lines?.length === 0}
                  className="p-1.5 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-40"
                  title="Copy previewed lines to clipboard"
                >
                  {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                </button>

                <button
                  onClick={() => handleDownload(previewLog.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-sm"
                  title="Download full file"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Log
                </button>

                <button
                  onClick={() => setPreviewLog(null)}
                  className="p-1.5 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  title="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-gray-950 text-gray-100 font-mono text-xs select-text">
              {previewLoading ? (
                <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                  <p className="text-sm">Reading the last {previewLimit} lines of {previewLog.filename}...</p>
                </div>
              ) : previewError ? (
                <div className="p-4 rounded bg-red-900/40 border border-red-800 text-red-300 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Unable to preview log file</p>
                    <p className="text-xs mt-1 text-red-400">{previewError}</p>
                  </div>
                </div>
              ) : !previewData || previewData.lines?.length === 0 ? (
                <div className="py-16 text-center text-gray-500">
                  <FileText className="w-10 h-10 mx-auto text-gray-600 mb-2" />
                  <p className="font-medium text-sm text-gray-400">Log file is currently empty.</p>
                  <p className="text-xs text-gray-600 mt-1">No HTTP requests have been recorded for this domain yet.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {previewData.lines.map((line, idx) => (
                    <div key={idx} className="flex hover:bg-gray-900 py-0.5 px-2 rounded">
                      <span className="text-gray-600 select-none w-12 text-right pr-4 flex-shrink-0">
                        {Math.max(1, (previewData.totalLines - previewData.lines.length) + idx + 1)}
                      </span>
                      <span
                        className="whitespace-pre-wrap break-all text-emerald-400"
                        dangerouslySetInnerHTML={{ __html: line }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50">
              <div>
                Showing latest {previewData?.lines?.length || 0} lines
                {previewData?.totalLines !== undefined && ` of ${previewData.totalLines} total lines in log`}
              </div>
              <button
                onClick={() => setPreviewLog(null)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
