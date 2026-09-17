/**
 * Comprehensive Automated Audit for Feature #30: Analog Stats (Metrics -> Analog Stats)
 *
 * Tests:
 * 1. Truthful Capability Detection (analog executable, engine, and GeoIP detection)
 * 2. Multi-tenant Domain Authorization (authorized vs foreign domains)
 * 3. Periods & Historical Months Discovery
 * 4. General Summary KPI Metrics (Successful, Failed, Total Requests, Pages, Bandwidth, Distinct Files/Hosts)
 * 5. Daily Aggregation & Day-of-Week Summary (Sun-Sat)
 * 6. Hourly Aggregation (00:00 - 23:00)
 * 7. File Type Extension Breakdown (.html, .php, etc.)
 * 8. Top URLs and Top Hosts (with Anonymization / Privacy Masking verification)
 * 9. HTTP Status Code Breakdown (2xx, 3xx, 4xx, 5xx)
 * 10. Referrers, User Agents & OS Breakdown
 * 11. Authentic Classic Analog ASCII Text Report Export
 * 12. Live HTTP Access Log Traffic Detection via /site
 * 13. Multi-Tenant Security Isolation & Authorization Enforcement
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
  console.error(`  [FAIL] ${msg}: ${err ? err.message || err : ''}`);
  failed++;
}

function request(method, pathName, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathName, BASE_URL);
    const reqHeaders = {
      ...headers
    };
    if (body && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            json: () => {
              try {
                return JSON.parse(data);
              } catch (e) {
                return null;
              }
            }
          });
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runAudit() {
  console.log('\n================================================================');
  console.log('  RUNNING FEATURE #30: ANALOG STATS BACKEND AUDIT');
  console.log('================================================================\n');

  // Test 1: Capabilities
  console.log('--- TEST 1: Truthful Capability Detection ---');
  try {
    const res = await request('GET', '/api/analog/capabilities');
    assert.strictEqual(res.status, 200, 'Capabilities must return HTTP 200');
    const json = res.json();
    assert.ok(json, 'Response must be valid JSON');
    assert.strictEqual(typeof json.analogInstalled, 'boolean', 'analogInstalled must be boolean');
    assert.strictEqual(typeof json.geoIpInstalled, 'boolean', 'geoIpInstalled must be boolean');
    assert.strictEqual(json.geoIpInstalled, false, 'geoIpInstalled must be false as GeoIP is not installed');
    assert.ok(json.engine === 'native_analog' || json.engine === 'embedded_access_log', 'Engine must be valid');
    logPass(`Capabilities verified: engine=${json.engine}, analogInstalled=${json.analogInstalled}, geoIpInstalled=${json.geoIpInstalled}`);
  } catch (err) {
    logFail('Capability Detection failed', err);
  }

  // Test 2: Authorized Domains
  console.log('\n--- TEST 2: Authorized Domain Listing ---');
  let authorizedDomain = null;
  try {
    const res = await request('GET', '/api/analog/domains');
    assert.strictEqual(res.status, 200, 'Domains must return HTTP 200');
    const json = res.json();
    assert.ok(json.domains && Array.isArray(json.domains), 'Response must have domains array');
    assert.ok(json.domains.length > 0, 'Must return at least one domain');
    const dItem = json.domains[0];
    authorizedDomain = dItem.domain || dItem.name;
    assert.ok(authorizedDomain, 'Domain name must not be empty');
    assert.ok('hasLog' in dItem || 'logExists' in dItem, 'Domain item must indicate log presence');
    logPass(`Found ${json.domains.length} authorized domain(s). Testing with: ${authorizedDomain}`);
  } catch (err) {
    logFail('Authorized Domain Listing failed', err);
  }

  if (!authorizedDomain) {
    console.error('Fatal: Cannot proceed without an authorized domain.');
    process.exit(1);
  }

  // Test 3: Available Periods
  console.log('\n--- TEST 3: Available Periods Discovery ---');
  let selectedPeriod = null;
  try {
    const res = await request('GET', `/api/analog/periods?domain=${encodeURIComponent(authorizedDomain)}`);
    assert.strictEqual(res.status, 200, 'Periods must return HTTP 200');
    const json = res.json();
    const periods = json.periods || (json.availableMonths ? json.availableMonths.map(m => m.key) : []);
    assert.ok(periods.length > 0, 'Must have at least one available period');
    selectedPeriod = periods[0];
    assert.match(selectedPeriod, /^\d{4}-\d{2}$/, 'Period must match YYYY-MM format');
    logPass(`Discovered periods: ${periods.join(', ')}. Selected: ${selectedPeriod}`);
  } catch (err) {
    logFail('Available Periods Discovery failed', err);
  }

  // Test 4: General Summary KPI Metrics
  console.log('\n--- TEST 4: General Summary Metrics ---');
  let reportData = null;
  try {
    const res = await request('GET', `/api/analog/report?domain=${encodeURIComponent(authorizedDomain)}&period=${encodeURIComponent(selectedPeriod)}`);
    assert.strictEqual(res.status, 200, 'Report must return HTTP 200');
    reportData = res.json();
    assert.ok(reportData, 'Report must be JSON');
    assert.strictEqual(reportData.domain, authorizedDomain, 'Report domain must match');

    const sum = reportData.summary || reportData.generalSummary;
    assert.ok(sum, 'Report must contain summary object');
    assert.strictEqual(typeof sum.successfulRequests, 'number', 'successfulRequests must be a number');
    assert.strictEqual(typeof sum.failedRequests, 'number', 'failedRequests must be a number');
    assert.strictEqual(typeof sum.totalRequests, 'number', 'totalRequests must be a number');
    assert.strictEqual(sum.totalRequests, sum.successfulRequests + sum.failedRequests, 'totalRequests must equal successful + failed');
    assert.strictEqual(typeof sum.distinctFiles, 'number', 'distinctFiles must be a number');
    assert.strictEqual(typeof sum.distinctHosts, 'number', 'distinctHosts must be a number');
    assert.strictEqual(typeof sum.totalPages, 'number', 'totalPages must be a number');
    assert.strictEqual(typeof sum.totalBytes, 'number', 'totalBytes must be a number');
    assert.ok(typeof sum.formattedBytes === 'string', 'formattedBytes must be formatted string');

    logPass(`Summary metrics valid: Total=${sum.totalRequests} (Success=${sum.successfulRequests}, Fail=${sum.failedRequests}), Pages=${sum.totalPages}, Distinct Files=${sum.distinctFiles}, Hosts=${sum.distinctHosts}, Bandwidth=${sum.formattedBytes}`);
  } catch (err) {
    logFail('General Summary Metrics failed', err);
  }

  // Test 5: Daily Aggregation & Day-of-Week Summary
  console.log('\n--- TEST 5: Daily & Day of Week Aggregations ---');
  try {
    const daily = reportData.dailyReport || reportData.dailyActivity;
    const dayOfWeek = reportData.dayOfWeekReport;
    assert.ok(Array.isArray(daily), 'dailyReport must be an array');
    assert.ok(Array.isArray(dayOfWeek), 'dayOfWeekReport must be an array');
    assert.strictEqual(dayOfWeek.length, 7, 'dayOfWeekReport must contain exactly 7 days (Sun-Sat)');

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    dayOfWeek.forEach((d, idx) => {
      assert.strictEqual(d.day, idx, `Day index must match ${idx}`);
      assert.strictEqual(d.dayName, dayNames[idx], `Day name must match ${dayNames[idx]}`);
      assert.strictEqual(typeof d.requests, 'number', 'requests must be number');
      assert.strictEqual(typeof d.pages, 'number', 'pages must be number');
      assert.strictEqual(typeof d.bytes, 'number', 'bytes must be number');
    });

    logPass(`Day of week and daily activity aggregations verified (${daily.length} active days, 7 weekdays mapped)`);
  } catch (err) {
    logFail('Daily & Day of Week Aggregations failed', err);
  }

  // Test 6: Hourly Summary (00:00 - 23:00)
  console.log('\n--- TEST 6: Hourly Activity Aggregation ---');
  try {
    const hourly = reportData.hourlySummary || reportData.hourlyActivity;
    assert.ok(Array.isArray(hourly), 'hourlySummary must be an array');
    assert.strictEqual(hourly.length, 24, 'hourlySummary must contain all 24 hours');

    let totalHourlyReq = 0;
    hourly.forEach((h, idx) => {
      assert.strictEqual(h.hour, idx, `Hour index must match ${idx}`);
      assert.ok(h.hourLabel.includes(String(idx).padStart(2, '0')), 'Hour label must include hour string');
      totalHourlyReq += h.requests;
    });
    const totalRequests = reportData.summary ? reportData.summary.totalRequests : reportData.generalSummary.totalRequests;
    assert.strictEqual(totalHourlyReq, totalRequests, 'Sum of hourly requests must equal totalRequests');

    logPass(`Hourly summary verified: all 24 hours accounted for, sum matches totalRequests (${totalHourlyReq})`);
  } catch (err) {
    logFail('Hourly Activity Aggregation failed', err);
  }

  // Test 7: File Type Extension Breakdown
  console.log('\n--- TEST 7: File Type Extension Breakdown ---');
  try {
    const fileTypes = reportData.fileTypeReport || reportData.fileTypes;
    assert.ok(Array.isArray(fileTypes), 'fileTypes must be an array');
    let totalFileReq = 0;
    fileTypes.forEach((ft) => {
      assert.ok(typeof ft.extension === 'string', 'extension must be string');
      assert.ok(typeof ft.description === 'string', 'description must be string');
      assert.strictEqual(typeof ft.requests, 'number', 'requests must be number');
      assert.strictEqual(typeof ft.bytes, 'number', 'bytes must be number');
      totalFileReq += ft.requests;
    });
    const totalRequests = reportData.summary ? reportData.summary.totalRequests : reportData.generalSummary.totalRequests;
    assert.strictEqual(totalFileReq, totalRequests, 'Sum of file type requests must equal totalRequests');

    logPass(`File types verified (${fileTypes.length} extensions mapped: ${fileTypes.slice(0, 5).map(f => f.extension).join(', ')}...)`);
  } catch (err) {
    logFail('File Type Extension Breakdown failed', err);
  }

  // Test 8: Top URLs & Top Hosts (with Anonymization check)
  console.log('\n--- TEST 8: Top URLs and Top Hosts Anonymization ---');
  try {
    assert.ok(Array.isArray(reportData.topUrls), 'topUrls must be an array');
    assert.ok(Array.isArray(reportData.topHosts), 'topHosts must be an array');

    // Test anonymize=true
    const anonRes = await request('GET', `/api/analog/report?domain=${encodeURIComponent(authorizedDomain)}&period=${encodeURIComponent(selectedPeriod)}&anonymize=true`);
    const anonData = anonRes.json();
    assert.ok(Array.isArray(anonData.topHosts), 'anonData topHosts must be an array');
    if (anonData.topHosts.length > 0) {
      const sampleHost = anonData.topHosts[0].host || anonData.topHosts[0].ip;
      assert.ok(sampleHost.includes('***'), `Host ${sampleHost} must contain *** when anonymize=true`);
    }

    logPass(`Top URLs (${reportData.topUrls.length}) and Top Hosts (${reportData.topHosts.length}) with privacy masking verified`);
  } catch (err) {
    logFail('Top URLs and Top Hosts Anonymization failed', err);
  }

  // Test 9: HTTP Status Codes & Referrers/Browsers/OS
  console.log('\n--- TEST 9: HTTP Status Codes, Referrers, Browsers & OS ---');
  try {
    assert.ok(Array.isArray(reportData.statusCodes), 'statusCodes must be an array');
    assert.ok(Array.isArray(reportData.referrers), 'referrers must be an array');
    assert.ok(Array.isArray(reportData.browsers), 'browsers must be an array');
    const osList = reportData.operatingSystems || reportData.os;
    assert.ok(Array.isArray(osList), 'operatingSystems must be an array');

    reportData.statusCodes.forEach((sc) => {
      assert.strictEqual(typeof sc.code, 'number', 'Status code must be numeric');
      assert.ok(typeof sc.description === 'string', 'Status description must be string');
      assert.strictEqual(typeof sc.requests, 'number', 'Requests must be number');
    });

    logPass(`Status codes (${reportData.statusCodes.length}), Referrers (${reportData.referrers.length}), Browsers (${reportData.browsers.length}), and OS (${osList.length}) verified`);
  } catch (err) {
    logFail('HTTP Status Codes, Referrers, Browsers & OS failed', err);
  }

  // Test 10: Classic Analog ASCII Text Report Export
  console.log('\n--- TEST 10: Classic Analog ASCII Text Report Export ---');
  try {
    const res = await request('GET', `/api/analog/export?domain=${encodeURIComponent(authorizedDomain)}&period=${encodeURIComponent(selectedPeriod)}`);
    assert.strictEqual(res.status, 200, 'Export must return HTTP 200');
    assert.ok(res.headers['content-type'].includes('text/plain'), 'Content-type must be text/plain');
    assert.ok(res.headers['content-disposition'].includes('.txt'), 'Content-disposition must name a .txt file');

    const text = res.body;
    assert.ok(text.includes('ANALOG'), 'Export must contain Analog header');
    assert.ok(text.toUpperCase().includes('GENERAL SUMMARY'), 'Export must contain General Summary section');
    assert.ok(text.toUpperCase().includes('DAILY REPORT') || text.toUpperCase().includes('DAILY SUMMARY'), 'Export must contain Daily Report');
    assert.ok(text.toUpperCase().includes('HOURLY SUMMARY'), 'Export must contain Hourly Summary');
    assert.ok(text.toUpperCase().includes('FILE TYPE'), 'Export must contain File Type Report');
    assert.ok(text.toUpperCase().includes('TOP REQUESTED URLS'), 'Export must contain Top Requested URLs');

    logPass(`ASCII Analog text export verified (${text.length} characters, contains standard Analog report sections)`);
  } catch (err) {
    logFail('Classic Analog ASCII Text Report Export failed', err);
  }

  // Test 11: Live HTTP Traffic Detection & Cache Refresh
  console.log('\n--- TEST 11: Live Traffic Detection & Cache Refresh ---');
  try {
    // 1. Fetch current hit count
    const beforeRes = await request('GET', `/api/analog/report?domain=${encodeURIComponent(authorizedDomain)}&period=current_month`);
    const beforeHits = beforeRes.json()?.generalSummary?.totalRequests || beforeRes.json()?.summary?.totalRequests || 0;

    // 2. Generate live HTTP request through web server /site
    const testProbePath = `/site/analog-audit-test-${Date.now()}.html?domain=${encodeURIComponent(authorizedDomain)}`;
    await request('GET', testProbePath, null, {
      'Host': authorizedDomain,
      'x-cpanel-domain': authorizedDomain,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // 3. Flush cache to force fresh aggregation
    await request('POST', `/api/analog/refresh?domain=${encodeURIComponent(authorizedDomain)}`);

    // 4. Fetch updated report
    const afterRes = await request('GET', `/api/analog/report?domain=${encodeURIComponent(authorizedDomain)}&period=current_month`);
    const afterHits = afterRes.json()?.generalSummary?.totalRequests || afterRes.json()?.summary?.totalRequests || 0;

    assert.ok(afterHits > beforeHits, `Hits should increase: before=${beforeHits}, after=${afterHits}`);

    logPass(`Live HTTP traffic on /site updates Analog Stats analytics in real-time (${beforeHits} -> ${afterHits})`);
  } catch (err) {
    logFail('Live Traffic Detection failed', err);
  }

  // Test 12: Security Isolation & Multi-tenant Authorization
  console.log('\n--- TEST 12: Security Isolation & Authorization Enforcement ---');
  try {
    const unauthorizedRes = await request('GET', '/api/analog/report?domain=unauthorized-foreign-domain.com');
    assert.strictEqual(unauthorizedRes.status, 403, 'Unauthorized domain must return HTTP 403');

    const crossUserRes = await request('GET', `/api/analog/report?domain=${encodeURIComponent(authorizedDomain)}&user=unauthorized_tenant_xyz`);
    assert.strictEqual(crossUserRes.status, 403, 'Cross-user domain access must return HTTP 403');

    const unauthorizedExport = await request('GET', '/api/analog/export?domain=unauthorized-foreign-domain.com');
    assert.strictEqual(unauthorizedExport.status, 403, 'Unauthorized export must return HTTP 403');

    const traversalRes = await request('GET', '/api/analog/report?domain=../../../etc/passwd');
    assert.ok(traversalRes.status === 400 || traversalRes.status === 403, 'Path traversal domain must return 400 or 403');

    const missingDomainRes = await request('GET', '/api/analog/report');
    assert.strictEqual(missingDomainRes.status, 400, 'Missing domain must return HTTP 400');

    logPass('Security isolation and authorization checks passed: 403 on unauthorized domains/cross-tenant, 400 on missing/invalid params');
  } catch (err) {
    logFail('Security Isolation failed', err);
  }

  console.log('\n================================================================');
  console.log(`  ANALOG STATS AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
