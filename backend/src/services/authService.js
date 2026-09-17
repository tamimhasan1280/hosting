const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const sessionService = require('./sessionService');
const db = require('./db');

const USERS_FILE = path.resolve(__dirname, '../../data/users.json');

function ensureUsersStore() {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let users = [];
  if (fs.existsSync(USERS_FILE)) {
    try {
      users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
      users = [];
    }
  }

  // Ensure Admin tamimhasan1281@gmail.com exists
  const existingTamim = users.find(u => u.email === 'tamimhasan1281@gmail.com' || u.username === 'tamimhasan1281@gmail.com' || u.cpanelUser === 'tamimhasan1281');
  const salt = bcrypt.genSaltSync(10);
  const tamimHash = bcrypt.hashSync('123@#TAmi', salt);

  if (!existingTamim) {
    users.push({
      id: 'usr_tamim',
      firstName: 'Tamim',
      lastName: 'Admin',
      phone: '+8801700000000',
      username: 'tamimhasan1281@gmail.com',
      email: 'tamimhasan1281@gmail.com',
      cpanelUser: 'tamimhasan1281',
      passwordHash: tamimHash,
      role: 'admin',
      status: 'active',
      created: new Date().toISOString()
    });
  } else {
    existingTamim.username = 'tamimhasan1281@gmail.com';
    existingTamim.email = 'tamimhasan1281@gmail.com';
    existingTamim.cpanelUser = 'tamimhasan1281';
    existingTamim.passwordHash = tamimHash;
    existingTamim.role = 'admin';
    existingTamim.status = existingTamim.status || 'active';
  }

  // Also maintain cpanel_user for automated tests
  const existingCpanel = users.find(u => u.cpanelUser === 'cpanel_user');
  if (!existingCpanel) {
    users.push({
      id: 'usr_default',
      firstName: 'Default',
      lastName: 'Admin',
      phone: '+8801800000000',
      username: 'cpanel_user',
      email: 'admin@example.com',
      cpanelUser: 'cpanel_user',
      passwordHash: bcrypt.hashSync('cpanel_default_pass', salt),
      role: 'admin',
      status: 'active',
      created: new Date().toISOString()
    });
  }

  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

class AuthService {
  constructor() {
    ensureUsersStore();
  }

  _readUsers() {
    // Prefer central db store, fallback to legacy
    try {
      const dbUsers = db.getAll('users');
      if (Array.isArray(dbUsers) && dbUsers.length > 0) return dbUsers;
    } catch (e) {}

    ensureUsersStore();
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  }

  _sanitize(str) {
    if (typeof str !== 'string') return '';
    // Strip control chars, null bytes, dangerous SQL injection fragments, and script tags
    return str
      .replace(/[\0\x08\x09\x1a\r]/g, '')
      .replace(/<[^>]*>/g, '') // XSS tag strip
      .replace(/(\b(UNION|SELECT|INSERT|DELETE|UPDATE|DROP|ALTER|EXEC|TRUNCATE)\b)/gi, '') // SQL keyword strip
      .replace(/['";\\]/g, '') // dangerous quotes and semicolons
      .trim();
  }

  registerClient({ firstName, lastName, phone, email, password, confirmPassword, ipAddress = '127.0.0.1' }) {
    // 1. Required Field Validation
    if (!firstName || !String(firstName).trim()) {
      return { success: false, message: 'First Name is required.' };
    }
    if (!lastName || !String(lastName).trim()) {
      return { success: false, message: 'Last Name is required.' };
    }
    if (!phone || !String(phone).trim()) {
      return { success: false, message: 'Phone Number is required.' };
    }
    if (!email || !String(email).trim()) {
      return { success: false, message: 'Email Address is required.' };
    }
    if (!password || !String(password).trim()) {
      return { success: false, message: 'Password is required.' };
    }
    if (!confirmPassword || !String(confirmPassword).trim()) {
      return { success: false, message: 'Confirm Password is required.' };
    }

    // 2. Confirm Password Matching
    if (password !== confirmPassword) {
      return { success: false, message: 'Password and Confirm Password do not match.' };
    }

    // 3. Email Validation (RFC standard format check & length)
    const cleanEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (cleanEmail.length > 254 || !emailRegex.test(cleanEmail)) {
      return { success: false, message: 'Please enter a valid email address (e.g. name@domain.com).' };
    }

    // 4. Phone Validation (Supports Bangladeshi 01XXXXXXXXX, +8801XXXXXXXXX, & International formats)
    const rawPhone = String(phone).trim();
    const phoneDigits = rawPhone.replace(/[^\d+]/g, '');
    const phoneRegex = /^(\+?[0-9]{8,16})$/;
    if (!phoneRegex.test(phoneDigits)) {
      return { success: false, message: 'Please enter a valid phone number (8 to 16 digits, e.g. 01700000000 or +8801700000000).' };
    }

    // 5. Password Validation (Min 8 chars, uppercase, lowercase, and number/symbol)
    if (password.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters long.' };
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigitOrSpecial = /[\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    if (!hasUpper || !hasLower || !hasDigitOrSpecial) {
      return { 
        success: false, 
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and at least one number or special character.' 
      };
    }

    // 6. Duplicate Email Prevention
    const allUsers = this._readUsers();
    const existing = allUsers.find(u => (u.email && u.email.toLowerCase() === cleanEmail) || (u.username && u.username.toLowerCase() === cleanEmail));
    if (existing) {
      return { success: false, message: 'An account with this email address is already registered. Please log in.' };
    }

    // 7. SQL Injection & XSS Protection Sanitization
    const sanitizedFirstName = this._sanitize(firstName);
    const sanitizedLastName = this._sanitize(lastName);
    const sanitizedPhone = phoneDigits;

    // Generate safe unique cPanel username from email
    const baseUser = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 8);
    let cpanelUser = baseUser || 'user';
    if (cpanelUser.length < 4) cpanelUser = `${cpanelUser}1280`;

    // Ensure uniqueness
    let counter = 1;
    while (allUsers.some(u => u.cpanelUser === cpanelUser)) {
      cpanelUser = `${baseUser.substring(0, 5)}${counter++}`;
    }

    // 8. Secure Password Hashing (bcryptjs with salt cost 12)
    const salt = bcrypt.genSaltSync(12);
    const passwordHash = bcrypt.hashSync(password, salt);

    const newUser = db.insert('users', {
      firstName: sanitizedFirstName,
      lastName: sanitizedLastName,
      phone: sanitizedPhone,
      email: cleanEmail,
      username: cleanEmail,
      cpanelUser,
      passwordHash,
      role: 'client',
      status: 'active',
      ipAddress: this._sanitize(ipAddress),
      createdAt: new Date().toISOString()
    });

    // Sync to legacy users.json for backward compatibility
    try {
      ensureUsersStore();
      const legacy = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      legacy.push(newUser);
      fs.writeFileSync(USERS_FILE, JSON.stringify(legacy, null, 2), 'utf8');
    } catch (e) {}

    // Initialize normalized user profile
    try {
      db.insert('user_profiles', {
        userId: newUser.id,
        companyName: '',
        taxId: '',
        timezone: 'Asia/Dhaka',
        language: 'en',
        twoFactorEnabled: false,
        avatarUrl: '',
        createdAt: new Date().toISOString()
      });
    } catch (e) {}

    db.logAudit(newUser.id, 'USER_REGISTERED', ipAddress, {
      email: cleanEmail,
      cpanelUser,
      phone: sanitizedPhone
    });

    try {
      db.logActivity(newUser.id, 'auth', 'USER_REGISTERED', ipAddress, {
        email: cleanEmail,
        cpanelUser
      });
    } catch (e) {}

    return {
      success: true,
      message: 'Account created successfully! You can now log in.',
      user: {
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        cpanelUser: newUser.cpanelUser,
        role: newUser.role
      }
    };
  }

  login(identifier, password, ipAddress = '127.0.0.1', userAgent = '') {
    if (!identifier || !password) {
      return { success: false, message: 'Username/Email and password are required.' };
    }

    const cleanId = String(identifier).trim().toLowerCase();
    const users = this._readUsers();

    const user = users.find(u => 
      (u.email && u.email.toLowerCase() === cleanId) || 
      (u.username && u.username.toLowerCase() === cleanId) || 
      (u.cpanelUser && u.cpanelUser.toLowerCase() === cleanId)
    );

    if (!user) {
      return { success: false, message: 'Invalid credentials. Please check and try again.' };
    }

    // Check account status
    if (user.status === 'suspended') {
      return { 
        success: false, 
        message: 'Your account has been suspended by the administrator. Please contact support.' 
      };
    }

    const match = bcrypt.compareSync(password, user.passwordHash);
    if (!match) {
      return { success: false, message: 'Invalid credentials. Please check and try again.' };
    }

    // Valid credentials: create real cPanel session
    const effectiveUser = user.cpanelUser || user.username || 'cpanel_user';
    const session = sessionService.createSession(effectiveUser, 'cpaneld', {
      email: user.email,
      username: user.username,
      role: user.role || 'client'
    }, null, ipAddress, userAgent);

    // Audit & Activity log
    try {
      db.logAudit(user.id, 'USER_LOGIN_SUCCESS', ipAddress, {
        email: user.email,
        cpanelUser: effectiveUser
      });
      db.logActivity(user.id, 'auth', 'USER_LOGIN_SUCCESS', ipAddress, {
        email: user.email,
        cpanelUser: effectiveUser
      });
    } catch (e) {}

    return {
      success: true,
      token: session.token,
      user: effectiveUser,
      email: user.email,
      role: user.role || 'client',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || '',
      status: user.status || 'active',
      expires: session.expires
    };
  }

  logout(token) {
    if (token) {
      sessionService.revokeSession(token);
    }
    return { success: true };
  }

  verifySession(token, user) {
    return sessionService.validateSession(token, user);
  }
}

module.exports = new AuthService();
