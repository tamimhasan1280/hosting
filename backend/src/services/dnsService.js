const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const domainService = require('./domainService');

const DOMAIN_DATA_FILE = path.resolve(__dirname, '../../data/dns/domains.json');

// Supported record types
const SUPPORTED_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'];

// Standard IPv4 regex
const IPV4_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

// Standard IPv6 regex
const IPV6_REGEX = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

class DnsService {
  constructor() {
    this.init();
  }

  init() {
    domainService._readAll();
  }

  /**
   * Normalize domain name (lowercase, no trailing dot for comparisons)
   */
  normalizeDomain(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().toLowerCase().replace(/\.+$/, '');
  }

  /**
   * Normalize record name (lowercase, ensure trailing dot for DNS RFC formatting)
   */
  normalizeRecordName(name, zoneDomain) {
    if (!name || typeof name !== 'string') return `${zoneDomain}.`;
    let clean = name.trim().toLowerCase();
    if (clean === '@' || clean === '') {
      return `${zoneDomain}.`;
    }
    if (clean.endsWith('.')) {
      return clean;
    }
    // If it doesn't end with zoneDomain, append it
    if (!clean.endsWith(zoneDomain)) {
      return `${clean}.${zoneDomain}.`;
    }
    return `${clean}.`;
  }

  /**
   * Get all zones (domains) authorized for a user
   */
  getZones(cpanelUser = 'cpanel_user') {
    const data = domainService._read(cpanelUser);
    const zones = [];

    // 1. Primary domain
    if (data.primaryDomain) {
      const records = this.getRecordsForDomain(data.primaryDomain, cpanelUser);
      zones.push({
        name: data.primaryDomain,
        type: 'Primary Domain',
        status: 'Active',
        recordCount: records.length,
        authoritativeNs: [`ns1.${data.primaryDomain}`, `ns2.${data.primaryDomain}`],
        dnssec: 'Supported (Not Active)',
        lastUpdated: data.updated || new Date().toISOString()
      });
    }

    // 2. Addon domains
    (data.domains || []).forEach(d => {
      if (d.name.toLowerCase() !== (data.primaryDomain || '').toLowerCase()) {
        const records = this.getRecordsForDomain(d.name, cpanelUser);
        zones.push({
          name: d.name,
          type: d.type || 'Addon Domain',
          status: d.status || 'Active',
          recordCount: records.length,
          authoritativeNs: [`ns1.${data.primaryDomain}`, `ns2.${data.primaryDomain}`],
          dnssec: 'Supported (Not Active)',
          lastUpdated: d.updated || d.created || new Date().toISOString()
        });
      }
    });

    // 3. Subdomains
    (data.subdomains || []).forEach(s => {
      const records = this.getRecordsForDomain(s.name, cpanelUser);
      zones.push({
        name: s.name,
        type: 'Subdomain',
        status: s.status || 'Active',
        recordCount: records.length,
        authoritativeNs: [`ns1.${data.primaryDomain}`, `ns2.${data.primaryDomain}`],
        dnssec: 'Supported (Not Active)',
        lastUpdated: s.created || new Date().toISOString()
      });
    });

    // 4. Aliases
    (data.aliases || []).forEach(a => {
      const records = this.getRecordsForDomain(a.name, cpanelUser);
      zones.push({
        name: a.name,
        type: 'Alias',
        status: a.status || 'Active',
        recordCount: records.length,
        authoritativeNs: [`ns1.${data.primaryDomain}`, `ns2.${data.primaryDomain}`],
        dnssec: 'Supported (Not Active)',
        lastUpdated: a.created || new Date().toISOString()
      });
    });

    return zones;
  }

  /**
   * Verify domain belongs to authenticated user
   */
  verifyDomainOwnership(domain, cpanelUser = 'cpanel_user') {
    const norm = this.normalizeDomain(domain);
    const zones = this.getZones(cpanelUser);
    const found = zones.find(z => this.normalizeDomain(z.name) === norm);
    if (!found) {
      throw new Error(`Domain "${domain}" is not authorized or does not belong to your account.`);
    }
    return found.name;
  }

