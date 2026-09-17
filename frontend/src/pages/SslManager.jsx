import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import {
  ShieldCheck,
  Play,
  Lock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Key,
  FileText,
  Search,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Copy,
  Check,
  Trash2,
  Activity,
  Info,
  Sliders,
  HelpCircle,
  Download
} from 'lucide-react';

export default function SslManager({ onBack, onNavigate, user = 'cpanel_user' }) {
  const [capabilities, setCapabilities] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory', 'install', 'csr', 'autossl'
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  // Modals state
  const [detailsModal, setDetailsModal] = useState(null);
  const [tlsModal, setTlsModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [generatedCsr, setGeneratedCsr] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');

  // Install Form state
  const [installDomain, setInstallDomain] = useState('');
  const [installCert, setInstallCert] = useState('');
  const [installKey, setInstallKey] = useState('');
  const [installBundle, setInstallBundle] = useState('');

  // CSR Form state
  const [csrDomain, setCsrDomain] = useState('');
  const [csrKeySize, setCsrKeySize] = useState('2048');
  const [csrOrg, setCsrOrg] = useState('');
  const [csrCountry, setCsrCountry] = useState('US');
  const [csrState, setCsrState] = useState('');
  const [csrCity, setCsrCity] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [capRes, invRes] = await Promise.all([
        api.getSslCapabilities(),
        api.getSslInventory(user)
      ]);
      setCapabilities(capRes);
      setInventory(invRes);
      if (invRes.authorizedDomains && invRes.authorizedDomains.length > 0) {
        if (!installDomain) setInstallDomain(invRes.authorizedDomains[0]);
        if (!csrDomain) setCsrDomain(invRes.authorizedDomains[0]);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load SSL inventory.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 6000);
  };

  const handleCopy = (text, key) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2500);
    }
  };

  // Run AutoSSL
  const handleRunAutoSsl = async () => {
    setActionLoading(true);
    try {
      const res = await api.runAutoSsl(user);
      showFeedback('success', res.message || 'AutoSSL completed successfully.');
      await loadData();
    } catch (err) {
      showFeedback('error', err.message || 'AutoSSL run failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Force HTTPS
  const handleToggleHttps = async (e) => {
    const checked = e.target.checked;
    try {
      await api.toggleForceHttps(checked);
      setInventory(prev => prev ? { ...prev, forceHttps: checked } : prev);
      showFeedback('success', `Force HTTPS Redirection ${checked ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      showFeedback('error', err.message || 'Failed to toggle Force HTTPS.');
    }
  };

  // View Details
  const handleViewDetails = async (domain, certId) => {
    setActionLoading(true);
    try {
      const details = await api.getSslDetails(domain, certId, user);
      setDetailsModal(details);
    } catch (err) {
      showFeedback('error', err.message || 'Failed to fetch certificate details.');
    } finally {
      setActionLoading(false);
    }
  };

  // Verify Live TLS
  const handleVerifyTls = async (domain) => {
    setActionLoading(true);
    try {
      const result = await api.verifySslTls(domain, user);
      setTlsModal(result);
    } catch (err) {
      showFeedback('error', err.message || 'Live TLS verification failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Renew single certificate
  const handleRenewCert = async (domain) => {
    setActionLoading(true);
    try {
      const res = await api.renewSslCertificate(domain, user);
      showFeedback('success', res.message || `Certificate renewed for "${domain}".`);
      await loadData();
    } catch (err) {
      showFeedback('error', err.message || 'Certificate renewal failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Uninstall/Remove Certificate
  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    setActionLoading(true);
    try {
      const res = await api.removeSslCertificate(deleteModal.domain, deleteModal.id, user);
      showFeedback('success', res.message || 'Certificate uninstalled.');
      setDeleteModal(null);
      await loadData();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to uninstall certificate.');
    } finally {
      setActionLoading(false);
    }
  };

  // Install Certificate Submit
  const handleInstallSubmit = async (e) => {
    e.preventDefault();
    if (!installDomain || !installCert || !installKey) {
      showFeedback('error', 'Please provide target domain, certificate PEM, and private key PEM.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.installSslCertificate({
        cpanelUser: user,
        domain: installDomain,
        certPem: installCert,
        keyPem: installKey,
        caBundle: installBundle
      });
      showFeedback('success', res.message || 'Certificate installed successfully.');
      setInstallCert('');
      setInstallKey('');
      setInstallBundle('');
      setActiveTab('inventory');
      await loadData();
    } catch (err) {
      showFeedback('error', err.message || 'Certificate installation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Generate CSR Submit
  const handleGenerateCsrSubmit = async (e) => {
    e.preventDefault();
    if (!csrDomain) {
      showFeedback('error', 'Please select a domain for the CSR.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.generateSslCsr({
        cpanelUser: user,
        domain: csrDomain,
        organization: csrOrg,
        country: csrCountry,
        state: csrState,
        locality: csrCity,
        keyBits: csrKeySize
      });
      setGeneratedCsr(res);
      showFeedback('success', res.message || 'CSR generated successfully.');
    } catch (err) {
      showFeedback('error', err.message || 'CSR generation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Certificates
  const filteredCerts = useMemo(() => {
    if (!inventory?.certificates) return [];
    if (!searchTerm.trim()) return inventory.certificates;
    const q = searchTerm.toLowerCase();
    return inventory.certificates.filter(c =>
      c.domain.toLowerCase().includes(q) ||
      (c.issuer && c.issuer.toLowerCase().includes(q)) ||
      (c.status && c.status.toLowerCase().includes(q)) ||
      (c.sans && c.sans.some(s => s.toLowerCase().includes(q)))
    );
  }, [inventory, searchTerm]);

  // Status counters
  const stats = useMemo(() => {
    if (!inventory?.certificates) return { total: 0, active: 0, warning: 0, uninstalled: 0 };
    let active = 0, warning = 0, uninstalled = 0;
    inventory.certificates.forEach(c => {
      if (c.status === 'Active (Valid)') active++;
      else if (c.status === 'Expiring Soon' || c.status === 'Expired') warning++;
      else uninstalled++;
    });
    return {
      total: inventory.certificates.length,
      active,
      warning,
      uninstalled
    };
  }, [inventory]);

  if (loading && !inventory) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
        <span className="text-sm font-medium text-slate-600">Loading SSL/TLS Certificate inventory...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
          <button
            onClick={() => onBack ? onBack() : onNavigate?.('dashboard')}
            className="hover:text-slate-900 transition flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <span>/</span>
          <span className="text-slate-400">Security</span>
          <span>/</span>
          <span className="text-slate-900 font-semibold">SSL/TLS Certificates</span>
        </div>

        {/* Global Force HTTPS Switch */}
        {inventory && (
          <div className="flex items-center space-x-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-xs">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold text-slate-700">Force HTTPS:</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={inventory.forceHttps}
                onChange={handleToggleHttps}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
            <span className={`text-[11px] font-bold ${inventory.forceHttps ? 'text-emerald-600' : 'text-slate-400'}`}>
              {inventory.forceHttps ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        )}
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            SSL/TLS Certificates & Status
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 max-w-2xl">
            Inspect real X.509 certificates, generate CSR signing requests, install manual SSL keypairs, and maintain automated Let's Encrypt protection for all domains in your account.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunAutoSsl}
            disabled={actionLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
            {actionLoading ? 'Provisioning...' : 'Run AutoSSL'}
          </button>
          <button
            onClick={loadData}
            disabled={loading || actionLoading}
            className="border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2.5 rounded-lg shadow-sm flex items-center gap-1.5 transition"
            title="Refresh Inventory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between animate-fade ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 ml-4">✕</button>
        </div>
      )}

      {/* Truthful Server Capabilities Banner */}
      {capabilities && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-600 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-800">Crypto Engine:</span> {capabilities.tlsEngine} •{' '}
              <span className="font-semibold text-slate-800">Server:</span> {capabilities.webServer}
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Let's Encrypt (AutoSSL)
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> HTTP-01 / DNS-01
            </span>
            <span className="inline-flex items-center gap-1" title={capabilities.serverFirewallNotice}>
              <Info className="w-3.5 h-3.5 text-slate-400" /> Server Policy Managed
            </span>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Authorized Domains</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Account Domains Monitored</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Active & Valid</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{stats.active}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Cryptographically Secured</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Expiring / Expired</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{stats.warning}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">&le; 15 Days or Lapsed</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unassigned / Pending</div>
          <div className="text-2xl font-black text-slate-700 mt-1">{stats.uninstalled}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Awaiting Certificate</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex space-x-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'inventory'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Certificates on Server ({stats.total})
        </button>
        <button
          onClick={() => setActiveTab('install')}
          className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'install'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" /> Install & Manage SSL (Manual)
        </button>
        <button
          onClick={() => setActiveTab('csr')}
          className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'csr'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Key className="w-4 h-4" /> Generate CSR (Signing Request)
        </button>
        <button
          onClick={() => setActiveTab('autossl')}
          className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'autossl'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" /> AutoSSL Logs & Activity
        </button>
      </div>

      {/* TAB 1: CERTIFICATES INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter domains, issuers..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Showing {filteredCerts.length} of {inventory.certificates.length} domains
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3.5 px-5">Domain & SANs</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Issuer</th>
                  <th className="py-3.5 px-5">Expiration & Validity</th>
                  <th className="py-3.5 px-5">Key Spec</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCerts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-500">
                      No matching SSL certificates found.
                    </td>
                  </tr>
                ) : (
                  filteredCerts.map((cert) => {
                    const isExpiring = cert.daysRemaining !== null && cert.daysRemaining <= 15 && cert.daysRemaining >= 0;
                    const isExpired = cert.daysRemaining !== null && cert.daysRemaining < 0;
                    const isActive = cert.status === 'Active (Valid)';

                    return (
                      <tr key={cert.domain} className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Lock className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                            {cert.domain}
                          </div>
                          {cert.sans && cert.sans.length > 0 && (
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5 line-clamp-1" title={cert.sans.join(', ')}>
                              SANs: {cert.sans.join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-5">
                          {isActive && (
                            <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-emerald-200 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Active (Valid)
                            </span>
                          )}
                          {isExpiring && (
                            <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-amber-200 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Expiring ({cert.daysRemaining}d)
                            </span>
                          )}
                          {isExpired && (
                            <span className="bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-rose-200 inline-flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> Expired
                            </span>
                          )}
                          {cert.status === 'Not Installed' && (
                            <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200 inline-flex items-center gap-1">
                              Not Installed
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-slate-700 font-medium">
                          {cert.issuer || 'None'}
                        </td>
                        <td className="py-3.5 px-5">
                          {cert.expires !== 'N/A' ? (
                            <div>
                              <span className="font-mono text-slate-800 font-medium">{cert.expires}</span>
                              {cert.daysRemaining !== null && (
                                <div className={`text-[10px] mt-0.5 font-semibold ${
                                  isExpired ? 'text-rose-600' : isExpiring ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                  {isExpired ? 'Expired' : `${cert.daysRemaining} days remaining`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-slate-600 text-[11px]">
                          {cert.keySize || 'None'}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {cert.isInstalled && (
                              <button
                                onClick={() => handleViewDetails(cert.domain, cert.id)}
                                className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded shadow-xs transition"
                                title="Certificate Details (X.509)"
                              >
                                Details
                              </button>
                            )}
                            <button
                              onClick={() => handleVerifyTls(cert.domain)}
                              className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded shadow-xs transition"
                              title="Verify live TLS socket on port 443"
                            >
                              Verify TLS
                            </button>
                            <button
                              onClick={() => handleRenewCert(cert.domain)}
                              className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded shadow-xs transition"
                              title="Renew certificate for 90 days"
                            >
                              Renew
                            </button>
                            {cert.isInstalled && (
                              <button
                                onClick={() => setDeleteModal(cert)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                                title="Uninstall Certificate"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INSTALL & MANAGE SSL */}
      {activeTab === 'install' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 max-w-4xl space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Install an SSL Certificate on a Domain
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Paste your Certificate (CRT) and Private Key (KEY). The system will cryptographically verify that the private key matches the certificate before applying changes.
            </p>
          </div>

          <form onSubmit={handleInstallSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Domain <span className="text-rose-500">*</span>
              </label>
              <select
                value={installDomain}
                onChange={(e) => setInstallDomain(e.target.value)}
                className="w-full sm:w-80 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                required
              >
                {inventory.authorizedDomains.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 block mt-1">Select an authorized domain from your account.</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Certificate: (CRT) <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={6}
                value={installCert}
                onChange={(e) => setInstallCert(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Private Key: (KEY) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Securely stored outside public_html
                </span>
              </div>
              <textarea
                rows={6}
                value={installKey}
                onChange={(e) => setInstallKey(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Certificate Authority Bundle: (CABUNDLE) <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={4}
                value={installBundle}
                onChange={(e) => setInstallBundle(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                {actionLoading ? 'Verifying & Installing...' : 'Install Certificate'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setInstallCert('');
                  setInstallKey('');
                  setInstallBundle('');
                }}
                className="border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-semibold px-4 py-2.5 rounded-lg transition"
              >
                Clear Form
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: GENERATE CSR */}
      {activeTab === 'csr' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 max-w-4xl space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-600" />
              Generate a Certificate Signing Request (CSR)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Create a PKCS#10 Certificate Signing Request to purchase or request an SSL certificate from an external Certificate Authority.
            </p>
          </div>

          <form onSubmit={handleGenerateCsrSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Domain <span className="text-rose-500">*</span>
                </label>
                <select
                  value={csrDomain}
                  onChange={(e) => setCsrDomain(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                  required
                >
                  {inventory.authorizedDomains.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Key Size</label>
                <select
                  value={csrKeySize}
                  onChange={(e) => setCsrKeySize(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                >
                  <option value="2048">2048 bits (Standard / Recommended)</option>
                  <option value="4096">4096 bits (High Security)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Organization</label>
                <input
                  type="text"
                  value={csrOrg}
                  onChange={(e) => setCsrOrg(e.target.value)}
                  placeholder="e.g. My Company, Inc."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Country (2-Letter Code)</label>
                <input
                  type="text"
                  maxLength={2}
                  value={csrCountry}
                  onChange={(e) => setCsrCountry(e.target.value.toUpperCase())}
                  placeholder="US"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">State / Province</label>
                <input
                  type="text"
                  value={csrState}
                  onChange={(e) => setCsrState(e.target.value)}
                  placeholder="e.g. California"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">City / Locality</label>
                <input
                  type="text"
                  value={csrCity}
                  onChange={(e) => setCsrCity(e.target.value)}
                  placeholder="e.g. San Francisco"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition disabled:opacity-50"
              >
                <Key className="w-3.5 h-3.5" />
                {actionLoading ? 'Generating Keypair & CSR...' : 'Generate CSR'}
              </button>
            </div>
          </form>

          {/* Generated CSR Display Card */}
          {generatedCsr && (
            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Generated CSR for "{generatedCsr.domain}"</span>
                <button
                  onClick={() => handleCopy(generatedCsr.csrPem, 'csr')}
                  className="text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded flex items-center gap-1 transition"
                >
                  {copiedKey === 'csr' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'csr' ? 'Copied!' : 'Copy CSR'}
                </button>
              </div>
              <textarea
                readOnly
                rows={7}
                value={generatedCsr.csrPem}
                className="w-full p-2.5 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-700 select-all"
              />
              <div className="text-[11px] text-slate-500">
                The private key has been generated and stored safely in your account's secure key storage. Submit this CSR to your SSL provider to issue your certificate.
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AUTOSSL ACTIVITY LOGS */}
      {activeTab === 'autossl' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">AutoSSL Engine Activity Logs</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time validation events and automatic renewal transactions with Let's Encrypt.
              </p>
            </div>
            <button
              onClick={handleRunAutoSsl}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" /> Run AutoSSL Check
            </button>
          </div>

          <div className="bg-slate-950 text-slate-300 font-mono text-xs p-4 rounded-xl max-h-80 overflow-y-auto space-y-2 border border-slate-800 shadow-inner">
            {inventory.logs && inventory.logs.length > 0 ? (
              inventory.logs.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-500 select-none">[{new Date(l.timestamp).toLocaleTimeString()}]</span>
                  <span className="text-emerald-400">{l.message}</span>
                </div>
              ))
            ) : (
              <div className="text-slate-500 italic">No AutoSSL activity recorded yet.</div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CERTIFICATE DETAILS */}
      {detailsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto animate-fade">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Certificate Details: {detailsModal.domain}</h3>
              </div>
              <button
                onClick={() => setDetailsModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Subject</div>
                <div className="font-semibold text-slate-800 mt-0.5 whitespace-pre-wrap">{detailsModal.subject}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Issuer</div>
                <div className="font-semibold text-slate-800 mt-0.5">{detailsModal.issuer}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Validity Period</div>
                <div className="text-slate-700 mt-0.5">
                  From: <span className="font-mono">{detailsModal.validFrom.split('T')[0]}</span><br />
                  Until: <span className="font-mono">{detailsModal.validTo.split('T')[0]}</span> ({detailsModal.daysRemaining} days remaining)
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Key Specification</div>
                <div className="font-semibold text-slate-800 mt-0.5">{detailsModal.keySize} ({detailsModal.keyAlgorithm})</div>
                <div className="text-[11px] text-slate-500">Sig: {detailsModal.signatureAlgorithm}</div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-2">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Serial Number</div>
                <div className="font-mono text-slate-700 text-[11px] break-all">{detailsModal.serialNumber}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">SHA-256 Fingerprint</div>
                <div className="font-mono text-slate-700 text-[11px] break-all">{detailsModal.fingerprint256}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Subject Alternative Names (SANs)</div>
                <div className="font-mono text-slate-700 text-[11px]">{detailsModal.sans?.join(', ')}</div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-600 uppercase">Public Certificate PEM</span>
                <button
                  onClick={() => handleCopy(detailsModal.certificatePem, 'certModal')}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  {copiedKey === 'certModal' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedKey === 'certModal' ? 'Copied' : 'Copy PEM'}
                </button>
              </div>
              <textarea
                readOnly
                rows={5}
                value={detailsModal.certificatePem}
                className="w-full p-2 text-[11px] font-mono bg-slate-900 text-slate-300 rounded-lg select-all"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailsModal(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LIVE TLS VERIFICATION */}
      {tlsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-fade">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Live TLS Status: {tlsModal.domain}</h3>
              </div>
              <button onClick={() => setTlsModal(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Connection Status:</span>
                <span className={`font-bold ${tlsModal.success ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {tlsModal.status}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Negotiated Protocol:</span>
                  <span className="font-mono font-bold text-slate-800">{tlsModal.protocol || 'TLSv1.3'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cipher Suite:</span>
                  <span className="font-mono text-slate-800 text-[11px]">{tlsModal.cipher || 'TLS_AES_256_GCM_SHA384'}</span>
                </div>
                {tlsModal.issuer && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Active Issuer:</span>
                    <span className="font-semibold text-slate-800">{tlsModal.issuer}</span>
                  </div>
                )}
                {tlsModal.validTo && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expires:</span>
                    <span className="font-mono text-slate-800">{tlsModal.validTo}</span>
                  </div>
                )}
              </div>
              <div className="text-[11px] text-slate-400 text-center">
                Verified at: {new Date(tlsModal.verifiedAt).toLocaleTimeString()}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setTlsModal(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE / UNINSTALL CONFIRMATION */}
      {deleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-fade">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Uninstall SSL Certificate?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to uninstall the SSL certificate for <strong className="text-slate-800">{deleteModal.domain}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs">
              <strong>Warning:</strong> Traffic to this domain will show browser security warnings until a new certificate is issued or installed.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {actionLoading ? 'Uninstalling...' : 'Yes, Uninstall Certificate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
