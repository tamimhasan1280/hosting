import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  Globe,
  HardDrive,
  HelpCircle,
  Info,
  Layers,
  LogIn,
  LogOut,
  PieChart,
  RefreshCw,
  Search,
  Server,
  Shield,
  Upload,
  User,
  Users,
  Wifi,
  X
} from 'lucide-react';
import { api } from '../services/api';

export default function WebalizerFtpManager({ onBack, onNavigate, user }) {
  const cpanelUser = user || 'cpanel_user';

  // Account & Period State
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  // Privacy & Search State
  const [maskIps, setMaskIps] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState('overview');
  const [topFilesSubTab, setTopFilesSubTab] = useState('uploads');

  // Data & Loading State
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Load Authorized FTP Accounts
  useEffect(() => {
    let isMounted = true;
    api.getWebalizerFtpAccounts(cpanelUser)
      .then(res => {
        if (isMounted && res && res.success) {
          setAccounts(res.accounts || []);
        }
      })
      .catch(err => {
        console.error('Failed to load FTP accounts:', err);
        if (isMounted) setError('Unable to load authorized FTP accounts for your account.');
      });

    return () => { isMounted = false; };
  }, [cpanelUser]);

  // Load Available Periods
  useEffect(() => {
    let isMounted = true;
    api.getWebalizerFtpPeriods({ user: cpanelUser, account: selectedAccount })
      .then(res => {
        if (isMounted && res && res.success) {
          setPeriods(res.periods || []);
          // If current selectedPeriod not in new list, reset to 'all'
          if (res.periods && res.periods.length > 0) {
            const exists = res.periods.some(p => p.key === selectedPeriod);
            if (!exists) setSelectedPeriod('all');
          }
        }
      })
      .catch(err => {
        console.error('Failed to load FTP periods:', err);
      });

    return () => { isMounted = false; };
  }, [cpanelUser, selectedAccount]);

  // Fetch Webalizer FTP Report
  const fetchReport = (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);

    api.getWebalizerFtpReport({
      user: cpanelUser,
      account: selectedAccount,
      period: selectedPeriod,
      anonymize: maskIps,
      limit: 100
    })
      .then(res => {
        if (res && res.success) {
          setReport(res);
        } else {
          setError(res?.error || 'Failed to generate Webalizer FTP statistics.');
        }
      })
      .catch(err => {
        console.error('Webalizer FTP error:', err);
        setError(err.response?.data?.error || err.message || 'Error communicating with Webalizer FTP service.');
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchReport();
  }, [cpanelUser, selectedAccount, selectedPeriod, maskIps]);

  const handleRefresh = () => {
    setRefreshing(true);
    api.refreshWebalizerFtp({ cpanelUser })
      .then(() => fetchReport(true))
      .catch(() => fetchReport(true));
  };

  const handleExport = (format) => {
    const exportUrl = `/api/webalizer-ftp/export?user=${encodeURIComponent(cpanelUser)}&account=${encodeURIComponent(selectedAccount)}&period=${encodeURIComponent(selectedPeriod)}&anonymize=${maskIps}&format=${format}`;
    window.open(exportUrl, '_blank');
  };

  const summary = report?.summary || {
    totalTransfers: 0,
    totalUploads: 0,
    uploadBytes: 0,
    formattedUploadBytes: '0 Bytes',
    totalDownloads: 0,
    downloadBytes: 0,
    formattedDownloadBytes: '0 Bytes',
    totalBytes: 0,
    formattedTotalBytes: '0 Bytes',
    totalSessions: 0,
    successfulLogins: 0,
    failedLogins: 0,
    avgTransferBytes: 0,
    formattedAvgTransferBytes: '0 Bytes',
    completionRate: 100,
    activeUsers: 0,
    uniqueClients: 0
  };

  // Filtered Top Files
  const filteredUploadFiles = useMemo(() => {
    if (!report?.topUploadedFiles) return [];
    if (!searchQuery.trim()) return report.topUploadedFiles;
    const q = searchQuery.toLowerCase();
    return report.topUploadedFiles.filter(f => f.filename.toLowerCase().includes(q));
  }, [report?.topUploadedFiles, searchQuery]);

  const filteredDownloadFiles = useMemo(() => {
    if (!report?.topDownloadedFiles) return [];
    if (!searchQuery.trim()) return report.topDownloadedFiles;
    const q = searchQuery.toLowerCase();
    return report.topDownloadedFiles.filter(f => f.filename.toLowerCase().includes(q));
  }, [report?.topDownloadedFiles, searchQuery]);

  // Filtered Client Hosts
  const filteredClients = useMemo(() => {
    if (!report?.clientHosts) return [];
    if (!searchQuery.trim()) return report.clientHosts;
    const q = searchQuery.toLowerCase();
    return report.clientHosts.filter(c => (c.displayHost || c.host).toLowerCase().includes(q));
  }, [report?.clientHosts, searchQuery]);

  // Filtered Recent Transfers
  const filteredRecentTransfers = useMemo(() => {
    if (!report?.recentTransfers) return [];
    if (!searchQuery.trim()) return report.recentTransfers;
    const q = searchQuery.toLowerCase();
    return report.recentTransfers.filter(r =>
      r.filename.toLowerCase().includes(q) ||
      (r.username && r.username.toLowerCase().includes(q)) ||
      (r.remoteHost && r.remoteHost.toLowerCase().includes(q))
    );
  }, [report?.recentTransfers, searchQuery]);

  const uploadRatio = summary.totalBytes > 0
    ? Math.round((summary.uploadBytes / summary.totalBytes) * 100)
    : 50;
  const downloadRatio = 100 - uploadRatio;

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
            <span className="text-gray-800 dark:text-gray-200 font-semibold">Webalizer FTP</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Webalizer FTP
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 font-normal">
                  Webalizer 2.23 Compatible
                </span>
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Authoritative FTP server file transfer metrics, bandwidth usage, and session activity
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
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
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <div className="relative group">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </button>
            <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg hidden group-hover:block z-20 py-1 text-xs">
              <button
                onClick={() => handleExport('html')}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"
              >
                <Globe className="w-3.5 h-3.5 text-blue-500" />
                <span>Webalizer HTML Report</span>
              </button>
              <button
                onClick={() => handleExport('txt')}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"
              >
                <FileText className="w-3.5 h-3.5 text-green-500" />
                <span>Plain Text (ASCII)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Capabilities Banner */}
      <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-1.5">
            <Server className="w-4 h-4 text-blue-500" />
            <span>
              Engine:{' '}
              <strong className="text-gray-900 dark:text-white">
                {report?.capabilities?.engine === 'native_webalizer' ? 'Native Webalizer Binary' : 'cPanel Embedded Webalizer FTP Engine'}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-green-500" />
            <span>
              FTP Daemon:{' '}
              <strong className="text-gray-900 dark:text-white">
                {report?.capabilities?.daemonName || 'cPanel RFC 959 FTP Daemon'}
              </strong>{' '}
              (Port {report?.capabilities?.daemonPort || 21})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span>Format: <strong>RFC 959 xferlog</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-mono text-[11px]">
            GeoIP: Unavailable
          </span>
          <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 font-medium">
            Active
          </span>
        </div>
      </div>

      {/* Scope Toolbar: FTP Account & Period Selector */}
      <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* FTP Account Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              FTP Account Scope
            </label>
            <div className="relative">
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 pr-8 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">All FTP Accounts (Aggregate)</option>
                {accounts.map(a => (
                  <option key={a.id || a.username} value={a.username}>
                    {a.username} ({a.directory || 'public_html'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Period Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Reporting Period
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 pr-8 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {periods.map(p => (
                <option key={p.key} value={p.key}>
                  {p.label} {p.count > 0 ? `(${p.count} transfers)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Privacy Masking Toggle */}
          <div className="flex items-center gap-2 pt-4">
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={maskIps}
                onChange={(e) => setMaskIps(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-blue-500" />
                Anonymize Client IPs (GDPR)
              </span>
            </label>
          </div>
        </div>

        {/* Search / Filter */}
        <div className="w-full md:w-64">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Filter Results
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search file, IP, or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading / Error States */}
      {loading && !refreshing && (
        <div className="p-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
          <p className="text-sm font-medium">Analyzing authentic FTP transfer logs...</p>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Unable to load Webalizer FTP statistics:</strong> {error}
          </div>
        </div>
      )}

      {/* Overview KPI Cards */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Transfers */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs mb-1">
              <span>Total File Transfers</span>
              <Activity className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary.totalTransfers.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50 pt-2">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Upload className="w-3 h-3" /> {summary.totalUploads} uploads
              </span>
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <Download className="w-3 h-3" /> {summary.totalDownloads} downloads
              </span>
            </div>
          </div>

          {/* Card 2: Total Volume */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs mb-1">
              <span>Total FTP Throughput</span>
              <HardDrive className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary.formattedTotalBytes}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50 pt-2">
              <span>Up: {summary.formattedUploadBytes}</span>
              <span>Down: {summary.formattedDownloadBytes}</span>
            </div>
          </div>

          {/* Card 3: FTP Sessions & Logins */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs mb-1">
              <span>FTP Sessions & Logins</span>
              <LogIn className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary.totalSessions.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50 pt-2">
              <span className="text-emerald-600">✓ {summary.successfulLogins} Success</span>
              {summary.failedLogins > 0 ? (
                <span className="text-red-600 font-semibold">⚠ {summary.failedLogins} Failed</span>
              ) : (
                <span className="text-gray-400">0 Failed</span>
              )}
            </div>
          </div>

          {/* Card 4: Transfer Completion Rate */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs mb-1">
              <span>Transfer Success Rate</span>
              <CheckCircle2 className="w-4 h-4 text-teal-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary.completionRate}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50 pt-2">
              <span>Avg Size: {summary.formattedAvgTransferBytes}</span>
              <span>{summary.uniqueClients} Clients</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-2 overflow-x-auto text-xs font-medium">
          {[
            { id: 'overview', label: 'Overview', icon: PieChart },
            { id: 'daily', label: 'Daily Activity', icon: Calendar, badge: report?.daily?.length },
            { id: 'hourly', label: 'Hourly Activity', icon: Clock },
            { id: 'top_files', label: 'Top Files', icon: FileText, badge: (report?.topUploadedFiles?.length || 0) + (report?.topDownloadedFiles?.length || 0) },
            { id: 'users', label: 'FTP Users', icon: Users, badge: report?.topUsers?.length },
            { id: 'clients', label: 'Client Hosts', icon: Globe, badge: report?.clientHosts?.length },
            { id: 'logs', label: 'Transfer Logs', icon: Activity, badge: report?.recentTransfers?.length },
            { id: 'auth', label: 'Auth Events', icon: Shield, badge: report?.recentAuthEvents?.length },
            { id: 'help', label: 'Legend & Help', icon: HelpCircle }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && !loading && (
        <div className="space-y-6">
          {/* Transfer Ratio Visual Bar */}
          <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Upload className="w-3.5 h-3.5" />
                Uploads: {summary.formattedUploadBytes} ({uploadRatio}%)
              </span>
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <Download className="w-3.5 h-3.5" />
                Downloads: {summary.formattedDownloadBytes} ({downloadRatio}%)
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${uploadRatio}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title={`Uploads: ${summary.formattedUploadBytes} (${uploadRatio}%)`}
              />
              <div
                style={{ width: `${downloadRatio}%` }}
                className="bg-blue-500 h-full transition-all duration-300"
                title={`Downloads: ${summary.formattedDownloadBytes} (${downloadRatio}%)`}
              />
            </div>
          </div>

          {/* General Summary Table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5 text-blue-500" />
                Webalizer FTP 2.23 General Statistics Summary
              </h3>
              <span className="text-[11px] text-gray-500">
                Scope: {selectedAccount === 'all' ? 'All Accounts' : selectedAccount}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700 text-xs">
              <div className="p-4 space-y-2">
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Total File Transfers</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{summary.totalTransfers.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Total Uploads (Incoming)</span>
                  <span className="font-semibold text-emerald-600">{summary.totalUploads.toLocaleString()} ({summary.formattedUploadBytes})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Total Downloads (Outgoing)</span>
                  <span className="font-semibold text-blue-600">{summary.totalDownloads.toLocaleString()} ({summary.formattedDownloadBytes})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Total Bytes Transferred</span>
                  <span className="font-bold text-gray-900 dark:text-white">{summary.formattedTotalBytes}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Average Transfer Volume</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{summary.formattedAvgTransferBytes}</span>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">FTP Login Sessions</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{summary.totalSessions}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Successful Logins</span>
                  <span className="font-semibold text-emerald-600">{summary.successfulLogins}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Failed Login Attempts</span>
                  <span className="font-semibold text-red-600">{summary.failedLogins}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Transfer Completion Rate</span>
                  <span className="font-semibold text-emerald-600">{summary.completionRate}%</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Active FTP Accounts</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{summary.activeUsers}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Snapshot: Recent Activity */}
          {report?.daily && report.daily.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  Recent Daily Activity (Last 7 Days)
                </h3>
                <button
                  onClick={() => setActiveTab('daily')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View All Days →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 font-medium">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Day</th>
                      <th className="px-4 py-2 text-right">Uploads</th>
                      <th className="px-4 py-2 text-right">Downloads</th>
                      <th className="px-4 py-2 text-right">Total Files</th>
                      <th className="px-4 py-2 text-right">Upload Vol</th>
                      <th className="px-4 py-2 text-right">Download Vol</th>
                      <th className="px-4 py-2 text-right">Total Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {report.daily.slice(0, 7).map(d => (
                      <tr key={d.date} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-4 py-2 font-mono font-medium">{d.date}</td>
                        <td className="px-4 py-2 text-gray-500">{d.dayOfWeek}</td>
                        <td className="px-4 py-2 text-right text-emerald-600">{d.uploads}</td>
                        <td className="px-4 py-2 text-right text-blue-600">{d.downloads}</td>
                        <td className="px-4 py-2 text-right font-semibold">{d.totalTransfers}</td>
                        <td className="px-4 py-2 text-right">{d.formattedUploadBytes}</td>
                        <td className="px-4 py-2 text-right">{d.formattedDownloadBytes}</td>
                        <td className="px-4 py-2 text-right font-bold">{d.formattedTotalBytes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Daily Activity */}
      {activeTab === 'daily' && !loading && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              Daily FTP Transfer Statistics
            </h3>
            <span className="text-[11px] text-gray-500">
              {report?.daily?.length || 0} active days recorded
            </span>
          </div>
          {report?.daily && report.daily.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 font-medium">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Day</th>
                    <th className="px-4 py-2.5 text-right">Uploads</th>
                    <th className="px-4 py-2.5 text-right">Downloads</th>
                    <th className="px-4 py-2.5 text-right">Total Files</th>
                    <th className="px-4 py-2.5 text-right">Upload Volume</th>
                    <th className="px-4 py-2.5 text-right">Download Volume</th>
                    <th className="px-4 py-2.5 text-right">Total Throughput</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {report.daily.map(d => (
                    <tr key={d.date} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-2 font-mono font-medium">{d.date}</td>
                      <td className="px-4 py-2 text-gray-500">{d.dayOfWeek}</td>
                      <td className="px-4 py-2 text-right text-emerald-600">{d.uploads.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-blue-600">{d.downloads.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-semibold">{d.totalTransfers.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">{d.formattedUploadBytes}</td>
                      <td className="px-4 py-2 text-right">{d.formattedDownloadBytes}</td>
                      <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white">{d.formattedTotalBytes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 text-xs">
              No daily transfer records found for the selected period.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Hourly Activity */}
      {activeTab === 'hourly' && !loading && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                Hourly FTP Activity (00:00 - 23:00)
              </h3>
            </div>
            <div className="p-4">
              {/* Visual 24-hour bars */}
              <div className="grid grid-cols-12 md:grid-cols-24 gap-1 h-32 items-end mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                {report?.hourly?.map(h => {
                  const maxHourlyBytes = Math.max(1, ...(report?.hourly?.map(x => x.totalBytes) || [1]));
                  const heightPct = Math.max(4, Math.round((h.totalBytes / maxHourlyBytes) * 100));
                  return (
                    <div
                      key={h.hour}
                      className="flex flex-col items-center group relative h-full justify-end"
                    >
                      <div
                        style={{ height: `${heightPct}%` }}
                        className="w-full bg-blue-500 hover:bg-blue-600 rounded-t transition-all"
                      />
                      <span className="text-[9px] text-gray-400 mt-1 font-mono">{String(h.hour).padStart(2, '0')}</span>
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] p-2 rounded shadow-lg whitespace-nowrap z-20 pointer-events-none">
                        <div><strong>{h.hourLabel}</strong></div>
                        <div>Total Files: {h.totalTransfers}</div>
                        <div>Uploads: {h.uploads} ({h.formattedUploadBytes})</div>
                        <div>Downloads: {h.downloads} ({h.formattedDownloadBytes})</div>
                        <div>Volume: {h.formattedTotalBytes}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hourly Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 font-medium">
                    <tr>
                      <th className="px-3 py-2">Hour</th>
                      <th className="px-3 py-2 text-right">Uploads</th>
                      <th className="px-3 py-2 text-right">Downloads</th>
                      <th className="px-3 py-2 text-right">Total Files</th>
                      <th className="px-3 py-2 text-right">Upload Volume</th>
                      <th className="px-3 py-2 text-right">Download Volume</th>
                      <th className="px-3 py-2 text-right">Total Volume</th>
                      <th className="px-3 py-2 text-right">% Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {report?.hourly?.map(h => (
                      <tr key={h.hour} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-3 py-1.5 font-mono font-medium">{h.hourLabel}</td>
                        <td className="px-3 py-1.5 text-right text-emerald-600">{h.uploads}</td>
                        <td className="px-3 py-1.5 text-right text-blue-600">{h.downloads}</td>
                        <td className="px-3 py-1.5 text-right font-semibold">{h.totalTransfers}</td>
                        <td className="px-3 py-1.5 text-right">{h.formattedUploadBytes}</td>
                        <td className="px-3 py-1.5 text-right">{h.formattedDownloadBytes}</td>
                        <td className="px-3 py-1.5 text-right font-bold">{h.formattedTotalBytes}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{h.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Top Files */}
      {activeTab === 'top_files' && !loading && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
            <button
              onClick={() => setTopFilesSubTab('uploads')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                topFilesSubTab === 'uploads'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Top Uploaded Files ({filteredUploadFiles.length})
            </button>
            <button
              onClick={() => setTopFilesSubTab('downloads')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                topFilesSubTab === 'downloads'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Top Downloaded Files ({filteredDownloadFiles.length})
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
            {topFilesSubTab === 'uploads' ? (
              filteredUploadFiles.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 font-medium">
                      <tr>
                        <th className="px-4 py-2.5 w-12">#</th>
                        <th className="px-4 py-2.5">File Path</th>
                        <th className="px-4 py-2.5 text-right">Upload Count</th>
                        <th className="px-4 py-2.5 text-right">Total Volume</th>
                        <th className="px-4 py-2.5 text-right">% Upload Volume</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredUploadFiles.map((f, i) => (
                        <tr key={f.filename + i} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="px-4 py-2 text-gray-400 font-mono">{i + 1}</td>
                          <td className="px-4 py-2 font-mono text-gray-900 dark:text-white break-all">
                            {f.filename}
                          </td>
                          <td className="px-4 py-2 text-right text-emerald-600 font-semibold">{f.count}</td>
                          <td className="px-4 py-2 text-right font-bold">{f.formattedBytes}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{f.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 text-xs">
                  No uploaded files recorded for the selected period.
                </div>
              )
            ) : (
              filteredDownloadFiles.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 font-medium">
                      <tr>
                        <th className="px-4 py-2.5 w-12">#</th>
                        <th className="px-4 py-2.5">File Path</th>
                        <th className="px-4 py-2.5 text-right">Download Count</th>
                        <th className="px-4 py-2.5 text-right">Total Volume</th>
                        <th className="px-4 py-2.5 text-right">% Download Volume</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredDownloadFiles.map((f, i) => (
                        <tr key={f.filename + i} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="px-4 py-2 text-gray-400 font-mono">{i + 1}</td>
                          <td className="px-4 py-2 font-mono text-gray-900 dark:text-white break-all">
                            {f.filename}
                          </td>
                          <td className="px-4 py-2 text-right text-blue-600 font-semibold">{f.count}</td>
                          <td className="px-4 py-2 text-right font-bold">{f.formattedBytes}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{f.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 text-xs">
                  No downloaded files recorded for the selected period.
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Tab 5: FTP Users */}
      {activeTab === 'users' && !loading && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              FTP User Accounts Activity Breakdown
            </h3>
            <span className="text-[11px] text-gray-500">
              {report?.topUsers?.length || 0} active users
            </span>
          </div>
          {report?.topUsers && report.topUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 font-medium">
                  <tr>
                    <th className="px-4 py-2.5">FTP Username</th>
                    <th className="px-4 py-2.5 text-right">Uploads</th>
                    <th className="px-4 py-2.5 text-right">Downloads</th>
                    <th className="px-4 py-2.5 text-right">Total Transfers</th>
                    <th className="px-4 py-2.5 text-right">Upload Vol</th>
                    <th className="px-4 py-2.5 text-right">Download Vol</th>
                    <th className="px-4 py-2.5 text-right">Total Volume</th>
                    <th className="px-4 py-2.5 text-right">% Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {report.topUsers.map(u => (
                    <tr key={u.username} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-2 font-mono font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-500" />
                        {u.username}
                      </td>
                      <td className="px-4 py-2 text-right text-emerald-600">{u.uploads}</td>
                      <td className="px-4 py-2 text-right text-blue-600">{u.downloads}</td>
                      <td className="px-4 py-2 text-right font-semibold">{u.totalTransfers}</td>
                      <td className="px-4 py-2 text-right">{u.formattedUploadBytes}</td>
                      <td className="px-4 py-2 text-right">{u.formattedDownloadBytes}</td>
                      <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white">{u.formattedTotalBytes}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{u.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 text-xs">
              No FTP user activity recorded for the selected period.
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Client Hosts */}
      {activeTab === 'clients' && !loading && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              Remote Client Hosts & IP Addresses
            </h3>
            <span className="text-[11px] text-gray-500">
              {filteredClients.length} unique client hosts
            </span>
          </div>
          {filteredClients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 font-medium">
                  <tr>
                    <th className="px-4 py-2.5">Client IP Address</th>
                    <th className="px-4 py-2.5 text-right">Transfer Count</th>
                    <th className="px-4 py-2.5 text-right">Total Transferred</th>
                    <th className="px-4 py-2.5 text-right">% Volume</th>
                    <th className="px-4 py-2.5 text-right">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredClients.map(c => (
                    <tr key={c.host} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-2 font-mono font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Wifi className="w-3.5 h-3.5 text-indigo-500" />
                        {c.displayHost}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">{c.count}</td>
                      <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white">{c.formattedBytes}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{c.percentage}%</td>
                      <td className="px-4 py-2 text-right text-gray-400 font-mono text-[11px]">
                        {c.lastAccess ? new Date(c.lastAccess).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 text-xs">
              No client hosts recorded for the selected period.
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Recent Transfer Logs */}
      {activeTab === 'logs' && !loading && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              Live FTP Transfer Stream (xferlog)
            </h3>
            <span className="text-[11px] text-gray-500">
              Showing latest {filteredRecentTransfers.length} events
            </span>
          </div>
          {filteredRecentTransfers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 font-medium">
                  <tr>
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Direction</th>
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2 text-right">Size</th>
                    <th className="px-3 py-2">Client IP</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                  {filteredRecentTransfers.map((r, i) => {
                    const isUpload = r.direction === 'i';
                    const isComplete = r.completionStatus === 'c';
                    return (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-3 py-1.5 text-gray-500 text-[11px] whitespace-nowrap">
                          {new Date(r.timestamp).toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 font-semibold text-gray-800 dark:text-gray-200">
                          {r.username}
                        </td>
                        <td className="px-3 py-1.5">
                          {isUpload ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              <Upload className="w-2.5 h-2.5" /> Upload
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                              <Download className="w-2.5 h-2.5" /> Download
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-gray-900 dark:text-white max-w-xs truncate" title={r.filename}>
                          {r.filename}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold">
                          {r.formattedBytes}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400 text-[11px]">
                          {r.remoteHost}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {isComplete ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                              Complete
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              Incomplete
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 text-xs">
              No FTP transfer logs found.
            </div>
          )}
        </div>
      )}

      {/* Tab 8: Authentication Events */}
      {activeTab === 'auth' && !loading && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-500" />
              FTP Server Authentication Log (ftp_auth.log)
            </h3>
            <span className="text-[11px] text-gray-500">
              {report?.recentAuthEvents?.length || 0} recent login events
            </span>
          </div>
          {report?.recentAuthEvents && report.recentAuthEvents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 font-medium">
                  <tr>
                    <th className="px-4 py-2.5">Timestamp</th>
                    <th className="px-4 py-2.5">User</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5">Client IP</th>
                    <th className="px-4 py-2.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                  {report.recentAuthEvents.map((a, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-2 text-gray-500 text-[11px]">
                        {new Date(a.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 font-bold text-gray-900 dark:text-white">
                        {a.username}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {a.success ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold">
                            SUCCESS
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 font-semibold">
                            FAILURE
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400 text-[11px]">
                        {a.ip}
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-[11px]">
                        {a.message || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 text-xs">
              No authentication events recorded for the selected period.
            </div>
          )}
        </div>
      )}

      {/* Tab 9: Help & Legend */}
      {activeTab === 'help' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4 text-xs text-gray-700 dark:text-gray-300">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-500" />
            About Webalizer FTP Server Traffic Analysis
          </h3>
          <p>
            Webalizer FTP produces comprehensive statistical summaries of file transfer operations through the FTP daemon.
            It processes standard Wu-FTPd, Pure-FTPd, ProFTPD, and RFC 959 transfer logs (<code>xferlog</code>).
          </p>

          <h4 className="font-bold text-gray-900 dark:text-white pt-2">Standard xferlog Format Breakdown:</h4>
          <pre className="p-3 bg-gray-100 dark:bg-gray-900 rounded font-mono text-[11px] overflow-x-auto text-gray-800 dark:text-gray-200">
current-time transfer-time remote-host file-size filename transfer-type special-action-flag direction access-mode username service-name auth-method auth-user-id completion-status
          </pre>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <h5 className="font-semibold text-gray-900 dark:text-white">Direction Codes:</h5>
              <ul className="list-disc pl-5 space-y-1">
                <li><code>i</code> (Incoming): File uploaded by client to the hosting server.</li>
                <li><code>o</code> (Outgoing): File downloaded by client from the hosting server.</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h5 className="font-semibold text-gray-900 dark:text-white">Completion Codes:</h5>
              <ul className="list-disc pl-5 space-y-1">
                <li><code>c</code> (Complete): File transfer completed successfully with zero truncation.</li>
                <li><code>i</code> (Incomplete): File transfer was interrupted, aborted, or terminated prematurely.</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 text-[11px] text-gray-500">
            Note: Webalizer FTP statistics are completely isolated per cPanel account. All metrics are calculated directly from authentic system logs.
          </div>
        </div>
      )}
    </div>
  );
}
