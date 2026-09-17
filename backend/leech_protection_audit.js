const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;

function request(method, pathName, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathName, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runAudit() {
  console.log('=== RUNNING AUDIT: FEATURE #40 — LEECH PROTECTION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    const user = 'cpanel_user';
    const testDir = 'public_html/leech-test-dir';

    // 0. Setup a test directory inside user sandbox
    const storageService = require('./src/services/storageService');
    const userRoot = storageService.getRootDir(user);
    const fullTestDir = path.join(userRoot, testDir);
    if (!fs.existsSync(fullTestDir)) {
      fs.mkdirSync(fullTestDir, { recursive: true });
    }
    fs.writeFileSync(path.join(fullTestDir, 'index.html'), '<h1>Leech Protected Area</h1>', 'utf8');

    // Create a dummy .htpasswd for directory privacy testing
    const htpasswdDir = path.join(userRoot, '.htpasswds', testDir);
    if (!fs.existsSync(htpasswdDir)) {
      fs.mkdirSync(htpasswdDir, { recursive: true });
    }
    const runId = Math.floor(Math.random() * 100000);
    const testUser = `testuser_${runId}`;
    const htpasswdFile = path.join(htpasswdDir, 'passwd');
    fs.writeFileSync(htpasswdFile, `${testUser}:$2a$10$dummyhashforauditpurposes1234567890\n`, 'utf8');

    // Reset clean state
    await request('POST', '/api/leech/save', {
      cpanelUser: user,
      directory: testDir,
      enabled: false,
      threshold: 4,
      timeWindowMinutes: 120,
      emailAlert: 'alert@example.com',
      redirectUrl: 'https://example.com/leech-warning.html',
      disableCompromisedAccounts: true,
      blockDurationMinutes: 120,
      whitelist: ['127.0.0.1']
    });

    // 1. Capabilities API
    console.log('1. Testing Leech Capabilities API...');
    const capsRes = await request('GET', '/api/leech/capabilities');
    assert(capsRes.status === 200 && capsRes.data.success, 'Capabilities endpoint returned HTTP 200 success');
    assert(capsRes.data.actionsSupported.includes('email_alert'), 'Supports email_alert action');
    assert(capsRes.data.actionsSupported.includes('redirect_url'), 'Supports redirect_url action');
    assert(capsRes.data.actionsSupported.includes('disable_compromised_account'), 'Supports disable_compromised_account action');
    assert(capsRes.data.actionsSupported.includes('temporary_ip_block'), 'Supports temporary_ip_block action');

    // 2. Directories Discovery API
    console.log('\n2. Testing Directories Discovery API...');
    const dirsRes = await request('GET', `/api/leech/directories?user=${user}`);
    assert(dirsRes.status === 200 && dirsRes.data.success, 'Directories endpoint returned HTTP 200 success');
    assert(Array.isArray(dirsRes.data.directories) && dirsRes.data.directories.length > 0, 'Discovered account directories');
    const foundTestDir = dirsRes.data.directories.find(d => d.canonicalRel === testDir);
    assert(!!foundTestDir, 'Discovered created test directory');

    // 3. Configure & Enable Leech Protection
    console.log('\n3. Configuring & Enabling Leech Protection...');
    const saveRes = await request('POST', '/api/leech/save', {
      cpanelUser: user,
      directory: testDir,
      enabled: true,
      threshold: 3, // Set threshold to 3 attempts
      timeWindowMinutes: 60,
      emailAlert: 'secops@example.com',
      redirectUrl: 'https://example.com/leech-warning.html',
      disableCompromisedAccounts: true,
      blockDurationMinutes: 60,
      whitelist: ['10.0.0.1']
    });
    assert(saveRes.status === 200 && saveRes.data.success, 'Save config returned HTTP 200 success');
    assert(saveRes.data.config.enabled === true, 'Leech protection is enabled');
    assert(saveRes.data.config.threshold === 3, 'Configured threshold is 3');

    // Check .htaccess on disk
    const htaccessPath = path.join(fullTestDir, '.htaccess');
    assert(fs.existsSync(htaccessPath), '.htaccess was generated in target directory');
    const htaccessContent = fs.readFileSync(htaccessPath, 'utf8');
    assert(htaccessContent.includes('# BEGIN CPANEL LEECH PROTECTION'), '.htaccess contains # BEGIN CPANEL LEECH PROTECTION');
    assert(htaccessContent.includes('Threshold: 3 logins'), '.htaccess contains Threshold: 3 logins');

    // 4. Sliding Window Detection: Access below threshold
    console.log('\n4. Testing Access Under Threshold...');
    const testIp = '198.51.100.' + (Math.floor(Math.random() * 200) + 10);
    // Attempt 1
    const att1 = await request('GET', `/api/leech/verify-access?user=${user}&directory=${testDir}&ip=${testIp}&authUser=${testUser}`);
    assert(att1.status === 200 && att1.data.blocked === false, 'Attempt 1 is allowed (under threshold)');
    assert(att1.data.currentAttempts === 1, 'Attempt count is 1');

    // Attempt 2
    const att2 = await request('GET', `/api/leech/verify-access?user=${user}&directory=${testDir}&ip=${testIp}&authUser=${testUser}`);
    assert(att2.status === 200 && att2.data.blocked === false, 'Attempt 2 is allowed (under threshold)');
    assert(att2.data.currentAttempts === 2, 'Attempt count is 2');

    // Attempt 3 (Threshold is 3, so 3 is still allowed)
    const att3 = await request('GET', `/api/leech/verify-access?user=${user}&directory=${testDir}&ip=${testIp}&authUser=${testUser}`);
    assert(att3.status === 200 && att3.data.blocked === false, 'Attempt 3 is allowed');

    // 5. Exceeding Threshold triggers Leech Violation
    console.log('\n5. Exceeding Threshold to Trigger Protective Actions...');
    // Attempt 4 -> Exceeds threshold!
    const att4 = await request('GET', `/api/leech/verify-access?user=${user}&directory=${testDir}&ip=${testIp}&authUser=${testUser}`);
    assert(att4.status === 200 && att4.data.blocked === true, 'Attempt 4 triggered Leech Protection violation');
    assert(att4.data.statusCode === 302, 'Redirect protective action triggered (302 Found)');
    assert(att4.data.redirectUrl === 'https://example.com/leech-warning.html', 'Redirects to configured warning URL');

    // 6. Verify Active Blocks & Events Recorded
    console.log('\n6. Verifying Active Blocks & Audit Events...');
    const blocksRes = await request('GET', `/api/leech/active-blocks?user=${user}`);
    assert(blocksRes.status === 200 && blocksRes.data.success, 'Active blocks endpoint returned HTTP 200');
    const hasBlock = blocksRes.data.blocks.find(b => b.ip === testIp);
    assert(!!hasBlock, 'Offending client IP is listed in active temporary blocks');
    assert(hasBlock.attemptsCount >= 4, 'Block record details attempts count');

    const eventsRes = await request('GET', `/api/leech/events?user=${user}`);
    assert(eventsRes.status === 200 && eventsRes.data.success, 'Events endpoint returned HTTP 200');
    const hasEvent = eventsRes.data.events.find(e => e.ip === testIp);
    assert(!!hasEvent, 'Violation event recorded in audit history');

    // Check .htpasswd disabled account
    const htpasswdUpdated = fs.readFileSync(htpasswdFile, 'utf8');
    assert(htpasswdUpdated.includes(`#DISABLED_LEECH# ${testUser}:`), 'Compromised account was disabled in .htpasswd');

    // 7. Manual IP Unblock
    console.log('\n7. Testing Manual IP Unblock...');
    const unblockRes = await request('POST', '/api/leech/unblock', {
      cpanelUser: user,
      ip: testIp
    });
    assert(unblockRes.status === 200 && unblockRes.data.success, 'Unblock endpoint returned HTTP 200');
    const blocksAfter = await request('GET', `/api/leech/active-blocks?user=${user}`);
    assert(!blocksAfter.data.blocks.some(b => b.ip === testIp), 'IP was removed from active blocks list');

    // 8. Whitelist Bypass
    console.log('\n8. Testing Whitelisted IP Bypass...');
    const whiteRes = await request('GET', `/api/leech/verify-access?user=${user}&directory=${testDir}&ip=10.0.0.1&authUser=${testUser}`);
    assert(whiteRes.status === 200 && whiteRes.data.whitelisted === true, 'Whitelisted IP is exempt from leech limits');

    // 9. Drift Detection & 1-Click Repair
    console.log('\n9. Testing Configuration Drift Detection & 1-Click Repair...');
    fs.writeFileSync(htaccessPath, '# User modified file\n', 'utf8');
    const driftRes = await request('GET', `/api/leech/config?user=${user}&directory=${testDir}`);
    assert(driftRes.data.inSync === false, 'Configuration drift detected when .htaccess rules were missing');

    const repairRes = await request('POST', '/api/leech/repair', {
      cpanelUser: user,
      directory: testDir
    });
    assert(repairRes.status === 200 && repairRes.data.success, 'Repair endpoint returned HTTP 200');
    assert(repairRes.data.config.inSync === true, 'Rules in sync after repair');
    const repairedHtaccess = fs.readFileSync(htaccessPath, 'utf8');
    assert(repairedHtaccess.includes('# BEGIN CPANEL LEECH PROTECTION'), 'Repaired .htaccess contains leech block');

    // 10. Clean Disable
    console.log('\n10. Disabling Leech Protection & Verifying Removal...');
    const disableRes = await request('POST', '/api/leech/toggle', {
      cpanelUser: user,
      directory: testDir,
      enabled: false
    });
    assert(disableRes.status === 200 && disableRes.data.success, 'Disable toggle returned HTTP 200');
    const disabledHtaccess = fs.readFileSync(htaccessPath, 'utf8');
    assert(!disabledHtaccess.includes('# BEGIN CPANEL LEECH PROTECTION'), 'Leech block removed from .htaccess');

    // 11. Multi-Tenant Account Isolation
    console.log('\n11. Testing Multi-Tenant Account Isolation...');
    const userBeta = 'tenant_beta';
    const betaDirs = await request('GET', `/api/leech/directories?user=${userBeta}`);
    assert(betaDirs.status === 200 && betaDirs.data.success, 'Tenant B directories queried');
    assert(!betaDirs.data.directories.some(d => d.canonicalRel === testDir), 'Tenant B cannot see Tenant A private directories');

    console.log(`\nAUDIT COMPLETE: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Unexpected error during audit:', err);
    process.exit(1);
  }
}

runAudit();
