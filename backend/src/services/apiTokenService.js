const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TOKENS_DATA_FILE = path.resolve(__dirname, '../../data/api_tokens.json');
const AUDIT_LOG_FILE = path.resolve(__dirname, '../../data/api_tokens_audit.log');
const MAX_TOKENS_PER_USER = 30;

// Defined authentic scopes backed by real features in the hosting panel
const AVAILABLE_SCOPES = [
  { id: 'full_access', name: 'Full Account Access', desc: 'Unrestricted administration for all authorized account features', category: 'Administrative' },
  { id: 'file_manager:read', name: 'File Manager (Read)', desc: 'View, read, and list files in document root and directories', category: 'Files' },
  { id: 'file_manager:write', name: 'File Manager (Write)', desc: 'Upload, edit, move, extract, and delete files', category: 'Files' },
  { id: 'database:manage', name: 'Databases', desc: 'Create and manage MySQL databases, users, and remote access hosts', category: 'Databases' },
  { id: 'domains:manage', name: 'Domains & Subdomains', desc: 'Create, modify, and configure addon domains, subdomains, and redirects', category: 'Domains' },
  { id: 'dns:manage', name: 'Zone Editor (DNS)', desc: 'Add, edit, and delete DNS zone records (A, CNAME, MX, TXT)', category: 'Domains' },
  { id: 'ssl:manage', name: 'SSL / TLS Certificates', desc: 'Install, renew, and inspect X.509 SSL certificates and AutoSSL', category: 'Security' },
  { id: 'backup:manage', name: 'Backups', desc: 'Generate, download, and manage cPanel account backups and archives', category: 'Backups' },
  { id: 'email:manage', name: 'Email Accounts', desc: 'Create and manage POP3/IMAP email accounts, forwarders, and quotas', category: 'Email' },
  { id: 'metrics:read', name: 'Metrics & Analytics', desc: 'Access Visitors, Bandwidth, Awstats, and Resource Usage metrics', category: 'Metrics' }
];

function ensureStore() {
  const dir = path.dirname(TOKENS_DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(TOKENS_DATA_FILE)) {
    fs.writeFileSync(TOKENS_DATA_FILE, JSON.stringify({ tokens: [] }, null, 2), 'utf8');
  }
}

class ApiTokenService {
  constructor() {
    ensureStore();
  }

  _read() {
    ensureStore();
    try {
      return JSON.parse(fs.readFileSync(TOKENS_DATA_FILE, 'utf8'));
    } catch (e) {
      return { tokens: [] };
    }
  }

