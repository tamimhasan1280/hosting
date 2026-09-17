/**
 * siteQualityService.js
 * Feature #25: Site Quality Monitoring Service
 * 
 * Provides authentic website health, uptime, performance, SSL/TLS,
 * and DNS monitoring with strict SSRF defenses and background scheduling.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const tls = require('tls');
const dns = require('dns').promises;
const crypto = require('crypto');
const domainService = require('./domainService');

const MONITORING_DIR = path.resolve(__dirname, '../../data/monitoring');
const MONITORS_FILE = path.join(MONITORING_DIR, 'monitors.json');
const CHECKS_FILE = path.join(MONITORING_DIR, 'checks.json');
const INCIDENTS_FILE = path.join(MONITORING_DIR, 'incidents.json');

// Supported monitoring intervals (minutes)
const VALID_INTERVALS = [5, 15, 30, 60];
const DEFAULT_INTERVAL = 15;
const MAX_MONITORS_PER_ACCOUNT = 10;
const MANUAL_CHECK_COOLDOWN_MS = 10000; // 10 seconds cooldown
const MAX_HISTORY_PER_MONITOR = 100;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB response limit
const REQUEST_TIMEOUT_MS = 10000; // 10s request timeout

function ensureStores() {
  if (!fs.existsSync(MONITORING_DIR)) {
    fs.mkdirSync(MONITORING_DIR, { recursive: true });
  }
  if (!fs.existsSync(MONITORS_FILE)) {
    fs.writeFileSync(MONITORS_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
  if (!fs.existsSync(CHECKS_FILE)) {
    fs.writeFileSync(CHECKS_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
  if (!fs.existsSync(INCIDENTS_FILE)) {
    fs.writeFileSync(INCIDENTS_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
}

// ==========================================
// SSRF PROTECTION HELPERS
// ==========================================

function ipToLong(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function inCidr(ip, cidr) {
  const [range, bits = 32] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);
  return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
}

const BLOCKED_IPV4_CIDRS = [
  '0.0.0.0/8',         // Current network (RFC 1122)
  '10.0.0.0/8',        // Private-Use (RFC 1918)
  '100.64.0.0/10',     // Shared Address Space (RFC 6598)
  '127.0.0.0/8',       // Loopback (RFC 1122)
  '169.254.0.0/16',    // Link-Local / APIPA / Cloud Metadata (RFC 3927)
  '172.16.0.0/12',     // Private-Use (RFC 1918)
  '192.0.0.0/24',      // IETF Protocol Assignments (RFC 6890)
  '192.0.2.0/24',      // TEST-NET-1 (RFC 5737)
  '192.168.0.0/16',    // Private-Use (RFC 1918)
  '198.51.100.0/24',   // TEST-NET-2 (RFC 5737)
  '203.0.113.0/24',    // TEST-NET-3 (RFC 5737)
  '224.0.0.0/4',       // Multicast (RFC 5771)
  '240.0.0.0/4',       // Reserved for Future Use (RFC 1112)
  '255.255.255.255/32' // Limited Broadcast (RFC 919)
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254',
  'instance-data'
];

function isSsrfBlockedIp(ipStr) {
  if (!ipStr || typeof ipStr !== 'string') return true;
  const clean = ipStr.trim().toLowerCase();

  // IPv6 Checks
  if (clean.includes(':')) {
    // Loopback / Unspecified
    if (clean === '::1' || clean === '::' || clean === '0:0:0:0:0:0:0:1') return true;
    // IPv4-mapped IPv6 ::ffff:192.0.2.1
    if (clean.startsWith('::ffff:')) {
      const v4 = clean.replace('::ffff:', '');
      return isSsrfBlockedIp(v4);
    }
    // Unique Local (fc00::/7 -> fc.. or fd..)
    if (/^f[cd][0-9a-f]{2}:/i.test(clean)) return true;
    // Link-Local (fe80::/10 -> fe80: to febf:)
    if (/^fe[89ab][0-9a-f]:/i.test(clean)) return true;
    // Multicast (ff00::/8)
    if (/^ff[0-9a-f]{2}:/i.test(clean)) return true;
    return false;
  }

  // IPv4 Checks
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(clean)) {
    for (const cidr of BLOCKED_IPV4_CIDRS) {
      if (inCidr(clean, cidr)) {
        return true;
      }
    }
    return false;
  }

  return true; // Malformed IP
}

function isSsrfBlockedHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') return true;
  const clean = hostname.trim().toLowerCase().replace(/\.+$/, '');

  for (const b of BLOCKED_HOSTNAMES) {
    if (clean === b || clean.endsWith(`.${b}`)) {
      return true;
    }
  }

  if (clean.endsWith('.local') || clean.endsWith('.internal') || clean.endsWith('.lan')) {
    return true;
  }

  // Pure IP passed as hostname
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(clean)) {
    return isSsrfBlockedIp(clean);
  }

  return false;
}

function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class SiteQualityService {
  constructor() {
    ensureStores();
    this.activeChecks = new Set(); // Prevent concurrent duplicate checks per monitor
    this.lastManualChecks = new Map(); // Cooldown tracking per monitor ID
    this.startScheduler();
  }

  // ==========================================
  // STORAGE HELPERS (Scoped per cpanel user)
  // ==========================================

  _readMonitors() {
    ensureStores();
    try {
      return JSON.parse(fs.readFileSync(MONITORS_FILE, 'utf8'));
    } catch (e) {
      return {};
    }
  }

  _writeMonitors(data) {
    ensureStores();
    fs.writeFileSync(MONITORS_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  _readChecks() {
    ensureStores();
    try {
      return JSON.parse(fs.readFileSync(CHECKS_FILE, 'utf8'));
    } catch (e) {
      return {};
    }
  }

  _writeChecks(data) {
    ensureStores();
    fs.writeFileSync(CHECKS_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  _readIncidents() {
    ensureStores();
    try {
      return JSON.parse(fs.readFileSync(INCIDENTS_FILE, 'utf8'));
    } catch (e) {
      return {};
    }
  }

  _writeIncidents(data) {
    ensureStores();
    fs.writeFileSync(INCIDENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  // ==========================================
  // AUTHORIZED DOMAIN DISCOVERY
  // ==========================================

  getAuthorizedDomains(username = 'cpanel_user') {
    const data = domainService._read(username);
    const list = [];

    const addTarget = (name, type) => {
      const clean = (name || '').trim().toLowerCase().replace(/\.+$/, '');
      if (!clean || list.some(d => d.domain === clean)) return;
      list.push({
        domain: clean,
        type,
        defaultUrl: `https://${clean}`
      });
    };

    if (data.primaryDomain) {
      addTarget(data.primaryDomain, 'Primary Domain');
    }
    (data.domains || []).forEach(d => addTarget(d.name, d.type || 'Addon Domain'));
    (data.subdomains || []).forEach(s => addTarget(s.name, 'Subdomain'));
    (data.aliases || []).forEach(a => addTarget(a.name, 'Alias'));

    return list;
  }

  verifyDomainAuthorized(domain, username = 'cpanel_user') {
    if (!domain || typeof domain !== 'string') {
      throw new Error('Domain name is required');
    }
    const clean = domain.trim().toLowerCase().replace(/\.+$/, '');
    const authorized = this.getAuthorizedDomains(username);
    const match = authorized.find(d => d.domain === clean);
    if (!match) {
      throw new Error(`Access denied: Domain "${domain}" does not belong to hosting account "${username}".`);
    }
    return clean;
  }

  // ==========================================
  // REAL NETWORK CHECK ENGINE
  // ==========================================

  /**
   * Resolve DNS and validate against SSRF
   */
  async resolveDnsSafe(hostname) {
    const cleanHost = (hostname || '').trim().toLowerCase().replace(/\.+$/, '');
    if (isSsrfBlockedHostname(cleanHost)) {
      throw new Error(`SSRF_BLOCKED: Hostname "${cleanHost}" resolves to a restricted or internal address space.`);
    }

    const start = Date.now();
    let addresses = [];

    try {
      const res = await dns.lookup(cleanHost, { all: true });
      addresses = Array.isArray(res) ? res : [res];
    } catch (err) {
      const dnsTime = Date.now() - start;
      return {
        success: false,
        hostname: cleanHost,
        dnsTime,
        error: `DNS resolution failed: ${err.message}`,
        addresses: []
      };
    }

    const dnsTime = Date.now() - start;

    if (!addresses || addresses.length === 0) {
      return {
        success: false,
        hostname: cleanHost,
        dnsTime,
        error: 'No IP addresses found for hostname',
        addresses: []
      };
    }

    // SSRF Check every resolved IP address
    for (const addr of addresses) {
      const ip = addr.address;
      if (isSsrfBlockedIp(ip)) {
        throw new Error(`SSRF_BLOCKED: Hostname "${cleanHost}" resolved to restricted IP address "${ip}".`);
      }
    }

    return {
      success: true,
      hostname: cleanHost,
      dnsTime,
      addresses: addresses.map(a => a.address),
      primaryIp: addresses[0].address
    };
  }

  /**
   * Perform real TLS connection and inspect peer certificate
   */
  async inspectTls(hostname, port = 443) {
    const cleanHost = (hostname || '').trim().toLowerCase().replace(/\.+$/, '');
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = tls.connect(
        {
          host: cleanHost,
          port,
          servername: cleanHost,
          minVersion: 'TLSv1.2',
          timeout: 5000,
          rejectUnauthorized: false // We inspect validity ourselves to capture exact error
        },
        () => {
          const tlsTime = Date.now() - start;
          let cert = null;
          try {
            cert = socket.getPeerCertificate();
          } catch (e) {}

          const authorized = socket.authorized;
          const authError = socket.authorizationError;

          socket.end();

          if (!cert || Object.keys(cert).length === 0) {
            return resolve({
              success: false,
              tlsTime,
              status: 'TLS connection failed',
              error: 'No certificate presented by remote host'
            });
          }

          const validFrom = cert.valid_from ? new Date(cert.valid_from).toISOString() : null;
          const validTo = cert.valid_to ? new Date(cert.valid_to).toISOString() : null;
          const now = Date.now();
          const expireTime = cert.valid_to ? new Date(cert.valid_to).getTime() : 0;
          const daysRemaining = Math.floor((expireTime - now) / (1000 * 60 * 60 * 24));

          let certStatus = 'Certificate valid';
          if (daysRemaining < 0) {
            certStatus = 'Certificate expired';
          } else if (daysRemaining <= 14) {
            certStatus = 'Certificate expiring soon';
          }

          if (!authorized && authError) {
            if (authError.includes('ERR_TLS_CERT_ALTNAME_INVALID')) {
              certStatus = 'Certificate hostname mismatch';
            } else if (certStatus === 'Certificate valid') {
              certStatus = `Unable to verify (${authError})`;
            }
          }

          resolve({
            success: true,
            tlsTime,
            status: certStatus,
            authorized,
            issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown Authority',
            subject: cert.subject?.CN || cleanHost,
            validFrom,
            validTo,
            daysRemaining,
            error: !authorized ? authError : null
          });
        }
      );

      socket.on('error', (err) => {
        resolve({
          success: false,
          tlsTime: Date.now() - start,
          status: 'TLS connection failed',
          error: err.message
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          success: false,
          tlsTime: 5000,
          status: 'TLS connection failed',
          error: 'TLS handshake timed out'
        });
      });
    });
  }

  /**
   * Perform safe HTTP / HTTPS check with redirect tracking
   */
  async executeHttpCheck(targetUrl, maxRedirects = 5) {
    let currentUrl = targetUrl;
    let redirectCount = 0;
    const redirectHistory = [];

    const overallStart = Date.now();

    while (redirectCount <= maxRedirects) {
      let parsedUrl;
      try {
        parsedUrl = new URL(currentUrl);
      } catch (err) {
        throw new Error(`Invalid URL format: "${currentUrl}"`);
      }

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error(`SSRF_BLOCKED: Unsupported protocol "${parsedUrl.protocol}"`);
      }

      const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (parsedUrl.protocol === 'https:' ? 443 : 80);
      if (port !== 80 && port !== 443) {
        throw new Error(`SSRF_BLOCKED: Prohibited port "${port}". Only standard ports 80 and 443 are permitted.`);
      }

      // Pre-check DNS & SSRF on target hostname
      const dnsResult = await this.resolveDnsSafe(parsedUrl.hostname);
      if (!dnsResult.success) {
        return {
          success: false,
          statusCode: 0,
          responseTime: Date.now() - overallStart,
          errorCategory: 'DNS_ERROR',
          errorMessage: dnsResult.error,
          finalUrl: currentUrl,
          redirectCount,
          dns: dnsResult
        };
      }

      // Check TLS if HTTPS
      let tlsResult = null;
      if (parsedUrl.protocol === 'https:') {
        tlsResult = await this.inspectTls(parsedUrl.hostname, port);
      }

      // Execute HTTP request
      const httpModule = parsedUrl.protocol === 'https:' ? https : http;
      const stepResult = await new Promise((resolve) => {
        const reqStart = Date.now();
        let ttfbRecorded = false;
        let ttfb = 0;

        const req = httpModule.request(
          currentUrl,
          {
            method: 'GET',
            timeout: REQUEST_TIMEOUT_MS,
            headers: {
              'User-Agent': 'cPanel-SiteQualityMonitor/1.0 (+https://cpanel.net/site-quality)',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Connection': 'close'
            }
          },
          (res) => {
            ttfb = Date.now() - reqStart;
            ttfbRecorded = true;

            let receivedBytes = 0;
            let responseBody = '';

            res.on('data', (chunk) => {
              receivedBytes += chunk.length;
              if (receivedBytes > MAX_RESPONSE_BYTES) {
                res.destroy(); // Limit response size to 2 MB
              } else if (receivedBytes < 64 * 1024) {
                // Buffer first 64KB for title extraction if needed
                responseBody += chunk.toString('utf8', 0, Math.min(chunk.length, 1024));
              }
            });

            res.on('end', () => {
              const reqTime = Date.now() - reqStart;
              resolve({
                success: true,
                statusCode: res.statusCode,
                statusMessage: res.statusMessage,
                headers: res.headers,
                responseTime: reqTime,
                ttfb,
                contentLength: receivedBytes,
                responseSample: responseBody
              });
            });

            res.on('error', (err) => {
              resolve({
                success: false,
                statusCode: 0,
                responseTime: Date.now() - reqStart,
                ttfb,
                errorCategory: 'CONNECTION_FAILED',
                errorMessage: err.message
              });
            });
          }
        );

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            statusCode: 0,
            responseTime: REQUEST_TIMEOUT_MS,
            ttfb: 0,
            errorCategory: 'CONNECTION_TIMEOUT',
            errorMessage: 'HTTP connection timed out after 10 seconds'
          });
        });

        req.on('error', (err) => {
          resolve({
            success: false,
            statusCode: 0,
            responseTime: Date.now() - reqStart,
            ttfb: 0,
            errorCategory: err.code === 'ECONNREFUSED' ? 'CONNECTION_FAILED' : 'HTTP_ERROR',
            errorMessage: err.message
          });
        });

        req.end();
      });

      if (!stepResult.success) {
        return {
          success: false,
          statusCode: stepResult.statusCode,
          responseTime: Date.now() - overallStart,
          ttfb: stepResult.ttfb,
          errorCategory: stepResult.errorCategory,
          errorMessage: stepResult.errorMessage,
          finalUrl: currentUrl,
          redirectCount,
          dns: dnsResult,
          tls: tlsResult
        };
      }

      // Check for redirect (301, 302, 307, 308)
      if ([301, 302, 303, 307, 308].includes(stepResult.statusCode) && stepResult.headers?.location) {
        const nextTarget = new URL(stepResult.headers.location, currentUrl).href;
        redirectHistory.push({
          from: currentUrl,
          to: nextTarget,
          statusCode: stepResult.statusCode
        });
        redirectCount++;
        currentUrl = nextTarget;
        continue;
      }

      // Final destination reached
      const totalTime = Date.now() - overallStart;
      return {
        success: true,
        statusCode: stepResult.statusCode,
        statusMessage: stepResult.statusMessage,
        responseTime: totalTime,
        ttfb: stepResult.ttfb,
        contentLength: stepResult.contentLength,
        initialUrl: targetUrl,
        finalUrl: currentUrl,
        redirectCount,
        redirectHistory,
        dns: dnsResult,
        tls: tlsResult
      };
    }

    return {
      success: false,
      statusCode: 310,
      responseTime: Date.now() - overallStart,
      errorCategory: 'REDIRECT_ERROR',
      errorMessage: `Exceeded maximum redirect depth (${maxRedirects} hops)`,
      finalUrl: currentUrl,
      redirectCount
    };
  }

  /**
   * Full comprehensive monitor check execution
   */
  async executeCheck(monitor, username = 'cpanel_user') {
    if (this.activeChecks.has(monitor.id)) {
      return { skipped: true, reason: 'Check already in progress' };
    }

    this.activeChecks.add(monitor.id);

    try {
      const targetUrl = monitor.url || `${monitor.scheme || 'https'}://${monitor.domain}`;
      const checkResult = await this.executeHttpCheck(targetUrl);

      // Determine Health State
      let healthState = 'Healthy';
      let errorCategory = null;
      let errorMessage = null;

      if (!checkResult.success) {
        healthState = 'Down';
        errorCategory = checkResult.errorCategory || 'CONNECTION_FAILED';
        errorMessage = checkResult.errorMessage || 'Website check failed';
      } else if (checkResult.statusCode >= 500) {
        healthState = 'Down';
        errorCategory = 'HTTP_ERROR';
        errorMessage = `HTTP server returned ${checkResult.statusCode} ${checkResult.statusMessage || 'Server Error'}`;
      } else if (checkResult.statusCode >= 400) {
        healthState = 'Degraded';
        errorCategory = 'HTTP_ERROR';
        errorMessage = `HTTP client error ${checkResult.statusCode} ${checkResult.statusMessage || 'Client Error'}`;
      } else if (checkResult.responseTime >= 2500) {
        healthState = 'Degraded';
        errorCategory = 'PERFORMANCE_DEGRADED';
        errorMessage = `Slow response time (${checkResult.responseTime}ms exceeds 2500ms threshold)`;
      } else if (checkResult.tls && checkResult.tls.status === 'Certificate expiring soon') {
        healthState = 'Degraded';
        errorCategory = 'TLS_EXPIRING_SOON';
        errorMessage = `SSL certificate expires in ${checkResult.tls.daysRemaining} days`;
      } else if (checkResult.tls && checkResult.tls.status === 'Certificate expired') {
        healthState = 'Down';
        errorCategory = 'TLS_ERROR';
        errorMessage = 'SSL certificate has expired';
      }

      // Check Record Creation
      const checkId = `chk_${crypto.randomBytes(8).toString('hex')}`;
      const timestamp = new Date().toISOString();

      const record = {
        id: checkId,
        monitorId: monitor.id,
        timestamp,
        status: healthState,
        httpStatus: checkResult.statusCode || null,
        responseTime: checkResult.responseTime,
        ttfb: checkResult.ttfb || 0,
        dnsTime: checkResult.dns?.dnsTime || 0,
        tlsTime: checkResult.tls?.tlsTime || 0,
        primaryIp: checkResult.dns?.primaryIp || null,
        sslStatus: checkResult.tls ? checkResult.tls.status : 'N/A',
        sslDaysRemaining: checkResult.tls?.daysRemaining ?? null,
        sslIssuer: checkResult.tls?.issuer || null,
        redirectCount: checkResult.redirectCount || 0,
        finalUrl: checkResult.finalUrl || targetUrl,
        errorCategory,
        errorMessage: errorMessage ? escapeHtml(errorMessage) : null
      };

      // Update Checks History Store
      const allChecks = this._readChecks();
      if (!allChecks[monitor.id]) {
        allChecks[monitor.id] = [];
      }
      allChecks[monitor.id].unshift(record);
      // Retain max history records
      if (allChecks[monitor.id].length > MAX_HISTORY_PER_MONITOR) {
        allChecks[monitor.id] = allChecks[monitor.id].slice(0, MAX_HISTORY_PER_MONITOR);
      }
      this._writeChecks(allChecks);

      // Manage Incident Lifecycle
      const allIncidents = this._readIncidents();
      if (!allIncidents[monitor.id]) {
        allIncidents[monitor.id] = [];
      }

      const activeIncident = allIncidents[monitor.id].find(i => i.status === 'ongoing');

      if (healthState === 'Down' || healthState === 'Degraded') {
        if (!activeIncident) {
          // Open new incident
          const incId = `inc_${crypto.randomBytes(8).toString('hex')}`;
          allIncidents[monitor.id].unshift({
            id: incId,
            monitorId: monitor.id,
            domain: monitor.domain,
            status: 'ongoing',
            severity: healthState === 'Down' ? 'critical' : 'warning',
            detectedAt: timestamp,
            recoveredAt: null,
            durationSeconds: null,
            rootCause: errorMessage || 'Unknown website disruption',
            errorCategory
          });
        } else {
          // Update active incident root cause if more severe
          if (healthState === 'Down') {
            activeIncident.severity = 'critical';
          }
        }
      } else if (healthState === 'Healthy' && activeIncident) {
        // Resolve ongoing incident
        activeIncident.status = 'recovered';
        activeIncident.recoveredAt = timestamp;
        const duration = Math.max(1, Math.round((new Date(timestamp) - new Date(activeIncident.detectedAt)) / 1000));
        activeIncident.durationSeconds = duration;
      }
      this._writeIncidents(allIncidents);

      // Update Monitor State
      const allMonitors = this._readMonitors();
      const userMonitors = allMonitors[username] || [];
      const targetMon = userMonitors.find(m => m.id === monitor.id);

      const nextCheckDate = new Date(Date.now() + (monitor.interval || DEFAULT_INTERVAL) * 60 * 1000).toISOString();

      if (targetMon) {
        targetMon.healthState = healthState;
        targetMon.lastCheckTime = timestamp;
        targetMon.nextCheckTime = targetMon.status === 'Paused' ? null : nextCheckDate;
        targetMon.lastHttpStatus = checkResult.statusCode;
        targetMon.lastResponseTime = checkResult.responseTime;
        targetMon.sslStatus = checkResult.tls ? checkResult.tls.status : 'N/A';
        targetMon.sslDaysRemaining = checkResult.tls?.daysRemaining ?? null;
        targetMon.dnsState = checkResult.dns?.success ? 'Healthy' : 'Error';
        targetMon.primaryIp = checkResult.dns?.primaryIp || targetMon.primaryIp;
        targetMon.lastError = errorMessage;
        targetMon.updatedAt = timestamp;
        this._writeMonitors(allMonitors);
      }

      return {
        success: true,
        record,
        healthState,
        nextCheckTime: nextCheckDate
      };
    } finally {
      this.activeChecks.delete(monitor.id);
    }
  }

  // ==========================================
  // CRUD & MANAGEMENT OPERATIONS
  // ==========================================

  getMonitors(username = 'cpanel_user') {
    const all = this._readMonitors();
    const list = all[username] || [];
    const allChecks = this._readChecks();
    const allIncidents = this._readIncidents();

    return list.map(m => {
      const history = allChecks[m.id] || [];
      const incidents = allIncidents[m.id] || [];
      const activeIncidents = incidents.filter(i => i.status === 'ongoing').length;

      // Compute Truthful Uptime
      let uptime = null;
      if (history.length >= 2) {
        const successful = history.filter(h => h.status === 'Healthy' || h.status === 'Degraded').length;
        uptime = +( (successful / history.length) * 100 ).toFixed(1);
      }

      // Compute Average Response Time
      let avgResponseTime = null;
      if (history.length > 0) {
        const sum = history.reduce((acc, h) => acc + (h.responseTime || 0), 0);
        avgResponseTime = Math.round(sum / history.length);
      }

      return {
        ...m,
        uptime,
        avgResponseTime,
        activeIncidents,
        totalChecksCount: history.length
      };
    });
  }

  getMonitorDetails(monitorId, username = 'cpanel_user') {
    const all = this._readMonitors();
    const userMonitors = all[username] || [];
    const monitor = userMonitors.find(m => m.id === monitorId);

    if (!monitor) {
      throw new Error(`Monitor with ID "${monitorId}" not found or unauthorized.`);
    }

    const allChecks = this._readChecks();
    const allIncidents = this._readIncidents();

    const history = allChecks[monitorId] || [];
    const incidents = allIncidents[monitorId] || [];

    // Compute Truthful Uptime
    let uptime = null;
    if (history.length >= 2) {
      const successful = history.filter(h => h.status === 'Healthy' || h.status === 'Degraded').length;
      uptime = +( (successful / history.length) * 100 ).toFixed(1);
    }

    let avgResponseTime = null;
    if (history.length > 0) {
      const sum = history.reduce((acc, h) => acc + (h.responseTime || 0), 0);
      avgResponseTime = Math.round(sum / history.length);
    }

    return {
      monitor: {
        ...monitor,
        uptime,
        avgResponseTime,
        activeIncidents: incidents.filter(i => i.status === 'ongoing').length
      },
      latestCheck: history[0] || null,
      history: history.slice(0, 50),
      incidents: incidents.slice(0, 25)
    };
  }

  async createMonitor({ domain, scheme = 'https', interval = DEFAULT_INTERVAL, notifyEmail = true }, username = 'cpanel_user') {
    const verifiedDomain = this.verifyDomainAuthorized(domain, username);

    // Validate Interval
    const parsedInterval = parseInt(interval, 10);
    if (!VALID_INTERVALS.includes(parsedInterval)) {
      throw new Error(`Invalid check interval "${interval}". Supported intervals are: ${VALID_INTERVALS.join(', ')} minutes.`);
    }

    const cleanScheme = scheme === 'http' ? 'http' : 'https';
    const targetUrl = `${cleanScheme}://${verifiedDomain}`;

    // Account Limits
    const all = this._readMonitors();
    if (!all[username]) all[username] = [];

    if (all[username].length >= MAX_MONITORS_PER_ACCOUNT) {
      throw new Error(`Account monitor limit reached (${MAX_MONITORS_PER_ACCOUNT} monitors maximum per hosting plan).`);
    }

    // Duplicate Check
    const exists = all[username].find(m => m.domain === verifiedDomain && m.scheme === cleanScheme);
    if (exists) {
      throw new Error(`A monitor for "${targetUrl}" already exists in your account.`);
    }

    const monitorId = `mon_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    const newMonitor = {
      id: monitorId,
      domain: verifiedDomain,
      hostname: verifiedDomain,
      scheme: cleanScheme,
      url: targetUrl,
      status: 'Active',
      interval: parsedInterval,
      lastCheckTime: null,
      nextCheckTime: new Date(Date.now() + 5000).toISOString(), // First check within 5s
      healthState: 'Pending',
      lastHttpStatus: null,
      lastResponseTime: null,
      sslStatus: 'Pending',
      sslDaysRemaining: null,
      dnsState: 'Pending',
      primaryIp: null,
      notifyEmail: !!notifyEmail,
      lastError: null,
      createdAt: now,
      updatedAt: now
    };

    all[username].push(newMonitor);
    this._writeMonitors(all);

    // Trigger Initial Live Check Immediately
    try {
      await this.executeCheck(newMonitor, username);
      this.lastManualChecks.set(monitorId, Date.now());
    } catch (e) {
      // Non-fatal, check will be caught by background runner
    }

    return this.getMonitorDetails(monitorId, username);
  }

  async manualCheck(monitorId, username = 'cpanel_user') {
    const all = this._readMonitors();
    const userMonitors = all[username] || [];
    const monitor = userMonitors.find(m => m.id === monitorId);

    if (!monitor) {
      throw new Error(`Monitor "${monitorId}" not found or unauthorized.`);
    }

    // Rate Limiting: 1 manual check per 10s
    const lastCheck = this.lastManualChecks.get(monitorId) || 0;
    const now = Date.now();
    if (now - lastCheck < MANUAL_CHECK_COOLDOWN_MS) {
      const remainingSecs = Math.ceil((MANUAL_CHECK_COOLDOWN_MS - (now - lastCheck)) / 1000);
      throw new Error(`Rate limit exceeded: Please wait ${remainingSecs} second(s) before checking again.`);
    }

    this.lastManualChecks.set(monitorId, now);

    const checkRes = await this.executeCheck(monitor, username);
    return {
      success: true,
      ...checkRes,
      monitorDetails: this.getMonitorDetails(monitorId, username)
    };
  }

  togglePause(monitorId, username = 'cpanel_user') {
    const all = this._readMonitors();
    const userMonitors = all[username] || [];
    const monitor = userMonitors.find(m => m.id === monitorId);

    if (!monitor) {
      throw new Error(`Monitor "${monitorId}" not found or unauthorized.`);
    }

    const isCurrentlyPaused = monitor.status === 'Paused';
    monitor.status = isCurrentlyPaused ? 'Active' : 'Paused';
    monitor.nextCheckTime = isCurrentlyPaused 
      ? new Date(Date.now() + monitor.interval * 60 * 1000).toISOString()
      : null;
    monitor.updatedAt = new Date().toISOString();

    this._writeMonitors(all);

    return {
      success: true,
      status: monitor.status,
      nextCheckTime: monitor.nextCheckTime
    };
  }

  deleteMonitor(monitorId, username = 'cpanel_user') {
    const all = this._readMonitors();
    const userMonitors = all[username] || [];
    const index = userMonitors.findIndex(m => m.id === monitorId);

    if (index === -1) {
      throw new Error(`Monitor "${monitorId}" not found or unauthorized.`);
    }

    const removed = userMonitors.splice(index, 1)[0];
    this._writeMonitors(all);

    // Cleanup checks and incidents
    const allChecks = this._readChecks();
    delete allChecks[monitorId];
    this._writeChecks(allChecks);

    const allIncidents = this._readIncidents();
    delete allIncidents[monitorId];
    this._writeIncidents(allIncidents);

    this.lastManualChecks.delete(monitorId);

    return {
      success: true,
      deletedMonitorId: monitorId,
      domain: removed.domain
    };
  }

  // ==========================================
  // BACKGROUND SCHEDULER & WORKER
  // ==========================================

  startScheduler() {
    if (this.schedulerInterval) return;

    // Ticks every 30 seconds
    this.schedulerInterval = setInterval(async () => {
      try {
        await this.runSchedulerTick();
      } catch (err) {
        // Suppress scheduler tick errors
      }
    }, 30000);

    // Allow process to terminate cleanly without holding event loop open indefinitely if testing
    if (this.schedulerInterval.unref) {
      this.schedulerInterval.unref();
    }
  }

  async runSchedulerTick() {
    const all = this._readMonitors();
    const now = Date.now();
    const pendingTasks = [];

    for (const [username, monitors] of Object.entries(all)) {
      for (const mon of monitors) {
        if (mon.status === 'Active' && mon.nextCheckTime) {
          const nextTime = new Date(mon.nextCheckTime).getTime();
          if (now >= nextTime && !this.activeChecks.has(mon.id)) {
            pendingTasks.push({ monitor: mon, username });
          }
        }
      }
    }

    // Process tasks with bounded concurrency (max 3 at a time)
    const BATCH_SIZE = 3;
    for (let i = 0; i < pendingTasks.length; i += BATCH_SIZE) {
      const batch = pendingTasks.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(task => this.executeCheck(task.monitor, task.username)));
    }
  }

  destroy() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }
}

module.exports = new SiteQualityService();
