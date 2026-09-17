// scratch/jumping_sso_audit.js
// Automated verification suite for cPanel SSO Jumping & Direct Login

const BASE_URL = 'http://localhost:5000';

async function runAudit() {
  console.log('================================================================');
  console.log('🚀 RUNNING ADVANCED CPANEL SSO JUMPING & DIRECT LOGIN AUDIT');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. WHM cPanel SSO Session Creation
    console.log('👉 [1/7] Testing WHM SSO Session Creation & Validation...');
    const whmSessRes = await fetch(`${BASE_URL}/json-api/create_user_session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'user_5gb', service: 'cpaneld' })
    });
    const whmSessData = await whmSessRes.json();
    assert(whmSessData.metadata.result === 1, 'WHM session creation returned result = 1');
    assert(whmSessData.data.token && whmSessData.data.token.startsWith('cpsess_'), `Generated token starts with cpsess_: ${whmSessData.data.token}`);
    assert(whmSessData.data.url.includes(`session=${whmSessData.data.token}`), 'Redirect URL includes session token');

    // 2. Validate Session Endpoint
    console.log('\n👉 [2/7] Testing /api/auth/validate-session...');
    const valRes = await fetch(`${BASE_URL}/api/auth/validate-session?token=${whmSessData.data.token}`);
    const valData = await valRes.json();
    assert(valData.valid === true, 'Session token is valid');
    assert(valData.user === 'user_5gb', `Session bound to correct user: ${valData.user}`);

    // Mismatch test
    const mismatchRes = await fetch(`${BASE_URL}/api/auth/validate-session?token=${whmSessData.data.token}&user=different_user`);
    const mismatchData = await mismatchRes.json();
    assert(mismatchData.valid === false, 'Session validation fails when user parameter mismatches');

    // 3. Webmail SSO Session Generation
    console.log('\n👉 [3/7] Testing Webmail SSO Session Generation...');
    // Seed user_5gb's email accounts if needed
    const emailRes1 = await fetch(`${BASE_URL}/api/email`, {
      headers: { 'x-cpanel-user': 'user_5gb' }
    });
    const emailData1 = await emailRes1.json();
    assert(emailData1.accounts && emailData1.accounts.length > 0, `user_5gb has default email accounts: ${emailData1.accounts?.length}`);

    const testEmail = emailData1.accounts[0].email;
    const wmSessRes = await fetch(`${BASE_URL}/api/email/webmail/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cpanel-user': 'user_5gb' },
      body: JSON.stringify({ email: testEmail })
    });
    const wmSessData = await wmSessRes.json();
    assert(wmSessData.success === true, 'Webmail session created successfully');
    assert(wmSessData.token.startsWith('wmsess_'), `Webmail token starts with wmsess_: ${wmSessData.token}`);
    assert(wmSessData.email === testEmail, `Session bound to email: ${testEmail}`);

    // 4. Webmail Mailbox Loading & Multi-Folder Inspection
    console.log('\n👉 [4/7] Testing Webmail Mailbox & Messages...');
    const boxRes = await fetch(`${BASE_URL}/api/email/webmail/mailbox?email=${encodeURIComponent(testEmail)}&folder=inbox`, {
      headers: { 'x-cpanel-user': 'user_5gb' }
    });
    const boxData = await boxRes.json();
    assert(boxData.folder === 'inbox', 'Folder is inbox');
    assert(Array.isArray(boxData.messages), 'Messages is an array');
    assert(boxData.counts && typeof boxData.counts.inbox === 'number', 'Folder unread counts returned');

    // 5. Webmail Email Composition & Local Delivery
    console.log('\n👉 [5/7] Testing Webmail Send & Inbox Delivery...');
    const recipientEmail = emailData1.accounts[1] ? emailData1.accounts[1].email : testEmail;
    const sendRes = await fetch(`${BASE_URL}/api/email/webmail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cpanel-user': 'user_5gb' },
      body: JSON.stringify({
        from: testEmail,
        to: recipientEmail,
        subject: 'SSO Automated Test Message',
        body: 'Testing direct jumping and delivery in cPanel.'
      })
    });
    const sendData = await sendRes.json();
    assert(sendData.success === true, 'Email dispatched successfully');

    // Verify in Sent folder of sender
    const sentBoxRes = await fetch(`${BASE_URL}/api/email/webmail/mailbox?email=${encodeURIComponent(testEmail)}&folder=sent`, {
      headers: { 'x-cpanel-user': 'user_5gb' }
    });
    const sentBoxData = await sentBoxRes.json();
    const sentMsg = sentBoxData.messages.find(m => m.subject === 'SSO Automated Test Message');
    assert(!!sentMsg, 'Dispatched email verified in Sent folder');

    // 6. phpMyAdmin SSO Jumping Session
    console.log('\n👉 [6/7] Testing phpMyAdmin SSO Jumping...');
    const pmaSessRes = await fetch(`${BASE_URL}/api/databases/phpmyadmin/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cpanel-user': 'user_5gb' },
      body: JSON.stringify({ dbName: 'user_5gb_db1' })
    });
    const pmaSessData = await pmaSessRes.json();
    assert(pmaSessData.success === true, 'phpMyAdmin session created successfully');
    assert(pmaSessData.token.startsWith('pmasess_'), `phpMyAdmin token starts with pmasess_: ${pmaSessData.token}`);
    assert(pmaSessData.db === 'user_5gb_db1', 'phpMyAdmin session scoped to target database');
    assert(pmaSessData.url.includes('jump=phpmyadmin'), 'phpMyAdmin redirect URL has jump=phpmyadmin');

    // 7. Multi-Tenant Jumping Security & Cross-User Protection
    console.log('\n👉 [7/7] Testing Multi-Tenant Isolation for SSO Jumping...');
    // Try to jump into user_10gb email using user_5gb session
    const hackRes = await fetch(`${BASE_URL}/api/email/webmail/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cpanel-user': 'user_5gb' },
      body: JSON.stringify({ email: 'admin@client2.com' })
    });
    assert(hackRes.status === 400, 'Cross-user Webmail SSO jump rejected with HTTP 400');
    const hackData = await hackRes.json();
    assert(hackData.error && hackData.error.includes('does not belong to user'), `Correct security error: ${hackData.error}`);

    // Session token authorization header test: pass x-cpanel-session instead of x-cpanel-user
    const authHeaderRes = await fetch(`${BASE_URL}/api/databases`, {
      headers: { 'x-cpanel-session': whmSessData.data.token }
    });
    const authHeaderData = await authHeaderRes.json();
    assert(Array.isArray(authHeaderData.databases), 'Authenticated request using x-cpanel-session succeeded');
    const hasOnlyUser5gbDbs = authHeaderData.databases.every(d => d.name.startsWith('user_5gb_'));
    assert(hasOnlyUser5gbDbs, 'Session token automatically scopes database list to user_5gb');

  } catch (err) {
    console.error('Fatal audit error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`📊 SSO JUMPING AUDIT RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit();
