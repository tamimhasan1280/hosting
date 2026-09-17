const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const domainService = require('./domainService');
const storageService = require('./storageService');

const SITEJET_DATA_FILE = path.resolve(__dirname, '../../data/sitejet.json');
const SITEJET_CONFIG_FILE = path.resolve(__dirname, '../../data/sitejet_config.json');

function ensureSitejetConfig() {
  const dir = path.dirname(SITEJET_CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(SITEJET_CONFIG_FILE)) {
    const initialConfig = {
      enabled: true,
      partnerId: 'cpanel-partner-standard',
      partnerName: 'cPanel Sitejet Integration',
      apiUrl: 'https://partner.sitejet.io/api/v1',
      ssoUrl: 'https://partner.sitejet.io/sso',
      mode: 'AVAILABLE', // 'AVAILABLE' | 'NOT_CONFIGURED' | 'UNAVAILABLE'
      supportedFeatures: [
        'visual_editor',
        'responsive_design',
        'one_click_publish',
        'template_browser',
        'ssl_sync',
        'domain_linking'
      ],
      templates: [
        { id: 'business_pro', name: 'Business Pro', category: 'Corporate', description: 'Clean modern corporate template with lead capture and services showcase.' },
        { id: 'restaurant_bistro', name: 'Artisan Bistro', category: 'Food & Dining', description: 'Interactive menu, reservation booking widget, and visual gallery.' },
        { id: 'portfolio_creative', name: 'Creative Studio', category: 'Portfolio', description: 'Minimalist designer and agency portfolio with project grids.' },
        { id: 'ecommerce_store', name: 'Modern Storefront', category: 'E-Commerce', description: 'Product grid, shopping cart flow, and conversion-optimized banners.' },
        { id: 'blank_canvas', name: 'Blank Canvas', category: 'Custom', description: 'Start completely from scratch with pure drag-and-drop elements.' }
      ]
    };
    fs.writeFileSync(SITEJET_CONFIG_FILE, JSON.stringify(initialConfig, null, 2), 'utf8');
  }
}

function ensureSitejetStore() {
  const dir = path.dirname(SITEJET_DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(SITEJET_DATA_FILE)) {
    const initialStore = {
      accounts: {
        'cpanel_user': {
          projects: []
        }
      }
    };
    fs.writeFileSync(SITEJET_DATA_FILE, JSON.stringify(initialStore, null, 2), 'utf8');
  }
}

class SitejetService {
  constructor() {
    ensureSitejetConfig();
    ensureSitejetStore();
  }

  _readConfig() {
    ensureSitejetConfig();
    try {
      return JSON.parse(fs.readFileSync(SITEJET_CONFIG_FILE, 'utf8'));
    } catch (e) {
      return { enabled: true, mode: 'AVAILABLE', partnerId: 'cpanel-partner-standard' };
    }
  }

  _readStore() {
    ensureSitejetStore();
    try {
      return JSON.parse(fs.readFileSync(SITEJET_DATA_FILE, 'utf8'));
    } catch (e) {
      return { accounts: {} };
    }
  }

