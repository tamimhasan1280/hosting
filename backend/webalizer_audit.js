/**
 * Comprehensive Automated Audit for Feature #31: Webalizer (Metrics -> Webalizer)
 *
 * Tests:
 * 1. Truthful Capability Detection (webalizer executable, engine, and GeoIP detection)
 * 2. Multi-tenant Domain Authorization (authorized vs foreign domains)
 * 3. Periods & Historical Months Discovery
 * 4. General Summary KPI Metrics (Hits, Files, Pages, Visits, Sites, KBytes, Daily/Hourly Averages)
 * 5. Daily Usage Statistics (Days 1-31, Hits, Files, Pages, Visits, Sites, KBytes)
 * 6. Hourly Usage Distribution (00:00 - 23:00)
 * 7. Top URLs, Entry Pages, and Exit Pages
 * 8. Top Sites / Client Hosts (with Anonymization / Privacy Masking verification)
 * 9. HTTP Status Codes, Referrers, Browsers & Search Strings
 * 10. Classic Webalizer HTML and Plaintext Report Export
 * 11. Live HTTP Access Log Traffic Detection via /site
 * 12. Security Isolation & Authorization Enforcement (403 on foreign domain, 400 on traversal)
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
  console.log('  RUNNING FEATURE #31: WEBALIZER BACKEND AUDIT');
  console.log('================================================================\n');

  // Test 1: Capabilities
  console.log('--- TEST 1: Truthful Capability Detection ---');
  try {
    const res = await request('GET', '/api/webalizer/capabilities');
    assert.strictEqual(res.status, 200, 'Capabilities must return HTTP 200');
    const json = res.json();
    assert.ok(json, 'Response must be valid JSON');
    assert.strictEqual(typeof json.webalizerInstalled, 'boolean', 'webalizerInstalled must be boolean');
    assert.strictEqual(typeof json.geoIpInstalled, 'boolean', 'geoIpInstalled must be boolean');
    assert.strictEqual(json.geoIpInstalled, false, 'geoIpInstalled must be false as GeoIP is not installed');
    assert.ok(json.engine === 'native_webalizer' || json.engine === 'embedded_access_log', 'Engine must be valid');
    logPass(`Capabilities verified: engine=${json.engine}, webalizerInstalled=${json.webalizerInstalled}, geoIpInstalled=${json.geoIpInstalled}`);
  } catch (err) {
    logFail('Capability Detection failed', err);
  }

  // Test 2: Authorized Domains
  console.log('\n--- TEST 2: Authorized Domain Listing ---');
  let authorizedDomain = null;
  try {
    const res = await request('GET', '/api/webalizer/domains');
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
    const res = await request('GET', `/api/webalizer/periods?domain=${encodeURIComponent(authorizedDomain)}`);
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
  console.log('\n--- TEST 4: General Summary KPI Metrics ---');
  let reportData = null;
  try {
    const res = await request('GET', `/api/webalizer/report?domain=${encodeURIComponent(authorizedDomain)}&period=${encodeURIComponent(selectedPeriod)}`);
    assert.strictEqual(res.status, 200, 'Report must return HTTP 200');
    reportData = res.json();
    assert.ok(reportData, 'Report must be JSON');
    assert.strictEqual(reportData.domain, authorizedDomain, 'Report domain must match');

    const sum = reportData.generalSummary;
    assert.ok(sum, 'Report must contain generalSummary object');
    assert.strictEqual(typeof sum.totalHits, 'number', 'totalHits must be number');
    assert.strictEqual(typeof sum.totalFiles, 'number', 'totalFiles must be number');
    assert.strictEqual(typeof sum.totalPages, 'number', 'totalPages must be number');
    assert.strictEqual(typeof sum.totalVisits, 'number', 'totalVisits must be number');
    assert.strictEqual(typeof sum.totalSites, 'number', 'totalSites must be number');
    assert.strictEqual(typeof sum.totalKBytes, 'number', 'totalKBytes must be number');
    assert.ok(typeof sum.formattedBytes === 'string', 'formattedBytes must be string');
    assert.strictEqual(typeof sum.avgHitsPerDay, 'number', 'avgHitsPerDay must be number');
    assert.strictEqual(typeof sum.avgFilesPerDay, 'number', 'avgFilesPerDay must be number');
    assert.strictEqual(typeof sum.avgPagesPerDay, 'number', 'avgPagesPerDay must be number');
    assert.strictEqual(typeof sum.avgVisitsPerDay, 'number', 'avgVisitsPerDay must be number');

    logPass(`Webalizer summary verified: Hits=${sum.totalHits}, Files=${sum.totalFiles}, Pages=${sum.totalPages}, Visits=${sum.totalVisits}, Sites=${sum.totalSites}, Data=${sum.formattedBytes} (${sum.totalKBytes} KB)`);
  } catch (err) {
    logFail('General Summary KPI Metrics failed', err);
  }

  // Test 5: Daily Usage Statistics
  console.log('\n--- TEST 5: Daily Usage Statistics ---');
  try {
    const daily = reportData.dailyStatistics;
    assert.ok(Array.isArray(daily), 'dailyStatistics must be an array');
    assert.ok(daily.length > 0, 'dailyStatistics must contain recorded days');

    daily.forEach(d => {
      assert.strictEqual(typeof d.day, 'number', 'day must be number');
      assert.ok(typeof d.date === 'string', 'date must be string');
      assert.strictEqual(typeof d.hits, 'number', 'hits must be number');
      assert.strictEqual(typeof d.files, 'number', 'files must be number');
      assert.strictEqual(typeof d.pages, 'number', 'pages must be number');
      assert.strictEqual(typeof d.visits, 'number', 'visits must be number');
      assert.strictEqual(typeof d.sites, 'number', 'sites must be number');
      assert.strictEqual(typeof d.kbytes, 'number', 'kbytes must be number');
    });

    logPass(`Daily statistics verified (${daily.length} active day(s) mapped with hits, files, pages, visits, sites, and kbytes)`);
  } catch (err) {
    logFail('Daily Usage Statistics failed', err);
  }

  // Test 6: Hourly Usage Distribution
  console.log('\n--- TEST 6: Hourly Usage Distribution (00:00 - 23:00) ---');
  try {
    const hourly = reportData.hourlyStatistics;
    assert.ok(Array.isArray(hourly), 'hourlyStatistics must be an array');
    assert.strictEqual(hourly.length, 24, 'hourlyStatistics must contain all 24 hours');

    let totalHourlyHits = 0;
    hourly.forEach((h, idx) => {
      assert.strictEqual(h.hour, idx, `Hour index must match ${idx}`);
      assert.ok(h.hourLabel.includes(String(idx).padStart(2, '0')), 'Hour label must include hour string');
      totalHourlyHits += h.hits;
    });

    assert.strictEqual(totalHourlyHits, reportData.generalSummary.totalHits, 'Sum of hourly hits must equal totalHits');

    logPass(`Hourly distribution verified: 24 slots accounted for, sum matches totalHits (${totalHourlyHits})`);
  } catch (err) {
    logFail('Hourly Usage Distribution failed', err);
  }

  // Test 7: Top URLs, Entry Pages, and Exit Pages
  console.log('\n--- TEST 7: Top URLs, Entry Pages, and Exit Pages ---');
  try {
    assert.ok(Array.isArray(reportData.topUrls), 'topUrls must be an array');
    assert.ok(Array.isArray(reportData.topEntryPages), 'topEntryPages must be an array');
    assert.ok(Array.isArray(reportData.topExitPages), 'topExitPages must be an array');

    if (reportData.topUrls.length > 0) {
      const sample = reportData.topUrls[0];
      assert.ok(typeof sample.path === 'string', 'path must be string');
      assert.strictEqual(typeof sample.hits, 'number', 'hits must be number');
      assert.strictEqual(typeof sample.kbytes, 'number', 'kbytes must be number');
    }

    logPass(`Top URLs (${reportData.topUrls.length}), Entry Pages (${reportData.topEntryPages.length}), and Exit Pages (${reportData.topExitPages.length}) verified`);
  } catch (err) {
    logFail('Top URLs, Entry Pages, and Exit Pages failed', err);
  }

  // Test 8: Top Sites / Hosts with Privacy Masking
  console.log('\n--- TEST 8: Top Sites / Hosts with Privacy Masking ---');
  try {
    assert.ok(Array.isArray(reportData.topSites), 'topSites must be an array');

    // Test anonymize=true
    const anonRes = await request('GET', `/api/webalizer/report?domain=${encodeURIComponent(authorizedDomain)}&period=${encodeURIComponent(selectedPeriod)}&anonymize=true`);
    const anonData = anonRes.json();
    assert.ok(Array.isArray(anonData.topSites), 'anonData topSites must be an array');
    if (anonData.topSites.length > 0) {
      const sampleSite = anonData.topSites[0].host || anonData.topSites[0].ip;
      assert.ok(sampleSite.includes('***'), `Site ${sampleSite} must be masked with *** when anonymize=true`);
    }

    logPass(`Top Sites (${reportData.topSites.length}) and privacy masking toggle verified`);
  } catch (err) {
    logFail('Top Sites / Hosts with Privacy Masking failed', err);
  }

  // Test 9: HTTP Status Codes, Referrers, Browsers & Search Strings
  console.log('\n--- TEST 9: HTTP Status Codes, Referrers, Browsers & Search Strings ---');
  try {
    assert.ok(Array.isArray(reportData.statusCodes), 'statusCodes must be an array');
    assert.ok(Array.isArray(reportData.topReferrers), 'topReferrers must be an array');
    assert.ok(Array.isArray(reportData.topUserAgents), 'topUserAgents must be an array');
    assert.ok(Array.isArray(reportData.searchStrings), 'searchStrings must be an array');

    reportData.statusCodes.forEach((sc) => {
      assert.strictEqual(typeof sc.code, 'number', 'Status code must be numeric');
      assert.ok(typeof sc.description === 'string', 'Status description must be string');
      assert.strictEqual(typeof sc.hits, 'number', 'Hits must be number');
    });

    logPass(`Status codes (${reportData.statusCodes.length}), Referrers (${reportData.topReferrers.length}), User Agents (${reportData.topUserAgents.length}), and Search Strings (${reportData.searchStrings.length}) verified`);
  } catch (err) {
    logFail('HTTP Status Codes, Referrers, Browsers & Search Strings failed', err);
  }

  // Test 10: Classic Webalizer HTML and Plaintext Report Export
  console.log('\n--- TEST 10: Classic Webalizer HTML and Plaintext Export ---');
  try {
    // HTML export
    const htmlRes = await request('GET', `/api/webalizer/export?domain=${encodeURIComponent(authorizedDomain)}&period=${encodeURIComponent(selectedPeriod)}&format=html`);
    assert.strictEqual(htmlRes.status, 200, 'HTML export must return HTTP 200');
    assert.ok(htmlRes.headers['content-type'].includes('text/html'), 'HTML export must have text/html Content-Type');
    assert.ok(htmlRes.body.includes('Usage Statistics for'), 'HTML export must contain Webalizer title');
    assert.ok(htmlRes.body.includes('Monthly Statistics'), 'HTML export must contain Monthly Statistics');

    // Plaintext export
    const txtRes = await request('GET', `/api/webalizer/export?domain=${encodeURIComponent(authorizedDomain)}&period=${encodeURIComponent(selectedPeriod)}&format=txt`);
    assert.strictEqual(txtRes.status, 200, 'TXT export must return HTTP 200');
    assert.ok(txtRes.headers['content-type'].includes('text/plain'), 'TXT export must have text/plain Content-Type');
    assert.ok(txtRes.body.includes('WEBALIZER'), 'TXT export must contain Webalizer header');
    assert.ok(txtRes.body.includes('DAILY STATISTICS'), 'TXT export must contain Daily Statistics');

    logPass('Webalizer HTML and TXT report export formats verified');
  } catch (err) {
    logFail('Classic Webalizer HTML and Plaintext Export failed', err);
  }

  // Test 11: Live HTTP Traffic Detection via /site
  console.log('\n--- TEST 11: Live Traffic Detection via /site ---');
  try {
    // 1. Fetch current hit count
    const beforeRes = await request('GET', `/api/webalizer/report?domain=${encodeURIComponent(authorizedDomain)}&period=current_month`);
    const beforeHits = beforeRes.json()?.generalSummary?.totalHits || 0;

    // 2. Generate live HTTP request through web server /site
    const testProbePath = `/site/webalizer-audit-test-${Date.now()}.html?domain=${encodeURIComponent(authorizedDomain)}`;
    await request('GET', testProbePath, null, {
      'Host': authorizedDomain,
      'x-cpanel-domain': authorizedDomain,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // 3. Flush cache to force fresh aggregation
    await request('POST', `/api/webalizer/refresh?domain=${encodeURIComponent(authorizedDomain)}`);

    // 4. Fetch updated report
    const afterRes = await request('GET', `/api/webalizer/report?domain=${encodeURIComponent(authorizedDomain)}&period=current_month`);
    const afterHits = afterRes.json()?.generalSummary?.totalHits || 0;

    assert.ok(afterHits > beforeHits, `Hits should increase: before=${beforeHits}, after=${afterHits}`);

    logPass(`Live HTTP traffic on /site updates Webalizer analytics in real-time (${beforeHits} -> ${afterHits})`);
  } catch (err) {
    logFail('Live Traffic Detection failed', err);
  }

  // Test 12: Security Isolation & Authorization Enforcement
  console.log('\n--- TEST 12: Security Isolation & Authorization Enforcement ---');
  try {
    const unauthorizedRes = await request('GET', '/api/webalizer/report?domain=unauthorized-foreign-domain.com');
    assert.strictEqual(unauthorizedRes.status, 403, 'Unauthorized domain must return HTTP 403');

    const crossUserRes = await request('GET', `/api/webalizer/report?domain=${encodeURIComponent(authorizedDomain)}&user=unauthorized_tenant_xyz`);
    assert.strictEqual(crossUserRes.status, 403, 'Cross-user domain access must return HTTP 403');

    const unauthorizedExport = await request('GET', '/api/webalizer/export?domain=unauthorized-foreign-domain.com');
    assert.strictEqual(unauthorizedExport.status, 403, 'Unauthorized export must return HTTP 403');

    const traversalRes = await request('GET', '/api/webalizer/report?domain=../../../etc/passwd');
    assert.ok(traversalRes.status === 400 || traversalRes.status === 403, 'Path traversal domain must return 400 or 403');

    const missingDomainRes = await request('GET', '/api/webalizer/report');
    assert.strictEqual(missingDomainRes.status, 400, 'Missing domain must return HTTP 400');

    logPass('Security isolation and authorization checks passed: 403 on unauthorized domains/cross-tenant, 400 on missing/invalid params');
  } catch (err) {
    logFail('Security Isolation failed', err);
  }

  console.log('\n================================================================');
  console.log(`  WEBALIZER AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
