import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileKey,
  HardDrive,
  HelpCircle,
  Info,
  Key,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  Upload,
  UserCheck,
  X,
  Zap
} from 'lucide-react';
import { api } from '../services/api';

export default function SshAccessManager({ onBack, onNavigate, user }) {
  const cpanelUser = user || 'cpanel_user';

  // Data States
  const [statusData, setStatusData] = useState(null);
  const [keysList, setKeysList] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);

  // UI Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedField, setCopiedField] = useState(null);

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showViewKeyModal, setShowViewKeyModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPrivateDownloadModal, setShowPrivateDownloadModal] = useState(false);
  const [showDiagModal, setShowDiagModal] = useState(false);

  // Active items for modals
  const [selectedKey, setSelectedKey] = useState(null);
  const [activePublicKeyContent, setActivePublicKeyContent] = useState('');
  const [privateDownloadData, setPrivateDownloadData] = useState(null);

  // Generation form
  const [genName, setGenName] = useState('id_ed25519');
  const [genType, setGenType] = useState('ed25519');
  const [genBits, setGenBits] = useState(2048);
  const [genPassphrase, setGenPassphrase] = useState('');
  const [genComment, setGenComment] = useState('');

  // Import form
  const [importName, setImportName] = useState('');
  const [importContent, setImportContent] = useState('');

  // Load Status and Keys
  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setErrorMessage(null);

    try {
      const [statusRes, keysRes] = await Promise.all([
        api.getSshAccessStatus(cpanelUser).catch(e => ({ success: false, error: e.message })),
        api.getSshKeys(cpanelUser).catch(e => ({ success: false, error: e.message, keys: [] }))
      ]);

      if (statusRes && statusRes.success) {
        setStatusData(statusRes);
      } else {
        setErrorMessage(statusRes?.error || 'Failed to fetch SSH status.');
      }

      if (keysRes && keysRes.success) {
        setKeysList(keysRes.keys || []);
      }
    } catch (err) {
      console.error('Failed to load SSH access data:', err);
      setErrorMessage(err.message || 'Error communicating with SSH Access API.');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [cpanelUser]);

  // Copy to clipboard helper
  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2500);
    }).catch(() => {
      // Fallback
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2500);
    });
  };

  // Generate Key handler
  const handleGenerateKey = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.generateSshKey({
        cpanelUser,
        name: genName.trim(),
        type: genType,
        bits: genBits,
        passphrase: genPassphrase,
        comment: genComment.trim()
      });

      if (res && res.success) {
        setShowGenerateModal(false);
        setPrivateDownloadData({
          name: res.key.name,
          token: res.downloadToken,
          fingerprint: res.key.fingerprint
        });
        setShowPrivateDownloadModal(true);
        setSuccessMessage(`SSH key pair "${res.key.name}" generated successfully.`);
        // Reset form
        setGenName('id_ed25519');
        setGenPassphrase('');
        setGenComment('');
        await loadData();
      } else {
        setErrorMessage(res?.error || 'Failed to generate key pair.');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message || 'Error generating key pair.');
    } finally {
      setActionLoading(false);
    }
  };

  // Import Key handler
  const handleImportKey = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.importSshKey({
        cpanelUser,
        name: importName.trim(),
        publicKeyContent: importContent.trim()
      });

      if (res && res.success) {
        setShowImportModal(false);
        setSuccessMessage(`Public key "${res.key.name}" imported successfully.`);
        setImportName('');
        setImportContent('');
        await loadData();
      } else {
        setErrorMessage(res?.error || 'Failed to import public key.');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message || 'Error importing public key.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Authorization
  const handleToggleAuthorize = async (key) => {
    setActionLoading(true);
    setErrorMessage(null);

    try {
      let res;
      if (key.authorized) {
        res = await api.deauthorizeSshKey({ cpanelUser, keyId: key.id });
        if (res && res.success) {
          setSuccessMessage(`Key "${key.name}" has been deauthorized and removed from authorized_keys.`);
        }
      } else {
        res = await api.authorizeSshKey({ cpanelUser, keyId: key.id });
        if (res && res.success) {
          setSuccessMessage(`Key "${key.name}" has been authorized and added to authorized_keys.`);
        }
      }
      await loadData();
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message || 'Error updating authorization status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Key
  const handleDeleteKey = async () => {
    if (!selectedKey) return;
    setActionLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.deleteSshKey({ cpanelUser, keyId: selectedKey.id });
      if (res && res.success) {
        setShowDeleteModal(false);
        setSuccessMessage(`SSH key "${selectedKey.name}" deleted permanently.`);
        setSelectedKey(null);
        await loadData();
      } else {
        setErrorMessage(res?.error || 'Failed to delete SSH key.');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message || 'Error deleting key.');
    } finally {
      setActionLoading(false);
    }
  };

  // View Public Key Content
  const handleViewPublicKey = async (key) => {
    setSelectedKey(key);
    setActivePublicKeyContent('Loading public key content...');
    setShowViewKeyModal(true);

    try {
      const res = await api.getSshPublicKey(key.id, cpanelUser);
      if (res && res.success) {
        setActivePublicKeyContent(res.publicKey);
      } else {
        setActivePublicKeyContent('Failed to retrieve public key content.');
      }
    } catch (err) {
      setActivePublicKeyContent(err.message || 'Error fetching public key.');
    }
  };

  // Run Connection Test
  const handleRunDiagnostics = async () => {
    setActionLoading(true);
    try {
      const res = await api.testSshConnection(cpanelUser);
      if (res && res.success) {
        setDiagnostics(res);
        setShowDiagModal(true);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error running connection diagnostics.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered keys
  const filteredKeys = useMemo(() => {
    if (!searchQuery.trim()) return keysList;
    const q = searchQuery.toLowerCase();
    return keysList.filter(k =>
      k.name.toLowerCase().includes(q) ||
      k.fingerprint.toLowerCase().includes(q) ||
      (k.comment && k.comment.toLowerCase().includes(q)) ||
      k.keyType.toLowerCase().includes(q)
    );
  }, [keysList, searchQuery]);

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-24">
          <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          <p className="text-slate-600 font-medium">Detecting server OpenSSH environment and account permissions...</p>
        </div>
      </div>
    );
  }

  const conn = statusData?.connectionInfo || {};
  const isServerInactive = statusData?.overallStatus === 'Server Daemon Inactive';

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
              <span className="text-slate-900 font-semibold">SSH Access</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                <Terminal className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">SSH Access</h1>
                <p className="text-sm text-slate-500">
                  Manage SSH cryptographic key pairs, authorize remote connections, and configure secure shell authentication.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunDiagnostics}
              disabled={actionLoading}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 transition-colors shadow-sm"
              title="Inspect real server configuration and authorized keys"
            >
              <Server className="w-3.5 h-3.5 text-slate-500" />
              Test Diagnostics
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

        {/* FEEDBACK NOTIFICATIONS */}
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

        {/* STATUS & CONNECTION CARD */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Header Status Bar */}
          <div className={`p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            statusData?.overallStatus === 'Enabled'
              ? 'bg-emerald-50/60 border-emerald-200'
              : statusData?.overallStatus === 'Restricted (Jailed)'
              ? 'bg-blue-50/60 border-blue-200'
              : isServerInactive
              ? 'bg-amber-50/60 border-amber-200'
              : 'bg-red-50/60 border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              {statusData?.overallStatus === 'Enabled' ? (
                <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
              ) : statusData?.overallStatus === 'Restricted (Jailed)' ? (
                <Shield className="w-6 h-6 text-blue-600 shrink-0" />
              ) : isServerInactive ? (
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-slate-900">
                    SSH Access Status: {statusData?.overallStatus}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-white border border-slate-200 text-slate-700">
                    Shell: {statusData?.shellType}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {statusData?.statusMessage}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs text-slate-500 block">Package Policy</span>
              <span className="text-xs font-bold text-slate-800">{statusData?.plan}</span>
            </div>
          </div>

          {/* Connection Details Grid */}
          <div className="p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">SSH Connection Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Host */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-500 block">Host / Server</span>
                  <span className="text-sm font-mono font-bold text-slate-800">{conn.host || 'localhost'}</span>
                </div>
                <button
                  onClick={() => handleCopy(conn.host, 'host')}
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded transition-colors"
                  title="Copy Host"
                >
                  {copiedField === 'host' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Port */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-500 block">SSH Port</span>
                  <span className="text-sm font-mono font-bold text-slate-800">{conn.port || 22}</span>
                </div>
                <button
                  onClick={() => handleCopy(String(conn.port || 22), 'port')}
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded transition-colors"
                  title="Copy Port"
                >
                  {copiedField === 'port' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Username */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-500 block">Username</span>
                  <span className="text-sm font-mono font-bold text-slate-800">{conn.username || cpanelUser}</span>
                </div>
                <button
                  onClick={() => handleCopy(conn.username || cpanelUser, 'username')}
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded transition-colors"
                  title="Copy Username"
                >
                  {copiedField === 'username' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Shell */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-500 block">Assigned Shell</span>
                  <span className="text-xs font-mono font-bold text-slate-800 truncate max-w-[170px]" title={statusData?.shell}>
                    {statusData?.shell}
                  </span>
                </div>
                <Lock className="w-4 h-4 text-slate-400" />
              </div>

            </div>

            {/* Quick Command Box */}
            <div className="p-3.5 bg-slate-900 rounded-lg flex items-center justify-between text-slate-100">
              <div className="flex items-center gap-3 overflow-x-auto">
                <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-mono font-semibold text-emerald-300 select-all">
                  {conn.command}
                </span>
              </div>
              <button
                onClick={() => handleCopy(conn.command, 'command')}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
              >
                {copiedField === 'command' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Command
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

        {/* KEYS SECTION HEADER & ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Manage SSH Keys</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-200 text-slate-700">
              {keysList.length} registered
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search keys..."
                className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 shadow-sm"
              />
            </div>

            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Key
            </button>

            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Generate a New Key
            </button>
          </div>
        </div>

        {/* KEYS TABLE */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {filteredKeys.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Key Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Cryptographic Fingerprint</th>
                    <th className="py-3 px-4">Authorization</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredKeys.map(k => (
                    <tr key={k.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <Key className="w-4 h-4 text-slate-400" />
                        {k.name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                          {k.keyType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-800 text-[11px]">
                            {k.fingerprint}
                          </span>
                          <button
                            onClick={() => handleCopy(k.fingerprint, `fp_${k.id}`)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded"
                            title="Copy Fingerprint"
                          >
                            {copiedField === `fp_${k.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                          k.authorized 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {k.authorized ? 'Authorized' : 'Not Authorized'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(k.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleAuthorize(k)}
                            disabled={actionLoading}
                            className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                              k.authorized
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {k.authorized ? 'Deauthorize' : 'Authorize'}
                          </button>

                          <button
                            onClick={() => handleViewPublicKey(k)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors"
                          >
                            View Key
                          </button>

                          <button
                            onClick={() => {
                              setSelectedKey(k);
                              setShowDeleteModal(true);
                            }}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            title="Delete Key"
                          >
                            <Trash2 className="w-4 h-4" />
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
              <FileKey className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="font-bold text-slate-800 text-sm">No SSH keys found.</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Generate a new cryptographic key pair or import your existing public key to begin authenticating.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
                >
                  Generate a New Key
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm"
                >
                  Import Key
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* MODAL 1: GENERATE KEY */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">Generate a New SSH Key Pair</h3>
              </div>
              <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Key Name</label>
                <input
                  type="text"
                  required
                  value={genName}
                  onChange={e => setGenName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="e.g. id_ed25519"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Alphanumeric, underscores, and hyphens only.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Key Algorithm</label>
                  <select
                    value={genType}
                    onChange={e => setGenType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="ed25519">ED25519 (Recommended)</option>
                    <option value="rsa">RSA</option>
                  </select>
                </div>

                {genType === 'rsa' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Key Size</label>
                    <select
                      value={genBits}
                      onChange={e => setGenBits(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value={2048}>2048-bit</option>
                      <option value={4096}>4096-bit</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Key Passphrase (Optional)</label>
                <input
                  type="password"
                  value={genPassphrase}
                  onChange={e => setGenPassphrase(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Passphrase to protect private key"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Leave empty for no passphrase.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Comment (Optional)</label>
                <input
                  type="text"
                  value={genComment}
                  onChange={e => setGenComment(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder={`${cpanelUser}@${conn.host || 'example.com'}`}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ONE-TIME PRIVATE KEY DOWNLOAD */}
      {showPrivateDownloadModal && privateDownloadData && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 pb-2 border-b border-emerald-100">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">Key Pair Generated Successfully</h3>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              <span className="font-bold block">Important Security Notice:</span>
              <p>
                In strict accordance with SSH private key security standards, the private key is never stored in plaintext on the server.
                You can download the private key now via this one-time token. Once dismissed or downloaded, it cannot be retrieved again.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Key Name:</span>
                <span className="font-mono font-bold text-slate-900">{privateDownloadData.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Fingerprint:</span>
                <span className="font-mono text-slate-900">{privateDownloadData.fingerprint}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <a
                href={`/api/ssh-access/keys/download-private/${privateDownloadData.token}?user=${cpanelUser}`}
                target="_blank"
                rel="noreferrer"
                download={privateDownloadData.name}
                onClick={() => {
                  setTimeout(() => setShowPrivateDownloadModal(false), 1500);
                }}
                className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-4 h-4" />
                Download Private Key
              </a>

              <button
                onClick={() => setShowPrivateDownloadModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: IMPORT KEY */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">Import an Existing Public Key</h3>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Key Name</label>
                <input
                  type="text"
                  required
                  value={importName}
                  onChange={e => setImportName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="e.g. macbook_id_ed25519"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Public Key Data</label>
                <textarea
                  required
                  rows={4}
                  value={importContent}
                  onChange={e => setImportContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono leading-relaxed"
                  placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... user@host"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Paste the standard single-line OpenSSH public key (starts with ssh-ed25519, ssh-rsa, or ecdsa).
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Import Public Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: VIEW PUBLIC KEY */}
      {showViewKeyModal && selectedKey && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">Public Key: {selectedKey.name}</h3>
              </div>
              <button onClick={() => setShowViewKeyModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-slate-500 font-mono block">Fingerprint: {selectedKey.fingerprint}</span>
              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-xs font-mono break-all whitespace-pre-wrap max-h-48 overflow-y-auto">
                {activePublicKeyContent}
              </pre>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <button
                onClick={() => handleCopy(activePublicKeyContent, 'modal_key')}
                className="px-3.5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg flex items-center gap-1.5 shadow-sm"
              >
                {copiedField === 'modal_key' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copiedField === 'modal_key' ? 'Copied to Clipboard!' : 'Copy Key String'}
              </button>

              <button
                onClick={() => setShowViewKeyModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: DELETE CONFIRMATION */}
      {showDeleteModal && selectedKey && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-red-600 border-b border-slate-100 pb-3">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900">Delete SSH Key</h3>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete SSH key <strong>"{selectedKey.name}"</strong>?
              If this key is currently in <code>authorized_keys</code>, it will be deauthorized and removed immediately.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteKey}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
              >
                {actionLoading ? 'Deleting...' : 'Delete Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: DIAGNOSTICS */}
      {showDiagModal && diagnostics && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">SSH Connection Diagnostics</h3>
              </div>
              <button onClick={() => setShowDiagModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <span className="font-semibold text-slate-700">Overall Diagnostic State:</span>
                <span className={`font-bold px-2.5 py-0.5 rounded-full ${
                  diagnostics.canConnect 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {diagnostics.overallResult}
                </span>
              </div>

              <div className="space-y-2">
                {diagnostics.diagnostics.map((d, i) => (
                  <div key={i} className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800">{d.item}</span>
                      <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                        d.status === 'PASS' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {d.status}
                      </span>
                    </div>
                    <p className="text-slate-500">{d.message}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowDiagModal(false)}
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
