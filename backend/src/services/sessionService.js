const fs = require('fs');
const path = require('path');

const SESSIONS_FILE = path.resolve(__dirname, '../../data/active_sessions.json');

const crypto = require('crypto');

class SessionService {
  constructor() {
    this.sessions = new Map();
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
        const now = Date.now();
        for (const [token, sess] of Object.entries(data)) {
          if (sess.expiresAt > now) {
            this.sessions.set(token, sess);
          }
        }
      }
    } catch (e) {
      this.sessions = new Map();
    }
  }

  _save() {
    try {
      const dir = path.dirname(SESSIONS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj = {};
      const now = Date.now();
      for (const [token, sess] of this.sessions.entries()) {
        if (sess.expiresAt > now) {
          obj[token] = sess;
        }
      }
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {}
  }

  createSession(user, service = 'cpaneld', extra = {}, baseUrl = null, ip = '127.0.0.1', userAgent = '') {
    const prefix = service === 'webmail' ? 'wmsess_' : service === 'phpmyadmin' ? 'pmasess_' : 'cpsess_';
    // 256-bit cryptographically secure session token
    const token = prefix + crypto.randomBytes(24).toString('hex');
    const ttlSeconds = 86400; // 24 hours
    const expiresAt = Date.now() + (ttlSeconds * 1000);

    const sessionData = {
      token,
      user,
      service,
      ip,
      userAgent: (userAgent || '').substring(0, 150),
      createdAt: Date.now(),
      expiresAt,
      extra
    };

    this.sessions.set(token, sessionData);
    this._save();

    const hostBase = baseUrl || process.env.CPANEL_BASE_URL || 'http://localhost:5000';
    let redirectUrl = `${hostBase.replace(/\/$/, '')}/?session=${token}&user=${encodeURIComponent(user)}`;
    if (service === 'webmail' && extra.email) {
      redirectUrl += `&jump=webmail&email=${encodeURIComponent(extra.email)}`;
    } else if (service === 'phpmyadmin') {
      redirectUrl += `&jump=phpmyadmin${extra.db ? `&db=${encodeURIComponent(extra.db)}` : ''}`;
    }

    return {
      token,
      user,
      service,
      redirectUrl,
      expires: Math.floor(expiresAt / 1000)
    };
  }

  validateSession(token, user = null) {
    if (!token) return { valid: false, reason: 'No token provided' };
    const sess = this.sessions.get(token);
    if (!sess) return { valid: false, reason: 'Invalid or expired session token' };
    if (Date.now() > sess.expiresAt) {
      this.sessions.delete(token);
      this._save();
      return { valid: false, reason: 'Session token has expired' };
    }
    if (user && sess.user !== user) {
      return { valid: false, reason: 'Session user mismatch' };
    }
    return {
      valid: true,
      user: sess.user,
      service: sess.service,
      extra: sess.extra,
      expires: Math.floor(sess.expiresAt / 1000)
    };
  }

  revokeSession(token) {
    const deleted = this.sessions.delete(token);
    if (deleted) this._save();
    return deleted;
  }
}

module.exports = new SessionService();
