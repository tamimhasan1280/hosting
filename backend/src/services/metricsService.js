const si = require('systeminformation');
const os = require('os');
const storageService = require('./storageService');
const ftpService = require('./ftpService');
const bandwidthService = require('./bandwidthService');

const fs = require('fs');
const path = require('path');

const WHM_ACCOUNTS_FILE = path.resolve(__dirname, '../../data/whm_accounts.json');

function getAccountDetails(username) {
  try {
    if (fs.existsSync(WHM_ACCOUNTS_FILE)) {
      const accts = JSON.parse(fs.readFileSync(WHM_ACCOUNTS_FILE, 'utf8'));
      const found = accts.find(a => a.user === username);
      if (found) return found;
    }
  } catch (e) {}
  return {
    user: username,
    domain: username === 'cpanel_user' ? 'example.com' : `${username}.com`,
    disklimit: '10240M',
    plan: 'Standard Shared Hosting'
  };
}

class MetricsService {
  async getSystemStats(username = 'cpanel_user') {
    const acct = getAccountDetails(username);
    const disklimitMb = parseInt(acct.disklimit, 10) || 10240;
    const totalDiskGb = (disklimitMb / 1024).toFixed(1);

    try {
      const [cpu, mem, currentLoad, bwSummary] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.currentLoad(),
        bandwidthService.getAccountBandwidthSummary(username).catch(() => ({ usedMb: 0, limitMb: 50000, usagePercent: 0 }))
      ]);

      const disk = storageService.getDiskUsage(username);
      const usedDiskGb = (disk.mb / 1024).toFixed(2);
      const diskPercent = Math.max(1, Math.min(100, Math.round((disk.mb / disklimitMb) * 100)));

      return {
        server: {
          hostname: os.hostname(),
          platform: os.platform(),
          release: os.release(),
          uptime: Math.floor(os.uptime()),
          serverTime: new Date().toISOString(),
          serverLoad: os.loadavg ? os.loadavg().map(v => v.toFixed(2)).join(', ') : '0.12, 0.08, 0.05',
          webServer: 'Apache / 2.4.58 (cPanel Pro)',
          phpVersion: '8.2.14',
          mySqlVersion: '10.6.18-MariaDB',
          cPanelVersion: '120.0 (build 11)'
        },
        resources: {
          cpu: {
            brand: cpu.brand || 'Multi-Core Processor',
            cores: cpu.cores || 4,
            usagePercent: Math.round(currentLoad.currentLoad || 12)
          },
          memory: {
            totalMb: Math.round(mem.total / (1024 * 1024)),
            usedMb: Math.round(mem.active / (1024 * 1024) || mem.used / (1024 * 1024)),
            freeMb: Math.round(mem.free / (1024 * 1024)),
            usagePercent: Math.round(((mem.active || mem.used) / mem.total) * 100) || 35
          },
          disk: {
            homeUsedMb: disk.mb,
            homeFiles: disk.files,
            totalGb: totalDiskGb,
            usedGb: usedDiskGb,
            limitMb: disklimitMb,
            usagePercent: diskPercent
          },
          bandwidth: {
            usedMb: bwSummary.usedMb,
            limitMb: bwSummary.limitMb,
            usagePercent: bwSummary.usagePercent
          },
          ftp: {
            used: ftpService.getAccountCount(username),
            limit: 20
          }
        },
        generalInfo: {
          currentUser: username,
          primaryDomain: acct.domain,
          plan: acct.plan || 'Standard Shared Hosting',
          sharedIp: '192.0.2.1',
          homeDir: storageService.getRootDir(username),
          lastLoginIp: '127.0.0.1',
          theme: 'jupiter'
        }
      };
    } catch (err) {
      console.error('Error fetching system stats:', err);
      const disk = storageService.getDiskUsage(username);
      // Fallback
      return {
        server: {
          hostname: os.hostname(),
          platform: os.platform(),
          uptime: Math.floor(os.uptime()),
          serverLoad: '0.15, 0.10, 0.05',
          webServer: 'Apache / 2.4.58 (cPanel Pro)',
          phpVersion: '8.2.14',
          mySqlVersion: '10.6.18-MariaDB',
          cPanelVersion: '120.0 (build 11)'
        },
        resources: {
          cpu: { brand: 'Intel / AMD Processor', cores: 4, usagePercent: 15 },
          memory: { totalMb: 16384, usedMb: 4200, freeMb: 12184, usagePercent: 26 },
          disk: { 
            homeUsedMb: disk.mb, 
            homeFiles: disk.files, 
            totalGb: totalDiskGb, 
            usedGb: (disk.mb / 1024).toFixed(2), 
            limitMb: disklimitMb,
            usagePercent: Math.max(1, Math.min(100, Math.round((disk.mb / disklimitMb) * 100))) 
          },
          bandwidth: { usedMb: 412.8, limitMb: 50000, usagePercent: 1 },
          ftp: { used: ftpService.getAccountCount(username), limit: 20 }
        },
        generalInfo: {
          currentUser: username,
          primaryDomain: acct.domain,
          plan: acct.plan || 'Standard Shared Hosting',
          sharedIp: '192.0.2.1',
          homeDir: storageService.getRootDir(username),
          lastLoginIp: '127.0.0.1',
          theme: 'jupiter'
        }
      };
    }
  }

  getErrorLogs() {
    return [
      { timestamp: new Date(Date.now() - 3600000).toISOString(), level: 'notice', message: '[core:notice] Apache/2.4.58 (cPanel Pro) configured -- resuming normal operations' },
      { timestamp: new Date(Date.now() - 2500000).toISOString(), level: 'warn', message: '[autoindex:warn] mod_autoindex disabled for public_html root' },
      { timestamp: new Date(Date.now() - 1200000).toISOString(), level: 'error', message: '[php:error] [pid 4912] Script timed out handling large background query, recovered' },
      { timestamp: new Date(Date.now() - 300000).toISOString(), level: 'info', message: '[ssl:info] AutoSSL checked domain example.com - status OK' }
    ];
  }

  getVisitorMetrics() {
    return {
      todayVisitors: 142,
      todayPageViews: 890,
      uniqueIps: 98,
      topPages: [
        { url: '/', hits: 450 },
        { url: '/blog', hits: 210 },
        { url: '/contact', hits: 115 },
        { url: '/about', hits: 95 }
      ],
      topBrowsers: [
        { name: 'Chrome', percent: 64 },
        { name: 'Firefox', percent: 18 },
        { name: 'Safari', percent: 12 },
        { name: 'Edge', percent: 6 }
      ]
    };
  }
}

module.exports = new MetricsService();
