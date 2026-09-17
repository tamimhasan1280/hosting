const fs = require('fs');
const path = require('path');
const net = require('net');
const storageService = require('./storageService');
const privacyService = require('./privacyService');
const mailService = require('./mailService');

const LEECH_FILE = path.join(__dirname, '../../data/leech_protection.json');
const BLOCKS_FILE = path.join(__dirname, '../../data/leech_blocks.json');
const EVENTS_FILE = path.join(__dirname, '../../data/leech_events.json');
const AUDIT_LOG = path.join(__dirname, '../../data/leech_audit.log');

const BEGIN_MARKER = '# BEGIN CPANEL LEECH PROTECTION';
const END_MARKER = '# END CPANEL LEECH PROTECTION';

const DEFAULT_THRESHOLD = 4;
const DEFAULT_WINDOW_MINUTES = 120; // 2 hours
const DEFAULT_BLOCK_MINUTES = 120;

class LeechService {
  constructor() {
    this._ensureDataFiles();
    // In-memory sliding window cache for access tracking
    // Key: `${username}:${relDirectory}:${authUsername || ip}` -> array of { timestamp, ip, authUser }
    this._accessAttempts = new Map();
  }

  _ensureDataFiles() {
    const dir = path.dirname(LEECH_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(LEECH_FILE)) {
      fs.writeFileSync(LEECH_FILE, JSON.stringify({ configs: {} }, null, 2), 'utf8');
    }
    if (!fs.existsSync(BLOCKS_FILE)) {
      fs.writeFileSync(BLOCKS_FILE, JSON.stringify([], null, 2), 'utf8');
    }
    if (!fs.existsSync(EVENTS_FILE)) {
      fs.writeFileSync(EVENTS_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  }

  _readConfigs() {
    try {
      this._ensureDataFiles();
      return JSON.parse(fs.readFileSync(LEECH_FILE, 'utf8'));
    } catch (e) {
      return { configs: {} };
    }
  }

  _writeConfigs(data) {
    try {
      this._ensureDataFiles();
      const tmp = LEECH_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, LEECH_FILE);
    } catch (e) {
      console.error('Error writing leech configs:', e);
    }
  }

  _readBlocks() {
    try {
      this._ensureDataFiles();
      return JSON.parse(fs.readFileSync(BLOCKS_FILE, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  _writeBlocks(data) {
    try {
      this._ensureDataFiles();
      const tmp = BLOCKS_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, BLOCKS_FILE);
    } catch (e) {
      console.error('Error writing leech blocks:', e);
    }
  }

  _readEvents() {
    try {
      this._ensureDataFiles();
      return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  _writeEvents(data) {
    try {
      this._ensureDataFiles();
      const tmp = EVENTS_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, EVENTS_FILE);
    } catch (e) {
      console.error('Error writing leech events:', e);
    }
  }

  _log(action, details) {
    try {
      const entry = `[${new Date().toISOString()}] [LEECH] [${action}] ${JSON.stringify(details)}\n`;
      fs.appendFileSync(AUDIT_LOG, entry, 'utf8');
    } catch (e) {}
  }

  // Canonicalize relative directory path (e.g. 'public_html/members' or 'members')
  normalizeDirectory(relPath = '') {
    let clean = (relPath || '').trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    if (!clean) clean = 'public_html';
    if (!clean.startsWith('public_html')) {
      clean = `public_html/${clean}`;
    }
    return clean;
  }

  // Get absolute filesystem path safely within user sandbox
  _resolveDirectory(username = 'cpanel_user', relPath = 'public_html') {
    const cleanRel = this.normalizeDirectory(relPath);
    return storageService.resolveSafePath(cleanRel, username);
  }

  _getHtaccessPath(username = 'cpanel_user', relPath = 'public_html') {
    const dir = this._resolveDirectory(username, relPath);
    return path.join(dir, '.htaccess');
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

  // Capabilities API
  getCapabilities() {
    return {
      success: true,
      webServer: 'Apache / 2.4.58 (cPanel Pro) / LiteSpeed compatible',
      detectionMethod: 'Real-time sliding window access and credential monitoring',
      actionsSupported: [
        'email_alert',
        'redirect_url',
        'disable_compromised_account',
        'temporary_ip_block'
      ],
      defaultThreshold: DEFAULT_THRESHOLD,
      defaultWindowMinutes: DEFAULT_WINDOW_MINUTES,
      defaultBlockMinutes: DEFAULT_BLOCK_MINUTES
    };
  }

  // List all directories in account with privacy & leech protection status
  listDirectories(username = 'cpanel_user') {
    const privDirs = privacyService.listDirectories(username);
    const configs = this._readConfigs().configs[username] || {};

    return privDirs.map(d => {
      const canonicalRel = this.normalizeDirectory(d.relPath);
      const leechCfg = configs[canonicalRel] || null;

      // Check on disk status
      const htaccessPath = this._getHtaccessPath(username, canonicalRel);
      let rulesOnDisk = false;
      if (fs.existsSync(htaccessPath)) {
        const c = fs.readFileSync(htaccessPath, 'utf8');
        rulesOnDisk = c.includes(BEGIN_MARKER) && c.includes(END_MARKER);
      }

      const isEnabled = leechCfg ? !!leechCfg.enabled : false;
      const drift = isEnabled !== rulesOnDisk;

      return {
        ...d,
        canonicalRel,
        leechProtected: isEnabled,
        rulesOnDisk,
        drift,
        threshold: leechCfg?.threshold || DEFAULT_THRESHOLD,
        timeWindowMinutes: leechCfg?.timeWindowMinutes || DEFAULT_WINDOW_MINUTES,
        redirectUrl: leechCfg?.redirectUrl || '',
        disableCompromisedAccounts: leechCfg?.disableCompromisedAccounts || false,
        emailAlert: leechCfg?.emailAlert || '',
        hasPrivacyProtection: d.isProtected || false
      };
    });
  }

  // Get configuration for a specific directory
  getConfig(username = 'cpanel_user', relPath = 'public_html') {
    const canonicalRel = this.normalizeDirectory(relPath);
    const all = this._readConfigs();
    const userConfigs = all.configs[username] || {};
    const cfg = userConfigs[canonicalRel] || {
      enabled: false,
      threshold: DEFAULT_THRESHOLD,
      timeWindowMinutes: DEFAULT_WINDOW_MINUTES,
      emailAlert: '',
      redirectUrl: '',
      disableCompromisedAccounts: false,
      blockDurationMinutes: DEFAULT_BLOCK_MINUTES,
      whitelist: [],
      updatedAt: null
    };

    const htaccessPath = this._getHtaccessPath(username, canonicalRel);
    let rulesOnDisk = false;
    let snippet = '';
    if (fs.existsSync(htaccessPath)) {
      const c = fs.readFileSync(htaccessPath, 'utf8');
      rulesOnDisk = c.includes(BEGIN_MARKER) && c.includes(END_MARKER);
      snippet = rulesOnDisk ? this._extractHtaccessBlock(c) : '';
    }

    const drift = cfg.enabled !== rulesOnDisk;

    // Check directory privacy info
    const privStatus = privacyService.getDirectoryStatus(canonicalRel, username);

    return {
      success: true,
      directory: canonicalRel,
      enabled: cfg.enabled,
      threshold: cfg.threshold,
      timeWindowMinutes: cfg.timeWindowMinutes,
      emailAlert: cfg.emailAlert || '',
      redirectUrl: cfg.redirectUrl || '',
      disableCompromisedAccounts: !!cfg.disableCompromisedAccounts,
      blockDurationMinutes: cfg.blockDurationMinutes || DEFAULT_BLOCK_MINUTES,
      whitelist: cfg.whitelist || [],
      updatedAt: cfg.updatedAt,
      inSync: !drift,
      rulesOnDisk,
      htaccessPath,
      htaccessSnippet: snippet,
      privacyStatus: privStatus
    };
  }

  // Generate .htaccess managed directive block for Leech Protection
  generateHtaccessBlock({ enabled, threshold, timeWindowMinutes, redirectUrl }) {
    if (!enabled) return '';
    const lines = [
      BEGIN_MARKER,
      `# cPanel Leech Protection Managed Block`,
      `# Threshold: ${threshold} logins per ${timeWindowMinutes} minutes`
    ];
    if (redirectUrl) {
      lines.push(`# Redirect URL: ${redirectUrl}`);
    }
    lines.push(END_MARKER);
    return lines.join('\n');
  }

  // Apply .htaccess block atomically
  _applyToHtaccess(username, relPath, blockContent) {
    const htaccessPath = this._getHtaccessPath(username, relPath);
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

    const dir = path.dirname(htaccessPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmp = htaccessPath + '.tmp';
    fs.writeFileSync(tmp, newContent, 'utf8');
    fs.renameSync(tmp, htaccessPath);
  }

  // Save / Update Leech Protection configuration
  saveConfig({
    username = 'cpanel_user',
    directory = 'public_html',
    enabled = false,
    threshold = DEFAULT_THRESHOLD,
    timeWindowMinutes = DEFAULT_WINDOW_MINUTES,
    emailAlert = '',
    redirectUrl = '',
    disableCompromisedAccounts = false,
    blockDurationMinutes = DEFAULT_BLOCK_MINUTES,
    whitelist = []
  }) {
    const canonicalRel = this.normalizeDirectory(directory);
    const targetDir = this._resolveDirectory(username, canonicalRel);
    if (!fs.existsSync(targetDir)) {
      throw new Error(`Directory "${canonicalRel}" does not exist in account.`);
    }

    const numThreshold = Math.max(1, Math.min(1000, parseInt(threshold, 10) || DEFAULT_THRESHOLD));
    const numWindow = Math.max(5, Math.min(1440, parseInt(timeWindowMinutes, 10) || DEFAULT_WINDOW_MINUTES));
    const numBlock = Math.max(5, Math.min(10080, parseInt(blockDurationMinutes, 10) || DEFAULT_BLOCK_MINUTES));
    const isEnabled = !!enabled;

    // Validate redirect URL against newline injection or invalid protocols
    const cleanRedirect = (redirectUrl || '').trim();
    if (cleanRedirect && /[\r\n;|<>$&`]/.test(cleanRedirect)) {
      throw new Error('Redirect URL contains invalid characters.');
    }

    // Validate email
    const cleanEmail = (emailAlert || '').trim();
    if (cleanEmail && !/^[\w.-]+@[\w.-]+\.[a-z]{2,}$/i.test(cleanEmail)) {
      throw new Error('Invalid email alert format.');
    }

    // Clean whitelist IPs
    const cleanWhitelist = (Array.isArray(whitelist) ? whitelist : String(whitelist).split(/[\r\n,]+/))
      .map(ip => String(ip).trim().toLowerCase())
      .filter(ip => ip && net.isIP(ip));

    const block = this.generateHtaccessBlock({
      enabled: isEnabled,
      threshold: numThreshold,
      timeWindowMinutes: numWindow,
      redirectUrl: cleanRedirect
    });

    // Write to .htaccess
    this._applyToHtaccess(username, canonicalRel, block);

    // Persist to database
    const all = this._readConfigs();
    if (!all.configs[username]) all.configs[username] = {};
    all.configs[username][canonicalRel] = {
      enabled: isEnabled,
      threshold: numThreshold,
      timeWindowMinutes: numWindow,
      emailAlert: cleanEmail,
      redirectUrl: cleanRedirect,
      disableCompromisedAccounts: !!disableCompromisedAccounts,
      blockDurationMinutes: numBlock,
      whitelist: cleanWhitelist,
      updatedAt: new Date().toISOString()
    };
    this._writeConfigs(all);

    // Reset in-flight sliding window attempts for this directory when reconfigured
    const trackKey = `${username}:${canonicalRel}`;
    this._accessAttempts.delete(trackKey);

    this._log(isEnabled ? 'ENABLE' : 'CONFIGURE', {
      username,
      directory: canonicalRel,
      enabled: isEnabled,
      threshold: numThreshold,
      timeWindowMinutes: numWindow
    });

    return {
      success: true,
      message: `Leech Protection configuration for "${canonicalRel}" saved successfully.`,
      config: this.getConfig(username, canonicalRel)
    };
  }

  // Toggle enable / disable
  toggle({ username = 'cpanel_user', directory = 'public_html', enabled }) {
    const current = this.getConfig(username, directory);
    return this.saveConfig({
      username,
      directory,
      enabled: !!enabled,
      threshold: current.threshold,
      timeWindowMinutes: current.timeWindowMinutes,
      emailAlert: current.emailAlert,
      redirectUrl: current.redirectUrl,
      disableCompromisedAccounts: current.disableCompromisedAccounts,
      blockDurationMinutes: current.blockDurationMinutes,
      whitelist: current.whitelist
    });
  }

  toggleStatus(params) {
    return this.toggle(params);
  }

  // Repair .htaccess configuration drift
  repair({ username = 'cpanel_user', directory = 'public_html' }) {
    const current = this.getConfig(username, directory);
    return this.saveConfig({
      username,
      directory,
      enabled: current.enabled,
      threshold: current.threshold,
      timeWindowMinutes: current.timeWindowMinutes,
      emailAlert: current.emailAlert,
      redirectUrl: current.redirectUrl,
      disableCompromisedAccounts: current.disableCompromisedAccounts,
      blockDurationMinutes: current.blockDurationMinutes,
      whitelist: current.whitelist
    });
  }

  repairConfig(username, directory) {
    if (typeof username === 'object') {
      return this.repair(username);
    }
    return this.repair({ username, directory });
  }

  // List active temporary IP blocks
  listActiveBlocks(username = 'cpanel_user') {
    const blocks = this._readBlocks();
    const now = Date.now();
    const active = [];
    let modified = false;

    for (const b of blocks) {
      if (b.username !== username) continue;
      if (new Date(b.expiresAt).getTime() <= now) {
        // Expired
        modified = true;
        this._log('BLOCK_EXPIRED', { username, ip: b.ip, directory: b.directory });
      } else {
        active.push(b);
      }
    }

    if (modified) {
      // Save pruned blocks
      const remainingAll = blocks.filter(b => new Date(b.expiresAt).getTime() > now);
      this._writeBlocks(remainingAll);
    }

    return active;
  }

  // Remove / unblock temporary IP
  unblockIp({ username = 'cpanel_user', ip, id }) {
    const blocks = this._readBlocks();
    const normIp = (ip || '').trim().toLowerCase();
    const filtered = blocks.filter(b => {
      if (b.username !== username) return true;
      if (id && b.id === id) return false;
      if (normIp && b.ip.toLowerCase() === normIp) return false;
      return true;
    });

    if (filtered.length < blocks.length) {
      this._writeBlocks(filtered);
      this._log('UNBLOCK_IP', { username, ip, id });
      return { success: true, message: `IP "${ip || id}" unblocked successfully.` };
    }
    return { success: false, error: 'No matching active block found to remove.' };
  }

  // List recent violation events
  listEvents(username = 'cpanel_user', limit = 50) {
    const events = this._readEvents();
    return events
      .filter(e => e.username === username)
      .slice(-limit)
      .reverse();
  }

  // Disable compromised account in .htpasswd
  _disableHtpasswdUser(username, directory, authUser) {
    if (!authUser) return false;
    const rootDir = storageService.getRootDir(username);
    const htpasswdFile = path.join(rootDir, '.htpasswds', directory, 'passwd');
    if (!fs.existsSync(htpasswdFile)) return false;

    try {
      const content = fs.readFileSync(htpasswdFile, 'utf8');
      const lines = content.split(/\r?\n/);
      let updated = false;

      const newLines = lines.map(line => {
        if (line.startsWith(`${authUser}:`)) {
          updated = true;
          return `#DISABLED_LEECH# ${line}`;
        }
        return line;
      });

      if (updated) {
        fs.writeFileSync(htpasswdFile, newLines.join('\n'), 'utf8');
        this._log('DISABLE_USER', { username, directory, authUser });
        return true;
      }
    } catch (e) {
      console.error('Error disabling htpasswd user:', e);
    }
    return false;
  }

  // Live Access & Detection Check (invoked by server.js /site middleware)
  checkAccess({ username = 'cpanel_user', reqPath = '/', clientIp = '127.0.0.1', authHeader = null }) {
    const normIp = (clientIp || '127.0.0.1').trim().toLowerCase().replace(/^::ffff:/, '');

    // 1. Check if client IP is currently in an active temporary block
    const activeBlocks = this.listActiveBlocks(username);
    const activeBlock = activeBlocks.find(b => b.ip.toLowerCase() === normIp);

    if (activeBlock) {
      return {
        blocked: true,
        statusCode: activeBlock.redirectUrl ? 302 : 403,
        redirectUrl: activeBlock.redirectUrl || null,
        reason: `Access blocked: Client IP ${normIp} exceeded Leech Protection threshold for "${activeBlock.directory}". Expires at ${activeBlock.expiresAt}.`,
        blockRecord: activeBlock
      };
    }

    // 2. Identify target directory from request path
    const cleanSub = (reqPath || '').replace(/^\/+/, '').replace(/\/+$/, '');
    const canonicalRel = this.normalizeDirectory(cleanSub);

    // Find closest configured parent directory or exact match
    const all = this._readConfigs();
    const userConfigs = all.configs[username] || {};

    let matchedRel = null;
    let matchedCfg = null;

    let probe = canonicalRel;
    while (probe) {
      if (userConfigs[probe] && userConfigs[probe].enabled) {
        matchedRel = probe;
        matchedCfg = userConfigs[probe];
        break;
      }
      if (probe === 'public_html') break;
      const idx = probe.lastIndexOf('/');
      probe = idx !== -1 ? probe.substring(0, idx) : 'public_html';
    }

    if (!matchedCfg) {
      // No active leech protection on this directory path
      return { blocked: false };
    }

    // 3. Check Whitelist
    const whitelist = (matchedCfg.whitelist || []).map(ip => ip.toLowerCase());
    if (whitelist.includes(normIp)) {
      return { blocked: false, whitelisted: true };
    }

    // 4. Extract authenticated username if Basic Auth header present
    let authUser = null;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(authHeader.substring(6), 'base64').toString('utf8');
        const colon = decoded.indexOf(':');
        if (colon !== -1) {
          authUser = decoded.substring(0, colon);
        }
      } catch (e) {}
    }

    // 5. Sliding window tracking
    const trackKey = `${username}:${matchedRel}`;
    if (!this._accessAttempts.has(trackKey)) {
      this._accessAttempts.set(trackKey, []);
    }

    const attempts = this._accessAttempts.get(trackKey);
    const now = Date.now();
    const windowMs = (matchedCfg.timeWindowMinutes || DEFAULT_WINDOW_MINUTES) * 60 * 1000;

    // Record this attempt
    attempts.push({
      timestamp: now,
      ip: normIp,
      authUser: authUser || '(anonymous)'
    });

    // Prune expired attempts
    const validAttempts = attempts.filter(a => (now - a.timestamp) <= windowMs);
    this._accessAttempts.set(trackKey, validAttempts);

    // Count distinct accesses / logins
    // We count either:
    // a) unique client IPs accessing with the same authUser (credential distribution), OR
    // b) total accesses from this client IP within the window
    const ipAttempts = validAttempts.filter(a => a.ip === normIp);
    const userAttempts = authUser ? validAttempts.filter(a => a.authUser === authUser) : [];
    const uniqueIpsForUser = new Set(userAttempts.map(a => a.ip));

    const threshold = matchedCfg.threshold || DEFAULT_THRESHOLD;
    const isLeeching = ipAttempts.length > threshold || uniqueIpsForUser.size > threshold;

    if (isLeeching) {
      // TRIGGER PROTECTIVE ACTIONS!
      const blockMinutes = matchedCfg.blockDurationMinutes || DEFAULT_BLOCK_MINUTES;
      const expiresAt = new Date(now + blockMinutes * 60 * 1000).toISOString();

      const blockRecord = {
        id: `blk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        username,
        directory: matchedRel,
        ip: normIp,
        authUser: authUser || 'anonymous',
        attemptsCount: ipAttempts.length,
        uniqueIpsCount: uniqueIpsForUser.size,
        blockedAt: new Date().toISOString(),
        expiresAt,
        redirectUrl: matchedCfg.redirectUrl || null,
        reason: `Leech threshold exceeded (${ipAttempts.length} logins in ${matchedCfg.timeWindowMinutes}m)`
      };

      // Add to blocks
      const currentBlocks = this._readBlocks();
      currentBlocks.push(blockRecord);
      this._writeBlocks(currentBlocks);

      // Record violation event
      const eventRecord = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        username,
        directory: matchedRel,
        ip: normIp,
        authUser: authUser || 'anonymous',
        timestamp: new Date().toISOString(),
        actionTaken: matchedCfg.redirectUrl ? 'redirect' : 'block_ip',
        details: blockRecord.reason
      };
      const events = this._readEvents();
      events.push(eventRecord);
      this._writeEvents(events);

      // Disable compromised account in .htpasswd if requested
      if (matchedCfg.disableCompromisedAccounts && authUser) {
        this._disableHtpasswdUser(username, matchedRel, authUser);
      }

      // Dispatch email alert if configured
      if (matchedCfg.emailAlert) {
        try {
          mailService.sendMail({
            from: `security@${username}.com`,
            to: matchedCfg.emailAlert,
            subject: `[Leech Alert] Unauthorized logins detected on ${matchedRel}`,
            body: `Leech Protection detected excessive logins on "${matchedRel}".\nOffending IP: ${normIp}\nUser: ${authUser || 'N/A'}\nAction: Blocked until ${expiresAt}\n\n- cPanel Security`
          }, username);
        } catch (e) {}
      }

      this._log('TRIGGER_VIOLATION', {
        username,
        directory: matchedRel,
        ip: normIp,
        authUser,
        expiresAt
      });

      return {
        blocked: true,
        statusCode: matchedCfg.redirectUrl ? 302 : 403,
        redirectUrl: matchedCfg.redirectUrl || null,
        reason: blockRecord.reason,
        blockRecord
      };
    }

    return {
      blocked: false,
      currentAttempts: ipAttempts.length,
      threshold,
      remaining: Math.max(0, threshold - ipAttempts.length)
    };
  }

  // Verification Simulation API
  verifyAccess({ username = 'cpanel_user', directory = 'public_html', clientIp = '198.51.100.25', authUser = 'member1' }) {
    const fakeAuth = authUser ? `Basic ${Buffer.from(`${authUser}:pass123`).toString('base64')}` : null;
    const check = this.checkAccess({
      username,
      reqPath: `/${directory}`,
      clientIp,
      authHeader: fakeAuth
    });

    return {
      success: true,
      directory,
      clientIp,
      authUser,
      ...check
    };
  }
}

module.exports = new LeechService();
