const fs = require('fs');
const path = require('path');
const sessionService = require('./sessionService');

const MAIL_DATA_FILE = path.resolve(__dirname, '../../data/email/accounts.json');
const WHM_ACCOUNTS_FILE = path.resolve(__dirname, '../../data/whm_accounts.json');

function getPrimaryDomainForUser(username) {
  if (username === 'cpanel_user') return 'example.com';
  try {
    if (fs.existsSync(WHM_ACCOUNTS_FILE)) {
      const accts = JSON.parse(fs.readFileSync(WHM_ACCOUNTS_FILE, 'utf8'));
      const found = accts.find(a => a.user === username);
      if (found && found.domain) return found.domain;
    }
  } catch (e) {}
  return `${username}.com`;
}

function createDefaultUserData(username) {
  const domain = getPrimaryDomainForUser(username);
  const now = new Date().toISOString();
  
  return {
    accounts: [
      {
        email: `admin@${domain}`,
        user: 'admin',
        domain: domain,
        quota: '1024 MB',
        usage: '14.2 MB',
        created: now
      },
      {
        email: `support@${domain}`,
        user: 'support',
        domain: domain,
        quota: '2048 MB',
        usage: '2.5 MB',
        created: now
      }
    ],
    forwarders: [
      {
        source: `info@${domain}`,
        destination: `admin@${domain}`,
        created: now
      }
    ],
    autoresponders: [
      {
        email: `support@${domain}`,
        from: 'Support Desk',
        subject: `We have received your ticket - ${domain}`,
        body: `Thank you for contacting ${domain} support. Our team will get back to you shortly.`,
        created: now
      }
    ],
    deliverability: [
      {
        domain: domain,
        spf: 'VALID',
        dkim: 'VALID',
        dmarc: 'VALID',
        status: 'Problems Exist (0)'
      }
    ],
    mailboxes: {
      [`admin@${domain}`]: {
        inbox: [
          {
            id: 'msg_1',
            from: 'cPanel System <system@cpanel.net>',
            to: `admin@${domain}`,
            subject: 'Welcome to your cPanel Webmail & Mailbox',
            date: new Date(Date.now() - 3600000).toLocaleString(),
            read: false,
            body: `Hello,\n\nYour mailbox for ${domain} is successfully configured on this server.\n\nEmail: admin@${domain}\nIncoming/Outgoing Server: mail.${domain}\nIMAP Port: 993 (SSL)\nSMTP Port: 465 (SSL)\n\nYou can access Webmail directly via Single Sign-On (SSO) at any time from your cPanel control panel.\n\nBest regards,\ncPanel Team`
          },
          {
            id: 'msg_2',
            from: 'SSL Certificate Authority <certs@autossl.cpanel.net>',
            to: `admin@${domain}`,
            subject: `[AutoSSL] Let's Encrypt Certificate Installed for ${domain}`,
            date: new Date(Date.now() - 86400000).toLocaleString(),
            read: true,
            body: `The SSL certificate for domain "${domain}" and subdomains has been automatically renewed and installed successfully.`
          }
        ],
        sent: [
          {
            id: 'msg_sent_1',
            from: `admin@${domain}`,
            to: 'client@example.org',
            subject: 'Hosting Setup Verification',
            date: new Date(Date.now() - 7200000).toLocaleString(),
            read: true,
            body: 'Your hosting account has been verified and DNS records are propagating properly.'
          }
        ],
        drafts: [],
        junk: [],
        trash: []
      }
    }
  };
}

