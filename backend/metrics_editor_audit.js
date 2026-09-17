/**
 * metrics_editor_audit.js
 * Comprehensive Verification & Automated Audit Suite for Feature #33: Metrics Editor
 * Tests capabilities discovery, domain binding, configuration CRUD, concurrency control,
 * server-managed protections, reset to defaults, audit logging, and multi-tenant isolation.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const metricsEditorService = require('./src/services/metricsEditorService');

const BASE_URL = 'http://localhost:5000/api/metrics-editor';
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
  console.log('⚡ STARTING METRICS EDITOR AUDIT SUITE (Feature #33)');
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

  // TEST 1: Capabilities discovery
  await test('Test 1: Truthful Metrics Capabilities & Engines Discovery', async () => {
    const res = await httpGet(`${BASE_URL}/capabilities`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.totalEngines, 8, 'Total of 8 metrics engines detected');

    const configEngines = res.data.configurableEngines;
    assert.strictEqual(configEngines.length, 4, '4 configurable engines');
    assert.ok(configEngines.some(e => e.id === 'awstats'), 'Contains Awstats');
    assert.ok(configEngines.some(e => e.id === 'webalizer'), 'Contains Webalizer');
    assert.ok(configEngines.some(e => e.id === 'analog_stats'), 'Contains Analog Stats');
    assert.ok(configEngines.some(e => e.id === 'webalizer_ftp'), 'Contains Webalizer FTP');

    const serverManaged = res.data.serverManagedEngines;
    assert.strictEqual(serverManaged.length, 4, '4 server-managed engines');
    assert.ok(serverManaged.some(e => e.id === 'visitors'), 'Contains Visitors');
    assert.ok(serverManaged.some(e => e.id === 'errors'), 'Contains Errors');
    assert.ok(serverManaged.some(e => e.id === 'bandwidth'), 'Contains Bandwidth');
    assert.ok(serverManaged.some(e => e.id === 'raw_access'), 'Contains Raw Access');
    assert.strictEqual(serverManaged[0].status, 'SERVER_MANAGED', 'Badged as SERVER_MANAGED');
  });

  // TEST 2: Authorized domain listing
  await test('Test 2: Authorized Domains Retrieval for Account Scope', async () => {
    const res = await httpGet(`${BASE_URL}/config?user=${TEST_USER}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.domains), 'Domains is array');
    assert.ok(res.data.domains.length > 0, 'User has at least 1 authorized domain');
    assert.ok(res.data.domains.some(d => d.name === 'example.com'), 'Contains example.com');
  });

  // Reset test user to clean defaults first
  await httpPost(`${BASE_URL}/reset`, { cpanelUser: TEST_USER });

  // TEST 3: Default configuration retrieval
  let currentVersion = 1;
  await test('Test 3: Initial Default Configuration State', async () => {
    const res = await httpGet(`${BASE_URL}/config?user=${TEST_USER}`);
    assert.strictEqual(res.status, 200);
    const cfg = res.data.config;
    assert.strictEqual(cfg.cpanelUser, TEST_USER);
    assert.strictEqual(cfg.defaultMetric, 'awstats', 'Default statistics program is Awstats');
    assert.strictEqual(cfg.domains['example.com'].awstats, true);
    assert.strictEqual(cfg.domains['example.com'].webalizer, true);
    assert.strictEqual(cfg.domains['example.com'].analog_stats, true);
    assert.strictEqual(cfg.accountMetrics.webalizer_ftp, true);
    currentVersion = cfg.version;
  });

  // TEST 4: Update default statistics software
  await test('Test 4: Update Default Statistics Software & Validation', async () => {
    // Valid update to Webalizer
    const updateRes = await httpPost(`${BASE_URL}/config`, {
      cpanelUser: TEST_USER,
      defaultMetric: 'webalizer',
      expectedVersion: currentVersion
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.success, true);
    assert.strictEqual(updateRes.data.config.defaultMetric, 'webalizer');
    currentVersion = updateRes.data.config.version;

    // Verify persistence via GET
    const checkRes = await httpGet(`${BASE_URL}/config?user=${TEST_USER}`);
    assert.strictEqual(checkRes.data.config.defaultMetric, 'webalizer');

    // Invalid update rejected
    const badRes = await httpPost(`${BASE_URL}/config`, {
      cpanelUser: TEST_USER,
      defaultMetric: 'invalid_analytics_software'
    });
    assert.strictEqual(badRes.status, 400, 'Rejects invalid defaultMetric');
  });

  // TEST 5: Per-domain metric toggle
  await test('Test 5: Per-Domain Log Program Enable/Disable Toggles', async () => {
    // Disable Webalizer for example.com
    const toggleRes = await httpPost(`${BASE_URL}/config`, {
      cpanelUser: TEST_USER,
      domainSettings: {
        'example.com': {
          webalizer: false
        }
      },
      expectedVersion: currentVersion
    });
    assert.strictEqual(toggleRes.status, 200);
    assert.strictEqual(toggleRes.data.config.domains['example.com'].webalizer, false);
    assert.strictEqual(toggleRes.data.config.domains['example.com'].awstats, true, 'Awstats preserved enabled');
    currentVersion = toggleRes.data.config.version;

    // Verify persistence
    const checkRes = await httpGet(`${BASE_URL}/config?user=${TEST_USER}`);
    assert.strictEqual(checkRes.data.config.domains['example.com'].webalizer, false);
  });

  // TEST 6: Account-level metric toggle (Webalizer FTP)
  await test('Test 6: Account-Level Webalizer FTP Toggle', async () => {
    // Disable Webalizer FTP
    const toggleRes = await httpPost(`${BASE_URL}/config`, {
      cpanelUser: TEST_USER,
      accountSettings: {
        webalizer_ftp: false
      },
      expectedVersion: currentVersion
    });
    assert.strictEqual(toggleRes.status, 200);
    assert.strictEqual(toggleRes.data.config.accountMetrics.webalizer_ftp, false);
    currentVersion = toggleRes.data.config.version;

    // Verify persistence
    const checkRes = await httpGet(`${BASE_URL}/config?user=${TEST_USER}`);
    assert.strictEqual(checkRes.data.config.accountMetrics.webalizer_ftp, false);
  });

  // TEST 7: Server-managed metrics rejection
  await test('Test 7: Server-Managed Metrics Protection (Rejects Disabling)', async () => {
    const attempt1 = await httpPost(`${BASE_URL}/config`, {
      cpanelUser: TEST_USER,
      domainSettings: {
        'example.com': {
          visitors: false
        }
      }
    });
    assert.strictEqual(attempt1.status, 400, 'Rejects modifying Visitors');
    assert.ok(attempt1.data.error.includes('managed by the server'), 'Error mentions server-managed');

    const attempt2 = await httpPost(`${BASE_URL}/config`, {
      cpanelUser: TEST_USER,
      accountSettings: {
        bandwidth: false
      }
    });
    assert.strictEqual(attempt2.status, 400, 'Rejects modifying Bandwidth');
  });

  // TEST 8: Optimistic concurrency control
  await test('Test 8: Optimistic Concurrency Control (Version Conflict)', async () => {
    const conflictRes = await httpPost(`${BASE_URL}/config`, {
      cpanelUser: TEST_USER,
      defaultMetric: 'analog_stats',
      expectedVersion: 99999 // Wrong version
    });
    assert.strictEqual(conflictRes.status, 400, 'Rejects stale version');
    assert.ok(conflictRes.data.error.includes('Concurrency conflict'), 'Mentions concurrency conflict');
  });

  // TEST 9: Domain authorization security
  await test('Test 9: Domain Authorization Enforcement (Blocks Foreign Domains)', async () => {
    const unauthRes = await httpPost(`${BASE_URL}/config`, {
      cpanelUser: TEST_USER,
      domainSettings: {
        'unauthorized-victim-domain.com': {
          awstats: false
        }
      }
    });
    assert.strictEqual(unauthRes.status, 400, 'Rejects unauthorized domain');
    assert.ok(unauthRes.data.error.includes('Access denied'), 'Mentions Access denied');
  });

  // TEST 10: Reset to defaults
  await test('Test 10: Reset to System Defaults', async () => {
    const resetRes = await httpPost(`${BASE_URL}/reset`, {
      cpanelUser: TEST_USER
    });
    assert.strictEqual(resetRes.status, 200);
    assert.strictEqual(resetRes.data.success, true);
    assert.strictEqual(resetRes.data.config.defaultMetric, 'awstats');
    assert.strictEqual(resetRes.data.config.domains['example.com'].webalizer, true, 'Webalizer restored to true');
    assert.strictEqual(resetRes.data.config.accountMetrics.webalizer_ftp, true, 'FTP restored to true');
  });

  // TEST 11: Audit logging verification
  await test('Test 11: Audit Trail Logging & History Inspection', async () => {
    const auditRes = await httpGet(`${BASE_URL}/audit?user=${TEST_USER}&limit=10`);
    assert.strictEqual(auditRes.status, 200);
    assert.strictEqual(auditRes.data.success, true);
    assert.ok(Array.isArray(auditRes.data.logs), 'Logs is array');
    assert.ok(auditRes.data.logs.length > 0, 'Contains audit log entries');
    assert.ok(auditRes.data.logs.some(l => l.action === 'UPDATE_CONFIG'), 'Contains UPDATE_CONFIG entry');
    assert.ok(auditRes.data.logs.some(l => l.action === 'RESET_TO_DEFAULTS'), 'Contains RESET_TO_DEFAULTS entry');
  });

  // TEST 12: Multi-tenant security isolation
  await test('Test 12: Strict Multi-Tenant Security & Isolation', async () => {
    // User A modifies their config
    await httpPost(`${BASE_URL}/config`, {
      cpanelUser: TEST_USER,
      defaultMetric: 'analog_stats'
    });

    // User B config should remain independent
    const otherRes = await httpGet(`${BASE_URL}/config?user=${OTHER_USER}`);
    assert.strictEqual(otherRes.status, 200);
    assert.strictEqual(otherRes.data.config.cpanelUser, OTHER_USER);
    assert.strictEqual(otherRes.data.config.defaultMetric, 'awstats', 'Other tenant default metric remains standard Awstats');

    // Other tenant's audit trail is isolated
    const otherAudit = await httpGet(`${BASE_URL}/audit?user=${OTHER_USER}`);
    assert.strictEqual(otherAudit.status, 200);
    assert.ok(!otherAudit.data.logs.some(l => l.user === TEST_USER), 'Does not leak User A logs to User B');
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
