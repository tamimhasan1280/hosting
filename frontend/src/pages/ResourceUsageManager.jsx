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
  Cpu,
  Database,
  ExternalLink,
  Eye,
  FileText,
  Flame,
  Globe,
  HardDrive,
  HelpCircle,
  History,
  Info,
  Layers,
  MemoryStick as MemoryIcon,
  PieChart,
  RefreshCw,
  Server,
  Shield,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  X,
  Zap
} from 'lucide-react';
import { api } from '../services/api';

export default function ResourceUsageManager({ onBack, onNavigate, user }) {
  const cpanelUser = user || 'cpanel_user';

  // State
  const [currentUsage, setCurrentUsage] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [faultsData, setFaultsData] = useState([]);
  
  // UI Tabs & Filters
  const [activeTab, setActiveTab] = useState('current'); // 'current' | 'history' | 'snapshots' | 'faults'
  const [timeRange, setTimeRange] = useState('24h'); // '1h' | '24h' | '7d' | '30d'
  
  // Loading & notifications
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showPlatformModal, setShowPlatformModal] = useState(false);

  // Load live current usage and capabilities
  const loadCurrentUsage = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setErrorMessage(null);

    try {
      const [capsRes, usageRes] = await Promise.all([
        api.getResourceUsageCapabilities().catch(e => ({ success: false, error: e.message })),
        api.getCurrentResourceUsage(cpanelUser).catch(e => ({ success: false, error: e.message }))
      ]);

      if (capsRes && capsRes.success) {
        setCapabilities(capsRes);
      }
      if (usageRes && usageRes.success) {
        setCurrentUsage(usageRes);
      } else {
        setErrorMessage(usageRes?.error || 'Failed to retrieve current resource usage.');
      }
    } catch (err) {
      console.error('Error fetching resource usage:', err);
      setErrorMessage(err.message || 'Error communicating with resource usage API.');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  // Load history snapshots for selected time range
  const loadHistory = async () => {
    try {
      const res = await api.getResourceUsageHistory({ user: cpanelUser, range: timeRange });
      if (res && res.success) {
        setHistoryData(res);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  // Load faults
  const loadFaults = async () => {
    try {
      const res = await api.getResourceUsageFaults({ user: cpanelUser, hours: timeRange === '7d' ? 168 : 24 });
      if (res && res.success) {
        setFaultsData(res.faults || []);
      }
    } catch (err) {
      console.error('Error loading faults:', err);
    }
  };

  useEffect(() => {
    loadCurrentUsage();
  }, [cpanelUser]);

  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'snapshots') {
      loadHistory();
    } else if (activeTab === 'faults') {
      loadFaults();
    }
  }, [activeTab, timeRange, cpanelUser]);

  // Trigger snapshot manually
  const handleTakeSnapshot = async () => {
    setSnapping(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.recordResourceUsageSnapshot({ cpanelUser });
      if (res && res.success) {
        setSuccessMessage('Resource snapshot successfully recorded to history log.');
        setTimeout(() => setSuccessMessage(null), 4000);
        // Refresh current and history
        await loadCurrentUsage();
        if (activeTab === 'history' || activeTab === 'snapshots') {
          await loadHistory();
        }
      } else {
        setErrorMessage(res?.error || 'Failed to capture snapshot.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error recording snapshot.');
    } finally {
      setSnapping(false);
    }
  };

  // Helpers for styling
  const getStatusColor = (status) => {
    switch (status) {
      case 'Limit Reached':
      case 'High':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          bar: 'bg-red-600',
          pill: 'bg-red-100 text-red-800'
        };
      case 'Warning':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          bar: 'bg-amber-500',
          pill: 'bg-amber-100 text-amber-800'
        };
      case 'Not available':
        return {
          bg: 'bg-slate-50 text-slate-500 border-slate-200',
          bar: 'bg-slate-300',
          pill: 'bg-slate-100 text-slate-600'
        };
      default:
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          bar: 'bg-emerald-600',
          pill: 'bg-emerald-100 text-emerald-800'
        };
    }
  };

  // SVG Chart points calculation for history
  const chartPoints = useMemo(() => {
    if (!historyData || !historyData.snapshots || historyData.snapshots.length === 0) return null;
    const snaps = historyData.snapshots;
    if (snaps.length < 2) return null;

    const width = 640;
    const height = 180;
    const padding = 30;

    const cpuPoints = snaps.map((s, idx) => {
      const x = padding + (idx / (snaps.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((s.cpuPercent || 0) / 100) * (height - 2 * padding);
      return `${x},${Math.max(padding, Math.min(height - padding, y))}`;
    }).join(' ');

    const memLimit = snaps[0]?.memoryLimitMb || 1024;
    const memPoints = snaps.map((s, idx) => {
      const x = padding + (idx / (snaps.length - 1)) * (width - 2 * padding);
      const pct = Math.min(1, (s.memoryMb || 0) / memLimit);
      const y = height - padding - pct * (height - 2 * padding);
      return `${x},${Math.max(padding, Math.min(height - padding, y))}`;
    }).join(' ');

    return { cpuPoints, memPoints, count: snaps.length };
  }, [historyData]);

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-24">
          <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          <p className="text-slate-600 font-medium">Measuring real-time system and account resource metrics...</p>
        </div>
      </div>
    );
  }

  const metrics = currentUsage?.metrics || {};

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* BREADCRUMB & HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <button 
                onClick={onBack} 
                className="hover:text-blue-600 font-medium transition-colors"
              >
                Dashboard
              </button>
              <ChevronRight className="w-4 h-4" />
              <span className="text-slate-700 font-medium">Metrics</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-slate-900 font-semibold">Resource Usage</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Resource Usage</h1>
                <p className="text-sm text-slate-500">
                  Monitor authentic CPU, Physical Memory, Disk Quota, Bandwidth, and concurrent process allocation.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPlatformModal(true)}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 transition-colors shadow-sm"
              title="Platform Capability Status"
            >
              <Server className="w-3.5 h-3.5 text-slate-500" />
              Platform: {capabilities?.platform === 'win32' ? 'Windows Sandbox' : capabilities?.platform || 'Host'}
            </button>
            <button
              onClick={handleTakeSnapshot}
              disabled={snapping}
              className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <Clock className={`w-3.5 h-3.5 ${snapping ? 'animate-spin' : ''}`} />
              {snapping ? 'Saving Snapshot...' : 'Take Snapshot'}
            </button>
            <button
              onClick={() => loadCurrentUsage(true)}
              disabled={refreshing}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* FEEDBACK ALERTS */}
        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-red-800 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ACCOUNT STATUS BANNER */}
        <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          currentUsage?.overallStatus === 'Normal' 
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
            : currentUsage?.overallStatus === 'Warning'
            ? 'bg-amber-50/70 border-amber-200 text-amber-900'
            : 'bg-red-50/70 border-red-200 text-red-900'
        }`}>
          <div className="flex items-center gap-3">
            {currentUsage?.overallStatus === 'Normal' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : currentUsage?.overallStatus === 'Warning' ? (
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            ) : (
              <Flame className="w-6 h-6 text-red-600 shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base">Account Status: {currentUsage?.overallStatus || 'Normal'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/80 border border-current">
                  {currentUsage?.plan || 'Standard Shared Hosting'}
                </span>
              </div>
              <p className="text-xs opacity-90 mt-0.5">
                {currentUsage?.overallStatus === 'Normal'
                  ? 'Your site and account processes are executing normally within package limits.'
                  : currentUsage?.overallStatus === 'Warning'
                  ? 'Some resource metrics are approaching plan limits. Monitor your heavy scripts or cron jobs.'
                  : 'Resource thresholds have been reached. Review your process and memory usage below.'}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-semibold block text-slate-500">Account Tenant</span>
            <span className="text-sm font-mono font-bold text-slate-800">{currentUsage?.user} ({currentUsage?.domain})</span>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-slate-200 gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('current')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'current'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            Current Usage
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Historical Trends
          </button>
          <button
            onClick={() => setActiveTab('snapshots')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'snapshots'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            Snapshot Logs
          </button>
          <button
            onClick={() => setActiveTab('faults')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'faults'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            Faults & Throttles
            {currentUsage?.faultsToday > 0 && (
              <span className="px-1.5 py-0.2 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                {currentUsage.faultsToday}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: CURRENT REAL-TIME USAGE */}
        {activeTab === 'current' && (
          <div className="space-y-6">

            {/* KPI METERS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* 1. CPU USAGE */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">CPU Usage</h3>
                      <p className="text-xs text-slate-500">Processing allocation</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${getStatusColor(metrics.cpu?.status).pill}`}>
                    {metrics.cpu?.status || 'Normal'}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-2xl font-black text-slate-900">
                      {metrics.cpu?.usedPercent || 0}%
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Limit: {metrics.cpu?.limitPercent || 100}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${getStatusColor(metrics.cpu?.status).bar}`}
                      style={{ width: `${Math.min(100, metrics.cpu?.normalizedPercent || 0)}%` }}
                    />
                  </div>
                </div>

                <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex justify-between">
                  <span>Relative load: {metrics.cpu?.normalizedPercent || 0}% of plan</span>
                  <span>Unit: % Core</span>
                </div>
              </div>

              {/* 2. PHYSICAL MEMORY (pMEM) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <MemoryIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Physical Memory (pMEM)</h3>
                      <p className="text-xs text-slate-500">Active RAM usage</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${getStatusColor(metrics.memory?.status).pill}`}>
                    {metrics.memory?.status || 'Normal'}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-2xl font-black text-slate-900">
                      {metrics.memory?.usedMb || 0} <span className="text-sm font-normal text-slate-500">MB</span>
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Limit: {metrics.memory?.limitMb || 1024} MB
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${getStatusColor(metrics.memory?.status).bar}`}
                      style={{ width: `${Math.min(100, metrics.memory?.usagePercent || 0)}%` }}
                    />
                  </div>
                </div>

                <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex justify-between">
                  <span>Virtual RAM (vMEM): {metrics.vMem?.usedMb || 0} / {metrics.vMem?.limitMb || 2048} MB</span>
                  <span>{metrics.memory?.usagePercent || 0}% used</span>
                </div>
              </div>

              {/* 3. DISK SPACE QUOTA */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Disk Quota</h3>
                      <p className="text-xs text-slate-500">Storage consumption</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${getStatusColor(metrics.disk?.status).pill}`}>
                    {metrics.disk?.status || 'Normal'}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-2xl font-black text-slate-900">
                      {metrics.disk?.usedMb || 0} <span className="text-sm font-normal text-slate-500">MB</span>
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Limit: {metrics.disk?.limitMb || 10240} MB
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${getStatusColor(metrics.disk?.status).bar}`}
                      style={{ width: `${Math.min(100, metrics.disk?.usagePercent || 0)}%` }}
                    />
                  </div>
                </div>

                <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span>Files: {metrics.disk?.files || 0} inodes</span>
                  <button
                    onClick={() => onNavigate && onNavigate('disk_usage')}
                    className="text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-1"
                  >
                    Manage Disk <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 4. BANDWIDTH USAGE */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Bandwidth</h3>
                      <p className="text-xs text-slate-500">Monthly data transfer</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${getStatusColor(metrics.bandwidth?.status).pill}`}>
                    {metrics.bandwidth?.status || 'Normal'}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-2xl font-black text-slate-900">
                      {metrics.bandwidth?.usedMb || 0} <span className="text-sm font-normal text-slate-500">MB</span>
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Limit: {metrics.bandwidth?.limitMb || 50000} MB
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${getStatusColor(metrics.bandwidth?.status).bar}`}
                      style={{ width: `${Math.min(100, metrics.bandwidth?.usagePercent || 0)}%` }}
                    />
                  </div>
                </div>

                <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span>Usage: {metrics.bandwidth?.usagePercent || 0}% of allocation</span>
                  <button
                    onClick={() => onNavigate && onNavigate('bandwidth')}
                    className="text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1"
                  >
                    Bandwidth Tool <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 5. ENTRY PROCESSES (EP) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Entry Processes (EP)</h3>
                      <p className="text-xs text-slate-500">Concurrent active connections</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${getStatusColor(metrics.entryProcesses?.status).pill}`}>
                    {metrics.entryProcesses?.status || 'Normal'}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-2xl font-black text-slate-900">
                      {metrics.entryProcesses?.current || 0} <span className="text-sm font-normal text-slate-500">EP</span>
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Limit: {metrics.entryProcesses?.limit || 20} EP
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${getStatusColor(metrics.entryProcesses?.status).bar}`}
                      style={{ width: `${Math.min(100, metrics.entryProcesses?.usagePercent || 0)}%` }}
                    />
                  </div>
                </div>

                <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex justify-between">
                  <span>Executing PHP/HTTP requests</span>
                  <span>{metrics.entryProcesses?.usagePercent || 0}%</span>
                </div>
              </div>

              {/* 6. NUMBER OF PROCESSES (NPROC) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Processes (NPROC)</h3>
                      <p className="text-xs text-slate-500">Total running processes</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${getStatusColor(metrics.totalProcesses?.status).pill}`}>
                    {metrics.totalProcesses?.status || 'Normal'}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-2xl font-black text-slate-900">
                      {metrics.totalProcesses?.current || 0} <span className="text-sm font-normal text-slate-500">threads</span>
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Limit: {metrics.totalProcesses?.limit || 100}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${getStatusColor(metrics.totalProcesses?.status).bar}`}
                      style={{ width: `${Math.min(100, metrics.totalProcesses?.usagePercent || 0)}%` }}
                    />
                  </div>
                </div>

                <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex justify-between">
                  <span>Active threads & workers</span>
                  <span>{metrics.totalProcesses?.usagePercent || 0}%</span>
                </div>
              </div>

            </div>

            {/* PLATFORM HARDWARE & IO CAPABILITIES SECTION */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-2">Platform Disk I/O & IOPS Availability</h3>
              <p className="text-xs text-slate-500 mb-4">
                In strict compliance with truthful measurement rules, disk I/O throughput and IOPS are monitored only when supported by the underlying OS blkio controller or CloudLinux LVE.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700">Disk I/O Throughput</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                      {metrics.io?.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {metrics.io?.throughputKbps !== null
                      ? `${metrics.io.throughputKbps} KB/s (Limit: ${metrics.io.limitKbps} KB/s)`
                      : 'Unavailable in local Windows dev environment (requires CloudLinux LVE or Linux cgroups blkio).'}
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700">I/O Operations Per Second (IOPS)</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                      {metrics.iops?.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {metrics.iops?.currentIops !== null
                      ? `${metrics.iops.currentIops} IOPS (Limit: ${metrics.iops.limitIops} IOPS)`
                      : 'Unavailable in local Windows dev environment (requires Linux kernel blkio counters).'}
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: HISTORICAL TRENDS */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            
            {/* Time Filter Controls */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Historical Resource Usage</h3>
                <p className="text-xs text-slate-500">View performance trends and peak usage across recorded snapshots.</p>
              </div>
              <div className="flex items-center gap-2">
                {['1h', '24h', '7d', '30d'].map(r => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                      timeRange === r
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {r === '1h' ? 'Past Hour' : r === '24h' ? 'Past 24 Hours' : r === '7d' ? 'Past 7 Days' : 'Past 30 Days'}
                  </button>
                ))}
              </div>
            </div>

            {/* SUMMARY STATS BAR */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 block">Snapshots Recorded</span>
                <span className="text-xl font-black text-slate-900">{historyData?.count || 0}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 block">Peak CPU Usage</span>
                <span className="text-xl font-black text-slate-900">{historyData?.summary?.peakCpuPercent || 0}%</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 block">Average CPU Usage</span>
                <span className="text-xl font-black text-slate-900">{historyData?.summary?.avgCpuPercent || 0}%</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 block">Peak Physical RAM</span>
                <span className="text-xl font-black text-slate-900">{historyData?.summary?.peakMemoryMb || 0} MB</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 block">Fault Incidents</span>
                <span className={`text-xl font-black ${historyData?.summary?.totalFaults > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {historyData?.summary?.totalFaults || 0}
                </span>
              </div>
            </div>

            {/* SVG CHART CONTAINER */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-slate-900">CPU & Memory Utilization Trend</h4>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
                    <span>CPU Usage (%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
                    <span>Memory Allocation (%)</span>
                  </div>
                </div>
              </div>

              {chartPoints ? (
                <div className="w-full overflow-x-auto">
                  <svg viewBox="0 0 640 180" className="w-full h-48 bg-slate-50/50 rounded-lg border border-slate-100">
                    {/* Grid lines */}
                    <line x1="30" y1="30" x2="610" y2="30" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="30" y1="75" x2="610" y2="75" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="30" y1="120" x2="610" y2="120" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="30" y1="150" x2="610" y2="150" stroke="#cbd5e1" />

                    {/* Polyline CPU */}
                    <polyline
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                      points={chartPoints.cpuPoints}
                    />

                    {/* Polyline Memory */}
                    <polyline
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="2.5"
                      strokeDasharray="4 2"
                      points={chartPoints.memPoints}
                    />
                  </svg>
                  <div className="flex justify-between text-[11px] text-slate-400 mt-2 px-2">
                    <span>{historyData.snapshots[0]?.timestamp ? new Date(historyData.snapshots[0].timestamp).toLocaleTimeString() : 'Earlier'}</span>
                    <span>Latest Snapshot</span>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="font-semibold text-sm">No historical snapshots recorded for this time range yet.</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Click "Take Snapshot" at the top to record your current usage state.</p>
                  <button
                    onClick={handleTakeSnapshot}
                    disabled={snapping}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow-sm"
                  >
                    Take Instant Snapshot
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: SNAPSHOT LOGS */}
        {activeTab === 'snapshots' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recorded Snapshot Logs</h3>
                <p className="text-xs text-slate-500">Audit trail of all periodic and on-demand resource readings.</p>
              </div>
              <button
                onClick={handleTakeSnapshot}
                disabled={snapping}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                + Record New Reading
              </button>
            </div>

            {historyData?.snapshots && historyData.snapshots.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">CPU (%)</th>
                      <th className="py-3 px-4">Memory (MB)</th>
                      <th className="py-3 px-4">Entry Proc (EP)</th>
                      <th className="py-3 px-4">Processes (NPROC)</th>
                      <th className="py-3 px-4">Disk (MB)</th>
                      <th className="py-3 px-4">Faults</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyData.snapshots.slice().reverse().map(snap => (
                      <tr key={snap.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-800">
                          {new Date(snap.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${getStatusColor(snap.overallStatus).pill}`}>
                            {snap.overallStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {snap.cpuPercent}% <span className="text-slate-400 font-normal">/ {snap.cpuLimit}%</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {snap.memoryMb} MB <span className="text-slate-400 font-normal">/ {snap.memoryLimitMb} MB</span>
                        </td>
                        <td className="py-3 px-4 text-slate-800">
                          {snap.entryProcesses} / {snap.epLimit}
                        </td>
                        <td className="py-3 px-4 text-slate-800">
                          {snap.totalProcesses} / {snap.nprocLimit}
                        </td>
                        <td className="py-3 px-4 text-slate-800 font-mono">
                          {snap.diskMb} MB
                        </td>
                        <td className="py-3 px-4">
                          {snap.faults && snap.faults.length > 0 ? (
                            <span className="text-red-600 font-bold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {snap.faults.length} Fault(s)
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="font-semibold text-sm">No snapshots logged yet.</p>
                <p className="text-xs text-slate-400 mt-1">Take an instant snapshot above to start logging metrics.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: FAULTS & THROTTLING EVENTS */}
        {activeTab === 'faults' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Resource Limit Fault Incidents</h3>
              <p className="text-xs text-slate-500">Events where account processes exceeded plan allocations and were throttled.</p>
            </div>

            {faultsData && faultsData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Resource</th>
                      <th className="py-3 px-4">Incident Description</th>
                      <th className="py-3 px-4">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {faultsData.map((f, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-800">
                          {new Date(f.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {f.resource}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {f.message}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                            Limit Reached
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-sm text-slate-800">Zero Resource Faults Recorded</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Your website and background scripts have stayed completely within your plan allocations. No requests were throttled or queued.
                </p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* PLATFORM CAPABILITY MODAL */}
      {showPlatformModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">Platform Capability Discovery</h3>
              </div>
              <button onClick={() => setShowPlatformModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800 block mb-1">Host Environment</span>
                <p>{capabilities?.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">OS Platform</span>
                  <span className="font-mono font-bold text-slate-800">{capabilities?.platform} ({capabilities?.arch})</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Kernel Release</span>
                  <span className="font-mono font-bold text-slate-800">{capabilities?.release}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">CloudLinux LVE</span>
                  <span className={`font-bold ${capabilities?.lveInstalled ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {capabilities?.lveInstalled ? 'Active & Enforced' : 'Not Installed'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Linux cgroups</span>
                  <span className={`font-bold ${capabilities?.cgroupsInstalled ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {capabilities?.cgroupsInstalled ? 'Active' : 'Not Installed'}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-1">Measured Resource Sources</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-500">
                  <li><strong>CPU & RAM:</strong> Measured via node-systeminformation.</li>
                  <li><strong>Disk Quota:</strong> Governed authoritatively via storageService.</li>
                  <li><strong>Bandwidth:</strong> Governed authoritatively via bandwidthService.</li>
                  <li><strong>Disk I/O & IOPS:</strong> {capabilities?.diskIoSupported ? 'Measured via OS blkio' : 'Marked "Not available" (no synthetic data)'}.</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowPlatformModal(false)}
                className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900"
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
