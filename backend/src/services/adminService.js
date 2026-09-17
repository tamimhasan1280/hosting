const db = require('./db');
const fs = require('fs');
const path = require('path');
const os = require('os');

const USERS_FILE = path.resolve(__dirname, '../../data/users.json');

let prevCpuTimes = null;

class AdminService {
  getHardwareMetrics() {
    const cpus = os.cpus() || [];
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = totalMemBytes - freeMemBytes;
    const memUsagePercent = Math.max(1, Math.min(100, Math.round((usedMemBytes / totalMemBytes) * 100)));

    const perCore = [];
    let totalUsageSum = 0;

    if (prevCpuTimes && prevCpuTimes.length === cpus.length) {
      for (let i = 0; i < cpus.length; i++) {
        const prev = prevCpuTimes[i];
        const curr = cpus[i].times;

        const pTotal = prev.user + prev.nice + prev.sys + prev.idle + (prev.irq || 0);
        const cTotal = curr.user + curr.nice + curr.sys + curr.idle + (curr.irq || 0);

        const diffTotal = cTotal - pTotal;
        const diffIdle = curr.idle - prev.idle;

        let corePercent = 0;
        if (diffTotal > 0) {
          corePercent = Math.max(0, Math.min(100, Math.round(((diffTotal - diffIdle) / diffTotal) * 100)));
        }
        perCore.push({
          core: i + 1,
          model: cpus[i].model ? cpus[i].model.trim() : `Core #${i + 1}`,
          speedMhz: cpus[i].speed,
          speedGhz: (cpus[i].speed / 1000).toFixed(2),
          usagePercent: corePercent
        });
        totalUsageSum += corePercent;
      }
    } else {
      for (let i = 0; i < cpus.length; i++) {
        const times = cpus[i].times;
        const total = times.user + times.nice + times.sys + times.idle + (times.irq || 0);
        const nonIdle = total - times.idle;
        const percent = total > 0 ? Math.max(1, Math.min(100, Math.round((nonIdle / total) * 100))) : 5;
        perCore.push({
          core: i + 1,
          model: cpus[i].model ? cpus[i].model.trim() : `Core #${i + 1}`,
          speedMhz: cpus[i].speed,
          speedGhz: (cpus[i].speed / 1000).toFixed(2),
          usagePercent: percent
        });
        totalUsageSum += percent;
      }
    }

    prevCpuTimes = cpus.map(c => ({ ...c.times }));
    const overallCpuUsage = cpus.length > 0 ? Math.round(totalUsageSum / cpus.length) : 0;

    const uptimeSeconds = os.uptime();
    const days = Math.floor(uptimeSeconds / (3600 * 24));
    const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeFormatted = `${days}d ${hours}h ${minutes}m`;

    const loadAvg = os.loadavg ? os.loadavg().map(n => n.toFixed(2)) : ['0.10', '0.08', '0.05'];

    return {
      timestamp: Date.now(),
      hostname: os.hostname(),
      platform: os.platform(),
      osType: os.type(),
      arch: os.arch(),
      release: os.release(),
      uptimeSeconds,
      uptimeFormatted,
      loadAverage: loadAvg,
      cpu: {
        model: cpus[0]?.model ? cpus[0].model.trim() : 'Server Processor',
        coreCount: cpus.length,
        baseSpeedGhz: cpus[0]?.speed ? (cpus[0].speed / 1000).toFixed(2) : '3.00',
        overallUsagePercent: overallCpuUsage,
        cores: perCore
      },
      memory: {
        totalBytes: totalMemBytes,
        usedBytes: usedMemBytes,
        freeBytes: freeMemBytes,
        totalGb: (totalMemBytes / (1024 ** 3)).toFixed(2),
        usedGb: (usedMemBytes / (1024 ** 3)).toFixed(2),
        freeGb: (freeMemBytes / (1024 ** 3)).toFixed(2),
        usagePercent: memUsagePercent
      }
    };
  }

