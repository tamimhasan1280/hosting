/**
 * zone_editor_audit.js — PROMPT 22: Zone Editor Full Audit
 * Tests service operations, RFC syntax validations, conflict detection,
 * protected records, BIND export, zone reset, SSRF-safe lookup, and REST API.
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function ok(label, fn) {
  try {
    fn();
    console.log(`  [PASS] ${label}`);
    passed++;
  } catch (e) {
    console.error(`  [FAIL] ${label}: ${e.message}`);
    failed++;
  }
}

async function okAsync(label, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${label}`);
    passed++;
  } catch (e) {
    console.error(`  [FAIL] ${label}: ${e.message}`);
    failed++;
  }
}

function expectThrows(label, fn, match) {
  try {
    fn();
    console.error(`  [FAIL] ${label}: Expected error but got none`);
    failed++;
  } catch (e) {
    if (match && !e.message.toLowerCase().includes(match.toLowerCase())) {
      console.error(`  [FAIL] ${label}: Error "${e.message}" doesn't match expected "${match}"`);
      failed++;
    } else {
      console.log(`  [PASS] ${label}`);
      passed++;
    }
  }
}

async function expectThrowsAsync(label, fn, match) {
  try {
    await fn();
    console.error(`  [FAIL] ${label}: Expected error but got none`);
    failed++;
  } catch (e) {
    if (match && !e.message.toLowerCase().includes(match.toLowerCase())) {
      console.error(`  [FAIL] ${label}: Error "${e.message}" doesn't match expected "${match}"`);
      failed++;
    } else {
      console.log(`  [PASS] ${label}`);
      passed++;
    }
  }
}


function httpGet(p, user = 'dns_audit_user') {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: 5000, path: p, method: 'GET',
      headers: { 'X-cPanel-User': user }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.end();
  });
}

function httpPost(p, data, user = 'dns_audit_user') {
  return new Promise((resolve) => {
    const body = JSON.stringify(data || {});
    const req = http.request({
      hostname: 'localhost', port: 5000, path: p, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-cPanel-User': user }
    }, (res) => {
      let respBody = '';
      res.on('data', d => respBody += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(respBody) }); }
        catch { resolve({ status: res.statusCode, body: respBody }); }
      });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.write(body);
    req.end();
  });
}

function httpPut(p, data, user = 'dns_audit_user') {
  return new Promise((resolve) => {
    const body = JSON.stringify(data || {});
    const req = http.request({
      hostname: 'localhost', port: 5000, path: p, method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-cPanel-User': user }
    }, (res) => {
      let respBody = '';
      res.on('data', d => respBody += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(respBody) }); }
        catch { resolve({ status: res.statusCode, body: respBody }); }
      });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.write(body);
    req.end();
  });
}

function httpDelete(p, user = 'dns_audit_user') {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: 5000, path: p, method: 'DELETE',
      headers: { 'X-cPanel-User': user }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.end();
  });
}

const dnsService = require('./src/services/dnsService');
const domainService = require('./src/services/domainService');
const TEST_USER = 'dns_audit_user_22';
const TEST_DOMAIN = 'dns_audit_user_22.com';

console.log('\n=== STARTING ZONE EDITOR (PROMPT 22) FULL AUDIT ===\n');

// Clean test user data
const initialData = domainService._read(TEST_USER);
initialData.dnsRecords = [];
domainService._write(initialData, TEST_USER);

// --------------------------------------------------------
console.log('--- 1. Domain Ownership & Zone Inventory ---');
// --------------------------------------------------------
ok('getZones returns authorized domains for user', () => {
  const zones = dnsService.getZones(TEST_USER);
  assert.ok(Array.isArray(zones), 'zones is array');
  assert.ok(zones.length >= 1, 'at least 1 zone');
  assert.strictEqual(zones[0].name, TEST_DOMAIN);
  assert.strictEqual(zones[0].status, 'Active');
});

ok('verifyDomainOwnership accepts owned domain', () => {
  const verified = dnsService.verifyDomainOwnership(TEST_DOMAIN, TEST_USER);
  assert.strictEqual(verified, TEST_DOMAIN);
});

expectThrows('verifyDomainOwnership rejects unauthorized domain', () => {
  dnsService.verifyDomainOwnership('not-my-domain.org', TEST_USER);
}, 'not authorized');

ok('getZone returns zone metadata and records', () => {
  const zone = dnsService.getZone(TEST_DOMAIN, TEST_USER);
  assert.strictEqual(zone.domain, TEST_DOMAIN);
  assert.strictEqual(zone.status, 'Active');
  assert.ok(Array.isArray(zone.records));
  assert.ok(zone.records.length >= 1);
});

// --------------------------------------------------------
console.log('\n--- 2. A and AAAA Records Validation & CRUD ---');
// --------------------------------------------------------
let aRecId;
ok('Add valid A record (IPv4)', () => {
  const res = dnsService.addRecord(TEST_DOMAIN, {
    type: 'A',
    name: 'api',
    record: '198.51.100.25',
    ttl: 14400
  }, TEST_USER);
  assert.ok(res.success);
  assert.strictEqual(res.record.type, 'A');
  assert.strictEqual(res.record.name, `api.${TEST_DOMAIN}.`);
  assert.strictEqual(res.record.record, '198.51.100.25');
  aRecId = res.record.id;
});

expectThrows('Reject invalid IPv4 for A record (out of range)', () => {
  dnsService.addRecord(TEST_DOMAIN, {
    type: 'A',
    name: 'bad',
    record: '999.1.1.1',
    ttl: 14400
  }, TEST_USER);
}, 'invalid ipv4');

expectThrows('Reject non-IP string for A record', () => {
  dnsService.addRecord(TEST_DOMAIN, {
    type: 'A',
    name: 'bad2',
    record: 'not-an-ip',
    ttl: 14400
  }, TEST_USER);
}, 'invalid ipv4');

let aaaaRecId;
ok('Add valid AAAA record (IPv6)', () => {
  const res = dnsService.addRecord(TEST_DOMAIN, {
    type: 'AAAA',
    name: 'ipv6',
    record: '2001:db8::1',
    ttl: 14400
  }, TEST_USER);
  assert.ok(res.success);
  assert.strictEqual(res.record.type, 'AAAA');
  aaaaRecId = res.record.id;
});

expectThrows('Reject invalid IPv6 for AAAA record', () => {
  dnsService.addRecord(TEST_DOMAIN, {
    type: 'AAAA',
    name: 'bad6',
    record: '2001:xyz::1',
    ttl: 14400
  }, TEST_USER);
}, 'invalid ipv6');

// --------------------------------------------------------
console.log('\n--- 3. CNAME Records & Conflict Defenses ---');
// --------------------------------------------------------
let cnameRecId;
ok('Add valid CNAME record', () => {
  const res = dnsService.addRecord(TEST_DOMAIN, {
    type: 'CNAME',
    name: 'blog',
    record: 'cdn.example.org.',
    ttl: 14400
  }, TEST_USER);
  assert.ok(res.success);
  assert.strictEqual(res.record.type, 'CNAME');
  cnameRecId = res.record.id;
});

expectThrows('Reject CNAME with IP address as target', () => {
  dnsService.addRecord(TEST_DOMAIN, {
    type: 'CNAME',
    name: 'cname-ip',
    record: '192.0.2.1',
    ttl: 14400
  }, TEST_USER);
}, 'cannot be an ip address');

expectThrows('Reject CNAME at zone apex (@)', () => {
  dnsService.addRecord(TEST_DOMAIN, {
    type: 'CNAME',
    name: '@',
    record: 'target.com.',
    ttl: 14400
  }, TEST_USER);
}, 'zone apex');

expectThrows('Reject CNAME collision where other record exists', () => {
  // api.dns_audit_user_22.com already has an A record
  dnsService.addRecord(TEST_DOMAIN, {
    type: 'CNAME',
    name: 'api',
    record: 'target.com.',
    ttl: 14400
  }, TEST_USER);
}, 'other record types');

// --------------------------------------------------------
console.log('\n--- 4. MX, TXT, NS, SRV, CAA Validation ---');
// --------------------------------------------------------
ok('Add valid MX record with priority', () => {
  const res = dnsService.addRecord(TEST_DOMAIN, {
    type: 'MX',
    name: '@',
    record: 'mail.google.com.',
    priority: 10,
    ttl: 14400
  }, TEST_USER);
  assert.ok(res.success);
  assert.strictEqual(res.record.priority, 10);
});

expectThrows('Reject MX record with IP address destination', () => {
  dnsService.addRecord(TEST_DOMAIN, {
    type: 'MX',
    name: '@',
    record: '192.0.2.5',
    priority: 10,
    ttl: 14400
  }, TEST_USER);
}, 'cannot be an ip address');

expectThrows('Reject MX record with invalid priority', () => {
  dnsService.addRecord(TEST_DOMAIN, {
    type: 'MX',
    name: '@',
    record: 'mail.example.com.',
    priority: -5,
    ttl: 14400
  }, TEST_USER);
}, 'priority');

ok('Add valid TXT record', () => {
  const res = dnsService.addRecord(TEST_DOMAIN, {
    type: 'TXT',
    name: '@',
    record: '"v=spf1 include:_spf.google.com ~all"',
    ttl: 14400
  }, TEST_USER);
  assert.ok(res.success);
});

expectThrows('Reject CRLF in TXT record (Header Injection prevention)', () => {
  dnsService.addRecord(TEST_DOMAIN, {
    type: 'TXT',
    name: 'inj',
    record: 'test\r\ninjected: header',
    ttl: 14400
  }, TEST_USER);
}, 'control characters');

ok('Add valid SRV record', () => {
  const res = dnsService.addRecord(TEST_DOMAIN, {
    type: 'SRV',
    name: '_sip._tcp',
    record: 'sipserver.example.com.',
    priority: 10,
    weight: 60,
    port: 5060,
    ttl: 14400
  }, TEST_USER);
  assert.ok(res.success);
  assert.strictEqual(res.record.port, 5060);
});

ok('Add valid CAA record', () => {
  const res = dnsService.addRecord(TEST_DOMAIN, {
    type: 'CAA',
    name: '@',
    record: 'letsencrypt.org',
    flag: 0,
    tag: 'issue',
    ttl: 14400
  }, TEST_USER);
  assert.ok(res.success);
  assert.strictEqual(res.record.tag, 'issue');
});

// --------------------------------------------------------
console.log('\n--- 5. Duplicate Record & TTL Validations ---');
// --------------------------------------------------------
expectThrows('Reject exact duplicate record', () => {
  dnsService.addRecord(TEST_DOMAIN, {
    type: 'A',
    name: 'api',
    record: '198.51.100.25',
    ttl: 14400
  }, TEST_USER);
}, 'already exists');

expectThrows('Reject TTL below minimum (300 seconds)', () => {
  dnsService.addRecord(TEST_DOMAIN, {
    type: 'A',
    name: 'ttlbad',
    record: '1.2.3.4',
    ttl: 60
  }, TEST_USER);
}, 'ttl must be');

// --------------------------------------------------------
console.log('\n--- 6. Record Updates & Protected Records ---');
// --------------------------------------------------------
ok('Update existing A record IP', () => {
  const res = dnsService.updateRecord(TEST_DOMAIN, aRecId, {
    record: '198.51.100.99',
    ttl: 7200
  }, TEST_USER);
  assert.ok(res.success);
  assert.strictEqual(res.record.record, '198.51.100.99');
  assert.strictEqual(res.record.ttl, 7200);
});

expectThrows('Reject modifying protected SOA record', () => {
  dnsService.updateRecord(TEST_DOMAIN, `soa_${TEST_DOMAIN.replace(/[^a-z0-9]/g, '_')}`, {
    record: 'modified'
  }, TEST_USER);
}, 'protected');

expectThrows('Reject deleting protected root SOA/NS record', () => {
  dnsService.deleteRecord(TEST_DOMAIN, `soa_${TEST_DOMAIN.replace(/[^a-z0-9]/g, '_')}`, TEST_USER);
}, 'protected');

// --------------------------------------------------------
console.log('\n--- 7. Record Deletion ---');
// --------------------------------------------------------
ok('Delete created AAAA record', () => {
  const res = dnsService.deleteRecord(TEST_DOMAIN, aaaaRecId, TEST_USER);
  assert.ok(res.success);
  const zone = dnsService.getZone(TEST_DOMAIN, TEST_USER);
  assert.ok(!zone.records.find(r => r.id === aaaaRecId));
});

// --------------------------------------------------------
console.log('\n--- 8. BIND 9 Zone Export ---');
// --------------------------------------------------------
ok('Export zone generates valid BIND 9 format', () => {
  const exp = dnsService.exportZone(TEST_DOMAIN, TEST_USER);
  assert.ok(exp.success);
  assert.strictEqual(exp.format, 'BIND 9');
  assert.ok(exp.zoneContent.includes(`$ORIGIN ${TEST_DOMAIN}.`));
  assert.ok(exp.zoneContent.includes('$TTL 14400'));
  assert.ok(exp.zoneContent.includes('IN  A'));
  assert.ok(exp.zoneContent.includes('IN  MX'));
  assert.ok(exp.zoneContent.includes('IN  TXT'));
});

// --------------------------------------------------------
console.log('\n--- 9. Zone Reset ---');
// --------------------------------------------------------
ok('Reset zone clears custom records and restores standard defaults', () => {
  const res = dnsService.resetZone(TEST_DOMAIN, TEST_USER);
  assert.ok(res.success);
  assert.ok(res.records.find(r => r.type === 'A'));
  assert.ok(res.records.find(r => r.type === 'CNAME'));
  assert.ok(res.records.find(r => r.type === 'MX'));
  assert.ok(res.records.find(r => r.type === 'TXT'));
  // Old custom api record should be gone
  assert.ok(!res.records.find(r => r.record === '198.51.100.99'));
});

// --------------------------------------------------------
console.log('\n--- 10. SSRF-Safe Live DNS Resolver Lookup ---');
// --------------------------------------------------------
(async () => {
  await okAsync('lookupDns queries resolver for valid hostname', async () => {
    const res = await dnsService.lookupDns('localhost', 'A');
    assert.ok(res.hostname === 'localhost');
    assert.ok(res.type === 'A');
    assert.ok(typeof res.responseTimeMs === 'number');
  });

  await expectThrowsAsync('lookupDns rejects invalid hostname', async () => {
    await dnsService.lookupDns('http://169.254.169.254/latest/meta-data');
  }, 'invalid');

  // --------------------------------------------------------
  console.log('\n--- 11. REST API Endpoints ---');
  // --------------------------------------------------------
  await okAsync('GET /api/dns/zones returns 200 with zones array', async () => {
    const res = await httpGet('/api/dns/zones', TEST_USER);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.success);
    assert.ok(Array.isArray(res.body.zones));
  });

  await okAsync('GET /api/dns/zone returns 200 with records', async () => {
    const res = await httpGet(`/api/dns/zone?domain=${encodeURIComponent(TEST_DOMAIN)}`, TEST_USER);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.domain, TEST_DOMAIN);
    assert.ok(Array.isArray(res.body.records));
  });

  let apiRecId;
  await okAsync('POST /api/dns/records creates new record', async () => {
    const res = await httpPost('/api/dns/records', {
      domain: TEST_DOMAIN,
      type: 'A',
      name: 'api-test',
      record: '198.51.100.111',
      ttl: 14400
    }, TEST_USER);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.success);
    assert.ok(res.body.record?.id);
    apiRecId = res.body.record.id;
  });

  await okAsync('PUT /api/dns/records/:id updates record', async () => {
    if (!apiRecId) return;
    const res = await httpPut(`/api/dns/records/${encodeURIComponent(apiRecId)}`, {
      domain: TEST_DOMAIN,
      type: 'A',
      name: 'api-test',
      record: '198.51.100.222',
      ttl: 7200
    }, TEST_USER);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.success);
    assert.strictEqual(res.body.record.record, '198.51.100.222');
  });

  await okAsync('DELETE /api/dns/records/:id removes record', async () => {
    if (!apiRecId) return;
    const res = await httpDelete(`/api/dns/records/${encodeURIComponent(apiRecId)}?domain=${encodeURIComponent(TEST_DOMAIN)}`, TEST_USER);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.success);
  });

  await okAsync('POST /api/dns/records rejects invalid record', async () => {
    const res = await httpPost('/api/dns/records', {
      domain: TEST_DOMAIN,
      type: 'A',
      name: 'fail',
      record: '999.999.999.999',
      ttl: 14400
    }, TEST_USER);
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error);
  });

  await okAsync('GET /api/dns/zone/export returns BIND text', async () => {
    const res = await httpGet(`/api/dns/zone/export?domain=${encodeURIComponent(TEST_DOMAIN)}`, TEST_USER);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.success);
    assert.ok(res.body.zoneContent.includes('$ORIGIN'));
  });

  await okAsync('POST /api/dns/zone/reset resets zone', async () => {
    const res = await httpPost('/api/dns/zone/reset', { domain: TEST_DOMAIN }, TEST_USER);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.success);
    assert.ok(Array.isArray(res.body.records));
  });

  await okAsync('POST /api/dns/lookup returns resolver answer', async () => {
    const res = await httpPost('/api/dns/lookup', { hostname: 'localhost', type: 'A' }, TEST_USER);
    assert.strictEqual(res.status, 200);
    assert.ok('results' in res.body || 'error' in res.body);
  });

  // --------------------------------------------------------
  console.log('\n--- 12. Multi-Tenant Security Isolation ---');
  // --------------------------------------------------------
  await okAsync('User B cannot view or modify User A zone records', async () => {
    const res = await httpGet(`/api/dns/zone?domain=${encodeURIComponent(TEST_DOMAIN)}`, 'other_unauthorized_user');
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.toLowerCase().includes('not authorized'));
  });

  await okAsync('User B cannot reset User A zone', async () => {
    const res = await httpPost('/api/dns/zone/reset', { domain: TEST_DOMAIN }, 'other_unauthorized_user');
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.toLowerCase().includes('not authorized'));
  });

  // --------------------------------------------------------
  console.log('\n--- 13. UI & Routing Integration ---');
  // --------------------------------------------------------
  const appJs = fs.readFileSync(path.join(__dirname, '../frontend/src/App.jsx'), 'utf8');
  ok('App.jsx imports ZoneEditor', () => { assert.ok(appJs.includes("import ZoneEditor")); });
  ok('App.jsx mounts "zone_editor" view', () => { assert.ok(appJs.includes("currentView === 'zone_editor'")); });

  const dashJs = fs.readFileSync(path.join(__dirname, '../frontend/src/pages/Dashboard.jsx'), 'utf8');
  ok('Dashboard.jsx routes zone_editor to dedicated view', () => {
    assert.ok(dashJs.includes("id: 'zone_editor'") && dashJs.includes("target: 'zone_editor'"));
  });

  const apiJs = fs.readFileSync(path.join(__dirname, '../frontend/src/services/api.js'), 'utf8');
  ok('Frontend api.js has getDnsZones', () => { assert.ok(apiJs.includes('getDnsZones')); });
  ok('Frontend api.js has getDnsZone', () => { assert.ok(apiJs.includes('getDnsZone')); });
  ok('Frontend api.js has addDnsZoneRecord', () => { assert.ok(apiJs.includes('addDnsZoneRecord')); });
  ok('Frontend api.js has updateDnsZoneRecord', () => { assert.ok(apiJs.includes('updateDnsZoneRecord')); });
  ok('Frontend api.js has deleteDnsZoneRecord', () => { assert.ok(apiJs.includes('deleteDnsZoneRecord')); });
  ok('Frontend api.js has resetDnsZone', () => { assert.ok(apiJs.includes('resetDnsZone')); });
  ok('Frontend api.js has exportDnsZone', () => { assert.ok(apiJs.includes('exportDnsZone')); });
  ok('Frontend api.js has lookupDns', () => { assert.ok(apiJs.includes('lookupDns')); });

  const zeJsx = fs.readFileSync(path.join(__dirname, '../frontend/src/pages/ZoneEditor.jsx'), 'utf8');
  ok('ZoneEditor.jsx calls api.getDnsZones', () => { assert.ok(zeJsx.includes('api.getDnsZones')); });
  ok('ZoneEditor.jsx calls api.getDnsZone', () => { assert.ok(zeJsx.includes('api.getDnsZone')); });
  ok('ZoneEditor.jsx calls api.addDnsZoneRecord', () => { assert.ok(zeJsx.includes('api.addDnsZoneRecord')); });
  ok('ZoneEditor.jsx calls api.updateDnsZoneRecord', () => { assert.ok(zeJsx.includes('api.updateDnsZoneRecord')); });
  ok('ZoneEditor.jsx calls api.deleteDnsZoneRecord', () => { assert.ok(zeJsx.includes('api.deleteDnsZoneRecord')); });
  ok('ZoneEditor.jsx calls api.resetDnsZone', () => { assert.ok(zeJsx.includes('api.resetDnsZone')); });
  ok('ZoneEditor.jsx calls api.exportDnsZone', () => { assert.ok(zeJsx.includes('api.exportDnsZone')); });
  ok('ZoneEditor.jsx calls api.lookupDns', () => { assert.ok(zeJsx.includes('api.lookupDns')); });

  console.log('\n========================================');
  console.log(`ZONE EDITOR AUDIT: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) process.exit(1);
})();
