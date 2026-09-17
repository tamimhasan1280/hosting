import React, { useState, useEffect } from 'react';
import { 
  Activity, Plus, Trash2, Edit2, Search, RefreshCw, Globe, ArrowRight, ArrowLeft, Check, X,
  Shield, Layers, AlertCircle, CheckCircle2, Download, RotateCcw, Copy, ExternalLink,
  HelpCircle, Eye, EyeOff, Key, Terminal, Wifi, Clock, Server, CheckCircle, Sliders,
  BookOpen, Lock, AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';

export default function DynamicDnsManager({ onBack, onNavigate, user = 'cpanel_user' }) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [zones, setZones] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [myIp, setMyIp] = useState('');

  // Create Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDomain, setCreateDomain] = useState('');
  const [createSubdomain, setCreateSubdomain] = useState('');
  const [createType, setCreateType] = useState('A');
  const [createIp, setCreateIp] = useState('');
  const [createTtl, setCreateTtl] = useState(300);
  const [createDesc, setCreateDesc] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [detectingIp, setDetectingIp] = useState(false);

  // One-time Token Reveal Modal State
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [revealToken, setRevealToken] = useState('');
  const [revealEntry, setRevealEntry] = useState(null);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editDesc, setEditDesc] = useState('');
  const [editTtl, setEditTtl] = useState(300);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editLoading, setEditLoading] = useState(false);

  // Regenerate Token Modal State
  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const [regenItem, setRegenItem] = useState(null);
  const [regenLoading, setRegenLoading] = useState(false);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteDnsRecord, setDeleteDnsRecord] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Setup Guide Drawer / Modal State
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [guideSelectedEntry, setGuideSelectedEntry] = useState(null);
  const [guideTab, setGuideTab] = useState('curl');

  // Notifications
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [copiedId, setCopiedId] = useState(null);

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 6000);
  };

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Load entries and zones
  const loadData = async () => {
    try {
      setLoading(true);
      const [entriesRes, zonesRes, ipRes] = await Promise.all([
        api.getDdnsEntries(user).catch(() => ({ entries: [] })),
        api.getDnsZones(user).catch(() => ({ zones: [] })),
        api.detectDdnsIp().catch(() => ({ ip: '127.0.0.1' }))
      ]);

      setEntries(entriesRes.entries || []);
      const zoneList = zonesRes.zones || [];
      setZones(zoneList);
      if (zoneList.length > 0 && !createDomain) {
        setCreateDomain(zoneList[0].name);
      }
      setMyIp(ipRes.ip || '127.0.0.1');
      if (!createIp) {
        setCreateIp(ipRes.ip || '127.0.0.1');
      }
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to load Dynamic DNS data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Handle IP Auto-detect
  const handleDetectIp = async () => {
    try {
      setDetectingIp(true);
      const res = await api.detectDdnsIp();
      if (res.ip) {
        setCreateIp(res.ip);
        setMyIp(res.ip);
        showMsg(`Detected IP: ${res.ip}`, 'success');
      }
    } catch (err) {
      showMsg('Failed to detect IP address', 'error');
    } finally {
      setDetectingIp(false);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setCreateSubdomain('');
    setCreateType('A');
    setCreateTtl(300);
    setCreateDesc('');
    setCreateIp(myIp || '127.0.0.1');
    if (zones.length > 0 && !createDomain) {
      setCreateDomain(zones[0].name);
    }
    setCreateModalOpen(true);
  };

  // Compute full target hostname for Create Modal
  const getPreviewHostname = () => {
    const sub = createSubdomain.trim().toLowerCase().replace(/\.+$/, '');
    const dom = (createDomain || 'example.com').trim().toLowerCase().replace(/\.+$/, '');
    if (!sub || sub === '@') return dom;
    return `${sub}.${dom}`;
  };

  // Handle Create Submit
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createDomain) {
      showMsg('Please select a domain', 'error');
      return;
    }
    const fullHost = getPreviewHostname();

    try {
      setCreateLoading(true);
      const res = await api.createDdnsEntry({
        domain: createDomain,
        hostname: fullHost,
        type: createType,
        ttl: parseInt(createTtl, 10) || 300,
        description: createDesc || `Dynamic DNS for ${fullHost}`,
        initialIp: createIp,
        cpanelUser: user
      });

      setCreateModalOpen(false);
      showMsg(res.message || 'Dynamic DNS created successfully!', 'success');
      
      // Open reveal modal for the generated token
      if (res.rawToken) {
        setRevealToken(res.rawToken);
        setRevealEntry(res.entry);
        setTokenModalOpen(true);
      }

      await loadData();
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to create Dynamic DNS', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  // Toggle Entry status
  const handleToggle = async (entry) => {
    try {
      const res = await api.toggleDdnsStatus(entry.id, user);
      showMsg(res.message || 'Status updated', 'success');
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, enabled: res.entry.enabled } : e));
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to toggle status', 'error');
    }
  };

  // Open Edit Modal
  const openEditModal = (entry) => {
    setEditItem(entry);
    setEditDesc(entry.description || '');
    setEditTtl(entry.ttl || 300);
    setEditEnabled(entry.enabled !== false);
    setEditModalOpen(true);
  };

  // Handle Edit Submit
  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editItem) return;

    try {
      setEditLoading(true);
      const res = await api.updateDdnsEntry(editItem.id, {
        description: editDesc,
        ttl: parseInt(editTtl, 10) || 300,
        enabled: editEnabled,
        cpanelUser: user
      });

      setEditModalOpen(false);
      showMsg(res.message || 'Configuration updated successfully!', 'success');
      setEntries(prev => prev.map(e => e.id === editItem.id ? res.entry : e));
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to update configuration', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  // Open Regenerate Modal
  const openRegenModal = (entry) => {
    setRegenItem(entry);
    setRegenModalOpen(true);
  };

  // Handle Regenerate Submit
  const handleRegen = async () => {
    if (!regenItem) return;

    try {
      setRegenLoading(true);
      const res = await api.regenerateDdnsToken(regenItem.id, user);
      setRegenModalOpen(false);
      showMsg(res.message || 'Token regenerated successfully!', 'success');

      if (res.rawToken) {
        setRevealToken(res.rawToken);
        setRevealEntry(res.entry);
        setTokenModalOpen(true);
      }

      await loadData();
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to regenerate token', 'error');
    } finally {
      setRegenLoading(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (entry) => {
    setDeleteItem(entry);
    setDeleteDnsRecord(true);
    setDeleteModalOpen(true);
  };

  // Handle Delete Submit
  const handleDelete = async () => {
    if (!deleteItem) return;

    try {
      setDeleteLoading(true);
      const res = await api.deleteDdnsEntry(deleteItem.id, deleteDnsRecord, user);
      setDeleteModalOpen(false);
      showMsg(res.message || 'Configuration deleted successfully!', 'success');
      setEntries(prev => prev.filter(e => e.id !== deleteItem.id));
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to delete configuration', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Open Guide Modal
  const openGuideModal = (entry = null) => {
    setGuideSelectedEntry(entry || (entries.length > 0 ? entries[0] : null));
    setGuideModalOpen(true);
  };

  // Format relative timestamp
  const formatTime = (isoString) => {
    if (!isoString) return 'Never';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Never';
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Filter entries
  const filteredEntries = entries.filter(e => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q ||
      e.hostname.toLowerCase().includes(q) ||
      e.domain.toLowerCase().includes(q) ||
      (e.currentIp && e.currentIp.toLowerCase().includes(q)) ||
      (e.description && e.description.toLowerCase().includes(q));

    const matchType = typeFilter === 'ALL' || e.type === typeFilter;
    const matchStatus = statusFilter === 'ALL' ||
      (statusFilter === 'Active' && e.enabled !== false) ||
      (statusFilter === 'Disabled' && e.enabled === false);

    return matchQ && matchType && matchStatus;
  });

  // Stats calculation
  const totalCount = entries.length;
  const activeCount = entries.filter(e => e.enabled !== false).length;
  const ipv4Count = entries.filter(e => e.type === 'A').length;
  const ipv6Count = entries.filter(e => e.type === 'AAAA').length;

  const originUrl = window.location.origin;

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <button 
              onClick={onBack} 
              className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Domains
            </button>
            <span>/</span>
            <span className="text-gray-800 dark:text-gray-200 font-medium">Dynamic DNS</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dynamic DNS</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automated DNS record synchronization for home networks, routers, and changing IP addresses
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => openGuideModal()}
            className="px-3.5 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <BookOpen className="w-4 h-4 text-gray-500" />
            <span>Setup Instructions</span>
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Dynamic DNS</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {msg.text && (
        <div className={`p-4 rounded-lg flex items-center justify-between shadow-sm transition-all ${
          msg.type === 'error' 
            ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800' 
            : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
        }`}>
          <div className="flex items-center gap-2.5">
            {msg.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm font-medium">{msg.text}</span>
          </div>
          <button onClick={() => setMsg({ text: '', type: '' })} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total DDNS</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Configured hostnames</p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Globe className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Status</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{activeCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">{totalCount - activeCount} disabled</p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">IPv4 (A)</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{ipv4Count}</p>
            <p className="text-xs text-gray-500 mt-0.5">Standard 32-bit addresses</p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Wifi className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">IPv6 (AAAA)</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{ipv6Count}</p>
            <p className="text-xs text-gray-500 mt-0.5">128-bit modern networks</p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Server className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by hostname, IP, domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
              <span className="text-gray-500 px-1 font-medium">Type:</span>
              {['ALL', 'A', 'AAAA'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2 py-1 rounded font-medium transition-colors ${
                    typeFilter === t
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
              <span className="text-gray-500 px-1 font-medium">Status:</span>
              {['ALL', 'Active', 'Disabled'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 rounded font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              title="Refresh table"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Dynamic DNS Entries Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-6 py-3.5">Hostname / Web Address</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-6 py-3.5">Current IP Address</th>
                <th className="px-4 py-3.5">TTL</th>
                <th className="px-4 py-3.5">Last Synchronized</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading Dynamic DNS configurations...</span>
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Activity className="w-10 h-10 mx-auto mb-2.5 text-gray-400 opacity-60" />
                    <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No Dynamic DNS hostnames found</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                      {searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL'
                        ? 'No configurations match your current search and filter settings.'
                        : 'You have not configured any Dynamic DNS hostnames yet. Click "Create Dynamic DNS" to get started.'}
                    </p>
                    {(!searchQuery && typeFilter === 'ALL' && statusFilter === 'ALL') && (
                      <button
                        onClick={openCreateModal}
                        className="mt-4 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create Your First DDNS
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white">
                            <span>{entry.hostname}</span>
                            <button
                              onClick={() => copyToClipboard(entry.hostname, `host-${entry.id}`)}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                              title="Copy hostname"
                            >
                              {copiedId === `host-${entry.id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {entry.description || `Zone: ${entry.domain}`}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-800">
                              {entry.tokenMasked}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        entry.type === 'A'
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                      }`}>
                        {entry.type}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-medium text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                          {entry.currentIp || 'Not set'}
                        </span>
                        {entry.currentIp && (
                          <button
                            onClick={() => copyToClipboard(entry.currentIp, `ip-${entry.id}`)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            title="Copy IP"
                          >
                            {copiedId === `ip-${entry.id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-xs font-mono text-gray-600 dark:text-gray-400">
                      {entry.ttl}s
                    </td>

                    <td className="px-4 py-4">
                      <div>
                        <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 font-medium">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span>{formatTime(entry.lastUpdateAt)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {entry.lastUpdateStatus === 'good' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Updated
                            </span>
                          )}
                          {entry.lastUpdateStatus === 'nochange' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Unchanged
                            </span>
                          )}
                          {entry.lastUpdateStatus === 'initialized' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                              Ready
                            </span>
                          )}
                          {entry.updateCount > 0 && (
                            <span className="text-[10px] text-gray-400">({entry.updateCount}x)</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleToggle(entry)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          entry.enabled !== false
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                        title="Click to toggle Enabled / Disabled"
                      >
                        <span className={`w-2 h-2 rounded-full ${entry.enabled !== false ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                        <span>{entry.enabled !== false ? 'Active' : 'Disabled'}</span>
                      </button>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openGuideModal(entry)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="View update commands and configuration snippets"
                        >
                          <Terminal className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(entry)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Edit TTL and description"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openRegenModal(entry)}
                          className="p-1.5 text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Regenerate Security Token (Revokes old token)"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(entry)}
                          className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Delete Dynamic DNS identifier"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* ============================================================ */}
      {/* MODAL 1: CREATE DYNAMIC DNS */}
      {/* ============================================================ */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create Dynamic DNS</h3>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {/* Domain Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Target Domain Zone <span className="text-red-500">*</span>
                </label>
                <select
                  value={createDomain}
                  onChange={(e) => setCreateDomain(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                >
                  {zones.map((z) => (
                    <option key={z.name} value={z.name}>
                      {z.name} ({z.type})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Select the domain zone where this Dynamic DNS entry belongs.</p>
              </div>

              {/* Subdomain & Full Hostname */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Hostname / Subdomain Prefix
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    placeholder="e.g. home, vpn, router"
                    value={createSubdomain}
                    onChange={(e) => setCreateSubdomain(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-l-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                  <span className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg text-sm text-gray-500 font-mono">
                    .{createDomain || 'example.com'}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="text-gray-500">Resulting FQDN:</span>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{getPreviewHostname()}</span>
                </div>
              </div>

              {/* Record Type & TTL */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Record Type
                  </label>
                  <select
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  >
                    <option value="A">A (IPv4 Address)</option>
                    <option value="AAAA">AAAA (IPv6 Address)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    TTL (Seconds)
                  </label>
                  <input
                    type="number"
                    min={300}
                    max={86400}
                    step={60}
                    value={createTtl}
                    onChange={(e) => setCreateTtl(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                  <p className="text-[11px] text-gray-500 mt-0.5">300s (5m) recommended</p>
                </div>
              </div>

              {/* Initial IP Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                    Initial IP Address
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectIp}
                    disabled={detectingIp}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${detectingIp ? 'animate-spin' : ''}`} />
                    <span>Detect My IP</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder={createType === 'A' ? '203.0.113.10' : '2001:db8::1'}
                  value={createIp}
                  onChange={(e) => setCreateIp(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Description / Purpose (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Home Office Router, Media Server, VPN Gateway"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  {createLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Create Dynamic DNS</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: ONE-TIME SECURITY TOKEN REVEAL */}
      {/* ============================================================ */}
      {tokenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/40 flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 rounded-lg">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Save Your Security Token</h3>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  This token will only be displayed ONCE in plaintext. It cannot be retrieved again later.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Dynamic DNS Secret Token
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    readOnly
                    value={revealToken}
                    className="flex-1 px-3 py-2 text-xs font-mono bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-l-lg text-emerald-600 dark:text-emerald-400 select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(revealToken, 'reveal-token')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg font-medium text-xs flex items-center gap-1 transition-colors"
                  >
                    {copiedId === 'reveal-token' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedId === 'reveal-token' ? 'Copied!' : 'Copy Token'}</span>
                  </button>
                </div>
              </div>

              {revealEntry && (
                <div className="p-3 bg-gray-50 dark:bg-gray-900/70 rounded-lg border border-gray-200 dark:border-gray-700 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Configured Hostname:</span>
                    <span className="font-semibold text-gray-900 dark:text-white font-mono">{revealEntry.hostname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Record Type:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{revealEntry.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Initial IP Address:</span>
                    <span className="font-mono text-gray-900 dark:text-white">{revealEntry.currentIp}</span>
                  </div>
                </div>
              )}

              {/* Sample Update URL */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Quick Web Update Command</span>
                  <button
                    onClick={() => copyToClipboard(
                      `curl -s "${originUrl}/api/ddns/update?token=${revealToken}&hostname=${revealEntry?.hostname || ''}"`,
                      'quick-curl'
                    )}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    {copiedId === 'quick-curl' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>Copy cURL</span>
                  </button>
                </div>
                <pre className="p-2.5 bg-gray-900 text-emerald-400 rounded-lg text-xs font-mono overflow-x-auto select-all">
                  {`curl -s "${originUrl}/api/ddns/update?token=${revealToken}&hostname=${revealEntry?.hostname || ''}"`}
                </pre>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setTokenModalOpen(false)}
                  className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-900 hover:bg-black text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors shadow-sm"
                >
                  I Have Copied My Token
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: EDIT DYNAMIC DNS */}
      {/* ============================================================ */}
      {editModalOpen && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Configuration</h3>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Hostname (Read-Only)
                </label>
                <input
                  type="text"
                  readOnly
                  value={editItem.hostname}
                  className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  TTL (Seconds)
                </label>
                <input
                  type="number"
                  min={300}
                  max={86400}
                  step={60}
                  value={editTtl}
                  onChange={(e) => setEditTtl(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Description / Purpose
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-enabled"
                  checked={editEnabled}
                  onChange={(e) => setEditEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="edit-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable Dynamic DNS updates for this hostname
                </label>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  {editLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: REGENERATE TOKEN CONFIRMATION */}
      {/* ============================================================ */}
      {regenModalOpen && regenItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Regenerate Security Token</h3>
                <p className="text-xs text-gray-500">Hostname: {regenItem.hostname}</p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Warning:</strong> Regenerating the security token will <strong>immediately revoke</strong> the existing token. Any routers, clients, or scheduled cron scripts configured with the old token will fail until updated.
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Are you sure you want to proceed and generate a new token for <strong>{regenItem.hostname}</strong>?
              </p>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRegenModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRegen}
                  disabled={regenLoading}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  {regenLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  <span>Yes, Regenerate Token</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 5: DELETE CONFIRMATION */}
      {/* ============================================================ */}
      {deleteModalOpen && deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
              <div className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Dynamic DNS</h3>
                <p className="text-xs text-gray-500">Hostname: {deleteItem.hostname}</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Are you sure you want to delete the Dynamic DNS configuration for <strong className="text-gray-900 dark:text-white">{deleteItem.hostname}</strong>? Future automated update requests will be rejected.
              </p>

              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="delete-dns"
                  checked={deleteDnsRecord}
                  onChange={(e) => setDeleteDnsRecord(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                />
                <label htmlFor="delete-dns" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Also delete the corresponding <strong>{deleteItem.type}</strong> DNS record from the <strong>{deleteItem.domain}</strong> zone
                </label>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  {deleteLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Delete Configuration</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 6: CLIENT SETUP INSTRUCTIONS DRAWER / MODAL */}
      {/* ============================================================ */}
      {guideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Client Configuration Guide</h3>
                  <p className="text-xs text-gray-500">
                    Target Hostname: {guideSelectedEntry?.hostname || 'your-hostname.example.com'}
                  </p>
                </div>
              </div>
              <button onClick={() => setGuideModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Hostname picker if multiple entries exist */}
              {entries.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Select Entry to Configure:</label>
                  <select
                    value={guideSelectedEntry?.id || ''}
                    onChange={(e) => {
                      const found = entries.find(x => x.id === e.target.value);
                      if (found) setGuideSelectedEntry(found);
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  >
                    {entries.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.hostname} ({e.type}) — Current IP: {e.currentIp || 'None'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tabs for client protocols */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 text-xs font-medium">
                {[
                  { id: 'curl', label: 'cURL / Shell (Linux & Mac)' },
                  { id: 'ddclient', label: 'ddclient (Linux Daemon)' },
                  { id: 'inadyn', label: 'inadyn (Routers & Linux)' },
                  { id: 'router', label: 'MikroTik / pfSense / OpenWrt' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setGuideTab(tab.id)}
                    className={`px-3 py-2 border-b-2 transition-colors ${
                      guideTab === tab.id
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: cURL */}
              {guideTab === 'curl' && (
                <div className="space-y-3 text-xs">
                  <p className="text-gray-600 dark:text-gray-300">
                    Use <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded font-mono">curl</code> to automatically update your Dynamic DNS from a shell script, terminal, or scheduled cron job.
                  </p>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Option 1: Auto-Detect IP (Query Param)</span>
                      <button
                        onClick={() => copyToClipboard(
                          `curl -s "${originUrl}/api/ddns/update?token=YOUR_TOKEN&hostname=${guideSelectedEntry?.hostname || 'example.com'}"`,
                          'guide-curl-1'
                        )}
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {copiedId === 'guide-curl-1' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        Copy
                      </button>
                    </div>
                    <pre className="p-3 bg-gray-900 text-emerald-400 rounded-lg font-mono overflow-x-auto select-all">
                      {`curl -s "${originUrl}/api/ddns/update?token=YOUR_TOKEN&hostname=${guideSelectedEntry?.hostname || 'example.com'}"`}
                    </pre>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Option 2: Bearer Header (More Secure)</span>
                      <button
                        onClick={() => copyToClipboard(
                          `curl -s -H "Authorization: Bearer YOUR_TOKEN" "${originUrl}/api/ddns/update?hostname=${guideSelectedEntry?.hostname || 'example.com'}"`,
                          'guide-curl-2'
                        )}
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {copiedId === 'guide-curl-2' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        Copy
                      </button>
                    </div>
                    <pre className="p-3 bg-gray-900 text-emerald-400 rounded-lg font-mono overflow-x-auto select-all">
                      {`curl -s -H "Authorization: Bearer YOUR_TOKEN" \\\n  "${originUrl}/api/ddns/update?hostname=${guideSelectedEntry?.hostname || 'example.com'}"`}
                    </pre>
                  </div>

                  <div>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Add to Crontab (Runs every 10 minutes):</span>
                    <pre className="mt-1 p-3 bg-gray-900 text-gray-200 rounded-lg font-mono overflow-x-auto select-all">
                      {`*/10 * * * * curl -s "${originUrl}/api/ddns/update?token=YOUR_TOKEN&hostname=${guideSelectedEntry?.hostname || 'example.com'}" > /dev/null 2>&1`}
                    </pre>
                  </div>
                </div>
              )}

              {/* Tab 2: ddclient */}
              {guideTab === 'ddclient' && (
                <div className="space-y-3 text-xs">
                  <p className="text-gray-600 dark:text-gray-300">
                    Add the following configuration to <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded font-mono">/etc/ddclient.conf</code>:
                  </p>
                  <pre className="p-3 bg-gray-900 text-emerald-400 rounded-lg font-mono overflow-x-auto select-all">
{`# /etc/ddclient.conf
daemon=300
syslog=yes
ssl=yes
protocol=dyndns2
use=web, web=checkip.dyndns.org
server=${window.location.hostname}
login=${user}
password=YOUR_TOKEN
${guideSelectedEntry?.hostname || 'example.com'}`}
                  </pre>
                </div>
              )}

              {/* Tab 3: inadyn */}
              {guideTab === 'inadyn' && (
                <div className="space-y-3 text-xs">
                  <p className="text-gray-600 dark:text-gray-300">
                    Add the following to <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded font-mono">/etc/inadyn.conf</code>:
                  </p>
                  <pre className="p-3 bg-gray-900 text-emerald-400 rounded-lg font-mono overflow-x-auto select-all">
{`# /etc/inadyn.conf
period = 300

custom default {
    system = default@dyndns.org
    ssl = true
    server = ${window.location.hostname}
    checkip-server = ${window.location.hostname}
    checkip-path = "/api/ddns/detect-ip"
    username = ${user}
    password = YOUR_TOKEN
    hostname = ${guideSelectedEntry?.hostname || 'example.com'}
}`}
                  </pre>
                </div>
              )}

              {/* Tab 4: RouterOS / pfSense / OpenWrt */}
              {guideTab === 'router' && (
                <div className="space-y-3 text-xs">
                  <p className="text-gray-600 dark:text-gray-300 font-semibold">MikroTik RouterOS Script:</p>
                  <pre className="p-3 bg-gray-900 text-emerald-400 rounded-lg font-mono overflow-x-auto select-all">
{`:local ddnsToken "YOUR_TOKEN"
:local ddnsHost "${guideSelectedEntry?.hostname || 'example.com'}"
/tool fetch mode=http url="${originUrl}/api/ddns/update?token=$ddnsToken&hostname=$ddnsHost" keep-result=no`}
                  </pre>

                  <p className="text-gray-600 dark:text-gray-300 font-semibold mt-3">pfSense / OPNsense Dynamic DNS Client:</p>
                  <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-400">
                    <li>Service Type: <strong>Custom</strong></li>
                    <li>Update URL: <code className="font-mono">{originUrl}/api/ddns/update?token=%PASS%&hostname=%HOST%&myip=%IP%</code></li>
                    <li>Username: <code className="font-mono">{user}</code></li>
                    <li>Password: <strong>YOUR_TOKEN</strong></li>
                    <li>Hostname: <code className="font-mono">{guideSelectedEntry?.hostname || 'example.com'}</code></li>
                  </ul>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setGuideModalOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
