const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const storageService = require('./storageService');
const domainService = require('./domainService');

const CONFIG_FILE = path.resolve(__dirname, '../../data/webserver_config.json');

function ensureStore() {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) {
    const initial = {
      optimization: {
        mode: 'all', // 'off' | 'all' | 'custom'
        mimeTypes: 'text/html text/plain text/xml text/css text/javascript application/javascript application/json'
      },
      indexes: {},
      errorPages: {},
      handlers: [
        { extension: 'cgi', handler: 'cgi-script' },
        { extension: 'pl', handler: 'cgi-script' }
      ],
      mimeTypes: [
        { extension: 'json', mimeType: 'application/json' },
        { extension: 'svg', mimeType: 'image/svg+xml' },
        { extension: 'webp', mimeType: 'image/webp' }
      ]
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

class WebServerService {
  constructor() {
    ensureStore();
  }

  _read() {
    ensureStore();
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }

  _write(data) {
    ensureStore();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  // --- OPTIMIZE WEBSITE (Feature #48) ---
  getOptimizationConfig() {
    return this._read().optimization;
  }

  saveOptimizationConfig({ mode = 'all', mimeTypes = '' }, username = 'cpanel_user') {
    const valid = ['off', 'all', 'custom'];
    if (!valid.includes(mode)) throw new Error('Invalid optimization mode');

    const data = this._read();
    data.optimization = { mode, mimeTypes };

    // Apply to public_html/.htaccess
    const htaccessPath = path.join(storageService.getRootDir(), 'public_html', '.htaccess');
    let content = fs.existsSync(htaccessPath) ? fs.readFileSync(htaccessPath, 'utf8') : '';

    const markerBegin = '# BEGIN CPANEL OPTIMIZE WEBSITE';
    const markerEnd = '# END CPANEL OPTIMIZE WEBSITE';

    let block = `${markerBegin}\n`;
    if (mode === 'all') {
      block += `<IfModule mod_deflate.c>\n  SetOutputFilter DEFLATE\n</IfModule>\n`;
    } else if (mode === 'custom' && mimeTypes.trim()) {
      block += `<IfModule mod_deflate.c>\n  AddOutputFilterByType DEFLATE ${mimeTypes.trim()}\n</IfModule>\n`;
    }
    block += `${markerEnd}`;

    if (content.includes(markerBegin)) {
      const regex = new RegExp(`${markerBegin}[\\s\\S]*?${markerEnd}`, 'g');
      content = content.replace(regex, block);
    } else {
      content = `${content ? content.trim() + '\n\n' : ''}${block}\n`;
    }

    fs.writeFileSync(htaccessPath, content, 'utf8');
    this._write(data);
    return { success: true, optimization: data.optimization };
  }

  // --- TRACK DNS (Feature #58) ---
  async trackDns(domain, username = 'cpanel_user') {
    if (!domain || !domain.trim()) throw new Error('Domain name is required');
    const clean = domain.trim().toLowerCase();

    // Security: no internal IP SSRF
    if (clean === 'localhost' || clean.includes('127.0.0.1') || clean.includes('::1')) {
      throw new Error('Internal host resolution is prohibited');
    }

    const results = {};
    const startTime = Date.now();

    try {
      results.a = await dns.resolve4(clean).catch(() => []);
    } catch {}
    try {
      results.aaaa = await dns.resolve6(clean).catch(() => []);
    } catch {}
    try {
      results.cname = await dns.resolveCname(clean).catch(() => []);
    } catch {}
    try {
      results.mx = await dns.resolveMx(clean).catch(() => []);
    } catch {}
    try {
      results.txt = await dns.resolveTxt(clean).catch(() => []);
    } catch {}
    try {
      results.ns = await dns.resolveNs(clean).catch(() => []);
    } catch {}
    try {
      results.soa = await dns.resolveSoa(clean).catch(() => null);
    } catch {}

    const latencyMs = Date.now() - startTime;

    return {
      domain: clean,
      timestamp: new Date().toISOString(),
      latencyMs,
      records: results,
      authoritative: results.ns.length > 0
    };
  }

  // --- INDEXES (Feature #59) ---
  getIndexSetting(relDir = 'public_html') {
    const safePath = storageService.resolveSafePath(relDir);
    const htaccess = path.join(safePath, '.htaccess');
    let setting = 'default';
    if (fs.existsSync(htaccess)) {
      const text = fs.readFileSync(htaccess, 'utf8');
      if (text.includes('Options -Indexes')) setting = 'disabled';
      else if (text.includes('Options +Indexes +FancyIndexing')) setting = 'fancy';
      else if (text.includes('Options +Indexes')) setting = 'standard';
    }
    return { path: relDir, setting };
  }

  saveIndexSetting(relDir, setting) {
    const valid = ['default', 'disabled', 'standard', 'fancy'];
    if (!valid.includes(setting)) throw new Error('Invalid index setting');

    const safePath = storageService.resolveSafePath(relDir);
    const htaccess = path.join(safePath, '.htaccess');
    let content = fs.existsSync(htaccess) ? fs.readFileSync(htaccess, 'utf8') : '';

    const markerBegin = '# BEGIN CPANEL INDEXES';
    const markerEnd = '# END CPANEL INDEXES';

    let directive = '';
    if (setting === 'disabled') directive = 'Options -Indexes';
    else if (setting === 'standard') directive = 'Options +Indexes';
    else if (setting === 'fancy') directive = 'Options +Indexes +FancyIndexing';

    let block = `${markerBegin}\n${directive ? '  ' + directive + '\n' : ''}${markerEnd}`;

    if (content.includes(markerBegin)) {
      const regex = new RegExp(`${markerBegin}[\\s\\S]*?${markerEnd}`, 'g');
      content = content.replace(regex, block);
    } else if (directive) {
      content = `${content ? content.trim() + '\n\n' : ''}${block}\n`;
    }

    fs.writeFileSync(htaccess, content, 'utf8');
    return { success: true, path: relDir, setting };
  }

  // --- ERROR PAGES (Feature #60) ---
  getErrorPages(username = 'cpanel_user') {
    const defaultCodes = [
      { code: '400', name: '400 (Bad Request)', defaultDesc: 'The server could not understand the request.' },
      { code: '401', name: '401 (Authorization Required)', defaultDesc: 'Authentication is required and has failed or has not been provided.' },
      { code: '403', name: '403 (Forbidden)', defaultDesc: 'Access to this resource is denied.' },
      { code: '404', name: '404 (Not Found)', defaultDesc: 'The requested URL was not found on this server.' },
      { code: '500', name: '500 (Internal Server Error)', defaultDesc: 'The server encountered an unexpected condition.' }
    ];

    const data = this._read();
    return defaultCodes.map(c => ({
      ...c,
      customHtml: data.errorPages[c.code] || null,
      isCustom: !!data.errorPages[c.code]
    }));
  }

  saveErrorPage(code, htmlContent) {
    const validCodes = ['400', '401', '403', '404', '500'];
    if (!validCodes.includes(String(code))) throw new Error(`Invalid HTTP error code: ${code}`);

    const data = this._read();
    data.errorPages[code] = htmlContent;

    // Save page file to public_html/error_pages/<code>.shtml
    const errorDir = path.join(storageService.getRootDir(), 'public_html', 'error_pages');
    if (!fs.existsSync(errorDir)) fs.mkdirSync(errorDir, { recursive: true });

    const pageFile = path.join(errorDir, `${code}.shtml`);
    fs.writeFileSync(pageFile, htmlContent, 'utf8');

    // Update .htaccess ErrorDocument
    const htaccessPath = path.join(storageService.getRootDir(), 'public_html', '.htaccess');
    let htaccess = fs.existsSync(htaccessPath) ? fs.readFileSync(htaccessPath, 'utf8') : '';
    const errMarkerBegin = '# BEGIN CPANEL ERROR PAGES';
    const errMarkerEnd = '# END CPANEL ERROR PAGES';

    const directive = `ErrorDocument ${code} /error_pages/${code}.shtml`;
    let block = '';
    if (htaccess.includes(errMarkerBegin)) {
      const regex = new RegExp(`${errMarkerBegin}[\\s\\S]*?${errMarkerEnd}`, 'g');
      const curBlock = htaccess.match(regex)[0];
      if (!curBlock.includes(`ErrorDocument ${code}`)) {
        block = curBlock.replace(errMarkerEnd, `  ${directive}\n${errMarkerEnd}`);
        htaccess = htaccess.replace(regex, block);
      }
    } else {
      block = `${errMarkerBegin}\n  ${directive}\n${errMarkerEnd}\n`;
      htaccess = `${htaccess ? htaccess.trim() + '\n\n' : ''}${block}`;
    }

    fs.writeFileSync(htaccessPath, htaccess, 'utf8');
    this._write(data);
    return { success: true, code };
  }

  // --- APACHE HANDLERS (Feature #61) ---
  getHandlers() {
    return this._read().handlers || [];
  }

  addHandler({ extension, handler }) {
    if (!extension || !handler) throw new Error('Extension and Handler are required');
    const cleanExt = extension.replace(/^\./, '').toLowerCase().trim();
    if (!/^[a-z0-9_-]+$/i.test(cleanExt)) throw new Error('Invalid extension format');

    const data = this._read();
    data.handlers = data.handlers || [];
    data.handlers = data.handlers.filter(h => h.extension !== cleanExt);
    data.handlers.push({ extension: cleanExt, handler: handler.trim() });
    this._write(data);
    return { success: true, extension: cleanExt, handler: handler.trim() };
  }

  deleteHandler(extension) {
    const cleanExt = extension.replace(/^\./, '').toLowerCase().trim();
    const data = this._read();
    data.handlers = (data.handlers || []).filter(h => h.extension !== cleanExt);
    this._write(data);
    return { success: true, extension: cleanExt };
  }

  // --- MIME TYPES (Feature #62) ---
  getMimeTypes() {
    return this._read().mimeTypes || [];
  }

  addMimeType({ extension, mimeType }) {
    if (!extension || !mimeType) throw new Error('Extension and MIME type are required');
    const cleanExt = extension.replace(/^\./, '').toLowerCase().trim();
    if (!/^[a-z0-9_-]+$/i.test(cleanExt)) throw new Error('Invalid extension format');
    if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(mimeType.trim())) throw new Error('Invalid MIME type format');

    const data = this._read();
    data.mimeTypes = data.mimeTypes || [];
    data.mimeTypes = data.mimeTypes.filter(m => m.extension !== cleanExt);
    data.mimeTypes.push({ extension: cleanExt, mimeType: mimeType.trim() });
    this._write(data);
    return { success: true, extension: cleanExt, mimeType: mimeType.trim() };
  }

  deleteMimeType(extension) {
    const cleanExt = extension.replace(/^\./, '').toLowerCase().trim();
    const data = this._read();
    data.mimeTypes = (data.mimeTypes || []).filter(m => m.extension !== cleanExt);
    this._write(data);
    return { success: true, extension: cleanExt };
  }
}

module.exports = new WebServerService();