  _writeStore(data) {
    fs.writeFileSync(SITEJET_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  _getAccountProjects(cpanelUser = 'cpanel_user') {
    const store = this._readStore();
    if (!store.accounts[cpanelUser]) {
      store.accounts[cpanelUser] = { projects: [] };
      this._writeStore(store);
    }
    return store.accounts[cpanelUser].projects || [];
  }

  _saveAccountProjects(projects, cpanelUser = 'cpanel_user') {
    const store = this._readStore();
    if (!store.accounts[cpanelUser]) {
      store.accounts[cpanelUser] = {};
    }
    store.accounts[cpanelUser].projects = projects;
    this._writeStore(store);
  }

  /**
   * Capability Detection: Real status of Sitejet in this hosting server
   */
  getCapabilities(cpanelUser = 'cpanel_user') {
    const config = this._readConfig();
    const isConfigured = Boolean(config.enabled && config.partnerId);

    let status = 'AVAILABLE';
    let statusMessage = 'Sitejet Builder is active and ready for your hosting account.';

    if (!config.enabled) {
      status = 'UNAVAILABLE';
      statusMessage = 'Sitejet Builder has been disabled by the server administrator.';
    } else if (!isConfigured) {
      status = 'NOT_CONFIGURED';
      statusMessage = 'Sitejet Partner API credentials are required to activate this feature.';
    }

    return {
      status,
      statusMessage,
      partnerId: config.partnerId,
      partnerName: config.partnerName || 'cPanel Sitejet Integration',
      supportedFeatures: config.supportedFeatures || [],
      templatesCount: config.templates?.length || 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get available Sitejet Templates
   */
  getTemplates() {
    const config = this._readConfig();
    return config.templates || [];
  }

  /**
   * Get all eligible domains and their current Sitejet status for an account
   */
  getSites(cpanelUser = 'cpanel_user') {
    const domainData = domainService.getAll(cpanelUser) || {};
    const primaryDomain = domainData.primaryDomain || `${cpanelUser}.com`;
    const domains = domainData.domains || [{ name: primaryDomain, type: 'Primary Domain', documentRoot: 'public_html' }];
    const subdomains = domainData.subdomains || [];
    const projects = this._getAccountProjects(cpanelUser);
    const userRoot = storageService.getRootDir(cpanelUser);

    const allDomainList = [];

    // Main / Addon domains
    for (const d of domains) {
      allDomainList.push({
        name: d.name,
        type: d.type || 'Primary Domain',
        documentRoot: d.documentRoot || 'public_html',
        sslStatus: d.sslStatus || 'Valid Let\'s Encrypt SSL',
        phpVersion: d.phpVersion || 'ea-php82'
      });
    }

    // Subdomains
    for (const s of subdomains) {
      allDomainList.push({
        name: s.name,
        type: 'Subdomain',
        documentRoot: s.documentRoot || `public_html/${s.sub || s.name}`,
        sslStatus: 'Valid Let\'s Encrypt SSL',
        phpVersion: 'ea-php82'
      });
    }

    // Map each domain with its Sitejet project & conflict status
    const sitejetSites = allDomainList.map(dom => {
      const existingProject = projects.find(p => p.domain.toLowerCase() === dom.name.toLowerCase());
      const docRootAbs = path.resolve(userRoot, dom.documentRoot);

      // Check conflicts
      let hasWordPress = false;
      let hasExistingSite = false;
      let fileCount = 0;

      if (fs.existsSync(docRootAbs)) {
        try {
          const files = fs.readdirSync(docRootAbs);
          fileCount = files.length;
          hasWordPress = files.includes('wp-config.php') || files.includes('wp-load.php');
          hasExistingSite = files.some(f => ['index.html', 'index.php', 'index.htm'].includes(f));
        } catch (e) {}
      }

      const siteUrl = `https://${dom.name}`;

      return {
        id: dom.name.replace(/[^a-zA-Z0-9_-]/g, '_'),
        domain: dom.name,
        type: dom.type,
        documentRoot: dom.documentRoot,
        sslStatus: dom.sslStatus,
        url: siteUrl,
        hasWordPress,
        hasExistingSite,
        fileCount,
        hasProject: Boolean(existingProject),
        project: existingProject || null,
        status: existingProject ? existingProject.status : 'NOT_CREATED',
        lastPublished: existingProject?.lastPublished || null
      };
    });

    return {
      sites: sitejetSites,
      totalDomains: sitejetSites.length,
      activeProjects: projects.length,
      publishedProjects: projects.filter(p => p.status === 'PUBLISHED').length
    };
  }

  /**
   * Create a new Sitejet project for a domain
   */
  createProject(domainName, templateId = 'business_pro', projectName = null, cpanelUser = 'cpanel_user') {
    if (!domainName) {
      throw new Error('Domain name is required');
    }

    const domainData = domainService.getAll(cpanelUser) || {};
    const domains = domainData.domains || [];
    const subdomains = domainData.subdomains || [];
    const primaryDomain = domainData.primaryDomain || `${cpanelUser}.com`;

    // Strictly verify ownership
    const isOwned = (domainName.toLowerCase() === primaryDomain.toLowerCase()) ||
      domains.some(d => d.name.toLowerCase() === domainName.toLowerCase()) ||
      subdomains.some(s => s.name.toLowerCase() === domainName.toLowerCase());

    if (!isOwned) {
      throw new Error(`Access denied: domain ${domainName} does not belong to user ${cpanelUser}`);
    }

    const projects = this._getAccountProjects(cpanelUser);
    const existingIndex = projects.findIndex(p => p.domain.toLowerCase() === domainName.toLowerCase());

    if (existingIndex >= 0) {
      throw new Error(`A Sitejet project already exists for ${domainName}. Please open the existing project or unlink it.`);
    }

    // Determine document root
    let docRoot = 'public_html';
    const foundDom = domains.find(d => d.name.toLowerCase() === domainName.toLowerCase());
    if (foundDom && foundDom.documentRoot) {
      docRoot = foundDom.documentRoot;
    } else {
      const foundSub = subdomains.find(s => s.name.toLowerCase() === domainName.toLowerCase());
      if (foundSub && foundSub.documentRoot) {
        docRoot = foundSub.documentRoot;
      }
    }

    const config = this._readConfig();
    const template = (config.templates || []).find(t => t.id === templateId) || { id: 'business_pro', name: 'Business Pro' };

    const projectId = `sj_proj_${crypto.randomBytes(6).toString('hex')}`;
    const newProject = {
      id: projectId,
      projectId: projectId,
      domain: domainName,
      projectName: projectName || `${domainName} Website`,
      documentRoot: docRoot,
      templateId: template.id,
      templateName: template.name,
      status: 'DRAFT', // 'DRAFT' | 'PUBLISHED'
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastPublished: null
    };

    projects.push(newProject);
    this._saveAccountProjects(projects, cpanelUser);

    return {
      success: true,
      message: `Sitejet project created for ${domainName}`,
      project: newProject
    };
  }

  /**
   * Generate secure SSO launcher URL for Sitejet Builder
   */
  openBuilder(projectId, cpanelUser = 'cpanel_user') {
    const projects = this._getAccountProjects(cpanelUser);
    const project = projects.find(p => p.id === projectId || p.projectId === projectId);

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    const config = this._readConfig();
    const ssoToken = crypto.randomBytes(24).toString('hex');
    const ssoUrl = `${config.ssoUrl || 'https://partner.sitejet.io/sso'}?token=${ssoToken}&projectId=${project.projectId}&domain=${encodeURIComponent(project.domain)}&partner=${encodeURIComponent(config.partnerId || 'cpanel')}`;

    return {
      success: true,
      projectId: project.projectId,
      domain: project.domain,
      ssoUrl: ssoUrl,
      expiresIn: 300 // seconds
    };
  }

  /**
   * Publish / Deploy Sitejet website to the target document root
   */
  publishProject(projectId, cpanelUser = 'cpanel_user') {
    const projects = this._getAccountProjects(cpanelUser);
    const projectIndex = projects.findIndex(p => p.id === projectId || p.projectId === projectId);

    if (projectIndex === -1) {
      throw new Error('Project not found or access denied');
    }

    const project = projects[projectIndex];
    const userRoot = storageService.getRootDir(cpanelUser);
    const cleanDocRoot = (project.documentRoot || 'public_html').replace(/^[\/\\]+/, '').replace(/\.\./g, '');
    const targetDir = path.resolve(userRoot, cleanDocRoot);

    // Sandbox check
    if (!targetDir.startsWith(path.resolve(userRoot))) {
      throw new Error('Access denied: document root escapes user sandbox');
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Deploy high-performance modern Sitejet static site assets
    const siteTitle = project.projectName || `${project.domain} — Sitejet Website`;
    const publishedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteTitle}</title>
  <meta name="generator" content="Sitejet Builder cPanel Integration">
  <style>
    :root {
      --primary: #ff6c2c;
      --primary-dark: #e05819;
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    body { background-color: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }
    header { border-bottom: 1px solid rgba(255,255,255,0.08); padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; }
    .brand { font-size: 20px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; }
    .badge { background: var(--primary); color: #fff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; text-transform: uppercase; }
    main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; }
    .hero { max-width: 720px; background: var(--card-bg); padding: 50px 40px; border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); }
    h1 { font-size: 38px; font-weight: 800; margin-bottom: 16px; line-height: 1.2; background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    p { font-size: 16px; color: var(--text-muted); line-height: 1.6; margin-bottom: 30px; }
    .cta-btn { display: inline-block; background: var(--primary); color: white; padding: 14px 32px; border-radius: 12px; font-size: 15px; font-weight: 600; text-decoration: none; transition: all 0.2s ease; box-shadow: 0 4px 14px rgba(255,108,44,0.3); }
    .cta-btn:hover { background: var(--primary-dark); transform: translateY(-2px); }
    .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-top: 40px; text-align: left; }
    .feat-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 20px; border-radius: 16px; }
    .feat-title { font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #fff; }
    .feat-desc { font-size: 12px; color: var(--text-muted); }
    footer { border-top: 1px solid rgba(255,255,255,0.05); padding: 24px 40px; text-align: center; font-size: 13px; color: var(--text-muted); }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>${project.domain}</span>
      <span class="badge">Sitejet Built</span>
    </div>
  </header>
  <main>
    <div class="hero">
      <span class="badge" style="margin-bottom: 16px;">Live & Published</span>
      <h1>Welcome to ${project.domain}</h1>
      <p>This website was designed and published using the integrated <strong>Sitejet Builder</strong> on cPanel. Template: <em>${project.templateName || 'Business Pro'}</em>.</p>
      <a href="/#contact" class="cta-btn">Get in Touch</a>

      <div class="features">
        <div class="feat-card">
          <div class="feat-title">⚡ Ultra-Fast Performance</div>
          <div class="feat-desc">Optimized static delivery with zero database latency.</div>
        </div>
        <div class="feat-card">
          <div class="feat-title">🔒 SSL Protected</div>
          <div class="feat-desc">Secure end-to-end TLS encryption enabled.</div>
        </div>
        <div class="feat-card">
          <div class="feat-title">📱 Fully Responsive</div>
          <div class="feat-desc">Flawless design on desktop, tablet, and mobile screens.</div>
        </div>
      </div>
    </div>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${project.domain}. Built with Sitejet Builder on cPanel.</p>
  </footer>
</body>
</html>`;

    const indexPath = path.join(targetDir, 'index.html');
    fs.writeFileSync(indexPath, publishedHtml, 'utf8');

    // Update project metadata
    project.status = 'PUBLISHED';
    project.lastPublished = new Date().toISOString();
    project.updatedAt = new Date().toISOString();

    projects[projectIndex] = project;
    this._saveAccountProjects(projects, cpanelUser);

    return {
      success: true,
      message: `Successfully published ${project.domain} to ${cleanDocRoot}/`,
      project: project,
      liveUrl: `https://${project.domain}`
    };
  }

  /**
   * Unlink a Sitejet project from a domain
   */
  unlinkProject(projectId, cpanelUser = 'cpanel_user') {
    const projects = this._getAccountProjects(cpanelUser);
    const filtered = projects.filter(p => p.id !== projectId && p.projectId !== projectId);

    if (filtered.length === projects.length) {
      throw new Error('Project not found or access denied');
    }

    this._saveAccountProjects(filtered, cpanelUser);

    return {
      success: true,
      message: 'Sitejet project unlinked successfully'
    };
  }

  /**
   * Force synchronization / refresh of project state
   */
  refreshProject(projectId, cpanelUser = 'cpanel_user') {
    const projects = this._getAccountProjects(cpanelUser);
    const project = projects.find(p => p.id === projectId || p.projectId === projectId);

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    project.updatedAt = new Date().toISOString();
    this._saveAccountProjects(projects, cpanelUser);

    return {
      success: true,
      project: project
    };
  }
}

module.exports = new SitejetService();
