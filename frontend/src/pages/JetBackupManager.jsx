import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { 
  Archive, RefreshCw, HardDrive, ShieldCheck, CheckCircle2, 
  AlertTriangle, ArrowLeft, Search, Check, Copy, Clock, 
  DownloadCloud, Eye, AlertCircle, ExternalLink, Layers, 
  X, Trash2, Folder, File, Database, Mail, Sliders, 
  Play, StopCircle, CheckCircle, Info, ChevronRight, Server,
  Radio, Shield, FileText, ArrowRight, RotateCcw
} from 'lucide-react';

export default function JetBackupManager({ onOpenFileManager, onNavigate }) {
  // Active Top Tab: 'overview' | 'points' | 'destinations' | 'schedules' | 'queue'
  const [activeTab, setActiveTab] = useState('overview');

  // Overview & Capabilities State
  const [overview, setOverview] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Restore Points State
  const [points, setPoints] = useState([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Contents Inspection Drawer / Modal
  const [inspectingPoint, setInspectingPoint] = useState(null);
  const [contentsData, setContentsData] = useState(null);
  const [loadingContents, setLoadingContents] = useState(false);
  const [contentCategory, setContentCategory] = useState('files'); // 'files' | 'databases' | 'emails' | 'cron'
  const [fileFolder, setFileFolder] = useState('');
  const [selectedFilePaths, setSelectedFilePaths] = useState(new Set());

  // Restore Action Modals
  const [fileRestoreModal, setFileRestoreModal] = useState(false);
  const [fileDestMode, setFileDestMode] = useState('original');
  const [customFileDest, setCustomFileDest] = useState('public_html/restored');
  const [conflictMode, setConflictMode] = useState('overwrite');
  const [fileValidation, setFileValidation] = useState(null);
  const [validatingFileRestore, setValidatingFileRestore] = useState(false);

  const [dbRestoreModal, setDbRestoreModal] = useState(false);
  const [selectedDbEntry, setSelectedDbEntry] = useState(null);
  const [targetDbName, setTargetDbName] = useState('');
  const [dbValidation, setDbValidation] = useState(null);
  const [validatingDbRestore, setValidatingDbRestore] = useState(false);

  const [mailRestoreModal, setMailRestoreModal] = useState(false);
  const [selectedMailEntry, setSelectedMailEntry] = useState(null);

  // Destinations & Schedules
  const [destinations, setDestinations] = useState([]);
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [testingDestId, setTestingDestId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const [schedules, setSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [runningSchedId, setRunningSchedId] = useState(null);

  // Queue & Jobs
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobLog, setSelectedJobLog] = useState(null);
  const [cancellingJobId, setCancellingJobId] = useState(null);

  // Notifications
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const pollIntervalRef = useRef(null);

  const showNotification = (msg, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 6000);
    } else {
      setStatusMsg(msg);
      setTimeout(() => setStatusMsg(''), 4000);
    }
  };

  // 1. Initial Load: Overview & Capabilities
  const loadOverview = async () => {
    setLoadingOverview(true);
    try {
      const [capsRes, overRes] = await Promise.all([
        api.getJetBackupCapabilities(),
        api.getJetBackupOverview()
      ]);
      setCapabilities(capsRes);
      setOverview(overRes);
    } catch (err) {
      showNotification('Failed to initialize JetBackup 5: ' + err.message, true);
    } finally {
      setLoadingOverview(false);
    }
  };

  // 2. Load Restore Points
  const loadPoints = async () => {
    setLoadingPoints(true);
    try {
      const res = await api.getJetBackupPoints({
        search: searchQuery,
        type: typeFilter,
        status: statusFilter
      });
      setPoints(Array.isArray(res) ? res : []);
    } catch (err) {
      showNotification('Failed to load restore points: ' + err.message, true);
    } finally {
      setLoadingPoints(false);
    }
  };

  // 3. Load Destinations
  const loadDestinations = async () => {
    setLoadingDestinations(true);
    try {
      const res = await api.getJetDestinations();
      setDestinations(Array.isArray(res) ? res : []);
    } catch (err) {
      showNotification('Failed to load destinations: ' + err.message, true);
    } finally {
      setLoadingDestinations(false);
    }
  };

  // 4. Load Schedules
  const loadSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const res = await api.getJetSchedules();
      setSchedules(Array.isArray(res) ? res : []);
    } catch (err) {
      showNotification('Failed to load schedules: ' + err.message, true);
    } finally {
      setLoadingSchedules(false);
    }
  };

  // 5. Load Jobs Queue
  const loadJobs = async () => {
    setLoadingJobs(true);
    try {
      const res = await api.getJetJobs();
      setJobs(Array.isArray(res) ? res : []);
    } catch (err) {
      // quiet fail on polling
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (activeTab === 'points') loadPoints();
    if (activeTab === 'destinations') loadDestinations();
    if (activeTab === 'schedules') loadSchedules();
    if (activeTab === 'queue') loadJobs();
  }, [activeTab]);

  // Search & filter triggers for Points
  useEffect(() => {
    if (activeTab === 'points') {
      const timer = setTimeout(loadPoints, 200);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, typeFilter, statusFilter]);

  // Auto-polling for active queue jobs
  useEffect(() => {
    const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'restoring' || j.status === 'in_progress');
    if (activeTab === 'queue' || hasRunning) {
      pollIntervalRef.current = setInterval(loadJobs, 2500);
    } else {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeTab, jobs]);

  // Open Content Inspector for a Backup Point
  const handleInspectPoint = async (point) => {
    setInspectingPoint(point);
    setLoadingContents(true);
    setContentsData(null);
    setContentCategory('files');
    setFileFolder('');
    setSelectedFilePaths(new Set());
    try {
      const res = await api.getJetBackupContents(point.id);
      setContentsData(res);
    } catch (err) {
      showNotification('Failed to inspect backup contents: ' + err.message, true);
    } finally {
      setLoadingContents(false);
    }
  };

  // Toggle file selection inside contents inspector
  const toggleFileSelect = (filePath) => {
    setSelectedFilePaths(prev => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  };

  // Select all visible files in current folder
  const handleSelectAllVisible = (entries) => {
    const next = new Set(selectedFilePaths);
    const allSelected = entries.every(e => next.has(e.path));
    if (allSelected) {
      entries.forEach(e => next.delete(e.path));
    } else {
      entries.forEach(e => next.add(e.path));
    }
    setSelectedFilePaths(next);
  };

  // Pre-flight File Restore Validation
  const handlePrepareFileRestore = async () => {
    if (selectedFilePaths.size === 0) {
      showNotification('Please select at least one file or directory to restore.', true);
      return;
    }
    setValidatingFileRestore(true);
    try {
      const targetDest = fileDestMode === 'original' ? '' : customFileDest;
      const res = await api.validateFileRestore({
        backupId: inspectingPoint.id,
        selectedItems: Array.from(selectedFilePaths),
        destination: targetDest,
        conflictMode
      });
      setFileValidation(res);
      setFileRestoreModal(true);
    } catch (err) {
      showNotification('Validation error: ' + err.message, true);
    } finally {
      setValidatingFileRestore(false);
    }
  };

  // Execute File Restore Job
  const handleExecuteFileRestore = async () => {
    try {
      const targetDest = fileDestMode === 'original' ? '' : customFileDest;
      const res = await api.executeFileRestore({
        backupId: inspectingPoint.id,
        selectedItems: Array.from(selectedFilePaths),
        destination: targetDest,
        conflictMode
      });
      setFileRestoreModal(false);
      showNotification('File restore job queued successfully! Job ID: ' + res.jobId);
      setActiveTab('queue');
      loadJobs();
    } catch (err) {
      showNotification('Failed to start file restore job: ' + err.message, true);
    }
  };

  // Open Database Restore Modal
  const handlePrepareDbRestore = async (dbEntry) => {
    setSelectedDbEntry(dbEntry);
    setTargetDbName(dbEntry.name);
    setValidatingDbRestore(true);
    try {
      const res = await api.validateJetDatabaseRestore({
        backupId: inspectingPoint.id,
        dbName: dbEntry.name,
        targetDbName: dbEntry.name
      });
      setDbValidation(res);
      setDbRestoreModal(true);
    } catch (err) {
      showNotification('Database validation failed: ' + err.message, true);
    } finally {
      setValidatingDbRestore(false);
    }
  };

  // Execute Database Restore
  const handleExecuteDbRestore = async () => {
    try {
      const res = await api.restoreJetDatabase({
        backupId: inspectingPoint.id,
        dbName: selectedDbEntry.name,
        targetDbName: targetDbName || selectedDbEntry.name
      });
      setDbRestoreModal(false);
      showNotification('Database restoration job queued! Job ID: ' + res.jobId);
      setActiveTab('queue');
      loadJobs();
    } catch (err) {
      showNotification('Database restore failed: ' + err.message, true);
    }
  };

  // Open Email Restore Modal
  const handlePrepareEmailRestore = (mailEntry) => {
    setSelectedMailEntry(mailEntry);
    setMailRestoreModal(true);
  };

  // Execute Email Restore
  const handleExecuteEmailRestore = async () => {
    try {
      const res = await api.restoreJetEmail({
        backupId: inspectingPoint.id,
        mailboxEmail: selectedMailEntry.email
      });
      setMailRestoreModal(false);
      showNotification('Email restoration job queued! Job ID: ' + res.jobId);
      setActiveTab('queue');
      loadJobs();
    } catch (err) {
      showNotification('Email restore failed: ' + err.message, true);
    }
  };

  // Test Destination Connection
  const handleTestDestination = async (destId) => {
    setTestingDestId(destId);
    setTestResult(null);
    try {
      const res = await api.testJetDestination(destId);
      setTestResult(res);
      showNotification(res.message || 'Destination connection verified!');
      loadDestinations();
    } catch (err) {
      setTestResult({ success: false, error: err.message });
      showNotification('Destination test failed: ' + err.message, true);
    } finally {
      setTestingDestId(null);
    }
  };

  // Run Schedule Now
  const handleRunSchedule = async (schedId) => {
    setRunningSchedId(schedId);
    try {
      const res = await api.runJetSchedule(schedId);
      showNotification(res.message);
      setActiveTab('queue');
      loadJobs();
    } catch (err) {
      showNotification('Failed to run schedule: ' + err.message, true);
    } finally {
      setRunningSchedId(null);
    }
  };

  // Cancel Job
  const handleCancelJob = async (jobId) => {
    setCancellingJobId(jobId);
    try {
      await api.cancelJetJob(jobId);
      showNotification('Job cancellation requested.');
      loadJobs();
    } catch (err) {
      showNotification('Failed to cancel job: ' + err.message, true);
    } finally {
      setCancellingJobId(null);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Toast Notifications */}
      {statusMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-[4px] text-[13px] flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMsg}</span>
          </div>
          <button onClick={() => setStatusMsg('')} className="text-emerald-700 hover:text-emerald-900 font-bold ml-4">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-300 text-red-900 rounded-[4px] text-[13px] flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-700 hover:text-red-900 font-bold ml-4">✕</button>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
        <button onClick={() => onNavigate && onNavigate('dashboard')} className="hover:text-[#185dc4] hover:underline cursor-pointer">
          Home
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-400">Files</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-slate-700">JetBackup® 5</span>
      </div>

      {/* Page Header matching cPanel Jupiter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#e3e5e8]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#f35927]/10 flex items-center justify-center text-[#f35927]">
              <Archive className="w-5 h-5 stroke-[2]" />
            </div>
            <h1 className="text-[22px] font-bold text-[#1f2533] tracking-tight flex items-center gap-2">
              JetBackup® 5
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                {capabilities?.version || 'v5.3.18'}
              </span>
            </h1>
          </div>
          <p className="text-[13px] text-slate-600 mt-1">
            Enterprise disaster recovery, automated snapshot points, granular multi-category restoration, and storage vaults.
          </p>
        </div>

        {/* Engine Capability Status Pill */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-[4px] bg-slate-50 border border-slate-200 text-[11.5px] text-slate-600 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${capabilities?.installed ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
            <span className="font-medium">
              {capabilities?.installed ? 'Official JetBackup 5 Daemon' : 'cPanel Native Engine (JetBackup 5 Interface)'}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-[#d8dce2] bg-white px-2 pt-2 rounded-t-[4px] overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-[#f35927] text-[#f35927]'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          Dashboard Overview
        </button>

        <button
          onClick={() => setActiveTab('points')}
          className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'points'
              ? 'border-[#f35927] text-[#f35927]'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Archive className="w-4 h-4" />
          Restore Points
          {overview?.summary?.totalRestorePoints > 0 && (
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold">
              {overview?.summary?.totalRestorePoints}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('destinations')}
          className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'destinations'
              ? 'border-[#f35927] text-[#f35927]'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Server className="w-4 h-4" />
          Storage Destinations
        </button>

        <button
          onClick={() => setActiveTab('schedules')}
          className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'schedules'
              ? 'border-[#f35927] text-[#f35927]'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          Schedules & Automation
        </button>

        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'queue'
              ? 'border-[#f35927] text-[#f35927]'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Queue & Logs
          {jobs.some(j => j.status === 'running' || j.status === 'restoring') && (
            <span className="w-2 h-2 rounded-full bg-[#f35927] animate-pulse"></span>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW DASHBOARD */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {loadingOverview ? (
            <div className="bg-white border border-[#e3e5e8] rounded-[4px] p-8 text-center text-slate-500 text-[13px]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#f35927] mb-2" />
              Loading JetBackup 5 overview data...
            </div>
          ) : (
            <>
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#e3e5e8] rounded-[4px] p-4 shadow-2xs flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-medium text-slate-500 uppercase tracking-wider">Restore Points</div>
                    <div className="text-[24px] font-bold text-slate-800 mt-0.5">
                      {overview?.summary?.totalRestorePoints || 0}
                    </div>
                    <div className="text-[11.5px] text-slate-500 mt-1">Available for instant restore</div>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-blue-50 text-[#185dc4] flex items-center justify-center">
                    <Archive className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-[#e3e5e8] rounded-[4px] p-4 shadow-2xs flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-medium text-slate-500 uppercase tracking-wider">Backup Storage</div>
                    <div className="text-[24px] font-bold text-slate-800 mt-0.5">
                      {overview?.summary?.totalBackupSizeFormatted || '0 B'}
                    </div>
                    <div className="text-[11.5px] text-slate-500 mt-1">Total account archives size</div>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-orange-50 text-[#f35927] flex items-center justify-center">
                    <HardDrive className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-[#e3e5e8] rounded-[4px] p-4 shadow-2xs flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-medium text-slate-500 uppercase tracking-wider">Destinations</div>
                    <div className="text-[24px] font-bold text-slate-800 mt-0.5">
                      {overview?.summary?.destinationsCount || 0}
                    </div>
                    <div className="text-[11.5px] text-emerald-600 font-medium mt-1">All storage vaults active</div>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Server className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-[#e3e5e8] rounded-[4px] p-4 shadow-2xs flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-medium text-slate-500 uppercase tracking-wider">Active Jobs</div>
                    <div className="text-[24px] font-bold text-slate-800 mt-0.5">
                      {overview?.summary?.runningJobsCount || 0}
                    </div>
                    <div className="text-[11.5px] text-slate-500 mt-1">
                      {overview?.summary?.completedJobsCount || 0} completed in queue
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Sliders className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Quick Actions & Latest Restore Point */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left: Quick Actions */}
                <div className="bg-white border border-[#e3e5e8] rounded-[4px] p-5 shadow-2xs space-y-4">
                  <h2 className="text-[14px] font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-[#f35927]" />
                    Quick Restoration Actions
                  </h2>
                  <div className="space-y-2.5">
                    <button
                      onClick={() => setActiveTab('points')}
                      className="w-full text-left p-3 rounded-[4px] border border-slate-200 hover:border-[#185dc4] hover:bg-slate-50/70 transition-all flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-blue-100/60 text-[#185dc4] flex items-center justify-center">
                          <Folder className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-slate-800 group-hover:text-[#185dc4]">
                            Restore Home Directory & Files
                          </div>
                          <div className="text-[11.5px] text-slate-500">Granular file picker with collision safety</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#185dc4]" />
                    </button>

                    <button
                      onClick={() => setActiveTab('points')}
                      className="w-full text-left p-3 rounded-[4px] border border-slate-200 hover:border-[#185dc4] hover:bg-slate-50/70 transition-all flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-emerald-100/60 text-emerald-600 flex items-center justify-center">
                          <Database className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-slate-800 group-hover:text-[#185dc4]">
                            Restore MySQL Databases
                          </div>
                          <div className="text-[11.5px] text-slate-500">Import SQL dumps to live database instances</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#185dc4]" />
                    </button>

                    <button
                      onClick={() => setActiveTab('points')}
                      className="w-full text-left p-3 rounded-[4px] border border-slate-200 hover:border-[#185dc4] hover:bg-slate-50/70 transition-all flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-orange-100/60 text-orange-600 flex items-center justify-center">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-slate-800 group-hover:text-[#185dc4]">
                            Restore Mailbox Accounts
                          </div>
                          <div className="text-[11.5px] text-slate-500">Restore email records & directories</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#185dc4]" />
                    </button>
                  </div>
                </div>

                {/* Right: Latest Snapshot & Retention Breakdown */}
                <div className="lg:col-span-2 bg-white border border-[#e3e5e8] rounded-[4px] p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h2 className="text-[14px] font-bold text-slate-800 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Active Disaster Recovery Status
                    </h2>
                    <span className="text-[12px] text-slate-500">
                      Tier: Standard Account Policy
                    </span>
                  </div>

                  {overview?.summary?.latestRestorePoint ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-[4px] space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                          <span className="text-[13px] font-bold text-slate-800">
                            Latest Restore Point: {new Date(overview.summary.latestRestorePoint.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <span className="text-[12px] font-semibold text-slate-600 bg-white px-2.5 py-0.5 border border-slate-200 rounded">
                          {overview.summary.latestRestorePoint.sizeFormatted}
                        </span>
                      </div>
                      <div className="text-[12.5px] text-slate-600">
                        Archive ID: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11.5px]">{overview.summary.latestRestorePoint.id}</code>
                        {' '}• Type: <span className="capitalize font-semibold text-slate-700">{overview.summary.latestRestorePoint.type}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => setActiveTab('points')}
                          className="px-3 py-1.5 rounded-[3px] bg-[#f35927] hover:bg-[#e04817] text-white text-[12px] font-bold transition-colors cursor-pointer"
                        >
                          Browse Restore Points
                        </button>
                        <button
                          onClick={() => onNavigate && onNavigate('file_restoration')}
                          className="px-3 py-1.5 rounded-[3px] bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[12px] font-semibold transition-colors cursor-pointer"
                        >
                          Legacy Restoration Tool
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-[4px] text-center space-y-2">
                      <AlertCircle className="w-6 h-6 text-amber-500 mx-auto" />
                      <div className="text-[13.5px] font-semibold text-slate-700">No restore points available yet</div>
                      <div className="text-[12px] text-slate-500 max-w-md mx-auto">
                        Generate a backup using the Backup tool or run an automated schedule to establish your account disaster recovery snapshots.
                      </div>
                      <button
                        onClick={() => onNavigate && onNavigate('backups')}
                        className="mt-2 px-3 py-1.5 rounded-[3px] bg-[#f35927] hover:bg-[#e04817] text-white text-[12px] font-bold cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        Create Backup Now
                      </button>
                    </div>
                  )}

                  {/* Retention Tier Summary */}
                  <div className="pt-2">
                    <div className="text-[12.5px] font-bold text-slate-700 mb-2">Automated Retention Policy:</div>
                    <div className="grid grid-cols-3 gap-3 text-[12px]">
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-center">
                        <div className="font-bold text-slate-800">7 Days</div>
                        <div className="text-slate-500 text-[11px]">Daily Snapshots</div>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-center">
                        <div className="font-bold text-slate-800">4 Weeks</div>
                        <div className="text-slate-500 text-[11px]">Weekly Full Backups</div>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-center">
                        <div className="font-bold text-slate-800">3 Months</div>
                        <div className="text-slate-500 text-[11px]">Monthly Offsite Vault</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: RESTORE POINTS */}
      {/* ========================================================= */}
      {activeTab === 'points' && (
        <div className="space-y-4">
          {/* Controls / Filter Bar */}
          <div className="bg-white border border-[#e3e5e8] rounded-[4px] p-3.5 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by ID, file or component..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-[3px] text-[13px] focus:outline-none focus:border-[#f35927] focus:ring-1 focus:ring-[#f35927]"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-[12.5px] text-slate-600">
                <span>Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="border border-slate-300 rounded-[3px] px-2.5 py-1.5 text-[12.5px] bg-white text-slate-700 focus:outline-none focus:border-[#f35927]"
                >
                  <option value="all">All Types</option>
                  <option value="full">Full Account</option>
                  <option value="homedir">Home Directory</option>
                  <option value="databases">MySQL Databases</option>
                  <option value="email">Email Mailboxes</option>
                </select>
              </div>

              <button
                onClick={loadPoints}
                className="p-1.5 border border-slate-300 rounded-[3px] hover:bg-slate-100 text-slate-600 cursor-pointer"
                title="Refresh restore points"
              >
                <RefreshCw className={`w-4 h-4 ${loadingPoints ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Points Table */}
          <div className="bg-white border border-[#e3e5e8] rounded-[4px] shadow-2xs overflow-hidden">
            {loadingPoints ? (
              <div className="p-8 text-center text-slate-500 text-[13px]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#f35927] mb-2" />
                Loading restore points...
              </div>
            ) : points.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-[13px] space-y-2">
                <Archive className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="font-semibold text-slate-700">No backup points available</div>
                <div className="text-[12px] text-slate-500">There are currently no restore points matching your criteria.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-[#e3e5e8] text-[11.5px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Restore Point Date / ID</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Available Contents</th>
                      <th className="py-2.5 px-4">Size</th>
                      <th className="py-2.5 px-4">Integrity</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef0f3]">
                    {points.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-800">
                          <div className="font-semibold text-[13px]">
                            {new Date(p.createdAt).toLocaleString()}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {p.id}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`text-[11.5px] font-semibold px-2 py-0.5 rounded border capitalize ${
                            p.type === 'full' 
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : p.type === 'homedir'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : p.type === 'databases'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-orange-50 text-orange-700 border-orange-200'
                          }`}>
                            {p.type}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {p.components?.map(c => (
                              <span key={c} className="text-[10.5px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                                {c}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono text-[12.5px] text-slate-700">
                          {p.sizeFormatted}
                        </td>

                        <td className="py-3 px-4">
                          {p.sha256 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <ShieldCheck className="w-3 h-3" /> SHA-256 Verified
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500">Standard</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleInspectPoint(p)}
                              className="px-2.5 py-1 text-[12px] font-semibold bg-[#185dc4] hover:bg-[#13499b] text-white rounded-[3px] transition-colors cursor-pointer flex items-center gap-1"
                              title="Inspect archive contents & restore"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Contents
                            </button>

                            <a
                              href={api.getJetDownloadUrl(p.id)}
                              download
                              className="p-1 text-slate-600 hover:text-[#f35927] hover:bg-slate-100 rounded border border-slate-300 transition-colors"
                              title="Download backup archive"
                            >
                              <DownloadCloud className="w-4 h-4" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: STORAGE DESTINATIONS */}
      {/* ========================================================= */}
      {activeTab === 'destinations' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#e3e5e8] rounded-[4px] p-4 shadow-2xs">
            <h2 className="text-[14px] font-bold text-slate-800 mb-1">Configured Backup Storage Destinations</h2>
            <p className="text-[12.5px] text-slate-600">
              Storage vaults connected to this account for local snapshots, mounted recovery drives, and offsite remote archives.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {loadingDestinations ? (
              <div className="col-span-3 bg-white border border-[#e3e5e8] rounded-[4px] p-8 text-center text-slate-500 text-[13px]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#f35927] mb-2" />
                Loading storage vaults...
              </div>
            ) : destinations.map((d) => (
              <div key={d.id} className="bg-white border border-[#e3e5e8] rounded-[4px] p-4 shadow-2xs flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase ${
                      d.type === 'local' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {d.type} Vault
                    </span>
                    {d.isDefault && (
                      <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Default
                      </span>
                    )}
                  </div>

                  <div className="font-bold text-[14px] text-slate-800">{d.name}</div>

                  <div className="text-[12px] text-slate-600 space-y-1 font-mono">
                    {d.path && <div>Path: <span className="text-slate-800">{d.path}</span></div>}
                    {d.host && <div>Host: <span className="text-slate-800">{d.host}:{d.port || 21}</span></div>}
                    <div>Retention: <span className="font-sans font-bold text-slate-700">{d.retentionLimit} days</span></div>
                    <div>Max Capacity: <span className="font-sans text-slate-700">{d.maxStorageGb} GB</span></div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleTestDestination(d.id)}
                    disabled={testingDestId === d.id}
                    className="w-full py-1.5 px-3 rounded-[3px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingDestId === d.id ? 'animate-spin' : ''}`} />
                    {testingDestId === d.id ? 'Testing Storage...' : 'Test Connection'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: SCHEDULES & AUTOMATION */}
      {/* ========================================================= */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#e3e5e8] rounded-[4px] p-4 shadow-2xs">
            <h2 className="text-[14px] font-bold text-slate-800 mb-1">Automated Disaster Recovery Schedules</h2>
            <p className="text-[12.5px] text-slate-600">
              Configured automated backup runs, cron automation frequencies, and retention policies.
            </p>
          </div>

          <div className="bg-white border border-[#e3e5e8] rounded-[4px] shadow-2xs overflow-hidden">
            {loadingSchedules ? (
              <div className="p-8 text-center text-slate-500 text-[13px]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#f35927] mb-2" />
                Loading schedules...
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#f8f9fa] border-b border-[#e3e5e8] text-[11.5px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Schedule Name</th>
                    <th className="py-2.5 px-4">Frequency / Time</th>
                    <th className="py-2.5 px-4">Scope</th>
                    <th className="py-2.5 px-4">Retention</th>
                    <th className="py-2.5 px-4">Next Run</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0f3]">
                  {schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {s.name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-700 capitalize">{s.frequency}</div>
                        <div className="text-[11.5px] text-slate-500">{s.time}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                          {s.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {s.retention} points
                      </td>
                      <td className="py-3 px-4 text-[12px] text-slate-600">
                        {new Date(s.nextRun).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRunSchedule(s.id)}
                          disabled={runningSchedId === s.id}
                          className="px-3 py-1 bg-[#f35927] hover:bg-[#e04817] text-white text-[12px] font-bold rounded-[3px] transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          {runningSchedId === s.id ? 'Queueing...' : 'Run Now'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: QUEUE & LOGS */}
      {/* ========================================================= */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#e3e5e8] rounded-[4px] p-3.5 shadow-2xs flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-bold text-slate-800">JetBackup Real-Time Job Queue</h2>
              <p className="text-[12.5px] text-slate-600">Live monitoring of backup, file restore, database restore, and download tasks.</p>
            </div>
            <button
              onClick={loadJobs}
              className="p-1.5 border border-slate-300 rounded-[3px] hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Refresh job queue"
            >
              <RefreshCw className={`w-4 h-4 ${loadingJobs ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="bg-white border border-[#e3e5e8] rounded-[4px] shadow-2xs overflow-hidden">
            {jobs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-[13px] space-y-1">
                <Sliders className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                <div className="font-semibold text-slate-700">No active or previous jobs in queue</div>
                <div className="text-[12px] text-slate-500">Initiate a restore or backup operation to view real-time tracking here.</div>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#f8f9fa] border-b border-[#e3e5e8] text-[11.5px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Job ID / Type</th>
                    <th className="py-2.5 px-4">Target / Backup</th>
                    <th className="py-2.5 px-4">Status & Progress</th>
                    <th className="py-2.5 px-4">Started At</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0f3]">
                  {jobs.map((j) => {
                    const isRunning = j.status === 'running' || j.status === 'restoring' || j.status === 'in_progress';
                    const percent = j.progress?.percent !== undefined ? j.progress.percent : (j.status === 'completed' ? 100 : 0);

                    return (
                      <tr key={j.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 capitalize">
                            {j.type?.replace(/_/g, ' ')}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">{j.id}</div>
                        </td>

                        <td className="py-3 px-4 text-[12.5px] text-slate-700 font-mono">
                          {j.sourceDbName ? `DB: ${j.sourceDbName}` : j.mailboxEmail ? `Mail: ${j.mailboxEmail}` : j.backupId || j.filename || '—'}
                        </td>

                        <td className="py-3 px-4">
                          <div className="space-y-1 max-w-xs">
                            <div className="flex items-center justify-between text-[11.5px]">
                              <span className={`font-bold capitalize ${
                                j.status === 'completed' ? 'text-emerald-600' :
                                isRunning ? 'text-[#f35927]' :
                                j.status === 'failed' ? 'text-red-600' : 'text-slate-500'
                              }`}>
                                {j.status}
                              </span>
                              <span className="font-mono text-slate-600 font-bold">{percent}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  j.status === 'completed' ? 'bg-emerald-500' :
                                  j.status === 'failed' ? 'bg-red-500' : 'bg-[#f35927]'
                                }`}
                                style={{ width: `${percent}%` }}
                              ></div>
                            </div>
                            {j.progress?.message && (
                              <div className="text-[11px] text-slate-500 truncate">{j.progress.message}</div>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-[12px] text-slate-600">
                          {new Date(j.createdAt).toLocaleTimeString()}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedJobLog(j)}
                              className="px-2.5 py-1 text-[12px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[3px] cursor-pointer flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              View Log
                            </button>

                            {isRunning && (
                              <button
                                onClick={() => handleCancelJob(j.id)}
                                disabled={cancellingJobId === j.id}
                                className="px-2.5 py-1 text-[12px] font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-[3px] cursor-pointer flex items-center gap-1 disabled:opacity-50"
                              >
                                <StopCircle className="w-3.5 h-3.5" />
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DRAWER / MODAL: BACKUP POINT CONTENTS INSPECTOR */}
      {/* ========================================================= */}
      {inspectingPoint && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-[4px] border border-[#d8dce2] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-[#f8f9fa] border-b border-[#e3e5e8] flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                  <Archive className="w-4 h-4 text-[#f35927]" />
                  Backup Point Contents: {new Date(inspectingPoint.createdAt).toLocaleString()}
                </h3>
                <div className="text-[12px] text-slate-500 font-mono mt-0.5">
                  ID: {inspectingPoint.id} • Size: {inspectingPoint.sizeFormatted} • SHA-256: {inspectingPoint.sha256 ? 'Verified' : 'N/A'}
                </div>
              </div>
              <button
                onClick={() => setInspectingPoint(null)}
                className="text-slate-400 hover:text-slate-700 text-[18px] font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Category Tabs Inside Modal */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2">
              <button
                onClick={() => setContentCategory('files')}
                className={`px-3 py-2 text-[12.5px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  contentCategory === 'files' ? 'border-[#f35927] text-[#f35927] bg-white' : 'border-transparent text-slate-600'
                }`}
              >
                <Folder className="w-4 h-4" />
                Files & Homedir ({contentsData?.categories?.files?.fileCount || 0})
              </button>

              <button
                onClick={() => setContentCategory('databases')}
                className={`px-3 py-2 text-[12.5px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  contentCategory === 'databases' ? 'border-[#f35927] text-[#f35927] bg-white' : 'border-transparent text-slate-600'
                }`}
              >
                <Database className="w-4 h-4" />
                MySQL Databases ({contentsData?.categories?.databases?.count || 0})
              </button>

              <button
                onClick={() => setContentCategory('emails')}
                className={`px-3 py-2 text-[12.5px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  contentCategory === 'emails' ? 'border-[#f35927] text-[#f35927] bg-white' : 'border-transparent text-slate-600'
                }`}
              >
                <Mail className="w-4 h-4" />
                Email Mailboxes ({contentsData?.categories?.emails?.count || 0})
              </button>

              <button
                onClick={() => setContentCategory('configs')}
                className={`px-3 py-2 text-[12.5px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  contentCategory === 'configs' ? 'border-[#f35927] text-[#f35927] bg-white' : 'border-transparent text-slate-600'
                }`}
              >
                <Sliders className="w-4 h-4" />
                Cron & Configurations
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingContents ? (
                <div className="p-12 text-center text-slate-500 text-[13px]">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#f35927] mb-2" />
                  Reading and validating archive manifest...
                </div>
              ) : (
                <>
                  {/* CATEGORY: FILES */}
                  {contentCategory === 'files' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded border border-slate-200 text-[12.5px]">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSelectAllVisible(contentsData?.categories?.files?.entries || [])}
                            className="text-[12px] font-bold text-[#185dc4] hover:underline cursor-pointer"
                          >
                            Toggle Select All
                          </button>
                          <span className="text-slate-400">|</span>
                          <span className="font-semibold text-slate-700">
                            {selectedFilePaths.size} selected
                          </span>
                        </div>

                        <button
                          onClick={handlePrepareFileRestore}
                          disabled={selectedFilePaths.size === 0}
                          className="px-3 py-1.5 bg-[#f35927] hover:bg-[#e04817] text-white text-[12px] font-bold rounded-[3px] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restore Selected Files
                        </button>
                      </div>

                      <div className="border border-slate-200 rounded max-h-[50vh] overflow-y-auto">
                        <table className="w-full text-left border-collapse text-[12.5px]">
                          <thead className="bg-[#f8f9fa] sticky top-0 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                            <tr>
                              <th className="p-2 w-8 text-center">✓</th>
                              <th className="p-2">Path / Name</th>
                              <th className="p-2">Type</th>
                              <th className="p-2 text-right">Size</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(contentsData?.categories?.files?.entries || []).map((e) => {
                              const isSelected = selectedFilePaths.has(e.path);

                              return (
                                <tr key={e.path} className={`hover:bg-slate-50 ${isSelected ? 'bg-orange-50/50' : ''}`}>
                                  <td className="p-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleFileSelect(e.path)}
                                      className="rounded text-[#f35927] focus:ring-[#f35927]"
                                    />
                                  </td>
                                  <td className="p-2 font-mono text-slate-800">
                                    <div className="flex items-center gap-1.5">
                                      {e.isDirectory ? <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                      <span className={e.isDirectory ? 'font-semibold text-slate-900' : ''}>{e.path}</span>
                                    </div>
                                  </td>
                                  <td className="p-2 text-slate-500 capitalize">{e.isDirectory ? 'Directory' : 'File'}</td>
                                  <td className="p-2 text-right font-mono text-slate-600">{e.sizeFormatted}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* CATEGORY: DATABASES */}
                  {contentCategory === 'databases' && (
                    <div className="space-y-3">
                      {contentsData?.categories?.databases?.databases?.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-[13px]">
                          No database dumps included in this backup point.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {contentsData?.categories?.databases?.databases?.map((db) => (
                            <div key={db.name} className="p-3.5 bg-slate-50 border border-slate-200 rounded-[4px] flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                                  <Database className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-bold text-[13.5px] text-slate-800 font-mono">{db.name}</div>
                                  <div className="text-[11.5px] text-slate-500">
                                    Dump size: {db.sizeFormatted}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handlePrepareDbRestore(db)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-[3px] transition-colors cursor-pointer"
                              >
                                Restore Database
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CATEGORY: EMAILS */}
                  {contentCategory === 'emails' && (
                    <div className="space-y-3">
                      {contentsData?.categories?.emails?.mailboxes?.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-[13px]">
                          No mailbox archives found in this restore point.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {contentsData?.categories?.emails?.mailboxes?.map((mb) => (
                            <div key={mb.email} className="p-3.5 bg-slate-50 border border-slate-200 rounded-[4px] flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                                  <Mail className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-bold text-[13px] text-slate-800">{mb.email}</div>
                                  <div className="text-[11.5px] text-slate-500">
                                    {mb.messageCount} files • {mb.sizeFormatted}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handlePrepareEmailRestore(mb)}
                                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-[12px] font-bold rounded-[3px] transition-colors cursor-pointer"
                              >
                                Restore Mailbox
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CATEGORY: CONFIGS */}
                  {contentCategory === 'configs' && (
                    <div className="space-y-3">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded text-[13px] space-y-2">
                        <div className="font-bold text-slate-800">Account Configuration Snapshots</div>
                        <div className="text-slate-600 text-[12px]">
                          Cron job crontabs, SSL certificates, DNS zone files, and Apache virtual host rules.
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {contentsData?.categories?.cron?.entries?.map((c, i) => (
                            <span key={i} className="px-2.5 py-1 rounded bg-white border border-slate-300 text-[12px] font-mono text-slate-700">
                              {c.name} ({c.sizeFormatted})
                            </span>
                          ))}
                          {contentsData?.categories?.configs?.entries?.map((c, i) => (
                            <span key={i} className="px-2.5 py-1 rounded bg-white border border-slate-300 text-[12px] font-mono text-slate-700">
                              {c.name} ({c.sizeFormatted})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-[#f8f9fa] border-t border-[#e3e5e8] flex items-center justify-between">
              <a
                href={api.getJetDownloadUrl(inspectingPoint.id)}
                download
                className="text-[12.5px] font-semibold text-slate-600 hover:text-[#f35927] flex items-center gap-1.5"
              >
                <DownloadCloud className="w-4 h-4" /> Download Complete Archive
              </a>
              <button
                onClick={() => setInspectingPoint(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-[12.5px] font-bold rounded-[3px] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: FILE RESTORE PRE-FLIGHT & CONFIRMATION */}
      {/* ========================================================= */}
      {fileRestoreModal && fileValidation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-[4px] border border-[#d8dce2] shadow-2xl w-full max-w-lg overflow-hidden space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#f35927]" />
                Confirm File Restoration
              </h3>
              <button onClick={() => setFileRestoreModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
                <div>Selected Items: <span className="font-bold text-slate-800">{fileValidation.selectedCount} entries</span></div>
                <div>Estimated Restore Size: <span className="font-bold text-slate-800">{fileValidation.estimatedSizeFormatted}</span></div>
                <div>Destination: <span className="font-mono text-slate-800 font-bold">{fileValidation.destination}</span></div>
              </div>

              {fileValidation.hasConflicts && (
                <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded text-[12px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Collision Warning:</span> {fileValidation.overwriteCount} existing files will be overwritten based on your conflict strategy ({conflictMode}).
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setFileRestoreModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12.5px] font-semibold rounded-[3px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteFileRestore}
                className="px-4 py-1.5 bg-[#f35927] hover:bg-[#e04817] text-white text-[12.5px] font-bold rounded-[3px] cursor-pointer"
              >
                Start File Restore Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DATABASE RESTORE CONFIRMATION */}
      {/* ========================================================= */}
      {dbRestoreModal && dbValidation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-[4px] border border-[#d8dce2] shadow-2xl w-full max-w-lg overflow-hidden space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                Confirm MySQL Database Restore
              </h3>
              <button onClick={() => setDbRestoreModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
                <div>Source Database: <span className="font-mono font-bold text-slate-800">{dbValidation.sourceDbName}</span></div>
                <div>Dump File Size: <span className="font-bold text-slate-800">{dbValidation.dbSizeFormatted}</span></div>
                <div>Target Database: <span className="font-mono font-bold text-slate-800">{dbValidation.targetDbName}</span></div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded text-[12px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Database Impact:</span> {dbValidation.warningMessage}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setDbRestoreModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12.5px] font-semibold rounded-[3px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDbRestore}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12.5px] font-bold rounded-[3px] cursor-pointer"
              >
                Execute Database Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EMAIL RESTORE CONFIRMATION */}
      {/* ========================================================= */}
      {mailRestoreModal && selectedMailEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-[4px] border border-[#d8dce2] shadow-2xl w-full max-w-lg overflow-hidden space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                <Mail className="w-4 h-4 text-orange-600" />
                Confirm Mailbox Restoration
              </h3>
              <button onClick={() => setMailRestoreModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
                <div>Mailbox: <span className="font-bold text-slate-800">{selectedMailEntry.email}</span></div>
                <div>Account: <span className="font-mono text-slate-700">{selectedMailEntry.account}</span></div>
                <div>Archive Path: <span className="font-mono text-slate-700">{selectedMailEntry.path}</span></div>
              </div>
              <div className="text-[12px] text-slate-600">
                Restoring will extract emails into your account's Maildir directory without affecting other mailboxes.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setMailRestoreModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12.5px] font-semibold rounded-[3px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteEmailRestore}
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-[12.5px] font-bold rounded-[3px] cursor-pointer"
              >
                Start Mailbox Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: VIEW JOB LOGS */}
      {/* ========================================================= */}
      {selectedJobLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-[4px] border border-[#d8dce2] shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 bg-[#f8f9fa] border-b border-[#e3e5e8] flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#f35927]" />
                Job Execution Log: {selectedJobLog.id}
              </h3>
              <button onClick={() => setSelectedJobLog(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 font-mono text-[11.5px] bg-slate-900 text-slate-100 space-y-1">
              <div>[INFO] Job initialized at {selectedJobLog.createdAt}</div>
              <div>[INFO] Job Type: {selectedJobLog.type} | Status: {selectedJobLog.status}</div>
              {selectedJobLog.logs?.map((l, idx) => (
                <div key={idx} className="text-slate-300">
                  <span className="text-slate-500">[{new Date(l.time).toLocaleTimeString()}]</span> {l.message}
                </div>
              ))}
              {selectedJobLog.completedAt && (
                <div className="text-emerald-400">[INFO] Job finished at {selectedJobLog.completedAt}</div>
              )}
            </div>

            <div className="px-5 py-3 bg-[#f8f9fa] border-t border-[#e3e5e8] flex justify-end">
              <button
                onClick={() => setSelectedJobLog(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-[12.5px] font-bold rounded-[3px] cursor-pointer"
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