  /**
   * Get all DNS records filtered for a specific domain/zone
   */
  getRecordsForDomain(domain, cpanelUser = 'cpanel_user') {
    const normDomain = this.normalizeDomain(domain);
    const data = domainService._read(cpanelUser);
    const allRecords = data.dnsRecords || [];

    // Match records that belong to this zone
    const matched = allRecords.filter(r => {
      const recName = this.normalizeDomain(r.name);
      return recName === normDomain || recName.endsWith(`.${normDomain}`);
    });

    // Ensure standard SOA and NS records are present in memory if missing
    const hasSoa = matched.some(r => r.type === 'SOA');
    const hasNs = matched.some(r => r.type === 'NS');

    const result = [...matched];

    if (!hasSoa) {
      result.unshift({
        id: `soa_${normDomain.replace(/[^a-z0-9]/g, '_')}`,
        name: `${normDomain}.`,
        type: 'SOA',
        ttl: 86400,
        class: 'IN',
        record: `ns1.${data.primaryDomain || normDomain}. hostmaster.${normDomain}. 2026091601 3600 1800 1209600 86400`,
        mname: `ns1.${data.primaryDomain || normDomain}.`,
        rname: `hostmaster.${normDomain}.`,
        serial: 2026091601,
        refresh: 3600,
        retry: 1800,
        expire: 1209600,
        minimum: 86400,
        isProtected: true
      });
    }

    if (!hasNs) {
      result.push(
        {
          id: `ns1_${normDomain.replace(/[^a-z0-9]/g, '_')}`,
          name: `${normDomain}.`,
          type: 'NS',
          ttl: 86400,
          class: 'IN',
          record: `ns1.${data.primaryDomain || normDomain}.`,
          isProtected: true
        },
        {
          id: `ns2_${normDomain.replace(/[^a-z0-9]/g, '_')}`,
          name: `${normDomain}.`,
          type: 'NS',
          ttl: 86400,
          class: 'IN',
          record: `ns2.${data.primaryDomain || normDomain}.`,
          isProtected: true
        }
      );
    }

    return result.map(r => ({
      ...r,
      class: 'IN',
      isProtected: r.isProtected || r.type === 'SOA' || (r.type === 'NS' && r.name === `${normDomain}.`)
    }));
  }

  /**
   * Get zone details and records for a domain
   */
  getZone(domain, cpanelUser = 'cpanel_user') {
    const verifiedDomain = this.verifyDomainOwnership(domain, cpanelUser);
    const records = this.getRecordsForDomain(verifiedDomain, cpanelUser);
    const data = domainService._read(cpanelUser);

    return {
      success: true,
      domain: verifiedDomain,
      status: 'Active',
      recordCount: records.length,
      authoritativeNs: [`ns1.${data.primaryDomain || verifiedDomain}`, `ns2.${data.primaryDomain || verifiedDomain}`],
      lastUpdated: new Date().toISOString(),
      records
    };
  }

  /**
   * Validate DNS Record syntax
   */
  validateRecord(type, name, rdata, ttl, priority, weight, port, flag, tag, zoneDomain) {
    const upperType = (type || '').trim().toUpperCase();
    if (!SUPPORTED_TYPES.includes(upperType)) {
      throw new Error(`Unsupported DNS record type "${type}". Supported types: ${SUPPORTED_TYPES.join(', ')}`);
    }

    // TTL Validation
    const parsedTtl = parseInt(ttl, 10);
    if (isNaN(parsedTtl) || parsedTtl < 300 || parsedTtl > 604800) {
      throw new Error('TTL must be a valid integer between 300 (5 minutes) and 604800 (7 days)');
    }

    // Name Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new Error('Record name is required');
    }
    const cleanName = name.trim();
    if (/[\r\n\0\s]/.test(cleanName)) {
      throw new Error('Record name contains invalid spaces or control characters');
    }
    if (cleanName.length > 253) {
      throw new Error('Record name cannot exceed 253 characters');
    }

    const normZone = this.normalizeDomain(zoneDomain);
    const fullName = this.normalizeRecordName(cleanName, normZone);

