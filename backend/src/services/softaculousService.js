const fs = require('fs');
const path = require('path');
const storageService = require('./storageService');
const databaseService = require('./databaseService');

const APPS_FILE = path.resolve(__dirname, '../../data/installed_apps.json');

function ensureAppsStore() {
  if (!fs.existsSync(APPS_FILE)) {
    fs.writeFileSync(APPS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

class SoftaculousService {
  constructor() {
    ensureAppsStore();
  }

  _read() {
    ensureAppsStore();
    return JSON.parse(fs.readFileSync(APPS_FILE, 'utf8'));
  }

  _write(data) {
    fs.writeFileSync(APPS_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  getInstalledApps() {
    return this._read();
  }

  getAvailableScripts() {
    return [
      {
        id: 'wordpress',
        name: 'WordPress',
        category: 'Blogs / CMS',
        version: '6.5.3',
        icon: 'Wp',
        description: 'WordPress is web software you can use to create a beautiful website, blog, or app.',
        rating: 4.8,
        reviews: 2450
      },
      {
        id: 'joomla',
        name: 'Joomla',
        category: 'CMS',
        version: '5.1.0',
        icon: 'Globe',
        description: 'Joomla is an award-winning content management system (CMS).',
        rating: 4.3,
        reviews: 820
      },
      {
        id: 'laravel',
        name: 'Laravel',
        category: 'PHP Framework',
        version: '11.0',
        icon: 'Code',
        description: 'The PHP Framework for Web Artisans with expressive, elegant syntax.',
        rating: 4.9,
        reviews: 1840
      },
      {
        id: 'opencart',
        name: 'OpenCart',
        category: 'E-Commerce',
        version: '4.0.2',
        icon: 'ShoppingCart',
        description: 'A free open-source e-commerce platform for online merchants.',
        rating: 4.5,
        reviews: 910
      }
    ];
  }

  async installApp(options) {
    const {
      scriptId = 'wordpress',
      siteName = 'My WordPress Site',
      adminUser = 'admin',
      adminEmail = 'admin@example.com',
      installDir = 'blog' // Relative to public_html
    } = options;

    const targetRelPath = path.join('public_html', installDir).replace(/\\/g, '/');
    const targetDir = path.join(storageService.getRootDir(), targetRelPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Auto create database for the app
    const cleanDbName = `${scriptId}_${Date.now().toString().slice(-4)}`;
    let dbName = 'cp_default';
    try {
      const createdDb = databaseService.createDatabase(cleanDbName);
      dbName = createdDb.name;
    } catch (e) {
      // ignore if exists
    }

    if (scriptId === 'wordpress') {
      // Create wp-config.php and index.php
      const wpConfig = `<?php
/** WordPress Database Settings */
define( 'DB_NAME', '${dbName}' );
define( 'DB_USER', 'cpanel_admin' );
define( 'DB_PASSWORD', 'SecurePass123!' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

$table_prefix = 'wp_';
define( 'WP_DEBUG', false );

if ( ! defined( 'ABSPATH' ) ) {
  define( 'ABSPATH', __DIR__ . '/' );
}
require_once ABSPATH . 'wp-settings.php';
`;
      fs.writeFileSync(path.join(targetDir, 'wp-config.php'), wpConfig, 'utf8');

      const wpIndex = `<?php
/**
 * Front to the WordPress application.
 */
define( 'WP_USE_THEMES', true );
echo "<!DOCTYPE html><html><head><title>${siteName}</title><style>body{font-family:sans-serif;margin:40px;text-align:center;background:#f0f0f1;} .box{background:#fff;padding:40px;border-radius:8px;max-width:600px;margin:0 auto;box-shadow:0 2px 10px rgba(0,0,0,0.1);}</style></head><body><div class='box'><h1 style='color:#0073aa;'>${siteName}</h1><p>Congratulations! WordPress was successfully installed by cPanel Softaculous.</p><p><strong>Database:</strong> ${dbName}<br><strong>Admin User:</strong> ${adminUser}</p><p><a href='#' style='display:inline-block;padding:10px 20px;background:#0073aa;color:#fff;text-decoration:none;border-radius:4px;'>Log in to WP-Admin</a></p></div></body></html>";
`;
      fs.writeFileSync(path.join(targetDir, 'index.php'), wpIndex, 'utf8');

      // Add .htaccess for React / WP URL rewriting
      const htaccess = `# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /${installDir ? installDir + '/' : ''}
RewriteRule ^index\\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /${installDir ? installDir + '/' : ''}index.php [L]
</IfModule>
# END WordPress
`;
      fs.writeFileSync(path.join(targetDir, '.htaccess'), htaccess, 'utf8');
    }

    const newInstall = {
      id: String(Date.now()),
      script: scriptId,
      name: siteName,
      url: `http://example.com/${installDir}`,
      adminUrl: `http://example.com/${installDir}/wp-admin`,
      path: targetRelPath,
      database: dbName,
      adminUser,
      adminEmail,
      installedAt: new Date().toISOString(),
      version: '6.5.3'
    };

    const data = this._read();
    data.push(newInstall);
    this._write(data);

    return newInstall;
  }

  deleteInstalledApp(id) {
    const data = this._read();
    const app = data.find(a => a.id === id);
    if (!app) throw new Error('App not found');

    // Remove directory
    try {
      const fullPath = path.join(storageService.getRootDir(), app.path);
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    } catch (e) {
      console.error('Error removing app dir:', e);
    }

    // Remove DB if created
    if (app.database) {
      try {
        databaseService.deleteDatabase(app.database);
      } catch (e) {}
    }

    const filtered = data.filter(a => a.id !== id);
    this._write(filtered);
    return { success: true, id };
  }
}

module.exports = new SoftaculousService();
