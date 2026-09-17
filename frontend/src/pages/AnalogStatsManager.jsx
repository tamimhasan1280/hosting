import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  Filter,
  Globe,
  HardDrive,
  Info,
  Layers,
  Laptop,
  Monitor,
  PieChart,
  RefreshCw,
  Search,
  Server,
  Shield,
  Smartphone,
  Terminal,
  TrendingUp,
  Users,
  Wifi,
  X
} from 'lucide-react';
import { api } from '../services/api';

export default function AnalogStatsManager({ onBack, onNavigate, user }) {
  const cpanelUser = user || 'cpanel_user';

  // Domain & Period state
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('ALL');
  const [periodsData, setPeriodsData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('current_month');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState('summary');

  // Privacy: IP Masking toggle
  const [maskIps, setMaskIps] = useState(true);

  // Data & Loading state
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [copied, setCopied] = useState(false);

  // Load authorized domains
  useEffect(() => {
    let isMounted = true;
    api.getAnalogDomains(cpanelUser)
      .then(res => {
        if (isMounted && res && res.success) {
          setDomains(res.domains || []);
        }
      })
      .catch(err => {
        console.error('Failed to load Analog domains:', err);
      });
    return () => { isMounted = false; };
  }, [cpanelUser]);

  // Load periods when domain changes
  useEffect(() => {
    let isMounted = true;
    api.getAnalogPeriods({ domain: selectedDomain, user: cpanelUser })
      .then(res => {
        if (isMounted && res && res.success) {
          setPeriodsData(res);
        }
      })
      .catch(err => {
        console.error('Failed to load Analog periods:', err);
      });
    return () => { isMounted = false; };
  }, [selectedDomain, cpanelUser]);

  // Load Report
  const loadReport = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      if (isManualRefresh) {
        await api.refreshAnalog({ cpanelUser });
      }

      const params = {
        domain: selectedDomain,
        user: cpanelUser,
        period: selectedPeriod
      };

      if (selectedMonth && selectedYear) {
        params.month = selectedMonth;
        params.year = selectedYear;
      }

      const res = await api.getAnalogReport(params);
      if (res && res.success) {
        setReport(res);
      } else {
        throw new Error(res?.error || 'Failed to load Analog stats report');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error generating Analog stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedDomain, selectedPeriod, selectedMonth, selectedYear]);

  // Handle Period change
  const handlePeriodChange = (val) => {
    if (val.includes('-')) {
      const [y, m] = val.split('-');
      setSelectedYear(y);
      setSelectedMonth(m);
      setSelectedPeriod('month_archive');
    } else {
      setSelectedYear('');
      setSelectedMonth('');
      setSelectedPeriod(val);
    }
  };

  // Download raw ASCII Analog report
  const handleDownloadReport = () => {
    const params = new URLSearchParams({
      domain: selectedDomain,
      user: cpanelUser,
      period: selectedPeriod
    });
    if (selectedMonth && selectedYear) {
      params.append('month', selectedMonth);
      params.append('year', selectedYear);
    }
    const url = `/api/analog/export?${params.toString()}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute daily chart max
  const maxDailyRequests = useMemo(() => {
    if (!report || !report.dailyReport || report.dailyReport.length === 0) return 1;
    return Math.max(...report.dailyReport.map(d => d.requests), 1);
  }, [report]);

  // Compute hourly chart max
  const maxHourlyRequests = useMemo(() => {
    if (!report || !report.hourlySummary || report.hourlySummary.length === 0) return 1;
    return Math.max(...report.hourlySummary.map(h => h.requests), 1);
  }, [report]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-5">
        <nav className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
          <span>cPanel</span>
          <ChevronRight className="w-3 h-3" />
          <span>Metrics</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-800 dark:text-gray-200 font-semibold">Analog Stats</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              Analog Stats
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-3xl">
              Analog Stats produces a simple, lightweight summary of all the people who have visited your site. It displays which parts of your site are being accessed most, file extension distributions, and hourly activity.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleDownloadReport}
              disabled={loading || !report || report.generalSummary?.totalRequests === 0}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm disabled:opacity-50"
              title="Download classic Analog ASCII report"
            >
              <Download className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              Download Report
            </button>
            <button
              onClick={() => loadReport(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm disabled:opacity-50"
              title="Refresh Analog stats cache"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
              Update now
            </button>
          </div>
        </div>
      </div>

      {/* Global Error Alert */}
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

      {/* Filter & Controls Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Domain Selector */}
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-500" />
              <label htmlFor="select-domain" className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                Domain:
              </label>
              <select
                id="select-domain"
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                disabled={loading || refreshing}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value="ALL">All Domains (Account-wide)</option>
                {domains.map(d => (
                  <option key={d.name} value={d.name}>
                    {d.name} {d.type ? `(${d.type})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <label htmlFor="select-period" className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                Period:
              </label>
              <select
                id="select-period"
                value={selectedMonth && selectedYear ? `${selectedYear}-${selectedMonth}` : selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                disabled={loading || refreshing}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <optgroup label="Standard Ranges">
                  <option value="current_month">Current Month</option>
                  <option value="previous_month">Previous Month</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="today">Today</option>
                </optgroup>
                {periodsData && periodsData.availableMonths && periodsData.availableMonths.length > 0 && (
                  <optgroup label="Monthly Archives">
                    {periodsData.availableMonths.map(m => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {/* Quick Links to Related Tools */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">Related:</span>
            {onNavigate && (
              <>
                <button
                  onClick={() => onNavigate('awstats')}
                  className="px-2 py-1 text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/30 rounded"
                >
                  Awstats
                </button>
                <button
                  onClick={() => onNavigate('visitors')}
                  className="px-2 py-1 text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/30 rounded"
                >
                  Visitors
                </button>
                <button
                  onClick={() => onNavigate('bandwidth')}
                  className="px-2 py-1 text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/30 rounded"
                >
                  Bandwidth
                </button>
                <button
                  onClick={() => onNavigate('raw_access')}
                  className="px-2 py-1 text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/30 rounded"
                >
                  Raw Access
                </button>
                <button
                  onClick={() => onNavigate('errors')}
                  className="px-2 py-1 text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/30 rounded"
                >
                  Errors
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Engine & Capability Info Banner */}
      {report && report.capabilities && (
        <div className="px-4 py-2.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900 dark:text-blue-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span>
              <strong>{report.capabilities.engineName}</strong> &bull; Log format: {report.capabilities.logFormat} &bull; Generated: {new Date(report.generatedAt).toLocaleTimeString()}
              {!report.capabilities.geoIpInstalled && (
                <span className="ml-2 text-amber-700 dark:text-amber-300 font-normal">
                  ({report.capabilities.geoIpMessage || 'GeoIP database is not installed or configured on the server. Country statistics are unavailable.'})
                </span>
              )}
            </span>
          </div>
          <div className="text-blue-700 dark:text-blue-300 italic">
            Scope: {report.domain} ({report.period})
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="py-24 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-3" />
          <p className="text-base font-medium">Generating Analog statistics from access logs...</p>
          <p className="text-xs text-gray-400 mt-1">Calculating file extensions, request rates, and hourly distribution.</p>
        </div>
      ) : !report || report.generalSummary?.totalRequests === 0 ? (
        <div className="py-20 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400 p-6">
          <BarChart3 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            No access data is available for this domain.
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            No HTTP access requests were recorded for {selectedDomain} during {report?.period || 'the selected period'}.
          </p>
        </div>
      ) : (
        <>
          {/* Summary KPI Cards (6 cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* 1. Total Requests */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                Total Requests
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {report.generalSummary.totalRequests.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {report.generalSummary.avgRequestsPerDay} / day avg
              </div>
            </div>

            {/* 2. Successful Requests */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                Successful Requests
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {report.generalSummary.successfulRequests.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                HTTP 2xx & 3xx
              </div>
            </div>

            {/* 3. Failed Requests */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                Failed Requests
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {report.generalSummary.failedRequests.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                HTTP 4xx & 5xx
              </div>
            </div>

            {/* 4. Pages */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                Total Pages
              </div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {report.generalSummary.totalPages.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {report.generalSummary.avgPagesPerDay} / day avg
              </div>
            </div>

            {/* 5. Data Transferred */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                Data Transferred
              </div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {report.generalSummary.formattedBytes}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {report.generalSummary.avgBytesPerDay} / day avg
              </div>
            </div>

            {/* 6. Unique Hosts */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                Unique Hosts
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {report.generalSummary.distinctHosts.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {report.generalSummary.distinctFiles} distinct files
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
              <nav className="flex space-x-1 p-2 min-w-max text-xs font-medium">
                {[
                  { id: 'summary', label: 'General Summary', icon: FileText },
                  { id: 'daily', label: 'Daily Activity', icon: Calendar },
                  { id: 'hourly', label: 'Hourly Summary', icon: Clock },
                  { id: 'urls', label: 'Requested URLs', icon: FileCode },
                  { id: 'hosts', label: 'Host Report', icon: Laptop },
                  { id: 'filetypes', label: 'File Types', icon: Archive },
                  { id: 'referrers', label: 'Referrers', icon: Compass },
                  { id: 'clients', label: 'Browsers & OS', icon: Monitor },
                  { id: 'status', label: 'Status Codes', icon: Shield },
                  { id: 'ascii', label: 'Raw ASCII Report', icon: Terminal }
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md transition select-none ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab Contents */}
            <div className="p-6">
              {/* TAB 1: GENERAL SUMMARY */}
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Analog General Summary
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs">
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                        <span className="text-gray-600 dark:text-gray-400">Successful requests:</span>
                        <span className="font-semibold text-emerald-600">{report.generalSummary.successfulRequests.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                        <span className="text-gray-600 dark:text-gray-400">Average successful requests per day:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.avgRequestsPerDay}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                        <span className="text-gray-600 dark:text-gray-400">Failed requests:</span>
                        <span className="font-semibold text-red-600">{report.generalSummary.failedRequests.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                        <span className="text-gray-600 dark:text-gray-400">Successful requests for pages:</span>
                        <span className="font-semibold text-purple-600">{report.generalSummary.totalPages.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                        <span className="text-gray-600 dark:text-gray-400">Total requests logged:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.totalRequests.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                        <span className="text-gray-600 dark:text-gray-400">Average pages per day:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.avgPagesPerDay}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                        <span className="text-gray-600 dark:text-gray-400">Distinct files requested:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.distinctFiles.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                        <span className="text-gray-600 dark:text-gray-400">Total data transferred:</span>
                        <span className="font-semibold text-indigo-600">{report.generalSummary.formattedBytes}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                        <span className="text-gray-600 dark:text-gray-400">Distinct hosts served:</span>
                        <span className="font-semibold text-blue-600">{report.generalSummary.distinctHosts.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                        <span className="text-gray-600 dark:text-gray-400">Average data transferred per day:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.avgBytesPerDay}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                        <span className="text-gray-600 dark:text-gray-400">First request:</span>
                        <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300">
                          {report.generalSummary.firstRequest ? new Date(report.generalSummary.firstRequest).toUTCString() : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                        <span className="text-gray-600 dark:text-gray-400">Last request:</span>
                        <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300">
                          {report.generalSummary.lastRequest ? new Date(report.generalSummary.lastRequest).toUTCString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DAILY ACTIVITY */}
              {activeTab === 'daily' && (
                <div className="space-y-6">
                  {/* Daily Hits Bar Chart */}
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
                    <div className="text-xs text-gray-500 mb-3 font-semibold uppercase">Daily Requests Bar Chart</div>
                    <div className="h-44 flex items-end gap-1.5 pt-4">
                      {report.dailyReport.map((day, idx) => {
                        const heightPct = Math.max(8, Math.round((day.requests / maxDailyRequests) * 100));
                        return (
                          <div
                            key={idx}
                            className="flex-1 flex flex-col items-center group relative cursor-pointer"
                            onMouseEnter={() => setHoveredBar(day)}
                            onMouseLeave={() => setHoveredBar(null)}
                          >
                            <div
                              className="w-full bg-blue-600 dark:bg-blue-500 rounded-t transition-all group-hover:bg-blue-700"
                              style={{ height: `${heightPct}%` }}
                            />
                            <span className="text-[10px] text-gray-400 mt-1">{day.dayNum}</span>
                          </div>
                        );
                      })}
                    </div>
                    {hoveredBar && (
                      <div className="mt-3 p-2 bg-gray-900 text-white text-xs rounded shadow flex items-center justify-between">
                        <span><strong>{hoveredBar.date}</strong> ({hoveredBar.dayName})</span>
                        <span>{hoveredBar.requests} requests &bull; {hoveredBar.pages} pages &bull; {hoveredBar.formattedBytes}</span>
                      </div>
                    )}
                  </div>

                  {/* Day of Week Summary */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                      Day of Week Summary
                    </h3>
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Day</th>
                            <th className="px-4 py-2.5 text-right">Requests</th>
                            <th className="px-4 py-2.5 text-right">Pages</th>
                            <th className="px-4 py-2.5 text-right">Data Transferred</th>
                            <th className="px-4 py-2.5 text-right">% Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {report.dayOfWeekReport.map(d => (
                            <tr key={d.dayNum} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{d.dayFull}</td>
                              <td className="px-4 py-2 text-right font-semibold text-blue-600">{d.requests}</td>
                              <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{d.pages}</td>
                              <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{d.formattedBytes}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{d.percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Daily Report Table */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                      Daily Report (Days of Month)
                    </h3>
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Date</th>
                            <th className="px-4 py-2.5 text-left">Day</th>
                            <th className="px-4 py-2.5 text-right">Requests</th>
                            <th className="px-4 py-2.5 text-right">Pages</th>
                            <th className="px-4 py-2.5 text-right">Data Transferred</th>
                            <th className="px-4 py-2.5 text-right">% Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {report.dailyReport.map(d => (
                            <tr key={d.date} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-2 font-mono text-gray-900 dark:text-white">{d.date}</td>
                              <td className="px-4 py-2 text-gray-600">{d.dayName}</td>
                              <td className="px-4 py-2 text-right font-semibold text-blue-600">{d.requests}</td>
                              <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{d.pages}</td>
                              <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{d.formattedBytes}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{d.percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: HOURLY ACTIVITY */}
              {activeTab === 'hourly' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Hourly Summary (00:00 - 23:00)
                  </h3>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Hour</th>
                          <th className="px-4 py-2.5 text-right">Requests</th>
                          <th className="px-4 py-2.5 text-right">Pages</th>
                          <th className="px-4 py-2.5 text-right">Data Transferred</th>
                          <th className="px-4 py-2.5 text-left w-1/3">Activity Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.hourlySummary.map(h => {
                          const barPct = maxHourlyRequests > 0 ? Math.round((h.requests / maxHourlyRequests) * 100) : 0;
                          return (
                            <tr key={h.hour} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-2 font-mono font-medium text-gray-900 dark:text-white">{h.hourLabel}</td>
                              <td className="px-4 py-2 text-right font-semibold text-blue-600">{h.requests}</td>
                              <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{h.pages}</td>
                              <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{h.formattedBytes}</td>
                              <td className="px-4 py-2">
                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${barPct}%` }} />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 10: RAW ASCII REPORT */}
              {activeTab === 'ascii' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Authentic Analog 6.0 ASCII Text Output
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExport}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download .txt
                      </button>
                    </div>
                  </div>
                  <pre className="p-4 bg-gray-900 text-gray-100 dark:bg-black font-mono text-xs rounded-lg overflow-x-auto leading-relaxed max-h-[600px]">
{`================================================================
ANALOG 6.0: Web Server Traffic Analysis
Program: ${report.capabilities.engineName}
Hostname / Scope: ${report.domain}
Analysis Period: ${report.period}
Generated: ${report.generatedAt}
================================================================

GENERAL SUMMARY
----------------------------------------------------------------
Successful requests:                  ${report.generalSummary.successfulRequests}
Failed requests:                      ${report.generalSummary.failedRequests}
Total requests:                       ${report.generalSummary.totalRequests}
Distinct files requested:             ${report.generalSummary.distinctFiles}
Distinct hosts served:                ${report.generalSummary.distinctHosts}
Successful requests for pages:        ${report.generalSummary.totalPages}
Data transferred:                     ${report.generalSummary.formattedBytes}
Average requests per day:             ${report.generalSummary.avgRequestsPerDay}
Average pages per day:                ${report.generalSummary.avgPagesPerDay}
First request:                        ${report.generalSummary.firstRequest || 'N/A'}
Last request:                         ${report.generalSummary.lastRequest || 'N/A'}
----------------------------------------------------------------`}
                  </pre>
                </div>
              )}

              {/* TAB 4: REQUESTED URLS */}
              {activeTab === 'urls' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Request Report (Top 25 Requested URLs)
                  </h3>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-2.5 text-left">URL Path</th>
                          <th className="px-4 py-2.5 text-right">Requests</th>
                          <th className="px-4 py-2.5 text-right">Pages</th>
                          <th className="px-4 py-2.5 text-right">Data Transferred</th>
                          <th className="px-4 py-2.5 text-right">% Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.topUrls.map((u, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-2 font-mono text-gray-900 dark:text-white truncate max-w-md">
                              {u.path}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-blue-600">{u.requests}</td>
                            <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{u.pages}</td>
                            <td className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">{u.formattedBytes}</td>
                            <td className="px-4 py-2 text-right text-gray-500">{u.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 10: RAW ASCII REPORT */}
              {activeTab === 'ascii' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Authentic Analog 6.0 ASCII Text Output
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExport}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download .txt
                      </button>
                    </div>
                  </div>
                  <pre className="p-4 bg-gray-900 text-gray-100 dark:bg-black font-mono text-xs rounded-lg overflow-x-auto leading-relaxed max-h-[600px]">
{`================================================================
ANALOG 6.0: Web Server Traffic Analysis
Program: ${report.capabilities.engineName}
Hostname / Scope: ${report.domain}
Analysis Period: ${report.period}
Generated: ${report.generatedAt}
================================================================

GENERAL SUMMARY
----------------------------------------------------------------
Successful requests:                  ${report.generalSummary.successfulRequests}
Failed requests:                      ${report.generalSummary.failedRequests}
Total requests:                       ${report.generalSummary.totalRequests}
Distinct files requested:             ${report.generalSummary.distinctFiles}
Distinct hosts served:                ${report.generalSummary.distinctHosts}
Successful requests for pages:        ${report.generalSummary.totalPages}
Data transferred:                     ${report.generalSummary.formattedBytes}
Average requests per day:             ${report.generalSummary.avgRequestsPerDay}
Average pages per day:                ${report.generalSummary.avgPagesPerDay}
First request:                        ${report.generalSummary.firstRequest || 'N/A'}
Last request:                         ${report.generalSummary.lastRequest || 'N/A'}
----------------------------------------------------------------`}
                  </pre>
                </div>
              )}

              {/* TAB 5: HOST REPORT */}
              {activeTab === 'hosts' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Host Report (Top 25 Visitor IP Addresses)
                    </h3>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={maskIps}
                        onChange={(e) => setMaskIps(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Mask IP addresses for privacy</span>
                    </label>
                  </div>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Visitor Host / IP</th>
                          <th className="px-4 py-2.5 text-right">Requests</th>
                          <th className="px-4 py-2.5 text-right">Pages</th>
                          <th className="px-4 py-2.5 text-right">Data Transferred</th>
                          <th className="px-4 py-2.5 text-right">Last Access</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.topHosts.map((h, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-2 font-mono font-medium text-gray-900 dark:text-white">
                              {maskIps ? h.maskedIp : h.ip}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-blue-600">{h.requests}</td>
                            <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{h.pages}</td>
                            <td className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">{h.formattedBytes}</td>
                            <td className="px-4 py-2 text-right text-gray-500">{h.lastVisit ? new Date(h.lastVisit).toLocaleString() : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 10: RAW ASCII REPORT */}
              {activeTab === 'ascii' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Authentic Analog 6.0 ASCII Text Output
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExport}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download .txt
                      </button>
                    </div>
                  </div>
                  <pre className="p-4 bg-gray-900 text-gray-100 dark:bg-black font-mono text-xs rounded-lg overflow-x-auto leading-relaxed max-h-[600px]">
{`================================================================
ANALOG 6.0: Web Server Traffic Analysis
Program: ${report.capabilities.engineName}
Hostname / Scope: ${report.domain}
Analysis Period: ${report.period}
Generated: ${report.generatedAt}
================================================================

GENERAL SUMMARY
----------------------------------------------------------------
Successful requests:                  ${report.generalSummary.successfulRequests}
Failed requests:                      ${report.generalSummary.failedRequests}
Total requests:                       ${report.generalSummary.totalRequests}
Distinct files requested:             ${report.generalSummary.distinctFiles}
Distinct hosts served:                ${report.generalSummary.distinctHosts}
Successful requests for pages:        ${report.generalSummary.totalPages}
Data transferred:                     ${report.generalSummary.formattedBytes}
Average requests per day:             ${report.generalSummary.avgRequestsPerDay}
Average pages per day:                ${report.generalSummary.avgPagesPerDay}
First request:                        ${report.generalSummary.firstRequest || 'N/A'}
Last request:                         ${report.generalSummary.lastRequest || 'N/A'}
----------------------------------------------------------------`}
                  </pre>
                </div>
              )}

              {/* TAB 6: FILE TYPES */}
              {activeTab === 'filetypes' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    File Type (Extension) Report
                  </h3>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Extension</th>
                          <th className="px-4 py-2.5 text-right">Requests</th>
                          <th className="px-4 py-2.5 text-right">Data Transferred</th>
                          <th className="px-4 py-2.5 text-right">% Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.fileTypeReport.map((f, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-2 font-mono font-medium text-gray-900 dark:text-white">{f.extension}</td>
                            <td className="px-4 py-2 text-right font-semibold text-blue-600">{f.requests}</td>
                            <td className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">{f.formattedBytes}</td>
                            <td className="px-4 py-2 text-right text-gray-500">{f.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 10: RAW ASCII REPORT */}
              {activeTab === 'ascii' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Authentic Analog 6.0 ASCII Text Output
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExport}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download .txt
                      </button>
                    </div>
                  </div>
                  <pre className="p-4 bg-gray-900 text-gray-100 dark:bg-black font-mono text-xs rounded-lg overflow-x-auto leading-relaxed max-h-[600px]">
{`================================================================
ANALOG 6.0: Web Server Traffic Analysis
Program: ${report.capabilities.engineName}
Hostname / Scope: ${report.domain}
Analysis Period: ${report.period}
Generated: ${report.generatedAt}
================================================================

GENERAL SUMMARY
----------------------------------------------------------------
Successful requests:                  ${report.generalSummary.successfulRequests}
Failed requests:                      ${report.generalSummary.failedRequests}
Total requests:                       ${report.generalSummary.totalRequests}
Distinct files requested:             ${report.generalSummary.distinctFiles}
Distinct hosts served:                ${report.generalSummary.distinctHosts}
Successful requests for pages:        ${report.generalSummary.totalPages}
Data transferred:                     ${report.generalSummary.formattedBytes}
Average requests per day:             ${report.generalSummary.avgRequestsPerDay}
Average pages per day:                ${report.generalSummary.avgPagesPerDay}
First request:                        ${report.generalSummary.firstRequest || 'N/A'}
Last request:                         ${report.generalSummary.lastRequest || 'N/A'}
----------------------------------------------------------------`}
                  </pre>
                </div>
              )}

              {/* TAB 7: REFERRERS */}
              {activeTab === 'referrers' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Referrer Report
                  </h3>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Origin / Referrer</th>
                          <th className="px-4 py-2.5 text-left">Category</th>
                          <th className="px-4 py-2.5 text-right">Requests</th>
                          <th className="px-4 py-2.5 text-right">% Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.referrers.map((r, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{r.label}</td>
                            <td className="px-4 py-2 text-gray-500">{r.category}</td>
                            <td className="px-4 py-2 text-right font-semibold text-blue-600">{r.requests}</td>
                            <td className="px-4 py-2 text-right text-gray-500">{r.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 10: RAW ASCII REPORT */}
              {activeTab === 'ascii' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Authentic Analog 6.0 ASCII Text Output
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExport}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download .txt
                      </button>
                    </div>
                  </div>
                  <pre className="p-4 bg-gray-900 text-gray-100 dark:bg-black font-mono text-xs rounded-lg overflow-x-auto leading-relaxed max-h-[600px]">
{`================================================================
ANALOG 6.0: Web Server Traffic Analysis
Program: ${report.capabilities.engineName}
Hostname / Scope: ${report.domain}
Analysis Period: ${report.period}
Generated: ${report.generatedAt}
================================================================

GENERAL SUMMARY
----------------------------------------------------------------
Successful requests:                  ${report.generalSummary.successfulRequests}
Failed requests:                      ${report.generalSummary.failedRequests}
Total requests:                       ${report.generalSummary.totalRequests}
Distinct files requested:             ${report.generalSummary.distinctFiles}
Distinct hosts served:                ${report.generalSummary.distinctHosts}
Successful requests for pages:        ${report.generalSummary.totalPages}
Data transferred:                     ${report.generalSummary.formattedBytes}
Average requests per day:             ${report.generalSummary.avgRequestsPerDay}
Average pages per day:                ${report.generalSummary.avgPagesPerDay}
First request:                        ${report.generalSummary.firstRequest || 'N/A'}
Last request:                         ${report.generalSummary.lastRequest || 'N/A'}
----------------------------------------------------------------`}
                  </pre>
                </div>
              )}

              {/* TAB 8: BROWSERS & OS */}
              {activeTab === 'clients' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                      Browser Summary
                    </h3>
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Browser</th>
                            <th className="px-4 py-2.5 text-right">Requests</th>
                            <th className="px-4 py-2.5 text-right">%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {report.browsers.map((b, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{b.name}</td>
                              <td className="px-4 py-2 text-right font-semibold text-blue-600">{b.requests}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{b.percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-purple-600" />
                      Operating System Report
                    </h3>
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Operating System</th>
                            <th className="px-4 py-2.5 text-right">Requests</th>
                            <th className="px-4 py-2.5 text-right">%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {report.operatingSystems.map((o, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{o.name}</td>
                              <td className="px-4 py-2 text-right font-semibold text-purple-600">{o.requests}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{o.percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 9: STATUS CODES */}
              {activeTab === 'status' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      HTTP Status Code Report
                    </h3>
                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('errors')}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        Inspect Raw Error Logs &rarr;
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Status Code</th>
                          <th className="px-4 py-2.5 text-left">Description</th>
                          <th className="px-4 py-2.5 text-right">Requests</th>
                          <th className="px-4 py-2.5 text-right">% Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.statusCodes.map(s => {
                          let label = 'Unknown';
                          let badgeColor = 'bg-gray-100 text-gray-700';
                          if (s.code === 200) { label = 'OK (Success)'; badgeColor = 'bg-green-100 text-green-800'; }
                          else if (s.code === 301) { label = 'Moved Permanently'; badgeColor = 'bg-blue-100 text-blue-800'; }
                          else if (s.code === 302) { label = 'Found (Redirect)'; badgeColor = 'bg-blue-100 text-blue-800'; }
                          else if (s.code === 304) { label = 'Not Modified'; badgeColor = 'bg-gray-100 text-gray-800'; }
                          else if (s.code === 400) { label = 'Bad Request'; badgeColor = 'bg-amber-100 text-amber-800'; }
                          else if (s.code === 401) { label = 'Unauthorized'; badgeColor = 'bg-amber-100 text-amber-800'; }
                          else if (s.code === 403) { label = 'Forbidden'; badgeColor = 'bg-red-100 text-red-800'; }
                          else if (s.code === 404) { label = 'Not Found'; badgeColor = 'bg-red-100 text-red-800'; }
                          else if (s.code >= 500) { label = 'Internal Server Error'; badgeColor = 'bg-red-100 text-red-900 font-bold'; }

                          return (
                            <tr key={s.code} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-2 font-mono font-bold">
                                <span className={`px-2 py-0.5 rounded text-xs ${badgeColor}`}>
                                  {s.code}
                                </span>
                              </td>
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{label}</td>
                              <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">{s.requests}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{s.percentage}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 10: RAW ASCII REPORT */}
              {activeTab === 'ascii' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Authentic Analog 6.0 ASCII Text Output
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExport}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download .txt
                      </button>
                    </div>
                  </div>
                  <pre className="p-4 bg-gray-900 text-gray-100 dark:bg-black font-mono text-xs rounded-lg overflow-x-auto leading-relaxed max-h-[600px]">
{`================================================================
ANALOG 6.0: Web Server Traffic Analysis
Program: ${report.capabilities.engineName}
Hostname / Scope: ${report.domain}
Analysis Period: ${report.period}
Generated: ${report.generatedAt}
================================================================

GENERAL SUMMARY
----------------------------------------------------------------
Successful requests:                  ${report.generalSummary.successfulRequests}
Failed requests:                      ${report.generalSummary.failedRequests}
Total requests:                       ${report.generalSummary.totalRequests}
Distinct files requested:             ${report.generalSummary.distinctFiles}
Distinct hosts served:                ${report.generalSummary.distinctHosts}
Successful requests for pages:        ${report.generalSummary.totalPages}
Data transferred:                     ${report.generalSummary.formattedBytes}
Average requests per day:             ${report.generalSummary.avgRequestsPerDay}
Average pages per day:                ${report.generalSummary.avgPagesPerDay}
First request:                        ${report.generalSummary.firstRequest || 'N/A'}
Last request:                         ${report.generalSummary.lastRequest || 'N/A'}
----------------------------------------------------------------`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
