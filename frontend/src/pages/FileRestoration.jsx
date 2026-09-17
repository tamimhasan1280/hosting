import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Folder, File, RefreshCw, CheckCircle2, AlertTriangle, 
  ChevronRight, ArrowLeft, Search, Check, Copy, HardDrive, 
  Archive, ShieldCheck, DownloadCloud, Clock, Eye, AlertCircle, 
  ExternalLink, Layers, X, Trash2, FolderPlus, FileText
} from 'lucide-react';

export default function FileRestoration({ onOpenFileManager, onNavigate }) {
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [selectedBackup, setSelectedBackup] = useState(null);
  
  // Backup Contents State
  const [archiveData, setArchiveData] = useState(null);
  const [loadingContents, setLoadingContents] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(''); // relative path inside homedir
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedPaths, setSelectedPaths] = useState(new Set());

  // Destination & Conflict Options
  const [destinationMode, setDestinationMode] = useState('original'); // 'original' | 'custom'
  const [customDestination, setCustomDestination] = useState('public_html/restored');
  const [conflictMode, setConflictMode] = useState('overwrite'); // 'overwrite' | 'skip' | 'missing_only'

  // Validation & Modal State
  const [validationData, setValidationData] = useState(null);
  const [validating, setValidating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Restore Execution & Job Tracking
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // Notifications
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Search & Sorting for Backups
  const [backupSearch, setBackupSearch] = useState('');
  const [backupSort, setBackupSort] = useState('date_desc');

  const showNotification = (msg, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 6000);
    } else {
      setStatusMsg(msg);
      setTimeout(() => setStatusMsg(''), 4000);
    }
  };

  // 1. Load Available Backups
  const loadBackups = async () => {
    setLoadingBackups(true);
    setErrorMsg('');
    try {
      const data = await api.getRestoreBackups();
      setBackups(Array.isArray(data) ? data : []);
    } catch (err) {
      showNotification('Failed to load backup archives: ' + err.message, true);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  // 2. Select Backup & Load Contents
  const handleSelectBackup = async (backup) => {
    setSelectedBackup(backup);
    setLoadingContents(true);
    setArchiveData(null);
    setCurrentFolder('');
    setSelectedPaths(new Set());
    setJobStatus(null);
    setActiveJobId(null);

    try {
      const data = await api.getRestoreBackupContents(backup.id);
      setArchiveData(data);
    } catch (err) {
      showNotification('Failed to open backup contents: ' + err.message, true);
    } finally {
      setLoadingContents(false);
    }
  };

  // 3. Selection Helpers
  const toggleSelectPath = (itemPath, isDirectory) => {
    const next = new Set(selectedPaths);
    const cleanPath = itemPath.replace(/^\/+/, '').replace(/\/$/, '');

    if (next.has(cleanPath)) {
      // Unselect item
      next.delete(cleanPath);
      // If directory, also unselect children
      if (isDirectory && archiveData?.entries) {
        for (const entry of archiveData.entries) {
          if (entry.path.startsWith(cleanPath + '/')) {
            next.delete(entry.path);
          }
        }
      }
    } else {
      // Select item
      next.add(cleanPath);
      // If directory, also select all children
      if (isDirectory && archiveData?.entries) {
        for (const entry of archiveData.entries) {
          if (entry.path.startsWith(cleanPath + '/')) {
            next.add(entry.path);
          }
        }
      }
    }
    setSelectedPaths(next);
  };

  const selectAllCurrentFolder = () => {
    if (!archiveData?.entries) return;
    const next = new Set(selectedPaths);
    const itemsInFolder = getItemsInCurrentFolder();
    for (const item of itemsInFolder) {
      next.add(item.path);
      if (item.isDirectory) {
        for (const entry of archiveData.entries) {
          if (entry.path.startsWith(item.path + '/')) {
            next.add(entry.path);
          }
        }
      }
    }
    setSelectedPaths(next);
  };

  const clearSelection = () => {
    setSelectedPaths(new Set());
  };

  // 4. Filter Items in Current Folder
  const getItemsInCurrentFolder = () => {
    if (!archiveData?.entries) return [];

    let filtered = archiveData.entries;

    // Search filter across whole archive if search term provided
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      return filtered.filter(e => e.path.toLowerCase().includes(q));
    }

    // Otherwise show items in current folder
    const targetParent = currentFolder;
    return filtered.filter(e => e.parentPath === targetParent);
  };

  // Calculate Selection Summary
  const getSelectionStats = () => {
    if (!archiveData?.entries) return { files: 0, dirs: 0, bytes: 0 };
    let files = 0;
    let dirs = 0;
    let bytes = 0;

    for (const p of selectedPaths) {
      const entry = archiveData.entries.find(e => e.path === p);
      if (entry) {
        if (entry.isDirectory) dirs++;
        else {
          files++;
          bytes += entry.sizeBytes || 0;
        }
      }
    }
    return { files, dirs, bytes };
  };

  // 5. Pre-flight Validation
  const handleOpenRestoreModal = async () => {
    if (selectedPaths.size === 0) {
      showNotification('Please select at least one file or directory to restore', true);
      return;
    }

    setValidating(true);
    setErrorMsg('');
    try {
      const res = await api.validateFileRestore({
        backupId: selectedBackup.id,
        selectedItems: Array.from(selectedPaths),
        destination: destinationMode === 'custom' ? customDestination.trim() : '',
        conflictMode
      });
      setValidationData(res);
      setShowConfirmModal(true);
    } catch (err) {
      showNotification('Validation failed: ' + err.message, true);
    } finally {
      setValidating(false);
    }
  };

  // 6. Execute Restore Job
  const handleConfirmRestore = async () => {
    setShowConfirmModal(false);
    setRestoring(true);
    setJobStatus(null);
    try {
      const res = await api.startFileRestoreJob({
        backupId: selectedBackup.id,
        selectedItems: Array.from(selectedPaths),
        destination: destinationMode === 'custom' ? customDestination.trim() : '',
        conflictMode
      });
      setActiveJobId(res.jobId);
      pollJobStatus(res.jobId);
    } catch (err) {
      showNotification('Failed to start restore job: ' + err.message, true);
      setRestoring(false);
    }
  };

  // 7. Poll Job Status
  const pollJobStatus = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.getFileRestoreJobStatus(jobId);
        if (res.job) {
          setJobStatus(res.job);
          if (res.job.status === 'completed' || res.job.status === 'completed_with_errors' || res.job.status === 'failed' || res.job.status === 'cancelled') {
            clearInterval(interval);
            setRestoring(false);
            if (res.job.status === 'completed') {
              showNotification('Files and directories restored successfully!');
            } else if (res.job.status === 'completed_with_errors') {
              showNotification('Restoration completed with some skipped/failed items', true);
            }
          }
        }
      } catch (err) {
        clearInterval(interval);
        setRestoring(false);
      }
    }, 800);
  };

  // 8. Cancel Job
  const handleCancelJob = async () => {
    if (!activeJobId) return;
    try {
      await api.cancelFileRestoreJob(activeJobId);
      showNotification('Restore job cancellation requested');
    } catch (err) {
      showNotification('Cancel failed: ' + err.message, true);
    }
  };

  // Filtered & Sorted Backups
  const filteredBackups = backups
    .filter(b => b.filename.toLowerCase().includes(backupSearch.toLowerCase()))
    .sort((a, b) => {
      if (backupSort === 'date_desc') return new Date(b.createdAt) - new Date(a.createdAt);
      if (backupSort === 'date_asc') return new Date(a.createdAt) - new Date(b.createdAt);
      if (backupSort === 'size_desc') return b.sizeBytes - a.sizeBytes;
      if (backupSort === 'size_asc') return a.sizeBytes - b.sizeBytes;
      return 0;
    });

  const selectionStats = getSelectionStats();
  const displayedItems = getItemsInCurrentFolder();

  return (
    <div className="space-y-6">
      {/* Header & Jupiter Breadcrumbs */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <span>Home</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span>Files</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[#ff6c2c]">File and Directory Restoration</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <RefreshCw className="w-6 h-6 text-[#ff6c2c]" />
              File and Directory Restoration
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Restore individual files and directories from previous cPanel backup archives into your live account directory without overwriting unrelated database tables or account settings.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedBackup && (
              <button
                onClick={() => { setSelectedBackup(null); setArchiveData(null); setJobStatus(null); }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Change Backup
              </button>
            )}
            <button
              onClick={loadBackups}
              title="Refresh available backups"
              className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {statusMsg && (
          <div className="mt-4 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 animate-fade">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 bg-rose-50 text-rose-800 border border-rose-200 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 animate-fade">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: SELECT A BACKUP ARCHIVE */}
      {/* ========================================================================= */}
      {!selectedBackup && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Archive className="w-4 h-4 text-[#ff6c2c]" /> Select a Backup Archive ({filteredBackups.length})
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Choose a completed account backup containing files and directories.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={backupSearch}
                onChange={(e) => setBackupSearch(e.target.value)}
                placeholder="Search backups..."
                className="border border-slate-300 bg-white px-3 py-1.5 text-xs rounded-lg focus:outline-none focus:border-[#ff6c2c]"
              />
              <select
                value={backupSort}
                onChange={(e) => setBackupSort(e.target.value)}
                className="border border-slate-300 bg-white px-2.5 py-1.5 text-xs rounded-lg focus:outline-none"
              >
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="size_desc">Largest Size</option>
                <option value="size_asc">Smallest Size</option>
              </select>
            </div>
          </div>

          {loadingBackups ? (
            <div className="p-12 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#ff6c2c] mb-2" />
              Scanning for available account backups...
            </div>
          ) : filteredBackups.length === 0 ? (
            <div className="p-12 text-center">
              <Archive className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No Backups Available for Restoration</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                There are currently no completed backup archives stored on the server for this hosting account.
              </p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('backup_wizard')}
                  className="mt-4 bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                >
                  Create a Backup in Backup Wizard
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-3 px-5">Backup Name & Archive</th>
                    <th className="py-3 px-5">Type</th>
                    <th className="py-3 px-5">Size</th>
                    <th className="py-3 px-5">Created Date</th>
                    <th className="py-3 px-5">Integrity</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBackups.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-slate-900 font-mono flex items-center gap-2">
                          <Archive className="w-4 h-4 text-[#ff6c2c] flex-shrink-0" />
                          <span>{b.filename}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200">
                          {b.typeFormatted || b.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-mono font-medium text-slate-700">
                        {b.sizeFormatted}
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 text-[11px]">
                        {new Date(b.createdAt).toLocaleDateString()} {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-5">
                        {b.sha256 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <ShieldCheck className="w-3.5 h-3.5" /> SHA-256 Verified
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Ready</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => handleSelectBackup(b)}
                          className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition"
                        >
                          Browse Files
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: BROWSE ARCHIVE & RESTORE CONTROL */}
      {/* ========================================================================= */}
      {selectedBackup && (
        <div className="space-y-6">
          {/* Selected Backup Banner */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#ff6c2c]">Selected Archive</span>
              <div className="text-sm font-bold text-slate-900 font-mono flex items-center gap-2 mt-0.5">
                <Archive className="w-4 h-4 text-[#ff6c2c]" />
                {selectedBackup.filename}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                <span>Size: <strong className="text-slate-700">{selectedBackup.sizeFormatted}</strong></span>
                <span>•</span>
                <span>Type: <strong className="text-slate-700">{selectedBackup.typeFormatted || selectedBackup.type}</strong></span>
                <span>•</span>
                <span>Created: {new Date(selectedBackup.createdAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Selection Counter & Action */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-bold text-slate-800">
                  {selectionStats.files} file(s), {selectionStats.dirs} folder(s)
                </div>
                <div className="text-[11px] text-slate-500">
                  {formatBytes(selectionStats.bytes)} selected
                </div>
              </div>
              <button
                onClick={handleOpenRestoreModal}
                disabled={selectedPaths.size === 0 || validating || restoring}
                className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {validating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Restore Selected Items
              </button>
            </div>
          </div>

          {/* Active Job Progress View */}
          {restoring && jobStatus && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-blue-200 bg-blue-50/20 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-5 h-5 text-[#ff6c2c] animate-spin" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Restoration in Progress</h3>
                    <p className="text-xs text-slate-500">{jobStatus.progress?.message || 'Processing files...'}</p>
                  </div>
                </div>
                <button
                  onClick={handleCancelJob}
                  className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs font-semibold rounded-lg transition"
                >
                  Cancel Restoration
                </button>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-[#ff6c2c] h-full transition-all duration-300"
                    style={{ width: `${jobStatus.progress?.percent || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                  <span>Processed: {jobStatus.progress?.processedCount || 0} / {jobStatus.progress?.totalCount || 0}</span>
                  <span>{jobStatus.progress?.percent || 0}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Completed Job Report Banner */}
          {!restoring && jobStatus && (jobStatus.status === 'completed' || jobStatus.status === 'completed_with_errors') && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-emerald-200 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {jobStatus.status === 'completed' ? 'Restoration Completed Successfully' : 'Restoration Completed with Errors'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Destination: <span className="font-mono text-slate-800">{jobStatus.destination}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onOpenFileManager && (
                    <button
                      onClick={() => onOpenFileManager(jobStatus.destinationRel || 'public_html')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition inline-flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open in File Manager
                    </button>
                  )}
                  <button
                    onClick={() => setJobStatus(null)}
                    className="px-3 py-1.5 border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs rounded-lg transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                  <span className="text-emerald-700 font-bold text-lg">{jobStatus.stats?.restoredCount || 0}</span>
                  <div className="text-[11px] text-emerald-800 font-semibold">Restored</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                  <span className="text-amber-700 font-bold text-lg">{jobStatus.stats?.skippedCount || 0}</span>
                  <div className="text-[11px] text-amber-800 font-semibold">Skipped (Conflicts)</div>
                </div>
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                  <span className="text-red-700 font-bold text-lg">{jobStatus.stats?.failedCount || 0}</span>
                  <div className="text-[11px] text-red-800 font-semibold">Failed</div>
                </div>
              </div>
            </div>
          )}

          {/* File Browser Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Toolbar & Breadcrumbs */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Folder Breadcrumbs */}
                <div className="flex items-center gap-1.5 text-xs font-mono overflow-x-auto py-1">
                  <button
                    onClick={() => setCurrentFolder('')}
                    className={`px-2 py-1 rounded ${currentFolder === '' ? 'bg-[#ff6c2c] text-white font-bold' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                  >
                    /home
                  </button>
                  {currentFolder.split('/').filter(Boolean).map((part, idx, arr) => {
                    const targetSub = arr.slice(0, idx + 1).join('/');
                    const isLast = idx === arr.length - 1;
                    return (
                      <React.Fragment key={idx}>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <button
                          onClick={() => setCurrentFolder(targetSub)}
                          className={`px-2 py-1 rounded ${isLast ? 'bg-[#ff6c2c] text-white font-bold' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                        >
                          {part}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Quick Search */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search archive files..."
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 bg-white rounded-lg focus:outline-none focus:border-[#ff6c2c] w-full sm:w-56"
                    />
                  </div>
                  {searchFilter && (
                    <button
                      onClick={() => setSearchFilter('')}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Selection Batch Controls */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/80">
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllCurrentFolder}
                    className="text-[#ff6c2c] hover:underline font-semibold"
                  >
                    Select All in this Folder
                  </button>
                  <span>•</span>
                  <button
                    onClick={clearSelection}
                    className="text-slate-500 hover:underline"
                  >
                    Clear Selection
                  </button>
                </div>
                <div className="text-slate-500">
                  Showing <strong className="text-slate-700">{displayedItems.length}</strong> items
                </div>
              </div>
            </div>

            {/* Contents Table */}
            {loadingContents ? (
              <div className="p-12 text-center text-xs text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#ff6c2c] mb-2" />
                Reading files and directories from backup archive...
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                <Folder className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">Folder is Empty</p>
                <p className="text-slate-400 mt-0.5">No files or subfolders found in this directory level.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4 w-10 text-center">
                        {/* Header checkbox */}
                      </th>
                      <th className="py-2.5 px-4">Name</th>
                      <th className="py-2.5 px-4">Size</th>
                      <th className="py-2.5 px-4">Modified</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Up one level button if inside subfolder */}
                    {currentFolder && !searchFilter && (
                      <tr 
                        onClick={() => {
                          const parts = currentFolder.split('/');
                          setCurrentFolder(parts.slice(0, -1).join('/'));
                        }}
                        className="hover:bg-slate-50 cursor-pointer text-slate-600 bg-slate-50/50"
                      >
                        <td className="py-2.5 px-4 text-center"></td>
                        <td className="py-2.5 px-4 font-bold flex items-center gap-2">
                          <Folder className="w-4 h-4 text-slate-400" />
                          <span>.. (Up one level)</span>
                        </td>
                        <td className="py-2.5 px-4">—</td>
                        <td className="py-2.5 px-4">—</td>
                        <td className="py-2.5 px-4 text-right"></td>
                      </tr>
                    )}

                    {displayedItems.map((item, idx) => {
                      const isSelected = selectedPaths.has(item.path);
                      return (
                        <tr 
                          key={idx} 
                          className={`hover:bg-slate-50 transition ${isSelected ? 'bg-orange-50/30' : ''}`}
                        >
                          <td className="py-2.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectPath(item.path, item.isDirectory)}
                              className="rounded text-[#ff6c2c] focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2 font-mono">
                              {item.isDirectory ? (
                                <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              )}
                              <span 
                                onClick={() => {
                                  if (item.isDirectory) setCurrentFolder(item.path);
                                }}
                                className={`${item.isDirectory ? 'cursor-pointer font-bold text-slate-900 hover:text-[#ff6c2c]' : 'text-slate-800'}`}
                              >
                                {item.name}
                              </span>
                            </div>
                            {searchFilter && (
                              <div className="text-[10px] text-slate-400 font-mono pl-6">
                                /{item.path}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-600">
                            {item.sizeFormatted}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                            {item.modifiedTime ? new Date(item.modifiedTime).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {item.isDirectory ? (
                              <button
                                onClick={() => setCurrentFolder(item.path)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded"
                              >
                                Open Folder
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {item.crc ? `CRC: ${item.crc}` : ''}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RESTORE CONFIRMATION & PRE-FLIGHT MODAL */}
      {/* ========================================================================= */}
      {showConfirmModal && validationData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#ff6c2c]" />
                <h3 className="text-sm font-bold text-slate-900">Confirm File & Directory Restoration</h3>
              </div>
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Destination Selector */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Restore Destination:</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="dest_mode"
                      value="original"
                      checked={destinationMode === 'original'}
                      onChange={() => setDestinationMode('original')}
                      className="text-[#ff6c2c] focus:ring-0"
                    />
                    <span>Restore to original account location (<code>/home/user/</code>)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="dest_mode"
                      value="custom"
                      checked={destinationMode === 'custom'}
                      onChange={() => setDestinationMode('custom')}
                      className="text-[#ff6c2c] focus:ring-0"
                    />
                    <span>Restore into custom directory</span>
                  </label>
                </div>
                {destinationMode === 'custom' && (
                  <div className="mt-2 flex items-center">
                    <span className="bg-slate-100 border border-r-0 border-slate-300 px-3 py-1.5 text-xs text-slate-500 rounded-l-lg font-mono">
                      /home/user/
                    </span>
                    <input
                      type="text"
                      value={customDestination}
                      onChange={(e) => setCustomDestination(e.target.value)}
                      placeholder="public_html/restored"
                      className="w-full border border-slate-300 px-3 py-1.5 text-xs rounded-r-lg focus:outline-none focus:border-[#ff6c2c] font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Conflict Handling Mode */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Conflict & Overwrite Resolution:</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="conflict_mode"
                      value="overwrite"
                      checked={conflictMode === 'overwrite'}
                      onChange={() => setConflictMode('overwrite')}
                      className="text-[#ff6c2c] focus:ring-0"
                    />
                    <span><strong>Overwrite:</strong> Replace existing live files with backup versions</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="conflict_mode"
                      value="skip"
                      checked={conflictMode === 'skip'}
                      onChange={() => setConflictMode('skip')}
                      className="text-[#ff6c2c] focus:ring-0"
                    />
                    <span><strong>Skip:</strong> Keep existing live files (do not overwrite)</span>
                  </label>
                </div>
              </div>

              {/* Validation Summary Card */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Source Archive:</span>
                  <span className="font-mono font-bold text-slate-800 truncate max-w-xs">{validationData.backupFilename}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Items to Restore:</span>
                  <span className="font-bold text-slate-800">{validationData.expectedFilesCount} files, {validationData.expectedDirectoriesCount} folders</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimated Uncompressed Size:</span>
                  <span className="font-mono font-bold text-slate-800">{validationData.estimatedSizeFormatted}</span>
                </div>
                {validationData.overwriteCount > 0 && conflictMode === 'overwrite' && (
                  <div className="flex justify-between text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 mt-2 font-semibold">
                    <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Overwrite Warning:</span>
                    <span>{validationData.overwriteCount} existing file(s) will be overwritten</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm transition"
              >
                Start Restoration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
