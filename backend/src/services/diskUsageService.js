const fs = require('fs');
const path = require('path');
const storageService = require('./storageService');
const whmService = require('./whmService');

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0 || bytes === null || bytes === undefined || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(Math.max(0, i), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, idx)).toFixed(dm)) + ' ' + sizes[idx];
}

class DiskUsageService {
  constructor() {
    this.cache = new Map();
    this.inFlightScans = new Map();
    this.CACHE_TTL_MS = 60 * 1000; // 60 seconds
  }

  formatBytes(bytes, decimals = 2) {
    return formatBytes(bytes, decimals);
  }

  /**
   * Get quota configuration for user from whm_accounts
   */
  getAccountQuota(username = 'cpanel_user') {
    let limitMb = 10240; // Default 10 GB
    let unlimited = false;

    try {
      const accounts = whmService._read ? whmService._read() : [];
      const acct = accounts.find(a => a.user === username);
      if (acct) {
        if (acct.disklimit === 'unlimited' || String(acct.disklimit).toLowerCase() === 'unlimited') {
          unlimited = true;
          limitMb = null;
        } else if (acct.disklimit !== undefined && acct.disklimit !== null) {
          const str = String(acct.disklimit).trim();
          if (str.endsWith('G') || str.endsWith('GB')) {
            limitMb = parseFloat(str) * 1024;
          } else if (str.endsWith('M') || str.endsWith('MB')) {
            limitMb = parseFloat(str);
          } else if (str.endsWith('K') || str.endsWith('KB')) {
            limitMb = parseFloat(str) / 1024;
          } else {
            const parsed = parseFloat(str);
            if (!isNaN(parsed)) limitMb = parsed;
          }
        }
      }
    } catch (e) {
      limitMb = 10240;
    }

    return { unlimited, limitMb };
  }

