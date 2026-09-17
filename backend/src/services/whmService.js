const fs = require('fs');
const path = require('path');
const storageService = require('./storageService');
const sessionService = require('./sessionService');
const domainService = require('./domainService');
const databaseService = require('./databaseService');
const mailService = require('./mailService');
const authService = require('./authService');

const ACCOUNTS_FILE = path.resolve(__dirname, '../../data/whm_accounts.json');
const WHMCS_PATH = 'D:\\Websites\\WHMC';

function ensureAccountsStore() {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    const initial = [
      {
        user: 'cpanel_user',
        domain: 'example.com',
        ip: '192.0.2.1',
        plan: 'Standard Shared Hosting',
        diskused: '14M',
        disklimit: '10240M',
        suspended: 0,
        suspendreason: '',
        contactemail: 'admin@example.com',
        startdate: new Date().toISOString()
      }
    ];
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

class WhmService {
  constructor() {
    ensureAccountsStore();
  }

  _read() {
    ensureAccountsStore();
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
  }

  _write(data) {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  getWhmcsStatus() {
    const exists = fs.existsSync(WHMCS_PATH);
    let details = {
      path: WHMCS_PATH,
      exists,
      version: '8.13.3',
      license: 'Active',
      dbName: 'topupsh1_whmc885',
      dbHost: 'localhost',
      sqlDumpExists: false,
      sqlDumpSizeMb: 0
    };

    if (exists) {
      const sqlPath = path.join(WHMCS_PATH, 'topupsh1_whmc885.sql');
      if (fs.existsSync(sqlPath)) {
        const stats = fs.statSync(sqlPath);
        details.sqlDumpExists = true;
        details.sqlDumpSizeMb = +(stats.size / (1024 * 1024)).toFixed(2);
      }
    }

    return {
      connected: exists,
      bridgeMode: 'Active (WHM API v1 / UAPI Native Bridge)',
      apiEndpoint: 'http://localhost:5000/json-api',
      uapiEndpoint: 'http://localhost:5000/execute',
      apiToken: 'whm_token_' + Buffer.from('cpanel_pro_whmcs_secret').toString('hex'),
      whmcs: details,
      serverSettings: {
        name: 'cPanel Local Node',
        hostname: 'localhost',
        ipaddress: '127.0.0.1',
        assignedips: '127.0.0.1',
        type: 'cpanel',
        port: 5000,
        secure: false,
        nameserver1: 'ns1.example.com',
        nameserver2: 'ns2.example.com'
      }
    };
  }

  // --- WHM API 1 METHODS (Standard format matching official cPanel/WHM) ---

  getVersion() {
    return {
      metadata: { version: 1, command: 'version', result: 1, reason: 'OK' },
      data: { version: '120.0.11' }
    };
  }

  listAccounts() {
    const accounts = this._read();
    return {
      metadata: { version: 1, command: 'listaccts', result: 1, reason: 'OK' },
      data: {
        acct: accounts.map(a => {
          let used = a.diskused || '1M';
          try {
            const du = storageService.getDiskUsage(a.user);
            used = `${du.mb}M`;
          } catch (e) {}
          return {
            user: a.user,
            domain: a.domain,
            ip: a.ip || '192.0.2.1',
            plan: a.plan || 'Standard',
            diskused: used,
            disklimit: a.disklimit || '10240M',
            suspended: a.suspended || 0,
            suspendreason: a.suspendreason || '',
            email: a.contactemail || `${a.user}@${a.domain}`,
            startdate: a.startdate
          };
        })
      }
    };
  }

  createAccount(params) {
    const { username, domain, plan = 'Standard', password, contactemail, quota = 10240 } = params;
    if (!username || !domain) {
      return {
        metadata: { version: 1, command: 'createacct', result: 0, reason: 'Missing username or domain' }
      };
    }

    const data = this._read();
    if (data.find(a => a.user === username || a.domain === domain)) {
      return {
        metadata: { version: 1, command: 'createacct', result: 0, reason: `Account with user '${username}' or domain '${domain}' already exists` }
      };
    }

    const newAcct = {
      user: username,
      domain,
      ip: '192.0.2.1',
      plan,
      diskused: '1M',
      disklimit: `${quota}M`,
      suspended: 0,
      suspendreason: '',
      contactemail: contactemail || `admin@${domain}`,
      startdate: new Date().toISOString()
    };

    data.push(newAcct);
    this._write(data);

    // Auto-create isolated vhost, domain config, and default mailbox
    try {
      storageService.getRootDir(username); // Provisions isolated data/vhosts/{username}/public_html/index.html
      domainService.initAccount(username, domain);
      mailService.createAccount('admin', domain, password || 'P@ssword123!', 1024);
      authService.registerUser(username, contactemail || `${username}@${domain}`, password || 'P@ssword123!');
    } catch (e) {
      console.warn('WHM Auto-provisioning note:', e.message);
    }

    return {
      metadata: { version: 1, command: 'createacct', result: 1, reason: `Account '${username}' created successfully for domain '${domain}'` },
      data: {
        ip: '192.0.2.1',
        nameserver: 'ns1.example.com',
        nameserver2: 'ns2.example.com',
        nameserver3: '',
        nameserver4: '',
        package: plan
      }
    };
  }

  suspendAccount(user, reason = 'Overdue Invoice') {
    const data = this._read();
    const acct = data.find(a => a.user === user);
    if (!acct) {
      return { metadata: { version: 1, command: 'suspendacct', result: 0, reason: `User '${user}' does not exist` } };
    }
    acct.suspended = 1;
    acct.suspendreason = reason;
    this._write(data);
    return {
      metadata: { version: 1, command: 'suspendacct', result: 1, reason: `Account '${user}' has been suspended (${reason})` }
    };
  }

  unsuspendAccount(user) {
    const data = this._read();
    const acct = data.find(a => a.user === user);
    if (!acct) {
      return { metadata: { version: 1, command: 'unsuspendacct', result: 0, reason: `User '${user}' does not exist` } };
    }
    acct.suspended = 0;
    acct.suspendreason = '';
    this._write(data);
    return {
      metadata: { version: 1, command: 'unsuspendacct', result: 1, reason: `Account '${user}' unsuspended successfully` }
    };
  }

  terminateAccount(user) {
    const data = this._read();
    const filtered = data.filter(a => a.user !== user);
    if (filtered.length === data.length) {
      return { metadata: { version: 1, command: 'removeacct', result: 0, reason: `User '${user}' does not exist` } };
    }
    this._write(filtered);
    return {
      metadata: { version: 1, command: 'removeacct', result: 1, reason: `Account '${user}' terminated successfully` }
    };
  }

  changePassword(user, password) {
    const data = this._read();
    const acct = data.find(a => a.user === user);
    if (!acct) {
      return { metadata: { version: 1, command: 'passwd', result: 0, reason: `User '${user}' does not exist` } };
    }
    try {
      authService.registerUser(user, acct.contactemail || `${user}@${acct.domain}`, password);
    } catch (e) {}
    return {
      metadata: { version: 1, command: 'passwd', result: 1, reason: `Password for '${user}' changed successfully` }
    };
  }

  changePackage(user, pkg) {
    const data = this._read();
    const acct = data.find(a => a.user === user);
    if (!acct) {
      return { metadata: { version: 1, command: 'changepackage', result: 0, reason: `User '${user}' does not exist` } };
    }
    acct.plan = pkg || 'Standard';
    this._write(data);
    return {
      metadata: { version: 1, command: 'changepackage', result: 1, reason: `Package for '${user}' changed to '${acct.plan}'` }
    };
  }

  showBandwidth() {
    const accounts = this._read();
    const bandwidth = accounts.map(a => ({
      user: a.user,
      totalbytes: 878 * 1024 * 1024,
      limit: 9999999 * 1024 * 1024
    }));
    return {
      metadata: { version: 1, command: 'showbw', result: 1, reason: 'OK' },
      data: { bandwidth }
    };
  }

  // Single Sign-On (SSO) session creation
  createUserSession(user, service = 'cpaneld', extra = {}, baseUrl = null) {
    const session = sessionService.createSession(user, service, extra, baseUrl);
    return {
      metadata: { version: 1, command: 'create_user_session', result: 1, reason: 'OK' },
      data: {
        token: session.token,
        url: session.redirectUrl,
        expires: session.expires
      }
    };
  }
}

module.exports = new WhmService();
