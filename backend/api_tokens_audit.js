const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:5000/api';
const TEST_USER = 'cpanel_user';
const OTHER_USER = 'user_b';

async function runTests() {
  console.log('=== RUNNING FEATURE #38: MANAGE API TOKENS AUDIT ===\n');
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test ${total}: ${name}`);
      console.error(`       Error: ${err.message}`);
    }
  }

  let createdRawToken = null;
  let createdTokenId = null;

  // 1. Available Scopes
  await test('Available Scopes Endpoint', async () => {
    const res = await fetch(`${BASE_URL}/tokens/available-scopes`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.scopes));
    assert.ok(data.scopes.some(s => s.id === 'full_access'));
    assert.ok(data.scopes.some(s => s.id === 'file_manager:read'));
    assert.ok(data.scopes.some(s => s.id === 'database:manage'));
    assert.ok(data.scopes.some(s => s.id === 'ssl:manage'));
  });

  // 2. Token Creation & Secret Return
  await test('Token Creation with Cryptographic Entropy', async () => {
    const res = await fetch(`${BASE_URL}/tokens/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpanelUser: TEST_USER,
        name: 'Audit Automation Token',
        scopes: ['file_manager:read', 'domains:manage'],
        expiresDays: 30
      })
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.rawToken && data.rawToken.startsWith('cpt_'));
    assert.ok(data.rawToken.length >= 64, 'Raw token must have sufficient entropy (>= 64 chars)');
    assert.ok(data.token.prefix.startsWith('cpt_'));
    assert.ok(data.token.prefix.includes('••••'));
    assert.strictEqual(data.token.status, 'Active');

    createdRawToken = data.rawToken;
    createdTokenId = data.token.id;
  });

  // 3. Raw Token NOT Stored in Database
  await test('Raw Token Plaintext NEVER Stored in Database', async () => {
    const dbPath = path.resolve(__dirname, 'data/api_tokens.json');
    assert.ok(fs.existsSync(dbPath), 'Tokens data file must exist');
    const dbContent = fs.readFileSync(dbPath, 'utf8');
    assert.ok(!dbContent.includes(createdRawToken), 'Raw token must NOT exist in the database file');

    // Hash check
    const expectedHash = crypto.createHash('sha256').update(createdRawToken).digest('hex');
    assert.ok(dbContent.includes(expectedHash), 'Database must store SHA-256 hash');
  });

  // 4. Token List Endpoint (Metadata Only)
  await test('Token List Endpoint Returns Safe Metadata Only', async () => {
    const res = await fetch(`${BASE_URL}/tokens/list?user=${TEST_USER}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.tokens));
    const found = data.tokens.find(t => t.id === createdTokenId);
    assert.ok(found, 'Created token must be present in token list');
    assert.strictEqual(found.name, 'Audit Automation Token');
    assert.ok(found.prefix.includes('••••'));
    assert.strictEqual(found.hash, undefined, 'Hash must not be exposed');
    assert.strictEqual(found.rawToken, undefined, 'Raw token must not be exposed');
  });

  // 5. Bearer Token Authentication
  await test('Bearer Token Authentication (/api/tokens/test-auth)', async () => {
    const res = await fetch(`${BASE_URL}/tokens/test-auth`, {
      headers: {
        'Authorization': `Bearer ${createdRawToken}`
      }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.authenticated, true);
    assert.strictEqual(data.user, TEST_USER);
    assert.ok(data.token.scopes.includes('file_manager:read'));
  });

  // 6. Token Authentication Failure with Invalid Token
  await test('Authentication Failure with Invalid/Malformed Token', async () => {
    const res = await fetch(`${BASE_URL}/tokens/test-auth`, {
      headers: {
        'Authorization': 'Bearer cpt_invalid_fake_token_1234567890abcdef'
      }
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('Invalid API token'));
  });

  // 7. Last Used Tracking
  await test('Last Used Timestamp Updates on Authentication', async () => {
    const res = await fetch(`${BASE_URL}/tokens/list?user=${TEST_USER}`);
    const data = await res.json();
    const found = data.tokens.find(t => t.id === createdTokenId);
    assert.ok(found);
    assert.ok(found.lastUsedAt !== null, 'lastUsedAt must be updated after successful auth');
  });

  // 8. Token Revocation
  await test('Immediate Token Revocation', async () => {
    const res = await fetch(`${BASE_URL}/tokens/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpanelUser: TEST_USER,
        tokenId: createdTokenId
      })
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);

    // List check: status must be Revoked
    const listRes = await fetch(`${BASE_URL}/tokens/list?user=${TEST_USER}`);
    const listData = await listRes.json();
    const found = listData.tokens.find(t => t.id === createdTokenId);
    assert.strictEqual(found.status, 'Revoked');
  });

  // 9. Revoked Token Immediately Rejected
  await test('Revoked Token Immediately Rejected (401 Unauthorized)', async () => {
    const res = await fetch(`${BASE_URL}/tokens/test-auth`, {
      headers: {
        'Authorization': `Bearer ${createdRawToken}`
      }
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.toLowerCase().includes('revoked'));
  });

  // 10. Account Isolation (User A vs User B)
  await test('Account Isolation: Cross-Account Access Prevention', async () => {
    // 1. Create a token for User B
    const userBRes = await fetch(`${BASE_URL}/tokens/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpanelUser: OTHER_USER,
        name: 'User B Private Token'
      })
    });
    const userBData = await userBRes.json();
    const userBTokenId = userBData.token.id;

    // 2. User A cannot view User B's token
    const listA = await fetch(`${BASE_URL}/tokens/list?user=${TEST_USER}`).then(r => r.json());
    assert.ok(!listA.tokens.some(t => t.id === userBTokenId), 'User A must not see User B tokens');

    // 3. User A cannot revoke User B's token
    const revokeFailRes = await fetch(`${BASE_URL}/tokens/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpanelUser: TEST_USER,
        tokenId: userBTokenId
      })
    });
    assert.strictEqual(revokeFailRes.status, 400);
    const revokeFailData = await revokeFailRes.json();
    assert.strictEqual(revokeFailData.success, false);
    assert.ok(revokeFailData.error.toLowerCase().includes('permission') || revokeFailData.error.toLowerCase().includes('access denied'));
  });

  // 11. Validation: Malformed Token Name
  await test('Validation: Empty or Malicious Token Name Rejection', async () => {
    const res = await fetch(`${BASE_URL}/tokens/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpanelUser: TEST_USER,
        name: '   '
      })
    });
    assert.strictEqual(res.status, 400);

    const xssRes = await fetch(`${BASE_URL}/tokens/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpanelUser: TEST_USER,
        name: '<script>alert(1)</script>'
      })
    });
    assert.strictEqual(xssRes.status, 400);
  });

  // 12. Audit Logging
  await test('Audit Logging Verification (Never Leaking Secrets)', async () => {
    const logPath = path.resolve(__dirname, 'data/api_tokens_audit.log');
    assert.ok(fs.existsSync(logPath), 'Audit log file must exist');
    const logContent = fs.readFileSync(logPath, 'utf8');
    assert.ok(logContent.includes('CREATE'), 'Audit log must record CREATE');
    assert.ok(logContent.includes('REVOKE'), 'Audit log must record REVOKE');
    assert.ok(logContent.includes('AUTH_SUCCESS'), 'Audit log must record AUTH_SUCCESS');
    assert.ok(logContent.includes('AUTH_FAIL'), 'Audit log must record AUTH_FAIL');
    assert.ok(!logContent.includes(createdRawToken), 'Raw token must NEVER appear in audit log');
  });

  console.log(`\n========================================`);
  console.log(`AUDIT COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
