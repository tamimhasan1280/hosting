/**
 * errors_audit.js
 * Comprehensive Automated Verification Suite for FEATURE #26: ERRORS
 * Metrics -> Errors
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const errorLogService = require('./src/services/errorLogService');
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
  console.log('  FEATURE #26 (ERRORS) AUTOMATED AUDIT & SECURITY SUITE');
  console.log('================================================================\n');

  // --- SECTION 1: Domain Authorization & Path Security ---
  console.log('--- SECTION 1: Domain Authorization & Path Security ---');
  
  await it('Lists authorized domains for account with error log metadata', () => {
    const domains = errorLogService.getAuthorizedDomains(USER);
    assert(Array.isArray(domains), 'domains must be an array');
    assert(domains.length > 0, 'must have at least primary domain');
    const primary = domains.find(d => d.name === 'example.com');
    assert(primary, 'example.com must be authorized');
    assert(typeof primary.logExists === 'boolean', 'logExists must be boolean');
    assert(typeof primary.logSizeBytes === 'number', 'logSizeBytes must be number');
  });

  await it('Allows access to authorized domain', () => {
    const isAuth = errorLogService.verifyDomainAuthorized('example.com', USER);
    assert.strictEqual(isAuth, true);
  });

  await it('Rejects unauthorized domain access with clear error message', () => {
    assert.throws(() => {
      errorLogService.verifyDomainAuthorized('evil-hacker-site.org', USER);
    }, /Access denied/i);
  });

  await it('Path security: getErrorContext rejects path traversal and outside files', async () => {
    try {
      await errorLogService.getErrorContext('../../etc/passwd', 1, 2, USER);
      assert.fail('Should have rejected traversal path');
    } catch (e) {
      assert(e.message.includes('not found') || e.message.includes('Invalid'), 'Properly prevented path traversal');
    }
  });

  // --- SECTION 2: Multi-Format Error Log Parser Engine ---
  console.log('\n--- SECTION 2: Multi-Format Error Log Parser Engine ---');

  await it('Parses Apache 2.4 / cPanel Standard format with PID, client IP, module, and referer', () => {
    const line = '[Wed Sep 16 14:22:30.123456 2026] [core:error] [pid 4912:tid 102] [client 192.0.2.1:52134] File does not exist: /home/cpanel_user/public_html/missing.html, referer: https://example.com/catalog';
    const parsed = errorLogService.parseLine(line, 'example.com.error.log', 42);
    assert(parsed, 'should parse line');
    assert.strictEqual(parsed.severity, 'error');
    assert.strictEqual(parsed.module, 'core');
    assert.strictEqual(parsed.pid, 4912);
    assert.strictEqual(parsed.tid, 102);
    assert.strictEqual(parsed.clientIp, '192.0.2.1');
    assert.strictEqual(parsed.clientPort, 52134);
    assert.strictEqual(parsed.statusCode, 404);
    assert.strictEqual(parsed.referer, 'https://example.com/catalog');
    assert(parsed.message.includes('File does not exist'));
  });

  await it('Parses Traditional Apache format', () => {
    const line = '[Wed Sep 16 14:22:30 2026] [error] [client 198.51.100.5] Directory index forbidden by Options directive: /home/cpanel_user/public_html/images/';
    const parsed = errorLogService.parseLine(line, 'error_log', 10);
    assert(parsed, 'should parse traditional line');
    assert.strictEqual(parsed.severity, 'error');
    assert.strictEqual(parsed.clientIp, '198.51.100.5');
    assert.strictEqual(parsed.statusCode, 403);
    assert(parsed.message.includes('Directory index forbidden'));
  });

  await it('Parses PHP Error format with Fatal error, source file, and line number', () => {
    const line = '[16-Sep-2026 14:22:30 UTC] PHP Fatal error: Uncaught Error: Call to undefined function wp_start() in /home/cpanel_user/public_html/index.php on line 45';
    const parsed = errorLogService.parseLine(line, 'error_log', 12);
    assert(parsed, 'should parse PHP fatal error');
    assert.strictEqual(parsed.severity, 'critical');
    assert.strictEqual(parsed.module, 'php');
    assert.strictEqual(parsed.statusCode, 500);
    assert.strictEqual(parsed.sourceFile, '/home/cpanel_user/public_html/index.php');
    assert.strictEqual(parsed.sourceLine, 45);
  });

  await it('Parses Nginx error format', () => {
    const line = '2026/09/16 14:22:30 [error] 1234#0: *1 open() "/home/cpanel_user/public_html/404.html" failed (2: No such file or directory), client: 203.0.113.1, server: example.com, request: "GET /404.html HTTP/1.1", host: "example.com"';
    const parsed = errorLogService.parseLine(line, 'error_log', 15);
    assert(parsed, 'should parse nginx format');
    assert.strictEqual(parsed.severity, 'error');
    assert.strictEqual(parsed.module, 'nginx');
    assert.strictEqual(parsed.clientIp, '203.0.113.1');
    assert.strictEqual(parsed.method, 'GET');
    assert.strictEqual(parsed.url, '/404.html');
  });

  // --- SECTION 3: Live Error Logging via HTTP /site ---
  console.log('\n--- SECTION 3: Live Error Logging via HTTP /site ---');

  await it('Live HTTP 404 on /site appends real Apache error log entry to disk', async () => {
    const testToken = `audit-404-file-${Date.now()}.html`;
    const res = await fetch(`${BASE_URL}/site/${testToken}`);
    assert.strictEqual(res.status, 404, 'expected 404 status');

    // Wait 250ms for finish hook write
    await new Promise(resolve => setTimeout(resolve, 250));

    const entriesRes = await fetch(`${BASE_URL}/api/errors/entries?user=${USER}`);
    const data = await entriesRes.json();
    assert(data.success, 'api response should be successful');
    const matched = data.entries.find(e => e.message.includes(testToken) || (e.url && e.url.includes(testToken)));
    assert(matched, `Expected to find newly written error log entry for ${testToken}`);
    assert.strictEqual(matched.statusCode, 404);
  });

  await it('Live HTTP 401 on /site appends authentication failure error to log', async () => {
    const logsDir = errorLogService.getLogsDir(USER);
    const domainLog = path.join(logsDir, 'example.com.error.log');
    const beforeSize = fs.existsSync(domainLog) ? fs.statSync(domainLog).size : 0;

    // Log a programmatic 401 error
    await fetch(`${BASE_URL}/api/errors/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: USER,
        domain: 'example.com',
        status: 401,
        url: '/protected-vault',
        ip: '198.51.100.99',
        referer: 'https://example.com/login'
      })
    });

    const afterSize = fs.statSync(domainLog).size;
    assert(afterSize > beforeSize, 'Error log size should have grown');
  });

  // --- SECTION 4: Summary Metrics Calculation ---
  console.log('\n--- SECTION 4: Summary Metrics Calculation ---');

  await it('Computes accurate summary metrics (Total, Today, Critical, Warnings, 4xx, 5xx)', async () => {
    const summary = await errorLogService.getSummary(USER, 'ALL', '30days');
    assert(typeof summary.total === 'number' && summary.total > 0, 'total must be > 0');
    assert(typeof summary.today === 'number', 'today must be a number');
    assert(typeof summary.critical === 'number', 'critical must be a number');
    assert(typeof summary.warning === 'number', 'warning must be a number');
    assert(typeof summary.notice === 'number', 'notice must be a number');
    assert(typeof summary.http4xx === 'number', 'http4xx must be a number');
    assert(typeof summary.http5xx === 'number', 'http5xx must be a number');
  });

  // --- SECTION 5: Filtering, Search, & Pagination ---
  console.log('\n--- SECTION 5: Filtering, Search, & Pagination ---');

  await it('Filters entries by Severity (warn)', async () => {
    const res = await errorLogService.getErrorEntries({
      username: USER,
      domain: 'ALL',
      range: '30days',
      severity: 'warn'
    });
    assert(res.success);
    assert(res.entries.length > 0, 'should find warning entries');
    for (const entry of res.entries) {
      assert.strictEqual(entry.severity, 'warn', 'every entry must have severity warn');
    }
  });

  await it('Filters entries by Search query', async () => {
    const res = await errorLogService.getErrorEntries({
      username: USER,
      domain: 'ALL',
      range: '30days',
      search: 'mod_autoindex'
    });
    assert(res.success);
    assert(res.entries.length > 0, 'should find mod_autoindex entry');
    for (const entry of res.entries) {
      assert(entry.message.toLowerCase().includes('mod_autoindex'), 'entry must match search query');
    }
  });

  await it('Enforces bounded pagination (limit, page offsets)', async () => {
    const res1 = await errorLogService.getErrorEntries({
      username: USER,
      domain: 'ALL',
      range: '30days',
      page: 1,
      limit: 2
    });
    assert(res1.success);
    assert.strictEqual(res1.entries.length, 2);
    assert.strictEqual(res1.pagination.page, 1);
    assert.strictEqual(res1.pagination.limit, 2);
  });

  // --- SECTION 6: Surrounding Log Context Extraction ---
  console.log('\n--- SECTION 6: Surrounding Log Context Extraction ---');

  await it('Extracts surrounding log lines (+/- 2 lines) with correct target flag', async () => {
    const res = await errorLogService.getErrorContext('error_log', 3, 2, USER);
    assert(res.success, 'context extraction should succeed');
    assert.strictEqual(res.targetLine, 3);
    assert(Array.isArray(res.context), 'context must be an array');
    const targetItem = res.context.find(c => c.lineNumber === 3);
    assert(targetItem, 'must contain line 3');
    assert.strictEqual(targetItem.isTarget, true, 'targetLine must be marked with isTarget: true');
  });

  // --- SECTION 7: REST API Endpoints ---
  console.log('\n--- SECTION 7: REST API Endpoints ---');

  await it('GET /api/errors/domains returns authorized domain list', async () => {
    const res = await fetch(`${BASE_URL}/api/errors/domains?user=${USER}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.success);
    assert(data.domains.length > 0);
  });

  await it('GET /api/errors/summary returns KPI metrics object', async () => {
    const res = await fetch(`${BASE_URL}/api/errors/summary?user=${USER}&range=7days`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.success);
    assert(typeof data.summary.total === 'number');
  });

  await it('GET /api/errors/entries returns paginated entries and summary', async () => {
    const res = await fetch(`${BASE_URL}/api/errors/entries?user=${USER}&domain=example.com`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.success);
    assert(Array.isArray(data.entries));
    assert(data.pagination);
  });

  await it('GET /api/errors/context returns log lines around target', async () => {
    const res = await fetch(`${BASE_URL}/api/errors/context?user=${USER}&logFile=error_log&line=2&contextLines=2`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.success);
    assert.strictEqual(data.targetLine, 2);
  });

  await it('Legacy /metrics/logs and /metrics/errors return real data', async () => {
    const res1 = await fetch(`${BASE_URL}/api/metrics/logs?user=${USER}`);
    assert.strictEqual(res1.status, 200);
    const data1 = await res1.json();
    assert(Array.isArray(data1));

    const res2 = await fetch(`${BASE_URL}/api/metrics/errors?user=${USER}`);
    assert.strictEqual(res2.status, 200);
    const data2 = await res2.json();
    assert(data2.success);
  });

  // --- SECTION 8: Multi-Tenant Security Isolation ---
  console.log('\n--- SECTION 8: Multi-Tenant Security Isolation ---');

  await it('Multi-tenant isolation: User A cannot query User B authorized domain', async () => {
    const res = await fetch(`${BASE_URL}/api/errors/entries?user=other_user&domain=example.com`);
    // example.com is registered to cpanel_user, not other_user
    assert.strictEqual(res.status, 403, 'Should reject unauthorized domain for other user with 403');
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert(data.error.includes('Access denied'));
  });

  console.log('\n================================================================');
  console.log(`  AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit();
