import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { 
  Database, Table, Play, RefreshCw, DownloadCloud, UploadCloud, 
  Search, Plus, Trash2, Key, CheckCircle2, AlertTriangle, 
  ChevronRight, ChevronDown, ArrowLeft, ExternalLink, Server, 
  FileText, Copy, Sliders, Check, X, ShieldCheck, AlertCircle,
  Eye, Code2, Edit3, CornerDownRight
} from 'lucide-react';

export default function PhpMyAdmin({ initialJumpDb, onNavigate }) {
  const [status, setStatus] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedDb, setSelectedDb] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'structure' | 'sql' | 'search' | 'insert' | 'export' | 'import' | 'operations'

  // Table Data & Structure
  const [browseData, setBrowseData] = useState(null);
  const [structureData, setStructureData] = useState(null);
  const [loadingTable, setLoadingTable] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // SQL Console
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM wp_posts LIMIT 10;');
  const [queryResult, setQueryResult] = useState(null);
  const [executingSql, setExecutingSql] = useState(false);

  // Import & Export
  const [importSqlText, setImportSqlText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [exportStructure, setExportStructure] = useState(true);
  const [exportData, setExportData] = useState(true);

  // SSO Session
  const [ssoToken, setSsoToken] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  // Notifications
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });

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
        api.getPhpMyAdminDatabases()
      ]);
      setStatus(statusRes);
      const dbs = dbsRes.databases || [];
      setDatabases(dbs);

      // Determine active database
      const urlParams = new URLSearchParams(window.location.search);
      const jumpDb = initialJumpDb || urlParams.get('db') || (dbs.length > 0 ? dbs[0].name : '');

      if (jumpDb) {
        setSelectedDb(jumpDb);
        if (dbs.find(d => d.name === jumpDb)?.tables?.length > 0) {
          const firstTable = dbs.find(d => d.name === jumpDb).tables[0].name;
          setSelectedTable(firstTable);
        }
      }

      // Create SSO Session token
      try {
        const ssoRes = await api.createPhpMyAdminSession(jumpDb);
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
  }, []);

  // 2. Load Table Data or Structure when selectedTable changes
  const loadTableDetails = async () => {
    if (!selectedDb || !selectedTable) return;
    setLoadingTable(true);
    setQueryResult(null);
    try {
      if (activeTab === 'browse') {
        const res = await api.browsePhpMyAdminTable({
          db: selectedDb,
          table: selectedTable,
          page: currentPage,
          limit: pageSize
        });
        setBrowseData(res);
      } else if (activeTab === 'structure') {
        const res = await api.getPhpMyAdminStructure(selectedDb, selectedTable);
        setStructureData(res);
      }
    } catch (err) {
      showNotification('Failed to load table details: ' + err.message, true);
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    if (selectedDb && selectedTable) {
      loadTableDetails();
    }
  }, [selectedDb, selectedTable, activeTab, currentPage, pageSize]);

  // Handle SQL Execution
  const handleRunSql = async () => {
    if (!selectedDb) {
      showNotification('Please select a database first', true);
      return;
    }
    setExecutingSql(true);
    setQueryResult(null);
    try {
      const res = await api.executePhpMyAdminQuery({
        database: selectedDb,
        query: sqlQuery
      });
      setQueryResult(res);
      showNotification(res.message || 'Query executed successfully');
      // Refresh database table list
      api.getPhpMyAdminDatabases().then(res => setDatabases(res.databases || []));
    } catch (err) {
      showNotification(err.message, true);
      setQueryResult({ error: err.message });
    } finally {
      setExecutingSql(false);
    }
  };

  // Handle Import
  const handleImportSql = async () => {
    if (!selectedDb || !importSqlText.trim()) {
      showNotification('Please provide SQL statements to import', true);
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await api.importPhpMyAdminSql({
        database: selectedDb,
        sql: importSqlText
      });
      setImportResult(res);
      showNotification(res.message);
      setImportSqlText('');
      // Refresh tables
      api.getPhpMyAdminDatabases().then(res => setDatabases(res.databases || []));
    } catch (err) {
      showNotification('Import failed: ' + err.message, true);
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
    }
  };

  // Handle File Upload Import
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setImportSqlText(evt.target.result);
      showNotification(`Loaded ${file.name} (${(file.size / 1024).toFixed(1)} KB) into import buffer`);
    };
    reader.readAsText(file);
  };

  const copySsoToken = () => {
    navigator.clipboard.writeText(ssoToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
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
        <span className="text-slate-400">Databases</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-slate-700">phpMyAdmin</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#e3e5e8]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#f35927]/10 flex items-center justify-center text-[#f35927]">
              <Database className="w-5 h-5 stroke-[2]" />
            </div>
            <h1 className="text-[22px] font-bold text-[#1f2533] tracking-tight flex items-center gap-2">
              phpMyAdmin
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                {status?.version || 'v5.2.1'}
              </span>
            </h1>
          </div>
          <p className="text-[13px] text-slate-600 mt-1">
            Web interface for MySQL & MariaDB database administration, structure inspection, SQL query runner, and imports/exports.
          </p>
        </div>

        {/* Server Status & SSO Pill */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-[4px] bg-slate-50 border border-slate-200 text-[11.5px] text-slate-600 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status?.serverConnected ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
            <span className="font-medium">
              {status?.serverConnected ? `MariaDB ${status?.databaseVersion || ''} (Live)` : 'Local Sandbox Engine'}
            </span>
          </div>

          {ssoToken && (
            <div className="px-3 py-1.5 rounded-[4px] bg-slate-50 border border-slate-200 text-[11.5px] text-slate-600 flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>SSO Active</span>
              <button 
                onClick={copySsoToken} 
                className="text-slate-500 hover:text-slate-800 ml-1 cursor-pointer"
                title="Copy SSO Session Token"
              >
                {copiedToken ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main 2-Column Interface */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        
        {/* LEFT COLUMN: Database & Table Tree Navigator */}
        <div className="w-full lg:w-[280px] shrink-0 bg-white border border-[#e3e5e8] rounded-[4px] shadow-2xs overflow-hidden">
          <div className="p-3 bg-[#f8f9fa] border-b border-[#e3e5e8] flex items-center justify-between">
            <span className="text-[12px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#f35927]" />
              Authorized Databases
            </span>
            <button
              onClick={loadInitialData}
              className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
              title="Refresh database list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="p-2 max-h-[70vh] overflow-y-auto space-y-1 text-[13px]">
            {loading ? (
              <div className="p-6 text-center text-slate-500 text-[12px]">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto text-[#f35927] mb-1.5" />
                Loading databases...
              </div>
            ) : databases.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-[12px] space-y-1">
                <AlertCircle className="w-5 h-5 text-amber-500 mx-auto" />
                <div className="font-semibold text-slate-700">No databases found</div>
                <div className="text-[11px] text-slate-500">Create a database in "Manage My Databases" to begin.</div>
              </div>
            ) : (
              databases.map((db) => {
                const isSelected = selectedDb === db.name;

                return (
                  <div key={db.name} className="space-y-0.5">
                    <button
                      onClick={() => {
                        setSelectedDb(db.name);
                        if (db.tables && db.tables.length > 0) {
                          setSelectedTable(db.tables[0].name);
                        } else {
                          setSelectedTable('');
                        }
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-[3px] font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#f35927]/10 text-[#f35927] font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Database className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#f35927]' : 'text-slate-400'}`} />
                        <span className="truncate font-mono text-[12.5px]">{db.name}</span>
                      </div>
                      <span className="text-[10.5px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono font-bold">
                        {db.tablesCount || 0}
                      </span>
                    </button>

                    {/* Table sub-tree */}
                    {isSelected && db.tables && db.tables.length > 0 && (
                      <div className="pl-5 pr-1 py-1 space-y-0.5 border-l-2 border-slate-200 ml-3">
                        {db.tables.map((t) => {
                          const isTableSelected = selectedTable === t.name;

                          return (
                            <button
                              key={t.name}
                              onClick={() => setSelectedTable(t.name)}
                              className={`w-full text-left px-2 py-1 rounded-[3px] text-[12px] flex items-center justify-between transition-colors cursor-pointer ${
                                isTableSelected
                                  ? 'bg-[#185dc4] text-white font-bold'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <Table className={`w-3 h-3 shrink-0 ${isTableSelected ? 'text-white' : 'text-slate-400'}`} />
                                <span className="truncate font-mono">{t.name}</span>
                              </div>
                              <span className={`text-[10px] ${isTableSelected ? 'text-blue-200' : 'text-slate-400'}`}>
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
        <div className="flex-1 min-w-0 bg-white border border-[#e3e5e8] rounded-[4px] shadow-2xs overflow-hidden flex flex-col">
          
          {/* Workspace Tab Bar */}
          <div className="flex border-b border-[#d8dce2] bg-[#f8f9fa] px-3 pt-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('browse')}
              className={`px-3.5 py-2 text-[12.5px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'browse'
                  ? 'border-[#f35927] text-[#f35927] bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Browse
            </button>

            <button
              onClick={() => setActiveTab('structure')}
              className={`px-3.5 py-2 text-[12.5px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'structure'
                  ? 'border-[#f35927] text-[#f35927] bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Structure
            </button>

            <button
              onClick={() => setActiveTab('sql')}
              className={`px-3.5 py-2 text-[12.5px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'sql'
                  ? 'border-[#f35927] text-[#f35927] bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              SQL Console
            </button>

            <button
              onClick={() => setActiveTab('import')}
              className={`px-3.5 py-2 text-[12.5px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'import'
                  ? 'border-[#f35927] text-[#f35927] bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Import
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`px-3.5 py-2 text-[12.5px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'export'
                  ? 'border-[#f35927] text-[#f35927] bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              Export
            </button>
          </div>

          {/* Active Database Context Bar */}
          <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-200 text-[12px] flex items-center justify-between text-slate-600">
            <div>
              Server: <span className="font-bold text-slate-800 font-mono">127.0.0.1:3306</span>
              {' '}» Database: <span className="font-bold text-[#185dc4] font-mono">{selectedDb || 'None'}</span>
              {selectedTable && (
                <> » Table: <span className="font-bold text-[#f35927] font-mono">{selectedTable}</span></>
              )}
            </div>
            {selectedDb && (
              <a
                href={api.getPhpMyAdminExportUrl(selectedDb)}
                download
                className="text-[11.5px] font-semibold text-[#185dc4] hover:underline flex items-center gap-1"
              >
                <DownloadCloud className="w-3.5 h-3.5" /> Export DB SQL
              </a>
            )}
          </div>

          {/* Workspace Body */}
          <div className="p-4 flex-1">
            
            {/* TAB: BROWSE */}
            {activeTab === 'browse' && (
              <div className="space-y-3">
                {loadingTable ? (
                  <div className="p-8 text-center text-slate-500 text-[13px]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#f35927] mb-2" />
                    Fetching rows from {selectedTable}...
                  </div>
                ) : !selectedTable ? (
                  <div className="p-8 text-center text-slate-500 text-[13px]">
                    Select a table from the left sidebar to browse its rows.
                  </div>
                ) : browseData?.rows?.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-[13px] space-y-1">
                    <Table className="w-6 h-6 text-slate-400 mx-auto" />
                    <div className="font-semibold text-slate-700">Table is empty</div>
                    <div className="text-[12px] text-slate-500">Zero rows returned in table '{selectedTable}'.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[12px] text-slate-600">
                      <div>
                        Showing rows <span className="font-bold text-slate-800">{browseData?.rows?.length || 0}</span> (Total: {browseData?.totalRows || 0}, Query took {browseData?.executionTime || '0.001s'})
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded max-h-[55vh] overflow-x-auto overflow-y-auto">
                      <table className="w-full text-left border-collapse text-[12.5px]">
                        <thead className="bg-[#f8f9fa] sticky top-0 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                          <tr>
                            <th className="p-2.5 w-12 text-center">#</th>
                            {browseData?.columns?.map((col) => (
                              <th key={col} className="p-2.5 font-mono text-slate-700 whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {browseData?.rows?.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80">
                              <td className="p-2 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>
                              {browseData.columns.map((col) => (
                                <td key={col} className="p-2 font-mono text-slate-800 whitespace-nowrap max-w-xs truncate">
                                  {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="text-slate-400 italic">NULL</span>}
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
              <div className="space-y-3">
                {loadingTable ? (
                  <div className="p-8 text-center text-slate-500 text-[13px]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#f35927] mb-2" />
                    Loading table schema...
                  </div>
                ) : !selectedTable ? (
                  <div className="p-8 text-center text-slate-500 text-[13px]">
                    Select a table to inspect column structure and indexes.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border border-slate-200 rounded overflow-hidden">
                      <table className="w-full text-left border-collapse text-[12.5px]">
                        <thead className="bg-[#f8f9fa] border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                          <tr>
                            <th className="p-2.5">Field / Name</th>
                            <th className="p-2.5">Type</th>
                            <th className="p-2.5">Null</th>
                            <th className="p-2.5">Key</th>
                            <th className="p-2.5">Default</th>
                            <th className="p-2.5">Extra</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {structureData?.columns?.map((c) => (
                            <tr key={c.field} className="hover:bg-slate-50/80">
                              <td className="p-2.5 font-bold font-mono text-slate-800">{c.field}</td>
                              <td className="p-2.5 font-mono text-slate-600">{c.type}</td>
                              <td className="p-2.5 text-slate-500">{c.null}</td>
                              <td className="p-2.5 font-bold text-amber-600 font-mono">{c.key}</td>
                              <td className="p-2.5 text-slate-500 font-mono">{c.default !== null ? String(c.default) : 'NULL'}</td>
                              <td className="p-2.5 text-slate-500">{c.extra}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: SQL CONSOLE */}
            {activeTab === 'sql' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="font-bold text-slate-700">Run SQL query on database `{selectedDb}`:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSqlQuery(`SELECT * FROM \`${selectedTable || 'wp_posts'}\` LIMIT 25;`)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-slate-700 cursor-pointer"
                    >
                      SELECT *
                    </button>
                    <button
                      onClick={() => setSqlQuery(`SHOW TABLES;`)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-slate-700 cursor-pointer"
                    >
                      SHOW TABLES
                    </button>
                    <button
                      onClick={() => setSqlQuery(`CREATE TABLE IF NOT EXISTS \`custom_table\` (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100));`)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-slate-700 cursor-pointer"
                    >
                      CREATE TABLE
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={5}
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    className="w-full p-3 font-mono text-[13px] bg-slate-900 text-emerald-400 rounded border border-slate-700 focus:outline-none focus:ring-1 focus:ring-[#f35927]"
                    placeholder="Enter SQL statement here..."
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] text-slate-500">Queries execute against authenticated database sandbox</span>
                  <button
                    onClick={handleRunSql}
                    disabled={executingSql || !sqlQuery.trim()}
                    className="px-4 py-1.5 bg-[#f35927] hover:bg-[#e04817] text-white text-[12.5px] font-bold rounded-[3px] transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {executingSql ? 'Executing Query...' : 'Go / Execute'}
                  </button>
                </div>

                {/* Query Output */}
                {queryResult && (
                  <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-bold text-slate-800">{queryResult.message}</span>
                      {queryResult.type && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                          {queryResult.type}
                        </span>
                      )}
                    </div>

                    {queryResult.rows && queryResult.rows.length > 0 && (
                      <div className="border border-slate-200 rounded max-h-[35vh] overflow-auto">
                        <table className="w-full text-left border-collapse text-[12px]">
                          <thead className="bg-[#f8f9fa] border-b border-slate-200 font-bold text-slate-600 uppercase text-[11px]">
                            <tr>
                              {queryResult.columns?.map(c => (
                                <th key={c} className="p-2 font-mono">{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {queryResult.rows.map((r, i) => (
                              <tr key={i} className="hover:bg-slate-100/50">
                                {queryResult.columns?.map(c => (
                                  <td key={c} className="p-2 font-mono text-slate-800 truncate max-w-xs">
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

            {/* TAB: IMPORT */}
            {activeTab === 'import' && (
              <div className="space-y-4 max-w-2xl">
                <div className="border-b border-slate-200 pb-2">
                  <h3 className="text-[14px] font-bold text-slate-800">Importing into database `{selectedDb}`</h3>
                  <p className="text-[12px] text-slate-600">Select a .sql file or paste SQL dump queries below.</p>
                </div>

                <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded text-center space-y-2">
                  <UploadCloud className="w-6 h-6 text-slate-400 mx-auto" />
                  <div className="text-[12.5px] font-bold text-slate-700">Choose .SQL file to import</div>
                  <input
                    type="file"
                    accept=".sql,.txt"
                    onChange={handleFileUpload}
                    className="text-[12px] text-slate-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700">Or Paste SQL Dump Statements:</label>
                  <textarea
                    rows={6}
                    value={importSqlText}
                    onChange={(e) => setImportSqlText(e.target.value)}
                    className="w-full p-2.5 font-mono text-[12px] border border-slate-300 rounded focus:outline-none focus:border-[#f35927]"
                    placeholder="CREATE TABLE ... INSERT INTO ..."
                  />
                </div>

                <button
                  onClick={handleImportSql}
                  disabled={importing || !importSqlText.trim()}
                  className="px-4 py-2 bg-[#f35927] hover:bg-[#e04817] text-white text-[12.5px] font-bold rounded-[3px] transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  {importing ? 'Importing SQL...' : 'Execute Import'}
                </button>

                {importResult && (
                  <div className={`p-3 rounded text-[12.5px] border ${
                    importResult.error 
                      ? 'bg-red-50 border-red-200 text-red-800' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    {importResult.message || importResult.error}
                  </div>
                )}
              </div>
            )}

            {/* TAB: EXPORT */}
            {activeTab === 'export' && (
              <div className="space-y-4 max-w-lg">
                <div className="border-b border-slate-200 pb-2">
                  <h3 className="text-[14px] font-bold text-slate-800">Exporting database `{selectedDb}`</h3>
                  <p className="text-[12px] text-slate-600">Export tables and rows into standard SQL format.</p>
                </div>

                <div className="space-y-2 text-[13px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportStructure}
                      onChange={(e) => setExportStructure(e.target.checked)}
                      className="rounded text-[#f35927] focus:ring-[#f35927]"
                    />
                    <span>Include Table Structure (<code>CREATE TABLE</code>)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportData}
                      onChange={(e) => setExportData(e.target.checked)}
                      className="rounded text-[#f35927] focus:ring-[#f35927]"
                    />
                    <span>Include Table Data Rows (<code>INSERT INTO</code>)</span>
                  </label>
                </div>

                <a
                  href={api.getPhpMyAdminExportUrl(selectedDb, exportStructure, exportData)}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#185dc4] hover:bg-[#13499b] text-white text-[12.5px] font-bold rounded-[3px] transition-colors"
                >
                  <DownloadCloud className="w-4 h-4" />
                  Download SQL Dump File
                </a>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
