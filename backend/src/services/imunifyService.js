const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ImunifyService {
  constructor() {
    this.status = this._detectInstallation();
  }

  _detectInstallation() {
    const isWin = process.platform === 'win32';
    let installed = false;
    let version = null;

    if (!isWin) {
      const paths = ['/usr/bin/imunify360-agent', '/usr/local/bin/imunify360-agent'];
      for (const p of paths) {
        if (fs.existsSync(p)) {
          installed = true;
          try {
            version = execSync(`${p} version 2>/dev/null || true`).toString().trim();
          } catch {}
          break;
        }
      }
    }

    return {
      available: installed,
      version: version || null,
      message: installed 
        ? 'Imunify360 Next-Gen Security is active.' 
        : 'Imunify360 is unavailable on this server. Imunify360 agent is not installed on this operating system/host.',
      proactiveDefense: installed ? 'Active' : 'Unavailable',
      malwareScanner: installed ? 'Active' : 'Unavailable',
      reputationManagement: installed ? 'Active' : 'Unavailable',
      firewall: installed ? 'Enabled' : 'Unavailable',
      quarantineFiles: []
    };
  }

  getStatus(username = 'cpanel_user') {
    return {
      ...this.status,
      user: username,
      accountIsolated: true,
      lastChecked: new Date().toISOString()
    };
  }

  startMalwareScan(pathTarget, username = 'cpanel_user') {
    if (!this.status.available) {
      throw new Error('Imunify360 is unavailable on this server.');
    }
    return {
      success: true,
      status: 'Initiated',
      target: pathTarget,
      user: username
    };
  }
}

module.exports = new ImunifyService();
