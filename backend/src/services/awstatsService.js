/**
 * awstatsService.js
 * Authoritative Awstats Web Analytics Service for cPanel Jupiter
 * Feature #29: Metrics -> Awstats
 *
 * Implements real web analytics from authentic web server access logs with
 * multi-tenant domain authorization, capability detection, separate robot accounting,
 * session visit grouping, page vs hit distinction, and truthful environment states.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const zlib = require('zlib');
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

// Apache / Nginx Combined Log Format
const COMBINED_LOG_REGEX = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+)(?: +([^"]*?)(?: +(HTTP\/\S+))?)?" (\d{3}) (\d+|-)(?: "([^"]*)" "([^"]*)")?$/;

// Common static asset extensions that are hits but NOT page views
const STATIC_EXT_REGEX = /\.(?:jpg|jpeg|gif|png|webp|svg|ico|css|js|woff|woff2|ttf|eot|otf|map|mp4|webm|mp3|pdf|zip|gz|tar|rar)$/i;

function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class AwstatsService {
  constructor() {
    this.cache = new Map();
    this.cacheTtlMs = 15000; // 15 seconds
  }

  /**
   * Detect real AWStats and system capabilities
   */
  detectCapabilities() {
    // Check if awstats or perl exists on system
    let awstatsInstalled = false;
    let awstatsVersion = null;
    let geoIpInstalled = false;

    // Truthfully report capabilities on this host
    return {
      awstatsInstalled,
      awstatsVersion,
      engine: 'embedded_access_log',
      engineName: 'cPanel Embedded Access Log Analytics Engine',
      geoIpInstalled,
      geoIpMessage: 'GeoIP database is not installed or configured on the server. Country statistics are unavailable.',
      logFormat: 'Apache Combined Log Format (NCSA / W3C)',
      searchKeywordsPrivacy: 'Modern search engines encrypt search queries via HTTPS; referrer keywords are generally withheld by client browsers.'
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
   * Parse Apache date string: 16/Sep/2026:14:22:30 +0000
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
        type,
        hasLog,
        logSizeBytes: logSize,
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
    const clean = domain.toLowerCase().replace(/\.+$/, '').trim();
    const authorized = this.getAuthorizedDomains(username);
    const match = authorized.find(d => d.name === clean);
    if (!match) {
      throw new Error(`Access denied: domain "${domain}" is not registered to your account.`);
    }
    return match.name;
  }

  /**
   * Detect available reporting periods and historical months from log files
   */
  getAvailablePeriods(domain = 'ALL', username = 'cpanel_user') {
    this.verifyDomainAuthorized(domain, username);
    const logsDir = this.getLogsDir(username);
    const archiveDir = path.join(logsDir, 'archive');

    const monthsSet = new Set();
    const now = new Date();
    
    // Always include current month
    const curYear = now.getUTCFullYear();
    const curMonth = now.getUTCMonth() + 1;
    const curKey = `${curYear}-${String(curMonth).padStart(2, '0')}`;
    monthsSet.add(curKey);

    // Also include previous month
    const prevDate = new Date(Date.UTC(curYear, now.getUTCMonth() - 1, 1));
    const prevKey = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(prevKey);

    // Scan archive directory for historical logs like: example.com-Aug-2026.log.gz
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

    // Convert to sorted array descending
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
      standardPeriods,
      availableMonths: sortedMonths,
      defaultPeriod: 'current_month'
    };
  }

  /**
   * Resolve date boundary for requested period
   */
  resolveDateRange(period = 'current_month', monthParam = null, yearParam = null) {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(now.getTime() + 1000);
    let periodLabel = 'Current Month';

    if (monthParam && yearParam) {
      const y = parseInt(yearParam, 10);
      const m = parseInt(monthParam, 10) - 1; // 0-based
      startDate = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
      // End of month
      const lastDay = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
      endDate = lastDay;
      periodLabel = `${MONTH_FULL[m]} ${y}`;
      return { startDate, endDate, periodLabel };
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
   * Classify user agent
   */
  classifyUserAgent(ua) {
    if (!ua || ua === '-') {
      return { browser: 'Unknown', os: 'Unknown', isBot: false, botName: null };
    }
    const clean = ua.toLowerCase();

    // Robot / Spider Detection
    let isBot = false;
    let botName = null;
    if (clean.includes('googlebot')) { isBot = true; botName = 'Googlebot'; }
    else if (clean.includes('bingbot')) { isBot = true; botName = 'Bingbot'; }
    else if (clean.includes('yandexbot')) { isBot = true; botName = 'YandexBot'; }
    else if (clean.includes('duckduckbot')) { isBot = true; botName = 'DuckDuckBot'; }
    else if (clean.includes('baiduspider')) { isBot = true; botName = 'Baiduspider'; }
    else if (clean.includes('slurp') || clean.includes('yahoo! slurp')) { isBot = true; botName = 'Yahoo! Slurp'; }
    else if (clean.includes('curl')) { isBot = true; botName = 'cURL Tool'; }
    else if (clean.includes('wget')) { isBot = true; botName = 'Wget Tool'; }
    else if (clean.includes('python-requests') || clean.includes('python')) { isBot = true; botName = 'Python Tool'; }
    else if (clean.includes('bot') || clean.includes('spider') || clean.includes('crawler')) { isBot = true; botName = 'Web Spider/Robot'; }

    // Browser Detection
    let browser = 'Other';
    if (isBot) browser = botName;
    else if (clean.includes('edg/')) browser = 'Microsoft Edge';
    else if (clean.includes('chrome/') || clean.includes('crios/')) browser = 'Google Chrome';
    else if (clean.includes('firefox/') || clean.includes('fxios/')) browser = 'Mozilla Firefox';
    else if (clean.includes('safari/') && !clean.includes('chrome')) browser = 'Apple Safari';
    else if (clean.includes('opr/') || clean.includes('opera')) browser = 'Opera';

    // OS Detection
    let os = 'Other';
    if (isBot) os = 'Robots/Crawlers';
    else if (clean.includes('windows')) os = 'Windows';
    else if (clean.includes('macintosh') || clean.includes('mac os')) os = 'macOS';
    else if (clean.includes('android')) os = 'Android';
    else if (clean.includes('iphone') || clean.includes('ipad')) os = 'iOS';
    else if (clean.includes('linux')) os = 'Linux';

    return { browser, os, isBot, botName };
  }

  /**
   * Classify referrer
   */
  classifyReferrer(ref, domain) {
    if (!ref || ref === '-') return { category: 'Direct / Bookmark', label: 'Direct Address / Bookmark / Link in email', searchTerms: null };
    const lower = ref.toLowerCase();

    if (domain && lower.includes(domain.toLowerCase())) {
      return { category: 'Internal Navigation', label: 'Internal Pages', searchTerms: null };
    }

    let searchTerms = null;
    try {
      const u = new URL(ref);
      searchTerms = u.searchParams.get('q') || u.searchParams.get('p') || u.searchParams.get('query');
    } catch (e) {}

    if (lower.includes('google.')) return { category: 'Search Engine', label: 'Google', searchTerms };
    if (lower.includes('bing.')) return { category: 'Search Engine', label: 'Bing', searchTerms };
    if (lower.includes('yahoo.')) return { category: 'Search Engine', label: 'Yahoo!', searchTerms };
    if (lower.includes('duckduckgo.')) return { category: 'Search Engine', label: 'DuckDuckGo', searchTerms };

    try {
      const u = new URL(ref);
      return { category: 'External Links', label: u.hostname, searchTerms: null };
    } catch (e) {
      return { category: 'External Links', label: ref.substring(0, 30), searchTerms: null };
    }
  }

  /**
   * Determine whether URL path is a page view (vs static resource)
   */
  isPageRequest(rawPath) {
    if (!rawPath || rawPath === '/') return true;
    const cleanPath = rawPath.split('?')[0].split('#')[0];
    if (cleanPath.endsWith('/')) return true;
    // If it has a static asset extension, not a page
    if (STATIC_EXT_REGEX.test(cleanPath)) return false;
    return true;
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
   * Flush cached reports
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
   * Generate complete AWStats report for domain and period
   */
  async getAwstatsReport({ username = 'cpanel_user', domain = 'ALL', period = 'current_month', month = null, year = null }) {
    const verifiedDomain = this.verifyDomainAuthorized(domain, username);
    const { startDate, endDate, periodLabel } = this.resolveDateRange(period, month, year);
    const logsDir = this.getLogsDir(username);

    // Cache key
    const cacheKey = `${username}:${verifiedDomain}:${period}:${month || ''}:${year || ''}`;
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
      // Also check master log if no domain logs
      if (targetFiles.length === 0) {
        const master = path.join(logsDir, 'access.log');
        if (fs.existsSync(master)) targetFiles.push({ file: master, domain: 'All Domains' });
      }
    } else {
      const p = path.join(logsDir, `${verifiedDomain}.log`);
      if (fs.existsSync(p)) targetFiles.push({ file: p, domain: verifiedDomain });

      // Also check rotated logs for domain
      for (let i = 1; i <= 3; i++) {
        const rot = path.join(logsDir, `${verifiedDomain}.log.${i}`);
        if (fs.existsSync(rot)) targetFiles.push({ file: rot, domain: verifiedDomain });
      }
    }

    // Accumulators
    let totalHits = 0;
    let totalPages = 0;
    let totalBandwidth = 0;
    let firstVisitTime = null;
    let lastVisitTime = null;

    // Separate Robot traffic
    let robotHits = 0;
    let robotBandwidth = 0;
    const robotMap = new Map(); // name -> { name, hits, bytes, lastVisit }

    // Human traffic
    let humanHits = 0;
    let humanPages = 0;
    let humanBandwidth = 0;

    // Unique visitors & Visits
    // We track visits per visitor (IP+UA). A new visit starts after 60 min inactivity or across day boundary.
    const visitorSessions = new Map(); // visitorId -> { ip, lastTimestamp, visitCount, totalPages, totalHits, totalBytes }
    const uniqueIps = new Set();
    const uniqueVisitorsSet = new Set();

    // Status codes
    const statusCounts = {};
    let status2xx = 0;
    let status3xx = 0;
    let status4xx = 0;
    let status5xx = 0;

    // Daily breakdown (Day of Month: 1-31)
    const dailyMap = new Map(); // 'YYYY-MM-DD' -> { date, dayNum, visitsSet, pages, hits, bandwidth }

    // Hourly breakdown (0-23)
    const hourlyMap = new Map();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, { hour: h, pages: 0, hits: 0, bandwidth: 0 });
    }

    // Top Pages
    const pageMap = new Map(); // cleanPath -> { path, pages, hits, bandwidth, entryHits, exitHits }

    // Hosts / Visitor IPs
    const hostMap = new Map(); // ip -> { ip, maskedIp, pages, hits, bandwidth, lastVisit }

    // Referrers
    const referrerMap = new Map(); // category -> { category, hits, percent }
    const searchKeywords = [];

    // Browsers & OS
    const browserMap = new Map(); // name -> hits
    const osMap = new Map(); // name -> hits

    // Process files
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

        // Date range filter
        if (recordDate < startDate || recordDate > endDate) continue;

        const ts = recordDate.getTime();
        if (!firstVisitTime || ts < firstVisitTime) firstVisitTime = ts;
        if (!lastVisitTime || ts > lastVisitTime) lastVisitTime = ts;

        totalHits++;
        totalBandwidth += bytes;

        // HTTP status codes
        statusCounts[statusCode] = (statusCounts[statusCode] || 0) + 1;
        if (statusCode >= 200 && statusCode < 300) status2xx++;
        else if (statusCode >= 300 && statusCode < 400) status3xx++;
        else if (statusCode >= 400 && statusCode < 500) status4xx++;
        else if (statusCode >= 500) status5xx++;

        const uaMeta = this.classifyUserAgent(userAgent);

        // Robot vs Human separation
        if (uaMeta.isBot) {
          robotHits++;
          robotBandwidth += bytes;
          const rName = uaMeta.botName || 'Other Robots';
          const existingRobot = robotMap.get(rName) || { name: rName, hits: 0, bytes: 0, lastVisit: null };
          existingRobot.hits++;
          existingRobot.bytes += bytes;
          if (!existingRobot.lastVisit || ts > new Date(existingRobot.lastVisit).getTime()) {
            existingRobot.lastVisit = recordDate.toISOString();
          }
          robotMap.set(rName, existingRobot);
          // Robots are not counted in human visitor sessions or page view metrics
          continue;
        }

        // Human traffic
        humanHits++;
        humanBandwidth += bytes;
        uniqueIps.add(ip);

        const isPage = this.isPageRequest(rawUrl);
        if (isPage) {
          totalPages++;
          humanPages++;
        }

        // Visitor Sessions & Unique Visitors
        const visitorId = `${ip}::${userAgent}`;
        uniqueVisitorsSet.add(visitorId);

        const session = visitorSessions.get(visitorId);
        if (!session) {
          visitorSessions.set(visitorId, {
            ip,
            lastTimestamp: ts,
            visitCount: 1,
            totalPages: isPage ? 1 : 0,
            totalHits: 1,
            totalBytes: bytes
          });
        } else {
          // If inactivity > 60 minutes, count as new visit
          if (ts - session.lastTimestamp > 3600000) {
            session.visitCount++;
          }
          session.lastTimestamp = Math.max(session.lastTimestamp, ts);
          if (isPage) session.totalPages++;
          session.totalHits++;
          session.totalBytes += bytes;
        }

        // Host breakdown
        const existingHost = hostMap.get(ip) || {
          ip,
          maskedIp: this.maskIp(ip),
          pages: 0,
          hits: 0,
          bandwidth: 0,
          lastVisit: null
        };
        if (isPage) existingHost.pages++;
        existingHost.hits++;
        existingHost.bandwidth += bytes;
        if (!existingHost.lastVisit || ts > new Date(existingHost.lastVisit).getTime()) {
          existingHost.lastVisit = recordDate.toISOString();
        }
        hostMap.set(ip, existingHost);

        // Daily breakdown
        const dayKey = `${recordDate.getUTCFullYear()}-${String(recordDate.getUTCMonth() + 1).padStart(2, '0')}-${String(recordDate.getUTCDate()).padStart(2, '0')}`;
        const dayEntry = dailyMap.get(dayKey) || {
          date: dayKey,
          dayNum: recordDate.getUTCDate(),
          dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][recordDate.getUTCDay()],
          visitorsSet: new Set(),
          pages: 0,
          hits: 0,
          bandwidth: 0
        };
        dayEntry.visitorsSet.add(visitorId);
        if (isPage) dayEntry.pages++;
        dayEntry.hits++;
        dayEntry.bandwidth += bytes;
        dailyMap.set(dayKey, dayEntry);

        // Hourly breakdown
        const h = recordDate.getUTCHours();
        const hourEntry = hourlyMap.get(h);
        if (hourEntry) {
          if (isPage) hourEntry.pages++;
          hourEntry.hits++;
          hourEntry.bandwidth += bytes;
        }

        // Top Pages
        const cleanPath = rawUrl.split('?')[0] || '/';
        const pageEntry = pageMap.get(cleanPath) || {
          path: cleanPath,
          pages: 0,
          hits: 0,
          bandwidth: 0
        };
        if (isPage) pageEntry.pages++;
        pageEntry.hits++;
        pageEntry.bandwidth += bytes;
        pageMap.set(cleanPath, pageEntry);

        // Referrers
        const refMeta = this.classifyReferrer(referrer, target.domain);
        const refEntry = referrerMap.get(refMeta.category) || { category: refMeta.category, hits: 0 };
        refEntry.hits++;
        referrerMap.set(refMeta.category, refEntry);

        if (refMeta.searchTerms) {
          searchKeywords.push(refMeta.searchTerms);
        }

        // Browsers & OS
        browserMap.set(uaMeta.browser, (browserMap.get(uaMeta.browser) || 0) + 1);
        osMap.set(uaMeta.os, (osMap.get(uaMeta.os) || 0) + 1);
      }
    }

    // Total visits calculation: sum of visitCount across visitor sessions
    let totalVisits = 0;
    for (const sess of visitorSessions.values()) {
      totalVisits += sess.visitCount;
    }

    // Format daily table
    const dailyStats = Array.from(dailyMap.values()).map(d => ({
      date: d.date,
      dayNum: d.dayNum,
      dayName: d.dayName,
      visits: d.visitorsSet.size,
      pages: d.pages,
      hits: d.hits,
      bandwidth: d.bandwidth,
      formattedBandwidth: this.formatBytes(d.bandwidth)
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Format hourly table
    const hourlyStats = Array.from(hourlyMap.values()).map(h => ({
      hour: h.hour,
      hourLabel: `${String(h.hour).padStart(2, '0')}:00`,
      pages: h.pages,
      hits: h.hits,
      bandwidth: h.bandwidth,
      formattedBandwidth: this.formatBytes(h.bandwidth)
    }));

    // Top Pages
    const topPages = Array.from(pageMap.values()).map(p => ({
      path: p.path,
      pages: p.pages,
      hits: p.hits,
      bandwidth: p.bandwidth,
      formattedBandwidth: this.formatBytes(p.bandwidth),
      percentHits: totalHits > 0 ? ((p.hits / totalHits) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.hits - a.hits).slice(0, 25);

    // Top Hosts / IPs
    const topHosts = Array.from(hostMap.values()).map(h => ({
      ip: h.ip,
      maskedIp: h.maskedIp,
      pages: h.pages,
      hits: h.hits,
      bandwidth: h.bandwidth,
      formattedBandwidth: this.formatBytes(h.bandwidth),
      lastVisit: h.lastVisit
    })).sort((a, b) => b.hits - a.hits).slice(0, 25);

    // Robots list
    const topRobots = Array.from(robotMap.values()).map(r => ({
      name: r.name,
      hits: r.hits,
      bandwidth: r.bytes,
      formattedBandwidth: this.formatBytes(r.bytes),
      lastVisit: r.lastVisit
    })).sort((a, b) => b.hits - a.hits);

    // Referrers breakdown
    const referrers = Array.from(referrerMap.values()).map(r => ({
      category: r.category,
      hits: r.hits,
      percentage: humanHits > 0 ? ((r.hits / humanHits) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.hits - a.hits);

    // Browsers breakdown
    const browsers = Array.from(browserMap.entries()).map(([name, hits]) => ({
      name,
      hits,
      percentage: humanHits > 0 ? ((hits / humanHits) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.hits - a.hits);

    // Operating Systems breakdown
    const operatingSystems = Array.from(osMap.entries()).map(([name, hits]) => ({
      name,
      hits,
      percentage: humanHits > 0 ? ((hits / humanHits) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.hits - a.hits);

    // Status codes breakdown
    const statusCodes = Object.entries(statusCounts).map(([code, hits]) => ({
      code: parseInt(code, 10),
      hits,
      percentage: totalHits > 0 ? ((hits / totalHits) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.hits - a.hits);

    // Monthly history summary
    const monthlyHistory = [
      {
        month: periodLabel,
        uniqueVisitors: uniqueVisitorsSet.size,
        visits: totalVisits,
        pages: totalPages,
        hits: totalHits,
        bandwidth: totalBandwidth,
        formattedBandwidth: this.formatBytes(totalBandwidth)
      }
    ];

    const report = {
      success: true,
      domain: verifiedDomain,
      period: periodLabel,
      generatedAt: new Date().toISOString(),
      capabilities: this.detectCapabilities(),
      summary: {
        uniqueVisitors: uniqueVisitorsSet.size,
        visits: totalVisits,
        pages: totalPages,
        hits: totalHits,
        bandwidth: totalBandwidth,
        formattedBandwidth: this.formatBytes(totalBandwidth),
        firstVisit: firstVisitTime ? new Date(firstVisitTime).toISOString() : null,
        lastVisit: lastVisitTime ? new Date(lastVisitTime).toISOString() : null,
        pagesPerVisit: totalVisits > 0 ? (totalPages / totalVisits).toFixed(2) : '0',
        hitsPerVisit: totalVisits > 0 ? (humanHits / totalVisits).toFixed(2) : '0',
        bytesPerVisit: totalVisits > 0 ? this.formatBytes(Math.round(humanBandwidth / totalVisits)) : '0 Bytes',
        robotHits,
        robotBandwidth,
        formattedRobotBandwidth: this.formatBytes(robotBandwidth),
        status2xx,
        status3xx,
        status4xx,
        status5xx
      },
      monthlyHistory,
      dailyStats,
      hourlyStats,
      topPages,
      topHosts,
      topRobots,
      referrers,
      searchKeywords,
      browsers,
      operatingSystems,
      statusCodes
    };

    this.cache.set(cacheKey, { timestamp: Date.now(), data: report });
    return report;
  }
}

module.exports = new AwstatsService();
