import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  BarChart3,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
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
  TrendingUp,
  Users,
  Wifi,
  X
} from 'lucide-react';
import { api } from '../services/api';

export default function AwstatsManager({ onBack, onNavigate, user }) {
  const cpanelUser = user || 'cpanel_user';

  // Domain & Period state
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('ALL');
  const [periodsData, setPeriodsData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('current_month');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState('overview');

  // Privacy: IP Masking toggle
  const [maskIps, setMaskIps] = useState(true);

  // Data & Loading state
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);

  // Load authorized domains
  useEffect(() => {
    let isMounted = true;
    api.getAwstatsDomains(cpanelUser)
      .then(res => {
        if (isMounted && res && res.success) {
          setDomains(res.domains || []);
        }
      })
      .catch(err => {
        console.error('Failed to load Awstats domains:', err);
      });
    return () => { isMounted = false; };
  }, [cpanelUser]);

  // Load periods when domain changes
  useEffect(() => {
    let isMounted = true;
    api.getAwstatsPeriods({ domain: selectedDomain, user: cpanelUser })
      .then(res => {
        if (isMounted && res && res.success) {
          setPeriodsData(res);
        }
      })
      .catch(err => {
        console.error('Failed to load Awstats periods:', err);
      });
    return () => { isMounted = false; };
  }, [selectedDomain, cpanelUser]);

  // Load Awstats Report
  const loadReport = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      if (isManualRefresh) {
        await api.refreshAwstats({ cpanelUser });
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

      const res = await api.getAwstatsReport(params);
      if (res && res.success) {
        setReport(res);
      } else {
        throw new Error(res?.error || 'Failed to load Awstats report');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error generating Awstats report');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedDomain, selectedPeriod, selectedMonth, selectedYear]);

  // Period change handler
  const handlePeriodChange = (val) => {
    if (val.includes('-')) {
      // Historical month key: YYYY-MM
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

  // Compute daily chart max for scaling
  const maxDailyHits = useMemo(() => {
    if (!report || !report.dailyStats || report.dailyStats.length === 0) return 1;
    return Math.max(...report.dailyStats.map(d => d.hits), 1);
  }, [report]);

  // Compute hourly chart max for scaling
  const maxHourlyHits = useMemo(() => {
    if (!report || !report.hourlyStats || report.hourlyStats.length === 0) return 1;
    return Math.max(...report.hourlyStats.map(h => h.hits), 1);
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
          <span className="text-gray-800 dark:text-gray-200 font-semibold">Awstats</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <PieChart className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              Awstats
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-3xl">
              Awstats is an advanced traffic analysis tool that generates comprehensive visual web statistics, robot activity reports, visitor distributions, and HTTP response tracking for your domains.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => loadReport(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm disabled:opacity-50"
              title="Refresh Awstats analytics cache"
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
            </span>
          </div>
          <div className="text-blue-700 dark:text-blue-300 italic">
            Reported Scope: {report.domain} ({report.period})
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="py-24 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-3" />
          <p className="text-base font-medium">Aggregating Awstats analytics from access logs...</p>
          <p className="text-xs text-gray-400 mt-1">Inspecting domain traffic, session visits, and crawler patterns.</p>
        </div>
      ) : !report || (report.summary?.hits === 0 && report.summary?.robotHits === 0) ? (
        <div className="py-20 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400 p-6">
          <PieChart className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            No analytics data is available for the selected period.
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            No HTTP access requests or crawler activity were logged for {selectedDomain} during {report?.period || 'the selected period'}.
          </p>
        </div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Unique Visitors */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Unique Visitors</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {report.summary.uniqueVisitors.toLocaleString()}
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Distinct human visitors
              </div>
            </div>

            {/* 2. Number of Visits */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Number of Visits</span>
                <Activity className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {report.summary.visits.toLocaleString()}
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {report.summary.pagesPerVisit} pages/visit
              </div>
            </div>

            {/* 3. Pages */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Pages</span>
                <FileText className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {report.summary.pages.toLocaleString()}
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Excludes static assets
              </div>
            </div>

            {/* 4. Hits */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Hits (Total)</span>
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {report.summary.hits.toLocaleString()}
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {report.summary.hitsPerVisit} hits/visit
              </div>
            </div>

            {/* 5. Bandwidth */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Bandwidth</span>
                <HardDrive className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {report.summary.formattedBandwidth}
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {report.summary.bytesPerVisit} / visit
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
              <nav className="flex space-x-1 p-2 min-w-max text-xs font-medium">
                {[
                  { id: 'overview', label: 'Summary', icon: BarChart2 },
                  { id: 'days', label: 'Days of Month', icon: Calendar },
                  { id: 'hours', label: 'Hours of Day', icon: Clock },
                  { id: 'pages', label: 'Pages & URLs', icon: FileCode },
                  { id: 'hosts', label: 'Hosts & Visitors', icon: Laptop },
                  { id: 'robots', label: 'Robots & Spiders', icon: Bot },
                  { id: 'referrers', label: 'Referrers & Search', icon: Compass },
                  { id: 'clients', label: 'Browsers & OS', icon: Monitor },
                  { id: 'status', label: 'HTTP Status Codes', icon: Shield }
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
              {/* TAB 1: OVERVIEW & SUMMARY */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Viewed Traffic vs Not Viewed Traffic Table */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-blue-600" />
                        Traffic Breakdown (Human vs Robots)
                      </h3>
                      <table className="min-w-full text-xs">
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          <tr>
                            <td className="py-2.5 font-medium text-gray-700 dark:text-gray-300">Viewed traffic (Humans)</td>
                            <td className="py-2.5 text-right font-semibold text-gray-900 dark:text-white">
                              {(report.summary.hits - report.summary.robotHits).toLocaleString()} hits
                            </td>
                            <td className="py-2.5 text-right font-medium text-gray-600 dark:text-gray-400">
                              {report.summary.formattedBandwidth}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                              <Bot className="w-3.5 h-3.5" />
                              Not viewed traffic (Robots/Spiders)
                            </td>
                            <td className="py-2.5 text-right font-semibold text-amber-700 dark:text-amber-400">
                              {report.summary.robotHits.toLocaleString()} hits
                            </td>
                            <td className="py-2.5 text-right font-medium text-gray-600 dark:text-gray-400">
                              {report.summary.formattedRobotBandwidth}
                            </td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-900/40 font-bold">
                            <td className="py-2.5 text-gray-900 dark:text-white">Total Logged Traffic</td>
                            <td className="py-2.5 text-right text-gray-900 dark:text-white">
                              {report.summary.hits.toLocaleString()} hits
                            </td>
                            <td className="py-2.5 text-right text-gray-900 dark:text-white">
                              {report.summary.formattedBandwidth}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* General Statistics */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-600" />
                        Session Timestamps
                      </h3>
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50">
                          <span className="text-gray-500">First Visit:</span>
                          <span className="font-medium text-gray-900 dark:text-white font-mono">
                            {report.summary.firstVisit ? new Date(report.summary.firstVisit).toUTCString() : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50">
                          <span className="text-gray-500">Last Visit:</span>
                          <span className="font-medium text-gray-900 dark:text-white font-mono">
                            {report.summary.lastVisit ? new Date(report.summary.lastVisit).toUTCString() : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50">
                          <span className="text-gray-500">Successful Requests (2xx):</span>
                          <span className="font-semibold text-emerald-600">
                            {report.summary.status2xx.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50">
                          <span className="text-gray-500">Client / Server Errors (4xx/5xx):</span>
                          <span className="font-semibold text-red-600">
                            {(report.summary.status4xx + report.summary.status5xx).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Monthly History */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                      Monthly History
                    </h3>
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Month</th>
                            <th className="px-4 py-2.5 text-right">Unique Visitors</th>
                            <th className="px-4 py-2.5 text-right">Number of Visits</th>
                            <th className="px-4 py-2.5 text-right">Pages</th>
                            <th className="px-4 py-2.5 text-right">Hits</th>
                            <th className="px-4 py-2.5 text-right">Bandwidth</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {report.monthlyHistory.map((m, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{m.month}</td>
                              <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{m.uniqueVisitors}</td>
                              <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{m.visits}</td>
                              <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{m.pages}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-blue-600 dark:text-blue-400">{m.hits}</td>
                              <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">{m.formattedBandwidth}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DAYS OF MONTH */}
              {activeTab === 'days' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                      Days of Month (Daily Activity)
                    </h3>
                    {report.dailyStats.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4">No daily statistics recorded for this period.</p>
                    ) : (
                      <>
                        {/* Interactive Bar Chart */}
                        <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
                          <div className="text-xs text-gray-500 mb-3 font-semibold uppercase">Daily Hits Timeline</div>
                          <div className="h-44 flex items-end gap-1.5 pt-4">
                            {report.dailyStats.map((day, idx) => {
                              const heightPct = Math.max(8, Math.round((day.hits / maxDailyHits) * 100));
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
                              <span>{hoveredBar.hits} hits &bull; {hoveredBar.pages} pages &bull; {hoveredBar.formattedBandwidth}</span>
                            </div>
                          )}
                        </div>

                        {/* Daily Table */}
                        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                          <table className="min-w-full text-xs">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                              <tr>
                                <th className="px-4 py-2.5 text-left">Day</th>
                                <th className="px-4 py-2.5 text-left">Date</th>
                                <th className="px-4 py-2.5 text-right">Number of Visits</th>
                                <th className="px-4 py-2.5 text-right">Pages</th>
                                <th className="px-4 py-2.5 text-right">Hits</th>
                                <th className="px-4 py-2.5 text-right">Bandwidth</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                              {report.dailyStats.map((d, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{d.dayName} {d.dayNum}</td>
                                  <td className="px-4 py-2 text-gray-500 font-mono text-[11px]">{d.date}</td>
                                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{d.visits}</td>
                                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{d.pages}</td>
                                  <td className="px-4 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">{d.hits}</td>
                                  <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">{d.formattedBandwidth}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: HOURS OF DAY */}
              {activeTab === 'hours' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                      Hours of Day (00:00 - 23:00)
                    </h3>
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Hour</th>
                            <th className="px-4 py-2.5 text-right">Pages</th>
                            <th className="px-4 py-2.5 text-right">Hits</th>
                            <th className="px-4 py-2.5 text-right">Bandwidth</th>
                            <th className="px-4 py-2.5 text-left w-1/3">Activity Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {report.hourlyStats.map((h) => {
                            const barPct = maxHourlyHits > 0 ? Math.round((h.hits / maxHourlyHits) * 100) : 0;
                            return (
                              <tr key={h.hour} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                <td className="px-4 py-2 font-mono font-medium text-gray-900 dark:text-white">{h.hourLabel}</td>
                                <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{h.pages}</td>
                                <td className="px-4 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">{h.hits}</td>
                                <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{h.formattedBandwidth}</td>
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
                </div>
              )}

              {/* TAB 4: PAGES & URLS */}
              {activeTab === 'pages' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Top Pages & URLs (Top 25)
                  </h3>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-2.5 text-left">URL Path</th>
                          <th className="px-4 py-2.5 text-right">Page Views</th>
                          <th className="px-4 py-2.5 text-right">Total Hits</th>
                          <th className="px-4 py-2.5 text-right">% of Total</th>
                          <th className="px-4 py-2.5 text-right">Bandwidth</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.topPages.map((p, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-2 font-mono text-gray-900 dark:text-white truncate max-w-md">
                              {p.path}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{p.pages}</td>
                            <td className="px-4 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">{p.hits}</td>
                            <td className="px-4 py-2 text-right text-gray-500">{p.percentHits}%</td>
                            <td className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">{p.formattedBandwidth}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: HOSTS & VISITORS */}
              {activeTab === 'hosts' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Visitor Hosts / IP Addresses (Top 25)
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
                          <th className="px-4 py-2.5 text-right">Pages</th>
                          <th className="px-4 py-2.5 text-right">Hits</th>
                          <th className="px-4 py-2.5 text-right">Bandwidth</th>
                          <th className="px-4 py-2.5 text-right">Last Visit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.topHosts.map((h, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-2 font-mono font-medium text-gray-900 dark:text-white">
                              {maskIps ? h.maskedIp : h.ip}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{h.pages}</td>
                            <td className="px-4 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">{h.hits}</td>
                            <td className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">{h.formattedBandwidth}</td>
                            <td className="px-4 py-2 text-right text-gray-500">{h.lastVisit ? new Date(h.lastVisit).toLocaleString() : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 6: ROBOTS & SPIDERS */}
              {activeTab === 'robots' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Bot className="w-4 h-4 text-amber-600" />
                      Robots & Spiders Visitors
                    </h3>
                    <span className="text-xs text-gray-500">
                      Tracked separately from human visitor sessions
                    </span>
                  </div>
                  {report.topRobots.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 border border-dashed rounded-lg">
                      <p className="text-xs">No automated crawlers or spiders detected in access logs for this period.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Robot / Spider Name</th>
                            <th className="px-4 py-2.5 text-right">Hits</th>
                            <th className="px-4 py-2.5 text-right">Bandwidth</th>
                            <th className="px-4 py-2.5 text-right">Last Visit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {report.topRobots.map((r, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                <Bot className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                {r.name}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-amber-600 dark:text-amber-400">{r.hits}</td>
                              <td className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">{r.formattedBandwidth}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{r.lastVisit ? new Date(r.lastVisit).toLocaleString() : 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: REFERRERS & SEARCH */}
              {activeTab === 'referrers' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                      Connect to site from (Referrers)
                    </h3>
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Origin / Referrer Category</th>
                            <th className="px-4 py-2.5 text-right">Hits</th>
                            <th className="px-4 py-2.5 text-right">Share (%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {report.referrers.map((r, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{r.category}</td>
                              <td className="px-4 py-2 text-right font-semibold text-blue-600">{r.hits}</td>
                              <td className="px-4 py-2 text-right text-gray-600">{r.percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Search Keywords Privacy Notice */}
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">
                      Search Keyphrases & Search Keywords
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {report.capabilities.searchKeywordsPrivacy}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 8: BROWSERS & OS */}
              {activeTab === 'clients' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Browsers Table */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                      Browsers (Grabber / Web Client)
                    </h3>
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Browser</th>
                            <th className="px-4 py-2.5 text-right">Hits</th>
                            <th className="px-4 py-2.5 text-right">%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {report.browsers.map((b, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{b.name}</td>
                              <td className="px-4 py-2 text-right font-semibold text-blue-600">{b.hits}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{b.percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Operating Systems Table */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-purple-600" />
                      Operating Systems
                    </h3>
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 font-semibold text-gray-600 dark:text-gray-400">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Operating System</th>
                            <th className="px-4 py-2.5 text-right">Hits</th>
                            <th className="px-4 py-2.5 text-right">%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {report.operatingSystems.map((o, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{o.name}</td>
                              <td className="px-4 py-2 text-right font-semibold text-purple-600">{o.hits}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{o.percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 9: HTTP STATUS CODES */}
              {activeTab === 'status' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      HTTP Status Codes
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
                          <th className="px-4 py-2.5 text-left">HTTP Status Code</th>
                          <th className="px-4 py-2.5 text-left">Description</th>
                          <th className="px-4 py-2.5 text-right">Hits</th>
                          <th className="px-4 py-2.5 text-right">Percentage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {report.statusCodes.map((s) => {
                          let label = 'Unknown';
                          let badgeColor = 'bg-gray-100 text-gray-700';
                          if (s.code === 200) { label = 'OK (Success)'; badgeColor = 'bg-green-100 text-green-800'; }
                          else if (s.code === 301) { label = 'Moved Permanently (Redirect)'; badgeColor = 'bg-blue-100 text-blue-800'; }
                          else if (s.code === 302) { label = 'Found (Temporary Redirect)'; badgeColor = 'bg-blue-100 text-blue-800'; }
                          else if (s.code === 304) { label = 'Not Modified (Browser Cache)'; badgeColor = 'bg-gray-100 text-gray-800'; }
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
                              <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">{s.hits}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{s.percentage}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
