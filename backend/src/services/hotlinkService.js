const fs = require('fs');
const path = require('path');
const domainService = require('./domainService');

const HOTLINK_FILE = path.join(__dirname, '../../data/hotlink_protection.json');
const AUDIT_LOG = path.join(__dirname, '../../data/hotlink_audit.log');
const DEFAULT_EXTENSIONS = 'jpg,jpeg,gif,png,bmp,webp,svg,avif,mp4,webm,mp3,pdf';
const BEGIN_MARKER = '# BEGIN CPANEL HOTLINK PROTECTION';
const END_MARKER = '# END CPANEL HOTLINK PROTECTION';

class HotlinkService {
  constructor() {
    this._ensureDataDir();
  }

  _ensureDataDir() {
    const dir = path.dirname(HOTLINK_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(HOTLINK_FILE)) {
      const initial = { accounts: {} };
      fs.writeFileSync(HOTLINK_FILE, JSON.stringify(initial, null, 2), 'utf8');
    }
  }

  _readAll() {
    try {
      this._ensureDataDir();
      const raw = fs.readFileSync(HOTLINK_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      return { accounts: {} };
    }
  }

  _writeAll(data) {
    try {
      this._ensureDataDir();
      const tmp = HOTLINK_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, HOTLINK_FILE);
    } catch (e) {
      console.error('Error saving hotlink data:', e);
    }
  }

  _log(action, details) {
    try {
      const entry = `[${new Date().toISOString()}] [HOTLINK] [${action}] ${JSON.stringify(details)}\n`;
      fs.appendFileSync(AUDIT_LOG, entry, 'utf8');
    } catch (e) {}
  }

  // Determine user document root and .htaccess path
  _getHtaccessPath(username = 'cpanel_user') {
    const vhostsBase = path.join(__dirname, '../../data/vhosts');
    const userVhost = path.join(vhostsBase, username === 'cpanel_user' ? 'default' : username);
    const pubHtml = path.join(userVhost, 'public_html');
    if (!fs.existsSync(pubHtml)) {
      fs.mkdirSync(pubHtml, { recursive: true });
    }
    return path.join(pubHtml, '.htaccess');
  }

  _extractHtaccessBlock(content) {
    if (!content) return '';
    const start = content.indexOf(BEGIN_MARKER);
    const end = content.indexOf(END_MARKER);
    if (start !== -1 && end !== -1) {
      return content.substring(start, end + END_MARKER.length);
    }
    return '';
  }

  // Get server capabilities
  getCapabilities() {
    return {
      success: true,
      webServer: 'Apache / 2.4.58 (cPanel Pro) / LiteSpeed compatible',
      enforcementMechanism: '.htaccess mod_rewrite directives (RewriteCond %{HTTP_REFERER} / RewriteRule ... [NC,F,L])',
      scope: 'Account Document Root (public_html)',
      allowEmptyRefererSupported: true,
      redirectUrlSupported: true,
      defaultExtensions: DEFAULT_EXTENSIONS
    };
  }

  // Normalize extensions string into clean comma-separated list
  normalizeExtensions(extInput) {
    if (!extInput) return DEFAULT_EXTENSIONS;
    let items = [];
    if (Array.isArray(extInput)) {
      items = extInput.map(e => String(e).trim().toLowerCase().replace(/^\./, '').replace(/[^a-z0-9]/g, ''));
    } else if (typeof extInput === 'string') {
      items = extInput
        .split(/[,|\s]+/)
        .map(e => e.trim().toLowerCase().replace(/^\./, '').replace(/[^a-z0-9]/g, ''));
    }
    const unique = Array.from(new Set(items.filter(Boolean)));
    return unique.length > 0 ? unique.join(',') : DEFAULT_EXTENSIONS;
  }

