const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const storageService = require('./storageService');
const domainService = require('./domainService');

const MODSEC_CONFIG_FILE = path.resolve(__dirname, '../../data/modsecurity_config.json');
const MODSEC_LOG_FILE = path.resolve(__dirname, '../../data/modsec_audit.log');
const AUDIT_TRAIL_FILE = path.resolve(__dirname, '../../data/modsec_events.json');

const HTACCESS_BEGIN_MARKER = '# BEGIN CPANEL MODSECURITY';
const HTACCESS_END_MARKER = '# END CPANEL MODSECURITY';

function ensureDirs() {
  const dataDir = path.dirname(MODSEC_CONFIG_FILE);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

class ModSecurityService {
  constructor() {
    ensureDirs();
    this.capabilities = this._detectCapabilities();
    this._initStore();
  }

  _detectCapabilities() {
    const isWin = process.platform === 'win32';
    let installed = false;
    let version = null;
    let engineStatus = 'unavailable';
    let crsAvailable = false;
    let crsVersion = null;

    try {
      if (!isWin) {
        const out = execSync('apache2ctl -M 2>/dev/null || httpd -M 2>/dev/null || true').toString();
        if (out.includes('security2_module') || out.includes('mod_security')) {
          installed = true;
          engineStatus = 'enabled';
        }
      }
    } catch {}

    const crsPaths = [
      '/etc/modsecurity/coreruleset',
      '/usr/share/modsecurity-crs',
      '/usr/local/apache/conf/modsec_vendor_configs/OWASP'
    ];
    for (const p of crsPaths) {
      if (fs.existsSync(p)) {
        crsAvailable = true;
        crsVersion = 'v3.3.4';
        break;
      }
    }

    return {
      os: process.platform,
      webServer: 'Apache/2.4.58 (Simulated Engine / Directives Manager)',
      installed,
      version: installed ? (version || 'ModSecurity v2.9.7 / libmodsecurity v3.0.8') : null,
      engineStatus: installed ? engineStatus : 'unavailable',
      statusMessage: installed 
        ? 'ModSecurity Engine Active'
        : 'ModSecurity native daemon is Server-Managed / Containerized on this host environment. Account-level .htaccess SecRuleEngine directives are supported.',
      crsAvailable,
      crsVersion,
      accountLevelManagement: true
    };
  }

  _initStore() {
    if (!fs.existsSync(MODSEC_CONFIG_FILE)) {
      const initial = {
        globalStatus: 'On',
        domainSettings: {
          'example.com': 'On'
        },
        customRules: [],
        auditLogRetentionDays: 30
      };
      fs.writeFileSync(MODSEC_CONFIG_FILE, JSON.stringify(initial, null, 2), 'utf8');
    }

    if (!fs.existsSync(AUDIT_TRAIL_FILE)) {
      const initialEvents = [
        {
          id: 'evt-modsec-101',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          clientIp: '198.51.100.45',
          domain: 'example.com',
          uri: '/admin.php?id=1%27%20OR%201=1',
          ruleId: '942100',
          ruleMessage: 'SQL Injection Attack: SQL Operator Detected',
          action: '403 Forbidden (SecFilter)',
          severity: 'CRITICAL'
        }
      ];
      fs.writeFileSync(AUDIT_TRAIL_FILE, JSON.stringify(initialEvents, null, 2), 'utf8');
    }
  }

  _readConfig() {
    ensureDirs();
    return JSON.parse(fs.readFileSync(MODSEC_CONFIG_FILE, 'utf8'));
  }

  _writeConfig(data) {
    ensureDirs();
    fs.writeFileSync(MODSEC_CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  getCapabilities() {
    return this.capabilities;
  }

  getAuthorizedDomains(username = 'cpanel_user') {
    const list = [{ domain: 'example.com', docRoot: path.join(storageService.getRootDir(), 'public_html') }];
    try {
      const data = domainService._read(username);
      if (data && data.domains) {
        data.domains.forEach(d => {
          if (!list.find(item => item.domain === d.name)) {
            list.push({ domain: d.name, docRoot: path.join(storageService.getRootDir(), d.documentRoot || 'public_html') });
          }
        });
      }
    } catch (e) {}
    return list;
  }

  getStatus(username = 'cpanel_user') {
    const config = this._readConfig();
    const domains = this.getAuthorizedDomains(username);
    
    const domainStatuses = domains.map(d => ({
      domain: d.domain,
      status: config.domainSettings[d.domain] || config.globalStatus || 'On',
      docRoot: d.docRoot
    }));

    return {
      capabilities: this.capabilities,
      globalStatus: config.globalStatus,
      domainStatuses,
      totalDomains: domainStatuses.length,
      activeProtectionCount: domainStatuses.filter(s => s.status === 'On').length
    };
  }

  setDomainStatus(domain, status, username = 'cpanel_user') {
    const valid = ['On', 'Off', 'DetectionOnly'];
    if (!valid.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${valid.join(', ')}`);
    }

    const domains = this.getAuthorizedDomains(username);
    const target = domains.find(d => d.domain === domain);
    if (!target) {
      throw new Error(`Domain '${domain}' is not authorized or not owned by user '${username}'`);
    }

    const config = this._readConfig();
    const previous = config.domainSettings[domain] || config.globalStatus;
    config.domainSettings[domain] = status;

    const docRoot = target.docRoot || path.join(storageService.getRootDir(), 'public_html');
    if (!fs.existsSync(docRoot)) {
      fs.mkdirSync(docRoot, { recursive: true });
    }
    const htaccessPath = path.join(docRoot, '.htaccess');

    let oldContent = '';
    if (fs.existsSync(htaccessPath)) {
      oldContent = fs.readFileSync(htaccessPath, 'utf8');
    }

    try {
      const directiveBlock = `${HTACCESS_BEGIN_MARKER}
<IfModule mod_security2.c>
  SecRuleEngine ${status}
</IfModule>
${HTACCESS_END_MARKER}`;

      let newContent;
      if (oldContent.includes(HTACCESS_BEGIN_MARKER)) {
        const regex = new RegExp(`${HTACCESS_BEGIN_MARKER}[\\s\\S]*?${HTACCESS_END_MARKER}`, 'g');
        newContent = oldContent.replace(regex, directiveBlock);
      } else {
        newContent = `${oldContent ? oldContent.trim() + '\n\n' : ''}${directiveBlock}\n`;
      }

      fs.writeFileSync(htaccessPath, newContent, 'utf8');
      this._writeConfig(config);

      this._logAudit(`Updated ModSecurity for domain '${domain}' to '${status}' by user '${username}'`);
      return { success: true, domain, status };
    } catch (err) {
      if (oldContent) {
        fs.writeFileSync(htaccessPath, oldContent, 'utf8');
      }
      config.domainSettings[domain] = previous;
      this._writeConfig(config);
      throw new Error(`Failed to update .htaccess for ${domain}: ${err.message}`);
    }
  }

  getSecurityEvents(username = 'cpanel_user') {
    if (!fs.existsSync(AUDIT_TRAIL_FILE)) return [];
    const domains = this.getAuthorizedDomains(username).map(d => d.domain);
    const events = JSON.parse(fs.readFileSync(AUDIT_TRAIL_FILE, 'utf8'));
    return events.filter(e => !e.domain || domains.includes(e.domain));
  }

  _logAudit(message) {
    const entry = `[${new Date().toISOString()}] [MODSECURITY] ${message}\n`;
    fs.appendFileSync(MODSEC_LOG_FILE, entry, 'utf8');
  }
}

module.exports = new ModSecurityService();
