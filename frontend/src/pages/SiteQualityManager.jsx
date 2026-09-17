import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  Lock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  TrendingUp,
  X,
  XCircle,
  Eye,
  BarChart2,
  Info
} from 'lucide-react';
import { api } from '../services/api';

export default function SiteQualityManager() {
  const cpanelUser = 'cpanel_user';

  // Core state
  const [monitors, setMonitors] = useState([]);
  const [authorizedDomains, setAuthorizedDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [activeMonitorDetails, setActiveMonitorDetails] = useState(null);
  const [monitorToDelete, setMonitorToDelete] = useState(null);

  // Form State
  const [formDomain, setFormDomain] = useState('');
  const [formScheme, setFormScheme] = useState('https');
  const [formInterval, setFormInterval] = useState(15);
  const [formNotify, setFormNotify] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Action Spinners
  const [checkingId, setCheckingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [detailsTab, setDetailsTab] = useState('checks'); // 'checks' | 'incidents'

  // Load Data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [domRes, monRes] = await Promise.all([
        api.getSiteQualityDomains(cpanelUser),
        api.getSiteQualityMonitors(cpanelUser)
      ]);

      if (domRes.success) {
        setAuthorizedDomains(domRes.domains || []);
        if (domRes.domains.length > 0 && !formDomain) {
          setFormDomain(domRes.domains[0].domain);
        }
      }

      if (monRes.success) {
        setMonitors(monRes.monitors || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Flash Messages Helper
  const flashSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // KPI Calculations
  const kpiData = useMemo(() => {
    const total = monitors.length;
    const active = monitors.filter(m => m.status === 'Active').length;
    const healthy = monitors.filter(m => m.healthState === 'Healthy').length;
    const degraded = monitors.filter(m => m.healthState === 'Degraded').length;
    const down = monitors.filter(m => m.healthState === 'Down').length;

    // Overall Uptime
    const monitorsWithUptime = monitors.filter(m => typeof m.uptime === 'number');
    let overallUptime = null;
    if (monitorsWithUptime.length > 0) {
      const sum = monitorsWithUptime.reduce((acc, m) => acc + m.uptime, 0);
      overallUptime = +(sum / monitorsWithUptime.length).toFixed(1);
    }

    // Average Latency
    const monitorsWithLatency = monitors.filter(m => typeof m.avgResponseTime === 'number');
    let avgLatency = null;
    if (monitorsWithLatency.length > 0) {
      const sum = monitorsWithLatency.reduce((acc, m) => acc + m.avgResponseTime, 0);
      avgLatency = Math.round(sum / monitorsWithLatency.length);
    }

    const totalIncidents = monitors.reduce((acc, m) => acc + (m.activeIncidents || 0), 0);

    return { total, active, healthy, degraded, down, overallUptime, avgLatency, totalIncidents };
  }, [monitors]);

  // Filtered List
  const filteredMonitors = useMemo(() => {
    return monitors.filter(m => {
      const matchesSearch = !searchQuery || 
        m.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.url.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || 
        (statusFilter === 'Paused' && m.status === 'Paused') ||
        (m.status === 'Active' && m.healthState === statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [monitors, searchQuery, statusFilter]);

  // Actions
  const handleCreateMonitor = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      const res = await api.createSiteQualityMonitor({
        domain: formDomain,
        scheme: formScheme,
        interval: formInterval,
        notifyEmail: formNotify
      }, cpanelUser);

      if (res.success) {
        flashSuccess(`Monitoring successfully enabled for ${res.monitor.url}`);
        setAddModalOpen(false);
        fetchData();
      }
    } catch (err) {
      setFormError(err.message || 'Failed to enable monitoring');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleManualCheck = async (monitorId) => {
    setCheckingId(monitorId);
    setError(null);
    try {
      const res = await api.checkSiteQualityNow(monitorId, cpanelUser);
      if (res.success) {
        flashSuccess(`Check completed for ${res.record.finalUrl || 'monitor'}: HTTP ${res.record.httpStatus}, ${res.record.responseTime}ms`);
        fetchData();
        if (activeMonitorDetails && activeMonitorDetails.monitor.id === monitorId) {
          handleViewDetails(monitorId);
        }
      }
    } catch (err) {
      setError(err.message || 'Manual check failed');
    } finally {
      setCheckingId(null);
    }
  };

  const handleTogglePause = async (monitorId) => {
    setTogglingId(monitorId);
    try {
      const res = await api.toggleSiteQualityPause(monitorId, cpanelUser);
      if (res.success) {
        flashSuccess(`Monitor ${res.status === 'Active' ? 'resumed' : 'paused'}`);
        fetchData();
      }
    } catch (err) {
      setError(err.message || 'Failed to toggle monitor state');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!monitorToDelete) return;
    setDeletingId(monitorToDelete.id);
    try {
      const res = await api.deleteSiteQualityMonitor(monitorToDelete.id, cpanelUser);
      if (res.success) {
        flashSuccess(`Monitor for ${monitorToDelete.domain} removed`);
        setDeleteModalOpen(false);
        setMonitorToDelete(null);
        if (activeMonitorDetails?.monitor.id === monitorToDelete.id) {
          setDetailsModalOpen(false);
        }
        fetchData();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete monitor');
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewDetails = async (monitorId) => {
    try {
      const res = await api.getSiteQualityMonitorDetails(monitorId, cpanelUser);
      if (res.success) {
        setActiveMonitorDetails(res);
        setDetailsModalOpen(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to load monitor details');
    }
  };

  // Helper Badge Renderers
  const getHealthBadge = (healthState, status) => {
    if (status === 'Paused') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
          <Pause className="w-3 h-3" /> Paused
        </span>
      );
    }
    switch (healthState) {
      case 'Healthy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Healthy
          </span>
        );
      case 'Degraded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Degraded
          </span>
        );
      case 'Down':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
            <XCircle className="w-3 h-3 text-red-600" /> Down
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
            <Clock className="w-3 h-3 text-blue-600" /> Pending
          </span>
        );
    }
  };

  const getSslBadge = (sslStatus, daysRemaining) => {
    if (!sslStatus || sslStatus === 'Pending' || sslStatus === 'N/A') {
      return <span className="text-gray-400 text-xs font-mono">N/A</span>;
    }
    if (sslStatus.includes('Certificate valid')) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Valid ({daysRemaining !== null ? `${daysRemaining}d` : 'OK'})</span>
        </span>
      );
    }
    if (sslStatus.includes('expiring soon')) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Expiring ({daysRemaining}d)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400 font-medium" title={sslStatus}>
        <ShieldAlert className="w-3.5 h-3.5" />
        <span>{sslStatus.length > 18 ? `${sslStatus.slice(0, 18)}...` : sslStatus}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 text-gray-800 dark:text-gray-200">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 gap-1.5 font-medium">
        <span className="hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer">Metrics</span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-gray-900 dark:text-white font-semibold">Site Quality Monitoring</span>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Site Quality Monitoring</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Automated 24/7 uptime verification, response latency measurement, TLS certificates, and incident detection
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
            title="Refresh monitor status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Website Monitor</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monitored Sites */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
            <span>Monitored Sites</span>
            <Globe className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white font-mono">{kpiData.total}</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {kpiData.active} active
            </span>
          </div>
          <div className="mt-2 text-[11px] text-gray-400">
            {kpiData.healthy} healthy, {kpiData.degraded} degraded, {kpiData.down} down
          </div>
        </div>

        {/* Overall Uptime */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
            <span>Overall Uptime</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
              {kpiData.overallUptime !== null ? `${kpiData.overallUptime}%` : '—'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-gray-400">
            {kpiData.overallUptime !== null ? 'Calculated across historical checks' : 'Not enough monitoring data yet'}
          </div>
        </div>

        {/* Average Response Time */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
            <span>Avg Response Time</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
              {kpiData.avgLatency !== null ? `${kpiData.avgLatency} ms` : '—'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-gray-400">
            {kpiData.avgLatency !== null ? 'End-to-end HTTP request latency' : 'No response timings recorded'}
          </div>
        </div>

        {/* Active Incidents */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
            <span>Active Incidents</span>
            <AlertTriangle className={`w-4 h-4 ${kpiData.totalIncidents > 0 ? 'text-red-500' : 'text-gray-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${kpiData.totalIncidents > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
              {kpiData.totalIncidents}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-gray-400">
            {kpiData.totalIncidents === 0 ? 'All monitored targets operational' : 'Unresolved service disruptions'}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by domain or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['ALL', 'Healthy', 'Degraded', 'Down', 'Paused'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-5 py-3.5">Monitored Website</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Response Time</th>
                <th className="px-4 py-3.5">Uptime</th>
                <th className="px-4 py-3.5">SSL / TLS</th>
                <th className="px-4 py-3.5">Last Check</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading && monitors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading website monitors...</span>
                  </td>
                </tr>
              ) : filteredMonitors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                    <Globe className="w-8 h-8 mx-auto mb-2 text-gray-400 opacity-60" />
                    <p className="font-semibold text-gray-700 dark:text-gray-300">
                      {monitors.length === 0 ? 'No websites are currently being monitored' : 'No monitors match your search criteria'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {monitors.length === 0 ? 'Select an authorized domain to start real-time health monitoring.' : 'Try changing your status filter or search keyword.'}
                    </p>
                    {monitors.length === 0 && (
                      <button
                        onClick={() => setAddModalOpen(true)}
                        className="mt-3 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Website Monitor</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredMonitors.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-750/50 transition-colors">
                    {/* Domain & URL */}
                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{m.domain}</span>
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          title="Open website in new tab"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono flex items-center gap-2 mt-0.5">
                        <span className="uppercase text-[10px] px-1 bg-gray-100 dark:bg-gray-700 rounded font-semibold text-gray-600 dark:text-gray-300">
                          {m.scheme}
                        </span>
                        <span>Every {m.interval}m</span>
                        {m.primaryIp && <span>• IP: {m.primaryIp}</span>}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getHealthBadge(m.healthState, m.status)}
                    </td>

                    {/* Response Time */}
                    <td className="px-4 py-3.5 font-mono whitespace-nowrap">
                      {m.lastResponseTime !== null ? (
                        <span className={`font-semibold ${
                          m.lastResponseTime < 500 ? 'text-emerald-600 dark:text-emerald-400' :
                          m.lastResponseTime < 1500 ? 'text-blue-600 dark:text-blue-400' :
                          'text-amber-600 dark:text-amber-400'
                        }`}>
                          {m.lastResponseTime} ms
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Uptime */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {typeof m.uptime === 'number' ? (
                        <div className="flex items-center gap-2 font-mono">
                          <span className={`font-bold ${
                            m.uptime >= 99 ? 'text-emerald-600 dark:text-emerald-400' :
                            m.uptime >= 95 ? 'text-blue-600 dark:text-blue-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {m.uptime}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[11px]">Not enough data yet</span>
                      )}
                    </td>

                    {/* SSL / TLS Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getSslBadge(m.sslStatus, m.sslDaysRemaining)}
                    </td>

                    {/* Last Check */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                      {m.lastCheckTime ? new Date(m.lastCheckTime).toLocaleTimeString() : 'Never'}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Check Now */}
                        <button
                          onClick={() => handleManualCheck(m.id)}
                          disabled={checkingId === m.id}
                          className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Check Now (Run immediate health check)"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${checkingId === m.id ? 'animate-spin text-blue-600' : ''}`} />
                        </button>

                        {/* Pause / Resume */}
                        <button
                          onClick={() => handleTogglePause(m.id)}
                          disabled={togglingId === m.id}
                          className="p-1.5 text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title={m.status === 'Active' ? 'Pause monitoring' : 'Resume monitoring'}
                        >
                          {m.status === 'Active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>

                        {/* View Details */}
                        <button
                          onClick={() => handleViewDetails(m.id)}
                          className="p-1.5 text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="View history & timing details"
                        >
                          <BarChart2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => {
                            setMonitorToDelete(m);
                            setDeleteModalOpen(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Delete monitor configuration"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================
          ADD MONITOR MODAL
         ======================================================== */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Enable Website Monitoring</h3>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMonitor} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                  {formError}
                </div>
              )}

              {/* Domain Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Select Authorized Domain
                </label>
                <select
                  value={formDomain}
                  onChange={(e) => setFormDomain(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                >
                  {authorizedDomains.map((d) => (
                    <option key={d.domain} value={d.domain}>
                      {d.domain} ({d.type})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Only domains owned by your hosting account are eligible for monitoring.
                </p>
              </div>

              {/* Protocol Scheme */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Protocol Scheme
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                    formScheme === 'https' 
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="scheme"
                      value="https"
                      checked={formScheme === 'https'}
                      onChange={() => setFormScheme('https')}
                      className="sr-only"
                    />
                    <Lock className="w-3.5 h-3.5" />
                    <span>HTTPS (Encrypted)</span>
                  </label>

                  <label className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                    formScheme === 'http' 
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="scheme"
                      value="http"
                      checked={formScheme === 'http'}
                      onChange={() => setFormScheme('http')}
                      className="sr-only"
                    />
                    <Globe className="w-3.5 h-3.5" />
                    <span>HTTP (Standard)</span>
                  </label>
                </div>
              </div>

              {/* Check Interval */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Monitoring Frequency
                </label>
                <select
                  value={formInterval}
                  onChange={(e) => setFormInterval(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value={5}>Every 5 minutes (High Cadence)</option>
                  <option value={15}>Every 15 minutes (Standard)</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every 1 hour (Low Cadence)</option>
                </select>
              </div>

              {/* Notification Toggle */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formNotify}
                    onChange={(e) => setFormNotify(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                    Log and track service incident notifications
                  </span>
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  {formSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Start Monitoring</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MONITOR DETAILS DRAWER / MODAL
         ======================================================== */}
      {detailsModalOpen && activeMonitorDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>{activeMonitorDetails.monitor.domain}</span>
                    {getHealthBadge(activeMonitorDetails.monitor.healthState, activeMonitorDetails.monitor.status)}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{activeMonitorDetails.monitor.url}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleManualCheck(activeMonitorDetails.monitor.id)}
                  disabled={checkingId === activeMonitorDetails.monitor.id}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingId === activeMonitorDetails.monitor.id ? 'animate-spin' : ''}`} />
                  <span>Check Now</span>
                </button>
                <button
                  onClick={() => setDetailsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Timing Latency Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">Total Latency</span>
                  <span className="text-lg font-bold font-mono text-gray-900 dark:text-white mt-1 block">
                    {activeMonitorDetails.latestCheck?.responseTime ?? '—'} ms
                  </span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">DNS Lookup</span>
                  <span className="text-lg font-bold font-mono text-gray-900 dark:text-white mt-1 block">
                    {activeMonitorDetails.latestCheck?.dnsTime ?? '—'} ms
                  </span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">TLS Handshake</span>
                  <span className="text-lg font-bold font-mono text-gray-900 dark:text-white mt-1 block">
                    {activeMonitorDetails.latestCheck?.tlsTime ?? '—'} ms
                  </span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">Time To First Byte</span>
                  <span className="text-lg font-bold font-mono text-gray-900 dark:text-white mt-1 block">
                    {activeMonitorDetails.latestCheck?.ttfb ?? '—'} ms
                  </span>
                </div>
              </div>

              {/* Response Time History Chart */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Response Time History (Recent Checks)
                  </h4>
                  <span className="text-xs text-gray-500 font-mono">
                    {activeMonitorDetails.history.length} check points recorded
                  </span>
                </div>

                {activeMonitorDetails.history.length === 0 ? (
                  <p className="text-xs text-gray-500 py-6 text-center">Not enough monitoring data yet.</p>
                ) : (
                  <div className="h-28 flex items-end gap-1 pt-4 pb-1 overflow-x-auto">
                    {activeMonitorDetails.history.slice(0, 30).reverse().map((h, idx) => {
                      const maxTime = 1500;
                      const barHeight = Math.min(100, Math.max(8, Math.round(((h.responseTime || 50) / maxTime) * 100)));
                      const isError = h.status === 'Down';
                      const isSlow = h.responseTime >= 1000;

                      return (
                        <div
                          key={idx}
                          className="flex-1 min-w-[12px] flex flex-col items-center group relative cursor-pointer"
                        >
                          <div
                            style={{ height: `${barHeight}%` }}
                            className={`w-full rounded-t-sm transition-all ${
                              isError ? 'bg-red-500' : isSlow ? 'bg-amber-500' : 'bg-blue-500 hover:bg-blue-600'
                            }`}
                          ></div>
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-1.5 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                            <div className="bg-gray-900 text-white text-[10px] rounded px-2 py-1 shadow-lg whitespace-nowrap font-mono">
                              <div>{h.responseTime} ms • {h.httpStatus || 'ERR'}</div>
                              <div className="text-gray-400 text-[9px]">{new Date(h.timestamp).toLocaleTimeString()}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Navigation Tabs (Checks vs Incidents) */}
              <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setDetailsTab('checks')}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    detailsTab === 'checks'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Recent Checks ({activeMonitorDetails.history.length})
                </button>
                <button
                  onClick={() => setDetailsTab('incidents')}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    detailsTab === 'incidents'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Incidents & Outages ({activeMonitorDetails.incidents.length})
                </button>
              </div>

              {/* Tab 1: Recent Checks Table */}
              {detailsTab === 'checks' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
                    <thead className="text-[11px] font-bold uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="py-2">Timestamp</th>
                        <th className="py-2">HTTP Status</th>
                        <th className="py-2">Response Time</th>
                        <th className="py-2">IP Address</th>
                        <th className="py-2">SSL Status</th>
                        <th className="py-2">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 font-mono text-[11px]">
                      {activeMonitorDetails.history.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-gray-500">
                            No checks recorded yet.
                          </td>
                        </tr>
                      ) : (
                        activeMonitorDetails.history.map((h) => (
                          <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="py-2 whitespace-nowrap text-gray-900 dark:text-white">
                              {new Date(h.timestamp).toLocaleString()}
                            </td>
                            <td className="py-2 whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                h.httpStatus >= 200 && h.httpStatus < 300 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                h.httpStatus >= 300 && h.httpStatus < 400 ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                                'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                              }`}>
                                {h.httpStatus || 'N/A'}
                              </span>
                            </td>
                            <td className="py-2 whitespace-nowrap">{h.responseTime} ms</td>
                            <td className="py-2 whitespace-nowrap text-gray-500">{h.primaryIp || '—'}</td>
                            <td className="py-2 whitespace-nowrap text-gray-500">{h.sslStatus}</td>
                            <td className="py-2 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                h.status === 'Healthy' ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40' :
                                h.status === 'Degraded' ? 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40' :
                                'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/40'
                              }`}>
                                {h.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Incidents Table */}
              {detailsTab === 'incidents' && (
                <div className="space-y-3">
                  {activeMonitorDetails.incidents.length === 0 ? (
                    <p className="text-xs text-gray-500 py-6 text-center">No service incidents recorded for this website.</p>
                  ) : (
                    activeMonitorDetails.incidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              inc.status === 'ongoing' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            }`}>
                              {inc.status}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {inc.rootCause}
                            </span>
                          </div>
                          <p className="text-gray-500 text-[11px]">
                            Detected: {new Date(inc.detectedAt).toLocaleString()}
                            {inc.recoveredAt && ` • Recovered: ${new Date(inc.recoveredAt).toLocaleString()}`}
                          </p>
                        </div>

                        <div className="text-right font-mono text-[11px] text-gray-500 shrink-0">
                          {inc.durationSeconds ? `${inc.durationSeconds}s duration` : 'Ongoing outage'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          DELETE CONFIRMATION MODAL
         ======================================================== */}
      {deleteModalOpen && monitorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-950 text-red-600 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Monitor</h3>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Are you sure you want to stop monitoring <strong className="text-gray-900 dark:text-white">{monitorToDelete.domain}</strong>?
              This action only removes the monitoring configuration and historical metrics; your hosted website files remain completely untouched.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deletingId === monitorToDelete.id}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
              >
                {deletingId === monitorToDelete.id && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Monitor</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
