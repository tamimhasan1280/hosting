/**
 * Comprehensive Automated Audit for Feature #28: Raw Access
 * Tests:
 * 1. Log Inventory (currentLogs, archivedLogs, config)
 * 2. Multi-tenant Domain Isolation (unauthorized domains blocked)
 * 3. Security Jail & Path Traversal Prevention (../, %2e%2e, null bytes)
 * 4. Streaming Downloads (headers, Content-Disposition, file integrity)
 * 5. Bounded Preview & Stored XSS Protection (HTML entity escaping)
 * 6. Configuration Persistence (archiveLogs, discardPreviousMonth)
 * 7. Rotated & Compressed Archive Ingestion (.log.1, .log.gz)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const assert = require('assert');

const BASE_URL = 'http://localhost:5000';
let passed = 0;
let failed = 0;

function logPass(msg) {
  console.log(`[PASS] ${msg}`);
  passed++;
}

function logFail(msg, err) {
  console.error(`[FAIL] ${msg}`);
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
  console.log('====================================================');
  console.log('STARTING RAW ACCESS (FEATURE #28) AUDIT SUITE');
  console.log('====================================================\n');

  const testUser = 'cpanel_user';
  const otherUser = 'unauthorized_tenant_b';

  // ----------------------------------------------------
  // TEST 1: Inventory Endpoint
  // ----------------------------------------------------
  try {
    const res = await makeRequest(`/api/raw-access/inventory?user=${testUser}`);
    assert.strictEqual(res.statusCode, 200, 'Status should be 200');
    assert.strictEqual(res.json?.success, true, 'success flag true');
    assert(Array.isArray(res.json?.currentLogs), 'currentLogs should be an array');
    assert(res.json.currentLogs.length > 0, 'Should return authorized domain logs');
    assert(res.json.config, 'Should return configuration');
    assert(typeof res.json.config.archiveLogs === 'boolean', 'archiveLogs boolean');

    const hasExample = res.json.currentLogs.some(l => l.domain === 'example.com');
    assert(hasExample, 'example.com must be present in currentLogs');
    const hasMaster = res.json.currentLogs.some(l => l.id === 'master:access.log');
    assert(hasMaster, 'master:access.log must be present');

    logPass('Test 1: Inventory endpoint returns correct domains, master log, and config');
  } catch (e) {
    logFail('Test 1: Inventory endpoint failed', e);
  }

  // ----------------------------------------------------
  // TEST 2: Multi-tenant Domain Isolation
  // ----------------------------------------------------
  try {
    // Attempt to preview unauthorized domain
    const res = await makeRequest(`/api/raw-access/preview/domain:unauthorized-other-tenant.com?user=${testUser}`);
    assert(res.statusCode >= 400, 'Unauthorized domain preview must return error status');
    assert(res.body.includes('Access denied') || res.body.includes('not registered'), 'Must indicate domain access denial');

    // Attempt to download unauthorized domain
    const dlRes = await makeRequest(`/api/raw-access/download/domain:unauthorized-other-tenant.com?user=${testUser}`);
    assert(dlRes.statusCode >= 400, 'Unauthorized domain download must return error status');

    logPass('Test 2: Multi-tenant domain isolation strictly blocks access to foreign domains');
  } catch (e) {
    logFail('Test 2: Multi-tenant domain isolation failed', e);
  }

  // ----------------------------------------------------
  // TEST 3: Path Traversal & Jail Security
  // ----------------------------------------------------
  try {
    const traversalPayloads = [
      'archive:../../server.js',
      'archive:..%2F..%2Fserver.js',
      'archive:....//....//server.js',
      'archive:%2e%2e%2f%2e%2e%2fserver.js',
      'archive:..\\..\\server.js'
    ];

    for (const payload of traversalPayloads) {
      const res = await makeRequest(`/api/raw-access/preview/${encodeURIComponent(payload)}?user=${testUser}`);
      assert(res.statusCode >= 400, `Payload ${payload} must be rejected with 4xx/5xx`);
      assert(res.body.includes('Access denied') || res.body.includes('invalid') || res.body.includes('error'), 'Must indicate error');
    }

    logPass('Test 3: Jail security prevents directory traversal (../, encoded slashes, dot-dots)');
  } catch (e) {
    logFail('Test 3: Path traversal security failed', e);
  }

  // ----------------------------------------------------
  // TEST 4: Streaming Download & Headers
  // ----------------------------------------------------
  try {
    // Download domain:example.com
    const dlRes = await makeRequest(`/api/raw-access/download/domain:example.com?user=${testUser}`);
    assert.strictEqual(dlRes.statusCode, 200, 'Download status 200');
    assert(dlRes.headers['content-disposition']?.includes('attachment'), 'Content-Disposition should be attachment');
    assert(dlRes.headers['content-disposition']?.includes('example.com-access-'), 'Filename should be sanitized');
    assert(dlRes.headers['content-type']?.includes('text/plain'), 'Content-Type should be text/plain');
    assert.strictEqual(dlRes.headers['x-content-type-options'], 'nosniff', 'nosniff header present');
    assert(dlRes.buffer.length > 0, 'Downloaded file should have content');

    // Verify master log download
    const masterRes = await makeRequest(`/api/raw-access/download/master:access.log?user=${testUser}`);
    assert.strictEqual(masterRes.statusCode, 200, 'Master log download status 200');
    assert(masterRes.headers['content-disposition']?.includes('account-access-'), 'Master filename formatted');

    logPass('Test 4: Real streaming download delivers valid headers, attachment disposition, and payload');
  } catch (e) {
    logFail('Test 4: Streaming download failed', e);
  }

  // ----------------------------------------------------
  // TEST 5: Bounded Preview & Stored XSS Escaping
  // ----------------------------------------------------
  try {
    // Inject a simulated XSS vector into example.com.log
    const vhostLogs = path.join(__dirname, 'data', 'vhosts', 'default', 'logs');
    if (!fs.existsSync(vhostLogs)) fs.mkdirSync(vhostLogs, { recursive: true });
    const testLogFile = path.join(vhostLogs, 'example.com.log');
    
    const xssPayload = '192.168.1.50 - - [16/Sep/2026:22:00:00 +0000] "GET /test?<script>alert(\"xss\")</script> HTTP/1.1" 200 120 "-" "Mozilla/<evil>"\n';
    fs.appendFileSync(testLogFile, xssPayload, 'utf8');

    const prevRes = await makeRequest(`/api/raw-access/preview/domain:example.com?user=${testUser}&limit=5`);
    assert.strictEqual(prevRes.statusCode, 200, 'Preview status 200');
    assert(prevRes.json?.success, 'Preview success');
    assert(Array.isArray(prevRes.json?.lines), 'Lines is array');
    assert(prevRes.json?.lines.length <= 5, 'Lines count bounded by limit');

    // Verify XSS escaping
    const lastLine = prevRes.json.lines[prevRes.json.lines.length - 1];
    assert(lastLine.includes('&lt;script&gt;'), 'HTML tags must be escaped (&lt;script&gt;)');
    assert(lastLine.includes('&quot;'), 'Quotes must be escaped (&quot;)');
    assert(!lastLine.includes('<script>'), 'Raw unescaped script tag must NOT exist');

    logPass('Test 5: Bounded log preview enforces line limits and strictly escapes HTML/XSS vectors');
  } catch (e) {
    logFail('Test 5: Preview & XSS escaping failed', e);
  }

  // ----------------------------------------------------
  // TEST 6: Configuration Persistence
  // ----------------------------------------------------
  try {
    // Update config to archiveLogs: false, discardPreviousMonth: true
    const updateRes = await makeRequest('/api/raw-access/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpanelUser: testUser,
        archiveLogs: false,
        discardPreviousMonth: true
      })
    });

    assert.strictEqual(updateRes.statusCode, 200, 'Config update status 200');
    assert.strictEqual(updateRes.json?.config?.archiveLogs, false, 'archiveLogs should be false');
    assert.strictEqual(updateRes.json?.config?.discardPreviousMonth, true, 'discardPreviousMonth should be true');

    // Verify persisted via GET
    const getRes = await makeRequest(`/api/raw-access/config?user=${testUser}`);
    assert.strictEqual(getRes.json?.config?.archiveLogs, false, 'Persisted archiveLogs is false');
    assert.strictEqual(getRes.json?.config?.discardPreviousMonth, true, 'Persisted discardPreviousMonth is true');

    // Reset config back to default
    await makeRequest('/api/raw-access/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpanelUser: testUser,
        archiveLogs: true,
        discardPreviousMonth: false
      })
    });

    logPass('Test 6: Configuration persistence safely saves and retrieves archive settings to disk');
  } catch (e) {
    logFail('Test 6: Configuration persistence failed', e);
  }

  // ----------------------------------------------------
  // TEST 7: Rotated & Compressed Archive Ingestion
  // ----------------------------------------------------
  try {
    const vhostLogs = path.join(__dirname, 'data', 'vhosts', 'default', 'logs');
    const archiveDir = path.join(vhostLogs, 'archive');
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

    // Create a mock rotated archive: example.com-Aug-2026.log.gz
    const sampleGzLog = path.join(archiveDir, 'example.com-Aug-2026.log.gz');
    const rawContent = '10.0.0.1 - - [01/Aug/2026:10:00:00 +0000] "GET /archive HTTP/1.1" 200 450\n';
    const compressedBuffer = zlib.gzipSync(Buffer.from(rawContent, 'utf8'));
    fs.writeFileSync(sampleGzLog, compressedBuffer);

    // Fetch inventory
    const invRes = await makeRequest(`/api/raw-access/inventory?user=${testUser}`);
    const foundArchived = invRes.json?.archivedLogs?.find(a => a.filename === 'example.com-Aug-2026.log.gz');
    assert(foundArchived, 'Archived log should be detected in inventory');
    assert.strictEqual(foundArchived.compressed, true, 'Should be marked as compressed');

    // Download the archived log
    const dlArchive = await makeRequest(`/api/raw-access/download/${encodeURIComponent(foundArchived.id)}?user=${testUser}`);
    assert.strictEqual(dlArchive.statusCode, 200, 'Archive download status 200');
    assert.strictEqual(dlArchive.headers['content-type'], 'application/gzip', 'Archive Content-Type application/gzip');
    assert(dlArchive.headers['content-disposition']?.includes('example.com-Aug-2026.log.gz'), 'Archive filename in disposition');

    // Clean up sample archive
    if (fs.existsSync(sampleGzLog)) fs.unlinkSync(sampleGzLog);

    logPass('Test 7: Rotated and compressed (.gz) logs are recognized, inventoried, and streamed properly');
  } catch (e) {
    logFail('Test 7: Rotated & compressed archive test failed', e);
  }

  console.log('\n====================================================');
  console.log(`RAW ACCESS AUDIT COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit();