  _write(data) {
    const tmp = TOKENS_DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, TOKENS_DATA_FILE);
  }

  _log(action, details) {
    try {
      const entry = `[${new Date().toISOString()}] [ACTION: ${action}] ${JSON.stringify(details)}\n`;
      fs.appendFileSync(AUDIT_LOG_FILE, entry, 'utf8');
    } catch (e) {}
  }

  getAvailableScopes() {
    return AVAILABLE_SCOPES;
  }

  // Hash token using SHA-256 (one-way, deterministic lookup)
  hashToken(rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  // List tokens for authenticated user (returns only safe metadata, NEVER raw token or hash)
  listTokens(username = 'cpanel_user') {
    const data = this._read();
    const now = new Date();

    return data.tokens
      .filter(t => t.user === username)
      .map(t => {
        let status = t.status || 'Active';
        if (status === 'Active' && t.expiresAt && new Date(t.expiresAt) < now) {
          status = 'Expired';
        }
        return {
          id: t.id,
          name: t.name,
          prefix: t.prefix,
          scopes: t.scopes || ['full_access'],
          createdAt: t.createdAt,
          expiresAt: t.expiresAt || null,
          lastUsedAt: t.lastUsedAt || null,
          revokedAt: t.revokedAt || null,
          status
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // Create new token
  createToken({ username = 'cpanel_user', name, scopes = [], expiresDays = null }) {
    if (!name || typeof name !== 'string') {
      throw new Error('Token name is required.');
    }
    const cleanName = name.trim();
    if (cleanName.length === 0 || cleanName.length > 80) {
      throw new Error('Token name must be between 1 and 80 characters.');
    }
    if (/[\r\n\t<>]/.test(cleanName)) {
      throw new Error('Token name contains invalid characters.');
    }

    const data = this._read();
    const userTokens = data.tokens.filter(t => t.user === username && t.status === 'Active');
    if (userTokens.length >= MAX_TOKENS_PER_USER) {
      throw new Error(`API token limit reached. Maximum ${MAX_TOKENS_PER_USER} active tokens allowed per account.`);
    }

    // Validate scopes
    const validScopeIds = new Set(AVAILABLE_SCOPES.map(s => s.id));
    let assignedScopes = [];
    if (Array.isArray(scopes) && scopes.length > 0) {
      assignedScopes = scopes.filter(s => validScopeIds.has(s));
    }
    if (assignedScopes.length === 0) {
      assignedScopes = ['full_access'];
    }

    // Calculate expiration
    let expiresAt = null;
    if (expiresDays !== null && expiresDays !== undefined && expiresDays !== 'never') {
      const days = Number(expiresDays);
      if (!isNaN(days) && days > 0) {
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + days);
        expiresAt = expDate.toISOString();
      }
    }

    // Generate cryptographically secure raw token: cpt_ + 64 hex characters (32 random bytes)
    const randomHex = crypto.randomBytes(32).toString('hex');
    const rawToken = `cpt_${randomHex}`;
    const prefix = `cpt_${randomHex.slice(0, 6)}••••••••`;
    const tokenHash = this.hashToken(rawToken);
    const tokenId = `tok_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const createdAt = new Date().toISOString();

    const record = {
      id: tokenId,
      user: username,
      name: cleanName,
      prefix,
      hash: tokenHash,
      scopes: assignedScopes,
      createdAt,
      expiresAt,
      lastUsedAt: null,
      revokedAt: null,
      status: 'Active'
    };

    data.tokens.push(record);
    this._write(data);

    this._log('CREATE', {
      username,
      tokenId,
      name: cleanName,
      prefix,
      scopes: assignedScopes,
      expiresAt
    });

    // Return the raw token ONLY once upon creation
    return {
      success: true,
      rawToken,
      token: {
        id: tokenId,
        name: cleanName,
        prefix,
        scopes: assignedScopes,
        createdAt,
        expiresAt,
        status: 'Active'
      },
      message: 'API token successfully generated. Store this token securely; it will not be displayed again.'
    };
  }

  // Revoke token
  revokeToken({ username = 'cpanel_user', tokenId }) {
    if (!tokenId) throw new Error('Token ID is required.');
    const data = this._read();
    const token = data.tokens.find(t => t.id === tokenId);

    if (!token) {
      throw new Error('API token not found.');
    }

    // Account isolation enforcement
    if (token.user !== username) {
      throw new Error('Access denied: You do not have permission to revoke this token.');
    }

    if (token.status === 'Revoked') {
      return { success: true, message: 'Token is already revoked.', tokenId };
    }

    token.status = 'Revoked';
    token.revokedAt = new Date().toISOString();
    this._write(data);

    this._log('REVOKE', {
      username,
      tokenId,
      name: token.name,
      prefix: token.prefix
    });

    return {
      success: true,
      message: `API token "${token.name}" has been revoked immediately.`,
      tokenId
    };
  }

  // Authenticate incoming API request using raw token and required scope
  authenticateToken(rawToken, requiredScope = null) {
    if (!rawToken || typeof rawToken !== 'string') {
      return { authenticated: false, error: 'Missing or malformed token.' };
    }

    const cleanToken = rawToken.trim().replace(/^Bearer\s+/i, '');
    if (!cleanToken.startsWith('cpt_') || cleanToken.length < 32) {
      return { authenticated: false, error: 'Invalid token format.' };
    }

    const tokenHash = this.hashToken(cleanToken);
    const data = this._read();
    const token = data.tokens.find(t => t.hash === tokenHash);

    if (!token) {
      this._log('AUTH_FAIL', { reason: 'Token not found or invalid hash', prefix: cleanToken.slice(0, 10) });
      return { authenticated: false, error: 'Invalid API token.' };
    }

    // Check revocation
    if (token.status === 'Revoked') {
      this._log('AUTH_FAIL', { reason: 'Token revoked', tokenId: token.id, username: token.user });
      return { authenticated: false, error: 'API token has been revoked.' };
    }

    // Check expiration
    if (token.expiresAt) {
      const exp = new Date(token.expiresAt);
      if (exp < new Date()) {
        token.status = 'Expired';
        this._write(data);
        this._log('AUTH_FAIL', { reason: 'Token expired', tokenId: token.id, username: token.user });
        return { authenticated: false, error: 'API token has expired.' };
      }
    }

    // Check scope if required
    if (requiredScope) {
      const hasFullAccess = token.scopes && token.scopes.includes('full_access');
      const hasScope = token.scopes && token.scopes.includes(requiredScope);
      if (!hasFullAccess && !hasScope) {
        this._log('AUTH_FAIL', { reason: 'Insufficient scope', tokenId: token.id, username: token.user, requiredScope, tokenScopes: token.scopes });
        return { authenticated: false, forbidden: true, error: `Forbidden: API token lacks required scope "${requiredScope}".` };
      }
    }

    // Update lastUsedAt (throttled to once every 2 minutes per token)
    const now = Date.now();
    const lastUsedTime = token.lastUsedAt ? new Date(token.lastUsedAt).getTime() : 0;
    if (now - lastUsedTime > 120000) {
      token.lastUsedAt = new Date(now).toISOString();
      this._write(data);
    }

    this._log('AUTH_SUCCESS', {
      username: token.user,
      tokenId: token.id,
      name: token.name,
      scopeChecked: requiredScope || 'none'
    });

    return {
      authenticated: true,
      user: token.user,
      tokenId: token.id,
      tokenName: token.name,
      prefix: token.prefix,
      scopes: token.scopes
    };
  }
}

module.exports = new ApiTokenService();
