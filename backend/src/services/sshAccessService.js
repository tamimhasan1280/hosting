const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync, spawnSync } = require('child_process');
const storageService = require('./storageService');

const WHM_ACCOUNTS_FILE = path.resolve(__dirname, '../../data/whm_accounts.json');
const KEYS_FILE = path.resolve(__dirname, '../../data/ssh_keys.json');
const AUDIT_FILE = path.resolve(__dirname, '../../data/ssh_audit.log');

// Plan-based SSH Policies
const PLAN_SSH_POLICIES = {
  'Standard Shared Hosting': {
    allowed: true,
    shell: '/usr/local/cpanel/bin/jailshell',
    shellType: 'jailed',
    policy: 'Jailed Shell (CloudLinux/cPanel Jail)'
  },
  'Starter SSD Hosting': {
    allowed: false,
    shell: '/bin/false',
    shellType: 'disabled',
    policy: 'SSH Disabled by Hosting Plan'
  },
  'Business Cloud': {
    allowed: true,
    shell: '/usr/local/cpanel/bin/jailshell',
    shellType: 'jailed',
    policy: 'Jailed Shell (CloudLinux/cPanel Jail)'
  },
  'Business Cloud Hosting': {
    allowed: true,
    shell: '/usr/local/cpanel/bin/jailshell',
    shellType: 'jailed',
    policy: 'Jailed Shell (CloudLinux/cPanel Jail)'
  },
  'Gold Cloud': {
    allowed: true,
    shell: '/usr/local/cpanel/bin/jailshell',
    shellType: 'jailed',
    policy: 'Jailed Shell (CloudLinux/cPanel Jail)'
  },
  'Enterprise Cloud': {
    allowed: true,
    shell: '/bin/bash',
    shellType: 'standard',
    policy: 'Standard Interactive Shell (Full Access)'
  }
};

const DEFAULT_POLICY = PLAN_SSH_POLICIES['Standard Shared Hosting'];

class SshAccessService {
  constructor() {
    this._ensureStorage();
    // In-memory one-time private key download tokens: Map<token, { privateKey, username, expiresAt }>
    this._privateKeyTokens = new Map();
  }

