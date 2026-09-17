import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Shield, Users, ShoppingCart, FileText, DollarSign, Server, Globe,
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Plus, Trash2, Edit,
  Lock, Unlock, Eye, Filter, ArrowUpRight, Search, Zap, Clock, Activity,
  Sliders, Tag, Ban, Key, CreditCard, Calendar, RotateCw, Database, Cpu,
  Upload, HardDrive, Check, Save
} from 'lucide-react';

export default function AdminDashboard({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('overview'); // overview, orders, users, services, domains, packages, invoices, gateways, ipblocks, promotions, settings, database, audit
  const [stats, setStats] = useState(null);
  const [hardware, setHardware] = useState(null);
  const [liveMonitoring, setLiveMonitoring] = useState(true);
  const [dbSchema, setDbSchema] = useState(null);
  const [systemSettings, setSystemSettings] = useState({ maxUploadSizeMb: 2048 });
  const [uploadLimitInput, setUploadLimitInput] = useState(2048);
  const [savingUploadLimit, setSavingUploadLimit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Data states for tabs
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [domains, setDomains] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [packages, setPackages] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [ipBlocks, setIpBlocks] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // User management states
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editUserForm, setEditUserForm] = useState({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'client',
    status: 'active'
  });
  const [showResetPassModal, setShowResetPassModal] = useState(false);
  const [resetPassForm, setResetPassForm] = useState({ userId: '', userEmail: '', newPassword: '' });

  // Modals & Action States
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [verifyTrxId, setVerifyTrxId] = useState('');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const [showPackageModal, setShowPackageModal] = useState(false);
  const [packageForm, setPackageForm] = useState({
    id: '',
    name: '',
    diskSpaceGb: 10,
    bandwidthGb: 100,
    maxDomains: 2,
    maxSubdomains: 10,
    maxEmailAccounts: 20,
    maxDatabases: 10,
    maxFtpAccounts: 5,
    maxCronJobs: 5,
    sslIncluded: true,
    priceMonthly: 5.99,
    priceYearly: 59.99,
    active: true
  });

  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoForm, setPromoForm] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: 10,
    maxUses: 100,
    active: true
  });

  const [showIpBlockModal, setShowIpBlockModal] = useState(false);
  const [ipBlockForm, setIpBlockForm] = useState({
    ip: '',
    scope: 'all',
    reason: ''
  });

  const showToast = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(''), 4000);
  };

  const loadAllData = async (search = userSearch) => {
    try {
      setRefreshing(true);
      const [dashRes, ordersRes, usersRes, pkgsRes, invRes, promoRes, ipRes, logsRes, srvRes, domRes, gwRes, dbTablesRes, settingsRes] = await Promise.all([
        api.getAdminDashboard().catch(() => null),
        api.getAdminOrders().catch(() => []),
        api.getAdminUsers(search).catch(() => []),
        api.getAdminPackages().catch(() => []),
        api.getAdminInvoices().catch(() => []),
        api.getAdminPromotions().catch(() => []),
        api.getAdminIpBlocks().catch(() => []),
        api.getAdminAuditLogs().catch(() => []),
        api.getAdminServices().catch(() => []),
        api.getAdminDomains().catch(() => []),
        api.getAdminGateways().catch(() => []),
        api.getDatabaseTables().catch(() => null),
        api.getAdminSettings().catch(() => null)
      ]);

      if (dashRes) {
        setStats(dashRes);
        if (dashRes.hardware) setHardware(dashRes.hardware);
      }
      setOrders(ordersRes || []);
      setUsers(usersRes || []);
      setPackages(pkgsRes || []);
      setInvoices(invRes || []);
      setPromotions(promoRes || []);
      setIpBlocks(ipRes || []);
      setAuditLogs(logsRes || []);
      setServices(srvRes || []);
      setDomains(domRes || []);
      setGateways(gwRes || []);
      if (dbTablesRes) setDbSchema(dbTablesRes);
      if (settingsRes?.settings) {
        setSystemSettings(settingsRes.settings);
        if (settingsRes.settings.maxUploadSizeMb) {
          setUploadLimitInput(settingsRes.settings.maxUploadSizeMb);
        }
      }
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch admin data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSaveUploadLimit = async (e) => {
    if (e) e.preventDefault();
    const mb = parseInt(uploadLimitInput, 10);
    if (isNaN(mb) || mb <= 0) {
      alert('Please enter a valid positive number for upload size in MB.');
      return;
    }
    try {
      setSavingUploadLimit(true);
      const res = await api.updateAdminUploadLimit(mb);
      if (res && res.success) {
        showToast(res.message || `Upload limit set to ${mb} MB (${(mb / 1024).toFixed(2)} GB)!`);
        setSystemSettings(prev => ({
          ...prev,
          maxUploadSizeMb: mb,
          maxUploadSizeGb: Number((mb / 1024).toFixed(2)),
          maxUploadSizeBytes: mb * 1024 * 1024
        }));
      } else {
        alert(res?.message || 'Failed to update upload limit');
      }
    } catch (err) {
      alert('Error updating upload limit: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingUploadLimit(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Live Real-Time Hardware & CPU Monitoring Polling (3s Interval)
  useEffect(() => {
    if (!liveMonitoring) return;
    const fetchHardware = async () => {
      try {
        const res = await api.getAdminHardwareMetrics();
        if (res && res.hardware) {
          setHardware(res.hardware);
        }
      } catch (e) {}
    };
    const interval = setInterval(fetchHardware, 3000);
    return () => clearInterval(interval);
  }, [liveMonitoring]);

  // Action Handlers
  const handleApproveOrder = async (orderId) => {
    if (!window.confirm('Approve this order? This will instantly provision the hosting account, auto-generate cPanel directories, and activate services.')) return;
    try {
      const res = await api.approveAdminOrder(orderId);
      if (res.success) {
        showToast(`Order approved & Auto-provisioned successfully! Service ID: ${res.service?.id || 'provisioned'}`);
        loadAllData();
      } else {
        alert(res.message || 'Failed to approve order');
      }
    } catch (err) {
      alert(err.message || 'Error approving order');
    }
  };

  const handleRejectOrder = async () => {
    if (!selectedOrder) return;
    try {
      const res = await api.rejectAdminOrder(selectedOrder.id, rejectReason || 'Order rejected by administrator');
      if (res.success) {
        showToast('Order rejected.');
        setShowRejectModal(false);
        setRejectReason('');
        setSelectedOrder(null);
        loadAllData();
      } else {
        alert(res.message || 'Failed to reject order');
      }
    } catch (err) {
      alert(err.message || 'Error rejecting order');
    }
  };

  // --- Orders Bulk & Individual Actions ---
  const handleSelectAllOrders = () => {
    if (selectedOrderIds.size === orders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(orders.map(o => o.id)));
    }
  };

  const toggleSelectOrder = (id) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm(`Are you sure you want to permanently delete order #${orderId}?`)) return;
    try {
      const res = await api.deleteAdminOrder(orderId);
      if (res && res.success) {
        showToast(`Order #${orderId} deleted permanently.`);
        setSelectedOrderIds(prev => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
        loadAllData();
      } else {
        alert(res?.message || 'Failed to delete order');
      }
    } catch (err) {
      alert('Error deleting order: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleBulkDeleteOrders = async () => {
    const count = selectedOrderIds.size;
    if (count === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${count} selected order(s)? This action cannot be undone.`)) return;
    try {
      setBulkActionLoading(true);
      const res = await api.bulkDeleteAdminOrders(Array.from(selectedOrderIds));
      if (res && res.success) {
        showToast(`Successfully deleted ${res.deletedCount || count} order(s).`);
        setSelectedOrderIds(new Set());
        loadAllData();
      } else {
        alert(res?.message || 'Bulk delete failed');
      }
    } catch (err) {
      alert('Error in bulk delete: ' + (err.response?.data?.message || err.message));
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkApproveOrders = async () => {
    const pendingSelected = orders.filter(o => selectedOrderIds.has(o.id) && o.status === 'pending');
    if (pendingSelected.length === 0) {
      alert('None of the selected orders are in "pending" status.');
      return;
    }
    if (!window.confirm(`Approve and auto-provision all ${pendingSelected.length} pending selected order(s)?`)) return;
    try {
      setBulkActionLoading(true);
      for (const order of pendingSelected) {
        await api.approveAdminOrder(order.id);
      }
      showToast(`Approved and auto-provisioned ${pendingSelected.length} order(s)!`);
      setSelectedOrderIds(new Set());
      loadAllData();
    } catch (err) {
      alert('Error approving orders: ' + (err.response?.data?.message || err.message));
    } finally {
      setBulkActionLoading(false);
    }
  };

  // --- Invoices Bulk & Individual Actions ---
  const handleSelectAllInvoices = () => {
    if (selectedInvoiceIds.size === invoices.length) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(invoices.map(i => i.id)));
    }
  };

  const toggleSelectInvoice = (id) => {
    setSelectedInvoiceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm(`Are you sure you want to permanently delete invoice #${invoiceId}?`)) return;
    try {
      const res = await api.deleteAdminInvoice(invoiceId);
      if (res && res.success) {
        showToast(res.message || 'Invoice deleted permanently.');
        setSelectedInvoiceIds(prev => {
          const next = new Set(prev);
          next.delete(invoiceId);
          return next;
        });
        loadAllData();
      } else {
        alert(res?.message || 'Failed to delete invoice');
      }
    } catch (err) {
      alert('Error deleting invoice: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleBulkDeleteInvoices = async () => {
    const count = selectedInvoiceIds.size;
    if (count === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${count} selected invoice(s)?`)) return;
    try {
      setBulkActionLoading(true);
      const res = await api.bulkDeleteAdminInvoices(Array.from(selectedInvoiceIds));
      if (res && res.success) {
        showToast(`Deleted ${count} invoice(s).`);
        setSelectedInvoiceIds(new Set());
        loadAllData();
      } else {
        alert(res?.message || 'Bulk delete failed');
      }
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const confirmMsg = nextStatus === 'suspended'
      ? 'Suspend this user account? The user will be barred from placing orders or logging into services.'
      : 'Activate this user account?';
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.updateAdminUserStatus(userId, nextStatus);
      if (res.success) {
        showToast(`User marked as ${nextStatus}.`);
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'Error changing user status');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to permanently delete this user? This cannot be undone.')) return;
    try {
      const res = await api.deleteAdminUser(userId);
      if (res.success) {
        showToast('User deleted successfully.');
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'Error deleting user');
    }
  };

  const handleUserSearch = async (val) => {
    setUserSearch(val);
    try {
      const res = await api.getAdminUsers(val);
      setUsers(res || []);
    } catch (e) {}
  };

  const handleViewUser = async (userId) => {
    try {
      const res = await api.getAdminUserDetails(userId);
      if (res && res.success) {
        setSelectedUserDetail(res);
        setShowUserDetailModal(true);
      }
    } catch (e) {
      alert('Failed to load user details: ' + e.message);
    }
  };

  const handleEditUser = (user) => {
    setEditUserForm({
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'client',
      status: user.status || 'active'
    });
    setShowEditUserModal(true);
  };

  const handleSaveEditUser = async (e) => {
    e.preventDefault();
    try {
      const res = await api.updateAdminUserDetails(editUserForm.id, editUserForm);
      if (res && res.success) {
        showToast('User details updated successfully!');
        setShowEditUserModal(false);
        loadAllData();
      } else {
        alert(res.message || 'Failed to update user');
      }
    } catch (err) {
      alert('Error updating user: ' + err.message);
    }
  };

  const handleOpenResetPass = (user) => {
    setResetPassForm({ userId: user.id, userEmail: user.email, newPassword: '' });
    setShowResetPassModal(true);
  };

  const handleSaveResetPass = async (e) => {
    e.preventDefault();
    if (resetPassForm.newPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    try {
      const res = await api.resetAdminUserPassword(resetPassForm.userId, resetPassForm.newPassword);
      if (res && res.success) {
        showToast('Password reset successfully with secure bcrypt hash!');
        setShowResetPassModal(false);
      } else {
        alert(res.message || 'Failed to reset password');
      }
    } catch (err) {
      alert('Error resetting password: ' + err.message);
    }
  };

  const handleServiceStatus = async (serviceId, status, extendDays = 30) => {
    const confirmMsg = status === 'renew'
      ? 'Renew this service for another 30 days?'
      : `Change service status to ${status}?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await api.updateAdminServiceStatus(serviceId, status, extendDays);
      if (res && res.success) {
        showToast(`Service status updated to ${res.service?.status || status}!`);
        loadAllData();
      } else {
        alert(res.message || 'Failed to update service status');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleToggleGateway = async (gatewayId, currentActive) => {
    try {
      const res = await api.toggleAdminGateway(gatewayId, !currentActive);
      if (res && res.success) {
        showToast(res.message || 'Gateway updated.');
        loadAllData();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleVerifyInvoice = async () => {
    if (!selectedInvoice) return;
    try {
      const res = await api.verifyAdminInvoice(selectedInvoice.id, verifyTrxId, verifyNotes);
      if (res.success) {
        showToast(`Invoice ${selectedInvoice.invoiceNumber} verified & marked as PAID.`);
        setShowVerifyModal(false);
        setVerifyTrxId('');
        setVerifyNotes('');
        setSelectedInvoice(null);
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'Error verifying invoice');
    }
  };

  const handleSavePackage = async (e) => {
    e.preventDefault();
    try {
      const res = await api.saveAdminPackage(packageForm);
      if (res.success) {
        showToast('Package saved successfully!');
        setShowPackageModal(false);
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'Error saving package');
    }
  };

  const handleDeletePackage = async (pkgId) => {
    if (!window.confirm('Delete this hosting package?')) return;
    try {
      const res = await api.deleteAdminPackage(pkgId);
      if (res.success) {
        showToast('Package deleted.');
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'Error deleting package');
    }
  };

  const handleSavePromotion = async (e) => {
    e.preventDefault();
    try {
      const res = await api.saveAdminPromotion(promoForm);
      if (res.success) {
        showToast('Promotion saved!');
        setShowPromoModal(false);
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'Error saving promotion');
    }
  };

  const handleDeletePromotion = async (id) => {
    if (!window.confirm('Delete this promotion coupon?')) return;
    try {
      const res = await api.deleteAdminPromotion(id);
      if (res.success) {
        showToast('Promotion deleted.');
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'Error deleting promotion');
    }
  };

  const handleBlockIp = async (e) => {
    e.preventDefault();
    try {
      const res = await api.blockAdminIp(ipBlockForm.ip, ipBlockForm.scope, ipBlockForm.reason);
      if (res.success) {
        showToast(`IP address ${ipBlockForm.ip} blocked.`);
        setShowIpBlockModal(false);
        setIpBlockForm({ ip: '', scope: 'all', reason: '' });
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'Error blocking IP');
    }
  };

  const handleUnblockIp = async (id) => {
    if (!window.confirm('Unblock this IP address?')) return;
    try {
      const res = await api.unblockAdminIp(id);
      if (res.success) {
        showToast('IP unblocked.');
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'Error unblocking IP');
    }
  };

  const renderStorageSettingsCard = () => {
    const calculatedGb = uploadLimitInput && !isNaN(uploadLimitInput) && Number(uploadLimitInput) > 0
      ? (Number(uploadLimitInput) / 1024).toFixed(2)
      : '0.00';
    const calculatedBytes = uploadLimitInput && !isNaN(uploadLimitInput) && Number(uploadLimitInput) > 0
      ? (Number(uploadLimitInput) * 1024 * 1024).toLocaleString()
      : '0';

    return (
      <div className='rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/50 shadow-2xl p-6 space-y-5 text-white font-sans'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-900/50 pb-4'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-emerald-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-950/40'>
              <div className='w-full h-full bg-[#180529] rounded-[10px] flex items-center justify-center text-emerald-400'>
                <HardDrive className='w-5 h-5' />
              </div>
            </div>
            <div>
              <h2 className='text-base font-black text-white tracking-tight flex items-center gap-2'>
                <span>Platform Storage &amp; Maximum File Upload Limit</span>
                <span className='px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[10px] font-mono font-bold'>
                  Admin Controlled
                </span>
              </h2>
              <p className='text-xs text-purple-300/70'>
                Configure maximum file size allowed in cPanel File Manager and backend storage API (Input in MB — auto-calculates to GB)
              </p>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <div className='px-3.5 py-1.5 rounded-xl bg-[#240c3c] border border-purple-800/40 text-xs font-mono text-purple-200 flex items-center gap-2'>
              <span className='w-2 h-2 rounded-full bg-emerald-400 animate-pulse' />
              <span>Current Limit:</span>
              <strong className='text-emerald-400 font-bold'>
                {systemSettings?.maxUploadSizeMb || 2048} MB
              </strong>
              <span className='text-purple-300/70'>
                ({((systemSettings?.maxUploadSizeMb || 2048) / 1024).toFixed(2)} GB)
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveUploadLimit} className='space-y-4'>
          <div className='grid grid-cols-1 md:grid-cols-12 gap-4 items-end'>
            {/* MB Input */}
            <div className='md:col-span-5 space-y-1.5'>
              <label className='text-xs font-bold text-purple-200 flex items-center justify-between'>
                <span>Maximum File Size (Enter in MB)</span>
                <span className='text-[10px] text-purple-400/80 font-normal'>Positive integer (e.g. 2048, 3072)</span>
              </label>
              <div className='relative'>
                <input
                  type='number'
                  min='1'
                  max='1048576'
                  required
                  value={uploadLimitInput}
                  onChange={(e) => setUploadLimitInput(e.target.value)}
                  className='w-full px-4 py-2.5 bg-purple-950/60 border border-purple-700/60 focus:border-emerald-400 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 transition placeholder-purple-400/40'
                  placeholder='e.g. 2048 for 2 GB'
                />
                <span className='absolute right-3.5 top-2.5 text-xs text-purple-400 font-mono font-bold select-none'>
                  MB
                </span>
              </div>
            </div>

            {/* Live Real-time GB Conversion Display */}
            <div className='md:col-span-4 space-y-1.5'>
              <label className='text-xs font-bold text-purple-200 flex items-center gap-1.5'>
                <Zap className='w-3.5 h-3.5 text-amber-400' />
                <span>Auto-Calculated in GB (রিয়েল-টাইম)</span>
              </label>
              <div className='px-4 py-2 bg-[#250a3f] border border-emerald-500/40 rounded-xl flex items-center justify-between shadow-inner'>
                <div className='flex items-baseline gap-1.5'>
                  <span className='text-xl font-black text-emerald-400 font-mono'>
                    {calculatedGb}
                  </span>
                  <span className='text-xs font-bold text-white uppercase'>GB</span>
                </div>
                <span className='text-[10px] text-purple-300/70 font-mono'>
                  {calculatedBytes} Bytes
                </span>
              </div>
            </div>

            {/* Save Action Button */}
            <div className='md:col-span-3'>
              <button
                type='submit'
                disabled={savingUploadLimit}
                className='w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer disabled:opacity-50'
              >
                {savingUploadLimit ? (
                  <RefreshCw className='w-4 h-4 animate-spin' />
                ) : (
                  <CheckCircle2 className='w-4 h-4' />
                )}
                <span>{savingUploadLimit ? 'Saving Limit...' : 'Save Upload Limit'}</span>
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className='pt-2 border-t border-purple-900/30 flex flex-wrap items-center gap-2'>
            <span className='text-[11px] text-purple-300/70 font-semibold mr-1'>Quick Presets:</span>
            {[
              { label: '512 MB (0.5 GB)', mb: 512 },
              { label: '1024 MB (1.0 GB)', mb: 1024 },
              { label: '2048 MB (2.0 GB)', mb: 2048 },
              { label: '3072 MB (3.0 GB)', mb: 3072 },
              { label: '4096 MB (4.0 GB)', mb: 4096 },
              { label: '5120 MB (5.0 GB)', mb: 5120 },
              { label: '10240 MB (10.0 GB)', mb: 10240 },
            ].map((preset) => (
              <button
                key={preset.mb}
                type='button'
                onClick={() => setUploadLimitInput(preset.mb)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition cursor-pointer border ${
                  Number(uploadLimitInput) === preset.mb
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500 font-bold shadow-sm'
                    : 'bg-purple-950/40 text-purple-300 hover:text-white hover:bg-purple-900/40 border-purple-800/40'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <p className='text-[11px] text-purple-300/60 leading-relaxed'>
            The configured limit is dynamically enforced by both the cPanel File Manager frontend interface and backend multipart streaming upload handlers without requiring server restarts.
          </p>
        </form>
      </div>
    );
  };

  if (loading) {
    return (
      <div className='min-h-[500px] flex items-center justify-center'>
        <div className='text-center space-y-3'>
          <div className='w-9 h-9 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto' />
          <p className='text-xs text-purple-300 font-semibold tracking-wider uppercase'>Loading WHM Admin Master Panel...</p>
        </div>
      </div>
    );
  }

  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const unpaidInvoicesCount = invoices.filter(i => i.status === 'unpaid').length;

  return (
    <div className='space-y-6'>
      {/* Toast Alert */}
      {actionSuccess && (
        <div className='bg-emerald-950/90 border border-emerald-500/70 text-emerald-200 px-4 py-3 rounded-xl flex items-center gap-3 shadow-2xl animate-fade-in'>
          <CheckCircle2 className='w-5 h-5 text-emerald-400 flex-shrink-0' />
          <span className='text-sm font-medium'>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className='bg-rose-950/90 border border-rose-500/70 text-rose-200 px-4 py-3 rounded-xl flex items-center gap-3 shadow-2xl'>
          <AlertTriangle className='w-5 h-5 text-rose-400 flex-shrink-0' />
          <span className='text-sm font-medium'>{error}</span>
        </div>
      )}

      {/* Main Admin Master Top Banner */}
      <div className='relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1c0836] via-[#280c44] to-[#0c2a1e] border border-purple-800/40 p-6 shadow-2xl'>
        <div className='relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <div className='space-y-1.5'>
            <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 text-[11px] font-bold tracking-wide uppercase'>
              <Shield className='w-3.5 h-3.5 text-emerald-400' />
              <span>WHM Master Administrator</span>
            </div>
            <h1 className='text-2xl font-black tracking-tight text-white'>
              Tamim Hosting — Main Control Center
            </h1>
            <p className='text-xs text-purple-200/70 flex flex-wrap items-center gap-2'>
              <span>Complete Hosting Business, Auto-Provisioning, Orders &amp; Security Management</span>
            </p>
          </div>

          <div className='flex items-center gap-2.5'>
            <button
              onClick={loadAllData}
              disabled={refreshing}
              className='px-3.5 py-2 bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 border border-purple-700/50 rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-sm'
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Status Metric Grid */}
      <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3'>
        <div className='p-4 rounded-xl bg-purple-950/30 border border-purple-800/30 space-y-1'>
          <div className='flex items-center justify-between text-purple-400 text-xs font-medium'>
            <span>Total Users</span>
            <Users className='w-4 h-4 text-purple-400' />
          </div>
          <div className='text-2xl font-black text-white'>{stats?.users?.total || users.length}</div>
          <div className='text-[10px] text-emerald-400 font-medium'>{stats?.users?.active || users.filter(u=>u.status==='active').length} Active</div>
        </div>

        <div className={`p-4 rounded-xl border space-y-1 transition ${pendingOrdersCount > 0 ? 'bg-amber-950/30 border-amber-500/50 shadow-lg shadow-amber-950/20' : 'bg-purple-950/30 border-purple-800/30'}`}>
          <div className='flex items-center justify-between text-amber-300 text-xs font-medium'>
            <span>Pending Orders</span>
            <ShoppingCart className='w-4 h-4 text-amber-400' />
          </div>
          <div className='text-2xl font-black text-amber-200 flex items-center gap-2'>
            {pendingOrdersCount}
            {pendingOrdersCount > 0 && (
              <span className='w-2 h-2 rounded-full bg-amber-400 animate-ping' />
            )}
          </div>
          <div className='text-[10px] text-amber-300/80'>Requires 1-Click Approval</div>
        </div>

        <div className='p-4 rounded-xl bg-purple-950/30 border border-purple-800/30 space-y-1'>
          <div className='flex items-center justify-between text-purple-400 text-xs font-medium'>
            <span>Unpaid Invoices</span>
            <FileText className='w-4 h-4 text-purple-400' />
          </div>
          <div className='text-2xl font-black text-rose-300'>{unpaidInvoicesCount}</div>
          <div className='text-[10px] text-purple-300/70'>{invoices.length} Total Generated</div>
        </div>

        <div className='p-4 rounded-xl bg-purple-950/30 border border-purple-800/30 space-y-1'>
          <div className='flex items-center justify-between text-emerald-400 text-xs font-medium'>
            <span>Total Revenue</span>
            <DollarSign className='w-4 h-4 text-emerald-400' />
          </div>
          <div className='text-2xl font-black text-emerald-300'>${(stats?.revenue || 0).toFixed(2)}</div>
          <div className='text-[10px] text-emerald-400/80'>Verified Paid</div>
        </div>

        <div className='p-4 rounded-xl bg-purple-950/30 border border-purple-800/30 space-y-1'>
          <div className='flex items-center justify-between text-cyan-400 text-xs font-medium'>
            <span>Active Services</span>
            <Server className='w-4 h-4 text-cyan-400' />
          </div>
          <div className='text-2xl font-black text-cyan-300'>{stats?.activeServices || 0}</div>
          <div className='text-[10px] text-cyan-400/80'>Provisioned Accounts</div>
        </div>

        <div className='p-4 rounded-xl bg-purple-950/30 border border-purple-800/30 space-y-1'>
          <div className='flex items-center justify-between text-rose-400 text-xs font-medium'>
            <span>Blocked IPs</span>
            <Ban className='w-4 h-4 text-rose-400' />
          </div>
          <div className='text-2xl font-black text-rose-300'>{ipBlocks.length}</div>
          <div className='text-[10px] text-rose-400/80'>Firewall Guarded</div>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className='flex items-center gap-2 overflow-x-auto pb-1 border-b border-purple-800/40 text-xs font-bold scrollbar-none'>
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'orders', label: `Orders (${orders.length})`, count: pendingOrdersCount, icon: ShoppingCart },
          { id: 'users', label: `Users (${users.length})`, icon: Users },
          { id: 'services', label: `Services (${services.length})`, icon: Server },
          { id: 'domains', label: `Domains (${domains.length})`, icon: Globe },
          { id: 'packages', label: `Packages (${packages.length})`, icon: Sliders },
          { id: 'invoices', label: `Invoices (${invoices.length})`, count: unpaidInvoicesCount, icon: FileText },
          { id: 'gateways', label: `Gateways (${gateways.length})`, icon: CreditCard },
          { id: 'ipblocks', label: `IP Blocker (${ipBlocks.length})`, icon: Ban },
          { id: 'promotions', label: `Promotions (${promotions.length})`, icon: Tag },
          { id: 'settings', label: 'Storage & Limits', icon: HardDrive },
          { id: 'database', label: `Database (${dbSchema?.totalTables || 29} Tables)`, icon: Database },
          { id: 'audit', label: 'Audit Logs', icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 whitespace-nowrap transition relative ${
                isActive
                  ? 'bg-gradient-to-r from-purple-700/60 to-emerald-700/60 text-white border border-purple-500/50 shadow-md'
                  : 'bg-purple-950/20 text-purple-300 hover:text-white hover:bg-purple-900/30 border border-transparent'
              }`}
            >
              <Icon className='w-3.5 h-3.5' />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className='px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black'>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className='space-y-6'>
          {/* REAL-TIME SERVER HARDWARE & CPU MONITOR (Section User Request) */}
          <div className='rounded-2xl bg-[#1c0830]/90 backdrop-blur-xl border border-purple-800/50 shadow-2xl p-6 space-y-6'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-900/50 pb-4'>
              <div className='space-y-1'>
                <div className='flex items-center gap-2.5'>
                  <div className='w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-emerald-500 p-0.5 flex items-center justify-center shadow-lg'>
                    <div className='w-full h-full bg-[#180529] rounded-[9px] flex items-center justify-center text-emerald-300'>
                      <Cpu className='w-4 h-4' />
                    </div>
                  </div>
                  <div>
                    <h2 className='text-base font-black text-white tracking-tight flex items-center gap-2'>
                      <span>Real-Time Server Hardware &amp; CPU Monitor</span>
                    </h2>
                    <p className='text-xs text-purple-300/70'>
                      Live real-time physical &amp; logical core telemetry directly from host operating system
                    </p>
                  </div>
                </div>
              </div>

              <div className='flex items-center gap-2.5'>
                <div className='inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-700/50 text-[11px] font-bold text-emerald-300 shadow-sm'>
                  <span className={`w-2 h-2 rounded-full ${liveMonitoring ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                  <span>{liveMonitoring ? 'Live Telemetry (3s)' : 'Paused'}</span>
                </div>
                <button
                  type='button'
                  onClick={() => setLiveMonitoring(!liveMonitoring)}
                  className='px-3 py-1.5 rounded-xl bg-purple-900/50 hover:bg-purple-800 border border-purple-700/50 text-purple-200 hover:text-white text-xs font-semibold transition cursor-pointer'
                >
                  {liveMonitoring ? 'Pause' : 'Resume'}
                </button>
              </div>
            </div>

            {/* Top 4 Hardware Metrics Cards */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
              {/* CPU Model & Cores */}
              <div className='p-4 rounded-xl bg-[#240939]/70 border border-purple-800/40 space-y-2'>
                <div className='flex items-center justify-between text-purple-400 text-xs font-semibold'>
                  <span className='flex items-center gap-1.5'><Cpu className='w-3.5 h-3.5 text-emerald-400' /> CPU Processor</span>
                  <span className='text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/40 font-mono'>
                    {hardware?.arch || 'x64'}
                  </span>
                </div>
                <div>
                  <h3 className='text-sm font-bold text-white truncate' title={hardware?.cpu?.model}>
                    {hardware?.cpu?.model || 'Multi-Core Server CPU'}
                  </h3>
                  <p className='text-xs text-purple-300/80 mt-1 flex items-center gap-2'>
                    <strong className='text-emerald-400 font-mono text-sm'>{hardware?.cpu?.coreCount || 0}</strong>
                    <span>Physical / Logical Cores</span>
                  </p>
                </div>
                <div className='text-[10px] text-purple-300/60 pt-1 border-t border-purple-900/30 flex justify-between'>
                  <span>Clock Speed:</span>
                  <strong className='text-white font-mono'>{hardware?.cpu?.baseSpeedGhz || '0.00'} GHz</strong>
                </div>
              </div>

              {/* Overall CPU Load */}
              <div className='p-4 rounded-xl bg-[#240939]/70 border border-purple-800/40 space-y-2'>
                <div className='flex items-center justify-between text-purple-400 text-xs font-semibold'>
                  <span className='flex items-center gap-1.5'><Activity className='w-3.5 h-3.5 text-purple-400' /> Total CPU Usage</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase border ${
                    (hardware?.cpu?.overallUsagePercent || 0) > 85 ? 'bg-rose-950 text-rose-300 border-rose-700/50' :
                    (hardware?.cpu?.overallUsagePercent || 0) > 60 ? 'bg-amber-950 text-amber-300 border-amber-700/50' :
                    'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                  }`}>
                    {(hardware?.cpu?.overallUsagePercent || 0) > 85 ? 'High' : (hardware?.cpu?.overallUsagePercent || 0) > 60 ? 'Moderate' : 'Optimal'}
                  </span>
                </div>
                <div className='flex items-baseline justify-between'>
                  <span className='text-3xl font-black text-white font-mono'>
                    {hardware?.cpu?.overallUsagePercent || 0}%
                  </span>
                  <span className='text-[11px] text-purple-300/70'>Avg across all cores</span>
                </div>
                {/* Progress Bar */}
                <div className='w-full bg-purple-950/80 h-2 rounded-full overflow-hidden border border-purple-900/40'>
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      (hardware?.cpu?.overallUsagePercent || 0) > 85 ? 'bg-rose-500' :
                      (hardware?.cpu?.overallUsagePercent || 0) > 60 ? 'bg-amber-400' :
                      'bg-gradient-to-r from-emerald-500 to-teal-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, hardware?.cpu?.overallUsagePercent || 0))}%` }}
                  />
                </div>
                <div className='text-[10px] text-purple-300/60 pt-1 border-t border-purple-900/30 flex justify-between'>
                  <span>Load Average:</span>
                  <strong className='text-white font-mono'>{(hardware?.loadAverage || []).join(', ') || 'N/A'}</strong>
                </div>
              </div>

              {/* Memory (RAM) */}
              <div className='p-4 rounded-xl bg-[#240939]/70 border border-purple-800/40 space-y-2'>
                <div className='flex items-center justify-between text-purple-400 text-xs font-semibold'>
                  <span className='flex items-center gap-1.5'><Server className='w-3.5 h-3.5 text-emerald-400' /> RAM / Memory</span>
                  <span className='text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/50 font-mono'>
                    {hardware?.memory?.usagePercent || 0}% Used
                  </span>
                </div>
                <div className='flex items-baseline justify-between'>
                  <span className='text-2xl font-black text-white font-mono'>
                    {hardware?.memory?.usedGb || '0.00'} <span className='text-xs text-purple-300/70 font-sans'>GB</span>
                  </span>
                  <span className='text-xs text-purple-300/70 font-mono'>/ {hardware?.memory?.totalGb || '0.00'} GB</span>
                </div>
                {/* Memory Bar */}
                <div className='w-full bg-purple-950/80 h-2 rounded-full overflow-hidden border border-purple-900/40'>
                  <div
                    className='h-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-500 rounded-full'
                    style={{ width: `${Math.min(100, Math.max(2, hardware?.memory?.usagePercent || 0))}%` }}
                  />
                </div>
                <div className='text-[10px] text-purple-300/60 pt-1 border-t border-purple-900/30 flex justify-between'>
                  <span>Free Available:</span>
                  <strong className='text-emerald-300 font-mono'>{hardware?.memory?.freeGb || '0.00'} GB</strong>
                </div>
              </div>

              {/* Host OS & Uptime */}
              <div className='p-4 rounded-xl bg-[#240939]/70 border border-purple-800/40 space-y-2'>
                <div className='flex items-center justify-between text-purple-400 text-xs font-semibold'>
                  <span className='flex items-center gap-1.5'><Clock className='w-3.5 h-3.5 text-amber-400' /> Host &amp; Uptime</span>
                  <span className='text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/40 font-mono'>
                    Online
                  </span>
                </div>
                <div>
                  <h3 className='text-sm font-bold text-white font-mono truncate' title={hardware?.hostname}>
                    {hardware?.hostname || 'localhost'}
                  </h3>
                  <p className='text-xs text-purple-300/80 mt-1 capitalize'>
                    {hardware?.platform || 'linux'} ({hardware?.osType || 'OS'})
                  </p>
                </div>
                <div className='text-[10px] text-purple-300/60 pt-1 border-t border-purple-900/30 flex justify-between'>
                  <span>System Uptime:</span>
                  <strong className='text-amber-300 font-mono'>{hardware?.uptimeFormatted || '0d 0h 0m'}</strong>
                </div>
              </div>
            </div>

            {/* REAL CPU CORES LIVE GRID (Per-Core Breakdown) */}
            <div className='space-y-3 pt-2 border-t border-purple-900/40'>
              <div className='flex items-center justify-between'>
                <h3 className='text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2'>
                  <Cpu className='w-3.5 h-3.5 text-emerald-400' />
                  <span>Physical &amp; Logical CPU Cores ({hardware?.cpu?.coreCount || 0} Cores Detected)</span>
                </h3>
                <span className='text-[11px] text-purple-300/60 font-mono'>
                  Auto-calibrated for VPS / Dedicated / Cloud Hosts
                </span>
              </div>

              <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3'>
                {(hardware?.cpu?.cores || []).map((core) => {
                  const percent = core.usagePercent || 0;
                  const isHigh = percent > 85;
                  const isModerate = percent > 60;
                  return (
                    <div
                      key={core.core}
                      className='p-3 rounded-xl bg-[#240939]/80 border border-purple-800/40 hover:border-emerald-500/50 transition space-y-2'
                    >
                      <div className='flex items-center justify-between'>
                        <span className='text-xs font-bold text-white font-mono'>Core #{core.core}</span>
                        <span className={`text-[11px] font-black font-mono ${
                          isHigh ? 'text-rose-400' : isModerate ? 'text-amber-300' : 'text-emerald-400'
                        }`}>
                          {percent}%
                        </span>
                      </div>

                      {/* Core Live Bar */}
                      <div className='w-full bg-purple-950/90 h-1.5 rounded-full overflow-hidden border border-purple-900/50'>
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            isHigh ? 'bg-rose-500' : isModerate ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(3, percent))}%` }}
                        />
                      </div>

                      <div className='flex items-center justify-between text-[10px] text-purple-300/60'>
                        <span>Freq:</span>
                        <span className='text-white font-mono'>{core.speedGhz} GHz</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Storage & Maximum File Upload Limit Configuration */}
          {renderStorageSettingsCard()}

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* Pending Orders Needing Action */}
            <div className='rounded-xl bg-purple-950/30 border border-purple-800/40 p-5 space-y-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2 text-white font-bold text-sm'>
                <ShoppingCart className='w-4 h-4 text-amber-400' />
                <span>Pending Orders Awaiting Auto-Provisioning</span>
              </div>
              <button
                onClick={() => setActiveTab('orders')}
                className='text-xs text-purple-300 hover:text-white flex items-center gap-1 font-semibold'
              >
                View all ({orders.length}) <ArrowUpRight className='w-3 h-3' />
              </button>
            </div>

            {orders.filter(o => o.status === 'pending').length === 0 ? (
              <div className='p-6 text-center text-xs text-purple-300/60 rounded-lg bg-purple-950/20 border border-purple-900/30'>
                No pending orders. All orders are processed!
              </div>
            ) : (
              <div className='space-y-3'>
                {orders.filter(o => o.status === 'pending').slice(0, 4).map((order) => (
                  <div key={order.id} className='p-3.5 rounded-xl bg-purple-950/50 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3'>
                    <div className='space-y-1'>
                      <div className='flex items-center gap-2'>
                        <span className='font-mono font-bold text-white text-xs'>{order.id}</span>
                        <span className='text-xs text-emerald-300 font-semibold'>{order.packageName}</span>
                        <span className='text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/50 uppercase font-bold'>
                          {order.billingCycle}
                        </span>
                      </div>
                      <div className='text-xs text-purple-200/70 flex items-center gap-3'>
                        <span>Domain: <strong className='text-white'>{order.domain}</strong></span>
                        <span>•</span>
                        <span>Amount: <strong className='text-emerald-400 font-bold'>${order.totalAmount}</strong></span>
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={() => handleApproveOrder(order.id)}
                        className='px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md'
                      >
                        <CheckCircle2 className='w-3.5 h-3.5' />
                        <span>1-Click Approve</span>
                      </button>
                      <button
                        onClick={() => { setSelectedOrder(order); setShowRejectModal(true); }}
                        className='px-2.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/50 rounded-lg text-xs font-semibold transition'
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Audit Activities */}
          <div className='rounded-xl bg-purple-950/30 border border-purple-800/40 p-5 space-y-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2 text-white font-bold text-sm'>
                <Activity className='w-4 h-4 text-emerald-400' />
                <span>Recent System Audit Activity</span>
              </div>
              <button
                onClick={() => setActiveTab('audit')}
                className='text-xs text-purple-300 hover:text-white flex items-center gap-1 font-semibold'
              >
                Full Logs <ArrowUpRight className='w-3 h-3' />
              </button>
            </div>

            <div className='space-y-2 max-h-[300px] overflow-y-auto pr-1'>
              {auditLogs.slice(0, 6).map((log, idx) => (
                <div key={idx} className='p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/30 flex items-start justify-between gap-3 text-xs'>
                  <div className='space-y-0.5'>
                    <div className='font-semibold text-white'>{log.action}</div>
                    <div className='text-[11px] text-purple-300/70 font-mono'>
                      User: {log.userId || 'system'} | IP: {log.ipAddress || '127.0.0.1'}
                    </div>
                  </div>
                  <div className='text-[10px] text-purple-300/50 whitespace-nowrap'>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* TAB CONTENT: ORDERS */}
      {activeTab === 'orders' && (
        <div className='rounded-xl bg-purple-950/30 border border-purple-800/40 overflow-hidden'>
          {/* Top Bar with Counts and Select Helpers */}
          <div className='p-4 border-b border-purple-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-950/40'>
            <div>
              <div className='font-bold text-white text-sm flex items-center gap-2'>
                <ShoppingCart className='w-4 h-4 text-emerald-400' />
                <span>All Client Hosting Orders ({orders.length})</span>
              </div>
              <div className='text-xs text-purple-300/70'>
                Auto-provisioning provisions directory &amp; active service instantly upon approval
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={handleSelectAllOrders}
                className='px-3 py-1.5 rounded-xl bg-purple-900/50 hover:bg-purple-800 border border-purple-700/50 text-purple-200 hover:text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5'
              >
                <Check className='w-3.5 h-3.5 text-emerald-400' />
                <span>{selectedOrderIds.size === orders.length && orders.length > 0 ? 'Deselect All' : `Select All (${orders.length})`}</span>
              </button>
            </div>
          </div>

          {/* Floating / Sticky Bulk Action Bar when items selected */}
          {selectedOrderIds.size > 0 && (
            <div className='p-3.5 bg-gradient-to-r from-[#200839] via-[#2d0e4e] to-[#120524] border-b border-purple-600/50 flex flex-wrap items-center justify-between gap-3 animate-fade-in shadow-xl'>
              <div className='flex items-center gap-3'>
                <span className='px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-600/60 rounded-xl font-mono font-bold text-xs shadow-sm flex items-center gap-2'>
                  <span className='w-2 h-2 rounded-full bg-emerald-400 animate-ping' />
                  <span>{selectedOrderIds.size} of {orders.length} Selected</span>
                </span>
                <button
                  type='button'
                  onClick={() => setSelectedOrderIds(new Set())}
                  className='text-xs text-purple-300 hover:text-white underline font-semibold cursor-pointer'
                >
                  Clear Selection
                </button>
              </div>

              <div className='flex items-center gap-2.5'>
                {orders.some(o => selectedOrderIds.has(o.id) && o.status === 'pending') && (
                  <button
                    type='button'
                    disabled={bulkActionLoading}
                    onClick={handleBulkApproveOrders}
                    className='px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-950/50 cursor-pointer disabled:opacity-50'
                  >
                    <CheckCircle2 className='w-3.5 h-3.5' />
                    <span>Approve Selected</span>
                  </button>
                )}
                <button
                  type='button'
                  disabled={bulkActionLoading}
                  onClick={handleBulkDeleteOrders}
                  className='px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-950/50 cursor-pointer disabled:opacity-50'
                >
                  <Trash2 className='w-3.5 h-3.5' />
                  <span>{bulkActionLoading ? 'Deleting...' : `Delete Selected (${selectedOrderIds.size})`}</span>
                </button>
              </div>
            </div>
          )}

          <div className='overflow-x-auto'>
            <table className='w-full text-left border-collapse text-xs'>
              <thead>
                <tr className='border-b border-purple-800/30 bg-purple-950/60 text-purple-300 uppercase font-semibold text-[10px] tracking-wider'>
                  <th className='p-3.5 w-12 text-center'>
                    <input
                      type='checkbox'
                      title={selectedOrderIds.size === orders.length && orders.length > 0 ? 'Deselect All' : 'Select All'}
                      checked={orders.length > 0 && selectedOrderIds.size === orders.length}
                      onChange={handleSelectAllOrders}
                      className='w-4 h-4 rounded border-purple-700 bg-purple-950 text-emerald-500 focus:ring-emerald-400 cursor-pointer accent-emerald-500'
                    />
                  </th>
                  <th className='p-3.5'>Order ID</th>
                  <th className='p-3.5'>Package</th>
                  <th className='p-3.5'>Domain</th>
                  <th className='p-3.5'>Billing Cycle</th>
                  <th className='p-3.5'>Total</th>
                  <th className='p-3.5'>Status</th>
                  <th className='p-3.5'>Created</th>
                  <th className='p-3.5 text-right'>Action</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-purple-900/30 text-purple-200'>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan='9' className='p-6 text-center text-purple-400'>No orders placed yet.</td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const isSelected = selectedOrderIds.has(order.id);
                    return (
                      <tr
                        key={order.id}
                        className={`transition ${
                          isSelected
                            ? 'bg-purple-900/40 border-l-4 border-emerald-400'
                            : 'hover:bg-purple-900/20'
                        }`}
                      >
                        <td className='p-3.5 w-12 text-center'>
                          <input
                            type='checkbox'
                            checked={isSelected}
                            onChange={() => toggleSelectOrder(order.id)}
                            className='w-4 h-4 rounded border-purple-700 bg-purple-950 text-emerald-500 focus:ring-emerald-400 cursor-pointer accent-emerald-500'
                          />
                        </td>
                        <td className='p-3.5 font-mono font-bold text-white'>{order.id}</td>
                        <td className='p-3.5 font-semibold text-emerald-300'>{order.packageName}</td>
                        <td className='p-3.5 font-mono text-cyan-300'>{order.domain}</td>
                        <td className='p-3.5 capitalize'>{order.billingCycle}</td>
                        <td className='p-3.5 font-bold text-white'>${order.totalAmount}</td>
                        <td className='p-3.5'>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            order.status === 'approved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60' :
                            order.status === 'pending' ? 'bg-amber-950 text-amber-300 border border-amber-700/60 animate-pulse' :
                            'bg-rose-950 text-rose-300 border border-rose-700/60'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className='p-3.5 text-[11px] text-purple-300/70'>
                          {new Date(order.createdAt).toLocaleString()}
                        </td>
                        <td className='p-3.5 text-right'>
                          <div className='flex items-center justify-end gap-1.5'>
                            {order.status === 'pending' && (
                              <>
                                <button
                                  type='button'
                                  onClick={() => handleApproveOrder(order.id)}
                                  className='px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer'
                                  title='Approve & Auto-Provision'
                                >
                                  <CheckCircle2 className='w-3.5 h-3.5' />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type='button'
                                  onClick={() => { setSelectedOrder(order); setShowRejectModal(true); }}
                                  className='px-2.5 py-1.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800/60 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer'
                                  title='Reject Order'
                                >
                                  <XCircle className='w-3.5 h-3.5' />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}
                            {order.status === 'approved' && (
                              <span className='px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 text-[11px] font-mono font-bold flex items-center gap-1 mr-1'>
                                ✓ Provisioned
                              </span>
                            )}
                            {order.status === 'rejected' && (
                              <span className='px-2.5 py-1 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-700/50 text-[11px] font-mono font-bold flex items-center gap-1 mr-1'>
                                ✗ Rejected
                              </span>
                            )}
                            {/* Action Bold Delete Button */}
                            <button
                              type='button'
                              onClick={() => handleDeleteOrder(order.id)}
                              className='px-2.5 py-1.5 bg-rose-950/90 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-800/60 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer'
                              title='Permanently Delete Order'
                            >
                              <Trash2 className='w-3.5 h-3.5' />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: USERS */}
      {activeTab === 'users' && (
        <div className='rounded-xl bg-purple-950/30 border border-purple-800/40 overflow-hidden'>
          <div className='p-4 border-b border-purple-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
            <div>
              <div className='font-bold text-white text-sm'>Registered Users &amp; Hosting Accounts ({users.length})</div>
              <div className='text-xs text-purple-300/70'>Search, View details, Edit, Reset password, Suspend, or Delete</div>
            </div>
            <div className='relative w-full sm:w-64'>
              <Search className='w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-purple-400' />
              <input
                type='text'
                value={userSearch}
                onChange={(e) => handleUserSearch(e.target.value)}
                placeholder='Search users by name, email...'
                className='w-full pl-9 pr-3 py-1.5 bg-purple-950/60 border border-purple-700/60 rounded-xl text-xs text-white placeholder-purple-400/60 focus:outline-none focus:border-purple-400'
              />
            </div>
          </div>

          <div className='overflow-x-auto'>
            <table className='w-full text-left border-collapse text-xs'>
              <thead>
                <tr className='border-b border-purple-800/30 bg-purple-950/60 text-purple-300 uppercase font-semibold text-[10px] tracking-wider'>
                  <th className='p-3.5'>Name</th>
                  <th className='p-3.5'>Email</th>
                  <th className='p-3.5'>cPanel User</th>
                  <th className='p-3.5'>Phone</th>
                  <th className='p-3.5'>Role</th>
                  <th className='p-3.5'>Status</th>
                  <th className='p-3.5'>Joined</th>
                  <th className='p-3.5 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-purple-900/30 text-purple-200'>
                {users.map((u) => (
                  <tr key={u.id} className='hover:bg-purple-900/20 transition'>
                    <td className='p-3.5 font-bold text-white'>
                      {u.firstName || ''} {u.lastName || ''}
                    </td>
                    <td className='p-3.5 font-mono text-cyan-300'>{u.email}</td>
                    <td className='p-3.5 font-mono text-emerald-300'>{u.cpanelUser || u.username}</td>
                    <td className='p-3.5'>{u.phone || 'N/A'}</td>
                    <td className='p-3.5'>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        u.role === 'admin' ? 'bg-purple-900 text-purple-200 border border-purple-600' : 'bg-slate-900 text-slate-300'
                      }`}>
                        {u.role || 'client'}
                      </span>
                    </td>
                    <td className='p-3.5'>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        u.status === 'active' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60' : 'bg-rose-950 text-rose-300 border border-rose-700/60'
                      }`}>
                        {u.status || 'active'}
                      </span>
                    </td>
                    <td className='p-3.5 text-[11px] text-purple-300/70'>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className='p-3.5 text-right'>
                      <div className='flex items-center justify-end gap-1.5'>
                        <button
                          onClick={() => handleViewUser(u.id)}
                          className='p-1.5 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/50 rounded transition'
                          title='View User Details & Services'
                        >
                          <Eye className='w-3.5 h-3.5' />
                        </button>
                        <button
                          onClick={() => handleEditUser(u)}
                          className='p-1.5 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/50 rounded transition'
                          title='Edit User'
                        >
                          <Edit className='w-3.5 h-3.5' />
                        </button>
                        <button
                          onClick={() => handleOpenResetPass(u)}
                          className='p-1.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800/50 rounded transition'
                          title='Reset Password'
                        >
                          <Key className='w-3.5 h-3.5' />
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus(u.id, u.status || 'active')}
                          className={`px-2 py-1 rounded text-xs font-semibold transition flex items-center gap-1 ${
                            u.status === 'suspended'
                              ? 'bg-emerald-900/60 text-emerald-200 hover:bg-emerald-800'
                              : 'bg-amber-900/60 text-amber-200 hover:bg-amber-800'
                          }`}
                        >
                          {u.status === 'suspended' ? <Unlock className='w-3 h-3' /> : <Lock className='w-3 h-3' />}
                          <span>{u.status === 'suspended' ? 'Activate' : 'Suspend'}</span>
                        </button>
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className='p-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/50 rounded transition'
                            title='Delete User'
                          >
                            <Trash2 className='w-3.5 h-3.5' />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SERVICES */}
      {activeTab === 'services' && (
        <div className='rounded-xl bg-purple-950/30 border border-purple-800/40 overflow-hidden'>
          <div className='p-4 border-b border-purple-800/40 flex items-center justify-between'>
            <div>
              <div className='font-bold text-white text-sm'>All Hosting Services ({services.length})</div>
              <div className='text-xs text-purple-300/70'>Activate, Suspend, Renew (+30 Days), or Expire client services</div>
            </div>
          </div>

          <div className='overflow-x-auto'>
            <table className='w-full text-left border-collapse text-xs'>
              <thead>
                <tr className='border-b border-purple-800/30 bg-purple-950/60 text-purple-300 uppercase font-semibold text-[10px] tracking-wider'>
                  <th className='p-3.5'>Domain</th>
                  <th className='p-3.5'>Client</th>
                  <th className='p-3.5'>Package</th>
                  <th className='p-3.5'>Disk Quota</th>
                  <th className='p-3.5'>Bandwidth</th>
                  <th className='p-3.5'>Cycle</th>
                  <th className='p-3.5'>Status</th>
                  <th className='p-3.5'>Next Due Date</th>
                  <th className='p-3.5 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-purple-900/30 text-purple-200'>
                {services.length === 0 ? (
                  <tr><td colSpan='9' className='p-6 text-center text-purple-300/60'>No active hosting services found.</td></tr>
                ) : (
                  services.map((s) => (
                    <tr key={s.id} className='hover:bg-purple-900/20 transition'>
                      <td className='p-3.5 font-bold text-white'>{s.domain}</td>
                      <td className='p-3.5'>
                        <div className='font-semibold text-purple-200'>{s.clientName}</div>
                        <div className='text-[10px] text-purple-400 font-mono'>{s.clientEmail}</div>
                      </td>
                      <td className='p-3.5 font-semibold text-emerald-300'>{s.packageName}</td>
                      <td className='p-3.5 text-[11px]'>{s.diskUsedMb || 0} MB / {s.diskLimitMb} MB</td>
                      <td className='p-3.5 text-[11px]'>{s.bandwidthUsedMb || 0} MB / {s.bandwidthLimitMb} MB</td>
                      <td className='p-3.5 capitalize'>{s.billingCycle}</td>
                      <td className='p-3.5'>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          s.status === 'active'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                            : s.status === 'suspended'
                            ? 'bg-amber-950 text-amber-300 border border-amber-700/60'
                            : 'bg-rose-950 text-rose-300 border border-rose-700/60'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className='p-3.5 text-[11px] text-purple-300/70'>
                        {s.nextDueDate ? new Date(s.nextDueDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className='p-3.5 text-right'>
                        <div className='flex items-center justify-end gap-1.5'>
                          {s.status !== 'active' && (
                            <button
                              onClick={() => handleServiceStatus(s.id, 'active')}
                              className='px-2 py-1 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 rounded text-xs font-semibold'
                            >
                              Activate
                            </button>
                          )}
                          {s.status === 'active' && (
                            <button
                              onClick={() => handleServiceStatus(s.id, 'suspended')}
                              className='px-2 py-1 bg-amber-900/60 hover:bg-amber-800 text-amber-200 rounded text-xs font-semibold'
                            >
                              Suspend
                            </button>
                          )}
                          <button
                            onClick={() => handleServiceStatus(s.id, 'renew', 30)}
                            className='px-2 py-1 bg-purple-900/60 hover:bg-purple-800 text-purple-200 rounded text-xs font-semibold flex items-center gap-1'
                            title='Extend Expiry by 30 days'
                          >
                            <RotateCw className='w-3 h-3' />
                            <span>Renew</span>
                          </button>
                          {s.status !== 'expired' && (
                            <button
                              onClick={() => handleServiceStatus(s.id, 'expired')}
                              className='px-2 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/50 rounded text-xs font-semibold'
                            >
                              Expire
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: DOMAINS */}
      {activeTab === 'domains' && (
        <div className='rounded-xl bg-purple-950/30 border border-purple-800/40 overflow-hidden'>
          <div className='p-4 border-b border-purple-800/40'>
            <div className='font-bold text-white text-sm'>Domain &amp; Service Mappings ({domains.length})</div>
            <div className='text-xs text-purple-300/70'>All registered domains linked to user hosting accounts</div>
          </div>

          <div className='overflow-x-auto'>
            <table className='w-full text-left border-collapse text-xs'>
              <thead>
                <tr className='border-b border-purple-800/30 bg-purple-950/60 text-purple-300 uppercase font-semibold text-[10px] tracking-wider'>
                  <th className='p-3.5'>Domain Name</th>
                  <th className='p-3.5'>Client</th>
                  <th className='p-3.5'>Document Root</th>
                  <th className='p-3.5'>Status</th>
                  <th className='p-3.5'>Created</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-purple-900/30 text-purple-200'>
                {domains.length === 0 ? (
                  <tr><td colSpan='5' className='p-6 text-center text-purple-300/60'>No domains registered.</td></tr>
                ) : (
                  domains.map((d) => (
                    <tr key={d.id} className='hover:bg-purple-900/20 transition'>
                      <td className='p-3.5 font-bold text-white flex items-center gap-2'>
                        <Globe className='w-3.5 h-3.5 text-cyan-400' />
                        <span>{d.domain}</span>
                      </td>
                      <td className='p-3.5'>
                        <div className='font-semibold text-purple-200'>{d.clientName}</div>
                        <div className='text-[10px] text-purple-400 font-mono'>{d.clientEmail}</div>
                      </td>
                      <td className='p-3.5 font-mono text-[11px] text-emerald-300'>{d.documentRoot || '/public_html'}</td>
                      <td className='p-3.5'>
                        <span className='px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-700/60'>
                          {d.status || 'active'}
                        </span>
                      </td>
                      <td className='p-3.5 text-[11px] text-purple-300/70'>
                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PAYMENT GATEWAYS */}
      {activeTab === 'gateways' && (
        <div className='space-y-4'>
          <div className='rounded-xl bg-purple-950/30 border border-purple-800/40 p-4'>
            <div className='font-bold text-white text-sm'>Payment Gateways &amp; Methods ({gateways.length})</div>
            <div className='text-xs text-purple-300/70'>Configure and toggle active payment channels for client orders and invoice settlements</div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {gateways.map((gw) => (
              <div key={gw.id} className='p-5 rounded-2xl bg-purple-950/30 border border-purple-800/40 space-y-3 relative overflow-hidden'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2.5'>
                    <div className='w-9 h-9 rounded-xl bg-purple-900/60 border border-purple-700/60 flex items-center justify-center text-emerald-400 font-bold'>
                      <CreditCard className='w-4 h-4' />
                    </div>
                    <div>
                      <div className='font-bold text-white text-sm'>{gw.name}</div>
                      <div className='text-[10px] text-purple-400 font-mono'>{gw.id}</div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    gw.active !== false
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                      : 'bg-slate-900 text-slate-400 border border-slate-700/60'
                  }`}>
                    {gw.active !== false ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <p className='text-xs text-purple-200/70 min-h-[32px]'>
                  {gw.instructions || gw.description || 'Secure automated and manual payment verification.'}
                </p>

                <div className='pt-2 border-t border-purple-800/30 flex items-center justify-between'>
                  <span className='text-[11px] text-purple-300/70 font-semibold'>Processing: Instant</span>
                  <button
                    onClick={() => handleToggleGateway(gw.id, gw.active !== false)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      gw.active !== false
                        ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/50'
                        : 'bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/50'
                    }`}
                  >
                    {gw.active !== false ? 'Disable Gateway' : 'Enable Gateway'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: PACKAGES */}
      {activeTab === 'packages' && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-base font-bold text-white'>Hosting Packages Management</h2>
              <p className='text-xs text-purple-300/70'>Configure storage, domains, databases, and monthly/yearly pricing</p>
            </div>
            <button
              onClick={() => {
                setPackageForm({
                  id: '',
                  name: '',
                  diskSpaceGb: 10,
                  bandwidthGb: 100,
                  maxDomains: 2,
                  maxSubdomains: 10,
                  maxEmailAccounts: 20,
                  maxDatabases: 10,
                  maxFtpAccounts: 5,
                  maxCronJobs: 5,
                  sslIncluded: true,
                  priceMonthly: 5.99,
                  priceYearly: 59.99,
                  active: true
                });
                setShowPackageModal(true);
              }}
              className='px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md'
            >
              <Plus className='w-4 h-4' />
              <span>Create New Package</span>
            </button>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            {packages.map((pkg) => (
              <div key={pkg.id} className='rounded-2xl bg-purple-950/30 border border-purple-800/40 p-5 space-y-4 flex flex-col justify-between'>
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='font-mono text-[10px] text-purple-300/60 font-bold'>{pkg.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      pkg.active !== false ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {pkg.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <h3 className='text-lg font-black text-white'>{pkg.name}</h3>
                  <div className='text-2xl font-black text-emerald-400'>
                    ${pkg.priceMonthly}<span className='text-xs text-purple-300/70 font-normal'>/mo</span>
                    <span className='text-xs text-purple-200/50 ml-2 font-normal'>(${pkg.priceYearly}/yr)</span>
                  </div>

                  <div className='pt-3 border-t border-purple-800/30 space-y-1.5 text-xs text-purple-200/80'>
                    <div className='flex justify-between'>
                      <span>Storage Disk:</span>
                      <strong className='text-white'>{pkg.diskSpaceGb} GB SSD</strong>
                    </div>
                    <div className='flex justify-between'>
                      <span>Bandwidth:</span>
                      <strong className='text-white'>{pkg.bandwidthGb} GB</strong>
                    </div>
                    <div className='flex justify-between'>
                      <span>Allowed Domains:</span>
                      <strong className='text-white'>{pkg.maxDomains}</strong>
                    </div>
                    <div className='flex justify-between'>
                      <span>Databases:</span>
                      <strong className='text-white'>{pkg.maxDatabases}</strong>
                    </div>
                    <div className='flex justify-between'>
                      <span>Email Accounts:</span>
                      <strong className='text-white'>{pkg.maxEmailAccounts}</strong>
                    </div>
                  </div>
                </div>

                <div className='pt-3 border-t border-purple-800/30 flex items-center justify-end gap-2'>
                  <button
                    onClick={() => {
                      setPackageForm({ ...pkg });
                      setShowPackageModal(true);
                    }}
                    className='px-2.5 py-1.5 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/50 rounded-lg text-xs font-semibold transition flex items-center gap-1'
                  >
                    <Edit className='w-3 h-3' /> Edit
                  </button>
                  <button
                    onClick={() => handleDeletePackage(pkg.id)}
                    className='p-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/50 rounded-lg transition'
                    title='Delete Package'
                  >
                    <Trash2 className='w-3.5 h-3.5' />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: INVOICES */}
      {activeTab === 'invoices' && (
        <div className='rounded-xl bg-purple-950/30 border border-purple-800/40 overflow-hidden'>
          {/* Top Bar with Counts and Select Helpers */}
          <div className='p-4 border-b border-purple-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-950/40'>
            <div>
              <div className='font-bold text-white text-sm flex items-center gap-2'>
                <CreditCard className='w-4 h-4 text-emerald-400' />
                <span>All Invoices &amp; Payment Verifications ({invoices.length})</span>
              </div>
              <div className='text-xs text-purple-300/70'>
                Verify manual bKash/Nagad/Rocket/Bank transaction IDs or manage client invoices
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={handleSelectAllInvoices}
                className='px-3 py-1.5 rounded-xl bg-purple-900/50 hover:bg-purple-800 border border-purple-700/50 text-purple-200 hover:text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5'
              >
                <Check className='w-3.5 h-3.5 text-emerald-400' />
                <span>{selectedInvoiceIds.size === invoices.length && invoices.length > 0 ? 'Deselect All' : `Select All (${invoices.length})`}</span>
              </button>
            </div>
          </div>

          {/* Floating / Sticky Bulk Action Bar when items selected */}
          {selectedInvoiceIds.size > 0 && (
            <div className='p-3.5 bg-gradient-to-r from-[#200839] via-[#2d0e4e] to-[#120524] border-b border-purple-600/50 flex flex-wrap items-center justify-between gap-3 animate-fade-in shadow-xl'>
              <div className='flex items-center gap-3'>
                <span className='px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-600/60 rounded-xl font-mono font-bold text-xs shadow-sm flex items-center gap-2'>
                  <span className='w-2 h-2 rounded-full bg-emerald-400 animate-ping' />
                  <span>{selectedInvoiceIds.size} of {invoices.length} Selected</span>
                </span>
                <button
                  type='button'
                  onClick={() => setSelectedInvoiceIds(new Set())}
                  className='text-xs text-purple-300 hover:text-white underline font-semibold cursor-pointer'
                >
                  Clear Selection
                </button>
              </div>

              <div className='flex items-center gap-2.5'>
                <button
                  type='button'
                  disabled={bulkActionLoading}
                  onClick={handleBulkDeleteInvoices}
                  className='px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-950/50 cursor-pointer disabled:opacity-50'
                >
                  <Trash2 className='w-3.5 h-3.5' />
                  <span>{bulkActionLoading ? 'Deleting...' : `Delete Selected (${selectedInvoiceIds.size})`}</span>
                </button>
              </div>
            </div>
          )}

          <div className='overflow-x-auto'>
            <table className='w-full text-left border-collapse text-xs'>
              <thead>
                <tr className='border-b border-purple-800/30 bg-purple-950/60 text-purple-300 uppercase font-semibold text-[10px] tracking-wider'>
                  <th className='p-3.5 w-12 text-center'>
                    <input
                      type='checkbox'
                      title={selectedInvoiceIds.size === invoices.length && invoices.length > 0 ? 'Deselect All' : 'Select All'}
                      checked={invoices.length > 0 && selectedInvoiceIds.size === invoices.length}
                      onChange={handleSelectAllInvoices}
                      className='w-4 h-4 rounded border-purple-700 bg-purple-950 text-emerald-500 focus:ring-emerald-400 cursor-pointer accent-emerald-500'
                    />
                  </th>
                  <th className='p-3.5'>Invoice #</th>
                  <th className='p-3.5'>User</th>
                  <th className='p-3.5'>Amount</th>
                  <th className='p-3.5'>Status</th>
                  <th className='p-3.5'>Trx ID</th>
                  <th className='p-3.5'>Due Date</th>
                  <th className='p-3.5 text-right'>Action</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-purple-900/30 text-purple-200'>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan='8' className='p-6 text-center text-purple-400'>No invoices generated yet.</td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const isSelected = selectedInvoiceIds.has(inv.id);
                    return (
                      <tr
                        key={inv.id}
                        className={`transition ${
                          isSelected
                            ? 'bg-purple-900/40 border-l-4 border-emerald-400'
                            : 'hover:bg-purple-900/20'
                        }`}
                      >
                        <td className='p-3.5 w-12 text-center'>
                          <input
                            type='checkbox'
                            checked={isSelected}
                            onChange={() => toggleSelectInvoice(inv.id)}
                            className='w-4 h-4 rounded border-purple-700 bg-purple-950 text-emerald-500 focus:ring-emerald-400 cursor-pointer accent-emerald-500'
                          />
                        </td>
                        <td className='p-3.5 font-mono font-bold text-white'>{inv.invoiceNumber}</td>
                        <td className='p-3.5 font-mono text-cyan-300'>{inv.userId}</td>
                        <td className='p-3.5 font-bold text-white'>${inv.totalAmount}</td>
                        <td className='p-3.5'>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            inv.status === 'paid' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60' :
                            inv.status === 'unpaid' ? 'bg-rose-950 text-rose-300 border border-rose-700/60' :
                            'bg-zinc-800 text-zinc-400'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className='p-3.5 font-mono text-emerald-300'>{inv.paymentTrxId || '—'}</td>
                        <td className='p-3.5 text-[11px] text-purple-300/70'>{inv.dueDate || 'Upon Receipt'}</td>
                        <td className='p-3.5 text-right'>
                          <div className='flex items-center justify-end gap-1.5'>
                            {inv.status !== 'paid' ? (
                              <button
                                type='button'
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setVerifyTrxId(inv.paymentTrxId || '');
                                  setShowVerifyModal(true);
                                }}
                                className='px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer'
                              >
                                <CheckCircle2 className='w-3.5 h-3.5' />
                                <span>Verify Payment</span>
                              </button>
                            ) : (
                              <span className='px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 text-[11px] font-mono font-bold flex items-center gap-1 mr-1'>
                                ✓ Paid &amp; Cleared
                              </span>
                            )}
                            <button
                              type='button'
                              onClick={() => handleDeleteInvoice(inv.id)}
                              className='px-2.5 py-1.5 bg-rose-950/90 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-800/60 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer'
                              title='Permanently Delete Invoice'
                            >
                              <Trash2 className='w-3.5 h-3.5' />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: IP BLOCKER */}
      {activeTab === 'ipblocks' && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-base font-bold text-white'>IP Security Firewall &amp; Blocker</h2>
              <p className='text-xs text-purple-300/70'>Block abusive or malicious client IP addresses from ordering or system access</p>
            </div>
            <button
              onClick={() => setShowIpBlockModal(true)}
              className='px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md'
            >
              <Plus className='w-4 h-4' />
              <span>Block New IP</span>
            </button>
          </div>

          <div className='rounded-xl bg-purple-950/30 border border-purple-800/40 overflow-hidden'>
            <table className='w-full text-left border-collapse text-xs'>
              <thead>
                <tr className='border-b border-purple-800/30 bg-purple-950/60 text-purple-300 uppercase font-semibold text-[10px] tracking-wider'>
                  <th className='p-3.5'>IP Address</th>
                  <th className='p-3.5'>Scope</th>
                  <th className='p-3.5'>Reason</th>
                  <th className='p-3.5'>Blocked At</th>
                  <th className='p-3.5 text-right'>Action</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-purple-900/30 text-purple-200'>
                {ipBlocks.length === 0 ? (
                  <tr>
                    <td colSpan='5' className='p-6 text-center text-purple-400'>No active IP bans.</td>
                  </tr>
                ) : (
                  ipBlocks.map((b) => (
                    <tr key={b.id} className='hover:bg-purple-900/20 transition'>
                      <td className='p-3.5 font-mono font-bold text-rose-400'>{b.ip}</td>
                      <td className='p-3.5 font-bold uppercase text-[10px] text-amber-300'>{b.scope}</td>
                      <td className='p-3.5 text-purple-200'>{b.reason || 'Malicious activity'}</td>
                      <td className='p-3.5 text-[11px] text-purple-300/70'>{new Date(b.createdAt).toLocaleString()}</td>
                      <td className='p-3.5 text-right'>
                        <button
                          onClick={() => handleUnblockIp(b.id)}
                          className='px-2.5 py-1 bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 rounded text-xs font-semibold transition'
                        >
                          Unblock IP
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PROMOTIONS */}
      {activeTab === 'promotions' && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-base font-bold text-white'>Promotions &amp; Coupon Codes</h2>
              <p className='text-xs text-purple-300/70'>Manage discount coupons for new hosting purchases</p>
            </div>
            <button
              onClick={() => {
                setPromoForm({
                  code: '',
                  discountType: 'percentage',
                  discountValue: 10,
                  maxUses: 100,
                  active: true
                });
                setShowPromoModal(true);
              }}
              className='px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md'
            >
              <Plus className='w-4 h-4' />
              <span>Create Coupon</span>
            </button>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            {promotions.map((p) => (
              <div key={p.id} className='rounded-2xl bg-purple-950/30 border border-purple-800/40 p-5 space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='font-mono text-xs font-black text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-700/50'>
                    {p.code}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    p.active ? 'bg-emerald-950 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {p.active ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div className='text-xl font-black text-white'>
                  {p.discountType === 'percentage' ? `${p.discountValue}% OFF` : `$${p.discountValue} OFF`}
                </div>
                <div className='text-xs text-purple-300/70'>
                  Usage: <strong>{p.currentUses || 0}</strong> / {p.maxUses || 'Unlimited'}
                </div>
                <div className='pt-2 border-t border-purple-800/30 flex justify-end'>
                  <button
                    onClick={() => handleDeletePromotion(p.id)}
                    className='text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold'
                  >
                    <Trash2 className='w-3.5 h-3.5' /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className='rounded-xl bg-purple-950/30 border border-purple-800/40 overflow-hidden'>
          <div className='p-4 border-b border-purple-800/40 font-bold text-white text-sm'>
            Comprehensive Operational Audit Logs ({auditLogs.length})
          </div>
          <div className='max-h-[500px] overflow-y-auto'>
            <table className='w-full text-left border-collapse text-xs'>
              <thead>
                <tr className='border-b border-purple-800/30 bg-purple-950/60 text-purple-300 uppercase font-semibold text-[10px] tracking-wider sticky top-0'>
                  <th className='p-3'>Timestamp</th>
                  <th className='p-3'>Action</th>
                  <th className='p-3'>User Identifier</th>
                  <th className='p-3'>IP Address</th>
                  <th className='p-3'>Details</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-purple-900/30 text-purple-200'>
                {auditLogs.map((log, i) => (
                  <tr key={i} className='hover:bg-purple-900/20 transition'>
                    <td className='p-3 text-[11px] text-purple-300/70 font-mono'>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className='p-3 font-semibold text-white'>{log.action}</td>
                    <td className='p-3 font-mono text-cyan-300'>{log.userId || 'system'}</td>
                    <td className='p-3 font-mono text-purple-300/70'>{log.ipAddress || '127.0.0.1'}</td>
                    <td className='p-3 font-mono text-[11px] text-purple-300/60'>
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: STORAGE & UPLOAD LIMITS */}
      {activeTab === 'settings' && (
        <div className='space-y-6'>
          {renderStorageSettingsCard()}
        </div>
      )}

      {/* MODAL: Reject Order */}
      {showRejectModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
          <div className='w-full max-w-md bg-[#1d0a2f] border border-purple-700/60 rounded-2xl p-6 shadow-2xl space-y-4 text-white'>
            <h3 className='text-lg font-bold text-rose-300 flex items-center gap-2'>
              <XCircle className='w-5 h-5 text-rose-400' />
              Reject Order {selectedOrder?.id}
            </h3>
            <p className='text-xs text-purple-200/70'>
              Please provide a reason for rejecting this order. The client will be notified.
            </p>
            <textarea
              rows='3'
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder='e.g., Domain not available or invalid payment information'
              className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-xs text-white focus:outline-none focus:border-purple-400'
            />
            <div className='flex items-center justify-end gap-2 pt-2'>
              <button
                onClick={() => setShowRejectModal(false)}
                className='px-4 py-2 bg-purple-900/50 hover:bg-purple-800 text-purple-300 rounded-xl text-xs font-semibold'
              >
                Cancel
              </button>
              <button
                onClick={handleRejectOrder}
                className='px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold'
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Verify Manual Invoice */}
      {showVerifyModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
          <div className='w-full max-w-md bg-[#1d0a2f] border border-purple-700/60 rounded-2xl p-6 shadow-2xl space-y-4 text-white'>
            <h3 className='text-lg font-bold text-emerald-300 flex items-center gap-2'>
              <CheckCircle2 className='w-5 h-5 text-emerald-400' />
              Verify Payment for Invoice {selectedInvoice?.invoiceNumber}
            </h3>
            <div className='p-3 bg-purple-950/60 rounded-xl border border-purple-800/40 text-xs space-y-1'>
              <div className='flex justify-between'>
                <span>Total Due:</span>
                <strong className='text-emerald-400 font-bold'>${selectedInvoice?.totalAmount}</strong>
              </div>
              <div className='flex justify-between'>
                <span>User:</span>
                <strong className='text-cyan-300'>{selectedInvoice?.userId}</strong>
              </div>
            </div>

            <div className='space-y-3 text-xs'>
              <div>
                <label className='block font-semibold mb-1 text-purple-300'>Transaction ID / TrxID</label>
                <input
                  type='text'
                  value={verifyTrxId}
                  onChange={(e) => setVerifyTrxId(e.target.value)}
                  placeholder='e.g., 9J28DA10K'
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white focus:outline-none focus:border-purple-400'
                />
              </div>
              <div>
                <label className='block font-semibold mb-1 text-purple-300'>Admin Verification Note</label>
                <input
                  type='text'
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder='e.g., Verified in bKash statement'
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white focus:outline-none focus:border-purple-400'
                />
              </div>
            </div>

            <div className='flex items-center justify-end gap-2 pt-2'>
              <button
                onClick={() => setShowVerifyModal(false)}
                className='px-4 py-2 bg-purple-900/50 hover:bg-purple-800 text-purple-300 rounded-xl text-xs font-semibold'
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyInvoice}
                className='px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md'
              >
                Mark as Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add/Edit Package */}
      {showPackageModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
          <form onSubmit={handleSavePackage} className='w-full max-w-lg bg-[#1d0a2f] border border-purple-700/60 rounded-2xl p-6 shadow-2xl space-y-4 text-white max-h-[90vh] overflow-y-auto'>
            <h3 className='text-lg font-bold text-white flex items-center gap-2'>
              <Server className='w-5 h-5 text-emerald-400' />
              {packageForm.id ? 'Edit Package' : 'Create Hosting Package'}
            </h3>

            <div className='grid grid-cols-2 gap-3 text-xs'>
              <div className='col-span-2'>
                <label className='block font-semibold mb-1 text-purple-300'>Package Name</label>
                <input
                  type='text'
                  required
                  value={packageForm.name}
                  onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                  placeholder='e.g., Standard Cloud (15 GB)'
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                />
              </div>
              <div>
                <label className='block font-semibold mb-1 text-purple-300'>Disk Space (GB)</label>
                <input
                  type='number'
                  required
                  min='1'
                  value={packageForm.diskSpaceGb}
                  onChange={(e) => setPackageForm({ ...packageForm, diskSpaceGb: Number(e.target.value) })}
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                />
              </div>
              <div>
                <label className='block font-semibold mb-1 text-purple-300'>Bandwidth (GB)</label>
                <input
                  type='number'
                  required
                  min='1'
                  value={packageForm.bandwidthGb}
                  onChange={(e) => setPackageForm({ ...packageForm, bandwidthGb: Number(e.target.value) })}
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                />
              </div>
              <div>
                <label className='block font-semibold mb-1 text-purple-300'>Max Domains</label>
                <input
                  type='number'
                  required
                  min='1'
                  value={packageForm.maxDomains}
                  onChange={(e) => setPackageForm({ ...packageForm, maxDomains: Number(e.target.value) })}
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                />
              </div>
              <div>
                <label className='block font-semibold mb-1 text-purple-300'>Max Databases</label>
                <input
                  type='number'
                  required
                  min='1'
                  value={packageForm.maxDatabases}
                  onChange={(e) => setPackageForm({ ...packageForm, maxDatabases: Number(e.target.value) })}
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                />
              </div>
              <div>
                <label className='block font-semibold mb-1 text-purple-300'>Monthly Price ($)</label>
                <input
                  type='number'
                  step='0.01'
                  required
                  value={packageForm.priceMonthly}
                  onChange={(e) => setPackageForm({ ...packageForm, priceMonthly: Number(e.target.value) })}
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                />
              </div>
              <div>
                <label className='block font-semibold mb-1 text-purple-300'>Yearly Price ($)</label>
                <input
                  type='number'
                  step='0.01'
                  required
                  value={packageForm.priceYearly}
                  onChange={(e) => setPackageForm({ ...packageForm, priceYearly: Number(e.target.value) })}
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                />
              </div>
            </div>

            <div className='flex items-center justify-end gap-2 pt-3 border-t border-purple-800/40'>
              <button
                type='button'
                onClick={() => setShowPackageModal(false)}
                className='px-4 py-2 bg-purple-900/50 hover:bg-purple-800 text-purple-300 rounded-xl text-xs font-semibold'
              >
                Cancel
              </button>
              <button
                type='submit'
                className='px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md'
              >
                Save Package
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Add Promotion Coupon */}
      {showPromoModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
          <form onSubmit={handleSavePromotion} className='w-full max-w-md bg-[#1d0a2f] border border-purple-700/60 rounded-2xl p-6 shadow-2xl space-y-4 text-white'>
            <h3 className='text-lg font-bold text-white flex items-center gap-2'>
              <Tag className='w-5 h-5 text-emerald-400' />
              Create Discount Coupon
            </h3>

            <div className='space-y-3 text-xs'>
              <div>
                <label className='block font-semibold mb-1 text-purple-300'>Coupon Code</label>
                <input
                  type='text'
                  required
                  value={promoForm.code}
                  onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                  placeholder='e.g., HOSTING25'
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white font-mono uppercase'
                />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block font-semibold mb-1 text-purple-300'>Type</label>
                  <select
                    value={promoForm.discountType}
                    onChange={(e) => setPromoForm({ ...promoForm, discountType: e.target.value })}
                    className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                  >
                    <option value='percentage'>Percentage (%)</option>
                    <option value='fixed'>Fixed Amount ($)</option>
                  </select>
                </div>
                <div>
                  <label className='block font-semibold mb-1 text-purple-300'>Discount Value</label>
                  <input
                    type='number'
                    required
                    min='1'
                    value={promoForm.discountValue}
                    onChange={(e) => setPromoForm({ ...promoForm, discountValue: Number(e.target.value) })}
                    className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                  />
                </div>
              </div>
            </div>

            <div className='flex items-center justify-end gap-2 pt-2'>
              <button
                type='button'
                onClick={() => setShowPromoModal(false)}
                className='px-4 py-2 bg-purple-900/50 hover:bg-purple-800 text-purple-300 rounded-xl text-xs font-semibold'
              >
                Cancel
              </button>
              <button
                type='submit'
                className='px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold'
              >
                Create Promo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Block IP */}
      {showIpBlockModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
          <form onSubmit={handleBlockIp} className='w-full max-w-md bg-[#1d0a2f] border border-purple-700/60 rounded-2xl p-6 shadow-2xl space-y-4 text-white'>
            <h3 className='text-lg font-bold text-rose-300 flex items-center gap-2'>
              <Ban className='w-5 h-5 text-rose-400' />
              Block IP Address
            </h3>

            <div className='space-y-3 text-xs'>
              <div>
                <label className='block font-semibold mb-1 text-purple-300'>Target IP Address</label>
                <input
                  type='text'
                  required
                  value={ipBlockForm.ip}
                  onChange={(e) => setIpBlockForm({ ...ipBlockForm, ip: e.target.value })}
                  placeholder='e.g., 192.168.1.100'
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white font-mono'
                />
              </div>
              <div>
                <label className='block font-semibold mb-1 text-purple-300'>Block Scope</label>
                <select
                  value={ipBlockForm.scope}
                  onChange={(e) => setIpBlockForm({ ...ipBlockForm, scope: e.target.value })}
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                >
                  <option value='all'>All Services &amp; Ordering</option>
                  <option value='ordering'>Ordering Only</option>
                  <option value='auth'>Authentication Only</option>
                </select>
              </div>
              <div>
                <label className='block font-semibold mb-1 text-purple-300'>Reason</label>
                <input
                  type='text'
                  value={ipBlockForm.reason}
                  onChange={(e) => setIpBlockForm({ ...ipBlockForm, reason: e.target.value })}
                  placeholder='e.g., Multiple failed brute force logins or fraudulent orders'
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                />
              </div>
            </div>

            <div className='flex items-center justify-end gap-2 pt-2'>
              <button
                type='button'
                onClick={() => setShowIpBlockModal(false)}
                className='px-4 py-2 bg-purple-900/50 hover:bg-purple-800 text-purple-300 rounded-xl text-xs font-semibold'
              >
                Cancel
              </button>
              <button
                type='submit'
                className='px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold'
              >
                Block IP
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB CONTENT: DATABASE SCHEMA */}
      {activeTab === 'database' && (
        <div className='space-y-6'>
          <div className='p-5 rounded-2xl bg-purple-950/30 border border-purple-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
            <div>
              <h2 className='text-lg font-bold text-white flex items-center gap-2'>
                <Database className='w-5 h-5 text-emerald-400' />
                Central Database Architecture (Scalable Normalized Schema)
              </h2>
              <p className='text-xs text-purple-300/80 mt-1'>
                Engine: <strong className='text-emerald-300'>{dbSchema?.engine || 'Tamim Hosting Normalized Relational Store'}</strong> • Total Tables: <strong className='text-cyan-300'>{dbSchema?.totalTables || 29}</strong> • Atomic file-based JSON relational engine with zero data loss.
              </p>
            </div>
            <button
              onClick={() => {
                api.getDatabaseTables().then(setDbSchema).catch(() => {});
                showToast('Database schema refreshed!');
              }}
              className='px-3.5 py-2 rounded-xl bg-purple-900/50 hover:bg-purple-800 text-purple-200 border border-purple-700/50 text-xs font-bold transition flex items-center gap-2'
            >
              <RotateCw className='w-3.5 h-3.5' />
              <span>Refresh Tables</span>
            </button>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {dbSchema && dbSchema.tables && Object.entries(dbSchema.tables).map(([tableName, info]) => (
              <div key={tableName} className='p-4 rounded-xl bg-purple-950/40 border border-purple-800/30 hover:border-purple-600/50 transition space-y-2.5'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <div className='w-2 h-2 rounded-full bg-emerald-400' />
                    <span className='font-mono font-bold text-white text-xs'>{tableName}</span>
                  </div>
                  <span className='px-2 py-0.5 rounded-full bg-purple-900/60 text-cyan-300 text-[10px] font-mono font-bold'>
                    {info.count} rows
                  </span>
                </div>
                <div>
                  <div className='text-[10px] uppercase font-bold text-purple-400/80 mb-1'>Columns</div>
                  <div className='flex flex-wrap gap-1'>
                    {(info.columns || []).slice(0, 7).map(col => (
                      <span key={col} className='px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-800/50 text-[10px] text-purple-200 font-mono'>
                        {col}
                      </span>
                    ))}
                    {(info.columns || []).length > 7 && (
                      <span className='text-[10px] text-purple-400 self-center'>
                        +{info.columns.length - 7} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: User Details (Services, Orders, Invoices, Domains) */}
      {showUserDetailModal && selectedUserDetail && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
          <div className='w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[#1d0a2f] border border-purple-700/60 rounded-2xl p-6 shadow-2xl space-y-4 text-white'>
            <div className='flex items-center justify-between border-b border-purple-800/40 pb-3'>
              <div className='flex items-center gap-2.5'>
                <div className='w-9 h-9 rounded-xl bg-purple-900/60 border border-purple-700/60 flex items-center justify-center text-cyan-400'>
                  <Users className='w-5 h-5' />
                </div>
                <div>
                  <h3 className='text-base font-bold text-white'>
                    {selectedUserDetail.user?.firstName} {selectedUserDetail.user?.lastName}
                  </h3>
                  <div className='text-[11px] text-cyan-300 font-mono'>{selectedUserDetail.user?.email}</div>
                </div>
              </div>
              <button
                onClick={() => setShowUserDetailModal(false)}
                className='text-purple-400 hover:text-white p-1'
              >
                ✕
              </button>
            </div>

            {/* Profile stats */}
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs'>
              <div className='p-3 bg-purple-950/60 rounded-xl border border-purple-800/30'>
                <span className='text-purple-400 block text-[10px] uppercase font-semibold'>Role</span>
                <span className='font-bold text-white capitalize'>{selectedUserDetail.user?.role}</span>
              </div>
              <div className='p-3 bg-purple-950/60 rounded-xl border border-purple-800/30'>
                <span className='text-purple-400 block text-[10px] uppercase font-semibold'>Status</span>
                <span className='font-bold text-emerald-400 capitalize'>{selectedUserDetail.user?.status}</span>
              </div>
              <div className='p-3 bg-purple-950/60 rounded-xl border border-purple-800/30'>
                <span className='text-purple-400 block text-[10px] uppercase font-semibold'>cPanel User</span>
                <span className='font-mono font-bold text-cyan-300'>{selectedUserDetail.user?.cpanelUser}</span>
              </div>
              <div className='p-3 bg-purple-950/60 rounded-xl border border-purple-800/30'>
                <span className='text-purple-400 block text-[10px] uppercase font-semibold'>Phone</span>
                <span className='font-bold text-white'>{selectedUserDetail.user?.phone || 'N/A'}</span>
              </div>
            </div>

            {/* Hosting Services */}
            <div className='space-y-2'>
              <h4 className='text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5'>
                <Server className='w-3.5 h-3.5 text-cyan-400' />
                Hosting Services ({(selectedUserDetail.services || []).length})
              </h4>
              <div className='bg-purple-950/40 rounded-xl border border-purple-800/30 overflow-hidden text-xs'>
                {(selectedUserDetail.services || []).length === 0 ? (
                  <p className='p-3 text-purple-300/60 text-center'>No hosting services provisioned.</p>
                ) : (
                  <div className='divide-y divide-purple-900/30'>
                    {selectedUserDetail.services.map(s => (
                      <div key={s.id} className='p-3 flex items-center justify-between'>
                        <div>
                          <span className='font-bold text-white'>{s.domain}</span>
                          <span className='text-[10px] text-purple-300 block'>{s.packageName} • {s.billingCycle}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          s.status === 'active' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60' : 'bg-rose-950 text-rose-300'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Orders & Invoices */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <h4 className='text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5'>
                  <ShoppingCart className='w-3.5 h-3.5 text-amber-400' />
                  Orders ({(selectedUserDetail.orders || []).length})
                </h4>
                <div className='bg-purple-950/40 rounded-xl border border-purple-800/30 p-2 text-xs space-y-1 max-h-36 overflow-y-auto'>
                  {(selectedUserDetail.orders || []).length === 0 ? (
                    <p className='text-purple-300/60 text-center py-2'>No orders.</p>
                  ) : (
                    selectedUserDetail.orders.map(o => (
                      <div key={o.id} className='flex justify-between items-center py-1 border-b border-purple-900/20 last:border-0'>
                        <span className='font-mono text-purple-300 text-[11px]'>{o.id}</span>
                        <span className='text-emerald-400 font-bold'>${o.totalAmount}</span>
                        <span className='text-[10px] capitalize text-purple-400'>{o.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className='space-y-1.5'>
                <h4 className='text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5'>
                  <FileText className='w-3.5 h-3.5 text-emerald-400' />
                  Invoices ({(selectedUserDetail.invoices || []).length})
                </h4>
                <div className='bg-purple-950/40 rounded-xl border border-purple-800/30 p-2 text-xs space-y-1 max-h-36 overflow-y-auto'>
                  {(selectedUserDetail.invoices || []).length === 0 ? (
                    <p className='text-purple-300/60 text-center py-2'>No invoices.</p>
                  ) : (
                    selectedUserDetail.invoices.map(inv => (
                      <div key={inv.id} className='flex justify-between items-center py-1 border-b border-purple-900/20 last:border-0'>
                        <span className='font-mono text-purple-300 text-[11px]'>{inv.invoiceNumber}</span>
                        <span className='text-emerald-400 font-bold'>${inv.totalAmount}</span>
                        <span className={`text-[10px] capitalize font-bold ${inv.status === 'paid' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {inv.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className='pt-2 flex justify-end'>
              <button
                onClick={() => setShowUserDetailModal(false)}
                className='px-4 py-2 bg-purple-900/50 hover:bg-purple-800 text-purple-300 rounded-xl text-xs font-semibold'
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit User */}
      {showEditUserModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
          <div className='w-full max-w-md bg-[#1d0a2f] border border-purple-700/60 rounded-2xl p-6 shadow-2xl space-y-4 text-white'>
            <h3 className='text-lg font-bold text-white flex items-center gap-2'>
              <Edit className='w-5 h-5 text-purple-400' />
              Edit User Account
            </h3>
            <form onSubmit={handleSaveEditUser} className='space-y-3 text-xs'>
              <div className='grid grid-cols-2 gap-2'>
                <div>
                  <label className='block font-semibold mb-1 text-purple-300'>First Name</label>
                  <input
                    type='text'
                    value={editUserForm.firstName}
                    onChange={(e) => setEditUserForm({ ...editUserForm, firstName: e.target.value })}
                    className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                  />
                </div>
                <div>
                  <label className='block font-semibold mb-1 text-purple-300'>Last Name</label>
                  <input
                    type='text'
                    value={editUserForm.lastName}
                    onChange={(e) => setEditUserForm({ ...editUserForm, lastName: e.target.value })}
                    className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                  />
                </div>
              </div>

              <div>
                <label className='block font-semibold mb-1 text-purple-300'>Email Address</label>
                <input
                  type='email'
                  required
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                />
              </div>

              <div>
                <label className='block font-semibold mb-1 text-purple-300'>Phone Number</label>
                <input
                  type='text'
                  value={editUserForm.phone}
                  onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                />
              </div>

              <div className='grid grid-cols-2 gap-2'>
                <div>
                  <label className='block font-semibold mb-1 text-purple-300'>Role</label>
                  <select
                    value={editUserForm.role}
                    onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                    className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                  >
                    <option value='client'>Client</option>
                    <option value='admin'>Administrator</option>
                  </select>
                </div>
                <div>
                  <label className='block font-semibold mb-1 text-purple-300'>Account Status</label>
                  <select
                    value={editUserForm.status}
                    onChange={(e) => setEditUserForm({ ...editUserForm, status: e.target.value })}
                    className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                  >
                    <option value='active'>Active</option>
                    <option value='suspended'>Suspended</option>
                  </select>
                </div>
              </div>

              <div className='flex items-center justify-end gap-2 pt-2'>
                <button
                  type='button'
                  onClick={() => setShowEditUserModal(false)}
                  className='px-4 py-2 bg-purple-900/50 hover:bg-purple-800 text-purple-300 rounded-xl text-xs font-semibold'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  className='px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold'
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reset Password */}
      {showResetPassModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
          <div className='w-full max-w-md bg-[#1d0a2f] border border-purple-700/60 rounded-2xl p-6 shadow-2xl space-y-4 text-white'>
            <h3 className='text-lg font-bold text-white flex items-center gap-2'>
              <Key className='w-5 h-5 text-amber-400' />
              Reset User Password
            </h3>
            <p className='text-xs text-purple-300/70'>
              The password will be safely hashed with <strong>bcrypt</strong> and securely updated across user records and linked hosting services.
            </p>
            <form onSubmit={handleSaveResetPass} className='space-y-3 text-xs'>
              <div>
                <label className='block font-semibold mb-1 text-purple-300'>User Account</label>
                <input
                  type='text'
                  readOnly
                  disabled
                  value={resetPassForm.userEmail}
                  className='w-full px-3 py-2 bg-purple-950/40 border border-purple-800/40 rounded-xl text-purple-300 font-mono opacity-80 cursor-not-allowed'
                />
              </div>
              <div>
                <label className='block font-semibold mb-1 text-purple-300'>New Password (min 6 chars)</label>
                <input
                  type='password'
                  required
                  value={resetPassForm.newPassword}
                  onChange={(e) => setResetPassForm({ ...resetPassForm, newPassword: e.target.value })}
                  placeholder='Enter strong new password'
                  className='w-full px-3 py-2 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white'
                />
              </div>

              <div className='flex items-center justify-end gap-2 pt-2'>
                <button
                  type='button'
                  onClick={() => setShowResetPassModal(false)}
                  className='px-4 py-2 bg-purple-900/50 hover:bg-purple-800 text-purple-300 rounded-xl text-xs font-semibold'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  className='px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-xl text-xs'
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
