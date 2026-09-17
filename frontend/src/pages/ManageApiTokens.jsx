import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import {
  Key,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Search,
  ArrowLeft,
  Info,
  Clock,
  Lock,
  Terminal,
  Layers,
  ChevronDown,
  ChevronUp,
  Sliders,
  ExternalLink
} from 'lucide-react';

export default function ManageApiTokens({ onBack, onNavigate, user = 'cpanel_user' }) {
  const [tokens, setTokens] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [revealModal, setRevealModal] = useState(null); // { rawToken, token }
  const [revokeModal, setRevokeModal] = useState(null); // token object to revoke
  const [copied, setCopied] = useState(false);

  // Create Form State
  const [tokenName, setTokenName] = useState('');
  const [expiresDays, setExpiresDays] = useState('never');
  const [selectedScopes, setSelectedScopes] = useState(['full_access']);

  // Live Token Test Console State
  const [testTokenInput, setTestTokenInput] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tokenRes, scopeRes] = await Promise.all([
        api.getApiTokens(user),
        api.getAvailableTokenScopes()
      ]);
      setTokens(tokenRes.tokens || []);
      setScopes(scopeRes.scopes || []);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load API tokens.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleCopy = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Create Token Submission
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!tokenName.trim()) {
      showFeedback('error', 'Token name is required.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.createApiToken({
        cpanelUser: user,
        name: tokenName.trim(),
        scopes: selectedScopes,
        expiresDays: expiresDays === 'never' ? null : Number(expiresDays)
      });

      // Show one-time reveal modal
      setRevealModal({ rawToken: res.rawToken, token: res.token });
      setIsCreateModalOpen(false);
      setTokenName('');
      setExpiresDays('never');
      setSelectedScopes(['full_access']);
      await loadData();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to generate API token.');
    } finally {
      setActionLoading(false);
    }
  };

  // Revoke Token Submission
  const handleRevokeConfirm = async () => {
    if (!revokeModal) return;
    setActionLoading(true);
    try {
      const res = await api.revokeApiToken(revokeModal.id, user);
      showFeedback('success', res.message || `Token "${revokeModal.name}" revoked.`);
      setRevokeModal(null);
      await loadData();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to revoke token.');
    } finally {
      setActionLoading(false);
    }
  };

  // Live Test Token
  const handleTestToken = async (e) => {
    e.preventDefault();
    if (!testTokenInput.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await api.testApiTokenAuth(testTokenInput.trim());
      setTestResult({ success: true, data: res });
    } catch (err) {
      setTestResult({
        success: false,
        status: err.response?.status || 401,
        error: err.response?.data?.error || err.message || 'Authentication failed.'
      });
    } finally {
      setTestLoading(false);
    }
  };

  // Scope selection helpers
  const toggleScope = (scopeId) => {
    if (scopeId === 'full_access') {
      setSelectedScopes(['full_access']);
      return;
    }
    let updated = selectedScopes.filter(s => s !== 'full_access');
    if (updated.includes(scopeId)) {
      updated = updated.filter(s => s !== scopeId);
    } else {
      updated.push(scopeId);
    }
    if (updated.length === 0) {
      updated = ['full_access'];
    }
    setSelectedScopes(updated);
  };

  const handleSelectAllScopes = () => {
    setSelectedScopes(scopes.map(s => s.id));
  };

  const handleClearScopes = () => {
    setSelectedScopes(['full_access']);
  };

  // Scopes grouped by category
  const groupedScopes = useMemo(() => {
    const map = {};
    scopes.forEach(s => {
      const cat = s.category || 'General';
      if (!map[cat]) map[cat] = [];
      map[cat].push(s);
    });
    return map;
  }, [scopes]);

  // Filtered Tokens
  const filteredTokens = useMemo(() => {
    if (!searchTerm.trim()) return tokens;
    const q = searchTerm.toLowerCase();
    return tokens.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.prefix.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q) ||
      (t.scopes && t.scopes.some(s => s.toLowerCase().includes(q)))
    );
  }, [tokens, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    let active = 0, expired = 0, revoked = 0;
    tokens.forEach(t => {
      if (t.status === 'Active') active++;
      else if (t.status === 'Expired') expired++;
      else if (t.status === 'Revoked') revoked++;
    });
    return { total: tokens.length, active, expired, revoked };
  }, [tokens]);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs Navigation */}
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
          <span className="text-slate-900 font-semibold">Manage API Tokens</span>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Account: <strong className="text-slate-800 font-mono">{user}</strong>
        </div>
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Key className="w-5 h-5" />
            </div>
            Manage API Tokens
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 max-w-2xl">
            API Tokens allow automated tools, deployment scripts, and command-line clients to authenticate securely with your cPanel hosting account using scoped Bearer authentication.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" /> Create API Token
          </button>
          <button
            onClick={loadData}
            disabled={loading || actionLoading}
            className="border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2.5 rounded-lg shadow-sm flex items-center gap-1.5 transition"
            title="Refresh Token List"
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
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 ml-4">✕</button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Tokens</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Maximum 30 allowed</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Active Tokens</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{stats.active}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Valid for authentication</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Expired Tokens</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{stats.expired}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Exceeded validity period</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Revoked Tokens</div>
          <div className="text-2xl font-black text-slate-600 mt-1">{stats.revoked}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Permanently invalidated</div>
        </div>
      </div>

      {/* Tokens List Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, prefix, scope..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Showing {filteredTokens.length} of {tokens.length} tokens
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3.5 px-5">Token Name & Prefix</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Assigned Scopes</th>
                <th className="py-3.5 px-5">Created Date</th>
                <th className="py-3.5 px-5">Last Used</th>
                <th className="py-3.5 px-5">Expires</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && tokens.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin mx-auto mb-2" />
                    Loading API tokens...
                  </td>
                </tr>
              ) : filteredTokens.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">
                    No API tokens found. Click <strong>"Create API Token"</strong> to generate your first credential.
                  </td>
                </tr>
              ) : (
                filteredTokens.map((t) => {
                  const isActive = t.status === 'Active';
                  const isExpired = t.status === 'Expired';
                  const isRevoked = t.status === 'Revoked';

                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Key className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                          {t.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5" title="Public identifier prefix">
                          {t.prefix}
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        {isActive && (
                          <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        )}
                        {isExpired && (
                          <span className="bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-rose-200 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Expired
                          </span>
                        )}
                        {isRevoked && (
                          <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200 inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Revoked
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {t.scopes?.map((s) => (
                            <span
                              key={s}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                s === 'full_access'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 font-mono text-[11px]">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 font-mono text-[11px]">
                        {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : <span className="text-slate-400">Never</span>}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-[11px]">
                        {t.expiresAt ? (
                          <span className={isExpired ? 'text-rose-600 font-semibold' : 'text-slate-700'}>
                            {new Date(t.expiresAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">Never</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {isActive ? (
                          <button
                            onClick={() => setRevokeModal(t)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded shadow-xs transition"
                            title="Revoke this token immediately"
                          >
                            Revoke
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium italic">
                            {isRevoked ? 'Revoked' : 'Expired'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live API Token Test Console */}
      <div className="bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-800 text-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Live API Token Test Console</h2>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Endpoint: GET /api/tokens/test-auth</span>
        </div>
        <p className="text-xs text-slate-400">
          Verify Bearer token authentication against the live backend API. Paste a token below to simulate an automated client request (`Authorization: Bearer &lt;TOKEN&gt;`).
        </p>

        <form onSubmit={handleTestToken} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={testTokenInput}
            onChange={(e) => setTestTokenInput(e.target.value)}
            placeholder="Paste raw token (cpt_...)"
            className="flex-1 px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={testLoading || !testTokenInput.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {testLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
            Test Authentication
          </button>
        </form>

        {testResult && (
          <div className={`p-3.5 rounded-lg text-xs font-mono border ${
            testResult.success
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}>
            <div className="font-bold flex items-center gap-1.5 mb-1">
              {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
              {testResult.success ? 'HTTP 200 OK — Authenticated' : `HTTP ${testResult.status} — Authentication Failed`}
            </div>
            {testResult.success ? (
              <div className="space-y-0.5 text-[11px]">
                <div>User: <strong>{testResult.data.user}</strong></div>
                <div>Token Name: <strong>{testResult.data.token?.name}</strong></div>
                <div>Scopes: {testResult.data.token?.scopes?.join(', ')}</div>
              </div>
            ) : (
              <div className="text-[11px]">{testResult.error}</div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: CREATE API TOKEN */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto animate-fade">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Create New API Token</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Token Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g. GitHub Actions Deployment, Backup Script"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
                <span className="text-[11px] text-slate-400 block mt-1">A memorable label for this token.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expiration</label>
                <select
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                >
                  <option value="never">Never (Persistent)</option>
                  <option value="7">7 Days</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days (Recommended for production)</option>
                  <option value="365">1 Year</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">Permissions & Scopes</label>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllScopes}
                      className="text-emerald-600 hover:underline font-semibold"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleClearScopes}
                      className="text-slate-500 hover:underline font-semibold"
                    >
                      Full Access Only
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-56 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {Object.entries(groupedScopes).map(([cat, catScopes]) => (
                    <div key={cat} className="space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{cat}</div>
                      {catScopes.map((scope) => {
                        const isChecked = selectedScopes.includes(scope.id);
                        return (
                          <label
                            key={scope.id}
                            className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer transition text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleScope(scope.id)}
                              className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div>
                              <div className="font-semibold text-slate-800">{scope.name}</div>
                              <div className="text-[11px] text-slate-500">{scope.desc}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ONE-TIME REVEAL TOKEN */}
      {revealModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fade">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">API Token Created Successfully</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Token: <strong className="text-slate-800">{revealModal.token.name}</strong>
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Important:</strong> Copy your API token now. For security purposes, this token will <strong>never be displayed again</strong>. If you lose it, you will need to generate a new token.
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Raw API Token</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={revealModal.rawToken}
                  className="w-full p-2.5 text-xs font-mono bg-slate-900 text-emerald-400 rounded-lg border border-slate-800 select-all"
                />
                <button
                  onClick={() => handleCopy(revealModal.rawToken)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition flex-shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setRevealModal(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-5 py-2 rounded-lg transition"
              >
                I have saved my token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REVOKE CONFIRMATION */}
      {revokeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-fade">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Revoke API Token?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to revoke <strong className="text-slate-800">{revokeModal.name}</strong> ({revokeModal.prefix})?
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-rose-800 text-xs">
              <strong>Warning:</strong> Any deployment pipelines, scripts, or apps currently authenticating with this token will immediately fail with HTTP 401 Unauthorized.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setRevokeModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeConfirm}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {actionLoading ? 'Revoking...' : 'Yes, Revoke Token'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
