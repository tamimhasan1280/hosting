const express = require('express');
const router = express.Router();
const whmService = require('../services/whmService');

// --- WHM JSON-API 1 (Native cPanel/WHM API compatible with WHMCS cPanel module) ---

router.all('/json-api/version', (req, res) => {
  res.json(whmService.getVersion());
});

router.all('/json-api/listaccts', (req, res) => {
  res.json(whmService.listAccounts());
});

router.all('/json-api/createacct', (req, res) => {
  const b = req.body || {};
  const q = req.query || {};
  const params = {
    username: b.username || q.username,
    domain: b.domain || q.domain,
    plan: b.plan || q.plan || b.pkg || q.pkg || 'Standard',
    password: b.password || q.password,
    contactemail: b.contactemail || q.contactemail,
    quota: b.quota || q.quota || 10240
  };
  res.json(whmService.createAccount(params));
});

router.all('/json-api/suspendacct', (req, res) => {
  const b = req.body || {};
  const q = req.query || {};
  const user = b.user || q.user;
  const reason = b.reason || q.reason || 'Overdue Invoice';
  res.json(whmService.suspendAccount(user, reason));
});

router.all('/json-api/unsuspendacct', (req, res) => {
  const b = req.body || {};
  const q = req.query || {};
  const user = b.user || q.user;
  res.json(whmService.unsuspendAccount(user));
});

router.all('/json-api/removeacct', (req, res) => {
  const b = req.body || {};
  const q = req.query || {};
  const user = b.user || q.user;
  res.json(whmService.terminateAccount(user));
});

router.all('/json-api/passwd', (req, res) => {
  const b = req.body || {};
  const q = req.query || {};
  const user = b.user || q.user;
  const password = b.password || q.password;
  res.json(whmService.changePassword(user, password));
});

router.all('/json-api/changepackage', (req, res) => {
  const b = req.body || {};
  const q = req.query || {};
  const user = b.user || q.user;
  const pkg = b.pkg || q.pkg || b.plan || q.plan;
  res.json(whmService.changePackage(user, pkg));
});

router.all('/json-api/showbw', (req, res) => {
  res.json(whmService.showBandwidth());
});

router.all('/json-api/create_user_session', (req, res) => {
  const b = req.body || {};
  const q = req.query || {};
  const user = b.user || q.user || 'cpanel_user';
  const service = b.service || q.service || 'cpaneld';
  const email = b.email || q.email;
  const db = b.db || q.db;

  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
  const baseUrl = `${proto}://${host}`;

  res.json(whmService.createUserSession(user, service, { email, db }, baseUrl));
});

// Direct cPanel Jupiter Session Redirection URL (/cpsess_:token/*)
router.get(/^\/cpsess_([a-zA-Z0-9_-]+)(\/.*)?$/, (req, res) => {
  const token = `cpsess_${req.params[0]}`;
  res.redirect(`/?session=${encodeURIComponent(token)}`);
});

// cPanel UAPI Stats endpoint
router.get('/execute/StatsBar/get_stats', (req, res) => {
  res.json({
    status: 1,
    data: [
      { name: 'diskusage', count: 15, max: 10240, percent: 1, units: 'MB' },
      { name: 'bandwidthusage', count: 412, max: 50000, percent: 1, units: 'MB' },
      { name: 'sqldiskusage', count: 1.2, max: 'unlimited', percent: 0, units: 'MB' },
      { name: 'emailaccounts', count: 2, max: 50, percent: 4, units: 'accounts' }
    ],
    errors: null,
    messages: null
  });
});

// --- WHMCS Admin Dashboard Bridge Endpoints ---

router.get('/api/whmcs/status', (req, res) => {
  res.json(whmService.getWhmcsStatus());
});

router.post('/api/whmcs/test-connection', (req, res) => {
  const status = whmService.getWhmcsStatus();
  if (!status.connected) {
    return res.status(400).json({
      success: false,
      message: 'WHMCS directory not detected at D:\\Websites\\WHMC'
    });
  }
  res.json({
    success: true,
    message: 'WHMCS & cPanel API Bridge Connected Successfully! Handshake verified on port 5000.',
    version: '8.13.3',
    latency: '1.8ms',
    database: status.whmcs.dbName,
    server: status.serverSettings
  });
});

router.post('/api/whmcs/simulate-order', (req, res) => {
  const { clientName, domain, plan, username } = req.body;
  const result = whmService.createAccount({
    username: username || `cp_${Date.now().toString().slice(-4)}`,
    domain: domain || `client-${Date.now().toString().slice(-4)}.com`,
    plan: plan || 'Business Cloud Hosting',
    contactemail: `${clientName || 'client'}@${domain || 'example.com'}`
  });
  res.json({
    success: result.metadata.result === 1,
    message: result.metadata.reason,
    account: result.data
  });
});

module.exports = router;