  // Normalize allowed URLs/domains array
  normalizeAllowedUrls(urlInput) {
    let list = [];
    if (Array.isArray(urlInput)) {
      list = urlInput;
    } else if (typeof urlInput === 'string') {
      list = urlInput.split(/[\r\n,]+/).map(u => u.trim()).filter(Boolean);
    }

    const clean = [];
    for (let u of list) {
      if (!u || typeof u !== 'string') continue;
      const trimmed = u.trim().toLowerCase();
      if (/[\r\n;|<>$&`"']/.test(trimmed)) continue;
      let host = trimmed;
      try {
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          const parsed = new URL(trimmed);
          host = parsed.hostname;
        } else {
          host = trimmed.replace(/\/.*$/, '');
        }
      } catch (e) {
        host = trimmed.replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '');
      }
      if (host && /^[a-z0-9.-]+$/.test(host) && !clean.includes(host)) {
        clean.push(host);
      }
    }
    return clean;
  }

  // Get current configuration for an account
  getConfig(username = 'cpanel_user') {
    const all = this._readAll();
    let domainData = { primaryDomain: 'example.com', domains: [], subdomains: [] };
    try {
      domainData = domainService._read(username);
    } catch (e) {}

    const authorizedDomains = [
      domainData.primaryDomain,
      ...(domainData.domains || []).map(d => d.name),
      ...(domainData.subdomains || []).map(s => s.name)
    ].filter(Boolean);

    let config = all.accounts[username];
    if (!config) {
      const defaultUrls = [];
      authorizedDomains.forEach(d => {
        defaultUrls.push(d);
        if (!d.startsWith('www.')) defaultUrls.push(`www.${d}`);
      });

      config = {
        enabled: false,
        allowedExtensions: DEFAULT_EXTENSIONS,
        allowedUrls: Array.from(new Set(defaultUrls)),
        allowEmptyReferer: true,
        redirectUrl: '',
        updatedAt: new Date().toISOString()
      };
      all.accounts[username] = config;
      this._writeAll(all);
    }

    const htaccessPath = this._getHtaccessPath(username);
    let onDisk = false;
    let htaccessContent = '';
    if (fs.existsSync(htaccessPath)) {
      htaccessContent = fs.readFileSync(htaccessPath, 'utf8');
      onDisk = htaccessContent.includes(BEGIN_MARKER) && htaccessContent.includes(END_MARKER);
    }

    const drift = config.enabled !== onDisk;
    const extArray = (config.allowedExtensions || DEFAULT_EXTENSIONS).split(',').map(s => s.trim()).filter(Boolean);
    const urlsArray = config.allowedUrls || [];

    return {
      success: true,
      enabled: config.enabled,
      allowedExtensions: config.allowedExtensions || DEFAULT_EXTENSIONS,
      protectedExtensions: extArray,
      allowedUrls: urlsArray,
      allowedDomains: urlsArray,
      allowEmptyReferer: config.allowEmptyReferer !== false,
      redirectUrl: config.redirectUrl || '',
      updatedAt: config.updatedAt,
      drift,
      inSync: !drift,
      onDisk,
      rulesActive: onDisk,
      authorizedDomains,
      accountDomains: authorizedDomains,
      htaccessPath,
      htaccessExists: fs.existsSync(htaccessPath),
      htaccessSnippet: onDisk ? this._extractHtaccessBlock(htaccessContent) : ''
    };
  }

  // Generate Apache .htaccess directives block
  generateHtaccessBlock({ enabled, allowedUrls, allowedExtensions, allowEmptyReferer, redirectUrl }) {
    if (!enabled) return '';

    const extList = this.normalizeExtensions(allowedExtensions).split(',').join('|');
    const cleanUrls = this.normalizeAllowedUrls(allowedUrls);

    const lines = [
      BEGIN_MARKER,
      'RewriteEngine On'
    ];

    if (allowEmptyReferer) {
      lines.push('RewriteCond %{HTTP_REFERER} !^$');
    }

    cleanUrls.forEach(url => {
      const escaped = url.replace(/\./g, '\\.');
      lines.push(`RewriteCond %{HTTP_REFERER} !^http(s)?://(www\\.)?${escaped} [NC]`);
    });

    if (redirectUrl && typeof redirectUrl === 'string' && redirectUrl.trim().length > 0) {
      const cleanRedirect = redirectUrl.trim().replace(/[\r\n\t]/g, '');
      lines.push(`RewriteRule \\.(${extList})$ ${cleanRedirect} [R,NC,L]`);
    } else {
      lines.push(`RewriteRule \\.(${extList})$ - [NC,F,L]`);
    }

    lines.push(END_MARKER);
    return lines.join('\n');
  }

  // Apply configuration to .htaccess atomically
  _applyToHtaccess(username, blockContent) {
    const htaccessPath = this._getHtaccessPath(username);
    let existingContent = '';
    if (fs.existsSync(htaccessPath)) {
      existingContent = fs.readFileSync(htaccessPath, 'utf8');
    }

    const regex = new RegExp(`${BEGIN_MARKER}[\\s\\S]*?${END_MARKER}\\r?\\n?`, 'g');
    let cleaned = existingContent.replace(regex, '').trim();

    let newContent = '';
    if (blockContent) {
      if (cleaned.length > 0) {
        newContent = `${cleaned}\n\n${blockContent}\n`;
      } else {
        newContent = `${blockContent}\n`;
      }
    } else {
      newContent = cleaned ? `${cleaned}\n` : '';
    }

    const tmpPath = htaccessPath + '.tmp';
    fs.writeFileSync(tmpPath, newContent, 'utf8');
    fs.renameSync(tmpPath, htaccessPath);
  }

  // Save Hotlink Protection configuration
  saveConfig({
    username = 'cpanel_user',
    enabled,
    allowedExtensions,
    protectedExtensions,
    allowedUrls,
    allowedDomains,
    allowEmptyReferer,
    redirectUrl
  }) {
    const isEnabled = !!enabled;
    const extInput = allowedExtensions || protectedExtensions;
    const cleanExtensions = this.normalizeExtensions(extInput);
    const cleanUrls = this.normalizeAllowedUrls(allowedUrls || allowedDomains);
    const allowEmpty = allowEmptyReferer !== false;
    const cleanRedirect = (redirectUrl || '').trim();

    if (cleanRedirect && /[\r\n;|<>$&`]/.test(cleanRedirect)) {
      throw new Error('Redirect URL contains invalid characters.');
    }

    const block = this.generateHtaccessBlock({
      enabled: isEnabled,
      allowedUrls: cleanUrls,
      allowedExtensions: cleanExtensions,
      allowEmptyReferer: allowEmpty,
      redirectUrl: cleanRedirect
    });

    this._applyToHtaccess(username, block);

    const all = this._readAll();
    all.accounts[username] = {
      enabled: isEnabled,
      allowedExtensions: cleanExtensions,
      allowedUrls: cleanUrls,
      allowEmptyReferer: allowEmpty,
      redirectUrl: cleanRedirect,
      updatedAt: new Date().toISOString()
    };
    this._writeAll(all);

    try {
      const domainData = domainService._read(username);
      domainData.hotlinkProtection = {
        enabled: isEnabled,
        allowedExtensions: cleanExtensions,
        urls: cleanUrls
      };
      domainService._write(domainData, username);
    } catch (e) {}

    this._log(isEnabled ? 'ENABLE' : 'DISABLE', {
      username,
      enabled: isEnabled,
      allowedUrlsCount: cleanUrls.length,
      allowedExtensions: cleanExtensions,
      allowEmptyReferer: allowEmpty
    });

    return {
      success: true,
      message: `Hotlink Protection ${isEnabled ? 'enabled' : 'disabled'} and server configuration updated successfully.`,
      config: this.getConfig(username)
    };
  }

  // Toggle enable/disable
  toggle({ username = 'cpanel_user', enabled }) {
    const current = this.getConfig(username);
    return this.saveConfig({
      username,
      enabled: !!enabled,
      allowedExtensions: current.allowedExtensions,
      allowedUrls: current.allowedUrls,
      allowEmptyReferer: current.allowEmptyReferer,
      redirectUrl: current.redirectUrl
    });
  }

  toggleStatus(params) {
    return this.toggle(params);
  }

  // Repair / Reapply configuration to resolve drift
  repair({ username = 'cpanel_user' }) {
    const current = this.getConfig(username);
    return this.saveConfig({
      username,
      enabled: current.enabled,
      allowedExtensions: current.allowedExtensions,
      allowedUrls: current.allowedUrls,
      allowEmptyReferer: current.allowEmptyReferer,
      redirectUrl: current.redirectUrl
    });
  }

  repairConfig(username = 'cpanel_user') {
    const user = typeof username === 'string' ? username : (username?.username || username?.cpanelUser || 'cpanel_user');
    return this.repair({ username: user });
  }

  // Live check for server.js request handler
  checkRequest(username, reqPath, refererHeader) {
    const config = this.getConfig(username);
    if (!config.enabled) {
      return { blocked: false };
    }

    const extMatch = reqPath.match(/\.([a-z0-9]+)$/i);
    if (!extMatch) {
      return { blocked: false };
    }
    const ext = extMatch[1].toLowerCase();
    const protectedExts = config.allowedExtensions.split(',').map(e => e.trim().toLowerCase());
    if (!protectedExts.includes(ext)) {
      return { blocked: false };
    }

    const rawRef = (refererHeader || '').trim();
    if (!rawRef) {
      if (config.allowEmptyReferer) {
        return { blocked: false };
      } else {
        return {
          blocked: true,
          statusCode: config.redirectUrl ? 302 : 403,
          redirectUrl: config.redirectUrl || null,
          reason: 'Direct requests without Referer are blocked by Hotlink Protection policy.'
        };
      }
    }

    let refHost = '';
    try {
      refHost = new URL(rawRef).hostname.toLowerCase();
    } catch (e) {
      refHost = rawRef.replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
    }

    const cleanUrls = config.allowedUrls.map(u => u.toLowerCase());
    const isAllowed = cleanUrls.some(allowed => {
      return refHost === allowed || refHost === `www.${allowed}` || allowed === `www.${refHost}`;
    });

    if (isAllowed) {
      return { blocked: false };
    }

    return {
      blocked: true,
      statusCode: config.redirectUrl ? 302 : 403,
      redirectUrl: config.redirectUrl || null,
      reason: `Referer "${refHost}" is not authorized by Hotlink Protection policy.`
    };
  }

  // Verification Simulation API
  verifyAccess({ username = 'cpanel_user', path: p, filePath, referer = '' }) {
    const targetPath = p || filePath || '/images/sample.jpg';
    const check = this.checkRequest(username, targetPath, referer);
    this._log('TEST', { username, filePath: targetPath, referer, result: check });
    return {
      success: true,
      filePath: targetPath,
      referer: referer || '(none)',
      allowed: !check.blocked,
      statusCode: check.blocked ? check.statusCode : 200,
      redirectUrl: check.redirectUrl || null,
      reason: check.reason || 'Request authorized by Hotlink Protection policy.'
    };
  }
}

module.exports = new HotlinkService();
