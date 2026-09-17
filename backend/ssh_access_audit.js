const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const storageService = require('./src/services/storageService');
const sshAccessService = require('./src/services/sshAccessService');

const BASE_URL = 'http://localhost:5000/api';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runAudit() {
  console.log('====================================================');
  console.log('AUDIT: FEATURE #35 - SSH ACCESS IMPLEMENTATION');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    return fn()
      .then(() => {
        console.log(`  [PASS] Test ${total}: ${name}`);
        passed++;
      })
      .catch(err => {
        console.error(`  [FAIL] Test ${total}: ${name}`);
        console.error(`         Error: ${err.message}`);
      });
  }

  // TEST 1: Capability & Status Detection
  await test('GET /api/ssh-access/status returns truthful server detection and account status', async () => {
    const res = await request('GET', '/ssh-access/status?user=cpanel_user');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user, 'cpanel_user');
    assert.ok(res.data.server, 'Server capability info must be present');
    assert.ok(typeof res.data.server.openSshInstalled === 'boolean');
    assert.ok(typeof res.data.server.sshdRunning === 'boolean');
    assert.ok(res.data.connectionInfo, 'Connection info must be present');
    assert.strictEqual(res.data.connectionInfo.port, 22);
    assert.ok(res.data.connectionInfo.command.startsWith('ssh cpanel_user@'));

    if (res.data.server.platform === 'win32' && !res.data.server.sshdRunning) {
      assert.strictEqual(res.data.overallStatus, 'Server Daemon Inactive');
    }
  });

  // TEST 2: Plan-Based Shell & Policy Resolution
  await test('Plan-based shell resolution properly maps Jailed, Full bash, and Disabled states', async () => {
    // Standard Shared Hosting -> Jailed Shell
    const stdRes = await request('GET', '/ssh-access/status?user=cpanel_user');
    assert.strictEqual(stdRes.status, 200);
    assert.strictEqual(stdRes.data.plan, 'Standard Shared Hosting');
    assert.strictEqual(stdRes.data.shellType, 'jailed');
    assert.strictEqual(stdRes.data.shell, '/usr/local/cpanel/bin/jailshell');

    // Enterprise Cloud -> Full Standard Shell
    const entRes = await request('GET', '/ssh-access/status?user=audit_1977');
    assert.strictEqual(entRes.status, 200);
    assert.strictEqual(entRes.data.plan, 'Enterprise Cloud');
    assert.strictEqual(entRes.data.shellType, 'standard');
    assert.strictEqual(entRes.data.shell, '/bin/bash');

    // Starter SSD Hosting -> Disabled Shell
    const starterRes = await request('GET', '/ssh-access/status?user=alpha_3516');
    assert.strictEqual(starterRes.status, 200);
    assert.strictEqual(starterRes.data.plan, 'Starter SSD Hosting');
    assert.strictEqual(starterRes.data.shellType, 'disabled');
    assert.strictEqual(starterRes.data.isPermitted, false);
  });

  // TEST 3: Cryptographic Key Pair Generation
  let generatedKeyId = null;
  let downloadToken = null;
  await test('POST /api/ssh-access/keys/generate creates authentic ED25519 key pair', async () => {
    const res = await request('POST', '/ssh-access/keys/generate', {
      cpanelUser: 'cpanel_user',
      name: 'audit_test_key',
      type: 'ed25519',
      comment: 'audit@example.com'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.key, 'Key metadata object must be returned');
    assert.strictEqual(res.data.key.name, 'audit_test_key');
    assert.strictEqual(res.data.key.keyType, 'ssh-ed25519');
    assert.ok(res.data.key.fingerprint.startsWith('SHA256:'));
    assert.ok(res.data.key.publicKey.startsWith('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5'));
    assert.ok(res.data.downloadToken, 'One-time download token must be present');

    generatedKeyId = res.data.key.id;
    downloadToken = res.data.downloadToken;
  });

  // TEST 4: One-Time Private Key Retrieval
  await test('One-time private key download token can be used once and expires immediately', async () => {
    // First retrieval should succeed
    const firstRes = await request('GET', `/ssh-access/keys/download-private/${downloadToken}?user=cpanel_user`);
    assert.strictEqual(firstRes.status, 200);
    assert.ok(firstRes.text.includes('BEGIN OPENSSH PRIVATE KEY') || firstRes.text.includes('PRIVATE KEY'));

    // Second retrieval must fail (Rule 10: Wipe immediately upon retrieval)
    const secondRes = await request('GET', `/ssh-access/keys/download-private/${downloadToken}?user=cpanel_user`);
    assert.strictEqual(secondRes.status, 400);
    assert.ok(secondRes.data.error.includes('invalid, expired, or has already been used'));
  });

  // TEST 5: Public Key Authorization into ~/.ssh/authorized_keys
  await test('POST /api/ssh-access/keys/authorize writes public key to ~/.ssh/authorized_keys', async () => {
    const authRes = await request('POST', '/ssh-access/keys/authorize', {
      cpanelUser: 'cpanel_user',
      keyId: generatedKeyId
    });

    assert.strictEqual(authRes.status, 200);
    assert.strictEqual(authRes.data.success, true);
    assert.strictEqual(authRes.data.authorized, true);

    // Verify file on disk
    const authFile = path.join(storageService.getRootDir('cpanel_user'), '.ssh', 'authorized_keys');
    assert.ok(fs.existsSync(authFile), 'authorized_keys file must exist on disk');
    const content = fs.readFileSync(authFile, 'utf8');
    assert.ok(content.includes('audit_test_key') || content.includes('audit@example.com'), 'Key must be written in authorized_keys');

    // Cross-reference with list API
    const listRes = await request('GET', '/ssh-access/keys?user=cpanel_user');
    const keyInList = listRes.data.keys.find(k => k.id === generatedKeyId);
    assert.ok(keyInList, 'Key must be in list');
    assert.strictEqual(keyInList.authorized, true, 'Key must be marked authorized');
  });

  // TEST 6: Public Key Deauthorization
  await test('POST /api/ssh-access/keys/deauthorize removes key from ~/.ssh/authorized_keys', async () => {
    const deauthRes = await request('POST', '/ssh-access/keys/deauthorize', {
      cpanelUser: 'cpanel_user',
      keyId: generatedKeyId
    });

    assert.strictEqual(deauthRes.status, 200);
    assert.strictEqual(deauthRes.data.success, true);
    assert.strictEqual(deauthRes.data.authorized, false);

    // Verify removed from disk
    const authFile = path.join(storageService.getRootDir('cpanel_user'), '.ssh', 'authorized_keys');
    const content = fs.readFileSync(authFile, 'utf8');
    assert.ok(!content.includes('audit@example.com'), 'Deauthorized key must be removed from authorized_keys');
  });

  // TEST 7: Public Key Validation & Rejection of Malformed Keys
  await test('POST /api/ssh-access/keys/import rejects invalid or malformed keys', async () => {
    // Malformed algorithm
    const badAlgo = await request('POST', '/ssh-access/keys/import', {
      cpanelUser: 'cpanel_user',
      name: 'bad_algo',
      publicKeyContent: 'ssh-invalidscheme AAAAB3NzaC1yc2EAAAADAQABAAAA... user@host'
    });
    assert.strictEqual(badAlgo.status, 400);

    // Corrupted Base64
    const badB64 = await request('POST', '/ssh-access/keys/import', {
      cpanelUser: 'cpanel_user',
      name: 'bad_b64',
      publicKeyContent: 'ssh-ed25519 !!!NotBase64!!! user@host'
    });
    assert.strictEqual(badB64.status, 400);

    // Multiline injection attempt
    const multiLine = await request('POST', '/ssh-access/keys/import', {
      cpanelUser: 'cpanel_user',
      name: 'multiline',
      publicKeyContent: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDqEDQFQYhGvezt9sCHgR3QoPlg7Oez0FWaVoYBJCFBc user\ncommand="rm -rf /" ssh-rsa ...'
    });
    assert.strictEqual(multiLine.status, 400);
  });

  // TEST 8: Valid Public Key Import & Duplicate Detection
  let importedKeyId = null;
  await test('POST /api/ssh-access/keys/import accepts valid key and prevents duplicate imports', async () => {
    const validPub = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDqEDQFQYhGvezt9sCHgR3QoPlg7Oez0FWaVoYBJCFBc import_user@laptop';
    const importRes = await request('POST', '/ssh-access/keys/import', {
      cpanelUser: 'cpanel_user',
      name: 'macbook_ed25519',
      publicKeyContent: validPub
    });

    assert.strictEqual(importRes.status, 200);
    assert.strictEqual(importRes.data.success, true);
    assert.strictEqual(importRes.data.key.name, 'macbook_ed25519');
    assert.strictEqual(importRes.data.key.fingerprint, 'SHA256:WRaUo36dNbIj8L+LnYqDjP5hzzMjAZXFhT+ls6ord6c');

    importedKeyId = importRes.data.key.id;

    // Attempt to import the exact same key again under a different name
    const dupRes = await request('POST', '/ssh-access/keys/import', {
      cpanelUser: 'cpanel_user',
      name: 'another_name_same_key',
      publicKeyContent: validPub
    });

    assert.strictEqual(dupRes.status, 400);
    assert.ok(dupRes.data.error.includes('identical') || dupRes.data.error.includes('already been imported'));
  });

  // TEST 9: Multi-Tenant Account Isolation
  await test('Account isolation: User A cannot view, authorize, or delete User B keys', async () => {
    // Generate a key under client_auto1
    const userBRes = await request('POST', '/ssh-access/keys/generate', {
      cpanelUser: 'client_auto1',
      name: 'client_b_key',
      type: 'ed25519'
    });
    assert.strictEqual(userBRes.status, 200);
    const userBKeyId = userBRes.data.key.id;

    // User A should NOT see User B's key
    const userAList = await request('GET', '/ssh-access/keys?user=cpanel_user');
    assert.ok(!userAList.data.keys.some(k => k.id === userBKeyId), 'User A must not see User B key');

    // User A attempting to deauthorize User B key must fail
    const attackDeauth = await request('POST', '/ssh-access/keys/deauthorize', {
      cpanelUser: 'cpanel_user',
      keyId: userBKeyId
    });
    assert.strictEqual(attackDeauth.status, 400);

    // User A attempting to delete User B key must fail
    const attackDelete = await request('POST', '/ssh-access/keys/delete', {
      cpanelUser: 'cpanel_user',
      keyId: userBKeyId
    });
    assert.strictEqual(attackDelete.status, 400);

    // Clean up User B key
    await request('POST', '/ssh-access/keys/delete', { cpanelUser: 'client_auto1', keyId: userBKeyId });
  });

  // TEST 10: Key Deletion and Cleanup
  await test('POST /api/ssh-access/keys/delete cleans up key metadata and files', async () => {
    // Delete the generated test key
    const delRes1 = await request('POST', '/ssh-access/keys/delete', {
      cpanelUser: 'cpanel_user',
      keyId: generatedKeyId
    });
    assert.strictEqual(delRes1.status, 200);
    assert.strictEqual(delRes1.data.success, true);

    // Delete the imported test key
    const delRes2 = await request('POST', '/ssh-access/keys/delete', {
      cpanelUser: 'cpanel_user',
      keyId: importedKeyId
    });
    assert.strictEqual(delRes2.status, 200);

    // Verify list is clean of these keys
    const listAfter = await request('GET', '/ssh-access/keys?user=cpanel_user');
    assert.ok(!listAfter.data.keys.some(k => k.id === generatedKeyId));
    assert.ok(!listAfter.data.keys.some(k => k.id === importedKeyId));
  });

  // TEST 11: Controlled Connection Test Diagnostics
  await test('GET /api/ssh-access/test-connection returns structured diagnostic checks', async () => {
    const diagRes = await request('GET', '/ssh-access/test-connection?user=cpanel_user');
    assert.strictEqual(diagRes.status, 200);
    assert.strictEqual(diagRes.data.success, true);
    assert.strictEqual(diagRes.data.user, 'cpanel_user');
    assert.ok(Array.isArray(diagRes.data.diagnostics), 'Diagnostics array must be present');
    assert.ok(diagRes.data.diagnostics.length >= 4, 'Must have at least 4 diagnostic checks');
    assert.ok(diagRes.data.diagnostics.some(d => d.item.includes('SSH Daemon')));
    assert.ok(diagRes.data.diagnostics.some(d => d.item.includes('Account SSH Permission')));
    assert.ok(diagRes.data.diagnostics.some(d => d.item.includes('Authorized Keys')));
  });

  console.log(`\nAUDIT COMPLETE: ${passed}/${total} tests passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
