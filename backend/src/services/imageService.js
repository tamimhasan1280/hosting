const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const storageService = require('./storageService');

const SUPPORTED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.bmp', '.tiff', '.ico'
]);

const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.ico': 'image/x-icon'
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

class ImageService {
  /**
   * Return list of directories within user account for folder picker
   */
  listDirectories(username = 'cpanel_user') {
    const rootDir = storageService.getRootDir(username);
    const dirs = [];

    function scan(dir, relPath = '') {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          // Exclude hidden directories and cache
          if (e.name.startsWith('.')) continue;
          const childRel = relPath ? `${relPath}/${e.name}` : e.name;
          dirs.push({
            name: e.name,
            relPath: childRel
          });
          scan(path.join(dir, e.name), childRel);
        }
      }
    }

    // Always include public_html first if it exists
    dirs.push({ name: 'public_html', relPath: 'public_html' });
    dirs.push({ name: 'Root (/)', relPath: '' });

    const pubHtml = path.join(rootDir, 'public_html');
    if (fs.existsSync(pubHtml)) {
      scan(pubHtml, 'public_html');
    }

    // Remove duplicates
    const unique = [];
    const seen = new Set();
    for (const d of dirs) {
      if (!seen.has(d.relPath)) {
        seen.add(d.relPath);
        unique.push(d);
      }
    }
    return unique;
  }

  /**
   * Scan an authorized directory for image files and extract metadata
   */
  async scanImages(relDir = 'public_html', username = 'cpanel_user') {
    const rootDir = storageService.getRootDir(username);
    const targetDir = storageService.resolveSafePath(relDir, username);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      return [];
    }

    const stat = fs.statSync(targetDir);
    if (!stat.isDirectory()) {
      throw new Error('Specified path is not a directory');
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const images = [];

    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

      const fullPath = path.join(targetDir, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      const fileStat = fs.statSync(fullPath);

      let width = null;
      let height = null;
      let format = ext.replace('.', '');
      let hasAlpha = false;

      // Extract real dimensions with sharp
      try {
        if (ext === '.svg') {
          format = 'svg';
          try {
            const meta = await sharp(fullPath).metadata();
            width = meta.width || null;
            height = meta.height || null;
          } catch (e) {}
        } else {
          const meta = await sharp(fullPath).metadata();
          width = meta.width || null;
          height = meta.height || null;
          format = meta.format || format;
          hasAlpha = !!meta.hasAlpha;
        }
      } catch (err) {
        // Fallback for corrupted or unreadable images
      }

      images.push({
        name: entry.name,
        relPath,
        relDir: relDir || '',
        size: fileStat.size,
        sizeFormatted: formatBytes(fileStat.size),
        mime: MIME_MAP[ext] || 'application/octet-stream',
        format: (format || ext.replace('.', '')).toUpperCase(),
        width,
        height,
        dimensions: width && height ? `${width} × ${height}` : 'Unknown',
        modified: fileStat.mtime.toISOString(),
        permissions: (fileStat.mode & 0o777).toString(8),
        hasAlpha
      });
    }

    return images;
  }

  /**
   * Get detailed metadata for a single image
   */
  async getImageMetadata(relPath, username = 'cpanel_user') {
    const rootDir = storageService.getRootDir(username);
    const fullPath = storageService.resolveSafePath(relPath, username);

    if (!fs.existsSync(fullPath)) {
      throw new Error('Image not found');
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      throw new Error('Target is a directory, not an image file');
    }

    const ext = path.extname(fullPath).toLowerCase();
    let meta = {};
    try {
      meta = await sharp(fullPath).metadata();
    } catch (err) {
      meta = { format: ext.replace('.', ''), width: null, height: null };
    }

    return {
      name: path.basename(fullPath),
      relPath: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
      size: stat.size,
      sizeFormatted: formatBytes(stat.size),
      mime: MIME_MAP[ext] || 'application/octet-stream',
      format: (meta.format || ext.replace('.', '')).toUpperCase(),
      width: meta.width || null,
      height: meta.height || null,
      dimensions: meta.width && meta.height ? `${meta.width} × ${meta.height}` : 'Unknown',
      channels: meta.channels || null,
      density: meta.density || null,
      space: meta.space || null,
      hasAlpha: !!meta.hasAlpha,
      isProgressive: !!meta.isProgressive,
      modified: stat.mtime.toISOString(),
      created: stat.birthtime.toISOString(),
      permissions: (stat.mode & 0o777).toString(8)
    };
  }

  /**
   * Generate or retrieve a cached thumbnail
   */
  async getThumbnail(relPath, width = 200, height = 200, username = 'cpanel_user') {
    const fullPath = storageService.resolveSafePath(relPath, username);
    if (!fs.existsSync(fullPath)) {
      throw new Error('Image not found');
    }

    const stat = fs.statSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();

    // Cache directory per user
    const rootDir = storageService.getRootDir(username);
    const cacheDir = path.join(rootDir, '.cpanel_cache', 'thumbnails');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const hash = crypto.createHash('md5').update(`${relPath}:${stat.mtimeMs}:${width}x${height}`).digest('hex');
    const cacheFile = path.join(cacheDir, `${hash}.webp`);

    if (fs.existsSync(cacheFile)) {
      const cacheStat = fs.statSync(cacheFile);
      if (cacheStat.mtimeMs >= stat.mtimeMs) {
        return { filePath: cacheFile, mime: 'image/webp' };
      }
    }

    const targetW = Math.min(Math.max(parseInt(width, 10) || 200, 32), 600);
    const targetH = Math.min(Math.max(parseInt(height, 10) || 200, 32), 600);

    try {
      await sharp(fullPath)
        .resize({
          width: targetW,
          height: targetH,
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 80 })
        .toFile(cacheFile);

      return { filePath: cacheFile, mime: 'image/webp' };
    } catch (err) {
      return { filePath: fullPath, mime: MIME_MAP[ext] || 'application/octet-stream' };
    }
  }

  /**
   * Resize an image with aspect ratio lock or custom dimensions
   */
  async resizeImage({
    sourcePath,
    newWidth,
    newHeight,
    maintainAspectRatio = true,
    outputName,
    outputDir,
    overwrite = false,
    username = 'cpanel_user'
  }) {
    if (!sourcePath) throw new Error('Source image path is required');

    const srcFullPath = storageService.resolveSafePath(sourcePath, username);
    if (!fs.existsSync(srcFullPath)) {
      throw new Error('Source image does not exist');
    }

    const w = parseInt(newWidth, 10);
    const h = newHeight ? parseInt(newHeight, 10) : null;

    if (isNaN(w) || w <= 0 || w > 10000) {
      throw new Error('Invalid width: must be a positive integer between 1 and 10000');
    }
    if (h !== null) {
      if (isNaN(h) || h <= 0 || h > 10000) {
        throw new Error('Invalid height: must be a positive integer between 1 and 10000');
      }
    }

    const cleanOutputName = (outputName || '').trim();
    if (!cleanOutputName) {
      throw new Error('Output filename is required');
    }

    if (cleanOutputName.includes('/') || cleanOutputName.includes('\\') || cleanOutputName.includes('\0')) {
      throw new Error('Invalid output filename');
    }
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i.test(cleanOutputName)) {
      throw new Error('Invalid output filename: reserved system name');
    }

    const targetRelDir = outputDir !== undefined && outputDir !== null ? outputDir : path.dirname(sourcePath);
    const targetDir = storageService.resolveSafePath(targetRelDir, username);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const destFullPath = path.join(targetDir, cleanOutputName);

    if (fs.existsSync(destFullPath) && !overwrite) {
      const err = new Error(`File "${cleanOutputName}" already exists in the target directory`);
      err.code = 'EEXIST';
      throw err;
    }

    const tempFile = path.join(targetDir, `.tmp_${crypto.randomBytes(6).toString('hex')}_${cleanOutputName}`);

    try {
      const transformer = sharp(srcFullPath);
      if (maintainAspectRatio) {
        transformer.resize({
          width: w,
          height: h || undefined,
          fit: 'inside',
          withoutEnlargement: false
        });
      } else {
        transformer.resize({
          width: w,
          height: h || w,
          fit: 'fill'
        });
      }

      await transformer.toFile(tempFile);
      fs.renameSync(tempFile, destFullPath);
    } catch (err) {
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch (e) {}
      }
      throw err;
    }

    const rootDir = storageService.getRootDir(username);
    const destRelPath = path.relative(rootDir, destFullPath).replace(/\\/g, '/');
    return await this.getImageMetadata(destRelPath, username);
  }

  /**
   * Convert an image to another format with quality and alpha handling
   */
  async convertImage({
    sourcePath,
    targetFormat,
    quality = 85,
    outputName,
    outputDir,
    overwrite = false,
    backgroundColor = '#ffffff',
    username = 'cpanel_user'
  }) {
    if (!sourcePath) throw new Error('Source image path is required');

    const srcFullPath = storageService.resolveSafePath(sourcePath, username);
    if (!fs.existsSync(srcFullPath)) {
      throw new Error('Source image does not exist');
    }

    const normalizedFmt = (targetFormat || '').toLowerCase().trim();
    const VALID_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'avif', 'tiff'];
    if (!VALID_FORMATS.includes(normalizedFmt)) {
      throw new Error(`Unsupported target format: ${targetFormat}. Supported formats: JPEG, PNG, WEBP, AVIF, TIFF`);
    }

    const fmt = normalizedFmt === 'jpg' ? 'jpeg' : normalizedFmt;
    const q = Math.min(Math.max(parseInt(quality, 10) || 85, 1), 100);

    const cleanOutputName = (outputName || '').trim();
    if (!cleanOutputName) {
      throw new Error('Output filename is required');
    }

    if (cleanOutputName.includes('/') || cleanOutputName.includes('\\') || cleanOutputName.includes('\0')) {
      throw new Error('Invalid output filename');
    }

    const targetRelDir = outputDir !== undefined && outputDir !== null ? outputDir : path.dirname(sourcePath);
    const targetDir = storageService.resolveSafePath(targetRelDir, username);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const destFullPath = path.join(targetDir, cleanOutputName);
    if (fs.existsSync(destFullPath) && !overwrite) {
      const err = new Error(`File "${cleanOutputName}" already exists in destination`);
      err.code = 'EEXIST';
      throw err;
    }

    const tempFile = path.join(targetDir, `.tmp_${crypto.randomBytes(6).toString('hex')}_${cleanOutputName}`);

    try {
      let pipeline = sharp(srcFullPath);

      if (fmt === 'jpeg') {
        const meta = await sharp(srcFullPath).metadata();
        if (meta.hasAlpha) {
          pipeline = pipeline.flatten({ background: backgroundColor || '#ffffff' });
        }
        pipeline = pipeline.jpeg({ quality: q, mozjpeg: true });
      } else if (fmt === 'png') {
        pipeline = pipeline.png({ compressionLevel: 9 });
      } else if (fmt === 'webp') {
        pipeline = pipeline.webp({ quality: q });
      } else if (fmt === 'avif') {
        pipeline = pipeline.avif({ quality: q });
      } else if (fmt === 'tiff') {
        pipeline = pipeline.tiff({ quality: q });
      }

      await pipeline.toFile(tempFile);
      fs.renameSync(tempFile, destFullPath);
    } catch (err) {
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch (e) {}
      }
      throw err;
    }

    const rootDir = storageService.getRootDir(username);
    const destRelPath = path.relative(rootDir, destFullPath).replace(/\\/g, '/');
    return await this.getImageMetadata(destRelPath, username);
  }

  /**
   * Optimize an image using sharp recompression
   */
  async optimizeImage({
    sourcePath,
    quality = 80,
    outputName,
    outputDir,
    overwrite = false,
    username = 'cpanel_user'
  }) {
    if (!sourcePath) throw new Error('Source image path is required');

    const srcFullPath = storageService.resolveSafePath(sourcePath, username);
    if (!fs.existsSync(srcFullPath)) {
      throw new Error('Source image does not exist');
    }

    const origStat = fs.statSync(srcFullPath);
    const origSize = origStat.size;
    const ext = path.extname(srcFullPath).toLowerCase();
    const cleanOutputName = outputName ? outputName.trim() : (overwrite ? path.basename(srcFullPath) : `optimized-${path.basename(srcFullPath)}`);

    const targetRelDir = outputDir !== undefined && outputDir !== null ? outputDir : path.dirname(sourcePath);
    const targetDir = storageService.resolveSafePath(targetRelDir, username);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const destFullPath = path.join(targetDir, cleanOutputName);
    if (fs.existsSync(destFullPath) && !overwrite && destFullPath !== srcFullPath) {
      const err = new Error(`File "${cleanOutputName}" already exists`);
      err.code = 'EEXIST';
      throw err;
    }

    const q = Math.min(Math.max(parseInt(quality, 10) || 80, 10), 100);
    const tempFile = path.join(targetDir, `.tmp_${crypto.randomBytes(6).toString('hex')}_${cleanOutputName}`);

    try {
      let pipeline = sharp(srcFullPath);
      if (ext === '.jpg' || ext === '.jpeg') {
        pipeline = pipeline.jpeg({ quality: q, mozjpeg: true });
      } else if (ext === '.png') {
        pipeline = pipeline.png({ compressionLevel: 9, palette: true, quality: q });
      } else if (ext === '.webp') {
        pipeline = pipeline.webp({ quality: q });
      } else if (ext === '.avif') {
        pipeline = pipeline.avif({ quality: q });
      } else {
        pipeline = pipeline.webp({ quality: q });
      }

      await pipeline.toFile(tempFile);
      fs.renameSync(tempFile, destFullPath);
    } catch (err) {
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch (e) {}
      }
      throw err;
    }

    const newStat = fs.statSync(destFullPath);
    const optimizedSize = newStat.size;
    const savedBytes = Math.max(0, origSize - optimizedSize);
    const savedPercent = origSize > 0 ? ((savedBytes / origSize) * 100).toFixed(1) : 0;

    const rootDir = storageService.getRootDir(username);
    const destRelPath = path.relative(rootDir, destFullPath).replace(/\\/g, '/');
    const metadata = await this.getImageMetadata(destRelPath, username);

    return {
      success: true,
      originalSize: origSize,
      originalFormatted: formatBytes(origSize),
      optimizedSize,
      optimizedFormatted: formatBytes(optimizedSize),
      savedBytes,
      savedFormatted: formatBytes(savedBytes),
      savedPercentage: `${savedPercent}%`,
      image: metadata
    };
  }

  /**
   * Delete an image
   */
  async deleteImage(relPath, username = 'cpanel_user') {
    const fullPath = storageService.resolveSafePath(relPath, username);
    if (!fs.existsSync(fullPath)) {
      throw new Error('Image not found');
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      throw new Error('Cannot delete directory via image service');
    }

    const ext = path.extname(fullPath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      throw new Error('File is not an image');
    }

    fs.unlinkSync(fullPath);
    return { success: true, message: 'Image deleted successfully' };
  }

  /**
   * Rename an image
   */
  async renameImage(oldRelPath, newName, username = 'cpanel_user') {
    const fullOldPath = storageService.resolveSafePath(oldRelPath, username);
    if (!fs.existsSync(fullOldPath)) {
      throw new Error('Image not found');
    }

    const cleanNewName = (newName || '').trim();
    if (!cleanNewName) {
      throw new Error('New name cannot be empty');
    }

    if (cleanNewName.includes('/') || cleanNewName.includes('\\') || cleanNewName.includes('\0')) {
      throw new Error('Invalid name format');
    }

    const newExt = path.extname(cleanNewName).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(newExt)) {
      throw new Error(`New filename must retain a valid image extension (${[...SUPPORTED_EXTENSIONS].join(', ')})`);
    }

    const dir = path.dirname(fullOldPath);
    const fullNewPath = path.join(dir, cleanNewName);

    if (fs.existsSync(fullNewPath)) {
      throw new Error(`A file with name "${cleanNewName}" already exists`);
    }

    fs.renameSync(fullOldPath, fullNewPath);

    const rootDir = storageService.getRootDir(username);
    const newRelPath = path.relative(rootDir, fullNewPath).replace(/\\/g, '/');
    return await this.getImageMetadata(newRelPath, username);
  }

  /**
   * Safe preview stream path
   */
  getPreviewFile(relPath, username = 'cpanel_user') {
    const fullPath = storageService.resolveSafePath(relPath, username);
    if (!fs.existsSync(fullPath)) {
      throw new Error('Image not found');
    }
    const ext = path.extname(fullPath).toLowerCase();
    return {
      filePath: fullPath,
      mime: MIME_MAP[ext] || 'application/octet-stream',
      name: path.basename(fullPath)
    };
  }
}

module.exports = new ImageService();