  getDashboardStats() {
    const users = db.getAll('users') || [];
    const orders = db.getAll('orders') || [];
    const invoices = db.getAll('invoices') || [];
    const services = db.getAll('services') || [];
    const domains = db.getAll('domains') || [];
    const packages = db.getAll('hosting_packages') || [];
    const ipBlocks = db.getAll('ip_blocks') || [];

    const activeUsers = users.filter(u => u.status === 'active').length;
    const suspendedUsers = users.filter(u => u.status === 'suspended').length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const approvedOrders = orders.filter(o => o.status === 'approved' || o.status === 'active').length;
    const rejectedOrders = orders.filter(o => o.status === 'rejected').length;

    const unpaidInvoices = invoices.filter(i => i.status === 'unpaid').length;
    const paidInvoices = invoices.filter(i => i.status === 'paid');
    const totalRevenue = paidInvoices.reduce((acc, inv) => acc + (Number(inv.totalAmount) || 0), 0);

    return {
      users: { total: users.length, active: activeUsers, suspended: suspendedUsers },
      orders: { total: orders.length, pending: pendingOrders, approved: approvedOrders, rejected: rejectedOrders },
      invoices: { total: invoices.length, unpaid: unpaidInvoices, paid: paidInvoices.length },
      revenue: Math.round(totalRevenue * 100) / 100,
      activeServices: services.filter(s => s.status === 'active').length,
      activeDomains: domains.filter(d => d.status === 'active').length,
      totalPackages: packages.length,
      totalBlockedIps: ipBlocks.length,
      recentOrders: orders.slice(-5).reverse(),
      recentUsers: users.slice(-5).reverse(),
      hardware: this.getHardwareMetrics()
    };
  }

  // Users Management
  listUsers(searchQuery = '') {
    let users = db.getAll('users') || [];
    const services = db.getAll('services') || [];
    const orders = db.getAll('orders') || [];

    if (searchQuery && typeof searchQuery === 'string') {
      const q = searchQuery.toLowerCase().trim();
      users = users.filter(u =>
        (u.firstName && u.firstName.toLowerCase().includes(q)) ||
        (u.lastName && u.lastName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q)) ||
        (u.cpanelUser && u.cpanelUser.toLowerCase().includes(q))
      );
    }

