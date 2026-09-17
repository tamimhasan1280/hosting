import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Server, Globe, ShoppingCart, FileText, CheckCircle2, Clock, ArrowRight, 
  Shield, CreditCard, User, ExternalLink, RefreshCw, AlertTriangle, 
  Layers, Check, Sparkles, HardDrive, Cpu 
} from 'lucide-react';

export default function ClientDashboard({ onNavigate, onOpenCpanel, onLogout }) {
  const [data, setData] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, pkgsRes] = await Promise.all([
        api.getClientDashboard(),
        api.getClientPackages().catch(() => [])
      ]);
      setData(dashRes);
      setPackages(pkgsRes || []);
      setError('');
    } catch (err) {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div className='min-h-[500px] flex items-center justify-center'>
        <div className='text-center space-y-3'>
          <div className='w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto' />
          <p className='text-xs text-purple-300/70'>Loading Client Portal...</p>
        </div>
      </div>
    );
  }

  const user = data?.user || {};
  const counts = data?.counts || { activeServices: 0, activeDomains: 0, pendingOrders: 0, unpaidInvoices: 0, expiringServices: 0, totalSpent: 0 };
  const recentOrders = data?.recentOrders || [];
  const recentInvoices = data?.recentInvoices || [];
  const services = data?.services || [];

  return (
    <div className='space-y-6'>
      {/* Top Banner */}
      <div className='relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#21093b] via-[#2f104d] to-[#123124] border border-purple-800/40 p-6 shadow-xl'>
        <div className='relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <div className='space-y-1.5'>
            <div className='inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 text-[11px] font-bold'>
              <Shield className='w-3 h-3 text-emerald-400' />
              <span>Verified Client Account</span>
            </div>
            <h1 className='text-2xl font-black tracking-tight text-white'>
              Welcome, {user.firstName || 'Client'} {user.lastName || ''}
            </h1>
            <p className='text-xs text-purple-200/70 flex flex-wrap items-center gap-3'>
              <span>Email: <strong className='text-white'>{user.email}</strong></span>
              <span>•</span>
              <span>Phone: <strong className='text-white'>{user.phone || 'N/A'}</strong></span>
              <span>•</span>
              <span>cPanel User: <strong className='text-emerald-300 font-mono'>{user.cpanelUser}</strong></span>
            </p>
          </div>
          <div className='flex items-center gap-3'>
            <button onClick={() => onNavigate('new_order')} className='px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg flex items-center gap-2 cursor-pointer transition transform active:scale-95'>
              <ShoppingCart className='w-4 h-4' />
              <span>Order New Hosting</span>
            </button>
            <button onClick={loadData} title='Refresh Data' className='p-2.5 rounded-xl bg-purple-900/40 border border-purple-700/40 text-purple-200 hover:text-white cursor-pointer transition'>
              <RefreshCw className='w-4 h-4' />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Summary Cards (Section 3: Active Services, Pending Orders, Unpaid Invoices, Expiring Services) */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
        <div onClick={() => onNavigate('my_services')} className='p-5 rounded-2xl bg-[#1b082e]/80 border border-purple-800/40 hover:border-emerald-500/50 transition cursor-pointer shadow-lg'>
          <div className='flex items-center justify-between'>
            <span className='text-xs font-semibold text-purple-300/80'>Active Services</span>
            <div className='w-9 h-9 rounded-xl bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center text-emerald-400'>
              <Server className='w-4 h-4' />
            </div>
          </div>
          <div className='mt-3 flex items-baseline justify-between'>
            <span className='text-2xl font-black text-white'>{counts.activeServices}</span>
            <span className='text-[11px] text-emerald-400 font-medium flex items-center gap-1'>Manage <ArrowRight className='w-3 h-3' /></span>
          </div>
        </div>

        <div onClick={() => onNavigate('my_orders')} className='p-5 rounded-2xl bg-[#1b082e]/80 border border-purple-800/40 hover:border-amber-500/50 transition cursor-pointer shadow-lg'>
          <div className='flex items-center justify-between'>
            <span className='text-xs font-semibold text-purple-300/80'>Pending Orders</span>
            <div className='w-9 h-9 rounded-xl bg-amber-900/40 border border-amber-700/40 flex items-center justify-center text-amber-400'>
              <Clock className='w-4 h-4' />
            </div>
          </div>
          <div className='mt-3 flex items-baseline justify-between'>
            <span className='text-2xl font-black text-white'>{counts.pendingOrders}</span>
            <span className='text-[11px] text-amber-400 font-medium flex items-center gap-1'>Track <ArrowRight className='w-3 h-3' /></span>
          </div>
        </div>

        <div onClick={() => onNavigate('invoices')} className='p-5 rounded-2xl bg-[#1b082e]/80 border border-purple-800/40 hover:border-rose-500/50 transition cursor-pointer shadow-lg'>
          <div className='flex items-center justify-between'>
            <span className='text-xs font-semibold text-purple-300/80'>Unpaid Invoices</span>
            <div className='w-9 h-9 rounded-xl bg-rose-900/40 border border-rose-700/40 flex items-center justify-center text-rose-400'>
              <FileText className='w-4 h-4' />
            </div>
          </div>
          <div className='mt-3 flex items-baseline justify-between'>
            <span className='text-2xl font-black text-white'>{counts.unpaidInvoices}</span>
            <span className='text-[11px] text-rose-400 font-medium flex items-center gap-1'>Pay Now <ArrowRight className='w-3 h-3' /></span>
          </div>
        </div>

        <div onClick={() => onNavigate('my_services')} className='p-5 rounded-2xl bg-[#1b082e]/80 border border-purple-800/40 hover:border-purple-500/50 transition cursor-pointer shadow-lg'>
          <div className='flex items-center justify-between'>
            <span className='text-xs font-semibold text-purple-300/80'>Expiring Services</span>
            <div className='w-9 h-9 rounded-xl bg-purple-900/40 border border-purple-700/40 flex items-center justify-center text-amber-400'>
              <AlertTriangle className='w-4 h-4' />
            </div>
          </div>
          <div className='mt-3 flex items-baseline justify-between'>
            <span className='text-2xl font-black text-white'>{counts.expiringServices || 0}</span>
            <span className='text-[11px] text-purple-300 font-medium flex items-center gap-1'>View <ArrowRight className='w-3 h-3' /></span>
          </div>
        </div>
      </div>

      {/* MY HOSTING SECTION (Section 17 & 18) */}
      <div className='p-6 rounded-2xl bg-[#1b082e]/80 border border-purple-800/40 shadow-xl space-y-4'>
        <div className='flex items-center justify-between border-b border-purple-900/40 pb-3'>
          <div className='flex items-center gap-2'>
            <Server className='w-4 h-4 text-emerald-400' />
            <h2 className='font-bold text-sm text-white'>My Hosting Services</h2>
          </div>
          <button 
            onClick={() => onNavigate('my_services')} 
            className='text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer'
          >
            View All Services &rarr;
          </button>
        </div>

        {services.length === 0 ? (
          <div className='p-8 text-center text-xs text-purple-300/60 border border-dashed border-purple-800/40 rounded-xl space-y-2'>
            <p>You do not have any hosting services yet.</p>
            <button 
              onClick={() => onNavigate('new_order')} 
              className='px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs'
            >
              Order Hosting Plan
            </button>
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {services.slice(0, 6).map(svc => {
              const rawStatus = (svc.status || 'active').toLowerCase();
              const isSvcActive = rawStatus === 'active';
              return (
                <div 
                  key={svc.id} 
                  className='p-4 rounded-xl bg-[#240939]/70 border border-purple-800/50 hover:border-emerald-500/50 transition flex flex-col justify-between space-y-3'
                >
                  <div className='space-y-1.5'>
                    <div className='flex items-center justify-between'>
                      <span className='font-mono font-bold text-white text-xs truncate'>{svc.domain}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                        isSvcActive ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50' :
                        rawStatus === 'pending' ? 'bg-amber-950/80 text-amber-300 border-amber-700/50' :
                        'bg-rose-950/80 text-rose-300 border-rose-700/50'
                      }`}>
                        {svc.status}
                      </span>
                    </div>
                    <p className='text-[11px] text-purple-300/70'>Package: <strong className='text-white'>{svc.packageName}</strong></p>
                    <p className='text-[11px] text-purple-300/60'>Expires: {svc.nextDueDate ? new Date(svc.nextDueDate).toLocaleDateString() : '2026-10-17'}</p>
                  </div>

                  <button
                    type='button'
                    onClick={() => onNavigate('domain_hosting', null, { serviceId: svc.id, domain: svc.domain })}
                    className='w-full py-2 px-3 rounded-lg bg-purple-900/50 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer'
                  >
                    <span>MANAGE HOSTING</span>
                    <ArrowRight className='w-3.5 h-3.5' />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AVAILABLE HOSTING PACKAGES SHOWCASE */}
      <div className='p-6 rounded-2xl bg-[#1c0830]/90 border border-purple-800/40 shadow-xl space-y-6'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-900/40 pb-4'>
          <div className='flex items-center gap-3'>
            <div className='w-9 h-9 rounded-xl bg-purple-900/50 border border-purple-700/50 flex items-center justify-center text-emerald-400 shadow'>
              <Layers className='w-4 h-4' />
            </div>
            <div>
              <h2 className='font-extrabold text-base text-white tracking-tight'>Available Web Hosting Packages</h2>
              <p className='text-xs text-purple-300/70'>
                Select your preferred cloud hosting plan, choose your domain, and deploy your cPanel in seconds
              </p>
            </div>
          </div>
          <button 
            type='button'
            onClick={() => onNavigate('new_order')}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-800 text-xs text-purple-200 hover:text-white font-semibold border border-purple-700/40 transition cursor-pointer'
          >
            <span>Custom Order</span>
            <ArrowRight className='w-3 h-3' />
          </button>
        </div>

        {packages.length === 0 ? (
          <div className='p-6 text-center text-xs text-purple-300/60'>
            Loading available hosting packages...
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            {packages.map((pkg, idx) => {
              const isPopular = pkg.id === 'pkg_10gb' || idx === 1;
              return (
                <div
                  key={pkg.id}
                  className={`p-5 rounded-2xl border transition flex flex-col justify-between space-y-4 relative ${
                    isPopular 
                      ? 'bg-gradient-to-b from-[#280c44] to-[#150424] border-emerald-500/60 shadow-[0_4px_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30' 
                      : 'bg-[#220935]/70 border-purple-800/40 hover:border-purple-600/60'
                  }`}
                >
                  {isPopular && (
                    <span className='absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-emerald-500 text-[#120422] text-[10px] font-black tracking-wider uppercase shadow'>
                      POPULAR
                    </span>
                  )}

                  <div className='space-y-3'>
                    <div>
                      <h3 className='font-black text-sm text-white tracking-tight'>{pkg.name}</h3>
                      <div className='mt-1 flex items-baseline gap-1'>
                        <span className='text-2xl font-black text-white'>${pkg.monthlyPrice}</span>
                        <span className='text-[11px] text-purple-300/70'>/ month</span>
                      </div>
                      <p className='text-[10px] text-emerald-400 font-medium'>
                        or ${pkg.yearlyPrice} / yr (Save 15%)
                      </p>
                    </div>

                    <div className='space-y-1.5 pt-3 border-t border-purple-900/40 text-xs text-purple-200/90'>
                      <div className='flex items-center gap-2 text-[11px]'>
                        <HardDrive className='w-3.5 h-3.5 text-emerald-400 shrink-0' />
                        <span><strong>{pkg.diskSpaceGb || 5} GB</strong> NVMe SSD Storage</span>
                      </div>
                      <div className='flex items-center gap-2 text-[11px]'>
                        <Cpu className='w-3.5 h-3.5 text-emerald-400 shrink-0' />
                        <span><strong>{pkg.bandwidthGb || 50} GB</strong> Premium Bandwidth</span>
                      </div>
                      <div className='flex items-center gap-2 text-[11px]'>
                        <Globe className='w-3.5 h-3.5 text-emerald-400 shrink-0' />
                        <span><strong>{pkg.domainLimit || 1}</strong> Website Domain</span>
                      </div>
                      <div className='flex items-center gap-2 text-[11px]'>
                        <Check className='w-3.5 h-3.5 text-emerald-400 shrink-0' />
                        <span><strong>{pkg.emailLimit || 5}</strong> Email Accounts</span>
                      </div>
                      <div className='flex items-center gap-2 text-[11px]'>
                        <Check className='w-3.5 h-3.5 text-emerald-400 shrink-0' />
                        <span><strong>{pkg.databaseLimit || 2}</strong> MySQL Databases</span>
                      </div>
                      <div className='flex items-center gap-2 text-[11px]'>
                        <Check className='w-3.5 h-3.5 text-emerald-400 shrink-0' />
                        <span>Free SSL &amp; Full cPanel Control</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type='button'
                    onClick={() => onNavigate('new_order', null, { initialPackageId: pkg.id, selectedPackage: pkg })}
                    className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md ${
                      isPopular
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black'
                        : 'bg-purple-900/60 hover:bg-emerald-600 text-white'
                    }`}
                  >
                    <span>Select Package &amp; Domain</span>
                    <ArrowRight className='w-3.5 h-3.5' />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tables */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div className='p-5 rounded-2xl bg-[#1b082e]/80 border border-purple-800/40 shadow-xl space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <ShoppingCart className='w-4 h-4 text-purple-400' />
              <h2 className='font-bold text-sm text-white'>Recent Orders</h2>
            </div>
            <button onClick={() => onNavigate('new_order')} className='text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer'>+ Place New Order</button>
          </div>
          {recentOrders.length === 0 ? (
            <div className='p-8 text-center text-xs text-purple-300/60 border border-dashed border-purple-800/40 rounded-xl'>No hosting orders placed yet.</div>
          ) : (
            <div className='divide-y divide-purple-900/40 text-xs'>
              {recentOrders.map(ord => (
                <div key={ord.id} className='py-3 flex items-center justify-between gap-3'>
                  <div>
                    <p className='font-bold text-white text-xs'>{ord.packageName}</p>
                    <p className='text-[11px] text-purple-300/70 font-mono'>{ord.domain}</p>
                  </div>
                  <div className='text-right'>
                    <p className='font-bold text-white text-xs'>${ord.totalAmount} <span className='text-[10px] text-purple-300/60'>/ {ord.billingCycle}</span></p>
                    <span className={'inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ' + (ord.status === 'active' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50' : 'bg-amber-950 text-amber-300 border border-amber-700/50')}>{ord.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='p-5 rounded-2xl bg-[#1b082e]/80 border border-purple-800/40 shadow-xl space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <FileText className='w-4 h-4 text-purple-400' />
              <h2 className='font-bold text-sm text-white'>Billing & Invoices</h2>
            </div>
            <button onClick={() => onNavigate('invoices')} className='text-xs font-semibold text-purple-300 hover:text-white hover:underline cursor-pointer'>View All</button>
          </div>
          {recentInvoices.length === 0 ? (
            <div className='p-8 text-center text-xs text-purple-300/60 border border-dashed border-purple-800/40 rounded-xl'>No invoices generated yet.</div>
          ) : (
            <div className='divide-y divide-purple-900/40 text-xs'>
              {recentInvoices.map(inv => (
                <div key={inv.id} className='py-3 flex items-center justify-between gap-3'>
                  <div>
                    <p className='font-bold text-white text-xs font-mono'>{inv.invoiceNumber}</p>
                    <p className='text-[11px] text-purple-300/70'>Due: {new Date(inv.dueDate).toLocaleDateString()}</p>
                  </div>
                  <div className='text-right'>
                    <p className='font-bold text-white text-xs'>${inv.totalAmount}</p>
                    <span className={'inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ' + (inv.status === 'paid' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50' : 'bg-rose-950 text-rose-300 border border-rose-700/50')}>{inv.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}