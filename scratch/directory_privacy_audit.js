const fs = require('fs');
const path = require('path');
const bcrypt = require('../backend/node_modules/bcryptjs');

const BASE_URL = 'http://localhost:5000/api';
const SITE_URL = 'http://localhost:5000/site';
const TEST_USER = 'privacy_audit_user';
const OTHER_USER = 'privacy_other_user';

const VHOSTS_DIR = path.resolve(__dirname, '../backend/data/vhosts');
const TEST_USER_ROOT = path.join(VHOSTS_DIR, TEST_USER);
const TEST_USER_DIR = path.join(TEST_USER_ROOT, 'public_html');
const OTHER_USER_ROOT = path.join(VHOSTS_DIR, OTHER_USER);
const OTHER_USER_DIR = path.join(OTHER_USER_ROOT, 'public_html');

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const user = options.user || TEST_USER;
  const headers = {
    'Content-Type': 'application/json',
    'X-cPanel-User': user,
    ...(options.headers || {})
  };

  const fetchOpts = {
    method: options.method || 'GET',
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  };

  const res = await fetch(url, fetchOpts);
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, headers: res.headers, data };
}

async function siteRequest(subPath, options = {}) {
  const user = options.user || TEST_USER;
  const url = `${SITE_URL}/${subPath}?user=${user}`;
  const headers = {
    ...(options.headers || {})
  };
  const res = await fetch(url, { headers });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

async function runAudit() {
  console.log('=== STARTING CPANEL DIRECTORY PRIVACY AUDIT ===\n');

  // Setup test environment
  if (fs.existsSync(TEST_USER_ROOT)) fs.rmSync(TEST_USER_ROOT, { recursive: true, force: true });
  if (fs.existsSync(OTHER_USER_ROOT)) fs.rmSync(OTHER_USER_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TEST_USER_DIR, { recursive: true });
  fs.mkdirSync(OTHER_USER_DIR, { recursive: true });

  // Create test directories and files
  const secretDir = path.join(TEST_USER_DIR, 'members_only');
  fs.mkdirSync(secretDir, { recursive: true });
  fs.writeFileSync(path.join(secretDir, 'index.html'), '<h1>Top Secret Members Area</h1>', 'utf8');

  const publicDir = path.join(TEST_USER_DIR, 'public_blog');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'index.html'), '<h1>Public Blog Post</h1>', 'utf8');

  // Existing .htaccess with unrelated rules
  const customHtaccessDir = path.join(TEST_USER_DIR, 'custom_app');
  fs.mkdirSync(customHtaccessDir, { recursive: true });
  const customRules = '# Custom Application Rewrite Rules\nRewriteEngine On\nRewriteRule ^old/?$ new.html [R=301,L]\n';
  fs.writeFileSync(path.join(customHtaccessDir, '.htaccess'), customRules, 'utf8');

  // 1. Directory Discovery
  console.log('1. Directory Discovery & Listing:');
  const dirsRes = await request('/privacy/directories');
  assert(dirsRes.status === 200 && Array.isArray(dirsRes.data), 'GET /privacy/directories returns 200 array');
  const foundSecret = dirsRes.data.some(d => d.relPath.includes('members_only'));
  assert(foundSecret, 'Discovered subfolder "public_html/members_only" in directory list');
  const foundPub = dirsRes.data.some(d => d.relPath === 'public_html');
  assert(foundPub, 'Includes "public_html" as primary document root');

  // 2. Initial Directory Status
  console.log('\n2. Directory Status Inspection:');
  const initStatus = await request('/privacy/status?path=public_html/members_only');
  assert(initStatus.status === 200, 'GET /privacy/status returns 200');
  assert(initStatus.data.isProtected === false, 'Initially directory is NOT protected');
  assert(initStatus.data.userCount === 0, 'Initially userCount is 0');

  // 3. Existing Rules Detection
  const customStatus = await request('/privacy/status?path=public_html/custom_app');
  assert(customStatus.data.hasOtherRules === true, 'Detected pre-existing unrelated rules in custom_app/.htaccess');

  // 4. Enable Protection
  console.log('\n3. Enabling Directory Protection:');
  const enableRes = await request('/privacy/protect', {
    method: 'POST',
    body: {
      path: 'public_html/members_only',
      enabled: true,
      authName: 'VIP Club Lounge'
    }
  });
  assert(enableRes.status === 200 && enableRes.data.success, 'POST /privacy/protect returns 200 success');
  assert(enableRes.data.status.isProtected === true, 'Directory marked as isProtected: true');
  assert(enableRes.data.status.authName === 'VIP Club Lounge', 'Auth realm set to "VIP Club Lounge"');

  // 5. Verify .htaccess Managed Block
  const htaccessPath = path.join(secretDir, '.htaccess');
  assert(fs.existsSync(htaccessPath), '.htaccess file physically created on disk');
  const htaccessContent = fs.readFileSync(htaccessPath, 'utf8');
  assert(htaccessContent.includes('# BEGIN DIRECTORY_PRIVACY_MANAGED'), '.htaccess contains # BEGIN DIRECTORY_PRIVACY_MANAGED');
  assert(htaccessContent.includes('AuthName "VIP Club Lounge"'), '.htaccess contains AuthName directive');
  assert(htaccessContent.includes('Require valid-user'), '.htaccess contains Require valid-user');
  assert(htaccessContent.includes('# END DIRECTORY_PRIVACY_MANAGED'), '.htaccess contains # END DIRECTORY_PRIVACY_MANAGED');

  // 6. User Management - Add User
  console.log('\n4. Authorized User Management:');
  const addUserRes = await request('/privacy/user/add', {
    method: 'POST',
    body: {
      path: 'public_html/members_only',
      username: 'vip_john',
      password: 'SecretPassword123'
    }
  });
  assert(addUserRes.status === 200 && addUserRes.data.success, 'POST /privacy/user/add creates user vip_john');

  // 7. Verify .htpasswd Content and Bcrypt Hash
  const htpasswdPath = path.join(TEST_USER_ROOT, '.htpasswds', 'public_html/members_only', 'passwd');
  assert(fs.existsSync(htpasswdPath), '.htpasswd file physically created outside document root');
  const htpasswdContent = fs.readFileSync(htpasswdPath, 'utf8');
  assert(htpasswdContent.includes('vip_john:$2b$'), '.htpasswd stores password as bcrypt hash ($2b$)');
  assert(!htpasswdContent.includes('SecretPassword123'), 'Plaintext password is NEVER stored in .htpasswd');

  // 8. Prevent Duplicate User
  const dupUserRes = await request('/privacy/user/add', {
    method: 'POST',
    body: {
      path: 'public_html/members_only',
      username: 'vip_john',
      password: 'AnotherPassword456'
    }
  });
  assert(dupUserRes.status === 409, 'Duplicate username rejected with 409 Conflict');

  // 9. Input Validation on Username and Password
  const badUserRes = await request('/privacy/user/add', {
    method: 'POST',
    body: {
      path: 'public_html/members_only',
      username: 'bad:user/name',
      password: 'Password123'
    }
  });
  assert(badUserRes.status === 400, 'Username with colon/slash rejected with 400');

  const shortPassRes = await request('/privacy/user/add', {
    method: 'POST',
    body: {
      path: 'public_html/members_only',
      username: 'good_user',
      password: '123'
    }
  });
  assert(shortPassRes.status === 400, 'Password shorter than 5 chars rejected with 400');

  // 10. Change Password
  console.log('\n5. Password Update:');
  const changePassRes = await request('/privacy/user/password', {
    method: 'POST',
    body: {
      path: 'public_html/members_only',
      username: 'vip_john',
      newPassword: 'BrandNewPassword999'
    }
  });
  assert(changePassRes.status === 200 && changePassRes.data.success, 'POST /privacy/user/password updates password');
  const updatedHtpasswd = fs.readFileSync(htpasswdPath, 'utf8');
  const userLine = updatedHtpasswd.split('\n').find(l => l.startsWith('vip_john:'));
  const newHash = userLine.split(':')[1];
  assert(bcrypt.compareSync('BrandNewPassword999', newHash), 'Bcrypt verification succeeds with new password');
  assert(!bcrypt.compareSync('SecretPassword123', newHash), 'Bcrypt verification fails with old password');

  // 11. Add second user
  await request('/privacy/user/add', {
    method: 'POST',
    body: { path: 'public_html/members_only', username: 'vip_mary', password: 'MaryPass789' }
  });
  const statusWithTwo = await request('/privacy/status?path=public_html/members_only');
  assert(statusWithTwo.data.users.length === 2, 'Directory status lists both authorized users');

  // 12. Delete User
  console.log('\n6. User Deletion:');
  const delUserRes = await request('/privacy/user/delete', {
    method: 'POST',
    body: {
      path: 'public_html/members_only',
      username: 'vip_mary'
    }
  });
  assert(delUserRes.status === 200 && delUserRes.data.success, 'POST /privacy/user/delete removes vip_mary');
  const statusAfterDel = await request('/privacy/status?path=public_html/members_only');
  assert(statusAfterDel.data.users.length === 1 && statusAfterDel.data.users[0] === 'vip_john', 'Remaining user is vip_john');

  // 13. REAL WEB SERVER HTTP BASIC AUTH ENFORCEMENT
  console.log('\n7. Real Web Server HTTP Basic Authentication (/site endpoint):');
  
  // A: Unauthenticated request to protected directory
  const unauthRes = await siteRequest('members_only/index.html');
  assert(unauthRes.status === 401, 'Unauthenticated request to protected directory receives HTTP 401');
  const authHeader = unauthRes.headers.get('www-authenticate') || '';
  assert(authHeader.includes('Basic realm="VIP Club Lounge"'), 'HTTP 401 includes WWW-Authenticate: Basic realm="VIP Club Lounge"');

  // B: Request with INVALID credentials
  const badAuth = Buffer.from('vip_john:WrongPassword').toString('base64');
  const badCredRes = await siteRequest('members_only/index.html', {
    headers: { 'Authorization': `Basic ${badAuth}` }
  });
  assert(badCredRes.status === 401, 'Request with invalid password receives HTTP 401 Unauthorized');

  // C: Request with VALID credentials
  const goodAuth = Buffer.from('vip_john:BrandNewPassword999').toString('base64');
  const goodCredRes = await siteRequest('members_only/index.html', {
    headers: { 'Authorization': `Basic ${goodAuth}` }
  });
  assert(goodCredRes.status === 200, 'Request with valid credentials receives HTTP 200 OK');
  assert(goodCredRes.text.includes('Top Secret Members Area'), 'Protected page content successfully loaded');

  // D: Unprotected folder access
  const pubRes = await siteRequest('public_blog/index.html');
  assert(pubRes.status === 200, 'Unprotected folder (/site/public_blog/) accessible without credentials (HTTP 200)');
  assert(pubRes.text.includes('Public Blog Post'), 'Public content loads without authentication');

  // 14. Non-Destructive .htaccess Rule Preservation
  console.log('\n8. Non-Destructive .htaccess Handling:');
  // Enable protection on custom_app (which has existing rewrite rules)
  await request('/privacy/protect', {
    method: 'POST',
    body: { path: 'public_html/custom_app', enabled: true, authName: 'Custom App Realm' }
  });
  const customWithAuth = fs.readFileSync(path.join(customHtaccessDir, '.htaccess'), 'utf8');
  assert(customWithAuth.includes('RewriteEngine On'), 'Existing RewriteEngine rule PRESERVED when enabling protection');
  assert(customWithAuth.includes('RewriteRule ^old/?$ new.html'), 'Existing RewriteRule PRESERVED when enabling protection');
  assert(customWithAuth.includes('# BEGIN DIRECTORY_PRIVACY_MANAGED'), 'Managed block added alongside existing rules');

  // Disable protection on custom_app
  await request('/privacy/protect', {
    method: 'POST',
    body: { path: 'public_html/custom_app', enabled: false }
  });
  const customAfterDisable = fs.readFileSync(path.join(customHtaccessDir, '.htaccess'), 'utf8');
  assert(customAfterDisable.includes('RewriteEngine On'), 'Existing RewriteEngine rule PRESERVED after disabling protection');
  assert(customAfterDisable.includes('RewriteRule ^old/?$ new.html'), 'Existing RewriteRule PRESERVED after disabling protection');
  assert(!customAfterDisable.includes('# BEGIN DIRECTORY_PRIVACY_MANAGED'), 'Managed block cleanly REMOVED after disabling protection');

  // 15. Security & Sandbox Penetration Tests
  console.log('\n9. Security Penetration & Account Isolation:');
  const travStatus = await request('/privacy/status?path=../../etc/passwd');
  assert(travStatus.status === 400, 'Path traversal in status (?path=../../) blocked with 400');

  const travProtect = await request('/privacy/protect', {
    method: 'POST',
    body: { path: '../../etc/shadow', enabled: true }
  });
  assert(travProtect.status === 400, 'Path traversal in protect blocked with 400');

  const nullByte = await request('/privacy/status?path=public_html%00/secret');
  assert(nullByte.status === 400, 'Null-byte injection blocked with 400');

  // Cross-user access check
  const crossUserRes = await request('/privacy/status?path=public_html/members_only', { user: OTHER_USER });
  assert(crossUserRes.data.isProtected === false, 'User B cannot see User A privacy configuration (cross-tenant isolation)');

  // Clean up test directories
  try {
    fs.rmSync(TEST_USER_ROOT, { recursive: true, force: true });
    fs.rmSync(OTHER_USER_ROOT, { recursive: true, force: true });
  } catch (e) {}

  console.log(`\n=========================================`);
  console.log(`AUDIT COMPLETE: ${passedCount} / ${totalCount} PASSED (${Math.round((passedCount / totalCount) * 100)}%)`);
  console.log(`=========================================\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
