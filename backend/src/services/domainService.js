const fs = require('fs');
const path = require('path');
const storageService = require('./storageService');

const DOMAIN_DATA_FILE = path.resolve(__dirname, '../../data/dns/domains.json');
const WHM_ACCOUNTS_FILE = path.resolve(__dirname, '../../data/whm_accounts.json');
const SSL_DATA_FILE = path.resolve(__dirname, '../../data/ssl/certificates.json');

function getPrimaryDomainForUser(username) {
  if (username === 'cpanel_user') return 'example.com';
  try {
    if (fs.existsSync(WHM_ACCOUNTS_FILE)) {
      const accts = JSON.parse(fs.readFileSync(WHM_ACCOUNTS_FILE, 'utf8'));
      const found = accts.find(a => a.user === username);
      if (found && found.domain) return found.domain;
    }
  } catch (e) {}
  return `${username}.com`;
}

function getPlanLimitsForUser(username) {
  try {
    if (fs.existsSync(WHM_ACCOUNTS_FILE)) {
      const accts = JSON.parse(fs.readFileSync(WHM_ACCOUNTS_FILE, 'utf8'));
      const found = accts.find(a => a.user === username);
      if (found) {
        return {
          plan: found.plan || 'Standard Shared Hosting',
          maxAddonDomains: found.maxAddonDomains !== undefined ? found.maxAddonDomains : 10,
          maxSubdomains: found.maxSubdomains !== undefined ? found.maxSubdomains : 50,
          maxAliases: found.maxAliases !== undefined ? found.maxAliases : 10,
          maxTotalDomains: found.maxTotalDomains !== undefined ? found.maxTotalDomains : 20
        };
      }
    }
  } catch (e) {}
  return {
    plan: 'Standard Shared Hosting',
    maxAddonDomains: 10,
    maxSubdomains: 50,
    maxAliases: 10,
    maxTotalDomains: 20
  };
}

function validateDomainName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Domain name is required');
  }
  const trimmed = name.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 253) {
    throw new Error('Domain name must be between 1 and 253 characters in length');
  }
  if (trimmed.includes(' ') || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes(';') || trimmed.includes('&') || trimmed.includes('|') || trimmed.includes('`') || trimmed.includes('$')) {
    throw new Error('Domain name contains invalid or forbidden characters');
  }
  const labels = trimmed.split('.');
  if (labels.length < 2) {
    throw new Error('Domain name must include a valid top-level domain (e.g. example.com)');
  }
  for (const label of labels) {
    if (label.length === 0 || label.length > 63) {
      throw new Error('Domain labels must be between 1 and 63 characters');
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(label)) {
      throw new Error(`Invalid domain label: "${label}". Labels cannot start or end with hyphens and must contain alphanumeric characters.`);
    }
  }
  const tld = labels[labels.length - 1];
  if (/^[0-9]+$/.test(tld) || tld.length < 2) {
    throw new Error('Top-level domain (TLD) must contain letters and be at least 2 characters long');
  }
  return trimmed;
}

