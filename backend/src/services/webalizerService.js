/**
 * webalizerService.js
 * Authoritative Webalizer Analytics Service for cPanel Jupiter
 * Feature #31: Metrics -> Webalizer
 *
 * Implements real web traffic analytics from authentic web server access logs with
 * multi-tenant domain authorization, capability detection, Webalizer-style general
 * summaries, daily/hourly distributions, entry/exit pages, file/hit/visit metrics,
 * search strings extraction, and HTML/ASCII export.
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

// Apache / Nginx Combined Log Format Regex
const COMBINED_LOG_REGEX = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+)(?: +([^"]*?)(?: +(HTTP\/\S+))?)?" (\d{3}) (\d+|-)(?: "([^"]*)" "([^"]*)")?$/;

// Common static asset extensions (not considered content pages in Webalizer)
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

class WebalizerService {
  constructor() {
    this.cache = new Map();
    this.cacheTtlMs = 15000; // 15 seconds
  }

  /**
   * Detect real Webalizer capability and system environment
   */
  detectCapabilities() {
    let webalizerInstalled = false;
    let webalizerVersion = null;
    let geoIpInstalled = false;

    // Check system PATH and known paths
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

    return {
      webalizerInstalled,
      webalizerVersion,
      engine: webalizerInstalled ? 'native_webalizer' : 'embedded_access_log',
      engineName: webalizerInstalled
        ? 'Native Webalizer Server Engine'
        : 'cPanel Embedded Access Log Analytics Engine (Webalizer Compatible)',
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
   * Format byte count into human-readable string
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
   * Extract search query from referrer URL
   */
  extractSearchQuery(ref) {
    if (!ref || ref === '-' || !ref.includes('?')) return null;
    try {
      const u = new URL(ref);
      const params = u.searchParams;
      const q = params.get('q') || params.get('query') || params.get('p') || params.get('search');
      if (q && q.trim().length > 1) {
        return q.trim().toLowerCase();
      }
    } catch (e) {}
    return null;
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
    if (!ua || ua === '-') return { name: 'Unknown', category: 'Other' };
    const lower = ua.toLowerCase();

    // Bots
    if (lower.includes('googlebot')) return { name: 'Googlebot (Crawler)', category: 'Search Engine Robot' };
    if (lower.includes('bingbot')) return { name: 'Bingbot (Crawler)', category: 'Search Engine Robot' };
    if (lower.includes('yandexbot')) return { name: 'YandexBot (Crawler)', category: 'Search Engine Robot' };
    if (lower.includes('duckduckbot')) return { name: 'DuckDuckBot (Crawler)', category: 'Search Engine Robot' };
    if (lower.includes('baiduspider')) return { name: 'Baiduspider (Crawler)', category: 'Search Engine Robot' };
    if (lower.includes('facebookexternalhit')) return { name: 'FacebookBot', category: 'Social Robot' };
    if (lower.includes('curl') || lower.includes('wget') || lower.includes('python') || lower.includes('postman')) {
      return { name: 'Automated Script / API Probe', category: 'Scripting Tool' };
    }

    // Browsers
    if (lower.includes('edg/')) return { name: 'Microsoft Edge', category: 'Web Browser' };
    if (lower.includes('opr/') || lower.includes('opera/')) return { name: 'Opera', category: 'Web Browser' };
    if (lower.includes('chrome/') && !lower.includes('edg/')) return { name: 'Google Chrome', category: 'Web Browser' };
    if (lower.includes('safari/') && !lower.includes('chrome/')) return { name: 'Apple Safari', category: 'Web Browser' };
    if (lower.includes('firefox/')) return { name: 'Mozilla Firefox', category: 'Web Browser' };
    if (lower.includes('trident/') || lower.includes('msie ')) return { name: 'Internet Explorer', category: 'Web Browser' };

    return { name: 'Other User-Agent', category: 'Other' };
  }

  /**
   * Classify referrer
   */
  classifyReferrer(ref, domain) {
    if (!ref || ref === '-') return { category: 'Direct Traffic', label: 'Direct Request' };
    const lower = ref.toLowerCase();

    if (domain && lower.includes(domain.toLowerCase())) {
      return { category: 'Internal', label: 'Internal Site Navigation' };
    }
    if (lower.includes('google.')) return { category: 'Search Engine', label: 'Google Search' };
    if (lower.includes('bing.')) return { category: 'Search Engine', label: 'Bing Search' };
    if (lower.includes('yahoo.')) return { category: 'Search Engine', label: 'Yahoo Search' };
    if (lower.includes('duckduckgo.')) return { category: 'Search Engine', label: 'DuckDuckGo Search' };

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
   * Generate complete Webalizer report
   */
  async getWebalizerReport({ username = 'cpanel_user', domain = 'ALL', period = 'current_month', month = null, year = null, anonymize = false }) {
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

    // Accumulators for Webalizer
    let totalHits = 0;
    let totalFiles = 0;
    let totalPages = 0;
    let totalBytes = 0;

    const distinctSitesSet = new Set();
    const distinctUrlsSet = new Set();

    let firstRequestTime = null;
    let lastRequestTime = null;

    // Daily Map (1 to 31)
    const dailyMap = new Map();

    // Hourly Map (00 to 23)
    const hourlyMap = new Map();
    for (let h = 0; h < 24; h++) {
      const hStr = String(h).padStart(2, '0');
      hourlyMap.set(h, {
        hour: h,
        hourLabel: `${hStr}:00`,
        hits: 0,
        files: 0,
        pages: 0,
        bytes: 0,
        kbytes: 0,
        formattedBytes: '0 Bytes'
      });
    }

    const urlMap = new Map();
    const siteMap = new Map();
    const referrerMap = new Map();
    const userAgentMap = new Map();
    const searchStringMap = new Map();
    const statusMap = new Map();

    // Visitor Sessions: Map of ip_ua -> array of requests sorted by time
    // Webalizer session timeout = 30 minutes (1,800,000 ms)
    const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
    const clientSessions = new Map();

    for (const target of targetFiles) {
      if (!fs.existsSync(target.file)) continue;

      const fileStream = fs.createReadStream(target.file, { encoding: 'utf8' });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        if (!line || !line.trim()) continue;
        const match = line.match(COMBINED_LOG_REGEX);
        if (!match) continue;

        const [ , ip, tsStr, method, rawUrl, , statusStr, bytesStr, referrer, userAgent ] = match;
        const recordDate = this.parseApacheDate(tsStr);
        if (!recordDate) continue;

        const ts = recordDate.getTime();
        if (ts < startDate.getTime() || ts > endDate.getTime()) continue;

        if (!firstRequestTime || ts < firstRequestTime) firstRequestTime = ts;
        if (!lastRequestTime || ts > lastRequestTime) lastRequestTime = ts;

        const statusCode = parseInt(statusStr, 10);
        const bytes = bytesStr === '-' ? 0 : Math.max(0, parseInt(bytesStr, 10));
        const isSuccessful = statusCode >= 200 && statusCode < 400;
        const cleanPath = (rawUrl || '/').split('?')[0].split('#')[0] || '/';
        const isPage = this.isPageRequest(cleanPath);

        totalHits++;
        if (isSuccessful) totalFiles++;
        if (isPage) totalPages++;
        totalBytes += bytes;

        distinctSitesSet.add(ip);
        distinctUrlsSet.add(cleanPath);

        // Daily aggregation
        const dateKey = recordDate.toISOString().split('T')[0];
        const dayOfMonth = recordDate.getUTCDate();
        const dEntry = dailyMap.get(dateKey) || {
          date: dateKey,
          day: dayOfMonth,
          dayName: DAY_NAMES[recordDate.getUTCDay()],
          dayFull: DAY_FULL[recordDate.getUTCDay()],
          hits: 0,
          files: 0,
          pages: 0,
          visits: 0,
          sitesSet: new Set(),
          bytes: 0
        };
        dEntry.hits++;
        if (isSuccessful) dEntry.files++;
        if (isPage) dEntry.pages++;
        dEntry.sitesSet.add(ip);
        dEntry.bytes += bytes;
        dailyMap.set(dateKey, dEntry);

        // Hourly aggregation
        const hour = recordDate.getUTCHours();
        const hEntry = hourlyMap.get(hour);
        if (hEntry) {
          hEntry.hits++;
          if (isSuccessful) hEntry.files++;
          if (isPage) hEntry.pages++;
          hEntry.bytes += bytes;
        }

        // Top URLs
        const uEntry = urlMap.get(cleanPath) || {
          path: cleanPath,
          hits: 0,
          pages: 0,
          bytes: 0
        };
        uEntry.hits++;
        if (isPage) uEntry.pages++;
        uEntry.bytes += bytes;
        urlMap.set(cleanPath, uEntry);

        // Top Sites
        const sEntry = siteMap.get(ip) || {
          ip,
          maskedIp: this.maskIp(ip),
          hits: 0,
          files: 0,
          pages: 0,
          bytes: 0,
          lastVisit: null
        };
        sEntry.hits++;
        if (isSuccessful) sEntry.files++;
        if (isPage) sEntry.pages++;
        sEntry.bytes += bytes;
        if (!sEntry.lastVisit || ts > new Date(sEntry.lastVisit).getTime()) {
          sEntry.lastVisit = recordDate.toISOString();
        }
        siteMap.set(ip, sEntry);

        // Referrers
        const refMeta = this.classifyReferrer(referrer, target.domain);
        const refKey = refMeta.label;
        const rEntry = referrerMap.get(refKey) || { label: refKey, category: refMeta.category, hits: 0 };
        rEntry.hits++;
        referrerMap.set(refKey, rEntry);

        // Search strings
        const searchQ = this.extractSearchQuery(referrer);
        if (searchQ) {
          const sqEntry = searchStringMap.get(searchQ) || { query: searchQ, hits: 0 };
          sqEntry.hits++;
          searchStringMap.set(searchQ, sqEntry);
        }

        // Status code
        statusMap.set(statusCode, (statusMap.get(statusCode) || 0) + 1);

        // User Agent
        const uaMeta = this.classifyUserAgent(userAgent);
        const uaKey = uaMeta.name;
        const uaEntry = userAgentMap.get(uaKey) || { name: uaKey, category: uaMeta.category, hits: 0 };
        uaEntry.hits++;
        userAgentMap.set(uaKey, uaEntry);

        // Track sessions for visits, entry pages, and exit pages
        const clientKey = `${ip}|${userAgent || ''}`;
        if (!clientSessions.has(clientKey)) {
          clientSessions.set(clientKey, []);
        }
        clientSessions.get(clientKey).push({
          ts,
          path: cleanPath,
          dateKey,
          isPage
        });
      }
    }

    // Process visits, entry pages, exit pages from clientSessions
    let totalVisits = 0;
    const entryPageMap = new Map();
    const exitPageMap = new Map();

    for (const reqs of clientSessions.values()) {
      reqs.sort((a, b) => a.ts - b.ts);

      let currentSession = [];
      for (const r of reqs) {
        if (currentSession.length === 0) {
          currentSession.push(r);
        } else {
          const lastReq = currentSession[currentSession.length - 1];
          if (r.ts - lastReq.ts > SESSION_TIMEOUT_MS) {
            // End of current session
            totalVisits++;
            // Attribute daily visit to session start date
            const d = dailyMap.get(currentSession[0].dateKey);
            if (d) d.visits++;

            const firstPage = currentSession.find(item => item.isPage) || currentSession[0];
            const lastPage = [...currentSession].reverse().find(item => item.isPage) || currentSession[currentSession.length - 1];

            entryPageMap.set(firstPage.path, (entryPageMap.get(firstPage.path) || 0) + 1);
            exitPageMap.set(lastPage.path, (exitPageMap.get(lastPage.path) || 0) + 1);

            currentSession = [r];
          } else {
            currentSession.push(r);
          }
        }
      }

      if (currentSession.length > 0) {
        totalVisits++;
        const d = dailyMap.get(currentSession[0].dateKey);
        if (d) d.visits++;

        const firstPage = currentSession.find(item => item.isPage) || currentSession[0];
        const lastPage = [...currentSession].reverse().find(item => item.isPage) || currentSession[currentSession.length - 1];

        entryPageMap.set(firstPage.path, (entryPageMap.get(firstPage.path) || 0) + 1);
        exitPageMap.set(lastPage.path, (exitPageMap.get(lastPage.path) || 0) + 1);
      }
    }

    // Days span for averages
    const daysSpan = Math.max(1, Math.ceil((endDate - startDate) / 86400000));
    const totalKBytes = Math.round(totalBytes / 1024);

    // Formatted Daily Statistics
    const dailyStatistics = Array.from(dailyMap.values()).map(d => {
      const dKBytes = Math.round(d.bytes / 1024);
      return {
        date: d.date,
        day: d.day,
        dayName: d.dayName,
        dayFull: d.dayFull,
        hits: d.hits,
        files: d.files,
        pages: d.pages,
        visits: d.visits,
        sites: d.sitesSet.size,
        kbytes: dKBytes,
        bytes: d.bytes,
        formattedBytes: this.formatBytes(d.bytes),
        pctHits: totalHits > 0 ? ((d.hits / totalHits) * 100).toFixed(1) : '0',
        pctFiles: totalFiles > 0 ? ((d.files / totalFiles) * 100).toFixed(1) : '0',
        pctPages: totalPages > 0 ? ((d.pages / totalPages) * 100).toFixed(1) : '0',
        pctKBytes: totalKBytes > 0 ? ((dKBytes / totalKBytes) * 100).toFixed(1) : '0'
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    // Formatted Hourly Statistics
    const hourlyStatistics = Array.from(hourlyMap.values()).map(h => {
      const hKBytes = Math.round(h.bytes / 1024);
      return {
        ...h,
        kbytes: hKBytes,
        formattedBytes: this.formatBytes(h.bytes),
        pctHits: totalHits > 0 ? ((h.hits / totalHits) * 100).toFixed(1) : '0',
        pctFiles: totalFiles > 0 ? ((h.files / totalFiles) * 100).toFixed(1) : '0',
        pctPages: totalPages > 0 ? ((h.pages / totalPages) * 100).toFixed(1) : '0',
        pctKBytes: totalKBytes > 0 ? ((hKBytes / totalKBytes) * 100).toFixed(1) : '0'
      };
    });

    // Top URLs
    const topUrls = Array.from(urlMap.values()).map(u => {
      const uKBytes = Math.round(u.bytes / 1024);
      return {
        path: u.path,
        url: u.path,
        hits: u.hits,
        requests: u.hits,
        pages: u.pages,
        kbytes: uKBytes,
        bytes: u.bytes,
        formattedBytes: this.formatBytes(u.bytes),
        pctHits: totalHits > 0 ? ((u.hits / totalHits) * 100).toFixed(1) : '0',
        pctKBytes: totalKBytes > 0 ? ((uKBytes / totalKBytes) * 100).toFixed(1) : '0'
      };
    }).sort((a, b) => b.hits - a.hits).slice(0, 30);

    // Top Entry Pages
    const topEntryPages = Array.from(entryPageMap.entries()).map(([path, visits]) => ({
      path,
      url: path,
      visits,
      pctVisits: totalVisits > 0 ? ((visits / totalVisits) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.visits - a.visits).slice(0, 15);

    // Top Exit Pages
    const topExitPages = Array.from(exitPageMap.entries()).map(([path, visits]) => ({
      path,
      url: path,
      visits,
      pctVisits: totalVisits > 0 ? ((visits / totalVisits) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.visits - a.visits).slice(0, 15);

    // Top Sites / Hosts
    const topSites = Array.from(siteMap.values()).map(s => {
      const sKBytes = Math.round(s.bytes / 1024);
      const displayHost = anonymize ? s.maskedIp : s.ip;
      return {
        ...s,
        host: displayHost,
        ip: displayHost,
        originalIp: s.ip,
        maskedIp: s.maskedIp,
        kbytes: sKBytes,
        formattedBytes: this.formatBytes(s.bytes),
        pctHits: totalHits > 0 ? ((s.hits / totalHits) * 100).toFixed(1) : '0',
        pctFiles: totalFiles > 0 ? ((s.files / totalFiles) * 100).toFixed(1) : '0',
        pctKBytes: totalKBytes > 0 ? ((sKBytes / totalKBytes) * 100).toFixed(1) : '0'
      };
    }).sort((a, b) => b.hits - a.hits).slice(0, 30);

    // Top Referrers
    const topReferrers = Array.from(referrerMap.values()).map(r => ({
      ...r,
      referrer: r.label,
      pctHits: totalHits > 0 ? ((r.hits / totalHits) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.hits - a.hits).slice(0, 25);

    // Top User Agents
    const topUserAgents = Array.from(userAgentMap.values()).map(ua => ({
      ...ua,
      userAgent: ua.name,
      pctHits: totalHits > 0 ? ((ua.hits / totalHits) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.hits - a.hits).slice(0, 20);

    // Search Strings
    const searchStrings = Array.from(searchStringMap.values()).map(sq => ({
      ...sq,
      pctHits: totalHits > 0 ? ((sq.hits / totalHits) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.hits - a.hits).slice(0, 20);

    // HTTP Status Codes
    const statusCodes = Array.from(statusMap.entries()).map(([code, count]) => ({
      code: parseInt(code, 10),
      description: STATUS_DESCRIPTIONS[code] || 'HTTP Status',
      hits: count,
      requests: count,
      pctHits: totalHits > 0 ? ((count / totalHits) * 100).toFixed(1) : '0',
      percentage: totalHits > 0 ? ((count / totalHits) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.hits - a.hits);

    const caps = this.detectCapabilities();
    const generatedTimestamp = new Date().toISOString();

    const generalSummary = {
      totalHits,
      totalFiles,
      totalPages,
      totalVisits,
      totalSites: distinctSitesSet.size,
      totalKBytes,
      totalBytes,
      formattedBytes: this.formatBytes(totalBytes),
      totalRequests: totalHits,
      distinctFiles: totalFiles,
      distinctHosts: distinctSitesSet.size,
      distinctUrls: distinctUrlsSet.size,

      // Daily Averages
      avgHitsPerDay: Math.round(totalHits / daysSpan),
      avgFilesPerDay: Math.round(totalFiles / daysSpan),
      avgPagesPerDay: Math.round(totalPages / daysSpan),
      avgVisitsPerDay: Math.round(totalVisits / daysSpan),
      avgKBytesPerDay: Math.round(totalKBytes / daysSpan),
      avgBytesPerDay: Math.round(totalBytes / daysSpan),
      formattedAvgBytes: this.formatBytes(Math.round(totalBytes / daysSpan)),

      // Hourly Averages (24h)
      avgHitsPerHour: Math.round(totalHits / (daysSpan * 24)),
      avgFilesPerHour: Math.round(totalFiles / (daysSpan * 24)),
      avgPagesPerHour: Math.round(totalPages / (daysSpan * 24)),
      avgKBytesPerHour: Math.round(totalKBytes / (daysSpan * 24)),

      firstRequest: firstRequestTime ? new Date(firstRequestTime).toISOString() : null,
      lastRequest: lastRequestTime ? new Date(lastRequestTime).toISOString() : null
    };

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
        webalizerInstalled: caps.webalizerInstalled,
        geoIpInstalled: caps.geoIpInstalled,
        logFile: targetFiles.map(t => path.basename(t.file)).join(', ') || null
      },
      capabilities: caps,
      generalSummary,
      summary: generalSummary,
      dailyStatistics,
      dailyActivity: dailyStatistics,
      dailyReport: dailyStatistics,
      hourlyStatistics,
      hourlySummary: hourlyStatistics,
      hourlyActivity: hourlyStatistics,
      topUrls,
      topEntryPages,
      topExitPages,
      topSites,
      topHosts: topSites,
      topReferrers,
      referrers: topReferrers,
      topUserAgents,
      userAgents: topUserAgents,
      searchStrings,
      statusCodes
    };

    this.cache.set(cacheKey, { timestamp: Date.now(), data: report });
    return report;
  }

  /**
   * Produce standard Webalizer report for export (HTML or Text)
   */
  getReportExportContent(report, format = 'html') {
    const s = report.generalSummary;

    if (format === 'txt' || format === 'text') {
      const lines = [];
      lines.push('================================================================');
      lines.push('WEBALIZER 2.23: Web Server Traffic Analysis');
      lines.push(`Program: ${report.capabilities.engineName}`);
      lines.push(`Hostname / Scope: ${report.domain}`);
      lines.push(`Analysis Period: ${report.period}`);
      lines.push(`Generated: ${report.generatedAt}`);
      lines.push('================================================================\n');

      lines.push('MONTHLY SUMMARY');
      lines.push('----------------------------------------------------------------');
      lines.push(`Total Hits:                           ${s.totalHits}`);
      lines.push(`Total Files:                          ${s.totalFiles}`);
      lines.push(`Total Pages:                          ${s.totalPages}`);
      lines.push(`Total Visits:                         ${s.totalVisits}`);
      lines.push(`Total Sites (Distinct Hosts):         ${s.totalSites}`);
      lines.push(`Total KBytes Transferred:             ${s.totalKBytes} KB (${s.formattedBytes})`);
      lines.push(`Daily Average Hits:                   ${s.avgHitsPerDay}`);
      lines.push(`Daily Average Files:                  ${s.avgFilesPerDay}`);
      lines.push(`Daily Average Pages:                  ${s.avgPagesPerDay}`);
      lines.push(`Daily Average Visits:                 ${s.avgVisitsPerDay}`);
      lines.push(`Daily Average KBytes:                 ${s.avgKBytesPerDay} KB`);
      lines.push(`First Request:                        ${s.firstRequest || 'N/A'}`);
      lines.push(`Last Request:                         ${s.lastRequest || 'N/A'}`);
      lines.push('----------------------------------------------------------------\n');

      lines.push('DAILY STATISTICS');
      lines.push('----------------------------------------------------------------');
      lines.push('Day   Date         Hits     Files    Pages   Visits    Sites     KBytes');
      lines.push('----------------------------------------------------------------');
      for (const d of report.dailyStatistics) {
        const dy = String(d.day).padEnd(5);
        const dt = d.date.padEnd(12);
        const h = String(d.hits).padStart(7);
        const f = String(d.files).padStart(8);
        const p = String(d.pages).padStart(8);
        const v = String(d.visits).padStart(8);
        const st = String(d.sites).padStart(8);
        const kb = `${d.kbytes} KB`.padStart(11);
        lines.push(`${dy} ${dt} ${h} ${f} ${p} ${v} ${st} ${kb}`);
      }
      lines.push('----------------------------------------------------------------\n');

      lines.push('HOURLY STATISTICS (00:00 - 23:00)');
      lines.push('----------------------------------------------------------------');
      lines.push('Hour   Hits     Files    Pages    KBytes        % Hits');
      lines.push('----------------------------------------------------------------');
      for (const h of report.hourlyStatistics) {
        const hr = h.hourLabel.padEnd(6);
        const ht = String(h.hits).padStart(7);
        const f = String(h.files).padStart(8);
        const p = String(h.pages).padStart(8);
        const kb = `${h.kbytes} KB`.padStart(12);
        const pct = `${h.pctHits}%`.padStart(9);
        lines.push(`${hr} ${ht} ${f} ${p} ${kb}  ${pct}`);
      }
      lines.push('----------------------------------------------------------------\n');

      lines.push('TOP 30 OF 30 TOTAL URLS');
      lines.push('----------------------------------------------------------------');
      lines.push('Hits       KBytes     % Hits  URL');
      lines.push('----------------------------------------------------------------');
      for (const u of report.topUrls) {
        const ht = String(u.hits).padStart(9);
        const kb = `${u.kbytes} KB`.padStart(11);
        const pct = `${u.pctHits}%`.padStart(8);
        lines.push(`${ht}  ${kb}  ${pct}  ${u.path}`);
      }
      lines.push('----------------------------------------------------------------\n');

      lines.push('TOP 30 OF 30 TOTAL SITES');
      lines.push('----------------------------------------------------------------');
      lines.push('Hits       Files      KBytes     Hostname / IP');
      lines.push('----------------------------------------------------------------');
      for (const st of report.topSites) {
        const ht = String(st.hits).padStart(9);
        const f = String(st.files).padStart(10);
        const kb = `${st.kbytes} KB`.padStart(11);
        lines.push(`${ht}  ${f}  ${kb}  ${st.host}`);
      }
      lines.push('----------------------------------------------------------------\n');

      lines.push('HTTP STATUS CODES');
      lines.push('----------------------------------------------------------------');
      for (const sc of report.statusCodes) {
        lines.push(`Code ${sc.code}: ${sc.hits} hits (${sc.pctHits}%) - ${sc.description}`);
      }
      lines.push('----------------------------------------------------------------\n');

      return {
        content: lines.join('\n'),
        mimeType: 'text/plain; charset=utf-8',
        extension: 'txt'
      };
    }

    // Classic Webalizer HTML format
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Usage Statistics for ${report.domain} - ${report.period}</title>
  <style>
    body { font-family: sans-serif; font-size: 13px; color: #000; background: #fff; margin: 20px; }
    h1, h2, h3 { color: #000080; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; font-size: 12px; }
    th { background: #000080; color: #fff; text-align: left; padding: 4px 8px; }
    td { padding: 4px 8px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #f2f2f2; }
    .right { text-align: right; }
    .center { text-align: center; }
    .mono { font-family: monospace; }
    .banner { background: #eef; border: 1px solid #99c; padding: 10px; margin-bottom: 20px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Usage Statistics for ${report.domain}</h1>
  <div class="banner">
    <strong>Generated by:</strong> ${report.capabilities.engineName}<br>
    <strong>Summary Period:</strong> ${report.period}<br>
    <strong>Generated:</strong> ${report.generatedAt}<br>
    <strong>GeoIP Status:</strong> ${report.capabilities.geoIpMessage}
  </div>

  <h2>Monthly Statistics</h2>
  <table>
    <tr><th>Metric</th><th class="right">Total Value</th><th class="right">Daily Average</th></tr>
    <tr><td>Total Hits</td><td class="right">${s.totalHits}</td><td class="right">${s.avgHitsPerDay}</td></tr>
    <tr><td>Total Files</td><td class="right">${s.totalFiles}</td><td class="right">${s.avgFilesPerDay}</td></tr>
    <tr><td>Total Pages</td><td class="right">${s.totalPages}</td><td class="right">${s.avgPagesPerDay}</td></tr>
    <tr><td>Total Visits</td><td class="right">${s.totalVisits}</td><td class="right">${s.avgVisitsPerDay}</td></tr>
    <tr><td>Total Sites (Hosts)</td><td class="right">${s.totalSites}</td><td class="right">-</td></tr>
    <tr><td>Total Data Transferred</td><td class="right">${s.formattedBytes} (${s.totalKBytes} KB)</td><td class="right">${s.formattedAvgBytes}</td></tr>
  </table>

  <h2>Daily Statistics</h2>
  <table>
    <tr><th>Day</th><th>Date</th><th class="right">Hits</th><th class="right">Files</th><th class="right">Pages</th><th class="right">Visits</th><th class="right">Sites</th><th class="right">KBytes</th></tr>
    ${report.dailyStatistics.map(d => `
      <tr>
        <td>${d.day}</td><td>${d.date} (${d.dayName})</td>
        <td class="right">${d.hits}</td><td class="right">${d.files}</td>
        <td class="right">${d.pages}</td><td class="right">${d.visits}</td>
        <td class="right">${d.sites}</td><td class="right">${d.kbytes} KB</td>
      </tr>
    `).join('')}
  </table>

  <h2>Hourly Statistics (00:00 - 23:00)</h2>
  <table>
    <tr><th>Hour</th><th class="right">Hits</th><th class="right">Files</th><th class="right">Pages</th><th class="right">KBytes</th><th class="right">% Hits</th></tr>
    ${report.hourlyStatistics.map(h => `
      <tr>
        <td>${h.hourLabel}</td>
        <td class="right">${h.hits}</td><td class="right">${h.files}</td>
        <td class="right">${h.pages}</td><td class="right">${h.kbytes} KB</td>
        <td class="right">${h.pctHits}%</td>
      </tr>
    `).join('')}
  </table>

  <h2>Top URLs</h2>
  <table>
    <tr><th>Hits</th><th>KBytes</th><th>% Hits</th><th>URL</th></tr>
    ${report.topUrls.map(u => `
      <tr>
        <td>${u.hits}</td><td>${u.kbytes} KB</td><td>${u.pctHits}%</td><td class="mono">${u.path}</td>
      </tr>
    `).join('')}
  </table>

  <h2>Top Sites (Hosts)</h2>
  <table>
    <tr><th>Hits</th><th>Files</th><th>KBytes</th><th>Hostname / IP</th></tr>
    ${report.topSites.map(st => `
      <tr>
        <td>${st.hits}</td><td>${st.files}</td><td>${st.kbytes} KB</td><td class="mono">${st.host}</td>
      </tr>
    `).join('')}
  </table>
</body>
</html>`;

    return {
      content: html,
      mimeType: 'text/html; charset=utf-8',
      extension: 'html'
    };
  }
}

module.exports = new WebalizerService();
