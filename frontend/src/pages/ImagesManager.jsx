import React, { useState, useEffect, useMemo } from 'react';
import { 
  Image as ImageIcon, Images, RefreshCw, Search, LayoutGrid, List, Eye, 
  Maximize2, RefreshCcw, Sparkles, Download, Info, Trash2, X, Check, 
  AlertTriangle, ChevronRight, Folder, FolderOpen, ArrowUpDown, Lock, 
  Unlock, ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import Modal from '../components/ui/Modal';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function ImagesManager({ onOpenFileManager }) {
  const [directories, setDirectories] = useState([]);
  const [currentDir, setCurrentDir] = useState('public_html');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Filters & Views
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'size' | 'modified' | 'dimensions'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'

  // Modals state
  const [previewImage, setPreviewImage] = useState(null);
  const [infoImage, setInfoImage] = useState(null);
  const [deleteImageTarget, setDeleteImageTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Resize state
  const [resizeTarget, setResizeTarget] = useState(null);
  const [resizeWidth, setResizeWidth] = useState('');
  const [resizeHeight, setResizeHeight] = useState('');
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [resizeAspectRatio, setResizeAspectRatio] = useState(1);
  const [resizeOutputName, setResizeOutputName] = useState('');
  const [resizeOverwrite, setResizeOverwrite] = useState(false);
  const [resizing, setResizing] = useState(false);

  // Convert state
  const [convertTarget, setConvertTarget] = useState(null);
  const [targetFormat, setTargetFormat] = useState('webp');
  const [convertQuality, setConvertQuality] = useState(85);
  const [convertOutputName, setConvertOutputName] = useState('');
  const [convertOverwrite, setConvertOverwrite] = useState(false);
  const [convertBgColor, setConvertBgColor] = useState('#ffffff');
  const [converting, setConverting] = useState(false);

  // Optimize state
  const [optimizeTarget, setOptimizeTarget] = useState(null);
  const [optimizeQuality, setOptimizeQuality] = useState(80);
  const [optimizeOverwrite, setOptimizeOverwrite] = useState(false);
  const [optimizeOutputName, setOptimizeOutputName] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState(null);

  // Fetch directory options
  const fetchDirectories = async () => {
    try {
      const dirs = await api.getImageDirectories();
      setDirectories(dirs || []);
    } catch (err) {
      console.error('Failed to load image directories', err);
    }
  };

  // Fetch images in selected directory
  const loadImages = async (dir = currentDir) => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listImages(dir);
      setImages(list || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to scan images in directory');
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectories();
  }, []);

  useEffect(() => {
    loadImages(currentDir);
  }, [currentDir]);

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === msg ? null : prev));
    }, 4000);
  };

  // Format list for filter dropdown
  const availableFormats = useMemo(() => {
    const set = new Set();
    images.forEach(img => {
      if (img.format) set.add(img.format.toUpperCase());
    });
    return Array.from(set);
  }, [images]);

  // Filtered & Sorted Images
  const processedImages = useMemo(() => {
    let result = [...images];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(img => 
        img.name.toLowerCase().includes(q) || 
        img.format.toLowerCase().includes(q) ||
        (img.dimensions && img.dimensions.toLowerCase().includes(q))
      );
    }

    // Format filter
    if (formatFilter !== 'ALL') {
      result = result.filter(img => img.format.toUpperCase() === formatFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'name') {
        comp = a.name.localeCompare(b.name);
      } else if (sortBy === 'size') {
        comp = a.size - b.size;
      } else if (sortBy === 'modified') {
        comp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
      } else if (sortBy === 'dimensions') {
        const areaA = (a.width || 0) * (a.height || 0);
        const areaB = (b.width || 0) * (b.height || 0);
        comp = areaA - areaB;
      }
      return sortOrder === 'asc' ? comp : -comp;
    });

    return result;
  }, [images, searchQuery, formatFilter, sortBy, sortOrder]);

  // Handle Resize setup
  const openResizeModal = (img) => {
    setResizeTarget(img);
    const origW = img.width || 800;
    const origH = img.height || 600;
    setResizeWidth(origW);
    setResizeHeight(origH);
    setResizeAspectRatio(origW / origH);
    setLockAspectRatio(true);
    setResizeOverwrite(false);

    // Default output filename
    const ext = img.name.substring(img.name.lastIndexOf('.'));
    const base = img.name.substring(0, img.name.lastIndexOf('.'));
    setResizeOutputName(`${base}-resized${ext}`);
  };

  const handleWidthChange = (val) => {
    setResizeWidth(val);
    if (lockAspectRatio && resizeAspectRatio && val) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) {
        setResizeHeight(Math.round(parsed / resizeAspectRatio));
      }
    }
  };

  const handleHeightChange = (val) => {
    setResizeHeight(val);
    if (lockAspectRatio && resizeAspectRatio && val) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) {
        setResizeWidth(Math.round(parsed * resizeAspectRatio));
      }
    }
  };

  const handleResizeSubmit = async (e) => {
    e.preventDefault();
    if (!resizeTarget) return;

    setResizing(true);
    try {
      await api.resizeImage({
        sourcePath: resizeTarget.relPath,
        newWidth: parseInt(resizeWidth, 10),
        newHeight: parseInt(resizeHeight, 10),
        maintainAspectRatio: lockAspectRatio,
        outputName: resizeOutputName,
        outputDir: resizeTarget.relDir,
        overwrite: resizeOverwrite
      });

      showNotification(`Image resized successfully: ${resizeOutputName}`);
      setResizeTarget(null);
      await loadImages(currentDir);
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Resize failed', 'error');
    } finally {
      setResizing(false);
    }
  };

  // Handle Convert setup
  const openConvertModal = (img) => {
    setConvertTarget(img);
    setTargetFormat('webp');
    setConvertQuality(85);
    setConvertOverwrite(false);
    setConvertBgColor('#ffffff');

    const base = img.name.substring(0, img.name.lastIndexOf('.'));
    setConvertOutputName(`${base}.webp`);
  };

  const handleTargetFormatChange = (fmt) => {
    setTargetFormat(fmt);
    if (convertTarget) {
      const base = convertTarget.name.substring(0, convertTarget.name.lastIndexOf('.'));
      const ext = fmt === 'jpeg' ? 'jpg' : fmt;
      setConvertOutputName(`${base}.${ext}`);
    }
  };

  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    if (!convertTarget) return;

    setConverting(true);
    try {
      await api.convertImage({
        sourcePath: convertTarget.relPath,
        targetFormat,
        quality: parseInt(convertQuality, 10),
        outputName: convertOutputName,
        outputDir: convertTarget.relDir,
        overwrite: convertOverwrite,
        backgroundColor: convertBgColor
      });

      showNotification(`Image converted to ${targetFormat.toUpperCase()} successfully: ${convertOutputName}`);
      setConvertTarget(null);
      await loadImages(currentDir);
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Conversion failed', 'error');
    } finally {
      setConverting(false);
    }
  };

  // Handle Optimize setup
  const openOptimizeModal = (img) => {
    setOptimizeTarget(img);
    setOptimizeQuality(80);
    setOptimizeOverwrite(false);
    setOptimizeResult(null);

    const ext = img.name.substring(img.name.lastIndexOf('.'));
    const base = img.name.substring(0, img.name.lastIndexOf('.'));
    setOptimizeOutputName(`optimized-${base}${ext}`);
  };

  const handleOptimizeSubmit = async (e) => {
    e.preventDefault();
    if (!optimizeTarget) return;

    setOptimizing(true);
    try {
      const res = await api.optimizeImage({
        sourcePath: optimizeTarget.relPath,
        quality: parseInt(optimizeQuality, 10),
        outputName: optimizeOverwrite ? optimizeTarget.name : optimizeOutputName,
        outputDir: optimizeTarget.relDir,
        overwrite: optimizeOverwrite
      });

      setOptimizeResult(res);
      showNotification(`Image optimized: saved ${res.savedFormatted} (${res.savedPercentage})`);
      await loadImages(currentDir);
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Optimization failed', 'error');
    } finally {
      setOptimizing(false);
    }
  };

  // Handle Delete
  const handleDeleteSubmit = async () => {
    if (!deleteImageTarget) return;
    setDeleting(true);
    try {
      await api.deleteImage(deleteImageTarget.relPath);
      showNotification(`Image "${deleteImageTarget.name}" deleted successfully`);
      setDeleteImageTarget(null);
      await loadImages(currentDir);
    } catch (err) {
      showNotification(err.response?.data?.error || err.message || 'Failed to delete image', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Top Banner Alert */}
      {notification && (
        <div className="fixed top-16 right-6 z-50 max-w-md shadow-lg animate-in fade-in slide-in-from-top-4">
          <Alert 
            variant={notification.type === 'error' ? 'error' : 'success'} 
            dismissible 
            onDismiss={() => setNotification(null)}
          >
            {notification.message}
          </Alert>
        </div>
      )}

      {/* Page Header Area */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b] mb-1">
              <span>Tools</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span>Files</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[#27235C]">Images</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#ff6c2c]/10 text-[#ff6c2c] rounded-lg">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#0f172a] leading-tight">Images</h1>
                <p className="text-xs text-[#64748b] mt-0.5">
                  Scan, preview, resize, convert formats, and optimize images stored in your hosting document root.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => loadImages(currentDir)}
              loading={loading}
              icon={RefreshCw}
            >
              Refresh
            </Button>
            {onOpenFileManager && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onOpenFileManager}
                icon={ExternalLink}
              >
                File Manager
              </Button>
            )}
          </div>
        </div>

        {/* Directory Picker Bar */}
        <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#ff6c2c]" />
            <span className="text-xs font-bold text-[#334155] uppercase tracking-wider">Directory:</span>
            <select
              value={currentDir}
              onChange={(e) => setCurrentDir(e.target.value)}
              className="bg-white border border-[#cbd5e1] text-[#1e293b] text-xs font-semibold rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/30 focus:border-[#ff6c2c]"
            >
              {directories.map((d) => (
                <option key={d.relPath} value={d.relPath}>
                  {d.name} {d.relPath ? `(${d.relPath})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Stats Bar */}
          <div className="flex items-center gap-3 text-xs text-[#64748b]">
            <span>Total Images: <strong className="text-[#0f172a]">{images.length}</strong></span>
            <span>•</span>
            <span>Showing: <strong className="text-[#ff6c2c]">{processedImages.length}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Controls & Filter Toolbar */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Search & Format Filter */}
        <div className="flex flex-wrap items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search images by name or dimension..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-md pl-9 pr-8 py-1.5 text-xs text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/20 focus:border-[#ff6c2c]"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Format Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#64748b]">Format:</span>
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className="bg-[#f8fafc] border border-[#cbd5e1] rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#334155] focus:outline-none focus:border-[#ff6c2c]"
            >
              <option value="ALL">All Formats</option>
              {availableFormats.map(fmt => (
                <option key={fmt} value={fmt}>{fmt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Sorting & View Mode Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort:</span>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, ord] = e.target.value.split('-');
                setSortBy(by);
                setSortOrder(ord);
              }}
              className="bg-[#f8fafc] border border-[#cbd5e1] rounded-md px-2.5 py-1.5 text-xs font-medium text-[#334155] focus:outline-none"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="size-asc">Size (Smallest)</option>
              <option value="size-desc">Size (Largest)</option>
              <option value="modified-desc">Newest First</option>
              <option value="modified-asc">Oldest First</option>
              <option value="dimensions-desc">Largest Dimensions</option>
              <option value="dimensions-asc">Smallest Dimensions</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#f1f5f9] p-0.5 rounded-lg border border-[#cbd5e1]">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-xs text-[#ff6c2c]' : 'text-[#64748b] hover:text-[#0f172a]'}`}
              title="Grid / Thumbnail View"
              aria-label="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-xs text-[#ff6c2c]' : 'text-[#64748b] hover:text-[#0f172a]'}`}
              title="Table List View"
              aria-label="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <RefreshCw className="w-8 h-8 text-[#ff6c2c] animate-spin" />
            <p className="text-sm font-semibold text-[#64748b]">Scanning directory for images...</p>
          </div>
        ) : error ? (
          <div className="max-w-xl mx-auto mt-8">
            <Alert variant="error" title="Unable to load images">
              {error}
            </Alert>
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm" onClick={() => loadImages(currentDir)}>
                Try Again
              </Button>
            </div>
          </div>
        ) : processedImages.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-12 text-center max-w-lg mx-auto mt-8 shadow-xs">
            <div className="w-16 h-16 bg-[#f8fafc] rounded-full flex items-center justify-center mx-auto text-[#94a3b8] mb-4">
              <ImageIcon className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[#0f172a] mb-1">No images found</h3>
            <p className="text-xs text-[#64748b] mb-4 leading-relaxed">
              {searchQuery || formatFilter !== 'ALL'
                ? 'No images match your search criteria. Try resetting filters.'
                : `There are no supported image files in "${currentDir}". Upload JPG, PNG, WEBP, or SVG images via File Manager to manage them here.`}
            </p>
            {(searchQuery || formatFilter !== 'ALL') ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setSearchQuery(''); setFormatFilter('ALL'); }}
              >
                Clear Filters
              </Button>
            ) : onOpenFileManager ? (
              <Button variant="primary" size="sm" onClick={onOpenFileManager}>
                Open File Manager
              </Button>
            ) : null}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid / Thumbnail View */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {processedImages.map((img) => (
              <div
                key={img.relPath}
                className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-xs hover:shadow-md transition-all group flex flex-col"
              >
                {/* Image Thumbnail Container */}
                <div 
                  className="h-44 bg-[#0f172a]/5 relative flex items-center justify-center overflow-hidden cursor-pointer group"
                  onClick={() => setPreviewImage(img)}
                >
                  <img
                    src={api.getThumbnailUrl(img.relPath, 280, 200)}
                    alt={img.name}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="hidden flex-col items-center justify-center text-[#94a3b8]">
                    <ImageIcon className="w-10 h-10 mb-1" />
                    <span className="text-[11px] font-medium">Preview Unavailable</span>
                  </div>

                  {/* Format Badge Overlay */}
                  <div className="absolute top-2 left-2 bg-[#0f172a]/70 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider">
                    {img.format}
                  </div>

                  {/* Dimensions Badge Overlay */}
                  {img.dimensions && img.dimensions !== 'Unknown' && (
                    <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-xs text-[#0f172a] text-[10px] font-semibold px-2 py-0.5 rounded-sm shadow-xs">
                      {img.dimensions}
                    </div>
                  )}

                  {/* Hover Quick Preview Action */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewImage(img); }}
                      className="p-2 bg-white rounded-full text-[#0f172a] hover:bg-[#ff6c2c] hover:text-white transition-colors shadow-md"
                      title="Quick Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <a
                      href={api.getImageDownloadUrl(img.relPath)}
                      onClick={(e) => e.stopPropagation()}
                      download
                      className="p-2 bg-white rounded-full text-[#0f172a] hover:bg-[#ff6c2c] hover:text-white transition-colors shadow-md"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Card Info & Meta */}
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 
                      className="text-xs font-bold text-[#0f172a] truncate hover:text-[#ff6c2c] cursor-pointer"
                      title={img.name}
                      onClick={() => setPreviewImage(img)}
                    >
                      {img.name}
                    </h4>
                    <div className="flex items-center justify-between text-[11px] text-[#64748b] mt-1.5">
                      <span>{img.sizeFormatted}</span>
                      <span>{new Date(img.modified).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] grid grid-cols-5 gap-1 text-center">
                    <button
                      onClick={() => openResizeModal(img)}
                      className="p-1.5 rounded hover:bg-[#ff6c2c]/10 text-[#475569] hover:text-[#ff6c2c] transition-colors flex justify-center"
                      title="Resize / Scale"
                      aria-label="Resize Image"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openConvertModal(img)}
                      className="p-1.5 rounded hover:bg-[#ff6c2c]/10 text-[#475569] hover:text-[#ff6c2c] transition-colors flex justify-center"
                      title="Convert Format"
                      aria-label="Convert Format"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openOptimizeModal(img)}
                      className="p-1.5 rounded hover:bg-[#ff6c2c]/10 text-[#475569] hover:text-[#ff6c2c] transition-colors flex justify-center"
                      title="Optimize / Recompress"
                      aria-label="Optimize Image"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setInfoImage(img)}
                      className="p-1.5 rounded hover:bg-[#ff6c2c]/10 text-[#475569] hover:text-[#ff6c2c] transition-colors flex justify-center"
                      title="File Information"
                      aria-label="File Information"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteImageTarget(img)}
                      className="p-1.5 rounded hover:bg-red-50 text-[#475569] hover:text-red-600 transition-colors flex justify-center"
                      title="Delete Image"
                      aria-label="Delete Image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table List View */
          <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#64748b] font-semibold select-none">
                    <th className="py-2.5 px-4 w-16 text-center">Thumb</th>
                    <th className="py-2.5 px-4">Filename</th>
                    <th className="py-2.5 px-4">Dimensions</th>
                    <th className="py-2.5 px-4">Size</th>
                    <th className="py-2.5 px-4">Format</th>
                    <th className="py-2.5 px-4">Modified</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {processedImages.map((img) => (
                    <tr key={img.relPath} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="py-2 px-4 text-center">
                        <img
                          src={api.getThumbnailUrl(img.relPath, 48, 48)}
                          alt={img.name}
                          className="w-9 h-9 object-contain rounded-md border border-[#e2e8f0] mx-auto cursor-pointer"
                          onClick={() => setPreviewImage(img)}
                        />
                      </td>
                      <td className="py-2 px-4 font-semibold text-[#0f172a]">
                        <span 
                          onClick={() => setPreviewImage(img)} 
                          className="hover:text-[#ff6c2c] cursor-pointer"
                        >
                          {img.name}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-[#475569] font-mono">
                        {img.dimensions || '—'}
                      </td>
                      <td className="py-2 px-4 text-[#475569]">
                        {img.sizeFormatted}
                      </td>
                      <td className="py-2 px-4">
                        <span className="px-2 py-0.5 bg-[#f1f5f9] text-[#334155] rounded text-[10px] font-bold uppercase">
                          {img.format}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-[#64748b]">
                        {new Date(img.modified).toLocaleString()}
                      </td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewImage(img)}
                            className="p-1.5 text-[#64748b] hover:text-[#ff6c2c] hover:bg-[#f1f5f9] rounded transition-colors"
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openResizeModal(img)}
                            className="p-1.5 text-[#64748b] hover:text-[#ff6c2c] hover:bg-[#f1f5f9] rounded transition-colors"
                            title="Resize"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openConvertModal(img)}
                            className="p-1.5 text-[#64748b] hover:text-[#ff6c2c] hover:bg-[#f1f5f9] rounded transition-colors"
                            title="Convert"
                          >
                            <RefreshCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openOptimizeModal(img)}
                            className="p-1.5 text-[#64748b] hover:text-[#ff6c2c] hover:bg-[#f1f5f9] rounded transition-colors"
                            title="Optimize"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={api.getImageDownloadUrl(img.relPath)}
                            download
                            className="p-1.5 text-[#64748b] hover:text-[#ff6c2c] hover:bg-[#f1f5f9] rounded transition-colors"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => setInfoImage(img)}
                            className="p-1.5 text-[#64748b] hover:text-[#ff6c2c] hover:bg-[#f1f5f9] rounded transition-colors"
                            title="Information"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteImageTarget(img)}
                            className="p-1.5 text-[#64748b] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- PREVIEW MODAL --- */}
      {previewImage && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewImage(null)}
          title={`Preview: ${previewImage.name}`}
          size="xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 text-xs text-[#64748b]">
                <span>Dimensions: <strong className="text-[#0f172a]">{previewImage.dimensions}</strong></span>
                <span>•</span>
                <span>Size: <strong className="text-[#0f172a]">{previewImage.sizeFormatted}</strong></span>
                <span>•</span>
                <span>Format: <strong className="text-[#ff6c2c] uppercase">{previewImage.format}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={api.getImageDownloadUrl(previewImage.relPath)}
                  download
                  className="px-3 py-1.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] font-semibold text-xs rounded-md transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <Button variant="outline" size="sm" onClick={() => setPreviewImage(null)}>
                  Close
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex flex-col items-center justify-center p-4 bg-[#0f172a]/5 rounded-lg min-h-[350px] max-h-[600px] overflow-auto">
            <img
              src={api.getImagePreviewUrl(previewImage.relPath)}
              alt={previewImage.name}
              className="max-h-[550px] max-w-full object-contain rounded shadow-sm"
            />
          </div>
        </Modal>
      )}

      {/* --- RESIZE MODAL --- */}
      {resizeTarget && (
        <Modal
          isOpen={true}
          onClose={() => !resizing && setResizeTarget(null)}
          title={`Scale / Resize Image: ${resizeTarget.name}`}
          size="md"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setResizeTarget(null)} disabled={resizing}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleResizeSubmit} loading={resizing}>
                Resize Image
              </Button>
            </div>
          }
        >
          <form onSubmit={handleResizeSubmit} className="space-y-4">
            <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg flex items-center justify-between text-xs">
              <span className="text-[#64748b]">Original Dimensions:</span>
              <span className="font-bold text-[#0f172a]">{resizeTarget.dimensions}</span>
            </div>

            {/* Width & Height Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">
                  New Width (px)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  required
                  value={resizeWidth}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-md px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/30 focus:border-[#ff6c2c]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">
                  New Height (px)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  required
                  value={resizeHeight}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-md px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/30 focus:border-[#ff6c2c]"
                />
              </div>
            </div>

            {/* Aspect Ratio Lock Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="lockAspect"
                checked={lockAspectRatio}
                onChange={(e) => setLockAspectRatio(e.target.checked)}
                className="rounded border-[#cbd5e1] text-[#ff6c2c] focus:ring-[#ff6c2c]"
              />
              <label htmlFor="lockAspect" className="text-xs font-medium text-[#475569] flex items-center gap-1.5 cursor-pointer">
                {lockAspectRatio ? <Lock className="w-3.5 h-3.5 text-[#ff6c2c]" /> : <Unlock className="w-3.5 h-3.5 text-[#94a3b8]" />}
                Maintain aspect ratio automatically
              </label>
            </div>

            {/* Output Filename */}
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">
                Output Filename
              </label>
              <input
                type="text"
                required
                value={resizeOutputName}
                onChange={(e) => setResizeOutputName(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/30 focus:border-[#ff6c2c]"
              />
            </div>

            {/* Overwrite Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="resizeOverwrite"
                checked={resizeOverwrite}
                onChange={(e) => setResizeOverwrite(e.target.checked)}
                className="rounded border-[#cbd5e1] text-[#ff6c2c] focus:ring-[#ff6c2c]"
              />
              <label htmlFor="resizeOverwrite" className="text-xs font-medium text-[#475569] cursor-pointer">
                Overwrite destination file if it already exists
              </label>
            </div>
          </form>
        </Modal>
      )}

      {/* --- CONVERT MODAL --- */}
      {convertTarget && (
        <Modal
          isOpen={true}
          onClose={() => !converting && setConvertTarget(null)}
          title={`Convert Format: ${convertTarget.name}`}
          size="md"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setConvertTarget(null)} disabled={converting}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleConvertSubmit} loading={converting}>
                Convert Format
              </Button>
            </div>
          }
        >
          <form onSubmit={handleConvertSubmit} className="space-y-4">
            <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg flex items-center justify-between text-xs">
              <span className="text-[#64748b]">Current Format:</span>
              <span className="font-bold text-[#ff6c2c] uppercase">{convertTarget.format}</span>
            </div>

            {/* Target Format */}
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">
                Target Format
              </label>
              <select
                value={targetFormat}
                onChange={(e) => handleTargetFormatChange(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-md px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/30 focus:border-[#ff6c2c]"
              >
                <option value="webp">WEBP (Modern, High Compression)</option>
                <option value="jpeg">JPEG / JPG (Universal Compatibility)</option>
                <option value="png">PNG (Lossless / Transparency)</option>
                <option value="avif">AVIF (Next-Gen Compression)</option>
                <option value="tiff">TIFF (Archival)</option>
              </select>
            </div>

            {/* Quality Slider for lossy formats */}
            {(targetFormat === 'jpeg' || targetFormat === 'webp' || targetFormat === 'avif') && (
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-[#334155] mb-1">
                  <span>Compression Quality</span>
                  <span className="text-[#ff6c2c]">{convertQuality}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={convertQuality}
                  onChange={(e) => setConvertQuality(e.target.value)}
                  className="w-full accent-[#ff6c2c]"
                />
                <div className="flex justify-between text-[10px] text-[#94a3b8] mt-0.5">
                  <span>Smaller File</span>
                  <span>Higher Quality</span>
                </div>
              </div>
            )}

            {/* Transparency Note */}
            {convertTarget.hasAlpha && targetFormat === 'jpeg' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Transparency Handling:</strong>
                  JPEG does not support transparent alpha channels. Transparent areas will be flattened with a clean white background.
                </div>
              </div>
            )}

            {/* Output Filename */}
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">
                Output Filename
              </label>
              <input
                type="text"
                required
                value={convertOutputName}
                onChange={(e) => setConvertOutputName(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/30 focus:border-[#ff6c2c]"
              />
            </div>

            {/* Overwrite Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="convertOverwrite"
                checked={convertOverwrite}
                onChange={(e) => setConvertOverwrite(e.target.checked)}
                className="rounded border-[#cbd5e1] text-[#ff6c2c] focus:ring-[#ff6c2c]"
              />
              <label htmlFor="convertOverwrite" className="text-xs font-medium text-[#475569] cursor-pointer">
                Overwrite destination file if it already exists
              </label>
            </div>
          </form>
        </Modal>
      )}

      {/* --- OPTIMIZE MODAL --- */}
      {optimizeTarget && (
        <Modal
          isOpen={true}
          onClose={() => !optimizing && setOptimizeTarget(null)}
          title={`Optimize / Recompress: ${optimizeTarget.name}`}
          size="md"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setOptimizeTarget(null)} disabled={optimizing}>
                {optimizeResult ? 'Done' : 'Cancel'}
              </Button>
              {!optimizeResult && (
                <Button variant="primary" size="sm" onClick={handleOptimizeSubmit} loading={optimizing}>
                  Optimize Now
                </Button>
              )}
            </div>
          }
        >
          {optimizeResult ? (
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#0f172a]">Optimization Complete!</h3>
              <div className="grid grid-cols-2 gap-3 bg-[#f8fafc] p-4 rounded-lg border border-[#e2e8f0] text-xs">
                <div>
                  <span className="text-[#64748b] block mb-0.5">Original Size</span>
                  <strong className="text-sm text-[#0f172a]">{optimizeResult.originalFormatted}</strong>
                </div>
                <div>
                  <span className="text-[#64748b] block mb-0.5">Optimized Size</span>
                  <strong className="text-sm text-emerald-600">{optimizeResult.optimizedFormatted}</strong>
                </div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800">
                Reduced by {optimizeResult.savedFormatted} ({optimizeResult.savedPercentage})
              </div>
            </div>
          ) : (
            <form onSubmit={handleOptimizeSubmit} className="space-y-4">
              <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg flex items-center justify-between text-xs">
                <span className="text-[#64748b]">Current File Size:</span>
                <span className="font-bold text-[#0f172a]">{optimizeTarget.sizeFormatted}</span>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-bold text-[#334155] mb-1">
                  <span>Compression Level</span>
                  <span className="text-[#ff6c2c]">{optimizeQuality}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="95"
                  value={optimizeQuality}
                  onChange={(e) => setOptimizeQuality(e.target.value)}
                  className="w-full accent-[#ff6c2c]"
                />
                <div className="flex justify-between text-[10px] text-[#94a3b8] mt-0.5">
                  <span>Maximum Compression</span>
                  <span>Balanced</span>
                  <span>High Fidelity</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="optOverwrite"
                  checked={optimizeOverwrite}
                  onChange={(e) => setOptimizeOverwrite(e.target.checked)}
                  className="rounded border-[#cbd5e1] text-[#ff6c2c] focus:ring-[#ff6c2c]"
                />
                <label htmlFor="optOverwrite" className="text-xs font-medium text-[#475569] cursor-pointer">
                  Overwrite original file directly
                </label>
              </div>

              {!optimizeOverwrite && (
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1">
                    Output Filename
                  </label>
                  <input
                    type="text"
                    required
                    value={optimizeOutputName}
                    onChange={(e) => setOptimizeOutputName(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff6c2c]/30 focus:border-[#ff6c2c]"
                  />
                </div>
              )}
            </form>
          )}
        </Modal>
      )}

      {/* --- INFO / PROPERTIES MODAL --- */}
      {infoImage && (
        <Modal
          isOpen={true}
          onClose={() => setInfoImage(null)}
          title={`Image Properties: ${infoImage.name}`}
          size="md"
          footer={
            <Button variant="outline" size="sm" onClick={() => setInfoImage(null)}>
              Close
            </Button>
          }
        >
          <div className="divide-y divide-[#e2e8f0] text-xs">
            <div className="py-2.5 flex justify-between">
              <span className="text-[#64748b]">Filename</span>
              <strong className="text-[#0f172a] font-mono">{infoImage.name}</strong>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-[#64748b]">Relative Path</span>
              <strong className="text-[#0f172a] font-mono">{infoImage.relPath}</strong>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-[#64748b]">Dimensions</span>
              <strong className="text-[#0f172a] font-mono">{infoImage.dimensions}</strong>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-[#64748b]">File Size</span>
              <strong className="text-[#0f172a]">{infoImage.sizeFormatted} ({infoImage.size.toLocaleString()} bytes)</strong>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-[#64748b]">Format</span>
              <span className="px-2 py-0.5 bg-[#f1f5f9] rounded text-[#0f172a] font-bold uppercase">{infoImage.format}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-[#64748b]">MIME Type</span>
              <strong className="text-[#0f172a] font-mono">{infoImage.mime}</strong>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-[#64748b]">Permissions</span>
              <strong className="text-[#0f172a] font-mono">{infoImage.permissions}</strong>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-[#64748b]">Last Modified</span>
              <strong className="text-[#0f172a]">{new Date(infoImage.modified).toLocaleString()}</strong>
            </div>
          </div>
        </Modal>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deleteImageTarget && (
        <Modal
          isOpen={true}
          onClose={() => !deleting && setDeleteImageTarget(null)}
          title="Confirm Delete Image"
          size="sm"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setDeleteImageTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleDeleteSubmit} loading={deleting}>
                Delete Image
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-[#475569] leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-[#0f172a]">"{deleteImageTarget.name}"</strong>?
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              This action cannot be undone. The file will be permanently removed from the server filesystem.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