function createDefaultAccountData(domain = 'example.com') {
  return {
    primaryDomain: domain,
    domains: [
      {
        id: `dom_${domain.replace(/[^a-z0-9]/g, '_')}`,
        name: domain,
        type: 'Primary Domain',
        documentRoot: 'public_html',
        phpVersion: 'ea-php82',
        sslStatus: "Valid Let's Encrypt SSL",
        forceHttps: true,
        redirectTarget: null,
        redirectType: null,
        status: 'Active',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      }
    ],
    subdomains: [
      {
        id: `sub_blog_${domain.replace(/[^a-z0-9]/g, '_')}`,
        name: `blog.${domain}`,
        domain: domain,
        sub: 'blog',
        documentRoot: 'public_html/blog',
        phpVersion: 'ea-php82',
        sslStatus: "Valid Let's Encrypt SSL",
        forceHttps: false,
        redirectTarget: null,
        status: 'Active',
        created: new Date().toISOString()
      },
      {
        id: `sub_app_${domain.replace(/[^a-z0-9]/g, '_')}`,
        name: `app.${domain}`,
        domain: domain,
        sub: 'app',
        documentRoot: 'public_html/app',
        phpVersion: 'ea-php82',
        sslStatus: "Pending AutoSSL",
        forceHttps: false,
        redirectTarget: null,
        status: 'Active',
        created: new Date().toISOString()
      }
    ],
    redirects: [
      {
        type: '301 Permanent',
        sourceUrl: `${domain}/old-page`,
        destUrl: `https://${domain}/new-page`,
        wildcard: false,
        created: new Date().toISOString()
      }
    ],
    dnsRecords: [
      { id: '1', name: `${domain}.`, type: 'A', ttl: 14400, record: '192.0.2.1' },
      { id: '2', name: `www.${domain}.`, type: 'CNAME', ttl: 14400, record: `${domain}.` },
      { id: '3', name: `mail.${domain}.`, type: 'A', ttl: 14400, record: '192.0.2.1' },
      { id: '4', name: `${domain}.`, type: 'MX', ttl: 14400, priority: 0, record: `mail.${domain}.` },
      { id: '5', name: `${domain}.`, type: 'TXT', ttl: 14400, record: '"v=spf1 +a +mx ~all"' },
      { id: '6', name: `default._domainkey.${domain}.`, type: 'TXT', ttl: 14400, record: '"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCg..."' }
    ],
    aliases: [
      {
        id: `alias_${domain.replace(/[^a-z0-9]/g, '_')}_org`,
        name: `${domain}.org`,
        targetDomain: domain,
        status: 'Active',
        sslStatus: 'Pending AutoSSL',
        created: new Date().toISOString()
      }
    ],
    directoryPrivacy: [
      { dirPath: 'public_html/admin', enabled: true, user: 'admin', created: new Date().toISOString() }
    ],
    blockedIps: [
      { ip: '198.51.100.4', reason: 'Repeated unauthorized login attempts', date: new Date().toISOString() }
    ],
    hotlinkProtection: {
      enabled: true,
      allowedExtensions: 'jpg,jpeg,gif,png,bmp,webp,mp4',
      urls: [`http://${domain}`, `https://${domain}`]
    },
    ftpAccounts: [
      { user: `webmaster@${domain}`, domain: domain, dir: 'public_html', quota: 'Unlimited', created: new Date().toISOString() }
    ]
  };
}

