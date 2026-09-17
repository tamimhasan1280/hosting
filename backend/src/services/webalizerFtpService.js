/**
 * webalizerFtpService.js
 * Authoritative Webalizer FTP Analytics Service for cPanel Jupiter
 * Feature #32: Metrics -> Webalizer FTP
 *
 * Implements real FTP server traffic analytics from authentic FTP server transfer
 * logs (xferlog RFC 959 format) and authentication logs, with multi-tenant account
 * isolation, capability detection, Webalizer-style general summaries, daily/hourly
 * distributions, top uploaded/downloaded files, client hosts with IP privacy masking,
 * and authentic Webalizer 2.23 HTML / ASCII report export.
 */

const fs = require('fs');
const path = require('path');
const storageService = require('./storageService');
const ftpService = require('./ftpService');
const ftpServerService = require('./ftpServerService');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_MAP = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatBytes(bytes) {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 Bytes';
  const b = Math.max(0, parseInt(bytes, 10));
  if (b === 0) return '0 Bytes';
  if (b < 1024) return `${b} Bytes`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(2)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  if (b < 1024 * 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  return `${(b / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
}

function maskIp(ip) {
  if (!ip) return 'unknown';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 3).join(':') + ':xxxx:xxxx';
  }
  return ip;
}

class WebalizerFtpService {
  constructor() {
    this.cache = new Map();
    this.cacheTtlMs = 15000; // 15s cache
  }

  /**
   * Detect real Webalizer FTP capability and daemon environment
   */
  detectCapabilities() {
    let webalizerInstalled = false;
    let webalizerVersion = null;
    let geoIpInstalled = false;

    // Check system PATH and known binaries
    const checkPaths = [
      '/usr/bin/webalizer',
      '/usr/local/bin/webalizer',
      '/opt/cpanel/webalizer/bin/webalizer',
      'C:\\Program Files\\Webalizer\\webalizer.exe',
      'C:\\webalizer\\webalizer.exe'
    ];

    for (const cp of checkPaths) {
      if (fs.existsSync(cp)) {
        webalizerInstalled = true;
        break;
      }
    }

    const ftpDaemonStatus = ftpServerService.getStatus();

    return {
      webalizerInstalled,
      webalizerVersion,
      engine: webalizerInstalled ? 'native_webalizer' : 'embedded_access_log',
      engineName: webalizerInstalled
        ? 'Native Webalizer FTP Server Engine'
        : 'cPanel Embedded Webalizer FTP Engine (RFC 959 / xferlog Compatible)',
      geoIpInstalled,
      geoIpMessage: 'GeoIP database is not installed or configured on the server. Country statistics are unavailable.',
      logFormat: 'Standard xferlog (RFC 959 FTP Transfer Log)',
      daemonAvailable: ftpDaemonStatus.available,
      daemonName: ftpDaemonStatus.daemon || 'cPanel Built-in RFC 959 FTP Daemon',
      daemonPort: ftpDaemonStatus.port || 21,
      daemonStatus: ftpDaemonStatus.status || 'running'
    };
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
      try {
        fs.mkdirSync(logsDir, { recursive: true });
      } catch (e) {}
    }
    return logsDir;
  }

  /**
   * Get path to user's FTP xferlog
   */
  getXferlogPath(username = 'cpanel_user') {
    const logsDir = this.getLogsDir(username);
    return path.join(logsDir, 'ftp_xferlog');
  }

  /**
   * Get path to user's FTP authentication log
   */
  getAuthLogPath(username = 'cpanel_user') {
    const logsDir = this.getLogsDir(username);
    return path.join(logsDir, 'ftp_auth.log');
  }

  /**
   * Log an authentic FTP transfer event (xferlog standard RFC 959 format)
   * Format:
   * current-time transfer-time remote-host file-size filename transfer-type special-action-flag direction access-mode username service-name authentication-method authenticated-user-id completion-status
   * Example:
   * Thu Sep 17 03:20:00 2026 1 127.0.0.1 2048 /public_html/file.zip b _ i r cpanel_user@example.com ftp 0 * c
   */
  logTransfer({
    cpanelUser = 'cpanel_user',
    username = 'cpanel_user@example.com',
    remoteHost = '127.0.0.1',
    bytes = 0,
    filename = '/',
    direction = 'o', // 'i' for incoming/upload, 'o' for outgoing/download
    transferType = 'b', // 'a' (ascii) or 'b' (binary)
    transferTime = 0,
    completionStatus = 'c', // 'c' complete, 'i' incomplete
    timestamp = new Date()
  }) {
    try {
      const logFile = this.getXferlogPath(cpanelUser);
      const dateObj = timestamp instanceof Date ? timestamp : new Date(timestamp);
      
      const dayName = DAY_NAMES[dateObj.getDay()];
      const monthName = MONTH_NAMES[dateObj.getMonth()];
      const dayNum = String(dateObj.getDate()).padStart(2, ' ');
      const timeStr = dateObj.toTimeString().split(' ')[0];
      const year = dateObj.getFullYear();
      const timeField = `${dayName} ${monthName} ${dayNum} ${timeStr} ${year}`;

      const cleanHost = (remoteHost || '127.0.0.1').replace(/::ffff:/, '');
      const cleanFile = (filename || '/').replace(/\\/g, '/');
      const cleanType = (transferType || 'b').toLowerCase() === 'a' ? 'a' : 'b';
      const cleanDir = (direction || 'o').toLowerCase() === 'i' ? 'i' : 'o';
      const cleanStatus = (completionStatus || 'c').toLowerCase() === 'i' ? 'i' : 'c';
      const cleanUser = (username || cpanelUser).trim();

      const line = `${timeField} ${Math.max(0, parseInt(transferTime, 10) || 0)} ${cleanHost} ${Math.max(0, parseInt(bytes, 10) || 0)} ${cleanFile} ${cleanType} _ ${cleanDir} r ${cleanUser} ftp 0 * ${cleanStatus}\n`;

      fs.appendFileSync(logFile, line, 'utf8');
      this.clearCache(cpanelUser);
      return true;
    } catch (e) {
      console.error('[WebalizerFTP] Error logging transfer:', e.message);
      return false;
    }
  }

  /**
   * Log an authentic FTP authentication event (success or failure)
   */
  logAuth({
    cpanelUser = 'cpanel_user',
    username = 'cpanel_user@example.com',
    remoteHost = '127.0.0.1',
    success = true,
    message = '',
    timestamp = new Date()
  }) {
    try {
      const authFile = this.getAuthLogPath(cpanelUser);
      const dateObj = timestamp instanceof Date ? timestamp : new Date(timestamp);
      const iso = dateObj.toISOString();
      const cleanHost = (remoteHost || '127.0.0.1').replace(/::ffff:/, '');
      const statusStr = success ? 'SUCCESS' : 'FAILURE';
      const entry = `${iso} [${statusStr}] user=${username} ip=${cleanHost} msg=${message || '-'}\n`;

      fs.appendFileSync(authFile, entry, 'utf8');
      this.clearCache(cpanelUser);
      return true;
    } catch (e) {
      console.error('[WebalizerFTP] Error logging auth event:', e.message);
      return false;
    }
  }

  /**
   * Parse xferlog line
   */
  parseXferlogLine(line) {
    if (!line || !line.trim()) return null;
    const trimmed = line.trim();

    const tokens = trimmed.split(/\s+/);
    if (tokens.length < 14) return null;

    const dayName = tokens[0];
    const monthName = tokens[1];
    const dayOfMonth = parseInt(tokens[2], 10);
    const timeParts = tokens[3].split(':');
    const year = parseInt(tokens[4], 10);

    const monthIndex = MONTH_MAP[monthName];
    if (monthIndex === undefined || isNaN(dayOfMonth) || isNaN(year) || timeParts.length < 3) {
      return null;
    }

    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    const second = parseInt(timeParts[2], 10);

    const dateObj = new Date(Date.UTC(year, monthIndex, dayOfMonth, hour, minute, second));
    if (isNaN(dateObj.getTime())) return null;

    const transferTime = parseInt(tokens[5], 10) || 0;
    const remoteHost = tokens[6] || '127.0.0.1';
    const bytes = parseInt(tokens[7], 10) || 0;
    const filename = tokens[8] || '/';
    const transferType = tokens[9] || 'b';
    const specialFlag = tokens[10] || '_';
    const direction = tokens[11] || 'o'; // 'i' = upload, 'o' = download
    const accessMode = tokens[12] || 'r';
    const username = tokens[13] || '';
    const serviceName = tokens[14] || 'ftp';
    const authMethod = tokens[15] || '0';
    const authUserId = tokens[16] || '*';
    const completionStatus = tokens[17] || 'c'; // 'c' = complete, 'i' = incomplete

    const pad = (n) => String(n).padStart(2, '0');
    const dateKey = `${year}-${pad(monthIndex + 1)}-${pad(dayOfMonth)}`;
    const monthKey = `${year}-${pad(monthIndex + 1)}`;

    return {
      timestamp: dateObj,
      dateKey,
      monthKey,
      hour,
      transferTime,
      remoteHost,
      bytes,
      filename,
      transferType,
      specialFlag,
      direction,
      accessMode,
      username,
      serviceName,
      authMethod,
      authUserId,
      completionStatus,
      raw: trimmed
    };
  }

  /**
   * Parse auth log line
   */
  parseAuthLine(line) {
    if (!line || !line.trim()) return null;
    const match = line.trim().match(/^(\S+)\s+\[(SUCCESS|FAILURE)\]\s+user=([^\s]+)\s+ip=([^\s]+)(?:\s+msg=(.*))?$/);
    if (!match) return null;

    const timestamp = new Date(match[1]);
    if (isNaN(timestamp.getTime())) return null;

    return {
      timestamp,
      success: match[2] === 'SUCCESS',
      username: match[3],
      ip: match[4],
      message: match[5] || ''
    };
  }

  /**
   * Get authorized FTP accounts for user
   */
  getAuthorizedAccounts(username = 'cpanel_user') {
    const rawAccounts = ftpService.listAccounts(username);
    const xferlogFile = this.getXferlogPath(username);

    let hasLogData = fs.existsSync(xferlogFile);
    let logSizeBytes = 0;
    let lastModified = null;

    if (hasLogData) {
      try {
        const stat = fs.statSync(xferlogFile);
        logSizeBytes = stat.size;
        lastModified = stat.mtime.toISOString();
      } catch (e) {}
    }

    const accounts = rawAccounts.map(a => ({
      id: a.id,
      username: a.username,
      userPart: a.userPart,
      domain: a.domain,
      directory: a.directory,
      quota: a.quota,
      usageBytes: a.usageBytes,
      usageFormatted: a.usageFormatted,
      status: a.status,
      isMain: a.isMain
    }));

    return {
      accounts,
      hasLogData,
      logSizeBytes,
      logSizeFormatted: formatBytes(logSizeBytes),
      lastModified,
      totalAccounts: accounts.length
    };
  }

  /**
   * Get available periods for user and account
   */
  getAvailablePeriods({ user = 'cpanel_user', account = 'all' }) {
    const logFile = this.getXferlogPath(user);
    if (!fs.existsSync(logFile)) {
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return [
        { key: 'all', label: 'All Recorded Transfers', count: 0, bytes: 0, isCurrent: false },
        { key: currentMonthKey, label: `${MONTH_FULL[now.getMonth()]} ${now.getFullYear()} (Current)`, count: 0, bytes: 0, isCurrent: true }
      ];
    }

    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    const periodMap = new Map();
    let totalTransfers = 0;
    let totalBytes = 0;

    for (const line of lines) {
      const parsed = this.parseXferlogLine(line);
      if (!parsed) continue;

      if (account && account !== 'all') {
        const targetClean = account.toLowerCase().trim();
        const lineUser = parsed.username.toLowerCase().trim();
        if (lineUser !== targetClean && !lineUser.startsWith(targetClean + '@')) {
          continue;
        }
      }

      totalTransfers++;
      totalBytes += parsed.bytes;

      if (!periodMap.has(parsed.monthKey)) {
        const parts = parsed.monthKey.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        periodMap.set(parsed.monthKey, {
          key: parsed.monthKey,
          label: `${MONTH_FULL[m]} ${y}`,
          year: y,
          month: m,
          count: 0,
          bytes: 0
        });
      }

      const p = periodMap.get(parsed.monthKey);
      p.count++;
      p.bytes += parsed.bytes;
    }

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (!periodMap.has(currentMonthKey)) {
      periodMap.set(currentMonthKey, {
        key: currentMonthKey,
        label: `${MONTH_FULL[now.getMonth()]} ${now.getFullYear()} (Current)`,
        year: now.getFullYear(),
        month: now.getMonth(),
        count: 0,
        bytes: 0
      });
    }

    const sortedPeriods = Array.from(periodMap.values()).sort((a, b) => b.key.localeCompare(a.key));

    const result = [
      {
        key: 'all',
        label: 'All Recorded Transfers',
        count: totalTransfers,
        bytes: totalBytes,
        formattedBytes: formatBytes(totalBytes),
        isCurrent: false
      },
      ...sortedPeriods.map(p => ({
        ...p,
        formattedBytes: formatBytes(p.bytes),
        isCurrent: p.key === currentMonthKey
      }))
    ];

    return result;
  }

  /**
   * Generate comprehensive Webalizer FTP Report
   */
  getReport({
    user = 'cpanel_user',
    account = 'all',
    period = 'all',
    anonymize = false,
    limit = 50
  }) {
    const cacheKey = `${user}:${account}:${period}:${anonymize}:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.cacheTtlMs)) {
      return cached.data;
    }

    const capabilities = this.detectCapabilities();
    const accountsData = this.getAuthorizedAccounts(user);
    const logFile = this.getXferlogPath(user);
    const authFile = this.getAuthLogPath(user);

    const availablePeriods = this.getAvailablePeriods({ user, account });

    if (!fs.existsSync(logFile)) {
      const emptyReport = {
        capabilities,
        user,
        account,
        period,
        anonymize,
        hasData: false,
        summary: {
          totalTransfers: 0,
          totalUploads: 0,
          uploadBytes: 0,
          totalDownloads: 0,
          downloadBytes: 0,
          totalBytes: 0,
          formattedTotalBytes: '0 Bytes',
          formattedUploadBytes: '0 Bytes',
          formattedDownloadBytes: '0 Bytes',
          totalSessions: 0,
          successfulLogins: 0,
          failedLogins: 0,
          avgTransferBytes: 0,
          formattedAvgTransferBytes: '0 Bytes',
          completionRate: 100,
          activeUsers: 0,
          uniqueClients: 0
        },
        daily: [],
        hourly: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          hourLabel: `${String(i).padStart(2, '0')}:00`,
          uploads: 0,
          downloads: 0,
          totalTransfers: 0,
          uploadBytes: 0,
          downloadBytes: 0,
          totalBytes: 0,
          formattedBytes: '0 Bytes'
        })),
        topUploadedFiles: [],
        topDownloadedFiles: [],
        topUsers: [],
        clientHosts: [],
        transferTypes: { binary: { count: 0, bytes: 0 }, ascii: { count: 0, bytes: 0 } },
        transferStatus: { complete: 0, incomplete: 0, successRate: 100 },
        recentTransfers: [],
        recentAuthEvents: [],
        availablePeriods,
        accounts: accountsData.accounts,
        generatedAt: new Date().toISOString()
      };
      return emptyReport;
    }

    const logContent = fs.readFileSync(logFile, 'utf8');
    const rawLines = logContent.split('\n');

    let totalTransfers = 0;
    let totalUploads = 0;
    let uploadBytes = 0;
    let totalDownloads = 0;
    let downloadBytes = 0;
    let totalBytes = 0;
    let completeTransfers = 0;
    let incompleteTransfers = 0;

    let binaryCount = 0;
    let binaryBytes = 0;
    let asciiCount = 0;
    let asciiBytes = 0;

    const dailyMap = new Map();
    const hourlyMap = new Map();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, {
        hour: h,
        hourLabel: `${String(h).padStart(2, '0')}:00`,
        uploads: 0,
        downloads: 0,
        totalTransfers: 0,
        uploadBytes: 0,
        downloadBytes: 0,
        totalBytes: 0
      });
    }

    const uploadFilesMap = new Map();
    const downloadFilesMap = new Map();
    const usersMap = new Map();
    const clientMap = new Map();
    const parsedRecords = [];

    const targetAccountClean = (account && account !== 'all') ? account.toLowerCase().trim() : null;

    for (const line of rawLines) {
      const record = this.parseXferlogLine(line);
      if (!record) continue;

      if (targetAccountClean) {
        const lineUser = record.username.toLowerCase().trim();
        if (lineUser !== targetAccountClean && !lineUser.startsWith(targetAccountClean + '@')) {
          continue;
        }
      }

      if (period && period !== 'all') {
        if (record.monthKey !== period) {
          continue;
        }
      }

      parsedRecords.push(record);
      totalTransfers++;
      totalBytes += record.bytes;

      const isUpload = record.direction === 'i';
      const isComplete = record.completionStatus === 'c';

      if (isComplete) completeTransfers++;
      else incompleteTransfers++;

      if (record.transferType === 'a') {
        asciiCount++;
        asciiBytes += record.bytes;
      } else {
        binaryCount++;
        binaryBytes += record.bytes;
      }

      if (isUpload) {
        totalUploads++;
        uploadBytes += record.bytes;
        const fn = record.filename;
        if (!uploadFilesMap.has(fn)) {
          uploadFilesMap.set(fn, { filename: fn, count: 0, bytes: 0 });
        }
        const uf = uploadFilesMap.get(fn);
        uf.count++;
        uf.bytes += record.bytes;
      } else {
        totalDownloads++;
        downloadBytes += record.bytes;
        const fn = record.filename;
        if (!downloadFilesMap.has(fn)) {
          downloadFilesMap.set(fn, { filename: fn, count: 0, bytes: 0 });
        }
        const df = downloadFilesMap.get(fn);
        df.count++;
        df.bytes += record.bytes;
      }

      if (!dailyMap.has(record.dateKey)) {
        const dObj = record.timestamp;
        const dayLabel = `${DAY_NAMES[dObj.getDay()]} ${dObj.getDate()} ${MONTH_NAMES[dObj.getMonth()]} ${dObj.getFullYear()}`;
        dailyMap.set(record.dateKey, {
          date: record.dateKey,
          dateLabel: dayLabel,
          dayOfWeek: DAY_NAMES[dObj.getDay()],
          uploads: 0,
          downloads: 0,
          totalTransfers: 0,
          uploadBytes: 0,
          downloadBytes: 0,
          totalBytes: 0
        });
      }
      const dayEntry = dailyMap.get(record.dateKey);
      dayEntry.totalTransfers++;
      dayEntry.totalBytes += record.bytes;
      if (isUpload) {
        dayEntry.uploads++;
        dayEntry.uploadBytes += record.bytes;
      } else {
        dayEntry.downloads++;
        dayEntry.downloadBytes += record.bytes;
      }

      const hourEntry = hourlyMap.get(record.hour);
      if (hourEntry) {
        hourEntry.totalTransfers++;
        hourEntry.totalBytes += record.bytes;
        if (isUpload) {
          hourEntry.uploads++;
          hourEntry.uploadBytes += record.bytes;
        } else {
          hourEntry.downloads++;
          hourEntry.downloadBytes += record.bytes;
        }
      }

      const u = record.username || 'unknown';
      if (!usersMap.has(u)) {
        usersMap.set(u, {
          username: u,
          uploads: 0,
          downloads: 0,
          totalTransfers: 0,
          uploadBytes: 0,
          downloadBytes: 0,
          totalBytes: 0
        });
      }
      const userEntry = usersMap.get(u);
      userEntry.totalTransfers++;
      userEntry.totalBytes += record.bytes;
      if (isUpload) {
        userEntry.uploads++;
        userEntry.uploadBytes += record.bytes;
      } else {
        userEntry.downloads++;
        userEntry.downloadBytes += record.bytes;
      }

      const ip = record.remoteHost;
      if (!clientMap.has(ip)) {
        clientMap.set(ip, {
          host: ip,
          count: 0,
          bytes: 0,
          lastAccess: record.timestamp.toISOString()
        });
      }
      const clientEntry = clientMap.get(ip);
      clientEntry.count++;
      clientEntry.bytes += record.bytes;
      if (record.timestamp.toISOString() > clientEntry.lastAccess) {
        clientEntry.lastAccess = record.timestamp.toISOString();
      }
    }

    let successfulLogins = 0;
    let failedLogins = 0;
    const recentAuthEvents = [];

    if (fs.existsSync(authFile)) {
      try {
        const authLines = fs.readFileSync(authFile, 'utf8').split('\n');
        for (const line of authLines) {
          const auth = this.parseAuthLine(line);
          if (!auth) continue;

          if (targetAccountClean) {
            const lineUser = auth.username.toLowerCase().trim();
            if (lineUser !== targetAccountClean && !lineUser.startsWith(targetAccountClean + '@')) {
              continue;
            }
          }

          if (period && period !== 'all') {
            const pad = (n) => String(n).padStart(2, '0');
            const mKey = `${auth.timestamp.getFullYear()}-${pad(auth.timestamp.getMonth() + 1)}`;
            if (mKey !== period) continue;
          }

          if (auth.success) {
            successfulLogins++;
          } else {
            failedLogins++;
          }

          recentAuthEvents.unshift({
            timestamp: auth.timestamp.toISOString(),
            success: auth.success,
            username: auth.username,
            ip: anonymize ? maskIp(auth.ip) : auth.ip,
            message: auth.message
          });
        }
      } catch (e) {}
    }

    const totalSessions = Math.max(successfulLogins, usersMap.size);

    const daily = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date)).map(d => ({
      ...d,
      formattedUploadBytes: formatBytes(d.uploadBytes),
      formattedDownloadBytes: formatBytes(d.downloadBytes),
      formattedTotalBytes: formatBytes(d.totalBytes)
    }));

    const hourly = Array.from(hourlyMap.values()).map(h => ({
      ...h,
      formattedUploadBytes: formatBytes(h.uploadBytes),
      formattedDownloadBytes: formatBytes(h.downloadBytes),
      formattedTotalBytes: formatBytes(h.totalBytes),
      percentage: totalBytes > 0 ? parseFloat(((h.totalBytes / totalBytes) * 100).toFixed(2)) : 0
    }));

    const topUploadedFiles = Array.from(uploadFilesMap.values())
      .sort((a, b) => b.bytes - a.bytes || b.count - a.count)
      .slice(0, limit)
      .map(f => ({
        ...f,
        formattedBytes: formatBytes(f.bytes),
        percentage: uploadBytes > 0 ? parseFloat(((f.bytes / uploadBytes) * 100).toFixed(2)) : 0
      }));

    const topDownloadedFiles = Array.from(downloadFilesMap.values())
      .sort((a, b) => b.bytes - a.bytes || b.count - a.count)
      .slice(0, limit)
      .map(f => ({
        ...f,
        formattedBytes: formatBytes(f.bytes),
        percentage: downloadBytes > 0 ? parseFloat(((f.bytes / downloadBytes) * 100).toFixed(2)) : 0
      }));

    const topUsers = Array.from(usersMap.values())
      .sort((a, b) => b.totalBytes - a.totalBytes)
      .map(u => ({
        ...u,
        formattedUploadBytes: formatBytes(u.uploadBytes),
        formattedDownloadBytes: formatBytes(u.downloadBytes),
        formattedTotalBytes: formatBytes(u.totalBytes),
        percentage: totalBytes > 0 ? parseFloat(((u.totalBytes / totalBytes) * 100).toFixed(2)) : 0
      }));

    const clientHosts = Array.from(clientMap.values())
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, limit)
      .map(c => ({
        ...c,
        displayHost: anonymize ? maskIp(c.host) : c.host,
        formattedBytes: formatBytes(c.bytes),
        percentage: totalBytes > 0 ? parseFloat(((c.bytes / totalBytes) * 100).toFixed(2)) : 0
      }));

    const recentTransfers = parsedRecords
      .slice(-limit)
      .reverse()
      .map(r => ({
        timestamp: r.timestamp.toISOString(),
        remoteHost: anonymize ? maskIp(r.remoteHost) : r.remoteHost,
        filename: r.filename,
        bytes: r.bytes,
        formattedBytes: formatBytes(r.bytes),
        direction: r.direction,
        transferType: r.transferType,
        username: r.username,
        completionStatus: r.completionStatus
      }));

    const avgTransferBytes = totalTransfers > 0 ? Math.round(totalBytes / totalTransfers) : 0;
    const completionRate = totalTransfers > 0 ? parseFloat(((completeTransfers / totalTransfers) * 100).toFixed(1)) : 100;

    const report = {
      capabilities,
      user,
      account,
      period,
      anonymize,
      hasData: totalTransfers > 0,
      summary: {
        totalTransfers,
        totalUploads,
        uploadBytes,
        formattedUploadBytes: formatBytes(uploadBytes),
        totalDownloads,
        downloadBytes,
        formattedDownloadBytes: formatBytes(downloadBytes),
        totalBytes,
        formattedTotalBytes: formatBytes(totalBytes),
        totalSessions,
        successfulLogins,
        failedLogins,
        avgTransferBytes,
        formattedAvgTransferBytes: formatBytes(avgTransferBytes),
        completionRate,
        activeUsers: usersMap.size,
        uniqueClients: clientMap.size
      },
      daily,
      hourly,
      topUploadedFiles,
      topDownloadedFiles,
      topUsers,
      clientHosts,
      transferTypes: {
        binary: { count: binaryCount, bytes: binaryBytes, formattedBytes: formatBytes(binaryBytes) },
        ascii: { count: asciiCount, bytes: asciiBytes, formattedBytes: formatBytes(asciiBytes) }
      },
      transferStatus: {
        complete: completeTransfers,
        incomplete: incompleteTransfers,
        successRate: completionRate
      },
      recentTransfers,
      recentAuthEvents: recentAuthEvents.slice(0, 50),
      availablePeriods,
      accounts: accountsData.accounts,
      generatedAt: new Date().toISOString()
    };

    this.cache.set(cacheKey, { timestamp: Date.now(), data: report });
    return report;
  }

  /**
   * Clear cache for user
   */
  clearCache(username = null) {
    if (!username) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${username}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Export Webalizer FTP Report as HTML or Text
   */
  exportReport({
    user = 'cpanel_user',
    account = 'all',
    period = 'all',
    anonymize = false,
    format = 'html'
  }) {
    const report = this.getReport({ user, account, period, anonymize, limit: 100 });
    const s = report.summary;
    const dateStr = new Date().toUTCString();
    const accountLabel = account === 'all' ? 'All FTP Accounts' : account;
    const periodObj = report.availablePeriods.find(p => p.key === period);
    const periodLabel = periodObj ? periodObj.label : period;

    if (format === 'txt') {
      let txt = `================================================================================\nWEBALIZER 2.23 - FTP SERVER TRAFFIC ANALYSIS\n================================================================================\nGenerated: ${dateStr}\nHost / User: ${user}\nFTP Account: ${accountLabel}\nPeriod: ${periodLabel}\nEngine: ${report.capabilities.engineName}\nIP Anonymization: ${anonymize ? 'Enabled (Masked)' : 'Disabled'}\n================================================================================\n\nSUMMARY STATISTICS\n--------------------------------------------------------------------------------\nTotal Transfers:           ${s.totalTransfers.toLocaleString()}\nTotal Uploads:             ${s.totalUploads.toLocaleString()} (${s.formattedUploadBytes})\nTotal Downloads:           ${s.totalDownloads.toLocaleString()} (${s.formattedDownloadBytes})\nTotal Volume:              ${s.formattedTotalBytes}\nFTP Sessions / Logins:     ${s.totalSessions.toLocaleString()} (Success: ${s.successfulLogins}, Failed: ${s.failedLogins})\nAverage Transfer Size:     ${s.formattedAvgTransferBytes}\nTransfer Success Rate:     ${s.completionRate}%\nActive FTP Users:          ${s.activeUsers}\nUnique Client Hosts:       ${s.uniqueClients}\n\n--------------------------------------------------------------------------------\nDAILY FTP USAGE (Top 31 Days)\n--------------------------------------------------------------------------------\nDate          Day   Uploads    Downloads    Files      Upload Vol     Download Vol       Total Vol\n--------------------------------------------------------------------------------\n`;
      for (const d of report.daily.slice(0, 31)) {
        const dt = d.date.padEnd(12);
        const day = d.dayOfWeek.padEnd(5);
        const up = String(d.uploads).padStart(8);
        const dn = String(d.downloads).padStart(10);
        const fl = String(d.totalTransfers).padStart(8);
        const uv = d.formattedUploadBytes.padStart(15);
        const dv = d.formattedDownloadBytes.padStart(16);
        const tv = d.formattedTotalBytes.padStart(16);
        txt += `${dt} ${day} ${up} ${dn} ${fl} ${uv} ${dv} ${tv}\n`;
      }

      txt += `\n--------------------------------------------------------------------------------\nTOP UPLOADED FILES\n--------------------------------------------------------------------------------\n`;
      for (const f of report.topUploadedFiles.slice(0, 20)) {
        txt += `${String(f.count).padStart(6)} transfers (${f.formattedBytes.padStart(10)}) - ${f.filename}\n`;
      }

      txt += `\n--------------------------------------------------------------------------------\nTOP DOWNLOADED FILES\n--------------------------------------------------------------------------------\n`;
      for (const f of report.topDownloadedFiles.slice(0, 20)) {
        txt += `${String(f.count).padStart(6)} transfers (${f.formattedBytes.padStart(10)}) - ${f.filename}\n`;
      }

      txt += `\n--------------------------------------------------------------------------------\nTOP FTP USERS\n--------------------------------------------------------------------------------\n`;
      for (const u of report.topUsers) {
        txt += `${u.username.padEnd(30)} Transfers: ${String(u.totalTransfers).padStart(6)}  Volume: ${u.formattedTotalBytes.padStart(12)} (${u.percentage}%)\n`;
      }

      txt += `\n================================================================================\nEnd of Report\n`;
      return { content: txt, contentType: 'text/plain; charset=utf-8', filename: `webalizer_ftp_${user}_${period}.txt` };
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Webalizer FTP 2.23 - Usage Statistics for ${accountLabel} - ${periodLabel}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 20px; font-size: 13px; }
    .container { max-width: 1100px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); padding: 25px; }
    h1 { color: #0f172a; font-size: 22px; margin-top: 0; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
    h2 { color: #1e3a8a; font-size: 16px; margin: 25px 0 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    .meta-box { background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 20px; border-radius: 0 4px 4px 0; }
    .meta-box p { margin: 4px 0; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    th { background: #0f766e; color: #ffffff; text-align: left; padding: 8px 10px; font-weight: 600; }
    td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .text-right { text-align: right; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-info { background: #e0f2fe; color: #075985; }
    .footer { margin-top: 30px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Webalizer 2.23: FTP Server Traffic Analysis</h1>
    <div class="meta-box">
      <p><strong>Target FTP Account:</strong> ${accountLabel}</p>
      <p><strong>Reporting Period:</strong> ${periodLabel}</p>
      <p><strong>Generated:</strong> ${dateStr}</p>
      <p><strong>Engine:</strong> ${report.capabilities.engineName}</p>
      <p><strong>IP Privacy Masking:</strong> ${anonymize ? 'Enabled' : 'Disabled'}</p>
    </div>

    <h2>Summary Statistics</h2>
    <table>
      <thead>
        <tr><th>Metric</th><th class="text-right">Value</th><th>Metric</th><th class="text-right">Value</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Total File Transfers</strong></td><td class="text-right">${s.totalTransfers.toLocaleString()}</td>
          <td><strong>Total Volume Transferred</strong></td><td class="text-right"><strong>${s.formattedTotalBytes}</strong></td>
        </tr>
        <tr>
          <td><strong>Uploads (Incoming)</strong></td><td class="text-right">${s.totalUploads.toLocaleString()} (${s.formattedUploadBytes})</td>
          <td><strong>Downloads (Outgoing)</strong></td><td class="text-right">${s.totalDownloads.toLocaleString()} (${s.formattedDownloadBytes})</td>
        </tr>
        <tr>
          <td><strong>FTP Sessions / Logins</strong></td><td class="text-right">${s.totalSessions.toLocaleString()}</td>
          <td><strong>Successful / Failed Logins</strong></td><td class="text-right">${s.successfulLogins} / ${s.failedLogins}</td>
        </tr>
        <tr>
          <td><strong>Average Transfer Size</strong></td><td class="text-right">${s.formattedAvgTransferBytes}</td>
          <td><strong>Transfer Success Rate</strong></td><td class="text-right"><span class="badge badge-success">${s.completionRate}%</span></td>
        </tr>
        <tr>
          <td><strong>Active FTP Accounts</strong></td><td class="text-right">${s.activeUsers}</td>
          <td><strong>Unique Client Hosts</strong></td><td class="text-right">${s.uniqueClients}</td>
        </tr>
      </tbody>
    </table>

    <h2>Daily FTP Activity</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Day</th>
          <th class="text-right">Uploads</th>
          <th class="text-right">Downloads</th>
          <th class="text-right">Total Files</th>
          <th class="text-right">Upload Volume</th>
          <th class="text-right">Download Volume</th>
          <th class="text-right">Total Volume</th>
        </tr>
      </thead>
      <tbody>
        ${report.daily.slice(0, 31).map(d => `
          <tr>
            <td>${d.date}</td>
            <td>${d.dayOfWeek}</td>
            <td class="text-right">${d.uploads}</td>
            <td class="text-right">${d.downloads}</td>
            <td class="text-right"><strong>${d.totalTransfers}</strong></td>
            <td class="text-right">${d.formattedUploadBytes}</td>
            <td class="text-right">${d.formattedDownloadBytes}</td>
            <td class="text-right"><strong>${d.formattedTotalBytes}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>Top Uploaded Files</h2>
    <table>
      <thead>
        <tr><th>#</th><th>File Path</th><th class="text-right">Transfers</th><th class="text-right">Volume</th><th class="text-right">% Uploads</th></tr>
      </thead>
      <tbody>
        ${report.topUploadedFiles.slice(0, 15).map((f, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><code>${f.filename}</code></td>
            <td class="text-right">${f.count}</td>
            <td class="text-right">${f.formattedBytes}</td>
            <td class="text-right">${f.percentage}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>Top Downloaded Files</h2>
    <table>
      <thead>
        <tr><th>#</th><th>File Path</th><th class="text-right">Transfers</th><th class="text-right">Volume</th><th class="text-right">% Downloads</th></tr>
      </thead>
      <tbody>
        ${report.topDownloadedFiles.slice(0, 15).map((f, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><code>${f.filename}</code></td>
            <td class="text-right">${f.count}</td>
            <td class="text-right">${f.formattedBytes}</td>
            <td class="text-right">${f.percentage}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>FTP Accounts Activity</h2>
    <table>
      <thead>
        <tr><th>FTP Username</th><th class="text-right">Uploads</th><th class="text-right">Downloads</th><th class="text-right">Total Files</th><th class="text-right">Total Volume</th><th class="text-right">% Volume</th></tr>
      </thead>
      <tbody>
        ${report.topUsers.map(u => `
          <tr>
            <td><strong>${u.username}</strong></td>
            <td class="text-right">${u.uploads}</td>
            <td class="text-right">${u.downloads}</td>
            <td class="text-right"><strong>${u.totalTransfers}</strong></td>
            <td class="text-right">${u.formattedTotalBytes}</td>
            <td class="text-right">${u.percentage}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="footer">
      Generated by <strong>cPanel Webalizer FTP</strong> | Webalizer 2.23 Compatible Engine | Multi-Tenant Isolated Statistics
    </div>
  </div>
</body>
</html>`;

    return { content: html, contentType: 'text/html; charset=utf-8', filename: `webalizer_ftp_${user}_${period}.html` };
  }
}

module.exports = new WebalizerFtpService();
