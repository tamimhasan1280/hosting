const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:5000/api';
const TEST_USER = 'cpanel_user';

async function runTests() {
  console.log('=== RUNNING FEATURE #37: SSL/TLS CERTIFICATES AUDIT ===\n');
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

  // 1. Capabilities
  await test('Capability Detection and Truthful Server Notices', async () => {
    const res = await fetch(`${BASE_URL}/ssl/capabilities`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.tlsEngine.includes('OpenSSL'));
    assert.ok(data.supportedProtocols.includes('TLSv1.3'));
    assert.strictEqual(data.certificateInventory, true);
    assert.strictEqual(data.certificateInstallation, true);
    assert.strictEqual(data.serverFirewallAccess, false, 'Server firewall must not be accessible to normal hosting users');
    assert.ok(data.serverFirewallNotice.includes('account level security isolation'));
  });

  // 2. Inventory & Real X.509 Fields
  await test('Real Certificate Inventory & X.509 Metadata', async () => {
    const res = await fetch(`${BASE_URL}/ssl/inventory?user=${TEST_USER}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.certificates));
    assert.ok(data.certificates.length > 0);

    const primary = data.certificates.find(c => c.domain === 'example.com');
    assert.ok(primary, 'example.com certificate must exist in inventory');
    assert.ok(primary.issuer.length > 0, 'Issuer must be non-empty');
    assert.ok(['Active (Valid)', 'Expiring Soon', 'Expired'].includes(primary.status), `Status ${primary.status} must be valid`);
    assert.ok(typeof primary.daysRemaining === 'number');
    assert.ok(Array.isArray(primary.sans));
  });

  // 3. Certificate Details
  await test('Detailed X.509 Certificate Inspection', async () => {
    const res = await fetch(`${BASE_URL}/ssl/details?user=${TEST_USER}&domain=example.com`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.domain, 'example.com');
    assert.ok(data.subject.includes('CN=example.com') || data.subject.includes('example.com'));
    assert.ok(data.serialNumber && data.serialNumber.length > 10);
    assert.ok(data.fingerprint256 && data.fingerprint256.includes(':'));
    assert.ok(data.certificatePem.includes('-----BEGIN CERTIFICATE-----'));
  });

  // 4. Account Isolation - Reject Unauthorized Domain
  await test('Account Isolation: Unauthorized Domain Access Rejection', async () => {
    const res = await fetch(`${BASE_URL}/ssl/details?user=${TEST_USER}&domain=unauthorized-bank.com`);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('not authorized'));
  });

  // 5. Cryptographic Private Key Mismatch Rejection
  await test('Private Key Mismatch Cryptographic Rejection', async () => {
    // Generate an unrelated RSA keypair
    const fakeKey = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const detailsRes = await fetch(`${BASE_URL}/ssl/details?user=${TEST_USER}&domain=example.com`);
    const details = await detailsRes.json();

    const installRes = await fetch(`${BASE_URL}/ssl/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpanelUser: TEST_USER,
        domain: 'example.com',
        certPem: details.certificatePem,
        keyPem: fakeKey.privateKey
      })
    });
    assert.strictEqual(installRes.status, 400);
    const installData = await installRes.json();
    assert.strictEqual(installData.success, false);
    assert.ok(installData.error.toLowerCase().includes('mismatch'));
  });

  // 6. Domain Mismatch Rejection
  await test('Domain Coverage Mismatch Rejection', async () => {
    const detailsRes = await fetch(`${BASE_URL}/ssl/details?user=${TEST_USER}&domain=example.com`);
    const details = await detailsRes.json();

    // Get matching key for example.com
    const keyPath = path.resolve(__dirname, 'data/ssl/keys', `${details.id}.key`);
    let keyPem = '';
    if (fs.existsSync(keyPath)) {
      keyPem = fs.readFileSync(keyPath, 'utf8');
    }

    if (keyPem) {
      // Try to install example.com cert on audit-shared.com (which it doesn't cover)
      const installRes = await fetch(`${BASE_URL}/ssl/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpanelUser: TEST_USER,
          domain: 'audit-shared.com',
          certPem: details.certificatePem,
          keyPem: keyPem
        })
      });
      assert.strictEqual(installRes.status, 400);
      const installData = await installRes.json();
      assert.strictEqual(installData.success, false);
      assert.ok(installData.error.toLowerCase().includes('domain mismatch'));
    }
  });

  // 7. CSR Generation
  await test('Real PKCS#10 CSR Generation with RSA 2048-bit', async () => {
    const res = await fetch(`${BASE_URL}/ssl/generate-csr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpanelUser: TEST_USER,
        domain: 'example.com',
        organization: 'Audit Testing Inc',
        country: 'US',
        state: 'California',
        locality: 'San Francisco',
        keyBits: 2048
      })
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.csrPem.includes('-----BEGIN CERTIFICATE REQUEST-----'));
    assert.ok(data.sans.includes('example.com'));
    assert.strictEqual(data.keyBits, 2048);
  });

  // 8. AutoSSL Provisioning & Real Issuance
  await test('AutoSSL Provisioning for Account Domains', async () => {
    const res = await fetch(`${BASE_URL}/ssl/autossl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpanelUser: TEST_USER })
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.securedDomains));
    assert.ok(data.securedDomains.includes('example.com'));
  });

  // 9. Single Domain Renewal
  await test('Single Domain Renewal (90-Day Extension)', async () => {
    const res = await fetch(`${BASE_URL}/ssl/renew`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpanelUser: TEST_USER, domain: 'example.com' })
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.domain, 'example.com');
  });

  // 10. Live TLS Verification & SSRF Protection
  await test('Live TLS Verification and SSRF Protection', async () => {
    // 1. Rejects SSRF attempt against unauthorized host
    const ssrfRes = await fetch(`${BASE_URL}/ssl/verify-tls?user=${TEST_USER}&domain=internal-admin.local`);
    assert.strictEqual(ssrfRes.status, 400);

    // 2. Verifies authorized domain
    const validRes = await fetch(`${BASE_URL}/ssl/verify-tls?user=${TEST_USER}&domain=example.com`);
    const validData = await validRes.json();
    assert.strictEqual(validData.domain, 'example.com');
    assert.ok(validData.protocol.includes('TLS'));
  });

  // 11. Certificate Removal & Shared Safety
  await test('Certificate Removal and State Transition', async () => {
    const removeRes = await fetch(`${BASE_URL}/ssl/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpanelUser: TEST_USER, domain: 'example.com.org' })
    });
    const removeData = await removeRes.json();
    assert.strictEqual(removeData.success, true);

    // Verify it's now listed as Not Installed
    const invRes = await fetch(`${BASE_URL}/ssl/inventory?user=${TEST_USER}`);
    const invData = await invRes.json();
    const target = invData.certificates.find(c => c.domain === 'example.com.org');
    assert.ok(target, 'Domain must still exist in inventory');
    assert.strictEqual(target.status, 'Not Installed');
  });

  // 12. Audit Logging
  await test('Audit Logging Verification', async () => {
    const logPath = path.resolve(__dirname, 'data/ssl_audit.log');
    assert.ok(fs.existsSync(logPath), 'Audit log file must exist');
    const logContent = fs.readFileSync(logPath, 'utf8');
    assert.ok(logContent.includes('AUTOSSL_RUN') || logContent.includes('RENEW') || logContent.includes('CSR_GEN'), 'Audit log must record operations');
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