function ensureDomainStore() {
  const dir = path.dirname(DOMAIN_DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DOMAIN_DATA_FILE)) {
    const initial = {
      accounts: {
        'cpanel_user': createDefaultAccountData('example.com')
      }
    };
    fs.writeFileSync(DOMAIN_DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

class DomainService {
  constructor() {
    ensureDomainStore();
  }

  _readAll() {
    ensureDomainStore();
    try {
      const raw = JSON.parse(fs.readFileSync(DOMAIN_DATA_FILE, 'utf8'));
      if (!raw.accounts) {
        const legacy = { ...raw };
        const migrated = {
          accounts: {
            'cpanel_user': legacy
          }
        };
        fs.writeFileSync(DOMAIN_DATA_FILE, JSON.stringify(migrated, null, 2), 'utf8');
        return migrated;
      }
      return raw;
    } catch (e) {
      return { accounts: { 'cpanel_user': createDefaultAccountData('example.com') } };
    }
  }

  _writeAll(data) {
    fs.writeFileSync(DOMAIN_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  _read(cpanelUser = 'cpanel_user') {
    const all = this._readAll();
    if (!all.accounts[cpanelUser]) {
      const primaryDomain = getPrimaryDomainForUser(cpanelUser);
      all.accounts[cpanelUser] = createDefaultAccountData(primaryDomain);
      this._writeAll(all);
    }
    const data = all.accounts[cpanelUser];
    data.domains = data.domains || [];
    data.subdomains = data.subdomains || [];
    data.aliases = data.aliases || [];
    data.redirects = data.redirects || [];
    data.dnsRecords = data.dnsRecords || [];
    data.directoryPrivacy = data.directoryPrivacy || [];
    data.blockedIps = data.blockedIps || [];
    data.hotlinkProtection = data.hotlinkProtection || {
      enabled: true,
      allowedExtensions: 'jpg,jpeg,gif,png,bmp,webp,mp4',
      urls: [`http://${data.primaryDomain}`, `https://${data.primaryDomain}`]
    };
    data.ftpAccounts = data.ftpAccounts || [];

    // Ensure all domains have ID, forceHttps, status, etc.
    data.domains.forEach(d => {
      if (!d.id) d.id = `dom_${d.name.replace(/[^a-z0-9]/g, '_')}`;
      if (d.forceHttps === undefined) d.forceHttps = d.type === 'Primary Domain';
      if (!d.status) d.status = 'Active';
      if (!d.phpVersion) d.phpVersion = 'ea-php82';
      if (!d.sslStatus) d.sslStatus = d.type === 'Primary Domain' ? "Valid Let's Encrypt SSL" : 'Pending AutoSSL';
    });

    return data;
  }

  _write(data, cpanelUser = 'cpanel_user') {
    const all = this._readAll();
    all.accounts[cpanelUser] = data;
    this._writeAll(all);
  }

  initAccount(username, primaryDomain) {
    const all = this._readAll();
    all.accounts[username] = createDefaultAccountData(primaryDomain);
    this._writeAll(all);
    return all.accounts[username];
  }

  getAll(cpanelUser = 'cpanel_user') {
    return this._read(cpanelUser);
  }

  /**
   * Return unified inventory of domains for cPanel Domains manager
   */
  getUnifiedDomains(cpanelUser = 'cpanel_user', query = '', filterType = '') {
    const data = this._read(cpanelUser);
    const limits = getPlanLimitsForUser(cpanelUser);

    const unified = [];

    // 1. Primary and Addon Domains
    for (const d of data.domains) {
      // Check if document root folder physically exists
      let docRootExists = false;
      try {
        const fullDocPath = storageService.resolveSafePath(d.documentRoot || 'public_html', cpanelUser);
        docRootExists = fs.existsSync(fullDocPath);
      } catch (e) {
        docRootExists = false;
      }

      unified.push({
        id: d.id || `dom_${d.name.replace(/[^a-z0-9]/g, '_')}`,
        name: d.name,
        type: d.type || (d.name === data.primaryDomain ? 'Primary Domain' : 'Addon Domain'),
        isPrimary: d.name === data.primaryDomain || d.type === 'Primary Domain',
        documentRoot: d.documentRoot || 'public_html',
        docRootExists,
        phpVersion: d.phpVersion || 'ea-php82',
        sslStatus: d.sslStatus || "Valid Let's Encrypt SSL",
        forceHttps: !!d.forceHttps,
        redirectTarget: d.redirectTarget || null,
        redirectType: d.redirectType || null,
        status: d.status || 'Active',
        created: d.created || new Date().toISOString(),
        updated: d.updated || d.created || new Date().toISOString()
      });
    }

    // 2. Subdomains
    for (const s of data.subdomains) {
      let docRootExists = false;
      try {
        const fullDocPath = storageService.resolveSafePath(s.documentRoot || `public_html/${s.sub}`, cpanelUser);
        docRootExists = fs.existsSync(fullDocPath);
      } catch (e) {
        docRootExists = false;
      }

      unified.push({
        id: s.id || `sub_${s.name.replace(/[^a-z0-9]/g, '_')}`,
        name: s.name,
        type: 'Subdomain',
        isPrimary: false,
        parentDomain: s.domain,
        sub: s.sub,
        documentRoot: s.documentRoot || `public_html/${s.sub}`,
        docRootExists,
        phpVersion: s.phpVersion || 'ea-php82',
        sslStatus: s.sslStatus || "Valid Let's Encrypt SSL",
        forceHttps: !!s.forceHttps,
        redirectTarget: s.redirectTarget || null,
        status: s.status || 'Active',
        created: s.created || new Date().toISOString()
      });
    }

    // 3. Aliases (Parked Domains)
    for (const a of data.aliases) {
      const parent = data.domains.find(d => d.name === a.targetDomain) || data.domains[0];
      unified.push({
        id: a.id || `alias_${a.name.replace(/[^a-z0-9]/g, '_')}`,
        name: a.name,
        type: 'Alias',
        isPrimary: false,
        targetDomain: a.targetDomain,
        documentRoot: parent?.documentRoot || 'public_html',
        docRootExists: true,
        phpVersion: parent?.phpVersion || 'ea-php82',
        sslStatus: a.sslStatus || 'Pending AutoSSL',
        forceHttps: !!parent?.forceHttps,
        redirectTarget: a.targetDomain ? `https://${a.targetDomain}` : null,
        status: a.status || 'Active',
        created: a.created || new Date().toISOString()
      });
    }

    // Filter
    let filtered = unified;
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      filtered = filtered.filter(item => item.name.toLowerCase().includes(q) || item.documentRoot.toLowerCase().includes(q));
    }
    if (filterType && filterType !== 'all') {
      filtered = filtered.filter(item => item.type.toLowerCase().includes(filterType.toLowerCase()));
    }

    // Compute stats & quotas
    const addonCount = data.domains.filter(d => d.type === 'Addon Domain').length;
    const subdomainCount = data.subdomains.length;
    const aliasCount = data.aliases.length;
    const totalCount = unified.length;

    return {
      primaryDomain: data.primaryDomain,
      domains: filtered,
      totalCount,
      stats: {
        total: totalCount,
        primary: 1,
        addon: addonCount,
        subdomain: subdomainCount,
        alias: aliasCount
      },
      limits: {
        ...limits,
        addonUsage: addonCount,
        subdomainUsage: subdomainCount,
        aliasUsage: aliasCount,
        totalUsage: totalCount
      }
    };
  }

  /**
   * Detailed inspector for a specific domain
   */
  getDomainDetails(domainName, cpanelUser = 'cpanel_user') {
    if (!domainName) throw new Error('Domain name is required');
    const norm = domainName.trim().toLowerCase();
    const data = this._read(cpanelUser);

    const domain = data.domains.find(d => d.name.toLowerCase() === norm);
    const subdomain = data.subdomains.find(s => s.name.toLowerCase() === norm);
    const alias = data.aliases.find(a => a.name.toLowerCase() === norm);

    if (!domain && !subdomain && !alias) {
      throw new Error(`Domain "${domainName}" not found in account`);
    }

    const item = domain || subdomain || alias;
    const docRoot = item.documentRoot || (alias ? 'public_html' : 'public_html');
    let docRootPhysical = '';
    let docRootExists = false;
    let fileCount = 0;
    try {
      docRootPhysical = storageService.resolveSafePath(docRoot, cpanelUser);
      docRootExists = fs.existsSync(docRootPhysical);
      if (docRootExists) {
        const files = fs.readdirSync(docRootPhysical);
        fileCount = files.length;
      }
    } catch (e) {}

    // Find DNS records for this domain
    const relatedDns = data.dnsRecords.filter(r => r.name.toLowerCase().includes(norm));

    return {
      name: norm,
      type: domain ? domain.type : (subdomain ? 'Subdomain' : 'Alias'),
      isPrimary: norm === data.primaryDomain.toLowerCase(),
      documentRoot: docRoot,
      docRootPhysical,
      docRootExists,
      fileCount,
      phpVersion: item.phpVersion || 'ea-php82',
      sslStatus: item.sslStatus || "Valid Let's Encrypt SSL",
      forceHttps: !!item.forceHttps,
      redirectTarget: item.redirectTarget || null,
      redirectType: item.redirectType || null,
      status: item.status || 'Active',
      created: item.created,
      dnsRecords: relatedDns,
      webServer: 'Apache/2.4 (cPanel Enterprise Engine)'
    };
  }

  /**
   * Pre-flight syntax and conflict verification
   */
  checkDomainName(name, cpanelUser = 'cpanel_user') {
    const validName = validateDomainName(name);
    const all = this._readAll();

    // Check conflict across account
    const userData = this._read(cpanelUser);
    const existsLocal = userData.domains.some(d => d.name.toLowerCase() === validName) ||
                        userData.subdomains.some(s => s.name.toLowerCase() === validName) ||
                        userData.aliases.some(a => a.name.toLowerCase() === validName);

    if (existsLocal) {
      return { valid: false, message: `Domain "${validName}" already exists in your account.` };
    }

    // Check conflict across server tenants
    for (const [user, uData] of Object.entries(all.accounts || {})) {
      if (user !== cpanelUser) {
        const conflict = (uData.domains || []).some(d => d.name.toLowerCase() === validName) ||
                         (uData.subdomains || []).some(s => s.name.toLowerCase() === validName);
        if (conflict) {
          return { valid: false, message: `Domain "${validName}" is already registered on this server by another account.` };
        }
      }
    }

    // Check plan limits
    const limits = getPlanLimitsForUser(cpanelUser);
    const currentAddons = userData.domains.filter(d => d.type === 'Addon Domain').length;
    if (currentAddons >= limits.maxAddonDomains) {
      return { valid: false, message: `Your hosting plan has reached its Addon Domain limit (${limits.maxAddonDomains}).` };
    }

    return {
      valid: true,
      name: validName,
      suggestedDocRoot: `public_html/${validName}`,
      message: 'Domain name is valid and available for configuration.'
    };
  }

  /**
   * Production Domain Creation with full parameters
   */
  createDomain(options = {}, cpanelUser = 'cpanel_user') {
    const {
      name,
      documentRoot,
      shareDocRoot = false,
      type = 'Addon Domain',
      phpVersion = 'ea-php82',
      forceHttps = false,
      redirectTarget = null
    } = options;

    const validName = validateDomainName(name);
    const check = this.checkDomainName(validName, cpanelUser);
    if (!check.valid) {
      throw new Error(check.message);
    }

    const data = this._read(cpanelUser);

    // Document Root path security & resolution
    let targetDocRoot = 'public_html';
    if (!shareDocRoot) {
      const rawRoot = documentRoot ? documentRoot.trim() : `public_html/${validName}`;
      // Validate safe path inside account jail
      const resolved = storageService.resolveSafePath(rawRoot, cpanelUser);
      targetDocRoot = rawRoot.replace(/^\/+/, '').replace(/\\/g, '/');

      // Ensure directory is physically created on disk
      if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
        const defaultIndex = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${validName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .box { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; max-width: 480px; }
    h1 { color: #0f172a; margin-top: 0; }
    .badge { background: #ff6c2c; color: #fff; padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="box">
    <span class="badge">cPanel Hosted</span>
    <h1>${validName}</h1>
    <p>Domain successfully configured on document root <code>${targetDocRoot}</code>.</p>
  </div>
</body>
</html>`;
        fs.writeFileSync(path.join(resolved, 'index.html'), defaultIndex, 'utf8');
      }
    }

    const newDomain = {
      id: `dom_${validName.replace(/[^a-z0-9]/g, '_')}`,
      name: validName,
      type: type === 'Primary Domain' ? 'Addon Domain' : (type || 'Addon Domain'),
      documentRoot: targetDocRoot,
      phpVersion: phpVersion || 'ea-php82',
      sslStatus: 'Pending AutoSSL',
      forceHttps: !!forceHttps,
      redirectTarget: redirectTarget || null,
      redirectType: redirectTarget ? '301 Permanent' : null,
      status: 'Active',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    data.domains.push(newDomain);

    // Auto-create standard DNS zone records
    data.dnsRecords.push(
      { id: String(Date.now()), name: `${validName}.`, type: 'A', ttl: 14400, record: '192.0.2.1' },
      { id: String(Date.now() + 1), name: `www.${validName}.`, type: 'CNAME', ttl: 14400, record: `${validName}.` },
      { id: String(Date.now() + 2), name: `mail.${validName}.`, type: 'A', ttl: 14400, record: '192.0.2.1' },
      { id: String(Date.now() + 3), name: `${validName}.`, type: 'TXT', ttl: 14400, record: '"v=spf1 +a +mx ~all"' }
    );

    this._write(data, cpanelUser);
    return newDomain;
  }

  /**
   * Update domain settings (document root, force HTTPS, redirect)
   */
  updateDomain(domainName, updates = {}, cpanelUser = 'cpanel_user') {
    if (!domainName) throw new Error('Domain name is required');
    const norm = domainName.trim().toLowerCase();
    const data = this._read(cpanelUser);

    const domIndex = data.domains.findIndex(d => d.name.toLowerCase() === norm);
    const subIndex = data.subdomains.findIndex(s => s.name.toLowerCase() === norm);

    if (domIndex === -1 && subIndex === -1) {
      throw new Error(`Domain "${domainName}" not found in your account`);
    }

    if (domIndex >= 0) {
      const target = data.domains[domIndex];

      // Document root update
      if (updates.documentRoot !== undefined) {
        const rawRoot = updates.documentRoot.trim();
        const resolved = storageService.resolveSafePath(rawRoot, cpanelUser);
        target.documentRoot = rawRoot.replace(/^\/+/, '').replace(/\\/g, '/');
        if (!fs.existsSync(resolved)) {
          fs.mkdirSync(resolved, { recursive: true });
        }
      }

      // Force HTTPS update
      if (updates.forceHttps !== undefined) {
        target.forceHttps = !!updates.forceHttps;
      }

      // PHP Version update
      if (updates.phpVersion !== undefined) {
        target.phpVersion = updates.phpVersion;
      }

      // Redirect update
      if (updates.redirectTarget !== undefined) {
        target.redirectTarget = updates.redirectTarget ? updates.redirectTarget.trim() : null;
        target.redirectType = target.redirectTarget ? (updates.redirectType || '301 Permanent') : null;
      }

      target.updated = new Date().toISOString();
      this._write(data, cpanelUser);
      return target;
    } else {
      const target = data.subdomains[subIndex];
      if (updates.documentRoot !== undefined) {
        const rawRoot = updates.documentRoot.trim();
        const resolved = storageService.resolveSafePath(rawRoot, cpanelUser);
        target.documentRoot = rawRoot.replace(/^\/+/, '').replace(/\\/g, '/');
        if (!fs.existsSync(resolved)) {
          fs.mkdirSync(resolved, { recursive: true });
        }
      }
      if (updates.forceHttps !== undefined) {
        target.forceHttps = !!updates.forceHttps;
      }
      if (updates.redirectTarget !== undefined) {
        target.redirectTarget = updates.redirectTarget ? updates.redirectTarget.trim() : null;
      }
      this._write(data, cpanelUser);
      return target;
    }
  }

  /**
   * Pre-delete inspection: returns list of impacted files, DNS records, subdomains
   */
  preDeleteCheck(domainName, cpanelUser = 'cpanel_user') {
    if (!domainName) throw new Error('Domain name is required');
    const norm = domainName.trim().toLowerCase();
    const data = this._read(cpanelUser);

    if (norm === data.primaryDomain.toLowerCase()) {
      throw new Error('The primary domain for this cPanel account cannot be deleted.');
    }

    const domain = data.domains.find(d => d.name.toLowerCase() === norm);
    const subdomain = data.subdomains.find(s => s.name.toLowerCase() === norm);
    const alias = data.aliases.find(a => a.name.toLowerCase() === norm);

    if (!domain && !subdomain && !alias) {
      throw new Error(`Domain "${domainName}" not found`);
    }

    const item = domain || subdomain || alias;
    const docRoot = item.documentRoot || 'public_html';

    let fileCount = 0;
    try {
      const fullPath = storageService.resolveSafePath(docRoot, cpanelUser);
      if (fs.existsSync(fullPath)) {
        fileCount = fs.readdirSync(fullPath).length;
      }
    } catch (e) {}

    const relatedDns = data.dnsRecords.filter(r => r.name.toLowerCase().includes(norm));
    const relatedSubdomains = data.subdomains.filter(s => s.domain?.toLowerCase() === norm);

    return {
      domain: norm,
      type: domain ? domain.type : (subdomain ? 'Subdomain' : 'Alias'),
      documentRoot: docRoot,
      fileCount,
      dnsRecordCount: relatedDns.length,
      subdomainCount: relatedSubdomains.length,
      isSharedDocRoot: docRoot === 'public_html'
    };
  }

  /**
   * Safe deletion
   */
  deleteDomain(name, cpanelUser = 'cpanel_user') {
    if (!name) throw new Error('Domain name is required');
    const norm = name.trim().toLowerCase();
    const data = this._read(cpanelUser);

    if (data.primaryDomain.toLowerCase() === norm) {
      throw new Error('Cannot delete primary domain');
    }

    const domExists = data.domains.some(d => d.name.toLowerCase() === norm);
    const subExists = data.subdomains.some(s => s.name.toLowerCase() === norm);
    const aliasExists = data.aliases.some(a => a.name.toLowerCase() === norm);

    if (!domExists && !subExists && !aliasExists) {
      throw new Error(`Domain "${name}" not found`);
    }

    data.domains = data.domains.filter(d => d.name.toLowerCase() !== norm);
    data.subdomains = data.subdomains.filter(s => s.name.toLowerCase() !== norm && s.domain?.toLowerCase() !== norm);
    data.aliases = data.aliases.filter(a => a.name.toLowerCase() !== norm);
    data.dnsRecords = data.dnsRecords.filter(r => !r.name.toLowerCase().includes(norm));

    this._write(data, cpanelUser);
    return { success: true, name: norm };
  }

  // --- Legacy Compatibility Methods ---
  addDomain(name, documentRoot = null, type = 'Addon Domain', cpanelUser = 'cpanel_user') {
    return this.createDomain({
      name,
      documentRoot,
      shareDocRoot: documentRoot === 'public_html',
      type
    }, cpanelUser);
  }

  addSubdomain(sub, domain, documentRoot = null, cpanelUser = 'cpanel_user') {
    if (!sub || !/^[a-zA-Z0-9-]+$/.test(sub)) {
      throw new Error('Subdomain prefix can only contain alphanumeric characters and hyphens');
    }
    const normDomain = domain.trim().toLowerCase();
    const data = this._read(cpanelUser);
    const fullName = `${sub}.${normDomain}`.toLowerCase();
    if (data.subdomains.find(s => s.name === fullName)) {
      throw new Error('Subdomain already exists');
    }
    const docRoot = documentRoot || `public_html/${sub}`;
    const resolved = storageService.resolveSafePath(docRoot, cpanelUser);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }

    const newSub = {
      id: `sub_${fullName.replace(/[^a-z0-9]/g, '_')}`,
      name: fullName,
      domain: normDomain,
      sub,
      documentRoot: docRoot,
      phpVersion: 'ea-php82',
      sslStatus: "Pending AutoSSL",
      forceHttps: false,
      redirectTarget: null,
      status: 'Active',
      created: new Date().toISOString()
    };
    data.subdomains.push(newSub);

    data.dnsRecords.push({
      id: String(Date.now()),
      name: `${fullName}.`,
      type: 'CNAME',
      ttl: 14400,
      record: `${normDomain}.`
    });

    this._write(data, cpanelUser);
    return newSub;
  }

  deleteSubdomain(fullName, cpanelUser = 'cpanel_user') {
    const data = this._read(cpanelUser);
    const norm = fullName.trim().toLowerCase();
    data.subdomains = data.subdomains.filter(s => s.name.toLowerCase() !== norm);
    data.dnsRecords = data.dnsRecords.filter(r => !r.name.toLowerCase().startsWith(norm));
    this._write(data, cpanelUser);
    return { success: true, name: norm };
  }

  addRedirect(type, sourceUrl, destUrl, wildcard = false, cpanelUser = 'cpanel_user') {
    if (!sourceUrl || !destUrl) throw new Error('Source URL and Destination URL are required');
    const data = this._read(cpanelUser);
    const newRedir = {
      type: type || '301 Permanent',
      sourceUrl: sourceUrl.trim(),
      destUrl: destUrl.trim(),
      wildcard: !!wildcard,
      created: new Date().toISOString()
    };
    data.redirects.push(newRedir);
    this._write(data, cpanelUser);
    return newRedir;
  }

  deleteRedirect(sourceUrl, cpanelUser = 'cpanel_user') {
    const data = this._read(cpanelUser);
    data.redirects = data.redirects.filter(r => r.sourceUrl !== sourceUrl);
    this._write(data, cpanelUser);
    return { success: true };
  }

  addDnsRecord(name, type, record, ttl = 14400, priority = 0, cpanelUser = 'cpanel_user') {
    if (!name || !record) throw new Error('DNS name and record value are required');
    const data = this._read(cpanelUser);
    const newRecord = {
      id: String(Date.now()),
      name: name.endsWith('.') ? name : `${name}.`,
      type: type.toUpperCase(),
      ttl: parseInt(ttl, 10) || 14400,
      record: record.trim(),
      priority: (type.toUpperCase() === 'MX' || type.toUpperCase() === 'SRV') ? parseInt(priority, 10) : undefined
    };
    data.dnsRecords.push(newRecord);
    this._write(data, cpanelUser);
    return newRecord;
  }

  deleteDnsRecord(id, cpanelUser = 'cpanel_user') {
    const data = this._read(cpanelUser);
    data.dnsRecords = data.dnsRecords.filter(r => r.id !== id);
    this._write(data, cpanelUser);
    return { success: true, id };
  }

  addAlias(name, targetDomain = null, cpanelUser = 'cpanel_user') {
    const validName = validateDomainName(name);
    const data = this._read(cpanelUser);
    if (data.aliases.find(a => a.name.toLowerCase() === validName)) {
      throw new Error('Alias already exists');
    }
    const target = targetDomain || data.primaryDomain || 'example.com';
    const newAlias = {
      id: `alias_${validName.replace(/[^a-z0-9]/g, '_')}`,
      name: validName,
      targetDomain: target,
      status: 'Active',
      sslStatus: 'Pending AutoSSL',
      created: new Date().toISOString()
    };
    data.aliases.push(newAlias);
    this._write(data, cpanelUser);
    return newAlias;
  }

  deleteAlias(name, cpanelUser = 'cpanel_user') {
    const data = this._read(cpanelUser);
    const norm = name.trim().toLowerCase();
    data.aliases = data.aliases.filter(a => a.name.toLowerCase() !== norm);
    this._write(data, cpanelUser);
    return { success: true, name: norm };
  }

  setDirectoryPrivacy(dirPath, enabled, username, password, cpanelUser = 'cpanel_user') {
    const data = this._read(cpanelUser);
    const existingIndex = data.directoryPrivacy.findIndex(p => p.dirPath === dirPath);
    if (!enabled) {
      if (existingIndex >= 0) data.directoryPrivacy.splice(existingIndex, 1);
    } else {
      const record = {
        dirPath,
        enabled: true,
        user: username || 'user',
        created: new Date().toISOString()
      };
      if (existingIndex >= 0) {
        data.directoryPrivacy[existingIndex] = record;
      } else {
        data.directoryPrivacy.push(record);
      }
    }
    this._write(data, cpanelUser);
    return { success: true, dirPath, enabled };
  }

  blockIp(ip, reason = 'Blocked by administrator', cpanelUser = 'cpanel_user') {
    if (!ip || !/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(ip)) {
      throw new Error('Please enter a valid IP address or CIDR range (e.g. 192.168.1.50 or 10.0.0.0/24)');
    }
    const data = this._read(cpanelUser);
    if (data.blockedIps.find(b => b.ip === ip)) {
      throw new Error('This IP is already blocked');
    }
    const record = { ip, reason, date: new Date().toISOString() };
    data.blockedIps.push(record);
    this._write(data, cpanelUser);
    return record;
  }

  unblockIp(ip, cpanelUser = 'cpanel_user') {
    const data = this._read(cpanelUser);
    data.blockedIps = data.blockedIps.filter(b => b.ip !== ip);
    this._write(data, cpanelUser);
    return { success: true, ip };
  }

  toggleHotlink(enabled, allowedExtensions, cpanelUser = 'cpanel_user') {
    const data = this._read(cpanelUser);
    data.hotlinkProtection = {
      enabled: !!enabled,
      allowedExtensions: allowedExtensions || 'jpg,jpeg,gif,png,webp',
      urls: [data.primaryDomain, ...data.domains.map(d => d.name)]
    };
    this._write(data, cpanelUser);
    return data.hotlinkProtection;
  }

  addFtpAccount(user, domain = null, password, dir = 'public_html', quota = 'Unlimited', cpanelUser = 'cpanel_user') {
    if (!user || !/^[a-zA-Z0-9_]+$/.test(user)) {
      throw new Error('FTP username can only contain alphanumeric characters');
    }
    if (!password || password.length < 5) {
      throw new Error('Password must be at least 5 characters');
    }
    const data = this._read(cpanelUser);
    const ftpDomain = domain || data.primaryDomain || 'example.com';
    const fullUser = `${user}@${ftpDomain}`;
    if (data.ftpAccounts.find(f => f.user === fullUser)) {
      throw new Error('FTP account already exists');
    }
    const record = {
      user: fullUser,
      domain: ftpDomain,
      dir: dir.startsWith('public_html') ? dir : `public_html/${dir}`,
      quota: quota || 'Unlimited',
      created: new Date().toISOString()
    };
    data.ftpAccounts.push(record);
    this._write(data, cpanelUser);
    return record;
  }

  deleteFtpAccount(user, cpanelUser = 'cpanel_user') {
    const data = this._read(cpanelUser);
    data.ftpAccounts = data.ftpAccounts.filter(f => f.user !== user);
    this._write(data, cpanelUser);
    return { success: true, user };
  }
}

module.exports = new DomainService();