    // Record Value Validation
    if (!rdata || typeof rdata !== 'string') {
      throw new Error('Record data/value is required');
    }
    const cleanRdata = rdata.trim();
    if (/[\r\n\0]/.test(cleanRdata)) {
      throw new Error('Record value contains invalid control characters (CRLF injection prevented)');
    }

    let parsedPriority = undefined;
    let parsedWeight = undefined;
    let parsedPort = undefined;
    let parsedFlag = undefined;
    let parsedTag = undefined;

    switch (upperType) {
      case 'A': {
        if (!IPV4_REGEX.test(cleanRdata)) {
          throw new Error(`Invalid IPv4 address format for A record: "${cleanRdata}". Example: 192.0.2.1`);
        }
        break;
      }
      case 'AAAA': {
        if (!IPV6_REGEX.test(cleanRdata)) {
          throw new Error(`Invalid IPv6 address format for AAAA record: "${cleanRdata}". Example: 2001:db8::1`);
        }
        break;
      }
      case 'CNAME': {
        let target = cleanRdata;
        if (target.endsWith('.')) target = target.slice(0, -1);
        if (IPV4_REGEX.test(cleanRdata) || IPV6_REGEX.test(cleanRdata)) {
          throw new Error('CNAME target cannot be an IP address. Use an A or AAAA record instead.');
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(target) || target.length < 2) {
          throw new Error(`Invalid CNAME target hostname: "${cleanRdata}"`);
        }
        // Apex CNAME check: RFC 1912 forbids CNAME at the zone apex
        if (fullName === `${normZone}.`) {
          throw new Error(`Cannot create a CNAME record at zone apex (${normZone}.). The zone apex requires SOA and NS records.`);
        }
        break;
      }
      case 'MX': {
        const prio = parseInt(priority, 10);
        if (isNaN(prio) || prio < 0 || prio > 65535) {
          throw new Error('MX Priority must be an integer between 0 and 65535');
        }
        parsedPriority = prio;

        let mailTarget = cleanRdata;
        if (mailTarget.endsWith('.')) mailTarget = mailTarget.slice(0, -1);
        if (IPV4_REGEX.test(cleanRdata) || IPV6_REGEX.test(cleanRdata)) {
          throw new Error('MX destination cannot be an IP address (RFC 2181). Specify a valid mail server hostname.');
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(mailTarget) || mailTarget.length < 2) {
          throw new Error(`Invalid MX mail destination hostname: "${cleanRdata}"`);
        }
        break;
      }
      case 'TXT': {
        if (cleanRdata.length > 2048) {
          throw new Error('TXT record cannot exceed 2048 characters');
        }
        break;
      }
      case 'NS': {
        let nsTarget = cleanRdata;
        if (nsTarget.endsWith('.')) nsTarget = nsTarget.slice(0, -1);
        if (IPV4_REGEX.test(cleanRdata) || IPV6_REGEX.test(cleanRdata)) {
          throw new Error('Nameserver cannot be an IP address. Provide a valid hostname.');
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(nsTarget) || nsTarget.length < 2) {
          throw new Error(`Invalid nameserver hostname: "${cleanRdata}"`);
        }
        break;
      }
      case 'SRV': {
        const prio = parseInt(priority, 10);
        if (isNaN(prio) || prio < 0 || prio > 65535) {
          throw new Error('SRV Priority must be an integer between 0 and 65535');
        }
        parsedPriority = prio;

        const w = parseInt(weight, 10);
        if (isNaN(w) || w < 0 || w > 65535) {
          throw new Error('SRV Weight must be an integer between 0 and 65535');
        }
        parsedWeight = w;

        const p = parseInt(port, 10);
        if (isNaN(p) || p < 1 || p > 65535) {
          throw new Error('SRV Port must be an integer between 1 and 65535');
        }
        parsedPort = p;

        let srvTarget = cleanRdata;
        if (srvTarget.endsWith('.')) srvTarget = srvTarget.slice(0, -1);
        if (!/^[a-zA-Z0-9_.-]+$/.test(srvTarget)) {
          throw new Error(`Invalid SRV target hostname: "${cleanRdata}"`);
        }
        break;
      }
      case 'CAA': {
        const f = parseInt(flag !== undefined ? flag : 0, 10);
        if (isNaN(f) || f < 0 || f > 255) {
          throw new Error('CAA Flag must be an integer between 0 and 255 (typically 0)');
        }
        parsedFlag = f;

        const t = (tag || 'issue').trim().toLowerCase();
        if (!['issue', 'issuewild', 'iodef'].includes(t)) {
          throw new Error('CAA Tag must be one of: "issue", "issuewild", or "iodef"');
        }
        parsedTag = t;
        break;
      }
    }

