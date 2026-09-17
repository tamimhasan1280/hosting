/**
 * webalizer_ftp_audit.js
 * Comprehensive Verification & Automated Audit Suite for Feature #32: Webalizer FTP
 * Tests capabilities, xferlog logging, parsing, live transfers, auth events,
 * KPIs, daily/hourly aggregations, IP privacy masking, HTML/ASCII export, and tenant isolation.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const webalizerFtpService = require('./src/services/webalizerFtpService');
const ftpService = require('./src/services/ftpService');
const storageService = require('./src/services/storageService');

const BASE_URL = 'http://localhost:5000/api/webalizer-ftp';
const TEST_USER = 'cpanel_user';
const OTHER_USER = 'other_tenant_user';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    }).on('error', reject);
  });
}

function httpPost(url, body = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runAudit() {
  console.log('====================================================');
  console.log('⚡ STARTING WEBALIZER FTP AUDIT SUITE (Feature #32)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // TEST 1: Capabilities detection
  await test('Test 1: Truthful Webalizer FTP Capabilities Detection', async () => {
    const res = await httpGet(`${BASE_URL}/capabilities`);
    assert.strictEqual(res.status, 200, 'Capabilities endpoint returned 200');
    assert.strictEqual(res.data.success, true, 'Capabilities success flag is true');
    assert.strictEqual(res.data.webalizerInstalled, false, 'Truthfully reports native webalizer not installed');
    assert.strictEqual(res.data.engine, 'embedded_access_log', 'Reports embedded xferlog analytics engine');
    assert.strictEqual(res.data.geoIpInstalled, false, 'Truthfully reports GeoIP not installed');
    assert.strictEqual(res.data.daemonAvailable, true, 'FTP daemon is active');
    assert.strictEqual(res.data.daemonPort, 21, 'FTP daemon active on port 21');
  });

  // TEST 2: Authorized FTP Accounts retrieval
  await test('Test 2: Authorized FTP Accounts Listing with Tenant Scope', async () => {
    const res = await httpGet(`${BASE_URL}/accounts?user=${TEST_USER}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.accounts), 'Accounts is an array');
    assert.ok(res.data.accounts.length > 0, 'User has at least 1 FTP account');
    assert.ok(res.data.accounts.some(a => a.username.includes(TEST_USER)), 'Contains test user account');
  });

  // Clean test logs before populating controlled records
  const userLogsDir = webalizerFtpService.getLogsDir(TEST_USER);
  const xferlogFile = webalizerFtpService.getXferlogPath(TEST_USER);
  const authLogFile = webalizerFtpService.getAuthLogPath(TEST_USER);

  if (fs.existsSync(xferlogFile)) fs.unlinkSync(xferlogFile);
  if (fs.existsSync(authLogFile)) fs.unlinkSync(authLogFile);
  webalizerFtpService.clearCache(TEST_USER);

  // TEST 3: Transfer logging (xferlog standard format)
  await test('Test 3: Authentic RFC 959 xferlog Record Generation', async () => {
    const ok = webalizerFtpService.logTransfer({
      cpanelUser: TEST_USER,
      username: `${TEST_USER}@example.com`,
      remoteHost: '192.168.1.50',
      bytes: 1048576, // 1 MB
      filename: '/public_html/assets/banner.png',
      direction: 'i', // upload
      transferType: 'b',
      transferTime: 1,
      completionStatus: 'c',
      timestamp: new Date('2026-09-17T03:15:00Z')
    });
    assert.strictEqual(ok, true, 'logTransfer returned true');
    assert.ok(fs.existsSync(xferlogFile), 'xferlog file created on disk');

    const content = fs.readFileSync(xferlogFile, 'utf8');
    assert.ok(content.includes('192.168.1.50'), 'Includes remote host');
    assert.ok(content.includes('1048576'), 'Includes byte count');
    assert.ok(content.includes('/public_html/assets/banner.png'), 'Includes filename');
    assert.ok(content.includes(' i '), 'Includes upload direction "i"');
    assert.ok(content.includes(' c'), 'Includes complete status "c"');
  });

  // TEST 4: Parsing of xferlog format
  await test('Test 4: RFC 959 xferlog Line Tokenization & Parsing', async () => {
    const rawLine = 'Thu Sep 17 03:15:00 2026 2 10.0.0.15 5242880 /public_html/backup.tar.gz b _ o r cpanel_user@example.com ftp 0 * c';
    const parsed = webalizerFtpService.parseXferlogLine(rawLine);
    assert.ok(parsed, 'Parsed record is not null');
    assert.strictEqual(parsed.remoteHost, '10.0.0.15');
    assert.strictEqual(parsed.bytes, 5242880);
    assert.strictEqual(parsed.filename, '/public_html/backup.tar.gz');
    assert.strictEqual(parsed.direction, 'o'); // download
    assert.strictEqual(parsed.completionStatus, 'c');
    assert.strictEqual(parsed.username, 'cpanel_user@example.com');
    assert.strictEqual(parsed.dateKey, '2026-09-17');
    assert.strictEqual(parsed.hour, 3);
  });

  // Populate multiple authentic records across different hours, directions, and files
  const testTransfers = [
    { username: `${TEST_USER}@example.com`, remoteHost: '192.168.1.50', bytes: 204800, filename: '/public_html/index.html', direction: 'i', transferType: 'a', completionStatus: 'c', timestamp: new Date('2026-09-17T01:00:00Z') },
    { username: `${TEST_USER}@example.com`, remoteHost: '192.168.1.51', bytes: 4096000, filename: '/public_html/data.zip', direction: 'o', transferType: 'b', completionStatus: 'c', timestamp: new Date('2026-09-17T02:30:00Z') },
    { username: `${TEST_USER}@example.com`, remoteHost: '192.168.1.52', bytes: 1024000, filename: '/public_html/video.mp4', direction: 'o', transferType: 'b', completionStatus: 'c', timestamp: new Date('2026-09-17T04:15:00Z') },
    { username: `${TEST_USER}@example.com`, remoteHost: '192.168.1.50', bytes: 512000, filename: '/public_html/assets/logo.svg', direction: 'i', transferType: 'a', completionStatus: 'c', timestamp: new Date('2026-09-17T05:00:00Z') },
    { username: `${TEST_USER}@example.com`, remoteHost: '192.168.1.53', bytes: 8192000, filename: '/public_html/broken.iso', direction: 'i', transferType: 'b', completionStatus: 'i', timestamp: new Date('2026-09-17T06:00:00Z') } // incomplete
  ];

  for (const t of testTransfers) {
    webalizerFtpService.logTransfer({
      cpanelUser: TEST_USER,
      ...t
    });
  }

  // TEST 5: Authentication logging & tracking
  await test('Test 5: FTP Authentication Event Logging (Success & Failure)', async () => {
    webalizerFtpService.logAuth({
      cpanelUser: TEST_USER,
      username: `${TEST_USER}@example.com`,
      remoteHost: '192.168.1.50',
      success: true,
      message: 'Login successful',
      timestamp: new Date('2026-09-17T01:00:00Z')
    });
    webalizerFtpService.logAuth({
      cpanelUser: TEST_USER,
      username: `${TEST_USER}@example.com`,
      remoteHost: '192.168.1.99',
      success: false,
      message: 'Invalid password',
      timestamp: new Date('2026-09-17T02:00:00Z')
    });

    assert.ok(fs.existsSync(authLogFile), 'Auth log created');
    const authContent = fs.readFileSync(authLogFile, 'utf8');
    assert.ok(authContent.includes('[SUCCESS]'), 'Records success login');
    assert.ok(authContent.includes('[FAILURE]'), 'Records failed login');
  });

  // Flush cache
  webalizerFtpService.clearCache(TEST_USER);

  // TEST 6: Overview KPI calculations
  await test('Test 6: Overview KPI Aggregations (Files, Bytes, Sessions, Ratios)', async () => {
    const res = await httpGet(`${BASE_URL}/report?user=${TEST_USER}&period=all`);
    assert.strictEqual(res.status, 200);
    const s = res.data.summary;
    // 1 initial upload (1048576) + 5 additional transfers:
    // Uploads: 1048576 + 204800 + 512000 + 8192000 = 9957376 bytes, count: 4
    // Downloads: 4096000 + 1024000 = 5120000 bytes, count: 2
    // Total transfers: 6
    // Total bytes: 9957376 + 5120000 = 15077376 bytes
    assert.strictEqual(s.totalTransfers, 6, 'Total transfers is 6');
    assert.strictEqual(s.totalUploads, 4, 'Total uploads is 4');
    assert.strictEqual(s.totalDownloads, 2, 'Total downloads is 2');
    assert.strictEqual(s.uploadBytes, 9957376, 'Upload bytes matches exactly');
    assert.strictEqual(s.downloadBytes, 5120000, 'Download bytes matches exactly');
    assert.strictEqual(s.totalBytes, 15077376, 'Total bytes matches sum');
    assert.strictEqual(s.successfulLogins, 1, '1 successful login');
    assert.strictEqual(s.failedLogins, 1, '1 failed login');
    assert.ok(s.completionRate < 100 && s.completionRate > 80, 'Completion rate reflects incomplete transfer');
  });

  // TEST 7: Daily & Hourly distributions
  await test('Test 7: Daily & Hourly Transfer Distributions', async () => {
    const res = await httpGet(`${BASE_URL}/report?user=${TEST_USER}&period=all`);
    const { daily, hourly } = res.data;
    assert.ok(Array.isArray(daily), 'Daily is an array');
    assert.ok(daily.length >= 1, 'Has at least 1 day entry');
    assert.strictEqual(daily[0].totalTransfers, 6, 'Day has 6 transfers');

    assert.ok(Array.isArray(hourly), 'Hourly is an array');
    assert.strictEqual(hourly.length, 24, 'Hourly has exactly 24 entries');
    
    // Check that total transfers across all 24 hours equals total 6
    const totalHourlyTransfers = hourly.reduce((sum, h) => sum + h.totalTransfers, 0);
    assert.strictEqual(totalHourlyTransfers, 6, 'Total hourly transfers sum to 6');
    const activeHours = hourly.filter(h => h.totalTransfers > 0);
    assert.ok(activeHours.length >= 4, 'Multiple distinct active hours distributed');
  });

  // TEST 8: Top Files Ranking
  await test('Test 8: Top Uploaded and Downloaded Files Ranking', async () => {
    const res = await httpGet(`${BASE_URL}/report?user=${TEST_USER}&period=all`);
    const { topUploadedFiles, topDownloadedFiles } = res.data;

    assert.ok(topUploadedFiles.length > 0, 'Has top uploaded files');
    assert.ok(topDownloadedFiles.length > 0, 'Has top downloaded files');

    // Largest upload was broken.iso (8192000 bytes)
    assert.strictEqual(topUploadedFiles[0].filename, '/public_html/broken.iso', 'broken.iso ranked #1 upload');
    // Largest download was data.zip (4096000 bytes)
    assert.strictEqual(topDownloadedFiles[0].filename, '/public_html/data.zip', 'data.zip ranked #1 download');
  });

  // TEST 9: Client Host IP privacy masking
  await test('Test 9: Client Host IP Anonymization (Privacy Masking)', async () => {
    const unmasked = await httpGet(`${BASE_URL}/report?user=${TEST_USER}&period=all&anonymize=false`);
    const masked = await httpGet(`${BASE_URL}/report?user=${TEST_USER}&period=all&anonymize=true`);

    const unmaskedHosts = unmasked.data.clientHosts.map(c => c.displayHost);
    const maskedHosts = masked.data.clientHosts.map(c => c.displayHost);

    assert.ok(unmaskedHosts.some(h => h === '192.168.1.50'), 'Unmasked contains real IP');
    assert.ok(maskedHosts.some(h => h === '192.168.1.xxx'), 'Masked contains 192.168.1.xxx');
    assert.ok(!maskedHosts.some(h => h === '192.168.1.50'), 'Masked does NOT contain real IP');
  });

  // TEST 10: HTML Export Report
  await test('Test 10: Authentic Webalizer 2.23 HTML Report Export', async () => {
    const res = await httpGet(`${BASE_URL}/export?user=${TEST_USER}&period=all&format=html`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'), 'Content-Type is text/html');
    assert.ok(res.raw.includes('Webalizer 2.23: FTP Server Traffic Analysis'), 'HTML includes Webalizer 2.23 title');
    assert.ok(res.raw.includes('Summary Statistics'), 'HTML includes summary statistics table');
    assert.ok(res.raw.includes('Daily FTP Activity'), 'HTML includes daily activity table');
    assert.ok(res.raw.includes('/public_html/broken.iso'), 'HTML includes file transfer records');
  });

  // TEST 11: ASCII Plaintext Export Report
  await test('Test 11: Authentic ASCII Plain Text Report Export', async () => {
    const res = await httpGet(`${BASE_URL}/export?user=${TEST_USER}&period=all&format=txt`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/plain'), 'Content-Type is text/plain');
    assert.ok(res.raw.includes('WEBALIZER 2.23 - FTP SERVER TRAFFIC ANALYSIS'), 'TXT contains header');
    assert.ok(res.raw.includes('SUMMARY STATISTICS'), 'TXT contains summary block');
    assert.ok(res.raw.includes('DAILY FTP USAGE'), 'TXT contains daily usage');
  });

  // TEST 12: Multi-Tenant Security & Isolation
  await test('Test 12: Strict Multi-Tenant Security & Data Isolation', async () => {
    // Other tenant user should have 0 data
    const otherRes = await httpGet(`${BASE_URL}/report?user=${OTHER_USER}&period=all`);
    assert.strictEqual(otherRes.status, 200);
    assert.strictEqual(otherRes.data.hasData, false, 'Other tenant has no data');
    assert.strictEqual(otherRes.data.summary.totalTransfers, 0, 'Other tenant has 0 transfers');
    assert.strictEqual(otherRes.data.summary.totalBytes, 0, 'Other tenant has 0 bytes');
  });

  console.log('\n====================================================');
  console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit suite error:', err);
  process.exit(1);
});
