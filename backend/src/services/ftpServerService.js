const net = require('net');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

function getWebalizerFtpService() {
  try {
    return require('./webalizerFtpService');
  } catch (e) {
    return null;
  }
}

class FtpServerService {
  constructor() {
    this.server = null;
    this.port = 21;
    this.fallbackPort = 2121;
    this.isRunning = false;
    this.activeConnections = new Set();
    this.accountsProvider = null; // will be set by ftpService
  }

  setAccountsProvider(provider) {
    this.accountsProvider = provider;
  }

  start(preferredPort = 21) {
    if (this.isRunning) return Promise.resolve(this.port);

    return new Promise((resolve) => {
      const tryListen = (port) => {
        const s = net.createServer((socket) => {
          this._handleClient(socket);
        });

        s.on('error', (err) => {
          if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
            if (port === preferredPort && port !== this.fallbackPort) {
              console.log(`[FTP Daemon] Port ${port} unavailable, attempting fallback port ${this.fallbackPort}...`);
              tryListen(this.fallbackPort);
            } else {
              console.error(`[FTP Daemon] Could not bind FTP port ${port}:`, err.message);
              this.isRunning = false;
              resolve(null);
            }
          } else {
            console.error('[FTP Daemon] Server error:', err.message);
          }
        });

        s.listen(port, '0.0.0.0', () => {
          this.server = s;
          this.port = port;
          this.isRunning = true;
          console.log(`⚡ cPanel FTP Daemon (RFC 959) active on port ${port}`);
          resolve(port);
        });
      };

      tryListen(preferredPort);
    });
  }

  stop() {
    if (!this.isRunning || !this.server) return Promise.resolve();
    return new Promise((resolve) => {
      for (const socket of this.activeConnections) {
        try { socket.destroy(); } catch (e) {}
      }
      this.activeConnections.clear();
      this.server.close(() => {
        this.isRunning = false;
        console.log('[FTP Daemon] Service stopped.');
        resolve();
      });
    });
  }

  getStatus() {
    return {
      available: this.isRunning,
      daemon: 'cPanel FTP Server (RFC 959 / Pure-FTPd Compatible)',
      version: '1.0.0',
      port: this.port,
      virtual_users: true,
      quota_supported: true,
      tls_supported: false,
      status: this.isRunning ? 'running' : 'stopped'
    };
  }

  _handleClient(socket) {
    this.activeConnections.add(socket);
    socket.setEncoding('utf8');

    const session = {
      socket,
      authenticated: false,
      user: null,
      account: null,
      accountBaseDir: null,
      cwd: '/',
      transferType: 'I', // 'A' or 'I'
      pasvServer: null,
      pasvSocket: null,
      activePort: null,
      renameFrom: null
    };

    socket.write('220 cPanel FTP Server (RFC 959) ready.\r\n');

    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk;
      let lineEnd;
      while ((lineEnd = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, lineEnd).replace(/\r$/, '');
        buffer = buffer.substring(lineEnd + 1);
        if (line.trim()) {
          this._handleCommand(session, line);
        }
      }
    });

    const cleanup = () => {
      this.activeConnections.delete(socket);
      if (session.pasvServer) {
        try { session.pasvServer.close(); } catch (e) {}
        session.pasvServer = null;
      }
      if (session.pasvSocket) {
        try { session.pasvSocket.destroy(); } catch (e) {}
        session.pasvSocket = null;
      }
    };

    socket.on('close', cleanup);
    socket.on('error', cleanup);
  }

  _handleCommand(session, line) {
    const spaceIdx = line.indexOf(' ');
    const cmd = (spaceIdx === -1 ? line : line.substring(0, spaceIdx)).toUpperCase();
    const arg = spaceIdx === -1 ? '' : line.substring(spaceIdx + 1).trim();

    // Commands requiring authentication (except USER, PASS, QUIT, NOOP, FEAT, SYST)
    const publicCmds = ['USER', 'PASS', 'QUIT', 'NOOP', 'FEAT', 'SYST', 'AUTH'];
    if (!session.authenticated && !publicCmds.includes(cmd)) {
      session.socket.write('530 Please login with USER and PASS.\r\n');
      return;
    }

    switch (cmd) {
      case 'USER':
        session.user = arg;
        session.authenticated = false;
        session.account = null;
        session.socket.write('331 User name okay, need password.\r\n');
        break;

      case 'PASS':
        this._handlePass(session, arg);
        break;

      case 'SYST':
        session.socket.write('215 UNIX Type: L8\r\n');
        break;

      case 'FEAT':
        session.socket.write('211-Features:\r\n PASV\r\n EPSV\r\n UTF8\r\n SIZE\r\n MDTM\r\n MLSD\r\n211 End\r\n');
        break;

      case 'TYPE':
        const typeArg = arg.toUpperCase();
        if (typeArg === 'A' || typeArg === 'I') {
          session.transferType = typeArg;
          session.socket.write(`200 Type set to ${typeArg}.\r\n`);
        } else {
          session.socket.write('504 Command not implemented for that parameter.\r\n');
        }
        break;

      case 'PWD':
        session.socket.write(`257 "${session.cwd}" is the current directory\r\n`);
        break;

      case 'CWD':
        this._handleCwd(session, arg);
        break;

      case 'CDUP':
        this._handleCwd(session, '..');
        break;

      case 'PASV':
        this._handlePasv(session);
        break;

      case 'EPSV':
        this._handleEpsv(session);
        break;

      case 'PORT':
        this._handlePort(session, arg);
        break;

      case 'LIST':
      case 'NLST':
        this._handleList(session, arg, cmd === 'NLST');
        break;

      case 'MLSD':
        this._handleMlsd(session, arg);
        break;

      case 'RETR':
        this._handleRetr(session, arg);
        break;

      case 'STOR':
        this._handleStor(session, arg);
        break;

      case 'DELE':
        this._handleDele(session, arg);
        break;

      case 'MKD':
        this._handleMkd(session, arg);
        break;

      case 'RMD':
        this._handleRmd(session, arg);
        break;

      case 'RNFR':
        this._handleRnfr(session, arg);
        break;

      case 'RNTO':
        this._handleRnto(session, arg);
        break;

      case 'SIZE':
        this._handleSize(session, arg);
        break;

      case 'MDTM':
        this._handleMdtm(session, arg);
        break;

      case 'NOOP':
        session.socket.write('200 NOOP ok.\r\n');
        break;

      case 'QUIT':
        session.socket.write('221 Goodbye.\r\n');
        session.socket.end();
        break;

      default:
        session.socket.write('502 Command not implemented.\r\n');
        break;
    }
  }

  _handlePass(session, password) {
    if (!session.user) {
      session.socket.write('503 Bad sequence of commands.\r\n');
      return;
    }

    if (!this.accountsProvider) {
      session.socket.write('451 Authentication service unavailable.\r\n');
      return;
    }

    const acct = this.accountsProvider.findAccount(session.user);
    if (!acct) {
      const wfs = getWebalizerFtpService();
      if (wfs) {
        wfs.logAuth({
          cpanelUser: 'cpanel_user',
          username: session.user,
          remoteHost: session.socket.remoteAddress,
          success: false,
          message: 'User account not found'
        });
      }
      session.socket.write('530 Login incorrect.\r\n');
      return;
    }

    // Verify bcrypt password
    const valid = bcrypt.compareSync(password, acct.passwordHash);
    if (!valid) {
      const wfs = getWebalizerFtpService();
      if (wfs) {
        wfs.logAuth({
          cpanelUser: acct.cpanelUser || 'cpanel_user',
          username: session.user,
          remoteHost: session.socket.remoteAddress,
          success: false,
          message: 'Invalid password'
        });
      }
      session.socket.write('530 Login incorrect.\r\n');
      return;
    }

    if (acct.status !== 'enabled') {
      const wfs = getWebalizerFtpService();
      if (wfs) {
        wfs.logAuth({
          cpanelUser: acct.cpanelUser || 'cpanel_user',
          username: session.user,
          remoteHost: session.socket.remoteAddress,
          success: false,
          message: 'Account disabled'
        });
      }
      session.socket.write('530 Login incorrect (Account disabled by user or administrator).\r\n');
      return;
    }

    // Determine sandbox root for this FTP user
    const userRootDir = this.accountsProvider.getUserRootDir(acct.cpanelUser);
    const accountBaseDir = acct.directory 
      ? path.resolve(userRootDir, acct.directory) 
      : path.resolve(userRootDir);

    if (!fs.existsSync(accountBaseDir)) {
      try {
        fs.mkdirSync(accountBaseDir, { recursive: true });
      } catch (e) {}
    }

    session.authenticated = true;
    session.account = acct;
    session.accountBaseDir = accountBaseDir;
    session.cwd = '/';

    const wfs = getWebalizerFtpService();
    if (wfs) {
      wfs.logAuth({
        cpanelUser: acct.cpanelUser || 'cpanel_user',
        username: session.user,
        remoteHost: session.socket.remoteAddress,
        success: true,
        message: 'Login successful'
      });
    }

    session.socket.write(`230 User ${session.user} logged in, proceed.\r\n`);
  }

  _resolvePath(session, relPath) {
    if (!relPath) return { abs: session.accountBaseDir, virt: session.cwd };

    // Remove null bytes and dangerous characters
    const cleanRel = relPath.replace(/\0/g, '').replace(/\\/g, '/');

    let targetVirt;
    if (cleanRel.startsWith('/')) {
      targetVirt = path.posix.normalize(cleanRel);
    } else {
      targetVirt = path.posix.normalize(path.posix.join(session.cwd, cleanRel));
    }

    // Strict containment inside virtual root '/'
    if (!targetVirt.startsWith('/')) {
      targetVirt = '/' + targetVirt;
    }

    // Map virtual path to physical accountBaseDir
    const subpath = targetVirt.replace(/^\/+/, '');
    const absPath = path.resolve(session.accountBaseDir, subpath);
    const canonicalBase = path.resolve(session.accountBaseDir);

    if (absPath !== canonicalBase && !absPath.startsWith(canonicalBase + path.sep)) {
      return null; // Path traversal prevented!
    }

    return { abs: absPath, virt: targetVirt };
  }

  _handleCwd(session, target) {
    const resolved = this._resolvePath(session, target);
    if (!resolved) {
      session.socket.write('550 Access denied: path outside authorized directory.\r\n');
      return;
    }

    if (!fs.existsSync(resolved.abs)) {
      session.socket.write('550 Failed to change directory: Directory not found.\r\n');
      return;
    }

    try {
      const stat = fs.statSync(resolved.abs);
      if (!stat.isDirectory()) {
        session.socket.write('550 Not a directory.\r\n');
        return;
      }
      session.cwd = resolved.virt;
      session.socket.write('250 Directory successfully changed.\r\n');
    } catch (e) {
      session.socket.write(`550 Directory change failed: ${e.message}\r\n`);
    }
  }

  _handlePasv(session) {
    if (session.pasvServer) {
      try { session.pasvServer.close(); } catch (e) {}
      session.pasvServer = null;
    }
    session.pasvSocket = null;
    session.pasvSocketResolver = null;

    const pasvServer = net.createServer((dataSocket) => {
      if (session.pasvSocketResolver) {
        session.pasvSocketResolver(dataSocket);
        session.pasvSocketResolver = null;
      } else {
        session.pasvSocket = dataSocket;
      }
      try { pasvServer.close(); } catch (e) {}
    });

    pasvServer.listen(0, '127.0.0.1', () => {
      session.pasvServer = pasvServer;
      const addr = pasvServer.address();
      const port = addr.port;
      const p1 = Math.floor(port / 256);
      const p2 = port % 256;
      session.socket.write(`227 Entering Passive Mode (127,0,0,1,${p1},${p2}).\r\n`);
    });
  }

  _handleEpsv(session) {
    if (session.pasvServer) {
      try { session.pasvServer.close(); } catch (e) {}
      session.pasvServer = null;
    }
    session.pasvSocket = null;
    session.pasvSocketResolver = null;

    const pasvServer = net.createServer((dataSocket) => {
      if (session.pasvSocketResolver) {
        session.pasvSocketResolver(dataSocket);
        session.pasvSocketResolver = null;
      } else {
        session.pasvSocket = dataSocket;
      }
      try { pasvServer.close(); } catch (e) {}
    });

    pasvServer.listen(0, '127.0.0.1', () => {
      session.pasvServer = pasvServer;
      const addr = pasvServer.address();
      session.socket.write(`229 Entering Extended Passive Mode (|||${addr.port}|)\r\n`);
    });
  }

  _handlePort(session, arg) {
    const parts = arg.split(',').map(n => parseInt(n, 10));
    if (parts.length !== 6 || parts.some(isNaN)) {
      session.socket.write('501 Syntax error in parameters or arguments.\r\n');
      return;
    }
    const host = `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}`;
    const port = parts[4] * 256 + parts[5];
    session.activePort = { host, port };
    session.socket.write('200 PORT command successful.\r\n');
  }

  _getDataSocket(session) {
    return new Promise((resolve, reject) => {
      if (session.pasvSocket) {
        const sock = session.pasvSocket;
        session.pasvSocket = null;
        resolve(sock);
        return;
      }

      if (session.pasvServer) {
        session.pasvSocketResolver = resolve;
        return;
      }

      if (session.activePort) {
        const { host, port } = session.activePort;
        session.activePort = null;
        const sock = net.connect({ host, port }, () => {
          resolve(sock);
        });
        sock.on('error', reject);
        return;
      }

      reject(new Error('Use PORT or PASV first.'));
    });
  }

  async _handleList(session, arg, namesOnly = false) {
    const resolved = this._resolvePath(session, arg);
    if (!resolved || !fs.existsSync(resolved.abs)) {
      session.socket.write('550 Directory not found.\r\n');
      return;
    }

    let dataSock;
    try {
      session.socket.write('150 Here comes the directory listing.\r\n');
      dataSock = await this._getDataSocket(session);
    } catch (err) {
      session.socket.write(`425 Can't open data connection: ${err.message}\r\n`);
      return;
    }

    try {
      const entries = fs.readdirSync(resolved.abs);
      let output = '';

      for (const entry of entries) {
        const full = path.join(resolved.abs, entry);
        if (namesOnly) {
          output += `${entry}\r\n`;
        } else {
          try {
            const stat = fs.statSync(full);
            const isDir = stat.isDirectory();
            const perm = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
            const size = stat.size;
            const dateStr = stat.mtime.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) + ' ' +
              stat.mtime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
            output += `${perm}   1 ftp      ftp  ${String(size).padStart(12, ' ')} ${dateStr} ${entry}\r\n`;
          } catch (e) {}
        }
      }

      dataSock.write(output, () => {
        dataSock.end();
        session.socket.write('226 Directory send OK.\r\n');
      });
    } catch (err) {
      dataSock.destroy();
      session.socket.write(`550 Failed to read directory: ${err.message}\r\n`);
    }
  }

  async _handleMlsd(session, arg) {
    const resolved = this._resolvePath(session, arg);
    if (!resolved || !fs.existsSync(resolved.abs)) {
      session.socket.write('550 Directory not found.\r\n');
      return;
    }

    let dataSock;
    try {
      session.socket.write('150 Opening data connection for MLSD.\r\n');
      dataSock = await this._getDataSocket(session);
    } catch (err) {
      session.socket.write(`425 Can't open data connection: ${err.message}\r\n`);
      return;
    }

    try {
      const entries = fs.readdirSync(resolved.abs);
      let output = '';

      for (const entry of entries) {
        const full = path.join(resolved.abs, entry);
        try {
          const stat = fs.statSync(full);
          const type = stat.isDirectory() ? 'dir' : 'file';
          const modify = stat.mtime.toISOString().replace(/[-:T]/g, '').slice(0, 14);
          output += `type=${type};size=${stat.size};modify=${modify}; ${entry}\r\n`;
        } catch (e) {}
      }

      dataSock.write(output, () => {
        dataSock.end();
        session.socket.write('226 Transfer complete.\r\n');
      });
    } catch (err) {
      dataSock.destroy();
      session.socket.write(`550 Failed MLSD: ${err.message}\r\n`);
    }
  }

  async _handleRetr(session, filename) {
    const resolved = this._resolvePath(session, filename);
    if (!resolved || !fs.existsSync(resolved.abs)) {
      session.socket.write('550 File not found.\r\n');
      return;
    }

    let dataSock;
    try {
      session.socket.write('150 Opening binary mode data connection.\r\n');
      dataSock = await this._getDataSocket(session);
    } catch (err) {
      session.socket.write(`425 Can't open data connection: ${err.message}\r\n`);
      return;
    }

    const readStream = fs.createReadStream(resolved.abs);
    const startTime = Date.now();
    let bytesRead = 0;

    readStream.on('data', (chunk) => {
      bytesRead += chunk.length;
    });

    readStream.pipe(dataSock);

    readStream.on('end', () => {
      const elapsedSec = Math.max(0, Math.round((Date.now() - startTime) / 1000));
      const wfs = getWebalizerFtpService();
      if (wfs) {
        wfs.logTransfer({
          cpanelUser: (session.account && session.account.cpanelUser) || 'cpanel_user',
          username: session.user || 'anonymous',
          remoteHost: session.socket.remoteAddress,
          bytes: bytesRead,
          filename: resolved.virt || filename,
          direction: 'o', // outgoing / download
          transferType: (session.transferType || 'I').toUpperCase() === 'A' ? 'a' : 'b',
          transferTime: elapsedSec,
          completionStatus: 'c'
        });
      }
      session.socket.write('226 Transfer complete.\r\n');
    });

    readStream.on('error', (err) => {
      dataSock.destroy();
      const wfs = getWebalizerFtpService();
      if (wfs) {
        wfs.logTransfer({
          cpanelUser: (session.account && session.account.cpanelUser) || 'cpanel_user',
          username: session.user || 'anonymous',
          remoteHost: session.socket.remoteAddress,
          bytes: bytesRead,
          filename: resolved.virt || filename,
          direction: 'o',
          transferType: (session.transferType || 'I').toUpperCase() === 'A' ? 'a' : 'b',
          transferTime: 0,
          completionStatus: 'i'
        });
      }
      session.socket.write(`451 Local error in processing: ${err.message}\r\n`);
    });
  }

  async _handleStor(session, filename) {
    const resolved = this._resolvePath(session, filename);
    if (!resolved) {
      session.socket.write('550 Access denied: invalid filename.\r\n');
      return;
    }

    // Ensure parent directory exists
    const parent = path.dirname(resolved.abs);
    if (!fs.existsSync(parent)) {
      try {
        fs.mkdirSync(parent, { recursive: true });
      } catch (e) {
        session.socket.write('550 Failed to create parent directory.\r\n');
        return;
      }
    }

    // Quota check if finite quota is configured
    if (this.accountsProvider && session.account) {
      const quotaCheck = this.accountsProvider.checkQuotaAvailable(session.account);
      if (!quotaCheck.allowed) {
        session.socket.write(`552 Quota exceeded: ${quotaCheck.message}\r\n`);
        return;
      }
    }

    let dataSock;
    try {
      session.socket.write('150 Ok to send data.\r\n');
      dataSock = await this._getDataSocket(session);
    } catch (err) {
      session.socket.write(`425 Can't open data connection: ${err.message}\r\n`);
      return;
    }

    const writeStream = fs.createWriteStream(resolved.abs);
    const startTime = Date.now();
    let bytesWritten = 0;

    dataSock.on('data', (chunk) => {
      bytesWritten += chunk.length;
    });

    dataSock.pipe(writeStream);

    writeStream.on('finish', () => {
      const elapsedSec = Math.max(0, Math.round((Date.now() - startTime) / 1000));
      const wfs = getWebalizerFtpService();
      if (wfs) {
        wfs.logTransfer({
          cpanelUser: (session.account && session.account.cpanelUser) || 'cpanel_user',
          username: session.user || 'anonymous',
          remoteHost: session.socket.remoteAddress,
          bytes: bytesWritten,
          filename: resolved.virt || filename,
          direction: 'i', // incoming / upload
          transferType: (session.transferType || 'I').toUpperCase() === 'A' ? 'a' : 'b',
          transferTime: elapsedSec,
          completionStatus: 'c'
        });
      }
      session.socket.write('226 Transfer complete.\r\n');
    });

    writeStream.on('error', (err) => {
      const wfs = getWebalizerFtpService();
      if (wfs) {
        wfs.logTransfer({
          cpanelUser: (session.account && session.account.cpanelUser) || 'cpanel_user',
          username: session.user || 'anonymous',
          remoteHost: session.socket.remoteAddress,
          bytes: bytesWritten,
          filename: resolved.virt || filename,
          direction: 'i',
          transferType: (session.transferType || 'I').toUpperCase() === 'A' ? 'a' : 'b',
          transferTime: 0,
          completionStatus: 'i'
        });
      }
      session.socket.write(`451 Write error: ${err.message}\r\n`);
    });
  }

  _handleDele(session, filename) {
    const resolved = this._resolvePath(session, filename);
    if (!resolved || !fs.existsSync(resolved.abs)) {
      session.socket.write('550 File not found.\r\n');
      return;
    }

    try {
      const stat = fs.statSync(resolved.abs);
      if (stat.isDirectory()) {
        session.socket.write('550 Cannot delete directory with DELE. Use RMD.\r\n');
        return;
      }
      fs.unlinkSync(resolved.abs);
      session.socket.write('250 File deleted successfully.\r\n');
    } catch (err) {
      session.socket.write(`550 Delete failed: ${err.message}\r\n`);
    }
  }

  _handleMkd(session, dirname) {
    const resolved = this._resolvePath(session, dirname);
    if (!resolved) {
      session.socket.write('550 Access denied: invalid directory name.\r\n');
      return;
    }

    if (fs.existsSync(resolved.abs)) {
      session.socket.write('550 Directory already exists.\r\n');
      return;
    }

    try {
      fs.mkdirSync(resolved.abs, { recursive: true });
      session.socket.write(`257 "${resolved.virt}" created.\r\n`);
    } catch (err) {
      session.socket.write(`550 Failed to create directory: ${err.message}\r\n`);
    }
  }

  _handleRmd(session, dirname) {
    const resolved = this._resolvePath(session, dirname);
    if (!resolved || !fs.existsSync(resolved.abs)) {
      session.socket.write('550 Directory not found.\r\n');
      return;
    }

    // Prevent deleting root chroot
    if (resolved.abs === path.resolve(session.accountBaseDir)) {
      session.socket.write('550 Cannot remove root directory.\r\n');
      return;
    }

    try {
      fs.rmSync(resolved.abs, { recursive: true, force: true });
      session.socket.write('250 Directory removed successfully.\r\n');
    } catch (err) {
      session.socket.write(`550 Failed to remove directory: ${err.message}\r\n`);
    }
  }

  _handleRnfr(session, filename) {
    const resolved = this._resolvePath(session, filename);
    if (!resolved || !fs.existsSync(resolved.abs)) {
      session.socket.write('550 File not found.\r\n');
      return;
    }

    session.renameFrom = resolved.abs;
    session.socket.write('350 File exists, ready for destination name (RNTO).\r\n');
  }

  _handleRnto(session, filename) {
    if (!session.renameFrom) {
      session.socket.write('503 Bad sequence of commands: RNFR required before RNTO.\r\n');
      return;
    }

    const resolved = this._resolvePath(session, filename);
    if (!resolved) {
      session.socket.write('550 Access denied: invalid destination name.\r\n');
      session.renameFrom = null;
      return;
    }

    try {
      fs.renameSync(session.renameFrom, resolved.abs);
      session.renameFrom = null;
      session.socket.write('250 Rename successful.\r\n');
    } catch (err) {
      session.renameFrom = null;
      session.socket.write(`550 Rename failed: ${err.message}\r\n`);
    }
  }

  _handleSize(session, filename) {
    const resolved = this._resolvePath(session, filename);
    if (!resolved || !fs.existsSync(resolved.abs)) {
      session.socket.write('550 File not found.\r\n');
      return;
    }

    try {
      const stat = fs.statSync(resolved.abs);
      session.socket.write(`213 ${stat.size}\r\n`);
    } catch (err) {
      session.socket.write(`550 Error reading size: ${err.message}\r\n`);
    }
  }

  _handleMdtm(session, filename) {
    const resolved = this._resolvePath(session, filename);
    if (!resolved || !fs.existsSync(resolved.abs)) {
      session.socket.write('550 File not found.\r\n');
      return;
    }

    try {
      const stat = fs.statSync(resolved.abs);
      const mtime = stat.mtime.toISOString().replace(/[-:T]/g, '').slice(0, 14);
      session.socket.write(`213 ${mtime}\r\n`);
    } catch (err) {
      session.socket.write(`550 Error reading MDTM: ${err.message}\r\n`);
    }
  }
}

module.exports = new FtpServerService();
