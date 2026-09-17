import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { 
  Folder, FolderPlus, FileText, FilePlus, FileCode, Upload, Download, Trash2, Edit3, Shield, Archive, 
  RefreshCw, ArrowUp, ChevronRight, Check, X, CheckSquare, Square, Copy, Move, Eye, Info, 
  Search, List, LayoutGrid, AlertCircle, HardDrive, FileSpreadsheet, Music, Video, ExternalLink, Key
} from 'lucide-react';

export default function FileManager({ stats, initialPath }) {
  const [currentPath, setCurrentPath] = useState(initialPath !== undefined ? initialPath : 'public_html');

  useEffect(() => {
    if (initialPath !== undefined) {
      setCurrentPath(initialPath);
    }
  }, [initialPath]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [notification, setNotification] = useState(null);
  const [accessBlocked, setAccessBlocked] = useState(null);

  // Active user name
  const activeUser = localStorage.getItem('cpanel_active_user') || 'cpanel_user';

  // Modals state
  const [newFileModal, setNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLimit, setUploadLimit] = useState({
    maxUploadSizeMb: 2048,
    maxUploadSizeGb: 2.0,
    maxUploadSizeBytes: 2048 * 1024 * 1024,
    formatted: '2.00 GB'
  });

  const [renameModal, setRenameModal] = useState(false);
  const [renameNewName, setRenameNewName] = useState('');

  const [copyModal, setCopyModal] = useState(false);
  const [copyDest, setCopyDest] = useState('public_html');
  const [copyConflict, setCopyConflict] = useState('replace');

  const [moveModal, setMoveModal] = useState(false);
  const [moveDest, setMoveDest] = useState('public_html');
  const [moveConflict, setMoveConflict] = useState('replace');

  const [deleteModal, setDeleteModal] = useState(false);

  const [editorModal, setEditorModal] = useState(false);
  const [editingFile, setEditingFile] = useState({ path: '', name: '', content: '', originalContent: '', loading: false });

  const [previewModal, setPreviewModal] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [infoModal, setInfoModal] = useState(false);
  const [infoData, setInfoData] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);

  const [permModal, setPermModal] = useState(false);
  const [permTarget, setPermTarget] = useState(null);
  const [permState, setPermState] = useState({
    userRead: true, userWrite: true, userExec: false,
    groupRead: true, groupWrite: false, groupExec: false,
    worldRead: true, worldWrite: false, worldExec: false
  });

  const [compressModal, setCompressModal] = useState(false);
  const [zipName, setZipName] = useState('archive.zip');

  const [extractModal, setExtractModal] = useState(false);
  const [extractDest, setExtractDest] = useState('public_html');

  const fileInputRef = useRef(null);

  // File size formatter for any size (Bytes, KB, MB, GB)
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Show notification helper
  const notify = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Load directory items
  const loadDirectory = async (path = currentPath) => {
    setLoading(true);
    setAccessBlocked(null);
    try {
      const data = await api.listFiles(path);
      setItems(data.items || []);
      setCurrentPath(data.currentPath ?? path);
      setSelectedPaths(new Set());
      setSelectedItem(null);
      setSearchQuery('');
      setIsSearching(false);
    } catch (err) {
      const errData = err.response?.data;
      if (err.response?.status === 403 || errData?.status === 'pending' || (typeof errData?.error === 'string' && errData.error.includes('Pending'))) {
        setAccessBlocked({
          title: errData?.error || 'Service Pending Admin Activation',
          message: errData?.message || 'Your hosting service has been ordered and is awaiting activation by the Main Administrator. File Manager access will unlock once approved by the Admin.'
        });
      } else {
        notify('error', 'Failed to load directory: ' + (errData?.error || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory('public_html');
    api.getUploadLimit().then(res => {
      if (res && res.maxUploadSizeMb) {
        setUploadLimit(res);
      }
    }).catch(() => {});
  }, []);

  // Handle live search
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadDirectory(currentPath);
      return;
    }
    setLoading(true);
    setIsSearching(true);
    try {
      const res = await api.searchFiles(searchQuery.trim(), currentPath);
      setItems(res.items || []);
      setSelectedPaths(new Set());
      setSelectedItem(null);
    } catch (err) {
      notify('error', 'Search failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    loadDirectory(currentPath);
  };

  // Selection handlers
  const allSelected = items.length > 0 && selectedPaths.size === items.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedPaths(new Set());
      setSelectedItem(null);
    } else {
      const all = new Set(items.map(i => i.relPath));
      setSelectedPaths(all);
      setSelectedItem(items[0] || null);
    }
  };

  const toggleSelect = (item, e) => {
    e?.stopPropagation();
    const next = new Set(selectedPaths);
    if (next.has(item.relPath)) {
      next.delete(item.relPath);
      if (selectedItem?.relPath === item.relPath) {
        const nextFirst = items.find(i => next.has(i.relPath));
        setSelectedItem(nextFirst || null);
      }
    } else {
      next.add(item.relPath);
      setSelectedItem(item);
    }
    setSelectedPaths(next);
  };

  // Keyboard shortcut Ctrl+A
  useEffect(() => {
    const onKeyDown = (e) => {
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !isInputFocused) {
        e.preventDefault();
        const all = new Set(items.map(i => i.relPath));
        setSelectedPaths(all);
        setSelectedItem(items[0] || null);
      }
      if (e.key === 'Escape') {
        setNewFileModal(false);
        setNewFolderModal(false);
        setUploadModal(false);
        setRenameModal(false);
        setCopyModal(false);
        setMoveModal(false);
        setDeleteModal(false);
        setEditorModal(false);
        setPreviewModal(false);
        setInfoModal(false);
        setPermModal(false);
        setCompressModal(false);
        setExtractModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [items]);

  // Navigate folder
  const handleOpenFolder = (folderRelPath) => {
    loadDirectory(folderRelPath);
  };

  const handleGoUp = () => {
    if (!currentPath || currentPath === 'public_html') {
      loadDirectory('');
      return;
    }
    const parts = currentPath.split('/');
    parts.pop();
    loadDirectory(parts.join('/'));
  };

  // Sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;

    let comp = 0;
    if (sortField === 'name') {
      comp = a.name.localeCompare(b.name);
    } else if (sortField === 'size') {
      comp = (a.size || 0) - (b.size || 0);
    } else if (sortField === 'modified') {
      comp = new Date(a.modified) - new Date(b.modified);
    } else if (sortField === 'permissions') {
      comp = (a.permissions || '').localeCompare(b.permissions || '');
    }
    return sortOrder === 'asc' ? comp : -comp;
  });

  // Create File
  const handleCreateFileSubmit = async (e) => {
    e.preventDefault();
    const name = newFileName.trim();
    if (!name) return;
    const target = currentPath ? `${currentPath}/${name}` : name;
    try {
      await api.createFile(target);
      notify('success', `File "${name}" created successfully.`);
      setNewFileName('');
      setNewFileModal(false);
      loadDirectory();
    } catch (err) {
      notify('error', err.response?.data?.error || err.message);
    }
  };

  // Create Folder
  const handleCreateFolderSubmit = async (e) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    const target = currentPath ? `${currentPath}/${name}` : name;
    try {
      await api.createFolder(target);
      notify('success', `Folder "${name}" created successfully.`);
      setNewFolderName('');
      setNewFolderModal(false);
      loadDirectory();
    } catch (err) {
      notify('error', err.response?.data?.error || err.message);
    }
  };

  // Upload handler
  const handleUploadSubmit = async () => {
    if (uploadQueue.length === 0) return;
    setIsUploading(true);
    setUploadProgress(10);
    try {
      const formData = new FormData();
      uploadQueue.forEach(f => {
        formData.append('files', f);
      });
      await api.uploadFile(formData, currentPath, (progressEvent) => {
        if (progressEvent.total) {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(pct);
        }
      });
      notify('success', `${uploadQueue.length} file(s) uploaded successfully!`);
      setUploadQueue([]);
      setUploadModal(false);
      loadDirectory();
    } catch (err) {
      notify('error', 'Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Rename
  const openRename = () => {
    if (!selectedItem) return;
    setRenameNewName(selectedItem.name);
    setRenameModal(true);
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    const newName = renameNewName.trim();
    if (!newName || !selectedItem) return;
    try {
      await api.renameItem(selectedItem.relPath, newName);
      notify('success', `Renamed to "${newName}" successfully.`);
      setRenameModal(false);
      loadDirectory();
    } catch (err) {
      notify('error', err.response?.data?.error || err.message);
    }
  };

  // Copy
  const openCopy = () => {
    if (selectedPaths.size === 0) return;
    setCopyDest(currentPath);
    setCopyConflict('replace');
    setCopyModal(true);
  };

  const handleCopySubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.copyItem(Array.from(selectedPaths), copyDest, copyConflict);
      notify('success', `Copied ${res.count || selectedPaths.size} item(s) to "${copyDest}".`);
      setCopyModal(false);
      loadDirectory();
    } catch (err) {
      notify('error', err.response?.data?.error || err.message);
    }
  };

  // Move
  const openMove = () => {
    if (selectedPaths.size === 0) return;
    setMoveDest(currentPath);
    setMoveConflict('replace');
    setMoveModal(true);
  };

  const handleMoveSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.moveItem(Array.from(selectedPaths), moveDest, moveConflict);
      notify('success', `Moved ${res.count || selectedPaths.size} item(s) to "${moveDest}".`);
      setMoveModal(false);
      loadDirectory();
    } catch (err) {
      notify('error', err.response?.data?.error || err.message);
    }
  };

  // Delete
  const openDelete = () => {
    if (selectedPaths.size === 0) return;
    setDeleteModal(true);
  };

  const handleDeleteSubmit = async () => {
    const targets = Array.from(selectedPaths);
    try {
      await api.deleteItem(targets);
      notify('success', `Deleted ${targets.length} item(s) permanently.`);
      setDeleteModal(false);
      loadDirectory();
    } catch (err) {
      notify('error', err.response?.data?.error || err.message);
    }
  };

  // Download
  const handleDownload = () => {
    if (!selectedItem || selectedItem.isDirectory) return;
    const url = api.getDownloadUrl(selectedItem.relPath);
    window.open(url, '_blank');
  };

  // Code Editor
  const openEditor = async (item = selectedItem) => {
    if (!item || item.isDirectory) return;
    setEditingFile({ path: item.relPath, name: item.name, content: '', originalContent: '', loading: true });
    setEditorModal(true);
    try {
      const res = await api.readFile(item.relPath);
      setEditingFile({
        path: item.relPath,
        name: item.name,
        content: res.content || '',
        originalContent: res.content || '',
        loading: false
      });
    } catch (err) {
      notify('error', 'Cannot open editor: ' + (err.response?.data?.error || err.message));
      setEditorModal(false);
    }
  };

  const handleSaveEditor = async () => {
    try {
      await api.saveFile(editingFile.path, editingFile.content);
      setEditingFile(prev => ({ ...prev, originalContent: prev.content }));
      notify('success', `File "${editingFile.name}" saved successfully.`);
      loadDirectory();
    } catch (err) {
      notify('error', 'Save failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCloseEditor = () => {
    if (editingFile.content !== editingFile.originalContent) {
      if (!window.confirm('You have unsaved changes. Discard changes and close?')) {
        return;
      }
    }
    setEditorModal(false);
  };

  // Preview
  const openPreview = async (item = selectedItem) => {
    if (!item || item.isDirectory) return;
    setPreviewItem(item);
    setPreviewLoading(true);
    setPreviewModal(true);

    const ext = (item.ext || '').toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'].includes(ext);
    const isPdf = ext === '.pdf';

    if (isImage || isPdf) {
      setPreviewLoading(false);
      return;
    }

    try {
      const res = await api.readFile(item.relPath);
      setPreviewContent(res.content || '');
    } catch (err) {
      setPreviewContent('Preview not available for this file type or file exceeded preview size.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Properties / Info
  const openInfo = async (item = selectedItem) => {
    if (!item) return;
    setInfoLoading(true);
    setInfoModal(true);
    try {
      const res = await api.getFileInfo(item.relPath);
      setInfoData(res);
    } catch (err) {
      notify('error', 'Could not get file information: ' + (err.response?.data?.error || err.message));
      setInfoModal(false);
    } finally {
      setInfoLoading(false);
    }
  };

  // Permissions (chmod)
  const openPermissions = (item = selectedItem) => {
    if (!item) return;
    setPermTarget(item);
    const raw = item.permissions || '644';
    const num = parseInt(raw, 8) || 0o644;

    setPermState({
      userRead: !!(num & 0o400),
      userWrite: !!(num & 0o200),
      userExec: !!(num & 0o100),
      groupRead: !!(num & 0o040),
      groupWrite: !!(num & 0o020),
      groupExec: !!(num & 0o010),
      worldRead: !!(num & 0o004),
      worldWrite: !!(num & 0o002),
      worldExec: !!(num & 0o001)
    });
    setPermModal(true);
  };

  const calculateOctal = () => {
    let u = (permState.userRead ? 4 : 0) + (permState.userWrite ? 2 : 0) + (permState.userExec ? 1 : 0);
    let g = (permState.groupRead ? 4 : 0) + (permState.groupWrite ? 2 : 0) + (permState.groupExec ? 1 : 0);
    let w = (permState.worldRead ? 4 : 0) + (permState.worldWrite ? 2 : 0) + (permState.worldExec ? 1 : 0);
    return `0${u}${g}${w}`;
  };

  const handlePermissionsSubmit = async (e) => {
    e.preventDefault();
    if (!permTarget) return;
    const mode = calculateOctal();
    try {
      await api.changePermissions(permTarget.relPath, mode);
      notify('success', `Permissions updated to ${mode} successfully.`);
      setPermModal(false);
      loadDirectory();
    } catch (err) {
      notify('error', err.response?.data?.error || err.message);
    }
  };

  // Compress to Zip
  const openCompress = () => {
    if (selectedPaths.size === 0) return;
    setZipName('archive.zip');
    setCompressModal(true);
  };

  const handleCompressSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.compress(Array.from(selectedPaths), zipName, currentPath);
      notify('success', `Archive "${zipName}" created successfully.`);
      setCompressModal(false);
      loadDirectory();
    } catch (err) {
      notify('error', err.response?.data?.error || err.message);
    }
  };

  // Extract Zip
  const openExtract = (item = selectedItem) => {
    if (!item || !item.name.endsWith('.zip')) return;
    setExtractDest(currentPath);
    setExtractModal(true);
  };

  const handleExtractSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      await api.extract(selectedItem.relPath, extractDest);
      notify('success', `Extracted "${selectedItem.name}" to "${extractDest}".`);
      setExtractModal(false);
      loadDirectory();
    } catch (err) {
      notify('error', err.response?.data?.error || err.message);
    }
  };

  // Double click handler
  const handleDoubleClick = (item) => {
    if (item.isDirectory) {
      handleOpenFolder(item.relPath);
    } else {
      const ext = (item.ext || '').toLowerCase();
      if (['.html', '.php', '.css', '.js', '.json', '.xml', '.txt', '.md', '.log', '.htaccess'].includes(ext)) {
        openEditor(item);
      } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf'].includes(ext)) {
        openPreview(item);
      } else {
        const url = api.getDownloadUrl(item.relPath);
        window.open(url, '_blank');
      }
    }
  };

  // Smart Icon Resolver
  const getItemIcon = (item, isLarge = false) => {
    const sizeCls = isLarge ? 'w-10 h-10' : 'w-4 h-4';
    if (item.isDirectory) {
      return <Folder className={`${sizeCls} text-amber-500 shrink-0`} fill="currentColor" fillOpacity={0.15} />;
    }
    const ext = (item.ext || '').toLowerCase();
    if (ext === '.zip' || ext === '.tar' || ext === '.gz') {
      return <Archive className={`${sizeCls} text-purple-600 shrink-0`} />;
    }
    if (['.html', '.php', '.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.xml', '.py', '.sh', '.sql'].includes(ext)) {
      return <FileCode className={`${sizeCls} text-blue-600 shrink-0`} />;
    }
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'].includes(ext)) {
      return <FileText className={`${sizeCls} text-emerald-600 shrink-0`} />;
    }
    if (ext === '.pdf') {
      return <FileText className={`${sizeCls} text-red-500 shrink-0`} />;
    }
    if (['.xls', '.xlsx', '.csv'].includes(ext)) {
      return <FileSpreadsheet className={`${sizeCls} text-green-600 shrink-0`} />;
    }
    if (['.mp3', '.wav', '.ogg'].includes(ext)) {
      return <Music className={`${sizeCls} text-pink-500 shrink-0`} />;
    }
    if (['.mp4', '.webm', '.mov'].includes(ext)) {
      return <Video className={`${sizeCls} text-indigo-500 shrink-0`} />;
    }
    return <FileText className={`${sizeCls} text-slate-400 shrink-0`} />;
  };

  // Breadcrumbs generator
  const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];

  const selectedCount = selectedPaths.size;
  const isSingleSelected = selectedCount === 1 && selectedItem;
  const isSingleFile = isSingleSelected && !selectedItem.isDirectory;
  const isSingleZip = isSingleFile && selectedItem.name.endsWith('.zip');

  if (accessBlocked) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 rounded-3xl bg-[#1c0830] border border-amber-500/50 text-center space-y-6 shadow-2xl backdrop-blur-xl font-sans">
        <div className="w-16 h-16 rounded-2xl bg-amber-950/80 border border-amber-500/60 flex items-center justify-center text-amber-400 mx-auto shadow-lg animate-pulse">
          <Shield className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-900/50 border border-amber-500/40 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider">
            <span>{accessBlocked.title}</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            File Manager Access Locked by Security Gatekeeper
          </h2>
          <p className="text-xs text-purple-200/90 max-w-md mx-auto leading-relaxed">
            {accessBlocked.message}
          </p>
          <p className="text-[12px] text-amber-300/90 max-w-md mx-auto leading-relaxed italic bg-amber-950/40 py-1.5 px-3 rounded-xl border border-amber-500/30">
            মেইন অ্যাডমিন আপনার পেমেন্ট ভেরিফাই করে সার্ভিসটি অ্যাক্টিভ না করা পর্যন্ত ফাইল ম্যানেজার ব্যবহার করা যাবে না।
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.href = '/?view=client_dashboard'}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg transition cursor-pointer"
          >
            Return to Client Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#1c0830]/95 backdrop-blur-xl border border-purple-800/40 shadow-2xl flex flex-col min-h-[calc(100vh-140px)] overflow-hidden text-white">
      
      {/* ========================================================================= */}
      {/* 1. TOP cPANEL TOOLBAR */}
      {/* ========================================================================= */}
      <div className="bg-[#1b082e]/95 border-b border-purple-800/40 px-3 py-2 flex flex-wrap items-center justify-between gap-2 select-none">
        
        {/* Left Action Buttons */}
        <div className="flex items-center flex-wrap gap-1.5 text-[12px]">
          {/* + File */}
          <button
            type="button"
            onClick={() => setNewFileModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-950/60 border border-purple-700/50 hover:bg-purple-900/60 text-purple-100 font-medium shadow-xs transition active:scale-95 cursor-pointer"
            title="Create a new file in current directory"
          >
            <FilePlus className="w-3.5 h-3.5 text-[#ff6c2c]" />
            <span>+ File</span>
          </button>

          {/* + Folder */}
          <button
            type="button"
            onClick={() => setNewFolderModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-950/60 border border-purple-700/50 hover:bg-purple-900/60 text-purple-100 font-medium shadow-xs transition active:scale-95 cursor-pointer"
            title="Create a new folder in current directory"
          >
            <FolderPlus className="w-3.5 h-3.5 text-blue-400" />
            <span>+ Folder</span>
          </button>

          <div className="h-4 w-px bg-purple-800/40 mx-1" />

          {/* Copy */}
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={openCopy}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition ${
              selectedCount > 0 
                ? 'bg-purple-950/60 border-purple-700/50 hover:bg-purple-900/60 text-purple-100 font-medium shadow-xs cursor-pointer' 
                : 'bg-purple-950/20 border-transparent text-purple-400/40 cursor-not-allowed'
            }`}
            title="Copy selected item(s)"
          >
            <Copy className="w-3.5 h-3.5 text-purple-300" />
            <span>Copy</span>
          </button>

          {/* Move */}
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={openMove}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition ${
              selectedCount > 0 
                ? 'bg-purple-950/60 border-purple-700/50 hover:bg-purple-900/60 text-purple-100 font-medium shadow-xs cursor-pointer' 
                : 'bg-purple-950/20 border-transparent text-purple-400/40 cursor-not-allowed'
            }`}
            title="Move selected item(s)"
          >
            <Move className="w-3.5 h-3.5 text-purple-300" />
            <span>Move</span>
          </button>

          {/* Upload */}
          <button
            type="button"
            onClick={() => setUploadModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-700/50 hover:bg-emerald-900/60 text-emerald-300 font-medium shadow-xs transition cursor-pointer"
            title="Upload files to current directory"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Upload</span>
          </button>

          {/* Download */}
          <button
            type="button"
            disabled={!isSingleFile}
            onClick={handleDownload}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition ${
              isSingleFile 
                ? 'bg-purple-950/60 border-purple-700/50 hover:bg-purple-900/60 text-purple-100 font-medium shadow-xs cursor-pointer' 
                : 'bg-purple-950/20 border-transparent text-purple-400/40 cursor-not-allowed'
            }`}
            title="Download selected file"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Download</span>
          </button>

          {/* Delete */}
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={openDelete}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition ${
              selectedCount > 0 
                ? 'bg-rose-950/60 border-rose-700/50 hover:bg-rose-900/60 text-rose-300 font-medium shadow-xs cursor-pointer' 
                : 'bg-purple-950/20 border-transparent text-purple-400/40 cursor-not-allowed'
            }`}
            title="Delete selected item(s)"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete {selectedCount > 1 ? `(${selectedCount})` : ''}</span>
          </button>

          <div className="h-4 w-px bg-purple-800/40 mx-1" />

          {/* Rename */}
          <button
            type="button"
            disabled={!isSingleSelected}
            onClick={openRename}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition ${
              isSingleSelected 
                ? 'bg-purple-950/60 border-purple-700/50 hover:bg-purple-900/60 text-purple-100 font-medium shadow-xs cursor-pointer' 
                : 'bg-purple-950/20 border-transparent text-purple-400/40 cursor-not-allowed'
            }`}
            title="Rename selected item"
          >
            <Edit3 className="w-3.5 h-3.5 text-purple-300" />
            <span>Rename</span>
          </button>

          {/* Edit */}
          <button
            type="button"
            disabled={!isSingleFile}
            onClick={() => openEditor()}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition ${
              isSingleFile 
                ? 'bg-purple-950/60 border-purple-700/50 hover:bg-purple-900/60 text-purple-100 font-medium shadow-xs cursor-pointer' 
                : 'bg-purple-950/20 border-transparent text-purple-400/40 cursor-not-allowed'
            }`}
            title="Edit code/text in cPanel Editor"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>Edit</span>
          </button>

          {/* View / Preview */}
          <button
            type="button"
            disabled={!isSingleFile}
            onClick={() => openPreview()}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition ${
              isSingleFile 
                ? 'bg-purple-950/60 border-purple-700/50 hover:bg-purple-900/60 text-purple-100 font-medium shadow-xs cursor-pointer' 
                : 'bg-purple-950/20 border-transparent text-purple-400/40 cursor-not-allowed'
            }`}
            title="Preview file contents"
          >
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span>View</span>
          </button>

          {/* Extract */}
          {isSingleZip && (
            <button
              type="button"
              onClick={() => openExtract()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-950/60 border border-teal-700/50 hover:bg-teal-900/60 text-teal-300 font-medium shadow-xs transition cursor-pointer"
              title="Extract archive contents"
            >
              <Archive className="w-3.5 h-3.5 text-teal-400" />
              <span>Extract</span>
            </button>
          )}

          {/* Compress */}
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={openCompress}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition ${
              selectedCount > 0 
                ? 'bg-purple-950/60 border-purple-700/50 hover:bg-purple-900/60 text-purple-100 font-medium shadow-xs cursor-pointer' 
                : 'bg-purple-950/20 border-transparent text-purple-400/40 cursor-not-allowed'
            }`}
            title="Compress selected items into Zip"
          >
            <Archive className="w-3.5 h-3.5 text-purple-400" />
            <span>Compress</span>
          </button>

          {/* Permissions */}
          <button
            type="button"
            disabled={!isSingleSelected}
            onClick={() => openPermissions()}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition ${
              isSingleSelected 
                ? 'bg-purple-950/60 border-purple-700/50 hover:bg-purple-900/60 text-purple-100 font-medium shadow-xs cursor-pointer' 
                : 'bg-purple-950/20 border-transparent text-purple-400/40 cursor-not-allowed'
            }`}
            title="Change permissions (chmod)"
          >
            <Key className="w-3.5 h-3.5 text-purple-300" />
            <span>Permissions</span>
          </button>

          {/* Info / Properties */}
          <button
            type="button"
            disabled={!isSingleSelected}
            onClick={() => openInfo()}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition ${
              isSingleSelected 
                ? 'bg-purple-950/60 border-purple-700/50 hover:bg-purple-900/60 text-purple-100 font-medium shadow-xs cursor-pointer' 
                : 'bg-purple-950/20 border-transparent text-purple-400/40 cursor-not-allowed'
            }`}
            title="View properties and details"
          >
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>Properties</span>
          </button>
        </div>

        {/* Right Utility Buttons */}
        <div className="flex items-center space-x-1.5 text-xs">
          {/* Select All */}
          <button
            type="button"
            onClick={handleSelectAll}
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition cursor-pointer ${
              allSelected 
                ? 'bg-purple-800/80 border-purple-500 text-white font-semibold' 
                : 'bg-purple-950/60 border-purple-700/50 hover:bg-purple-900/60 text-purple-200'
            }`}
            title="Select / Unselect all visible items (Ctrl+A)"
          >
            {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> : <Square className="w-3.5 h-3.5 text-purple-400" />}
            <span>{allSelected ? 'Select None' : 'Select All'}</span>
          </button>

          {/* Reload Button */}
          <button
            type="button"
            onClick={() => loadDirectory()}
            className="p-1.5 rounded-lg bg-purple-950/60 border border-purple-700/50 hover:bg-purple-900/60 text-purple-200 hover:text-white transition cursor-pointer"
            title="Reload current directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#ff6c2c]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. NOTIFICATION BANNER */}
      {/* ========================================================================= */}
      {notification && (
        <div className={`px-4 py-2 text-xs flex items-center justify-between border-b animate-fade ${
          notification.type === 'error' 
            ? 'bg-red-50 text-red-700 border-red-200' 
            : notification.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{notification.message}</span>
          </div>
          <button type="button" onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. BREADCRUMBS, SEARCH & VIEW MODE */}
      {/* ========================================================================= */}
      <div className="bg-[#160427]/90 border-b border-purple-800/40 px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-purple-200">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-1.5 flex-wrap min-w-0">
          <button
            type="button"
            onClick={handleGoUp}
            className="p-1 hover:bg-purple-900/50 rounded text-purple-200 transition cursor-pointer"
            title="Up One Level"
          >
            <ArrowUp className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => loadDirectory('')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-purple-900/50 text-[#38bdf8] font-semibold transition cursor-pointer"
            title="Go to Home Root"
          >
            <Folder className="w-3.5 h-3.5 text-[#ff6c2c]" />
            <span>/home/{activeUser}/</span>
          </button>

          {pathSegments.map((segment, idx) => {
            const segPath = pathSegments.slice(0, idx + 1).join('/');
            const isLast = idx === pathSegments.length - 1;
            return (
              <React.Fragment key={segPath}>
                <span className="text-purple-500/60">/</span>
                <button
                  type="button"
                  onClick={() => loadDirectory(segPath)}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                    isLast 
                      ? 'font-bold text-white bg-purple-900/60 border border-purple-700/40' 
                      : 'text-[#38bdf8] hover:bg-purple-900/50 hover:underline'
                  }`}
                >
                  {segment}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Search Bar & View Mode Toggles */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Search Box */}
          <form onSubmit={handleSearch} className="relative flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in this directory..."
              className="bg-[#250c3d]/90 border border-purple-700/40 rounded-xl pl-2.5 pr-7 py-1 text-xs text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30 w-48 sm:w-56 transition"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 text-purple-400 hover:text-white cursor-pointer"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                className="absolute right-2 text-purple-400 hover:text-[#38bdf8] cursor-pointer"
                title="Search"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-purple-700/50 rounded-xl bg-purple-950/60 overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition cursor-pointer ${viewMode === 'list' ? 'bg-gradient-to-r from-purple-600 to-emerald-600 text-white font-bold' : 'text-purple-300 hover:bg-purple-900/50'}`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 transition cursor-pointer ${viewMode === 'grid' ? 'bg-gradient-to-r from-purple-600 to-emerald-600 text-white font-bold' : 'text-purple-300 hover:bg-purple-900/50'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MAIN CONTENT AREA: TABLE (LIST) OR GRID */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-auto bg-[#140324]/60">
        {loading ? (
          <div className="py-20 text-center text-purple-300/70">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-[#ff6c2c]" />
            <p className="text-sm font-medium">Loading filesystem entries...</p>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="py-20 text-center">
            <Folder className="w-12 h-12 text-purple-400/40 mx-auto mb-3" />
            <p className="text-sm font-semibold text-white">This directory is empty.</p>
            <p className="text-xs text-purple-300/70 mt-1 max-w-sm mx-auto">
              Use the toolbar buttons above to upload files or create new folders inside this directory.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setNewFileModal(true)}
                className="px-3.5 py-1.5 bg-purple-950/70 border border-purple-700/50 hover:bg-purple-900/60 text-xs font-semibold rounded-xl text-purple-200 shadow-xs cursor-pointer"
              >
                + New File
              </button>
              <button
                type="button"
                onClick={() => setNewFolderModal(true)}
                className="px-3.5 py-1.5 bg-purple-950/70 border border-purple-700/50 hover:bg-purple-900/60 text-xs font-semibold rounded-xl text-purple-200 shadow-xs cursor-pointer"
              >
                + New Folder
              </button>
              <button
                type="button"
                onClick={() => setUploadModal(true)}
                className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-xs font-bold rounded-xl text-white shadow-lg cursor-pointer"
              >
                Upload Files
              </button>
            </div>
          </div>
        ) : viewMode === 'list' ? (
          /* --- LIST VIEW (TABLE) --- */
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#1f0933] text-purple-200 sticky top-0 border-b border-purple-800/40 font-semibold select-none z-10">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-purple-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    title="Select All (Ctrl+A)"
                  />
                </th>
                <th className="py-2.5 px-2 w-8"></th>
                <th 
                  className="py-2.5 px-3 cursor-pointer hover:bg-purple-900/40 transition"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    <span>Name</span>
                    {sortField === 'name' && (
                      <span className="text-[10px] text-purple-300">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="py-2.5 px-3 w-28 text-right cursor-pointer hover:bg-purple-900/40 transition"
                  onClick={() => handleSort('size')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Size</span>
                    {sortField === 'size' && (
                      <span className="text-[10px] text-purple-300">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="py-2.5 px-3 w-48 cursor-pointer hover:bg-purple-900/40 transition"
                  onClick={() => handleSort('modified')}
                >
                  <div className="flex items-center gap-1">
                    <span>Last Modified</span>
                    {sortField === 'modified' && (
                      <span className="text-[10px] text-purple-300">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="py-2.5 px-3 w-24 text-center cursor-pointer hover:bg-purple-900/40 transition"
                  onClick={() => handleSort('permissions')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Perms</span>
                    {sortField === 'permissions' && (
                      <span className="text-[10px] text-purple-300">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                <th className="py-2.5 px-3 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-900/20">
              {sortedItems.map((item) => {
                const isSelected = selectedPaths.has(item.relPath);
                return (
                  <tr
                    key={item.relPath}
                    onClick={(e) => toggleSelect(item, e)}
                    onDoubleClick={() => handleDoubleClick(item)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-purple-900/50 font-medium text-white' : 'hover:bg-purple-900/25 text-purple-100'
                    }`}
                  >
                    <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelect(item, e)}
                        className="w-4 h-4 rounded border-purple-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      {getItemIcon(item)}
                    </td>
                    <td className="py-2 px-3 text-white">
                      <div className="flex items-center gap-1.5">
                        <span className={item.isHidden ? 'text-purple-400/60 italic' : 'font-medium'}>
                          {item.name}
                        </span>
                        {item.name === '.htaccess' && (
                          <span className="text-[10px] bg-purple-950/80 text-purple-300 px-1.5 py-0.2 rounded border border-purple-700/40">
                            Server Config
                          </span>
                        )}
                        {item.name === 'index.html' && (
                          <span className="text-[10px] bg-emerald-950/70 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-700/40">
                            Default Index
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right text-purple-300/80 font-mono">
                      {item.sizeFormatted || (item.isDirectory ? '--' : `${item.size} B`)}
                    </td>
                    <td className="py-2 px-3 text-purple-300/80 font-mono text-[11px]">
                      {new Date(item.modified).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-purple-200">
                      {item.permissions}
                    </td>
                    <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {!item.isDirectory && (
                          <button
                            type="button"
                            onClick={() => openEditor(item)}
                            className="px-2.5 py-0.5 bg-purple-950/70 hover:bg-purple-900/80 text-purple-200 border border-purple-700/40 rounded text-[11px] font-semibold cursor-pointer"
                            title="Edit file"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openInfo(item)}
                          className="px-1.5 py-0.5 hover:bg-purple-900/50 rounded text-purple-400 hover:text-white cursor-pointer"
                          title="Properties"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* --- GRID VIEW (CARDS) --- */
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {sortedItems.map((item) => {
              const isSelected = selectedPaths.has(item.relPath);
              return (
                <div
                  key={item.relPath}
                  onClick={(e) => toggleSelect(item, e)}
                  onDoubleClick={() => handleDoubleClick(item)}
                  className={`p-3 rounded-xl border transition-all flex flex-col items-center text-center cursor-pointer relative group ${
                    isSelected 
                      ? 'bg-purple-900/60 border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.4)]' 
                      : 'bg-purple-950/40 border-purple-800/40 hover:border-purple-600 hover:bg-purple-900/40'
                  }`}
                >
                  <div className="absolute top-2 left-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleSelect(item, e)}
                      className="w-3.5 h-3.5 rounded border-purple-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                  </div>

                  <div className="my-2">
                    {getItemIcon(item, true)}
                  </div>

                  <span className="text-xs font-medium text-white line-clamp-2 break-all max-w-full">
                    {item.name}
                  </span>

                  <span className="text-[10px] text-purple-300/70 mt-1 font-mono">
                    {item.sizeFormatted || (item.isDirectory ? 'Folder' : `${item.size} B`)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. BOTTOM STATUS & QUOTA BAR */}
      {/* ========================================================================= */}
      <div className="bg-[#1b082e]/95 border-t border-purple-800/40 px-4 py-2 flex flex-wrap items-center justify-between text-xs text-purple-300/70 select-none">
        <div className="flex items-center gap-4">
          <span>{items.length} item(s)</span>
          {selectedCount > 0 && (
            <span className="text-emerald-400 font-semibold">
              {selectedCount} item(s) selected
            </span>
          )}
          {isSearching && (
            <span className="text-amber-400 font-medium">
              Filtered by search: "{searchQuery}"
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-purple-200">
            <HardDrive className="w-3.5 h-3.5 text-purple-400" />
            <span>Disk Usage: <strong className="text-white">{stats?.resources?.disk_used_formatted || '12.4 MB'}</strong></span>
            {stats?.resources?.disk_quota_formatted && (
              <span>/ {stats.resources.disk_quota_formatted}</span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. MODALS */}
      {/* ========================================================================= */}

      {/* --- MODAL: NEW FILE --- */}
      {newFileModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c0830] rounded-2xl shadow-2xl max-w-md w-full border border-purple-700/50 animate-fade overflow-hidden text-white">
            <div className="px-5 py-3.5 border-b border-purple-800/40 flex items-center justify-between bg-purple-950/40">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-[#ff6c2c]" /> Create New File
              </h3>
              <button type="button" onClick={() => setNewFileModal(false)} className="text-purple-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateFileSubmit} className="p-5">
              <p className="text-xs text-purple-200/80 mb-2">
                New file will be created inside: <code className="bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800/40 text-emerald-300">/{currentPath || 'home'}</code>
              </p>
              <label className="block text-xs font-semibold text-purple-200 mb-1">New File Name:</label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="index.php or script.js"
                autoFocus
                className="w-full text-xs bg-[#250c3d]/90 border border-purple-700/40 rounded-xl p-2.5 text-white placeholder-purple-400/40 focus:border-purple-400 focus:outline-none mb-4 font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewFileModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/40 text-purple-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white shadow-lg cursor-pointer"
                >
                  Create New File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: NEW FOLDER --- */}
      {newFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c0830] rounded-2xl shadow-2xl max-w-md w-full border border-purple-700/50 animate-fade overflow-hidden text-white">
            <div className="px-5 py-3.5 border-b border-purple-800/40 flex items-center justify-between bg-purple-950/40">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-blue-400" /> Create New Folder
              </h3>
              <button type="button" onClick={() => setNewFolderModal(false)} className="text-purple-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateFolderSubmit} className="p-5">
              <p className="text-xs text-purple-200/80 mb-2">
                New folder will be created inside: <code className="bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800/40 text-emerald-300">/{currentPath || 'home'}</code>
              </p>
              <label className="block text-xs font-semibold text-purple-200 mb-1">New Folder Name:</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="assets or images"
                autoFocus
                className="w-full text-xs bg-[#250c3d]/90 border border-purple-700/40 rounded-xl p-2.5 text-white placeholder-purple-400/40 focus:border-purple-400 focus:outline-none mb-4 font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewFolderModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/40 text-purple-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white shadow-lg cursor-pointer"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: UPLOAD WITH DRAG & DROP --- */}
      {uploadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c0830] rounded-2xl shadow-2xl max-w-lg w-full border border-purple-700/50 animate-fade overflow-hidden text-white">
            <div className="px-5 py-3.5 border-b border-purple-800/40 flex items-center justify-between bg-purple-950/40">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" /> Upload Files
              </h3>
              <button type="button" onClick={() => setUploadModal(false)} className="text-purple-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-purple-200/80">
                Destination Directory: <code className="bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800/40 text-emerald-300">/{currentPath || 'home'}</code>
              </p>

              {/* Drag and drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) {
                    const incoming = Array.from(e.dataTransfer.files);
                    const maxBytes = uploadLimit?.maxUploadSizeBytes || (2048 * 1024 * 1024);
                    const valid = [];
                    for (const f of incoming) {
                      if (f.size > maxBytes) {
                        notify('error', `File "${f.name}" (${formatFileSize(f.size)}) exceeds maximum limit of ${uploadLimit?.maxUploadSizeMb || 2048} MB (${uploadLimit?.maxUploadSizeGb || 2.0} GB).`);
                      } else {
                        valid.push(f);
                      }
                    }
                    if (valid.length > 0) setUploadQueue(prev => [...prev, ...valid]);
                  }
                }}
                className="border-2 border-dashed border-purple-700/50 hover:border-purple-400 rounded-xl p-6 text-center bg-purple-950/30 transition cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-white">
                  Drop files here or click to select
                </p>
                <p className="text-[11px] text-purple-300/70 mt-1">
                  Maximum file size:{' '}
                  <span className="text-emerald-400 font-bold">
                    {uploadLimit?.maxUploadSizeMb >= 1024
                      ? `${(uploadLimit.maxUploadSizeMb / 1024).toFixed(1)} GB (${uploadLimit.maxUploadSizeMb} MB)`
                      : `${uploadLimit?.maxUploadSizeMb || 2048} MB`}
                  </span>{' '}
                  per file. Multiple files supported.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      const incoming = Array.from(e.target.files);
                      const maxBytes = uploadLimit?.maxUploadSizeBytes || (2048 * 1024 * 1024);
                      const valid = [];
                      for (const f of incoming) {
                        if (f.size > maxBytes) {
                          notify('error', `File "${f.name}" (${formatFileSize(f.size)}) exceeds maximum limit of ${uploadLimit?.maxUploadSizeMb || 2048} MB (${uploadLimit?.maxUploadSizeGb || 2.0} GB).`);
                        } else {
                          valid.push(f);
                        }
                      }
                      if (valid.length > 0) setUploadQueue(prev => [...prev, ...valid]);
                    }
                  }}
                  className="hidden"
                />
              </div>

              {/* Queue List */}
              {uploadQueue.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-purple-800/40 rounded-xl p-2.5 text-xs bg-purple-950/40">
                  {uploadQueue.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 bg-[#240c3c]/80 border border-purple-800/30 rounded-lg">
                      <span className="truncate max-w-[280px] font-medium text-purple-100">{f.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-purple-300/70 text-[10px]">{formatFileSize(f.size)}</span>
                        <button
                          type="button"
                          onClick={() => setUploadQueue(uploadQueue.filter((_, idx) => idx !== i))}
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress Bar */}
              {isUploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-purple-200 font-medium">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-purple-950 rounded-full h-2 overflow-hidden border border-purple-800/40">
                    <div className="bg-gradient-to-r from-purple-500 to-emerald-500 h-2 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-purple-800/40">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => {
                    setUploadQueue([]);
                    setUploadModal(false);
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/40 text-purple-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={uploadQueue.length === 0 || isUploading}
                  onClick={handleUploadSubmit}
                  className={`px-4 py-2 text-xs font-bold rounded-xl text-white transition ${
                    uploadQueue.length > 0 && !isUploading
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg cursor-pointer'
                      : 'bg-purple-950/40 border border-purple-800/30 text-purple-400/40 cursor-not-allowed'
                  }`}
                >
                  {isUploading ? 'Uploading...' : `Upload ${uploadQueue.length} File(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: RENAME --- */}
      {renameModal && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c0830] rounded-2xl shadow-2xl max-w-md w-full border border-purple-700/50 animate-fade overflow-hidden text-white">
            <div className="px-5 py-3.5 border-b border-purple-800/40 flex items-center justify-between bg-purple-950/40">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-purple-300" /> Rename Item
              </h3>
              <button type="button" onClick={() => setRenameModal(false)} className="text-purple-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit} className="p-5">
              <p className="text-xs text-purple-300/80 mb-2">
                Current Name: <strong className="text-white">{selectedItem.name}</strong>
              </p>
              <label className="block text-xs font-semibold text-purple-200 mb-1">New Name:</label>
              <input
                type="text"
                value={renameNewName}
                onChange={(e) => setRenameNewName(e.target.value)}
                autoFocus
                className="w-full text-xs bg-[#250c3d]/90 border border-purple-700/40 rounded-xl p-2.5 text-white placeholder-purple-400/40 focus:border-purple-400 focus:outline-none mb-4 font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenameModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/40 text-purple-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white shadow-lg cursor-pointer"
                >
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: COPY --- */}
      {copyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c0830] rounded-2xl shadow-2xl max-w-md w-full border border-purple-700/50 animate-fade overflow-hidden text-white">
            <div className="px-5 py-3.5 border-b border-purple-800/40 flex items-center justify-between bg-purple-950/40">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Copy className="w-4 h-4 text-purple-300" /> Copy Items
              </h3>
              <button type="button" onClick={() => setCopyModal(false)} className="text-purple-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCopySubmit} className="p-5 space-y-3">
              <p className="text-xs text-purple-200/80">
                Copying <strong className="text-white">{selectedPaths.size} item(s)</strong>.
              </p>
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">Destination Directory:</label>
                <input
                  type="text"
                  value={copyDest}
                  onChange={(e) => setCopyDest(e.target.value)}
                  className="w-full text-xs bg-[#250c3d]/90 border border-purple-700/40 rounded-xl p-2.5 text-white placeholder-purple-400/40 focus:border-purple-400 focus:outline-none font-mono"
                  placeholder="public_html"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">If file already exists:</label>
                <select
                  value={copyConflict}
                  onChange={(e) => setCopyConflict(e.target.value)}
                  className="w-full text-xs bg-[#250c3d]/90 border border-purple-700/40 rounded-xl p-2.5 text-white focus:border-purple-400 focus:outline-none"
                >
                  <option value="replace" className="bg-[#1c0830] text-white">Overwrite / Replace</option>
                  <option value="rename" className="bg-[#1c0830] text-white">Keep both (rename copy)</option>
                  <option value="skip" className="bg-[#1c0830] text-white">Skip existing</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCopyModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/40 text-purple-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white shadow-lg cursor-pointer"
                >
                  Copy File(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: MOVE --- */}
      {moveModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c0830] rounded-2xl shadow-2xl max-w-md w-full border border-purple-700/50 animate-fade overflow-hidden text-white">
            <div className="px-5 py-3.5 border-b border-purple-800/40 flex items-center justify-between bg-purple-950/40">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Move className="w-4 h-4 text-purple-300" /> Move Items
              </h3>
              <button type="button" onClick={() => setMoveModal(false)} className="text-purple-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleMoveSubmit} className="p-5 space-y-3">
              <p className="text-xs text-purple-200/80">
                Moving <strong className="text-white">{selectedPaths.size} item(s)</strong>.
              </p>
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">Destination Directory:</label>
                <input
                  type="text"
                  value={moveDest}
                  onChange={(e) => setMoveDest(e.target.value)}
                  className="w-full text-xs bg-[#250c3d]/90 border border-purple-700/40 rounded-xl p-2.5 text-white placeholder-purple-400/40 focus:border-purple-400 focus:outline-none font-mono"
                  placeholder="public_html"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">If file already exists:</label>
                <select
                  value={moveConflict}
                  onChange={(e) => setMoveConflict(e.target.value)}
                  className="w-full text-xs bg-[#250c3d]/90 border border-purple-700/40 rounded-xl p-2.5 text-white focus:border-purple-400 focus:outline-none"
                >
                  <option value="replace" className="bg-[#1c0830] text-white">Overwrite / Replace</option>
                  <option value="rename" className="bg-[#1c0830] text-white">Keep both (rename moved)</option>
                  <option value="skip" className="bg-[#1c0830] text-white">Skip existing</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMoveModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/40 text-purple-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white shadow-lg cursor-pointer"
                >
                  Move File(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: DELETE CONFIRMATION --- */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c0830] rounded-2xl shadow-2xl max-w-md w-full border border-rose-700/50 animate-fade overflow-hidden text-white">
            <div className="px-5 py-3.5 border-b border-rose-900/40 bg-rose-950/40 flex items-center justify-between">
              <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" /> Confirm Permanent Deletion
              </h3>
              <button type="button" onClick={() => setDeleteModal(false)} className="text-purple-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-purple-100 font-medium">
                Are you sure you want to permanently delete <strong className="text-white">{selectedPaths.size}</strong> selected item(s)?
              </p>
              <div className="max-h-32 overflow-y-auto bg-purple-950/50 border border-purple-800/40 rounded-xl p-2.5 text-[11px] font-mono text-purple-200 space-y-1">
                {Array.from(selectedPaths).map(p => (
                  <div key={p} className="truncate">• {p}</div>
                ))}
              </div>
              <p className="text-[11px] text-rose-400">
                Warning: This action cannot be undone. Folder contents will also be removed.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/40 text-purple-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg cursor-pointer"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CODE EDITOR --- */}
      {editorModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c0830] rounded-2xl shadow-2xl border border-purple-700/50 w-full max-w-5xl flex flex-col h-[85vh] overflow-hidden animate-fade text-white">
            <div className="bg-[#180529] text-white px-5 py-3 flex items-center justify-between border-b border-purple-800/40">
              <div className="flex items-center space-x-2.5">
                <FileCode className="w-4 h-4 text-[#ff6c2c]" />
                <span className="font-bold text-xs">cPanel Code Editor:</span>
                <span className="font-mono text-xs text-purple-200 bg-purple-950/80 border border-purple-700/50 px-2.5 py-0.5 rounded-lg">
                  {editingFile.name}
                </span>
                {editingFile.content !== editingFile.originalContent && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-sans">
                    Unsaved Changes
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSaveEditor}
                  className="bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-lg transition cursor-pointer"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={handleCloseEditor}
                  className="text-purple-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-[#120320] p-3 overflow-hidden flex flex-col font-mono text-xs">
              {editingFile.loading ? (
                <div className="flex-1 flex items-center justify-center text-purple-300">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#ff6c2c]" />
                </div>
              ) : (
                <textarea
                  value={editingFile.content}
                  onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                  spellCheck="false"
                  className="w-full flex-1 bg-transparent text-emerald-400 leading-relaxed p-2 focus:outline-none resize-none font-mono"
                />
              )}
            </div>
            <div className="bg-[#180529] text-purple-300/70 px-5 py-2 text-[11px] flex justify-between border-t border-purple-800/40 select-none">
              <span>Encoding: UTF-8</span>
              <span>Lines: {editingFile.content.split('\n').length}</span>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: FILE PREVIEW --- */}
      {previewModal && previewItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c0830] rounded-2xl shadow-2xl border border-purple-700/50 w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden animate-fade text-white">
            <div className="bg-[#180529] text-white px-5 py-3 flex items-center justify-between border-b border-purple-800/40">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-xs">File Preview:</span>
                <span className="font-mono text-xs text-purple-200 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-700/40">{previewItem.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(false)}
                className="text-purple-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5 bg-[#140324]/80 flex items-center justify-center min-h-[300px]">
              {previewLoading ? (
                <RefreshCw className="w-7 h-7 animate-spin text-[#ff6c2c]" />
              ) : ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'].includes((previewItem.ext || '').toLowerCase()) ? (
                <img
                  src={api.getPreviewUrl(previewItem.relPath)}
                  alt={previewItem.name}
                  className="max-h-[60vh] max-w-full object-contain rounded-xl border border-purple-800/40 bg-purple-950/40"
                />
              ) : previewItem.ext === '.pdf' ? (
                <iframe
                  src={api.getPreviewUrl(previewItem.relPath)}
                  title={previewItem.name}
                  className="w-full h-[60vh] rounded-xl border border-purple-800/40"
                />
              ) : (
                <pre className="w-full h-full bg-[#120320] p-4 rounded-xl border border-purple-800/40 font-mono text-xs text-purple-100 overflow-auto whitespace-pre-wrap">
                  {previewContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: FILE PROPERTIES / INFO --- */}
      {infoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c0830] rounded-2xl shadow-2xl max-w-md w-full border border-purple-700/50 animate-fade overflow-hidden text-white">
            <div className="px-5 py-3.5 border-b border-purple-800/40 flex items-center justify-between bg-purple-950/40">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400" /> Properties & Details
              </h3>
              <button type="button" onClick={() => setInfoModal(false)} className="text-purple-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-2 text-xs">
              {infoLoading || !infoData ? (
                <div className="py-8 text-center text-purple-300">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#ff6c2c]" />
                  Loading properties...
                </div>
              ) : (
                <div className="space-y-2 font-mono">
                  <div className="flex justify-between py-1.5 border-b border-purple-900/30">
                    <span className="text-purple-300/70 font-sans">Name:</span>
                    <span className="font-semibold text-white">{infoData.name}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-purple-900/30">
                    <span className="text-purple-300/70 font-sans">Location:</span>
                    <span className="text-purple-200 truncate max-w-[200px]">/{infoData.relPath}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-purple-900/30">
                    <span className="text-purple-300/70 font-sans">Type:</span>
                    <span className="text-emerald-400 uppercase font-bold">{infoData.typeCategory}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-purple-900/30">
                    <span className="text-purple-300/70 font-sans">Size:</span>
                    <span className="text-purple-100">{infoData.sizeFormatted} ({infoData.size} bytes)</span>
                  </div>
                  {infoData.itemCount !== null && (
                    <div className="flex justify-between py-1.5 border-b border-purple-900/30">
                      <span className="text-purple-300/70 font-sans">Child Items:</span>
                      <span className="text-purple-100">{infoData.itemCount} item(s)</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1.5 border-b border-purple-900/30">
                    <span className="text-purple-300/70 font-sans">Permissions:</span>
                    <span className="text-purple-200">{infoData.permissions}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-purple-900/30">
                    <span className="text-purple-300/70 font-sans">Last Modified:</span>
                    <span className="text-purple-200 text-[11px]">{new Date(infoData.modified).toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setInfoModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/40 text-purple-200 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: PERMISSIONS (CHMOD) --- */}
      {permModal && permTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c0830] rounded-2xl shadow-2xl max-w-md w-full border border-purple-700/50 animate-fade overflow-hidden text-white">
            <div className="px-5 py-3.5 border-b border-purple-800/40 flex items-center justify-between bg-purple-950/40">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-300" /> Change Permissions (chmod)
              </h3>
              <button type="button" onClick={() => setPermModal(false)} className="text-purple-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePermissionsSubmit} className="p-5 space-y-3">
              <p className="text-xs text-purple-200/80">
                Target: <strong className="font-mono text-white">{permTarget.name}</strong>
              </p>

              <div className="border border-purple-800/40 rounded-xl p-3 bg-purple-950/30">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-purple-300 border-b border-purple-800/40">
                      <th className="text-left pb-1.5 font-semibold">Role</th>
                      <th className="text-center pb-1.5 font-semibold">Read (4)</th>
                      <th className="text-center pb-1.5 font-semibold">Write (2)</th>
                      <th className="text-center pb-1.5 font-semibold">Exec (1)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-900/30">
                    <tr>
                      <td className="py-2 font-medium text-purple-200">User / Owner</td>
                      <td className="text-center py-2">
                        <input
                          type="checkbox"
                          checked={permState.userRead}
                          onChange={(e) => setPermState({ ...permState, userRead: e.target.checked })}
                          className="rounded border-purple-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                      <td className="text-center py-2">
                        <input
                          type="checkbox"
                          checked={permState.userWrite}
                          onChange={(e) => setPermState({ ...permState, userWrite: e.target.checked })}
                          className="rounded border-purple-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                      <td className="text-center py-2">
                        <input
                          type="checkbox"
                          checked={permState.userExec}
                          onChange={(e) => setPermState({ ...permState, userExec: e.target.checked })}
                          className="rounded border-purple-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium text-purple-200">Group</td>
                      <td className="text-center py-2">
                        <input
                          type="checkbox"
                          checked={permState.groupRead}
                          onChange={(e) => setPermState({ ...permState, groupRead: e.target.checked })}
                          className="rounded border-purple-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                      <td className="text-center py-2">
                        <input
                          type="checkbox"
                          checked={permState.groupWrite}
                          onChange={(e) => setPermState({ ...permState, groupWrite: e.target.checked })}
                          className="rounded border-purple-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                      <td className="text-center py-2">
                        <input
                          type="checkbox"
                          checked={permState.groupExec}
                          onChange={(e) => setPermState({ ...permState, groupExec: e.target.checked })}
                          className="rounded border-purple-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium text-purple-200">World / Others</td>
                      <td className="text-center py-2">
                        <input
                          type="checkbox"
                          checked={permState.worldRead}
                          onChange={(e) => setPermState({ ...permState, worldRead: e.target.checked })}
                          className="rounded border-purple-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                      <td className="text-center py-2">
                        <input
                          type="checkbox"
                          checked={permState.worldWrite}
                          onChange={(e) => setPermState({ ...permState, worldWrite: e.target.checked })}
                          className="rounded border-purple-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                      <td className="text-center py-2">
                        <input
                          type="checkbox"
                          checked={permState.worldExec}
                          onChange={(e) => setPermState({ ...permState, worldExec: e.target.checked })}
                          className="rounded border-purple-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 font-mono">
                <span className="text-purple-300/70 font-sans">Octal Permission:</span>
                <span className="text-sm font-bold text-emerald-400 bg-purple-950/80 px-2.5 py-1 rounded-lg border border-purple-700/40">
                  {calculateOctal()}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPermModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/40 text-purple-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white shadow-lg cursor-pointer"
                >
                  Change Permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: COMPRESS --- */}
      {compressModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c0830] rounded-2xl shadow-2xl max-w-md w-full border border-purple-700/50 animate-fade overflow-hidden text-white">
            <div className="px-5 py-3.5 border-b border-purple-800/40 flex items-center justify-between bg-purple-950/40">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Archive className="w-4 h-4 text-purple-400" /> Compress to Zip
              </h3>
              <button type="button" onClick={() => setCompressModal(false)} className="text-purple-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCompressSubmit} className="p-5 space-y-3">
              <p className="text-xs text-purple-200/80">
                Compressing <strong className="text-white">{selectedPaths.size} selected item(s)</strong> into an archive.
              </p>
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">Archive Name (.zip):</label>
                <input
                  type="text"
                  value={zipName}
                  onChange={(e) => setZipName(e.target.value)}
                  className="w-full text-xs bg-[#250c3d]/90 border border-purple-700/40 rounded-xl p-2.5 text-white placeholder-purple-400/40 focus:border-purple-400 focus:outline-none font-mono"
                  placeholder="archive.zip"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompressModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/40 text-purple-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg cursor-pointer"
                >
                  Compress File(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: EXTRACT --- */}
      {extractModal && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c0830] rounded-2xl shadow-2xl max-w-md w-full border border-purple-700/50 animate-fade overflow-hidden text-white">
            <div className="px-5 py-3.5 border-b border-purple-800/40 flex items-center justify-between bg-purple-950/40">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Archive className="w-4 h-4 text-emerald-400" /> Extract Zip Archive
              </h3>
              <button type="button" onClick={() => setExtractModal(false)} className="text-purple-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleExtractSubmit} className="p-5 space-y-3">
              <p className="text-xs text-purple-200/80">
                Extracting: <strong className="font-mono text-white">{selectedItem.name}</strong>
              </p>
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">Destination Directory:</label>
                <input
                  type="text"
                  value={extractDest}
                  onChange={(e) => setExtractDest(e.target.value)}
                  className="w-full text-xs bg-[#250c3d]/90 border border-purple-700/40 rounded-xl p-2.5 text-white placeholder-purple-400/40 focus:border-purple-400 focus:outline-none font-mono"
                  placeholder="public_html"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtractModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/40 text-purple-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg cursor-pointer"
                >
                  Extract File(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
