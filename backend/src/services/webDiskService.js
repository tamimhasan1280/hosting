const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const storageService = require('./storageService');

const ACCOUNTS_FILE = path.resolve(__dirname, '../../data/web_disk_accounts.json');

function ensureAccountsStore() {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    // Default main Web Disk account for cpanel_user
    const initial = [
      {
        id: 'wd_main_cpanel_user',
        cpanelUser: 'cpanel_user',
        username: 'cpanel_user',
        passwordHash: bcrypt.hashSync('demo12345', 10),
        directory: '', // points to account root
        permissions: 'read-write',
        status: 'enabled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

class WebDiskService {
  constructor() {
    ensureAccountsStore();
  }

  _read() {
    ensureAccountsStore();
    try {
      return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  _write(data) {
    const tmp = `${ACCOUNTS_FILE}.tmp_${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, ACCOUNTS_FILE);
  }

  /**
   * List Web Disk accounts for a specific cPanel user (never exposes passwordHash)
   */
  listAccounts(cpanelUser = 'cpanel_user') {
    const accounts = this._read();
    
    // Ensure default account exists if user has none
    let userAccounts = accounts.filter(a => a.cpanelUser === cpanelUser);
    if (userAccounts.length === 0) {
      const defaultAcct = {
        id: `wd_main_${cpanelUser}_${Date.now()}`,
        cpanelUser,
        username: cpanelUser,
        passwordHash: bcrypt.hashSync('cpanel_pass123', 10),
        directory: '',
        permissions: 'read-write',
        status: 'enabled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      accounts.push(defaultAcct);
      this._write(accounts);
      userAccounts = [defaultAcct];
    }

    return userAccounts.map(a => ({
      id: a.id,
      username: a.username,
      directory: a.directory || '/',
      displayDirectory: a.directory ? `/${a.directory}` : '/ (Home Directory)',
      permissions: a.permissions || 'read-write',
      status: a.status || 'enabled',
      createdAt: a.createdAt,
      updatedAt: a.updatedAt
    }));
  }

  /**
   * List valid directories for Web Disk creation dropdown
   */
  listAvailableDirectories(cpanelUser = 'cpanel_user') {
    const rootDir = storageService.getRootDir(cpanelUser);
    const dirs = [{ name: '/ (Home Directory)', path: '' }];

    function walk(currentDir, rel = '') {
      if (!fs.existsSync(currentDir)) return;
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            if (e.name.startsWith('.') || e.name === 'node_modules') continue;
            const childRel = rel ? `${rel}/${e.name}` : e.name;
            dirs.push({
              name: `/${childRel}`,
              path: childRel
            });
            // Max depth 3
            if (childRel.split('/').length < 3) {
              walk(path.join(currentDir, e.name), childRel);
            }
          }
        }
      } catch (err) {}
    }

    walk(rootDir, '');
    return dirs;
  }

  /**
   * Create a new Web Disk account
   */
  createAccount({ username, password, directory = '', permissions = 'read-write', cpanelUser = 'cpanel_user' }) {
    if (!username || typeof username !== 'string') {
      throw new Error('Username is required');
    }
    const cleanUser = username.trim();
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(cleanUser)) {
      throw new Error('Username must be 3-32 characters and contain only letters, numbers, hyphens, dots, or underscores');
    }
    if (!password || typeof password !== 'string' || password.length < 5) {
      throw new Error('Password must be at least 5 characters long');
    }
    if (permissions !== 'read-write' && permissions !== 'read-only') {
      throw new Error('Permissions must be either read-write or read-only');
    }

    // Verify directory stays within user root
    const rootDir = storageService.getRootDir(cpanelUser);
    let cleanRelDir = (directory || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (cleanRelDir) {
      const resolved = storageService.resolveSafePath(cleanRelDir, cpanelUser);
      if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
      }
    }

    const accounts = this._read();
    if (accounts.some(a => a.username.toLowerCase() === cleanUser.toLowerCase())) {
      throw new Error(`Web Disk account with username '${cleanUser}' already exists`);
    }

    const newAccount = {
      id: `wd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      cpanelUser,
      username: cleanUser,
      passwordHash: bcrypt.hashSync(password, 10),
      directory: cleanRelDir,
      permissions,
      status: 'enabled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    accounts.push(newAccount);
    this._write(accounts);

    return {
      success: true,
      account: {
        id: newAccount.id,
        username: newAccount.username,
        directory: newAccount.directory || '/',
        permissions: newAccount.permissions,
        status: newAccount.status,
        createdAt: newAccount.createdAt
      }
    };
  }

  /**
   * Change password for a Web Disk account
   */
  changePassword({ accountId, newPassword, cpanelUser = 'cpanel_user' }) {
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 5) {
      throw new Error('New password must be at least 5 characters long');
    }

    const accounts = this._read();
    const acct = accounts.find(a => a.id === accountId);
    if (!acct) {
      throw new Error('Web Disk account not found');
    }
    if (acct.cpanelUser !== cpanelUser) {
      throw new Error('Access denied: account does not belong to user');
    }

    acct.passwordHash = bcrypt.hashSync(newPassword, 10);
    acct.updatedAt = new Date().toISOString();
    this._write(accounts);

    return { success: true, message: 'Password updated successfully' };
  }

  /**
   * Toggle account status (enabled / disabled)
   */
  toggleStatus({ accountId, enabled, cpanelUser = 'cpanel_user' }) {
    const accounts = this._read();
    const acct = accounts.find(a => a.id === accountId);
    if (!acct) {
      throw new Error('Web Disk account not found');
    }
    if (acct.cpanelUser !== cpanelUser) {
      throw new Error('Access denied: account does not belong to user');
    }

    if (enabled !== undefined) {
      acct.status = enabled ? 'enabled' : 'disabled';
    } else {
      acct.status = acct.status === 'enabled' ? 'disabled' : 'enabled';
    }
    acct.updatedAt = new Date().toISOString();
    this._write(accounts);

    return { success: true, status: acct.status };
  }

  /**
   * Delete Web Disk account (CRITICAL: leaves filesystem directory completely untouched!)
   */
  deleteAccount({ accountId, cpanelUser = 'cpanel_user' }) {
    const accounts = this._read();
    const acctIndex = accounts.findIndex(a => a.id === accountId);
    if (acctIndex === -1) {
      throw new Error('Web Disk account not found');
    }
    const acct = accounts[acctIndex];
    if (acct.cpanelUser !== cpanelUser) {
      throw new Error('Access denied: account does not belong to user');
    }

    accounts.splice(acctIndex, 1);
    this._write(accounts);

    return { 
      success: true, 
      message: `Web Disk account '${acct.username}' deleted successfully. The directory '${acct.directory || '/'}' was left untouched.` 
    };
  }

  /**
   * Test Web Disk connection
   */
  testConnection({ accountId, cpanelUser = 'cpanel_user' }) {
    const accounts = this._read();
    const acct = accounts.find(a => a.id === accountId);
    if (!acct) {
      throw new Error('Web Disk account not found');
    }
    if (acct.cpanelUser !== cpanelUser) {
      throw new Error('Access denied: account does not belong to user');
    }

    const isEnabled = acct.status === 'enabled';
    const rootDir = storageService.getRootDir(cpanelUser);
    const targetDir = acct.directory ? path.join(rootDir, acct.directory) : rootDir;
    const dirExists = fs.existsSync(targetDir);

    return {
      success: true,
      testedAt: new Date().toISOString(),
      account: acct.username,
      status: acct.status,
      webdavEndpoint: '/webdav',
      directoryExists: dirExists,
      latencyMs: Math.floor(Math.random() * 8) + 4,
      connectionOk: isEnabled && dirExists
    };
  }

  /**
   * Real WebDAV Protocol Request Handler
   * Handles OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY, LOCK, UNLOCK
   */
  async handleWebDavRequest(req, res) {
    const method = req.method.toUpperCase();

    // 1. OPTIONS Discovery (Can be queried unauthenticated or authenticated per RFC 4918)
    if (method === 'OPTIONS') {
      res.setHeader('DAV', '1, 2');
      res.setHeader('MS-Author-Via', 'DAV');
      res.setHeader('Allow', 'OPTIONS, GET, HEAD, PROPFIND, PUT, DELETE, MKCOL, MOVE, COPY, PROPPATCH, LOCK, UNLOCK');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, HEAD, PROPFIND, PUT, DELETE, MKCOL, MOVE, COPY, PROPPATCH, LOCK, UNLOCK');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Depth, Destination, If, Overwrite');
      return res.status(200).end();
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="cPanel Web Disk"');
      return res.status(401).send('Authentication required for Web Disk access');
    }

    let credentials;
    try {
      const b64 = authHeader.split(' ')[1];
      const decoded = Buffer.from(b64, 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      if (idx === -1) throw new Error('Invalid auth string');
      credentials = {
        user: decoded.substring(0, idx),
        pass: decoded.substring(idx + 1)
      };
    } catch (e) {
      res.setHeader('WWW-Authenticate', 'Basic realm="cPanel Web Disk"');
      return res.status(401).send('Invalid authorization header format');
    }

    const accounts = this._read();
    const matchedAccount = accounts.find(a => a.username.toLowerCase() === credentials.user.toLowerCase());

    if (!matchedAccount) {
      res.setHeader('WWW-Authenticate', 'Basic realm="cPanel Web Disk"');
      return res.status(401).send('Invalid Web Disk credentials');
    }

    const passwordValid = bcrypt.compareSync(credentials.pass, matchedAccount.passwordHash);
    if (!passwordValid) {
      res.setHeader('WWW-Authenticate', 'Basic realm="cPanel Web Disk"');
      return res.status(401).send('Invalid Web Disk credentials');
    }

    if (matchedAccount.status !== 'enabled') {
      return res.status(403).send('Web Disk account is disabled by administrator or user');
    }

    // Determine sandbox root for this Web Disk account
    const userRootDir = storageService.getRootDir(matchedAccount.cpanelUser);
    const accountBaseDir = matchedAccount.directory 
      ? path.resolve(userRootDir, matchedAccount.directory) 
      : path.resolve(userRootDir);

    if (!fs.existsSync(accountBaseDir)) {
      fs.mkdirSync(accountBaseDir, { recursive: true });
    }

    // Parse subpath requested from URL
    // e.g. /webdav or /webdav/folder1/file.txt
    const urlPath = req.path || '';
    let subpath = urlPath.replace(/^\/webdav\/?/i, '');
    try {
      subpath = decodeURIComponent(subpath);
    } catch (e) {}

    // Traversal and null-byte defenses
    if (subpath.includes('\0') || subpath.toLowerCase().includes('%00')) {
      return res.status(400).send('Access denied: null byte detected');
    }

    subpath = subpath.replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = subpath.split('/');
    for (const seg of segments) {
      if (seg === '..' || seg === '.') {
        return res.status(403).send('Access denied: path traversal detected');
      }
    }

    const targetPath = path.resolve(accountBaseDir, subpath);
    const canonicalBase = path.resolve(accountBaseDir);

    // Verify path remains strictly inside accountBaseDir
    if (targetPath !== canonicalBase && !targetPath.startsWith(canonicalBase + path.sep)) {
      return res.status(403).send('Access denied: path outside authorized Web Disk directory');
    }

    // Check symlink containment if exists
    if (fs.existsSync(targetPath)) {
      try {
        const real = fs.realpathSync(targetPath);
        if (real !== canonicalBase && !real.startsWith(canonicalBase + path.sep)) {
          return res.status(403).send('Access denied: symlink escape detected');
        }
      } catch (e) {}
    }

    // Enforce read-only restriction
    const isWriteMethod = ['PUT', 'DELETE', 'MKCOL', 'MOVE', 'COPY', 'PROPPATCH'].includes(req.method.toUpperCase());
    if (matchedAccount.permissions === 'read-only' && isWriteMethod) {
      return res.status(403).send('Access denied: this Web Disk account is configured as read-only');
    }

    // Handle WebDAV methods
    // 2. PROPFIND (XML 207 Multi-Status)
    if (method === 'PROPFIND') {
      if (!fs.existsSync(targetPath)) {
        return res.status(404).send('Resource not found');
      }

      const stat = fs.statSync(targetPath);
      const depth = req.headers['depth'] || '1'; // '0', '1', or 'infinity'

      const itemsToReport = [];
      itemsToReport.push({
        href: req.path.endsWith('/') ? req.path : `${req.path}/`,
        stat,
        isDir: stat.isDirectory(),
        name: path.basename(targetPath) || '/'
      });

      if (stat.isDirectory() && depth !== '0') {
        try {
          const entries = fs.readdirSync(targetPath, { withFileTypes: true });
          for (const entry of entries) {
            const entryPath = path.join(targetPath, entry.name);
            try {
              const entryStat = fs.statSync(entryPath);
              const basePathClean = req.path.replace(/\/+$/, '');
              itemsToReport.push({
                href: `${basePathClean}/${encodeURIComponent(entry.name)}${entryStat.isDirectory() ? '/' : ''}`,
                stat: entryStat,
                isDir: entryStat.isDirectory(),
                name: entry.name
              });
            } catch (err) {}
          }
        } catch (err) {}
      }

      let xml = '<?xml version="1.0" encoding="utf-8" ?>\n';
      xml += '<D:multistatus xmlns:D="DAV:">\n';

      for (const item of itemsToReport) {
        xml += '  <D:response>\n';
        xml += `    <D:href>${item.href}</D:href>\n`;
        xml += '    <D:propstat>\n';
        xml += '      <D:prop>\n';
        xml += `        <D:displayname>${item.name}</D:displayname>\n`;
        xml += `        <D:getlastmodified>${item.stat.mtime.toUTCString()}</D:getlastmodified>\n`;
        if (item.isDir) {
          xml += '        <D:resourcetype><D:collection/></D:resourcetype>\n';
        } else {
          xml += '        <D:resourcetype/>\n';
          xml += `        <D:getcontentlength>${item.stat.size}</D:getcontentlength>\n`;
        }
        xml += '      </D:prop>\n';
        xml += '      <D:status>HTTP/1.1 200 OK</D:status>\n';
        xml += '    </D:propstat>\n';
        xml += '  </D:response>\n';
      }

      xml += '</D:multistatus>';

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      return res.status(207).send(xml);
    }

    // 3. GET & HEAD
    if (method === 'GET' || method === 'HEAD') {
      if (!fs.existsSync(targetPath)) {
        return res.status(404).send('Resource not found');
      }
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        if (!req.path.endsWith('/')) {
          return res.redirect(301, `${req.path}/`);
        }
        // HTML Directory Index
        const entries = fs.readdirSync(targetPath);
        let html = `<!DOCTYPE html><html><head><title>Index of ${subpath || '/'}</title></head><body><h1>Index of /${subpath}</h1><hr><ul>`;
        html += '<li><a href="../">../</a></li>';
        for (const e of entries) {
          html += `<li><a href="${encodeURIComponent(e)}">${e}</a></li>`;
        }
        html += '</ul><hr><small>cPanel Web Disk Service</small></body></html>';
        return res.status(200).send(html);
      }

      res.setHeader('Content-Length', stat.size);
      res.setHeader('Last-Modified', stat.mtime.toUTCString());
      if (method === 'HEAD') {
        return res.status(200).end();
      }
      return fs.createReadStream(targetPath).pipe(res);
    }

    // 4. MKCOL (Create Directory)
    if (method === 'MKCOL') {
      if (fs.existsSync(targetPath)) {
        return res.status(405).send('Directory or file already exists');
      }
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        return res.status(409).send('Parent directory does not exist');
      }
      fs.mkdirSync(targetPath);
      return res.status(201).end();
    }

    // 5. PUT (Upload/Write File)
    if (method === 'PUT') {
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      const writeStream = fs.createWriteStream(targetPath);
      req.pipe(writeStream);
      writeStream.on('finish', () => {
        res.status(201).end();
      });
      writeStream.on('error', (err) => {
        res.status(500).send(err.message);
      });
      return;
    }

    // 6. DELETE
    if (method === 'DELETE') {
      if (!fs.existsSync(targetPath)) {
        return res.status(404).send('Target not found');
      }
      // Never allow deleting the base directory itself
      if (targetPath === canonicalBase) {
        return res.status(403).send('Cannot delete the root Web Disk directory');
      }
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
      return res.status(204).end();
    }

    // 7. MOVE & COPY
    if (method === 'MOVE' || method === 'COPY') {
      const destHeader = req.headers['destination'];
      if (!destHeader) {
        return res.status(400).send('Destination header required for MOVE/COPY');
      }
      let destUrlPath;
      try {
        const u = new URL(destHeader, 'http://localhost');
        destUrlPath = u.pathname;
      } catch (e) {
        destUrlPath = destHeader;
      }
      let destSub = destUrlPath.replace(/^\/webdav\/?/i, '');
      const destTarget = path.resolve(accountBaseDir, decodeURIComponent(destSub).replace(/\\/g, '/').replace(/^\/+/, ''));

      if (destTarget !== canonicalBase && !destTarget.startsWith(canonicalBase + path.sep)) {
        return res.status(403).send('Destination outside authorized Web Disk directory');
      }

      if (!fs.existsSync(targetPath)) {
        return res.status(404).send('Source not found');
      }

      if (method === 'MOVE') {
        fs.renameSync(targetPath, destTarget);
        return res.status(201).end();
      } else {
        fs.cpSync(targetPath, destTarget, { recursive: true });
        return res.status(201).end();
      }
    }

    // 8. LOCK / UNLOCK
    if (method === 'LOCK') {
      const token = `opaquelocktoken:${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      res.setHeader('Lock-Token', `<${token}>`);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      const xml = `<?xml version="1.0" encoding="utf-8" ?>
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:exclusive/></D:lockscope>
      <D:depth>Infinity</D:depth>
      <D:owner><D:href>${matchedAccount.username}</D:href></D:owner>
      <D:timeout>Second-3600</D:timeout>
      <D:locktoken><D:href>${token}</D:href></D:locktoken>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>`;
      return res.status(200).send(xml);
    }

    if (method === 'UNLOCK') {
      return res.status(204).end();
    }

    // Unsupported method fallback
    res.setHeader('Allow', 'OPTIONS, GET, HEAD, PROPFIND, PUT, DELETE, MKCOL, MOVE, COPY, LOCK, UNLOCK');
    return res.status(405).send(`Method ${method} not allowed`);
  }
}

module.exports = new WebDiskService();
