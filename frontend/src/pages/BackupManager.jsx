import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { 
  Archive, Download, Trash2, CheckCircle2, RefreshCw, HardDrive, 
  ShieldCheck, AlertTriangle, Database, Mail, Folder, FileText, 
  Info, Shield, Check, Copy, Upload, ArrowRight, Clock, Hash
} from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Alert from '../components/ui/Alert';

export default function BackupManager() {
  const [backups, setBackups] = useState([]);
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingType, setCreatingType] = useState(null); // 'full', 'homedir', 'databases', 'email'
  const [selectedDb, setSelectedDb] = useState('');
  const [notification, setNotification] = useState(null);

  // Active Job Polling
  const [activeJob, setActiveJob] = useState(null);
  const pollIntervalRef = useRef(null);

  // Modals state
  const [detailsModalBackup, setDetailsModalBackup] = useState(null);
  const [deleteModalBackup, setDeleteModalBackup] = useState(null);
  const [restoreModalBackup, setRestoreModalBackup] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [backupList, dbRes] = await Promise.all([
        api.getBackups(),
        api.getDatabases().catch(() => ({ databases: [] }))
      ]);
      setBackups(Array.isArray(backupList) ? backupList : (backupList.backups || []));
      setDatabases(dbRes.databases || []);
    } catch (err) {
      showNotification('Failed to load backup data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Poll active backup job
  const startJobPolling = (jobId) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.getBackupStatus(jobId);
        if (res.success && res.job) {
          setActiveJob(res.job);
          if (res.job.status === 'completed') {
            clearInterval(pollIntervalRef.current);
            setCreatingType(null);
            showNotification(`Backup ${res.job.filename} completed successfully!`, 'success');
            loadData();
          } else if (res.job.status === 'failed') {
            clearInterval(pollIntervalRef.current);
            setCreatingType(null);
            showNotification(`Backup failed: ${res.job.error || 'Unknown error'}`, 'error');
            loadData();
          }
        }
      } catch (e) {
        clearInterval(pollIntervalRef.current);
        setCreatingType(null);
      }
    }, 1500);
  };

  const handleCreateBackup = async (type = 'full', customDb = null) => {
    setCreatingType(type);
    try {
      const res = await api.createBackup({ type, dbName: customDb });
      if (res.success && res.jobId) {
        startJobPolling(res.jobId);
        showNotification(`Started ${type === 'full' ? 'Full Account' : type} backup generation...`, 'info');
      }
    } catch (err) {
      setCreatingType(null);
      showNotification(err.response?.data?.error || err.message, 'error');
    }
  };

  const handleDownload = (backup) => {
    const backupId = backup.id || backup.filename;
    window.location.href = `/api/backup/download/${encodeURIComponent(backupId)}`;
  };

  const handleConfirmRestore = async () => {
    if (!restoreModalBackup) return;
    setRestoring(true);
    setRestoreResult(null);
    try {
      const res = await api.restoreBackup({ backupId: restoreModalBackup.id || restoreModalBackup.filename });
      if (res.success) {
        setRestoreResult(res);
        showNotification('Backup restored successfully into account filesystem!', 'success');
      }
    } catch (err) {
      showNotification('Restoration failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setRestoring(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalBackup) return;
    setDeleting(true);
    try {
      const res = await api.deleteBackup(deleteModalBackup.id || deleteModalBackup.filename);
      if (res.success) {
        showNotification(res.message || 'Backup deleted successfully', 'success');
        setDeleteModalBackup(null);
        loadData();
      }
    } catch (err) {
      showNotification(err.response?.data?.error || err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const copyChecksum = (hash) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const totalBytesUsed = backups.reduce((acc, b) => acc + (b.sizeBytes || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumbs */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-1">
              <span>Home</span>
              <span>/</span>
              <span>Files</span>
              <span>/</span>
              <span className="text-indigo-600">Backup</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <Archive className="w-6 h-6 text-[#27235C]" />
              <span>Backup & Restore Engine</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Create and manage real compressed backups of all or part of your website, databases, and email data for safekeeping or account migration.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-700">Backup Storage Used</div>
              <div className="text-xs text-slate-500 font-mono">{formatBytes(totalBytesUsed)} ({backups.length} archives)</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="flex items-center space-x-1 border-slate-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {notification && (
          <div className="mt-4">
            <Alert variant={notification.type} onClose={() => setNotification(null)}>
              {notification.message}
            </Alert>
          </div>
        )}
      </div>

      {/* Active Backup Progress Card */}
      {creatingType && activeJob && (
        <div className="bg-gradient-to-r from-indigo-900 to-[#27235C] text-white rounded-xl p-5 shadow-md animate-fade">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
              <div>
                <h4 className="font-bold text-sm">Backup In Progress ({activeJob.type?.toUpperCase()} Backup)</h4>
                <p className="text-xs text-indigo-200 mt-0.5">{activeJob.progress?.message || 'Processing files...'}</p>
              </div>
            </div>
            <div className="text-sm font-bold font-mono text-amber-300">
              {activeJob.progress?.percent || 20}%
            </div>
          </div>
          <div className="w-full bg-indigo-950/60 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full transition-all duration-500 rounded-full"
              style={{ width: `${activeJob.progress?.percent || 20}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Backup Creation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Full Account Backup */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-indigo-600" />
                <span>Full Account Backup</span>
              </h2>
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-indigo-200">
                Recommended
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              A full backup creates a comprehensive archive of your entire home directory, all MySQL databases, email forwarders/accounts, DNS zones, and cron jobs.
            </p>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80 mb-5 space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Includes <code className="font-mono text-slate-800">public_html</code> & all user files</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Full MySQL databases SQL dump & structure</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Email accounts, forwarders & autoresponders</span>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            disabled={!!creatingType}
            onClick={() => handleCreateBackup('full')}
            className="w-full bg-[#27235C] hover:bg-[#1c1944] text-white flex items-center justify-center space-x-2 py-2.5"
          >
            {creatingType === 'full' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating Full Backup...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download a Full Account Backup</span>
              </>
            )}
          </Button>
        </div>

        {/* 2. Partial Backups */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-2 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Partial Backups</span>
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Download separate individual backup archives for specific components of your hosting account.
            </p>

            <div className="space-y-3 mb-5">
              {/* Home Directory Button */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/50 transition">
                <div className="flex items-center space-x-2.5">
                  <Folder className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Home Directory Backup</div>
                    <div className="text-[11px] text-slate-500">Website files & subdirectories only</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={!!creatingType}
                  onClick={() => handleCreateBackup('homedir')}
                  className="text-xs border-slate-300"
                >
                  Download Home Dir
                </Button>
              </div>

              {/* MySQL Databases Button & Selector */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Database className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">MySQL Database Backup</div>
                      <div className="text-[11px] text-slate-500">Export SQL dumps of database tables</div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={!!creatingType}
                    onClick={() => handleCreateBackup('databases', selectedDb || null)}
                    className="text-xs border-slate-300"
                  >
                    Download SQL
                  </Button>
                </div>
                {databases.length > 0 && (
                  <div className="flex items-center space-x-2 pt-1 border-t border-slate-200/60">
                    <span className="text-[11px] text-slate-500">Database:</span>
                    <select
                      value={selectedDb}
                      onChange={(e) => setSelectedDb(e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded px-2 py-1 font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                    >
                      <option value="">All Databases ({databases.length})</option>
                      {databases.map(d => (
                        <option key={d.name} value={d.name}>{d.name} ({d.size || '0 B'})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Email Forwarders / Accounts */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/50 transition">
                <div className="flex items-center space-x-2.5">
                  <Mail className="w-4 h-4 text-purple-500" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Email & Forwarders Backup</div>
                    <div className="text-[11px] text-slate-500">Accounts, mail routing & filters</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={!!creatingType}
                  onClick={() => handleCreateBackup('email')}
                  className="text-xs border-slate-300"
                >
                  Download Email
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backups Available Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
              <Archive className="w-4 h-4 text-indigo-600" />
              <span>Backups Available for Download ({backups.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Archives generated and stored on the server for download or one-click account restoration.
            </p>
          </div>
        </div>

        {backups.length === 0 ? (
          <div className="p-12 text-center">
            <Archive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700">No backups available</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Create a backup of your hosting account to safeguard your files, databases, and emails.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleCreateBackup('full')}
              disabled={!!creatingType}
              className="bg-[#27235C] hover:bg-[#1c1944] text-white"
            >
              Create Backup Now
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="py-3.5 px-4 w-4/12">Archive Name</th>
                  <th className="py-3.5 px-4 w-2/12">Type</th>
                  <th className="py-3.5 px-4 w-2/12">Size</th>
                  <th className="py-3.5 px-4 w-2/12">Date Created</th>
                  <th className="py-3.5 px-4 w-2/12 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {backups.map((b) => (
                  <tr key={b.id || b.filename} className="hover:bg-slate-50/70 transition-colors">
                    {/* Filename */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 flex items-center space-x-2">
                      <Archive className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="truncate max-w-xs" title={b.filename}>{b.filename}</span>
                    </td>

                    {/* Type Badge */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        b.type === 'full' 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                          : b.type === 'homedir' 
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : b.type === 'databases'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {b.type === 'full' ? 'Full Account' : b.type === 'homedir' ? 'Home Directory' : b.type === 'databases' ? 'Database' : 'Email'}
                      </span>
                    </td>

                    {/* Size */}
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {b.sizeFormatted || `${b.sizeMb || 0} MB`}
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(b.created).toLocaleString()}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleDownload(b)}
                          className="text-xs text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 flex items-center space-x-1"
                          title="Stream download archive to your computer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            setRestoreModalBackup(b);
                            setRestoreResult(null);
                          }}
                          className="text-xs text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 flex items-center space-x-1"
                          title="Restore this backup into the hosting account"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Restore</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setDetailsModalBackup(b)}
                          className="text-xs text-slate-600 border-slate-200 hover:bg-slate-100"
                          title="View backup details and checksum"
                        >
                          <Info className="w-3 h-3" />
                        </Button>

                        <Button
                          variant="danger"
                          size="xs"
                          onClick={() => setDeleteModalBackup(b)}
                          className="text-xs bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 p-1.5"
                          title="Delete this backup archive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 1. Backup Details Modal */}
      {detailsModalBackup && (
        <Modal
          isOpen={true}
          onClose={() => setDetailsModalBackup(null)}
          title="Backup Archive Details"
        >
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Archive File:</span>
                <span className="font-mono font-bold text-slate-800">{detailsModalBackup.filename}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Backup Type:</span>
                <span className="capitalize font-bold text-indigo-700">{detailsModalBackup.type} Backup</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Size:</span>
                <span className="font-mono text-slate-800">{detailsModalBackup.sizeFormatted || `${detailsModalBackup.sizeMb} MB`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Created At:</span>
                <span className="font-mono text-slate-600">{new Date(detailsModalBackup.created).toLocaleString()}</span>
              </div>
            </div>

            {/* SHA-256 Hash */}
            {detailsModalBackup.sha256 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center space-x-1">
                  <Hash className="w-3.5 h-3.5 text-indigo-600" />
                  <span>SHA-256 Integrity Checksum</span>
                </label>
                <div className="flex items-center space-x-2 bg-slate-100 p-2 rounded-lg border border-slate-300">
                  <span className="font-mono text-[11px] text-slate-700 truncate select-all">{detailsModalBackup.sha256}</span>
                  <button
                    onClick={() => copyChecksum(detailsModalBackup.sha256)}
                    className="p-1 hover:bg-slate-200 rounded text-slate-600"
                    title="Copy checksum"
                  >
                    {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Components Included */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Included Components
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(detailsModalBackup.components || ['homedir', 'databases', 'email', 'domains']).map(c => (
                  <span key={c} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1">
                    <Check className="w-3 h-3" />
                    <span className="capitalize">{c}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setDetailsModalBackup(null)}
                className="bg-[#27235C] hover:bg-[#1c1944] text-white"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 2. Restore Confirmation Modal */}
      {restoreModalBackup && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!restoring) {
              setRestoreModalBackup(null);
              setRestoreResult(null);
            }
          }}
          title="Restore Account Backup"
        >
          <div className="space-y-4">
            {!restoreResult ? (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start space-x-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Important Restoration Warning:</strong>
                    Restoring this backup archive (<span className="font-mono font-bold text-slate-900">{restoreModalBackup.filename}</span>) will extract files and overwrite existing files and database tables in your account.
                  </div>
                </div>

                <p className="text-xs text-slate-600">
                  Are you sure you want to proceed with restoring this backup into your active hosting directory?
                </p>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={restoring}
                    onClick={() => setRestoreModalBackup(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={restoring}
                    onClick={handleConfirmRestore}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1"
                  >
                    {restoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>{restoring ? 'Restoring Archive...' : 'Confirm & Restore'}</span>
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3 text-center py-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm text-slate-900">Restoration Completed Successfully!</h4>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1 text-left">
                  <div>Files Restored: <strong className="font-mono">{restoreResult.stats?.filesRestored || 0}</strong></div>
                  <div>Databases Restored: <strong className="font-mono">{restoreResult.stats?.databasesRestored || 0}</strong></div>
                  <div>Email Configuration: <strong className="text-emerald-700 font-bold">{restoreResult.stats?.emailRestored ? 'Restored' : 'Unchanged'}</strong></div>
                </div>
                <div className="flex justify-center pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setRestoreModalBackup(null);
                      setRestoreResult(null);
                    }}
                    className="bg-[#27235C] text-white"
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 3. Delete Confirmation Modal */}
      {deleteModalBackup && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteModalBackup(null)}
          title="Delete Backup Archive"
        >
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 flex items-start space-x-2.5">
              <Trash2 className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Permanently Delete Backup:</strong>
                Are you sure you want to permanently delete the archive <strong className="font-mono">{deleteModalBackup.filename}</strong>? This action cannot be undone.
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={deleting}
                onClick={() => setDeleteModalBackup(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white flex items-center space-x-1"
              >
                {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{deleting ? 'Deleting...' : 'Delete Backup'}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