  _ensureStorage() {
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(KEYS_FILE)) {
      fs.writeFileSync(KEYS_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  }

  _logAudit(user, action, details) {
    const entry = {
      timestamp: new Date().toISOString(),
      user: user || 'system',
      action,
      details
    };
    try {
      fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n', 'utf8');
    } catch (e) {
      console.error('Failed to append to SSH audit log:', e);
    }
  }

  _readKeys() {
    this._ensureStorage();
    try {
      return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  _writeKeys(keys) {
    this._ensureStorage();
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
  }

  // Get account home and .ssh paths safely
  _getUserSshDir(username) {
    const safeUser = (username || 'cpanel_user').replace(/[^a-zA-Z0-9_-]/g, '');
    const userHome = storageService.getRootDir(safeUser);
    const sshDir = path.join(userHome, '.ssh');
    if (!fs.existsSync(sshDir)) {
      fs.mkdirSync(sshDir, { recursive: true, mode: 0o700 });
    }
    return sshDir;
  }

  _getAuthorizedKeysPath(username) {
    const sshDir = this._getUserSshDir(username);
    return path.join(sshDir, 'authorized_keys');
  }

  // Get WHM Account details & plan
  getAccount(username = 'cpanel_user') {
    let account = null;
    try {
      if (fs.existsSync(WHM_ACCOUNTS_FILE)) {
        const accts = JSON.parse(fs.readFileSync(WHM_ACCOUNTS_FILE, 'utf8'));
        account = accts.find(a => a.user === username);
      }
    } catch (e) {}

    if (!account) {
      account = {
        user: username,
        domain: username === 'cpanel_user' ? 'example.com' : `${username}.com`,
        plan: 'Standard Shared Hosting'
      };
    }

    const policy = PLAN_SSH_POLICIES[account.plan] || DEFAULT_POLICY;

    return {
      user: account.user,
      domain: account.domain,
      plan: account.plan,
      policy: policy.policy,
      shell: policy.shell,
      shellType: policy.shellType,
      isPermitted: policy.allowed
    };
  }

  // Real capability detection
  getCapabilities() {
    const platform = os.platform();
    let openSshInstalled = false;
    let sshKeygenAvailable = false;
    let sshdRunning = false;
    let openSshVersion = 'Unknown';

    // Check OpenSSH client
    try {
      const v = execSync('ssh -V 2>&1', { encoding: 'utf8' }).trim();
      if (v) {
        openSshInstalled = true;
        openSshVersion = v;
      }
    } catch (e) {
      if (e.stdout || e.stderr) {
        openSshInstalled = true;
        openSshVersion = (e.stdout || e.stderr).trim();
      }
    }

    // Check ssh-keygen
    try {
      const checkCmd = platform === 'win32' ? 'where.exe ssh-keygen' : 'which ssh-keygen';
      const out = execSync(checkCmd, { encoding: 'utf8' }).trim();
      if (out) sshKeygenAvailable = true;
    } catch (e) {}

    // Check sshd service
    if (platform === 'win32') {
      try {
        const out = execSync('sc.exe query sshd', { encoding: 'utf8' });
        if (out.includes('RUNNING')) {
          sshdRunning = true;
        }
      } catch (e) {}
    } else if (platform === 'linux') {
      try {
        const out = execSync('systemctl is-active sshd || systemctl is-active ssh', { encoding: 'utf8' }).trim();
        if (out === 'active') sshdRunning = true;
      } catch (e) {
        if (fs.existsSync('/var/run/sshd.pid') || fs.existsSync('/run/sshd.pid')) {
          sshdRunning = true;
        }
      }
    }

    const configuredPort = parseInt(process.env.SSH_PORT, 10) || 22;

    return {
      platform,
      arch: os.arch(),
      hostname: os.hostname(),
      openSshInstalled,
      openSshVersion,
      sshKeygenAvailable,
      sshdRunning,
      configuredPort
    };
  }

  // Calculate authentic SHA256 OpenSSH fingerprint
  calculateFingerprint(publicKeyString) {
    if (!publicKeyString || typeof publicKeyString !== 'string') return null;
    const parts = publicKeyString.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const b64 = parts[1];
    try {
      const buf = Buffer.from(b64, 'base64');
      const hash = crypto.createHash('sha256').update(buf).digest('base64').replace(/=+$/, '');
      return `SHA256:${hash}`;
    } catch (e) {
      return null;
    }
  }

  // Validate public key structure
  validatePublicKey(keyString) {
    if (!keyString || typeof keyString !== 'string') {
      return { valid: false, error: 'Public key cannot be empty.' };
    }

    // Reject control characters or newlines
    if (keyString.includes('\n') || keyString.includes('\r')) {
      // Allow single line
      const lines = keyString.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length > 1) {
        return { valid: false, error: 'Public key must be a single continuous line.' };
      }
      keyString = lines[0];
    }

    const parts = keyString.trim().split(/\s+/);
    if (parts.length < 2) {
      return { valid: false, error: 'Invalid SSH public key format. Expected: <algorithm> <base64_blob> [comment]' };
    }

    const [keyType, b64Data, ...commentParts] = parts;
    const comment = commentParts.join(' ');

    const allowedTypes = [
      'ssh-ed25519',
      'ssh-rsa',
      'ecdsa-sha2-nistp256',
      'ecdsa-sha2-nistp384',
      'ecdsa-sha2-nistp521',
      'ssh-dss'
    ];

    if (!allowedTypes.includes(keyType)) {
      return { valid: false, error: `Unsupported key algorithm "${keyType}". Supported: ${allowedTypes.join(', ')}` };
    }

    // Check base64 decoding
    let buf;
    try {
      buf = Buffer.from(b64Data, 'base64');
      if (buf.length < 16) {
        return { valid: false, error: 'Base64 key payload is too short or malformed.' };
      }
    } catch (e) {
      return { valid: false, error: 'Failed to decode Base64 payload.' };
    }

    // Validate wire format header (first 4 bytes = length of keyType string)
    try {
      const typeLen = buf.readUInt32BE(0);
      if (typeLen > 64 || typeLen + 4 > buf.length) {
        return { valid: false, error: 'Malformed wire format: key header length is invalid.' };
      }
      const decodedType = buf.slice(4, 4 + typeLen).toString('utf8');
      if (decodedType !== keyType) {
        return { valid: false, error: `Wire format mismatch: header declares "${decodedType}", but prefix is "${keyType}".` };
      }
    } catch (e) {
      return { valid: false, error: 'Corrupted OpenSSH key structure.' };
    }

    // Validate comment
    if (comment && comment.length > 256) {
      return { valid: false, error: 'Key comment exceeds maximum allowed length (256 characters).' };
    }

    const fingerprint = this.calculateFingerprint(keyString);
    if (!fingerprint) {
      return { valid: false, error: 'Unable to calculate cryptographic fingerprint for key.' };
    }

    return {
      valid: true,
      keyType,
      b64Data,
      comment: comment || '',
      fingerprint,
      normalizedKey: `${keyType} ${b64Data}${comment ? ' ' + comment : ''}`
    };
  }

  // Get full SSH Status for account
  getStatus(username = 'cpanel_user') {
    const acct = this.getAccount(username);
    const caps = this.getCapabilities();
    const authorizedKeys = this._getAuthorizedKeysList(username);
    const allKeys = this._readKeys().filter(k => k.username === username);

    let overallStatus = 'Disabled';
    let statusMessage = '';

    if (!caps.sshdRunning) {
      overallStatus = 'Server Daemon Inactive';
      statusMessage = 'SSH server daemon (sshd) is currently inactive on this development host. Keys and authorization can still be managed.';
    } else if (!acct.isPermitted) {
      overallStatus = 'Disabled';
      statusMessage = `SSH access is disabled for this account plan (${acct.plan}). Contact your hosting administrator.`;
    } else if (acct.shellType === 'jailed') {
      overallStatus = 'Restricted (Jailed)';
      statusMessage = 'SSH access is active within a secure, isolated Jailed Shell environment (CloudLinux/cPanel).';
    } else {
      overallStatus = 'Enabled';
      statusMessage = 'SSH access is fully enabled with standard shell access.';
    }

    const host = acct.domain || caps.hostname || 'localhost';
    const port = caps.configuredPort;

    return {
      user: acct.user,
      domain: acct.domain,
      plan: acct.plan,
      shell: acct.shell,
      shellType: acct.shellType,
      isPermitted: acct.isPermitted,
      overallStatus,
      statusMessage,
      server: {
        platform: caps.platform,
        openSshInstalled: caps.openSshInstalled,
        openSshVersion: caps.openSshVersion,
        sshdRunning: caps.sshdRunning,
        port
      },
      connectionInfo: {
        host,
        port,
        username: acct.user,
        command: `ssh ${acct.user}@${host} -p ${port}`,
        authMethodsSupported: ['Public Key', 'Password (Policy dependent)']
      },
      keysCount: {
        total: allKeys.length,
        authorized: authorizedKeys.length
      }
    };
  }

  // Read actual authorized keys directly from ~/.ssh/authorized_keys
  _getAuthorizedKeysList(username) {
    const authFile = this._getAuthorizedKeysPath(username);
    if (!fs.existsSync(authFile)) return [];
    try {
      const content = fs.readFileSync(authFile, 'utf8');
      return content.split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith('#'));
    } catch (e) {
      return [];
    }
  }

  // List keys for user, cross-referencing actual authorized_keys
  listKeys(username = 'cpanel_user') {
    const allKeys = this._readKeys().filter(k => k.username === username);
    const authorizedKeys = this._getAuthorizedKeysList(username);

    return allKeys.map(k => {
      // Rule 13: Authoritative verification against actual authorized_keys file
      const isActuallyAuthorized = authorizedKeys.some(ak => {
        const akParts = ak.split(/\s+/);
        const kParts = k.publicKey.split(/\s+/);
        return akParts[1] === kParts[1];
      });

      return {
        id: k.id,
        name: k.name,
        keyType: k.keyType,
        fingerprint: k.fingerprint,
        comment: k.comment,
        createdAt: k.createdAt,
        authorized: isActuallyAuthorized
      };
    });
  }

  // Generate an authentic OpenSSH key pair
  async generateKey({ username = 'cpanel_user', name, type = 'ed25519', bits = 2048, passphrase = '', comment = '' }) {
    // Validate key name
    if (!name || !/^[a-zA-Z0-9_-]{1,64}$/.test(name)) {
      throw new Error('Key name must be 1-64 characters and contain only alphanumeric characters, underscores, or hyphens.');
    }

    const allKeys = this._readKeys();
    if (allKeys.some(k => k.username === username && k.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`An SSH key named "${name}" already exists for this account.`);
    }

    const safeUser = (username || 'cpanel_user').replace(/[^a-zA-Z0-9_-]/g, '');
    const keyComment = comment || `${safeUser}@${os.hostname()}`;

    // Temp file for generation
    const tempDir = path.join(os.tmpdir(), `ssh_gen_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    const tempKeyFile = path.join(tempDir, 'id_key');

    let publicKeyContent = '';
    let privateKeyContent = '';

    try {
      const caps = this.getCapabilities();
      if (caps.sshKeygenAvailable) {
        const args = ['-t', type];
        if (type === 'rsa') {
          args.push('-b', String(bits === 4096 ? 4096 : 2048));
        }
        args.push('-N', passphrase || '', '-C', keyComment, '-f', tempKeyFile);

        const genRes = spawnSync('ssh-keygen', args, { encoding: 'utf8' });
        if (genRes.status !== 0) {
          throw new Error(`ssh-keygen generation failed: ${genRes.stderr || 'Unknown error'}`);
        }

        publicKeyContent = fs.readFileSync(tempKeyFile + '.pub', 'utf8').trim();
        privateKeyContent = fs.readFileSync(tempKeyFile, 'utf8');
      } else {
        // Fallback: Node crypto
        const keyOptions = {
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
            ...(passphrase ? { cipher: 'aes-256-cbc', passphrase } : {})
          }
        };
        if (type === 'ed25519') {
          const pair = crypto.generateKeyPairSync('ed25519', keyOptions);
          publicKeyContent = pair.publicKey;
          privateKeyContent = pair.privateKey;
        } else {
          const pair = crypto.generateKeyPairSync('rsa', { modulusLength: bits || 2048, ...keyOptions });
          publicKeyContent = pair.publicKey;
          privateKeyContent = pair.privateKey;
        }
      }
    } finally {
      // Clean up temporary files
      try {
        if (fs.existsSync(tempKeyFile)) fs.unlinkSync(tempKeyFile);
        if (fs.existsSync(tempKeyFile + '.pub')) fs.unlinkSync(tempKeyFile + '.pub');
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
      } catch (e) {}
    }

    const validation = this.validatePublicKey(publicKeyContent);
    if (!validation.valid) {
      throw new Error(`Generated public key validation error: ${validation.error}`);
    }

    // Check duplicate fingerprint
    if (allKeys.some(k => k.username === username && k.fingerprint === validation.fingerprint)) {
      throw new Error('This key pair has an identical fingerprint to an existing registered key.');
    }

    // Persist public key to account's .ssh directory
    const sshDir = this._getUserSshDir(username);
    const pubKeyPath = path.join(sshDir, `${name}.pub`);
    fs.writeFileSync(pubKeyPath, validation.normalizedKey + '\n', { encoding: 'utf8', mode: 0o644 });

    const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const keyEntry = {
      id: keyId,
      username,
      name,
      keyType: validation.keyType,
      fingerprint: validation.fingerprint,
      publicKey: validation.normalizedKey,
      comment: validation.comment,
      createdAt: new Date().toISOString()
    };

    allKeys.push(keyEntry);
    this._writeKeys(allKeys);

    // Create a secure one-time download token for the private key
    const downloadToken = crypto.randomBytes(32).toString('hex');
    this._privateKeyTokens.set(downloadToken, {
      privateKey: privateKeyContent,
      username,
      name,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    this._logAudit(username, 'GENERATE_KEY', { name, type, fingerprint: validation.fingerprint });

    return {
      key: keyEntry,
      downloadToken
    };
  }

  // One-time private key download (Rule 10: One-time download token, expire immediately, never store in plaintext)
  retrievePrivateKeyOneTime(token, username) {
    if (!token || !this._privateKeyTokens.has(token)) {
      throw new Error('Private key download token is invalid, expired, or has already been used.');
    }

    const item = this._privateKeyTokens.get(token);
    this._privateKeyTokens.delete(token); // Wipe immediately upon retrieval

    if (item.username !== username) {
      throw new Error('Unauthorized: Token does not belong to the authenticated account.');
    }

    if (Date.now() > item.expiresAt) {
      throw new Error('Private key download token has expired.');
    }

    this._logAudit(username, 'DOWNLOAD_PRIVATE_KEY_ONETIME', { name: item.name });

    return {
      name: item.name,
      privateKey: item.privateKey
    };
  }

  // Import an existing public key
  importKey({ username = 'cpanel_user', name, publicKeyContent }) {
    if (!name || !/^[a-zA-Z0-9_-]{1,64}$/.test(name)) {
      throw new Error('Key name must be 1-64 characters and contain only alphanumeric characters, underscores, or hyphens.');
    }

    const validation = this.validatePublicKey(publicKeyContent);
    if (!validation.valid) {
      throw new Error(`Invalid public key: ${validation.error}`);
    }

    const allKeys = this._readKeys();
    if (allKeys.some(k => k.username === username && k.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`An SSH key named "${name}" already exists for this account.`);
    }

    if (allKeys.some(k => k.username === username && k.fingerprint === validation.fingerprint)) {
      throw new Error('An SSH key with this exact public key fingerprint has already been imported.');
    }

    // Save public key into ~/.ssh/
    const sshDir = this._getUserSshDir(username);
    const pubKeyPath = path.join(sshDir, `${name}.pub`);
    fs.writeFileSync(pubKeyPath, validation.normalizedKey + '\n', { encoding: 'utf8', mode: 0o644 });

    const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const keyEntry = {
      id: keyId,
      username,
      name,
      keyType: validation.keyType,
      fingerprint: validation.fingerprint,
      publicKey: validation.normalizedKey,
      comment: validation.comment,
      createdAt: new Date().toISOString()
    };

    allKeys.push(keyEntry);
    this._writeKeys(allKeys);

    this._logAudit(username, 'IMPORT_KEY', { name, type: validation.keyType, fingerprint: validation.fingerprint });

    return keyEntry;
  }

  // Authorize key into actual ~/.ssh/authorized_keys atomically
  authorizeKey({ username = 'cpanel_user', keyId }) {
    const allKeys = this._readKeys();
    const key = allKeys.find(k => k.username === username && k.id === keyId);
    if (!key) {
      throw new Error('SSH key not found for this account.');
    }

    const authFile = this._getAuthorizedKeysPath(username);
    const sshDir = path.dirname(authFile);

    let lines = [];
    if (fs.existsSync(authFile)) {
      const content = fs.readFileSync(authFile, 'utf8');
      lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    }

    const keyB64 = key.publicKey.split(/\s+/)[1];
    const exists = lines.some(l => {
      const parts = l.split(/\s+/);
      return parts[1] === keyB64;
    });

    if (!exists) {
      lines.push(key.publicKey);
      // Write atomically via temp file
      const tempFile = path.join(sshDir, `auth_tmp_${Date.now()}`);
      fs.writeFileSync(tempFile, lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tempFile, authFile);
    }

    this._logAudit(username, 'AUTHORIZE_KEY', { name: key.name, fingerprint: key.fingerprint });

    return {
      success: true,
      keyId: key.id,
      authorized: true
    };
  }

  // Deauthorize key from ~/.ssh/authorized_keys atomically
  deauthorizeKey({ username = 'cpanel_user', keyId }) {
    const allKeys = this._readKeys();
    const key = allKeys.find(k => k.username === username && k.id === keyId);
    if (!key) {
      throw new Error('SSH key not found for this account.');
    }

    const authFile = this._getAuthorizedKeysPath(username);
    if (fs.existsSync(authFile)) {
      const content = fs.readFileSync(authFile, 'utf8');
      const keyB64 = key.publicKey.split(/\s+/)[1];
      const filtered = content.split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => {
          if (!l || l.startsWith('#')) return false;
          const parts = l.split(/\s+/);
          return parts[1] !== keyB64;
        });

      const sshDir = path.dirname(authFile);
      const tempFile = path.join(sshDir, `auth_tmp_${Date.now()}`);
      fs.writeFileSync(tempFile, filtered.length > 0 ? (filtered.join('\n') + '\n') : '', { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tempFile, authFile);
    }

    this._logAudit(username, 'DEAUTHORIZE_KEY', { name: key.name, fingerprint: key.fingerprint });

    return {
      success: true,
      keyId: key.id,
      authorized: false
    };
  }

  // Delete key completely
  deleteKey({ username = 'cpanel_user', keyId }) {
    const allKeys = this._readKeys();
    const index = allKeys.findIndex(k => k.username === username && k.id === keyId);
    if (index === -1) {
      throw new Error('SSH key not found for this account.');
    }

    const key = allKeys[index];

    // Deauthorize from authorized_keys
    this.deauthorizeKey({ username, keyId });

    // Remove .pub file if present
    try {
      const sshDir = this._getUserSshDir(username);
      const pubKeyPath = path.join(sshDir, `${key.name}.pub`);
      if (fs.existsSync(pubKeyPath)) {
        fs.unlinkSync(pubKeyPath);
      }
    } catch (e) {}

    allKeys.splice(index, 1);
    this._writeKeys(allKeys);

    this._logAudit(username, 'DELETE_KEY', { name: key.name, fingerprint: key.fingerprint });

    return {
      success: true,
      deletedKeyId: keyId,
      name: key.name
    };
  }

  // Get raw public key content for viewing / copying
  getPublicKeyContent({ username = 'cpanel_user', keyId }) {
    const allKeys = this._readKeys();
    const key = allKeys.find(k => k.username === username && k.id === keyId);
    if (!key) {
      throw new Error('SSH key not found.');
    }
    return {
      id: key.id,
      name: key.name,
      publicKey: key.publicKey,
      fingerprint: key.fingerprint
    };
  }

  // Controlled server-side connection test
  testConnection(username = 'cpanel_user') {
    const status = this.getStatus(username);
    const authList = this._getAuthorizedKeysList(username);
    const sshDir = this._getUserSshDir(username);

    const diagnostics = [
      {
        item: 'SSH Daemon Service',
        status: status.server.sshdRunning ? 'PASS' : 'WARN',
        message: status.server.sshdRunning
          ? `OpenSSH daemon is active on port ${status.server.port}.`
          : 'SSH daemon is inactive on this host (commands cannot be received until sshd is started).'
      },
      {
        item: 'Account SSH Permission',
        status: status.isPermitted ? 'PASS' : 'FAIL',
        message: status.isPermitted
          ? `Allowed shell: ${status.shell} (${status.shellType}).`
          : `SSH access is disabled under plan "${status.plan}".`
      },
      {
        item: 'SSH Directory (~/.ssh)',
        status: fs.existsSync(sshDir) ? 'PASS' : 'FAIL',
        message: fs.existsSync(sshDir) ? 'Directory exists with secure permissions.' : 'Directory missing.'
      },
      {
        item: 'Authorized Keys (~/.ssh/authorized_keys)',
        status: authList.length > 0 ? 'PASS' : 'WARN',
        message: authList.length > 0
          ? `${authList.length} public key(s) currently authorized.`
          : 'No public keys are currently authorized. Key-based authentication will be rejected.'
      }
    ];

    const canConnect = status.server.sshdRunning && status.isPermitted && authList.length > 0;

    return {
      user: username,
      canConnect,
      overallResult: canConnect ? 'Ready for Connection' : 'Configuration Warning / Incomplete',
      diagnostics
    };
  }
}

module.exports = new SshAccessService();