function ensureMailStore() {
  const dir = path.dirname(MAIL_DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(MAIL_DATA_FILE)) {
    const initial = {
      users: {
        'cpanel_user': createDefaultUserData('cpanel_user')
      }
    };
    fs.writeFileSync(MAIL_DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

class MailService {
  constructor() {
    ensureMailStore();
  }

  _readAll() {
    ensureMailStore();
    try {
      const raw = JSON.parse(fs.readFileSync(MAIL_DATA_FILE, 'utf8'));
      if (!raw.users) {
        // Migrate legacy flat structure
        const migrated = {
          users: {
            'cpanel_user': {
              accounts: raw.accounts || [],
              forwarders: raw.forwarders || [],
              autoresponders: raw.autoresponders || [],
              deliverability: raw.deliverability || [],
              mailboxes: {}
            }
          }
        };
        fs.writeFileSync(MAIL_DATA_FILE, JSON.stringify(migrated, null, 2), 'utf8');
        return migrated;
      }
      return raw;
    } catch (e) {
      return { users: { 'cpanel_user': createDefaultUserData('cpanel_user') } };
    }
  }

  _writeAll(data) {
    fs.writeFileSync(MAIL_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  _getUserData(cpanelUser = 'cpanel_user') {
    const all = this._readAll();
    if (!all.users[cpanelUser]) {
      all.users[cpanelUser] = createDefaultUserData(cpanelUser);
      this._writeAll(all);
    }
    return all.users[cpanelUser];
  }

  _saveUserData(cpanelUser, userData) {
    const all = this._readAll();
    all.users[cpanelUser] = userData;
    this._writeAll(all);
  }

  getAll(cpanelUser = 'cpanel_user') {
    const uData = this._getUserData(cpanelUser);
    return {
      accounts: uData.accounts || [],
      forwarders: uData.forwarders || [],
      autoresponders: uData.autoresponders || [],
      deliverability: uData.deliverability || []
    };
  }

  createAccount(user, domain, password, quota = 1024, cpanelUser = 'cpanel_user') {
    if (!user || !/^[a-zA-Z0-9._-]+$/.test(user)) {
      throw new Error('Invalid email username');
    }
    if (!domain) {
      throw new Error('Domain is required');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    const fullEmail = `${user}@${domain}`.toLowerCase();
    const uData = this._getUserData(cpanelUser);

    if (uData.accounts.find(a => a.email === fullEmail)) {
      throw new Error('Email account already exists');
    }

    // Enforce package email account limit if service exists
    const db = require('./db');
    const allServices = db.getAll('services') || [];
    const userServices = allServices.filter(s => (s.user === cpanelUser || s.domain === domain) && s.status === 'active');
    if (userServices.length > 0) {
      const activeSvc = userServices[0];
      const pkg = db.getById('hosting_packages', activeSvc.packageId);
      if (pkg && typeof pkg.emailLimit === 'number' && uData.accounts.length >= pkg.emailLimit) {
        throw new Error(`Email account limit reached (${pkg.emailLimit} accounts allowed for ${pkg.name}). Please upgrade package.`);
      }
    }

    const newAcc = {
      email: fullEmail,
      user,
      domain,
      quota: `${quota} MB`,
      usage: '0.00 MB',
      created: new Date().toISOString()
    };
    uData.accounts.push(newAcc);
    
    // Initialize mailbox
    if (!uData.mailboxes) uData.mailboxes = {};
    uData.mailboxes[fullEmail] = {
      inbox: [
        {
          id: 'msg_init',
          from: 'System Mailer <mailer-daemon@server>',
          to: fullEmail,
          subject: 'Account Created Successfully',
          date: new Date().toLocaleString(),
          read: false,
          body: `Mailbox ${fullEmail} is now active and ready to send and receive messages.`
        }
      ],
      sent: [],
      drafts: [],
      junk: [],
      trash: []
    };

    this._saveUserData(cpanelUser, uData);
    return newAcc;
  }

  deleteAccount(email, cpanelUser = 'cpanel_user') {
    const uData = this._getUserData(cpanelUser);
    uData.accounts = uData.accounts.filter(a => a.email !== email);
    if (uData.mailboxes && uData.mailboxes[email]) {
      delete uData.mailboxes[email];
    }
    this._saveUserData(cpanelUser, uData);
    return { success: true, email };
  }

  changePassword(email, newPassword, cpanelUser = 'cpanel_user') {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    const uData = this._getUserData(cpanelUser);
    const acc = uData.accounts.find(a => a.email.toLowerCase() === email.toLowerCase());
    if (!acc) throw new Error(`Email account ${email} not found`);
    
    const bcrypt = require('bcryptjs');
    acc.passwordHash = bcrypt.hashSync(newPassword, 10);
    acc.updatedAt = new Date().toISOString();
    this._saveUserData(cpanelUser, uData);
    return { success: true, message: `Password for ${email} updated successfully.` };
  }

  updateQuota(email, quotaMb, cpanelUser = 'cpanel_user') {
    const uData = this._getUserData(cpanelUser);
    const acc = uData.accounts.find(a => a.email.toLowerCase() === email.toLowerCase());
    if (!acc) throw new Error(`Email account ${email} not found`);
    acc.quota = `${quotaMb} MB`;
    acc.updatedAt = new Date().toISOString();
    this._saveUserData(cpanelUser, uData);
    return { success: true, quota: acc.quota };
  }

  addForwarder(source, destination, cpanelUser = 'cpanel_user') {
    const uData = this._getUserData(cpanelUser);
    const newFwd = {
      source: source.toLowerCase(),
      destination: destination.toLowerCase(),
      created: new Date().toISOString()
    };
    uData.forwarders.push(newFwd);
    this._saveUserData(cpanelUser, uData);
    return newFwd;
  }

  deleteForwarder(source, destination, cpanelUser = 'cpanel_user') {
    const uData = this._getUserData(cpanelUser);
    uData.forwarders = uData.forwarders.filter(f => !(f.source === source && f.destination === destination));
    this._saveUserData(cpanelUser, uData);
    return { success: true };
  }

  addAutoresponder(email, from, subject, body, cpanelUser = 'cpanel_user') {
    const uData = this._getUserData(cpanelUser);
    const newAuto = {
      email: email.toLowerCase(),
      from,
      subject,
      body,
      created: new Date().toISOString()
    };
    uData.autoresponders = (uData.autoresponders || []).filter(a => a.email !== email.toLowerCase());
    uData.autoresponders.push(newAuto);
    this._saveUserData(cpanelUser, uData);
    return newAuto;
  }

  // --- Webmail SSO & Email Client Actions ---

  createWebmailSession(email, cpanelUser = 'cpanel_user') {
    const uData = this._getUserData(cpanelUser);
    const acc = uData.accounts.find(a => a.email.toLowerCase() === email.toLowerCase());
    if (!acc) {
      throw new Error(`Email account '${email}' does not belong to user '${cpanelUser}'`);
    }

    const session = sessionService.createSession(cpanelUser, 'webmail', { email: acc.email });
    return {
      success: true,
      token: session.token,
      email: acc.email,
      url: session.redirectUrl,
      expires: session.expires
    };
  }

  getMailbox(email, folder = 'inbox', cpanelUser = 'cpanel_user') {
    const uData = this._getUserData(cpanelUser);
    const normalizedEmail = email.toLowerCase();
    
    // Check if account exists
    const acc = uData.accounts.find(a => a.email.toLowerCase() === normalizedEmail);
    if (!acc) {
      throw new Error(`Mailbox not found for ${email}`);
    }

    if (!uData.mailboxes) uData.mailboxes = {};
    if (!uData.mailboxes[normalizedEmail]) {
      uData.mailboxes[normalizedEmail] = {
        inbox: [],
        sent: [],
        drafts: [],
        junk: [],
        trash: []
      };
      this._saveUserData(cpanelUser, uData);
    }

    const targetFolder = folder.toLowerCase();
    const messages = uData.mailboxes[normalizedEmail][targetFolder] || [];

    // Folder counts
    const counts = {
      inbox: (uData.mailboxes[normalizedEmail].inbox || []).filter(m => !m.read).length,
      sent: (uData.mailboxes[normalizedEmail].sent || []).length,
      drafts: (uData.mailboxes[normalizedEmail].drafts || []).length,
      junk: (uData.mailboxes[normalizedEmail].junk || []).length,
      trash: (uData.mailboxes[normalizedEmail].trash || []).length
    };

    return {
      email: normalizedEmail,
      folder: targetFolder,
      messages,
      counts
    };
  }

  sendMail(fromEmail, to, subject, body, cpanelUser = 'cpanel_user') {
    const uData = this._getUserData(cpanelUser);
    const normalizedFrom = fromEmail.toLowerCase();
    const normalizedTo = to.toLowerCase().trim();

    if (!uData.accounts.find(a => a.email.toLowerCase() === normalizedFrom)) {
      throw new Error(`Sender address '${fromEmail}' does not exist on this account`);
    }

    if (!uData.mailboxes) uData.mailboxes = {};
    if (!uData.mailboxes[normalizedFrom]) {
      uData.mailboxes[normalizedFrom] = { inbox: [], sent: [], drafts: [], junk: [], trash: [] };
    }

    const newMsg = {
      id: 'msg_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      from: normalizedFrom,
      to: normalizedTo,
      subject: subject || '(No Subject)',
      date: new Date().toLocaleString(),
      read: true,
      body: body || ''
    };

    uData.mailboxes[normalizedFrom].sent.unshift(newMsg);
    this._saveUserData(cpanelUser, uData);

    // If recipient is also hosted locally on this server (any cpanelUser), deliver to their inbox!
    const all = this._readAll();
    for (const [u, userObj] of Object.entries(all.users)) {
      if (userObj.accounts && userObj.accounts.find(a => a.email.toLowerCase() === normalizedTo)) {
        if (!userObj.mailboxes) userObj.mailboxes = {};
        if (!userObj.mailboxes[normalizedTo]) {
          userObj.mailboxes[normalizedTo] = { inbox: [], sent: [], drafts: [], junk: [], trash: [] };
        }
        userObj.mailboxes[normalizedTo].inbox.unshift({
          ...newMsg,
          read: false
        });
        this._writeAll(all);
        break;
      }
    }

    return { success: true, message: newMsg };
  }

  deleteMail(email, folder, messageId, cpanelUser = 'cpanel_user') {
    const uData = this._getUserData(cpanelUser);
    const normalizedEmail = email.toLowerCase();
    const targetFolder = (folder || 'inbox').toLowerCase();

    if (!uData.mailboxes || !uData.mailboxes[normalizedEmail] || !uData.mailboxes[normalizedEmail][targetFolder]) {
      return { success: false, reason: 'Mailbox or folder not found' };
    }

    const msgIndex = uData.mailboxes[normalizedEmail][targetFolder].findIndex(m => m.id === messageId);
    if (msgIndex === -1) return { success: false, reason: 'Message not found' };

    const [removed] = uData.mailboxes[normalizedEmail][targetFolder].splice(msgIndex, 1);

    // If not already in trash, move to trash
    if (targetFolder !== 'trash') {
      if (!uData.mailboxes[normalizedEmail].trash) uData.mailboxes[normalizedEmail].trash = [];
      uData.mailboxes[normalizedEmail].trash.unshift(removed);
    }

    this._saveUserData(cpanelUser, uData);
    return { success: true, messageId };
  }

  markRead(email, folder, messageId, cpanelUser = 'cpanel_user') {
    const uData = this._getUserData(cpanelUser);
    const normalizedEmail = email.toLowerCase();
    const targetFolder = (folder || 'inbox').toLowerCase();

    if (!uData.mailboxes || !uData.mailboxes[normalizedEmail] || !uData.mailboxes[normalizedEmail][targetFolder]) {
      return { success: false };
    }

    const msg = uData.mailboxes[normalizedEmail][targetFolder].find(m => m.id === messageId);
    if (msg) {
      msg.read = true;
      this._saveUserData(cpanelUser, uData);
    }
    return { success: true };
  }
}

module.exports = new MailService();
