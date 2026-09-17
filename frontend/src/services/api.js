import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Attach active cPanel user and session context to all requests
client.interceptors.request.use((config) => {
  const activeUser = localStorage.getItem('cpanel_active_user') || sessionStorage.getItem('cpanel_active_user') || '';
  const sessionToken = localStorage.getItem('cpanel_session_token') || sessionStorage.getItem('cpanel_session_token') || '';
  if (activeUser) config.headers['X-cPanel-User'] = activeUser;
  if (sessionToken) config.headers['X-cPanel-Session'] = sessionToken;
  return config;
});

export const api = {
  // Auth
  login: (username, password) => client.post('/auth/login', { username, password }).then(r => r.data),
  register: (userData) => client.post('/auth/register', userData).then(r => r.data),
  logout: (token) => client.post('/auth/logout', { token }).then(r => r.data),
  getCurrentAuthUser: () => client.get('/auth/me').then(r => r.data),
  validateSession: (token, user) => client.get('/auth/validate-session', { params: { token, user } }).then(r => r.data),

  // Client Portal & Order Flow
  getClientDashboard: () => client.get('/client/dashboard').then(r => r.data),
  getClientPackages: () => client.get('/client/packages').then(r => r.data),
  validateDomain: (domain, option) => client.post('/client/validate-domain', { domain, option }).then(r => r.data),
  validateCoupon: (code, amount) => client.post('/client/validate-coupon', { code, amount }).then(r => r.data),
  getPaymentMethods: () => client.get('/client/payment-methods').then(r => r.data),
  createClientOrder: (orderData) => client.post('/client/orders', orderData).then(r => r.data),
  getClientOrders: () => client.get('/client/orders').then(r => r.data),
  getClientInvoices: () => client.get('/client/invoices').then(r => r.data),
  getClientServices: () => client.get('/client/services').then(r => r.data),
  getClientDomains: () => client.get('/client/domains').then(r => r.data),
  changeServicePassword: (serviceId, newPassword) => client.post(`/client/services/${serviceId}/change-password`, { newPassword }).then(r => r.data),
  getHostingInfo: (serviceId = null, domain = null) => client.get('/client/hosting-info', { params: { ...(serviceId ? { serviceId } : {}), ...(domain ? { domain } : {}) } }).then(r => r.data),
  getServiceDetails: (serviceId) => client.get(`/client/services/${serviceId}`).then(r => r.data),

  // Admin Management API
  getAdminDashboard: () => client.get('/admin/dashboard').then(r => r.data),
  getAdminHardwareMetrics: () => client.get('/admin/system/hardware').then(r => r.data),
  getAdminUsers: (search = '') => client.get(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(r => r.data),
  getAdminUserDetails: (id) => client.get(`/admin/users/${id}`).then(r => r.data),
  updateAdminUserDetails: (id, data) => client.put(`/admin/users/${id}`, data).then(r => r.data),
  resetAdminUserPassword: (id, newPassword) => client.post(`/admin/users/${id}/reset-password`, { newPassword }).then(r => r.data),
  updateAdminUserStatus: (id, status) => client.post(`/admin/users/${id}/status`, { status }).then(r => r.data),
  deleteAdminUser: (id) => client.delete(`/admin/users/${id}`).then(r => r.data),
  getAdminServices: () => client.get('/admin/services').then(r => r.data),
  updateAdminServiceStatus: (id, status, extendDays) => client.post(`/admin/services/${id}/status`, { status, extendDays }).then(r => r.data),
  getAdminDomains: () => client.get('/admin/domains').then(r => r.data),
  getAdminOrders: () => client.get('/admin/orders').then(r => r.data),
  approveAdminOrder: (id) => client.post(`/admin/orders/${id}/approve`).then(r => r.data),
  rejectAdminOrder: (id, reason) => client.post(`/admin/orders/${id}/reject`, { reason }).then(r => r.data),
  deleteAdminOrder: (id) => client.delete(`/admin/orders/${id}`).then(r => r.data),
  bulkDeleteAdminOrders: (orderIds) => client.post('/admin/orders/bulk-delete', { orderIds }).then(r => r.data),
  getAdminInvoices: () => client.get('/admin/invoices').then(r => r.data),
  verifyAdminInvoice: (id, trxId, notes) => client.post(`/admin/invoices/${id}/verify`, { trxId, notes }).then(r => r.data),
  deleteAdminInvoice: (id) => client.delete(`/admin/invoices/${id}`).then(r => r.data),
  bulkDeleteAdminInvoices: (invoiceIds) => client.post('/admin/invoices/bulk-delete', { invoiceIds }).then(r => r.data),
  getAdminPackages: () => client.get('/admin/packages').then(r => r.data),
  saveAdminPackage: (data) => client.post('/admin/packages', data).then(r => r.data),
  deleteAdminPackage: (id) => client.delete(`/admin/packages/${id}`).then(r => r.data),
  getAdminPromotions: () => client.get('/admin/promotions').then(r => r.data),
  saveAdminPromotion: (data) => client.post('/admin/promotions', data).then(r => r.data),
  deleteAdminPromotion: (id) => client.delete(`/admin/promotions/${id}`).then(r => r.data),
  getAdminIpBlocks: () => client.get('/admin/ip-blocks').then(r => r.data),
  blockAdminIp: (ip, scope, reason) => client.post('/admin/ip-blocks', { ip, scope, reason }).then(r => r.data),
  unblockAdminIp: (id) => client.delete(`/admin/ip-blocks/${id}`).then(r => r.data),
  getAdminGateways: () => client.get('/admin/gateways').then(r => r.data),
  toggleAdminGateway: (id, active) => client.post(`/admin/gateways/${id}/toggle`, { active }).then(r => r.data),
  getAdminAuditLogs: () => client.get('/admin/audit-logs').then(r => r.data),
  getAdminSettings: () => client.get('/admin/settings').then(r => r.data),
  updateAdminUploadLimit: (maxUploadSizeMb) => client.post('/admin/upload-limit', { maxUploadSizeMb }).then(r => r.data),
  getDatabaseStatus: () => client.get('/system/db-status').then(r => r.data),
  getDatabaseTables: () => client.get('/system/db-tables').then(r => r.data),

  // Accounts / WHM
  getAccounts: () => client.get('/whm/accounts').then(r => r.data),

  // System / Metrics
  getSystemStats: () => client.get('/metrics/system').then(r => r.data),
  getErrorLogs: () => client.get('/metrics/logs').then(r => r.data),
  getVisitorMetrics: () => client.get('/metrics/visitors').then(r => r.data),

  // Files
  getUploadLimit: () => client.get('/files/upload-limit').then(r => r.data),
  listFiles: (path = 'public_html') => client.get(`/files/list?path=${encodeURIComponent(path)}`).then(r => r.data),
  readFile: (path) => client.get(`/files/read?path=${encodeURIComponent(path)}`).then(r => r.data),
  saveFile: (path, content) => client.post('/files/save', { path, content }).then(r => r.data),
  createFolder: (path) => client.post('/files/folder', { path }).then(r => r.data),
  createFile: (path, content = '') => client.post('/files/file', { path, content }).then(r => r.data),
  deleteItem: (pathOrPaths) => client.post('/files/delete', Array.isArray(pathOrPaths) ? { paths: pathOrPaths } : { path: pathOrPaths }).then(r => r.data),
  renameItem: (oldPath, newName) => client.post('/files/rename', { oldPath, newName }).then(r => r.data),
  copyItem: (sources, targetDir, conflictStrategy = 'replace') => client.post('/files/copy', { sources: Array.isArray(sources) ? sources : [sources], targetDir, conflictStrategy }).then(r => r.data),
  moveItem: (sources, targetDir, conflictStrategy = 'replace') => client.post('/files/move', { sources: Array.isArray(sources) ? sources : [sources], targetDir, conflictStrategy }).then(r => r.data),
  searchFiles: (query, path = '') => client.get(`/files/search?q=${encodeURIComponent(query)}&path=${encodeURIComponent(path)}`).then(r => r.data),
  getFileInfo: (path) => client.get(`/files/info?path=${encodeURIComponent(path)}`).then(r => r.data),
  changePermissions: (path, mode) => client.post('/files/permissions', { path, mode }).then(r => r.data),
  compress: (items, zipName, targetDir) => client.post('/files/compress', { items, zipName, targetDir }).then(r => r.data),
  extract: (zipPath, targetDir) => client.post('/files/extract', { zipPath, targetDir }).then(r => r.data),
  uploadFile: (formData, path = 'public_html', onUploadProgress) => client.post(`/files/upload?path=${encodeURIComponent(path)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0, // Infinite/no-timeout for large uploads (2GB, 3GB, etc.)
    onUploadProgress
  }).then(r => r.data),
  getDownloadUrl: (path) => `${API_BASE_URL}/files/download?path=${encodeURIComponent(path)}`,
  getPreviewUrl: (path) => `${API_BASE_URL}/files/preview?path=${encodeURIComponent(path)}`,

  // Images
  listImages: (path = 'public_html') => client.get(`/images/list?path=${encodeURIComponent(path)}`).then(r => r.data),
  getImageDirectories: () => client.get('/images/directories').then(r => r.data),
  getImageMetadata: (path) => client.get(`/images/metadata?path=${encodeURIComponent(path)}`).then(r => r.data),
  getThumbnailUrl: (path, w = 200, h = 200) => `${API_BASE_URL}/images/thumbnail?path=${encodeURIComponent(path)}&w=${w}&h=${h}`,
  getImagePreviewUrl: (path) => `${API_BASE_URL}/images/view?path=${encodeURIComponent(path)}`,
  getImageDownloadUrl: (path) => `${API_BASE_URL}/images/download?path=${encodeURIComponent(path)}`,
  resizeImage: (data) => client.post('/images/resize', data).then(r => r.data),
  convertImage: (data) => client.post('/images/convert', data).then(r => r.data),
  optimizeImage: (data) => client.post('/images/optimize', data).then(r => r.data),
  deleteImage: (path) => client.post('/images/delete', { path }).then(r => r.data),
  renameImage: (oldPath, newName) => client.post('/images/rename', { oldPath, newName }).then(r => r.data),

  // Directory Privacy
  getPrivacyDirectories: () => client.get('/privacy/directories').then(r => r.data),
  getDirectoryPrivacyStatus: (path = 'public_html') => client.get(`/privacy/status?path=${encodeURIComponent(path)}`).then(r => r.data),
  setDirectoryPrivacyProtection: (path, enabled, authName) => client.post('/privacy/protect', { path, enabled, authName }).then(r => r.data),
  addPrivacyUser: (path, username, password) => client.post('/privacy/user/add', { path, username, password }).then(r => r.data),
  changePrivacyUserPassword: (path, username, newPassword) => client.post('/privacy/user/password', { path, username, newPassword }).then(r => r.data),
  deletePrivacyUser: (path, username) => client.post('/privacy/user/delete', { path, username }).then(r => r.data),

  // Disk Usage
  getDiskUsageSummary: (force = false) => client.get('/disk-usage', { params: { force } }).then(r => r.data),
  getDiskUsageDirectory: (path) => client.get('/disk-usage/directory', { params: { path } }).then(r => r.data),
  refreshDiskUsage: () => client.post('/disk-usage/refresh').then(r => r.data),

  // Web Disk
  getWebDiskAccounts: () => client.get('/webdisk/accounts').then(r => r.data),
  getWebDiskStatus: () => client.get('/webdisk/status').then(r => r.data),
  getWebDiskDirectories: () => client.get('/webdisk/directories').then(r => r.data),
  createWebDiskAccount: (data) => client.post('/webdisk/create', data).then(r => r.data),
  changeWebDiskPassword: (data) => client.post('/webdisk/password', data).then(r => r.data),
  toggleWebDiskStatus: (data) => client.post('/webdisk/toggle', data).then(r => r.data),
  deleteWebDiskAccount: (data) => client.post('/webdisk/delete', data).then(r => r.data),
  testWebDiskConnection: (data) => client.post('/webdisk/test', data).then(r => r.data),

  // Databases (Manage My Databases)
  getDatabases: (user) => client.get('/databases', { params: { user } }).then(r => r.data),
  createDatabase: (data) => client.post('/databases/create', typeof data === 'string' ? { name: data } : data).then(r => r.data),
  deleteDatabase: (name) => client.post('/databases/delete', { name }).then(r => r.data),
  checkDatabase: (name) => client.post('/databases/check', { name }).then(r => r.data),
  repairDatabase: (name) => client.post('/databases/repair', { name }).then(r => r.data),
  createUser: (username, password) => client.post('/databases/user', { username, password }).then(r => r.data),
  changeDatabaseUserPassword: (username, password) => client.post('/databases/user/password', { username, password }).then(r => r.data),
  deleteDatabaseUser: (username) => client.post('/databases/user/delete', { username }).then(r => r.data),
  assignUser: (username, database, privileges) => client.post('/databases/assign', { username, database, privileges }).then(r => r.data),
  revokeDatabaseUser: (username, database) => client.post('/databases/revoke', { username, database }).then(r => r.data),
  getDatabasePrivileges: (username, database) => client.get('/databases/privileges', { params: { username, database } }).then(r => r.data),
  getTables: (db) => client.get(`/databases/tables?db=${encodeURIComponent(db)}`).then(r => r.data),
  executeSqlQuery: (database, query) => client.post('/databases/query', { database, query }).then(r => r.data),
  getDatabaseServerStatus: () => client.get('/databases/server-status').then(r => r.data),
  updateDatabaseConfig: (config) => client.post('/databases/config', config).then(r => r.data),

  // Database Wizard (cPanel Guided Setup)
  validateWizardDb: (data) => client.post('/database-wizard/validate-db', data).then(r => r.data),
  createWizardDb: (data) => client.post('/database-wizard/create-db', data).then(r => r.data),
  validateWizardUser: (data) => client.post('/database-wizard/validate-user', data).then(r => r.data),
  createWizardUser: (data) => client.post('/database-wizard/create-user', data).then(r => r.data),
  assignWizardUser: (data) => client.post('/database-wizard/assign', data).then(r => r.data),
  verifyWizardSetup: (db, user, accountUser) => client.get('/database-wizard/verify', { params: { db, user, accountUser } }).then(r => r.data),

  // Remote Database Access (cPanel Real Access Grants)
  getRemoteCapabilities: (user) => client.get('/databases/remote/capabilities', { params: { user } }).then(r => r.data),
  getRemoteHosts: (user) => client.get('/databases/remote/hosts', { params: { user } }).then(r => r.data),
  validateRemoteHost: (host) => client.post('/databases/remote/validate', { host }).then(r => r.data),
  addRemoteHost: (data) => client.post('/databases/remote/hosts', data).then(r => r.data),
  deleteRemoteHost: (data) => client.post('/databases/remote/delete', typeof data === 'string' ? { id: data } : data).then(r => r.data),
  testRemoteHost: (host) => client.post('/databases/remote/test', { host }).then(r => r.data),

  // Domains & Hosting
  getDomains: () => client.get('/domains').then(r => r.data),
  getUnifiedDomains: (q, filter) => client.get('/domains/unified', { params: { q, filter } }).then(r => r.data),
  getDomainDetails: (domain) => client.get('/domains/details', { params: { domain } }).then(r => r.data),
  checkDomainName: (name) => client.post('/domains/check-name', { name }).then(r => r.data),
  createDomainExtended: (data) => client.post('/domains/create', data).then(r => r.data),
  updateDomainConfig: (domain, updates) => client.post('/domains/update', { domain, updates }).then(r => r.data),
  toggleDomainForceHttps: (domain, enabled) => client.post('/domains/force-https', { domain, enabled }).then(r => r.data),
  preDeleteDomainCheck: (name) => client.post('/domains/pre-delete', { name }).then(r => r.data),
  addDomain: (name, documentRoot, type) => client.post('/domains/add', { name, documentRoot, type }).then(r => r.data),
  deleteDomain: (name) => client.post('/domains/delete', { name }).then(r => r.data),
  addSubdomain: (sub, domain, documentRoot) => client.post('/domains/subdomain', { sub, domain, documentRoot }).then(r => r.data),
  deleteSubdomain: (name) => client.post('/domains/subdomain/delete', { name }).then(r => r.data),
  addAlias: (name, targetDomain) => client.post('/domains/alias', { name, targetDomain }).then(r => r.data),
  deleteAlias: (name) => client.post('/domains/alias/delete', { name }).then(r => r.data),
  addRedirect: (type, sourceUrl, destUrl, wildcard) => client.post('/domains/redirect', { type, sourceUrl, destUrl, wildcard }).then(r => r.data),
  deleteRedirect: (sourceUrl) => client.post('/domains/redirect/delete', { sourceUrl }).then(r => r.data),
  addDnsRecord: (name, type, record, ttl, priority) => client.post('/domains/dns', { name, type, record, ttl, priority }).then(r => r.data),
  deleteDnsRecord: (id) => client.post('/domains/dns/delete', { id }).then(r => r.data),

  // Hosting Security & Protection
  getHostingFeatures: () => client.get('/domains/hosting-features').then(r => r.data),
  setDirectoryPrivacy: (dirPath, enabled, username, password) => client.post('/domains/directory-privacy', { dirPath, enabled, username, password }).then(r => r.data),
  blockIp: (ip, reason) => client.post('/domains/ip-blocker', { ip, reason }).then(r => r.data),
  unblockIp: (ip) => client.post('/domains/ip-blocker/delete', { ip }).then(r => r.data),
  toggleHotlink: (enabled, allowedExtensions) => client.post('/domains/hotlink', { enabled, allowedExtensions }).then(r => r.data),
  addFtpAccount: (user, domain, password, dir, quota) => client.post('/domains/ftp', { user, domain, password, dir, quota }).then(r => r.data),
  deleteFtpAccount: (user) => client.post('/domains/ftp/delete', { user }).then(r => r.data),

  // Database phpMyAdmin SSO
  createPhpMyAdminSession: (dbName) => client.post('/databases/phpmyadmin/session', { dbName }).then(r => r.data),

  // Email & Webmail SSO
  getEmailData: () => client.get('/email').then(r => r.data),
  createEmailAccount: (user, domain, password, quota) => client.post('/email/account', { user, domain, password, quota }).then(r => r.data),
  deleteEmailAccount: (email) => client.post('/email/account/delete', { email }).then(r => r.data),
  changeEmailPassword: (email, password) => client.post('/email/account/change-password', { email, password }).then(r => r.data),
  updateEmailQuota: (email, quota) => client.post('/email/account/quota', { email, quota }).then(r => r.data),
  addForwarder: (source, destination) => client.post('/email/forwarder', { source, destination }).then(r => r.data),
  deleteForwarder: (source, destination) => client.post('/email/forwarder/delete', { source, destination }).then(r => r.data),
  addAutoresponder: (email, from, subject, body) => client.post('/email/autoresponder', { email, from, subject, body }).then(r => r.data),
  createWebmailSession: (email) => client.post('/email/webmail/session', { email }).then(r => r.data),
  getWebmailMailbox: (email, folder) => client.get('/email/webmail/mailbox', { params: { email, folder } }).then(r => r.data),
  sendWebmailMail: (from, to, subject, body) => client.post('/email/webmail/send', { from, to, subject, body }).then(r => r.data),
  deleteWebmailMail: (email, folder, messageId) => client.post('/email/webmail/delete', { email, folder, messageId }).then(r => r.data),
  markWebmailRead: (email, folder, messageId) => client.post('/email/webmail/mark-read', { email, folder, messageId }).then(r => r.data),

  // Auth & Session
  validateSession: (token, user) => client.get('/auth/validate-session', { params: { token, user } }).then(r => r.data),

  // PHP
  getPhpConfig: () => client.get('/php').then(r => r.data),
  updateDomainPhp: (domain, version) => client.post('/php/domain', { domain, version }).then(r => r.data),
  updatePhpIni: (directives) => client.post('/php/ini', { directives }).then(r => r.data),

  // SSL/TLS Certificates (Feature #37)
  getSslStatus: () => client.get('/ssl').then(r => r.data),
  runAutoSsl: (user) => client.post('/ssl/autossl', { cpanelUser: user }).then(r => r.data),
  toggleForceHttps: (enabled) => client.post('/ssl/force-https', { enabled }).then(r => r.data),
  getSslCapabilities: () => client.get('/ssl/capabilities').then(r => r.data),
  getSslInventory: (user) => client.get('/ssl/inventory', { params: { user } }).then(r => r.data),
  getSslDetails: (domain, certId, user) => client.get('/ssl/details', { params: { domain, certId, user } }).then(r => r.data),
  installSslCertificate: (data) => client.post('/ssl/install', data).then(r => r.data),
  renewSslCertificate: (domain, user) => client.post('/ssl/renew', { domain, cpanelUser: user }).then(r => r.data),
  generateSslCsr: (data) => client.post('/ssl/generate-csr', data).then(r => r.data),
  removeSslCertificate: (domain, certId, user) => client.post('/ssl/remove', { domain, certId, cpanelUser: user }).then(r => r.data),
  verifySslTls: (domain, user) => client.get('/ssl/verify-tls', { params: { domain, user } }).then(r => r.data),

  // Manage API Tokens (Feature #38)
  getApiTokens: (user) => client.get('/tokens/list', { params: { user } }).then(r => r.data),
  getAvailableTokenScopes: () => client.get('/tokens/available-scopes').then(r => r.data),
  createApiToken: (data) => client.post('/tokens/create', data).then(r => r.data),
  revokeApiToken: (tokenId, user) => client.post('/tokens/revoke', { tokenId, cpanelUser: user }).then(r => r.data),
  testApiTokenAuth: (token) => client.get('/tokens/test-auth', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.data),

  // Cron
  getCronJobs: () => client.get('/cron').then(r => r.data),
  addCronJob: (job) => client.post('/cron/add', job).then(r => r.data),
  editCronJob: (id, updates) => client.post('/cron/edit', { id, updates }).then(r => r.data),
  deleteCronJob: (id) => client.post('/cron/delete', { id }).then(r => r.data),
  testCronJob: (id) => client.post('/cron/test', { id }).then(r => r.data),

  // Backups (cPanel Real Backup & Restore Engine)
  getBackups: (user) => client.get('/backup/list', { params: { user } }).then(r => r.data),
  createBackup: (data) => client.post('/backup/create', data || {}).then(r => r.data),
  getBackupStatus: (id, user) => client.get(`/backup/status/${id}`, { params: { user } }).then(r => r.data),
  getBackupDetails: (id, user) => client.get(`/backup/details/${id}`, { params: { user } }).then(r => r.data),
  restoreBackup: (data) => client.post('/backup/restore', data).then(r => r.data),
  deleteBackup: (data) => client.post('/backup/delete', typeof data === 'string' ? { backupId: data } : data).then(r => r.data),

  // Backup Wizard (cPanel Guided Backup & Restore Wizard)
  getBackupWizardCapabilities: (user) => client.get('/backup-wizard/capabilities', { params: { user } }).then(r => r.data),
  validateBackupWizard: (data) => client.post('/backup-wizard/validate', data).then(r => r.data),
  cancelBackupJob: (data) => client.post('/backup-wizard/cancel', typeof data === 'string' ? { jobId: data } : data).then(r => r.data),

  // File and Directory Restoration (cPanel Jupiter Real Implementation)
  getRestoreBackups: (user) => client.get('/restore/backups', { params: { user } }).then(r => r.data),
  getRestoreBackupContents: (backupId, user) => client.get('/restore/contents', { params: { backupId, user } }).then(r => r.data),
  validateFileRestore: (data) => client.post('/restore/validate', data).then(r => r.data),
  startFileRestoreJob: (data) => client.post('/restore/job', data).then(r => r.data),
  getFileRestoreJobStatus: (jobId, user) => client.get(`/restore/job/${jobId}`, { params: { user } }).then(r => r.data),
  cancelFileRestoreJob: (data) => client.post('/restore/cancel', typeof data === 'string' ? { jobId: data } : data).then(r => r.data),

  // Softaculous
  getAvailableApps: () => client.get('/apps/available').then(r => r.data),
  getInstalledApps: () => client.get('/apps/installed').then(r => r.data),
  installApp: (options) => client.post('/apps/install', options).then(r => r.data),
  deleteInstalledApp: (id) => client.post('/apps/delete', { id }).then(r => r.data),

  // Git™ Version Control (cPanel Real Implementation)
  getGitCapabilities: () => client.get('/git/capabilities').then(r => r.data),
  getGitRepos: (user) => client.get('/git/list', { params: { user } }).then(r => r.data),
  createGitRepo: (data) => client.post('/git/create', data).then(r => r.data),
  cloneGitRepo: (data) => client.post('/git/clone', data).then(r => r.data),
  getGitRepoDetails: (params) => client.get('/git/details', { params }).then(r => r.data),
  getGitStatus: (params) => client.get('/git/status', { params }).then(r => r.data),
  getGitBranches: (params) => client.get('/git/branches', { params }).then(r => r.data),
  createGitBranch: (data) => client.post('/git/branch/create', data).then(r => r.data),
  checkoutGitBranch: (data) => client.post('/git/branch/checkout', data).then(r => r.data),
  getGitCommits: (params) => client.get('/git/commits', { params }).then(r => r.data),
  createGitCommit: (data) => client.post('/git/commit', data).then(r => r.data),
  getGitRemotes: (params) => client.get('/git/remotes', { params }).then(r => r.data),
  addGitRemote: (data) => client.post('/git/remote/add', data).then(r => r.data),
  removeGitRemote: (data) => client.post('/git/remote/remove', data).then(r => r.data),
  fetchGitRepo: (data) => client.post('/git/fetch', data).then(r => r.data),
  pullGitRepo: (data) => client.post('/git/pull', typeof data === 'string' ? { repoId: data } : data).then(r => r.data),
  pushGitRepo: (data) => client.post('/git/push', data).then(r => r.data),
  deployGitRepo: (data) => client.post('/git/deploy', data).then(r => r.data),
  deleteGitRepo: (data) => client.post('/git/delete', typeof data === 'string' ? { repoId: data } : data).then(r => r.data),

  // FTP Accounts (cPanel RFC 959 Protocol)
  getFtpCapabilities: () => client.get('/ftp/capabilities').then(r => r.data),
  getFtpAccounts: (user) => client.get('/ftp/accounts', { params: { user } }).then(r => r.data),
  getFtpDirectories: (user) => client.get('/ftp/directories', { params: { user } }).then(r => r.data),
  createFtpAccount: (data) => client.post('/ftp/accounts', data).then(r => r.data),
  changeFtpPassword: (data) => client.post('/ftp/accounts/password', data).then(r => r.data),
  changeFtpQuota: (data) => client.post('/ftp/accounts/quota', data).then(r => r.data),
  changeFtpDirectory: (data) => client.post('/ftp/accounts/directory', data).then(r => r.data),
  toggleFtpStatus: (data) => client.post('/ftp/accounts/toggle', data).then(r => r.data),
  deleteFtpAccount: (data) => client.post('/ftp/accounts/delete', data).then(r => r.data),
  testFtpConnection: (data) => client.post('/ftp/accounts/test', data).then(r => r.data),
  getFtpConnectionInfo: (params) => client.get('/ftp/accounts/connection-info', { params }).then(r => r.data),

  // JetBackup® 5 (cPanel Disaster Recovery & Backup Management)
  getJetBackupCapabilities: () => client.get('/jetbackup/capabilities').then(r => r.data),
  getJetBackupOverview: (user) => client.get('/jetbackup/overview', { params: { user } }).then(r => r.data),
  getJetBackupPoints: (params) => client.get('/jetbackup/points', { params }).then(r => r.data),
  getJetBackupContents: (backupId, user) => client.get('/jetbackup/contents', { params: { backupId, user } }).then(r => r.data),
  validateJetDatabaseRestore: (data) => client.post('/jetbackup/restore/database/validate', data).then(r => r.data),
  restoreJetDatabase: (data) => client.post('/jetbackup/restore/database', data).then(r => r.data),
  restoreJetEmail: (data) => client.post('/jetbackup/restore/email', data).then(r => r.data),
  getJetDestinations: () => client.get('/jetbackup/destinations').then(r => r.data),
  testJetDestination: (destinationId) => client.post('/jetbackup/destinations/test', { destinationId }).then(r => r.data),
  getJetSchedules: () => client.get('/jetbackup/schedules').then(r => r.data),
  runJetSchedule: (scheduleId, user) => client.post('/jetbackup/schedules/run', { scheduleId, user }).then(r => r.data),
  getJetJobs: (user) => client.get('/jetbackup/jobs', { params: { user } }).then(r => r.data),
  getJetJobDetails: (id, user) => client.get(`/jetbackup/job/${id}`, { params: { user } }).then(r => r.data),
  cancelJetJob: (jobId, user) => client.post('/jetbackup/job/cancel', { jobId, user }).then(r => r.data),
  getJetDownloadUrl: (id) => `${API_BASE_URL}/jetbackup/download/${id}`,

  // phpMyAdmin (cPanel Real Database Management & SQL Runner)
  getPhpMyAdminStatus: () => client.get('/phpmyadmin/status').then(r => r.data),
  getPhpMyAdminDatabases: (user) => client.get('/phpmyadmin/databases', { params: { user } }).then(r => r.data),
  getPhpMyAdminTables: (db, user) => client.get('/phpmyadmin/tables', { params: { db, user } }).then(r => r.data),
  getPhpMyAdminStructure: (db, table, user) => client.get('/phpmyadmin/structure', { params: { db, table, user } }).then(r => r.data),
  browsePhpMyAdminTable: (params) => client.get('/phpmyadmin/browse', { params }).then(r => r.data),
  executePhpMyAdminQuery: (data) => client.post('/phpmyadmin/query', data).then(r => r.data),
  importPhpMyAdminSql: (data) => client.post('/phpmyadmin/import', data).then(r => r.data),
  getPhpMyAdminExportUrl: (db, structure = true, data = true) => `${API_BASE_URL}/phpmyadmin/export?db=${encodeURIComponent(db)}&structure=${structure}&data=${data}`,
  createPhpMyAdminSession: (dbName, user) => client.post('/phpmyadmin/session', { dbName, user }).then(r => r.data),

  // WordPress Management (Domains -> WordPress Management)
  getWordPressInstallations: (user) => client.get('/wordpress/installations', { params: { user } }).then(r => r.data),
  getWordPressDetails: (path, user) => client.get('/wordpress/installation', { params: { path, user } }).then(r => r.data),
  scanWordPress: (user) => client.post('/wordpress/scan', { cpanelUser: user }).then(r => r.data),
  updateWordPressConfig: (data) => client.post('/wordpress/update-config', data).then(r => r.data),
  toggleWordPressMaintenance: (data) => client.post('/wordpress/toggle-maintenance', data).then(r => r.data),

  // Sitejet Builder (Domains -> Sitejet Builder)
  getSitejetCapabilities: (user) => client.get('/sitejet/capabilities', { params: { user } }).then(r => r.data),
  getSitejetSites: (user) => client.get('/sitejet/sites', { params: { user } }).then(r => r.data),
  getSitejetTemplates: () => client.get('/sitejet/templates').then(r => r.data),
  createSitejetProject: (data) => client.post('/sitejet/create', data).then(r => r.data),
  openSitejetBuilder: (data) => client.post('/sitejet/open', data).then(r => r.data),
  publishSitejetSite: (data) => client.post('/sitejet/publish', data).then(r => r.data),
  unlinkSitejetProject: (data) => client.post('/sitejet/unlink', data).then(r => r.data),
  refreshSitejetStatus: (data) => client.post('/sitejet/refresh', data).then(r => r.data),

  // Social Media Management (Domains -> Social Media Management)
  getSocialCapabilities: (user) => client.get('/social/capabilities', { params: { user } }).then(r => r.data),
  getSocialConnections: (user) => client.get('/social/connections', { params: { user } }).then(r => r.data),
  initSocialConnect: (data) => client.post('/social/connect', data).then(r => r.data),
  handleSocialOAuthCallback: (data) => client.post('/social/oauth/callback', data).then(r => r.data),
  disconnectSocialChannel: (data) => client.post('/social/disconnect', data).then(r => r.data),
  refreshSocialConnection: (data) => client.post('/social/refresh', data).then(r => r.data),
  publishSocialPost: (data) => client.post('/social/publish', data).then(r => r.data),
  getSocialPosts: (user) => client.get('/social/posts', { params: { user } }).then(r => r.data),
  cancelSocialPost: (data) => client.post('/social/posts/cancel', data).then(r => r.data),

  // Redirects (Feature #21)
  getRedirects: (user) => client.get('/redirects', { params: { user } }).then(r => r.data),
  getRedirectDomains: (user) => client.get('/redirects/domains', { params: { user } }).then(r => (r.data.domains || r.data)),
  getRedirectById: (id, user) => client.get(`/redirects/${id}`, { params: { user } }).then(r => r.data),
  createRedirect: (data) => client.post('/redirects', data).then(r => r.data),
  updateRedirect: (id, data) => client.put(`/redirects/${id}`, data).then(r => r.data),
  deleteRedirectExtended: (id, user) => client.delete(`/redirects/${id}`, { params: { user } }).then(r => r.data),
  toggleRedirectStatus: (id, data) => client.post(`/redirects/${id}/toggle`, data || {}).then(r => r.data),
  testRedirect: (id, data) => client.post(`/redirects/${id}/test`, data || {}).then(r => r.data),

  // Zone Editor (Feature #22)
  getDnsZones: (user) => client.get('/dns/zones', { params: { user } }).then(r => r.data),
  getDnsZone: (domain, user) => client.get('/dns/zone', { params: { domain, user } }).then(r => r.data),
  addDnsZoneRecord: (data) => client.post('/dns/records', data).then(r => r.data),
  updateDnsZoneRecord: (id, data) => client.put(`/dns/records/${id}`, data).then(r => r.data),
  deleteDnsZoneRecord: (id, domain, user) => client.delete(`/dns/records/${id}`, { params: { domain, user } }).then(r => r.data),
  resetDnsZone: (domain, user) => client.post('/dns/zone/reset', { domain, cpanelUser: user }).then(r => r.data),
  exportDnsZone: (domain, user) => client.get('/dns/zone/export', { params: { domain, user } }).then(r => r.data),
  lookupDns: (hostname, type) => client.post('/dns/lookup', { hostname, type }).then(r => r.data),

  // Dynamic DNS (Feature #23)
  getDdnsEntries: (user) => client.get('/ddns', { params: { user } }).then(r => r.data),
  getDdnsEntry: (id, user) => client.get(`/ddns/${id}`, { params: { user } }).then(r => r.data),
  detectDdnsIp: () => client.get('/ddns/detect-ip').then(r => r.data),
  createDdnsEntry: (data) => client.post('/ddns', data).then(r => r.data),
  updateDdnsEntry: (id, data) => client.put(`/ddns/${id}`, data).then(r => r.data),
  toggleDdnsStatus: (id, user) => client.post(`/ddns/${id}/toggle`, { cpanelUser: user }).then(r => r.data),
  regenerateDdnsToken: (id, user) => client.post(`/ddns/${id}/regenerate-token`, { cpanelUser: user }).then(r => r.data),
  deleteDdnsEntry: (id, deleteDnsRecord, user) => client.delete(`/ddns/${id}`, { params: { deleteDnsRecord, user } }).then(r => r.data),

  // Visitors Metrics (Feature #24)
  getVisitorDomains: (user) => client.get('/visitors/domains', { params: { user } }).then(r => r.data),
  getVisitorOverview: (params) => client.get('/visitors/overview', { params }).then(r => r.data),
  getVisitorRecords: (params) => client.get('/visitors/records', { params }).then(r => r.data),

  // Site Quality Monitoring (Feature #25)
  getSiteQualityDomains: (user) => client.get('/site-quality/domains', { params: { user } }).then(r => r.data),
  getSiteQualityMonitors: (user) => client.get('/site-quality/monitors', { params: { user } }).then(r => r.data),
  getSiteQualityMonitorDetails: (id, user) => client.get(`/site-quality/monitors/${id}`, { params: { user } }).then(r => r.data),
  createSiteQualityMonitor: (data, user) => client.post('/site-quality/monitors', { ...data, cpanelUser: user }).then(r => r.data),
  checkSiteQualityNow: (id, user) => client.post(`/site-quality/monitors/${id}/check`, { cpanelUser: user }).then(r => r.data),
  toggleSiteQualityPause: (id, user) => client.post(`/site-quality/monitors/${id}/toggle`, { cpanelUser: user }).then(r => r.data),
  deleteSiteQualityMonitor: (id, user) => client.delete(`/site-quality/monitors/${id}`, { params: { user } }).then(r => r.data),

  // Errors Metrics (Feature #26)
  getErrorDomains: (user) => client.get('/errors/domains', { params: { user } }).then(r => r.data),
  getErrorSummary: (params) => client.get('/errors/summary', { params }).then(r => r.data),
  getErrorEntries: (params) => client.get('/errors/entries', { params }).then(r => r.data),
  getErrorContext: (params) => client.get('/errors/context', { params }).then(r => r.data),
  logErrorEntry: (data) => client.post('/errors/log', data).then(r => r.data),

  // Bandwidth Metrics (Feature #27)
  getBandwidthSummary: (params) => client.get('/bandwidth/summary', { params }).then(r => r.data),
  getBandwidthDomains: (params) => client.get('/bandwidth/domains', { params }).then(r => r.data),
  getBandwidthTimeline: (params) => client.get('/bandwidth/timeline', { params }).then(r => r.data),
  getBandwidthHourly: (params) => client.get('/bandwidth/hourly', { params }).then(r => r.data),
  refreshBandwidth: (data) => client.post('/bandwidth/refresh', data || {}).then(r => r.data),

  // Raw Access Logs (Feature #28)
  getRawAccessInventory: (params) => client.get('/raw-access/inventory', { params }).then(r => r.data),
  getRawAccessPreview: (logId, params) => client.get(`/raw-access/preview/${encodeURIComponent(logId)}`, { params }).then(r => r.data),
  getRawAccessConfig: (params) => client.get('/raw-access/config', { params }).then(r => r.data),
  updateRawAccessConfig: (data) => client.post('/raw-access/config', data).then(r => r.data),

  // Awstats Web Analytics (Feature #29)
  getAwstatsCapabilities: () => client.get('/awstats/capabilities').then(r => r.data),
  getAwstatsDomains: (user) => client.get('/awstats/domains', { params: { user } }).then(r => r.data),
  getAwstatsPeriods: (params) => client.get('/awstats/periods', { params }).then(r => r.data),
  getAwstatsReport: (params) => client.get('/awstats/report', { params }).then(r => r.data),
  refreshAwstats: (data) => client.post('/awstats/refresh', data || {}).then(r => r.data),

  // Analog Stats (Feature #30)
  getAnalogCapabilities: () => client.get('/analog/capabilities').then(r => r.data),
  getAnalogDomains: (user) => client.get('/analog/domains', { params: { user } }).then(r => r.data),
  getAnalogPeriods: (params) => client.get('/analog/periods', { params }).then(r => r.data),
  getAnalogReport: (params) => client.get('/analog/report', { params }).then(r => r.data),
  refreshAnalog: (data) => client.post('/analog/refresh', data || {}).then(r => r.data),

  // Webalizer (Feature #31)
  getWebalizerCapabilities: () => client.get('/webalizer/capabilities').then(r => r.data),
  getWebalizerDomains: (user) => client.get('/webalizer/domains', { params: { user } }).then(r => r.data),
  getWebalizerPeriods: (params) => client.get('/webalizer/periods', { params }).then(r => r.data),
  getWebalizerReport: (params) => client.get('/webalizer/report', { params }).then(r => r.data),
  refreshWebalizer: (data) => client.post('/webalizer/refresh', data || {}).then(r => r.data),

  // Webalizer FTP (Feature #32)
  getWebalizerFtpCapabilities: () => client.get('/webalizer-ftp/capabilities').then(r => r.data),
  getWebalizerFtpAccounts: (user) => client.get('/webalizer-ftp/accounts', { params: { user } }).then(r => r.data),
  getWebalizerFtpPeriods: (params) => client.get('/webalizer-ftp/periods', { params }).then(r => r.data),
  getWebalizerFtpReport: (params) => client.get('/webalizer-ftp/report', { params }).then(r => r.data),
  refreshWebalizerFtp: (data) => client.post('/webalizer-ftp/refresh', data || {}).then(r => r.data),

  // Metrics Editor (Feature #33)
  getMetricsEditorCapabilities: () => client.get('/metrics-editor/capabilities').then(r => r.data),
  getMetricsEditorConfig: (user) => client.get('/metrics-editor/config', { params: { user } }).then(r => r.data),
  updateMetricsEditorConfig: (data) => client.post('/metrics-editor/config', data || {}).then(r => r.data),
  resetMetricsEditorConfig: (data) => client.post('/metrics-editor/reset', data || {}).then(r => r.data),
  getMetricsEditorAudit: (user) => client.get('/metrics-editor/audit', { params: { user } }).then(r => r.data),

  // Resource Usage (Feature #34)
  getResourceUsageCapabilities: () => client.get('/resource-usage/capabilities').then(r => r.data),
  getCurrentResourceUsage: (user) => client.get('/resource-usage/current', { params: { user } }).then(r => r.data),
  getResourceUsageHistory: (params) => client.get('/resource-usage/history', { params }).then(r => r.data),
  recordResourceUsageSnapshot: (data) => client.post('/resource-usage/snapshot', data || {}).then(r => r.data),
  getResourceUsageFaults: (params) => client.get('/resource-usage/faults', { params }).then(r => r.data),

  // SSH Access (Feature #35)
  getSshAccessStatus: (user) => client.get('/ssh-access/status', { params: { user } }).then(r => r.data),
  getSshKeys: (user) => client.get('/ssh-access/keys', { params: { user } }).then(r => r.data),
  generateSshKey: (data) => client.post('/ssh-access/keys/generate', data || {}).then(r => r.data),
  importSshKey: (data) => client.post('/ssh-access/keys/import', data || {}).then(r => r.data),
  authorizeSshKey: (data) => client.post('/ssh-access/keys/authorize', data || {}).then(r => r.data),
  deauthorizeSshKey: (data) => client.post('/ssh-access/keys/deauthorize', data || {}).then(r => r.data),
  deleteSshKey: (data) => client.post('/ssh-access/keys/delete', data || {}).then(r => r.data),
  getSshPublicKey: (keyId, user) => client.get(`/ssh-access/keys/${encodeURIComponent(keyId)}/public`, { params: { user } }).then(r => r.data),
  testSshConnection: (user) => client.get('/ssh-access/test-connection', { params: { user } }).then(r => r.data),

  // IP Blocker (Feature #36)
  getIpBlockerCapabilities: () => client.get('/ip-blocker/capabilities').then(r => r.data),
  getBlockedIps: (user) => client.get('/ip-blocker/list', { params: { user } }).then(r => r.data),
  addBlockedIp: (data) => client.post('/ip-blocker/block', data || {}).then(r => r.data),
  removeBlockedIp: (data) => client.post('/ip-blocker/unblock', data || {}).then(r => r.data),
  syncIpBlocker: (data) => client.post('/ip-blocker/sync', data || {}).then(r => r.data),
  verifyIpAccess: (params) => client.get('/ip-blocker/verify-access', { params }).then(r => r.data),

  // Hotlink Protection (Feature #39)
  getHotlinkCapabilities: () => client.get('/hotlink/capabilities').then(r => r.data),
  getHotlinkConfig: (user) => client.get('/hotlink/config', { params: { user } }).then(r => r.data),
  saveHotlinkConfig: (data) => client.post('/hotlink/save', data).then(r => r.data),
  toggleHotlinkProtection: (data) => client.post('/hotlink/toggle', data).then(r => r.data),
  repairHotlinkConfig: (user) => client.post('/hotlink/repair', { cpanelUser: user }).then(r => r.data),
  verifyHotlinkAccess: (params) => client.get('/hotlink/verify-access', { params }).then(r => r.data),

  // Leech Protection (Feature #40)
  getLeechCapabilities: () => client.get('/leech/capabilities').then(r => r.data),
  getLeechDirectories: (user) => client.get('/leech/directories', { params: { user } }).then(r => r.data),
  getLeechConfig: (user, directory) => client.get('/leech/config', { params: { user, directory } }).then(r => r.data),
  saveLeechConfig: (data) => client.post('/leech/save', data).then(r => r.data),
  toggleLeechProtection: (data) => client.post('/leech/toggle', data).then(r => r.data),
  repairLeechConfig: (data) => client.post('/leech/repair', data).then(r => r.data),
  getLeechActiveBlocks: (user) => client.get('/leech/active-blocks', { params: { user } }).then(r => r.data),
  removeLeechBlock: (data) => client.post('/leech/unblock', data).then(r => r.data),
  getLeechEvents: (user, limit = 50) => client.get('/leech/events', { params: { user, limit } }).then(r => r.data),
  verifyLeechAccess: (params) => client.get('/leech/verify-access', { params }).then(r => r.data),



  // --- MODSECURITY (Feature #41) ---
  getModSecCapabilities: () => client.get('/modsec/capabilities').then(r => r.data),
  getModSecStatus: (user) => client.get(`/modsec/status${user ? `?user=${encodeURIComponent(user)}` : ''}`).then(r => r.data),
  setModSecDomain: (domain, status, user) => client.post('/modsec/set-domain', { domain, status, user }).then(r => r.data),
  getModSecEvents: (user) => client.get(`/modsec/events${user ? `?user=${encodeURIComponent(user)}` : ''}`).then(r => r.data),

  // --- LET'S ENCRYPT SSL (Feature #42) ---
  getLetsEncryptStatus: (user) => client.get(`/ssl/letsencrypt/status${user ? `?user=${encodeURIComponent(user)}` : ''}`).then(r => r.data),
  issueLetsEncryptCert: (domain, user) => client.post('/ssl/letsencrypt/issue', { domain, user }).then(r => r.data),
  renewLetsEncryptCert: (domain, user) => client.post('/ssl/letsencrypt/renew', { domain, user }).then(r => r.data),

  // --- CPGUARD (Feature #43) ---
  getCpguardStatus: (user) => client.get(`/cpguard/status${user ? `?user=${encodeURIComponent(user)}` : ''}`).then(r => r.data),
  scanCpguard: (domain, user) => client.post('/cpguard/scan', { domain, user }).then(r => r.data),

  // --- IMUNIFY360 (Feature #44) ---
  getImunifyStatus: (user) => client.get(`/imunify/status${user ? `?user=${encodeURIComponent(user)}` : ''}`).then(r => r.data),
  scanImunify: (target, user) => client.post('/imunify/scan', { target, user }).then(r => r.data),

  // --- APP RUNTIMES (Features #46, #47, #49, #53, #55, #56) ---
  getNodeInfo: () => client.get('/runtime/node/info').then(r => r.data),
  getNodeApps: (user) => client.get(`/runtime/node/apps${user ? `?user=${encodeURIComponent(user)}` : ''}`).then(r => r.data),
  createNodeApp: (data, user) => client.post('/runtime/node/create', { ...data, user }).then(r => r.data),
  startNodeApp: (id) => client.post('/runtime/node/start', { id }).then(r => r.data),
  stopNodeApp: (id) => client.post('/runtime/node/stop', { id }).then(r => r.data),
  deleteNodeApp: (id) => client.post('/runtime/node/delete', { id }).then(r => r.data),

  getPythonInfo: () => client.get('/runtime/python/info').then(r => r.data),
  getPythonApps: (user) => client.get(`/runtime/python/apps${user ? `?user=${encodeURIComponent(user)}` : ''}`).then(r => r.data),
  createPythonApp: (data, user) => client.post('/runtime/python/create', { ...data, user }).then(r => r.data),
  deletePythonApp: (id) => client.post('/runtime/python/delete', { id }).then(r => r.data),

  getAllApps: (user) => client.get(`/runtime/apps${user ? `?user=${encodeURIComponent(user)}` : ''}`).then(r => r.data),
  getPearStatus: () => client.get('/runtime/pear/status').then(r => r.data),
  getPerlStatus: () => client.get('/runtime/perl/status').then(r => r.data),
  getAccelerateWpStatus: () => client.get('/runtime/acceleratewp/status').then(r => r.data),

  // --- WEBSERVER & ADVANCED (Features #48, #58, #59, #60, #61, #62) ---
  getOptimizationConfig: () => client.get('/webserver/optimization').then(r => r.data),
  saveOptimizationConfig: (data, user) => client.post('/webserver/optimization', { ...data, user }).then(r => r.data),
  trackDns: (domain, user) => client.get(`/webserver/dns/track?domain=${encodeURIComponent(domain)}${user ? `&user=${encodeURIComponent(user)}` : ''}`).then(r => r.data),
  getIndexSetting: (path) => client.get(`/webserver/indexes?path=${encodeURIComponent(path || 'public_html')}`).then(r => r.data),
  saveIndexSetting: (path, setting) => client.post('/webserver/indexes', { path, setting }).then(r => r.data),
  getErrorPages: (user) => client.get(`/webserver/error-pages${user ? `?user=${encodeURIComponent(user)}` : ''}`).then(r => r.data),
  saveErrorPage: (code, htmlContent) => client.post('/webserver/error-pages', { code, htmlContent }).then(r => r.data),
  getHandlers: () => client.get('/webserver/handlers').then(r => r.data),
  addHandler: (data) => client.post('/webserver/handlers', data).then(r => r.data),
  deleteHandler: (ext) => client.delete(`/webserver/handlers/${encodeURIComponent(ext)}`).then(r => r.data),
  getMimeTypes: () => client.get('/webserver/mime-types').then(r => r.data),
  addMimeType: (data) => client.post('/webserver/mime-types', data).then(r => r.data),
  deleteMimeType: (ext) => client.delete(`/webserver/mime-types/${encodeURIComponent(ext)}`).then(r => r.data),

  // --- PREFERENCES & SERVER INFO (Features #63, #64, #65) ---
  getPreferences: (user) => client.get(`/preferences${user ? `?user=${encodeURIComponent(user)}` : ''}`).then(r => r.data),
  savePreferences: (data, user) => client.post('/preferences', { ...data, user }).then(r => r.data),
  getSupportedLanguages: () => client.get('/preferences/languages').then(r => r.data),
  setLanguage: (language, user) => client.post('/preferences/language', { language, user }).then(r => r.data),
  getServerInformation: (user) => client.get(`/system/server-info${user ? `?user=${encodeURIComponent(user)}` : ''}`).then(r => r.data),

};
