/**
 * site_quality_audit.js
 * Comprehensive integration, SSRF, security, and functional tests
 * for Feature #25 (Site Quality Monitoring).
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const siteQualityService = require('./src/services/siteQualityService');

const BASE_URL = 'http://localhost:5000';
const TEST_USER = 'cpanel_user';
const TEST_DOMAIN = 'example.com';
const UNAUTHORIZED_USER = 'unauthorized_tenant_b';

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
  console.log('🧪 RUNNING SITE QUALITY MONITORING (FEATURE #25) AUDIT');
  console.log('====================================================\n');

  // --- SECTION 1: SSRF Protection Engine ---
  console.log('--- SECTION 1: SSRF Protection Engine ---');

  await testAsync('Rejects localhost and loopback IPv4', async () => {
    let err = null;
    try {
      await siteQualityService.resolveDnsSafe('localhost');
    } catch (e) {
      err = e;
    }
    assert.ok(err, 'Localhost must be blocked');
    assert.ok(err.message.includes('SSRF_BLOCKED'));
  });

  await testAsync('Rejects IPv4 127.0.0.1 directly', async () => {
    let err = null;
    try {
      await siteQualityService.resolveDnsSafe('127.0.0.1');
    } catch (e) {
      err = e;
    }
    assert.ok(err, '127.0.0.1 must be blocked');
    assert.ok(err.message.includes('SSRF_BLOCKED'));
  });

  await testAsync('Rejects private IPv4 10.0.0.1 subnet', async () => {
    let err = null;
    try {
      await siteQualityService.resolveDnsSafe('10.0.0.1');
    } catch (e) {
      err = e;
    }
    assert.ok(err, '10.0.0.1 must be blocked');
    assert.ok(err.message.includes('SSRF_BLOCKED'));
  });

  await testAsync('Rejects private IPv4 192.168.1.1 subnet', async () => {
    let err = null;
    try {
      await siteQualityService.resolveDnsSafe('192.168.1.1');
    } catch (e) {
      err = e;
    }
    assert.ok(err, '192.168.1.1 must be blocked');
    assert.ok(err.message.includes('SSRF_BLOCKED'));
  });

  await testAsync('Rejects private IPv4 172.16.0.1 subnet', async () => {
    let err = null;
    try {
      await siteQualityService.resolveDnsSafe('172.16.0.1');
    } catch (e) {
      err = e;
    }
    assert.ok(err, '172.16.0.1 must be blocked');
    assert.ok(err.message.includes('SSRF_BLOCKED'));
  });

  await testAsync('Rejects Cloud Metadata service address 169.254.169.254', async () => {
    let err = null;
    try {
      await siteQualityService.resolveDnsSafe('169.254.169.254');
    } catch (e) {
      err = e;
    }
    assert.ok(err, '169.254.169.254 must be blocked');
    assert.ok(err.message.includes('SSRF_BLOCKED'));
  });

  await testAsync('Rejects Cloud Metadata hostname metadata.google.internal', async () => {
    let err = null;
    try {
      await siteQualityService.resolveDnsSafe('metadata.google.internal');
    } catch (e) {
      err = e;
    }
    assert.ok(err, 'metadata.google.internal must be blocked');
    assert.ok(err.message.includes('SSRF_BLOCKED'));
  });

  await testAsync('Rejects non-standard ports (e.g. port 8080 or 22)', async () => {
    let err = null;
    try {
      await siteQualityService.executeHttpCheck('http://example.com:8080');
    } catch (e) {
      err = e;
    }
    assert.ok(err, 'Non-standard port must be blocked');
    assert.ok(err.message.includes('SSRF_BLOCKED'));
  });

  await testAsync('Rejects unsupported protocol schemes (e.g. file:// or ftp://)', async () => {
    let err = null;
    try {
      await siteQualityService.executeHttpCheck('file:///etc/passwd');
    } catch (e) {
      err = e;
    }
    assert.ok(err, 'Unsafe scheme must be blocked');
    assert.ok(err.message.includes('SSRF_BLOCKED'));
  });

  // --- SECTION 2: Domain Authorization & Target Validation ---
  console.log('\n--- SECTION 2: Domain Authorization & Target Validation ---');

  test('Get authorized domains returns account domains', () => {
    const domains = siteQualityService.getAuthorizedDomains(TEST_USER);
    assert.ok(Array.isArray(domains));
    assert.ok(domains.length > 0);
    assert.ok(domains.some(d => d.domain === TEST_DOMAIN));
  });

  test('verifyDomainAuthorized accepts owned domain', () => {
    const verified = siteQualityService.verifyDomainAuthorized(TEST_DOMAIN, TEST_USER);
    assert.strictEqual(verified, TEST_DOMAIN);
  });

  test('verifyDomainAuthorized rejects unauthorized domain with Access denied', () => {
    assert.throws(() => {
      siteQualityService.verifyDomainAuthorized('malicious-unowned-site.org', TEST_USER);
    }, /Access denied/);
  });

  // --- SECTION 3: Real DNS, TLS, and HTTP Checks ---
  console.log('\n--- SECTION 3: Real DNS, TLS, and HTTP Checks ---');

  await testAsync('Real DNS resolution resolves public domain and records latency', async () => {
    const dnsRes = await siteQualityService.resolveDnsSafe(TEST_DOMAIN);
    assert.strictEqual(dnsRes.success, true);
    assert.ok(dnsRes.dnsTime >= 0);
    assert.ok(dnsRes.addresses.length > 0);
    assert.ok(dnsRes.primaryIp);
  });

  await testAsync('Real TLS inspection retrieves live certificate for example.com', async () => {
    const tlsRes = await siteQualityService.inspectTls(TEST_DOMAIN, 443);
    assert.strictEqual(tlsRes.success, true);
    assert.ok(tlsRes.tlsTime > 0);
    assert.ok(tlsRes.validTo);
    assert.ok(typeof tlsRes.daysRemaining === 'number');
    assert.ok(tlsRes.status.includes('Certificate valid') || tlsRes.status.includes('Certificate'));
  });

  await testAsync('Real HTTP/HTTPS check fetches example.com with timing breakdown', async () => {
    const httpRes = await siteQualityService.executeHttpCheck(`https://${TEST_DOMAIN}`);
    assert.strictEqual(httpRes.success, true);
    assert.strictEqual(httpRes.statusCode, 200);
    assert.ok(httpRes.responseTime > 0);
    assert.ok(httpRes.ttfb >= 0);
    assert.ok(httpRes.dns);
    assert.ok(httpRes.tls);
  });

  // --- SECTION 4: Monitor Creation, Execution & History ---
  console.log('\n--- SECTION 4: Monitor Creation, Execution & History ---');

  let createdMonitorId = null;

  await testAsync('Create monitor performs initial live check and persists monitor', async () => {
    // Clear any previous test monitors for clean test
    const all = siteQualityService._readMonitors();
    all[TEST_USER] = [];
    siteQualityService._writeMonitors(all);

    const details = await siteQualityService.createMonitor({
      domain: TEST_DOMAIN,
      scheme: 'https',
      interval: 15,
      notifyEmail: true
    }, TEST_USER);

    assert.ok(details.monitor);
    assert.strictEqual(details.monitor.domain, TEST_DOMAIN);
    assert.strictEqual(details.monitor.scheme, 'https');
    assert.strictEqual(details.monitor.interval, 15);
    assert.ok(details.monitor.id);
    createdMonitorId = details.monitor.id;

    assert.ok(['Healthy', 'Degraded', 'Pending'].includes(details.monitor.healthState));
    assert.ok(details.latestCheck, 'Latest check should be populated');
    assert.strictEqual(details.latestCheck.httpStatus, 200);
  });

  await testAsync('Duplicate monitor creation for same domain & scheme is rejected', async () => {
    let err = null;
    try {
      await siteQualityService.createMonitor({
        domain: TEST_DOMAIN,
        scheme: 'https',
        interval: 15
      }, TEST_USER);
    } catch (e) {
      err = e;
    }
    assert.ok(err);
    assert.ok(err.message.includes('already exists'));
  });

  await testAsync('Invalid check interval is rejected', async () => {
    let err = null;
    try {
      await siteQualityService.createMonitor({
        domain: TEST_DOMAIN,
        scheme: 'http',
        interval: 1 // 1 minute not allowed
      }, TEST_USER);
    } catch (e) {
      err = e;
    }
    assert.ok(err);
    assert.ok(err.message.includes('Invalid check interval'));
  });

  // --- SECTION 5: Manual Check & Rate Limiting ---
  console.log('\n--- SECTION 5: Manual Check & Rate Limiting ---');

  await testAsync('Rate limit enforces 10s cooldown on consecutive manual checks', async () => {
    // Rate limit must throttle manual check executed within 10s of previous check
    siteQualityService.lastManualChecks.set(createdMonitorId, Date.now());
    let err = null;
    try {
      await siteQualityService.manualCheck(createdMonitorId, TEST_USER);
    } catch (e) {
      err = e;
    }
    assert.ok(err, 'Manual check within cooldown window must throw rate limit error');
    assert.ok(err.message.includes('Rate limit exceeded'));
  });

  // --- SECTION 6: Pause & Resume Operations ---
  console.log('\n--- SECTION 6: Pause & Resume Operations ---');

  test('Pause monitor halts scheduled checks and sets nextCheckTime to null', () => {
    const res = siteQualityService.togglePause(createdMonitorId, TEST_USER);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'Paused');
    assert.strictEqual(res.nextCheckTime, null);

    const details = siteQualityService.getMonitorDetails(createdMonitorId, TEST_USER);
    assert.strictEqual(details.monitor.status, 'Paused');
  });

  test('Resume monitor restores Active status and calculates nextCheckTime', () => {
    const res = siteQualityService.togglePause(createdMonitorId, TEST_USER);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'Active');
    assert.ok(res.nextCheckTime);

    const details = siteQualityService.getMonitorDetails(createdMonitorId, TEST_USER);
    assert.strictEqual(details.monitor.status, 'Active');
  });

  // --- SECTION 7: Uptime Calculation & History Retention ---
  console.log('\n--- SECTION 7: Uptime Calculation & History Retention ---');

  test('Uptime calculation returns percentage when 2 or more checks exist', () => {
    // Simulate second check in history
    const allChecks = siteQualityService._readChecks();
    allChecks[createdMonitorId].push({
      id: 'chk_test_sim_2',
      monitorId: createdMonitorId,
      timestamp: new Date().toISOString(),
      status: 'Healthy',
      httpStatus: 200,
      responseTime: 120,
      ttfb: 80,
      dnsTime: 10,
      tlsTime: 30,
      sslStatus: 'Certificate valid'
    });
    siteQualityService._writeChecks(allChecks);

    const monitors = siteQualityService.getMonitors(TEST_USER);
    const m = monitors.find(x => x.id === createdMonitorId);
    assert.ok(m);
    assert.strictEqual(typeof m.uptime, 'number');
    assert.strictEqual(m.uptime, 100);
  });

  // --- SECTION 8: Incident Lifecycle ---
  console.log('\n--- SECTION 8: Incident Lifecycle ---');

  test('Simulated failure opens ongoing incident, and subsequent recovery resolves it', () => {
    // 1. Simulate failure
    const allIncidents = siteQualityService._readIncidents();
    allIncidents[createdMonitorId] = [
      {
        id: 'inc_test_1',
        monitorId: createdMonitorId,
        domain: TEST_DOMAIN,
        status: 'ongoing',
        severity: 'critical',
        detectedAt: new Date(Date.now() - 60000).toISOString(),
        recoveredAt: null,
        durationSeconds: null,
        rootCause: 'Connection timed out',
        errorCategory: 'CONNECTION_TIMEOUT'
      }
    ];
    siteQualityService._writeIncidents(allIncidents);

    let details = siteQualityService.getMonitorDetails(createdMonitorId, TEST_USER);
    assert.strictEqual(details.monitor.activeIncidents, 1);
    assert.strictEqual(details.incidents[0].status, 'ongoing');

    // 2. Resolve incident
    allIncidents[createdMonitorId][0].status = 'recovered';
    allIncidents[createdMonitorId][0].recoveredAt = new Date().toISOString();
    allIncidents[createdMonitorId][0].durationSeconds = 60;
    siteQualityService._writeIncidents(allIncidents);

    details = siteQualityService.getMonitorDetails(createdMonitorId, TEST_USER);
    assert.strictEqual(details.monitor.activeIncidents, 0);
    assert.strictEqual(details.incidents[0].status, 'recovered');
  });

  // --- SECTION 9: REST API Endpoints ---
  console.log('\n--- SECTION 9: REST API Endpoints ---');

  await testAsync('GET /api/site-quality/domains returns 200 with domain list', async () => {
    const res = await fetch(`${BASE_URL}/api/site-quality/domains?user=${TEST_USER}`).then(r => r.json());
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.domains));
    assert.ok(res.domains.length > 0);
  });

  await testAsync('GET /api/site-quality/monitors returns 200 with list of monitors', async () => {
    const res = await fetch(`${BASE_URL}/api/site-quality/monitors?user=${TEST_USER}`).then(r => r.json());
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.monitors));
    assert.ok(res.monitors.some(m => m.id === createdMonitorId));
  });

  await testAsync('GET /api/site-quality/monitors/:id returns 200 with detailed report', async () => {
    const res = await fetch(`${BASE_URL}/api/site-quality/monitors/${createdMonitorId}?user=${TEST_USER}`).then(r => r.json());
    assert.strictEqual(res.success, true);
    assert.ok(res.monitor);
    assert.ok(Array.isArray(res.history));
    assert.ok(Array.isArray(res.incidents));
  });

  await testAsync('POST /api/site-quality/monitors/:id/toggle pauses and resumes via API', async () => {
    const res = await fetch(`${BASE_URL}/api/site-quality/monitors/${createdMonitorId}/toggle?user=${TEST_USER}`, {
      method: 'POST'
    }).then(r => r.json());
    assert.strictEqual(res.success, true);
    assert.ok(['Active', 'Paused'].includes(res.status));
  });

  await testAsync('DELETE /api/site-quality/monitors/:id deletes monitor', async () => {
    const res = await fetch(`${BASE_URL}/api/site-quality/monitors/${createdMonitorId}?user=${TEST_USER}`, {
      method: 'DELETE'
    }).then(r => r.json());
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.deletedMonitorId, createdMonitorId);

    // Verify deletion
    const all = siteQualityService.getMonitors(TEST_USER);
    assert.ok(!all.some(m => m.id === createdMonitorId));
  });

  // --- SECTION 10: Multi-Tenant Security Isolation ---
  console.log('\n--- SECTION 10: Multi-Tenant Security Isolation ---');

  await testAsync('User B cannot inspect or delete User A monitors', async () => {
    // Create monitor for User A
    const m = await siteQualityService.createMonitor({
      domain: TEST_DOMAIN,
      scheme: 'https'
    }, TEST_USER);

    // User B tries to inspect
    const inspectRes = await fetch(`${BASE_URL}/api/site-quality/monitors/${m.monitor.id}?user=${UNAUTHORIZED_USER}`);
    assert.strictEqual(inspectRes.status, 404);

    // User B tries to delete
    const deleteRes = await fetch(`${BASE_URL}/api/site-quality/monitors/${m.monitor.id}?user=${UNAUTHORIZED_USER}`, {
      method: 'DELETE'
    });
    assert.strictEqual(deleteRes.status, 404);

    // Clean up
    siteQualityService.deleteMonitor(m.monitor.id, TEST_USER);
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
  console.error('Fatal audit error:', err);
  process.exit(1);
});
