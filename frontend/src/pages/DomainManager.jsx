import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { 
  Globe, Plus, Trash2, ArrowRight, ShieldCheck, CheckCircle2, 
  Link2, Lock, ShieldAlert, Shield, Users, RefreshCw, ExternalLink,
  Folder, Settings, Search, Filter, AlertTriangle, X, Check, ArrowUpRight,
  Sliders, Key, FileText, Database, Radio
} from 'lucide-react';

export default function DomainManager({ onOpenFileManager, onNavigate, user }) {
  const [data, setData] = useState({ 
    primaryDomain: 'example.com',
    domains: [], 
    subdomains: [], 
    aliases: [],
    redirects: [], 
    dnsRecords: [],
    directoryPrivacy: [],
    blockedIps: [],
    hotlinkProtection: {},
    ftpAccounts: []
  });

  const [unifiedData, setUnifiedData] = useState({
    domains: [],
    totalCount: 0,
    stats: { total: 0, primary: 1, addon: 0, subdomain: 0, alias: 0 },
    limits: { plan: 'Standard Shared Hosting', maxAddonDomains: 10, maxSubdomains: 50, maxAliases: 10, maxTotalDomains: 20 }
  });

  const [tab, setTab] = useState('domains'); 
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Search & Filter for Unified Domains
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [preDeleteInfo, setPreDeleteInfo] = useState(null);

  // Create Domain Form State
  const [newDomainName, setNewDomainName] = useState('');
  const [shareDocRoot, setShareDocRoot] = useState(false);
  const [newDocRoot, setNewDocRoot] = useState('');
  const [newForceHttps, setNewForceHttps] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [checkingName, setCheckingName] = useState(false);

  // Manage Domain Form State
  const [editDocRoot, setEditDocRoot] = useState('');
  const [editForceHttps, setEditForceHttps] = useState(false);
  const [editRedirectTarget, setEditRedirectTarget] = useState('');
  const [domainDetails, setDomainDetails] = useState(null);

  // Forms - Legacy Tab Handlers (Subdomains, Aliases, Redirects, DNS, etc.)
  const [subPrefix, setSubPrefix] = useState('');
  const [subDomainSelect, setSubDomainSelect] = useState('example.com');
  const [aliasName, setAliasName] = useState('');
  const [aliasTarget, setAliasTarget] = useState('example.com');
  const [redirType, setRedirType] = useState('301 Permanent');
  const [redirSource, setRedirSource] = useState('');
  const [redirDest, setRedirDest] = useState('');
  const [dnsName, setDnsName] = useState('');
  const [dnsType, setDnsType] = useState('A');
  const [dnsRecord, setDnsRecord] = useState('');
  const [dnsTtl, setDnsTtl] = useState('14400');
  const [dnsPriority, setDnsPriority] = useState('0');
  const [dpPath, setDpPath] = useState('public_html/secret');
  const [dpUser, setDpUser] = useState('admin');
  const [dpPass, setDpPass] = useState('');
  const [blockIpInput, setBlockIpInput] = useState('');
  const [blockIpReason, setBlockIpReason] = useState('Abuse / Brute force');
  const [ftpUser, setFtpUser] = useState('');
  const [ftpDomain, setFtpDomain] = useState('example.com');
  const [ftpPass, setFtpPass] = useState('');
  const [ftpDir, setFtpDir] = useState('public_html');
  const [ftpQuota, setFtpQuota] = useState('Unlimited');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [legacyRes, unifiedRes] = await Promise.all([
        api.getDomains(),
        api.getUnifiedDomains()
      ]);
      setData(legacyRes);
      setUnifiedData(unifiedRes);

      if (legacyRes.domains?.length > 0) {
        if (!subDomainSelect) setSubDomainSelect(legacyRes.domains[0].name);
        if (!aliasTarget) setAliasTarget(legacyRes.domains[0].name);
        if (!ftpDomain) setFtpDomain(legacyRes.domains[0].name);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Live validation for new domain name
  useEffect(() => {
    if (!newDomainName.trim() || newDomainName.trim().length < 3 || !newDomainName.includes('.')) {
      setCheckResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingName(true);
      try {
        const res = await api.checkDomainName(newDomainName.trim());
        setCheckResult(res);
        if (!shareDocRoot && !newDocRoot) {
          setNewDocRoot(res.suggestedDocRoot || `public_html/${newDomainName.trim().toLowerCase()}`);
        }
      } catch (err) {
        setCheckResult({ valid: false, message: err.message });
      } finally {
        setCheckingName(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [newDomainName]);

  // Filtered Unified Domains
  const filteredDomains = useMemo(() => {
    let list = unifiedData.domains || [];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q) || d.documentRoot.toLowerCase().includes(q));
    }
    if (filterType !== 'all') {
      list = list.filter(d => d.type.toLowerCase().includes(filterType.toLowerCase()));
    }
    return list;
  }, [unifiedData.domains, searchQuery, filterType]);

  // --- UNIFIED DOMAIN ACTIONS ---

  const handleOpenCreateModal = () => {
    setNewDomainName('');
    setShareDocRoot(false);
    setNewDocRoot('');
    setNewForceHttps(false);
    setCheckResult(null);
    setCreateModalOpen(true);
  };

  const handleCreateDomainSubmit = async (e) => {
    e.preventDefault();
    if (!newDomainName.trim()) return;
    setActionLoading(true);
    try {
      await api.createDomainExtended({
        name: newDomainName.trim(),
        documentRoot: shareDocRoot ? 'public_html' : (newDocRoot.trim() || `public_html/${newDomainName.trim().toLowerCase()}`),
        shareDocRoot,
        type: 'Addon Domain',
        forceHttps: newForceHttps
      });
      showToast(`Domain "${newDomainName.trim()}" created and configured successfully!`);
      setCreateModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleForceHttps = async (domain, currentVal) => {
    const nextVal = !currentVal;
    setActionLoading(true);
    try {
      await api.toggleDomainForceHttps(domain.name, nextVal);
      showToast(`Force HTTPS Redirection ${nextVal ? 'Enabled' : 'Disabled'} for ${domain.name}`);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenManageModal = async (domain) => {
    setSelectedDomain(domain);
    setEditDocRoot(domain.documentRoot || 'public_html');
    setEditForceHttps(!!domain.forceHttps);
    setEditRedirectTarget(domain.redirectTarget || '');
    setManageModalOpen(true);
    try {
      const details = await api.getDomainDetails(domain.name);
      setDomainDetails(details);
    } catch (e) {
      setDomainDetails(null);
    }
  };

  const handleSaveManageConfig = async (e) => {
    e.preventDefault();
    if (!selectedDomain) return;
    setActionLoading(true);
    try {
      await api.updateDomainConfig(selectedDomain.name, {
        documentRoot: editDocRoot.trim(),
        forceHttps: editForceHttps,
        redirectTarget: editRedirectTarget.trim() || null
      });
      showToast(`Configuration saved for ${selectedDomain.name}`);
      setManageModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDeleteModal = async (domain) => {
    if (domain.isPrimary || domain.type === 'Primary Domain') {
      showToast('Cannot delete the primary domain of this hosting account', 'error');
      return;
    }
    setSelectedDomain(domain);
    setPreDeleteInfo(null);
    setDeleteModalOpen(true);
    try {
      const info = await api.preDeleteDomainCheck(domain.name);
      setPreDeleteInfo(info);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedDomain) return;
    setActionLoading(true);
    try {
      await api.deleteDomain(selectedDomain.name);
      showToast(`Domain "${selectedDomain.name}" removed successfully`);
      setDeleteModalOpen(false);
      setSelectedDomain(null);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenFileRoot = (docRoot) => {
    if (onOpenFileManager) {
      onOpenFileManager(docRoot);
    } else if (onNavigate) {
      onNavigate('files', null, { initialPath: docRoot });
    }
  };

  // --- LEGACY TAB HANDLERS ---
  const handleAddSubdomain = async (e) => {
    e.preventDefault();
    if (!subPrefix.trim()) return;
    try {
      await api.addSubdomain(subPrefix.trim(), subDomainSelect);
      setSubPrefix('');
      showToast('Subdomain created successfully!');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteSubdomain = async (name) => {
    if (!window.confirm(`Delete subdomain "${name}"?`)) return;
    try {
      await api.deleteSubdomain(name);
      showToast('Subdomain deleted');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAddAlias = async (e) => {
    e.preventDefault();
    if (!aliasName.trim()) return;
    try {
      await api.addAlias(aliasName.trim(), aliasTarget);
      setAliasName('');
      showToast('Alias added successfully!');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteAlias = async (name) => {
    if (!window.confirm(`Delete alias "${name}"?`)) return;
    try {
      await api.deleteAlias(name);
      showToast('Alias deleted');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAddRedirect = async (e) => {
    e.preventDefault();
    if (!redirSource.trim() || !redirDest.trim()) return;
    try {
      await api.addRedirect(redirType, redirSource.trim(), redirDest.trim());
      setRedirSource('');
      setRedirDest('');
      showToast('Redirect rule saved!');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteRedirect = async (source) => {
    try {
      await api.deleteRedirect(source);
      showToast('Redirect removed');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAddDns = async (e) => {
    e.preventDefault();
    if (!dnsName.trim() || !dnsRecord.trim()) return;
    try {
      await api.addDnsRecord(dnsName.trim(), dnsType, dnsRecord.trim(), dnsTtl, dnsPriority);
      setDnsName('');
      setDnsRecord('');
      showToast('DNS Record added to zone!');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteDns = async (id) => {
    try {
      await api.deleteDnsRecord(id);
      showToast('DNS record deleted');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSetDirectoryPrivacy = async (e) => {
    e.preventDefault();
    if (!dpPath.trim() || !dpUser.trim() || !dpPass) return;
    try {
      await api.setDirectoryPrivacy(dpPath.trim(), true, dpUser.trim(), dpPass);
      setDpPass('');
      showToast(`Directory "${dpPath}" password-protected!`);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoveDirectoryPrivacy = async (dirPath) => {
    if (!window.confirm(`Remove password protection from "${dirPath}"?`)) return;
    try {
      await api.setDirectoryPrivacy(dirPath, false);
      showToast(`Removed protection from "${dirPath}"`);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBlockIp = async (e) => {
    e.preventDefault();
    if (!blockIpInput.trim()) return;
    try {
      await api.blockIp(blockIpInput.trim(), blockIpReason.trim());
      setBlockIpInput('');
      showToast(`IP ${blockIpInput} blocked!`);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUnblockIp = async (ip) => {
    if (!window.confirm(`Unblock IP address "${ip}"?`)) return;
    try {
      await api.unblockIp(ip);
      showToast(`Unblocked IP ${ip}`);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleHotlink = async () => {
    try {
      const nextState = !data.hotlinkProtection?.enabled;
      await api.toggleHotlink(nextState, data.hotlinkProtection?.allowedExtensions);
      showToast(`Hotlink protection ${nextState ? 'Enabled' : 'Disabled'}`);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAddFtp = async (e) => {
    e.preventDefault();
    if (!ftpUser.trim() || !ftpPass) return;
    try {
      await api.addFtpAccount(ftpUser.trim(), ftpDomain, ftpPass, ftpDir.trim(), ftpQuota);
      setFtpUser('');
      setFtpPass('');
      showToast('FTP Account created!');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteFtp = async (u) => {
    if (!window.confirm(`Delete FTP account "${u}"?`)) return;
    try {
      await api.deleteFtpAccount(u);
      showToast('FTP account deleted');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all animate-fade ${
          toast.type === 'error' 
            ? 'bg-rose-50 border-rose-200 text-rose-800' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span className="hover:text-slate-800 cursor-pointer" onClick={() => onNavigate && onNavigate('dashboard')}>cPanel</span>
            <span>/</span>
            <span>Domains</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Domains</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-[#ff6c2c]" />
            Domains
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage your websites, addon domains, subdomains, parked aliases, and document root directories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading || actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#ff6c2c]' : 'text-slate-500'}`} />
            Refresh
          </button>

          <button
            onClick={handleOpenCreateModal}
            disabled={loading || actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#ff6c2c] hover:bg-[#e05819] text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-60 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create a New Domain
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-[#ff6c2c] rounded-lg">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{unifiedData.stats.total}</div>
            <div className="text-xs text-slate-500 font-medium">Total Domains</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 truncate max-w-[120px]">{unifiedData.primaryDomain}</div>
            <div className="text-xs text-slate-500 font-medium">Primary Domain</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{unifiedData.stats.addon} <span className="text-xs font-normal text-slate-400">/ {unifiedData.limits.maxAddonDomains}</span></div>
            <div className="text-xs text-slate-500 font-medium">Addon Domains</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Folder className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{unifiedData.stats.subdomain} <span className="text-xs font-normal text-slate-400">/ {unifiedData.limits.maxSubdomains}</span></div>
            <div className="text-xs text-slate-500 font-medium">Subdomains</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-lg">
            <Link2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{unifiedData.stats.alias} <span className="text-xs font-normal text-slate-400">/ {unifiedData.limits.maxAliases}</span></div>
            <div className="text-xs text-slate-500 font-medium">Aliases / Parked</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 space-x-2 sm:space-x-4 text-xs font-semibold overflow-x-auto pb-0.5">
        <button
          onClick={() => setTab('domains')}
          className={`pb-2.5 px-3 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
            tab === 'domains' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Domains ({unifiedData.totalCount})
        </button>
        <button
          onClick={() => setTab('subdomains')}
          className={`pb-2.5 px-3 border-b-2 whitespace-nowrap transition cursor-pointer ${
            tab === 'subdomains' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Subdomains ({data.subdomains?.length || 0})
        </button>
        <button
          onClick={() => setTab('aliases')}
          className={`pb-2.5 px-3 border-b-2 whitespace-nowrap transition cursor-pointer ${
            tab === 'aliases' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Aliases ({data.aliases?.length || 0})
        </button>
        <button
          onClick={() => setTab('redirects')}
          className={`pb-2.5 px-3 border-b-2 whitespace-nowrap transition cursor-pointer ${
            tab === 'redirects' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Redirects ({data.redirects?.length || 0})
        </button>
        <button
          onClick={() => setTab('dns')}
          className={`pb-2.5 px-3 border-b-2 whitespace-nowrap transition cursor-pointer ${
            tab === 'dns' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Zone Editor ({data.dnsRecords?.length || 0})
        </button>
        <button
          onClick={() => setTab('security')}
          className={`pb-2.5 px-3 border-b-2 whitespace-nowrap transition cursor-pointer ${
            tab === 'security' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Security & Privacy ({(data.directoryPrivacy?.length || 0) + (data.blockedIps?.length || 0)})
        </button>
        <button
          onClick={() => setTab('ftp')}
          className={`pb-2.5 px-3 border-b-2 whitespace-nowrap transition cursor-pointer ${
            tab === 'ftp' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          FTP Accounts ({data.ftpAccounts?.length || 0})
        </button>
      </div>

      {/* TAB 1: UNIFIED DOMAINS (cPanel Jupiter Standard) */}
      {tab === 'domains' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by domain name or document root..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#ff6c2c]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-[#ff6c2c]"
              >
                <option value="all">All Domain Types</option>
                <option value="primary">Primary Domain</option>
                <option value="addon">Addon Domain</option>
                <option value="subdomain">Subdomain</option>
                <option value="alias">Alias / Parked</option>
              </select>
            </div>
          </div>

          {/* Unified Domain Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-3 px-5">Domain</th>
                    <th className="py-3 px-5">Document Root</th>
                    <th className="py-3 px-5">Force HTTPS</th>
                    <th className="py-3 px-5">Redirects To</th>
                    <th className="py-3 px-5">SSL Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDomains.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400">
                        <Globe className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">No domains match your filter</p>
                        <p className="text-xs text-slate-400 mt-1">Click "Create a New Domain" to add an addon domain or subdomain.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredDomains.map((d) => (
                      <tr key={d.id || d.name} className="hover:bg-slate-50/70 transition">
                        {/* Domain & Type Badge */}
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2">
                            <a
                              href={`http${d.forceHttps || d.sslStatus?.includes('Valid') ? 's' : ''}://${d.name}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-slate-900 hover:text-[#ff6c2c] flex items-center gap-1 group"
                            >
                              <span>{d.name}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#ff6c2c]" />
                            </a>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              d.isPrimary 
                                ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                : d.type === 'Addon Domain'
                                ? 'bg-orange-50 text-[#ff6c2c] border border-orange-200'
                                : d.type === 'Subdomain'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-teal-50 text-teal-700 border border-teal-200'
                            }`}>
                              {d.type}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Engine: {d.phpVersion} • Status: <span className="text-emerald-600 font-medium">{d.status}</span>
                          </div>
                        </td>

                        {/* Document Root with Clickable File Manager Shortcut */}
                        <td className="py-3 px-5">
                          <button
                            onClick={() => handleOpenFileRoot(d.documentRoot)}
                            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-mono text-xs hover:underline cursor-pointer"
                            title="Open Document Root in File Manager"
                          >
                            <Folder className="w-3.5 h-3.5 text-amber-500" />
                            <span>/{d.documentRoot}</span>
                          </button>
                        </td>

                        {/* Force HTTPS Redirect Toggle */}
                        <td className="py-3 px-5">
                          <button
                            onClick={() => handleToggleForceHttps(d, d.forceHttps)}
                            disabled={actionLoading}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              d.forceHttps ? 'bg-[#ff6c2c]' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                d.forceHttps ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>

                        {/* Redirects To */}
                        <td className="py-3 px-5">
                          {d.redirectTarget ? (
                            <span className="font-mono text-emerald-700 text-[11px] flex items-center gap-1 truncate max-w-[150px]">
                              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                              {d.redirectTarget}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenManageModal(d)}
                              className="text-slate-400 hover:text-slate-600 text-[11px] underline cursor-pointer"
                            >
                              Not Redirected
                            </button>
                          )}
                        </td>

                        {/* SSL Status */}
                        <td className="py-3 px-5">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 w-fit ${
                            d.sslStatus?.includes('Valid')
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-amber-700 bg-amber-50 border-amber-200'
                          }`}>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{d.sslStatus || 'Pending AutoSSL'}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenManageModal(d)}
                              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded text-xs transition cursor-pointer shadow-sm"
                            >
                              Manage
                            </button>
                            <button
                              onClick={() => handleOpenFileRoot(d.documentRoot)}
                              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
                              title="File Manager"
                            >
                              <Folder className="w-4 h-4 text-amber-500" />
                            </button>
                            {!d.isPrimary && (
                              <button
                                onClick={() => handleOpenDeleteModal(d)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                title="Delete Domain"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
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
      )}

      {/* TAB 2: SUBDOMAINS (Legacy view compatibility) */}
      {tab === 'subdomains' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#ff6c2c]" /> Create a Subdomain
            </h2>
            <form onSubmit={handleAddSubdomain} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Subdomain Prefix:</label>
                <input
                  type="text"
                  value={subPrefix}
                  onChange={(e) => setSubPrefix(e.target.value)}
                  placeholder="shop"
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[#ff6c2c]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Select Domain:</label>
                <select
                  value={subDomainSelect}
                  onChange={(e) => setSubDomainSelect(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[#ff6c2c]"
                >
                  {data.domains?.map((d) => (
                    <option key={d.name} value={d.name}>.{d.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition h-[35px] cursor-pointer"
              >
                Create Subdomain
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-6">Subdomain</th>
                  <th className="py-3 px-6">Root Domain</th>
                  <th className="py-3 px-6">Document Root</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.subdomains?.map((s) => (
                  <tr key={s.name} className="hover:bg-slate-50">
                    <td className="py-3 px-6 font-semibold text-slate-800 font-mono">{s.name}</td>
                    <td className="py-3 px-6 text-slate-600">{s.domain}</td>
                    <td className="py-3 px-6 text-slate-600 font-mono">/{s.documentRoot}</td>
                    <td className="py-3 px-6 text-right">
                      <button
                        onClick={() => handleDeleteSubdomain(s.name)}
                        className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[11px] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ALIASES (PARKED DOMAINS) */}
      {tab === 'aliases' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-[#ff6c2c]" /> Create an Alias (Parked Domain)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Domain aliases allow you to point additional domain names to your existing website (e.g. <code>example.net</code> pointing directly to <code>example.com</code>).
            </p>
            <form onSubmit={handleAddAlias} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Alias Domain Name:</label>
                <input
                  type="text"
                  value={aliasName}
                  onChange={(e) => setAliasName(e.target.value)}
                  placeholder="example.net"
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[#ff6c2c]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target Website Domain:</label>
                <select
                  value={aliasTarget}
                  onChange={(e) => setAliasTarget(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                >
                  {data.domains?.map((d) => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition h-[35px] cursor-pointer"
              >
                Add Alias
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-6">Alias Domain</th>
                  <th className="py-3 px-6">Target Domain</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.aliases?.map((a) => (
                  <tr key={a.name} className="hover:bg-slate-50">
                    <td className="py-3 px-6 font-semibold text-slate-800 font-mono flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-teal-600" /> {a.name}
                    </td>
                    <td className="py-3 px-6 font-mono text-slate-600">{a.targetDomain}</td>
                    <td className="py-3 px-6">
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-200">
                        Active
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        onClick={() => handleDeleteAlias(a.name)}
                        className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[11px] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: REDIRECTS */}
      {tab === 'redirects' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#ff6c2c]" /> Add Redirect
            </h2>
            <form onSubmit={handleAddRedirect} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Type:</label>
                <select
                  value={redirType}
                  onChange={(e) => setRedirType(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                >
                  <option value="301 Permanent">301 Permanent</option>
                  <option value="302 Temporary">302 Temporary</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Source URL Path:</label>
                <input
                  type="text"
                  value={redirSource}
                  onChange={(e) => setRedirSource(e.target.value)}
                  placeholder="example.com/old-link"
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Destination URL:</label>
                <input
                  type="text"
                  value={redirDest}
                  onChange={(e) => setRedirDest(e.target.value)}
                  placeholder="https://example.com/new-link"
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition h-[35px] cursor-pointer"
              >
                Add Redirect
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-6">Type</th>
                  <th className="py-3 px-6">Source URL</th>
                  <th className="py-3 px-6">Destination URL</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.redirects?.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-3 px-6 font-semibold text-blue-600">{r.type}</td>
                    <td className="py-3 px-6 font-mono text-slate-700">{r.sourceUrl}</td>
                    <td className="py-3 px-6 font-mono text-emerald-700 flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" /> {r.destUrl}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        onClick={() => handleDeleteRedirect(r.sourceUrl)}
                        className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[11px] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: ZONE EDITOR (DNS) */}
      {tab === 'dns' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#ff6c2c]" /> Add a DNS Record
            </h2>
            <form onSubmit={handleAddDns} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Name (Host):</label>
                <input
                  type="text"
                  value={dnsName}
                  onChange={(e) => setDnsName(e.target.value)}
                  placeholder="api.example.com."
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">TTL (Seconds):</label>
                <input
                  type="number"
                  value={dnsTtl}
                  onChange={(e) => setDnsTtl(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Type:</label>
                <select
                  value={dnsType}
                  onChange={(e) => setDnsType(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                >
                  <option value="A">A (IPv4)</option>
                  <option value="AAAA">AAAA (IPv6)</option>
                  <option value="CNAME">CNAME (Alias)</option>
                  <option value="MX">MX (Mail Exchange)</option>
                  <option value="TXT">TXT (Text/SPF/DKIM)</option>
                  <option value="SRV">SRV (Service)</option>
                  <option value="CAA">CAA (Certificate Authority)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Record (Value):</label>
                <input
                  type="text"
                  value={dnsRecord}
                  onChange={(e) => setDnsRecord(e.target.value)}
                  placeholder="192.0.2.1"
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>
              {(dnsType === 'MX' || dnsType === 'SRV') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Priority:</label>
                  <input
                    type="number"
                    value={dnsPriority}
                    onChange={(e) => setDnsPriority(e.target.value)}
                    className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                  />
                </div>
              )}
              <button
                type="submit"
                className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition h-[35px] cursor-pointer"
              >
                Add Record
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-6">Name</th>
                  <th className="py-3 px-6">TTL</th>
                  <th className="py-3 px-6">Class</th>
                  <th className="py-3 px-6">Type</th>
                  <th className="py-3 px-6">Record</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {data.dnsRecords?.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="py-3 px-6 text-slate-800 font-semibold">{rec.name}</td>
                    <td className="py-3 px-6 text-slate-600">{rec.ttl}</td>
                    <td className="py-3 px-6 text-slate-500">IN</td>
                    <td className="py-3 px-6">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-bold border border-blue-200">
                        {rec.type}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-slate-700 truncate max-w-xs">{rec.record}</td>
                    <td className="py-3 px-6 text-right font-sans">
                      <button
                        onClick={() => handleDeleteDns(rec.id)}
                        className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[11px] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: SECURITY & PRIVACY */}
      {tab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Directory Privacy */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#ff6c2c]" /> Directory Privacy (.htpasswd)
            </h2>
            <form onSubmit={handleSetDirectoryPrivacy} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Directory to Protect:</label>
                <input
                  type="text"
                  value={dpPath}
                  onChange={(e) => setDpPath(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Username:</label>
                  <input
                    type="text"
                    value={dpUser}
                    onChange={(e) => setDpUser(e.target.value)}
                    className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Password:</label>
                  <input
                    type="password"
                    value={dpPass}
                    onChange={(e) => setDpPass(e.target.value)}
                    className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold py-2 rounded-lg shadow transition cursor-pointer"
              >
                Protect Directory
              </button>
            </form>

            <div className="border-t border-slate-100 pt-3">
              <h3 className="text-xs font-bold text-slate-700 mb-2">Protected Directories:</h3>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {data.directoryPrivacy?.map((dp, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded text-xs">
                    <span className="font-mono text-slate-800">/{dp.dirPath} ({dp.user})</span>
                    <button
                      onClick={() => handleRemoveDirectoryPrivacy(dp.dirPath)}
                      className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* IP Blocker & Hotlink */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-[#ff6c2c]" /> IP Blocker
              </h2>
              <form onSubmit={handleBlockIp} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">IP Address or Range:</label>
                  <input
                    type="text"
                    value={blockIpInput}
                    onChange={(e) => setBlockIpInput(e.target.value)}
                    placeholder="192.168.1.50"
                    className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition h-[35px] cursor-pointer"
                >
                  Block IP
                </button>
              </form>

              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {data.blockedIps?.map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded text-xs">
                    <span className="font-mono text-rose-700 font-semibold">{b.ip}</span>
                    <button
                      onClick={() => handleUnblockIp(b.ip)}
                      className="text-slate-500 hover:text-slate-800 text-[11px] cursor-pointer"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600" /> Hotlink Protection
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Prevent external sites from bandwidth leeching images.
                </p>
              </div>
              <button
                onClick={handleToggleHotlink}
                className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer shadow transition ${
                  data.hotlinkProtection?.enabled
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {data.hotlinkProtection?.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: FTP ACCOUNTS */}
      {tab === 'ftp' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#ff6c2c]" /> Create FTP Account
            </h2>
            <form onSubmit={handleAddFtp} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Login:</label>
                <div className="flex">
                  <input
                    type="text"
                    value={ftpUser}
                    onChange={(e) => setFtpUser(e.target.value)}
                    placeholder="webmaster"
                    className="w-full border border-r-0 border-slate-300 px-3 py-2 text-xs rounded-l-lg focus:outline-none"
                  />
                  <span className="bg-slate-100 border border-slate-300 px-2 py-2 text-xs text-slate-500 rounded-r-lg font-mono">
                    @{ftpDomain}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Password:</label>
                <input
                  type="password"
                  value={ftpPass}
                  onChange={(e) => setFtpPass(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Directory:</label>
                <input
                  type="text"
                  value={ftpDir}
                  onChange={(e) => setFtpDir(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none font-mono"
                />
              </div>
              <button
                type="submit"
                className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition h-[35px] cursor-pointer"
              >
                Create Account
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-6">Login</th>
                  <th className="py-3 px-6">Path</th>
                  <th className="py-3 px-6">Quota</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.ftpAccounts?.map((f) => (
                  <tr key={f.user} className="hover:bg-slate-50">
                    <td className="py-3 px-6 font-semibold text-slate-800 font-mono">{f.user}</td>
                    <td className="py-3 px-6 text-slate-600 font-mono">/{f.dir}</td>
                    <td className="py-3 px-6 text-slate-600">{f.quota}</td>
                    <td className="py-3 px-6 text-right">
                      <button
                        onClick={() => handleDeleteFtp(f.user)}
                        className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[11px] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE DOMAIN MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#ff6c2c]" />
                Create a New Domain
              </h2>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDomainSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Domain Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. newsite.com or blog.mybrand.org"
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-[#ff6c2c]"
                  required
                />
                {checkingName && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Verifying domain syntax...
                  </p>
                )}
                {checkResult && (
                  <div className={`mt-1.5 p-2 rounded text-xs font-medium flex items-start gap-1.5 ${
                    checkResult.valid ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                  }`}>
                    {checkResult.valid ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />}
                    <span>{checkResult.message}</span>
                  </div>
                )}
              </div>

              {/* Document Root Sharing / Custom Path */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareDocRoot}
                    onChange={(e) => setShareDocRoot(e.target.checked)}
                    className="rounded text-[#ff6c2c] focus:ring-[#ff6c2c]"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Share document root (<code>public_html</code>) with primary domain
                  </span>
                </label>

                {!shareDocRoot && (
                  <div className="pl-6 pt-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Document Root Directory:
                    </label>
                    <div className="flex items-center">
                      <span className="bg-slate-100 border border-r-0 border-slate-300 px-3 py-2 text-xs text-slate-500 rounded-l-lg font-mono">
                        /
                      </span>
                      <input
                        type="text"
                        value={newDocRoot}
                        onChange={(e) => setNewDocRoot(e.target.value)}
                        placeholder="public_html/newsite.com"
                        className="w-full border border-slate-300 px-3 py-2 text-xs rounded-r-lg font-mono focus:outline-none focus:border-[#ff6c2c]"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Files for this domain will be hosted in this account directory.
                    </p>
                  </div>
                )}
              </div>

              {/* Force HTTPS Toggle Option */}
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-slate-800 block">
                    Force HTTPS Redirection
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Automatically redirect HTTP visitors to HTTPS.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setNewForceHttps(!newForceHttps)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    newForceHttps ? 'bg-[#ff6c2c]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      newForceHttps ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Automatic DNS & AutoSSL Provisioning
                </div>
                <p className="text-[11px]">
                  cPanel will automatically configure local DNS A/CNAME records and schedule AutoSSL certificate issuance for this domain.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || (checkResult && !checkResult.valid)}
                  className="px-5 py-2 bg-[#ff6c2c] hover:bg-[#e05819] text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                >
                  {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE DOMAIN MODAL / DRAWER */}
      {manageModalOpen && selectedDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#ff6c2c]" />
                  Manage Domain: <span className="text-[#ff6c2c]">{selectedDomain.name}</span>
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold">{selectedDomain.type}</span> •
                  <span>Engine: {selectedDomain.phpVersion}</span> •
                  <span className="text-emerald-600 font-semibold">{selectedDomain.sslStatus}</span>
                </div>
              </div>
              <button
                onClick={() => setManageModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManageConfig} className="p-5 space-y-4">
              {/* Document Root */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Document Root Directory
                </label>
                <div className="flex items-center">
                  <span className="bg-slate-100 border border-r-0 border-slate-300 px-3 py-2 text-xs text-slate-500 rounded-l-lg font-mono">
                    /
                  </span>
                  <input
                    type="text"
                    value={editDocRoot}
                    onChange={(e) => setEditDocRoot(e.target.value)}
                    className="w-full border border-slate-300 px-3 py-2 text-xs rounded-r-lg font-mono focus:outline-none focus:border-[#ff6c2c]"
                    required
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Relative to account home directory.</span>
                  <button
                    type="button"
                    onClick={() => handleOpenFileRoot(editDocRoot)}
                    className="text-blue-600 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Folder className="w-3 h-3 text-amber-500" /> Open in File Manager
                  </button>
                </div>
              </div>

              {/* Force HTTPS */}
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 block">
                    Force HTTPS Redirection
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Enforce secure SSL/TLS connections for all incoming web requests.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditForceHttps(!editForceHttps)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    editForceHttps ? 'bg-[#ff6c2c]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      editForceHttps ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Redirection Configuration */}
              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Domain Redirection Target (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. https://destination-site.com"
                  value={editRedirectTarget}
                  onChange={(e) => setEditRedirectTarget(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg font-mono focus:outline-none focus:border-[#ff6c2c]"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Leave blank to disable domain forwarding and serve files directly.
                </p>
              </div>

              {/* Quick Jump Shortcuts */}
              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Additional Domain Tools
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setManageModalOpen(false);
                      setTab('dns');
                    }}
                    className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left text-xs transition cursor-pointer"
                  >
                    <div className="font-semibold text-slate-800 flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-blue-600" /> Zone Editor
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Manage DNS records</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setManageModalOpen(false);
                      if (onNavigate) onNavigate('ssl');
                    }}
                    className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left text-xs transition cursor-pointer"
                  >
                    <div className="font-semibold text-slate-800 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> SSL/TLS Status
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Certificates & AutoSSL</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setManageModalOpen(false);
                      if (onNavigate) onNavigate('email');
                    }}
                    className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left text-xs transition cursor-pointer"
                  >
                    <div className="font-semibold text-slate-800 flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5 text-[#ff6c2c]" /> Email Accounts
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Mailboxes & Webmail</div>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div>
                  {!selectedDomain.isPrimary && (
                    <button
                      type="button"
                      onClick={() => {
                        setManageModalOpen(false);
                        handleOpenDeleteModal(selectedDomain);
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                    >
                      Remove Domain...
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setManageModalOpen(false)}
                    disabled={actionLoading}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-[#ff6c2c] hover:bg-[#e05819] text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                  >
                    {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Update</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && selectedDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-rose-50/50 flex items-center justify-between">
              <h2 className="text-base font-bold text-rose-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Remove Domain: {selectedDomain.name}
              </h2>
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to remove the domain <strong>{selectedDomain.name}</strong> from your hosting account?
              </p>

              {preDeleteInfo && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs text-slate-700">
                  <div className="font-bold text-slate-900">Resource Impact Summary:</div>
                  <div className="flex justify-between">
                    <span>Domain Type:</span>
                    <span className="font-semibold">{preDeleteInfo.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Document Root:</span>
                    <span className="font-mono text-slate-900">/{preDeleteInfo.documentRoot}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Associated DNS Records:</span>
                    <span className="font-semibold">{preDeleteInfo.dnsRecordCount} record(s)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Associated Subdomains:</span>
                    <span className="font-semibold">{preDeleteInfo.subdomainCount} subdomain(s)</span>
                  </div>
                </div>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                <strong>Safety Notice:</strong> Removing the domain unlinks the virtual host configuration and DNS records. Your directory files will remain safely stored on disk unless manually removed.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                >
                  {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Yes, Remove Domain</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
