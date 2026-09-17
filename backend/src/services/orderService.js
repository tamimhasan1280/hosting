const db = require('./db');

class OrderService {
  getPackages() {
    const pkgs = db.getAll('hosting_packages') || [];
    return pkgs.filter(p => p.status === 'active');
  }

  getPackageById(id) {
    return db.getById('hosting_packages', id);
  }

  validateDomain(rawDomain, option = 'existing') {
    if (!rawDomain || typeof rawDomain !== 'string') {
      return { valid: false, message: 'Domain name cannot be empty.' };
    }
    const trimmed = rawDomain.trim();
    if (/^(https?:\/\/)/i.test(trimmed)) {
      return { valid: false, message: 'Please do not include http:// or https:// in the domain name.' };
    }
    if (/[\/\\]/.test(trimmed)) {
      return { valid: false, message: 'Domain name cannot contain slashes or path characters.' };
    }
    if (/\s/.test(trimmed)) {
      return { valid: false, message: 'Domain name cannot contain spaces.' };
    }
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(trimmed)) {
      return { valid: false, message: 'Invalid domain syntax. Example format: example.com or alham.com' };
    }
    const cleanDomain = trimmed.toLowerCase();
    const allDomains = db.getAll('domains') || [];
    const exists = allDomains.find(d => d.domain && d.domain.toLowerCase() === cleanDomain && d.status === 'active');
    if (exists) {
      return { valid: false, message: 'This domain is already registered and active in the system.' };
    }
    return { valid: true, domain: cleanDomain, option };
  }

  validateCoupon(code, amount = 0) {
    if (!code || typeof code !== 'string') {
      return { valid: false, message: 'Please provide a coupon code.' };
    }
    const cleanCode = code.trim().toUpperCase();
    const allPromos = db.getAll('promotions') || [];
    const promo = allPromos.find(p => p.code && p.code.toUpperCase() === cleanCode);
    if (!promo) {
      return { valid: false, message: 'Invalid coupon code.' };
    }
    if (!promo.isActive) {
      return { valid: false, message: 'This coupon code is currently disabled.' };
    }
    if (promo.expiryDate && new Date(promo.expiryDate) < new Date()) {
      return { valid: false, message: 'This coupon code has expired.' };
    }
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
      return { valid: false, message: 'This coupon code has reached its maximum usage limit.' };
    }
    let discount = 0;
    const baseAmount = Number(amount) || 0;
    if (promo.discountType === 'percentage') {
      discount = (baseAmount * promo.value) / 100;
    } else {
      discount = Number(promo.value) || 0;
    }
    discount = Math.min(discount, baseAmount);
    discount = Math.round(discount * 100) / 100;
    const finalAmount = Math.max(0, Math.round((baseAmount - discount) * 100) / 100);
    return {
      valid: true,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.value,
      discountAmount: discount,
      finalAmount,
      description: promo.description || ''
    };
  }

  getPaymentMethods() {
    const methods = db.getAll('payment_methods') || [];
    return methods.filter(m => m.isActive);
  }

  isIpBlocked(ipAddress, action = 'ordering') {
    if (!ipAddress) return false;
    const cleanIp = ipAddress.replace(/::ffff:/, '').trim();
    const blocks = db.getAll('ip_blocks') || [];
    const matched = blocks.find(b => {
      const bIp = (b.ip || '').replace(/::ffff:/, '').trim();
      return bIp === cleanIp;
    });
    if (!matched) return false;
    if (matched.scope === 'all') return true;
    if (action === 'ordering' && (matched.scope === 'ordering' || !matched.scope)) return true;
    return false;
  }

  createOrder({
    userId,
    packageId,
    billingCycle = 'monthly',
    domain,
    domainOption = 'existing',
    couponCode = null,
    billingAddress = {},
    paymentMethodId = 'pay_bkash',
    additionalNotes = '',
    ipAddress = '127.0.0.1'
  }) {
    if (this.isIpBlocked(ipAddress, 'ordering')) {
      return { success: false, message: 'Your IP address is restricted from placing orders.' };
    }
    const pkg = this.getPackageById(packageId);
    if (!pkg || pkg.status !== 'active') {
      return { success: false, message: 'Selected hosting package is invalid or not active.' };
    }
    const domainCheck = this.validateDomain(domain, domainOption);
    if (!domainCheck.valid) {
      return { success: false, message: domainCheck.message };
    }
    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const basePrice = cycle === 'yearly' ? Number(pkg.yearlyPrice || 0) : Number(pkg.monthlyPrice || 0);
    let discountAmount = 0;
    let finalAmount = basePrice;
    let appliedPromo = null;
    if (couponCode) {
      const promoCheck = this.validateCoupon(couponCode, basePrice);
      if (promoCheck.valid) {
        discountAmount = promoCheck.discountAmount;
        finalAmount = promoCheck.finalAmount;
        appliedPromo = promoCheck;
        try {
          const promoObj = db.find('promotions', p => p.code.toUpperCase() === promoCheck.code.toUpperCase());
          if (promoObj) {
            db.update('promotions', promoObj.id, { usedCount: (promoObj.usedCount || 0) + 1 });
          }
        } catch (e) {}
      }
    }
    const order = db.insert('orders', {
      userId,
      packageId: pkg.id,
      packageName: pkg.name,
      diskSpaceGb: pkg.diskSpaceGb,
      bandwidthGb: pkg.bandwidthGb,
      billingCycle: cycle,
      domain: domainCheck.domain,
      domainOption,
      subtotal: basePrice,
      discount: discountAmount,
      totalAmount: finalAmount,
      couponCode: appliedPromo ? appliedPromo.code : null,
      billingAddress: {
        firstName: billingAddress.firstName || '',
        lastName: billingAddress.lastName || '',
        address: billingAddress.address || '',
        city: billingAddress.city || '',
        state: billingAddress.state || '',
        postalCode: billingAddress.postalCode || '',
        country: billingAddress.country || 'Bangladesh',
        phone: billingAddress.phone || '',
        email: billingAddress.email || ''
      },
      paymentMethodId,
      additionalNotes: String(additionalNotes || '').slice(0, 500),
      status: 'pending',
      ipAddress,
      createdAt: new Date().toISOString()
    });
    const invoiceNumber = 'INV-' + (100000 + Math.floor(Math.random() * 900000));
    const dueDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const invoice = db.insert('invoices', {
      orderId: order.id,
      userId,
      invoiceNumber,
      subtotal: basePrice,
      discount: discountAmount,
      totalAmount: finalAmount,
      currency: 'USD',
      status: 'unpaid',
      paymentMethodId,
      dueDate,
      items: [{
        description: pkg.name + ' (' + (cycle === 'yearly' ? '1 Year' : '1 Month') + ') - ' + domainCheck.domain,
        amount: finalAmount
      }],
      createdAt: new Date().toISOString()
    });
    db.logAudit(userId, 'ORDER_CREATED', ipAddress, {
      orderId: order.id,
      invoiceId: invoice.id,
      invoiceNumber,
      domain: domainCheck.domain,
      totalAmount: finalAmount
    });
    return {
      success: true,
      message: 'Order created successfully! Pending administrative review.',
      order,
      invoice
    };
  }

  getClientDashboardData(userId) {
    const user = db.getById('users', userId);
    const allServices = (db.getAll('services') || []).filter(s => s.userId === userId);
    const allDomains = (db.getAll('domains') || []).filter(d => d.userId === userId);
    const allOrders = (db.getAll('orders') || []).filter(o => o.userId === userId);
    const allInvoices = (db.getAll('invoices') || []).filter(i => i.userId === userId);
    const activeServices = allServices.filter(s => s.status === 'active');
    const activeDomains = allDomains.filter(d => d.status === 'active');
    const pendingOrders = allOrders.filter(o => o.status === 'pending');
    const unpaidInvoices = allInvoices.filter(i => i.status === 'unpaid');
    const paidInvoices = allInvoices.filter(i => i.status === 'paid');
    const totalSpent = paidInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringServices = allServices.filter(s => {
      if (s.status === 'expired') return true;
      if (s.status === 'active' && s.nextDueDate) {
        const due = new Date(s.nextDueDate);
        return due <= thirtyDaysFromNow;
      }
      return false;
    });

    return {
      user: user ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        cpanelUser: user.cpanelUser,
        role: user.role,
        status: user.status
      } : null,
      counts: {
        activeServices: activeServices.length,
        activeDomains: activeDomains.length,
        pendingOrders: pendingOrders.length,
        unpaidInvoices: unpaidInvoices.length,
        expiringServices: expiringServices.length,
        paidInvoices: paidInvoices.length,
        totalSpent: Math.round(totalSpent * 100) / 100
      },
      recentOrders: allOrders.slice(-5).reverse(),
      recentInvoices: allInvoices.slice(-5).reverse(),
      services: allServices,
      domains: allDomains
    };
  }
}

module.exports = new OrderService();