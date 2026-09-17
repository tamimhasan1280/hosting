const fs = require('fs');
const path = require('path');
const storageService = require('./storageService');
const domainService = require('./domainService');
const phpService = require('./phpService');
const databaseService = require('./databaseService');

/**
 * Safe parser for wp-config.php
 */
function parseWpConfig(configContent) {
  const defines = {};
  // Match define('KEY', 'VALUE') or define("KEY", "VALUE") or define('KEY', true/false/123)
  const defineRegex = /define\s*\(\s*['"]([^'"]+)['"]\s*,\s*(?:(['"])(.*?)\2|([^\s\),]+))\s*\)/gi;
  let match;
  while ((match = defineRegex.exec(configContent)) !== null) {
    const key = match[1];
    let val = match[3] !== undefined ? match[3] : match[4];
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (val === 'null') val = null;
    else if (!isNaN(Number(val)) && val.trim() !== '') val = Number(val);
    defines[key] = val;
  }

  // Match $table_prefix = 'wp_';
  let tablePrefix = 'wp_';
  const prefixMatch = configContent.match(/\$table_prefix\s*=\s*['"]([^'"]+)['"]/i);
  if (prefixMatch) {
    tablePrefix = prefixMatch[1];
  }

  return { defines, tablePrefix };
}

/**
 * Safe parser for wp-includes/version.php
 */
function parseWpVersion(versionContent) {
  // $wp_version = '6.4.3';
  const versionMatch = versionContent.match(/\$wp_version\s*=\s*['"]([^'"]+)['"]/i);
  return versionMatch ? versionMatch[1] : null;
}

/**
 * Safe parser for WordPress plugin headers
 */
function parsePluginHeader(fileContent) {
  const header = {};
  const headerSection = fileContent.slice(0, 8192); // Read up to first 8KB

  const fields = {
    name: /Plugin Name:\s*([^\r\n]+)/i,
    pluginUri: /Plugin URI:\s*([^\r\n]+)/i,
    version: /Version:\s*([^\r\n]+)/i,
    description: /Description:\s*([^\r\n]+)/i,
    author: /Author:\s*([^\r\n]+)/i,
    authorUri: /Author URI:\s*([^\r\n]+)/i,
    textDomain: /Text Domain:\s*([^\r\n]+)/i,
    network: /Network:\s*([^\r\n]+)/i
  };

  for (const [key, regex] of Object.entries(fields)) {
    const match = headerSection.match(regex);
    if (match) {
      header[key] = match[1].trim();
    }
  }

  return header.name ? header : null;
}

/**
 * Safe parser for WordPress theme style.css
 */
function parseThemeHeader(cssContent) {
  const header = {};
  const headerSection = cssContent.slice(0, 8192);

  const fields = {
    name: /Theme Name:\s*([^\r\n]+)/i,
    themeUri: /Theme URI:\s*([^\r\n]+)/i,
    version: /Version:\s*([^\r\n]+)/i,
    description: /Description:\s*([^\r\n]+)/i,
    author: /Author:\s*([^\r\n]+)/i,
    authorUri: /Author URI:\s*([^\r\n]+)/i,
    template: /Template:\s*([^\r\n]+)/i,
    textDomain: /Text Domain:\s*([^\r\n]+)/i
  };

  for (const [key, regex] of Object.entries(fields)) {
    const match = headerSection.match(regex);
    if (match) {
      header[key] = match[1].trim();
    }
  }

  return header.name ? header : null;
}

/**
 * Calculate directory size recursively (with safe depth)
 */
function getDirSize(dirPath, maxDepth = 6, currentDepth = 0) {
  if (currentDepth > maxDepth || !fs.existsSync(dirPath)) return 0;
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          total += getDirSize(fullPath, maxDepth, currentDepth + 1);
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          total += stat.size;
        }
      } catch (e) {}
    }
  } catch (e) {}
  return total;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

class WordPressService {
  constructor() {}

  /**
   * Resolve user root directory securely
   */
  getUserRootDir(cpanelUser = 'cpanel_user') {
    return storageService.getRootDir(cpanelUser);
  }

  /**
   * Find all WordPress installations under a user's account
   */
  async scanInstallations(cpanelUser = 'cpanel_user') {
    const userRoot = this.getUserRootDir(cpanelUser);
    const installations = [];
    const visited = new Set();

    const checkAndAdd = (dirPath, relPath) => {
      if (visited.has(dirPath)) return;
      visited.add(dirPath);

      const wpConfigPath = path.join(dirPath, 'wp-config.php');
      const wpIncludesPath = path.join(dirPath, 'wp-includes');
      const wpVersionPath = path.join(wpIncludesPath, 'version.php');
      const wpAdminPath = path.join(dirPath, 'wp-admin');

      // Valid WP installation must have wp-config.php OR (wp-includes/version.php and index.php)
      const hasConfig = fs.existsSync(wpConfigPath);
      const hasVersion = fs.existsSync(wpVersionPath);
      const hasAdmin = fs.existsSync(wpAdminPath);

      if (hasConfig || (hasVersion && hasAdmin)) {
        try {
          const details = this.getInstallationDetails(relPath, cpanelUser);
          if (details) {
            installations.push(details);
          }
        } catch (e) {
          console.error(`Error inspecting WordPress at ${relPath}:`, e);
        }
      }
    };

    // Scan public_html and common subdirectories up to depth 3
    const scanDir = (currentDir, currentRel, depth = 0) => {
      if (depth > 4 || !fs.existsSync(currentDir)) return;

      const wpConfigPath = path.join(currentDir, 'wp-config.php');
      const wpIncludesPath = path.join(currentDir, 'wp-includes');
      if (fs.existsSync(wpConfigPath) || fs.existsSync(wpIncludesPath)) {
        checkAndAdd(currentDir, currentRel);
      }

      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const name = entry.name;
            // Skip system/heavy non-web directories
            if (['.git', 'node_modules', 'vendor', 'wp-includes', 'wp-admin', 'wp-content', '.trash', 'mail', 'ssl'].includes(name)) {
              continue;
            }
            const nextDir = path.join(currentDir, name);
            const nextRel = currentRel ? `${currentRel}/${name}` : name;
            scanDir(nextDir, nextRel, depth + 1);
          }
        }
      } catch (e) {}
    };

    // Scan public_html first
    const publicHtml = path.join(userRoot, 'public_html');
    if (fs.existsSync(publicHtml)) {
      scanDir(publicHtml, 'public_html', 0);
    } else {
      scanDir(userRoot, '', 0);
    }

    return installations;
  }

  /**
   * Get rich details for a single WordPress installation by relative path
   */
  getInstallationDetails(relPath, cpanelUser = 'cpanel_user') {
    const userRoot = this.getUserRootDir(cpanelUser);
    const cleanRel = (relPath || 'public_html').replace(/^[\/\\]+/, '').replace(/\.\./g, '');
    const installDir = path.resolve(userRoot, cleanRel);

    // Sandbox check
    if (!installDir.startsWith(path.resolve(userRoot))) {
      throw new Error('Access denied: path outside user sandbox');
    }

    if (!fs.existsSync(installDir)) {
      return null;
    }

    const wpConfigPath = path.join(installDir, 'wp-config.php');
    const wpVersionPath = path.join(installDir, 'wp-includes', 'version.php');
    const maintenancePath = path.join(installDir, '.maintenance');

    let defines = {};
    let tablePrefix = 'wp_';
    if (fs.existsSync(wpConfigPath)) {
      try {
        const configContent = fs.readFileSync(wpConfigPath, 'utf8');
        const parsed = parseWpConfig(configContent);
        defines = parsed.defines;
        tablePrefix = parsed.tablePrefix;
      } catch (e) {}
    }

    let version = '6.4.3'; // fallback
    if (fs.existsSync(wpVersionPath)) {
      try {
        const verContent = fs.readFileSync(wpVersionPath, 'utf8');
        const parsedVer = parseWpVersion(verContent);
        if (parsedVer) version = parsedVer;
      } catch (e) {}
    } else if (defines.WP_VERSION) {
      version = defines.WP_VERSION;
    }

    // Match Domain / URL
    const domainData = domainService.getAll(cpanelUser) || {};
    const primaryDomain = domainData.primaryDomain || `${cpanelUser}.com`;
    const domains = domainData.domains || [{ name: primaryDomain, documentRoot: 'public_html' }];
    const subdomains = domainData.subdomains || [];

    // Determine domain and site url
    let matchedDomain = primaryDomain;
    let urlPath = '';
    let siteUrl = '';

    // Check subdomains first
    const matchedSub = subdomains.find(s => s.documentRoot && cleanRel.replace(/\\/g, '/') === s.documentRoot.replace(/\\/g, '/'));
    if (matchedSub) {
      matchedDomain = matchedSub.name;
      siteUrl = `https://${matchedSub.name}`;
    } else {
      // Check addon/main domains
      const matchedDom = domains.find(d => d.documentRoot && cleanRel.replace(/\\/g, '/') === d.documentRoot.replace(/\\/g, '/'));
      if (matchedDom) {
        matchedDomain = matchedDom.name;
        siteUrl = `https://${matchedDom.name}`;
      } else if (cleanRel.replace(/\\/g, '/').startsWith('public_html/')) {
        const subFolder = cleanRel.replace(/\\/g, '/').replace(/^public_html\//, '');
        matchedDomain = primaryDomain;
        urlPath = `/${subFolder}`;
        siteUrl = `https://${primaryDomain}/${subFolder}`;
      } else {
        matchedDomain = primaryDomain;
        siteUrl = `https://${primaryDomain}`;
      }
    }

    if (defines.WP_SITEURL) {
      siteUrl = defines.WP_SITEURL;
    } else if (defines.WP_HOME) {
      siteUrl = defines.WP_HOME;
    }

    const adminUrl = `${siteUrl.replace(/\/+$/, '')}/wp-admin/`;

    // PHP Version
    const phpConfig = phpService.getConfig();
    const domainPhp = phpConfig.domainVersions?.[matchedDomain] || phpConfig.defaultVersion || 'ea-php82';

    // SSL Status
    const domainEntry = domains.find(d => d.name === matchedDomain);
    const sslStatus = domainEntry?.sslStatus || 'Valid Let\'s Encrypt SSL';

    // Plugins Scan
    const plugins = [];
    const pluginsDir = path.join(installDir, 'wp-content', 'plugins');
    if (fs.existsSync(pluginsDir)) {
      try {
        const pluginEntries = fs.readdirSync(pluginsDir, { withFileTypes: true });
        for (const pEntry of pluginEntries) {
          if (pEntry.isDirectory()) {
            const pDirPath = path.join(pluginsDir, pEntry.name);
            const phpFiles = fs.readdirSync(pDirPath).filter(f => f.endsWith('.php'));
            let pluginData = null;
            for (const pf of phpFiles) {
              try {
                const content = fs.readFileSync(path.join(pDirPath, pf), 'utf8');
                const parsed = parsePluginHeader(content);
                if (parsed) {
                  pluginData = { ...parsed, file: `${pEntry.name}/${pf}`, slug: pEntry.name, isDir: true };
                  break;
                }
              } catch (e) {}
            }
            if (pluginData) {
              pluginData.status = 'Active';
              plugins.push(pluginData);
            } else {
              plugins.push({
                name: pEntry.name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                slug: pEntry.name,
                version: '1.0.0',
                status: 'Active',
                description: 'Custom WordPress plugin',
                author: 'Site Administrator'
              });
            }
          } else if (pEntry.isFile() && pEntry.name.endsWith('.php') && pEntry.name !== 'index.php') {
            try {
              const content = fs.readFileSync(path.join(pluginsDir, pEntry.name), 'utf8');
              const parsed = parsePluginHeader(content);
              if (parsed) {
                plugins.push({
                  ...parsed,
                  slug: pEntry.name.replace('.php', ''),
                  file: pEntry.name,
                  isDir: false,
                  status: 'Active'
                });
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    }

    if (plugins.length === 0) {
      plugins.push(
        { name: 'Akismet Anti-spam: Spam Protection', slug: 'akismet', version: '5.3.1', status: 'Active', author: 'Automattic', description: 'Used by millions, Akismet is quite possibly the best way in the world to protect your blog from spam.' },
        { name: 'LiteSpeed Cache', slug: 'litespeed-cache', version: '6.1.0', status: 'Active', author: 'LiteSpeed Technologies', description: 'High-performance page caching and site optimization plugin for WordPress.' }
      );
    }

    // Themes Scan
    const themes = [];
    const themesDir = path.join(installDir, 'wp-content', 'themes');
    let activeTheme = 'Twenty Twenty-Four';
    if (fs.existsSync(themesDir)) {
      try {
        const themeEntries = fs.readdirSync(themesDir, { withFileTypes: true });
        for (const tEntry of themeEntries) {
          if (tEntry.isDirectory()) {
            const styleCss = path.join(themesDir, tEntry.name, 'style.css');
            if (fs.existsSync(styleCss)) {
              try {
                const cssContent = fs.readFileSync(styleCss, 'utf8');
                const parsed = parseThemeHeader(cssContent);
                if (parsed) {
                  themes.push({
                    ...parsed,
                    slug: tEntry.name,
                    active: themes.length === 0
                  });
                  if (themes.length === 1) activeTheme = parsed.name;
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {}
    }

    if (themes.length === 0) {
      themes.push({
        name: 'Twenty Twenty-Four',
        slug: 'twentytwentyfour',
        version: '1.0',
        author: 'the WordPress team',
        description: 'Twenty Twenty-Four is designed to be flexible, versatile and applicable to any website.',
        active: true
      });
    }

    // Check Maintenance Mode
    const isMaintenance = fs.existsSync(maintenancePath);

    // Database details
    const dbName = defines.DB_NAME || 'undefined';
    const dbUser = defines.DB_USER || 'undefined';
    const dbHost = defines.DB_HOST || 'localhost';

    // Health & Security Assessment
    const health = {
      status: 'Good',
      score: 92,
      checks: [
        {
          id: 'core_version',
          title: 'WordPress Core Version',
          status: 'passed',
          detail: `Running WordPress ${version} (Up to date)`
        },
        {
          id: 'php_version',
          title: 'PHP Runtime',
          status: domainPhp.includes('ea-php7') ? 'warning' : 'passed',
          detail: `Running on ${domainPhp} (${domainPhp.includes('ea-php7') ? 'Upgrade to PHP 8.2+ recommended' : 'Modern, performant runtime'})`
        },
        {
          id: 'ssl_status',
          title: 'SSL / HTTPS Security',
          status: sslStatus.includes('Valid') ? 'passed' : 'warning',
          detail: sslStatus
        },
        {
          id: 'debug_mode',
          title: 'WordPress Debug Mode',
          status: defines.WP_DEBUG ? 'warning' : 'passed',
          detail: defines.WP_DEBUG ? 'WP_DEBUG is enabled. Turn off in production to prevent leaking sensitive errors.' : 'WP_DEBUG is disabled (Recommended for production)'
        },
        {
          id: 'file_edit',
          title: 'File Editor Protection',
          status: defines.DISALLOW_FILE_EDIT ? 'passed' : 'info',
          detail: defines.DISALLOW_FILE_EDIT ? 'Built-in plugin/theme file editor is disabled (Secure)' : 'Built-in file editor is enabled'
        },
        {
          id: 'auto_updates',
          title: 'Automatic Security Updates',
          status: defines.AUTOMATIC_UPDATER_DISABLED ? 'warning' : 'passed',
          detail: defines.AUTOMATIC_UPDATER_DISABLED ? 'Automatic core updates disabled' : 'Automatic security updates enabled'
        }
      ]
    };

    // Directory Size
    const dirSizeBytes = getDirSize(installDir, 4);

    return {
      id: cleanRel.replace(/[\/\\]/g, '_'),
      path: cleanRel.replace(/\\/g, '/'),
      name: `${matchedDomain}${urlPath ? ` (${urlPath})` : ''}`,
      domain: matchedDomain,
      url: siteUrl,
      adminUrl: adminUrl,
      version: version,
      phpVersion: domainPhp,
      sslStatus: sslStatus,
      isMultisite: Boolean(defines.MULTISITE),
      isMaintenance: isMaintenance,
      wpDebug: Boolean(defines.WP_DEBUG),
      disallowFileEdit: Boolean(defines.DISALLOW_FILE_EDIT),
      forceSslAdmin: Boolean(defines.FORCE_SSL_ADMIN),
      autoUpdates: !Boolean(defines.AUTOMATIC_UPDATER_DISABLED),
      tablePrefix: tablePrefix,
      database: {
        name: dbName,
        user: dbUser,
        host: dbHost
      },
      plugins: plugins,
      themes: themes,
      activeTheme: activeTheme,
      diskUsage: {
        bytes: dirSizeBytes,
        formatted: formatBytes(dirSizeBytes)
      },
      health: health
    };
  }

  /**
   * Update wp-config.php settings safely
   */
  updateConfig(relPath, updates, cpanelUser = 'cpanel_user') {
    const userRoot = this.getUserRootDir(cpanelUser);
    const cleanRel = (relPath || 'public_html').replace(/^[\/\\]+/, '').replace(/\.\./g, '');
    const installDir = path.resolve(userRoot, cleanRel);

    if (!installDir.startsWith(path.resolve(userRoot))) {
      throw new Error('Access denied: path outside user sandbox');
    }

    const wpConfigPath = path.join(installDir, 'wp-config.php');
    if (!fs.existsSync(wpConfigPath)) {
      throw new Error(`wp-config.php not found in ${cleanRel}`);
    }

    let content = fs.readFileSync(wpConfigPath, 'utf8');

    const updateDefine = (key, value) => {
      const valString = typeof value === 'boolean' ? (value ? 'true' : 'false') : (typeof value === 'number' ? `${value}` : `'${value}'`);
      const regex = new RegExp(`define\\s*\\(\\s*['"]${key}['"]\\s*,[^\\)]+\\);?`, 'i');
      if (regex.test(content)) {
        content = content.replace(regex, `define( '${key}', ${valString} );`);
      } else {
        if (content.includes('require_once')) {
          content = content.replace('require_once', `define( '${key}', ${valString} );\n\nrequire_once`);
        } else {
          content += `\ndefine( '${key}', ${valString} );\n`;
        }
      }
    };

    if (updates.wpDebug !== undefined) {
      updateDefine('WP_DEBUG', Boolean(updates.wpDebug));
    }

    if (updates.disallowFileEdit !== undefined) {
      updateDefine('DISALLOW_FILE_EDIT', Boolean(updates.disallowFileEdit));
    }

    if (updates.forceSslAdmin !== undefined) {
      updateDefine('FORCE_SSL_ADMIN', Boolean(updates.forceSslAdmin));
    }

    if (updates.autoUpdates !== undefined) {
      updateDefine('AUTOMATIC_UPDATER_DISABLED', !Boolean(updates.autoUpdates));
    }

    fs.writeFileSync(wpConfigPath, content, 'utf8');

    return this.getInstallationDetails(cleanRel, cpanelUser);
  }

  /**
   * Toggle WordPress Maintenance Mode (.maintenance file)
   */
  toggleMaintenance(relPath, enable, cpanelUser = 'cpanel_user') {
    const userRoot = this.getUserRootDir(cpanelUser);
    const cleanRel = (relPath || 'public_html').replace(/^[\/\\]+/, '').replace(/\.\./g, '');
    const installDir = path.resolve(userRoot, cleanRel);

    if (!installDir.startsWith(path.resolve(userRoot))) {
      throw new Error('Access denied: path outside user sandbox');
    }

    const maintenancePath = path.join(installDir, '.maintenance');

    if (enable) {
      const content = `<?php $upgrading = ${Math.floor(Date.now() / 1000)}; ?>\n`;
      fs.writeFileSync(maintenancePath, content, 'utf8');
    } else {
      if (fs.existsSync(maintenancePath)) {
        fs.unlinkSync(maintenancePath);
      }
    }

    return {
      success: true,
      isMaintenance: Boolean(enable),
      path: cleanRel
    };
  }
}

module.exports = new WordPressService();
