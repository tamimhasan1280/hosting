const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_DIR = path.resolve(__dirname, '../../data/store');
const LEGACY_USERS_FILE = path.resolve(__dirname, '../../data/users.json');
const LEGACY_WHM_FILE = path.resolve(__dirname, '../../data/whm_accounts.json');

/**
 * TAMIM HOSTING Central Database Architecture
 * Manages scalable JSON-store relational data tables with atomic writes,
 * validation, auto-generated IDs, and data integrity guarantees.
 */
class DatabaseManager {
  constructor() {
    this.storeDir = STORE_DIR;
    this._ensureStore();
  }

  _ensureStore() {
    if (!fs.existsSync(this.storeDir)) {
      fs.mkdirSync(this.storeDir, { recursive: true });
    }

    // Initialize all normalized tables with defaults/seeds if not present
    this._initTable('users', () => this._seedUsers());
    this._initTable('user_profiles', () => this._seedUserProfiles());
    this._initTable('billing_addresses', () => []);
    this._initTable('hosting_packages', () => this._seedPackages());
    this._initTable('services', () => this._seedServices());
    this._initTable('domains', () => this._seedDomains());
    this._initTable('orders', () => []);
    this._initTable('order_items', () => []);
    this._initTable('invoices', () => []);
    this._initTable('invoice_items', () => []);
    this._initTable('payments', () => []);
    this._initTable('payment_methods', () => this._seedPaymentMethods());
    this._initTable('subscriptions', () => []);
    this._initTable('promotions', () => this._seedPromotions());
    this._initTable('coupons', () => this._seedCoupons());
    this._initTable('coupon_usage', () => []);
    this._initTable('hosting_credentials', () => this._seedHostingCredentials());
    this._initTable('email_accounts', () => this._seedEmailAccounts());
    this._initTable('databases', () => this._seedDatabases());
    this._initTable('database_users', () => this._seedDatabaseUsers());
    this._initTable('ftp_accounts', () => this._seedFtpAccounts());
    this._initTable('cron_jobs', () => this._seedCronJobs());
    this._initTable('dns_records', () => this._seedDnsRecords());
    this._initTable('backups', () => []);
    this._initTable('ssl_certificates', () => this._seedSslCertificates());
    this._initTable('ip_blocks', () => []);
    this._initTable('settings', () => this._seedSettings());
    this._initTable('activity_logs', () => []);
    this._initTable('admin_logs', () => []);
    this._initTable('audit_logs', () => []);
  }

  _getTablePath(table) {
    return path.join(this.storeDir, `${table}.json`);
  }

  _initTable(table, seedFn) {
    const filePath = this._getTablePath(table);
    if (!fs.existsSync(filePath)) {
      const initialData = typeof seedFn === 'function' ? seedFn() : [];
      this._writeTable(table, initialData);
    }
  }

  _readTable(table) {
    const filePath = this._getTablePath(table);
    if (!fs.existsSync(filePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`[DB Error] Reading table ${table}:`, err.message);
      return [];
    }
  }

