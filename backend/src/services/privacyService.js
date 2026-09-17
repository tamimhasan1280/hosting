const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const storageService = require('./storageService');

const MANAGED_START = '# BEGIN DIRECTORY_PRIVACY_MANAGED';
const MANAGED_END = '# END DIRECTORY_PRIVACY_MANAGED';

class PrivacyService {
  /**
   * List directories inside user account with their privacy protection status
   */
  listDirectories(username = 'cpanel_user') {
    const rootDir = storageService.getRootDir(username);
    const pubHtml = path.join(rootDir, 'public_html');
    const results = [];

    // Always include public_html
    const pubStatus = this.getDirectoryStatus('public_html', username);
    results.push({
      name: 'public_html',
      relPath: 'public_html',
      isDocumentRoot: true,
      ...pubStatus
    });

    function scan(dir, relPath = '') {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          if (e.name.startsWith('.') || e.name === 'node_modules') continue;
          const childRel = relPath ? `${relPath}/${e.name}` : e.name;
          results.push({
            name: e.name,
            relPath: childRel,
            isDocumentRoot: false
          });
          scan(path.join(dir, e.name), childRel);
        }
      }
    }

    if (fs.existsSync(pubHtml)) {
      scan(pubHtml, 'public_html');
    }

    // Attach real protection status for all discovered directories
    return results.map(dir => {
      if (dir.relPath === 'public_html') return dir;
      const status = this.getDirectoryStatus(dir.relPath, username);
      return {
        ...dir,
        ...status
      };
    });
  }

  /**
   * Get detailed privacy status and user list for a specific directory
   */
  getDirectoryStatus(relPath = 'public_html', username = 'cpanel_user') {
    const rootDir = storageService.getRootDir(username);
    const targetDir = storageService.resolveSafePath(relPath, username);

    const dirName = path.basename(targetDir) || 'Root';
    const htaccessPath = path.join(targetDir, '.htaccess');
    const htpasswdPath = path.join(rootDir, '.htpasswds', relPath, 'passwd');

    let isProtected = false;
    let authName = 'Restricted Directory';
    let hasOtherRules = false;
    let users = [];

    if (fs.existsSync(htaccessPath)) {
      const content = fs.readFileSync(htaccessPath, 'utf8');
      if (content.includes(MANAGED_START) && content.includes(MANAGED_END)) {
        isProtected = true;
        const match = content.match(/AuthName\s+["']?([^"'\r\n]+)["']?/i);
        if (match) {
          authName = match[1];
        }
      }

      // Check if there are other rules besides our managed block
      const withoutBlock = content.replace(new RegExp(`${MANAGED_START}[\\s\\S]*?${MANAGED_END}`, 'g'), '').trim();
      hasOtherRules = withoutBlock.length > 0;
    }

    if (fs.existsSync(htpasswdPath)) {
      const lines = fs.readFileSync(htpasswdPath, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes(':')) {
          const colonIdx = trimmed.indexOf(':');
          const u = trimmed.substring(0, colonIdx);
          if (u) users.push(u);
        }
      }
    }

    return {
      relPath,
      dirName,
      isProtected,
      authName,
      userCount: users.length,
      users,
      hasOtherRules
    };
  }

  /**
   * Enable or disable directory protection
   */
  setProtection({ relPath = 'public_html', enabled, authName = 'Restricted Directory', username = 'cpanel_user' }) {
    const rootDir = storageService.getRootDir(username);
    const targetDir = storageService.resolveSafePath(relPath, username);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const htaccessPath = path.join(targetDir, '.htaccess');
    const htpasswdDir = path.join(rootDir, '.htpasswds', relPath);
    const htpasswdFile = path.join(htpasswdDir, 'passwd');

    let existingContent = '';
    if (fs.existsSync(htaccessPath)) {
      existingContent = fs.readFileSync(htaccessPath, 'utf8');
    }

    // Strip previous managed block if present
    let cleanContent = existingContent.replace(
      new RegExp(`(\\r?\\n)*${MANAGED_START}[\\s\\S]*?${MANAGED_END}(\\r?\\n)*`, 'g'),
      '\n'
    ).trim();

    if (enabled) {
      if (!fs.existsSync(htpasswdDir)) {
        fs.mkdirSync(htpasswdDir, { recursive: true });
      }
      if (!fs.existsSync(htpasswdFile)) {
        fs.writeFileSync(htpasswdFile, '', { mode: 0o600, encoding: 'utf8' });
      }

      const cleanAuthName = (authName || 'Restricted Directory')
        .replace(/["'\r\n]/g, '')
        .trim();

      const normalizedPasswdPath = htpasswdFile.replace(/\\/g, '/');
      const managedBlock = `${MANAGED_START}
AuthType Basic
AuthName "${cleanAuthName}"
AuthUserFile "${normalizedPasswdPath}"
Require valid-user
${MANAGED_END}`;

      const finalContent = cleanContent ? `${cleanContent}\n\n${managedBlock}\n` : `${managedBlock}\n`;

      // Atomic write via temp file
      const tempFile = path.join(targetDir, `.tmp_ht_${crypto.randomBytes(4).toString('hex')}`);
      fs.writeFileSync(tempFile, finalContent, { mode: 0o644, encoding: 'utf8' });
      fs.renameSync(tempFile, htaccessPath);
    } else {
      // Disabling protection: remove managed block only, preserve all other rules
      if (cleanContent) {
        const tempFile = path.join(targetDir, `.tmp_ht_${crypto.randomBytes(4).toString('hex')}`);
        fs.writeFileSync(tempFile, `${cleanContent}\n`, { mode: 0o644, encoding: 'utf8' });
        fs.renameSync(tempFile, htaccessPath);
      } else {
        // If .htaccess only contained the managed block, remove it cleanly
        if (fs.existsSync(htaccessPath)) {
          fs.unlinkSync(htaccessPath);
        }
      }
    }

    return this.getDirectoryStatus(relPath, username);
  }

  /**
   * Add a new authorized user to a protected directory
   */
  addUser({ relPath = 'public_html', username: newUsername, password, cpanelUser = 'cpanel_user' }) {
    if (!newUsername || typeof newUsername !== 'string') {
      throw new Error('Username is required');
    }
    const cleanUser = newUsername.trim();
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(cleanUser)) {
      throw new Error('Username can only contain alphanumeric characters, hyphens, dots, and underscores');
    }
    if (cleanUser.length < 2 || cleanUser.length > 32) {
      throw new Error('Username must be between 2 and 32 characters');
    }
    if (!password || typeof password !== 'string' || password.length < 5) {
      throw new Error('Password must be at least 5 characters');
    }
    if (password.includes('\n') || password.includes('\r')) {
      throw new Error('Password cannot contain newline characters');
    }

    const rootDir = storageService.getRootDir(cpanelUser);
    storageService.resolveSafePath(relPath, cpanelUser); // Verification
    const htpasswdDir = path.join(rootDir, '.htpasswds', relPath);
    const htpasswdFile = path.join(htpasswdDir, 'passwd');

    if (!fs.existsSync(htpasswdDir)) {
      fs.mkdirSync(htpasswdDir, { recursive: true });
    }

    let lines = [];
    if (fs.existsSync(htpasswdFile)) {
      lines = fs.readFileSync(htpasswdFile, 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
    }

    // Check for duplicate username
    for (const line of lines) {
      if (line.startsWith(`${cleanUser}:`)) {
        const err = new Error(`User "${cleanUser}" already exists for this directory`);
        err.code = 'EEXIST';
        throw err;
      }
    }

    // Securely hash password with bcrypt ($2b$ Apache-compatible format)
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    lines.push(`${cleanUser}:${hash}`);

    // Atomic write
    const tempFile = path.join(htpasswdDir, `.tmp_pwd_${crypto.randomBytes(4).toString('hex')}`);
    fs.writeFileSync(tempFile, lines.join('\n') + '\n', { mode: 0o600, encoding: 'utf8' });
    fs.renameSync(tempFile, htpasswdFile);

    return {
      success: true,
      username: cleanUser,
      userCount: lines.length
    };
  }

  /**
   * Change password for an existing authorized user
   */
  changePassword({ relPath = 'public_html', username: targetUser, newPassword, cpanelUser = 'cpanel_user' }) {
    if (!targetUser || !newPassword || newPassword.length < 5) {
      throw new Error('Valid username and password (minimum 5 characters) are required');
    }

    const rootDir = storageService.getRootDir(cpanelUser);
    storageService.resolveSafePath(relPath, cpanelUser);
    const htpasswdFile = path.join(rootDir, '.htpasswds', relPath, 'passwd');

    if (!fs.existsSync(htpasswdFile)) {
      throw new Error('No user credentials found for this directory');
    }

    const lines = fs.readFileSync(htpasswdFile, 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
    let found = false;

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(newPassword, salt);

    const updatedLines = lines.map(line => {
      if (line.startsWith(`${targetUser}:`)) {
        found = true;
        return `${targetUser}:${hash}`;
      }
      return line;
    });

    if (!found) {
      throw new Error(`User "${targetUser}" not found in this directory`);
    }

    const dir = path.dirname(htpasswdFile);
    const tempFile = path.join(dir, `.tmp_pwd_${crypto.randomBytes(4).toString('hex')}`);
    fs.writeFileSync(tempFile, updatedLines.join('\n') + '\n', { mode: 0o600, encoding: 'utf8' });
    fs.renameSync(tempFile, htpasswdFile);

    return { success: true, username: targetUser };
  }

  /**
   * Remove an authorized user from a protected directory
   */
  removeUser({ relPath = 'public_html', username: targetUser, cpanelUser = 'cpanel_user' }) {
    const rootDir = storageService.getRootDir(cpanelUser);
    storageService.resolveSafePath(relPath, cpanelUser);
    const htpasswdFile = path.join(rootDir, '.htpasswds', relPath, 'passwd');

    if (!fs.existsSync(htpasswdFile)) {
      throw new Error('Credential file not found');
    }

    const lines = fs.readFileSync(htpasswdFile, 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
    const filtered = lines.filter(l => !l.startsWith(`${targetUser}:`));

    if (filtered.length === lines.length) {
      throw new Error(`User "${targetUser}" not found in this directory`);
    }

    const dir = path.dirname(htpasswdFile);
    const tempFile = path.join(dir, `.tmp_pwd_${crypto.randomBytes(4).toString('hex')}`);
    fs.writeFileSync(tempFile, filtered.length > 0 ? filtered.join('\n') + '\n' : '', { mode: 0o600, encoding: 'utf8' });
    fs.renameSync(tempFile, htpasswdFile);

    return {
      success: true,
      username: targetUser,
      remainingUsers: filtered.map(l => l.split(':')[0])
    };
  }

  /**
   * Web Server HTTP Basic Auth Checker
   * Used by Express /site middleware to enforce real HTTP 401 challenge on protected folders
   */
  verifyHttpAuth(userPublicHtml, requestSubPath, authHeader, username = 'cpanel_user') {
    const cleanSub = (requestSubPath || '').replace(/^\/+|\/+$/g, '');
    const rootDir = storageService.getRootDir(username);

    // Check directory hierarchy from requested path up to public_html
    const segments = cleanSub ? cleanSub.split('/') : [];
    let currentRel = segments.length > 0 ? `public_html/${segments.join('/')}` : 'public_html';

    while (true) {
      const checkDir = path.join(rootDir, currentRel);
      const htaccessFile = path.join(checkDir, '.htaccess');

      if (fs.existsSync(htaccessFile)) {
        const content = fs.readFileSync(htaccessFile, 'utf8');
        if (content.includes(MANAGED_START) && content.includes(MANAGED_END)) {
          // Found protection!
          let realm = 'Restricted Directory';
          const match = content.match(/AuthName\s+["']?([^"'\r\n]+)["']?/i);
          if (match) realm = match[1];

          const htpasswdFile = path.join(rootDir, '.htpasswds', currentRel, 'passwd');
          if (!fs.existsSync(htpasswdFile)) {
            return { requiresAuth: true, realm, authorized: false };
          }

          if (!authHeader || !authHeader.startsWith('Basic ')) {
            return { requiresAuth: true, realm, authorized: false };
          }

          // Decode credentials
          try {
            const b64 = authHeader.substring(6);
            const decoded = Buffer.from(b64, 'base64').toString('utf8');
            const colon = decoded.indexOf(':');
            if (colon === -1) return { requiresAuth: true, realm, authorized: false };

            const user = decoded.substring(0, colon);
            const pass = decoded.substring(colon + 1);

            const lines = fs.readFileSync(htpasswdFile, 'utf8').split(/\r?\n/);
            for (const line of lines) {
              if (line.startsWith(`${user}:`)) {
                const storedHash = line.substring(user.length + 1);
                if (bcrypt.compareSync(pass, storedHash)) {
                  return { requiresAuth: true, realm, authorized: true, user };
                }
              }
            }
          } catch (e) {}

          return { requiresAuth: true, realm, authorized: false };
        }
      }

      if (currentRel === 'public_html') break;
      const lastSlash = currentRel.lastIndexOf('/');
      if (lastSlash === -1 || currentRel.substring(0, lastSlash) === '') {
        currentRel = 'public_html';
      } else {
        currentRel = currentRel.substring(0, lastSlash);
      }
    }

    return { requiresAuth: false, authorized: true };
  }
}

module.exports = new PrivacyService();
