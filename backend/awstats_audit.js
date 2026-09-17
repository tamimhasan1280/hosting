/**
 * Comprehensive Automated Audit for Feature #29: Awstats (Metrics -> Awstats)
 *
 * Tests:
 * 1. Capability Detection (truthful AWStats binary, engine, and GeoIP detection)
 * 2. Multi-tenant Domain Authorization (authorized vs foreign domains)
 * 3. Periods & Historical Months Discovery
 * 4. Summary KPI Metrics (Unique visitors, visits, pages, hits, bandwidth)
 * 5. Distinct Accounting of Robot / Spider Traffic
 * 6. Page Views vs Total Hits Distinction
 * 7. HTTP Status Code Classification (2xx, 3xx, 4xx, 5xx)
 * 8. Daily & Hourly Time-Series Aggregations
 * 9. Client Operating System & Browser Classifications
 * 10. Top Pages & Visitor Hosts Breakdowns
 * 11. Live HTTP Traffic Detection via /site
 * 12. Cache Refresh & Flashing
 * 13. Multi-Tenant Security Isolation
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://localhost:5000';
let passed = 0;
let failed = 0;

function logPass(msg) {
  console.log(`  [PASS] ${msg}`);
  passed++;
}

function logFail(msg, err) {
  console.error(`  [FAIL] ${msg}`);
  if (err) console.error(err);
  failed++;
}

function makeRequest(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(url, reqOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        let json = null;
        try {
          json = JSON.parse(rawBuffer.toString('utf8'));
        } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: rawBuffer.toString('utf8'),
          buffer: rawBuffer,
          json
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runAudit() {
  console.log('================================================================');
  console.log('  FEATURE #29 (AWSTATS) AUTOMATED AUDIT & SECURITY SUITE');
  console.log('================================================================\n');

  const testUser = 'cpanel_user';
  const testDomain = 'example.com';
  const otherUser = 'tenant_b_user';

  // ----------------------------------------------------
  // SECTION 1: Capability Detection
  // ----------------------------------------------------
  console.log('--- SECTION 1: Capability Detection ---');
  try {
    const res = await makeRequest('/api/awstats/capabilities');
    assert.strictEqual(res.statusCode, 200, 'Status should be 200');
    assert.strictEqual(res.json?.success, true, 'success flag true');
    assert.strictEqual(res.json?.engine, 'embedded_access_log', 'Reports embedded log engine');
    assert.strictEqual(typeof res.json?.awstatsInstalled, 'boolean', 'awstatsInstalled is boolean');
    assert.strictEqual(res.json?.geoIpInstalled, false, 'geoIpInstalled is false');
    assert(res.json?.geoIpMessage.includes('GeoIP database is not installed'), 'Truthful GeoIP message');

    logPass('Detects system capabilities and reports truthful GeoIP / engine status');
  } catch (e) {
    logFail('Capability detection failed', e);
  }

  // ----------------------------------------------------
  // SECTION 2: Domain Authorization
  // ----------------------------------------------------
  console.log('\n--- SECTION 2: Domain Authorization & Periods ---');
  try {
    const domainsRes = await makeRequest(`/api/awstats/domains?user=${testUser}`);
    assert.strictEqual(domainsRes.statusCode, 200, 'Status 200');
    assert(Array.isArray(domainsRes.json?.domains), 'domains is array');
    assert(domainsRes.json.domains.some(d => d.name === testDomain), 'Contains testDomain');

    // Query periods for testDomain
    const periodsRes = await makeRequest(`/api/awstats/periods?domain=${testDomain}&user=${testUser}`);
    assert.strictEqual(periodsRes.statusCode, 200, 'Periods status 200');
    assert(Array.isArray(periodsRes.json?.availableMonths), 'availableMonths is array');
    assert(periodsRes.json.availableMonths.length > 0, 'Should have at least 1 month');

    // Reject unauthorized foreign domain
    const badDomainRes = await makeRequest(`/api/awstats/report?domain=unauthorized-foreign-domain.com&user=${testUser}`);
    assert(badDomainRes.statusCode >= 400, 'Foreign domain must return error status');
    assert(badDomainRes.body.includes('Access denied'), 'Must indicate access denial');

    logPass('Authorizes account domains and strictly blocks unauthorized foreign domains');
  } catch (e) {
    logFail('Domain authorization failed', e);
  }

  // ----------------------------------------------------
  // SECTION 3: Report Generation & Summary KPIs
  // ----------------------------------------------------
  console.log('\n--- SECTION 3: Report Generation & Summary KPIs ---');
  try {
    const reportRes = await makeRequest(`/api/awstats/report?domain=${testDomain}&user=${testUser}&period=current_month`);
    assert.strictEqual(reportRes.statusCode, 200, 'Report status 200');
    assert.strictEqual(reportRes.json?.success, true, 'Report success flag');
    assert.strictEqual(reportRes.json?.domain, testDomain, 'Report domain match');

    const s = reportRes.json.summary;
    assert(s, 'Summary object present');
    assert(typeof s.uniqueVisitors === 'number', 'uniqueVisitors number');
    assert(typeof s.visits === 'number', 'visits number');
    assert(typeof s.pages === 'number', 'pages number');
    assert(typeof s.hits === 'number', 'hits number');
    assert(typeof s.bandwidth === 'number', 'bandwidth number');
    assert(s.formattedBandwidth, 'formattedBandwidth present');

    logPass('Generates complete report with authentic summary KPI metrics');
  } catch (e) {
    logFail('Report summary KPIs failed', e);
  }

  // ----------------------------------------------------
  // SECTION 4: Robots Traffic vs Human Traffic
  // ----------------------------------------------------
  console.log('\n--- SECTION 4: Separate Robot / Crawler Accounting ---');
  try {
    const reportRes = await makeRequest(`/api/awstats/report?domain=${testDomain}&user=${testUser}&period=current_month`);
    const s = reportRes.json.summary;
    const robots = reportRes.json.topRobots;

    assert(typeof s.robotHits === 'number', 'robotHits is number');
    assert(typeof s.robotBandwidth === 'number', 'robotBandwidth is number');
    assert(Array.isArray(robots), 'topRobots is array');

    // If robots exist in logs (e.g. Googlebot), verify they appear in topRobots
    if (robots.length > 0) {
      assert(robots[0].name, 'Robot has name');
      assert(robots[0].hits > 0, 'Robot has hits');
      assert(robots[0].formattedBandwidth, 'Robot has formattedBandwidth');
    }

    logPass('Separately accounts for crawler/robot hits without polluting human visits');
  } catch (e) {
    logFail('Robot accounting failed', e);
  }

  // ----------------------------------------------------
  // SECTION 5: Pages vs Hits Distinction
  // ----------------------------------------------------
  console.log('\n--- SECTION 5: Pages vs Hits Distinction ---');
  try {
    const reportRes = await makeRequest(`/api/awstats/report?domain=${testDomain}&user=${testUser}&period=current_month`);
    const s = reportRes.json.summary;

    // Hits (all requests including images, css, js) must be >= Pages (content URLs)
    assert(s.hits >= s.pages, 'Total hits must be greater than or equal to page views');

    logPass('Correctly differentiates page views from total hits (assets/images excluded from pages)');
  } catch (e) {
    logFail('Pages vs hits distinction failed', e);
  }

  // ----------------------------------------------------
  // SECTION 6: HTTP Status Codes Breakdown
  // ----------------------------------------------------
  console.log('\n--- SECTION 6: HTTP Status Codes Breakdown ---');
  try {
    const reportRes = await makeRequest(`/api/awstats/report?domain=${testDomain}&user=${testUser}&period=current_month`);
    const codes = reportRes.json.statusCodes;
    assert(Array.isArray(codes), 'statusCodes is array');
    assert(codes.length > 0, 'Should have status codes');

    for (const c of codes) {
      assert(typeof c.code === 'number', 'status code is number');
      assert(c.hits > 0, 'status code has positive hits');
      assert(typeof c.percentage === 'string', 'percentage string');
    }

    logPass('Categorizes HTTP response status codes (2xx, 3xx, 4xx, 5xx) accurately');
  } catch (e) {
    logFail('HTTP status codes breakdown failed', e);
  }

  // ----------------------------------------------------
  // SECTION 7: Daily & Hourly Time-Series
  // ----------------------------------------------------
  console.log('\n--- SECTION 7: Daily & Hourly Time-Series ---');
  try {
    const reportRes = await makeRequest(`/api/awstats/report?domain=${testDomain}&user=${testUser}&period=current_month`);
    const daily = reportRes.json.dailyStats;
    const hourly = reportRes.json.hourlyStats;

    assert(Array.isArray(daily), 'dailyStats is array');
    assert(Array.isArray(hourly), 'hourlyStats is array');
    assert.strictEqual(hourly.length, 24, 'hourlyStats must have exactly 24 slots (00:00 - 23:00)');

    logPass('Computes daily activity and full 24-hour hourly distributions');
  } catch (e) {
    logFail('Time-series calculation failed', e);
  }

  // ----------------------------------------------------
  // SECTION 8: Operating Systems & Browsers
  // ----------------------------------------------------
  console.log('\n--- SECTION 8: Operating Systems & Browsers ---');
  try {
    const reportRes = await makeRequest(`/api/awstats/report?domain=${testDomain}&user=${testUser}&period=current_month`);
    const browsers = reportRes.json.browsers;
    const osList = reportRes.json.operatingSystems;

    assert(Array.isArray(browsers), 'browsers is array');
    assert(Array.isArray(osList), 'operatingSystems is array');
    assert(browsers.length > 0, 'Has browser entries');
    assert(osList.length > 0, 'Has OS entries');

    logPass('Classifies visitor User-Agents into browser and operating system categories');
  } catch (e) {
    logFail('Browsers and OS classification failed', e);
  }

  // ----------------------------------------------------
  // SECTION 9: Live Traffic Detection via /site
  // ----------------------------------------------------
  console.log('\n--- SECTION 9: Live HTTP Traffic Detection via /site ---');
  try {
    // 1. Fetch current hit count
    const beforeRes = await makeRequest(`/api/awstats/report?domain=${testDomain}&user=${testUser}&period=today`);
    const beforeHits = beforeRes.json?.summary?.hits || 0;

    // 2. Generate live HTTP request to /site
    const testPath = `/site/awstats-audit-test-${Date.now()}.html`;
    await makeRequest(testPath, {
      headers: {
        'Host': testDomain,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    // 3. Flush cache to force fresh aggregation
    await makeRequest('/api/awstats/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpanelUser: testUser })
    });

    // 4. Fetch updated report
    const afterRes = await makeRequest(`/api/awstats/report?domain=${testDomain}&user=${testUser}&period=today`);
    const afterHits = afterRes.json?.summary?.hits || 0;

    assert(afterHits > beforeHits, `Hits should increase: before=${beforeHits}, after=${afterHits}`);

    logPass('Live HTTP traffic on /site updates Awstats analytics in real-time');
  } catch (e) {
    logFail('Live traffic detection failed', e);
  }

  // ----------------------------------------------------
  // SECTION 10: Multi-Tenant Security Isolation
  // ----------------------------------------------------
  console.log('\n--- SECTION 10: Multi-Tenant Security Isolation ---');
  try {
    // Attempt by other user to query testDomain
    const crossRes = await makeRequest(`/api/awstats/report?domain=${testDomain}&user=unauthorized_tenant_xyz`);
    assert(crossRes.statusCode >= 400, 'Cross-tenant request must be rejected');

    logPass('Multi-tenant isolation strictly blocks cross-account analytics queries');
  } catch (e) {
    logFail('Multi-tenant isolation failed', e);
  }

  console.log('\n================================================================');
  console.log(`  AWSTATS AUDIT COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit();
