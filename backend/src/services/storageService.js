const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const BASE_VHOSTS_DIR = path.resolve(__dirname, '../../data/vhosts');

function getUserRootDir(username = 'cpanel_user') {
  const safeUser = (username || 'cpanel_user').replace(/[^a-zA-Z0-9_-]/g, '');
  const userDir = path.join(BASE_VHOSTS_DIR, safeUser);
  
  if (!fs.existsSync(userDir)) {
    // If cpanel_user or default, ensure fallback to legacy default if present
    const defaultDir = path.join(BASE_VHOSTS_DIR, 'default');
    if ((safeUser === 'cpanel_user' || safeUser === 'default') && fs.existsSync(defaultDir)) {
      return defaultDir;
    }
    fs.mkdirSync(path.join(userDir, 'public_html'), { recursive: true });
    const starterHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${safeUser}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; max-width: 500px; }
    .badge { background: #ff6c2c; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    h1 { margin: 20px 0 10px; color: #0f172a; }
    p { color: #64748b; font-size: 14px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">cPanel Hosted</span>
    <h1>Account Active: ${safeUser}</h1>
    <p>This is the default document root (<code>public_html/index.html</code>) for hosting account <strong>${safeUser}</strong>.</p>
    <p>Upload your website files using cPanel File Manager or FTP.</p>
  </div>
</body>
</html>`;
    fs.writeFileSync(path.join(userDir, 'public_html', 'index.html'), starterHtml, 'utf8');
  }
  return userDir;
}

function resolveSafePath(relPath = '', username = 'cpanel_user') {
  const root = getUserRootDir(username);
  if (typeof relPath !== 'string') {
    throw new Error('Invalid path format');
  }
  
  // Check for raw null-byte or %00 injection before any processing
  if (relPath.includes('\0') || relPath.toLowerCase().includes('%00')) {
    throw new Error('Access denied: null byte injection detected');
  }
  
  // Repeatedly URL-decode to catch multi-layer encoded traversal (%252e%252e%252f -> %2e%2e%2f -> ../)
  let clean = relPath;
  let prev = '';
  while (clean !== prev) {
    prev = clean;
    try {
      clean = decodeURIComponent(clean);
    } catch (e) {
      break;
    }
  }

  // Reject attempts that contain null bytes after decoding
  if (clean.includes('\0')) {
    throw new Error('Access denied: null byte injection detected');
  }

  // Replace backslashes with forward slashes for consistent posix normalization
  clean = clean.replace(/\\/g, '/');

  // Strip leading and trailing slashes
  clean = clean.replace(/^\/+/, '').replace(/\/+$/, '');

  // Check segments for path traversal (..)
  if (clean) {
    const segments = clean.split('/');
    for (const seg of segments) {
      if (seg === '..' || seg === '.') {
        throw new Error('Access denied: path traversal detected');
      }
    }
  }

  // Absolute resolution against user root directory
  const canonicalRoot = path.resolve(root);
  const target = path.resolve(root, clean);

  // Must remain strictly within user root
  if (target !== canonicalRoot && !target.startsWith(canonicalRoot + path.sep)) {
    throw new Error('Access denied: path traversal detected');
  }

  // Check symlink containment if path exists on disk
  if (fs.existsSync(target)) {
    try {
      const real = fs.realpathSync(target);
      if (real !== canonicalRoot && !real.startsWith(canonicalRoot + path.sep)) {
        throw new Error('Access denied: symlink escape detected');
      }
    } catch (e) {
      if (e.message.includes('Access denied')) throw e;
    }
  }

  return target;
}

function validateName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Name is required');
  }
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Name cannot be empty');
  }
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0') || trimmed === '.' || trimmed === '..' || trimmed.includes('..')) {
    throw new Error('Invalid name: illegal characters or path traversal sequence');
  }
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i.test(trimmed)) {
    throw new Error('Invalid name: reserved system filename');
  }
  return trimmed;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getPermissionsString(stat) {
  const mode = stat.mode;
  return (mode & 0o777).toString(8);
}

class StorageService {
  getRootDir(username = 'cpanel_user') {
    return getUserRootDir(username);
  }

  getUserRootDir(username = 'cpanel_user') {
    return getUserRootDir(username);
  }

  resolveSafePath(relPath, username = 'cpanel_user') {
    return resolveSafePath(relPath, username);
  }

  async listFiles(relPath = 'public_html', username = 'cpanel_user') {
    const rootDir = getUserRootDir(username);
    const targetPath = resolveSafePath(relPath, username);
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      const fullPath = path.join(targetPath, entry.name);
      try {
        const stats = fs.statSync(fullPath);
        const itemRelPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
        items.push({
          name: entry.name,
          relPath: itemRelPath,
          isDirectory: entry.isDirectory(),
          size: entry.isDirectory() ? 0 : stats.size,
          sizeFormatted: entry.isDirectory() ? '--' : formatBytes(stats.size),
          modified: stats.mtime,
          permissions: getPermissionsString(stats),
          isHidden: entry.name.startsWith('.'),
          ext: entry.isDirectory() ? '' : path.extname(entry.name).toLowerCase()
        });
      } catch (err) {
        console.error('Error reading stats for', fullPath, err.message);
      }
    }

    // Sort: directories first, then alphabetical
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    const currentRel = path.relative(rootDir, targetPath).replace(/\\/g, '/');
    return {
      currentPath: currentRel || '',
      items
    };
  }

  async readFile(relPath, username = 'cpanel_user') {
    const rootDir = getUserRootDir(username);
    const targetPath = resolveSafePath(relPath, username);
    if (!fs.existsSync(targetPath)) {
      throw new Error('File not found');
    }
    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
      throw new Error('Cannot read a directory as text');
    }

    const MAX_EDIT_SIZE = 5 * 1024 * 1024; // 5 MB
    if (stats.size > MAX_EDIT_SIZE) {
      throw new Error(`File is too large to edit in browser (${(stats.size / (1024 * 1024)).toFixed(1)} MB). Maximum supported edit size is 5 MB.`);
    }

    const content = fs.readFileSync(targetPath, 'utf8');
    return {
      name: path.basename(targetPath),
      relPath: path.relative(rootDir, targetPath).replace(/\\/g, '/'),
      content,
      size: stats.size,
      sizeFormatted: formatBytes(stats.size),
      modified: stats.mtime
    };
  }

  async saveFile(relPath, content, username = 'cpanel_user') {
    const targetPath = resolveSafePath(relPath, username);
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(targetPath, content, 'utf8');
    return { success: true, path: relPath };
  }

  async createFolder(relPath, username = 'cpanel_user') {
    const baseName = path.basename(relPath);
    validateName(baseName);
    const targetPath = resolveSafePath(relPath, username);
    if (fs.existsSync(targetPath)) {
      throw new Error('Folder already exists');
    }
    fs.mkdirSync(targetPath, { recursive: true });
    return { success: true, path: relPath };
  }

  async createFile(relPath, initialContent = '', username = 'cpanel_user') {
    const baseName = path.basename(relPath);
    validateName(baseName);
    const targetPath = resolveSafePath(relPath, username);
    if (fs.existsSync(targetPath)) {
      throw new Error('File already exists');
    }
    const parent = path.dirname(targetPath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    fs.writeFileSync(targetPath, initialContent, 'utf8');
    return { success: true, path: relPath };
  }

  async deleteItem(relPath, username = 'cpanel_user') {
    if (Array.isArray(relPath)) {
      return this.deleteItems(relPath, username);
    }
    const rootDir = getUserRootDir(username);
    const targetPath = resolveSafePath(relPath, username);
    
    if (path.resolve(targetPath) === path.resolve(rootDir)) {
      throw new Error('Cannot delete user root directory');
    }

    if (!fs.existsSync(targetPath)) {
      throw new Error('Item not found: ' + relPath);
    }
    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
    return { success: true, path: relPath };
  }

  async deleteItems(relPaths = [], username = 'cpanel_user') {
    const results = [];
    for (const p of relPaths) {
      try {
        const res = await this.deleteItem(p, username);
        results.push(res);
      } catch (err) {
        results.push({ success: false, path: p, error: err.message });
      }
    }
    return { success: true, deletedCount: results.filter(r => r.success).length, results };
  }

  getDownloadPath(relPath, username = 'cpanel_user') {
    const targetPath = resolveSafePath(relPath, username);
    if (!fs.existsSync(targetPath)) {
      throw new Error('File not found');
    }
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      throw new Error('Cannot download a directory as a file');
    }
    return targetPath;
  }

  async renameItem(oldRelPath, newName, username = 'cpanel_user') {
    const validatedNewName = validateName(newName);
    const rootDir = getUserRootDir(username);
    const oldPath = resolveSafePath(oldRelPath, username);
    if (!fs.existsSync(oldPath)) {
      throw new Error('Source not found');
    }

    if (path.resolve(oldPath) === path.resolve(rootDir)) {
      throw new Error('Cannot rename user root directory');
    }

    const parentDir = path.dirname(oldPath);
    const newPath = path.join(parentDir, validatedNewName);
    const canonicalRoot = path.resolve(rootDir);
    const canonicalNew = path.resolve(newPath);

    if (!canonicalNew.startsWith(canonicalRoot + path.sep)) {
      throw new Error('Invalid new path');
    }
    if (fs.existsSync(newPath)) {
      throw new Error('A file or folder with that name already exists');
    }
    fs.renameSync(oldPath, newPath);
    return {
      success: true,
      oldPath: oldRelPath,
      newRelPath: path.relative(rootDir, newPath).replace(/\\/g, '/')
    };
  }

  async copyItem(sourcePaths, destRelDir = 'public_html', conflictStrategy = 'replace', username = 'cpanel_user') {
    const sources = Array.isArray(sourcePaths) ? sourcePaths : [sourcePaths];
    const rootDir = getUserRootDir(username);
    const destDir = resolveSafePath(destRelDir, username);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const destStat = fs.statSync(destDir);
    if (!destStat.isDirectory()) {
      throw new Error('Destination must be a directory');
    }

    const results = [];
    for (const srcRel of sources) {
      const srcPath = resolveSafePath(srcRel, username);
      if (!fs.existsSync(srcPath)) {
        throw new Error(`Source not found: ${srcRel}`);
      }
      const baseName = path.basename(srcPath);
      let targetPath = path.join(destDir, baseName);

      // Check if copying directory into itself
      const canonicalSrc = path.resolve(srcPath);
      const canonicalTarget = path.resolve(targetPath);
      if (canonicalTarget === canonicalSrc || canonicalTarget.startsWith(canonicalSrc + path.sep)) {
        throw new Error(`Cannot copy "${baseName}" into itself or its own subdirectory`);
      }

      if (fs.existsSync(targetPath)) {
        if (conflictStrategy === 'skip') {
          results.push({ source: srcRel, action: 'skipped' });
          continue;
        } else if (conflictStrategy === 'rename') {
          let count = 1;
          const ext = path.extname(baseName);
          const nameWithoutExt = path.basename(baseName, ext);
          while (fs.existsSync(targetPath)) {
            targetPath = path.join(destDir, `${nameWithoutExt} (${count})${ext}`);
            count++;
          }
        }
      }

      const srcStat = fs.statSync(srcPath);
      if (srcStat.isDirectory()) {
        fs.cpSync(srcPath, targetPath, { recursive: true, force: true });
      } else {
        fs.copyFileSync(srcPath, targetPath);
      }
      results.push({
        source: srcRel,
        destination: path.relative(rootDir, targetPath).replace(/\\/g, '/'),
        action: 'copied'
      });
    }

    return { success: true, count: results.length, results };
  }

  async moveItem(sourcePaths, destRelDir = 'public_html', conflictStrategy = 'replace', username = 'cpanel_user') {
    const sources = Array.isArray(sourcePaths) ? sourcePaths : [sourcePaths];
    const rootDir = getUserRootDir(username);
    const destDir = resolveSafePath(destRelDir, username);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const destStat = fs.statSync(destDir);
    if (!destStat.isDirectory()) {
      throw new Error('Destination must be a directory');
    }

    const results = [];
    for (const srcRel of sources) {
      const srcPath = resolveSafePath(srcRel, username);
      if (!fs.existsSync(srcPath)) {
        throw new Error(`Source not found: ${srcRel}`);
      }
      const baseName = path.basename(srcPath);
      let targetPath = path.join(destDir, baseName);

      // Prevent moving root or moving folder into itself
      const canonicalSrc = path.resolve(srcPath);
      const canonicalDest = path.resolve(destDir);
      const canonicalTarget = path.resolve(targetPath);

      if (canonicalSrc === path.resolve(rootDir)) {
        throw new Error('Cannot move user root directory');
      }
      if (canonicalTarget === canonicalSrc) {
        results.push({ source: srcRel, action: 'skipped (same location)' });
        continue;
      }
      if (canonicalDest === canonicalSrc || canonicalDest.startsWith(canonicalSrc + path.sep)) {
        throw new Error(`Cannot move directory "${baseName}" into itself or its own subfolder`);
      }

      if (fs.existsSync(targetPath)) {
        if (conflictStrategy === 'skip') {
          results.push({ source: srcRel, action: 'skipped' });
          continue;
        } else if (conflictStrategy === 'rename') {
          let count = 1;
          const ext = path.extname(baseName);
          const nameWithoutExt = path.basename(baseName, ext);
          while (fs.existsSync(targetPath)) {
            targetPath = path.join(destDir, `${nameWithoutExt} (${count})${ext}`);
            count++;
          }
        } else {
          // Replace: remove existing target first
          const targetStat = fs.statSync(targetPath);
          if (targetStat.isDirectory()) {
            fs.rmSync(targetPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(targetPath);
          }
        }
      }

      fs.renameSync(srcPath, targetPath);
      results.push({
        source: srcRel,
        destination: path.relative(rootDir, targetPath).replace(/\\/g, '/'),
        action: 'moved'
      });
    }

    return { success: true, count: results.length, results };
  }

  async searchFiles(query = '', relDir = '', username = 'cpanel_user') {
    if (!query || typeof query !== 'string') {
      return { query: '', count: 0, items: [] };
    }
    const rootDir = getUserRootDir(username);
    const startPath = resolveSafePath(relDir, username);
    const cleanQ = query.trim().toLowerCase();
    const results = [];
    const MAX_RESULTS = 100;

    function walk(dir) {
      if (results.length >= MAX_RESULTS) return;
      if (!fs.existsSync(dir)) return;

      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (err) {
        return;
      }

      for (const entry of entries) {
        if (results.length >= MAX_RESULTS) break;
        const full = path.join(dir, entry.name);
        try {
          const stats = fs.statSync(full);
          const itemRel = path.relative(rootDir, full).replace(/\\/g, '/');

          if (entry.name.toLowerCase().includes(cleanQ)) {
            results.push({
              name: entry.name,
              relPath: itemRel,
              isDirectory: entry.isDirectory(),
              size: entry.isDirectory() ? 0 : stats.size,
              sizeFormatted: entry.isDirectory() ? '--' : formatBytes(stats.size),
              modified: stats.mtime,
              permissions: getPermissionsString(stats),
              ext: entry.isDirectory() ? '' : path.extname(entry.name).toLowerCase()
            });
          }

          if (entry.isDirectory()) {
            walk(full);
          }
        } catch (err) {}
      }
    }

    walk(startPath);
    return { query, count: results.length, items: results };
  }

  async getFileInfo(relPath, username = 'cpanel_user') {
    const rootDir = getUserRootDir(username);
    const targetPath = resolveSafePath(relPath, username);
    if (!fs.existsSync(targetPath)) {
      throw new Error('Item not found');
    }
    const stats = fs.statSync(targetPath);
    const isDir = stats.isDirectory();
    const name = path.basename(targetPath);
    const rel = path.relative(rootDir, targetPath).replace(/\\/g, '/');

    let itemCount = null;
    if (isDir) {
      try {
        itemCount = fs.readdirSync(targetPath).length;
      } catch (e) {
        itemCount = 0;
      }
    }

    const ext = isDir ? '' : path.extname(name).toLowerCase();
    let typeCategory = 'unknown';
    if (isDir) typeCategory = 'folder';
    else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'].includes(ext)) typeCategory = 'image';
    else if (['.html', '.htm', '.css', '.js', '.jsx', '.ts', '.tsx', '.json', '.xml', '.php', '.sql', '.py', '.sh'].includes(ext)) typeCategory = 'code';
    else if (['.txt', '.md', '.log', '.csv', '.env', '.htaccess'].includes(ext)) typeCategory = 'text';
    else if (['.zip', '.tar', '.gz', '.tgz', '.rar', '.7z'].includes(ext)) typeCategory = 'archive';
    else if (ext === '.pdf') typeCategory = 'pdf';
    else if (['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)) typeCategory = 'document';
    else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) typeCategory = 'audio';
    else if (['.mp4', '.webm', '.avi', '.mov'].includes(ext)) typeCategory = 'video';

    return {
      name,
      relPath: rel,
      isDirectory: isDir,
      size: isDir ? 0 : stats.size,
      sizeFormatted: isDir ? '--' : formatBytes(stats.size),
      modified: stats.mtime,
      created: stats.birthtime,
      permissions: getPermissionsString(stats),
      extension: ext,
      typeCategory,
      itemCount
    };
  }

  async changePermissions(relPath, mode, username = 'cpanel_user') {
    const targetPath = resolveSafePath(relPath, username);
    if (!fs.existsSync(targetPath)) {
      throw new Error('Item not found');
    }
    const parsedMode = parseInt(mode, 8);
    try {
      fs.chmodSync(targetPath, parsedMode);
    } catch (e) {
      // Windows file systems might not support POSIX chmod modes
    }
    return { success: true, permissions: mode };
  }

  async compress(items, zipName, targetRelDir = 'public_html', username = 'cpanel_user') {
    const rootDir = getUserRootDir(username);
    const zip = new AdmZip();
    const destDir = resolveSafePath(targetRelDir, username);
    const cleanZipName = validateName(zipName.endsWith('.zip') ? zipName : `${zipName}.zip`);
    const zipPath = path.join(destDir, cleanZipName);

    for (const itemRel of items) {
      const fullPath = resolveSafePath(itemRel, username);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          zip.addLocalFolder(fullPath, path.basename(fullPath));
        } else {
          zip.addLocalFile(fullPath);
        }
      }
    }

    zip.writeZip(zipPath);
    return { success: true, zipFile: path.relative(rootDir, zipPath).replace(/\\/g, '/') };
  }

  async extract(zipRelPath, targetRelDir = 'public_html', username = 'cpanel_user') {
    const rootDir = getUserRootDir(username);
    const zipFullPath = resolveSafePath(zipRelPath, username);
    const destDir = resolveSafePath(targetRelDir, username);

    if (!fs.existsSync(zipFullPath)) {
      throw new Error('Zip file not found');
    }

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const zip = new AdmZip(zipFullPath);
    const zipEntries = zip.getEntries();
    
    // Zip Slip defense: verify that every entry remains inside destDir
    const canonicalDest = path.resolve(destDir);
    for (const entry of zipEntries) {
      if (entry.entryName.includes('..')) {
        throw new Error('Malicious archive detected: Zip Slip path traversal blocked');
      }
      const entryDest = path.resolve(canonicalDest, entry.entryName);
      if (!entryDest.startsWith(canonicalDest + path.sep) && entryDest !== canonicalDest) {
        throw new Error('Malicious archive detected: entry resolves outside target directory');
      }
    }

    zip.extractAllTo(destDir, true);
    return { success: true, extractedTo: path.relative(rootDir, destDir).replace(/\\/g, '/') };
  }

  getDiskUsage(username = 'cpanel_user') {
    const rootDir = getUserRootDir(username);
    let totalBytes = 0;
    let fileCount = 0;

    function walk(dir) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        try {
          const s = fs.statSync(full);
          if (e.isDirectory()) {
            walk(full);
          } else {
            totalBytes += s.size;
            fileCount++;
          }
        } catch (err) {}
      }
    }

    walk(rootDir);
    return {
      bytes: totalBytes,
      mb: +(totalBytes / (1024 * 1024)).toFixed(2),
      formatted: formatBytes(totalBytes),
      files: fileCount
    };
  }
}

module.exports = new StorageService();
