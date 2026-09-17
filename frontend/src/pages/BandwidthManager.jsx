import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BarChart2,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  DownloadCloud,
  ExternalLink,
  FileText,
  Filter,
  Globe,
  HardDrive,
  Info,
  Layers,
  PieChart,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  TrendingUp,
  Wifi,
  XCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function BandwidthManager() {
  const cpanelUser = 'cpanel_user';

  // Period & Scope State
  const [period, setPeriod] = useState('current_month');
  const [selectedDomain, setSelectedDomain] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Data State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);

  // Load Bandwidth Data
  const loadBandwidthData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = isManualRefresh
        ? await api.refreshBandwidth({
            user: cpanelUser,
            domain: selectedDomain,
            period,
            startDate: period === 'custom' ? startDate : undefined,
            endDate: period === 'custom' ? endDate : undefined
          })
        : await api.getBandwidthSummary({
            user: cpanelUser,
            domain: selectedDomain,
            period,
            startDate: period === 'custom' ? startDate : undefined,
            endDate: period === 'custom' ? endDate : undefined
          });

      if (res && res.success) {
        // Also fetch timeline and domains if not included in summary
        const [timelineRes, domainsRes] = await Promise.all([
          api.getBandwidthTimeline({
            user: cpanelUser,
            domain: selectedDomain,
            period,
            startDate: period === 'custom' ? startDate : undefined,
            endDate: period === 'custom' ? endDate : undefined
          }).catch(() => null),
          api.getBandwidthDomains({
            user: cpanelUser,
            period,
            startDate: period === 'custom' ? startDate : undefined,
            endDate: period === 'custom' ? endDate : undefined
          }).catch(() => null)
        ]);

        setData({
          ...res,
          timeline: timelineRes?.timeline || [],
          domains: domainsRes?.domains || []
        });
      } else {
        setError(res?.error || 'Bandwidth usage data is currently unavailable.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Bandwidth usage data is currently unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBandwidthData();
  }, [period, selectedDomain, startDate, endDate]);

  // Safe Account Values
  const account = data?.account || {
    user: cpanelUser,
    plan: 'Standard Shared Hosting',
    isUnlimited: false,
    limitBytes: 52428800000,
    limitFormatted: '48.83 GB',
    usedBytes: 0,
    usedFormatted: '0 Bytes',
    remainingBytes: 52428800000,
    remainingFormatted: '48.83 GB',
    usagePercent: 0,
    isOverLimit: false,
    totalRequests: 0
  };

  const periodInfo = data?.period || {
    label: 'Current Month'
  };

  const timeline = data?.timeline || [];
  const domains = data?.domains || [];
  const trafficBreakdown = data?.trafficBreakdown || [];

  // Maximum bytes in timeline for chart scaling
  const maxTimelineBytes = useMemo(() => {
    if (!timeline || timeline.length === 0) return 1;
    return Math.max(...timeline.map((t) => t.bytes), 1);
  }, [timeline]);

  // Format date helper
  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center text-sm font-medium text-slate-500 dark:text-slate-400 space-x-2">
        <span>Metrics</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 dark:text-white font-semibold">Bandwidth</span>
      </nav>

      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Bandwidth</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
                This function displays bandwidth usage for your account and all authorized domains across your selected billing cycle or custom reporting period. Track HTTP and HTTPS web traffic, request volume, and account quota limits.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            {/* Scope Filter */}
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm cursor-pointer"
            >
              <option value="ALL">All Domains (Account-wide)</option>
              {domains.map((d) => (
                <option key={d.domain} value={d.domain}>
                  {d.domain} ({d.type})
                </option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              onClick={() => loadBandwidthData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg transition-colors border border-slate-300 dark:border-slate-700 disabled:opacity-50"
              title="Recalculate bandwidth and flush cache"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Last updated timestamp indicator */}
        {data?.lastUpdated && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Reporting Period: <strong className="font-semibold text-slate-700 dark:text-slate-300">{periodInfo.label}</strong>
            </span>
            <span>
              Last updated:{' '}
              <span className="font-mono">{new Date(data.lastUpdated).toLocaleTimeString()}</span>
            </span>
          </div>
        )}
      </div>

      {/* Over-Limit Alert Banner */}
      {account.isOverLimit && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 rounded-xl p-4 flex items-start gap-3 text-rose-800 dark:text-rose-300 text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-rose-900 dark:text-rose-200">
              Bandwidth Limit Exceeded
            </h3>
            <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300">
              Your account has consumed <strong>{account.usedFormatted}</strong>, exceeding your allocated plan quota of <strong>{account.limitFormatted}</strong>. Traffic continues to be served, but your hosting provider may apply overage policies or restrict network throughput.
            </p>
          </div>
        </div>
      )}

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Bandwidth Used */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Bandwidth Used
            </span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : account.usedFormatted}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {account.totalRequests} total requests
          </p>
        </div>

        {/* Card 2: Account Limit */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Account Limit
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : account.limitFormatted}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Plan: {account.plan}
          </p>
        </div>

        {/* Card 3: Remaining Bandwidth */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Remaining
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${account.isOverLimit ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
              {loading ? '...' : account.remainingFormatted}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {account.isOverLimit ? 'Quota exceeded' : 'Available for billing cycle'}
          </p>
        </div>

        {/* Card 4: Usage Percentage & Gauge */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Quota Consumed
            </span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <BarChart2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : account.isUnlimited ? 'Unlimited' : `${account.usagePercent}%`}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                account.usagePercent >= 100
                  ? 'bg-rose-500'
                  : account.usagePercent >= 80
                  ? 'bg-amber-500'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(100, account.usagePercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Timeframe Filter Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span>Time Period:</span>
          </div>

          <div className="flex flex-wrap items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium">
            {[
              { id: 'current_month', label: 'Current Month' },
              { id: 'previous_month', label: 'Previous Month' },
              { id: 'today', label: 'Today (24h)' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'custom', label: 'Custom Range' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPeriod(t.id)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  period === t.id
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers */}
        {period === 'custom' && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              Specify Date Range:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl p-4 flex items-start gap-3 text-rose-800 dark:text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold">Unable to Load Bandwidth Data</h3>
            <p className="mt-0.5 text-xs">{error}</p>
          </div>
          <button
            onClick={() => loadBandwidthData()}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Visual Bandwidth Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Bandwidth Usage Timeline
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {timeline.length} {timeline.length === 1 ? 'day recorded' : 'days recorded'}
          </span>
        </div>

        {loading ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-500" />
            Calculating bandwidth metrics from server logs...
          </div>
        ) : timeline.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 opacity-60" />
            <span className="font-medium text-slate-700 dark:text-slate-300">
              No bandwidth usage recorded for the selected period.
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">
              Traffic will appear automatically as visitors browse your sites.
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {/* SVG Interactive Bar Chart */}
            <div className="relative h-44 w-full flex items-end gap-2 pt-6 pb-2 border-b border-slate-200 dark:border-slate-800">
              {timeline.map((t, idx) => {
                const heightPercent = Math.max(8, Math.round((t.bytes / maxTimelineBytes) * 100));
                const isHovered = hoveredBar === idx;

                return (
                  <div
                    key={t.date}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                    onMouseEnter={() => setHoveredBar(idx)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute -top-12 z-20 bg-slate-900 text-white text-[11px] font-mono rounded-lg px-2.5 py-1 shadow-xl pointer-events-none whitespace-nowrap border border-slate-700">
                        <div><strong>{t.date}</strong>: {t.formattedBytes}</div>
                        <div className="text-slate-400 text-[10px]">{t.requests} requests ({t.percentOfTotal}%)</div>
                      </div>
                    )}

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[48px] rounded-t transition-all ${
                        isHovered
                          ? 'bg-blue-600 shadow-md shadow-blue-500/30'
                          : 'bg-blue-500/80 dark:bg-blue-600/80 hover:bg-blue-500'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-axis date labels */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
              <span>{timeline[0]?.date ? formatDateLabel(timeline[0].date) : ''}</span>
              {timeline.length > 2 && (
                <span>{formatDateLabel(timeline[Math.floor(timeline.length / 2)].date)}</span>
              )}
              <span>{timeline[timeline.length - 1]?.date ? formatDateLabel(timeline[timeline.length - 1].date) : ''}</span>
            </div>
          </div>
        )}
      </div>

      {/* Two Columns: Domain Breakdown & Traffic Source */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Domain Breakdown Table (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Bandwidth by Domain
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {domains.length} authorized {domains.length === 1 ? 'domain' : 'domains'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Domain</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Bandwidth</th>
                  <th className="py-3 px-3">Requests</th>
                  <th className="py-3 px-3">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 text-xs">
                {domains.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400">
                      No domains found.
                    </td>
                  </tr>
                ) : (
                  domains.map((d) => (
                    <tr key={d.domain} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                        {d.domain}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {d.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {d.formattedBytes}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {d.requests}
                      </td>
                      <td className="py-3 px-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full"
                              style={{ width: `${d.percentOfTotal || 0}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-500 w-10 text-right">
                            {d.percentOfTotal}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Traffic Source & Protocol Card (1 col) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Traffic by Service
            </h2>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Traffic captured directly from your Apache web server access logs.
          </p>

          <div className="space-y-3 pt-2">
            {trafficBreakdown.map((t) => (
              <div key={t.service} className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white">
                  <span className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-blue-500" />
                    {t.service}
                  </span>
                  <span className="font-mono">{t.formattedBytes}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: `${t.percent}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>{t.requests} requests</span>
                  <span>{t.percent}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
            <span className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              Accounting Methodology
            </span>
            <p className="leading-relaxed">
              Bandwidth is calculated from HTTP/HTTPS response body byte counts recorded in authentic web server logs.
            </p>
          </div>
        </div>
      </div>

      {/* Daily Usage Breakdown Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Daily Bandwidth Breakdown
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {timeline.length} {timeline.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Bandwidth Used</th>
                <th className="py-3 px-3">HTTP Requests</th>
                <th className="py-3 px-3">% of Period</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 text-xs">
              {timeline.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-slate-400">
                    No daily traffic records found for this period.
                  </td>
                </tr>
              ) : (
                timeline.map((item) => (
                  <tr key={item.date} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-medium text-slate-900 dark:text-white">
                      {item.date}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {item.formattedBytes}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">
                      {item.requests}
                    </td>
                    <td className="py-3 px-3 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full"
                            style={{ width: `${item.percentOfTotal || 0}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-500 w-12 text-right">
                          {item.percentOfTotal}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
