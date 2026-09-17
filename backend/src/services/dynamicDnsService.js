const crypto = require('crypto');
const dnsService = require('./dnsService');
const domainService = require('./domainService');

// IPv4 Regex
const IPV4_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

// IPv6 Regex
const IPV6_REGEX = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

class DynamicDnsService {
  constructor() {
    this.rateLimits = new Map(); // tokenHash -> array of timestamps
  }

  /**
   * Safely detect client IP from request, handling headers and proxies securely
   */
  detectClientIp(req) {
    if (!req) return '127.0.0.1';
    let ip = req.headers['cf-connecting-ip'] ||
             req.headers['x-real-ip'] ||
             (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) ||
             req.connection?.remoteAddress ||
             req.socket?.remoteAddress ||
             req.ip ||
             '127.0.0.1';

    if (typeof ip === 'string') {
      ip = ip.trim();
      if (ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
      }
      if (ip === '::1') {
        ip = '127.0.0.1';
      }
    }
    return ip;
  }

  /**
   * Validate IP according to record type (A = IPv4, AAAA = IPv6)
   */
  validateIp(ip, type = 'A') {
    if (!ip || typeof ip !== 'string') return false;
    const clean = ip.trim();
    if (type === 'A') {
      return IPV4_REGEX.test(clean);
    } else if (type === 'AAAA') {
      return IPV6_REGEX.test(clean);
    }
    return false;
  }

  /**
   * Hash token using SHA-256
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(String(token).trim()).digest('hex');
  }

  /**
   * Normalize hostname (lowercase, no trailing dot)
   */
  normalizeHostname(hostname, domain) {
    if (hostname === undefined || hostname === null || typeof hostname !== 'string') {
      throw new Error('Hostname is required');
    }
    let clean = hostname.trim().toLowerCase().replace(/\.+$/, '');
    const cleanDomain = domain.trim().toLowerCase().replace(/\.+$/, '');

    if (clean === '@' || clean === '') {
      return cleanDomain;
    }

    if (clean !== cleanDomain && !clean.endsWith(`.${cleanDomain}`)) {
      clean = `${clean}.${cleanDomain}`;
    }

    // Validate hostname characters & labels
    const labels = clean.split('.');
    for (const label of labels) {
      if (!label || label.length > 63) {
        throw new Error(`Hostname label "${label}" is invalid (must be 1-63 chars)`);
      }
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(label)) {
        throw new Error(`Invalid hostname label: "${label}". Must contain alphanumeric characters or hyphens, and cannot start or end with a hyphen.`);
      }
    }

