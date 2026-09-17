import React, { useState, useEffect, useMemo } from 'react';
import { 
  HardDrive, Folder, FolderOpen, ChevronRight, ChevronDown, 
  RefreshCw, Search, ArrowUpDown, ArrowUp, ArrowDown, 
  AlertTriangle, Check, X, ExternalLink, Database, Layers, 
  FileText, Clock, PieChart, ShieldCheck, AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';

export default function DiskUsage({ onOpenFileManager }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Search & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('size'); // 'size' | 'name' | 'percentage'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'

  // Expanded directory tree state (stores set of expanded paths)
  const [expandedPaths, setExpandedPaths] = useState(new Set());
  const [childrenMap, setChildrenMap] = useState(new Map()); // path -> [childDirs]
  const [loadingChildren, setLoadingChildren] = useState(new Set()); // paths currently loading

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification(prev => (prev?.message === msg ? null : prev));
    }, 4000);
  };

  // Fetch disk usage summary from backend
  const loadDiskUsage = async (force = false) => {
    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await api.getDiskUsageSummary(force);
      if (res && res.success) {
        setData(res);
        if (force) {
          showNotification('Disk usage statistics recalculated successfully.', 'success');
        }
      } else {
        throw new Error(res?.error || 'Failed to calculate disk usage');
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'An error occurred while calculating disk usage.';
      setError(errMsg);
      showNotification(errMsg, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDiskUsage(false);
  }, []);

  // Toggle expand / collapse for a directory
  const toggleExpand = async (dirPath) => {
    const nextExpanded = new Set(expandedPaths);
    if (nextExpanded.has(dirPath)) {
      nextExpanded.delete(dirPath);
      setExpandedPaths(nextExpanded);
      return;
    }

    nextExpanded.add(dirPath);
    setExpandedPaths(nextExpanded);

    // If children not already cached in memory, fetch from backend
    if (!childrenMap.has(dirPath)) {
      const nextLoading = new Set(loadingChildren);
      nextLoading.add(dirPath);
      setLoadingChildren(nextLoading);

      try {
        const res = await api.getDiskUsageDirectory(dirPath);
        if (res && res.success) {
          setChildrenMap(prev => new Map(prev).set(dirPath, res.children || []));
        }
      } catch (err) {
        showNotification(`Failed to inspect subdirectories of ${dirPath}`, 'error');
      } finally {
        setLoadingChildren(prev => {
          const updated = new Set(prev);
          updated.delete(dirPath);
          return updated;
        });
      }
    }
  };

  // Filter and sort top-level directories
  const processedDirectories = useMemo(() => {
    if (!data?.directories) return [];
    let list = [...data.directories];

    // Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(d => 
        d.name.toLowerCase().includes(q) || 
        d.path.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortField === 'size') {
        valA = a.size_bytes || 0;
        valB = b.size_bytes || 0;
      } else if (sortField === 'percentage') {
        valA = a.percentage || 0;
        valB = b.percentage || 0;
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [data, searchQuery, sortField, sortOrder]);

  const getUsageColor = (percent, isOverQuota) => {
    if (isOverQuota || percent >= 90) return '#dc2626'; // Red danger
    if (percent >= 80) return '#f59e0b'; // Amber warning
    return '#27235C'; // cPanel Indigo / primary
  };

  const getUsageBg = (percent, isOverQuota) => {
    if (isOverQuota || percent >= 90) return 'bg-red-50 text-red-700 border-red-200';
    if (percent >= 80) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-fade-in">
          <Alert variant={notification.type} onClose={() => setNotification(null)}>
            {notification.message}
          </Alert>
        </div>
      )}

      {/* Header & Breadcrumb */}
      <div className="bg-white border-b border-slate-200 -mx-6 -mt-6 px-6 py-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center text-xs text-slate-500 mb-1 space-x-2">
              <span className="hover:text-slate-700 cursor-pointer" onClick={() => onOpenFileManager && onOpenFileManager('')}>Home</span>
              <span>/</span>
              <span className="hover:text-slate-700 cursor-pointer" onClick={() => onOpenFileManager && onOpenFileManager('')}>Files</span>
              <span>/</span>
              <span className="text-slate-800 font-medium">Disk Usage</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-[#27235C] flex items-center justify-center border border-indigo-100 shadow-sm">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Disk Usage</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  View detailed information about the disk space used by your account.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenFileManager && onOpenFileManager('')}
              className="flex items-center space-x-2 text-slate-700 border-slate-300 hover:bg-slate-50"
            >
              <ExternalLink className="w-4 h-4 text-slate-500" />
              <span>Open in File Manager</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => loadDiskUsage(true)}
              disabled={loading || refreshing}
              className="flex items-center space-x-2 bg-[#27235C] hover:bg-[#1b183f] text-white"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Recalculating...' : 'Refresh'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Partial scan warning banner */}
      {data?.partial && data.warnings?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">Notice:</span> Some directories could not be fully scanned due to permissions or broken symlinks.
            <div className="text-xs text-amber-700 mt-1 font-mono">
              {data.warnings[0]}
            </div>
          </div>
        </div>
      )}

      {/* Loading state skeleton */}
      {loading && !data && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <RefreshCw className="w-8 h-8 text-[#27235C] animate-spin mx-auto" />
          <p className="text-base font-medium text-slate-700">Calculating disk usage...</p>
          <p className="text-xs text-slate-500">Scanning account filesystem and directory sizes</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Disk Usage Calculation Failed</h3>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
          <Button variant="primary" onClick={() => loadDiskUsage(true)} className="bg-[#27235C] text-white">
            Try Again
          </Button>
        </div>
      )}

      {/* Main Content when data loaded */}
      {data && !loading && (
        <>
          {/* Top-Level Usage Summary Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">Storage Consumption Summary</h2>
              {data.is_over_quota && (
                <span className="px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 rounded-full text-xs font-bold uppercase tracking-wide flex items-center space-x-1 animate-pulse">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Account is Over Quota</span>
                </span>
              )}
            </div>

            <div className="p-6">
              {/* 4 Metric Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* 1. Disk Usage */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-medium uppercase tracking-wider">Disk Usage</span>
                    <HardDrive className="w-4 h-4 text-[#27235C]" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    {data.usage_formatted}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">
                    {Number(data.usage_bytes).toLocaleString()} Bytes
                  </div>
                </div>

                {/* 2. Quota */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-medium uppercase tracking-wider">Disk Quota</span>
                    <Database className="w-4 h-4 text-[#27235C]" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    {data.quota_formatted}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {data.unlimited ? 'Unlimited Storage Limit' : `${Number(data.quota_bytes || 0).toLocaleString()} Bytes`}
                  </div>
                </div>

                {/* 3. Remaining */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-medium uppercase tracking-wider">Remaining Space</span>
                    <Layers className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    {data.remaining_formatted}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {data.unlimited ? 'No Disk Limit Enforced' : (data.is_over_quota ? '0 B available' : 'Available for files')}
                  </div>
                </div>

                {/* 4. Percentage */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-medium uppercase tracking-wider">Used</span>
                    <PieChart className="w-4 h-4 text-[#27235C]" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    {data.unlimited ? 'N/A' : `${data.percentage}%`}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {data.unlimited ? 'Unlimited Account' : (data.is_over_quota ? 'Exceeded Allocation' : 'Of Allocated Quota')}
                  </div>
                </div>
              </div>

              {/* Visual Usage Bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-medium text-slate-600">
                  <span>Quota Utilization</span>
                  <span>{data.unlimited ? 'Unlimited' : `${data.percentage}% Used`}</span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  {data.unlimited ? (
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-500"
                      style={{ width: '10%' }}
                      title="Unlimited Quota"
                    />
                  ) : (
                    <div 
                      className="h-full transition-all duration-500 rounded-full"
                      style={{ 
                        width: `${Math.min(100, Math.max(1, data.percentage || 0))}%`,
                        backgroundColor: getUsageColor(data.percentage || 0, data.is_over_quota)
                      }}
                      title={`${data.percentage}% used`}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Account Storage Statistics Strip */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-y-2">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Total Files: <strong className="text-slate-800">{Number(data.stats.total_files || 0).toLocaleString()}</strong></span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Folder className="w-3.5 h-3.5 text-slate-400" />
                  <span>Total Directories: <strong className="text-slate-800">{Number(data.stats.total_directories || 0).toLocaleString()}</strong></span>
                </div>
                {data.stats.largest_directory && (
                  <div className="flex items-center space-x-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                    <span>Largest: <strong className="text-slate-800">{data.stats.largest_directory.name} ({data.stats.largest_directory.size_formatted})</strong></span>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-4 text-slate-400">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Scan: {data.stats.scan_time_ms} ms</span>
                </div>
                <span>•</span>
                <div>
                  Last calculated: <span className="text-slate-600">{new Date(data.last_updated).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Directory Breakdown Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search directories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
                <div className="flex items-center space-x-1 text-xs text-slate-500">
                  <span>Sort by:</span>
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value)}
                    className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none"
                  >
                    <option value="size">Size</option>
                    <option value="name">Name</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>

                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-1.5 border border-slate-200 rounded hover:bg-slate-100 text-slate-600 transition-colors"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Directory Table / Tree */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4 w-5/12">Directory</th>
                    <th className="py-3 px-4 w-2/12">Size</th>
                    <th className="py-3 px-4 w-3/12">Account Usage</th>
                    <th className="py-3 px-4 w-2/12 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {processedDirectories.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500">
                        <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-base font-medium text-slate-700">No matching directories found</p>
                        <p className="text-xs text-slate-400 mt-1">Try clearing your search query</p>
                      </td>
                    </tr>
                  ) : (
                    processedDirectories.map(dir => (
                      <React.Fragment key={dir.name}>
                        {/* Top-Level Directory Row */}
                        <tr className="hover:bg-slate-50/80 transition-colors group">
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {dir.has_children ? (
                                <button
                                  onClick={() => toggleExpand(dir.path)}
                                  className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-colors"
                                  title={expandedPaths.has(dir.path) ? 'Collapse' : 'Expand'}
                                >
                                  {expandedPaths.has(dir.path) ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-6" />
                              )}

                              {dir.is_loose_files ? (
                                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                              ) : (
                                <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                              )}

                              <div>
                                <span className="font-semibold text-slate-800 hover:text-indigo-600 cursor-pointer"
                                  onClick={() => !dir.is_loose_files && onOpenFileManager && onOpenFileManager(dir.path)}
                                >
                                  {dir.name}
                                </span>
                                {dir.path && (
                                  <span className="text-xs text-slate-400 ml-2 font-mono">
                                    /{dir.path}
                                  </span>
                                )}
                                <div className="text-xs text-slate-400">
                                  {dir.file_count} files {dir.directory_count > 0 && `• ${dir.directory_count} subfolders`}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 font-mono font-medium text-slate-700">
                            {dir.size_formatted}
                          </td>

                          <td className="py-3 px-4">
                            <div className="space-y-1 max-w-[200px]">
                              <div className="flex justify-between text-xs text-slate-600">
                                <span className="font-medium">{dir.percentage}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                <div
                                  className="h-full bg-[#27235C] rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, Math.max(dir.size_bytes > 0 ? 1 : 0, dir.percentage))}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            {!dir.is_loose_files && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onOpenFileManager && onOpenFileManager(dir.path)}
                                className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 text-xs"
                                title="Open this directory in File Manager"
                              >
                                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                <span>Open</span>
                              </Button>
                            )}
                          </td>
                        </tr>

                        {/* Expanded Children Rows */}
                        {expandedPaths.has(dir.path) && (
                          <>
                            {loadingChildren.has(dir.path) ? (
                              <tr>
                                <td colSpan={4} className="py-3 pl-12 pr-4 bg-slate-50/50 text-xs text-slate-500">
                                  <div className="flex items-center space-x-2">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#27235C]" />
                                    <span>Loading subdirectories...</span>
                                  </div>
                                </td>
                              </tr>
                            ) : childrenMap.get(dir.path)?.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-2 pl-12 pr-4 bg-slate-50/50 text-xs text-slate-400 italic">
                                  No subdirectories in this folder
                                </td>
                              </tr>
                            ) : (
                              childrenMap.get(dir.path)?.map(child => (
                                <tr key={child.path} className="bg-slate-50/40 hover:bg-slate-100/60 transition-colors border-l-2 border-indigo-500">
                                  <td className="py-2.5 pl-12 pr-4">
                                    <div className="flex items-center space-x-2">
                                      <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                      <div>
                                        <span 
                                          className="font-medium text-slate-700 hover:text-indigo-600 cursor-pointer"
                                          onClick={() => onOpenFileManager && onOpenFileManager(child.path)}
                                        >
                                          {child.name}
                                        </span>
                                        <span className="text-xs text-slate-400 ml-2 font-mono">
                                          /{child.path}
                                        </span>
                                        <div className="text-xs text-slate-400">
                                          {child.file_count} files {child.directory_count > 0 && `• ${child.directory_count} subfolders`}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-4 font-mono text-xs text-slate-600">
                                    {child.size_formatted}
                                  </td>

                                  <td className="py-2.5 px-4">
                                    <div className="space-y-1 max-w-[200px]">
                                      <div className="flex justify-between text-xs text-slate-500">
                                        <span>{child.percentage}%</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-indigo-500 rounded-full"
                                          style={{ width: `${Math.min(100, Math.max(child.size_bytes > 0 ? 1 : 0, child.percentage))}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-4 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onOpenFileManager && onOpenFileManager(child.path)}
                                      className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100/50 px-2 py-0.5 text-xs"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                      <span>Open</span>
                                    </Button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
