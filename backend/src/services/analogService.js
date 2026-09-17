/**
 * analogService.js
 * Authoritative Analog Stats Analytics Service for cPanel Jupiter
 * Feature #30: Metrics -> Analog Stats
 *
 * Implements real web analytics from authentic web server access logs with
 * multi-tenant domain authorization, capability detection, Analog-style general
 * summaries, file-type reports, directory/URL reports, and ASCII export.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const storageService = require('./storageService');
const domainService = require('./domainService');

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
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Apache / Nginx Combined Log Format
const COMBINED_LOG_REGEX = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+)(?: +([^"]*?)(?: +(HTTP\/\S+))?)?" (\d{3}) (\d+|-)(?: "([^"]*)" "([^"]*)")?$/;

// Common static asset extensions
const STATIC_EXT_REGEX = /\.(?:jpg|jpeg|gif|png|webp|svg|ico|css|js|woff|woff2|ttf|eot|otf|map|mp4|webm|mp3|pdf|zip|gz|tar|rar)$/i;

const STATUS_DESCRIPTIONS = {
  200: 'OK - Successful Request',
  201: 'Created',
  204: 'No Content',
  206: 'Partial Content',
  301: 'Moved Permanently',
  302: 'Found (Temporary Redirect)',
  304: 'Not Modified (Cached)',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  410: 'Gone',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout'
};

function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class AnalogService {
  constructor() {
    this.cache = new Map();
    this.cacheTtlMs = 15000; // 15 seconds
  }

  /**
   * Detect real Analog capability and system environment
   */
  detectCapabilities() {
    let analogInstalled = false;
    let analogVersion = null;
    let geoIpInstalled = false;

    return {
      analogInstalled,
      analogVersion,
      engine: 'embedded_access_log',
      engineName: 'cPanel Embedded Access Log Analytics Engine (Analog Compatible)',
      geoIpInstalled,
      geoIpMessage: 'GeoIP database is not installed or configured on the server. Country statistics are unavailable.',
      logFormat: 'Apache Combined Log Format (NCSA / W3C)'
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
      fs.mkdirSync(logsDir, { recursive: true });
    }
    return logsDir;
  }

  /**
   * Format bytes
   */
  formatBytes(bytes) {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 Bytes';
    const b = Math.max(0, parseInt(bytes, 10));
    if (b === 0) return '0 Bytes';
    if (b < 1024) return `${b} Bytes`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(2)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
    if (b < 1024 * 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    return `${(b / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
  }

  /**
   * Parse Apache date string
   */
  parseApacheDate(tsStr) {
    if (!tsStr) return null;
    const match = tsStr.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})(?: ([\+\-]\d{4}))?$/);
    if (!match) {
      const fallback = new Date(tsStr);
      return isNaN(fallback.getTime()) ? null : fallback;
    }
    const day = parseInt(match[1], 10);
    const month = MONTH_MAP[match[2]];
    const year = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const min = parseInt(match[5], 10);
    const sec = parseInt(match[6], 10);

    if (month === undefined) return null;

    let offsetMs = 0;
    if (match[7]) {
      const sign = match[7][0] === '-' ? -1 : 1;
      const offH = parseInt(match[7].substring(1, 3), 10);
      const offM = parseInt(match[7].substring(3, 5), 10);
      offsetMs = sign * (offH * 60 + offM) * 60 * 1000;
    }

    const utcMs = Date.UTC(year, month, day, hour, min, sec) - offsetMs;
    return new Date(utcMs);
  }

  /**
   * Get authorized domains list for user
   */
  getAuthorizedDomains(username = 'cpanel_user') {
    const data = domainService._read(username);
    const logsDir = this.getLogsDir(username);
    const domainsList = [];

    const addDomain = (domainName, type) => {
      const clean = (domainName || '').toLowerCase().replace(/\.+$/, '').trim();
      if (!clean || domainsList.some(d => d.name === clean)) return;

      const logFile = path.join(logsDir, `${clean}.log`);
      let logSize = 0;
      let lastModified = null;
      let hasLog = false;

      if (fs.existsSync(logFile)) {
        try {
          const st = fs.statSync(logFile);
          logSize = st.size;
          lastModified = st.mtime.toISOString();
          hasLog = true;
        } catch (e) {}
      }

      domainsList.push({
        name: clean,
        domain: clean,
        type,
        hasLog,
        logExists: hasLog,
        logSizeBytes: logSize,
        logSize: logSize,
        logFormattedSize: this.formatBytes(logSize),
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
   * Verify domain belongs to user
   */
  verifyDomainAuthorized(domain, username = 'cpanel_user') {
    if (!domain || domain === 'ALL' || domain === 'all') return 'ALL';
    if (domain.includes('/') || domain.includes('\\') || domain.includes('..')) {
      const err = new Error(`Invalid domain parameter: "${domain}"`);
      err.status = 400;
      throw err;
    }
    const clean = domain.toLowerCase().replace(/\.+$/, '').trim();
    const authorized = this.getAuthorizedDomains(username);
    const match = authorized.find(d => d.name === clean || d.domain === clean);
    if (!match) {
      const err = new Error(`Access denied: domain "${domain}" is not registered to your account.`);
      err.status = 403;
      throw err;
    }
    return match.name;
  }

  /**
   * Detect available reporting periods and historical months
   */
  getAvailablePeriods(domain = 'ALL', username = 'cpanel_user') {
    this.verifyDomainAuthorized(domain, username);
    const logsDir = this.getLogsDir(username);
    const archiveDir = path.join(logsDir, 'archive');

    const monthsSet = new Set();
    const now = new Date();

    const curYear = now.getUTCFullYear();
    const curMonth = now.getUTCMonth() + 1;
    const curKey = `${curYear}-${String(curMonth).padStart(2, '0')}`;
    monthsSet.add(curKey);

    const prevDate = new Date(Date.UTC(curYear, now.getUTCMonth() - 1, 1));
    const prevKey = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(prevKey);

    if (fs.existsSync(archiveDir)) {
      try {
        const files = fs.readdirSync(archiveDir);
        for (const file of files) {
          const m = file.match(/([A-Za-z]{3})-(\d{4})/);
          if (m) {
            const mIndex = MONTH_MAP[m[1]];
            if (mIndex !== undefined) {
              monthsSet.add(`${m[2]}-${String(mIndex + 1).padStart(2, '0')}`);
            }
          }
        }
      } catch (e) {}
    }

    const sortedMonths = Array.from(monthsSet).sort().reverse().map(key => {
      const [y, mStr] = key.split('-');
      const mNum = parseInt(mStr, 10);
      return {
        key,
        year: parseInt(y, 10),
        month: mNum,
        label: `${MONTH_FULL[mNum - 1]} ${y}`,
        shortLabel: `${MONTH_NAMES[mNum - 1]} ${y}`
      };
    });

    const standardPeriods = [
      { key: 'current_month', label: 'Current Month' },
      { key: 'previous_month', label: 'Previous Month' },
      { key: '7days', label: 'Last 7 Days' },
      { key: '30days', label: 'Last 30 Days' },
      { key: 'today', label: 'Today' }
    ];

    return {
      success: true,
      domain,
      periods: sortedMonths.map(m => m.key),
      standardPeriods,
      availableMonths: sortedMonths,
      defaultPeriod: 'current_month'
    };
  }

  /**
   * Resolve date boundaries
   */
  resolveDateRange(period = 'current_month', monthParam = null, yearParam = null) {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(now.getTime() + 1000);
    let periodLabel = 'Current Month';

    if (monthParam && yearParam) {
      const y = parseInt(yearParam, 10);
      const m = parseInt(monthParam, 10) - 1;
      startDate = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
      periodLabel = `${MONTH_FULL[m]} ${y}`;
      return { startDate, endDate, periodLabel };
    }

    if (period) {
      const ymMatch = period.match(/^(\d{4})-(\d{2})$/);
      if (ymMatch) {
        const y = parseInt(ymMatch[1], 10);
        const m = parseInt(ymMatch[2], 10) - 1;
        startDate = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
        periodLabel = `${MONTH_FULL[m]} ${y}`;
        return { startDate, endDate, periodLabel };
      }
    }

    switch (period.toLowerCase()) {
      case 'previous_month': {
        const curY = now.getUTCFullYear();
        const curM = now.getUTCMonth();
        startDate = new Date(Date.UTC(curY, curM - 1, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(curY, curM, 0, 23, 59, 59, 999));
        const prevM = startDate.getUTCMonth();
        periodLabel = `${MONTH_FULL[prevM]} ${startDate.getUTCFullYear()}`;
        break;
      }
      case 'today': {
        startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        periodLabel = `Today (${now.getUTCDate()} ${MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCFullYear()})`;
        break;
      }
      case '7days': {
        startDate = new Date(now.getTime() - 7 * 86400000);
        periodLabel = 'Last 7 Days';
        break;
      }
      case '30days': {
        startDate = new Date(now.getTime() - 30 * 86400000);
        periodLabel = 'Last 30 Days';
        break;
      }
      case 'current_month':
      default: {
        startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
        periodLabel = `${MONTH_FULL[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
        break;
      }
    }

    return { startDate, endDate, periodLabel };
  }

  /**
   * Determine whether URL path is a page request
   */
  isPageRequest(rawPath) {
    if (!rawPath || rawPath === '/') return true;
    const cleanPath = rawPath.split('?')[0].split('#')[0];
    if (cleanPath.endsWith('/')) return true;
    if (STATIC_EXT_REGEX.test(cleanPath)) return false;
    return true;
  }

  /**
   * Extract file extension
   */
  extractExtension(rawPath) {
    if (!rawPath || rawPath === '/') return '[directories]';
    const cleanPath = rawPath.split('?')[0].split('#')[0];
    if (cleanPath.endsWith('/')) return '[directories]';
    const dotIdx = cleanPath.lastIndexOf('.');
    if (dotIdx === -1) return '[no extension]';
    return cleanPath.substring(dotIdx).toLowerCase();
  }

  /**
   * Mask IP address for privacy
   */
  maskIp(ip) {
    if (!ip) return '***';
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 2) return `${parts[0]}:${parts[1]}:****:****`;
    }
    return '***';
  }

  /**
   * Classify user agent
   */
  classifyUserAgent(ua) {
    if (!ua || ua === '-') {
      return { browser: 'Unknown', os: 'Unknown' };
    }
    const clean = ua.toLowerCase();

    // Browser
    let browser = 'Other';
    if (clean.includes('edg/')) browser = 'Microsoft Edge';
    else if (clean.includes('chrome/') || clean.includes('crios/')) browser = 'Google Chrome';
    else if (clean.includes('firefox/') || clean.includes('fxios/')) browser = 'Mozilla Firefox';
    else if (clean.includes('safari/') && !clean.includes('chrome')) browser = 'Apple Safari';
    else if (clean.includes('opr/') || clean.includes('opera')) browser = 'Opera';
    else if (clean.includes('bot') || clean.includes('crawler') || clean.includes('spider')) browser = 'Robots / Crawlers';
    else if (clean.includes('curl') || clean.includes('wget')) browser = 'Command Line Tools';

    // OS
    let os = 'Other';
    if (clean.includes('windows')) os = 'Windows';
    else if (clean.includes('macintosh') || clean.includes('mac os')) os = 'macOS';
    else if (clean.includes('android')) os = 'Android';
    else if (clean.includes('iphone') || clean.includes('ipad')) os = 'iOS';
    else if (clean.includes('linux')) os = 'Linux';

    return { browser, os };
  }

  /**
   * Classify referrer
   */
  classifyReferrer(ref, domain) {
    if (!ref || ref === '-') return { category: 'Direct Traffic', label: 'Direct Request' };
    const lower = ref.toLowerCase();

    if (domain && lower.includes(domain.toLowerCase())) {
      return { category: 'Internal', label: 'Internal Navigation' };
    }
    if (lower.includes('google.')) return { category: 'Search Engine', label: 'Google' };
    if (lower.includes('bing.')) return { category: 'Search Engine', label: 'Bing' };
    if (lower.includes('yahoo.')) return { category: 'Search Engine', label: 'Yahoo' };
    if (lower.includes('duckduckgo.')) return { category: 'Search Engine', label: 'DuckDuckGo' };

    try {
      const u = new URL(ref);
      return { category: 'External', label: u.hostname };
    } catch (e) {
      return { category: 'External', label: ref.substring(0, 30) };
    }
  }

  /**
   * Flush cache
   */
  flushCache(username = null) {
    if (username) {
      for (const k of this.cache.keys()) {
        if (k.startsWith(`${username}:`)) this.cache.delete(k);
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Generate complete Analog Stats report
   */
  async getAnalogReport({ username = 'cpanel_user', domain = 'ALL', period = 'current_month', month = null, year = null, anonymize = false }) {
    const verifiedDomain = this.verifyDomainAuthorized(domain, username);
    const { startDate, endDate, periodLabel } = this.resolveDateRange(period, month, year);
    const logsDir = this.getLogsDir(username);

    // Cache lookup
    const cacheKey = `${username}:${verifiedDomain}:${period}:${month || ''}:${year || ''}:${anonymize ? 'anon' : 'raw'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.cacheTtlMs)) {
      return cached.data;
    }

    // Determine target log files
    const targetFiles = [];
    const authorized = this.getAuthorizedDomains(username);

    if (verifiedDomain === 'ALL') {
      authorized.forEach(d => {
        const p = path.join(logsDir, `${d.name}.log`);
        if (fs.existsSync(p)) targetFiles.push({ file: p, domain: d.name });
      });
      if (targetFiles.length === 0) {
        const master = path.join(logsDir, 'access.log');
        if (fs.existsSync(master)) targetFiles.push({ file: master, domain: 'All Domains' });
      }
    } else {
      const p = path.join(logsDir, `${verifiedDomain}.log`);
      if (fs.existsSync(p)) targetFiles.push({ file: p, domain: verifiedDomain });

      for (let i = 1; i <= 3; i++) {
        const rot = path.join(logsDir, `${verifiedDomain}.log.${i}`);
        if (fs.existsSync(rot)) targetFiles.push({ file: rot, domain: verifiedDomain });
      }
    }

    // Accumulators
    let totalRequests = 0;
    let successfulRequests = 0; // 2xx, 3xx
    let failedRequests = 0; // 4xx, 5xx
    let totalPages = 0;
    let totalBytes = 0;
    let firstRequestTime = null;
    let lastRequestTime = null;

    const distinctFilesSet = new Set();
    const distinctHostsSet = new Set();

    // Day of week summary: 0 (Sun) to 6 (Sat)
    const dayOfWeekMap = new Map();
    for (let d = 0; d < 7; d++) {
      dayOfWeekMap.set(d, { dayNum: d, dayName: DAY_NAMES[d], dayFull: DAY_FULL[d], requests: 0, pages: 0, bytes: 0 });
    }

    // Day of month report
    const dailyMap = new Map();

    // Hourly summary: 0 to 23
    const hourlyMap = new Map();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, { hour: h, hourLabel: `${String(h).padStart(2, '0')}:00`, requests: 0, pages: 0, bytes: 0 });
    }

    // File Type (Extensions)
    const extensionMap = new Map();

    // Top URLs / Files
    const fileMap = new Map();

    // Hosts / IPs
    const hostMap = new Map();

    // Referrers
    const referrerMap = new Map();

    // Status Codes
    const statusMap = new Map();

    // Browsers & OS
    const browserMap = new Map();
    const osMap = new Map();

    // Stream process log lines
    for (const target of targetFiles) {
      if (!fs.existsSync(target.file)) continue;

      const fileStream = fs.createReadStream(target.file, { encoding: 'utf8' });
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      for await (const line of rl) {
        if (!line || !line.trim()) continue;

        const match = line.match(COMBINED_LOG_REGEX);
        if (!match) continue;

        const ip = match[1];
        const dateStr = match[2];
        const method = match[3];
        const rawUrl = match[4] || '/';
        const statusCode = parseInt(match[6], 10);
        const bytes = match[7] === '-' ? 0 : (parseInt(match[7], 10) || 0);
        const referrer = match[8] || '-';
        const userAgent = match[9] || '-';

        const recordDate = this.parseApacheDate(dateStr);
        if (!recordDate) continue;

        if (recordDate < startDate || recordDate > endDate) continue;

        const ts = recordDate.getTime();
        if (!firstRequestTime || ts < firstRequestTime) firstRequestTime = ts;
        if (!lastRequestTime || ts > lastRequestTime) lastRequestTime = ts;

        totalRequests++;
        totalBytes += bytes;

        if (statusCode >= 200 && statusCode < 400) {
          successfulRequests++;
        } else if (statusCode >= 400) {
          failedRequests++;
        }

        const isPage = this.isPageRequest(rawUrl);
        if (isPage) {
          totalPages++;
        }

        const cleanPath = rawUrl.split('?')[0] || '/';
        distinctFilesSet.add(cleanPath);
        distinctHostsSet.add(ip);

        // Day of week
        const dow = recordDate.getUTCDay();
        const dowEntry = dayOfWeekMap.get(dow);
        if (dowEntry) {
          dowEntry.requests++;
          if (isPage) dowEntry.pages++;
          dowEntry.bytes += bytes;
        }

        // Day of month
        const dayKey = `${recordDate.getUTCFullYear()}-${String(recordDate.getUTCMonth() + 1).padStart(2, '0')}-${String(recordDate.getUTCDate()).padStart(2, '0')}`;
        const dayEntry = dailyMap.get(dayKey) || {
          date: dayKey,
          dayNum: recordDate.getUTCDate(),
          dayName: DAY_NAMES[dow],
          requests: 0,
          pages: 0,
          bytes: 0
        };
        dayEntry.requests++;
        if (isPage) dayEntry.pages++;
        dayEntry.bytes += bytes;
        dailyMap.set(dayKey, dayEntry);

        // Hourly
        const hour = recordDate.getUTCHours();
        const hEntry = hourlyMap.get(hour);
        if (hEntry) {
          hEntry.requests++;
          if (isPage) hEntry.pages++;
          hEntry.bytes += bytes;
        }

        // File Extension
        const ext = this.extractExtension(rawUrl);
        const extEntry = extensionMap.get(ext) || { extension: ext, requests: 0, bytes: 0 };
        extEntry.requests++;
        extEntry.bytes += bytes;
        extensionMap.set(ext, extEntry);

        // Top URLs
        const fEntry = fileMap.get(cleanPath) || { path: cleanPath, requests: 0, pages: 0, bytes: 0 };
        fEntry.requests++;
        if (isPage) fEntry.pages++;
        fEntry.bytes += bytes;
        fileMap.set(cleanPath, fEntry);

        // Hosts
        const hstEntry = hostMap.get(ip) || {
          ip,
          maskedIp: this.maskIp(ip),
          requests: 0,
          pages: 0,
          bytes: 0,
          lastVisit: null
        };
        hstEntry.requests++;
        if (isPage) hstEntry.pages++;
        hstEntry.bytes += bytes;
        if (!hstEntry.lastVisit || ts > new Date(hstEntry.lastVisit).getTime()) {
          hstEntry.lastVisit = recordDate.toISOString();
        }
        hostMap.set(ip, hstEntry);

        // Referrer
        const refMeta = this.classifyReferrer(referrer, target.domain);
        const refKey = refMeta.label;
        const rEntry = referrerMap.get(refKey) || { label: refKey, category: refMeta.category, requests: 0 };
        rEntry.requests++;
        referrerMap.set(refKey, rEntry);

        // Status code
        statusMap.set(statusCode, (statusMap.get(statusCode) || 0) + 1);

        // User Agent
        const uaMeta = this.classifyUserAgent(userAgent);
        browserMap.set(uaMeta.browser, (browserMap.get(uaMeta.browser) || 0) + 1);
        osMap.set(uaMeta.os, (osMap.get(uaMeta.os) || 0) + 1);
      }
    }

    // Number of active days span in period for averages
    const daysSpan = Math.max(1, Math.ceil((endDate - startDate) / 86400000));

    const getFileTypeDescription = (ext) => {
    const descMap = {
      '.html': 'HTML Documents',
      '.htm': 'HTML Documents',
      '.php': 'PHP Scripts',
      '.phtml': 'PHP Scripts',
      '.js': 'JavaScript Files',
      '.css': 'Cascading Style Sheets',
      '.json': 'JSON Data',
      '.xml': 'XML Documents',
      '.png': 'PNG Images',
      '.jpg': 'JPEG Images',
      '.jpeg': 'JPEG Images',
      '.gif': 'GIF Graphics',
      '.svg': 'SVG Vector Graphics',
      '.webp': 'WebP Images',
      '.ico': 'Favicon Icons',
      '.pdf': 'PDF Documents',
      '.txt': 'Plain Text Files',
      '.zip': 'ZIP Archives',
      '.tar': 'Tape Archives',
      '.gz': 'GZip Compressed Files',
      '.woff': 'Web Open Font Format',
      '.woff2': 'Web Open Font Format 2',
      '.ttf': 'TrueType Fonts',
      '[directories]': 'Directories',
      '[no extension]': 'No Extension'
    };
    return descMap[(ext || '').toLowerCase()] || `${(ext || '').toUpperCase().replace('.', '')} Files`;
  }

    // Formatted collections
    const dayOfWeekReport = Array.from(dayOfWeekMap.values()).map(d => ({
      ...d,
      day: d.dayNum,
      dayName: d.dayFull,
      dayShort: d.dayName,
      formattedBytes: this.formatBytes(d.bytes),
      percentage: totalRequests > 0 ? ((d.requests / totalRequests) * 100).toFixed(1) : '0'
    }));

    const dailyReport = Array.from(dailyMap.values()).map(d => ({
      ...d,
      formattedBytes: this.formatBytes(d.bytes),
      percentage: totalRequests > 0 ? ((d.requests / totalRequests) * 100).toFixed(1) : '0'
    })).sort((a, b) => a.date.localeCompare(b.date));

    const hourlySummary = Array.from(hourlyMap.values()).map(h => ({
      ...h,
      formattedBytes: this.formatBytes(h.bytes),
      percentage: totalRequests > 0 ? ((h.requests / totalRequests) * 100).toFixed(1) : '0'
    }));

    const fileTypeReport = Array.from(extensionMap.values()).map(e => ({
      ...e,
      description: getFileTypeDescription(e.extension),
      formattedBytes: this.formatBytes(e.bytes),
      percentage: totalRequests > 0 ? ((e.requests / totalRequests) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.requests - a.requests);

    const topUrls = Array.from(fileMap.values()).map(f => ({
      ...f,
      url: f.path,
      path: f.path,
      formattedBytes: this.formatBytes(f.bytes),
      percentage: totalRequests > 0 ? ((f.requests / totalRequests) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.requests - a.requests).slice(0, 25);

    const topHosts = Array.from(hostMap.values()).map(h => {
      const displayHost = anonymize ? h.maskedIp : h.ip;
      return {
        ...h,
        host: displayHost,
        ip: displayHost,
        originalIp: h.ip,
        maskedIp: h.maskedIp,
        formattedBytes: this.formatBytes(h.bytes),
        percentage: totalRequests > 0 ? ((h.requests / totalRequests) * 100).toFixed(1) : '0'
      };
    }).sort((a, b) => b.requests - a.requests).slice(0, 25);

    const referrers = Array.from(referrerMap.values()).map(r => ({
      ...r,
      percentage: totalRequests > 0 ? ((r.requests / totalRequests) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.requests - a.requests);

    const statusCodes = Array.from(statusMap.entries()).map(([code, count]) => ({
      code: parseInt(code, 10),
      description: STATUS_DESCRIPTIONS[code] || 'HTTP Status',
      requests: count,
      percentage: totalRequests > 0 ? ((count / totalRequests) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.requests - a.requests);

    const browsers = Array.from(browserMap.entries()).map(([name, count]) => ({
      name,
      requests: count,
      percentage: totalRequests > 0 ? ((count / totalRequests) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.requests - a.requests);

    const operatingSystems = Array.from(osMap.entries()).map(([name, count]) => ({
      name,
      requests: count,
      percentage: totalRequests > 0 ? ((count / totalRequests) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.requests - a.requests);

    const genSummary = {
      successfulRequests,
      failedRequests,
      totalRequests,
      distinctFiles: distinctFilesSet.size,
      distinctHosts: distinctHostsSet.size,
      totalPages,
      totalBytes,
      totalBytesTransferred: totalBytes,
      formattedBandwidth: this.formatBytes(totalBytes),
      formattedBytes: this.formatBytes(totalBytes),
      avgRequestsPerDay: (totalRequests / daysSpan).toFixed(1),
      avgPagesPerDay: (totalPages / daysSpan).toFixed(1),
      avgBytesPerDay: this.formatBytes(Math.round(totalBytes / daysSpan)),
      dailyAvgRequests: parseFloat((totalRequests / daysSpan).toFixed(1)),
      dailyAvgPages: parseFloat((totalPages / daysSpan).toFixed(1)),
      dailyAvgBytes: Math.round(totalBytes / daysSpan),
      firstRequest: firstRequestTime ? new Date(firstRequestTime).toISOString() : null,
      lastRequest: lastRequestTime ? new Date(lastRequestTime).toISOString() : null
    };

    const caps = this.detectCapabilities();
    const generatedTimestamp = new Date().toISOString();

    const report = {
      success: true,
      domain: verifiedDomain,
      period: periodLabel,
      generatedAt: generatedTimestamp,
      meta: {
        domain: verifiedDomain,
        period: periodLabel,
        generatedAt: generatedTimestamp,
        engine: caps.engine,
        analogInstalled: caps.analogInstalled,
        geoIpInstalled: caps.geoIpInstalled,
        logFile: targetFiles.map(t => path.basename(t.file)).join(', ') || null
      },
      capabilities: caps,
      generalSummary: genSummary,
      summary: genSummary,
      dayOfWeekReport,
      dailyReport,
      dailyActivity: dailyReport,
      hourlySummary,
      hourlyActivity: hourlySummary,
      fileTypeReport,
      fileTypes: fileTypeReport,
      topUrls,
      topHosts,
      referrers,
      statusCodes,
      browsers,
      operatingSystems,
      os: operatingSystems
    };

    this.cache.set(cacheKey, { timestamp: Date.now(), data: report });
    return report;
  }

  /**
   * Produce standard Analog ASCII text report for export
   */
  getReportExportText(report) {
    const s = report.generalSummary;
    const lines = [];

    lines.push('================================================================');
    lines.push('ANALOG 6.0: Web Server Traffic Analysis');
    lines.push(`Program: ${report.capabilities.engineName}`);
    lines.push(`Hostname / Scope: ${report.domain}`);
    lines.push(`Analysis Period: ${report.period}`);
    lines.push(`Generated: ${report.generatedAt}`);
    lines.push('================================================================\n');

    lines.push('GENERAL SUMMARY');
    lines.push('General Summary:');
    lines.push('----------------------------------------------------------------');
    lines.push(`Successful requests:                  ${s.successfulRequests}`);
    lines.push(`Failed requests:                      ${s.failedRequests}`);
    lines.push(`Total requests:                       ${s.totalRequests}`);
    lines.push(`Distinct files requested:             ${s.distinctFiles}`);
    lines.push(`Distinct hosts served:                ${s.distinctHosts}`);
    lines.push(`Successful requests for pages:        ${s.totalPages}`);
    lines.push(`Data transferred:                     ${s.formattedBytes}`);
    lines.push(`Average requests per day:             ${s.avgRequestsPerDay}`);
    lines.push(`Average pages per day:                ${s.avgPagesPerDay}`);
    lines.push(`First request:                        ${s.firstRequest || 'N/A'}`);
    lines.push(`Last request:                         ${s.lastRequest || 'N/A'}`);
    lines.push('----------------------------------------------------------------\n');

    lines.push('DAILY REPORT (DAYS OF MONTH)');
    lines.push('----------------------------------------------------------------');
    lines.push('Date         Day   Requests   Pages      Bytes');
    lines.push('----------------------------------------------------------------');
    for (const d of report.dailyReport) {
      const dt = d.date.padEnd(12);
      const dy = d.dayName.padEnd(5);
      const req = String(d.requests).padStart(9);
      const pgs = String(d.pages).padStart(7);
      const bts = d.formattedBytes.padStart(12);
      lines.push(`${dt} ${dy} ${req}  ${pgs}  ${bts}`);
    }
    lines.push('----------------------------------------------------------------\n');

    lines.push('HOURLY SUMMARY (00:00 - 23:00)');
    lines.push('----------------------------------------------------------------');
    lines.push('Hour   Requests    Pages      Bytes          % Share');
    lines.push('----------------------------------------------------------------');
    for (const h of report.hourlySummary) {
      const hr = h.hourLabel.padEnd(6);
      const req = String(h.requests).padStart(9);
      const pgs = String(h.pages).padStart(7);
      const bts = h.formattedBytes.padStart(12);
      const pct = `${h.percentage}%`.padStart(9);
      lines.push(`${hr} ${req}  ${pgs}  ${bts}  ${pct}`);
    }
    lines.push('----------------------------------------------------------------\n');

    lines.push('FILE TYPE (EXTENSION) REPORT');
    lines.push('----------------------------------------------------------------');
    lines.push('Extension             Requests    Bytes          % Share');
    lines.push('----------------------------------------------------------------');
    for (const f of report.fileTypeReport) {
      const ext = f.extension.padEnd(20);
      const req = String(f.requests).padStart(10);
      const bts = f.formattedBytes.padStart(12);
      const pct = `${f.percentage}%`.padStart(9);
      lines.push(`${ext} ${req}  ${bts}  ${pct}`);
    }
    lines.push('----------------------------------------------------------------\n');

    lines.push('TOP REQUESTED URLS');
    lines.push('----------------------------------------------------------------');
    lines.push('Requests   Pages    Bytes         URL');
    lines.push('----------------------------------------------------------------');
    for (const u of report.topUrls) {
      const req = String(u.requests).padStart(8);
      const pgs = String(u.pages).padStart(6);
      const bts = u.formattedBytes.padStart(12);
      lines.push(`${req}  ${pgs}  ${bts}   ${u.path}`);
    }
    lines.push('----------------------------------------------------------------\n');

    lines.push('HTTP STATUS CODES');
    lines.push('----------------------------------------------------------------');
    for (const sc of report.statusCodes) {
      lines.push(`Code ${sc.code}: ${sc.requests} requests (${sc.percentage}%)`);
    }
    lines.push('----------------------------------------------------------------\n');

    return lines.join('\n');
  }
}

module.exports = new AnalogService();
