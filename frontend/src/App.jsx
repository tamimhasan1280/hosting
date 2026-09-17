import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import AppLayout from './layout/AppLayout';
import ServerInfoModal from './components/ServerInfoModal';
import { Lock, Clock, AlertTriangle, CheckCircle, Shield, ArrowRight, ShieldCheck } from 'lucide-react';

// Pages
import Dashboard from './pages/Dashboard';
import FileManager from './pages/FileManager';
import ImagesManager from './pages/ImagesManager';
import DirectoryPrivacy from './pages/DirectoryPrivacy';
import DiskUsage from './pages/DiskUsage';
import WebDisk from './pages/WebDisk';
import FtpAccounts from './pages/FtpAccounts';
import DatabaseManager from './pages/DatabaseManager';
import DatabaseWizard from './pages/DatabaseWizard';
import RemoteDatabaseAccess from './pages/RemoteDatabaseAccess';
import PhpMyAdmin from './pages/PhpMyAdmin';
import DomainManager from './pages/DomainManager';
import EmailManager from './pages/EmailManager';
import PhpManager from './pages/PhpManager';
import SslManager from './pages/SslManager';
import CronManager from './pages/CronManager';
import SoftaculousManager from './pages/SoftaculousManager';
import GitManager from './pages/GitManager';
import BackupManager from './pages/BackupManager';
import BackupWizard from './pages/BackupWizard';
import FileRestoration from './pages/FileRestoration';
import JetBackupManager from './pages/JetBackupManager';
import WordPressManagement from './pages/WordPressManagement';
import SitejetManager from './pages/SitejetManager';
import SocialMediaManager from './pages/SocialMediaManager';
import MetricsManager from './pages/MetricsManager';
import WhmcsBridge from './pages/WhmcsBridge';
import RedirectManager from './pages/RedirectManager';
import ZoneEditor from './pages/ZoneEditor';
import DynamicDnsManager from './pages/DynamicDnsManager';
import VisitorsManager from './pages/VisitorsManager';
import SiteQualityManager from './pages/SiteQualityManager';
import ErrorsManager from './pages/ErrorsManager';
import BandwidthManager from './pages/BandwidthManager';
import RawAccessManager from './pages/RawAccessManager';
import AwstatsManager from './pages/AwstatsManager';
import AnalogStatsManager from './pages/AnalogStatsManager';
import WebalizerManager from './pages/WebalizerManager';
import WebalizerFtpManager from './pages/WebalizerFtpManager';
import MetricsEditorManager from './pages/MetricsEditorManager';
import ResourceUsageManager from './pages/ResourceUsageManager';
import SshAccessManager from './pages/SshAccessManager';
import IpBlockerManager from './pages/IpBlockerManager';
import ManageApiTokens from './pages/ManageApiTokens';
import HotlinkProtectionManager from './pages/HotlinkProtectionManager';
import LeechProtectionManager from './pages/LeechProtectionManager';
import ModSecurityManager from './pages/ModSecurityManager';
import SecuritySuiteManager from './pages/SecuritySuiteManager';
import AppManager from './pages/AppManager';
import PackageManager from './pages/PackageManager';
import OptimizeWebsiteManager from './pages/OptimizeWebsiteManager';
import DnsTrackerManager from './pages/DnsTrackerManager';
import IndexesManager from './pages/IndexesManager';
import ErrorPagesManager from './pages/ErrorPagesManager';
import ApacheHandlersManager from './pages/ApacheHandlersManager';
import MimeTypesManager from './pages/MimeTypesManager';
import AccountPreferencesManager from './pages/AccountPreferencesManager';
import ServerInfoPage from './pages/ServerInfoPage';
import LoginPage from './pages/LoginPage';

// Client Portal Pages
import ClientDashboard from './pages/ClientDashboard';
import NewOrderFlow from './pages/NewOrderFlow';
import ClientServices from './pages/ClientServices';
import ClientInvoices from './pages/ClientInvoices';
import ClientDomains from './pages/ClientDomains';
import DomainHostingDashboard from './pages/DomainHostingDashboard';
import AdminDashboard from './pages/AdminDashboard';


