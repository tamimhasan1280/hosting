const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const apiRoutes = require('./routes/api');
const whmRoutes = require('./routes/whmRoutes');
const storageService = require('./services/storageService');
const privacyService = require('./services/privacyService');
const webDiskService = require('./services/webDiskService');
const ftpServerService = require('./services/ftpServerService');
const redirectService = require('./services/redirectService');
const dynamicDnsService = require('./services/dynamicDnsService');
const visitorService = require('./services/visitorService');
const errorLogService = require('./services/errorLogService');
const hotlinkService = require('./services/hotlinkService');
const leechService = require('./services/leechService');

const app = express();
const PORT = process.env.PORT || 5000;

// WebDAV Server Protocol (cPanel Web Disk endpoint)
// Mounted BEFORE CORS and body parsers for raw stream support and WebDAV OPTIONS
app.use('/webdav', (req, res) => {
  webDiskService.handleWebDavRequest(req, res);
});

// Enable CORS & JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve WHM API 1 & WHMCS Bridge (/json-api/*, /execute/*, /api/whmcs/*)
app.use('/', whmRoutes);

// Serve API
app.use('/api', apiRoutes);

// Standard DynDNS / RFC update endpoint at root for router clients (/nic/update)
app.all('/nic/update', (req, res) => {
  const result = dynamicDnsService.handleUpdateRequest(req);
  const wantsJson = (req.headers['accept'] && req.headers['accept'].includes('application/json')) || req.query.format === 'json';
  if (wantsJson) {
    return res.status(result.statusCode).json(result);
  }
  return res.status(result.statusCode).type('text/plain').send(result.rawResponse);
});


// Live preview of the user's public_html website with real HTTP Basic Auth!
app.use('/site', (req, res, next) => {
  const user = req.query.user || req.headers['x-cpanel-user'] || 'cpanel_user';
  const domain = req.query.domain || req.headers['x-cpanel-domain'] || 'example.com';

  // Live Apache Combined Access Logger
  res.on('finish', () => {
    try {
      const bytes = res.getHeader('content-length') || 0;
      visitorService.logRequest({
        user,
        domain,
        ip: dynamicDnsService.detectClientIp(req),
        method: req.method,
        url: req.path || '/',
        status: res.statusCode,
        bytes,
        referrer: req.headers['referer'] || req.headers['referrer'] || '-',
        userAgent: req.headers['user-agent'] || '-'
      });
    } catch (e) {}

    // Live Apache Error Logger for 4xx / 5xx responses
    try {
      if (res.statusCode >= 400) {
        errorLogService.logHttpError({
          user,
          domain,
          ip: dynamicDnsService.detectClientIp(req),
          method: req.method,
          url: req.path || '/',
          status: res.statusCode,
          referer: req.headers['referer'] || req.headers['referrer'] || '-'
        });
      }
    } catch (e) {}
  });

  const userPublicHtml = path.join(storageService.getRootDir(user), 'public_html');

  // Enforce Directory Privacy (HTTP 401 Basic Auth Challenge)
  const authCheck = privacyService.verifyHttpAuth(userPublicHtml, req.path, req.headers['authorization'], user);
  if (authCheck.requiresAuth && !authCheck.authorized) {
    res.setHeader('WWW-Authenticate', `Basic realm="${authCheck.realm}"`);
    return res.status(401).send(`<!DOCTYPE html>
<html><head><title>401 Authorization Required</title></head>
<body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
  <h1>401 Authorization Required</h1>
  <p>This server could not verify that you are authorized to access the document requested.</p>
  <hr><address>cPanel Jupiter Web Server</address>
</body></html>`);
  }

  // Apply managed redirect rules (mirrors .htaccess MANAGED REDIRECTS block)
  try {
    const hostname = req.hostname || req.headers['host'] || 'localhost';
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const query = req.query || {};
    const match = redirectService.matchRedirect(user, hostname, req.path, query, isHttps);
    if (match) {
      return res.redirect(match.statusCode, match.destination);
    }
  } catch (e) {
    // Non-fatal: redirect engine error should not block static serving
  }

  // Apply Hotlink Protection rules (mirrors .htaccess CPANEL HOTLINK PROTECTION block)
  try {
    const referer = req.headers['referer'] || req.headers['referrer'] || '';
    const hotlinkCheck = hotlinkService.checkRequest(user, req.path, referer);
    if (hotlinkCheck.blocked) {
      if (hotlinkCheck.redirectUrl) {
        return res.redirect(hotlinkCheck.statusCode, hotlinkCheck.redirectUrl);
      }
      return res.status(403).send(`<!DOCTYPE html>
<html><head><title>403 Forbidden</title></head>
<body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
  <h1>403 Forbidden</h1>
  <p>Hotlinking is prohibited by server security policy.</p>
  <hr><address>cPanel Jupiter Web Server</address>
</body></html>`);
    }
  } catch (e) {
    // Non-fatal
  }

  // Apply Leech Protection rules (mirrors .htaccess CPANEL LEECH PROTECTION block)
  try {
    const clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.socket.remoteAddress;
    const leechCheck = leechService.checkAccess({
      username: user,
      reqPath: req.path,
      clientIp,
      authHeader: req.headers['authorization']
    });
    if (leechCheck.blocked) {
      if (leechCheck.redirectUrl) {
        return res.redirect(leechCheck.statusCode, leechCheck.redirectUrl);
      }
      return res.status(403).send(`<!DOCTYPE html>
<html><head><title>403 Forbidden - Leech Protection</title></head>
<body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
  <h1>403 Forbidden</h1>
  <p>Access denied: Leech Protection policy enforced on this directory.</p>
  <p style="color: #666; font-size: 13px;">${leechCheck.reason || 'Excessive or compromised credential logins detected.'}</p>
  <hr><address>cPanel Jupiter Web Server</address>
</body></html>`);
    }
  } catch (e) {
    // Non-fatal
  }

  express.static(userPublicHtml)(req, res, next);
});

// Serve frontend production build if available
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/site') || req.path.startsWith('/webdav')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: 'cPanel Pro v120.0',
    mode: process.platform === 'win32' ? 'Development Sandbox (Windows)' : 'Production (Linux VPS)',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`⚡ cPanel Dashboard running on http://localhost:${PORT}`);
  console.log(`🌐 Live Hosted Website preview: http://localhost:${PORT}/site`);
  console.log(`🔧 Mode: ${process.platform === 'win32' ? 'Windows Sandbox' : 'Linux Production VPS'}`);
  console.log(`====================================================`);

  // Start real RFC 959 FTP Daemon
  ftpServerService.start(21);
});
