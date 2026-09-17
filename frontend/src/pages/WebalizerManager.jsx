import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowDownRight,
  ArrowRight,
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
  HelpCircle,
  Info,
  Layers,
  Laptop,
  LogIn,
  LogOut,
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

export default function WebalizerManager({ onBack, onNavigate, user }) {
  const cpanelUser = user || 'cpanel_user';

  // Domain & Period state
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('ALL');
  const [periodsData, setPeriodsData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('current_month');
  const [selectedMonth, setSelectedMonth] = useState('');

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
    api.getWebalizerDomains(cpanelUser)
      .then(res => {
        if (isMounted && res && res.success) {
          setDomains(res.domains || []);
          if (res.domains && res.domains.length > 0) {
            const hasPrimary = res.domains.find(d => d.type === 'Primary Domain');
            if (hasPrimary) {
              setSelectedDomain(hasPrimary.domain || hasPrimary.name);
            } else {
              setSelectedDomain(res.domains[0].domain || res.domains[0].name);
            }
          }
        }
      })
      .catch(err => {
        console.error('Failed to load Webalizer domains:', err);
        if (isMounted) setError('Unable to load authorized domains for your account.');
      });

    return () => { isMounted = false; };
  }, [cpanelUser]);

  // Load available periods for domain
  useEffect(() => {
    if (!selectedDomain) return;
    let isMounted = true;

    api.getWebalizerPeriods({ domain: selectedDomain, user: cpanelUser })
      .then(res => {
        if (isMounted && res && res.success) {
          setPeriodsData(res);
          if (res.defaultPeriod) {
            setSelectedPeriod(res.defaultPeriod);
          }
        }
      })
      .catch(err => {
        console.error('Failed to load Webalizer periods:', err);
      });

    return () => { isMounted = false; };
  }, [selectedDomain, cpanelUser]);

  // Fetch Webalizer Report
  const loadReport = (isRefresh = false) => {
    if (!selectedDomain) return;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const queryPeriod = selectedMonth || selectedPeriod;

    api.getWebalizerReport({
      domain: selectedDomain,
      period: queryPeriod,
      user: cpanelUser,
      anonymize: maskIps
    })
      .then(res => {
        if (res && res.success) {
          setReport(res);
        } else {
          setError(res?.error || 'Failed to generate Webalizer statistics.');
        }
      })
      .catch(err => {
        console.error('Webalizer error:', err);
        setError(err.response?.data?.error || err.message || 'Error communicating with Webalizer service.');
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    loadReport(false);
  }, [selectedDomain, selectedPeriod, selectedMonth, maskIps, cpanelUser]);

  const handleRefresh = () => {
    setRefreshing(true);
    api.refreshWebalizer({ cpanelUser })
      .then(() => loadReport(true))
      .catch(() => loadReport(true));
  };

  const handleExport = (format = 'html') => {
    const queryPeriod = selectedMonth || selectedPeriod;
    const exportUrl = `/api/webalizer/export?domain=${encodeURIComponent(selectedDomain)}&period=${encodeURIComponent(queryPeriod)}&user=${encodeURIComponent(cpanelUser)}&anonymize=${maskIps}&format=${format}`;
    window.open(exportUrl, '_blank');
  };

  const handleCopyAscii = () => {
    if (!report) return;
    const s = report.generalSummary;
    const text = `================================================================
WEBALIZER 2.23: Web Server Traffic Analysis
Program: ${report.capabilities.engineName}
Hostname / Scope: ${report.domain}
Analysis Period: ${report.period}
Generated: ${report.generatedAt}
================================================================

SUMMARY TOTALS
----------------------------------------------------------------
Total Hits:                           ${s.totalHits}
Total Files:                          ${s.totalFiles}
Total Pages:                          ${s.totalPages}
Total Visits:                         ${s.totalVisits}
Total Sites (Distinct Hosts):         ${s.totalSites}
Total Data Transferred:               ${s.formattedBytes} (${s.totalKBytes} KB)
Daily Average Hits:                   ${s.avgHitsPerDay}
Daily Average Files:                  ${s.avgFilesPerDay}
Daily Average Pages:                  ${s.avgPagesPerDay}
Daily Average Visits:                 ${s.avgVisitsPerDay}
Daily Average KBytes:                 ${s.avgKBytesPerDay} KB
First Request:                        ${s.firstRequest || 'N/A'}
Last Request:                         ${s.lastRequest || 'N/A'}
----------------------------------------------------------------`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Find max value in hourly distribution for proportional bars
  const maxHourlyHits = useMemo(() => {
    if (!report || !report.hourlyStatistics) return 1;
    const max = Math.max(...report.hourlyStatistics.map(h => h.hits), 0);
    return max > 0 ? max : 1;
  }, [report]);

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
        <button
          onClick={onBack}
          className="hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          cPanel
        </button>
        <ChevronRight className="w-3 h-3 text-gray-400" />
        <span className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer" onClick={onBack}>
          Metrics
        </span>
        <ChevronRight className="w-3 h-3 text-gray-400" />
        <span className="text-gray-800 dark:text-gray-200 font-semibold">Webalizer</span>
      </nav>

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Webalizer
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Webalizer 2.23 Compatible
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Standard visual web server traffic statistics and hourly usage analysis for your domains.
          </p>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition shadow-sm"
            title="Refresh statistics from current access logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Update now'}
          </button>

          <div className="relative group">
            <button
              onClick={() => handleExport('html')}
              disabled={loading || !report}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Download Report
            </button>
          </div>
        </div>
      </div>

      {/* Scope and Period Selector Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Domain Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Domain Scope
            </label>
            <select
              value={selectedDomain}
              onChange={(e) => {
                setSelectedDomain(e.target.value);
                setSelectedMonth('');
              }}
              className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">All Domains (Consolidated)</option>
              {domains.map(d => {
                const domName = d.domain || d.name;
                return (
                  <option key={domName} value={domName}>
                    {domName} ({d.type || 'Domain'}{d.hasLog ? ' • active' : ' • empty'})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Standard Period Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Reporting Period
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                setSelectedMonth('');
              }}
              className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {periodsData?.standardPeriods?.map(p => (
                <option key={p.key} value={p.key}>{p.label}</option>
              )) || (
                <>
                  <option value="current_month">Current Month</option>
                  <option value="previous_month">Previous Month</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="today">Today</option>
                </>
              )}
            </select>
          </div>

          {/* Historical Month Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Historical Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
              }}
              className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">-- Active Timeframe --</option>
              {periodsData?.availableMonths?.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Privacy Masking Toggle */}
          <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700">
            <div className="text-xs">
              <span className="font-semibold text-gray-800 dark:text-gray-200 block">Privacy Masking</span>
              <span className="text-gray-500 dark:text-gray-400 text-[10px]">Mask visitor IPs</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={maskIps}
                onChange={(e) => setMaskIps(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Sibling Tool Quick Navigation */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span className="text-gray-400">Related Metrics:</span>
            {onNavigate && (
              <>
                <button onClick={() => onNavigate('awstats')} className="text-blue-600 dark:text-blue-400 hover:underline px-1.5 py-0.5">Awstats</button>
                &bull;
                <button onClick={() => onNavigate('analog_stats')} className="text-blue-600 dark:text-blue-400 hover:underline px-1.5 py-0.5">Analog Stats</button>
                &bull;
                <button onClick={() => onNavigate('visitors')} className="text-blue-600 dark:text-blue-400 hover:underline px-1.5 py-0.5">Visitors</button>
                &bull;
                <button onClick={() => onNavigate('bandwidth')} className="text-blue-600 dark:text-blue-400 hover:underline px-1.5 py-0.5">Bandwidth</button>
                &bull;
                <button onClick={() => onNavigate('raw_access')} className="text-blue-600 dark:text-blue-400 hover:underline px-1.5 py-0.5">Raw Access</button>
                &bull;
                <button onClick={() => onNavigate('errors')} className="text-blue-600 dark:text-blue-400 hover:underline px-1.5 py-0.5">Errors</button>
              </>
            )}
          </div>
          <div className="text-[11px] text-gray-400">
            Engine: {report?.capabilities?.engine === 'native_webalizer' ? 'Native Webalizer Binary' : 'cPanel Embedded Webalizer Engine'}
          </div>
        </div>
      </div>

      {/* Engine & Capability Info Banner */}
      {report && report.capabilities && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>
              <strong>{report.capabilities.engineName}</strong> &bull; Log format: {report.capabilities.logFormat} &bull; Generated: {new Date(report.generatedAt).toLocaleTimeString()}
              {!report.capabilities.geoIpInstalled && (
                <span className="ml-2 text-amber-700 dark:text-amber-300 font-normal">
                  ({report.capabilities.geoIpMessage || 'GeoIP database is not installed or configured on the server. Country statistics are unavailable.'})
                </span>
              )}
            </span>
          </div>
          <div className="text-emerald-700 dark:text-emerald-300 italic">
            Scope: {report.domain} ({report.period})
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="py-24 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-3" />
          <p className="text-base font-medium">Generating Webalizer statistics from access logs...</p>
          <p className="text-xs text-gray-400 mt-1">Aggregating hits, files, pages, visits, sites, and hourly usage.</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-red-200 dark:border-red-900/50 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Unable to Load Webalizer Statistics</h3>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
          <button
            onClick={() => loadReport(false)}
            className="mt-4 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition"
          >
            Retry Analysis
          </button>
        </div>
      ) : !report || report.generalSummary.totalHits === 0 ? (
        <div className="py-16 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center p-6">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">No Webalizer Data Available</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            There are no recorded HTTP requests in the access logs for <strong>{selectedDomain}</strong> during <strong>{report?.period || selectedPeriod}</strong>.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={handleRefresh}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition"
            >
              Refresh Logs
            </button>
            {onNavigate && (
              <button
                onClick={() => onNavigate('raw_access')}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Inspect Raw Access Logs
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Hits */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Total Hits
              </span>
              <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {report.generalSummary.totalHits.toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                ~{report.generalSummary.avgHitsPerDay} / day
              </div>
            </div>

            {/* Total Files */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Total Files
              </span>
              <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {report.generalSummary.totalFiles.toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                ~{report.generalSummary.avgFilesPerDay} / day
              </div>
            </div>

            {/* Total Pages */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Total Pages
              </span>
              <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {report.generalSummary.totalPages.toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                ~{report.generalSummary.avgPagesPerDay} / day
              </div>
            </div>

            {/* Total Visits */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Total Visits
              </span>
              <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {report.generalSummary.totalVisits.toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                ~{report.generalSummary.avgVisitsPerDay} / day
              </div>
            </div>

            {/* Total Sites (Unique Hosts) */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Total Sites
              </span>
              <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {report.generalSummary.totalSites.toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Unique client hosts
              </div>
            </div>

            {/* Data Transferred (Bandwidth) */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Transferred
              </span>
              <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {report.generalSummary.formattedBytes}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {report.generalSummary.totalKBytes.toLocaleString()} KB total
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
              <nav className="flex space-x-1 p-2 min-w-max text-xs font-medium">
                {[
                  { id: 'summary', label: 'Monthly Summary', icon: FileText },
                  { id: 'daily', label: 'Daily Statistics', icon: Calendar },
                  { id: 'hourly', label: 'Hourly Statistics', icon: Clock },
                  { id: 'urls', label: 'Top URLs', icon: FileCode },
                  { id: 'entryexit', label: 'Entry & Exit Pages', icon: LogIn },
                  { id: 'sites', label: 'Top Sites (Hosts)', icon: Laptop },
                  { id: 'referrers', label: 'Top Referrers', icon: Compass },
                  { id: 'useragents', label: 'User Agents', icon: Monitor },
                  { id: 'search', label: 'Search Strings', icon: Search },
                  { id: 'status', label: 'Status Codes', icon: Shield },
                  { id: 'export', label: 'Raw / Export', icon: Terminal }
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

            {/* Tab Panes */}
            <div className="p-4">
              {/* TAB 1: MONTHLY SUMMARY */}
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Monthly Totals Table */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-900/30">
                      <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                        Monthly Totals ({report.period})
                      </h3>
                      <dl className="divide-y divide-gray-200 dark:divide-gray-800 text-xs">
                        <div className="py-2 flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Total Hits</dt>
                          <dd className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.totalHits.toLocaleString()}</dd>
                        </div>
                        <div className="py-2 flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Total Files (Successful Requests)</dt>
                          <dd className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.totalFiles.toLocaleString()}</dd>
                        </div>
                        <div className="py-2 flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Total Pages (Content URLs)</dt>
                          <dd className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.totalPages.toLocaleString()}</dd>
                        </div>
                        <div className="py-2 flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Total Visits</dt>
                          <dd className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.totalVisits.toLocaleString()}</dd>
                        </div>
                        <div className="py-2 flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Total Sites (Unique Visitors / Hosts)</dt>
                          <dd className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.totalSites.toLocaleString()}</dd>
                        </div>
                        <div className="py-2 flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Total Volume Transferred</dt>
                          <dd className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.formattedBytes} ({report.generalSummary.totalKBytes} KB)</dd>
                        </div>
                      </dl>
                    </div>

                    {/* Daily & Hourly Averages Table */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-900/30">
                      <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                        Calculated Usage Averages
                      </h3>
                      <dl className="divide-y divide-gray-200 dark:divide-gray-800 text-xs">
                        <div className="py-2 flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Daily Average Hits</dt>
                          <dd className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.avgHitsPerDay.toLocaleString()}</dd>
                        </div>
                        <div className="py-2 flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Daily Average Files</dt>
                          <dd className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.avgFilesPerDay.toLocaleString()}</dd>
                        </div>
                        <div className="py-2 flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Daily Average Pages</dt>
                          <dd className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.avgPagesPerDay.toLocaleString()}</dd>
                        </div>
                        <div className="py-2 flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Daily Average Visits</dt>
                          <dd className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.avgVisitsPerDay.toLocaleString()}</dd>
                        </div>
                        <div className="py-2 flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Daily Average Data Transferred</dt>
                          <dd className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.formattedAvgBytes} ({report.generalSummary.avgKBytesPerDay} KB)</dd>
                        </div>
                        <div className="py-2 flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Hourly Average Hits</dt>
                          <dd className="font-semibold text-gray-900 dark:text-white">{report.generalSummary.avgHitsPerHour.toLocaleString()}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* Timestamp boundaries */}
                  <div className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <strong>First Request:</strong> {report.generalSummary.firstRequest ? new Date(report.generalSummary.firstRequest).toUTCString() : 'N/A'}
                    </div>
                    <div>
                      <strong>Last Request:</strong> {report.generalSummary.lastRequest ? new Date(report.generalSummary.lastRequest).toUTCString() : 'N/A'}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DAILY STATISTICS */}
              {activeTab === 'daily' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Daily Usage Statistics
                    </h3>
                    <span className="text-xs text-gray-500">
                      {report.dailyStatistics.length} active day(s) recorded
                    </span>
                  </div>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                        <tr>
                          <th className="px-3 py-2.5 text-center">Day</th>
                          <th className="px-3 py-2.5 text-left">Date</th>
                          <th className="px-3 py-2.5 text-right">Hits</th>
                          <th className="px-3 py-2.5 text-right">Files</th>
                          <th className="px-3 py-2.5 text-right">Pages</th>
                          <th className="px-3 py-2.5 text-right">Visits</th>
                          <th className="px-3 py-2.5 text-right">Sites</th>
                          <th className="px-3 py-2.5 text-right">KBytes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.dailyStatistics.map(d => (
                          <tr key={d.date} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                            <td className="px-3 py-2 text-center font-bold text-gray-500">{d.day}</td>
                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                              {d.date} <span className="text-gray-400 font-normal">({d.dayName})</span>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">{d.hits.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{d.files.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right font-semibold text-purple-600 dark:text-purple-400">{d.pages.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right font-semibold text-amber-600 dark:text-amber-400">{d.visits.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right font-semibold text-indigo-600 dark:text-indigo-400">{d.sites.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right font-mono font-medium text-gray-700 dark:text-gray-300">{d.kbytes.toLocaleString()} KB</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: HOURLY STATISTICS */}
              {activeTab === 'hourly' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Hourly Usage Distribution (00:00 - 23:00)
                    </h3>
                    <span className="text-xs text-gray-500">24-hour UTC distribution</span>
                  </div>

                  {/* Interactive Visual Bar Chart */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="h-44 flex items-end justify-between gap-1 pt-6 px-1">
                      {report.hourlyStatistics.map(h => {
                        const heightPct = Math.max(4, Math.round((h.hits / maxHourlyHits) * 100));
                        const isHovered = hoveredBar === h.hour;
                        return (
                          <div
                            key={h.hour}
                            className="flex-1 flex flex-col items-center group relative cursor-pointer"
                            onMouseEnter={() => setHoveredBar(h.hour)}
                            onMouseLeave={() => setHoveredBar(null)}
                          >
                            {/* Hover tooltip */}
                            {isHovered && (
                              <div className="absolute -top-14 bg-gray-900 text-white text-[11px] rounded px-2 py-1 shadow-lg z-20 whitespace-nowrap pointer-events-none">
                                <div className="font-bold">{h.hourLabel}</div>
                                <div>Hits: {h.hits} ({h.pctHits}%)</div>
                                <div>Files: {h.files} | Pages: {h.pages}</div>
                                <div>Data: {h.kbytes} KB</div>
                              </div>
                            )}

                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full max-w-[18px] rounded-t transition-all ${
                                h.hits > 0
                                  ? isHovered
                                    ? 'bg-blue-700 dark:bg-blue-400 shadow-md'
                                    : 'bg-blue-500 dark:bg-blue-600'
                                  : 'bg-gray-200 dark:bg-gray-700'
                              }`}
                            />
                            <span className="text-[9px] text-gray-500 mt-1">
                              {h.hour % 2 === 0 ? String(h.hour).padStart(2, '0') : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hourly Data Table */}
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Hour</th>
                          <th className="px-4 py-2.5 text-right">Hits</th>
                          <th className="px-4 py-2.5 text-right">Files</th>
                          <th className="px-4 py-2.5 text-right">Pages</th>
                          <th className="px-4 py-2.5 text-right">KBytes</th>
                          <th className="px-4 py-2.5 text-right">% Hits</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.hourlyStatistics.map(h => (
                          <tr key={h.hour} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-2 font-bold font-mono text-gray-900 dark:text-white">{h.hourLabel}</td>
                            <td className="px-4 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">{h.hits.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{h.files.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{h.pages.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right font-mono text-gray-600 dark:text-gray-400">{h.kbytes.toLocaleString()} KB</td>
                            <td className="px-4 py-2 text-right text-gray-500">{h.pctHits}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: TOP URLS */}
              {activeTab === 'urls' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Top 30 Requested URLs
                    </h3>
                    <span className="text-xs text-gray-500">{report.topUrls.length} URLs listed</span>
                  </div>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-2.5 text-left">URL Path</th>
                          <th className="px-4 py-2.5 text-right">Hits</th>
                          <th className="px-4 py-2.5 text-right">Pages</th>
                          <th className="px-4 py-2.5 text-right">Volume</th>
                          <th className="px-4 py-2.5 text-right">% Hits</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.topUrls.map((u, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-2 font-mono text-gray-900 dark:text-white max-w-md truncate" title={u.path}>
                              {u.path}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">{u.hits.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{u.pages.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right font-mono text-gray-600 dark:text-gray-400">{u.kbytes.toLocaleString()} KB</td>
                            <td className="px-4 py-2 text-right text-gray-500">{u.pctHits}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: ENTRY & EXIT PAGES */}
              {activeTab === 'entryexit' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Entry Pages */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <LogIn className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        Top Entry Pages
                      </h3>
                    </div>
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                          <tr>
                            <th className="px-3 py-2 text-left">URL</th>
                            <th className="px-3 py-2 text-right">Visits</th>
                            <th className="px-3 py-2 text-right">% Visits</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {report.topEntryPages.length === 0 ? (
                            <tr><td colSpan="3" className="p-4 text-center text-gray-400">No entry pages recorded</td></tr>
                          ) : (
                            report.topEntryPages.map((ep, i) => (
                              <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                <td className="px-3 py-1.5 font-mono text-gray-900 dark:text-white truncate max-w-[200px]" title={ep.path}>{ep.path}</td>
                                <td className="px-3 py-1.5 text-right font-semibold text-emerald-600">{ep.visits}</td>
                                <td className="px-3 py-1.5 text-right text-gray-500">{ep.pctVisits}%</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Exit Pages */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <LogOut className="w-4 h-4 text-rose-600" />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        Top Exit Pages
                      </h3>
                    </div>
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                          <tr>
                            <th className="px-3 py-2 text-left">URL</th>
                            <th className="px-3 py-2 text-right">Visits</th>
                            <th className="px-3 py-2 text-right">% Visits</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {report.topExitPages.length === 0 ? (
                            <tr><td colSpan="3" className="p-4 text-center text-gray-400">No exit pages recorded</td></tr>
                          ) : (
                            report.topExitPages.map((xp, i) => (
                              <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                <td className="px-3 py-1.5 font-mono text-gray-900 dark:text-white truncate max-w-[200px]" title={xp.path}>{xp.path}</td>
                                <td className="px-3 py-1.5 text-right font-semibold text-rose-600">{xp.visits}</td>
                                <td className="px-3 py-1.5 text-right text-gray-500">{xp.pctVisits}%</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: TOP SITES (HOSTS) */}
              {activeTab === 'sites' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Top 30 Sites (Client Hosts)
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {maskIps ? 'Privacy masking active (***.***)' : 'Raw IP addresses visible'}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Hostname / Client IP</th>
                          <th className="px-4 py-2.5 text-right">Hits</th>
                          <th className="px-4 py-2.5 text-right">Files</th>
                          <th className="px-4 py-2.5 text-right">KBytes</th>
                          <th className="px-4 py-2.5 text-right">% Hits</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.topSites.map((s, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-2 font-mono text-gray-900 dark:text-white">
                              {s.host}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">{s.hits.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{s.files.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right font-mono text-gray-600 dark:text-gray-400">{s.kbytes.toLocaleString()} KB</td>
                            <td className="px-4 py-2 text-right text-gray-500">{s.pctHits}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 7: TOP REFERRERS */}
              {activeTab === 'referrers' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Top Referrers
                    </h3>
                    <span className="text-xs text-gray-500">{report.topReferrers.length} referral sources</span>
                  </div>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Referrer Source</th>
                          <th className="px-4 py-2.5 text-left">Category</th>
                          <th className="px-4 py-2.5 text-right">Hits</th>
                          <th className="px-4 py-2.5 text-right">% Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.topReferrers.map((r, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-white max-w-md truncate" title={r.label}>
                              {r.label}
                            </td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-0.5 rounded text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                {r.category}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">{r.hits}</td>
                            <td className="px-4 py-2 text-right text-gray-500">{r.pctHits}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 8: USER AGENTS */}
              {activeTab === 'useragents' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Top User Agents & Browsers
                    </h3>
                    <span className="text-xs text-gray-500">{report.topUserAgents.length} user agents classified</span>
                  </div>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-2.5 text-left">User Agent / Software</th>
                          <th className="px-4 py-2.5 text-left">Type</th>
                          <th className="px-4 py-2.5 text-right">Hits</th>
                          <th className="px-4 py-2.5 text-right">% Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.topUserAgents.map((ua, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{ua.name}</td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-0.5 rounded text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                {ua.category}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">{ua.hits}</td>
                            <td className="px-4 py-2 text-right text-gray-500">{ua.pctHits}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 9: SEARCH STRINGS */}
              {activeTab === 'search' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Search Engine Query Strings
                    </h3>
                    <span className="text-xs text-gray-500">Captured from organic search referrers</span>
                  </div>
                  {report.searchStrings.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 text-xs">
                      <Search className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="font-semibold text-gray-700 dark:text-gray-300">No search query strings recorded</p>
                      <p className="text-gray-400 text-[11px] mt-1 max-w-sm mx-auto">
                        Modern search engines (Google, Bing, Yahoo) protect search queries using HTTPS referrer encryption.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Search Query String</th>
                            <th className="px-4 py-2.5 text-right">Hits</th>
                            <th className="px-4 py-2.5 text-right">% Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {report.searchStrings.map((sq, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-2 font-mono text-gray-900 dark:text-white">{sq.query}</td>
                              <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">{sq.hits}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{sq.pctHits}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 10: STATUS CODES */}
              {activeTab === 'status' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      HTTP Response Status Codes
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
                          <th className="px-4 py-2.5 text-right">Hits</th>
                          <th className="px-4 py-2.5 text-right">% Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.statusCodes.map(s => {
                          let badgeColor = 'bg-gray-100 text-gray-700';
                          if (s.code >= 200 && s.code < 300) badgeColor = 'bg-green-100 text-green-800';
                          else if (s.code >= 300 && s.code < 400) badgeColor = 'bg-blue-100 text-blue-800';
                          else if (s.code >= 400 && s.code < 500) badgeColor = 'bg-amber-100 text-amber-800';
                          else if (s.code >= 500) badgeColor = 'bg-red-100 text-red-900 font-bold';

                          return (
                            <tr key={s.code} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-2 font-mono font-bold">
                                <span className={`px-2 py-0.5 rounded text-xs ${badgeColor}`}>
                                  {s.code}
                                </span>
                              </td>
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{s.description}</td>
                              <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">{s.hits}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{s.pctHits}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 11: RAW / EXPORT */}
              {activeTab === 'export' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Authentic Webalizer 2.23 Report Export
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyAscii}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copied ? 'Copied!' : 'Copy Summary'}
                      </button>
                      <button
                        onClick={() => handleExport('html')}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download HTML
                      </button>
                      <button
                        onClick={() => handleExport('txt')}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-gray-700 hover:bg-gray-800 text-white transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download TXT
                      </button>
                    </div>
                  </div>

                  <pre className="p-4 bg-gray-900 text-gray-100 dark:bg-black font-mono text-xs rounded-lg overflow-x-auto leading-relaxed max-h-[600px]">
{`================================================================
WEBALIZER 2.23: Web Server Traffic Analysis
Program: ${report.capabilities.engineName}
Hostname / Scope: ${report.domain}
Analysis Period: ${report.period}
Generated: ${report.generatedAt}
================================================================

SUMMARY TOTALS
----------------------------------------------------------------
Total Hits:                           ${report.generalSummary.totalHits}
Total Files:                          ${report.generalSummary.totalFiles}
Total Pages:                          ${report.generalSummary.totalPages}
Total Visits:                         ${report.generalSummary.totalVisits}
Total Sites (Distinct Hosts):         ${report.generalSummary.totalSites}
Total Data Transferred:               ${report.generalSummary.formattedBytes} (${report.generalSummary.totalKBytes} KB)
Daily Average Hits:                   ${report.generalSummary.avgHitsPerDay}
Daily Average Files:                  ${report.generalSummary.avgFilesPerDay}
Daily Average Pages:                  ${report.generalSummary.avgPagesPerDay}
Daily Average Visits:                 ${report.generalSummary.avgVisitsPerDay}
Daily Average KBytes:                 ${report.generalSummary.avgKBytesPerDay} KB
First Request:                        ${report.generalSummary.firstRequest || 'N/A'}
Last Request:                         ${report.generalSummary.lastRequest || 'N/A'}
----------------------------------------------------------------`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
