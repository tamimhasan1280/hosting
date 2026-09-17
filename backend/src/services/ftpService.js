const fs = require('fs');
const path = require('path');
const net = require('net');
const bcrypt = require('bcryptjs');
const storageService = require('./storageService');
const domainService = require('./domainService');
const ftpServerService = require('./ftpServerService');

const FTP_ACCOUNTS_FILE = path.resolve(__dirname, '../../data/ftp_accounts.json');

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function parseQuotaBytes(quotaStr) {
  if (quotaStr === null || quotaStr === undefined || String(quotaStr).toLowerCase() === 'unlimited' || String(quotaStr) === '0' || quotaStr === 0) {
    return null; // Unlimited
  }
  const match = String(quotaStr).trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) return null;
  const val = parseFloat(match[1]);
  const unit = (match[2] || 'MB').toUpperCase();
  const mult = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024, TB: 1024 * 1024 * 1024 * 1024 };
  return Math.round(val * (mult[unit] || 1024 * 1024));
}

function getDirSizeBytes(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return stat.size;
    const entries = fs.readdirSync(dirPath);
    for (const e of entries) {
      const full = path.join(dirPath, e);
      try {
        const s = fs.statSync(full);
        if (s.isDirectory()) {
          total += getDirSizeBytes(full);
        } else {
          total += s.size;
        }
      } catch (err) {}
    }
  } catch (err) {}
  return total;
}

class FtpService {
  constructor() {
    this._ensureStore();
    ftpServerService.setAccountsProvider(this);
  }

