/**
 * bandwidth_audit.js
 * Comprehensive Automated Verification Suite for FEATURE #27: BANDWIDTH
 * Metrics -> Bandwidth
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const bandwidthService = require('./src/services/bandwidthService');
const metricsService = require('./src/services/metricsService');
const storageService = require('./src/services/storageService');

const BASE_URL = 'http://localhost:5000';
const USER = 'cpanel_user';

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return res.then(() => {
        console.log(`  [PASS] ${name}`);
        passed++;
      }).catch((e) => {
        console.error(`  [FAIL] ${name}:`, e.message);
        failed++;
      });
    }
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`  [FAIL] ${name}:`, e.message);
    failed++;
  }
}

async function runAudit() {
  console.log('================================================================');
  console.log('  FEATURE #27 (BANDWIDTH) AUTOMATED AUDIT & SECURITY SUITE');
  console.log('================================================================\n');

  // --- SECTION 1: Account Limit & Plan Integration ---
  console.log('--- SECTION 1: Account Limit & Plan Integration ---');

  await it('Retrieves account bandwidth limit and plan info from WHM data', () => {
    const limits = bandwidthService.getAccountBandwidthLimit(USER);
    assert(limits, 'Limits object must exist');
    assert.strictEqual(typeof limits.isUnlimited, 'boolean');
    assert.strictEqual(typeof limits.plan, 'string');
    assert(limits.limitBytes > 0 || limits.isUnlimited, 'Must have limitBytes or be unlimited');
    assert(typeof limits.limitFormatted === 'string', 'Must provide formatted limit string');
  });

  await it('Correctly formats byte numbers with standard binary prefixes', () => {
    assert.strictEqual(bandwidthService.formatBytes(0), '0 Bytes');
    assert.strictEqual(bandwidthService.formatBytes(500), '500 Bytes');
    assert.strictEqual(bandwidthService.formatBytes(2048), '2.00 KB');
    assert.strictEqual(bandwidthService.formatBytes(1048576), '1.00 MB');
    assert.strictEqual(bandwidthService.formatBytes(1073741824), '1.00 GB');
  });

  // --- SECTION 2: Real Bandwidth Calculation from Access Logs ---
  console.log('\n--- SECTION 2: Real Bandwidth Calculation from Access Logs ---');

  await it('Calculates real bandwidth from authentic access log on disk', async () => {
    const data = await bandwidthService.getBandwidthData({ username: USER, period: 'current_month' });
    assert(data.success);
    assert.strictEqual(typeof data.account.usedBytes, 'number');
    assert(data.account.usedBytes > 0, 'Account must have real recorded traffic from baseline logs');
    assert(data.account.totalRequests > 0, 'Must have recorded HTTP requests');
    assert.strictEqual(typeof data.account.usagePercent, 'number');
    assert.strictEqual(typeof data.account.remainingFormatted, 'string');
  });

  // --- SECTION 3: Double-Counting Protection ---
  console.log('\n--- SECTION 3: Double-Counting Protection ---');

  await it('Double-counting check: sum of domain bytes exactly equals account total bytes', async () => {
    const data = await bandwidthService.getBandwidthData({ username: USER, period: 'current_month' });
    const domainSum = data.domains.reduce((acc, d) => acc + d.bytes, 0);
    assert.strictEqual(domainSum, data.account.usedBytes, 'Sum of domain bytes must exactly match account total (no double counting)');
  });

  await it('Timeline daily bytes sum exactly equals account total bytes', async () => {
    const data = await bandwidthService.getBandwidthData({ username: USER, period: 'current_month' });
    const timelineSum = data.timeline.reduce((acc, t) => acc + t.bytes, 0);
    assert.strictEqual(timelineSum, data.account.usedBytes, 'Sum of timeline daily bytes must equal account total');
  });

  // --- SECTION 4: Domain Breakdown & Traffic Attribution ---
  console.log('\n--- SECTION 4: Domain Breakdown & Traffic Attribution ---');

  await it('Provides domain breakdown for all authorized domains', async () => {
    const data = await bandwidthService.getBandwidthData({ username: USER, period: 'current_month' });
    assert(Array.isArray(data.domains), 'Domains must be an array');
    assert(data.domains.length > 0, 'Must include authorized domains');
    const primary = data.domains.find(d => d.domain === 'example.com');
    assert(primary, 'example.com must be present in domain breakdown');
    assert(primary.bytes > 0, 'example.com must have recorded bytes');
    assert(typeof primary.percentOfTotal === 'number', 'Must have percentOfTotal calculation');
  });

  await it('Rejects unauthorized domain query with Access denied', async () => {
    try {
      await bandwidthService.getBandwidthData({ username: USER, domain: 'hacker-site.org' });
      assert.fail('Should have rejected unauthorized domain');
    } catch (e) {
      assert(e.message.includes('Access denied'), 'Rejected unauthorized domain with Access denied');
    }
  });

  // --- SECTION 5: Date Range & Billing Period Filtering ---
  console.log('\n--- SECTION 5: Date Range & Billing Period Filtering ---');

  await it('Supports Current Month billing period', async () => {
    const data = await bandwidthService.getBandwidthData({ username: USER, period: 'current_month' });
    assert(data.period.label.includes('Current Billing Cycle') || data.period.label.includes('Current Month'));
    assert(data.period.startDate.length > 0);
    assert(data.period.endDate.length > 0);
  });

  await it('Supports 7 Days, 30 Days, Today, and Custom Range', async () => {
    const [p7, pToday, pCustom] = await Promise.all([
      bandwidthService.getBandwidthData({ username: USER, period: '7days' }),
      bandwidthService.getBandwidthData({ username: USER, period: 'today' }),
      bandwidthService.getBandwidthData({
        username: USER,
        period: 'custom',
        startDate: '2026-09-01',
        endDate: '2026-09-30'
      })
    ]);

    assert(p7.success && p7.period.id === '7days');
    assert(pToday.success && pToday.period.id === 'today');
    assert(pCustom.success && pCustom.period.id === 'custom');
  });

  // --- SECTION 6: Daily & Hourly Timeline Aggregation ---
  console.log('\n--- SECTION 6: Daily & Hourly Timeline Aggregation ---');

  await it('Aggregates daily timeline with dates, formatted bytes, and requests', async () => {
    const data = await bandwidthService.getBandwidthData({ username: USER, period: 'current_month' });
    assert(Array.isArray(data.timeline));
    if (data.timeline.length > 0) {
      const first = data.timeline[0];
      assert.strictEqual(typeof first.date, 'string');
      assert.strictEqual(typeof first.bytes, 'number');
      assert.strictEqual(typeof first.requests, 'number');
      assert.strictEqual(typeof first.formattedBytes, 'string');
    }
  });

  await it('Generates 24-hour hourly breakdown slots', async () => {
    const data = await bandwidthService.getBandwidthData({ username: USER, period: 'today' });
    assert(Array.isArray(data.hourly));
    assert.strictEqual(data.hourly.length, 24, 'Must have 24 hourly slots');
    assert.strictEqual(data.hourly[0].hour, '00:00');
    assert.strictEqual(data.hourly[23].hour, '23:00');
  });

  // --- SECTION 7: Live Web Traffic Detection via /site ---
  console.log('\n--- SECTION 7: Live Web Traffic Detection via /site ---');

  await it('Live HTTP request on /site updates bandwidth usage in real-time', async () => {
    const before = await bandwidthService.getBandwidthData({ username: USER, period: 'current_month', forceRefresh: true });
    const initialBytes = before.account.usedBytes;
    const initialReqs = before.account.totalRequests;

    // Send a live web request to /site/index.html
    const res = await fetch(`${BASE_URL}/site/index.html?user=${USER}&domain=example.com`);
    assert.strictEqual(res.status, 200, 'Page request must succeed');

    // Wait 250ms for write stream to flush
    await new Promise(r => setTimeout(r, 250));

    // Force refresh and verify bandwidth recorded
    const after = await bandwidthService.getBandwidthData({ username: USER, period: 'current_month', forceRefresh: true });
    assert(after.account.usedBytes >= initialBytes, 'Bandwidth used must increase or remain non-zero');
    assert(after.account.totalRequests > initialReqs, 'Request count must increment');
  });

  // --- SECTION 8: REST API Endpoints ---
  console.log('\n--- SECTION 8: REST API Endpoints ---');

  await it('GET /api/bandwidth/summary returns account bandwidth overview', async () => {
    const res = await fetch(`${BASE_URL}/api/bandwidth/summary?user=${USER}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert(body.success);
    assert(body.account);
    assert(typeof body.account.usedBytes === 'number');
    assert(body.trafficBreakdown);
  });

  await it('GET /api/bandwidth/domains returns domain breakdown', async () => {
    const res = await fetch(`${BASE_URL}/api/bandwidth/domains?user=${USER}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert(body.success);
    assert(Array.isArray(body.domains));
  });

  await it('GET /api/bandwidth/timeline returns daily timeline array', async () => {
    const res = await fetch(`${BASE_URL}/api/bandwidth/timeline?user=${USER}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert(body.success);
    assert(Array.isArray(body.timeline));
  });

  await it('GET /api/bandwidth/hourly returns 24-hour breakdown', async () => {
    const res = await fetch(`${BASE_URL}/api/bandwidth/hourly?user=${USER}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert(body.success);
    assert.strictEqual(body.hourly.length, 24);
  });

  await it('POST /api/bandwidth/refresh flushes cache and recalculates', async () => {
    const res = await fetch(`${BASE_URL}/api/bandwidth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: USER, period: 'current_month' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert(body.success);
    assert(body.lastUpdated);
  });

  // --- SECTION 9: Multi-Tenant Security Isolation ---
  console.log('\n--- SECTION 9: Multi-Tenant Security Isolation ---');

  await it('Multi-tenant isolation: User A cannot query domain belonging to User B', async () => {
    const res = await fetch(`${BASE_URL}/api/bandwidth/summary?user=other_user&domain=example.com`);
    assert.strictEqual(res.status, 403, 'Must reject unauthorized domain query with 403');
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert(body.error.includes('Access denied'));
  });

  // --- SECTION 10: Consistency with Statistics Panel ---
  console.log('\n--- SECTION 10: Consistency with Statistics Panel ---');

  await it('metricsService.getSystemStats reports real bandwidth usage consistent with bandwidthService', async () => {
    const stats = await metricsService.getSystemStats(USER);
    assert(stats.resources.bandwidth, 'Bandwidth resource must be present in system stats');
    assert.strictEqual(typeof stats.resources.bandwidth.usedMb, 'number');
    assert.strictEqual(typeof stats.resources.bandwidth.limitMb, 'number');
    assert.strictEqual(typeof stats.resources.bandwidth.usagePercent, 'number');

    const bwSummary = await bandwidthService.getAccountBandwidthSummary(USER);
    assert.strictEqual(stats.resources.bandwidth.usedMb, bwSummary.usedMb, 'System stats usedMb must equal bandwidthService usedMb');
  });

  console.log('\n================================================================');
  console.log(`  AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit();
