import React, { useState, useEffect } from 'react';
import { 
  Radio, Plus, Trash2, Edit2, ExternalLink, CheckCircle2, 
  AlertCircle, Search, RefreshCw, Globe, ArrowRight, Check, X,
  Shield, Layers, Sliders, ToggleLeft, ToggleRight, Play, Info
} from 'lucide-react';
import { api } from '../services/api';

export default function RedirectManager({ onBack, onNavigate, user = 'cpanel_user' }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, permanent: 0, temporary: 0, active: 0, disabled: 0 });
  const [redirects, setRedirects] = useState([]);
  const [domains, setDomains] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Add Form State
  const [addType, setAddType] = useState('301 Permanent');
  const [addDomain, setAddDomain] = useState('all');
  const [addSourcePath, setAddSourcePath] = useState('');
  const [addTargetUrl, setAddTargetUrl] = useState('');
  const [addWildcard, setAddWildcard] = useState(false);
  const [addWwwOption, setAddWwwOption] = useState('all');
  const [addLoading, setAddLoading] = useState(false);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editTargetUrl, setEditTargetUrl] = useState('');
  const [editType, setEditType] = useState('301 Permanent');
  const [editWildcard, setEditWildcard] = useState(false);
  const [editWwwOption, setEditWwwOption] = useState('all');
  const [editStatus, setEditStatus] = useState('Active');
  const [editLoading, setEditLoading] = useState(false);

  // Test Modal State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testItem, setTestItem] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Notifications
  const [msg, setMsg] = useState({ text: '', type: '' });

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 6000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [redirRes, domRes] = await Promise.all([
        api.getRedirects(),
        api.getRedirectDomains()
      ]);
      setRedirects(redirRes.redirects || []);
      setStats(redirRes.stats || { total: 0, permanent: 0, temporary: 0, active: 0, disabled: 0 });
      setDomains(domRes || []);
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to load redirects', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Handle Add Redirect
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addTargetUrl.trim()) {
      showMsg('Please enter a target destination URL', 'error');
      return;
    }

    try {
      setAddLoading(true);
      await api.createRedirect({
        domain: addDomain,
        sourcePath: addSourcePath,
        targetUrl: addTargetUrl.trim(),
        type: addType,
        wildcard: addWildcard,
        wwwOption: addWwwOption
      });
      showMsg(`Redirect created successfully and synced with .htaccess!`, 'success');
      setAddSourcePath('');
      setAddTargetUrl('');
      setAddWildcard(false);
      setAddWwwOption('all');
      await loadData();
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to create redirect', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (item) => {
    setEditItem(item);
    setEditTargetUrl(item.targetUrl || item.destUrl || '');
    setEditType(item.type || '301 Permanent');
    setEditWildcard(!!item.wildcard);
    setEditWwwOption(item.wwwOption || 'all');
    setEditStatus(item.status || 'Active');
    setEditModalOpen(true);
  };

  // Save Edit
  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editItem) return;

    try {
      setEditLoading(true);
      await api.updateRedirect(editItem.id, {
        targetUrl: editTargetUrl.trim(),
        type: editType,
        wildcard: editWildcard,
        wwwOption: editWwwOption,
        status: editStatus
      });
      showMsg('Redirect updated successfully and .htaccess refreshed!', 'success');
      setEditModalOpen(false);
      await loadData();
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to update redirect', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (item) => {
    try {
      const res = await api.toggleRedirectStatus(item.id);
      showMsg(`Redirect status changed to "${res.redirect.status}"`, 'success');
      await loadData();
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to toggle status', 'error');
    }
  };

  // Open Test Modal & Run Test
  const openTestModal = async (item) => {
    setTestItem(item);
    setTestResult(null);
    setTestModalOpen(true);
    setTestLoading(true);

    try {
      const res = await api.testRedirect(item.id);
      setTestResult(res);
    } catch (err) {
      setTestResult({
        success: false,
        error: err.response?.data?.error || err.message || 'Test failed'
      });
    } finally {
      setTestLoading(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (item) => {
    setDeleteItem(item);
    setDeleteModalOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    try {
      setDeleteLoading(true);
      await api.deleteRedirectExtended(deleteItem.id);
      showMsg('Redirect removed successfully and .htaccess cleaned!', 'success');
      setDeleteModalOpen(false);
      setDeleteItem(null);
      await loadData();
    } catch (err) {
      showMsg(err.response?.data?.error || err.message || 'Failed to delete redirect', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered List
  const filteredRedirects = redirects.filter(r => {
    const q = searchQuery.toLowerCase();
    const domainMatch = (r.domain || '').toLowerCase().includes(q);
    const pathMatch = (r.sourcePath || '').toLowerCase().includes(q);
    const targetMatch = (r.targetUrl || r.destUrl || '').toLowerCase().includes(q);
    const queryMatch = !q || domainMatch || pathMatch || targetMatch;

    const typeMatches = typeFilter === 'ALL' || 
      (typeFilter === '301' && r.type?.includes('301')) ||
      (typeFilter === '302' && r.type?.includes('302'));

    const statusMatches = statusFilter === 'ALL' || r.status === statusFilter;

    return queryMatch && typeMatches && statusMatches;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-800 font-sans">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span 
              onClick={() => onNavigate && onNavigate('dashboard')}
              className="hover:text-blue-600 cursor-pointer"
            >
              Home
            </span>
            <span>/</span>
            <span 
              onClick={() => onNavigate && onNavigate('domains')}
              className="hover:text-blue-600 cursor-pointer"
            >
              Domains
            </span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Redirects</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Radio className="w-7 h-7 text-[#ff6c2c]" />
            Redirects
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Redirects allow you to forward specific web paths or entire domains to new destinations using real 301 Permanent or 302 Temporary HTTP rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
            title="Refresh Redirects"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#ff6c2c]' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Global Message Alert */}
      {msg.text && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-xs border ${
          msg.type === 'error' 
            ? 'bg-red-50 border-red-200 text-red-700' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {msg.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Metric / Stat Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Redirects</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Managed rules</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">301 Permanent</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{stats.permanent}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">SEO Moved Permanently</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">302 Temporary</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{stats.temporary}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Found / Temporary Move</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Active Rules</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.active}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{stats.disabled} disabled</div>
        </div>
      </div>

      {/* ADD REDIRECT CARD */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Plus className="w-4 h-4 text-[#ff6c2c]" />
          Add Redirect
        </h2>

        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={addType}
                onChange={(e) => setAddType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white focus:outline-none"
              >
                <option value="301 Permanent">Permanent (301)</option>
                <option value="302 Temporary">Temporary (302)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                {addType.includes('301') 
                  ? '301: Tells browsers and search engines to update their bookmarks/indexes.' 
                  : '302: For temporary maintenance or short campaigns.'}
              </p>
            </div>

            {/* Domain Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                https?://(www.)? <span className="text-red-500">*</span>
              </label>
              <select
                value={addDomain}
                onChange={(e) => setAddDomain(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white focus:outline-none"
              >
                {domains.map((d, i) => (
                  <option key={i} value={d.value}>
                    {d.name} {d.type && d.type !== 'Special' ? `(${d.type})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Select specific domain or all public domains.
              </p>
            </div>

            {/* Directory / Path */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Directory / Source Path
              </label>
              <div className="flex items-center">
                <span className="bg-slate-100 border border-r-0 border-slate-300 px-2.5 py-2 text-xs text-slate-500 rounded-l-lg select-none">
                  /
                </span>
                <input
                  type="text"
                  value={addSourcePath}
                  onChange={(e) => setAddSourcePath(e.target.value)}
                  placeholder="old-page or leave empty for root"
                  className="w-full bg-slate-50 border border-slate-300 rounded-r-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Leave blank to redirect the entire domain root.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Redirects To / Destination URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Redirects To <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={addTargetUrl}
                onChange={(e) => setAddTargetUrl(e.target.value)}
                placeholder="https://example.com/new-location or /new-page"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Enter the full destination URL (e.g. <code>https://newsite.com</code>).
              </p>
            </div>

            {/* www Redirection Options */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                www. Redirection:
              </label>
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="wwwOption"
                    value="all"
                    checked={addWwwOption === 'all'}
                    onChange={(e) => setAddWwwOption(e.target.value)}
                    className="text-[#ff6c2c] focus:ring-[#ff6c2c]"
                  />
                  <span>Redirect with or without www.</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="wwwOption"
                    value="only_www"
                    checked={addWwwOption === 'only_www'}
                    onChange={(e) => setAddWwwOption(e.target.value)}
                    className="text-[#ff6c2c] focus:ring-[#ff6c2c]"
                  />
                  <span>Only redirect with www.</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="wwwOption"
                    value="no_www"
                    checked={addWwwOption === 'no_www'}
                    onChange={(e) => setAddWwwOption(e.target.value)}
                    className="text-[#ff6c2c] focus:ring-[#ff6c2c]"
                  />
                  <span>Do Not Redirect www.</span>
                </label>
              </div>
            </div>
          </div>

          {/* Wildcard Option */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <label className="flex items-start gap-2 text-xs text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={addWildcard}
                onChange={(e) => setAddWildcard(e.target.checked)}
                className="mt-0.5 text-[#ff6c2c] focus:ring-[#ff6c2c] rounded"
              />
              <div>
                <span className="font-semibold">Wildcard Redirect</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Checking this box will redirect all files within a directory to the same filename in the redirected directory (e.g. <code>example.com/pic.jpg</code> &rarr; <code>newsite.com/pic.jpg</code>).
                </p>
              </div>
            </label>
          </div>

          {/* Live Preview & Submit */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-600 flex items-center gap-1.5 font-mono">
              <span className="text-slate-400 font-sans text-[11px]">Preview:</span>
              <span className="bg-slate-100 px-2 py-1 rounded text-slate-700">
                {addDomain === 'all' ? '*' : addDomain}{addSourcePath.startsWith('/') ? addSourcePath : `/${addSourcePath}`}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="bg-slate-100 px-2 py-1 rounded text-emerald-700 font-semibold truncate max-w-[300px]">
                {addTargetUrl || '(destination url)'}
              </span>
            </div>

            <button
              type="submit"
              disabled={addLoading}
              className="bg-[#ff6c2c] hover:bg-[#e55619] disabled:bg-slate-300 text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              {addLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add Redirect
            </button>
          </div>
        </form>
      </div>

      {/* CURRENT REDIRECTS LIST */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Table Filters & Search */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">
              Current Redirects ({filteredRedirects.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search domain or path..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="301">301 Permanent</option>
              <option value="302">302 Temporary</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active</option>
              <option value="Disabled">Disabled</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#ff6c2c]" />
            Loading redirects and inspecting .htaccess...
          </div>
        ) : filteredRedirects.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <Radio className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-700">No redirects found</p>
            <p className="text-slate-400 mt-0.5">Use the form above to create your first URL redirect rule.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-4">Domain / Source Path</th>
                  <th className="py-3 px-4">Redirects To</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Match</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRedirects.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Domain & Source Path */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5 font-mono">
                        <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{r.domain === 'all' ? '** All Public Domains **' : r.domain}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 pl-5">
                        Path: <span className="font-semibold text-slate-700">{r.sourcePath || '/'}</span>
                      </div>
                    </td>

                    {/* Redirect URL */}
                    <td className="py-3 px-4">
                      <a
                        href={r.targetUrl || r.destUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-mono font-medium truncate max-w-[260px]"
                        title={r.targetUrl || r.destUrl}
                      >
                        {r.targetUrl || r.destUrl}
                        <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                      </a>
                    </td>

                    {/* Type Badge */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                        r.type?.includes('301')
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {r.type}
                      </span>
                    </td>

                    {/* Match / Wildcard */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        r.wildcard
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {r.wildcard ? 'Wildcard' : 'Exact'}
                      </span>
                    </td>

                    {/* Status Toggle */}
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(r)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                          r.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                        }`}
                        title="Click to toggle status"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {r.status === 'Active' ? 'Active' : 'Disabled'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Test Button */}
                        <button
                          type="button"
                          onClick={() => openTestModal(r)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                          title="Test Redirect"
                        >
                          <Play className="w-3 h-3 text-blue-600" />
                          Test
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => openEditModal(r)}
                          className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                          title="Edit Redirect"
                        >
                          <Edit2 className="w-3 h-3 text-slate-500" />
                          Edit
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => openDeleteModal(r)}
                          className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                          title="Delete Redirect"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editModalOpen && editItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#ff6c2c]" />
                Edit Redirect Rule
              </h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Source Domain & Path:</label>
                <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-mono">
                  {editItem.domain}{editItem.sourcePath}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination Target URL:</label>
                <input
                  type="text"
                  value={editTargetUrl}
                  onChange={(e) => setEditTargetUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Redirect Type:</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="301 Permanent">301 Permanent</option>
                    <option value="302 Temporary">302 Temporary</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status:</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editWildcard}
                    onChange={(e) => setEditWildcard(e.target.checked)}
                    className="text-[#ff6c2c] focus:ring-[#ff6c2c] rounded"
                  />
                  <span className="font-semibold">Wildcard Redirect</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-[#ff6c2c] hover:bg-[#e55619] disabled:bg-slate-300 text-white font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  {editLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEST MODAL / DRAWER */}
      {testModalOpen && testItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Play className="w-4 h-4 text-blue-600" />
                Test Redirect Operation
              </h3>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {testLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                Executing live HTTP redirect simulation and SSRF safety check...
              </div>
            ) : testResult ? (
              <div className="space-y-3 text-xs">
                <div className={`p-3 rounded-lg flex items-center gap-2 font-semibold ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />}
                  <span>{testResult.status || 'Verified Response'}</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 font-mono">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-sans text-slate-500">HTTP Status:</span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {testResult.statusCode} {testResult.statusCode === 301 ? 'Moved Permanently' : 'Found (302)'}
                    </span>
                  </div>

                  <div className="text-slate-600">
                    <div className="font-sans text-slate-500 mb-0.5">Location Header (Destination):</div>
                    <div className="text-emerald-700 font-semibold break-all bg-white p-2 rounded border border-slate-200">
                      {testResult.location}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-slate-600 text-[11px] pt-1 border-t border-slate-200">
                    <span className="font-sans text-slate-500">Response Latency:</span>
                    <span>{testResult.responseTimeMs} ms</span>
                  </div>
                </div>

                {testResult.note && (
                  <p className="text-[11px] text-slate-500 italic">
                    {testResult.note}
                  </p>
                )}
              </div>
            ) : null}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteModalOpen && deleteItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-red-600 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Confirm Redirect Deletion
              </h3>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete the redirect rule for:
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-800 space-y-1">
              <div><strong>Source:</strong> {deleteItem.domain}{deleteItem.sourcePath}</div>
              <div><strong>Target:</strong> {deleteItem.targetUrl || deleteItem.destUrl}</div>
              <div><strong>Type:</strong> {deleteItem.type}</div>
            </div>

            <p className="text-[11px] text-slate-500">
              This will immediately remove the rewrite directives from your web server's <code>.htaccess</code> configuration.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                {deleteLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Delete Redirect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