    return {
      type: upperType,
      name: fullName,
      record: cleanRdata,
      ttl: parsedTtl,
      priority: parsedPriority,
      weight: parsedWeight,
      port: parsedPort,
      flag: parsedFlag,
      tag: parsedTag
    };
  }

  /**
   * Check for DNS conflict (e.g. CNAME with other records at the same owner)
   */
  checkConflicts(type, fullName, existingRecords, excludeId = null) {
    const normName = fullName.toLowerCase();
    const otherRecords = existingRecords.filter(r => r.id !== excludeId && r.name.toLowerCase() === normName);

    if (type === 'CNAME') {
      if (otherRecords.length > 0) {
        const existingTypes = otherRecords.map(r => r.type).join(', ');
        throw new Error(`Cannot add CNAME record for "${fullName}". Other record types (${existingTypes}) already exist at this name (RFC 1034).`);
      }
    } else {
      const hasCname = otherRecords.some(r => r.type === 'CNAME');
      if (hasCname) {
        throw new Error(`Cannot add ${type} record for "${fullName}". A CNAME record already exists at this name.`);
      }
    }
  }

  /**
   * Add a new DNS record
   */
  addRecord(domain, recordData = {}, cpanelUser = 'cpanel_user') {
    const verifiedDomain = this.verifyDomainOwnership(domain, cpanelUser);
    const { type, name, record, ttl = 14400, priority, weight, port, flag, tag } = recordData;

    const validated = this.validateRecord(
      type, name, record, ttl, priority, weight, port, flag, tag, verifiedDomain
    );

    const data = domainService._read(cpanelUser);
    data.dnsRecords = data.dnsRecords || [];

    // Conflict detection
    this.checkConflicts(validated.type, validated.name, data.dnsRecords);

    // Duplicate check
    const isDuplicate = data.dnsRecords.some(r => 
      r.name.toLowerCase() === validated.name.toLowerCase() &&
      r.type === validated.type &&
      r.record.toLowerCase() === validated.record.toLowerCase() &&
      r.priority === validated.priority
    );
    if (isDuplicate) {
      throw new Error(`An identical ${validated.type} record already exists for ${validated.name}.`);
    }

    const newId = `dns_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRecord = {
      id: newId,
      name: validated.name,
      type: validated.type,
      ttl: validated.ttl,
      class: 'IN',
      record: validated.record,
      priority: validated.priority,
      weight: validated.weight,
      port: validated.port,
      flag: validated.flag,
      tag: validated.tag,
      created: new Date().toISOString()
    };

    data.dnsRecords.push(newRecord);
    domainService._write(data, cpanelUser);

    return {
      success: true,
      message: 'DNS record added successfully. DNS resolvers may take time to reflect changes according to TTL and caching.',
      record: newRecord
    };
  }

  /**
   * Update an existing DNS record
   */
  updateRecord(domain, id, recordData = {}, cpanelUser = 'cpanel_user') {
    const verifiedDomain = this.verifyDomainOwnership(domain, cpanelUser);
    const data = domainService._read(cpanelUser);
    data.dnsRecords = data.dnsRecords || [];

    const idx = data.dnsRecords.findIndex(r => r.id === String(id));
    if (idx === -1) {
      // Check if it's a virtual/protected SOA or NS record
      if (String(id).startsWith('soa_') || String(id).startsWith('ns1_') || String(id).startsWith('ns2_')) {
        throw new Error('System-managed root SOA and NS records are protected and cannot be directly modified.');
      }
      throw new Error(`DNS record with ID "${id}" not found in zone.`);
    }

    const existing = data.dnsRecords[idx];
    if (existing.isProtected || existing.type === 'SOA') {
      throw new Error('This record is protected and cannot be modified.');
    }

    const newType = recordData.type || existing.type;
    const newName = recordData.name !== undefined ? recordData.name : existing.name;
    const newRecord = recordData.record !== undefined ? recordData.record : existing.record;
    const newTtl = recordData.ttl !== undefined ? recordData.ttl : existing.ttl;
    const newPriority = recordData.priority !== undefined ? recordData.priority : existing.priority;
    const newWeight = recordData.weight !== undefined ? recordData.weight : existing.weight;
    const newPort = recordData.port !== undefined ? recordData.port : existing.port;
    const newFlag = recordData.flag !== undefined ? recordData.flag : existing.flag;
    const newTag = recordData.tag !== undefined ? recordData.tag : existing.tag;

    const validated = this.validateRecord(
      newType, newName, newRecord, newTtl, newPriority, newWeight, newPort, newFlag, newTag, verifiedDomain
    );

    // Conflict detection
    this.checkConflicts(validated.type, validated.name, data.dnsRecords, String(id));

    const updated = {
      ...existing,
      name: validated.name,
      type: validated.type,
      record: validated.record,
      ttl: validated.ttl,
      priority: validated.priority,
      weight: validated.weight,
      port: validated.port,
      flag: validated.flag,
      tag: validated.tag,
      updated: new Date().toISOString()
    };

    data.dnsRecords[idx] = updated;
    domainService._write(data, cpanelUser);

    return {
      success: true,
      message: 'DNS record updated successfully.',
      record: updated
    };
  }

  /**
   * Delete a DNS record
   */
  deleteRecord(domain, id, cpanelUser = 'cpanel_user') {
    this.verifyDomainOwnership(domain, cpanelUser);
    const data = domainService._read(cpanelUser);
    data.dnsRecords = data.dnsRecords || [];

    // Protected checks
    if (String(id).startsWith('soa_') || String(id).startsWith('ns1_') || String(id).startsWith('ns2_')) {
      throw new Error('System-managed root SOA and NS records are protected and cannot be deleted.');
    }

    const record = data.dnsRecords.find(r => r.id === String(id));
    if (!record) {
      throw new Error(`DNS record with ID "${id}" not found.`);
    }

    if (record.isProtected || record.type === 'SOA') {
      throw new Error('This record is protected and cannot be deleted.');
    }

    data.dnsRecords = data.dnsRecords.filter(r => r.id !== String(id));
    domainService._write(data, cpanelUser);

    return {
      success: true,
      message: `DNS record ${record.type} "${record.name}" deleted successfully.`,
      id: String(id)
    };
  }

  /**
   * Reset zone to default standard records
   */
  resetZone(domain, cpanelUser = 'cpanel_user') {
    const verifiedDomain = this.verifyDomainOwnership(domain, cpanelUser);
    const norm = this.normalizeDomain(verifiedDomain);
    const data = domainService._read(cpanelUser);

    // Remove existing records for this domain
    data.dnsRecords = (data.dnsRecords || []).filter(r => {
      const recName = this.normalizeDomain(r.name);
      return recName !== norm && !recName.endsWith(`.${norm}`);
    });

    // Seed clean standard defaults
    const now = Date.now();
    const defaults = [
      { id: `dns_${now}_1`, name: `${norm}.`, type: 'A', ttl: 14400, record: '192.0.2.1', class: 'IN' },
      { id: `dns_${now}_2`, name: `www.${norm}.`, type: 'CNAME', ttl: 14400, record: `${norm}.`, class: 'IN' },
      { id: `dns_${now}_3`, name: `mail.${norm}.`, type: 'A', ttl: 14400, record: '192.0.2.1', class: 'IN' },
      { id: `dns_${now}_4`, name: `${norm}.`, type: 'MX', ttl: 14400, priority: 0, record: `mail.${norm}.`, class: 'IN' },
      { id: `dns_${now}_5`, name: `${norm}.`, type: 'TXT', ttl: 14400, record: '"v=spf1 +a +mx ~all"', class: 'IN' },
      { id: `dns_${now}_6`, name: `default._domainkey.${norm}.`, type: 'TXT', ttl: 14400, record: '"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCg..."', class: 'IN' }
    ];

    data.dnsRecords.push(...defaults);
    domainService._write(data, cpanelUser);

    return {
      success: true,
      message: `Zone "${verifiedDomain}" reset to default records successfully.`,
      records: this.getRecordsForDomain(verifiedDomain, cpanelUser)
    };
  }

  /**
   * Export zone in authentic standard BIND format
   */
  exportZone(domain, cpanelUser = 'cpanel_user') {
    const verifiedDomain = this.verifyDomainOwnership(domain, cpanelUser);
    const norm = this.normalizeDomain(verifiedDomain);
    const records = this.getRecordsForDomain(verifiedDomain, cpanelUser);

    const lines = [
      `; Zone file for ${norm}`,
      `; Exported from cPanel Jupiter Zone Editor`,
      `; Export Date: ${new Date().toISOString()}`,
      `$ORIGIN ${norm}.`,
      `$TTL 14400`,
      ``
    ];

    records.forEach(r => {
      let rName = r.name;
      const ttl = r.ttl || 14400;
      let targetVal = r.record;

      if (r.type === 'MX') {
        lines.push(`${rName.padEnd(30)} ${ttl.toString().padEnd(8)} IN  MX    ${(r.priority || 0).toString().padEnd(4)} ${targetVal}`);
      } else if (r.type === 'SRV') {
        lines.push(`${rName.padEnd(30)} ${ttl.toString().padEnd(8)} IN  SRV   ${r.priority || 0} ${r.weight || 0} ${r.port || 0} ${targetVal}`);
      } else if (r.type === 'CAA') {
        lines.push(`${rName.padEnd(30)} ${ttl.toString().padEnd(8)} IN  CAA   ${r.flag || 0} ${r.tag || 'issue'} "${targetVal}"`);
      } else if (r.type === 'TXT') {
        const val = targetVal.startsWith('"') ? targetVal : `"${targetVal}"`;
        lines.push(`${rName.padEnd(30)} ${ttl.toString().padEnd(8)} IN  TXT   ${val}`);
      } else {
        lines.push(`${rName.padEnd(30)} ${ttl.toString().padEnd(8)} IN  ${r.type.padEnd(6)} ${targetVal}`);
      }
    });

    return {
      success: true,
      domain: verifiedDomain,
      format: 'BIND 9',
      zoneContent: lines.join('\n')
    };
  }

  /**
   * SSRF-Safe live DNS query / verification tool
   */
  async lookupDns(hostname, type = 'A') {
    const cleanHost = (hostname || '').trim().toLowerCase().replace(/\.+$/, '');
    if (!cleanHost || !/^[a-zA-Z0-9_.-]+$/.test(cleanHost)) {
      throw new Error('Invalid lookup hostname');
    }
    const cleanType = (type || 'A').toUpperCase();

    const startTime = Date.now();
    try {
      let results = [];
      switch (cleanType) {
        case 'A': {
          results = await dns.resolve4(cleanHost);
          break;
        }
        case 'AAAA': {
          results = await dns.resolve6(cleanHost);
          break;
        }
        case 'CNAME': {
          results = await dns.resolveCname(cleanHost);
          break;
        }
        case 'MX': {
          results = await dns.resolveMx(cleanHost);
          break;
        }
        case 'TXT': {
          results = await dns.resolveTxt(cleanHost);
          break;
        }
        case 'NS': {
          results = await dns.resolveNs(cleanHost);
          break;
        }
        default:
          throw new Error(`DNS live lookup not supported for type "${cleanType}"`);
      }

      return {
        success: true,
        hostname: cleanHost,
        type: cleanType,
        results,
        responseTimeMs: Date.now() - startTime,
        status: 'Resolved by public DNS resolvers'
      };
    } catch (err) {
      return {
        success: false,
        hostname: cleanHost,
        type: cleanType,
        error: err.code || err.message,
        responseTimeMs: Date.now() - startTime,
        status: 'Unresolved or NXDOMAIN'
      };
    }
  }
}

module.exports = new DnsService();
