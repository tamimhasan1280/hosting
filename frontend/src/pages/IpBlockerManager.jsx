import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  Filter,
  Globe,
  HelpCircle,
  Info,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
  Zap
} from 'lucide-react';
import { api } from '../services/api';

export default function IpBlockerManager({ onBack, onNavigate, user }) {
  const cpanelUser = user || 'cpanel_user';

  // Data state
  const [blockedIps, setBlockedIps] = useState([]);
  const [capabilities, setCapabilities] = useState(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Form input
  const [inputIp, setInputIp] = useState('');

  // Modals
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [selectedIpRecord, setSelectedIpRecord] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testIpInput, setTestIpInput] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testingAccess, setTestingAccess] = useState(false);

  // Load blocked IPs & capabilities
  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setErrorMessage(null);

    try {
      const [capsRes, listRes] = await Promise.all([
        api.getIpBlockerCapabilities().catch(e => ({ success: false, error: e.message })),
        api.getBlockedIps(cpanelUser).catch(e => ({ success: false, error: e.message, blockedIps: [] }))
      ]);

      if (capsRes && capsRes.success) {
        setCapabilities(capsRes);
      }
      if (listRes && listRes.success) {
        setBlockedIps(listRes.blockedIps || []);
      } else {
        setErrorMessage(listRes?.error || 'Failed to load blocked IP addresses.');
      }
    } catch (err) {
      console.error('Error loading IP blocker data:', err);
      setErrorMessage(err.message || 'Error communicating with IP Blocker API.');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [cpanelUser]);

  // Handle Add Block
  const handleAddBlock = async (e) => {
    e.preventDefault();
    const trimmed = inputIp.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.addBlockedIp({ cpanelUser, ip: trimmed });
      if (res && res.success) {
        setSuccessMessage(`IP address ${res.record.ip} successfully blocked in .htaccess.`);
        setInputIp('');
        await loadData();
      } else {
        setErrorMessage(res?.error || 'Failed to block IP address.');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message || 'Error adding IP block.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Unblock
  const handleUnblock = async () => {
    if (!selectedIpRecord) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await api.removeBlockedIp({
        cpanelUser,
        ip: selectedIpRecord.ip,
        recordId: selectedIpRecord.id
      });

      if (res && res.success) {
        setShowUnblockModal(false);
        setSuccessMessage(`IP address ${selectedIpRecord.ip} has been unblocked.`);
        setSelectedIpRecord(null);
        await loadData();
      } else {
        setErrorMessage(res?.error || 'Failed to unblock IP address.');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message || 'Error unblocking IP.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Sync
  const handleSync = async () => {
    setSyncing(true);
    setErrorMessage(null);
    try {
      const res = await api.syncIpBlocker({ cpanelUser });
      if (res && res.success) {
        setSuccessMessage(`Synchronized ${res.syncedCount} IP rule(s) with .htaccess.`);
        await loadData();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error syncing with .htaccess.');
    } finally {
      setSyncing(false);
    }
  };

  // Handle Test Access Simulation
  const handleRunTestAccess = async (ipToTest) => {
    const targetIp = ipToTest || testIpInput;
    if (!targetIp) return;

    setTestingAccess(true);
    setTestResult(null);

    try {
      const res = await api.verifyIpAccess({ user: cpanelUser, ip: targetIp.trim() });
      if (res && res.success) {
        setTestResult(res);
      }
    } catch (err) {
      setTestResult({
        allowed: true,
        httpStatus: 200,
        reason: 'Error conducting access test: ' + (err.message || 'Unknown')
      });
    } finally {
      setTestingAccess(false);
    }
  };

  // Filtered IP List
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return blockedIps;
    const q = searchQuery.toLowerCase();
    return blockedIps.filter(item =>
      item.ip.toLowerCase().includes(q) ||
      item.version.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q)
    );
  }, [blockedIps, searchQuery]);

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-24">
          <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          <p className="text-slate-600 font-medium">Loading account .htaccess access-control rules...</p>
        </div>
      </div>
    );
  }

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
              <span className="text-slate-700 font-medium">Security</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-slate-900 font-semibold">IP Blocker</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">IP Blocker</h1>
                <p className="text-sm text-slate-500">
                  Block specific IP addresses or subnets from accessing your websites and hosting resources.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 transition-colors shadow-sm"
              title="Synchronize rules directly with public_html/.htaccess"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-blue-600' : ''}`} />
              Sync .htaccess
            </button>
            <button
              onClick={() => loadData(true)}
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

        {/* CAPABILITY & SECURITY BOUNDARY NOTICE */}
        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <span className="font-bold block text-sm">Account-Level Protection Enforced</span>
              <p className="opacity-90">
                Rules are applied directly to your account's web server configuration (<code>public_html/.htaccess</code>) via Apache 2.4+ <code>Require not ip</code> directives.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded font-mono font-bold bg-white text-blue-800 border border-blue-200 shrink-0">
            Scope: Account Only
          </span>
        </div>

        {/* ADD IP ADDRESS FORM */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Add an IP Address to Block</h2>
            <p className="text-xs text-slate-500">
              Enter a single IPv4 (e.g. <code>203.0.113.25</code>) or IPv6 (e.g. <code>2001:db8::1</code>) address to deny access to your site.
            </p>
          </div>

          <form onSubmit={handleAddBlock} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  value={inputIp}
                  onChange={e => setInputIp(e.target.value)}
                  placeholder="e.g. 198.51.100.4 or 2001:db8::1"
                  className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !inputIp.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                Block IP
              </button>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
              <span><strong>Supported:</strong> IPv4 & IPv6</span>
              <span>•</span>
              <span><strong>Syntax:</strong> Apache 2.4+ <code>Require not ip</code></span>
              <span>•</span>
              <span><strong>Target:</strong> <code>public_html/.htaccess</code></span>
            </div>
          </form>
        </div>

        {/* BLOCKED IPS LIST & CONTROLS */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Currently-Blocked IP Addresses</h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-200 text-slate-700">
                {blockedIps.length} active
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter blocked IPs..."
                  className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 shadow-sm"
                />
              </div>

              <button
                onClick={() => {
                  setTestIpInput('');
                  setTestResult(null);
                  setShowTestModal(true);
                }}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Test IP Access
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {filteredList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Blocked IP Address</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Enforcement Status</th>
                      <th className="py-3 px-4">Date Blocked</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredList.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 flex items-center gap-2">
                          <Ban className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          {item.ip}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                            {item.version}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            item.status === 'Active'
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setTestIpInput(item.ip);
                                setShowTestModal(true);
                                handleRunTestAccess(item.ip);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors flex items-center gap-1"
                            >
                              <Zap className="w-3 h-3 text-amber-500" />
                              Verify 403
                            </button>

                            <button
                              onClick={() => {
                                setSelectedIpRecord(item);
                                setShowUnblockModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
                            >
                              Unblock
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-500">
                <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-slate-800 text-sm">No IP addresses are currently blocked.</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  All visitors have standard access to your websites according to web server directives.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* UNBLOCK CONFIRMATION MODAL */}
      {showUnblockModal && selectedIpRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-red-600 border-b border-slate-100 pb-3">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900">Remove IP Block</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to unblock <strong>{selectedIpRecord.ip}</strong>?
              This will remove the <code>Require not ip {selectedIpRecord.ip}</code> rule from your account's <code>.htaccess</code> file, restoring website access to this IP address.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowUnblockModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUnblock}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm disabled:opacity-50"
              >
                {submitting ? 'Removing...' : 'Confirm Unblock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEST ACCESS VERIFICATION MODAL */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base text-slate-900">Test IP Access Simulation</h3>
              </div>
              <button onClick={() => setShowTestModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-500">
                Test whether an incoming HTTP request originating from a specific IP address is permitted or rejected with <code>HTTP 403 Forbidden</code> by your account's access rules.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={testIpInput}
                  onChange={e => setTestIpInput(e.target.value)}
                  placeholder="Enter IP to test..."
                  className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleRunTestAccess()}
                  disabled={testingAccess || !testIpInput.trim()}
                  className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50"
                >
                  {testingAccess ? 'Testing...' : 'Run Test'}
                </button>
              </div>

              {testResult && (
                <div className={`p-4 rounded-xl border space-y-2 mt-4 ${
                  !testResult.allowed
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">
                      Simulation Result: {testResult.httpStatus} {testResult.statusText}
                    </span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                      !testResult.allowed ? 'bg-red-200 text-red-800' : 'bg-emerald-200 text-emerald-800'
                    }`}>
                      {!testResult.allowed ? 'BLOCKED' : 'ALLOWED'}
                    </span>
                  </div>
                  <p className="text-xs opacity-90">{testResult.reason}</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowTestModal(false)}
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