export default function App() {
  const [currentView, setCurrentView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const jump = params.get('jump');
    if (jump === 'webmail') return 'email';
    if (jump === 'phpmyadmin') return 'phpmyadmin';
    const viewParam = params.get('view');
    if (viewParam) return viewParam;
    const role = localStorage.getItem('cpanel_user_role') || sessionStorage.getItem('cpanel_user_role') || 'client';
    return role === 'admin' ? 'admin_dashboard' : 'client_dashboard';
  });
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('cpanel_user_role') || sessionStorage.getItem('cpanel_user_role') || 'client';
  });
  const [clientServices, setClientServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState(null);
  const [serverInfoOpen, setServerInfoOpen] = useState(false);
  const [jumpParam, setJumpParam] = useState(null);
  const [activeHostingContext, setActiveHostingContext] = useState(() => {
    try {
      const saved = localStorage.getItem('cpanel_active_hosting_context');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [sessionToken, setSessionToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session') || localStorage.getItem('cpanel_session_token') || sessionStorage.getItem('cpanel_session_token') || '';
  });
  const [userKey, setUserKey] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('user') || localStorage.getItem('cpanel_active_user') || sessionStorage.getItem('cpanel_active_user') || '';
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('session') || localStorage.getItem('cpanel_session_token') || sessionStorage.getItem('cpanel_session_token');
    return !!token;
  });
  const [isAuthChecking, setIsAuthChecking] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('session') || localStorage.getItem('cpanel_session_token') || sessionStorage.getItem('cpanel_session_token');
    return !!token;
  });

  const fetchStats = async () => {
    try {
      const data = await api.getSystemStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch system stats', err);
    }
  };

  // SSO Session & URL Parameter Initializer
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sess = params.get('session') || localStorage.getItem('cpanel_session_token') || sessionStorage.getItem('cpanel_session_token');
    const user = params.get('user') || localStorage.getItem('cpanel_active_user') || sessionStorage.getItem('cpanel_active_user');
    const view = params.get('view');
    const jump = params.get('jump');
    const email = params.get('email');
    const db = params.get('db');

    if (sess) {
      api.validateSession(sess, user).then(res => {
        if (res && res.valid) {
          const verifiedUser = res.user || user || 'cpanel_user';
          localStorage.setItem('cpanel_active_user', verifiedUser);
          localStorage.setItem('cpanel_session_token', sess);
          if (res.role) {
            setUserRole(res.role);
            localStorage.setItem('cpanel_user_role', res.role);
          }
          setUserKey(verifiedUser);
          setSessionToken(sess);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('cpanel_session_token');
          localStorage.removeItem('cpanel_active_user');
          localStorage.removeItem('cpanel_user_email');
          localStorage.removeItem('cpanel_user_role');
          sessionStorage.removeItem('cpanel_session_token');
          sessionStorage.removeItem('cpanel_active_user');
          sessionStorage.removeItem('cpanel_user_role');
          setSessionToken('');
          setUserKey('');
          setUserRole('client');
          setIsAuthenticated(false);
        }
      }).catch(() => {
        setIsAuthenticated(false);
      }).finally(() => {
        setIsAuthChecking(false);
      });
    } else {
      setIsAuthenticated(false);
      setIsAuthChecking(false);
    }

    if (jump === 'webmail') {
      setCurrentView('email');
      setJumpParam({ type: 'webmail', email });
    } else if (jump === 'phpmyadmin') {
      setCurrentView('phpmyadmin');
      setJumpParam({ type: 'phpmyadmin', db });
    } else if (view) {
      setCurrentView(view);
    }
  }, []);

  const fetchClientServices = async () => {
    try {
      const svcs = await api.getClientServices();
      setClientServices(Array.isArray(svcs) ? svcs : []);
    } catch (e) {
      setClientServices([]);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      fetchClientServices();
      const interval = setInterval(() => {
        fetchStats();
        fetchClientServices();
      }, 10000); // 10s auto-refresh
      return () => clearInterval(interval);
    }
  }, [userKey, isAuthenticated]);

  const handleUserChange = (newUser) => {
    setUserKey(newUser);
    fetchStats();
    fetchClientServices();
  };

  const handleLoginSuccess = (res) => {
    setSessionToken(res.token);
    setUserKey(res.user || 'cpanel_user');
    setIsAuthenticated(true);
    const role = res.role || 'client';
    setUserRole(role);
    localStorage.setItem('cpanel_user_role', role);
    if (role === 'admin') {
      setCurrentView('dashboard');
    } else {
      setCurrentView('client_dashboard');
    }
    fetchStats();
    fetchClientServices();
  };

  const handleLogout = async () => {
    try {
      if (sessionToken) {
        await api.logout(sessionToken);
      }
    } catch (err) {
      console.error('Logout error', err);
    }
    localStorage.removeItem('cpanel_session_token');
    localStorage.removeItem('cpanel_active_user');
    localStorage.removeItem('cpanel_user_email');
    localStorage.removeItem('cpanel_user_role');
    localStorage.removeItem('cpanel_active_hosting_context');
    localStorage.removeItem('cpanel_active_domain');
    localStorage.removeItem('cpanel_active_package');
    sessionStorage.removeItem('cpanel_session_token');
    sessionStorage.removeItem('cpanel_active_user');
    sessionStorage.removeItem('cpanel_user_role');
    setActiveHostingContext(null);
    setClientServices([]);
    setUserRole('client');
    localStorage.removeItem('cpanel_active_package');
    sessionStorage.removeItem('cpanel_session_token');
    sessionStorage.removeItem('cpanel_active_user');
    setActiveHostingContext(null);
    setSessionToken('');
    setUserKey('');
    setIsAuthenticated(false);
  };

  const handleNavigate = (view, jump = null, extra = null) => {
    setCurrentView(view);
    if (jump || extra) {
      setJumpParam({ type: jump || 'navigate', ...(extra || {}) });
    } else {
      setJumpParam(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDomainCpanel = (domainInfo, targetView = 'dashboard') => {
    if (!domainInfo) {
      handleNavigate('dashboard');
      return;
    }
    const ctx = typeof domainInfo === 'string' ? { user: domainInfo } : domainInfo;
    setActiveHostingContext(ctx);
    try {
      localStorage.setItem('cpanel_active_hosting_context', JSON.stringify(ctx));
      if (ctx.domain) localStorage.setItem('cpanel_active_domain', ctx.domain);
      if (ctx.package) localStorage.setItem('cpanel_active_package', ctx.package);
    } catch (e) {}

    if (ctx.user) {
      handleUserChange(ctx.user);
    }
    handleNavigate(targetView);
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#f4f6f8] flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#ff6c2c] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Verifying cPanel Security Session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const isAdmin = userRole === 'admin';
  const hasActiveService = clientServices.some(s => s.status === 'active');
  const hasPendingService = clientServices.some(s => s.status === 'pending');
  const clientPortalViews = [
    'client_dashboard', 'new_order', 'my_services', 'my_domains',
    'domain_hosting', 'invoices', 'payments', 'my_orders', 'admin_dashboard', 'whm'
  ];
  const isCpanelToolView = !clientPortalViews.includes(currentView);

  return (
    <AppLayout
      currentView={currentView}
      activeHostingContext={activeHostingContext}
      onNavigate={handleNavigate}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      onUserChange={handleUserChange}
      onLogout={handleLogout}
      version="136.0.40"
    >
      <div key={`${userKey}-${jumpParam?.type || 'standard'}`}>
        {/* Main Admin Management Panel (WHM) */}
        {(currentView === 'admin_dashboard' || currentView === 'whm') && (
          <AdminDashboard 
            onNavigate={handleNavigate}
          />
        )}

        {/* Client Portal Views */}
        {currentView === 'client_dashboard' && (
          <ClientDashboard 
            onNavigate={handleNavigate}
            onOpenCpanel={handleOpenDomainCpanel}
            onLogout={handleLogout}
          />
        )}
        {currentView === 'new_order' && (
          <NewOrderFlow 
            onNavigate={handleNavigate} 
            initialPackage={jumpParam?.selectedPackage}
            initialPackageId={jumpParam?.initialPackageId}
          />
        )}
        {(currentView === 'my_services' || currentView === 'hosting') && (
          <ClientServices 
            onNavigate={handleNavigate}
            onOpenCpanel={handleOpenDomainCpanel}
          />
        )}
        {currentView === 'my_domains' && (
          <ClientDomains onNavigate={handleNavigate} />
        )}
        {currentView === 'domain_hosting' && (
          <DomainHostingDashboard
            serviceId={jumpParam?.serviceId}
            domainName={jumpParam?.domain}
            onNavigate={handleNavigate}
            onOpenCpanel={handleOpenDomainCpanel}
          />
        )}
        {(currentView === 'invoices' || currentView === 'payments' || currentView === 'my_orders') && (
          <ClientInvoices onNavigate={handleNavigate} />
        )}

        {/* ACCESS GUARD: Prevent unauthorized access to cPanel tools without an active package & domain */}
        {isCpanelToolView && !isAdmin && !hasActiveService ? (
          hasPendingService ? (
            /* SERVICE PENDING ADMIN ACTIVATION SCREEN */
            <div className="max-w-2xl mx-auto my-10 p-8 rounded-3xl bg-[#1c0830]/95 border border-amber-500/50 text-center space-y-6 shadow-2xl backdrop-blur-2xl">
              <div className="w-16 h-16 rounded-2xl bg-amber-950/80 border border-amber-500/60 flex items-center justify-center text-amber-400 mx-auto shadow-lg ring-4 ring-amber-500/10">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>
              
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-900/50 border border-amber-500/40 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Pending Admin Activation</span>
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  Hosting Service Pending Main Admin Activation
                </h2>
                <p className="text-xs text-purple-200/90 max-w-lg mx-auto leading-relaxed">
                  Your order has been recorded and payment received. In accordance with platform security, your cPanel account, File Manager, and Databases remain locked until the <strong>Main Administrator</strong> reviews and activates your service.
                </p>
                <p className="text-[12px] text-amber-300/90 max-w-md mx-auto leading-relaxed italic bg-amber-950/40 py-1.5 px-3 rounded-xl border border-amber-500/30">
                  মেইন অ্যাডমিন আপনার পেমেন্ট ভেরিফাই করে সার্ভিসটি অ্যাক্টিভ করার সাথে সাথে সিপ্যানেল ও ফাইল ম্যানেজার স্বয়ংক্রিয়ভাবে খুলে যাবে।
                </p>
              </div>

              {/* Step Progress Visualizer */}
              <div className="bg-[#240c3c]/80 p-4 rounded-2xl border border-purple-800/40 max-w-lg mx-auto text-left space-y-3">
                <div className="flex items-center justify-between text-xs text-purple-300/70 border-b border-purple-800/30 pb-2">
                  <span className="font-semibold text-white">Activation Pipeline</span>
                  <span className="text-[11px] text-amber-400 font-mono">Status: Awaiting Review</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center gap-2.5 text-emerald-400 font-medium">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Step 1: Hosting Package Selected &amp; Payment Recorded</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-amber-300 font-bold">
                    <Clock className="w-4 h-4 shrink-0 animate-spin" />
                    <span>Step 2: Main Administrator Verification &amp; Account Provisioning (In Progress)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-purple-300/50">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>Step 3: cPanel Jupiter, File Manager &amp; MySQL Access (Locked)</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleNavigate('invoices')}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>View Order &amp; Invoice Status</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate('client_dashboard')}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-900/50 hover:bg-purple-800 text-purple-200 hover:text-white font-semibold text-xs border border-purple-700/50 transition cursor-pointer"
                >
                  Back to Client Dashboard
                </button>
              </div>
            </div>
          ) : (
            /* NO PACKAGE / INACTIVE SCREEN */
            <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-[#1c0830]/95 border border-amber-500/40 text-center space-y-4 shadow-2xl backdrop-blur-xl">
              <div className="w-14 h-14 rounded-2xl bg-amber-950/80 border border-amber-500/50 flex items-center justify-center text-amber-400 mx-auto shadow-lg">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-black text-white tracking-tight">Active Hosting Package &amp; Domain Required</h2>
                <p className="text-xs text-purple-200/80 max-w-md mx-auto leading-relaxed">
                  cPanel management tools (File Manager, MySQL Databases, Webmail, etc.) are strictly isolated per domain and require an active purchased hosting service.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleNavigate('client_dashboard')}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg transition cursor-pointer"
                >
                  Choose Hosting Package on Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate('my_services')}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-900/50 hover:bg-purple-800 text-purple-200 hover:text-white font-semibold text-xs border border-purple-700/50 transition cursor-pointer"
                >
                  View My Services
                </button>
              </div>
            </div>
          )
        ) : (
          <>
        {/* cPanel Jupiter Views */}
        {currentView === 'dashboard' && (
          <Dashboard 
            onOpenTool={handleNavigate} 
            searchQuery={searchQuery}
            stats={stats}
            onOpenServerInfo={() => setServerInfoOpen(true)}
            onLogout={handleLogout}
          />
        )}
        {currentView === 'files' && (
          <FileManager stats={stats} initialPath={jumpParam?.initialPath} />
        )}
        {currentView === 'images' && (
          <ImagesManager onOpenFileManager={() => handleNavigate('files')} />
        )}
        {currentView === 'privacy' && (
          <DirectoryPrivacy onOpenFileManager={() => handleNavigate('files')} />
        )}
        {currentView === 'disk_usage' && (
          <DiskUsage onOpenFileManager={(path) => handleNavigate('files', null, { initialPath: path })} />
        )}
        {currentView === 'web_disk' && (
          <WebDisk onOpenFileManager={(path) => handleNavigate('files', null, { initialPath: path })} />
        )}
        {currentView === 'ftp_accounts' && (
          <FtpAccounts onOpenFileManager={(path) => handleNavigate('files', null, { initialPath: path })} />
        )}
        {currentView === 'databases' && (
          <DatabaseManager 
            initialJumpDb={jumpParam?.type === 'phpmyadmin' ? jumpParam.db : null} 
            onNavigate={handleNavigate} 
          />
        )}
        {(currentView === 'database_wizard' || currentView === 'mysql_wizard') && (
          <DatabaseWizard onNavigate={handleNavigate} />
        )}
        {(currentView === 'remote_databases' || currentView === 'remote_database_access') && (
          <RemoteDatabaseAccess onNavigate={handleNavigate} />
        )}
        {currentView === 'phpmyadmin' && (
          <PhpMyAdmin 
            initialJumpDb={jumpParam?.type === 'phpmyadmin' ? jumpParam.db : null} 
            onNavigate={handleNavigate} 
          />
        )}
        {(currentView === 'domains' || currentView === 'addon_domains') && (
          <DomainManager 
            onOpenFileManager={(path) => handleNavigate('files', null, { initialPath: path })}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {currentView === 'email' && (
          <EmailManager initialJumpEmail={jumpParam?.type === 'webmail' ? jumpParam.email : null} />
        )}
        {currentView === 'php' && <PhpManager />}
        {currentView === 'ssl' && (
          <SslManager 
            onBack={() => handleNavigate('dashboard')} 
            onNavigate={handleNavigate} 
            user={userKey} 
          />
        )}
        {currentView === 'cron' && <CronManager />}
        {currentView === 'softaculous' && <SoftaculousManager />}
        {currentView === 'git' && <GitManager />}
        {currentView === 'backups' && <BackupManager />}
        {currentView === 'backup_wizard' && <BackupWizard onNavigate={handleNavigate} />}
        {currentView === 'file_restoration' && (
          <FileRestoration 
            onOpenFileManager={(path) => handleNavigate('files', null, { initialPath: path })} 
            onNavigate={handleNavigate} 
          />
        )}
        {currentView === 'jetbackup_5' && (
          <JetBackupManager 
            onOpenFileManager={(path) => handleNavigate('files', null, { initialPath: path })} 
            onNavigate={handleNavigate} 
          />
        )}
        {(currentView === 'wordpress_management' || currentView === 'wp_management_domains') && (
          <WordPressManagement 
            onBack={() => handleNavigate('dashboard')} 
            user={userKey}
          />
        )}
        {(currentView === 'sitejet_builder' || currentView === 'sitejet') && (
          <SitejetManager 
            onBack={() => handleNavigate('dashboard')} 
            user={userKey}
          />
        )}
        {(currentView === 'social_media' || currentView === 'social' || currentView === 'social_media_mgmt') && (
          <SocialMediaManager 
            onBack={() => handleNavigate('dashboard')} 
            user={userKey}
          />
        )}
        {currentView === 'metrics' && <MetricsManager />}
        {currentView === 'visitors' && (
          <VisitorsManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {(currentView === 'site_quality_monitoring' || currentView === 'site_quality' || currentView === 'monitoring') && (
          <SiteQualityManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {(currentView === 'errors' || currentView === 'error_logs') && (
          <ErrorsManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {currentView === 'bandwidth' && (
          <BandwidthManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {(currentView === 'raw_access' || currentView === 'rawaccess') && (
          <RawAccessManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {(currentView === 'awstats' || currentView === 'aw_stats') && (
          <AwstatsManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {(currentView === 'analog_stats' || currentView === 'analog') && (
          <AnalogStatsManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {currentView === 'webalizer' && (
          <WebalizerManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {(currentView === 'webalizer_ftp' || currentView === 'webalizerftp') && (
          <WebalizerFtpManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {(currentView === 'metrics_editor' || currentView === 'metricseditor') && (
          <MetricsEditorManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {(currentView === 'resource_usage' || currentView === 'resourceusage') && (
          <ResourceUsageManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {(currentView === 'ssh_access' || currentView === 'ssh') && (
          <SshAccessManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {(currentView === 'ip_blocker' || currentView === 'ipblocker') && (
          <IpBlockerManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {currentView === 'whmcs' && <WhmcsBridge />}
        {(currentView === 'redirects' || currentView === 'redirect_manager') && (
          <RedirectManager
            onBack={() => handleNavigate('domains')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {currentView === 'zone_editor' && (
          <ZoneEditor
            onBack={() => handleNavigate('domains')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {(currentView === 'dynamic_dns' || currentView === 'ddns') && (
          <DynamicDnsManager
            onBack={() => handleNavigate('domains')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {(currentView === 'api_tokens' || currentView === 'manage_api_tokens') && (
          <ManageApiTokens
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {(currentView === 'hotlink_protection' || currentView === 'hotlink') && (
          <HotlinkProtectionManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
        {(currentView === 'leech_protection' || currentView === 'leech') && (
          <LeechProtectionManager
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            user={userKey}
          />
        )}
              {(currentView === 'modsecurity' || currentView === 'modsec') && (
          <ModSecurityManager
            onBack={() => handleNavigate('dashboard')}
            user={userKey}
          />
        )}
        {currentView === 'cpguard' && (
          <SecuritySuiteManager
            onBack={() => handleNavigate('dashboard')}
            mode="cpguard"
            user={userKey}
          />
        )}
        {currentView === 'imunify360' && (
          <SecuritySuiteManager
            onBack={() => handleNavigate('dashboard')}
            mode="imunify"
            user={userKey}
          />
        )}
        {(currentView === 'application_manager' || currentView === 'nodejs_app' || currentView === 'python_app' || currentView === 'accelerate_wp') && (
          <AppManager
            onBack={() => handleNavigate('dashboard')}
            defaultTab={currentView === 'nodejs_app' ? 'node' : currentView === 'python_app' ? 'python' : currentView === 'accelerate_wp' ? 'accelerate' : 'all'}
            user={userKey}
          />
        )}
        {(currentView === 'pear' || currentView === 'perl') && (
          <PackageManager
            onBack={() => handleNavigate('dashboard')}
            defaultMode={currentView === 'perl' ? 'perl' : 'pear'}
          />
        )}
        {currentView === 'optimize_website' && (
          <OptimizeWebsiteManager
            onBack={() => handleNavigate('dashboard')}
            user={userKey}
          />
        )}
        {currentView === 'track_dns' && (
          <DnsTrackerManager
            onBack={() => handleNavigate('dashboard')}
            user={userKey}
          />
        )}
        {currentView === 'indexes' && (
          <IndexesManager
            onBack={() => handleNavigate('dashboard')}
          />
        )}
        {currentView === 'error_pages' && (
          <ErrorPagesManager
            onBack={() => handleNavigate('dashboard')}
            user={userKey}
          />
        )}
        {currentView === 'apache_handlers' && (
          <ApacheHandlersManager
            onBack={() => handleNavigate('dashboard')}
          />
        )}
        {currentView === 'mime_types' && (
          <MimeTypesManager
            onBack={() => handleNavigate('dashboard')}
          />
        )}
        {currentView === 'account_preferences' && (
          <AccountPreferencesManager
            onBack={() => handleNavigate('dashboard')}
            user={userKey}
          />
        )}
        {currentView === 'change_language' && (
          <ChangeLanguageManager
            onBack={() => handleNavigate('dashboard')}
            user={userKey}
          />
        )}
        {currentView === 'server_info' && (
          <ServerInfoPage
            onBack={() => handleNavigate('dashboard')}
            user={userKey}
          />
        )}
        </>
        )}
      </div>


      {/* Server Information Modal */}
      <ServerInfoModal
        isOpen={serverInfoOpen}
        onClose={() => setServerInfoOpen(false)}
        stats={stats}
      />
    </AppLayout>
  );
}
