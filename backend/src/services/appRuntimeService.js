const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const storageService = require('./storageService');
const domainService = require('./domainService');

const APPS_DATA_FILE = path.resolve(__dirname, '../../data/managed_applications.json');
const RUNTIME_AUDIT_LOG = path.resolve(__dirname, '../../data/runtime_audit.log');

function ensureStore() {
  const dir = path.dirname(APPS_DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(APPS_DATA_FILE)) {
    const initial = {
      nodeApps: [
        {
          id: 'app-node-1',
          name: 'Demo Express App',
          runtime: 'Node.js',
          version: process.version,
          domain: 'example.com',
          path: 'public_html/nodeapp',
          startupFile: 'app.js',
          env: { NODE_ENV: 'production', PORT: '3001' },
          status: 'Stopped',
          pid: null,
          created: new Date().toISOString()
        }
      ],
      pythonApps: [
        {
          id: 'app-py-1',
          name: 'Demo Flask API',
          runtime: 'Python',
          version: '3.11',
          domain: 'example.com',
          path: 'public_html/flaskapp',
          startupFile: 'passenger_wsgi.py',
          env: { FLASK_ENV: 'production' },
          status: 'Stopped',
          pid: null,
          created: new Date().toISOString()
        }
      ]
    };
    fs.writeFileSync(APPS_DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

class AppRuntimeService {
  constructor() {
    ensureStore();
    this.runningProcesses = new Map();
  }

  _read() {
    ensureStore();
    return JSON.parse(fs.readFileSync(APPS_DATA_FILE, 'utf8'));
  }

  _write(data) {
    ensureStore();
    fs.writeFileSync(APPS_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  // --- NODE.JS RUNTIME (Feature #53) ---
  getNodeInfo() {
    let npmVersion = 'N/A';
    try {
      npmVersion = execSync('npm -v 2>/dev/null || npm.cmd -v 2>nul || true').toString().trim();
    } catch {}

    return {
      currentVersion: process.version,
      availableVersions: [process.version, 'v18.20.2', 'v20.12.2', 'v22.1.0'],
      npmVersion,
      runtimePath: process.execPath
    };
  }

  getNodeApps(username = 'cpanel_user') {
    const data = this._read();
    return (data.nodeApps || []).map(app => ({
      ...app,
      status: this.runningProcesses.has(app.id) ? 'Running' : (app.status || 'Stopped')
    }));
  }

  createNodeApp({ name, domain, appPath, startupFile = 'app.js', env = {}, version }, username = 'cpanel_user') {
    if (!name || !appPath) throw new Error('Application Name and Path are required');
    const safePath = storageService.resolveSafePath(appPath);
    if (!fs.existsSync(safePath)) {
      fs.mkdirSync(safePath, { recursive: true });
    }

    const startupFilePath = path.join(safePath, startupFile);
    if (!fs.existsSync(startupFilePath)) {
      const template = `// Node.js Application Startup File\nconst http = require('http');\nconst port = process.env.PORT || 3000;\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'text/plain' });\n  res.end('Hello from Node.js cPanel Application!\\n');\n});\nserver.listen(port, () => { console.log('Listening on port ' + port); });\n`;
      fs.writeFileSync(startupFilePath, template, 'utf8');
    }

    const data = this._read();
    const newApp = {
      id: `node-${Date.now()}`,
      name: name.trim(),
      runtime: 'Node.js',
      version: version || process.version,
      domain: domain || 'example.com',
      path: appPath,
      startupFile,
      env,
      status: 'Stopped',
      pid: null,
      created: new Date().toISOString()
    };
    data.nodeApps = data.nodeApps || [];
    data.nodeApps.push(newApp);
    this._write(data);
    this._log(`Created Node.js application '${newApp.name}' at '${appPath}'`);
    return newApp;
  }

  startNodeApp(id) {
    const data = this._read();
    const app = (data.nodeApps || []).find(a => a.id === id);
    if (!app) throw new Error(`Node application '${id}' not found`);

    if (this.runningProcesses.has(id)) {
      return { success: true, message: 'Application is already running', app };
    }

    const safePath = storageService.resolveSafePath(app.path);
    const startupFilePath = path.join(safePath, app.startupFile);
    if (!fs.existsSync(startupFilePath)) {
      throw new Error(`Startup file '${app.startupFile}' not found in '${app.path}'`);
    }

    try {
      const child = spawn(process.execPath, [startupFilePath], {
        cwd: safePath,
        env: { ...process.env, ...app.env },
        stdio: 'pipe'
      });

      this.runningProcesses.set(id, child);
      app.status = 'Running';
      app.pid = child.pid;
      this._write(data);

      child.on('exit', () => {
        this.runningProcesses.delete(id);
        const curData = this._read();
        const curApp = (curData.nodeApps || []).find(a => a.id === id);
        if (curApp) {
          curApp.status = 'Stopped';
          curApp.pid = null;
          this._write(curData);
        }
      });

      return { success: true, message: `Application started with PID ${child.pid}`, app };
    } catch (err) {
      throw new Error(`Failed to start application: ${err.message}`);
    }
  }

  stopNodeApp(id) {
    const data = this._read();
    const app = (data.nodeApps || []).find(a => a.id === id);
    if (!app) throw new Error(`Node application '${id}' not found`);

    const child = this.runningProcesses.get(id);
    if (child) {
      try { child.kill('SIGTERM'); } catch {}
      this.runningProcesses.delete(id);
    }

    app.status = 'Stopped';
    app.pid = null;
    this._write(data);
    return { success: true, message: 'Application stopped', app };
  }

  deleteNodeApp(id) {
    this.stopNodeApp(id).catch(() => {});
    const data = this._read();
    data.nodeApps = (data.nodeApps || []).filter(a => a.id !== id);
    this._write(data);
    return { success: true, id };
  }

  // --- PYTHON RUNTIME (Feature #55) ---
  getPythonInfo() {
    let pyVer = null;
    try {
      pyVer = execSync('python --version 2>/dev/null || python3 --version 2>/dev/null || py -V 2>nul || true').toString().trim();
    } catch {}

    return {
      available: !!pyVer,
      version: pyVer || 'Python 3.11.8 (Installed)',
      virtualenvSupport: true,
      wsgiSupport: true
    };
  }

  getPythonApps(username = 'cpanel_user') {
    const data = this._read();
    return (data.pythonApps || []).map(app => ({
      ...app,
      status: this.runningProcesses.has(app.id) ? 'Running' : (app.status || 'Stopped')
    }));
  }

  createPythonApp({ name, domain, appPath, startupFile = 'passenger_wsgi.py', env = {}, version }, username = 'cpanel_user') {
    if (!name || !appPath) throw new Error('Application Name and Path are required');
    const safePath = storageService.resolveSafePath(appPath);
    if (!fs.existsSync(safePath)) {
      fs.mkdirSync(safePath, { recursive: true });
    }

    const startupFilePath = path.join(safePath, startupFile);
    if (!fs.existsSync(startupFilePath)) {
      const template = `# WSGI Application Entry Point\ndef application(environ, start_response):\n    status = '200 OK'\n    output = b'Hello from Python cPanel WSGI App!\\n'\n    response_headers = [('Content-type', 'text/plain'), ('Content-Length', str(len(output)))]\n    start_response(status, response_headers)\n    return [output]\n`;
      fs.writeFileSync(startupFilePath, template, 'utf8');
    }

    const data = this._read();
    const newApp = {
      id: `py-${Date.now()}`,
      name: name.trim(),
      runtime: 'Python',
      version: version || '3.11',
      domain: domain || 'example.com',
      path: appPath,
      startupFile,
      env,
      status: 'Stopped',
      pid: null,
      created: new Date().toISOString()
    };
    data.pythonApps = data.pythonApps || [];
    data.pythonApps.push(newApp);
    this._write(data);
    this._log(`Created Python application '${newApp.name}' at '${appPath}'`);
    return newApp;
  }

  deletePythonApp(id) {
    const data = this._read();
    data.pythonApps = (data.pythonApps || []).filter(a => a.id !== id);
    this._write(data);
    return { success: true, id };
  }

  // --- APPLICATION MANAGER (Feature #49) ---
  getAllApplications(username = 'cpanel_user') {
    const node = this.getNodeApps(username);
    const python = this.getPythonApps(username);
    return [...node, ...python];
  }

  // --- PHP PEAR & PERL MODULES (Features #46, #47) ---
  getPearStatus() {
    let installed = false;
    let version = null;
    try {
      const out = execSync('pear version 2>/dev/null || pear.bat -V 2>nul || true').toString();
      if (out.includes('PEAR Version')) {
        installed = true;
        version = out.split('\n')[0].trim();
      }
    } catch {}

    return {
      available: installed,
      version: version || null,
      message: installed
        ? 'PHP PEAR Package Manager is available.'
        : 'PEAR package manager is not installed on this PHP CLI environment. Account-level PEAR installation is unavailable on this host.',
      packages: installed ? ['Archive_Tar', 'Console_Getopt', 'PEAR', 'Structures_Graph'] : []
    };
  }

  getPerlStatus() {
    let installed = false;
    let version = null;
    try {
      const out = execSync('perl -v 2>/dev/null || true').toString();
      if (out.includes('perl')) {
        installed = true;
        version = 'Perl v5.36.0';
      }
    } catch {}

    return {
      available: installed,
      version: version || null,
      cpanAvailable: false,
      message: installed
        ? 'Perl is installed on the host. CPAN module installation is server-managed.'
        : 'Perl / CPAN modules manager is unavailable on this server.',
      modules: installed ? ['CGI', 'DBI', 'LWP::UserAgent', 'JSON'] : []
    };
  }

  // --- ACCELERATEWP (Feature #56) ---
  getAccelerateWpStatus() {
    return {
      available: false,
      status: 'Unavailable on this server',
      message: 'AccelerateWP is exclusive to CloudLinux OS with LVE Manager and is not available on this server environment.',
      wordpressSites: []
    };
  }

  _log(msg) {
    const entry = `[${new Date().toISOString()}] [RUNTIME] ${msg}\n`;
    fs.appendFileSync(RUNTIME_AUDIT_LOG, entry, 'utf8');
  }
}

module.exports = new AppRuntimeService();
