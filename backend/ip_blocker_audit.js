const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const storageService = require('./src/services/storageService');
const ipBlockerService = require('./src/services/ipBlockerService');

const BASE_URL = 'http://localhost:5000/api';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runAudit() {
  console.log('====================================================');
  console.log('AUDIT: FEATURE #36 - IP BLOCKER IMPLEMENTATION');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    return fn()
      .then(() => {
        console.log(`  [PASS] Test ${total}: ${name}`);
        passed++;
      })
      .catch(err => {
        console.error(`  [FAIL] Test ${total}: ${name}`);
        console.error(`         Error: ${err.message}`);
      });
  }

  // TEST 1: Capabilities Discovery
  await test('GET /api/ip-blocker/capabilities returns supported web server and IP versions', async () => {
    const res = await request('GET', '/ip-blocker/capabilities');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.webServer);
    assert.strictEqual(res.data.ipv4Supported, true);
    assert.strictEqual(res.data.ipv6Supported, true);
    assert.strictEqual(res.data.serverFirewallAccess, false, 'Tenant must not control root firewall');
  });

  // TEST 2: Add valid IPv4 block and verify .htaccess
  let ipv4RecordId = null;
  await test('POST /api/ip-blocker/block adds valid IPv4 rule to .htaccess', async () => {
    const res = await request('POST', '/ip-blocker/block', {
      cpanelUser: 'cpanel_user',
      ip: '203.0.113.45'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.record.ip, '203.0.113.45');
    assert.strictEqual(res.data.record.version, 'IPv4');
    assert.strictEqual(res.data.record.status, 'Active');

    ipv4RecordId = res.data.record.id;

    // Check .htaccess on disk
    const htaccessPath = path.join(storageService.getRootDir('cpanel_user'), 'public_html', '.htaccess');
    assert.ok(fs.existsSync(htaccessPath), '.htaccess must exist');
    const content = fs.readFileSync(htaccessPath, 'utf8');
    assert.ok(content.includes('Require not ip 203.0.113.45'), 'Rule must be present in .htaccess');
    assert.ok(content.includes('# BEGIN CPANEL IP BLOCKER'), 'Managed begin marker must be present');
    assert.ok(content.includes('# END CPANEL IP BLOCKER'), 'Managed end marker must be present');
  });

  // TEST 3: Add valid IPv6 block
  let ipv6RecordId = null;
  await test('POST /api/ip-blocker/block adds valid IPv6 rule to .htaccess', async () => {
    const res = await request('POST', '/ip-blocker/block', {
      cpanelUser: 'cpanel_user',
      ip: '2001:db8:85a3::8a2e:370:7334'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.record.version, 'IPv6');

    ipv6RecordId = res.data.record.id;

    const htaccessPath = path.join(storageService.getRootDir('cpanel_user'), 'public_html', '.htaccess');
    const content = fs.readFileSync(htaccessPath, 'utf8');
    assert.ok(content.includes('Require not ip 2001:db8:85a3::8a2e:370:7334'));
  });

  // TEST 4: Duplicate block prevention
  await test('POST /api/ip-blocker/block rejects duplicate IP addresses', async () => {
    const res = await request('POST', '/ip-blocker/block', {
      cpanelUser: 'cpanel_user',
      ip: '203.0.113.45'
    });

    assert.strictEqual(res.status, 400);
    assert.ok(res.data.error.includes('already blocked'));
  });

  // TEST 5: Invalid IP syntax rejection
  await test('POST /api/ip-blocker/block rejects malformed or invalid IP addresses', async () => {
    const malformed1 = await request('POST', '/ip-blocker/block', { cpanelUser: 'cpanel_user', ip: '999.999.999.999' });
    assert.strictEqual(malformed1.status, 400);

    const malformed2 = await request('POST', '/ip-blocker/block', { cpanelUser: 'cpanel_user', ip: '1.2.3' });
    assert.strictEqual(malformed2.status, 400);

    const malformed3 = await request('POST', '/ip-blocker/block', { cpanelUser: 'cpanel_user', ip: 'evil.domain.com' });
    assert.strictEqual(malformed3.status, 400);

    const malformed4 = await request('POST', '/ip-blocker/block', { cpanelUser: 'cpanel_user', ip: '203.0.113.45; rm -rf /' });
    assert.strictEqual(malformed4.status, 400);
  });

  // TEST 6: Special/Loopback address rejection
  await test('POST /api/ip-blocker/block rejects loopback, all-zeros, and broadcast addresses', async () => {
    const loop1 = await request('POST', '/ip-blocker/block', { cpanelUser: 'cpanel_user', ip: '127.0.0.1' });
    assert.strictEqual(loop1.status, 400);
    assert.ok(loop1.data.error.includes('Loopback'));

    const loop2 = await request('POST', '/ip-blocker/block', { cpanelUser: 'cpanel_user', ip: '::1' });
    assert.strictEqual(loop2.status, 400);

    const bcast = await request('POST', '/ip-blocker/block', { cpanelUser: 'cpanel_user', ip: '255.255.255.255' });
    assert.strictEqual(bcast.status, 400);
  });

  // TEST 7: Real traffic verification (403 Forbidden for blocked IP)
  await test('GET /api/ip-blocker/verify-access returns 403 Forbidden for blocked IP', async () => {
    const resBlocked = await request('GET', '/ip-blocker/verify-access?user=cpanel_user&ip=203.0.113.45');
    assert.strictEqual(resBlocked.status, 200);
    assert.strictEqual(resBlocked.data.allowed, false);
    assert.strictEqual(resBlocked.data.httpStatus, 403);
    assert.strictEqual(resBlocked.data.statusText, 'Forbidden');
    assert.ok(resBlocked.data.reason.includes('.htaccess'));

    // Allowed IP should return 200 OK
    const resAllowed = await request('GET', '/ip-blocker/verify-access?user=cpanel_user&ip=198.51.100.99');
    assert.strictEqual(resAllowed.status, 200);
    assert.strictEqual(resAllowed.data.allowed, true);
    assert.strictEqual(resAllowed.data.httpStatus, 200);
  });

  // TEST 8: List blocked IPs
  await test('GET /api/ip-blocker/list returns active rules for authenticated account', async () => {
    const res = await request('GET', '/ip-blocker/list?user=cpanel_user');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.blockedIps));
    assert.ok(res.data.blockedIps.some(item => item.ip === '203.0.113.45'));
    assert.ok(res.data.blockedIps.some(item => item.ip === '2001:db8:85a3::8a2e:370:7334'));
  });

  // TEST 9: Unblock operation
  await test('POST /api/ip-blocker/unblock removes rule from .htaccess and metadata', async () => {
    const unblockRes = await request('POST', '/ip-blocker/unblock', {
      cpanelUser: 'cpanel_user',
      ip: '203.0.113.45',
      recordId: ipv4RecordId
    });

    assert.strictEqual(unblockRes.status, 200);
    assert.strictEqual(unblockRes.data.success, true);

    // Verify removed from .htaccess
    const htaccessPath = path.join(storageService.getRootDir('cpanel_user'), 'public_html', '.htaccess');
    const content = fs.readFileSync(htaccessPath, 'utf8');
    assert.ok(!content.includes('Require not ip 203.0.113.45'), 'Unblocked IP must be removed from .htaccess');

    // Clean up IPv6 rule as well
    await request('POST', '/ip-blocker/unblock', {
      cpanelUser: 'cpanel_user',
      recordId: ipv6RecordId
    });
  });

  // TEST 10: Traffic verification after unblock returns 200 Allowed
  await test('GET /api/ip-blocker/verify-access confirms traffic restored to 200 Allowed after unblock', async () => {
    const res = await request('GET', '/ip-blocker/verify-access?user=cpanel_user&ip=203.0.113.45');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.allowed, true);
    assert.strictEqual(res.data.httpStatus, 200);
  });

  // TEST 11: Multi-tenant account isolation
  await test('Account isolation: User A cannot see, block, or unblock User B rules', async () => {
    // Add block under client_auto1
    const addB = await request('POST', '/ip-blocker/block', {
      cpanelUser: 'client_auto1',
      ip: '198.51.100.77'
    });
    assert.strictEqual(addB.status, 200);

    // User A should not see User B's blocked IP
    const listA = await request('GET', '/ip-blocker/list?user=cpanel_user');
    assert.ok(!listA.data.blockedIps.some(i => i.ip === '198.51.100.77'));

    // User A attempting to unblock User B's IP must fail
    const attackUnblock = await request('POST', '/ip-blocker/unblock', {
      cpanelUser: 'cpanel_user',
      recordId: addB.data.record.id
    });
    assert.strictEqual(attackUnblock.status, 400);

    // Clean up User B
    await request('POST', '/ip-blocker/unblock', { cpanelUser: 'client_auto1', recordId: addB.data.record.id });
  });

  // TEST 12: Preserves unrelated .htaccess rules (e.g. Redirects)
  await test('.htaccess retains unrelated directives outside the managed block intact', async () => {
    const htaccessPath = path.join(storageService.getRootDir('cpanel_user'), 'public_html', '.htaccess');
    const content = fs.readFileSync(htaccessPath, 'utf8');
    assert.ok(content.includes('# BEGIN MANAGED REDIRECTS'), 'Redirect block must remain intact');
    assert.ok(content.includes('RewriteEngine On'), 'RewriteEngine must remain intact');
  });

  console.log(`\nAUDIT COMPLETE: ${passed}/${total} tests passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
