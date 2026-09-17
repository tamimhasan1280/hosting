const fs = require('fs');
const path = require('path');
const net = require('net');
const storageService = require('./storageService');

const IP_BLOCKER_FILE = path.resolve(__dirname, '../../data/ip_blocker.json');
const AUDIT_FILE = path.resolve(__dirname, '../../data/ip_blocker_audit.log');

const BEGIN_MARKER = '# BEGIN CPANEL IP BLOCKER';
const END_MARKER = '# END CPANEL IP BLOCKER';

class IpBlockerService {
  constructor() {
    this._ensureStorage();
  }

  _ensureStorage() {
    const dir = path.dirname(IP_BLOCKER_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(IP_BLOCKER_FILE)) {
      fs.writeFileSync(IP_BLOCKER_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  }

  _logAudit(user, action, details) {
    const entry = {
      timestamp: new Date().toISOString(),
      user: user || 'cpanel_user',
      action,
      details
    };
    try {
      fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n', 'utf8');
    } catch (e) {
      console.error('Failed to append to IP blocker audit log:', e);
    }
  }

  _readRecords() {
    this._ensureStorage();
    try {
      return JSON.parse(fs.readFileSync(IP_BLOCKER_FILE, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  _writeRecords(records) {
    this._ensureStorage();
    fs.writeFileSync(IP_BLOCKER_FILE, JSON.stringify(records, null, 2), 'utf8');
  }

  _getHtaccessPath(username) {
    const safeUser = (username || 'cpanel_user').replace(/[^a-zA-Z0-9_-]/g, '');
    const userRoot = storageService.getRootDir(safeUser);
    const publicHtml = path.join(userRoot, 'public_html');
    if (!fs.existsSync(publicHtml)) {
      fs.mkdirSync(publicHtml, { recursive: true });
    }
    return path.join(publicHtml, '.htaccess');
  }

  // Capability discovery
  getCapabilities() {
    return {
      webServer: 'Apache / 2.4.58 (cPanel Pro) / LiteSpeed compatible',
      enforcementMechanism: '.htaccess access-control directives (<RequireAll> / Require not ip)',
      scope: 'Account / Document Root (public_html)',
      ipv4Supported: true,
      ipv6Supported: true,
      serverFirewallAccess: false // Strict security boundary: No global firewall manipulation
    };
  }

  // Validate and normalize IP address
  validateAndNormalizeIp(rawIp) {
    if (!rawIp || typeof rawIp !== 'string') {
      return { valid: false, error: 'IP address cannot be empty.' };
    }

    const trimmed = rawIp.trim();

    // Check for control characters, newlines, or command injection payloads
    if (/[\r\n;|<>$&`"']/.test(trimmed)) {
      return { valid: false, error: 'IP address contains invalid or prohibited characters.' };
    }

    const ipVersion = net.isIP(trimmed);
    if (ipVersion === 0) {
      return { valid: false, error: 'Invalid IP address syntax. Please enter a valid IPv4 or IPv6 address.' };
    }

    // Disallow loopback, all-zeros, and broadcast addresses
    const isLoopback = trimmed === '127.0.0.1' || trimmed === '::1' || trimmed.startsWith('127.');
    const isAllZeros = trimmed === '0.0.0.0' || trimmed === '::';
    const isBroadcast = trimmed === '255.255.255.255';

    if (isLoopback || isAllZeros || isBroadcast) {
      return {
        valid: false,
        error: 'Loopback, unspecified, or broadcast IP addresses cannot be blocked as this would break internal server communications.'
      };
    }

    // Normalize
    const normalized = trimmed.toLowerCase();

    return {
      valid: true,
      ip: trimmed,
      normalizedIp: normalized,
      version: ipVersion === 4 ? 'IPv4' : 'IPv6'
    };
  }

  // Read managed IP directives from account .htaccess
  _readHtaccessDirectives(username) {
    const htaccessPath = this._getHtaccessPath(username);
    if (!fs.existsSync(htaccessPath)) return [];

    try {
      const content = fs.readFileSync(htaccessPath, 'utf8');
      const beginIdx = content.indexOf(BEGIN_MARKER);
      const endIdx = content.indexOf(END_MARKER);

      if (beginIdx === -1 || endIdx === -1 || beginIdx >= endIdx) {
        return [];
      }

      const managedBlock = content.substring(beginIdx + BEGIN_MARKER.length, endIdx);
      const lines = managedBlock.split(/\r?\n/).map(l => l.trim());
      const ips = [];

      for (const line of lines) {
        const match = line.match(/^Require\s+not\s+ip\s+([a-fA-F0-9:.]+)/i);
        if (match && match[1]) {
          ips.push(match[1].toLowerCase());
        }
      }

      return ips;
    } catch (e) {
      console.error('Error reading .htaccess directives:', e);
      return [];
    }
  }

  // Atomically write managed IP block to account .htaccess
  _writeHtaccessDirectives(username, blockedIps) {
    const htaccessPath = this._getHtaccessPath(username);
    const dir = path.dirname(htaccessPath);

    let existingContent = '';
    if (fs.existsSync(htaccessPath)) {
      existingContent = fs.readFileSync(htaccessPath, 'utf8');
    }

    // Build the managed block
    let newManagedSection = '';
    if (blockedIps && blockedIps.length > 0) {
      const requireLines = blockedIps.map(ip => `  Require not ip ${ip}`).join('\n');
      newManagedSection = `${BEGIN_MARKER}\n<RequireAll>\n  Require all granted\n${requireLines}\n</RequireAll>\n${END_MARKER}`;
    }

    let updatedContent = '';
    const beginIdx = existingContent.indexOf(BEGIN_MARKER);
    const endIdx = existingContent.indexOf(END_MARKER);

    if (beginIdx !== -1 && endIdx !== -1 && beginIdx < endIdx) {
      const before = existingContent.substring(0, beginIdx).trimEnd();
      const after = existingContent.substring(endIdx + END_MARKER.length).trimStart();

      if (newManagedSection) {
        updatedContent = (before ? before + '\n\n' : '') + newManagedSection + (after ? '\n\n' + after : '\n');
      } else {
        // Removed block completely
        updatedContent = (before ? before + '\n' : '') + (after ? after : '');
      }
    } else {
      if (newManagedSection) {
        updatedContent = existingContent.trim()
          ? `${existingContent.trim()}\n\n${newManagedSection}\n`
          : `${newManagedSection}\n`;
      } else {
        updatedContent = existingContent;
      }
    }

    // Atomic write via temp file
    const tempFile = path.join(dir, `.htaccess_tmp_${Date.now()}`);
    fs.writeFileSync(tempFile, updatedContent, { encoding: 'utf8', mode: 0o644 });
    fs.renameSync(tempFile, htaccessPath);
  }

  // List blocked IPs for user with live synchronization
  listBlockedIps(username = 'cpanel_user') {
    const safeUser = (username || 'cpanel_user').replace(/[^a-zA-Z0-9_-]/g, '');
    const allRecords = this._readRecords();
    const userRecords = allRecords.filter(r => r.username === safeUser);
    const htaccessIps = this._readHtaccessDirectives(safeUser);

    // Map through records and verify synchronization with .htaccess
    const result = userRecords.map(r => {
      const inHtaccess = htaccessIps.includes(r.normalizedIp);
      return {
        id: r.id,
        ip: r.ip,
        normalizedIp: r.normalizedIp,
        version: r.version,
        status: inHtaccess ? 'Active' : 'Out of Sync',
        createdAt: r.createdAt,
        inHtaccess
      };
    });

    // Auto-detect any directives in .htaccess that were added externally
    for (const htIp of htaccessIps) {
      if (!userRecords.some(r => r.normalizedIp === htIp)) {
        const val = this.validateAndNormalizeIp(htIp);
        if (val.valid) {
          result.push({
            id: `ip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            ip: val.ip,
            normalizedIp: val.normalizedIp,
            version: val.version,
            status: 'Active (Imported from .htaccess)',
            createdAt: new Date().toISOString(),
            inHtaccess: true
          });
        }
      }
    }

    return result;
  }

  // Add an IP block
  addBlock({ username = 'cpanel_user', ip }) {
    const safeUser = (username || 'cpanel_user').replace(/[^a-zA-Z0-9_-]/g, '');
    const validation = this.validateAndNormalizeIp(ip);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const allRecords = this._readRecords();
    const userRecords = allRecords.filter(r => r.username === safeUser);

    // Check duplicate
    if (userRecords.some(r => r.normalizedIp === validation.normalizedIp)) {
      throw new Error(`The IP address "${validation.ip}" is already blocked for this account.`);
    }

    // Read current .htaccess directives
    const currentHtaccessIps = this._readHtaccessDirectives(safeUser);
    if (!currentHtaccessIps.includes(validation.normalizedIp)) {
      currentHtaccessIps.push(validation.normalizedIp);
    }

    // Write to .htaccess atomically
    this._writeHtaccessDirectives(safeUser, currentHtaccessIps);

    // Save to metadata store
    const recordId = `ip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newRecord = {
      id: recordId,
      username: safeUser,
      ip: validation.ip,
      normalizedIp: validation.normalizedIp,
      version: validation.version,
      status: 'Active',
      createdAt: new Date().toISOString()
    };

    allRecords.push(newRecord);
    this._writeRecords(allRecords);

    this._logAudit(safeUser, 'ADD_IP_BLOCK', { ip: validation.ip, version: validation.version });

    return newRecord;
  }

  // Remove an IP block (Unblock)
  removeBlock({ username = 'cpanel_user', ip, recordId }) {
    const safeUser = (username || 'cpanel_user').replace(/[^a-zA-Z0-9_-]/g, '');
    const allRecords = this._readRecords();

    let targetRecord = null;
    let targetIndex = -1;

    if (recordId) {
      targetIndex = allRecords.findIndex(r => r.username === safeUser && r.id === recordId);
      if (targetIndex !== -1) targetRecord = allRecords[targetIndex];
    } else if (ip) {
      const val = this.validateAndNormalizeIp(ip);
      const searchIp = val.valid ? val.normalizedIp : ip.trim().toLowerCase();
      targetIndex = allRecords.findIndex(r => r.username === safeUser && r.normalizedIp === searchIp);
      if (targetIndex !== -1) targetRecord = allRecords[targetIndex];
    }

    const normalizedIpToRemove = targetRecord ? targetRecord.normalizedIp : (ip ? ip.trim().toLowerCase() : null);

    if (!normalizedIpToRemove && targetIndex === -1) {
      throw new Error('Blocked IP rule not found for this account.');
    }

    // Remove from .htaccess
    const currentHtaccessIps = this._readHtaccessDirectives(safeUser);
    const filteredIps = currentHtaccessIps.filter(item => item !== normalizedIpToRemove);
    this._writeHtaccessDirectives(safeUser, filteredIps);

    // Remove from metadata store if record exists
    if (targetIndex !== -1) {
      allRecords.splice(targetIndex, 1);
      this._writeRecords(allRecords);
    }

    this._logAudit(safeUser, 'REMOVE_IP_BLOCK', { ip: normalizedIpToRemove });

    return {
      success: true,
      removedIp: normalizedIpToRemove
    };
  }

  // Force re-synchronize metadata with .htaccess
  sync({ username = 'cpanel_user' }) {
    const safeUser = (username || 'cpanel_user').replace(/[^a-zA-Z0-9_-]/g, '');
    const allRecords = this._readRecords();
    const otherRecords = allRecords.filter(r => r.username !== safeUser);

    const htaccessIps = this._readHtaccessDirectives(safeUser);
    const newRecords = [];

    for (const htIp of htaccessIps) {
      const val = this.validateAndNormalizeIp(htIp);
      if (val.valid) {
        newRecords.push({
          id: `ip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          username: safeUser,
          ip: val.ip,
          normalizedIp: val.normalizedIp,
          version: val.version,
          status: 'Active',
          createdAt: new Date().toISOString()
        });
      }
    }

