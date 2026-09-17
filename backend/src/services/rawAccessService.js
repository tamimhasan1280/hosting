/**
 * rawAccessService.js
 * Authoritative Raw Access Logs Service for cPanel Jupiter
 * Feature #28: Metrics -> Raw Access
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const storageService = require('./storageService');
const domainService = require('./domainService');

function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class RawAccessService {
  /**
   * Format byte count into human-readable string
   */
  formatBytes(bytes) {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 Bytes';
    const b = Math.max(0, parseInt(bytes, 10));
    if (b === 0) return '0 Bytes';
    if (b < 1024) return `${b} Bytes`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(2)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  /**
   * Get user logs directory
   */
  getLogsDir(username = 'cpanel_user') {
    const root = typeof storageService.getUserRootDir === 'function'
      ? storageService.getUserRootDir(username)
      : storageService.getRootDir(username);
    const logsDir = path.join(root, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    return logsDir;
  }

  /**
   * Get user raw logs archive directory
   */
  getArchiveDir(username = 'cpanel_user') {
    const logsDir = this.getLogsDir(username);
    const archiveDir = path.join(logsDir, 'archive');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    return archiveDir;
  }

  /**
   * Get user Raw Access configuration
   */
  getConfig(username = 'cpanel_user') {
    const logsDir = this.getLogsDir(username);
    const configFile = path.join(logsDir, '.raw_access_config.json');
    const defaults = {
      archiveLogs: true,
      discardPreviousMonth: false
    };

    if (fs.existsSync(configFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        return { ...defaults, ...parsed };
      } catch (e) {}
    }

    return defaults;
  }

  /**
   * Update user Raw Access configuration
   */
  updateConfig(username = 'cpanel_user', updates = {}) {
    const logsDir = this.getLogsDir(username);
    const configFile = path.join(logsDir, '.raw_access_config.json');
    const current = this.getConfig(username);
    const updated = {
      ...current,
      archiveLogs: Boolean(updates.archiveLogs !== undefined ? updates.archiveLogs : current.archiveLogs),
      discardPreviousMonth: Boolean(updates.discardPreviousMonth !== undefined ? updates.discardPreviousMonth : current.discardPreviousMonth)
    };

    fs.writeFileSync(configFile, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  }

  /**
   * Get authorized domains list for user
   */
  getAuthorizedDomains(username = 'cpanel_user') {
    const data = domainService._read(username);
    const domainsList = [];

    const addDomain = (domainName, type) => {
      const clean = (domainName || '').toLowerCase().replace(/\.+$/, '').trim();
      if (!clean || domainsList.some(d => d.name === clean)) return;
      domainsList.push({ name: clean, type });
    };

    if (data.primaryDomain) {
      addDomain(data.primaryDomain, 'Primary Domain');
    } else {
      addDomain('example.com', 'Primary Domain');
    }

    (data.domains || []).forEach(d => addDomain(d.name, d.type || 'Addon Domain'));
    (data.subdomains || []).forEach(s => addDomain(s.name, 'Subdomain'));
    (data.aliases || []).forEach(a => addDomain(a.name, 'Alias'));

    return domainsList;
  }

  /**
   * Verify domain belongs to user
   */
  verifyDomainAuthorized(domain, username = 'cpanel_user') {
    if (!domain || domain === 'ALL' || domain === 'all') return true;
    const clean = domain.toLowerCase().replace(/\.+$/, '').trim();
    const authorized = this.getAuthorizedDomains(username);
    const match = authorized.find(d => d.name === clean);
    if (!match) {
      throw new Error(`Access denied: domain "${domain}" is not registered to your account.`);
    }
    return true;
  }

  /**
   * Resolve server-managed logId to safe physical file path
   */
  resolveLogPath(logId, username = 'cpanel_user') {
    if (!logId || typeof logId !== 'string') {
      throw new Error('Invalid log identifier');
    }

    // Reject null bytes or traversal sequences
    if (logId.includes('\0') || logId.includes('..')) {
      throw new Error('Access denied: invalid path sequence');
    }

    const logsDir = this.getLogsDir(username);
    const archiveDir = this.getArchiveDir(username);
    let resolvedPath = null;
    let domainName = null;

    if (logId.startsWith('domain:')) {
      const rawDomain = decodeURIComponent(logId.substring(7)).toLowerCase().trim();
      this.verifyDomainAuthorized(rawDomain, username);
      domainName = rawDomain;
      resolvedPath = path.join(logsDir, `${rawDomain}.log`);
    } else if (logId === 'master:access.log' || logId === 'master:access') {
      resolvedPath = path.join(logsDir, 'access.log');
      domainName = 'account-master';
    } else if (logId.startsWith('archive:')) {
      const rawFilename = path.basename(decodeURIComponent(logId.substring(8)));
      // Check if archive starts with a domain name
      const authDomains = this.getAuthorizedDomains(username);
      const matchDomain = authDomains.find(d => rawFilename.toLowerCase().startsWith(d.name));
      if (!matchDomain && !rawFilename.toLowerCase().startsWith('access')) {
        throw new Error('Access denied: archive does not belong to your authorized domains');
      }
      domainName = matchDomain ? matchDomain.name : 'archived';

      // Check in archiveDir first, then in logsDir
      const inArchive = path.join(archiveDir, rawFilename);
      if (fs.existsSync(inArchive)) {
        resolvedPath = inArchive;
      } else {
        resolvedPath = path.join(logsDir, rawFilename);
      }
    } else {
      throw new Error('Unrecognized log identifier format');
    }

    // Path canonical jail check
    const canonicalLogsDir = path.resolve(logsDir);
    const canonicalResolved = path.resolve(resolvedPath);

    if (!canonicalResolved.startsWith(canonicalLogsDir)) {
      throw new Error('Security check violation: path outside authorized logs root');
    }

    // Check symlink escape
    if (fs.existsSync(resolvedPath)) {
      const lstat = fs.lstatSync(resolvedPath);
      if (lstat.isSymbolicLink()) {
        throw new Error('Security check violation: symlinks are not permitted');
      }
      if (!lstat.isFile()) {
        throw new Error('Target is not a regular file');
      }
    }

    return {
      resolvedPath,
      domain: domainName,
      filename: path.basename(resolvedPath)
    };
  }

  /**
   * Get Raw Access inventory for user (Current logs, Archived logs, Configuration)
   */
  getInventory(username = 'cpanel_user') {
    const logsDir = this.getLogsDir(username);
    const archiveDir = this.getArchiveDir(username);
    const authorizedDomains = this.getAuthorizedDomains(username);
    const config = this.getConfig(username);

    const currentLogs = [];
    const archivedLogs = [];

    // 1. Current Domain Logs
    for (const d of authorizedDomains) {
      const filename = `${d.name}.log`;
      const filePath = path.join(logsDir, filename);
      let sizeBytes = 0;
      let lastModified = null;
      let exists = false;

      if (fs.existsSync(filePath)) {
        try {
          const st = fs.statSync(filePath);
          if (st.isFile()) {
            sizeBytes = st.size;
            lastModified = st.mtime.toISOString();
            exists = true;
          }
        } catch (e) {}
      }

      currentLogs.push({
        id: `domain:${encodeURIComponent(d.name)}`,
        domain: d.name,
        type: d.type,
        filename,
        sizeBytes,
        formattedSize: this.formatBytes(sizeBytes),
        lastModified,
        exists
      });
    }

    // 2. Account Master Access Log
    const masterPath = path.join(logsDir, 'access.log');
    let masterSize = 0;
    let masterModified = null;
    let masterExists = false;

    if (fs.existsSync(masterPath)) {
      try {
        const st = fs.statSync(masterPath);
        if (st.isFile()) {
          masterSize = st.size;
          masterModified = st.mtime.toISOString();
          masterExists = true;
        }
      } catch (e) {}
    }

    currentLogs.push({
      id: 'master:access.log',
      domain: 'Account Master Log (All Domains)',
      type: 'Account Master',
      filename: 'access.log',
      sizeBytes: masterSize,
      formattedSize: this.formatBytes(masterSize),
      lastModified: masterModified,
      exists: masterExists
    });

    // 3. Rotated & Archived Logs
    const checkArchiveCandidate = (dir, file) => {
      // Must not be current log or config
      if (file.endsWith('.log') && !file.includes('-') && !file.includes('.')) return;
      if (file.startsWith('.')) return;
      if (file === 'access.log' || file === 'error_log') return;
      if (file.endsWith('.error.log')) return;

      const p = path.join(dir, file);
      try {
        const st = fs.statSync(p);
        if (st.isFile()) {
          const isCompressed = file.endsWith('.gz') || file.endsWith('.zip');
          // Extract associated domain if available
          let matchedDomain = 'Account';
          for (const d of authorizedDomains) {
            if (file.toLowerCase().startsWith(d.name)) {
              matchedDomain = d.name;
              break;
            }
          }

          archivedLogs.push({
            id: `archive:${encodeURIComponent(file)}`,
            filename: file,
            domain: matchedDomain,
            sizeBytes: st.size,
            formattedSize: this.formatBytes(st.size),
            lastModified: st.mtime.toISOString(),
            compressed: isCompressed
          });
        }
      } catch (e) {}
    };

    // Scan archiveDir
    if (fs.existsSync(archiveDir)) {
      try {
        const files = fs.readdirSync(archiveDir);
        for (const f of files) checkArchiveCandidate(archiveDir, f);
      } catch (e) {}
    }

    // Scan rotated logs in logsDir (e.g. *.log.1, *.log.2)
    try {
      const files = fs.readdirSync(logsDir);
      for (const f of files) {
        if (f.match(/\.log\.\d+$/)) {
          checkArchiveCandidate(logsDir, f);
        }
      }
    } catch (e) {}

    return {
      success: true,
      currentLogs,
      archivedLogs,
      config
    };
  }

  /**
   * Get safe download stream and response headers for logId
   */
  getDownloadStream(logId, username = 'cpanel_user') {
    const { resolvedPath, domain, filename } = this.resolveLogPath(logId, username);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Log file "${filename}" was not found or has been rotated.`);
    }

    const st = fs.statSync(resolvedPath);
    if (!st.isFile()) {
      throw new Error('Target is not a regular file');
    }

    // Safe download filename
    const todayStr = new Date().toISOString().slice(0, 10);
    let safeFilename = filename;

    if (logId.startsWith('domain:')) {
      safeFilename = `${domain}-access-${todayStr}.log`;
    } else if (logId.startsWith('master:')) {
      safeFilename = `account-access-${todayStr}.log`;
    }

    // Sanitize filename against CRLF and quotes
    safeFilename = safeFilename.replace(/[^\w\.\-]/g, '_');

    const isGzip = filename.endsWith('.gz');
    const mimeType = isGzip ? 'application/gzip' : 'text/plain; charset=utf-8';

    const stream = fs.createReadStream(resolvedPath);

    return {
      stream,
      filename: safeFilename,
      sizeBytes: st.size,
      mimeType
    };
  }

  /**
   * Bounded inline preview of the latest lines (tail) with HTML escaping
   */
  async getLogPreview(logId, maxLines = 100, username = 'cpanel_user') {
    const { resolvedPath, domain, filename } = this.resolveLogPath(logId, username);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Log file "${filename}" was not found.`);
    }

    const st = fs.statSync(resolvedPath);
    if (st.size === 0) {
      return {
        success: true,
        logId,
        filename,
        domain,
        sizeBytes: 0,
        formattedSize: '0 Bytes',
        totalLines: 0,
        lines: [],
        rawPreview: ''
      };
    }

    // Stream lines into circular buffer of maxLines
    const lineBuffer = [];
    let totalLinesCount = 0;

    const fileStream = fs.createReadStream(resolvedPath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      totalLinesCount++;
      if (lineBuffer.length >= maxLines) {
        lineBuffer.shift();
      }
      lineBuffer.push(line);
    }

    // HTML escape each line to prevent stored XSS attacks
    const escapedLines = lineBuffer.map(l => escapeHtml(l));

    return {
      success: true,
      logId,
      filename,
      domain,
      sizeBytes: st.size,
      formattedSize: this.formatBytes(st.size),
      totalLines: totalLinesCount,
      lines: escapedLines,
      rawPreview: lineBuffer.join('\n')
    };
  }

  // Aliases for compatibility
  getLogInventory(username) {
    return this.getInventory(username);
  }

  tailLogFile(logId, username, limit = 100) {
    return this.getLogPreview(logId, limit, username);
  }
}

module.exports = new RawAccessService();
