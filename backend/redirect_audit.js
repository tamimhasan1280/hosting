/**
 * redirect_audit.js — PROMPT 21: Redirects Full Audit
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function ok(label, fn) {
  try { fn(); console.log(`  [PASS] ${label}`); passed++; }
  catch (e) { console.error(`  [FAIL] ${label}: ${e.message}`); failed++; }
}

async function okAsync(label, fn) {
  try { await fn(); console.log(`  [PASS] ${label}`); passed++; }
  catch (e) { console.error(`  [FAIL] ${label}: ${e.message}`); failed++; }
}

function expectThrows(label, fn, match) {
  try {
    fn();
    console.error(`  [FAIL] ${label}: Expected error but got none`);
    failed++;
  } catch (e) {
    if (match && !e.message.toLowerCase().includes(match.toLowerCase())) {
      console.error(`  [FAIL] ${label}: Error "${e.message}" doesn't match "${match}"`);
      failed++;
    } else { console.log(`  [PASS] ${label}`); passed++; }
  }
}

function httpGet(p) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 5000, path: p, method: 'GET', headers: { 'X-cPanel-User': 'test_redir_api' } }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(body) }); } catch { resolve({ status: res.statusCode, body }); } });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.end();
  });
}

function httpPost(p, data) {
  return new Promise((resolve) => {
    const body = JSON.stringify(data || {});
    const req = http.request({ hostname: 'localhost', port: 5000, path: p, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-cPanel-User': 'test_redir_api' } }, (res) => {
      let respBody = '';
      res.on('data', d => respBody += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(respBody) }); } catch { resolve({ status: res.statusCode, body: respBody }); } });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.write(body);
    req.end();
  });
}

function httpPut(p, data) {
  return new Promise((resolve) => {
    const body = JSON.stringify(data || {});
    const req = http.request({ hostname: 'localhost', port: 5000, path: p, method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-cPanel-User': 'test_redir_api' } }, (res) => {
      let respBody = '';
      res.on('data', d => respBody += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(respBody) }); } catch { resolve({ status: res.statusCode, body: respBody }); } });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.write(body);
    req.end();
  });
}

function httpDelete(p) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 5000, path: p, method: 'DELETE', headers: { 'X-cPanel-User': 'test_redir_api' } }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(body) }); } catch { resolve({ status: res.statusCode, body }); } });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.end();
  });
}

const redirectService = require('./src/services/redirectService');
const TEST_USER = 'redirect_audit_user_21';

console.log('\n=== STARTING REDIRECTS (PROMPT 21) FULL AUDIT ===\n');

// --- 1. Target URL Validation ---
console.log('--- 1. Target URL Validation ---');
ok('Valid HTTPS URL accepted', () => { assert.ok(redirectService.validateTargetUrl('https://example.com/page')); });
ok('Valid relative path accepted', () => { assert.ok(redirectService.validateTargetUrl('/new-page')); });
expectThrows('javascript: scheme rejected', () => redirectService.validateTargetUrl('javascript:alert(1)'), 'dangerous');
expectThrows('data: scheme rejected', () => redirectService.validateTargetUrl('data:text/html,<h1>x</h1>'), 'dangerous');
expectThrows('file: scheme rejected', () => redirectService.validateTargetUrl('file:///etc/passwd'), 'dangerous');
expectThrows('CRLF injection rejected', () => redirectService.validateTargetUrl('https://example.com\r\nX-Injected:bad'), 'control');
expectThrows('Empty URL rejected', () => redirectService.validateTargetUrl(''), 'required');

// --- 2. Source Path Normalization ---
console.log('\n--- 2. Source Path Normalization ---');
ok('Empty path normalized to /', () => { assert.strictEqual(redirectService.normalizeSourcePath(''), '/'); });
ok('Leading slash ensured', () => { assert.strictEqual(redirectService.normalizeSourcePath('page'), '/page'); });
ok('Double slashes collapsed', () => { assert.strictEqual(redirectService.normalizeSourcePath('//a//b'), '/a/b'); });
expectThrows('CRLF in path rejected', () => redirectService.normalizeSourcePath('/path\r\n'), 'control');

// --- 3. Loop Detection ---
console.log('\n--- 3. Redirect Loop Detection ---');
expectThrows('Direct self-loop detected', () => {
  redirectService.detectLoop('example.com', '/same', 'https://example.com/same', TEST_USER, null);
}, 'loop');
expectThrows('Relative self-loop detected', () => {
  redirectService.detectLoop('example.com', '/path', '/path', TEST_USER, null);
}, 'loop');

// --- 4. Domain Ownership ---
console.log('\n--- 4. Domain Ownership Validation ---');
expectThrows('Unauthorized domain rejected', () => {
  redirectService.create({ domain: 'attacker.com', sourcePath: '/x', targetUrl: 'https://evil.com', type: '301 Permanent', cpanelUser: TEST_USER });
}, 'not authorized');

// --- 5. CRUD via Service ---
console.log('\n--- 5. Redirect CRUD Operations ---');
// Clean up any previous test state for deterministic execution
const initialData = redirectService._readAccount(TEST_USER);
initialData.redirects = [];
redirectService._writeAccount(initialData, TEST_USER);

let id301, id302;
ok('Create 301 redirect', () => {
  const r = redirectService.create({ domain: 'all', sourcePath: '/old-page', targetUrl: 'https://example.com/new', type: '301 Permanent', cpanelUser: TEST_USER });
  assert.ok(r.id); assert.strictEqual(r.type, '301 Permanent'); assert.strictEqual(r.status, 'Active'); id301 = r.id;
});
ok('Create 302 redirect', () => {
  const r = redirectService.create({ domain: 'all', sourcePath: '/temp', targetUrl: 'https://example.com/tmp', type: '302 Temporary', cpanelUser: TEST_USER });
  assert.strictEqual(r.type, '302 Temporary'); id302 = r.id;
});
expectThrows('Duplicate source rejected', () => {
  redirectService.create({ domain: 'all', sourcePath: '/old-page', targetUrl: 'https://other.com', type: '301 Permanent', cpanelUser: TEST_USER });
}, 'already exists');
ok('getAll returns created redirects', () => {
  const res = redirectService.getAll(TEST_USER);
  assert.ok(res.redirects.length >= 2); assert.ok(res.stats.total >= 2);
  assert.ok(res.stats.permanent >= 1); assert.ok(res.stats.temporary >= 1);
});
ok('getById retrieves record', () => {
  const r = redirectService.getById(id301, TEST_USER); assert.strictEqual(r.id, id301);
});
ok('Update target URL', () => {
  const u = redirectService.update(id301, { targetUrl: 'https://example.com/updated' }, TEST_USER);
  assert.strictEqual(u.targetUrl, 'https://example.com/updated');
});
ok('Toggle status to Disabled', () => { assert.strictEqual(redirectService.toggleStatus(id301, TEST_USER).status, 'Disabled'); });
ok('Toggle status back to Active', () => { assert.strictEqual(redirectService.toggleStatus(id301, TEST_USER).status, 'Active'); });

// --- 6. .htaccess Sync ---
console.log('\n--- 6. .htaccess Synchronization ---');
ok('.htaccess file created with managed block', () => {
  const storageService = require('./src/services/storageService');
  const htPath = path.join(storageService.getRootDir(TEST_USER), 'public_html', '.htaccess');
  assert.ok(fs.existsSync(htPath), '.htaccess exists');
  const c = fs.readFileSync(htPath, 'utf8');
  assert.ok(c.includes('BEGIN MANAGED REDIRECTS'));
  assert.ok(c.includes('END MANAGED REDIRECTS'));
  assert.ok(c.includes('RewriteEngine On'));
});
ok('.htaccess contains 301 rule', () => {
  const storageService = require('./src/services/storageService');
  const c = fs.readFileSync(path.join(storageService.getRootDir(TEST_USER), 'public_html', '.htaccess'), 'utf8');
  assert.ok(c.includes('R=301'));
});
ok('Toggle off+on sync without crash', () => {
  redirectService.toggleStatus(id301, TEST_USER);
  redirectService.toggleStatus(id301, TEST_USER);
});

// --- 7. Path & Query Matching ---
console.log('\n--- 7. Path & Query String Matching ---');
ok('Exact path match finds redirect', () => {
  const m = redirectService.matchRedirect(TEST_USER, 'localhost', '/old-page', {}, false);
  assert.ok(m); assert.strictEqual(m.statusCode, 301);
});
ok('Unrelated path returns null', () => {
  assert.strictEqual(redirectService.matchRedirect(TEST_USER, 'localhost', '/old-page-xyz', {}, false), null);
});
ok('Wildcard redirect preserves suffix', () => {
  const wid = redirectService.create({ domain: 'all', sourcePath: '/wild', targetUrl: 'https://example.com/dest', type: '301 Permanent', wildcard: true, cpanelUser: TEST_USER });
  const m = redirectService.matchRedirect(TEST_USER, 'localhost', '/wild/sub/page', {}, false);
  assert.ok(m && m.destination.includes('sub/page'));
  redirectService.delete(wid.id, TEST_USER);
});
ok('Query string preserved in destination', () => {
  const m = redirectService.matchRedirect(TEST_USER, 'localhost', '/old-page', { page: '2' }, false);
  assert.ok(m && m.destination.includes('page=2'));
});

// --- 8. Delete ---
console.log('\n--- 8. Delete Redirect ---');
ok('Delete removes redirect from inventory', () => {
  redirectService.delete(id301, TEST_USER);
  const all = redirectService.getAll(TEST_USER);
  assert.ok(!all.redirects.find(r => r.id === id301));
});

// --- 9. REST API + 10. Integration ---
(async () => {
  console.log('\n--- 9. REST API Endpoints ---');
  await okAsync('GET /api/redirects returns 200 with redirects+stats', async () => {
    const res = await httpGet('/api/redirects');
    assert.strictEqual(res.status, 200); assert.ok('redirects' in res.body); assert.ok('stats' in res.body);
  });
  await okAsync('GET /api/redirects/domains returns domain list', async () => {
    const res = await httpGet('/api/redirects/domains');
    assert.strictEqual(res.status, 200); assert.ok(Array.isArray(res.body.domains));
    assert.ok(res.body.domains.find(d => d.value === 'all'));
  });

  let apiId;
  await okAsync('POST /api/redirects creates redirect', async () => {
    const res = await httpPost('/api/redirects', { domain: 'all', sourcePath: '/api-test', targetUrl: 'https://example.com/api-dest', type: '302 Temporary', cpanelUser: 'test_redir_api' });
    assert.strictEqual(res.status, 200); assert.ok(res.body.success); assert.ok(res.body.redirect?.id);
    apiId = res.body.redirect.id;
  });
  await okAsync('GET /api/redirects/:id returns redirect', async () => {
    if (!apiId) return;
    const res = await httpGet(`/api/redirects/${encodeURIComponent(apiId)}`);
    assert.strictEqual(res.status, 200); assert.ok(res.body.redirect);
  });
  await okAsync('PUT /api/redirects/:id updates redirect', async () => {
    if (!apiId) return;
    const res = await httpPut(`/api/redirects/${encodeURIComponent(apiId)}`, { targetUrl: 'https://example.com/updated', cpanelUser: 'test_redir_api' });
    assert.strictEqual(res.status, 200); assert.ok(res.body.success);
  });
  await okAsync('POST /api/redirects/:id/toggle changes status', async () => {
    if (!apiId) return;
    const res = await httpPost(`/api/redirects/${encodeURIComponent(apiId)}/toggle`, { cpanelUser: 'test_redir_api' });
    assert.strictEqual(res.status, 200); assert.ok(['Active', 'Disabled'].includes(res.body.redirect?.status));
  });
  await okAsync('POST /api/redirects/:id/test returns valid test result', async () => {
    if (!apiId) return;
    const res = await httpPost(`/api/redirects/${encodeURIComponent(apiId)}/test`, { cpanelUser: 'test_redir_api' });
    assert.strictEqual(res.status, 200); assert.ok(res.body.tested === true); assert.ok(res.body.statusCode); assert.ok(res.body.location);
  });
  await okAsync('DELETE /api/redirects/:id removes redirect', async () => {
    if (!apiId) return;
    const res = await httpDelete(`/api/redirects/${encodeURIComponent(apiId)}?user=test_redir_api`);
    assert.strictEqual(res.status, 200); assert.ok(res.body.success);
  });
  await okAsync('POST /api/redirects rejects javascript: target', async () => {
    const res = await httpPost('/api/redirects', { domain: 'all', sourcePath: '/xss', targetUrl: 'javascript:alert(1)', cpanelUser: 'test_redir_api' });
    assert.strictEqual(res.status, 400); assert.ok(res.body.error);
  });
  await okAsync('POST /api/redirects rejects unauthorized domain', async () => {
    const res = await httpPost('/api/redirects', { domain: 'evil-domain.com', sourcePath: '/x', targetUrl: 'https://example.com', cpanelUser: 'test_redir_api' });
    assert.strictEqual(res.status, 400);
  });

  console.log('\n--- 10. App.jsx & Component Integration ---');
  const appContent = fs.readFileSync(path.join(__dirname, '../frontend/src/App.jsx'), 'utf8');
  ok('App.jsx imports RedirectManager', () => { assert.ok(appContent.includes("import RedirectManager")); });
  ok('App.jsx mounts "redirects" view', () => { assert.ok(appContent.includes("currentView === 'redirects'")); });

  const jsx = fs.readFileSync(path.join(__dirname, '../frontend/src/pages/RedirectManager.jsx'), 'utf8');
  ok('RedirectManager calls api.getRedirects', () => { assert.ok(jsx.includes('api.getRedirects')); });
  ok('RedirectManager calls api.createRedirect', () => { assert.ok(jsx.includes('api.createRedirect')); });
  ok('RedirectManager calls api.updateRedirect', () => { assert.ok(jsx.includes('api.updateRedirect')); });
  ok('RedirectManager calls api.deleteRedirectExtended', () => { assert.ok(jsx.includes('api.deleteRedirectExtended')); });
  ok('RedirectManager calls api.toggleRedirectStatus', () => { assert.ok(jsx.includes('api.toggleRedirectStatus')); });
  ok('RedirectManager calls api.testRedirect', () => { assert.ok(jsx.includes('api.testRedirect')); });

  const apiJs = fs.readFileSync(path.join(__dirname, '../frontend/src/services/api.js'), 'utf8');
  ok('Frontend api.js has getRedirects', () => { assert.ok(apiJs.includes('getRedirects')); });
  ok('Frontend api.js has getRedirectDomains', () => { assert.ok(apiJs.includes('getRedirectDomains')); });
  ok('Frontend api.js has createRedirect', () => { assert.ok(apiJs.includes('createRedirect')); });
  ok('Frontend api.js has updateRedirect', () => { assert.ok(apiJs.includes('updateRedirect')); });
  ok('Frontend api.js has deleteRedirectExtended', () => { assert.ok(apiJs.includes('deleteRedirectExtended')); });
  ok('Frontend api.js has toggleRedirectStatus', () => { assert.ok(apiJs.includes('toggleRedirectStatus')); });
  ok('Frontend api.js has testRedirect', () => { assert.ok(apiJs.includes('testRedirect')); });

  const serverJs = fs.readFileSync(path.join(__dirname, './src/server.js'), 'utf8');
  ok('server.js imports redirectService', () => { assert.ok(serverJs.includes('redirectService')); });
  ok('server.js applies matchRedirect on /site', () => { assert.ok(serverJs.includes('matchRedirect')); });

  console.log('\n========================================');
  console.log(`REDIRECTS AUDIT: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');
  if (failed > 0) process.exit(1);
})();
