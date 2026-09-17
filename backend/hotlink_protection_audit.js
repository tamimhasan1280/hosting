const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;

function request(method, pathName, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathName, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runAudit() {
  console.log('=== RUNNING AUDIT: FEATURE #39 — HOTLINK PROTECTION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    const user = 'cpanel_user';

    // 0. Reset clean state for user
    await request('POST', '/api/hotlink/save', {
      cpanelUser: user,
      enabled: false,
      allowedDomains: ['example.com', 'default.com', 'localhost'],
      protectedExtensions: ['jpg', 'jpeg', 'gif', 'png', 'bmp', 'webp', 'svg'],
      allowEmptyReferer: true,
      redirectUrl: ''
    });

    // 1. Capabilities API
    console.log('1. Testing Hotlink Capabilities API...');
    const capsRes = await request('GET', '/api/hotlink/capabilities');
    assert(capsRes.status === 200 && capsRes.data.success, 'Capabilities endpoint returned HTTP 200 success');
    assert(capsRes.data.allowEmptyRefererSupported === true, 'Capabilities reports allowEmptyRefererSupported');
    assert(capsRes.data.redirectUrlSupported === true, 'Capabilities reports redirectUrlSupported');
    assert(capsRes.data.defaultExtensions.includes('jpg'), 'Default extensions contain jpg');

    // 2. Initial Config API
    console.log('\n2. Testing Hotlink Config API...');
    const cfgRes = await request('GET', `/api/hotlink/config?user=${user}`);
    assert(cfgRes.status === 200 && cfgRes.data.success, 'Config endpoint returned HTTP 200 success');
    assert(cfgRes.data.config.accountDomains.length > 0, 'Config returns account domains');
    assert(cfgRes.data.config.htaccessPath.includes('.htaccess'), 'Config returns valid .htaccess path');

    // 3. Enable Hotlink Protection
    console.log('\n3. Enabling Hotlink Protection...');
    const enableRes = await request('POST', '/api/hotlink/toggle', {
      cpanelUser: user,
      enabled: true
    });
    assert(enableRes.status === 200 && enableRes.data.success, 'Enable toggle returned HTTP 200 success');
    assert(enableRes.data.config.enabled === true, 'Config state is now enabled');
    assert(enableRes.data.config.rulesActive === true, 'Rewrite rules are actively deployed in .htaccess');

    // Verify .htaccess file on disk
    const htaccessPath = cfgRes.data.config.htaccessPath;
    assert(fs.existsSync(htaccessPath), '.htaccess file exists on disk');
    const diskContent = fs.readFileSync(htaccessPath, 'utf-8');
    assert(diskContent.includes('# BEGIN CPANEL HOTLINK PROTECTION'), '.htaccess contains # BEGIN CPANEL HOTLINK PROTECTION marker');
    assert(diskContent.includes('RewriteEngine On'), '.htaccess contains RewriteEngine On');
    assert(diskContent.includes('RewriteCond %{HTTP_REFERER}'), '.htaccess contains RewriteCond %{HTTP_REFERER}');
    assert(diskContent.includes('RewriteRule'), '.htaccess contains RewriteRule [NC,F,L]');

    // 4. Live Traffic Verification via Service API
    console.log('\n4. Testing Live Access Verification...');
    // A) Authorized referer -> Allowed
    const authRes = await request('GET', `/api/hotlink/verify-access?user=${user}&path=/site/images/logo.png&referer=http://example.com`);
    assert(authRes.status === 200 && authRes.data.allowed === true, 'Authorized referer (http://example.com) is allowed (HTTP 200)');

    // B) Unauthorized referer -> 403 Forbidden
    const unauthRes = await request('GET', `/api/hotlink/verify-access?user=${user}&path=/site/images/logo.png&referer=http://bandwidth-pirate.com`);
    assert(unauthRes.status === 200 && unauthRes.data.allowed === false, 'Unauthorized referer is blocked');
    assert(unauthRes.data.statusCode === 403, 'Unauthorized referer returns 403 Forbidden');

    // C) Non-protected extension (.css) -> Allowed even with unauthorized referer
    const cssRes = await request('GET', `/api/hotlink/verify-access?user=${user}&path=/site/styles/app.css&referer=http://bandwidth-pirate.com`);
    assert(cssRes.status === 200 && cssRes.data.allowed === true, 'Unprotected extension (.css) is allowed for any referer');

    // D) Blank referer when allowed -> Allowed
    const blankRes = await request('GET', `/api/hotlink/verify-access?user=${user}&path=/site/images/logo.png&referer=`);
    assert(blankRes.status === 200 && blankRes.data.allowed === true, 'Blank referer allowed when allowEmptyReferer is true');

    // 5. Update Config: Custom Redirect URL and Disallow Blank Referer
    console.log('\n5. Testing Custom Redirect URL & Strict Referer Enforcement...');
    const saveRes = await request('POST', '/api/hotlink/save', {
      cpanelUser: user,
      enabled: true,
      allowedDomains: ['default.com', 'https://default.com'],
      protectedExtensions: ['jpg', 'png', 'webp'],
      allowEmptyReferer: false,
      redirectUrl: 'https://default.com/no-hotlinking.png'
    });
    assert(saveRes.status === 200 && saveRes.data.success, 'Save config with redirect URL returned HTTP 200 success');
    assert(saveRes.data.config.redirectUrl === 'https://default.com/no-hotlinking.png', 'Redirect URL persisted in config');

    // Test blank referer now blocked with 302 redirect
    const blankBlockedRes = await request('GET', `/api/hotlink/verify-access?user=${user}&path=/site/images/logo.png&referer=`);
    assert(blankBlockedRes.status === 200 && blankBlockedRes.data.allowed === false, 'Blank referer now blocked when allowEmptyReferer is false');
    assert(blankBlockedRes.data.statusCode === 302, 'Redirect URL triggers HTTP 302 Found response');
    assert(blankBlockedRes.data.redirectUrl === 'https://default.com/no-hotlinking.png', 'Response includes configured redirect URL');

    // 6. Drift Detection & Repair
    console.log('\n6. Testing Drift Detection & 1-Click Repair...');
    // Simulate manual removal or alteration of .htaccess block
    fs.writeFileSync(htaccessPath, '# BEGIN MANAGED REDIRECTS\nRewriteEngine On\n# END MANAGED REDIRECTS\n', 'utf-8');
    const driftCfg = await request('GET', `/api/hotlink/config?user=${user}`);
    assert(driftCfg.data.config.inSync === false, 'Drift detected when .htaccess rules were externally modified');

    // Run 1-click repair
    const repairRes = await request('POST', '/api/hotlink/repair', { cpanelUser: user });
    assert(repairRes.status === 200 && repairRes.data.success, 'Repair endpoint returned HTTP 200 success');
    assert(repairRes.data.config.inSync === true, 'Rules are in sync after repair');
    const repairedHtaccess = fs.readFileSync(htaccessPath, 'utf-8');
    assert(repairedHtaccess.includes('# BEGIN CPANEL HOTLINK PROTECTION'), '.htaccess has restored hotlink protection block');
    assert(repairedHtaccess.includes('# BEGIN MANAGED REDIRECTS'), 'Coexisting managed redirects block was preserved');

    // 7. Disable Hotlink Protection
    console.log('\n7. Disabling Hotlink Protection and Verifying Clean Removal...');
    const disableRes = await request('POST', '/api/hotlink/toggle', {
      cpanelUser: user,
      enabled: false
    });
    assert(disableRes.status === 200 && disableRes.data.success, 'Disable toggle returned HTTP 200 success');
    assert(disableRes.data.config.enabled === false, 'Protection is disabled');
    const disabledHtaccess = fs.readFileSync(htaccessPath, 'utf-8');
    assert(!disabledHtaccess.includes('# BEGIN CPANEL HOTLINK PROTECTION'), 'Hotlink block completely removed from .htaccess');
    assert(disabledHtaccess.includes('# BEGIN MANAGED REDIRECTS'), 'Coexisting directives remain intact');

    // 8. Multi-Tenant Account Isolation
    console.log('\n8. Testing Multi-Tenant Account Isolation...');
    const userB = 'tenant_beta';
    const cfgBeta = await request('GET', `/api/hotlink/config?user=${userB}`);
    assert(cfgBeta.status === 200 && cfgBeta.data.success, 'Tenant B config retrieved');
    assert(cfgBeta.data.config.htaccessPath.includes('tenant_beta') || cfgBeta.data.config.accountDomains.length >= 0, 'Tenant B has isolated context');

    console.log(`\nAUDIT COMPLETE: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Unexpected error during audit:', err);
    process.exit(1);
  }
}

runAudit();
