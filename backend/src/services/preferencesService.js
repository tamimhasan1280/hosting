const fs = require('fs');
const path = require('path');
const os = require('os');

const PREFS_FILE = path.resolve(__dirname, '../../data/user_preferences.json');

function ensureStore() {
  const dir = path.dirname(PREFS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(PREFS_FILE)) {
    const initial = {
      accounts: {
        'cpanel_user': {
          contactEmail: 'admin@example.com',
          secondaryEmail: '',
          notifyDiskQuota: true,
          notifyBandwidth: true,
          notifySslExpiry: true,
          timezone: 'UTC',
          language: 'en'
        }
      }
    };
    fs.writeFileSync(PREFS_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

class PreferencesService {
  constructor() {
    ensureStore();
  }

  _read() {
    ensureStore();
    return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8'));
  }

  _write(data) {
    ensureStore();
    fs.writeFileSync(PREFS_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  // --- ACCOUNT PREFERENCES (Feature #63) ---
  getPreferences(username = 'cpanel_user') {
    const data = this._read();
    return data.accounts[username] || {
      contactEmail: `${username}@example.com`,
      secondaryEmail: '',
      notifyDiskQuota: true,
      notifyBandwidth: true,
      notifySslExpiry: true,
      timezone: 'UTC',
      language: 'en'
    };
  }

  savePreferences(prefs, username = 'cpanel_user') {
    const data = this._read();
    data.accounts[username] = {
      ...this.getPreferences(username),
      ...prefs
    };
    this._write(data);
    return { success: true, preferences: data.accounts[username] };
  }

  // --- CHANGE LANGUAGE (Feature #64) ---
  getSupportedLanguages() {
    return [
      { code: 'en', name: 'English', nativeName: 'English (US)', flag: '🇺🇸' },
      { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
      { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
      { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
      { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' },
      { code: 'zh', name: 'Chinese', nativeName: '简体中文', flag: '🇨🇳' }
    ];
  }

  getLanguage(username = 'cpanel_user') {
    const prefs = this.getPreferences(username);
    return prefs.language || 'en';
  }

  setLanguage(code, username = 'cpanel_user') {
    const supported = this.getSupportedLanguages().map(l => l.code);
    if (!supported.includes(code)) {
      throw new Error(`Unsupported language code: ${code}`);
    }
    return this.savePreferences({ language: code }, username);
  }

  // --- SERVER INFORMATION (Feature #65) ---
  getServerInfo(username = 'cpanel_user') {
    const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'Intel/AMD Processor';

    return {
      hostname: os.hostname(),
      operatingSystem: `${os.type()} ${os.release()} (${os.arch()})`,
      kernelVersion: `${os.type()} Kernel ${os.release()}`,
      webServer: 'Apache/2.4.58 (cPanel Pro Platform)',
      phpVersion: 'ea-php82 (v8.2.18)',
      mysqlVersion: '10.6.18-MariaDB Enterprise',
      nodeVersion: process.version,
      architecture: os.arch(),
      serverTime: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      cpuCount: cpus.length,
      cpuModel,
      memoryTotal: `${totalMemMb} MB`,
      memoryFree: `${freeMemMb} MB`,
      hostingEnvironment: 'cPanel Cloud Dedicated Node',
      securityStatus: {
        firewall: 'Active / Managed',
        modSecurity: 'Active',
        sslEngine: 'OpenSSL 3.0.13'
      },
      restricted: {
        rootCredentials: '[RESTRICTED / HIDDEN]',
        apiPrivateKeys: '[RESTRICTED / ENCRYPTED]',
        internalNetworkTopology: '[RESTRICTED]'
      }
    };
  }
}

module.exports = new PreferencesService();
