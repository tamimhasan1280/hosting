const assert = require('assert');
const crypto = require('crypto');
const dynamicDnsService = require('./src/services/dynamicDnsService');
const dnsService = require('./src/services/dnsService');
const domainService = require('./src/services/domainService');

const BASE_URL = 'http://localhost:5000';
const TEST_USER = 'cpanel_user';
const TEST_DOMAIN = 'example.com';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

async function runAudit() {
  console.log('\n====================================================');
  console.log('🧪 RUNNING EXTENDED DYNAMIC DNS (PROMPT 23) AUDIT');
  console.log('====================================================\n');

  // --- SECTION 1: Hostname & IP Validation ---
  console.log('--- SECTION 1: Hostname & IP Validation ---');
  
  test('Hostname normalization handles root @ and subdomains', () => {
    assert.strictEqual(dynamicDnsService.normalizeHostname('home', TEST_DOMAIN), 'home.example.com');
    assert.strictEqual(dynamicDnsService.normalizeHostname('home.example.com', TEST_DOMAIN), 'home.example.com');
    assert.strictEqual(dynamicDnsService.normalizeHostname('@', TEST_DOMAIN), 'example.com');
    assert.strictEqual(dynamicDnsService.normalizeHostname('', TEST_DOMAIN), 'example.com');
  });

  test('Hostname rejects invalid characters and syntax', () => {
    assert.throws(() => dynamicDnsService.normalizeHostname('invalid_char$#', TEST_DOMAIN));
    assert.throws(() => dynamicDnsService.normalizeHostname('-badstart', TEST_DOMAIN));
    assert.throws(() => dynamicDnsService.normalizeHostname(null, TEST_DOMAIN));
    assert.throws(() => dynamicDnsService.normalizeHostname(12345, TEST_DOMAIN));
  });

  test('IP validation validates IPv4 accurately', () => {
    assert.strictEqual(dynamicDnsService.validateIp('203.0.113.195', 'A'), true);
    assert.strictEqual(dynamicDnsService.validateIp('127.0.0.1', 'A'), true);
    assert.strictEqual(dynamicDnsService.validateIp('0.0.0.0', 'A'), true);
    assert.strictEqual(dynamicDnsService.validateIp('255.255.255.255', 'A'), true);
    assert.strictEqual(dynamicDnsService.validateIp('256.0.0.1', 'A'), false);
    assert.strictEqual(dynamicDnsService.validateIp('999.0.0.1', 'A'), false);
    assert.strictEqual(dynamicDnsService.validateIp('abc.def.ghi.jkl', 'A'), false);
    assert.strictEqual(dynamicDnsService.validateIp('', 'A'), false);
    assert.strictEqual(dynamicDnsService.validateIp(null, 'A'), false);
  });

  test('IP validation validates IPv6 accurately', () => {
    assert.strictEqual(dynamicDnsService.validateIp('2001:db8::1', 'AAAA'), true);
    assert.strictEqual(dynamicDnsService.validateIp('::1', 'AAAA'), true);
    assert.strictEqual(dynamicDnsService.validateIp('fe80::1', 'AAAA'), true);
    assert.strictEqual(dynamicDnsService.validateIp('203.0.113.195', 'AAAA'), false);
    assert.strictEqual(dynamicDnsService.validateIp('2001:xyz::1', 'AAAA'), false);
  });

  // --- SECTION 2: Entry Creation & Cryptographic Security ---
  console.log('\n--- SECTION 2: Entry Creation & Token Security ---');

  let createdEntry1 = null;
  let rawToken1 = null;
  const host1 = `home-${Date.now().toString(36)}.example.com`;

  test('Create DDNS entry generates secure token and links DNS record', () => {
    const res = dynamicDnsService.createEntry({
      domain: TEST_DOMAIN,
      hostname: host1,
      type: 'A',
      ttl: 300,
      description: 'Home Router DDNS',
      initialIp: '203.0.113.10'
    }, TEST_USER);

    assert.strictEqual(res.success, true);
    assert.ok(res.entry.id);
    assert.strictEqual(res.entry.hostname, host1);
    assert.strictEqual(res.entry.type, 'A');
    assert.strictEqual(res.entry.currentIp, '203.0.113.10');
    assert.ok(res.rawToken && res.rawToken.startsWith('cpanel_ddns_'));
    
    // Raw token must be at least 48 characters with high entropy
    assert.ok(res.rawToken.length >= 48);

    createdEntry1 = res.entry;
    rawToken1 = res.rawToken;

    // Verify raw token is NEVER stored in database
    const db = domainService._read(TEST_USER);
    const inDb = (db.ddnsEntries || []).find(e => e.id === createdEntry1.id);
    assert.ok(inDb);
    assert.strictEqual(inDb.rawToken, undefined);
    assert.strictEqual(inDb.token, undefined);
    assert.ok(inDb.tokenHash);
    assert.strictEqual(inDb.tokenHash, crypto.createHash('sha256').update(rawToken1).digest('hex'));

    // Verify DNS record was actually created in dnsRecords
    const dnsRec = (db.dnsRecords || []).find(r => r.name.toLowerCase() === `${host1.toLowerCase()}.`);
    assert.ok(dnsRec, 'DNS record should exist in zone');
    assert.strictEqual(dnsRec.type, 'A');
    assert.strictEqual(dnsRec.record, '203.0.113.10');
    assert.strictEqual(dnsRec.ttl, 300);
  });

  test('Zone Editor sees the record created by Dynamic DNS', () => {
    const zone = dnsService.getZone(TEST_DOMAIN, TEST_USER);
    const foundInZone = zone.records.find(r => r.name.toLowerCase() === `${host1.toLowerCase()}.`);
    assert.ok(foundInZone, 'Zone Editor must see the record created by DDNS');
    assert.strictEqual(foundInZone.type, 'A');
    assert.strictEqual(foundInZone.record, '203.0.113.10');
  });

  test('Duplicate DDNS entry for same hostname and type is rejected', () => {
    assert.throws(() => {
      dynamicDnsService.createEntry({
        domain: TEST_DOMAIN,
        hostname: host1,
        type: 'A',
        ttl: 300,
        initialIp: '203.0.113.20'
      }, TEST_USER);
    });
  });

  test('Create AAAA (IPv6) entry works and synchronizes DNS zone', () => {
    const hostIpv6 = `ipv6-${Date.now().toString(36)}.example.com`;
    const res = dynamicDnsService.createEntry({
      domain: TEST_DOMAIN,
      hostname: hostIpv6,
      type: 'AAAA',
      ttl: 300,
      description: 'IPv6 Workstation',
      initialIp: '2001:db8::cafe:1'
    }, TEST_USER);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.entry.type, 'AAAA');
    assert.strictEqual(res.entry.currentIp, '2001:db8::cafe:1');

    const db = domainService._read(TEST_USER);
    const dnsRec = (db.dnsRecords || []).find(r => r.name.toLowerCase() === `${hostIpv6.toLowerCase()}.`);
    assert.ok(dnsRec);
    assert.strictEqual(dnsRec.type, 'AAAA');
    assert.strictEqual(dnsRec.record, '2001:db8::cafe:1');
  });

  test('Create entry with invalid TTL (< 300 or > 604800) is rejected', () => {
    assert.throws(() => {
      dynamicDnsService.createEntry({
        domain: TEST_DOMAIN,
        hostname: `ttl-low-${Date.now().toString(36)}.example.com`,
        type: 'A',
        ttl: 60
      }, TEST_USER);
    });
    assert.throws(() => {
      dynamicDnsService.createEntry({
        domain: TEST_DOMAIN,
        hostname: `ttl-high-${Date.now().toString(36)}.example.com`,
        type: 'A',
        ttl: 9999999
      }, TEST_USER);
    });
  });

  test('Create entry for unauthorized domain is rejected', () => {
    assert.throws(() => {
      dynamicDnsService.createEntry({
        domain: 'not-my-domain.net',
        hostname: 'router.not-my-domain.net',
        type: 'A'
      }, TEST_USER);
    });
  });

  // --- SECTION 3: Authenticated Management APIs ---
  console.log('\n--- SECTION 3: Authenticated Management APIs ---');

  await testAsync('GET /api/ddns returns list with masked tokens', async () => {
    const res = await fetch(`${BASE_URL}/api/ddns?user=${TEST_USER}`).then(r => r.json());
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.entries));
    const found = res.entries.find(e => e.id === createdEntry1.id);
    assert.ok(found);
    assert.strictEqual(found.tokenHash, undefined);
    assert.ok(found.tokenMasked.includes('••••'));
  });

  await testAsync('GET /api/ddns/:id returns single sanitized entry', async () => {
    const res = await fetch(`${BASE_URL}/api/ddns/${createdEntry1.id}?user=${TEST_USER}`).then(r => r.json());
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.entry.id, createdEntry1.id);
    assert.strictEqual(res.entry.hostname, host1);
    assert.strictEqual(res.entry.tokenHash, undefined);
  });

  await testAsync('GET /api/ddns/:id for non-existent ID returns 404', async () => {
    const res = await fetch(`${BASE_URL}/api/ddns/non_existent_id?user=${TEST_USER}`);
    assert.strictEqual(res.status, 404);
  });

  await testAsync('GET /api/ddns/detect-ip detects IP accurately', async () => {
    const res = await fetch(`${BASE_URL}/api/ddns/detect-ip`).then(r => r.json());
    assert.strictEqual(res.success, true);
    assert.ok(res.ip);
  });

  await testAsync('PUT /api/ddns/:id updates TTL and propagates to DNS zone', async () => {
    const res = await fetch(`${BASE_URL}/api/ddns/${createdEntry1.id}?user=${TEST_USER}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 600, description: 'Updated Router Description' })
    }).then(r => r.json());

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.entry.ttl, 600);
    assert.strictEqual(res.entry.description, 'Updated Router Description');

    const db = domainService._read(TEST_USER);
    const dnsRec = (db.dnsRecords || []).find(r => r.name.toLowerCase() === `${host1.toLowerCase()}.`);
    assert.strictEqual(dnsRec.ttl, 600);
  });

  // --- SECTION 4: Public Machine-Readable Update Engine ---
  console.log('\n--- SECTION 4: Public Machine-Readable Update Engine ---');

  await testAsync('Public update rejects missing or invalid token with badauth', async () => {
    const res1 = await fetch(`${BASE_URL}/api/ddns/update`);
    assert.strictEqual(res1.status, 401);
    const txt1 = await res1.text();
    assert.strictEqual(txt1.trim(), 'badauth');

    const res2 = await fetch(`${BASE_URL}/api/ddns/update?token=cpanel_ddns_invalidtoken12345`);
    assert.strictEqual(res2.status, 401);
    const txt2 = await res2.text();
    assert.strictEqual(txt2.trim(), 'badauth');
  });

  await testAsync('Public update rejects hostname mismatch with nohost', async () => {
    const res = await fetch(`${BASE_URL}/api/ddns/update?token=${rawToken1}&hostname=wrong-host.example.com`);
    assert.strictEqual(res.status, 400);
    const txt = await res.text();
    assert.strictEqual(txt.trim(), 'nohost');
  });

  await testAsync('Public update rejects invalid IP format with badagent', async () => {
    const res = await fetch(`${BASE_URL}/api/ddns/update?token=${rawToken1}&hostname=${host1}&ip=999.999.999.999`);
    assert.strictEqual(res.status, 400);
    const txt = await res.text();
    assert.strictEqual(txt.trim(), 'badagent');
  });

  await testAsync('Public update nochange optimization returns nochg without DNS writes', async () => {
    // Current IP is 203.0.113.10
    const res = await fetch(`${BASE_URL}/api/ddns/update?token=${rawToken1}&hostname=${host1}&ip=203.0.113.10`);
    assert.strictEqual(res.status, 200);
    const txt = await res.text();
    assert.strictEqual(txt.trim(), 'nochg 203.0.113.10');
  });

  await testAsync('Public update JSON mode returns structured payload', async () => {
    const res = await fetch(`${BASE_URL}/api/ddns/update?token=${rawToken1}&hostname=${host1}&ip=203.0.113.10&format=json`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, 'nochange');
    assert.strictEqual(json.ip, '203.0.113.10');
    assert.strictEqual(json.hostname, host1);
  });

  await testAsync('Public update IP change updates DNS record and returns good <ip>', async () => {
    const NEW_IP = '198.51.100.77';
    const res = await fetch(`${BASE_URL}/api/ddns/update?token=${rawToken1}&hostname=${host1}&ip=${NEW_IP}`);
    assert.strictEqual(res.status, 200);
    const txt = await res.text();
    assert.strictEqual(txt.trim(), `good ${NEW_IP}`);

    // Verify DNS record was actually updated in authoritative storage
    const db = domainService._read(TEST_USER);
    const dnsRec = (db.dnsRecords || []).find(r => r.name.toLowerCase() === `${host1.toLowerCase()}.`);
    assert.strictEqual(dnsRec.record, NEW_IP);

    const entry = (db.ddnsEntries || []).find(e => e.id === createdEntry1.id);
    assert.strictEqual(entry.currentIp, NEW_IP);
    assert.strictEqual(entry.lastUpdateStatus, 'good');
    assert.strictEqual(entry.updateCount, 1);
  });

  await testAsync('Public update via myip alias parameter works', async () => {
    const MYIP = '198.51.100.82';
    const res = await fetch(`${BASE_URL}/api/ddns/update?token=${rawToken1}&hostname=${host1}&myip=${MYIP}`);
    assert.strictEqual(res.status, 200);
    const txt = await res.text();
    assert.strictEqual(txt.trim(), `good ${MYIP}`);
  });

  await testAsync('Public update via key alias parameter works', async () => {
    const KEY_IP = '198.51.100.85';
    const res = await fetch(`${BASE_URL}/api/ddns/update?key=${rawToken1}&hostname=${host1}&ip=${KEY_IP}`);
    assert.strictEqual(res.status, 200);
    const txt = await res.text();
    assert.strictEqual(txt.trim(), `good ${KEY_IP}`);
  });

  await testAsync('Public update via Bearer authorization header works', async () => {
    const BEARER_IP = '198.51.100.88';
    const res = await fetch(`${BASE_URL}/api/ddns/update?hostname=${host1}&ip=${BEARER_IP}`, {
      headers: { 'Authorization': `Bearer ${rawToken1}` }
    });
    assert.strictEqual(res.status, 200);
    const txt = await res.text();
    assert.strictEqual(txt.trim(), `good ${BEARER_IP}`);
  });

  await testAsync('Public update via Basic authorization header works', async () => {
    const BASIC_IP = '198.51.100.99';
    const credentials = Buffer.from(`${TEST_USER}:${rawToken1}`).toString('base64');
    const res = await fetch(`${BASE_URL}/api/ddns/update?hostname=${host1}&ip=${BASIC_IP}`, {
      headers: { 'Authorization': `Basic ${credentials}` }
    });
    assert.strictEqual(res.status, 200);
    const txt = await res.text();
    assert.strictEqual(txt.trim(), `good ${BASIC_IP}`);
  });

  await testAsync('Standard root router endpoint /nic/update works identically', async () => {
    const ROUTER_IP = '198.51.100.111';
    const res = await fetch(`${BASE_URL}/nic/update?token=${rawToken1}&hostname=${host1}&ip=${ROUTER_IP}`);
    assert.strictEqual(res.status, 200);
    const txt = await res.text();
    assert.strictEqual(txt.trim(), `good ${ROUTER_IP}`);
  });

  // --- SECTION 5: Token Regeneration & Revocation ---
  console.log('\n--- SECTION 5: Token Regeneration & Revocation ---');

  let rawToken2 = null;
  await testAsync('Token regeneration generates new token and invalidates old one immediately', async () => {
    const res = await fetch(`${BASE_URL}/api/ddns/${createdEntry1.id}/regenerate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpanelUser: TEST_USER })
    }).then(r => r.json());

    assert.strictEqual(res.success, true);
    assert.ok(res.rawToken);
    assert.notStrictEqual(res.rawToken, rawToken1);
    rawToken2 = res.rawToken;

    // Old token must immediately fail with 401 badauth
    const oldRes = await fetch(`${BASE_URL}/api/ddns/update?token=${rawToken1}&hostname=${host1}&ip=198.51.100.123`);
    assert.strictEqual(oldRes.status, 401);
    const oldTxt = await oldRes.text();
    assert.strictEqual(oldTxt.trim(), 'badauth');

    // New token must succeed
    const newRes = await fetch(`${BASE_URL}/api/ddns/update?token=${rawToken2}&hostname=${host1}&ip=198.51.100.123`);
    assert.strictEqual(newRes.status, 200);
    const newTxt = await newRes.text();
    assert.strictEqual(newTxt.trim(), 'good 198.51.100.123');
  });

  // --- SECTION 6: Toggle Status (Enable/Disable) ---
  console.log('\n--- SECTION 6: Status Toggle (Enable/Disable) ---');

  await testAsync('Disabling entry rejects updates with 403 abuse', async () => {
    // Toggle to disable
    const toggleRes = await fetch(`${BASE_URL}/api/ddns/${createdEntry1.id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpanelUser: TEST_USER })
    }).then(r => r.json());
    assert.strictEqual(toggleRes.success, true);
    assert.strictEqual(toggleRes.entry.enabled, false);

    // Update must fail with abuse
    const upRes = await fetch(`${BASE_URL}/api/ddns/update?token=${rawToken2}&hostname=${host1}&ip=198.51.100.200`);
    assert.strictEqual(upRes.status, 403);
    const upTxt = await upRes.text();
    assert.strictEqual(upTxt.trim(), 'abuse');

    // Re-enable
    await fetch(`${BASE_URL}/api/ddns/${createdEntry1.id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpanelUser: TEST_USER })
    });
  });

  // --- SECTION 7: Rate Limiting ---
  console.log('\n--- SECTION 7: Rate Limiting ---');

  test('Rate limit permits normal cadence and throttles excessive requests', () => {
    const dummyHash = 'test_dummy_token_hash_rate_limit';
    for (let i = 0; i < 60; i++) {
      assert.strictEqual(dynamicDnsService.checkRateLimit(dummyHash), true);
    }
    // 61st should be throttled
    assert.strictEqual(dynamicDnsService.checkRateLimit(dummyHash), false);
  });

  // --- SECTION 8: Deletion with DNS Record Cleanup ---
  console.log('\n--- SECTION 8: Deletion & Cleanup ---');

  await testAsync('Delete DDNS entry and linked DNS record removes both', async () => {
    const res = await fetch(`${BASE_URL}/api/ddns/${createdEntry1.id}?deleteDnsRecord=true&user=${TEST_USER}`, {
      method: 'DELETE'
    }).then(r => r.json());

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.dnsDeleted, true);

    const db = domainService._read(TEST_USER);
    const foundEntry = (db.ddnsEntries || []).find(e => e.id === createdEntry1.id);
    assert.strictEqual(foundEntry, undefined);

    const foundDns = (db.dnsRecords || []).find(r => r.name.toLowerCase() === `${host1.toLowerCase()}.`);
    assert.strictEqual(foundDns, undefined);
  });

  // --- SECTION 9: Multi-Tenant Account Isolation ---
  console.log('\n--- SECTION 9: Multi-Tenant Account Isolation ---');

  test('User B cannot see or manipulate User A DDNS records', () => {
    const userAEntry = dynamicDnsService.createEntry({
      domain: TEST_DOMAIN,
      hostname: `isolated-a-${Date.now().toString(36)}.example.com`,
      type: 'A',
      initialIp: '203.0.113.250'
    }, 'cpanel_user');

    const userBEntries = dynamicDnsService.getEntries('other_user_test');
    const leak = userBEntries.find(e => e.id === userAEntry.entry.id);
    assert.strictEqual(leak, undefined, 'User B must not see User A DDNS entries');

    // Clean up
    dynamicDnsService.deleteEntry(userAEntry.entry.id, true, 'cpanel_user');
  });

  // Summary
  console.log('\n====================================================');
  console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
