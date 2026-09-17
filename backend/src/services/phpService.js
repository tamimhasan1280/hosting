const fs = require('fs');
const path = require('path');

const PHP_CONFIG_FILE = path.resolve(__dirname, '../../data/php.json');

function ensurePhpConfig() {
  if (!fs.existsSync(PHP_CONFIG_FILE)) {
    const initial = {
      defaultVersion: 'ea-php82',
      availableVersions: [
        { id: 'ea-php81', name: 'PHP 8.1 (Supported)' },
        { id: 'ea-php82', name: 'PHP 8.2 (Recommended)', current: true },
        { id: 'ea-php83', name: 'PHP 8.3 (Stable)' },
        { id: 'ea-php84', name: 'PHP 8.4 (Latest Release)' }
      ],
      iniDirectives: {
        'display_errors': 'Off',
        'max_execution_time': '300',
        'max_input_time': '60',
        'memory_limit': '512M',
        'post_max_size': '256M',
        'upload_max_filesize': '128M',
        'zlib.output_compression': 'Off',
        'allow_url_fopen': 'On'
      },
      domainVersions: {
        'example.com': 'ea-php82'
      }
    };
    fs.writeFileSync(PHP_CONFIG_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

class PhpService {
  constructor() {
    ensurePhpConfig();
  }

  _read() {
    ensurePhpConfig();
    return JSON.parse(fs.readFileSync(PHP_CONFIG_FILE, 'utf8'));
  }

  _write(data) {
    fs.writeFileSync(PHP_CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  getConfig() {
    return this._read();
  }

  updateDomainVersion(domain, version) {
    const data = this._read();
    if (!data.availableVersions.find(v => v.id === version)) {
      throw new Error('Invalid PHP version selected');
    }
    data.domainVersions[domain] = version;
    this._write(data);
    return { success: true, domain, version };
  }

  updateIni(directives) {
    const data = this._read();
    data.iniDirectives = {
      ...data.iniDirectives,
      ...directives
    };
    this._write(data);
    return data.iniDirectives;
  }
}

module.exports = new PhpService();