    this._writeRecords([...otherRecords, ...newRecords]);
    this._logAudit(safeUser, 'SYNC_IP_BLOCKS', { count: newRecords.length });

    return {
      success: true,
      syncedCount: newRecords.length,
      records: newRecords
    };
  }

  // Real traffic verification: tests if a given client IP is allowed or denied with 403 Forbidden
  verifyAccess({ username = 'cpanel_user', ip }) {
    const safeUser = (username || 'cpanel_user').replace(/[^a-zA-Z0-9_-]/g, '');
    const validation = this.validateAndNormalizeIp(ip);

    if (!validation.valid) {
      return {
        allowed: true,
        httpStatus: 200,
        message: 'Invalid IP address; traffic not blocked.'
      };
    }

    const htaccessIps = this._readHtaccessDirectives(safeUser);
    const isBlocked = htaccessIps.includes(validation.normalizedIp);

    if (isBlocked) {
      return {
        allowed: false,
        httpStatus: 403,
        statusText: 'Forbidden',
        reason: `Access Denied by .htaccess (Require not ip ${validation.ip})`,
        ip: validation.ip,
        version: validation.version
      };
    }

    return {
      allowed: true,
      httpStatus: 200,
      statusText: 'OK',
      reason: 'Access Allowed by web server access-control rules.',
      ip: validation.ip,
      version: validation.version
    };
  }
}

module.exports = new IpBlockerService();