  _writeTable(table, data) {
    const filePath = this._getTablePath(table);
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 5)}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  }

  // --- SEED GENERATORS ---

  _seedUsers() {
    // Preserve existing users from legacy users.json
    if (fs.existsSync(LEGACY_USERS_FILE)) {
      try {
        const legacy = JSON.parse(fs.readFileSync(LEGACY_USERS_FILE, 'utf8'));
        if (Array.isArray(legacy) && legacy.length > 0) {
          return legacy.map(u => ({
            id: u.id || `usr_${crypto.randomUUID().substring(0, 8)}`,
            firstName: u.firstName || (u.role === 'admin' ? 'Tamim' : 'Hosting'),
            lastName: u.lastName || (u.role === 'admin' ? 'Admin' : 'Client'),
            phone: u.phone || '+8801700000000',
            email: u.email || `${u.username}@example.com`,
            username: u.username || u.cpanelUser,
            cpanelUser: u.cpanelUser || u.username,
            passwordHash: u.passwordHash,
            role: u.role || 'client',
            status: u.status || 'active',
            createdAt: u.created || new Date().toISOString()
          }));
        }
      } catch (e) {}
    }

    return [
      {
        id: 'usr_tamim',
        firstName: 'Tamim',
        lastName: 'Admin',
        phone: '+8801700000000',
        email: 'tamimhasan1281@gmail.com',
        username: 'tamimhasan1281@gmail.com',
        cpanelUser: 'tamimhasan1281',
        passwordHash: '$2b$10$NHv0KG2LgpE9IJWq86.goO5x93RWM9bn/SKbTl5jmX6am46M87mGy',
        role: 'admin',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr_default',
        firstName: 'Default',
        lastName: 'User',
        phone: '+8801800000000',
        email: 'admin@example.com',
        username: 'cpanel_user',
        cpanelUser: 'cpanel_user',
        passwordHash: '$2b$10$YUdkB1GSphL7TCZRmo6gcu5GSRVuxyZJnxJPGe7/O2KyWpd.J.TLG',
        role: 'admin',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ];
  }

  _seedPackages() {
    return [
      {
        id: 'pkg_5gb',
        name: 'Starter Cloud (5 GB)',
        diskSpaceGb: 5,
        diskLimitMb: 5120,
        bandwidthGb: 50,
        bandwidthLimitMb: 51200,
        monthlyPrice: 2.99,
        yearlyPrice: 29.99,
        domainLimit: 1,
        databaseLimit: 2,
        emailLimit: 5,
        ftpLimit: 2,
        cronLimit: 5,
        features: ['5 GB NVMe SSD', '50 GB Bandwidth', '1 Website Domain', 'Free SSL / TLS', 'cPanel Access', '24/7 Support'],
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'pkg_10gb',
        name: 'Pro Cloud (10 GB)',
        diskSpaceGb: 10,
        diskLimitMb: 10240,
        bandwidthGb: 100,
        bandwidthLimitMb: 102400,
        monthlyPrice: 5.99,
        yearlyPrice: 59.99,
        domainLimit: 3,
        databaseLimit: 10,
        emailLimit: 25,
        ftpLimit: 10,
        cronLimit: 20,
        features: ['10 GB NVMe SSD', '100 GB Bandwidth', '3 Websites / Addon Domains', 'Free SSL / TLS', 'Full cPanel Control', 'Daily Automated Backups'],
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'pkg_15gb',
        name: 'Business Cloud (15 GB)',
        diskSpaceGb: 15,
        diskLimitMb: 15360,
        bandwidthGb: 200,
        bandwidthLimitMb: 204800,
        monthlyPrice: 8.99,
        yearlyPrice: 89.99,
        domainLimit: 10,
        databaseLimit: 50,
        emailLimit: 100,
        ftpLimit: 25,
        cronLimit: 50,
        features: ['15 GB NVMe SSD', '200 GB Bandwidth', '10 Addon Domains', 'Free SSL & Dedicated IP Support', 'LiteSpeed Accelerated', 'Priority Support'],
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'pkg_20gb',
        name: 'Enterprise Cloud (20 GB)',
        diskSpaceGb: 20,
        diskLimitMb: 20480,
        bandwidthGb: 500,
        bandwidthLimitMb: 512000,
        monthlyPrice: 11.99,
        yearlyPrice: 119.99,
        domainLimit: 25,
        databaseLimit: 100,
        emailLimit: 500,
        ftpLimit: 50,
        cronLimit: 100,
        features: ['20 GB NVMe SSD', '500 GB Bandwidth', 'Unlimited Domains Support', 'Wildcard SSL Included', 'Real-time Malware Protection', 'Dedicated Account Manager'],
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ];
  }

  _seedServices() {
    // Sync with existing whm_accounts.json if present
    const services = [];
    if (fs.existsSync(LEGACY_WHM_FILE)) {
      try {
        const whm = JSON.parse(fs.readFileSync(LEGACY_WHM_FILE, 'utf8'));
        if (Array.isArray(whm)) {
          whm.forEach((acct, idx) => {
            services.push({
              id: `srv_${acct.user || idx + 1}`,
              user: acct.user,
              domain: acct.domain,
              packageId: 'pkg_10gb',
              planName: acct.plan || 'Standard Shared Hosting',
              status: acct.suspended ? 'suspended' : 'active',
              suspendReason: acct.suspendreason || '',
              ipAddress: acct.ip || '192.0.2.1',
              diskUsedMb: parseInt(acct.diskused) || 14,
              diskLimitMb: parseInt(acct.disklimit) || 10240,
              bandwidthUsedMb: 412,
              bandwidthLimitMb: 50000,
              billingCycle: 'yearly',
              startDate: acct.startdate || new Date().toISOString(),
              expiryDate: '2026-10-17T00:00:00.000Z',
              createdAt: acct.startdate || new Date().toISOString()
            });
          });
        }
      } catch (e) {}
    }

    if (services.length === 0) {
      services.push({
        id: 'srv_tamimhasan1281',
        user: 'tamimhasan1281',
        domain: 'example.com',
        packageId: 'pkg_20gb',
        planName: 'Enterprise Cloud (20 GB)',
        status: 'active',
        suspendReason: '',
        ipAddress: '192.0.2.1',
        diskUsedMb: 14,
        diskLimitMb: 20480,
        bandwidthUsedMb: 412,
        bandwidthLimitMb: 512000,
        billingCycle: 'yearly',
        startDate: new Date().toISOString(),
        expiryDate: '2026-10-17T00:00:00.000Z',
        createdAt: new Date().toISOString()
      });
    }

    return services;
  }

  _seedDomains() {
    return [
      {
        id: 'dom_example',
        domain: 'example.com',
        user: 'tamimhasan1281',
        serviceId: 'srv_tamimhasan1281',
        type: 'primary',
        documentRoot: '/public_html',
        sslStatus: 'active',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ];
  }

  _seedPaymentMethods() {
    return [
      {
        id: 'pay_bkash',
        name: 'bKash / Nagad / Rocket (Mobile Banking)',
        type: 'mobile',
        instructions: 'Send money to Personal/Merchant Number: 01700000000. Enter Transaction ID (TrxID) below.',
        accountNumber: '01700000000',
        feePercent: 0,
        isActive: true,
        sortOrder: 1
      },
      {
        id: 'pay_bank',
        name: 'Bank Wire Transfer',
        type: 'bank',
        instructions: 'Bank: City Bank / Islami Bank. Account: 123456789. Routing: 987654321.',
        accountNumber: '123456789',
        feePercent: 0,
        isActive: true,
        sortOrder: 2
      },
      {
        id: 'pay_manual',
        name: 'Manual / Cash Payment',
        type: 'manual',
        instructions: 'Submit your order and notify admin for physical cash or direct transfer verification.',
        accountNumber: '',
        feePercent: 0,
        isActive: true,
        sortOrder: 3
      },
      {
        id: 'pay_card',
        name: 'Credit / Debit Card (Online Gateway)',
        type: 'gateway',
        instructions: 'Instant automatic payment processing via Visa, Mastercard, AMEX.',
        accountNumber: '',
        feePercent: 2.5,
        isActive: false, // Can be activated by admin
        sortOrder: 4
      }
    ];
  }

  _seedPromotions() {
    return [
      {
        id: 'promo_welcome10',
        code: 'WELCOME10',
        discountType: 'percentage',
        value: 10,
        usageLimit: 100,
        usedCount: 0,
        expiryDate: '2026-12-31T23:59:59.000Z',
        isActive: true,
        description: '10% discount for all new hosting orders'
      },
      {
        id: 'promo_tamim50',
        code: 'TAMIM50',
        discountType: 'percentage',
        value: 50,
        usageLimit: 20,
        usedCount: 1,
        expiryDate: '2026-12-31T23:59:59.000Z',
        isActive: true,
        description: 'Exclusive 50% VIP discount on yearly hosting packages'
      }
    ];
  }

  _seedSettings() {
    return {
      siteName: 'TAMIM HOSTING',
      tagline: 'High Performance cPanel Cloud Hosting',
      currency: 'USD',
      currencySymbol: '$',
      bdtRate: 120, // 1 USD = 120 BDT
      contactEmail: 'admin@tamimhosting.com',
      supportPhone: '+8801700000000',
      nameservers: ['ns1.tamimhosting.com', 'ns2.tamimhosting.com'],
      autoProvisionOnPayment: true,
      maintenanceMode: false
    };
  }

  _seedUserProfiles() {
    return [
      {
        id: 'uprof_admin',
        userId: 'usr_tamim',
        companyName: 'Tamim Hosting Inc.',
        taxId: 'TX-ADMIN-001',
        timezone: 'Asia/Dhaka',
        language: 'en',
        twoFactorEnabled: false,
        avatarUrl: '',
        createdAt: new Date().toISOString()
      },
      {
        id: 'uprof_default',
        userId: 'usr_default',
        companyName: 'Default Client Ltd.',
        taxId: '',
        timezone: 'Asia/Dhaka',
        language: 'en',
        twoFactorEnabled: false,
        avatarUrl: '',
        createdAt: new Date().toISOString()
      }
    ];
  }

  _seedCoupons() {
    return [
      {
        id: 'cpn_welcome20',
        code: 'WELCOME20',
        discountType: 'percentage',
        discountValue: 20,
        maxUses: 100,
        usedCount: 0,
        expiryDate: '2026-12-31T23:59:59.000Z',
        isActive: true,
        description: '20% off your initial hosting order',
        createdAt: new Date().toISOString()
      },
      {
        id: 'cpn_vip50',
        code: 'VIP50',
        discountType: 'percentage',
        discountValue: 50,
        maxUses: 25,
        usedCount: 1,
        expiryDate: '2026-12-31T23:59:59.000Z',
        isActive: true,
        description: 'VIP 50% discount for enterprise yearly hosting',
        createdAt: new Date().toISOString()
      }
    ];
  }

  _seedHostingCredentials() {
    return [
      {
        id: 'hcred_tamimhasan1281',
        serviceId: 'srv_tamimhasan1281',
        userId: 'usr_tamim',
        cpanelUser: 'tamimhasan1281',
        serverIp: '192.0.2.1',
        hostname: 'cpanel.tamimhosting.com',
        port: 2083,
        status: 'active',
        lastPasswordChange: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }
    ];
  }

  _seedEmailAccounts() {
    return [
      {
        id: 'eml_admin_example',
        userId: 'usr_tamim',
        serviceId: 'srv_tamimhasan1281',
        email: 'admin@example.com',
        username: 'admin',
        domain: 'example.com',
        quotaMb: 1024,
        usedMb: 14.2,
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'eml_support_example',
        userId: 'usr_tamim',
        serviceId: 'srv_tamimhasan1281',
        email: 'support@example.com',
        username: 'support',
        domain: 'example.com',
        quotaMb: 2048,
        usedMb: 2.5,
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ];
  }

  _seedDatabases() {
    return [
      {
        id: 'db_main_app',
        userId: 'usr_tamim',
        serviceId: 'srv_tamimhasan1281',
        dbName: 'cpanel_mainapp',
        collation: 'utf8mb4_unicode_ci',
        sizeMb: 5.4,
        createdAt: new Date().toISOString()
      }
    ];
  }

  _seedDatabaseUsers() {
    return [
      {
        id: 'dbu_main_user',
        userId: 'usr_tamim',
        serviceId: 'srv_tamimhasan1281',
        dbUser: 'cpanel_dbuser',
        dbName: 'cpanel_mainapp',
        privileges: ['ALL PRIVILEGES'],
        createdAt: new Date().toISOString()
      }
    ];
  }

  _seedFtpAccounts() {
    return [
      {
        id: 'ftp_deploy',
        userId: 'usr_tamim',
        serviceId: 'srv_tamimhasan1281',
        username: 'deploy@example.com',
        directory: '/home/tamimhasan1281/public_html',
        quotaMb: 5120,
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ];
  }

  _seedCronJobs() {
    return [
      {
        id: 'cron_ssl_renew',
        userId: 'usr_tamim',
        serviceId: 'srv_tamimhasan1281',
        schedule: '0 0 * * *',
        minute: '0',
        hour: '0',
        day: '*',
        month: '*',
        weekday: '*',
        command: '/usr/local/bin/autossl --check',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ];
  }

  _seedDnsRecords() {
    return [
      {
        id: 'dns_a_root',
        userId: 'usr_tamim',
        domain: 'example.com',
        name: 'example.com.',
        type: 'A',
        ttl: 14400,
        record: '192.0.2.1',
        priority: null,
        createdAt: new Date().toISOString()
      },
      {
        id: 'dns_cname_www',
        userId: 'usr_tamim',
        domain: 'example.com',
        name: 'www.example.com.',
        type: 'CNAME',
        ttl: 14400,
        record: 'example.com.',
        priority: null,
        createdAt: new Date().toISOString()
      },
      {
        id: 'dns_mx_mail',
        userId: 'usr_tamim',
        domain: 'example.com',
        name: 'example.com.',
        type: 'MX',
        ttl: 14400,
        record: 'mail.example.com.',
        priority: 10,
        createdAt: new Date().toISOString()
      }
    ];
  }

  _seedSslCertificates() {
    return [
      {
        id: 'ssl_example_cert',
        userId: 'usr_tamim',
        domain: 'example.com',
        issuer: "Let's Encrypt / cPanel AutoSSL",
        validFrom: '2026-01-01T00:00:00.000Z',
        validTo: '2026-12-31T23:59:59.000Z',
        status: 'active',
        autoRenew: true,
        createdAt: new Date().toISOString()
      }
    ];
  }

  // --- CRUD METHODS ---

  getAll(table, filter = null) {
    const data = this._readTable(table);
    if (!filter) return data;
    if (typeof filter === 'function') {
      return data.filter(filter);
    }
    return data.filter(item => {
      return Object.entries(filter).every(([key, val]) => item[key] === val);
    });
  }

  getById(table, id) {
    const data = this._readTable(table);
    return data.find(item => item.id === id) || null;
  }

  find(table, filter) {
    return this.findOne(table, filter);
  }

  findOne(table, filter) {
    const data = this._readTable(table);
    if (typeof filter === 'function') {
      return data.find(filter) || null;
    }
    return data.find(item => {
      return Object.entries(filter).every(([key, val]) => item[key] === val);
    }) || null;
  }

  insert(table, item) {
    const data = this._readTable(table);
    const newItem = {
      id: item.id || `${table.substring(0, 3)}_${crypto.randomUUID().substring(0, 8)}`,
      ...item,
      createdAt: item.createdAt || new Date().toISOString()
    };
    data.push(newItem);
    this._writeTable(table, data);
    return newItem;
  }

  update(table, id, updates) {
    const data = this._readTable(table);
    const index = data.findIndex(item => item.id === id);
    if (index === -1) return null;

    data[index] = {
      ...data[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this._writeTable(table, data);
    return data[index];
  }

  delete(table, id) {
    const data = this._readTable(table);
    const filtered = data.filter(item => item.id !== id);
    if (filtered.length === data.length) return false;
    this._writeTable(table, filtered);
    return true;
  }

  logAudit(userId, action, ipAddress, details = {}) {
    return this.insert('audit_logs', {
      userId: userId || 'anonymous',
      action,
      ipAddress: ipAddress || '127.0.0.1',
      details,
      timestamp: new Date().toISOString()
    });
  }

  logActivity(userId, type, action, ipAddress, metadata = {}) {
    return this.insert('activity_logs', {
      userId: userId || 'anonymous',
      type: type || 'info',
      action,
      ipAddress: ipAddress || '127.0.0.1',
      metadata,
      timestamp: new Date().toISOString()
    });
  }

  logAdminAction(adminId, action, targetType, targetId, ipAddress, details = {}) {
    return this.insert('admin_logs', {
      adminId: adminId || 'admin',
      action,
      targetType: targetType || 'system',
      targetId: targetId || null,
      ipAddress: ipAddress || '127.0.0.1',
      details,
      timestamp: new Date().toISOString()
    });
  }

  // --- RELATIONAL HELPERS ---

  getUserWithProfile(userId) {
    const user = this.getById('users', userId);
    if (!user) return null;
    const profile = this.findOne('user_profiles', { userId }) || {};
    const billing = this.findOne('billing_addresses', { userId }) || {};
    return {
      ...user,
      profile,
      billingAddress: billing
    };
  }

  getUserBillingAddress(userId) {
    return this.findOne('billing_addresses', { userId });
  }

  getServiceCredentials(serviceId) {
    return this.findOne('hosting_credentials', { serviceId });
  }

  getStatus() {
    const tables = [
      'users', 'user_profiles', 'billing_addresses',
      'hosting_packages', 'services', 'domains',
      'orders', 'order_items', 'invoices', 'invoice_items',
      'payments', 'payment_methods', 'coupons', 'coupon_usage',
      'hosting_credentials', 'email_accounts', 'databases', 'database_users',
      'ftp_accounts', 'cron_jobs', 'dns_records', 'backups',
      'ssl_certificates', 'ip_blocks', 'settings', 'activity_logs',
      'admin_logs', 'audit_logs', 'subscriptions'
    ];

    const counts = {};
    for (const t of tables) {
      try {
        counts[t] = this.getAll(t).length;
      } catch (e) {
        counts[t] = 0;
      }
    }

    return {
      status: 'healthy',
      engine: 'Tamim Hosting Normalized Relational Store (JSON/Atomic)',
      storePath: this.storeDir,
      totalTables: tables.length,
      tables: counts,
      timestamp: new Date().toISOString()
    };
  }

  getSettings() {
    const filePath = this._getTablePath('settings');
    if (!fs.existsSync(filePath)) {
      return {
        siteName: 'TAMIM HOSTING',
        tagline: 'High Performance cPanel Cloud Hosting',
        currency: 'USD',
        currencySymbol: '$',
        bdtRate: 120,
        contactEmail: 'admin@tamimhosting.com',
        supportPhone: '+8801700000000',
        nameservers: ['ns1.tamimhosting.com', 'ns2.tamimhosting.com'],
        autoProvisionOnPayment: true,
        maintenanceMode: false,
        maxUploadSizeMb: 2048
      };
    }
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!data.maxUploadSizeMb) {
        data.maxUploadSizeMb = 2048;
      }
      return data;
    } catch (e) {
      return { maxUploadSizeMb: 2048 };
    }
  }

  updateSettings(updates) {
    const current = this.getSettings();
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this._writeTable('settings', updated);
    return updated;
  }
}

const db = new DatabaseManager();
module.exports = db;
