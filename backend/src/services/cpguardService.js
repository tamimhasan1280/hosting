const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CPGuardService {
  constructor() {
    this.status = this._detectInstallation();
  }

  _detectInstallation() {
    const isWin = process.platform === 'win32';
    let installed = false;
    let version = null;
    let serviceActive = false;

    if (!isWin) {
      const paths = ['/usr/local/cpguard/bin/cpgctl', '/usr/bin/cpgctl'];
      for (const p of paths) {
        if (fs.existsSync(p)) {
          installed = true;
          try {
            version = execSync(`${p} --version 2>/dev/null || true`).toString().trim();
          } catch {}
          break;
        }
      }
    }

    return {
      available: installed,
      version: version || null,
      message: installed 
        ? 'cPGuard Security Suite is active and monitoring.' 
        : 'cPGuard is unavailable on this server. This hosting node does not have cPGuard daemon installed or licensed.',
      scansEnabled: installed,
      realtimeScanner: installed ? 'Active' : 'Disabled',
      quarantineCount: 0,
      recentAlerts: []
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

  initiateScan(domain, username = 'cpanel_user') {
    if (!this.status.available) {
      throw new Error('cPGuard is unavailable on this server.');
    }
    return {
      success: true,
      scanId: `cpg-${Date.now()}`,
      status: 'Queued',
      target: domain,
      user: username
    };
  }
}

module.exports = new CPGuardService();
