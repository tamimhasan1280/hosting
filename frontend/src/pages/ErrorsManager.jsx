import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Clock,
  Code,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileQuestion,
  FileText,
  Filter,
  Globe,
  HelpCircle,
  Info,
  Layers,
  List,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Sliders,
  Terminal,
  X,
  XCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function ErrorsManager() {
  const cpanelUser = 'cpanel_user';

  // Domain & Log status
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('ALL');

  // Filters & State
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [timeframe, setTimeframe] = useState('7days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('formatted'); // 'formatted' | 'raw'

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  // Data
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    today: 0,
    critical: 0,
    warning: 0,
    notice: 0,
    http4xx: 0,
    http5xx: 0
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Inspector Modal
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [activeEntry, setActiveEntry] = useState(null);
  const [contextData, setContextData] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState(null);

  // Load authorized domains
  const loadDomains = async () => {
    try {
      const res = await api.getErrorDomains(cpanelUser);
      if (res && res.success && res.domains) {
        setDomains(res.domains);
      }
    } catch (e) {
      console.error('Failed to load error domains:', e);
    }
  };

  // Load error logs & summary
  const loadErrorEntries = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await api.getErrorEntries({
        user: cpanelUser,
        domain: selectedDomain,
        range: timeframe,
        startDate: timeframe === 'custom' ? startDate : undefined,
        endDate: timeframe === 'custom' ? endDate : undefined,
        severity: severityFilter,
        search: searchQuery,
        page,
        limit
      });

      if (res && res.success) {
        setEntries(res.entries || []);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
          setTotalEntries(res.pagination.total || 0);
        }
        if (res.summary) {
          setSummary(res.summary);
        }
      } else {
        setError(res?.error || 'Failed to fetch error logs');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Error logs are currently unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadDomains();
  }, []);

  // Reload when query params change
  useEffect(() => {
    loadErrorEntries();
  }, [selectedDomain, severityFilter, timeframe, startDate, endDate, page, limit]);

  // Handle search submit or debounce
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    loadErrorEntries();
  };

  // Open Inspector
  const handleInspect = async (entry) => {
    setActiveEntry(entry);
    setInspectModalOpen(true);
    setContextData(null);
    setContextError(null);
    setContextLoading(true);

    try {
      const res = await api.getErrorContext({
        user: cpanelUser,
        logFile: entry.logFile,
        line: entry.lineNumber,
        contextLines: 3
      });
      if (res && res.success) {
        setContextData(res);
      } else {
        setContextError(res?.error || 'Log context unavailable');
      }
    } catch (err) {
      setContextError(err?.response?.data?.error || err.message || 'Failed to load log context');
    } finally {
      setContextLoading(false);
    }
  };

  // Copy text helper
  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Severity color badge helper
  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-300 dark:border-rose-700/50">
            <AlertOctagon className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            CRITICAL
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-300 dark:border-red-700/50">
            <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
            ERROR
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            WARNING
          </span>
        );
      case 'notice':
      case 'info':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-300 dark:border-blue-700/50">
            <Info className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            NOTICE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            {sev.toUpperCase()}
          </span>
        );
    }
  };

  // HTTP status badge helper
  const getStatusBadge = (code) => {
    if (!code) return <span className="text-xs text-slate-400 font-mono">—</span>;
    let color = 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    if (code >= 500) {
      color = 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800';
    } else if (code === 404) {
      color = 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800';
    } else if (code === 403 || code === 401) {
      color = 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800';
    } else if (code >= 400) {
      color = 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-800';
    }
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border ${color}`}>
        {code}
      </span>
    );
  };

  // Format timestamp helper
  const formatTime = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      return isoString;
    }
  };

  // Guidance helper based on status code
  const getResolutionGuidance = (entry) => {
    if (!entry) return null;
    const code = entry.statusCode;
    const msg = entry.message || '';

    if (code === 404 || /file does not exist/i.test(msg)) {
      return {
        title: 'HTTP 404: Resource Not Found',
        advice: 'Verify that the file actually exists in the specified document root. If this is a single-page application or CMS (such as WordPress), ensure your .htaccess RewriteRules or routing configuration directs requests to index.php or index.html.',
        docsLink: 'https://docs.cpanel.net/cpanel/metrics/errors/'
      };
    }
    if (code === 403 || /forbidden|client denied/i.test(msg)) {
      return {
        title: 'HTTP 403: Forbidden / Access Denied',
        advice: 'Check filesystem permissions for the target directory (standard is 0755 for directories, 0644 for files). Check .htaccess directives to ensure "Require all granted" or Options +Indexes is configured if directory listings are expected.',
        docsLink: 'https://docs.cpanel.net/cpanel/metrics/errors/'
      };
    }
    if (code === 401 || /authentication failure/i.test(msg)) {
      return {
        title: 'HTTP 401: Authorization Required',
        advice: 'The requested path is protected by Directory Privacy (HTTP Basic Authentication). Ensure the user is passing valid credentials configured in the cPanel Directory Privacy tool.',
        docsLink: 'https://docs.cpanel.net/cpanel/files/directory-privacy/'
      };
    }
    if (code >= 500 || entry.severity === 'critical' || entry.module === 'php') {
      return {
        title: 'HTTP 500 / PHP Error',
        advice: 'A fatal runtime exception occurred during execution. Review the file and line number shown in the stack trace below. Ensure database credentials, file permissions, and PHP version compatibility match your application requirements.',
        docsLink: 'https://docs.cpanel.net/cpanel/software/select-php-version/'
      };
    }
    return {
      title: 'Server Notice or Warning',
      advice: 'This is an informational or non-critical warning generated by Apache, OpenSSL, or mod_autoindex. No immediate user intervention is typically required unless accompanied by broken page requests.',
      docsLink: 'https://docs.cpanel.net/cpanel/metrics/errors/'
    };
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center text-sm font-medium text-slate-500 dark:text-slate-400 space-x-2">
        <span>Metrics</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 dark:text-white font-semibold">Errors</span>
      </nav>

      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20 shrink-0">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Errors</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
                This function displays authentic errors recorded by your web server and PHP error logs. Inspect broken links, missing files, permission issues, or runtime exceptions for your authorized domains.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            {/* Domain Selector Dropdown */}
            <div className="relative">
              <select
                value={selectedDomain}
                onChange={(e) => {
                  setSelectedDomain(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm cursor-pointer"
              >
                <option value="ALL">All Domains (Account-wide)</option>
                {domains.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} ({d.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => loadErrorEntries(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg transition-colors border border-slate-300 dark:border-slate-700 disabled:opacity-50"
              title="Refresh error logs"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Errors */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total In Scope
            </span>
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : summary.total}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">entries</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">in selected window</p>
        </div>

        {/* Card 2: Errors Today */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Today
            </span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : summary.today}
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Last 24h</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">recorded today</p>
        </div>

        {/* Card 3: Critical & Fatal */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Critical / Fatal
            </span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {loading ? '...' : summary.critical}
            </span>
            <span className="text-xs text-rose-600/80 font-medium">fatal</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">require immediate fix</p>
        </div>

        {/* Card 4: Warnings & Notices */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Warnings
            </span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : summary.warning}
            </span>
            <span className="text-xs text-amber-600 font-medium">+{summary.notice} notices</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">non-breaking notices</p>
        </div>

        {/* Card 5: HTTP 4xx / 5xx */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              HTTP 4xx / 5xx
            </span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : summary.http4xx + summary.http5xx}
            </span>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
              {summary.http4xx} 4xx · {summary.http5xx} 5xx
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">client & server responses</p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search error message, URL path, client IP, source file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-20 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                  setTimeout(loadErrorEntries, 50);
                }}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold transition-colors"
            >
              Find
            </button>
          </form>

          {/* Timeframe & View Mode Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium">
              <button
                type="button"
                onClick={() => { setTimeframe('today'); setPage(1); }}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  timeframe === 'today'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => { setTimeframe('yesterday'); setPage(1); }}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  timeframe === 'yesterday'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => { setTimeframe('7days'); setPage(1); }}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  timeframe === '7days'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => { setTimeframe('30days'); setPage(1); }}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  timeframe === '30days'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={() => { setTimeframe('custom'); setPage(1); }}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  timeframe === 'custom'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Custom
              </button>
            </div>

            {/* View Mode Toggle: Formatted vs Raw */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode('formatted')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                  viewMode === 'formatted'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="Formatted Table View"
              >
                <List className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                  viewMode === 'raw'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="Raw Log Output"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Raw</span>
              </button>
            </div>
          </div>
        </div>

        {/* Custom Date Pickers */}
        {timeframe === 'custom' && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Custom Date Range:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Severity Filter Pills */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Severity:
          </span>
          {[
            { id: 'ALL', label: 'All Severities' },
            { id: 'critical', label: 'Critical / Fatal' },
            { id: 'error', label: 'Errors' },
            { id: 'warn', label: 'Warnings' },
            { id: 'notice', label: 'Notices / Info' }
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => { setSeverityFilter(pill.id); setPage(1); }}
              className={`px-3 py-1 rounded-full border transition-all ${
                severityFilter === pill.id
                  ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-semibold'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error alert banner if any */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl p-4 flex items-start gap-3 text-rose-800 dark:text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold">Unable to Load Error Logs</h3>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => loadErrorEntries()}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {viewMode === 'formatted' ? (
        /* Formatted Table View */
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Severity</th>
                  <th className="py-3.5 px-4">Module / Scope</th>
                  <th className="py-3.5 px-4">HTTP Status</th>
                  <th className="py-3.5 px-4">Error Details & Message</th>
                  <th className="py-3.5 px-4">Client IP</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                        <span>Reading and parsing server error logs...</span>
                      </div>
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-16 text-center">
                      <div className="max-w-md mx-auto flex flex-col items-center">
                        <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          No Errors Found
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          No errors match the selected domain, timeframe, or severity criteria. Your web server is operating without reported failures.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr
                      key={entry.id}
                      onClick={() => handleInspect(entry)}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono text-slate-600 dark:text-slate-300">
                        {formatTime(entry.timestamp)}
                      </td>

                      {/* Severity */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getSeverityBadge(entry.severity)}
                      </td>

                      {/* Module */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                            [{entry.module}]
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[120px]" title={entry.logFile}>
                            {entry.domain || entry.logFile}
                          </span>
                        </div>
                      </td>

                      {/* HTTP Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(entry.statusCode)}
                      </td>

                      {/* Message & Path */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="truncate font-medium text-slate-900 dark:text-white text-xs leading-relaxed" title={entry.message}>
                          {entry.message}
                        </div>
                        {entry.url && (
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5" title={entry.url}>
                            {entry.url}
                          </div>
                        )}
                        {entry.sourceFile && (
                          <div className="text-[11px] font-mono text-rose-600 dark:text-rose-400 truncate mt-0.5">
                            {entry.sourceFile}:{entry.sourceLine}
                          </div>
                        )}
                      </td>

                      {/* Client IP */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono text-slate-500 dark:text-slate-400">
                        {entry.clientIp ? (
                          <span>
                            {entry.clientIp}
                            {entry.clientPort ? `:${entry.clientPort}` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspect(entry);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 rounded-md transition-colors"
                          title="Inspect full details and surrounding log context"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-3">
              <span>
                Showing <strong className="font-semibold text-slate-900 dark:text-white">{entries.length > 0 ? (page - 1) * limit + 1 : 0}</strong> to{' '}
                <strong className="font-semibold text-slate-900 dark:text-white">{Math.min(page * limit, totalEntries)}</strong> of{' '}
                <strong className="font-semibold text-slate-900 dark:text-white">{totalEntries}</strong> errors
              </span>
              <div className="flex items-center gap-1.5 ml-4">
                <span>Rows:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <span className="px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Raw Log Terminal View */
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 shadow-lg overflow-hidden">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-slate-200">Raw Error Logs ({entries.length} records shown)</span>
            </div>
            <button
              onClick={() => {
                const text = entries.map((e) => e.raw || e.message).join('\n');
                copyToClipboard(text, 'raw_all');
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md font-mono text-xs transition-colors"
            >
              {copiedId === 'raw_all' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
              <span>{copiedId === 'raw_all' ? 'Copied' : 'Copy All'}</span>
            </button>
          </div>
          <div className="font-mono text-xs text-slate-300 space-y-1 overflow-x-auto max-h-[600px] leading-relaxed select-text">
            {entries.length === 0 ? (
              <div className="text-slate-500 py-8 text-center">No raw error records found for the current query.</div>
            ) : (
              entries.map((e, idx) => (
                <div key={e.id} className="hover:bg-slate-900 py-0.5 px-1 rounded">
                  <span className="text-slate-600 select-none mr-3">{String(idx + 1).padStart(3, '0')}</span>
                  <span className={e.severity === 'critical' ? 'text-rose-400 font-semibold' : e.severity === 'warn' ? 'text-amber-300' : 'text-slate-300'}>
                    {e.raw || `[${e.timestamp}] [${e.module}:${e.severity}] ${e.message}`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Error Detail Inspector Modal */}
      {inspectModalOpen && activeEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Error Log Inspector
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    File: <span className="font-mono">{activeEntry.logFile}</span> (line {activeEntry.lineNumber})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInspectModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 text-sm">
              {/* Top metadata cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">Severity</span>
                  <div className="mt-1">{getSeverityBadge(activeEntry.severity)}</div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">HTTP Status</span>
                  <div className="mt-1">{getStatusBadge(activeEntry.statusCode)}</div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">Module</span>
                  <div className="mt-1 font-mono font-semibold text-xs text-slate-900 dark:text-white">
                    {activeEntry.module}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">Process ID</span>
                  <div className="mt-1 font-mono text-xs text-slate-900 dark:text-white">
                    pid {activeEntry.pid || '—'}
                  </div>
                </div>
              </div>

              {/* Timestamp & Request Info */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Logged Timestamp:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {activeEntry.timestamp} ({formatTime(activeEntry.timestamp)})
                  </span>
                </div>
                {activeEntry.clientIp && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Client Address:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {activeEntry.clientIp}{activeEntry.clientPort ? `:${activeEntry.clientPort}` : ''}
                    </span>
                  </div>
                )}
                {activeEntry.url && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Request Target / Path:</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 truncate max-w-md" title={activeEntry.url}>
                      {activeEntry.url}
                    </span>
                  </div>
                )}
                {activeEntry.referer && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Referer:</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400 truncate max-w-md" title={activeEntry.referer}>
                      {activeEntry.referer}
                    </span>
                  </div>
                )}
                {activeEntry.sourceFile && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Source File:</span>
                    <span className="font-mono text-rose-600 dark:text-rose-400">
                      {activeEntry.sourceFile}:{activeEntry.sourceLine}
                    </span>
                  </div>
                )}
              </div>

              {/* Full Error Message Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Recorded Error Message
                  </span>
                  <button
                    onClick={() => copyToClipboard(activeEntry.message, 'msg')}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {copiedId === 'msg' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Clipboard className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'msg' ? 'Copied' : 'Copy Message'}</span>
                  </button>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed overflow-x-auto select-text border border-slate-800">
                  {activeEntry.message}
                </div>
              </div>

              {/* Surrounding Log Context (+/- 2 lines) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    Surrounding Log Context (+/- 3 lines)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    target line: #{activeEntry.lineNumber}
                  </span>
                </div>

                <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 font-mono text-xs overflow-x-auto">
                  {contextLoading ? (
                    <div className="py-4 text-center text-slate-400 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                      <span>Loading physical log context...</span>
                    </div>
                  ) : contextError ? (
                    <div className="text-rose-400 text-xs py-2">{contextError}</div>
                  ) : contextData && contextData.context ? (
                    <div className="space-y-1">
                      {contextData.context.map((line) => (
                        <div
                          key={line.lineNumber}
                          className={`flex items-start gap-2 py-0.5 px-1.5 rounded ${
                            line.isTarget
                              ? 'bg-rose-900/40 text-rose-300 font-semibold border-l-2 border-rose-500'
                              : 'text-slate-400'
                          }`}
                        >
                          <span className="text-slate-600 select-none w-8 text-right shrink-0">
                            {line.lineNumber}
                          </span>
                          <span className="break-all">{line.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 py-2">No surrounding lines found.</div>
                  )}
                </div>
              </div>

              {/* Resolution Guidance Section */}
              {(() => {
                const guidance = getResolutionGuidance(activeEntry);
                if (!guidance) return null;
                return (
                  <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        {guidance.title}
                      </span>
                      {guidance.docsLink && (
                        <a
                          href={guidance.docsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          <span>cPanel Documentation</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <p className="leading-relaxed text-slate-600 dark:text-slate-300">
                      {guidance.advice}
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end rounded-b-2xl">
              <button
                onClick={() => setInspectModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg text-xs transition-colors"
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
