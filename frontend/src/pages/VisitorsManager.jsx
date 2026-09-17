import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, Users, Globe, ArrowLeft, RefreshCw, Search, Calendar,
  TrendingUp, HardDrive, AlertTriangle, CheckCircle2, AlertCircle, X,
  Eye, Filter, ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink,
  Shield, Laptop, Compass, Clock, Activity, FileText, Lock
} from 'lucide-react';
import { api } from '../services/api';

const DATE_RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7days', label: 'Last 7 Days' },
  { id: '30days', label: 'Last 30 Days' },
  { id: 'custom', label: 'Custom Range' }
];

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getStatusBadge(status) {
  const code = parseInt(status, 10);
  if (code >= 200 && code < 300) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
  } else if (code >= 300 && code < 400) {
    return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
  } else if (code >= 400 && code < 500) {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
  }
  return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
}

export default function VisitorsManager({ onBack, onNavigate, user = 'cpanel_user' }) {
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('ALL');
  const [selectedRange, setSelectedRange] = useState('today');

  // Custom date inputs
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Overview Data
  const [overview, setOverview] = useState(null);

  // Paginated Records
  const [records, setRecords] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('time');
  const [sortOrder, setSortOrder] = useState('desc');
  const [maskIp, setMaskIp] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);

  // Inspect Record Modal
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectedRecord, setInspectedRecord] = useState(null);

  // Hovered time bucket for chart tooltip
  const [hoveredBucket, setHoveredBucket] = useState(null);

  // Notifications
  const [msg, setMsg] = useState({ text: '', type: '' });

  const showMsg = (text, type = 'error') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 6000);
  };

  // Load Domains list
  const loadDomains = async () => {
    try {
      const res = await api.getVisitorDomains(user);
      setDomains(res.domains || []);
    } catch (err) {
      console.error('Failed to load domains:', err);
    }
  };

  // Load Overview Metrics & Aggregations
  const loadOverview = async () => {
    try {
      setLoading(true);
      const params = {
        user,
        domain: selectedDomain,
        range: selectedRange
      };
      if (selectedRange === 'custom') {
        if (!customStart) return;
        params.startDate = customStart;
        if (customEnd) params.endDate = customEnd;
      }

      const res = await api.getVisitorOverview(params);
      setOverview(res);
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to load visitor metrics');
    } finally {
      setLoading(false);
    }
  };

  // Load Paginated Records
  const loadRecords = async () => {
    try {
      setRecordsLoading(true);
      const params = {
        user,
        domain: selectedDomain,
        range: selectedRange,
        page,
        limit,
        search: searchQuery,
        statusFilter,
        sortBy,
        sortOrder,
        maskIp
      };
      if (selectedRange === 'custom' && customStart) {
        params.startDate = customStart;
        if (customEnd) params.endDate = customEnd;
      }

      const res = await api.getVisitorRecords(params);
      setRecords(res.records || []);
      setTotalRecords(res.totalRecords || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setRecordsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadDomains();
  }, [user]);

  // When domain or range changes, reload overview and reset page
  useEffect(() => {
    if (selectedRange === 'custom' && !customStart) return;
    loadOverview();
    setPage(1);
  }, [user, selectedDomain, selectedRange, customStart, customEnd]);

  // When pagination or filters change, reload records
  useEffect(() => {
    if (selectedRange === 'custom' && !customStart) return;
    loadRecords();
  }, [user, selectedDomain, selectedRange, customStart, customEnd, page, limit, searchQuery, statusFilter, sortBy, sortOrder, maskIp]);

  // Handle Refresh All
  const handleRefresh = async () => {
    await Promise.all([loadOverview(), loadRecords()]);
  };

  // Inspect a record
  const handleInspect = (record) => {
    setInspectedRecord(record);
    setInspectModalOpen(true);
  };

  // Calculate max requests in time series for chart bar scale
  const maxBucketRequests = useMemo(() => {
    if (!overview?.timeSeries || overview.timeSeries.length === 0) return 1;
    return Math.max(...overview.timeSeries.map(b => b.requests), 1);
  }, [overview]);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <button 
              onClick={onBack} 
              className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Metrics
            </button>
            <span>/</span>
            <span className="text-gray-800 dark:text-gray-200 font-medium">Visitors</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Visitors</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Inspect real web server requests, top visited pages, HTTP status codes, and user agents
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar: Domain & Date Range Pickers */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Domain Picker */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 rounded-lg text-xs shadow-sm">
            <Globe className="w-3.5 h-3.5 text-gray-500" />
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white font-medium cursor-pointer"
            >
              <option value="ALL">All Domains ({domains.length})</option>
              {domains.map(d => (
                <option key={d.name} value={d.name}>
                  {d.name} ({d.type})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium">
            {DATE_RANGES.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRange(r.id)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  selectedRange === r.id
                    ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors shadow-sm"
            title="Refresh visitor metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Custom Date Inputs Drawer (when Custom Range selected) */}
      {selectedRange === 'custom' && (
        <div className="bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800/50 shadow-sm flex flex-wrap items-center gap-3 text-xs">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-gray-700 dark:text-gray-300">Custom Timeframe:</span>
          <div className="flex items-center gap-2">
            <label className="text-gray-500">From:</label>
            <input
              type="datetime-local"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-500">To:</label>
            <input
              type="datetime-local"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
            />
          </div>
          <button
            onClick={loadOverview}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
          >
            Apply Range
          </button>
        </div>
      )}

      {/* Error Toast */}
      {msg.text && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{msg.text}</span>
          </div>
          <button onClick={() => setMsg({ text: '', type: '' })} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Requests</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {loading ? '...' : (overview?.summary?.totalRequests || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">HTTP hits in period</p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unique Visitors</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {loading ? '...' : (overview?.summary?.uniqueVisitors || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{overview?.summary?.uniqueIps || 0} unique IP addresses</p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data Transferred</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {loading ? '...' : formatBytes(overview?.summary?.totalBytes || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Total outbound bandwidth</p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <HardDrive className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Error Rate</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {loading ? '...' : `${overview?.summary?.errorRate || '0.0'}%`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{overview?.summary?.status4xx || 0} 4xx · {overview?.summary?.status5xx || 0} 5xx</p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Time-Series Activity Chart */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>Visitor Activity Timeline</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Request frequency aggregated across {overview?.domain === 'ALL' ? 'all domains' : overview?.domain}
            </p>
          </div>
          {hoveredBucket && (
            <div className="text-xs bg-gray-50 dark:bg-gray-900 px-3 py-1 rounded border border-gray-200 dark:border-gray-700 flex items-center gap-3">
              <span className="font-semibold text-gray-900 dark:text-white font-mono">{hoveredBucket.time}</span>
              <span className="text-blue-600 font-medium">{hoveredBucket.requests} requests</span>
              <span className="text-emerald-600 font-medium">{hoveredBucket.uniqueVisitors} visitors</span>
              <span className="text-gray-500">{formatBytes(hoveredBucket.bytes)}</span>
            </div>
          )}
        </div>

        {/* Activity Bar Visualization */}
        {(!overview?.timeSeries || overview.timeSeries.length === 0) ? (
          <div className="py-12 text-center text-gray-500 text-xs">
            No visitor activity recorded in this timeframe.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="h-32 flex items-end gap-1 pt-6 px-2 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
              {overview.timeSeries.map((b, idx) => {
                const heightPercent = Math.max(8, Math.round((b.requests / maxBucketRequests) * 100));
                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredBucket(b)}
                    onMouseLeave={() => setHoveredBucket(null)}
                    className="flex-1 min-w-[12px] flex flex-col items-center group cursor-pointer"
                  >
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-t transition-all shadow-xs"
                    ></div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[11px] text-gray-400 font-mono px-2">
              <span>{overview.timeSeries[0]?.time}</span>
              <span>{overview.timeSeries[overview.timeSeries.length - 1]?.time}</span>
            </div>
          </div>
        )}
      </div>

      {/* Two Column Grid: Top Pages & HTTP Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Pages */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Top Visited Pages</span>
            </h3>
            <span className="text-xs text-gray-500">{overview?.topPages?.length || 0} unique paths</span>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-80">
            {(!overview?.topPages || overview.topPages.length === 0) ? (
              <p className="text-xs text-gray-500 text-center py-8">No page visit records available.</p>
            ) : (
              <div className="space-y-3">
                {overview.topPages.map((page, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-mono text-gray-900 dark:text-white truncate max-w-[280px]">
                        <span className="text-gray-400 font-semibold">{idx + 1}.</span>
                        <span className="truncate">{page.path}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadge(page.status)}`}>
                          {page.status}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white font-mono">{page.hits} hits</span>
                        <span className="text-gray-400 text-[11px]">({page.percentage}%)</span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${page.percentage}%` }}
                        className="bg-blue-600 h-full rounded-full"
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* HTTP Status Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>HTTP Status Codes</span>
            </h3>
            <span className="text-xs text-gray-500">{overview?.summary?.totalRequests || 0} total</span>
          </div>

          <div className="p-4 flex-1 space-y-4">
            {/* 2xx Success */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-emerald-700 dark:text-emerald-300">2xx Success</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                  {overview?.summary?.status2xx || 0} (
                  {overview?.summary?.totalRequests ? Math.round((overview.summary.status2xx / overview.summary.totalRequests) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div
                  style={{ width: `${overview?.summary?.totalRequests ? (overview.summary.status2xx / overview.summary.totalRequests) * 100 : 0}%` }}
                  className="bg-emerald-500 h-full rounded-full"
                ></div>
              </div>
            </div>

            {/* 3xx Redirects */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-blue-700 dark:text-blue-300">3xx Redirections</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                  {overview?.summary?.status3xx || 0} (
                  {overview?.summary?.totalRequests ? Math.round((overview.summary.status3xx / overview.summary.totalRequests) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div
                  style={{ width: `${overview?.summary?.totalRequests ? (overview.summary.status3xx / overview.summary.totalRequests) * 100 : 0}%` }}
                  className="bg-blue-500 h-full rounded-full"
                ></div>
              </div>
            </div>

            {/* 4xx Client Errors */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-amber-700 dark:text-amber-300">4xx Client Errors</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                  {overview?.summary?.status4xx || 0} (
                  {overview?.summary?.totalRequests ? Math.round((overview.summary.status4xx / overview.summary.totalRequests) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div
                  style={{ width: `${overview?.summary?.totalRequests ? (overview.summary.status4xx / overview.summary.totalRequests) * 100 : 0}%` }}
                  className="bg-amber-500 h-full rounded-full"
                ></div>
              </div>
            </div>

            {/* 5xx Server Errors */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-red-700 dark:text-red-300">5xx Server Errors</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                  {overview?.summary?.status5xx || 0} (
                  {overview?.summary?.totalRequests ? Math.round((overview.summary.status5xx / overview.summary.totalRequests) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div
                  style={{ width: `${overview?.summary?.totalRequests ? (overview.summary.status5xx / overview.summary.totalRequests) * 100 : 0}%` }}
                  className="bg-red-500 h-full rounded-full"
                ></div>
              </div>
            </div>

            {/* Granular status counts pill grid */}
            {overview?.summary?.statusCounts && Object.keys(overview.summary.statusCounts).length > 0 && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Discrete Response Codes:</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(overview.summary.statusCounts).map(([code, cnt]) => (
                    <span
                      key={code}
                      className={`px-2 py-0.5 rounded text-xs font-mono font-semibold border ${getStatusBadge(code)}`}
                    >
                      {code}: {cnt}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Grid 2: Top Referrers & Top Browsers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Referrers */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-purple-600" />
              <span>Traffic Sources & Referrers</span>
            </h3>
            <span className="text-xs text-gray-500">{overview?.topReferrers?.length || 0} sources</span>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-60">
            {(!overview?.topReferrers || overview.topReferrers.length === 0) ? (
              <p className="text-xs text-gray-500 text-center py-6">No referrer records found.</p>
            ) : (
              <div className="space-y-2.5">
                {overview.topReferrers.map((ref, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 max-w-[260px] truncate">
                      <span className="text-gray-400 font-semibold">{idx + 1}.</span>
                      <span className="font-medium text-gray-900 dark:text-white truncate" title={ref.referrer}>
                        {ref.label || ref.referrer}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {ref.category}
                      </span>
                      <span className="font-mono font-semibold text-gray-900 dark:text-white">{ref.count} visits</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Browsers & User Agents */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Laptop className="w-4 h-4 text-indigo-600" />
              <span>Browsers & Devices</span>
            </h3>
            <span className="text-xs text-gray-500">Client classification</span>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-60">
            {(!overview?.topBrowsers || overview.topBrowsers.length === 0) ? (
              <p className="text-xs text-gray-500 text-center py-6">No user agent records available.</p>
            ) : (
              <div className="space-y-3">
                {overview.topBrowsers.map((b, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-900 dark:text-white">{b.name}</span>
                      <span className="font-mono font-semibold text-gray-900 dark:text-white">
                        {b.count} ({b.percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${b.percent}%` }}
                        className="bg-indigo-600 h-full rounded-full"
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Request Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden space-y-4 p-4">
        {/* Table Toolbar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700 pb-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by URL path, IP, status..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
              <span className="text-gray-500 px-1 font-medium">Status:</span>
              {['ALL', '2xx', '3xx', '4xx', '5xx'].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setPage(1);
                  }}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* IP Masking Toggle */}
            <button
              onClick={() => setMaskIp(!maskIp)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                maskIp 
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
              }`}
              title="Toggle IP privacy masking"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{maskIp ? 'IPs Masked' : 'Raw IPs'}</span>
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => {
                  setSortBy('time');
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                }}>
                  <div className="flex items-center gap-1">
                    <span>Date & Time</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3">Client IP</th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => {
                  setSortBy('path');
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                }}>
                  <div className="flex items-center gap-1">
                    <span>HTTP Request Path</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-3 py-3 cursor-pointer select-none" onClick={() => {
                  setSortBy('status');
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                }}>
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-3 py-3 cursor-pointer select-none" onClick={() => {
                  setSortBy('size');
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                }}>
                  <div className="flex items-center gap-1">
                    <span>Bytes</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3">Referrer</th>
                <th className="px-4 py-3">User Agent</th>
                <th className="px-3 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {recordsLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-blue-600" />
                    <span>Loading visitor logs...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-400 opacity-60" />
                    <p className="font-semibold text-gray-700 dark:text-gray-300">No visitor records found</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      No web requests match your current domain, timeframe, or search criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="px-4 py-3 font-mono whitespace-nowrap text-gray-900 dark:text-white">
                      {new Date(rec.timestamp).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {rec.ip}
                    </td>

                    <td className="px-4 py-3 font-mono max-w-[280px] truncate text-gray-900 dark:text-white" title={rec.fullUrl}>
                      <span className="font-bold text-blue-600 dark:text-blue-400 mr-1.5">{rec.method}</span>
                      <span>{rec.url}</span>
                    </td>

                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${getStatusBadge(rec.status)}`}>
                        {rec.status}
                      </span>
                    </td>

                    <td className="px-3 py-3 font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatBytes(rec.bytes)}
                    </td>

                    <td className="px-4 py-3 max-w-[160px] truncate text-gray-500" title={rec.referrer || 'Direct'}>
                      {rec.referrer || '-'}
                    </td>

                    <td className="px-4 py-3 max-w-[180px] truncate text-gray-500" title={rec.userAgent || '-'}>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{rec.browser}</span>
                      {rec.os && rec.os !== 'Other' && <span className="text-[10px] text-gray-400 ml-1">({rec.os})</span>}
                    </td>

                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => handleInspect(rec)}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Inspect full HTTP request"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs border-t border-gray-200 dark:border-gray-700">
          <div className="text-gray-500">
            Showing <span className="font-semibold text-gray-800 dark:text-gray-200">{records.length > 0 ? (page - 1) * limit + 1 : 0}</span> to{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">{Math.min(page * limit, totalRecords)}</span> of{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">{totalRecords}</span> entries
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-gray-500">
              <span>Rows per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value, 10));
                  setPage(1);
                }}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-900 dark:text-white"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-gray-700 dark:text-gray-300">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Inspection Modal */}
      {inspectModalOpen && inspectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Request Detail Inspection</h3>
              </div>
              <button onClick={() => setInspectModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700 font-mono">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">HTTP Status</span>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded font-bold border ${getStatusBadge(inspectedRecord.status)}`}>
                    {inspectedRecord.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">HTTP Method & Protocol</span>
                  <span className="font-bold text-gray-900 dark:text-white mt-0.5 block">
                    {inspectedRecord.method} ({inspectedRecord.protocol})
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">Client IP Address</span>
                  <span className="text-gray-900 dark:text-white mt-0.5 block">
                    {inspectedRecord.ip}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">Response Payload</span>
                  <span className="text-gray-900 dark:text-white mt-0.5 block">
                    {formatBytes(inspectedRecord.bytes)} ({inspectedRecord.bytes} bytes)
                  </span>
                </div>
              </div>

              <div>
                <span className="text-gray-500 uppercase font-semibold text-[10px] block mb-1">Requested URI / Path:</span>
                <pre className="p-2.5 bg-gray-100 dark:bg-gray-900 text-blue-600 dark:text-blue-400 rounded-lg font-mono overflow-x-auto select-all">
                  {inspectedRecord.fullUrl}
                </pre>
              </div>

              <div>
                <span className="text-gray-500 uppercase font-semibold text-[10px] block mb-1">Referrer URL:</span>
                <p className="p-2 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-lg font-mono break-all">
                  {inspectedRecord.referrer || 'None (Direct Request)'}
                </p>
              </div>

              <div>
                <span className="text-gray-500 uppercase font-semibold text-[10px] block mb-1">Raw User Agent:</span>
                <p className="p-2.5 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-lg font-mono break-all select-all text-[11px]">
                  {inspectedRecord.userAgent || 'None specified'}
                </p>
              </div>

              <div className="flex justify-between items-center text-gray-400 text-[11px] pt-2 border-t border-gray-200 dark:border-gray-700">
                <span>Domain: <strong>{inspectedRecord.domain}</strong></span>
                <span>UTC Timestamp: {inspectedRecord.timestamp}</span>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setInspectModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
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