  _ensureStore() {
    const dir = path.dirname(FTP_ACCOUNTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(FTP_ACCOUNTS_FILE)) {
      // Provision default main FTP account for cpanel_user
      const initial = [
        {
          id: 'ftp_main_cpanel_user',
          cpanelUser: 'cpanel_user',
          username: 'cpanel_user@example.com',
          userPart: 'cpanel_user',
          domain: 'example.com',
          passwordHash: bcrypt.hashSync('demo12345', 10),
          directory: 'public_html',
          quota: 'Unlimited',
          quotaBytes: null,
          status: 'enabled',
          isMain: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      fs.writeFileSync(FTP_ACCOUNTS_FILE, JSON.stringify(initial, null, 2), 'utf8');
    }
  }

  _read() {
    this._ensureStore();
    try {
      return JSON.parse(fs.readFileSync(FTP_ACCOUNTS_FILE, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  _write(accounts) {
    fs.writeFileSync(FTP_ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf8');
  }

  // Used by ftpServerService for real authentication
  findAccount(username) {
    if (!username) return null;
    const clean = username.trim().toLowerCase();
    const accounts = this._read();
    return accounts.find(a => 
      a.username.toLowerCase() === clean || 
      a.userPart.toLowerCase() === clean
    ) || null;
  }

  getUserRootDir(cpanelUser) {
    return storageService.getRootDir(cpanelUser);
  }

  checkQuotaAvailable(account) {
    if (!account.quotaBytes) {
      return { allowed: true }; // Unlimited
    }

    const userRoot = this.getUserRootDir(account.cpanelUser);
    const targetDir = account.directory ? path.resolve(userRoot, account.directory) : userRoot;
    const currentBytes = getDirSizeBytes(targetDir);

    if (currentBytes >= account.quotaBytes) {
      return {
        allowed: false,
        message: `Assigned quota of ${account.quota} reached (${formatBytes(currentBytes)} used).`
      };
    }

    return { allowed: true };
  }

  /**
   * FTP Capability Detection
   */
  getCapabilities() {
    const status = ftpServerService.getStatus();
    return {
      available: status.available,
      server: status.server || 'cPanel Built-in RFC 959 FTP Daemon',
      daemon: status.daemon || 'cPanel Built-in RFC 959 FTP Daemon',
      version: status.version || '1.0.0',
      port: status.port || 21,
      activePort: status.activePort || status.port || 21,
      virtual_users: status.virtual_users !== undefined ? status.virtual_users : true,
      quota_supported: status.quota_supported !== undefined ? status.quota_supported : true,
      tls_supported: status.tls_supported !== undefined ? status.tls_supported : false,
      status: status.status || 'running'
    };
  }

  getAccountCount(cpanelUser = 'cpanel_user') {
    const accounts = this._read();
    return accounts.filter(a => a.cpanelUser === cpanelUser).length;
  }

  /**
   * List FTP Accounts for a cPanel user
   */
  listAccounts(cpanelUser = 'cpanel_user') {
    const accounts = this._read().filter(a => a.cpanelUser === cpanelUser);
    const userRoot = this.getUserRootDir(cpanelUser);

    return accounts.map(acct => {
      const targetDir = acct.directory ? path.resolve(userRoot, acct.directory) : userRoot;
      const usageBytes = getDirSizeBytes(targetDir);
      const usageFormatted = formatBytes(usageBytes);

      let percentage = null;
      if (acct.quotaBytes && acct.quotaBytes > 0) {
        percentage = Math.min(100, Math.round((usageBytes / acct.quotaBytes) * 100));
      }

      return {
        id: acct.id,
        username: acct.username,
        userPart: acct.userPart,
        domain: acct.domain,
        directory: acct.directory || 'public_html',
        quota: acct.quota,
        quotaBytes: acct.quotaBytes,
        usageBytes,
        usageFormatted,
        percentage,
        status: acct.status,
        isMain: !!acct.isMain,
        isDefault: !!acct.isMain,
        createdAt: acct.createdAt,
        updatedAt: acct.updatedAt
      };
    });
  }

  /**
   * List available directories for user
   */
  listAvailableDirectories(cpanelUser = 'cpanel_user') {
    const userRoot = this.getUserRootDir(cpanelUser);
    const dirs = ['public_html'];

    function scan(rel) {
      const full = path.join(userRoot, rel);
      if (!fs.existsSync(full)) return;
      try {
        const entries = fs.readdirSync(full);
        for (const e of entries) {
          if (e.startsWith('.') || e === 'node_modules') continue;
          const sub = path.join(full, e);
          try {
            if (fs.statSync(sub).isDirectory()) {
              const relPath = path.posix.join(rel, e);
              dirs.push(relPath);
              if (dirs.length < 50) scan(relPath);
            }
          } catch (err) {}
        }
      } catch (err) {}
    }

    scan('public_html');
    return Array.from(new Set(dirs));
  }

  /**
   * Create an FTP Account
   */
  createAccount({ username, domain, password, directory = 'public_html', quota = 'Unlimited', cpanelUser = 'cpanel_user' }) {
    if (!username || !/^[a-zA-Z0-9_.-]+$/.test(username.trim())) {
      throw new Error('FTP username can only contain alphanumeric characters, underscores, hyphens, and periods');
    }
    const cleanUser = username.trim().toLowerCase();

    if (!password || password.length < 5) {
      throw new Error('Password must be at least 5 characters long');
    }

    // Resolve domain
    const domainsData = domainService.getAll(cpanelUser);
    let cleanDomain = domain ? domain.trim().toLowerCase() : (domainsData.primaryDomain || 'example.com');

    const fullUser = `${cleanUser}@${cleanDomain}`;

    const accounts = this._read();
    if (accounts.some(a => a.username.toLowerCase() === fullUser || ((a.domain || '').toLowerCase() === cleanDomain && a.userPart.toLowerCase() === cleanUser))) {
      throw new Error(`FTP account '${fullUser}' already exists`);
    }

    // Plan limits check
    const db = require('./db');
    const allServices = db.getAll('services') || [];
    const userServices = allServices.filter(s => (s.user === cpanelUser || s.domain === cleanDomain) && s.status === 'active');
    let maxFtp = 20;
    if (userServices.length > 0) {
      const activeSvc = userServices[0];
      const pkg = db.getById('hosting_packages', activeSvc.packageId);
      if (pkg && typeof pkg.ftpLimit === 'number') {
        maxFtp = pkg.ftpLimit;
      }
    }
    const existingCount = accounts.filter(a => a.cpanelUser === cpanelUser).length;
    if (existingCount >= maxFtp) {
      throw new Error(`FTP account limit reached for this hosting plan (Max: ${maxFtp} accounts)`);
    }

    // Path security & validation
    let cleanRelDir = (directory || 'public_html').trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    if (!cleanRelDir) cleanRelDir = 'public_html';

    const segments = cleanRelDir.split('/');
    for (const seg of segments) {
      if (seg === '..' || seg === '.' || seg.includes(' ')) {
        throw new Error('Access denied: path traversal detected in FTP directory');
      }
    }

    const userRoot = this.getUserRootDir(cpanelUser);
    const targetDir = path.resolve(userRoot, cleanRelDir);
    const canonicalBase = path.resolve(userRoot);

    if (targetDir !== canonicalBase && !targetDir.startsWith(canonicalBase + path.sep)) {
      throw new Error('Access denied: directory outside authorized account root');
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Quota parsing
    const quotaBytes = parseQuotaBytes(quota);
    const formattedQuota = quotaBytes ? formatBytes(quotaBytes) : (quota === 0 || quota === '0' || quota === 'Unlimited' ? 'Unlimited' : (typeof quota === 'number' ? quota + ' MB' : String(quota)));

    const newAccount = {
      id: `ftp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      cpanelUser,
      username: fullUser,
      userPart: cleanUser,
      domain: cleanDomain,
      passwordHash: bcrypt.hashSync(password, 10),
      directory: cleanRelDir,
      quota: quotaBytes ? formatBytes(quotaBytes) : (quota === 0 || quota === '0' ? 'Unlimited' : quota),
      quotaBytes,
      status: 'enabled',
      isMain: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    accounts.push(newAccount);
    this._write(accounts);

    // Sync with domainService.data.ftpAccounts for backward compatibility with feature_audit.js
    try {
      const dData = domainService._read(cpanelUser);
      dData.ftpAccounts = dData.ftpAccounts || [];
      if (!dData.ftpAccounts.some(f => f.user === fullUser || f.user === cleanUser)) {
        dData.ftpAccounts.push({
          user: fullUser,
          domain: cleanDomain,
          dir: cleanRelDir,
          quota: newAccount.quota,
          created: newAccount.createdAt
        });
        domainService._write(dData, cpanelUser);
      }
    } catch (e) {}

    return {
      success: true,
      account: {
        id: newAccount.id,
        username: newAccount.username,
        userPart: newAccount.userPart,
        domain: newAccount.domain,
        directory: newAccount.directory,
        quota: newAccount.quota,
        quotaBytes: newAccount.quotaBytes,
        status: newAccount.status,
        createdAt: newAccount.createdAt
      }
    };
  }

  /**
   * Change password for an FTP account
   */
  changePassword({ accountId, newPassword, password, cpanelUser = 'cpanel_user' }) {
    const pwd = newPassword || password;
    if (!pwd || pwd.length < 5) {
      throw new Error('Password must be at least 5 characters long');
    }

    const accounts = this._read();
    const acct = accounts.find(a => (a.id === accountId || a.username === accountId || a.userPart === accountId) && a.cpanelUser === cpanelUser);
    if (!acct) {
      throw new Error('FTP account not found');
    }

    acct.passwordHash = bcrypt.hashSync(pwd, 10);
    acct.updatedAt = new Date().toISOString();
    this._write(accounts);

    return { success: true, message: 'Password updated successfully' };
  }

  /**
   * Change Quota
   */
  changeQuota({ accountId, quota, cpanelUser = 'cpanel_user' }) {
    const accounts = this._read();
    const acct = accounts.find(a => (a.id === accountId || a.username === accountId || a.userPart === accountId) && a.cpanelUser === cpanelUser);
    if (!acct) {
      throw new Error('FTP account not found');
    }

    const quotaBytes = parseQuotaBytes(quota);
    acct.quota = quotaBytes ? formatBytes(quotaBytes) : 'Unlimited';
    acct.quotaBytes = quotaBytes;
    acct.updatedAt = new Date().toISOString();
    this._write(accounts);

    return {
      success: true,
      quota: acct.quota,
      quotaBytes: acct.quotaBytes,
      account: {
        id: acct.id,
        username: acct.username,
        quota: acct.quota,
        quotaBytes: acct.quotaBytes
      }
    };
  }

  /**
   * Change Directory Scope
   */
  changeDirectory({ accountId, newDirectory, directory, cpanelUser = 'cpanel_user' }) {
    const accounts = this._read();
    const acct = accounts.find(a => (a.id === accountId || a.username === accountId || a.userPart === accountId) && a.cpanelUser === cpanelUser);
    if (!acct) {
      throw new Error('FTP account not found');
    }

    const targetDirInput = newDirectory || directory || 'public_html';
    let cleanRelDir = targetDirInput.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    if (!cleanRelDir) cleanRelDir = 'public_html';

    const segments = cleanRelDir.split('/');
    for (const seg of segments) {
      if (seg === '..' || seg === '.' || seg.includes(' ')) {
        throw new Error('Access denied: path traversal detected in FTP directory');
      }
    }

    const userRoot = this.getUserRootDir(cpanelUser);
    const targetDir = path.resolve(userRoot, cleanRelDir);
    const canonicalBase = path.resolve(userRoot);

    if (targetDir !== canonicalBase && !targetDir.startsWith(canonicalBase + path.sep)) {
      throw new Error('Access denied: directory outside authorized account root');
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    acct.directory = cleanRelDir;
    acct.updatedAt = new Date().toISOString();
    this._write(accounts);

    return {
      success: true,
      directory: acct.directory,
      account: {
        id: acct.id,
        username: acct.username,
        directory: acct.directory
      }
    };
  }

  /**
   * Toggle account status (enabled / disabled)
   */
  toggleStatus({ accountId, enabled, status, cpanelUser = 'cpanel_user' }) {
    const accounts = this._read();
    const acct = accounts.find(a => (a.id === accountId || a.username === accountId || a.userPart === accountId) && a.cpanelUser === cpanelUser);
    if (!acct) {
      throw new Error('FTP account not found');
    }

    if (status !== undefined) {
      acct.status = (status === 'active' || status === 'enabled') ? 'enabled' : 'disabled';
    } else if (enabled !== undefined) {
      acct.status = enabled ? 'enabled' : 'disabled';
    } else {
      acct.status = acct.status === 'enabled' ? 'disabled' : 'enabled';
    }

    acct.updatedAt = new Date().toISOString();
    this._write(accounts);

    return {
      success: true,
      status: acct.status === 'enabled' ? 'active' : 'disabled',
      account: {
        id: acct.id,
        username: acct.username,
        status: acct.status === 'enabled' ? 'active' : 'disabled'
      }
    };
  }

  /**
   * Delete FTP account
   * CRITICAL: STRICTLY PRESERVES PHYSICAL DIRECTORY AND ALL FILES!
   */
  deleteAccount({ accountId, cpanelUser = 'cpanel_user' }) {
    const accounts = this._read();
    const acctIndex = accounts.findIndex(a => (a.id === accountId || a.username === accountId || a.userPart === accountId) && (cpanelUser ? a.cpanelUser === cpanelUser : true));
    if (acctIndex === -1) {
      throw new Error('FTP account not found');
    }

    const acct = accounts[acctIndex];
    if (acct.isMain) {
      throw new Error('Cannot delete the primary/system FTP account');
    }

    accounts.splice(acctIndex, 1);
    this._write(accounts);

    // Sync with domainService for backward compatibility
    try {
      const dData = domainService._read(acct.cpanelUser);
      if (dData.ftpAccounts) {
        dData.ftpAccounts = dData.ftpAccounts.filter(f => f.user !== acct.username && f.user !== acct.userPart);
        domainService._write(dData, acct.cpanelUser);
      }
    } catch (e) {}

    return {
      success: true,
      message: `FTP account '${acct.username}' deleted. Directory '${acct.directory}' was preserved.`,
      preservedDirectory: acct.directory
    };
  }

  /**
   * Live Test Connection via TCP Socket probe
   */
  async testConnection({ accountId, cpanelUser = 'cpanel_user' }) {
    const accounts = this._read();
    const acct = accounts.find(a => (a.id === accountId || a.username === accountId || a.userPart === accountId) && a.cpanelUser === cpanelUser);
    if (!acct) {
      throw new Error('FTP account not found');
    }

    const isEnabled = acct.status === 'enabled';
    const userRoot = this.getUserRootDir(cpanelUser);
    const targetDir = acct.directory ? path.resolve(userRoot, acct.directory) : userRoot;
    const dirExists = fs.existsSync(targetDir);

    const port = ftpServerService.port || 21;
    const start = Date.now();

    return new Promise((resolve) => {
      const client = net.createConnection({ host: '127.0.0.1', port }, () => {
        const latencyMs = Date.now() - start;
        client.write('QUIT\r\n');
        client.end();
        resolve({
          success: true,
          status: isEnabled ? 'Active' : 'Disabled',
          ftpPort: port,
          directoryStatus: dirExists ? 'Accessible' : 'Directory Missing',
          assignedDirectory: acct.directory,
          quota: acct.quota,
          latencyMs,
          message: isEnabled ? 'FTP Service operational and ready for client connections' : 'Account is currently disabled'
        });
      });

      client.on('error', (err) => {
        resolve({
          success: false,
          status: isEnabled ? 'Active' : 'Disabled',
          ftpPort: port,
          directoryStatus: dirExists ? 'Accessible' : 'Directory Missing',
          assignedDirectory: acct.directory,
          quota: acct.quota,
          latencyMs: null,
          message: `FTP Daemon check failed: ${err.message}`
        });
      });
    });
  }

  /**
   * Connection Information & Client Configs (FileZilla XML, CoreFTP, Cyberduck)
   */
  getConnectionInfo({ accountId, cpanelUser = 'cpanel_user', host = 'localhost' }) {
    const accounts = this._read();
    const acct = accounts.find(a => (a.id === accountId || a.username === accountId || a.userPart === accountId) && a.cpanelUser === cpanelUser);
    if (!acct) {
      throw new Error('FTP account not found');
    }

    const port = ftpServerService.port || 21;
    const serverHost = host.includes(':') ? host.split(':')[0] : host;

    const filezillaXml = `<?xml version="1.0" encoding="UTF-8"?>
<FileZilla3 version="3.0.0" platform="windows">
  <Servers>
    <Server>
      <Host>${serverHost}</Host>
      <Port>${port}</Port>
      <Protocol>0</Protocol>
      <Type>0</Type>
      <User>${acct.username}</User>
      <Logontype>1</Logontype>
      <PasvMode>MODE_DEFAULT</PasvMode>
      <EncodingType>Auto</EncodingType>
      <BypassProxy>0</BypassProxy>
      <Name>${acct.username} on ${serverHost}</Name>
      <RemoteDir>/public_html</RemoteDir>
    </Server>
  </Servers>
</FileZilla3>`;

    const cyberduckDuck = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Protocol</key>
  <string>ftp</string>
  <key>Hostname</key>
  <string>${serverHost}</string>
  <key>Port</key>
  <string>${port}</string>
  <key>Username</key>
  <string>${acct.username}</string>
  <key>Path</key>
  <string>/public_html</string>
</dict>
</plist>`;

    return {
      success: true,
      connection: {
        server: serverHost,
        port,
        protocol: 'FTP (RFC 959)',
        username: acct.username,
        directory: acct.directory,
        quota: acct.quota,
        tls: false
      },
      clientConfigs: {
        filezilla: {
          filename: `${acct.username}-filezilla.xml`,
          mime: 'application/xml',
          content: filezillaXml
        },
        cyberduck: {
          filename: `${acct.username}-cyberduck.duck`,
          mime: 'application/xml',
          content: cyberduckDuck
        }
      }
    };
  }
}

module.exports = new FtpService();
