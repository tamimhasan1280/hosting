/**
 * errorLogService.js
 * Comprehensive Error Log Inspector & Analyzer for cPanel Jupiter
 * Feature #26: Metrics -> Errors
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const storageService = require('./storageService');
const domainService = require('./domainService');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_MAP = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
};

// Regex Patterns for supported web & app server log formats
// 1. Apache 2.4 / cPanel Standard format:
// [Wed Sep 16 14:22:30.123456 2026] [core:error] [pid 1234:tid 5678] [client 192.0.2.1:52134] File does not exist: /path, referer: https://...
const APACHE_24_REGEX = /^\[([A-Za-z]{3} [A-Za-z]{3} \d{1,2} \d{2}:\d{2}:\d{2}(?:\.\d+)? \d{4})\] \[([^:]+):([a-z]+)\] (?:\[pid (\d+)(?::tid (\d+))?\] )?(?:\[client ([^:\]]+)(?::(\d+))?\] )?(.*)$/i;

// 2. Traditional Apache / cPanel format:
// [Wed Sep 16 14:22:30 2026] [error] [client 192.0.2.1] Directory index forbidden by Options directive: /path
const APACHE_TRADITIONAL_REGEX = /^\[([A-Za-z]{3} [A-Za-z]{3} \d{1,2} \d{2}:\d{2}:\d{2} \d{4})\] \[([a-z]+)\] (?:\[client ([^:\]]+)(?::(\d+))?\] )?(.*)$/i;

// 3. PHP Error Log format:
// [16-Sep-2026 14:22:30 UTC] PHP Fatal error: Uncaught Error: ... in /path/file.php on line 12
// [16-Sep-2026 14:22:30 UTC] PHP Warning: ... in /path/file.php:12
const PHP_ERROR_REGEX = /^\[(\d{1,2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2}(?: [A-Za-z]+)?)\] PHP (Fatal error|Parse error|Warning|Notice|Deprecated|Catchable fatal error): (.*?)(?: in (.*?) on line (\d+)|\:(\d+))?$/i;

// 4. Nginx Error format:
// 2026/09/16 14:22:30 [error] 1234#0: *1 open() "/path" failed (2: No such file or directory), client: 192.0.2.1, server: example.com, request: "GET /url HTTP/1.1", host: "example.com", referrer: "https://..."
const NGINX_ERROR_REGEX = /^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \[([a-z]+)\] (\d+#\d+): (.*)$/i;

class ErrorLogService {
  constructor() {
    this.seededAccounts = new Set();
  }

  /**
   * Safe user logs directory
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
   * Safe user public_html directory
   */
  getPublicHtml(username = 'cpanel_user') {
    const root = typeof storageService.getUserRootDir === 'function'
      ? storageService.getUserRootDir(username)
      : storageService.getRootDir(username);
    const pub = path.join(root, 'public_html');
    if (!fs.existsSync(pub)) {
      fs.mkdirSync(pub, { recursive: true });
    }
    return pub;
  }

  /**
   * Get authorized domains for user
   */
  getAuthorizedDomains(username = 'cpanel_user') {
    this.ensureBaselineLogs(username);
    const data = domainService._read(username);
    const logsDir = this.getLogsDir(username);

    const domainsList = [];

    const addDomain = (domainName, type) => {
      const clean = (domainName || '').toLowerCase().replace(/\.+$/, '').trim();
      if (!clean || domainsList.some(d => d.name === clean)) return;

      const logFile = path.join(logsDir, `${clean}.error.log`);
      let logExists = false;
      let logSizeBytes = 0;
      let lastModified = null;

      if (fs.existsSync(logFile)) {
        logExists = true;
        try {
          const st = fs.statSync(logFile);
          logSizeBytes = st.size;
          lastModified = st.mtime.toISOString();
        } catch (e) {}
      }

      domainsList.push({
        name: clean,
        type,
        logExists,
        logSizeBytes,
        lastModified
      });
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
   * Verify domain is authorized
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
   * Normalize severity strings to cPanel severity categories:
   * 'critical' | 'error' | 'warn' | 'notice' | 'info'
   */
  normalizeSeverity(raw) {
    if (!raw) return 'error';
    const s = String(raw).toLowerCase().trim();
    if (['fatal', 'fatal error', 'parse error', 'crit', 'critical', 'alert', 'emerg'].includes(s)) {
      return 'critical';
    }
    if (['error', 'err'].includes(s)) {
      return 'error';
    }
    if (['warn', 'warning'].includes(s)) {
      return 'warn';
    }
    if (['notice', 'deprecated'].includes(s)) {
      return 'notice';
    }
    if (['info', 'debug'].includes(s)) {
      return 'info';
    }
    return 'error';
  }

  /**
   * Parse Apache / PHP / Nginx date string to Date object
   */
  parseLogDate(str) {
    if (!str) return new Date();
    try {
      // 1. Apache: Wed Sep 16 14:22:30.123456 2026 or Wed Sep 16 14:22:30 2026
      const apacheMatch = str.match(/^[A-Za-z]{3} ([A-Za-z]{3}) +(\d{1,2}) (\d{2}):(\d{2}):(\d{2})(?:\.\d+)? (\d{4})/);
      if (apacheMatch) {
        const month = MONTH_MAP[apacheMatch[1]];
        const day = parseInt(apacheMatch[2], 10);
        const hour = parseInt(apacheMatch[3], 10);
        const min = parseInt(apacheMatch[4], 10);
        const sec = parseInt(apacheMatch[5], 10);
        const year = parseInt(apacheMatch[6], 10);
        return new Date(Date.UTC(year, month, day, hour, min, sec));
      }

      // 2. PHP: 16-Sep-2026 14:22:30 UTC
      const phpMatch = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
      if (phpMatch) {
        const day = parseInt(phpMatch[1], 10);
        const month = MONTH_MAP[phpMatch[2]];
        const year = parseInt(phpMatch[3], 10);
        const hour = parseInt(phpMatch[4], 10);
        const min = parseInt(phpMatch[5], 10);
        const sec = parseInt(phpMatch[6], 10);
        return new Date(Date.UTC(year, month, day, hour, min, sec));
      }

      // 3. Nginx: 2026/09/16 14:22:30
      const nginxMatch = str.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
      if (nginxMatch) {
        const year = parseInt(nginxMatch[1], 10);
        const month = parseInt(nginxMatch[2], 10) - 1;
        const day = parseInt(nginxMatch[3], 10);
        const hour = parseInt(nginxMatch[4], 10);
        const min = parseInt(nginxMatch[5], 10);
        const sec = parseInt(nginxMatch[6], 10);
        return new Date(Date.UTC(year, month, day, hour, min, sec));
      }

      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) return parsed;
    } catch (e) {}
    return new Date();
  }

  /**
   * Parse a single log line
   */
  parseLine(line, filename = 'error_log', lineNumber = 1) {
    if (!line || typeof line !== 'string') return null;
    const trimmed = line.trim();
    if (!trimmed) return null;

    let timestamp = null;
    let severity = 'error';
    let module = 'core';
    let pid = null;
    let tid = null;
    let clientIp = null;
    let clientPort = null;
    let message = trimmed;
    let referer = null;
    let statusCode = null;
    let url = null;
    let method = null;
    let sourceFile = null;
    let sourceLine = null;

    // Try 1: Apache 2.4
    const m24 = trimmed.match(APACHE_24_REGEX);
    if (m24) {
      timestamp = this.parseLogDate(m24[1]);
      module = m24[2].toLowerCase();
      severity = this.normalizeSeverity(m24[3]);
      pid = m24[4] ? parseInt(m24[4], 10) : null;
      tid = m24[5] ? parseInt(m24[5], 10) : null;
      clientIp = m24[6] || null;
      clientPort = m24[7] ? parseInt(m24[7], 10) : null;
      message = m24[8] || '';
    } else {
      // Try 2: Traditional Apache
      const mTrad = trimmed.match(APACHE_TRADITIONAL_REGEX);
      if (mTrad) {
        timestamp = this.parseLogDate(mTrad[1]);
        severity = this.normalizeSeverity(mTrad[2]);
        module = 'apache';
        clientIp = mTrad[3] || null;
        clientPort = mTrad[4] ? parseInt(mTrad[4], 10) : null;
        message = mTrad[5] || '';
      } else {
        // Try 3: PHP Error Log
        const mPhp = trimmed.match(PHP_ERROR_REGEX);
        if (mPhp) {
          timestamp = this.parseLogDate(mPhp[1]);
          const phpLevel = mPhp[2];
          severity = this.normalizeSeverity(phpLevel);
          module = 'php';
          message = mPhp[3] || '';
          sourceFile = mPhp[4] || null;
          sourceLine = mPhp[5] || mPhp[6] ? parseInt(mPhp[5] || mPhp[6], 10) : null;
          statusCode = 500;
        } else {
          // Try 4: Nginx Error Log
          const mNg = trimmed.match(NGINX_ERROR_REGEX);
          if (mNg) {
            timestamp = this.parseLogDate(mNg[1]);
            severity = this.normalizeSeverity(mNg[2]);
            module = 'nginx';
            message = mNg[4] || '';
            const ipMatch = message.match(/client: ([^,]+)/);
            if (ipMatch) clientIp = ipMatch[1];
            const reqMatch = message.match(/request: "([A-Z]+) ([^"]+) HTTP/);
            if (reqMatch) {
              method = reqMatch[1];
              url = reqMatch[2];
            }
          } else {
            // Generic line
            timestamp = new Date();
            severity = 'error';
            module = 'system';
            message = trimmed;
          }
        }
      }
    }

    // Extract referer if present: ", referer: https://..."
    const refMatch = message.match(/, referer: (.*)$/);
    if (refMatch) {
      referer = refMatch[1].trim();
      if (referer === '-' || referer === 'none') referer = null;
      message = message.substring(0, refMatch.index).trim();
    }

    // Status code inference & URL parsing
    if (!statusCode) {
      if (/File does not exist:\s*(.*)/i.test(message)) {
        statusCode = 404;
        const pMatch = message.match(/File does not exist:\s*(.*)/i);
        if (pMatch) url = pMatch[1].trim();
      } else if (/Directory index forbidden/i.test(message) || /client denied by server configuration/i.test(message)) {
        statusCode = 403;
        const pMatch = message.match(/(?:forbidden|configuration):\s*(.*)/i);
        if (pMatch) url = pMatch[1].trim();
      } else if (/Authentication failure/i.test(message) || /user not authorized/i.test(message)) {
        statusCode = 401;
      } else if (/HTTP\/[0-9.]+"\s+(4\d\d|5\d\d)/i.test(message)) {
        const sm = message.match(/HTTP\/[0-9.]+"\s+(4\d\d|5\d\d)/i);
        if (sm) statusCode = parseInt(sm[1], 10);
      } else if (severity === 'critical') {
        statusCode = 500;
      }
    }

    // Clean up domain from filename if available (e.g. example.com.error.log -> example.com)
    let domainName = null;
    const fn = path.basename(filename);
    if (fn.endsWith('.error.log')) {
      domainName = fn.replace(/\.error\.log$/, '');
    }

    return {
      id: `${fn}:${lineNumber}:${timestamp ? timestamp.getTime() : Date.now()}`,
      logFile: fn,
      lineNumber,
      timestamp: timestamp ? timestamp.toISOString() : new Date().toISOString(),
      timestampEpoch: timestamp ? timestamp.getTime() : Date.now(),
      severity,
      module,
      pid,
      tid,
      clientIp,
      clientPort,
      method,
      url,
      statusCode,
      sourceFile,
      sourceLine,
      referer,
      message,
      domain: domainName,
      raw: trimmed
    };
  }

  /**
   * Ensure baseline error logs exist for fresh accounts
   */
  ensureBaselineLogs(username = 'cpanel_user') {
    if (this.seededAccounts.has(username)) return;
    this.seededAccounts.add(username);

    const logsDir = this.getLogsDir(username);
    const mainLog = path.join(logsDir, 'error_log');
    const primaryDomain = 'example.com';
    const domainLog = path.join(logsDir, `${primaryDomain}.error.log`);

    if (!fs.existsSync(mainLog) || fs.statSync(mainLog).size === 0) {
      const now = new Date();
      const d1 = new Date(now.getTime() - 4 * 3600000);
      const d2 = new Date(now.getTime() - 2.5 * 3600000);
      const d3 = new Date(now.getTime() - 1.2 * 3600000);
      const d4 = new Date(now.getTime() - 45 * 60000);
      const d5 = new Date(now.getTime() - 15 * 60000);

      const fmt = (d) => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = days[d.getUTCDay()];
        const monthName = MONTH_NAMES[d.getUTCMonth()];
        const day = String(d.getUTCDate()).padStart(2, '0');
        const h = String(d.getUTCHours()).padStart(2, '0');
        const m = String(d.getUTCMinutes()).padStart(2, '0');
        const s = String(d.getUTCSeconds()).padStart(2, '0');
        const y = d.getUTCFullYear();
        return `${dayName} ${monthName} ${day} ${h}:${m}:${s}.000000 ${y}`;
      };

      const baselineLines = [
        `[${fmt(d1)}] [core:notice] [pid 1024] AH00094: Command line: '/usr/sbin/httpd -D FOREGROUND'`,
        `[${fmt(d1)}] [mpm_event:notice] [pid 1024] AH00489: Apache/2.4.58 (cPanel Pro) OpenSSL/3.0.2 configured -- resuming normal operations`,
        `[${fmt(d2)}] [autoindex:warn] [pid 1025] [client 192.0.2.14:51234] mod_autoindex disabled for public_html root, referer: -`,
        `[${fmt(d3)}] [core:error] [pid 1026] [client 192.0.2.18:49812] File does not exist: /home/${username}/public_html/favicon.ico, referer: https://${primaryDomain}/`,
        `[${fmt(d4)}] [authz_core:error] [pid 1026] [client 198.51.100.22:50411] AH01630: client denied by server configuration: /home/${username}/public_html/.env, referer: -`,
        `[${fmt(d5)}] [php:error] [pid 1027] [client 203.0.113.88:38192] PHP Warning: session_start(): Failed to read session data: files in /home/${username}/public_html/index.php on line 8, referer: https://${primaryDomain}/login`
      ];

      fs.writeFileSync(mainLog, baselineLines.join('\n') + '\n', 'utf8');
      fs.writeFileSync(domainLog, baselineLines.slice(2).join('\n') + '\n', 'utf8');
    }
  }

  /**
   * Live HTTP Error Logger for /site requests with status >= 400
   */
  logHttpError({
    user = 'cpanel_user',
    domain = 'example.com',
    ip = '127.0.0.1',
    method = 'GET',
    url = '/',
    status = 404,
    referer = '-',
    message = null,
    severity = null,
    module = null
  }) {
    try {
      const logsDir = this.getLogsDir(user);
      const cleanDomain = domain.toLowerCase().replace(/\.+$/, '').trim() || 'example.com';
      const domainLog = path.join(logsDir, `${cleanDomain}.error.log`);
      const mainLog = path.join(logsDir, 'error_log');

      const now = new Date();
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = days[now.getUTCDay()];
      const monthName = MONTH_NAMES[now.getUTCMonth()];
      const day = String(now.getUTCDate()).padStart(2, '0');
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      const y = now.getUTCFullYear();
      const timestampStr = `${dayName} ${monthName} ${day} ${h}:${m}:${s}.123456 ${y}`;

      const pid = process.pid || 1234;
      const ref = referer && referer !== '-' ? referer : '-';

      let sev = severity ? this.normalizeSeverity(severity) : (status >= 500 ? 'error' : 'error');
      let mod = module || (status === 401 ? 'authz_core' : (status === 403 ? 'authz_core' : 'core'));

      let msg = message;
      if (!msg) {
        if (status === 404) {
          msg = `File does not exist: /home/${user}/public_html${url}`;
        } else if (status === 401) {
          msg = `AH01627: Authentication failure for "${url}": user not authorized`;
        } else if (status === 403) {
          msg = `AH01630: client denied by server configuration: /home/${user}/public_html${url}`;
        } else if (status === 500) {
          sev = 'critical';
          mod = 'php';
          msg = `Internal Server Error: Script execution failed for ${url}`;
        } else {
          msg = `HTTP status ${status} encountered while processing ${method} ${url}`;
        }
      }

      const logLine = `[${timestampStr}] [${mod}:${sev}] [pid ${pid}] [client ${ip}:54321] ${msg}, referer: ${ref}\n`;

      fs.appendFileSync(domainLog, logLine, 'utf8');
      fs.appendFileSync(mainLog, logLine, 'utf8');
    } catch (e) {
      console.error('[ErrorLogService] Failed to append live error:', e.message);
    }
  }

  /**
   * Stream & parse a single log file up to maxLines
   */
  async parseLogFile(filePath, maxLines = 10000) {
    if (!fs.existsSync(filePath)) return [];

    const results = [];
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineIndex = 0;
    const baseName = path.basename(filePath);

    for await (const line of rl) {
      lineIndex++;
      if (lineIndex > maxLines) break;
      const parsed = this.parseLine(line, baseName, lineIndex);
      if (parsed) {
        results.push(parsed);
      }
    }

    return results;
  }

  /**
   * Find candidate error log files for a user and optional domain
   */
  getLogFilesForScope(username = 'cpanel_user', domain = 'ALL') {
    const logsDir = this.getLogsDir(username);
    const pubDir = this.getPublicHtml(username);
    const files = [];

    if (!domain || domain === 'ALL' || domain === 'all') {
      // 1. Account master error_log
      const masterLog = path.join(logsDir, 'error_log');
      if (fs.existsSync(masterLog)) files.push(masterLog);

      // 2. All domain *.error.log
      try {
        const dirEntries = fs.readdirSync(logsDir);
        for (const f of dirEntries) {
          if (f.endsWith('.error.log')) {
            const p = path.join(logsDir, f);
            if (!files.includes(p)) files.push(p);
          }
        }
      } catch (e) {}

      // 3. PHP error log in public_html
      const phpLog = path.join(pubDir, 'error_log');
      if (fs.existsSync(phpLog) && !files.includes(phpLog)) files.push(phpLog);
    } else {
      const clean = domain.toLowerCase().replace(/\.+$/, '').trim();
      const domainLog = path.join(logsDir, `${clean}.error.log`);
      if (fs.existsSync(domainLog)) {
        files.push(domainLog);
      }
    }

    return files;
  }

  /**
   * Get all parsed error entries with filtering, search, and pagination
   */
  async getErrorEntries({
    username = 'cpanel_user',
    domain = 'ALL',
    range = '7days',
    startDate = null,
    endDate = null,
    severity = 'ALL',
    search = '',
    page = 1,
    limit = 25
  } = {}) {
    this.ensureBaselineLogs(username);
    this.verifyDomainAuthorized(domain, username);

    const logFiles = this.getLogFilesForScope(username, domain);
    const allEntries = [];
    const seenIds = new Set();

    for (const filePath of logFiles) {
      try {
        const entries = await this.parseLogFile(filePath, 10000);
        for (const item of entries) {
          // Deduplicate across master log and per-domain log if same message & timestamp
          const dedupeKey = `${item.timestampEpoch}:${item.message}:${item.clientIp || ''}`;
          if (!seenIds.has(dedupeKey)) {
            seenIds.add(dedupeKey);
            allEntries.push(item);
          }
        }
      } catch (e) {
        console.error(`[ErrorLogService] Error reading ${filePath}:`, e.message);
      }
    }

    // Sort reverse chronological (newest first)
    allEntries.sort((a, b) => b.timestampEpoch - a.timestampEpoch);

    // Compute Date Range Boundaries
    const now = new Date();
    let minTime = 0;
    let maxTime = Infinity;

    if (range === 'today') {
      const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
      minTime = startOfDay.getTime();
    } else if (range === 'yesterday') {
      const startOfYesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0));
      const endOfYesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0) - 1);
      minTime = startOfYesterday.getTime();
      maxTime = endOfYesterday.getTime();
    } else if (range === '7days') {
      minTime = now.getTime() - (7 * 24 * 3600 * 1000);
    } else if (range === '30days') {
      minTime = now.getTime() - (30 * 24 * 3600 * 1000);
    } else if (range === 'custom') {
      if (startDate) {
        const sd = new Date(startDate);
        if (!isNaN(sd.getTime())) minTime = sd.getTime();
      }
      if (endDate) {
        const ed = new Date(endDate);
        if (!isNaN(ed.getTime())) maxTime = ed.getTime();
      }
    }

    // Calculate Summary Metrics over the time window BEFORE pagination/severity filtering
    const inWindowEntries = allEntries.filter(item => item.timestampEpoch >= minTime && item.timestampEpoch <= maxTime);

    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).getTime();

    const summary = {
      total: inWindowEntries.length,
      today: inWindowEntries.filter(e => e.timestampEpoch >= startOfToday).length,
      critical: inWindowEntries.filter(e => e.severity === 'critical').length,
      warning: inWindowEntries.filter(e => e.severity === 'warn').length,
      notice: inWindowEntries.filter(e => e.severity === 'notice' || e.severity === 'info').length,
      http4xx: inWindowEntries.filter(e => e.statusCode >= 400 && e.statusCode < 500).length,
      http5xx: inWindowEntries.filter(e => e.statusCode >= 500 || e.severity === 'critical').length
    };

    // Apply Severity Filter
    let filtered = inWindowEntries;
    if (severity && severity !== 'ALL' && severity !== 'all') {
      const targetSev = this.normalizeSeverity(severity);
      filtered = filtered.filter(e => e.severity === targetSev);
    }

    // Apply Search Filter
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(e => {
        return (
          (e.message && e.message.toLowerCase().includes(q)) ||
          (e.url && e.url.toLowerCase().includes(q)) ||
          (e.clientIp && e.clientIp.toLowerCase().includes(q)) ||
          (e.module && e.module.toLowerCase().includes(q)) ||
          (e.sourceFile && e.sourceFile.toLowerCase().includes(q)) ||
          (e.statusCode && String(e.statusCode).includes(q)) ||
          (e.raw && e.raw.toLowerCase().includes(q))
        );
      });
    }

    // Pagination
    const total = filtered.length;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const totalPages = Math.ceil(total / lim) || 1;
    const startIndex = (p - 1) * lim;
    const paginatedEntries = filtered.slice(startIndex, startIndex + lim);

    return {
      success: true,
      entries: paginatedEntries,
      pagination: {
        total,
        page: p,
        limit: lim,
        totalPages
      },
      summary
    };
  }

  /**
   * Get KPI summary metrics only
   */
  async getSummary(username = 'cpanel_user', domain = 'ALL', range = '7days') {
    const result = await this.getErrorEntries({
      username,
      domain,
      range,
      limit: 10
    });
    return result.summary;
  }

  /**
   * Get log context (+/- N surrounding lines) around an error entry
   */
  async getErrorContext(logFilename, targetLineNumber, contextLines = 2, username = 'cpanel_user') {
    if (!logFilename || typeof logFilename !== 'string') {
      throw new Error('Log filename is required');
    }

    // Path security check: Prevent directory traversal
    const safeBase = path.basename(logFilename);
    const logsDir = this.getLogsDir(username);
    const pubDir = this.getPublicHtml(username);

    let resolvedPath = path.join(logsDir, safeBase);
    if (!fs.existsSync(resolvedPath)) {
      resolvedPath = path.join(pubDir, safeBase);
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Log file "${safeBase}" not found`);
    }

    const tLine = parseInt(targetLineNumber, 10);
    if (isNaN(tLine) || tLine < 1) {
      throw new Error('Invalid line number');
    }

    const startLine = Math.max(1, tLine - contextLines);
    const endLine = tLine + contextLines;

    const fileStream = fs.createReadStream(resolvedPath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let currentLine = 0;
    const contextLinesList = [];
    let targetText = '';

    for await (const line of rl) {
      currentLine++;
      if (currentLine >= startLine && currentLine <= endLine) {
        const isTarget = currentLine === tLine;
        if (isTarget) targetText = line;
        contextLinesList.push({
          lineNumber: currentLine,
          text: line,
          isTarget
        });
      }
      if (currentLine > endLine) break;
    }

    return {
      success: true,
      logFile: safeBase,
      targetLine: tLine,
      targetText,
      context: contextLinesList
    };
  }
}

module.exports = new ErrorLogService();