    return clean;
  }

  /**
   * Sanitize an entry for client responses (strip sensitive tokenHash)
   */
  sanitizeEntry(entry) {
    if (!entry) return null;
    const { tokenHash, ...safe } = entry;
    return {
      ...safe,
      tokenMasked: `${entry.tokenPrefix || 'cpanel_ddns_'}••••••••••••${entry.tokenSuffix || ''}`
    };
  }

  /**
   * Get all DDNS entries for a user
   */
  getEntries(cpanelUser = 'cpanel_user') {
    const data = domainService._read(cpanelUser);
    data.ddnsEntries = data.ddnsEntries || [];
    return data.ddnsEntries.map(e => this.sanitizeEntry(e));
  }

  /**
   * Get a single DDNS entry by ID
   */
  getEntry(id, cpanelUser = 'cpanel_user') {
    const data = domainService._read(cpanelUser);
    data.ddnsEntries = data.ddnsEntries || [];
    const found = data.ddnsEntries.find(e => e.id === String(id));
    if (!found) {
      throw new Error(`Dynamic DNS configuration with ID "${id}" was not found.`);
    }
    return this.sanitizeEntry(found);
  }

  /**
   * Create a new Dynamic DNS entry
   */
  createEntry(options = {}, cpanelUser = 'cpanel_user') {
    const {
      domain,
      hostname,
      type = 'A',
      ttl = 300,
      description = '',
      initialIp = null
    } = options;

    if (!domain) {
      throw new Error('Target domain is required.');
    }

    // 1. Verify user ownership of the domain
    const verifiedDomain = dnsService.verifyDomainOwnership(domain, cpanelUser);

    // 2. Validate and normalize hostname
    const fullHostname = this.normalizeHostname(hostname || domain, verifiedDomain);

    // 3. Validate record type
    const upperType = (type || 'A').toUpperCase();
    if (!['A', 'AAAA'].includes(upperType)) {
      throw new Error('Dynamic DNS only supports record types "A" (IPv4) and "AAAA" (IPv6).');
    }

    // 4. Validate TTL
    const parsedTtl = parseInt(ttl, 10);
    if (isNaN(parsedTtl) || parsedTtl < 300 || parsedTtl > 604800) {
      throw new Error('TTL must be an integer between 300 (5 minutes) and 604800 (7 days).');
    }

    // 5. Check if initial IP is supplied
    let targetIp = initialIp ? String(initialIp).trim() : null;
    if (targetIp) {
      if (!this.validateIp(targetIp, upperType)) {
        throw new Error(`Invalid ${upperType} IP address format: "${targetIp}"`);
      }
    } else {
      // Default to 127.0.0.1 for A or ::1 for AAAA if not provided
      targetIp = upperType === 'A' ? '127.0.0.1' : '::1';
    }

    // 6. Check for duplicate hostname + type in user's DDNS entries
    const initialData = domainService._read(cpanelUser);
    const existingEntry = (initialData.ddnsEntries || []).find(
      e => e.hostname.toLowerCase() === fullHostname.toLowerCase() && e.type === upperType
    );
    if (existingEntry) {
      throw new Error(`A Dynamic DNS configuration already exists for hostname "${fullHostname}" with type "${upperType}".`);
    }

    // 7. Synchronize with DNS Zone: check if DNS record exists, or add it
    const rfcName = `${fullHostname}.`;
    let linkedRecord = (initialData.dnsRecords || []).find(
      r => r.name.toLowerCase() === rfcName.toLowerCase() && r.type === upperType
    );

    if (linkedRecord) {
      // Update existing record if needed
      if (targetIp && linkedRecord.record !== targetIp) {
        dnsService.updateRecord(verifiedDomain, linkedRecord.id, {
          record: targetIp,
          ttl: parsedTtl
        }, cpanelUser);
      }
    } else {
      // Add record to DNS zone via dnsService (which updates data.dnsRecords and writes)
      const addRes = dnsService.addRecord(verifiedDomain, {
        name: rfcName,
        type: upperType,
        record: targetIp,
        ttl: parsedTtl
      }, cpanelUser);
      linkedRecord = addRes.record;
    }

    // 8. Generate cryptographically secure token
    const rawSecret = `cpanel_ddns_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = this.hashToken(rawSecret);
    const tokenPrefix = rawSecret.substring(0, 16);
    const tokenSuffix = rawSecret.substring(rawSecret.length - 4);

    const newId = `ddns_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newEntry = {
      id: newId,
      domain: verifiedDomain,
      hostname: fullHostname,
      type: upperType,
      ttl: parsedTtl,
      description: (description || `Dynamic DNS for ${fullHostname}`).trim(),
      enabled: true,
      tokenHash,
      tokenPrefix,
      tokenSuffix,
      currentIp: targetIp,
      lastUpdateAt: now,
      lastUpdateIp: 'local',
      lastUpdateStatus: 'initialized',
      updateCount: 0,
      recordId: linkedRecord?.id || null,
      created: now,
      updated: now
    };

    // Re-read FRESH account data so we don't overwrite the newly created DNS record
    const freshData = domainService._read(cpanelUser);
    freshData.ddnsEntries = freshData.ddnsEntries || [];
    freshData.ddnsEntries.push(newEntry);
    domainService._write(freshData, cpanelUser);

    return {
      success: true,
      message: `Dynamic DNS configuration for "${fullHostname}" created successfully. Save your token now!`,
      entry: this.sanitizeEntry(newEntry),
      rawToken: rawSecret
    };
  }

  /**
   * Update an existing Dynamic DNS configuration
   */
  updateEntry(id, updates = {}, cpanelUser = 'cpanel_user') {
    const data = domainService._read(cpanelUser);
    data.ddnsEntries = data.ddnsEntries || [];
    const idx = data.ddnsEntries.findIndex(e => e.id === String(id));
    if (idx === -1) {
      throw new Error(`Dynamic DNS configuration with ID "${id}" was not found.`);
    }

    const entry = data.ddnsEntries[idx];

    // TTL update
    if (updates.ttl !== undefined) {
      const parsedTtl = parseInt(updates.ttl, 10);
      if (isNaN(parsedTtl) || parsedTtl < 300 || parsedTtl > 604800) {
        throw new Error('TTL must be an integer between 300 (5 minutes) and 604800 (7 days).');
      }
      entry.ttl = parsedTtl;

      // Also update linked DNS record TTL if available
      try {
        const rfcName = `${entry.hostname}.`;
        const rec = (data.dnsRecords || []).find(
          r => r.name.toLowerCase() === rfcName.toLowerCase() && r.type === entry.type
        );
        if (rec) {
          dnsService.updateRecord(entry.domain, rec.id, { ttl: parsedTtl }, cpanelUser);
        }
      } catch (err) {
        // Log or proceed
      }
    }

    // Description update
    if (updates.description !== undefined) {
      entry.description = String(updates.description).trim();
    }

    // Enabled status update
    if (updates.enabled !== undefined) {
      entry.enabled = Boolean(updates.enabled);
    }

    entry.updated = new Date().toISOString();
    
    // Re-read fresh data to preserve any DNS updates
    const freshData = domainService._read(cpanelUser);
    const freshIdx = (freshData.ddnsEntries || []).findIndex(e => e.id === String(id));
    if (freshIdx !== -1) {
      freshData.ddnsEntries[freshIdx] = entry;
      domainService._write(freshData, cpanelUser);
    }

    return {
      success: true,
      message: 'Dynamic DNS configuration updated successfully.',
      entry: this.sanitizeEntry(entry)
    };
  }

  /**
   * Toggle enabled/disabled state of a DDNS entry
   */
  toggleEntry(id, cpanelUser = 'cpanel_user') {
    const data = domainService._read(cpanelUser);
    data.ddnsEntries = data.ddnsEntries || [];
    const idx = data.ddnsEntries.findIndex(e => e.id === String(id));
    if (idx === -1) {
      throw new Error(`Dynamic DNS configuration with ID "${id}" was not found.`);
    }

    const entry = data.ddnsEntries[idx];
    entry.enabled = !entry.enabled;
    entry.updated = new Date().toISOString();

    domainService._write(data, cpanelUser);

    return {
      success: true,
      message: `Dynamic DNS for "${entry.hostname}" is now ${entry.enabled ? 'Enabled' : 'Disabled'}.`,
      entry: this.sanitizeEntry(entry)
    };
  }

  /**
   * Regenerate token for an entry (revokes old token immediately)
   */
  regenerateToken(id, cpanelUser = 'cpanel_user') {
    const data = domainService._read(cpanelUser);
    data.ddnsEntries = data.ddnsEntries || [];
    const idx = data.ddnsEntries.findIndex(e => e.id === String(id));
    if (idx === -1) {
      throw new Error(`Dynamic DNS configuration with ID "${id}" was not found.`);
    }

    const entry = data.ddnsEntries[idx];

    // Generate brand new secret
    const rawSecret = `cpanel_ddns_${crypto.randomBytes(24).toString('hex')}`;
    entry.tokenHash = this.hashToken(rawSecret);
    entry.tokenPrefix = rawSecret.substring(0, 16);
    entry.tokenSuffix = rawSecret.substring(rawSecret.length - 4);
    entry.updated = new Date().toISOString();

    data.ddnsEntries[idx] = entry;
    domainService._write(data, cpanelUser);

    return {
      success: true,
      message: `New Dynamic DNS security token generated for "${entry.hostname}". The previous token has been revoked immediately.`,
      entry: this.sanitizeEntry(entry),
      rawToken: rawSecret
    };
  }

  /**
   * Delete a Dynamic DNS entry
   */
  deleteEntry(id, deleteDnsRecord = false, cpanelUser = 'cpanel_user') {
    const data = domainService._read(cpanelUser);
    data.ddnsEntries = data.ddnsEntries || [];
    const idx = data.ddnsEntries.findIndex(e => e.id === String(id));
    if (idx === -1) {
      throw new Error(`Dynamic DNS configuration with ID "${id}" was not found.`);
    }

    const deleted = data.ddnsEntries[idx];

    let dnsDeleted = false;
    if (deleteDnsRecord) {
      try {
        const rfcName = `${deleted.hostname.toLowerCase()}.`;
        const freshData = domainService._read(cpanelUser);
        const rec = (freshData.dnsRecords || []).find(
          r => r.name.toLowerCase() === rfcName && r.type === deleted.type
        );
        if (rec) {
          dnsService.deleteRecord(deleted.domain, rec.id, cpanelUser);
          dnsDeleted = true;
        }
      } catch (e) {
        // Non-fatal if DNS record couldn't be removed
      }
    }

    // Now remove entry from ddnsEntries in fresh data
    const finalData = domainService._read(cpanelUser);
    finalData.ddnsEntries = (finalData.ddnsEntries || []).filter(e => e.id !== String(id));
    domainService._write(finalData, cpanelUser);

    return {
      success: true,
      message: `Dynamic DNS configuration for "${deleted.hostname}" deleted successfully.${dnsDeleted ? ' Linked DNS zone record was also deleted.' : ''}`,
      id: String(id),
      dnsDeleted
    };
  }

  /**
   * Check rate limiting for a given token hash (e.g. max 60 requests per minute)
   */
  checkRateLimit(tokenHash) {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 60;

    let timestamps = this.rateLimits.get(tokenHash) || [];
    // Filter timestamps within window
    timestamps = timestamps.filter(t => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
      return false; // Rate limit exceeded
    }

    timestamps.push(now);
    this.rateLimits.set(tokenHash, timestamps);
    return true;
  }

  /**
   * Public Machine-Readable Dynamic DNS Update Handler
   */
  handleUpdateRequest(req) {
    const clientIp = this.detectClientIp(req);

    // 1. Extract Token
    let token = null;
    let authUser = null;

    // Check Authorization header
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (authHeader.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(authHeader.substring(6).trim(), 'base64').toString('utf8');
        const parts = decoded.split(':');
        if (parts.length >= 2) {
          authUser = parts[0] || null;
          token = parts.slice(1).join(':') || parts[0];
        } else {
          token = parts[0];
        }
      } catch (e) {}
    }

    // Check Query parameters and Body
    if (!token) {
      token = req.query?.token || req.query?.key || req.query?.password ||
              req.body?.token || req.body?.key || req.body?.password;
    }

    if (!token) {
      return {
        statusCode: 401,
        status: 'badauth',
        message: 'Authentication failed. Dynamic DNS token is missing.',
        rawResponse: 'badauth'
      };
    }

    // 2. Hash token and search across accounts
    const tokenHash = this.hashToken(token);
    const allAccounts = domainService._readAll();

    let matchedUser = null;
    let matchedEntry = null;

    for (const [userKey, accountData] of Object.entries(allAccounts.accounts || {})) {
      if (authUser && userKey.toLowerCase() !== authUser.toLowerCase()) {
        continue;
      }
      const entries = accountData.ddnsEntries || [];
      const found = entries.find(e => e.tokenHash === tokenHash);
      if (found) {
        matchedUser = userKey;
        matchedEntry = found;
        break;
      }
    }

    if (!matchedEntry || !matchedUser) {
      return {
        statusCode: 401,
        status: 'badauth',
        message: 'Authentication failed. Invalid or revoked Dynamic DNS token.',
        rawResponse: 'badauth'
      };
    }

    // 3. Check if entry is enabled
    if (!matchedEntry.enabled) {
      return {
        statusCode: 403,
        status: 'abuse',
        message: `Dynamic DNS configuration for "${matchedEntry.hostname}" is disabled by account owner.`,
        rawResponse: 'abuse'
      };
    }

    // 4. Rate Limiting Check
    if (!this.checkRateLimit(tokenHash)) {
      return {
        statusCode: 429,
        status: 'abuse',
        message: 'Too many update requests. Please wait before updating again.',
        rawResponse: 'abuse'
      };
    }

    // 5. Hostname Verification (if supplied in request)
    const reqHostname = req.query?.hostname || req.body?.hostname;
    if (reqHostname) {
      const cleanReqHost = String(reqHostname).trim().toLowerCase().replace(/\.+$/, '');
      const cleanEntryHost = matchedEntry.hostname.toLowerCase().replace(/\.+$/, '');
      if (cleanReqHost !== cleanEntryHost) {
        return {
          statusCode: 400,
          status: 'nohost',
          message: `Hostname mismatch. Token is authorized for "${cleanEntryHost}", requested "${cleanReqHost}".`,
          rawResponse: 'nohost'
        };
      }
    }

    // 6. Target IP Resolution
    let requestedIp = req.query?.ip || req.query?.myip || req.body?.ip || req.body?.myip;
    if (!requestedIp) {
      requestedIp = clientIp;
    } else {
      requestedIp = String(requestedIp).trim();
    }

    // 7. Validate Target IP
    if (!this.validateIp(requestedIp, matchedEntry.type)) {
      return {
        statusCode: 400,
        status: 'badagent',
        message: `Invalid IP format for record type ${matchedEntry.type}: "${requestedIp}".`,
        rawResponse: 'badagent'
      };
    }

    const now = new Date().toISOString();

    // 8. Optimization: nochange check
    if (matchedEntry.currentIp === requestedIp) {
      const freshData = domainService._read(matchedUser);
      const freshEntry = (freshData.ddnsEntries || []).find(e => e.id === matchedEntry.id);
      if (freshEntry) {
        freshEntry.lastUpdateAt = now;
        freshEntry.lastUpdateIp = clientIp;
        freshEntry.lastUpdateStatus = 'nochange';
        domainService._write(freshData, matchedUser);
      }

      return {
        statusCode: 200,
        status: 'nochange',
        message: `IP address unchanged (${requestedIp}). DNS update not required.`,
        ip: requestedIp,
        hostname: matchedEntry.hostname,
        rawResponse: `nochg ${requestedIp}`
      };
    }

    // 9. IP Changed: Update DNS Zone Record
    try {
      const rfcName = `${matchedEntry.hostname.toLowerCase()}.`;
      const currentAcc = domainService._read(matchedUser);
      const rec = (currentAcc.dnsRecords || []).find(
        r => r.name.toLowerCase() === rfcName && r.type === matchedEntry.type
      );

      if (rec) {
        dnsService.updateRecord(matchedEntry.domain, rec.id, {
          record: requestedIp,
          ttl: matchedEntry.ttl
        }, matchedUser);
      } else {
        dnsService.addRecord(matchedEntry.domain, {
          name: rfcName,
          type: matchedEntry.type,
          record: requestedIp,
          ttl: matchedEntry.ttl
        }, matchedUser);
      }
    } catch (dnsErr) {
      return {
        statusCode: 500,
        status: 'dnserr',
        message: `DNS update failed: ${dnsErr.message}`,
        rawResponse: 'dnserr'
      };
    }

    // 10. Update Entry State in fresh data
    const finalData = domainService._read(matchedUser);
    const finalEntry = (finalData.ddnsEntries || []).find(e => e.id === matchedEntry.id);
    if (finalEntry) {
      finalEntry.currentIp = requestedIp;
      finalEntry.lastUpdateAt = now;
      finalEntry.lastUpdateIp = clientIp;
      finalEntry.lastUpdateStatus = 'good';
      finalEntry.updateCount = (finalEntry.updateCount || 0) + 1;
      finalEntry.updated = now;
      domainService._write(finalData, matchedUser);
    }

    return {
      statusCode: 200,
      status: 'good',
      message: `Dynamic DNS updated successfully. Hostname "${matchedEntry.hostname}" now points to ${requestedIp}.`,
      ip: requestedIp,
      hostname: matchedEntry.hostname,
      rawResponse: `good ${requestedIp}`
    };
  }
}

module.exports = new DynamicDnsService();