    return users.map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      username: u.username,
      cpanelUser: u.cpanelUser,
      role: u.role || 'client',
      status: u.status || 'active',
      servicesCount: services.filter(s => s.userId === u.id).length,
      ordersCount: orders.filter(o => o.userId === u.id).length,
      createdAt: u.createdAt || u.created || new Date().toISOString()
    }));
  }

  getUserDetails(userId) {
    const user = db.getById('users', userId);
    if (!user) return { success: false, message: 'User not found.' };
    const services = (db.getAll('services') || []).filter(s => s.userId === userId);
    const orders = (db.getAll('orders') || []).filter(o => o.userId === userId);
    const invoices = (db.getAll('invoices') || []).filter(i => i.userId === userId);
    const domains = (db.getAll('domains') || []).filter(d => d.userId === userId);
    return {
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        username: user.username,
        cpanelUser: user.cpanelUser,
        role: user.role || 'client',
        status: user.status || 'active',
        createdAt: user.createdAt || user.created
      },
      services,
      orders,
      invoices,
      domains
    };
  }

  updateUserDetails(userId, data = {}) {
    const user = db.getById('users', userId);
    if (!user) return { success: false, message: 'User not found.' };
    const updates = {};
    if (data.firstName) updates.firstName = data.firstName;
    if (data.lastName) updates.lastName = data.lastName;
    if (data.phone) updates.phone = data.phone;
    if (data.email) updates.email = data.email;
    if (data.role && (data.role === 'admin' || data.role === 'client')) updates.role = data.role;
    if (data.status && (data.status === 'active' || data.status === 'suspended')) updates.status = data.status;
    updates.updatedAt = new Date().toISOString();
    const updated = db.update('users', userId, updates);
    db.logAudit(userId, 'ADMIN_USER_UPDATED', '127.0.0.1', { updates });
    return { success: true, message: 'User details updated.', user: updated };
  }

  async resetUserPassword(userId, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters long.' };
    }
    const user = db.getById('users', userId);
    if (!user) return { success: false, message: 'User not found.' };
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(newPassword, 10);
    db.update('users', userId, { passwordHash: hash, updatedAt: new Date().toISOString() });

    try {
      if (fs.existsSync(USERS_FILE)) {
        const legacy = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        const idx = legacy.findIndex(u => u.id === userId || u.email === user.email);
        if (idx !== -1) {
          legacy[idx].passwordHash = hash;
          fs.writeFileSync(USERS_FILE, JSON.stringify(legacy, null, 2), 'utf8');
        }
      }
    } catch (e) {}

    const services = (db.getAll('services') || []).filter(s => s.userId === userId);
    services.forEach(s => {
      db.update('services', s.id, { cpanelPasswordHash: hash });
    });

    db.logAudit(userId, 'ADMIN_RESET_PASSWORD', '127.0.0.1', { email: user.email });
    return { success: true, message: 'Password has been safely reset and hashed.' };
  }

  updateUserStatus(userId, status) {
    if (status !== 'active' && status !== 'suspended') {
      return { success: false, message: 'Invalid user status. Allowed: active, suspended.' };
    }
    const user = db.getById('users', userId);
    if (!user) return { success: false, message: 'User not found.' };
    if (user.email === 'tamimhasan1281@gmail.com') {
      return { success: false, message: 'Cannot suspend main administrator account.' };
    }
    const updated = db.update('users', userId, { status, updatedAt: new Date().toISOString() });
    try {
      if (fs.existsSync(USERS_FILE)) {
        const legacy = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        const idx = legacy.findIndex(u => u.id === userId || u.email === user.email);
        if (idx !== -1) { legacy[idx].status = status; fs.writeFileSync(USERS_FILE, JSON.stringify(legacy, null, 2), 'utf8'); }
      }
    } catch (e) {}
    db.logAudit(userId, 'ADMIN_USER_STATUS_CHANGED', '127.0.0.1', { previous: user.status, new: status });
    return { success: true, message: 'User status updated to ' + status + '.', user: updated || { ...user, status } };
  }

  deleteUser(userId) {
    const user = db.getById('users', userId);
    if (!user) return { success: false, message: 'User not found.' };
    if (user.email === 'tamimhasan1281@gmail.com' || user.role === 'admin') {
      return { success: false, message: 'Cannot delete system administrator account.' };
    }
    db.delete('users', userId);
    try {
      if (fs.existsSync(USERS_FILE)) {
        const legacy = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        const filtered = legacy.filter(u => u.id !== userId && u.email !== user.email);
        fs.writeFileSync(USERS_FILE, JSON.stringify(filtered, null, 2), 'utf8');
      }
    } catch (e) {}
    db.logAudit(userId, 'ADMIN_USER_DELETED', '127.0.0.1', { email: user.email });
    return { success: true, message: 'User account deleted successfully.' };
  }

  // Orders Management & 1-Click Approval / Auto-Provisioning
  listOrders() {
    const orders = db.getAll('orders') || [];
    const users = db.getAll('users') || [];
    const invoices = db.getAll('invoices') || [];
    return orders.map(o => {
      const user = users.find(u => u.id === o.userId) || {};
      const inv = invoices.find(i => i.orderId === o.id) || {};
      return {
        ...o,
        clientName: (user.firstName || '') + ' ' + (user.lastName || ''),
        clientEmail: user.email || '',
        invoiceNumber: inv.invoiceNumber || 'N/A',
        invoiceStatus: inv.status || 'unpaid'
      };
    }).reverse();
  }

  approveOrder(orderId) {
    const order = db.getById('orders', orderId);
    if (!order) return { success: false, message: 'Order not found.' };
    if (order.status === 'approved') return { success: false, message: 'Order is already approved.' };

    const pkg = db.getById('hosting_packages', order.packageId) || { diskLimitMb: 5120, bandwidthLimitMb: 51200 };
    const user = db.getById('users', order.userId) || {};

    // 1. Update Order status
    db.update('orders', orderId, { status: 'approved', approvedAt: new Date().toISOString() });

    // 2. Mark invoice as paid
    const invoices = db.getAll('invoices') || [];
    const inv = invoices.find(i => i.orderId === orderId);
    if (inv) {
      db.update('invoices', inv.id, { status: 'paid', paidAt: new Date().toISOString() });
    }

    // 3. Auto-Provision Hosting Service in services table
    const cycleDays = order.billingCycle === 'yearly' ? 365 : 30;
    const nextDueDate = new Date(Date.now() + cycleDays * 86400000).toISOString();
    const newService = db.insert('services', {
      userId: order.userId,
      packageId: order.packageId,
      packageName: order.packageName,
      domain: order.domain,
      username: user.cpanelUser || order.domain.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8),
      user: user.cpanelUser || user.id,
      cpanelUser: user.cpanelUser || user.id,
      diskLimitMb: pkg.diskLimitMb || 5120,
      diskUsedMb: 12,
      bandwidthLimitMb: pkg.bandwidthLimitMb || 51200,
      bandwidthUsedMb: 0,
      billingCycle: order.billingCycle,
      status: 'active',
      ipAddress: '127.0.0.1',
      nextDueDate,
      createdAt: new Date().toISOString()
    });

    // 4. Auto-register domain in domains table
    const existingDomain = db.find('domains', d => d.domain && d.domain.toLowerCase() === order.domain.toLowerCase());
    if (!existingDomain) {
      db.insert('domains', {
        userId: order.userId,
        domain: order.domain.toLowerCase(),
        serviceId: newService.id,
        status: 'active',
        documentRoot: '/public_html',
        createdAt: new Date().toISOString()
      });
    }

    // 5. Ensure user public_html directory exists
    try {
      const cpanelUser = user.cpanelUser || 'cpanel_user';
      const userDir = path.resolve(__dirname, '../../data/storage/home/' + cpanelUser + '/public_html');
      if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
      const indexFile = path.join(userDir, 'index.html');
      if (!fs.existsSync(indexFile)) {
        fs.writeFileSync(indexFile, '<h1>Welcome to ' + order.domain + '</h1><p>Hosted by TAMIM HOSTING cPanel Platform</p>', 'utf8');
      }
    } catch (e) {}

    db.logAudit(order.userId, 'ORDER_APPROVED_AND_PROVISIONED', '127.0.0.1', { orderId, domain: order.domain });
    return { 
      success: true, 
      message: 'Order approved and hosting service provisioned successfully!', 
      service: newService,
      order: db.getById('orders', orderId),
      invoice: inv ? db.getById('invoices', inv.id) : null
    };
  }

  rejectOrder(orderId, reason = '') {
    const order = db.getById('orders', orderId);
    if (!order) return { success: false, message: 'Order not found.' };
    db.update('orders', orderId, { status: 'rejected', rejectionReason: reason, rejectedAt: new Date().toISOString() });
    const invoices = db.getAll('invoices') || [];
    const inv = invoices.find(i => i.orderId === orderId);
    if (inv) { db.update('invoices', inv.id, { status: 'cancelled' }); }
    db.logAudit(order.userId, 'ORDER_REJECTED', '127.0.0.1', { orderId, reason });
    return { success: true, message: 'Order rejected.' };
  }

  deleteOrder(orderId, adminId = 'admin') {
    const order = db.getById('orders', orderId);
    if (!order) return { success: false, message: 'Order not found.' };
    db.delete('orders', orderId);
    db.logAudit(adminId, 'ADMIN_ORDER_DELETED', '127.0.0.1', { orderId, domain: order.domain });
    return { success: true, message: `Order ${orderId} deleted successfully.` };
  }

  bulkDeleteOrders(orderIds = [], adminId = 'admin') {
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return { success: false, message: 'No orders selected for deletion.' };
    }
    let count = 0;
    for (const id of orderIds) {
      const order = db.getById('orders', id);
      if (order) {
        db.delete('orders', id);
        count++;
      }
    }
    db.logAudit(adminId, 'ADMIN_ORDERS_BULK_DELETED', '127.0.0.1', { count, orderIds });
    return { success: true, message: `Successfully deleted ${count} order(s).`, deletedCount: count };
  }

  // Invoices & Payment Verification
  listInvoices() {
    const invoices = db.getAll('invoices') || [];
    const users = db.getAll('users') || [];
    return invoices.map(inv => {
      const user = users.find(u => u.id === inv.userId) || {};
      return {
        ...inv,
        clientName: (user.firstName || '') + ' ' + (user.lastName || ''),
        clientEmail: user.email || ''
      };
    }).reverse();
  }

  verifyInvoice(invoiceId, trxId = '', notes = '') {
    const inv = db.getById('invoices', invoiceId);
    if (!inv) return { success: false, message: 'Invoice not found.' };
    db.update('invoices', invoiceId, { status: 'paid', trxId, notes, paidAt: new Date().toISOString() });
    if (inv.orderId) {
      const order = db.getById('orders', inv.orderId);
      if (order && order.status === 'pending') {
        this.approveOrder(inv.orderId);
      }
    }
    db.logAudit(inv.userId, 'INVOICE_PAYMENT_VERIFIED', '127.0.0.1', { invoiceId, trxId });
    return { success: true, message: 'Payment verified and invoice marked as paid.' };
  }

  deleteInvoice(invoiceId, adminId = 'admin') {
    const inv = db.getById('invoices', invoiceId);
    if (!inv) return { success: false, message: 'Invoice not found.' };
    db.delete('invoices', invoiceId);
    db.logAudit(adminId, 'ADMIN_INVOICE_DELETED', '127.0.0.1', { invoiceId, invoiceNumber: inv.invoiceNumber });
    return { success: true, message: `Invoice ${inv.invoiceNumber || invoiceId} deleted successfully.` };
  }

  bulkDeleteInvoices(invoiceIds = [], adminId = 'admin') {
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return { success: false, message: 'No invoices selected for deletion.' };
    }
    let count = 0;
    for (const id of invoiceIds) {
      const inv = db.getById('invoices', id);
      if (inv) {
        db.delete('invoices', id);
        count++;
      }
    }
    db.logAudit(adminId, 'ADMIN_INVOICES_BULK_DELETED', '127.0.0.1', { count, invoiceIds });
    return { success: true, message: `Successfully deleted ${count} invoice(s).`, deletedCount: count };
  }

  // Packages Management
  listPackages() { return db.getAll('hosting_packages') || []; }

  savePackage(pkgData) {
    const monthlyPrice = Number(pkgData.monthlyPrice || pkgData.priceMonthly);
    const yearlyPrice = Number(pkgData.yearlyPrice || pkgData.priceYearly || (monthlyPrice * 10));
    const diskSpaceGb = Number(pkgData.diskSpaceGb);
    if (!pkgData.name || !diskSpaceGb || !monthlyPrice) {
      return { success: false, message: 'Package Name, Storage (GB), and Monthly Price are required.' };
    }
    const pkgObj = {
      name: pkgData.name,
      diskSpaceGb,
      diskLimitMb: diskSpaceGb * 1024,
      bandwidthGb: Number(pkgData.bandwidthGb || 100),
      bandwidthLimitMb: Number(pkgData.bandwidthGb || 100) * 1024,
      monthlyPrice,
      priceMonthly: monthlyPrice,
      yearlyPrice,
      priceYearly: yearlyPrice,
      domainLimit: Number(pkgData.domainLimit || pkgData.maxDomains || 1),
      maxDomains: Number(pkgData.domainLimit || pkgData.maxDomains || 1),
      databaseLimit: Number(pkgData.databaseLimit || pkgData.maxDatabases || 5),
      maxDatabases: Number(pkgData.databaseLimit || pkgData.maxDatabases || 5),
      emailLimit: Number(pkgData.emailLimit || pkgData.maxEmailAccounts || 10),
      maxEmailAccounts: Number(pkgData.emailLimit || pkgData.maxEmailAccounts || 10),
      ftpLimit: Number(pkgData.ftpLimit || pkgData.maxFtpAccounts || 2),
      maxFtpAccounts: Number(pkgData.ftpLimit || pkgData.maxFtpAccounts || 2),
      cronLimit: Number(pkgData.cronLimit || pkgData.maxCronJobs || 5),
      maxCronJobs: Number(pkgData.cronLimit || pkgData.maxCronJobs || 5),
      sslIncluded: pkgData.sslIncluded !== false,
      active: pkgData.active !== false,
      status: pkgData.status || 'active'
    };
    if (pkgData.id) {
      const updated = db.update('hosting_packages', pkgData.id, pkgObj);
      return { success: true, message: 'Package updated successfully.', package: updated || { id: pkgData.id, ...pkgObj } };
    } else {
      const inserted = db.insert('hosting_packages', pkgObj);
      return { success: true, message: 'Package created successfully.', package: inserted };
    }
  }

  deletePackage(pkgId) {
    db.delete('hosting_packages', pkgId);
    return { success: true, message: 'Package deleted.' };
  }

  // Promotions / Coupons
  listPromotions() { return db.getAll('promotions') || []; }

  savePromotion(promoData) {
    const val = promoData.value !== undefined ? Number(promoData.value) : Number(promoData.discountValue);
    if (!promoData.code || isNaN(val)) {
      return { success: false, message: 'Coupon code and discount value are required.' };
    }
    const promo = {
      code: promoData.code.trim().toUpperCase(),
      discountType: promoData.discountType || 'percentage',
      value: val,
      discountValue: val,
      usageLimit: Number(promoData.usageLimit || promoData.maxUses || 100),
      maxUses: Number(promoData.usageLimit || promoData.maxUses || 100),
      usedCount: 0,
      currentUses: 0,
      expiryDate: promoData.expiryDate || '2026-12-31T23:59:59.000Z',
      isActive: promoData.active !== false && promoData.isActive !== false,
      active: promoData.active !== false && promoData.isActive !== false,
      description: promoData.description || ''
    };
    const inserted = db.insert('promotions', promo);
    return { success: true, message: 'Promotion created.', promotion: inserted };
  }

  deletePromotion(promoId) {
    db.delete('promotions', promoId);
    return { success: true, message: 'Promotion deleted.' };
  }

  // IP Blocker & Security
  listIpBlocks() { return db.getAll('ip_blocks') || []; }

  blockIp(ip, scope = 'ordering', reason = '') {
    if (!ip) return { success: false, message: 'IP address is required.' };
    const rec = db.insert('ip_blocks', {
      ip: ip.trim(),
      scope: scope === 'all' ? 'all' : 'ordering',
      reason: reason || 'Restricted by Admin',
      blockedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
    return { success: true, message: 'IP ' + ip + ' has been blocked (' + scope + ').', ipBlock: rec };
  }

  unblockIp(blockId) {
    db.delete('ip_blocks', blockId);
    return { success: true, message: 'IP unblocked.' };
  }

  // Services Management
  listServices() {
    const services = db.getAll('services') || [];
    const users = db.getAll('users') || [];
    const pkgs = db.getAll('hosting_packages') || [];
    return services.map(s => {
      const u = users.find(usr => usr.id === s.userId) || {};
      const p = pkgs.find(pkg => pkg.id === s.packageId) || {};
      return {
        ...s,
        clientName: (u.firstName || '') + ' ' + (u.lastName || '') || u.email || 'Client',
        clientEmail: u.email || '',
        packageName: s.packageName || p.name || 'Standard Hosting'
      };
    }).reverse();
  }

  updateServiceStatus(serviceId, status, extendDays = 30) {
    const service = db.getById('services', serviceId);
    if (!service) return { success: false, message: 'Service not found.' };
    const validStatuses = ['active', 'suspended', 'expired', 'renew'];
    if (!validStatuses.includes(status)) {
      return { success: false, message: 'Invalid service status. Allowed: active, suspended, expired, renew.' };
    }
    const updates = { updatedAt: new Date().toISOString() };
    if (status === 'renew') {
      updates.status = 'active';
      const currentDue = service.nextDueDate ? new Date(service.nextDueDate).getTime() : Date.now();
      const baseTime = currentDue > Date.now() ? currentDue : Date.now();
      updates.nextDueDate = new Date(baseTime + (extendDays * 86400000)).toISOString();
    } else {
      updates.status = status;
    }
    const updated = db.update('services', serviceId, updates);
    db.logAudit(service.userId, 'ADMIN_SERVICE_STATUS_CHANGED', '127.0.0.1', { serviceId, status: updates.status });
    return { success: true, message: `Service status updated to ${updates.status}.`, service: updated };
  }

  // Domains Management (Mapping)
  listDomains() {
    const domains = db.getAll('domains') || [];
    const services = db.getAll('services') || [];
    const users = db.getAll('users') || [];
    return domains.map(d => {
      const s = services.find(srv => srv.id === d.serviceId || srv.domain === d.domain) || {};
      const u = users.find(usr => usr.id === d.userId || usr.id === s.userId) || {};
      return {
        ...d,
        serviceDomain: s.domain || d.domain,
        clientName: (u.firstName || '') + ' ' + (u.lastName || '') || u.email || 'Client',
        clientEmail: u.email || '',
        serviceStatus: s.status || d.status || 'active'
      };
    }).reverse();
  }

  // Payment Gateways
  listPaymentGateways() {
    return db.getAll('payment_methods') || [];
  }

  togglePaymentGateway(gatewayId, active) {
    const gw = db.getById('payment_methods', gatewayId);
    if (!gw) return { success: false, message: 'Payment gateway not found.' };
    const updated = db.update('payment_methods', gatewayId, { active: !!active, isActive: !!active, updatedAt: new Date().toISOString() });
    return { success: true, message: `Gateway ${gw.name} is now ${active ? 'active' : 'inactive'}.`, gateway: updated };
  }

  getAuditLogs() {
    const logs = db.getAll('audit_logs') || [];
    return logs.slice(-50).reverse();
  }

  // System Settings & Upload Limits
  getSettings() {
    const settings = db.getSettings();
    const maxUploadSizeMb = Number(settings.maxUploadSizeMb) || 2048;
    const maxUploadSizeGb = Number((maxUploadSizeMb / 1024).toFixed(2));
    const maxUploadSizeBytes = maxUploadSizeMb * 1024 * 1024;
    return {
      ...settings,
      maxUploadSizeMb,
      maxUploadSizeGb,
      maxUploadSizeBytes,
      formattedUploadLimit: maxUploadSizeMb >= 1024 ? `${maxUploadSizeGb.toFixed(2)} GB` : `${maxUploadSizeMb} MB`
    };
  }

  updateUploadLimit(sizeMb, adminId = 'admin') {
    const parsedMb = parseInt(sizeMb, 10);
    if (isNaN(parsedMb) || parsedMb <= 0) {
      return { success: false, message: 'Invalid upload limit. Must be a positive integer in MB.' };
    }
    const updated = db.updateSettings({ maxUploadSizeMb: parsedMb });
    const gb = (parsedMb / 1024).toFixed(2);
    db.logAudit(adminId, 'ADMIN_MAX_UPLOAD_LIMIT_UPDATED', '127.0.0.1', {
      maxUploadSizeMb: parsedMb,
      maxUploadSizeGb: gb
    });
    return {
      success: true,
      message: `Maximum file upload limit successfully updated to ${parsedMb} MB (${gb} GB).`,
      maxUploadSizeMb: parsedMb,
      maxUploadSizeGb: Number(gb),
      maxUploadSizeBytes: parsedMb * 1024 * 1024,
      settings: updated
    };
  }

  getMaxUploadLimitMb() {
    const settings = db.getSettings();
    return Number(settings.maxUploadSizeMb) || 2048;
  }
}

module.exports = new AdminService();