  /**
   * Perform recursive directory scan with symlink & permission protection
   */
  _scanDirectoryRecursive(dirPath, rootDir, visitedRealPaths, warnings) {
    let sizeBytes = 0;
    let fileCount = 0;
    let dirCount = 0;
    let subDirs = [];

    let entries = [];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (err) {
      warnings.push(`Cannot read directory ${path.relative(rootDir, dirPath) || '.'}: ${err.message}`);
      return { sizeBytes: 0, fileCount: 0, dirCount: 0, subDirs: [] };
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        const lstat = fs.lstatSync(fullPath);

        // Symlink protection: verify target stays within user root
        if (lstat.isSymbolicLink()) {
          try {
            const real = fs.realpathSync(fullPath);
            const canonicalRoot = path.resolve(rootDir);
            if (real !== canonicalRoot && !real.startsWith(canonicalRoot + path.sep)) {
              warnings.push(`Skipped external symlink: ${entry.name}`);
              continue;
            }
            if (visitedRealPaths.has(real)) {
              // Circular symlink loop prevention
              continue;
            }
            visitedRealPaths.add(real);

            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              dirCount++;
              const res = this._scanDirectoryRecursive(fullPath, rootDir, visitedRealPaths, warnings);
              sizeBytes += res.sizeBytes;
              fileCount += res.fileCount;
              dirCount += res.dirCount;
              subDirs.push({
                name: entry.name,
                fullPath,
                ...res
              });
            } else if (stat.isFile()) {
              fileCount++;
              sizeBytes += stat.size;
            }
          } catch (symErr) {
            // Broken symlink
            warnings.push(`Broken symlink ignored: ${entry.name}`);
          }
          continue;
        }

        if (entry.isDirectory()) {
          dirCount++;
          const res = this._scanDirectoryRecursive(fullPath, rootDir, visitedRealPaths, warnings);
          sizeBytes += res.sizeBytes;
          fileCount += res.fileCount;
          dirCount += res.dirCount;
          subDirs.push({
            name: entry.name,
            fullPath,
            ...res
          });
        } else if (entry.isFile()) {
          fileCount++;
          sizeBytes += lstat.size;
        }
        // Skip special files (sockets, FIFOs, block/character devices) safely
      } catch (entryErr) {
        warnings.push(`Could not inspect ${entry.name}: ${entryErr.message}`);
      }
    }

    return {
      sizeBytes,
      fileCount,
      dirCount,
      subDirs
    };
  }

  /**
   * Main scan execution for an authenticated user
   */
  async _performDiskScan(username = 'cpanel_user') {
    const startTime = Date.now();
    const rootDir = storageService.getRootDir(username);
    const warnings = [];
    const visitedRealPaths = new Set();
    visitedRealPaths.add(path.resolve(rootDir));

    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir, { recursive: true });
    }

    let rootEntries = [];
    try {
      rootEntries = fs.readdirSync(rootDir, { withFileTypes: true });
    } catch (err) {
      warnings.push(`Cannot access user root directory: ${err.message}`);
    }

    let totalUsageBytes = 0;
    let totalFiles = 0;
    let totalDirectories = 0;
    const directoryList = [];
    let looseFilesBytes = 0;
    let looseFilesCount = 0;

    let largestDir = { name: 'None', path: '', size_bytes: 0 };

    for (const entry of rootEntries) {
      const fullPath = path.join(rootDir, entry.name);
      try {
        const lstat = fs.lstatSync(fullPath);

        if (lstat.isDirectory()) {
          totalDirectories++;
          const scanRes = this._scanDirectoryRecursive(fullPath, rootDir, visitedRealPaths, warnings);
          totalUsageBytes += scanRes.sizeBytes;
          totalFiles += scanRes.fileCount;
          totalDirectories += scanRes.dirCount;

          const relPath = entry.name;
          const dirInfo = {
            name: entry.name,
            path: relPath,
            size_bytes: scanRes.sizeBytes,
            size_formatted: formatBytes(scanRes.sizeBytes),
            file_count: scanRes.fileCount,
            directory_count: scanRes.dirCount,
            has_children: scanRes.subDirs.length > 0,
            children_count: scanRes.subDirs.length
          };

          if (scanRes.sizeBytes > largestDir.size_bytes) {
            largestDir = {
              name: entry.name,
              path: relPath,
              size_bytes: scanRes.sizeBytes,
              size_formatted: formatBytes(scanRes.sizeBytes)
            };
          }

          directoryList.push(dirInfo);
        } else if (lstat.isFile()) {
          looseFilesCount++;
          looseFilesBytes += lstat.size;
          totalFiles++;
          totalUsageBytes += lstat.size;
        }
      } catch (err) {
        warnings.push(`Error accessing ${entry.name}: ${err.message}`);
      }
    }

    if (looseFilesCount > 0) {
      directoryList.push({
        name: 'Files in Home Directory',
        path: '',
        is_loose_files: true,
        size_bytes: looseFilesBytes,
        size_formatted: formatBytes(looseFilesBytes),
        file_count: looseFilesCount,
        directory_count: 0,
        has_children: false,
        children_count: 0
      });
    }

    for (const d of directoryList) {
      d.percentage = totalUsageBytes > 0 
        ? Number(((d.size_bytes / totalUsageBytes) * 100).toFixed(1))
        : 0;
    }

    directoryList.sort((a, b) => b.size_bytes - a.size_bytes);

    const quotaConfig = this.getAccountQuota(username);
    let quotaBytes = null;
    let quotaFormatted = 'Unlimited';
    let remainingBytes = null;
    let remainingFormatted = 'Unlimited';
    let usagePercentage = null;
    let isOverQuota = false;
    let isZeroQuota = false;

    if (!quotaConfig.unlimited) {
      if (quotaConfig.limitMb === 0) {
        quotaBytes = 0;
        quotaFormatted = '0 B';
        remainingBytes = 0;
        remainingFormatted = '0 B';
        usagePercentage = 0;
        isZeroQuota = true;
        isOverQuota = totalUsageBytes > 0;
      } else {
        quotaBytes = Math.round(quotaConfig.limitMb * 1024 * 1024);
        quotaFormatted = formatBytes(quotaBytes);
        remainingBytes = Math.max(0, quotaBytes - totalUsageBytes);
        remainingFormatted = formatBytes(remainingBytes);
        usagePercentage = Number(((totalUsageBytes / quotaBytes) * 100).toFixed(2));
        isOverQuota = totalUsageBytes > quotaBytes;
      }
    }

    const scanDuration = Date.now() - startTime;

    return {
      success: true,
      username,
      usage_bytes: totalUsageBytes,
      usage_formatted: formatBytes(totalUsageBytes),
      quota_bytes: quotaBytes,
      quota_formatted: quotaFormatted,
      remaining_bytes: remainingBytes,
      remaining_formatted: remainingFormatted,
      percentage: usagePercentage,
      unlimited: quotaConfig.unlimited,
      is_over_quota: isOverQuota,
      is_zero_quota: isZeroQuota,
      stats: {
        total_files: totalFiles,
        total_directories: totalDirectories,
        largest_directory: largestDir.size_bytes > 0 ? largestDir : null,
        scan_time_ms: scanDuration
      },
      last_updated: new Date().toISOString(),
      cached: false,
      partial: warnings.length > 0,
      warnings,
      directories: directoryList
    };
  }

  /**
   * Get user disk usage summary with caching and concurrency deduplication
   */
  async getUserDiskUsageSummary(username = 'cpanel_user', forceRefresh = false) {
    if (!forceRefresh && this.cache.has(username)) {
      const cachedEntry = this.cache.get(username);
      if (Date.now() < cachedEntry.expiresAt) {
        return {
          ...cachedEntry.data,
          cached: true
        };
      }
    }

    if (this.inFlightScans.has(username)) {
      return await this.inFlightScans.get(username);
    }

    const scanPromise = (async () => {
      try {
        const result = await this._performDiskScan(username);
        this.cache.set(username, {
          data: result,
          timestamp: result.last_updated,
          expiresAt: Date.now() + this.CACHE_TTL_MS
        });
        return result;
      } finally {
        this.inFlightScans.delete(username);
      }
    })();

    this.inFlightScans.set(username, scanPromise);
    return await scanPromise;
  }

  invalidateUserCache(username = 'cpanel_user') {
    this.cache.delete(username);
  }

  getDirectoryChildren(relPath = '', username = 'cpanel_user') {
    if (!relPath) {
      throw new Error('Relative directory path is required');
    }

    const rootDir = storageService.getRootDir(username);
    const targetDir = storageService.resolveSafePath(relPath, username);

    if (!fs.existsSync(targetDir)) {
      throw new Error('Directory not found');
    }

    const stat = fs.statSync(targetDir);
    if (!stat.isDirectory()) {
      throw new Error('Specified path is not a directory');
    }

    let totalAccountUsage = 0;
    if (this.cache.has(username)) {
      totalAccountUsage = this.cache.get(username).data.usage_bytes || 0;
    }

    const warnings = [];
    const visitedRealPaths = new Set();
    visitedRealPaths.add(path.resolve(rootDir));

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const children = [];

    for (const e of entries) {
      if (e.isDirectory()) {
        const childFullPath = path.join(targetDir, e.name);
        const childRelPath = `${relPath.replace(/\/+$/, '')}/${e.name}`;
        const scanRes = this._scanDirectoryRecursive(childFullPath, rootDir, visitedRealPaths, warnings);

        children.push({
          name: e.name,
          path: childRelPath,
          size_bytes: scanRes.sizeBytes,
          size_formatted: formatBytes(scanRes.sizeBytes),
          percentage: totalAccountUsage > 0
            ? Number(((scanRes.sizeBytes / totalAccountUsage) * 100).toFixed(1))
            : 0,
          file_count: scanRes.fileCount,
          directory_count: scanRes.dirCount,
          has_children: scanRes.subDirs.length > 0,
          children_count: scanRes.subDirs.length
        });
      }
    }

    children.sort((a, b) => b.size_bytes - a.size_bytes);

    return {
      success: true,
      path: relPath,
      children,
      warnings
    };
  }
}

module.exports = new DiskUsageService();
