import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { 
  Database, Table, Play, RefreshCw, DownloadCloud, UploadCloud, 
  Search, Plus, Trash2, Key, CheckCircle2, AlertTriangle, 
  ChevronRight, ChevronDown, ArrowLeft, ExternalLink, Server, 
  FileText, Copy, Sliders, Check, X, ShieldCheck, AlertCircle,
  Eye, Code2, Edit3, CornerDownRight, FileUp, HardDrive, Shield,
  Layers, Lock, CheckCircle
} from 'lucide-react';

export default function PhpMyAdmin({ initialJumpDb, onNavigate }) {
  // Tenant context
  const ctx = (() => {
    try {
      return JSON.parse(localStorage.getItem('cpanel_active_hosting_context') || '{}');
    } catch { return {}; }
  })();
  const cpanelUser = ctx.user || localStorage.getItem('cpanel_active_user') || 'tamimsho';
  const cpanelDomain = ctx.domain || localStorage.getItem('cpanel_active_domain') || '';

  const [status, setStatus] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedDb, setSelectedDb] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [activeTab, setActiveTab] = useState('databases'); // 'databases' | 'browse' | 'structure' | 'sql' | 'import' | 'export'

  // Table Data & Structure
  const [browseData, setBrowseData] = useState(null);
  const [structureData, setStructureData] = useState(null);
  const [loadingTable, setLoadingTable] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // SQL Console
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [executingSql, setExecutingSql] = useState(false);

  // Import & File Upload State
  const [importTargetDb, setImportTargetDb] = useState('');
  const [importSqlText, setImportSqlText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileSize, setUploadedFileSize] = useState(0);
  const [exportStructure, setExportStructure] = useState(true);
  const [exportData, setExportData] = useState(true);
  const fileInputRef = useRef(null);

  // Create Database Modal State
  const [createDbModal, setCreateDbModal] = useState(false);
  const [newDbSuffix, setNewDbSuffix] = useState('');
  const [newDbCollation, setNewDbCollation] = useState('utf8mb4_unicode_ci');
  const [creatingDb, setCreatingDb] = useState(false);

  // SSO Session
  const [ssoToken, setSsoToken] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  // Filter in Left Navigator
  const [dbSearchQuery, setDbSearchQuery] = useState('');

  // Notifications
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const showNotification = (msg, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 6000);
    } else {
      setStatusMsg(msg);
      setTimeout(() => setStatusMsg(''), 4000);
    }
  };

  // 1. Initial Load: Server Status, Databases & SSO Session
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [statusRes, dbsRes] = await Promise.all([
        api.getPhpMyAdminStatus(),
        api.getPhpMyAdminDatabases(cpanelUser)
      ]);
      setStatus(statusRes);
      const dbs = dbsRes.databases || [];
      setDatabases(dbs);

      // Determine active database
      const urlParams = new URLSearchParams(window.location.search);
      const jumpDb = initialJumpDb || urlParams.get('db') || (dbs.length > 0 ? dbs[0].name : '');

      if (jumpDb) {
        setSelectedDb(jumpDb);
        setImportTargetDb(jumpDb);
        const match = dbs.find(d => d.name === jumpDb);
        if (match?.tables?.length > 0) {
          setSelectedTable(match.tables[0].name);
          setActiveTab('browse');
        } else {
          setActiveTab('structure');
        }
      } else if (dbs.length > 0) {
        setSelectedDb(dbs[0].name);
        setImportTargetDb(dbs[0].name);
        if (dbs[0].tables?.length > 0) {
          setSelectedTable(dbs[0].tables[0].name);
        }
      }

      // Create SSO Session token
      try {
        const ssoRes = await api.createPhpMyAdminSession(jumpDb, cpanelUser);
        setSsoToken(ssoRes.token);
      } catch (e) {}

    } catch (err) {
      showNotification('Failed to initialize phpMyAdmin: ' + err.message, true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [cpanelUser]);

  // 2. Load Table Data or Structure when selectedTable changes
  const loadTableDetails = async () => {
    if (!selectedDb) return;
    setLoadingTable(true);
    setQueryResult(null);
    try {
      if (activeTab === 'browse' && selectedTable) {
        const res = await api.browsePhpMyAdminTable({
          db: selectedDb,
          table: selectedTable,
          page: currentPage,
          limit: pageSize,
          user: cpanelUser
        });
        setBrowseData(res);
      } else if (activeTab === 'structure') {
        if (selectedTable) {
          const res = await api.getPhpMyAdminStructure(selectedDb, selectedTable, cpanelUser);
          setStructureData(res);
        } else {
          // Fetch database tables list
          const res = await api.getPhpMyAdminTables(selectedDb, cpanelUser);
          setStructureData(res);
        }
      }
    } catch (err) {
      showNotification('Failed to load table details: ' + err.message, true);
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    if (selectedDb) {
      loadTableDetails();
    }
  }, [selectedDb, selectedTable, activeTab, currentPage, pageSize]);

  // Handle SQL Execution
  const handleRunSql = async () => {
    const targetDb = selectedDb || importTargetDb || (databases[0]?.name);
    if (!targetDb) {
      showNotification('Please select or create a database first', true);
      return;
    }
    if (!sqlQuery.trim()) {
      showNotification('Please enter a SQL query to execute', true);
      return;
    }
    setExecutingSql(true);
    setQueryResult(null);
    try {
      const res = await api.executePhpMyAdminQuery({
        database: targetDb,
        query: sqlQuery,
        cpanelUser
      });
      setQueryResult(res);
      showNotification(res.message || 'Query executed successfully');
      // Refresh database table list
      api.getPhpMyAdminDatabases(cpanelUser).then(res => setDatabases(res.databases || []));
    } catch (err) {
      showNotification(err.message, true);
      setQueryResult({ error: err.message });
    } finally {
      setExecutingSql(false);
    }
  };

  // Handle File Upload Import
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setUploadedFileSize(file.size);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setImportSqlText(evt.target.result);
      showNotification('File "' + file.name + '" (' + (file.size / 1024).toFixed(1) + ' KB) loaded into import buffer. Click "Execute Import" below.');
    };
    reader.onerror = () => {
      showNotification('Error reading file: ' + file.name, true);
    };
    reader.readAsText(file);
  };

  // Handle Execute Import
  const handleImportSql = async () => {
    const targetDb = importTargetDb || selectedDb || (databases[0]?.name);
    if (!targetDb) {
      showNotification('Please select or create a target database for import', true);
      return;
    }
    if (!importSqlText.trim()) {
      showNotification('Please choose a .sql file or paste SQL queries to import', true);
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await api.importPhpMyAdminSql({
        database: targetDb,
        sql: importSqlText,
        cpanelUser
      });
      setImportResult(res);
      showNotification(res.message || 'Database imported successfully!');
      setImportSqlText('');
      setUploadedFileName('');
      setUploadedFileSize(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Refresh tables & databases
      const dbsRes = await api.getPhpMyAdminDatabases(cpanelUser);
      setDatabases(dbsRes.databases || []);
      setSelectedDb(targetDb);
      setActiveTab('structure');
    } catch (err) {
      showNotification('Import failed: ' + err.message, true);
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
    }
  };

  // Handle Create Database
  const handleCreateDatabase = async (e) => {
    e.preventDefault();
    const cleanSuffix = newDbSuffix.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleanSuffix) {
      showNotification('Please enter a valid database name', true);
      return;
    }
    const fullDbName = cpanelUser + '_' + cleanSuffix;
    setCreatingDb(true);
    try {
      await api.createDatabase({
        name: cleanSuffix,
        collation: newDbCollation,
        cpanelUser
      });
      showNotification('Database `' + fullDbName + '` created successfully in MariaDB!');
      setNewDbSuffix('');
      setCreateDbModal(false);
      // Refresh databases
      const dbsRes = await api.getPhpMyAdminDatabases(cpanelUser);
      setDatabases(dbsRes.databases || []);
      setSelectedDb(fullDbName);
      setImportTargetDb(fullDbName);
      setActiveTab('structure');
    } catch (err) {
      showNotification('Failed to create database: ' + err.message, true);
    } finally {
      setCreatingDb(false);
    }
  };

  // Copy SSO Token
  const copySsoToken = () => {
    navigator.clipboard.writeText(ssoToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // Filter databases for left navigator
  const filteredDbs = databases.filter(d => 
    d.name.toLowerCase().includes(dbSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-12 text-left">
      {/* Toast Notifications */}
      {statusMsg && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 rounded-xl text-[12.5px] flex items-center justify-between shadow-lg backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMsg}</span>
          </div>
          <button onClick={() => setStatusMsg('')} className="text-emerald-400 hover:text-white font-bold ml-4 cursor-pointer">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-950/80 border border-rose-500/50 text-rose-300 rounded-xl text-[12.5px] flex items-center justify-between shadow-lg backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-white font-bold ml-4 cursor-pointer">✕</button>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between text-[12px] text-purple-300/70">
        <div className="flex items-center gap-1.5">
          <button onClick={() => onNavigate && onNavigate('dashboard')} className="hover:text-emerald-300 hover:underline cursor-pointer">
            cPanel Tools
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-purple-400/50" />
          <button onClick={() => onNavigate && onNavigate('databases')} className="hover:text-emerald-300 hover:underline cursor-pointer">
            Databases
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-purple-400/50" />
          <span className="font-semibold text-white">phpMyAdmin &amp; MariaDB Live Interface</span>
        </div>

        {cpanelDomain && (
          <div className="hidden sm:flex items-center gap-2 text-[11px] bg-purple-950/60 border border-purple-800/40 px-2.5 py-1 rounded-full text-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Isolated Domain: <strong>{cpanelDomain}</strong></span>
          </div>
        )}
      </div>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-5 rounded-2xl bg-gradient-to-r from-[#1c0830]/95 via-[#250c3d]/90 to-[#102319]/90 border border-purple-800/40 shadow-xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff6c2c] to-amber-500 flex items-center justify-center text-white shadow-md">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-[20px] font-black text-white tracking-tight flex items-center gap-2">
                <span>phpMyAdmin</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-200 border border-purple-700/40">
                  {status?.version || 'v5.2.1'}
                </span>
                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-600/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  MariaDB 10.11 Live
                </span>
              </h1>
              <p className="text-[12px] text-purple-200/70 mt-0.5">
                Authentic web interface for MariaDB / MySQL database administration, SQL execution, and database file imports.
              </p>
            </div>
          </div>
        </div>

        {/* Server Status & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCreateDbModal(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg transition cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Database</span>
          </button>

          <button
            onClick={() => { setActiveTab('import'); }}
            className="px-3 py-2 rounded-xl bg-purple-900/60 hover:bg-purple-800 border border-purple-700/50 text-purple-200 hover:text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <FileUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Upload &amp; Import .SQL</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Interface */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        
        {/* LEFT COLUMN: Database & Table Tree Navigator */}
        <div className="w-full lg:w-[280px] shrink-0 bg-[#1c0830]/95 border border-purple-800/40 rounded-2xl shadow-xl overflow-hidden backdrop-blur-xl">
          <div className="p-3.5 bg-purple-950/60 border-b border-purple-900/40 flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Databases ({databases.length})</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCreateDbModal(true)}
                className="p-1 hover:bg-purple-800/60 rounded text-emerald-300 cursor-pointer"
                title="Create New Database"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={loadInitialData}
                className="p-1 hover:bg-purple-800/60 rounded text-purple-300 cursor-pointer"
                title="Refresh database list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Quick Search */}
          <div className="p-2 border-b border-purple-900/30">
            <div className="relative">
              <input
                type="text"
                value={dbSearchQuery}
                onChange={(e) => setDbSearchQuery(e.target.value)}
                placeholder="Filter databases..."
                className="w-full bg-[#240c3c]/80 text-[11px] text-white placeholder-purple-300/40 pl-2.5 pr-7 py-1.5 rounded-lg border border-purple-800/30 focus:outline-none focus:border-purple-400"
              />
              <Search className="w-3 h-3 text-purple-300/40 absolute right-2 top-2 pointer-events-none" />
            </div>
          </div>

          {/* Databases Tree List */}
          <div className="p-2 max-h-[65vh] overflow-y-auto space-y-1 text-[12px]">
            {loading ? (
              <div className="p-6 text-center text-purple-300/60 text-[12px]">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto text-emerald-400 mb-2" />
                Loading MariaDB databases...
              </div>
            ) : filteredDbs.length === 0 ? (
              <div className="p-5 text-center space-y-2">
                <p className="text-[11.5px] text-purple-300/70">No databases found for <strong>{cpanelUser}</strong>.</p>
                <button
                  onClick={() => setCreateDbModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition cursor-pointer flex items-center gap-1 mx-auto"
                >
                  <Plus className="w-3 h-3" />
                  <span>Create First DB</span>
                </button>
              </div>
            ) : (
              filteredDbs.map((db) => {
                const isSelected = selectedDb === db.name;

                return (
                  <div key={db.name} className="space-y-0.5">
                    <button
                      onClick={() => {
                        setSelectedDb(db.name);
                        setImportTargetDb(db.name);
                        if (db.tables?.length > 0) {
                          setSelectedTable(db.tables[0].name);
                          setActiveTab('browse');
                        } else {
                          setSelectedTable('');
                          setActiveTab('structure');
                        }
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-between ${
                        isSelected 
                          ? 'bg-purple-900/60 border border-purple-600/40 text-emerald-300 font-bold shadow-sm' 
                          : 'text-purple-200 hover:bg-purple-900/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Database className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-purple-400'}`} />
                        <span className="truncate font-mono text-[12px]">{db.name}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 font-mono font-semibold border border-purple-800/40">
                        {db.tablesCount || 0}
                      </span>
                    </button>

                    {/* Table sub-tree */}
                    {isSelected && db.tables && db.tables.length > 0 && (
                      <div className="pl-4 pr-1 py-1 space-y-0.5 border-l border-purple-800/40 ml-3">
                        {db.tables.map((t) => {
                          const isTableSelected = selectedTable === t.name;

                          return (
                            <button
                              key={t.name}
                              onClick={() => {
                                setSelectedTable(t.name);
                                setActiveTab('browse');
                              }}
                              className={`w-full text-left px-2 py-1 rounded-lg text-[11.5px] flex items-center justify-between transition cursor-pointer ${
                                isTableSelected
                                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/50 font-bold'
                                  : 'text-purple-300/80 hover:bg-purple-900/30 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <Table className={`w-3 h-3 shrink-0 ${isTableSelected ? 'text-emerald-400' : 'text-purple-400/60'}`} />
                                <span className="truncate font-mono">{t.name}</span>
                              </div>
                              <span className={`text-[9.5px] ${isTableSelected ? 'text-emerald-300' : 'text-purple-400/50'}`}>
                                {t.rows !== undefined ? `${t.rows}r` : ''}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: phpMyAdmin Workspace & Tabs */}
        <div className="flex-1 min-w-0 bg-[#1c0830]/95 border border-purple-800/40 rounded-2xl shadow-xl overflow-hidden backdrop-blur-xl flex flex-col">
          
          {/* Workspace Tab Bar */}
          <div className="flex border-b border-purple-900/40 bg-purple-950/50 px-3 pt-2 overflow-x-auto gap-1">
            <button
              onClick={() => setActiveTab('databases')}
              className={`px-3.5 py-2 text-[12px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'databases'
                  ? 'border-emerald-400 text-emerald-300 bg-[#250c3d]/60 rounded-t-lg'
                  : 'border-transparent text-purple-300/70 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Databases</span>
            </button>

            <button
              onClick={() => setActiveTab('browse')}
              className={`px-3.5 py-2 text-[12px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'browse'
                  ? 'border-emerald-400 text-emerald-300 bg-[#250c3d]/60 rounded-t-lg'
                  : 'border-transparent text-purple-300/70 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Browse</span>
            </button>

            <button
              onClick={() => setActiveTab('structure')}
              className={`px-3.5 py-2 text-[12px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'structure'
                  ? 'border-emerald-400 text-emerald-300 bg-[#250c3d]/60 rounded-t-lg'
                  : 'border-transparent text-purple-300/70 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Structure</span>
            </button>

            <button
              onClick={() => setActiveTab('sql')}
              className={`px-3.5 py-2 text-[12px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'sql'
                  ? 'border-emerald-400 text-emerald-300 bg-[#250c3d]/60 rounded-t-lg'
                  : 'border-transparent text-purple-300/70 hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>SQL Console</span>
            </button>

            <button
              onClick={() => setActiveTab('import')}
              className={`px-3.5 py-2 text-[12px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'import'
                  ? 'border-emerald-400 text-emerald-300 bg-[#250c3d]/60 rounded-t-lg'
                  : 'border-transparent text-purple-300/70 hover:text-white'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Import (.SQL)</span>
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`px-3.5 py-2 text-[12px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'export'
                  ? 'border-emerald-400 text-emerald-300 bg-[#250c3d]/60 rounded-t-lg'
                  : 'border-transparent text-purple-300/70 hover:text-white'
              }`}
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>

          {/* Context Sub-Bar */}
          <div className="px-4 py-2 bg-[#180529]/70 border-b border-purple-900/40 text-[11.5px] flex flex-wrap items-center justify-between text-purple-300/80">
            <div>
              Server: <span className="font-bold text-white font-mono">127.0.0.1:3306</span>
              {' '}» Database: <span className="font-bold text-emerald-300 font-mono">{selectedDb || 'None Selected'}</span>
              {selectedTable && (
                <> » Table: <span className="font-bold text-amber-300 font-mono">{selectedTable}</span></>
              )}
            </div>
            {selectedDb && (
              <a
                href={api.getPhpMyAdminExportUrl(selectedDb)}
                download
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1"
              >
                <DownloadCloud className="w-3.5 h-3.5" /> Quick Export (.SQL)
              </a>
            )}
          </div>

          {/* Tab Content Body */}
          <div className="p-4 sm:p-6 flex-1 min-h-[420px]">
            
            {/* TAB: DATABASES OVERVIEW */}
            {activeTab === 'databases' && (
              <div className="space-y-6">
                {/* Create Database Box */}
                <div className="p-4 rounded-2xl bg-[#240c3c]/80 border border-purple-700/40 space-y-3">
                  <h3 className="text-[13.5px] font-bold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Create database in MariaDB</span>
                  </h3>
                  <form onSubmit={handleCreateDatabase} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-semibold text-purple-200 mb-1">Database Name</label>
                      <div className="flex items-center">
                        <span className="px-2.5 py-2 bg-purple-950/90 border border-r-0 border-purple-700/40 text-purple-300 text-[11.5px] rounded-l-xl font-mono font-bold">
                          {cpanelUser}_
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="shop_db"
                          value={newDbSuffix}
                          onChange={(e) => setNewDbSuffix(e.target.value)}
                          className="w-full px-3 py-2 bg-[#1b082e] border border-purple-700/40 rounded-r-xl text-[12px] text-white font-mono focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-purple-200 mb-1">Collation</label>
                      <select
                        value={newDbCollation}
                        onChange={(e) => setNewDbCollation(e.target.value)}
                        className="w-full px-3 py-2 bg-[#1b082e] border border-purple-700/40 rounded-xl text-[12px] text-white font-mono focus:outline-none focus:border-purple-400"
                      >
                        <option value="utf8mb4_unicode_ci">utf8mb4_unicode_ci (Recommended)</option>
                        <option value="utf8mb4_general_ci">utf8mb4_general_ci</option>
                        <option value="utf8_general_ci">utf8_general_ci</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        disabled={creatingDb}
                        className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[12px] rounded-xl shadow transition cursor-pointer disabled:opacity-50 h-[38px] flex items-center justify-center gap-1.5"
                      >
                        {creatingDb ? 'Creating...' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Databases Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[13.5px] font-bold text-white">Authorized Databases for {cpanelUser}</h3>
                    <span className="text-[11px] text-purple-300/70">Multi-tenant isolated per domain</span>
                  </div>

                  <div className="border border-purple-800/40 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-[12px]">
                      <thead className="bg-purple-950/70 border-b border-purple-900/40 text-[11px] font-bold text-purple-200 uppercase">
                        <tr>
                          <th className="p-3">Database</th>
                          <th className="p-3">Collation</th>
                          <th className="p-3">Tables</th>
                          <th className="p-3">Size</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-900/20 text-white">
                        {databases.map((d) => (
                          <tr key={d.name} className="hover:bg-purple-900/20 transition">
                            <td className="p-3 font-mono font-bold text-emerald-300 flex items-center gap-2">
                              <Database className="w-3.5 h-3.5 text-emerald-400" />
                              <button
                                onClick={() => {
                                  setSelectedDb(d.name);
                                  setImportTargetDb(d.name);
                                  setActiveTab('structure');
                                }}
                                className="hover:underline cursor-pointer"
                              >
                                {d.name}
                              </button>
                            </td>
                            <td className="p-3 font-mono text-purple-300/80">{d.collation || 'utf8mb4_unicode_ci'}</td>
                            <td className="p-3 font-mono">{d.tablesCount || 0}</td>
                            <td className="p-3 font-mono">{d.size || '0.00 MB'}</td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedDb(d.name);
                                  setImportTargetDb(d.name);
                                  setActiveTab('import');
                                }}
                                className="px-2.5 py-1 rounded bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-[11px] font-semibold border border-purple-700/40 transition cursor-pointer"
                              >
                                Import
                              </button>
                              <a
                                href={api.getPhpMyAdminExportUrl(d.name)}
                                download
                                className="px-2.5 py-1 rounded bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-[11px] font-semibold border border-purple-700/40 transition cursor-pointer inline-block"
                              >
                                Export
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: BROWSE TABLE DATA */}
            {activeTab === 'browse' && (
              <div className="space-y-4">
                {loadingTable ? (
                  <div className="p-12 text-center text-purple-300/60 text-[13px]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-400 mb-2" />
                    Fetching live MariaDB table data...
                  </div>
                ) : !selectedTable ? (
                  <div className="p-12 text-center text-purple-300/60 text-[13px] space-y-3">
                    <Table className="w-8 h-8 text-purple-400/50 mx-auto" />
                    <p>Select a table from the left sidebar to browse its rows.</p>
                    {selectedDb && (
                      <button
                        onClick={() => setActiveTab('structure')}
                        className="px-4 py-2 rounded-xl bg-purple-900/60 hover:bg-purple-800 text-purple-200 font-bold text-xs border border-purple-700/40"
                      >
                        View Database Tables Schema
                      </button>
                    )}
                  </div>
                ) : !browseData || !browseData.rows ? (
                  <div className="p-8 text-center text-purple-300/60 text-[13px]">
                    No data in table `${selectedTable}`.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[12px] text-purple-300">
                      <div>
                        Showing rows <strong className="text-white">1 - {browseData.rows.length}</strong> of table <span className="font-mono font-bold text-amber-300">`${selectedTable}`</span>
                      </div>
                      <button
                        onClick={loadTableDetails}
                        className="px-2.5 py-1 rounded bg-purple-900/50 text-purple-200 hover:text-white border border-purple-800/40 text-[11px] cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>

                    <div className="border border-purple-800/40 rounded-xl overflow-x-auto max-h-[50vh]">
                      <table className="w-full text-left border-collapse text-[12px]">
                        <thead className="bg-purple-950/70 border-b border-purple-900/40 text-[11px] font-bold text-purple-200 uppercase">
                          <tr>
                            <th className="p-2.5 text-center w-10">#</th>
                            {browseData.columns.map(c => (
                              <th key={c} className="p-2.5 font-mono">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-900/20 text-white">
                          {browseData.rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-purple-900/20 transition">
                              <td className="p-2 text-center text-purple-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>
                              {browseData.columns.map((col) => (
                                <td key={col} className="p-2 font-mono text-purple-100 whitespace-nowrap max-w-xs truncate">
                                  {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="text-purple-400/50 italic">NULL</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: STRUCTURE */}
            {activeTab === 'structure' && (
              <div className="space-y-4">
                {loadingTable ? (
                  <div className="p-8 text-center text-purple-300/60 text-[13px]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-400 mb-2" />
                    Loading MariaDB schema structure...
                  </div>
                ) : !selectedDb ? (
                  <div className="p-8 text-center text-purple-300/60 text-[13px]">
                    Please select a database from the left sidebar.
                  </div>
                ) : selectedTable && structureData?.columns ? (
                  /* Single Table Columns Structure */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="font-bold text-white">Table Structure: `${selectedTable}`</span>
                      <button
                        onClick={() => setSelectedTable('')}
                        className="text-[11px] text-purple-300 hover:text-emerald-300 underline cursor-pointer"
                      >
                        ← Back to database tables
                      </button>
                    </div>

                    <div className="border border-purple-800/40 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-[12px]">
                        <thead className="bg-purple-950/70 border-b border-purple-900/40 text-[11px] font-bold text-purple-200 uppercase">
                          <tr>
                            <th className="p-2.5">Field / Column</th>
                            <th className="p-2.5">Type</th>
                            <th className="p-2.5">Null</th>
                            <th className="p-2.5">Key</th>
                            <th className="p-2.5">Default</th>
                            <th className="p-2.5">Extra</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-900/20 text-white">
                          {structureData.columns.map((c) => (
                            <tr key={c.field} className="hover:bg-purple-900/20 transition">
                              <td className="p-2.5 font-bold font-mono text-emerald-300">{c.field}</td>
                              <td className="p-2.5 font-mono text-purple-200">{c.type}</td>
                              <td className="p-2.5 text-purple-300/80">{c.null}</td>
                              <td className="p-2.5 font-bold text-amber-400 font-mono">{c.key}</td>
                              <td className="p-2.5 text-purple-300 font-mono">{c.default !== null ? String(c.default) : 'NULL'}</td>
                              <td className="p-2.5 text-purple-300/80">{c.extra}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* Database Tables List */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[13.5px] font-bold text-white">Tables in database `${selectedDb}`</h3>
                      <button
                        onClick={() => setActiveTab('import')}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Import Tables (.SQL)</span>
                      </button>
                    </div>

                    {(!databases.find(d => d.name === selectedDb)?.tables || databases.find(d => d.name === selectedDb)?.tables.length === 0) ? (
                      <div className="p-10 text-center space-y-3 bg-[#240c3c]/40 rounded-2xl border border-purple-800/30">
                        <Table className="w-8 h-8 text-purple-400/50 mx-auto" />
                        <p className="text-[12.5px] text-purple-300">No tables found in database <strong>{selectedDb}</strong>.</p>
                        <div className="flex items-center justify-center gap-2 pt-2">
                          <button
                            onClick={() => setActiveTab('import')}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow transition cursor-pointer"
                          >
                            Upload .SQL Dump
                          </button>
                          <button
                            onClick={() => {
                              setSqlQuery(`CREATE TABLE \`users\` (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
                              setActiveTab('sql');
                            }}
                            className="px-4 py-2 rounded-xl bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-xs font-semibold border border-purple-700/40 cursor-pointer"
                          >
                            Create Table with SQL
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="border border-purple-800/40 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse text-[12px]">
                          <thead className="bg-purple-950/70 border-b border-purple-900/40 text-[11px] font-bold text-purple-200 uppercase">
                            <tr>
                              <th className="p-3">Table Name</th>
                              <th className="p-3">Action</th>
                              <th className="p-3">Rows</th>
                              <th className="p-3">Engine</th>
                              <th className="p-3">Collation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-900/20 text-white">
                            {databases.find(d => d.name === selectedDb)?.tables.map(t => (
                              <tr key={t.name} className="hover:bg-purple-900/20 transition">
                                <td className="p-3 font-mono font-bold text-emerald-300">
                                  <button
                                    onClick={() => {
                                      setSelectedTable(t.name);
                                      setActiveTab('browse');
                                    }}
                                    className="hover:underline cursor-pointer flex items-center gap-1.5"
                                  >
                                    <Table className="w-3.5 h-3.5 text-purple-400" />
                                    <span>{t.name}</span>
                                  </button>
                                </td>
                                <td className="p-3 space-x-2">
                                  <button
                                    onClick={() => {
                                      setSelectedTable(t.name);
                                      setActiveTab('browse');
                                    }}
                                    className="px-2 py-0.5 rounded bg-purple-900/50 text-emerald-300 text-[11px] hover:bg-purple-800 font-semibold cursor-pointer"
                                  >
                                    Browse
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedTable(t.name);
                                      setActiveTab('structure');
                                    }}
                                    className="px-2 py-0.5 rounded bg-purple-900/50 text-purple-200 text-[11px] hover:bg-purple-800 font-semibold cursor-pointer"
                                  >
                                    Structure
                                  </button>
                                </td>
                                <td className="p-3 font-mono">{t.rows !== undefined ? t.rows : 0}</td>
                                <td className="p-3 font-mono text-purple-300/80">InnoDB</td>
                                <td className="p-3 font-mono text-purple-300/80">utf8mb4_unicode_ci</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: SQL CONSOLE */}
            {activeTab === 'sql' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                  <span className="font-bold text-white">Run SQL query on MariaDB `${selectedDb || databases[0]?.name || 'default'}`:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setSqlQuery(`SELECT * FROM \`${selectedTable || 'users'}\` LIMIT 25;`)}
                      className="px-2 py-1 rounded-lg bg-purple-900/50 hover:bg-purple-800 text-[11px] font-mono text-purple-200 cursor-pointer border border-purple-700/40"
                    >
                      SELECT *
                    </button>
                    <button
                      onClick={() => setSqlQuery(`SHOW TABLES;`)}
                      className="px-2 py-1 rounded-lg bg-purple-900/50 hover:bg-purple-800 text-[11px] font-mono text-purple-200 cursor-pointer border border-purple-700/40"
                    >
                      SHOW TABLES
                    </button>
                    <button
                      onClick={() => setSqlQuery(`CREATE TABLE IF NOT EXISTS \`custom_table\` (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`)}
                      className="px-2 py-1 rounded-lg bg-purple-900/50 hover:bg-purple-800 text-[11px] font-mono text-purple-200 cursor-pointer border border-purple-700/40"
                    >
                      CREATE TABLE
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={6}
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    className="w-full p-3 font-mono text-[12.5px] bg-[#180529] text-emerald-400 rounded-xl border border-purple-700/50 focus:outline-none focus:border-emerald-400 shadow-inner"
                    placeholder="Enter SQL statement here (e.g., SELECT * FROM ...;)"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] text-purple-300/60">Live MariaDB queries run with strict tenant permissions</span>
                  <button
                    onClick={handleRunSql}
                    disabled={executingSql || !sqlQuery.trim()}
                    className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[12.5px] font-bold rounded-xl transition cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-md"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{executingSql ? 'Executing Query...' : 'Go / Execute Query'}</span>
                  </button>
                </div>

                {/* Query Output */}
                {queryResult && (
                  <div className="mt-4 p-4 bg-[#240c3c]/90 border border-purple-700/50 rounded-xl space-y-2 text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-bold text-white">{queryResult.message || queryResult.error}</span>
                      {queryResult.type && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 uppercase">
                          {queryResult.type}
                        </span>
                      )}
                    </div>

                    {queryResult.rows && queryResult.rows.length > 0 && (
                      <div className="border border-purple-800/40 rounded-xl max-h-[35vh] overflow-auto">
                        <table className="w-full text-left border-collapse text-[12px]">
                          <thead className="bg-purple-950/80 border-b border-purple-900/40 font-bold text-purple-200 uppercase text-[11px]">
                            <tr>
                              {queryResult.columns?.map(c => (
                                <th key={c} className="p-2 font-mono">{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-900/20">
                            {queryResult.rows.map((r, i) => (
                              <tr key={i} className="hover:bg-purple-900/20 transition">
                                {queryResult.columns?.map(c => (
                                  <td key={c} className="p-2 font-mono text-purple-100 truncate max-w-xs">
                                    {String(r[c])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: IMPORT (.SQL FILE UPLOAD & EXECUTE) */}
            {activeTab === 'import' && (
              <div className="space-y-5 max-w-3xl">
                <div className="border-b border-purple-900/40 pb-3">
                  <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                    <UploadCloud className="w-5 h-5 text-emerald-400" />
                    <span>Import SQL Dump into MariaDB</span>
                  </h3>
                  <p className="text-[12px] text-purple-200/70 mt-0.5">
                    Upload a <code>.sql</code>, <code>.sql.gz</code>, or <code>.txt</code> file to import tables and records directly into your MariaDB database.
                  </p>
                </div>

                {/* Target Database Picker */}
                <div className="bg-[#240c3c]/60 p-4 rounded-2xl border border-purple-700/40 space-y-2">
                  <label className="block text-[12px] font-bold text-white">Target Database</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={importTargetDb || selectedDb || (databases[0]?.name || '')}
                      onChange={(e) => setImportTargetDb(e.target.value)}
                      className="px-3 py-2 bg-[#1b082e] border border-purple-700/40 rounded-xl text-[12.5px] text-white font-mono focus:outline-none focus:border-purple-400 min-w-[240px]"
                    >
                      {databases.map(d => (
                        <option key={d.name} value={d.name}>{d.name} ({d.tablesCount || 0} tables)</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setCreateDbModal(true)}
                      className="px-3 py-2 rounded-xl bg-purple-900/50 hover:bg-purple-800 text-emerald-300 font-semibold text-xs border border-purple-700/40 cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create New Target DB</span>
                    </button>
                  </div>
                </div>

                {/* File Upload Dropzone */}
                <div className="p-6 bg-gradient-to-br from-[#240c3c]/80 to-[#170529]/80 border-2 border-dashed border-purple-600/50 rounded-2xl text-center space-y-3 shadow-inner">
                  <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-700/40 flex items-center justify-center text-emerald-400 mx-auto shadow-md">
                    <FileUp className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-[13.5px] font-bold text-white">Choose a .SQL File to Upload &amp; Import</h4>
                    <p className="text-[11.5px] text-purple-300/70 mt-0.5">
                      Max file size: 5000 MB (Unlimited VPS limit). Supported formats: <code>.sql</code>, <code>.txt</code>
                    </p>
                  </div>

                  <div className="pt-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".sql,.txt,.gz"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="sql-file-upload"
                    />
                    <label
                      htmlFor="sql-file-upload"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg transition cursor-pointer"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>Browse from Computer</span>
                    </label>
                  </div>

                  {uploadedFileName && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-600/50 text-[11.5px] font-mono mt-2">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Loaded: {uploadedFileName} ({(uploadedFileSize / 1024).toFixed(1)} KB)</span>
                    </div>
                  )}
                </div>

                {/* Or Paste Raw SQL Dump Textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] font-bold text-purple-200">Or Paste Raw SQL Statements:</label>
                    {importSqlText && (
                      <button
                        type="button"
                        onClick={() => setImportSqlText('')}
                        className="text-[11px] text-purple-400 hover:text-rose-400 underline cursor-pointer"
                      >
                        Clear buffer
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={6}
                    value={importSqlText}
                    onChange={(e) => setImportSqlText(e.target.value)}
                    className="w-full p-3 font-mono text-[12px] bg-[#180529] text-emerald-300 border border-purple-700/40 rounded-xl focus:outline-none focus:border-emerald-400 shadow-inner"
                    placeholder="CREATE TABLE ... INSERT INTO ...;"
                  />
                </div>

                {/* Execute Import Button */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-purple-300/60">
                    Target: <strong className="text-emerald-300 font-mono">{importTargetDb || selectedDb || (databases[0]?.name || 'None')}</strong>
                  </span>
                  <button
                    onClick={handleImportSql}
                    disabled={importing || !importSqlText.trim()}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[13px] font-bold rounded-xl transition cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-lg"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{importing ? 'Importing SQL into MariaDB...' : 'Execute Import'}</span>
                  </button>
                </div>

                {/* Import Result Feedback */}
                {importResult && (
                  <div className={`p-4 rounded-xl text-[12.5px] border ${
                    importResult.error 
                      ? 'bg-rose-950/70 border-rose-600/50 text-rose-300' 
                      : 'bg-emerald-950/70 border-emerald-600/50 text-emerald-300'
                  }`}>
                    <div className="font-bold flex items-center gap-2">
                      {importResult.error ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>{importResult.message || importResult.error}</span>
                    </div>
                    {importResult.executedCount !== undefined && (
                      <div className="text-[11.5px] mt-1 font-mono text-purple-200">
                        Executed {importResult.executedCount} queries successfully against `${importResult.database}`.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: EXPORT DATABASE */}
            {activeTab === 'export' && (
              <div className="space-y-4 max-w-lg">
                <div className="border-b border-purple-900/40 pb-3">
                  <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                    <DownloadCloud className="w-5 h-5 text-emerald-400" />
                    <span>Exporting database `${selectedDb || databases[0]?.name || ''}`</span>
                  </h3>
                  <p className="text-[12px] text-purple-200/70 mt-0.5">
                    Generate and download a full SQL dump including CREATE TABLE and INSERT statements.
                  </p>
                </div>

                <div className="bg-[#240c3c]/80 p-4 rounded-xl border border-purple-700/40 space-y-3 text-[12.5px] text-purple-200">
                  <div className="font-bold text-white">Export Options:</div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportStructure}
                      onChange={(e) => setExportStructure(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span>Include Table Structure (CREATE TABLE, DROP TABLE)</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportData}
                      onChange={(e) => setExportData(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span>Include Table Data (INSERT INTO rows)</span>
                  </label>
                </div>

                <div className="pt-2">
                  <a
                    href={api.getPhpMyAdminExportUrl(selectedDb || databases[0]?.name || '', exportStructure, exportData)}
                    download
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[13px] font-bold rounded-xl transition cursor-pointer shadow-lg"
                  >
                    <DownloadCloud className="w-4 h-4" />
                    <span>Download `${selectedDb || databases[0]?.name || 'database'}.sql`</span>
                  </a>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* CREATE DATABASE MODAL */}
      {createDbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-[#1c0830] rounded-2xl border border-purple-700/60 shadow-2xl w-full max-w-md overflow-hidden text-left animate-in fade-in duration-200">
            <div className="px-5 py-4 border-b border-purple-900/40 flex items-center justify-between bg-gradient-to-r from-purple-950/70 to-emerald-950/50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-900/60 flex items-center justify-center text-emerald-400 border border-purple-700/40">
                  <Database className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-[14px] text-white">Create New MariaDB Database</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setCreateDbModal(false)}
                className="text-purple-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDatabase} className="p-5 space-y-4 text-[12.5px]">
              <div>
                <label className="block font-semibold text-purple-200 mb-1.5">
                  Database Name
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-purple-950/90 border border-r-0 border-purple-700/40 text-purple-300 text-[12px] rounded-l-xl font-mono font-bold">
                    {cpanelUser}_
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="my_database"
                    value={newDbSuffix}
                    onChange={(e) => setNewDbSuffix(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#260c3e]/80 border border-purple-700/40 rounded-r-xl text-[12.5px] text-white font-mono focus:outline-none focus:border-purple-400"
                  />
                </div>
                <span className="text-[10.5px] text-purple-300/60 block mt-1">
                  Full name will be: <strong className="text-emerald-300 font-mono">{cpanelUser}_{newDbSuffix || '...'}</strong>
                </span>
              </div>

              <div>
                <label className="block font-semibold text-purple-200 mb-1.5">
                  Collation
                </label>
                <select
                  value={newDbCollation}
                  onChange={(e) => setNewDbCollation(e.target.value)}
                  className="w-full px-3 py-2 bg-[#260c3e]/80 border border-purple-700/40 rounded-xl text-[12.5px] text-white font-mono focus:outline-none focus:border-purple-400"
                >
                  <option value="utf8mb4_unicode_ci">utf8mb4_unicode_ci (Recommended)</option>
                  <option value="utf8mb4_general_ci">utf8mb4_general_ci</option>
                  <option value="utf8_general_ci">utf8_general_ci</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateDbModal(false)}
                  className="px-4 py-2 border border-purple-800/40 rounded-xl text-purple-300 hover:bg-purple-900/30 text-[12px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingDb}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-[12.5px] cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {creatingDb ? 'Creating...' : 'Create Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
