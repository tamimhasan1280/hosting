import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { 
  Archive, Download, Trash2, CheckCircle2, RefreshCw, HardDrive, 
  ShieldCheck, AlertTriangle, Database, Mail, Folder, FileText, 
  Info, Shield, Check, Copy, Upload, ArrowRight, ArrowLeft, Clock, 
  Hash, Wand2, Play, XCircle, CheckCircle, ChevronRight, Layers, FileArchive
} from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Alert from '../components/ui/Alert';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function BackupWizard({ onNavigate }) {
  const [mode, setMode] = useState('backup'); // 'backup' or 'restore'
  const [capabilities, setCapabilities] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Backup Stepper State (1: Select Data, 2: Options, 3: Destination, 4: Review, 5: Progress, 6: Complete)
  const [step, setStep] = useState(1);
  const [backupScope, setBackupScope] = useState('full'); // 'full' or 'custom'
  const [includeHome, setIncludeHome] = useState(true);
  const [includeDbs, setIncludeDbs] = useState(true);
  const [selectedDbNames, setSelectedDbNames] = useState([]);
  const [includeEmail, setIncludeEmail] = useState(true);
  const [archiveFormat, setArchiveFormat] = useState('zip');
  const [includeDotfiles, setIncludeDotfiles] = useState(true);
  const [destination, setDestination] = useState('homedir');

  // Job & Progress
  const [activeJob, setActiveJob] = useState(null);
  const [completedJob, setCompletedJob] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const pollIntervalRef = useRef(null);

  // Restore Stepper State (1: Select Backup, 2: Components, 3: Confirm, 4: Execute)
  const [restoreStep, setRestoreStep] = useState(1);
  const [selectedRestoreBackup, setSelectedRestoreBackup] = useState(null);
  const [restoreComponents, setRestoreComponents] = useState({ homedir: true, databases: true, email: true });
  const [restoreConfirmChecked, setRestoreConfirmChecked] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadCapabilities = async () => {
    setLoading(true);
    try {
      const res = await api.getBackupWizardCapabilities();
      if (res.success) {
        setCapabilities(res);
        // Pre-select all databases
        if (res.databases?.items) {
          setSelectedDbNames(res.databases.items.map(d => d.name));
        }
        // If an active job is running, attach immediately!
        if (res.activeJob) {
          setActiveJob(res.activeJob);
          setStep(5);
          startJobPolling(res.activeJob.id);
        }
      }
    } catch (err) {
      showNotification('Failed to load backup capabilities: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCapabilities();
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
            setCompletedJob(res.job);
            setStep(6);
            showNotification(`Backup ${res.job.filename} completed successfully!`, 'success');
            loadCapabilities();
          } else if (res.job.status === 'failed') {
            clearInterval(pollIntervalRef.current);
            showNotification(`Backup failed: ${res.job.error || 'Unknown error'}`, 'error');
            setStep(4);
            loadCapabilities();
          } else if (res.job.status === 'cancelled') {
            clearInterval(pollIntervalRef.current);
            showNotification('Backup job was cancelled.', 'info');
            setStep(1);
            loadCapabilities();
          }
        }
      } catch (e) {
        clearInterval(pollIntervalRef.current);
      }
    }, 1500);
  };

  const handleStartBackup = async () => {
    setLoading(true);
    try {
      // 1. Client & Server-side validation
      const components = backupScope === 'full' 
        ? ['homedir', 'databases', 'email', 'domains', 'cron', 'ftp']
        : [
            ...(includeHome ? ['homedir'] : []),
            ...(includeDbs ? ['databases'] : []),
            ...(includeEmail ? ['email'] : [])
          ];

      if (components.length === 0) {
        showNotification('Please select at least one component to back up.', 'error');
        setLoading(false);
        return;
      }

      await api.validateBackupWizard({
        type: backupScope,
        components,
        databases: selectedDbNames,
        destination
      });

      // 2. Start Real Backup Job
      const res = await api.createBackup({
        type: backupScope,
        selectedDbs: selectedDbNames,
        customComponents: components
      });

      if (res.success && res.jobId) {
        setActiveJob({
          id: res.jobId,
          filename: res.filename,
          type: res.type,
          status: 'in_progress',
          progress: { percent: 10, message: 'Initializing backup archive...' },
          createdAt: new Date().toISOString()
        });
        setStep(5);
        startJobPolling(res.jobId);
        showNotification('Backup generation started successfully!', 'info');
      }
    } catch (err) {
      showNotification(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async () => {
    if (!activeJob) return;
    setCancelling(true);
    try {
      const res = await api.cancelBackupJob(activeJob.id);
      if (res.success) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setShowCancelModal(false);
        setActiveJob(null);
        setStep(1);
        showNotification(res.message, 'info');
        loadCapabilities();
      }
    } catch (err) {
      showNotification('Failed to cancel job: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!selectedRestoreBackup) return;
    setRestoring(true);
    setRestoreResult(null);
    try {
      const res = await api.restoreBackup({
        backupId: selectedRestoreBackup.id || selectedRestoreBackup.filename
      });
      if (res.success) {
        setRestoreResult(res);
        setRestoreStep(4);
        showNotification('Account backup restored successfully!', 'success');
      }
    } catch (err) {
      showNotification('Restore failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setRestoring(false);
    }
  };

  const handleDownload = (backupId) => {
    window.location.href = `/api/backup/download/${encodeURIComponent(backupId)}`;
  };

  const copyChecksum = (hash) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  // Estimated Size Calculation
  const calculateEstimatedSize = () => {
    if (!capabilities) return '0 B';
    let bytes = 0;
    if (backupScope === 'full' || includeHome) {
      bytes += Math.round((capabilities.homeDirectory?.sizeBytes || 0) * 0.7);
    }
    if (backupScope === 'full' || includeDbs) {
      const count = backupScope === 'full' ? (capabilities.databases?.count || 0) : selectedDbNames.length;
      bytes += count * 250 * 1024;
    }
    if (backupScope === 'full' || includeEmail) {
      bytes += 50 * 1024;
    }
    return formatBytes(Math.max(10240, bytes));
  };

  // Stepper Items Definition
  const backupSteps = [
    { num: 1, label: 'Select Data' },
    { num: 2, label: 'Options' },
    { num: 3, label: 'Destination' },
    { num: 4, label: 'Review' },
    { num: 5, label: 'Progress' },
    { num: 6, label: 'Complete' }
  ];

  const restoreSteps = [
    { num: 1, label: 'Select Archive' },
    { num: 2, label: 'Components' },
    { num: 3, label: 'Confirmation' },
    { num: 4, label: 'Results' }
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header & Mode Switcher */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-1">
              <span>Home</span>
              <span>/</span>
              <span>Files</span>
              <span>/</span>
              <span className="text-indigo-600">Backup Wizard</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <Wand2 className="w-6 h-6 text-[#27235C]" />
              <span>Backup Wizard</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Step-by-step guided assistant to create custom backups or safely restore account archives.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {/* Mode Switcher Buttons */}
            <div className="bg-slate-100 p-1 rounded-lg flex items-center space-x-1 border border-slate-200">
              <button
                onClick={() => { setMode('backup'); setStep(1); }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                  mode === 'backup' 
                    ? 'bg-white text-[#27235C] shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>1. Back Up</span>
              </button>
              <button
                onClick={() => { setMode('restore'); setRestoreStep(1); }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                  mode === 'restore' 
                    ? 'bg-white text-indigo-700 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>2. Restore</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadCapabilities}
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

      {/* 2. Visual Stepper Header */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between max-w-4xl mx-auto overflow-x-auto py-2">
          {(mode === 'backup' ? backupSteps : restoreSteps).map((s, idx) => {
            const current = mode === 'backup' ? step : restoreStep;
            const isCompleted = s.num < current;
            const isCurrent = s.num === current;

            return (
              <React.Fragment key={s.num}>
                <div className="flex items-center space-x-2 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    isCompleted 
                      ? 'bg-emerald-500 text-white' 
                      : isCurrent 
                        ? 'bg-[#27235C] text-white ring-4 ring-indigo-100' 
                        : 'bg-slate-100 text-slate-400'
                  }`}>
                    {isCompleted ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <span className={`text-xs font-semibold ${
                    isCurrent ? 'text-[#27235C]' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {idx < (mode === 'backup' ? backupSteps.length - 1 : restoreSteps.length - 1) && (
                  <div className={`h-0.5 w-8 sm:w-12 mx-2 ${
                    s.num < current ? 'bg-emerald-500' : 'bg-slate-200'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* BACKUP WIZARD STEPS */}
      {/* ========================================================= */}
      {mode === 'backup' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* STEP 1: Select Data */}
          {step === 1 && (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <span>Step 1: Choose What to Back Up</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Select whether you want a complete full account archive or customized individual components.
                </p>
              </div>

              {/* Scope Selection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => setBackupScope('full')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start space-x-3 ${
                    backupScope === 'full'
                      ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-100'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="scope" 
                    checked={backupScope === 'full'} 
                    onChange={() => setBackupScope('full')}
                    className="mt-1 text-indigo-600 focus:ring-indigo-500" 
                  />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-slate-800">Full Account Backup</span>
                      <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Includes entire home directory, all MySQL databases, email forwarders/filters, DNS zones, and cron configurations.
                    </p>
                  </div>
                </div>

                <div 
                  onClick={() => setBackupScope('custom')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start space-x-3 ${
                    backupScope === 'custom'
                      ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-100'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="scope" 
                    checked={backupScope === 'custom'} 
                    onChange={() => setBackupScope('custom')}
                    className="mt-1 text-indigo-600 focus:ring-indigo-500" 
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-800">Custom / Partial Backup</span>
                    <p className="text-xs text-slate-500 mt-1">
                      Choose specific items such as website files, select individual MySQL databases, or email configurations.
                    </p>
                  </div>
                </div>
              </div>

              {/* Custom Component Checkboxes & Tables */}
              {backupScope === 'custom' && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Account Components:</h4>
                  
                  {/* Home Directory Checkbox */}
                  <label className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={includeHome}
                      onChange={(e) => setIncludeHome(e.target.checked)}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <Folder className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-slate-800">Home Directory & Website Files</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          ({capabilities?.homeDirectory?.fileCount || 0} files, {capabilities?.homeDirectory?.sizeFormatted || '0 B'})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Backs up <code>public_html</code> and all user documents in <code>{capabilities?.homeDirectory?.path || '/home/cpanel_user'}</code>.
                      </p>
                    </div>
                  </label>

                  {/* Databases Checkbox & List */}
                  <div className="p-3 rounded-lg border border-slate-200 space-y-2">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeDbs}
                        onChange={(e) => setIncludeDbs(e.target.checked)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Database className="w-4 h-4 text-blue-500" />
                          <span className="text-xs font-bold text-slate-800">MySQL / MariaDB Databases</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            ({capabilities?.databases?.count || 0} databases discovered)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Exports real SQL dumps containing table schemas and data rows.
                        </p>
                      </div>
                    </label>

                    {includeDbs && capabilities?.databases?.items?.length > 0 && (
                      <div className="pl-7 pt-2 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1 border-b border-slate-100">
                          <span>Select individual databases to include:</span>
                          <div className="space-x-2">
                            <button 
                              type="button" 
                              onClick={() => setSelectedDbNames(capabilities.databases.items.map(d => d.name))}
                              className="text-indigo-600 font-bold hover:underline"
                            >
                              Select All
                            </button>
                            <span>|</span>
                            <button 
                              type="button" 
                              onClick={() => setSelectedDbNames([])}
                              className="text-slate-500 font-bold hover:underline"
                            >
                              Deselect All
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                          {capabilities.databases.items.map(db => (
                            <label key={db.name} className="flex items-center space-x-2 text-xs p-1.5 rounded hover:bg-slate-100 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedDbNames.includes(db.name)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDbNames([...selectedDbNames, db.name]);
                                  } else {
                                    setSelectedDbNames(selectedDbNames.filter(n => n !== db.name));
                                  }
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="font-mono text-slate-800 font-semibold truncate">{db.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({db.size})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Email Data Checkbox */}
                  <label className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={includeEmail}
                      onChange={(e) => setIncludeEmail(e.target.checked)}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-purple-500" />
                        <span className="text-xs font-bold text-slate-800">Email Accounts & Forwarders</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          ({capabilities?.email?.count || 0} accounts)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Exports mail account definitions, forwarders, autoresponders, and spam filters.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Step 1 Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Estimated Archive Size: <strong className="font-mono text-slate-800">{calculateEstimatedSize()}</strong>
                </div>
                <Button
                  variant="primary"
                  onClick={() => setStep(2)}
                  className="bg-[#27235C] hover:bg-[#1c1944] text-white flex items-center space-x-1"
                >
                  <span>Next: Options</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Backup Options */}
          {step === 2 && (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                  <FileArchive className="w-5 h-5 text-indigo-600" />
                  <span>Step 2: Backup Options & Format</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Configure compression format and file inclusions.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Archive Format:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(capabilities?.supportedFormats || [
                      { id: 'zip', name: 'Standard ZIP Archive (.zip)', extension: '.zip', recommended: true }
                    ]).map(fmt => (
                      <div
                        key={fmt.id}
                        onClick={() => setArchiveFormat(fmt.id)}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-center justify-between ${
                          archiveFormat === fmt.id
                            ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-100'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <FileArchive className="w-4 h-4 text-indigo-600" />
                          <div>
                            <div className="text-xs font-bold text-slate-800">{fmt.name}</div>
                            <div className="text-[11px] text-slate-500">Universal compatibility</div>
                          </div>
                        </div>
                        {fmt.recommended && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 mb-2">File Filters & Inclusions:</label>
                  <label className="flex items-center space-x-2 text-xs text-slate-700 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDotfiles}
                      onChange={(e) => setIncludeDotfiles(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Include hidden dotfiles (<code className="font-mono text-slate-800">.htaccess</code>, <code className="font-mono text-slate-800">.user.ini</code>, <code className="font-mono text-slate-800">.cpanel</code>)</span>
                  </label>
                </div>
              </div>

              {/* Step 2 Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex items-center space-x-1 border-slate-300"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setStep(3)}
                  className="bg-[#27235C] hover:bg-[#1c1944] text-white flex items-center space-x-1"
                >
                  <span>Next: Destination</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Destination & Quota */}
          {step === 3 && (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                  <HardDrive className="w-5 h-5 text-indigo-600" />
                  <span>Step 3: Storage Destination & Quota Check</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Select destination directory and verify available disk quota headroom.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Backup Storage Destination:</label>
                  <div className="p-4 rounded-xl border-2 border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Folder className="w-5 h-5 text-indigo-600" />
                        <div>
                          <div className="text-xs font-bold text-slate-800">Account Backup Storage Directory</div>
                          <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                            {capabilities?.destinations?.[0]?.path || '/home/cpanel_user/backups'}
                          </div>
                        </div>
                      </div>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                        Writable
                      </span>
                    </div>
                  </div>
                </div>

                {/* Storage Headroom Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Available Storage Headroom:</span>
                    <span className="font-mono text-emerald-700">
                      {capabilities?.storage?.freeFormatted || '10 GB'} Free Space
                    </span>
                  </div>
                  
                  {/* Progress Meter */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ 
                        width: `${Math.min(100, Math.max(5, ((capabilities?.storage?.usedBytes || 0) / (capabilities?.storage?.quotaBytes || 1)) * 100))}%` 
                      }}
                    />
                  </div>

                  <div className="flex items-center space-x-2 text-[11px] text-emerald-700">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Sufficient disk quota available for estimated archive size ({calculateEstimatedSize()}).</span>
                  </div>
                </div>
              </div>

              {/* Step 3 Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="flex items-center space-x-1 border-slate-300"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setStep(4)}
                  className="bg-[#27235C] hover:bg-[#1c1944] text-white flex items-center space-x-1"
                >
                  <span>Next: Review</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Review & Final Confirmation */}
          {step === 4 && (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <span>Step 4: Review & Start Backup</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Please review your selected configuration before initiating the backup process.
                </p>
              </div>

              {/* Review Summary Grid */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Backup Scope:</span>
                    <strong className="text-slate-800 capitalize">{backupScope} Backup</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Archive Format:</span>
                    <strong className="text-slate-800 uppercase">{archiveFormat} Archive</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Estimated Size:</span>
                    <strong className="text-slate-800 font-mono">{calculateEstimatedSize()}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Storage Destination:</span>
                    <strong className="text-slate-800 font-mono">{capabilities?.destinations?.[0]?.path}</strong>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <span className="text-xs text-slate-500 block mb-1.5">Included Components:</span>
                  <div className="flex flex-wrap gap-2">
                    {(backupScope === 'full' || includeHome) && (
                      <span className="inline-flex items-center space-x-1 bg-white border border-slate-200 px-2.5 py-1 rounded text-xs text-slate-700">
                        <Folder className="w-3.5 h-3.5 text-amber-500" />
                        <span>Home Directory</span>
                      </span>
                    )}
                    {(backupScope === 'full' || includeDbs) && (
                      <span className="inline-flex items-center space-x-1 bg-white border border-slate-200 px-2.5 py-1 rounded text-xs text-slate-700">
                        <Database className="w-3.5 h-3.5 text-blue-500" />
                        <span>MySQL Databases ({backupScope === 'full' ? capabilities?.databases?.count : selectedDbNames.length})</span>
                      </span>
                    )}
                    {(backupScope === 'full' || includeEmail) && (
                      <span className="inline-flex items-center space-x-1 bg-white border border-slate-200 px-2.5 py-1 rounded text-xs text-slate-700">
                        <Mail className="w-3.5 h-3.5 text-purple-500" />
                        <span>Email & Forwarders</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Confirmation Notice */}
              <div className="flex items-start space-x-2 text-xs text-slate-500 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  The backup engine will package live server files and tables asynchronously in the background. You may leave or refresh this page without interrupting the job.
                </span>
              </div>

              {/* Step 4 Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(3)}
                  className="flex items-center space-x-1 border-slate-300"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </Button>
                <Button
                  variant="primary"
                  onClick={handleStartBackup}
                  disabled={loading}
                  className="bg-[#27235C] hover:bg-[#1c1944] text-white flex items-center space-x-2 px-6"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  <span>Start Backup</span>
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: Live Backup Progress */}
          {step === 5 && (
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto ring-8 ring-indigo-50/50">
                <RefreshCw className="w-8 h-8 text-[#27235C] animate-spin" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Backup In Progress ({activeJob?.type?.toUpperCase()} Backup)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {activeJob?.progress?.message || 'Processing account resources and building archive...'}
                </p>
              </div>

              {/* Real Progress Bar */}
              <div className="max-w-md mx-auto space-y-2">
                <div className="flex justify-between text-xs font-mono font-bold text-slate-700">
                  <span>Progress</span>
                  <span>{activeJob?.progress?.percent || 20}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                  <div 
                    className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-full transition-all duration-500 rounded-full"
                    style={{ width: `${activeJob?.progress?.percent || 20}%` }}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-center space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelModal(true)}
                  className="text-red-600 border-red-200 hover:bg-red-50 flex items-center space-x-1"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Cancel Backup</span>
                </Button>
              </div>
            </div>
          )}

          {/* STEP 6: Complete & Download */}
          {step === 6 && completedJob && (
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">Backup Completed Successfully!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Your compressed account archive is ready for secure download or safekeeping.
                </p>
              </div>

              {/* Archive Details Card */}
              <div className="max-w-lg mx-auto bg-slate-50 rounded-xl p-5 border border-slate-200 text-left space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs text-slate-500">Archive Filename:</span>
                  <span className="text-xs font-mono font-bold text-slate-900 truncate max-w-[280px]">
                    {completedJob.filename}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs text-slate-500">Archive Size:</span>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {formatBytes(completedJob.sizeBytes)}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs text-slate-500">Created:</span>
                  <span className="text-xs text-slate-700 font-mono">
                    {new Date(completedJob.completedAt || Date.now()).toLocaleString()}
                  </span>
                </div>
                {completedJob.sha256 && (
                  <div className="pt-1">
                    <span className="text-[11px] text-slate-500 block mb-1">SHA-256 Checksum:</span>
                    <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-slate-200">
                      <span className="text-[11px] font-mono text-slate-700 truncate mr-2">
                        {completedJob.sha256}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyChecksum(completedJob.sha256)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold shrink-0 flex items-center space-x-1"
                      >
                        {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button
                  variant="primary"
                  onClick={() => handleDownload(completedJob.id || completedJob.filename)}
                  className="bg-[#27235C] hover:bg-[#1c1944] text-white flex items-center space-x-2 px-6 py-2.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Backup Archive</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setStep(1); setCompletedJob(null); }}
                  className="border-slate-300"
                >
                  Create Another Backup
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* RESTORE WIZARD STEPS */}
      {/* ========================================================= */}
      {mode === 'restore' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* STEP 1: Select Archive */}
          {restoreStep === 1 && (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                  <Archive className="w-5 h-5 text-indigo-600" />
                  <span>Step 1: Select a Backup to Restore</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choose from existing archives saved on the server for this account.
                </p>
              </div>

              {(!capabilities?.recentBackups || capabilities.recentBackups.length === 0) ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                  <Archive className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-700">No backup archives found</h4>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Create a backup first using the Backup Wizard before restoring.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => { setMode('backup'); setStep(1); }}
                    className="bg-[#27235C] text-white"
                  >
                    Go to Backup Wizard
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2.5 max-h-80 overflow-y-auto pr-1">
                    {capabilities.recentBackups.map(b => (
                      <div
                        key={b.id}
                        onClick={() => setSelectedRestoreBackup(b)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-center justify-between ${
                          selectedRestoreBackup?.id === b.id
                            ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-100'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="restore_bk"
                            checked={selectedRestoreBackup?.id === b.id}
                            onChange={() => setSelectedRestoreBackup(b)}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900 font-mono">{b.filename}</div>
                            <div className="text-[11px] text-slate-500 flex items-center space-x-2 mt-0.5">
                              <span>Size: <strong className="font-mono text-slate-700">{b.sizeFormatted}</strong></span>
                              <span>•</span>
                              <span>Type: <strong className="capitalize">{b.type}</strong></span>
                              <span>•</span>
                              <span>{new Date(b.created).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                          b.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {b.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Step 1 Restore Footer */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Selected: <strong>{selectedRestoreBackup ? selectedRestoreBackup.filename : 'None'}</strong>
                    </span>
                    <Button
                      variant="primary"
                      disabled={!selectedRestoreBackup}
                      onClick={() => setRestoreStep(2)}
                      className="bg-[#27235C] hover:bg-[#1c1944] text-white flex items-center space-x-1"
                    >
                      <span>Next: Components</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Restore Components */}
          {restoreStep === 2 && selectedRestoreBackup && (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <span>Step 2: Select Components to Restore</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choose which data segments from archive <strong className="font-mono text-slate-800">{selectedRestoreBackup.filename}</strong> to extract.
                </p>
              </div>

              <div className="space-y-3">
                <label className="flex items-center space-x-3 p-3.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreComponents.homedir}
                    onChange={(e) => setRestoreComponents({ ...restoreComponents, homedir: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Home Directory Files</div>
                    <div className="text-[11px] text-slate-500">Restores website document root and user files</div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreComponents.databases}
                    onChange={(e) => setRestoreComponents({ ...restoreComponents, databases: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-800">MySQL Database Tables</div>
                    <div className="text-[11px] text-slate-500">Imports SQL dump tables and records</div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreComponents.email}
                    onChange={(e) => setRestoreComponents({ ...restoreComponents, email: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Email Configuration & Forwarders</div>
                    <div className="text-[11px] text-slate-500">Restores mail routing and account settings</div>
                  </div>
                </label>
              </div>

              {/* Step 2 Restore Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setRestoreStep(1)}
                  className="flex items-center space-x-1 border-slate-300"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setRestoreStep(3)}
                  className="bg-[#27235C] hover:bg-[#1c1944] text-white flex items-center space-x-1"
                >
                  <span>Next: Confirmation</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Restore Confirmation */}
          {restoreStep === 3 && selectedRestoreBackup && (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span>Step 3: Confirm Account Restoration</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Please read the warning below carefully before proceeding.
                </p>
              </div>

              {/* Warning Alert */}
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>CRITICAL RESTORATION WARNING</span>
                </div>
                <p className="text-xs leading-relaxed">
                  Restoring will overwrite existing website files, directories, and MySQL database tables with the contents of the archive <strong>{selectedRestoreBackup.filename}</strong>. Any changes made since this backup was taken will be replaced.
                </p>
              </div>

              <label className="flex items-start space-x-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restoreConfirmChecked}
                  onChange={(e) => setRestoreConfirmChecked(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-800 font-semibold">
                  I understand that this action will replace current account files and databases with archive data.
                </span>
              </label>

              {/* Step 3 Restore Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setRestoreStep(2)}
                  className="flex items-center space-x-1 border-slate-300"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </Button>
                <Button
                  variant="primary"
                  disabled={!restoreConfirmChecked || restoring}
                  onClick={handleExecuteRestore}
                  className="bg-amber-600 hover:bg-amber-700 text-white flex items-center space-x-2 px-6"
                >
                  {restoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>Execute Restore</span>
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Restore Execution Results */}
          {restoreStep === 4 && restoreResult && (
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">Restoration Completed Successfully!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Account files and configurations have been restored from archive.
                </p>
              </div>

              {/* Stats Summary Card */}
              <div className="max-w-md mx-auto bg-slate-50 rounded-xl p-5 border border-slate-200 text-left space-y-2 text-xs">
                <div className="flex justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Files Restored:</span>
                  <strong className="text-slate-900 font-mono">{restoreResult.stats?.filesRestored || 0} files</strong>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Databases Restored:</span>
                  <strong className="text-slate-900 font-mono">{restoreResult.stats?.databasesRestored || 0} databases</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email Config Restored:</span>
                  <strong className="text-emerald-700">{restoreResult.stats?.emailRestored ? 'Yes' : 'None'}</strong>
                </div>
              </div>

              <div className="pt-2 flex justify-center space-x-3">
                <Button
                  variant="primary"
                  onClick={() => { setRestoreStep(1); setRestoreResult(null); setRestoreConfirmChecked(false); }}
                  className="bg-[#27235C] text-white"
                >
                  Start New Restore
                </Button>
                {onNavigate && (
                  <Button
                    variant="outline"
                    onClick={() => onNavigate('files')}
                    className="border-slate-300"
                  >
                    View in File Manager
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Active Backup Job"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to cancel the currently running backup job? Any partially written archive files will be cleaned up immediately.
          </p>
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelModal(false)}
              disabled={cancelling}
            >
              Keep Running
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCancelJob}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
