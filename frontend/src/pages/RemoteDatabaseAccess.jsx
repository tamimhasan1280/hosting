import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Globe, Database, Shield, ShieldCheck, CheckCircle2, AlertTriangle, 
  Plus, Trash2, RefreshCw, Server, Info, Search, Copy, Check, 
  ExternalLink, Network, Key, Layers, Activity, Lock, HelpCircle
} from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Alert from '../components/ui/Alert';

export default function RemoteDatabaseAccess({ onNavigate }) {
  const [cpanelUser, setCpanelUser] = useState(localStorage.getItem('cpanel_active_user') || 'cpanel_user');
  const [capabilities, setCapabilities] = useState(null);
  const [hosts, setHosts] = useState([]);
  const [dbUsers, setDbUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [hostInput, setHostInput] = useState('');
  const [selectedUserScope, setSelectedUserScope] = useState('ALL');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [wildcardConfirmed, setWildcardConfirmed] = useState(false);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Test Connection State
  const [testingHost, setTestingHost] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [copiedHost, setCopiedHost] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [capRes, hostsRes, dbRes] = await Promise.all([
        api.getRemoteCapabilities(cpanelUser),
        api.getRemoteHosts(cpanelUser),
        api.getDatabases(cpanelUser).catch(() => ({ users: [] }))
      ]);
      setCapabilities(capRes);
      setHosts(hostsRes.hosts || []);
      setDbUsers(dbRes.users || []);
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to load remote database settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const active = localStorage.getItem('cpanel_active_user') || 'cpanel_user';
    setCpanelUser(active);
    loadData();
  }, []);

  const handleAddHost = async (e) => {
    e.preventDefault();
    const trimmedHost = hostInput.trim();
    if (!trimmedHost) {
      showNotification('Please enter a remote host or IP address', 'error');
      return;
    }

    if (trimmedHost === '%' && !wildcardConfirmed) {
      showNotification('Please confirm the wildcard access warning before proceeding.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Validate
      const valRes = await api.validateRemoteHost(trimmedHost);
      if (!valRes.valid) {
        showNotification('Invalid remote host format', 'error');
        setSubmitting(false);
        return;
      }

      // Add
      await api.addRemoteHost({
        host: trimmedHost,
        databaseUser: selectedUserScope,
        description: descriptionInput,
        cpanelUser
      });

      showNotification('Remote host ' + trimmedHost + ' added successfully!', 'success');
      setHostInput('');
      setDescriptionInput('');
      setSelectedUserScope('ALL');
      setWildcardConfirmed(false);
      await loadData();
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to add remote host', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHost = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteRemoteHost({ id: deleteTarget.id, host: deleteTarget.host, cpanelUser });
      showNotification('Remote access for ' + deleteTarget.host + ' revoked successfully', 'success');
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to remove remote host', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleTestConnection = async (host) => {
    setTestingHost(host);
    setTestResult(null);
    try {
      const res = await api.testRemoteHost(host);
      setTestResult(res);
    } catch (err) {
      setTestResult({ error: err.response?.data?.error || err.message || 'Connection test failed' });
    }
  };

  const filteredHosts = hosts.filter(h => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (h.host && h.host.toLowerCase().includes(q)) ||
      (h.description && h.description.toLowerCase().includes(q)) ||
      (h.databaseUser && h.databaseUser.toLowerCase().includes(q))
    );
  });

  const isWildcardSelected = hostInput.trim() === '%';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 rounded-xl border border-indigo-500/30 text-indigo-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Remote Database Access</h1>
            <p className="text-sm text-slate-400">
              Authorize external servers, microservices, and client IPs to connect to your databases.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-2 text-slate-300 hover:text-white"
          >
            <RefreshCw className={'w-4 h-4 mr-1 ' + (loading ? 'animate-spin' : '')} />
            <span>Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate ? onNavigate('databases') : null}
            className="flex items-center space-x-2 text-slate-300 hover:text-white"
          >
            <Layers className="w-4 h-4 mr-1 text-slate-400" />
            <span>Manage Databases</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate ? onNavigate('phpmyadmin') : null}
            className="flex items-center space-x-2 text-amber-400 hover:text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
          >
            <Server className="w-4 h-4 mr-1" />
            <span>phpMyAdmin</span>
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <Alert
          type={notification.type === 'error' ? 'danger' : notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Server & Connection Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 flex items-center space-x-4 shadow-sm">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-slate-400 uppercase font-semibold block">Database Host</span>
            <div className="text-sm font-mono font-bold text-white truncate">
              {capabilities?.host || '127.0.0.1'} (localhost)
            </div>
            <span className="text-xs text-slate-500">Default database endpoint</span>
          </div>
        </div>

        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 flex items-center space-x-4 shadow-sm">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-slate-400 uppercase font-semibold block">Server Port</span>
            <div className="text-sm font-mono font-bold text-emerald-400 truncate">
              Port {capabilities?.port || 3306} (MySQL/MariaDB)
            </div>
            <span className="text-xs text-slate-500">Standard listener port</span>
          </div>
        </div>

        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 flex items-center space-x-4 shadow-sm">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-slate-400 uppercase font-semibold block">Remote Capability</span>
            <div className="text-sm font-mono font-bold text-white truncate">
              {capabilities?.capability || 'AVAILABLE'}
            </div>
            <span className="text-xs text-emerald-400">Account isolated grants</span>
          </div>
        </div>
      </div>

      {/* Firewall & Network Notice */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start space-x-3 text-xs text-slate-300">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="text-white block font-medium">Firewall & Network Advisory:</strong>
          <p>
            Adding an IP address here creates the necessary MySQL/MariaDB database user grant. For connections to succeed from outside the hosting server, ensure that port <span className="text-blue-300 font-mono">3306</span> is allowed through your network firewall and hosting security group.
          </p>
        </div>
      </div>

      {/* Add Remote Host Form */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl space-y-6">
        <div className="border-b border-slate-700/80 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Add Remote Host</h2>
              <p className="text-xs text-slate-400">Specify the IP address, FQDN, or wildcard host authorized to access your databases.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleAddHost} className="space-y-5 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Host Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Host (IP, FQDN, or Wildcard)
              </label>
              <input
                type="text"
                value={hostInput}
                onChange={(e) => setHostInput(e.target.value)}
                placeholder="e.g. 203.0.113.10 or db-client.example.com"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 text-white px-4 py-2.5 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
              <p className="text-xs text-slate-400 mt-1.5">
                Examples: <span className="text-slate-300 font-mono">203.0.113.10</span>, <span className="text-slate-300 font-mono">192.168.1.%</span>, or <span className="text-slate-300 font-mono">%</span>
              </p>
            </div>

            {/* Database User Scope */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Database User Scope
              </label>
              <select
                value={selectedUserScope}
                onChange={(e) => setSelectedUserScope(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 text-white px-4 py-2.5 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value="ALL">All Account Database Users (Recommended)</option>
                {dbUsers.map(u => (
                  <option key={u.username} value={u.username}>
                    {u.username}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1.5">
                Grants remote access to the selected user identity.
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Comment / Description (Optional)
            </label>
            <input
              type="text"
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              placeholder="e.g. Office Static IP / Production API Worker"
              maxLength={100}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 text-white px-4 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Wildcard Warning */}
          {isWildcardSelected && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-3">
              <div className="flex items-start space-x-2.5 text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <strong className="text-amber-300 block font-semibold">Security Warning: Unrestricted Wildcard (%)</strong>
                  <p className="text-slate-300">
                    Using <span className="font-mono font-bold text-amber-300">%</span> permits database connections from ANY remote IP address worldwide. Make sure all your database users have strong, complex passwords.
                  </p>
                </div>
              </div>
              <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-slate-200 select-none pt-1">
                <input
                  type="checkbox"
                  checked={wildcardConfirmed}
                  onChange={(e) => setWildcardConfirmed(e.target.checked)}
                  className="w-4 h-4 rounded border-amber-500 text-amber-500 bg-slate-950 focus:ring-amber-400"
                />
                <span>I understand and confirm that I want to grant unrestricted wildcard remote access.</span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end pt-2">
            <Button
              type="submit"
              disabled={submitting || !hostInput.trim() || (isWildcardSelected && !wildcardConfirmed)}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg shadow-lg shadow-blue-600/20 font-medium"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  <span>Adding Remote Host...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1.5" />
                  <span>Add Remote Host</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Allowed Remote Hosts Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Allowed Remote Hosts ({filteredHosts.length})</h2>
            <p className="text-xs text-slate-400">Currently authorized remote connection endpoints for account <strong className="text-blue-400 font-mono">{cpanelUser}</strong>.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search remote hosts..."
              className="w-full rounded-lg border border-slate-600 bg-slate-900 text-white pl-9 pr-3 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono"
            />
          </div>
        </div>

        {filteredHosts.length === 0 ? (
          <div className="text-center py-12 space-y-3 bg-slate-900/40 rounded-xl border border-dashed border-slate-700/60">
            <Globe className="w-10 h-10 text-slate-500 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No Remote Database Hosts Configured</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add an IP address or hostname above to allow external clients to connect to your databases.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-700 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Host / IP</th>
                  <th className="py-3 px-4">Database User Scope</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Added Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                {filteredHosts.map((item) => (
                  <tr key={item.id || item.host} className="hover:bg-slate-700/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-white flex items-center space-x-2">
                      <span>{item.host}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(item.host);
                          setCopiedHost(item.host);
                          setTimeout(() => setCopiedHost(null), 2000);
                        }}
                        className="text-slate-400 hover:text-white"
                        title="Copy Host"
                      >
                        {copiedHost === item.host ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono text-indigo-300">
                      {item.databaseUser === 'ALL' ? (
                        <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-sans font-medium text-[11px]">
                          All Account Users
                        </span>
                      ) : (
                        <span>{item.databaseUser}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                      {item.description || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      {item.created ? new Date(item.created).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Active
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection(item.host)}
                        className="text-slate-300 hover:text-white text-xs px-2.5 py-1"
                      >
                        <Activity className="w-3.5 h-3.5 mr-1 text-blue-400" />
                        <span>Test</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTarget(item)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/30 text-xs px-2.5 py-1"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        <span>Remove</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          title="Revoke Remote Database Access"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Are you sure you want to revoke remote database access for <strong className="text-white font-mono">{deleteTarget.host}</strong>?
            </p>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
              The corresponding MySQL/MariaDB grant will be permanently removed. Local access (localhost) will remain unaffected.
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteHost}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-500 text-white font-medium"
              >
                {deleting ? 'Revoking...' : 'Revoke Access'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Connection Test Result Modal */}
      {testingHost && (
        <Modal
          isOpen={true}
          onClose={() => { setTestingHost(null); setTestResult(null); }}
          title={'Connection Test: ' + testingHost}
        >
          <div className="space-y-4">
            {!testResult ? (
              <div className="flex items-center justify-center py-8 space-x-3 text-sm text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                <span>Verifying database server grant and port availability...</span>
              </div>
            ) : testResult.error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-xs text-red-300 space-y-1">
                <strong className="block font-semibold">Test Failed</strong>
                <p>{testResult.error}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-xs text-emerald-300 space-y-1.5">
                  <div className="flex items-center space-x-2 font-semibold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Configuration Verified</span>
                  </div>
                  <p className="text-slate-300">{testResult.message}</p>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-xs space-y-1 text-slate-300">
                  <div>Host: <strong className="text-white">{testResult.host}</strong></div>
                  <div>Port: <strong className="text-emerald-400">{testResult.port}</strong></div>
                  <div>Status: <strong className="text-emerald-400">{testResult.status}</strong></div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => { setTestingHost(null); setTestResult(null); }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}