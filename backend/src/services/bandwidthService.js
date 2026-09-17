/**
 * bandwidthService.js
 * Authoritative Bandwidth Accounting & Reporting Service for cPanel Jupiter
 * Feature #27: Metrics -> Bandwidth
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const storageService = require('./storageService');
const domainService = require('./domainService');

const WHM_ACCOUNTS_FILE = path.resolve(__dirname, '../../data/whm_accounts.json');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_MAP = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
};

// Apache Combined Log Format:
// 127.0.0.1 - - [16/Sep/2026:14:22:30 +0000] "GET /index.html HTTP/1.1" 200 4521 "https://google.com" "Mozilla/5.0..."
const COMBINED_LOG_REGEX = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+)(?: +([^"]*?)(?: +(HTTP\/\S+))?)?" (\d{3}) (\d+|-)(?: "([^"]*)" "([^"]*)")?$/;

class BandwidthService {
  constructor() {
    this.cache = new Map();
    this.cacheTtlMs = 15000; // 15 seconds cache to balance responsiveness and I/O efficiency
  }

  /**
   * Format byte count into human-readable representation with standard binary prefixes
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
   * Parse Apache date string to Date object
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
   * Get account plan details and bandwidth limit
   */
  getAccountBandwidthLimit(username = 'cpanel_user') {
    let limitMb = 50000; // Default 50,000 MB (cPanel Standard Hosting)
    let isUnlimited = false;
    let plan = 'Standard Shared Hosting';

    try {
      if (fs.existsSync(WHM_ACCOUNTS_FILE)) {
        const accts = JSON.parse(fs.readFileSync(WHM_ACCOUNTS_FILE, 'utf8'));
        const found = accts.find(a => a.user === username);
        if (found) {
          plan = found.plan || plan;
          if (found.bwlimit) {
            const bwStr = String(found.bwlimit).toLowerCase().trim();
            if (bwStr === 'unlimited' || bwStr === '0' || bwStr === 'unlim') {
              isUnlimited = true;
              limitMb = null;
            } else {
              const num = parseInt(bwStr, 10);
              if (!isNaN(num) && num > 0) {
                limitMb = num;
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('[BandwidthService] Error reading WHM account limits:', e.message);
    }

    const limitBytes = isUnlimited ? null : limitMb * 1024 * 1024;

    return {
      plan,
      isUnlimited,
      limitMb,
      limitBytes,
      limitFormatted: isUnlimited ? 'Unlimited' : this.formatBytes(limitBytes)
    };
  }

  /**
   * Resolve time range boundaries in UTC milliseconds
   */
  resolveTimeRange(period = 'current_month', customStart = null, customEnd = null) {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();

    let minTime = 0;
    let maxTime = now.getTime();
    let periodLabel = 'Current Month';

    switch (period) {
      case 'today':
      case '24h': {
        const startOfDay = new Date(Date.UTC(currentYear, currentMonth, now.getUTCDate(), 0, 0, 0));
        minTime = startOfDay.getTime();
        maxTime = now.getTime();
        periodLabel = 'Today';
        break;
      }
      case 'yesterday': {
        const startOfYesterday = new Date(Date.UTC(currentYear, currentMonth, now.getUTCDate() - 1, 0, 0, 0));
        const endOfYesterday = new Date(Date.UTC(currentYear, currentMonth, now.getUTCDate(), 0, 0, 0) - 1);
        minTime = startOfYesterday.getTime();
        maxTime = endOfYesterday.getTime();
        periodLabel = 'Yesterday';
        break;
      }
      case '7days': {
        minTime = now.getTime() - (7 * 24 * 3600 * 1000);
        maxTime = now.getTime();
        periodLabel = 'Last 7 Days';
        break;
      }
      case '30days': {
        minTime = now.getTime() - (30 * 24 * 3600 * 1000);
        maxTime = now.getTime();
        periodLabel = 'Last 30 Days';
        break;
      }
      case 'previous_month': {
        const prevMonthDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0));
        const prevYear = prevMonthDate.getUTCFullYear();
        const prevMonth = prevMonthDate.getUTCMonth();
        const startOfPrev = new Date(Date.UTC(prevYear, prevMonth, 1, 0, 0, 0));
        const endOfPrev = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0) - 1);
        minTime = startOfPrev.getTime();
        maxTime = endOfPrev.getTime();
        periodLabel = `${MONTH_NAMES[prevMonth]} ${prevYear} (Previous Month)`;
        break;
      }
      case 'custom': {
        if (customStart) {
          const sd = new Date(customStart);
          if (!isNaN(sd.getTime())) {
            minTime = Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate(), 0, 0, 0);
          }
        }
        if (customEnd) {
          const ed = new Date(customEnd);
          if (!isNaN(ed.getTime())) {
            maxTime = Date.UTC(ed.getUTCFullYear(), ed.getUTCMonth(), ed.getUTCDate(), 23, 59, 59, 999);
          }
        }
        periodLabel = 'Custom Range';
        break;
      }
      case 'current_month':
      default: {
        const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0));
        // End of current month
        const nextMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 1, 0, 0, 0));
        const endOfMonth = new Date(nextMonth.getTime() - 1);
        minTime = startOfMonth.getTime();
        maxTime = endOfMonth.getTime();
        periodLabel = `${MONTH_NAMES[currentMonth]} ${currentYear} (Current Billing Cycle)`;
        break;
      }
    }

    return {
      period,
      periodLabel,
      minTime,
      maxTime,
      startDate: new Date(minTime).toISOString(),
      endDate: new Date(maxTime).toISOString()
    };
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
   * Process a single log file and extract traffic between minTime and maxTime
   */
  async processLogFile(filePath, minTime, maxTime) {
    if (!fs.existsSync(filePath)) return { bytes: 0, requests: 0, daily: {}, hourly: {} };

    let totalBytes = 0;
    let totalRequests = 0;
    const daily = {};
    const hourly = {};

    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let linesCount = 0;

    for await (const line of rl) {
      linesCount++;
      if (linesCount > 20000) break; // Bounded to prevent runaway execution on massive logs

      const match = line.match(COMBINED_LOG_REGEX);
      if (!match) continue;

      const dateObj = this.parseApacheDate(match[2]);
      if (!dateObj) continue;

      const time = dateObj.getTime();
      if (time < minTime || time > maxTime) continue;

      // Extract response bytes: match[7]
      const rawBytes = match[7];
      const bytes = rawBytes === '-' ? 0 : (parseInt(rawBytes, 10) || 0);

      totalBytes += bytes;
      totalRequests += 1;

      // Daily grouping: YYYY-MM-DD
      const year = dateObj.getUTCFullYear();
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      const dayKey = `${year}-${month}-${day}`;

      if (!daily[dayKey]) {
        daily[dayKey] = { bytes: 0, requests: 0 };
      }
      daily[dayKey].bytes += bytes;
      daily[dayKey].requests += 1;

      // Hourly grouping for today
      if (time >= startOfTodayMs) {
        const hourStr = String(dateObj.getUTCHours()).padStart(2, '0');
        if (!hourly[hourStr]) {
          hourly[hourStr] = { bytes: 0, requests: 0 };
        }
        hourly[hourStr].bytes += bytes;
        hourly[hourStr].requests += 1;
      }
    }

    return { bytes: totalBytes, requests: totalRequests, daily, hourly };
  }

  /**
   * Get full accounting data for user, domain, and period
   */
  async getBandwidthData({
    username = 'cpanel_user',
    domain = 'ALL',
    period = 'current_month',
    startDate = null,
    endDate = null,
    forceRefresh = false
  } = {}) {
    this.verifyDomainAuthorized(domain, username);

    const timeRange = this.resolveTimeRange(period, startDate, endDate);
    const cacheKey = `${username}:${domain}:${period}:${timeRange.minTime}:${timeRange.maxTime}`;

    if (!forceRefresh && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTtlMs) {
        return cached.data;
      }
    }

    const logsDir = this.getLogsDir(username);
    const authorizedDomains = this.getAuthorizedDomains(username);
    const limitInfo = this.getAccountBandwidthLimit(username);

    // Target domains to scan
    let domainsToScan = authorizedDomains;
    if (domain && domain !== 'ALL' && domain !== 'all') {
      const clean = domain.toLowerCase().replace(/\.+$/, '').trim();
      domainsToScan = authorizedDomains.filter(d => d.name === clean);
    }

    let accountTotalBytes = 0;
    let accountTotalRequests = 0;
    const domainSummaries = [];
    const aggregatedDaily = {};
    const aggregatedHourly = {};

    // Initialize 24-hour hourly slots
    for (let i = 0; i < 24; i++) {
      const hStr = String(i).padStart(2, '0');
      aggregatedHourly[hStr] = { hour: `${hStr}:00`, bytes: 0, requests: 0 };
    }

    // Process each authorized domain's dedicated log file (guarantees NO DOUBLE COUNTING)
    for (const d of domainsToScan) {
      const domainLog = path.join(logsDir, `${d.name}.log`);
      const res = await this.processLogFile(domainLog, timeRange.minTime, timeRange.maxTime);

      // Check rotated logs if any (e.g. domain.log.1)
      const rotated1 = path.join(logsDir, `${d.name}.log.1`);
      if (fs.existsSync(rotated1)) {
        const resRot = await this.processLogFile(rotated1, timeRange.minTime, timeRange.maxTime);
        res.bytes += resRot.bytes;
        res.requests += resRot.requests;
        for (const [k, v] of Object.entries(resRot.daily)) {
          if (!res.daily[k]) res.daily[k] = { bytes: 0, requests: 0 };
          res.daily[k].bytes += v.bytes;
          res.daily[k].requests += v.requests;
        }
        for (const [k, v] of Object.entries(resRot.hourly)) {
          if (!res.hourly[k]) res.hourly[k] = { bytes: 0, requests: 0 };
          res.hourly[k].bytes += v.bytes;
          res.hourly[k].requests += v.requests;
        }
      }

      accountTotalBytes += res.bytes;
      accountTotalRequests += res.requests;

      domainSummaries.push({
        domain: d.name,
        type: d.type,
        bytes: res.bytes,
        formattedBytes: this.formatBytes(res.bytes),
        requests: res.requests
      });

      // Merge daily
      for (const [k, v] of Object.entries(res.daily)) {
        if (!aggregatedDaily[k]) {
          aggregatedDaily[k] = { bytes: 0, requests: 0 };
        }
        aggregatedDaily[k].bytes += v.bytes;
        aggregatedDaily[k].requests += v.requests;
      }

      // Merge hourly
      for (const [k, v] of Object.entries(res.hourly)) {
        if (aggregatedHourly[k]) {
          aggregatedHourly[k].bytes += v.bytes;
          aggregatedHourly[k].requests += v.requests;
        }
      }
    }

    // Compute percentages for domains
    domainSummaries.forEach(ds => {
      ds.percentOfTotal = accountTotalBytes > 0
        ? parseFloat(((ds.bytes / accountTotalBytes) * 100).toFixed(1))
        : 0;
    });

    // Sort domain summaries descending by bandwidth
    domainSummaries.sort((a, b) => b.bytes - a.bytes);

    // Format daily timeline
    const timeline = Object.keys(aggregatedDaily)
      .sort()
      .map(dayKey => {
        const item = aggregatedDaily[dayKey];
        return {
          date: dayKey,
          bytes: item.bytes,
          formattedBytes: this.formatBytes(item.bytes),
          requests: item.requests,
          percentOfTotal: accountTotalBytes > 0
            ? parseFloat(((item.bytes / accountTotalBytes) * 100).toFixed(1))
            : 0
        };
      });

    // Format hourly timeline
    const hourlyTimeline = Object.keys(aggregatedHourly)
      .sort()
      .map(k => {
        const item = aggregatedHourly[k];
        return {
          hour: item.hour,
          bytes: item.bytes,
          formattedBytes: this.formatBytes(item.bytes),
          requests: item.requests
        };
      });

    // Compute account limits, percentage, and remaining
    let remainingBytes = null;
    let usagePercent = 0;
    let isOverLimit = false;

    if (!limitInfo.isUnlimited && limitInfo.limitBytes > 0) {
      remainingBytes = Math.max(0, limitInfo.limitBytes - accountTotalBytes);
      usagePercent = parseFloat(((accountTotalBytes / limitInfo.limitBytes) * 100).toFixed(2));
      isOverLimit = accountTotalBytes > limitInfo.limitBytes;
    }

    const payload = {
      success: true,
      lastUpdated: new Date().toISOString(),
      account: {
        user: username,
        plan: limitInfo.plan,
        isUnlimited: limitInfo.isUnlimited,
        limitBytes: limitInfo.limitBytes,
        limitFormatted: limitInfo.limitFormatted,
        usedBytes: accountTotalBytes,
        usedFormatted: this.formatBytes(accountTotalBytes),
        remainingBytes,
        remainingFormatted: limitInfo.isUnlimited ? 'Unlimited' : this.formatBytes(remainingBytes),
        usagePercent,
        isOverLimit,
        totalRequests: accountTotalRequests
      },
      period: {
        id: timeRange.period,
        label: timeRange.periodLabel,
        startDate: timeRange.startDate,
        endDate: timeRange.endDate
      },
      trafficBreakdown: [
        {
          service: 'HTTP / HTTPS Web Traffic',
          bytes: accountTotalBytes,
          formattedBytes: this.formatBytes(accountTotalBytes),
          requests: accountTotalRequests,
          percent: 100
        }
      ],
      domains: domainSummaries,
      timeline,
      hourly: hourlyTimeline
    };

    // Cache the result
    this.cache.set(cacheKey, { timestamp: Date.now(), data: payload });

    return payload;
  }

  /**
   * Flush cache for a user
   */
  flushCache(username) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${username}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Single source of truth summary for SidebarStats and MetricsService
   */
  async getAccountBandwidthSummary(username = 'cpanel_user') {
    const data = await this.getBandwidthData({ username, period: 'current_month' });
    const usedMb = parseFloat((data.account.usedBytes / (1024 * 1024)).toFixed(2));
    const limitMb = data.account.isUnlimited ? 'unlimited' : (data.account.limitBytes ? Math.round(data.account.limitBytes / (1024 * 1024)) : 50000);
    const usagePercent = Math.round(data.account.usagePercent || 0);

    return {
      usedBytes: data.account.usedBytes,
      usedMb,
      limitMb,
      usagePercent,
      isUnlimited: data.account.isUnlimited
    };
  }
}

module.exports = new BandwidthService();
