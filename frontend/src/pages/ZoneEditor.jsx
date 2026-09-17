import React, { useState, useEffect } from 'react';
import { 
  Sliders, Plus, Trash2, Edit2, Search, RefreshCw, Globe, ArrowRight, Check, X,
  Shield, Layers, AlertCircle, CheckCircle2, Download, RotateCcw, Copy, ExternalLink,
  HelpCircle, Eye, Activity
} from 'lucide-react';
import { api } from '../services/api';

const RECORD_TYPES = ['ALL', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'];

export default function ZoneEditor({ onBack, onNavigate, user = 'cpanel_user' }) {
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [zoneData, setZoneData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Add Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addType, setAddType] = useState('A');
  const [addName, setAddName] = useState('');
  const [addRecord, setAddRecord] = useState('');
  const [addTtl, setAddTtl] = useState(14400);
  const [addPriority, setAddPriority] = useState(0);
  const [addWeight, setAddWeight] = useState(0);
  const [addPort, setAddPort] = useState(443);
  const [addFlag, setAddFlag] = useState(0);
  const [addTag, setAddTag] = useState('issue');
  const [addLoading, setAddLoading] = useState(false);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRecord, setEditRecord] = useState('');
  const [editTtl, setEditTtl] = useState(14400);
  const [editPriority, setEditPriority] = useState(0);
  const [editWeight, setEditWeight] = useState(0);
  const [editPort, setEditPort] = useState(443);
  const [editFlag, setEditFlag] = useState(0);
  const [editTag, setEditTag] = useState('issue');
  const [editLoading, setEditLoading] = useState(false);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Export Modal State
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  // Reset Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Live Lookup Modal State
  const [lookupModalOpen, setLookupModalOpen] = useState(false);
  const [lookupHost, setLookupHost] = useState('');
  const [lookupType, setLookupType] = useState('A');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Notifications
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [copiedId, setCopiedId] = useState(null);

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 6000);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Load zones on mount / user change
  const loadZones = async () => {
    try {
      setLoading(true);
      const res = await api.getDnsZones(user);
      const zoneList = res.zones || [];
      setZones(zoneList);
      if (zoneList.length > 0) {
        const initial = selectedDomain || zoneList[0].name;
        setSelectedDomain(initial);
        await loadZoneData(initial);
      } else {
        setZoneData(null);
      }
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to load DNS zones', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load single zone details
  const loadZoneData = async (domain) => {
    if (!domain) return;
    try {
      const data = await api.getDnsZone(domain, user);
      setZoneData(data);
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || `Failed to load records for ${domain}`, 'error');
    }
  };

  useEffect(() => {
    loadZones();
  }, [user]);

  const handleDomainChange = async (e) => {
    const domain = e.target.value;
    setSelectedDomain(domain);
    await loadZoneData(domain);
  };

  // Open Add Modal
  const openAddModal = (presetType = 'A') => {
    setAddType(presetType);
    setAddName('');
    setAddRecord('');
    setAddTtl(14400);
    setAddPriority(0);
    setAddWeight(0);
    setAddPort(443);
    setAddFlag(0);
    setAddTag('issue');
    setAddModalOpen(true);
  };

  // Submit Add Record
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addName.trim() && addName !== '@') {
      showMsg('Please provide a record name', 'error');
      return;
    }
    if (!addRecord.trim()) {
      showMsg('Please provide a record value / destination', 'error');
      return;
    }

    try {
      setAddLoading(true);
      const res = await api.addDnsZoneRecord({
        domain: selectedDomain,
        type: addType,
        name: addName.trim(),
        record: addRecord.trim(),
        ttl: parseInt(addTtl, 10) || 14400,
        priority: (addType === 'MX' || addType === 'SRV') ? parseInt(addPriority, 10) : undefined,
        weight: addType === 'SRV' ? parseInt(addWeight, 10) : undefined,
        port: addType === 'SRV' ? parseInt(addPort, 10) : undefined,
        flag: addType === 'CAA' ? parseInt(addFlag, 10) : undefined,
        tag: addType === 'CAA' ? addTag : undefined,
        cpanelUser: user
      });
      showMsg(res.message || 'DNS record added successfully!', 'success');
      setAddModalOpen(false);
      await loadZoneData(selectedDomain);
      // Update zone list record count
      const updatedZones = await api.getDnsZones(user);
      setZones(updatedZones.zones || []);
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to add record', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (item) => {
    if (item.isProtected) {
      showMsg('This system-managed record is protected and cannot be modified.', 'error');
      return;
    }
    setEditItem(item);
    setEditName(item.name || '');
    setEditRecord(item.record || '');
    setEditTtl(item.ttl || 14400);
    setEditPriority(item.priority !== undefined ? item.priority : 0);
    setEditWeight(item.weight !== undefined ? item.weight : 0);
    setEditPort(item.port !== undefined ? item.port : 443);
    setEditFlag(item.flag !== undefined ? item.flag : 0);
    setEditTag(item.tag || 'issue');
    setEditModalOpen(true);
  };

  // Submit Edit Record
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editItem) return;

    try {
      setEditLoading(true);
      const res = await api.updateDnsZoneRecord(editItem.id, {
        domain: selectedDomain,
        type: editItem.type,
        name: editName.trim(),
        record: editRecord.trim(),
        ttl: parseInt(editTtl, 10) || 14400,
        priority: (editItem.type === 'MX' || editItem.type === 'SRV') ? parseInt(editPriority, 10) : undefined,
        weight: editItem.type === 'SRV' ? parseInt(editWeight, 10) : undefined,
        port: editItem.type === 'SRV' ? parseInt(editPort, 10) : undefined,
        flag: editItem.type === 'CAA' ? parseInt(editFlag, 10) : undefined,
        tag: editItem.type === 'CAA' ? editTag : undefined,
        cpanelUser: user
      });
      showMsg(res.message || 'DNS record updated successfully!', 'success');
      setEditModalOpen(false);
      await loadZoneData(selectedDomain);
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to update record', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (item) => {
    if (item.isProtected) {
      showMsg('This system-managed record is protected and cannot be deleted.', 'error');
      return;
    }
    setDeleteItem(item);
    setDeleteModalOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    try {
      setDeleteLoading(true);
      const res = await api.deleteDnsZoneRecord(deleteItem.id, selectedDomain, user);
      showMsg(res.message || 'DNS record deleted successfully!', 'success');
      setDeleteModalOpen(false);
      setDeleteItem(null);
      await loadZoneData(selectedDomain);
      const updatedZones = await api.getDnsZones(user);
      setZones(updatedZones.zones || []);
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to delete record', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Open Export Modal
  const handleOpenExport = async () => {
    try {
      setExportLoading(true);
      setExportModalOpen(true);
      const res = await api.exportDnsZone(selectedDomain, user);
      setExportContent(res.zoneContent || '');
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to export zone', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  // Confirm Reset Zone
  const handleConfirmReset = async () => {
    try {
      setResetLoading(true);
      const res = await api.resetDnsZone(selectedDomain, user);
      showMsg(res.message || 'Zone reset to default records successfully!', 'success');
      setResetModalOpen(false);
      await loadZoneData(selectedDomain);
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to reset zone', 'error');
    } finally {
      setResetLoading(false);
    }
  };

  // Live DNS Lookup
  const handleLookup = async (e) => {
    e.preventDefault();
    if (!lookupHost.trim()) return;
    try {
      setLookupLoading(true);
      setLookupResult(null);
      const res = await api.lookupDns(lookupHost.trim(), lookupType);
      setLookupResult(res);
    } catch (err) {
      setLookupResult({
        success: false,
        error: err.response?.data?.error || err.message || 'Lookup failed'
      });
    } finally {
      setLookupLoading(false);
    }
  };

  // Filter & Sort records
  const records = (zoneData?.records || []).filter(r => {
    // Type filter
    if (typeFilter !== 'ALL' && r.type !== typeFilter) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (r.name || '').toLowerCase().includes(q);
      const matchType = (r.type || '').toLowerCase().includes(q);
      const matchRecord = (r.record || '').toLowerCase().includes(q);
      if (!matchName && !matchType && !matchRecord) return false;
    }
    return true;
  }).sort((a, b) => {
    let fieldA = a[sortBy] || '';
    let fieldB = b[sortBy] || '';
    if (typeof fieldA === 'string') fieldA = fieldA.toLowerCase();
    if (typeof fieldB === 'string') fieldB = fieldB.toLowerCase();
    if (fieldA < fieldB) return sortAsc ? -1 : 1;
    if (fieldA > fieldB) return sortAsc ? 1 : -1;
    return 0;
  });

  const getTypeBadgeColor = (type) => {
    switch (type) {
      case 'A': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'AAAA': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'CNAME': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'MX': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'TXT': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'NS': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'SRV': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'CAA': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'SOA': return 'bg-slate-100 text-slate-700 border-slate-300';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {msg.text && (
        <div className={`p-4 rounded-xl flex items-center justify-between shadow-lg transition-all animate-fadeIn ${
          msg.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
        }`}>
          <div className="flex items-center gap-3">
            {msg.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            <span className="text-sm font-medium">{msg.text}</span>
          </div>
          <button onClick={() => setMsg({ text: '', type: '' })} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span onClick={onBack || (() => onNavigate?.('domains'))} className="hover:text-blue-600 cursor-pointer">Domains</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Zone Editor</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Sliders className="w-7 h-7 text-[#ff6c2c]" /> Zone Editor
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage authoritative DNS zone records (A, AAAA, CNAME, MX, TXT, NS, SRV, CAA) for your hosting domains.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openAddModal('A')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Add Record
          </button>
          <button
            onClick={() => {
              setLookupHost(selectedDomain);
              setLookupResult(null);
              setLookupModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Activity className="w-4 h-4 text-blue-600" /> DNS Lookup
          </button>
          <button
            onClick={handleOpenExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Download className="w-4 h-4 text-slate-600" /> Export Zone
          </button>
          <button
            onClick={() => setResetModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 border border-slate-300 hover:border-red-200 text-slate-700 hover:text-red-600 text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <RotateCcw className="w-4 h-4" /> Reset Zone
          </button>
        </div>
      </div>

      {/* Domain Selector & Zone Metadata Card */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
            Select Domain / Zone
          </label>
          <select
            value={selectedDomain}
            onChange={handleDomainChange}
            className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/20 focus:border-[#ff6c2c]"
          >
            {zones.map(z => (
              <option key={z.name} value={z.name}>
                {z.name} ({z.type})
              </option>
            ))}
          </select>
        </div>

        <div className="border-l border-slate-100 pl-4">
          <span className="block text-[11px] font-semibold text-slate-400 uppercase">Zone Status</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-sm font-bold text-emerald-700">Active</span>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">BIND 9</span>
          </div>
        </div>

        <div className="border-l border-slate-100 pl-4">
          <span className="block text-[11px] font-semibold text-slate-400 uppercase">Total Records</span>
          <span className="text-xl font-bold text-slate-800 mt-0.5 block">
            {zoneData?.recordCount || 0}
          </span>
        </div>

        <div className="border-l border-slate-100 pl-4">
          <span className="block text-[11px] font-semibold text-slate-400 uppercase">Authoritative Nameservers</span>
          <div className="text-xs text-slate-600 font-mono mt-0.5 truncate">
            {zoneData?.authoritativeNs?.join(', ') || `ns1.${selectedDomain}, ns2.${selectedDomain}`}
          </div>
        </div>
      </div>

      {/* Quick Add Buttons */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-600 mr-2 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5 text-[#ff6c2c]" /> Quick Add:
        </span>
        <button
          onClick={() => openAddModal('A')}
          className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-300 text-blue-700 font-bold rounded shadow-2xs transition"
        >
          + A Record
        </button>
        <button
          onClick={() => openAddModal('CNAME')}
          className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-300 hover:border-emerald-300 text-emerald-700 font-bold rounded shadow-2xs transition"
        >
          + CNAME Record
        </button>
        <button
          onClick={() => openAddModal('MX')}
          className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-slate-300 hover:border-amber-300 text-amber-700 font-bold rounded shadow-2xs transition"
        >
          + MX Record
        </button>
        <button
          onClick={() => openAddModal('TXT')}
          className="px-2.5 py-1 bg-white hover:bg-purple-50 border border-slate-300 hover:border-purple-300 text-purple-700 font-bold rounded shadow-2xs transition"
        >
          + TXT Record
        </button>
        <button
          onClick={() => openAddModal('AAAA')}
          className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-300 text-indigo-700 font-bold rounded shadow-2xs transition"
        >
          + AAAA Record
        </button>
        <button
          onClick={() => openAddModal('CAA')}
          className="px-2.5 py-1 bg-white hover:bg-teal-50 border border-slate-300 hover:border-teal-300 text-teal-700 font-bold rounded shadow-2xs transition"
        >
          + CAA Record
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search records by name, type or value..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/20 focus:border-[#ff6c2c]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1 w-full md:w-auto overflow-x-auto">
          {RECORD_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                typeFilter === t
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* DNS Records Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold tracking-wider uppercase text-[11px]">
              <tr>
                <th className="py-3 px-5">Name</th>
                <th className="py-3 px-3">TTL</th>
                <th className="py-3 px-3">Class</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-5">Record / Target</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 font-sans">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#ff6c2c]" />
                    Loading authoritative DNS records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 font-sans">
                    <Sliders className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-slate-700">No DNS records match the criteria</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting search filters or click "Add Record" to create one.</p>
                  </td>
                </tr>
              ) : (
                records.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Name */}
                    <td className="py-3 px-5 text-slate-800 font-semibold max-w-[240px] truncate">
                      <div className="flex items-center gap-1.5">
                        <span title={rec.name} className="truncate">{rec.name}</span>
                        <button
                          onClick={() => copyToClipboard(rec.name, `name_${rec.id}`)}
                          title="Copy hostname"
                          className="text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition"
                        >
                          {copiedId === `name_${rec.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>

                    {/* TTL */}
                    <td className="py-3 px-3 text-slate-600">{rec.ttl}</td>

                    {/* Class */}
                    <td className="py-3 px-3 text-slate-400">IN</td>

                    {/* Type */}
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getTypeBadgeColor(rec.type)}`}>
                        {rec.type}
                      </span>
                    </td>

                    {/* Record / Value */}
                    <td className="py-3 px-5 text-slate-700 max-w-md">
                      <div className="flex items-center gap-2 truncate">
                        {rec.type === 'MX' && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            Prio {rec.priority !== undefined ? rec.priority : 0}
                          </span>
                        )}
                        {rec.type === 'SRV' && (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {rec.priority}/{rec.weight}/{rec.port}
                          </span>
                        )}
                        {rec.type === 'CAA' && (
                          <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {rec.flag} {rec.tag}
                          </span>
                        )}
                        <span title={rec.record} className="truncate select-all">{rec.record}</span>
                        <button
                          onClick={() => copyToClipboard(rec.record, `rec_${rec.id}`)}
                          title="Copy value"
                          className="text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition"
                        >
                          {copiedId === `rec_${rec.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-5 text-right font-sans">
                      {rec.isProtected ? (
                        <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1 inline-flex" title="System-managed root DNS record">
                          <Shield className="w-3 h-3 text-slate-400" /> System Protected
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(rec)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={() => openDeleteModal(rec)}
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL: ADD RECORD */}
      {/* ============================================================ */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#ff6c2c]" /> Add DNS Record ({selectedDomain})
              </h3>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              {/* Type selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Type:</label>
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:border-[#ff6c2c]"
                >
                  <option value="A">A (Address - IPv4)</option>
                  <option value="AAAA">AAAA (IPv6 Address)</option>
                  <option value="CNAME">CNAME (Canonical Name / Alias)</option>
                  <option value="MX">MX (Mail Exchanger)</option>
                  <option value="TXT">TXT (Text / SPF / DKIM)</option>
                  <option value="NS">NS (Name Server)</option>
                  <option value="SRV">SRV (Service Record)</option>
                  <option value="CAA">CAA (Certification Authority Authorization)</option>
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Name (Host / Subdomain):</label>
                <div className="relative">
                  <input
                    type="text"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder={`e.g. sub or @ or sub.${selectedDomain}.`}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff6c2c]"
                    required
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Tip: Use <code>@</code> or leave bare name for root <code>{selectedDomain}.</code>
                </span>
              </div>

              {/* TTL */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">TTL (Seconds):</label>
                <input
                  type="number"
                  min="300"
                  max="604800"
                  value={addTtl}
                  onChange={(e) => setAddTtl(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff6c2c]"
                />
              </div>

              {/* Type-Specific Fields */}
              {addType === 'A' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">IPv4 Address:</label>
                  <input
                    type="text"
                    value={addRecord}
                    onChange={(e) => setAddRecord(e.target.value)}
                    placeholder="192.0.2.1"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff6c2c]"
                    required
                  />
                </div>
              )}

              {addType === 'AAAA' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">IPv6 Address:</label>
                  <input
                    type="text"
                    value={addRecord}
                    onChange={(e) => setAddRecord(e.target.value)}
                    placeholder="2001:db8::1"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff6c2c]"
                    required
                  />
                </div>
              )}

              {addType === 'CNAME' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Hostname:</label>
                  <input
                    type="text"
                    value={addRecord}
                    onChange={(e) => setAddRecord(e.target.value)}
                    placeholder="example.com."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff6c2c]"
                    required
                  />
                </div>
              )}

              {addType === 'MX' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Priority:</label>
                    <input
                      type="number"
                      min="0"
                      max="65535"
                      value={addPriority}
                      onChange={(e) => setAddPriority(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff6c2c]"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Destination Mail Server:</label>
                    <input
                      type="text"
                      value={addRecord}
                      onChange={(e) => setAddRecord(e.target.value)}
                      placeholder="mail.example.com."
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff6c2c]"
                      required
                    />
                  </div>
                </div>
              )}

              {addType === 'TXT' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">TXT Data:</label>
                  <textarea
                    rows="3"
                    value={addRecord}
                    onChange={(e) => setAddRecord(e.target.value)}
                    placeholder='"v=spf1 +a +mx ~all"'
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff6c2c]"
                    required
                  />
                </div>
              )}

              {addType === 'NS' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nameserver Hostname:</label>
                  <input
                    type="text"
                    value={addRecord}
                    onChange={(e) => setAddRecord(e.target.value)}
                    placeholder="ns1.example.com."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff6c2c]"
                    required
                  />
                </div>
              )}

              {addType === 'SRV' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Priority:</label>
                      <input type="number" min="0" max="65535" value={addPriority} onChange={(e) => setAddPriority(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Weight:</label>
                      <input type="number" min="0" max="65535" value={addWeight} onChange={(e) => setAddWeight(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Port:</label>
                      <input type="number" min="1" max="65535" value={addPort} onChange={(e) => setAddPort(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target Hostname:</label>
                    <input type="text" value={addRecord} onChange={(e) => setAddRecord(e.target.value)} placeholder="sip.example.com." className="w-full border rounded px-3 py-1.5 text-xs font-mono" required />
                  </div>
                </div>
              )}

              {addType === 'CAA' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Flag:</label>
                      <input type="number" min="0" max="255" value={addFlag} onChange={(e) => setAddFlag(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tag:</label>
                      <select value={addTag} onChange={(e) => setAddTag(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                        <option value="issue">issue</option>
                        <option value="issuewild">issuewild</option>
                        <option value="iodef">iodef</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Value (CA Domain / Email):</label>
                    <input type="text" value={addRecord} onChange={(e) => setAddRecord(e.target.value)} placeholder="letsencrypt.org" className="w-full border rounded px-3 py-1.5 text-xs font-mono" required />
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-5 py-2 bg-[#ff6c2c] hover:bg-[#e55619] text-white font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {addLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EDIT RECORD */}
      {/* ============================================================ */}
      {editModalOpen && editItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" /> Edit {editItem.type} Record
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Name (Host):</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff6c2c]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">TTL (Seconds):</label>
                <input
                  type="number"
                  min="300"
                  max="604800"
                  value={editTtl}
                  onChange={(e) => setEditTtl(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff6c2c]"
                />
              </div>

              {editItem.type === 'MX' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority:</label>
                  <input
                    type="number"
                    min="0"
                    max="65535"
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff6c2c]"
                  />
                </div>
              )}

              {editItem.type === 'SRV' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Priority:</label>
                    <input type="number" min="0" max="65535" value={editPriority} onChange={(e) => setEditPriority(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs font-mono" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Weight:</label>
                    <input type="number" min="0" max="65535" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs font-mono" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Port:</label>
                    <input type="number" min="1" max="65535" value={editPort} onChange={(e) => setEditPort(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs font-mono" />
                  </div>
                </div>
              )}

              {editItem.type === 'CAA' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Flag:</label>
                    <input type="number" min="0" max="255" value={editFlag} onChange={(e) => setEditFlag(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs font-mono" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tag:</label>
                    <select value={editTag} onChange={(e) => setEditTag(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                      <option value="issue">issue</option>
                      <option value="issuewild">issuewild</option>
                      <option value="iodef">iodef</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Record Value / Target:</label>
                {editItem.type === 'TXT' ? (
                  <textarea
                    rows="3"
                    value={editRecord}
                    onChange={(e) => setEditRecord(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff6c2c]"
                    required
                  />
                ) : (
                  <input
                    type="text"
                    value={editRecord}
                    onChange={(e) => setEditRecord(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#ff6c2c]"
                    required
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {editLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ============================================================ */}
      {deleteModalOpen && deleteItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete DNS Record?</h3>
                <p className="text-xs text-slate-500">This action will remove the record from the authoritative zone.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 my-4 text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Type:</span>
                <span className="font-bold text-slate-800">{deleteItem.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Name:</span>
                <span className="font-bold text-slate-800 truncate max-w-[200px]">{deleteItem.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Value:</span>
                <span className="font-bold text-slate-800 truncate max-w-[200px]">{deleteItem.record}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TTL:</span>
                <span className="text-slate-600">{deleteItem.ttl}s</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleteLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EXPORT ZONE */}
      {/* ============================================================ */}
      {exportModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-600" /> BIND Zone File — {selectedDomain}
              </h3>
              <button onClick={() => setExportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {exportLoading ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                Generating BIND zone configuration...
              </div>
            ) : (
              <div>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono max-h-96 overflow-y-auto whitespace-pre leading-relaxed select-all">
                  {exportContent}
                </pre>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-[11px] text-slate-500">Standard RFC 1035 / BIND 9 zone format</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(exportContent, 'export_zone')}
                      className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                    >
                      {copiedId === 'export_zone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Text
                    </button>
                    <a
                      href={`data:text/plain;charset=utf-8,${encodeURIComponent(exportContent)}`}
                      download={`${selectedDomain}.db`}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" /> Download .db File
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: RESET ZONE */}
      {/* ============================================================ */}
      {resetModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reset Zone to Defaults?</h3>
                <p className="text-xs text-slate-500">Domain: {selectedDomain}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed my-3">
              This will remove all custom DNS entries for <strong>{selectedDomain}</strong> and restore default standard records:
              A (Apex), www CNAME, mail A, default MX, and basic SPF/DKIM records.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={resetLoading}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {resetLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Reset Zone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: LIVE DNS LOOKUP */}
      {/* ============================================================ */}
      {lookupModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" /> Live DNS Resolver Lookup
              </h3>
              <button onClick={() => setLookupModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLookup} className="space-y-3 text-xs mb-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Hostname to Query:</label>
                  <input
                    type="text"
                    value={lookupHost}
                    onChange={(e) => setLookupHost(e.target.value)}
                    placeholder="example.com"
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Type:</label>
                  <select
                    value={lookupType}
                    onChange={(e) => setLookupType(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold"
                  >
                    <option value="A">A</option>
                    <option value="AAAA">AAAA</option>
                    <option value="CNAME">CNAME</option>
                    <option value="MX">MX</option>
                    <option value="TXT">TXT</option>
                    <option value="NS">NS</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={lookupLoading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
              >
                {lookupLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Query Public DNS Resolvers
              </button>
            </form>

            {lookupResult && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-mono">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                  <span className="font-bold text-slate-800">
                    Query: {lookupResult.hostname} [{lookupResult.type}]
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    lookupResult.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {lookupResult.status} ({lookupResult.responseTimeMs}ms)
                  </span>
                </div>

                {lookupResult.success ? (
                  <div>
                    <span className="text-slate-500 block mb-1 font-sans text-[11px]">Resolver Answers:</span>
                    <ul className="space-y-1">
                      {(Array.isArray(lookupResult.results) ? lookupResult.results : [lookupResult.results]).map((res, i) => (
                        <li key={i} className="bg-white p-2 rounded border border-slate-200 text-slate-800 select-all">
                          {typeof res === 'object' ? JSON.stringify(res) : String(res)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-red-600 font-sans">
                    Error: {lookupResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
