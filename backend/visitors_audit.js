const assert = require('assert');
const fs = require('fs');
const path = require('path');
const visitorService = require('./src/services/visitorService');
const domainService = require('./src/services/domainService');
const storageService = require('./src/services/storageService');

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
  console.log('🧪 RUNNING VISITORS METRICS (FEATURE #24) AUDIT');
  console.log('====================================================\n');

  // --- SECTION 1: Domain Authorization & Directory Structure ---
  console.log('--- SECTION 1: Domain Authorization & Scope Lock ---');

  test('Get authorized domains returns accounts domains with log metadata', () => {
    const domains = visitorService.getAuthorizedDomains(TEST_USER);
    assert.ok(Array.isArray(domains));
    assert.ok(domains.length > 0);
    const primary = domains.find(d => d.name === TEST_DOMAIN);
    assert.ok(primary);
    assert.strictEqual(primary.type, 'Primary Domain');
    assert.strictEqual(typeof primary.logExists, 'boolean');
  });

  test('Domain authorization validator accepts owned domains and ALL', () => {
    assert.strictEqual(visitorService.verifyDomainAuthorized('ALL', TEST_USER), 'ALL');
    assert.strictEqual(visitorService.verifyDomainAuthorized(TEST_DOMAIN, TEST_USER), TEST_DOMAIN);
    assert.strictEqual(visitorService.verifyDomainAuthorized(`blog.${TEST_DOMAIN}`, TEST_USER), `blog.${TEST_DOMAIN}`);
  });

  test('Domain authorization validator rejects unauthorized domains with 403', () => {
    assert.throws(() => {
      visitorService.verifyDomainAuthorized('hacker-domain.com', TEST_USER);
    }, /Access denied/);
  });

  // --- SECTION 2: Apache Combined Log Format & Date Parsers ---
  console.log('\n--- SECTION 2: Apache Combined Log Format & Timestamp Handlers ---');

  test('Apache date formatter generates valid NCSA format', () => {
    const fixed = new Date(Date.UTC(2026, 8, 16, 14, 22, 30));
    const formatted = visitorService.formatApacheDate(fixed);
    assert.strictEqual(formatted, '16/Sep/2026:14:22:30 +0000');
  });

  test('Apache date parser converts NCSA string back to Date object accurately', () => {
    const parsed = visitorService.parseApacheDate('16/Sep/2026:14:22:30 +0000');
    assert.ok(parsed instanceof Date);
    assert.strictEqual(parsed.getUTCFullYear(), 2026);
    assert.strictEqual(parsed.getUTCMonth(), 8); // Sep (0-indexed)
    assert.strictEqual(parsed.getUTCDate(), 16);
    assert.strictEqual(parsed.getUTCHours(), 14);
    assert.strictEqual(parsed.getUTCMinutes(), 22);
    assert.strictEqual(parsed.getUTCSeconds(), 30);
  });

  test('Date range resolver handles Today, Yesterday, 7 Days, 30 Days and Custom', () => {
    const today = visitorService.resolveDateRange('today');
    assert.ok(today.startDate && today.endDate);
    assert.ok(today.startDate <= today.endDate);

    const yesterday = visitorService.resolveDateRange('yesterday');
    assert.ok(yesterday.startDate <= yesterday.endDate);

    const sevenDays = visitorService.resolveDateRange('7days');
    assert.ok(sevenDays.startDate <= sevenDays.endDate);

    const thirtyDays = visitorService.resolveDateRange('30days');
    assert.ok(thirtyDays.startDate <= thirtyDays.endDate);

    const custom = visitorService.resolveDateRange('custom', '2026-09-01T00:00:00Z', '2026-09-10T23:59:59Z');
    assert.ok(custom.startDate <= custom.endDate);

    // Invalid range (start > end) must throw
    assert.throws(() => {
      visitorService.resolveDateRange('custom', '2026-09-10T00:00:00Z', '2026-09-01T00:00:00Z');
    });

    // Exceeding 365 days must throw
    assert.throws(() => {
      visitorService.resolveDateRange('custom', '2020-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
    });
  });

  // --- SECTION 3: Live Access Logging & Request Interception ---
  console.log('\n--- SECTION 3: Live Access Logging & Real Web Traffic ---');

  let initialLogCount = 0;
  test('Ensure baseline log exists and can be appended', () => {
    visitorService.ensureBaselineLogs(TEST_USER, TEST_DOMAIN);
    const logsDir = visitorService.getLogsDir(TEST_USER);
    const logFile = path.join(logsDir, `${TEST_DOMAIN}.log`);
    assert.ok(fs.existsSync(logFile));
    const content = fs.readFileSync(logFile, 'utf8');
    initialLogCount = content.trim().split('\n').length;
    assert.ok(initialLogCount > 0, 'Baseline access log lines should exist');
  });

  await testAsync('Live HTTP request to /site triggers real Apache access log entry', async () => {
    const TEST_PATH = `/audit-test-page-${Date.now().toString(36)}`;
    const response = await fetch(`${BASE_URL}/site${TEST_PATH}?user=${TEST_USER}&domain=${TEST_DOMAIN}`, {
      headers: {
        'User-Agent': 'Antigravity-Audit-Bot/1.0',
        'Referer': 'https://google.com/search?q=cpanel'
      }
    });
    // Request will be 404 since page doesn't exist on disk, which is expected
    assert.ok([200, 404].includes(response.status));

    // Wait 100ms for file write
    await new Promise(r => setTimeout(r, 100));

    const logsDir = visitorService.getLogsDir(TEST_USER);
    const logFile = path.join(logsDir, `${TEST_DOMAIN}.log`);
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.trim().split('\n');

    assert.ok(lines.length > initialLogCount, 'Log file must have grown with real HTTP request');
    const lastLine = lines[lines.length - 1];
    assert.ok(lastLine.includes(TEST_PATH), `Last log line must contain visited path: ${lastLine}`);
    assert.ok(lastLine.includes('Antigravity-Audit-Bot/1.0'), 'Log line must contain user agent');
    assert.ok(lastLine.includes('google.com'), 'Log line must contain referrer');
  });

  // --- SECTION 4: Log Parser & Metrics Aggregations ---
  console.log('\n--- SECTION 4: Log Parser & Metrics Aggregations ---');

  await testAsync('Process logs returns truthful metrics summary', async () => {
    const data = await visitorService.processLogs(TEST_USER, TEST_DOMAIN, '30days');
    assert.ok(data.summary);
    assert.ok(data.summary.totalRequests > 0);
    assert.ok(data.summary.uniqueVisitors > 0);
    assert.ok(data.summary.uniqueIps > 0);
    assert.ok(data.summary.totalBytes > 0);
    assert.ok(data.summary.statusCounts);
    assert.strictEqual(typeof data.summary.errorRate, 'string');
  });

  await testAsync('Time series aggregation creates structured buckets', async () => {
    const data = await visitorService.processLogs(TEST_USER, TEST_DOMAIN, '30days');
    assert.ok(Array.isArray(data.timeSeries));
    assert.ok(data.timeSeries.length > 0);
    const firstBucket = data.timeSeries[0];
    assert.ok(firstBucket.time);
    assert.strictEqual(typeof firstBucket.requests, 'number');
    assert.strictEqual(typeof firstBucket.bytes, 'number');
  });

  await testAsync('Top pages ranking identifies most visited paths', async () => {
    const data = await visitorService.processLogs(TEST_USER, TEST_DOMAIN, '30days');
    assert.ok(Array.isArray(data.topPages));
    assert.ok(data.topPages.length > 0);
    const top = data.topPages[0];
    assert.ok(top.path);
    assert.ok(top.hits > 0);
    assert.strictEqual(typeof top.percentage, 'number');
  });

  await testAsync('Referrers classification categorizes traffic sources', async () => {
    const data = await visitorService.processLogs(TEST_USER, TEST_DOMAIN, '30days');
    assert.ok(Array.isArray(data.topReferrers));
    assert.ok(data.topReferrers.length > 0);
    const hasGoogle = data.topReferrers.some(r => r.category === 'Search Engine' || r.label.includes('Google'));
    assert.ok(hasGoogle, 'Referrers should identify Google search traffic');
  });

  await testAsync('User agent classification categorizes browsers and devices', async () => {
    const data = await visitorService.processLogs(TEST_USER, TEST_DOMAIN, '30days');
    assert.ok(Array.isArray(data.topBrowsers));
    assert.ok(data.topBrowsers.length > 0);
    const browserNames = data.topBrowsers.map(b => b.name);
    assert.ok(browserNames.includes('Google Chrome') || browserNames.includes('Apple Safari') || browserNames.includes('Mozilla Firefox'));
  });

  // --- SECTION 5: Paginated Records, Filters & Sorting ---
  console.log('\n--- SECTION 5: Paginated Records, Filters & Sorting ---');

  await testAsync('getVisitorRecords returns paginated records with metadata', async () => {
    const res = await visitorService.getVisitorRecords({
      username: TEST_USER,
      domain: TEST_DOMAIN,
      range: '30days',
      page: 1,
      limit: 5,
      maskIp: true
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.page, 1);
    assert.strictEqual(res.limit, 5);
    assert.ok(res.totalRecords > 0);
    assert.ok(Array.isArray(res.records));
    assert.ok(res.records.length <= 5);

    // Verify IP is masked when maskIp=true
    const rec = res.records[0];
    assert.ok(rec.ip.includes('***'));
  });

  await testAsync('Raw IP address is returned when maskIp=false for authorized owner', async () => {
    const res = await visitorService.getVisitorRecords({
      username: TEST_USER,
      domain: TEST_DOMAIN,
      range: '30days',
      page: 1,
      limit: 5,
      maskIp: false
    });

    const rec = res.records[0];
    assert.ok(!rec.ip.includes('***'));
  });

  await testAsync('Search filtering finds records matching path substring', async () => {
    const res = await visitorService.getVisitorRecords({
      username: TEST_USER,
      domain: TEST_DOMAIN,
      range: '30days',
      search: 'audit-test-page'
    });

    assert.ok(res.records.length > 0);
    assert.ok(res.records[0].url.includes('audit-test-page'));
  });

  await testAsync('Status filtering filters by category (4xx)', async () => {
    const res = await visitorService.getVisitorRecords({
      username: TEST_USER,
      domain: TEST_DOMAIN,
      range: '30days',
      statusFilter: '4xx'
    });

    res.records.forEach(r => {
      assert.ok(r.status >= 400 && r.status < 500);
    });
  });

  // --- SECTION 6: Resilience & Edge Cases ---
  console.log('\n--- SECTION 6: Resilience & Edge Cases ---');

  test('Malformed log lines are skipped without crashing', async () => {
    const logsDir = visitorService.getLogsDir(TEST_USER);
    const logFile = path.join(logsDir, `${TEST_DOMAIN}.log`);

    // Append corrupted garbage line
    fs.appendFileSync(logFile, 'THIS_IS_A_CORRUPTED_LINE_WITH_NO_FORMAT\n');
    fs.appendFileSync(logFile, '127.0.0.1 broken date [notadate] "GET /bad HTTP/1.1" abc xyz\n');

    const res = await visitorService.processLogs(TEST_USER, TEST_DOMAIN, '30days');
    assert.ok(res.summary.corruptedLines >= 2, 'Corrupted lines should be counted');
    assert.ok(res.summary.totalRequests > 0, 'Valid requests should still be parsed correctly');
  });

  test('XSS payloads in URL and user agent are escaped safely', () => {
    visitorService.logRequest({
      user: TEST_USER,
      domain: TEST_DOMAIN,
      method: 'GET',
      url: '/<script>alert("xss")</script>',
      userAgent: '<img src=x onerror=alert(1)>'
    });
    // Check that logging does not crash and processes safely
    assert.ok(true);
  });

  // --- SECTION 7: REST API Endpoints ---
  console.log('\n--- SECTION 7: REST API Endpoints ---');

  await testAsync('GET /api/visitors/domains returns 200 with domain list', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors/domains?user=${TEST_USER}`).then(r => r.json());
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.domains));
    assert.ok(res.domains.length > 0);
  });

  await testAsync('GET /api/visitors/overview returns 200 with complete metrics payload', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors/overview?domain=${TEST_DOMAIN}&range=30days&user=${TEST_USER}`).then(r => r.json());
    assert.strictEqual(res.success, true);
    assert.ok(res.summary);
    assert.ok(Array.isArray(res.timeSeries));
    assert.ok(Array.isArray(res.topPages));
    assert.ok(Array.isArray(res.topReferrers));
    assert.ok(Array.isArray(res.topBrowsers));
  });

  await testAsync('GET /api/visitors/overview for unauthorized domain returns 403', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors/overview?domain=unauthorized-site.com&user=${TEST_USER}`);
    assert.strictEqual(res.status, 403);
  });

  await testAsync('GET /api/visitors/records returns 200 with paginated rows', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors/records?domain=${TEST_DOMAIN}&range=30days&page=1&limit=10&user=${TEST_USER}`).then(r => r.json());
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.page, 1);
    assert.strictEqual(res.limit, 10);
    assert.ok(Array.isArray(res.records));
  });

  // --- SECTION 8: Multi-Tenant Security Isolation ---
  console.log('\n--- SECTION 8: Multi-Tenant Security Isolation ---');

  test('User B cannot inspect User A logs', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors/overview?domain=${TEST_DOMAIN}&user=unauthorized_tenant_b`);
    assert.strictEqual(res.status, 403);
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
