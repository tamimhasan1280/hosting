import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Server, ExternalLink, Globe, Key, Shield, CheckCircle2, AlertTriangle, X, Lock } from 'lucide-react';

export default function ClientServices({ onNavigate, onOpenCpanel }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Change Password Modal
  const [selectedService, setSelectedService] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passSubmitting, setPassSubmitting] = useState(false);
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });

  const loadServices = () => {
    setLoading(true);
    api.getClientServices().then(res => {
      setServices(res || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPassMsg({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setPassSubmitting(true);
    setPassMsg({ type: '', text: '' });
    try {
      const res = await api.changeServicePassword(selectedService.id, newPassword);
      if (res.success) {
        setPassMsg({ type: 'success', text: res.message || 'cPanel password changed successfully!' });
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setSelectedService(null);
          setPassMsg({ type: '', text: '' });
        }, 2200);
      } else {
        setPassMsg({ type: 'error', text: res.message || 'Failed to update password.' });
      }
    } catch (err) {
      setPassMsg({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to change password.' });
    } finally {
      setPassSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className='min-h-[400px] flex items-center justify-center'>
        <div className='text-center space-y-2'>
          <div className='w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto' />
          <p className='text-xs text-purple-300/70'>Loading Hosting Services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
        <div>
          <h1 className='text-xl font-bold text-white'>My Hosting Services</h1>
          <p className='text-xs text-purple-300/70'>Manage active hosting accounts and direct isolated cPanel access</p>
        </div>
        <button onClick={() => onNavigate('new_order')} className='px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg cursor-pointer transition'>
          + Order New Service
        </button>
      </div>

      {services.length === 0 ? (
        <div className='p-12 text-center rounded-2xl bg-[#1c0830]/80 border border-purple-800/40 space-y-3'>
          <Server className='w-10 h-10 text-purple-400/40 mx-auto' />
          <h3 className='font-bold text-sm text-white'>No Active Hosting Services Yet</h3>
          <p className='text-xs text-purple-300/60 max-w-sm mx-auto'>
            Once your hosting orders are verified and approved, your active cPanel accounts will appear here.
          </p>
          <button onClick={() => onNavigate('new_order')} className='px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-emerald-600 text-white font-bold text-xs cursor-pointer'>
            Order a Hosting Plan
          </button>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {services.map(svc => {
            const svcUser = svc.username || svc.cpanelUser || 'cpanel_user';
            return (
              <div key={svc.id} className='p-5 rounded-2xl bg-[#1c0830]/90 border border-purple-800/40 shadow-xl space-y-4 flex flex-col justify-between'>
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <h3 className='font-bold text-base text-white'>{svc.packageName}</h3>
                      <p className='text-xs text-emerald-400 font-mono flex items-center gap-1.5 mt-0.5'>
                        <Globe className='w-3.5 h-3.5' />
                        <span className='font-bold'>{svc.domain}</span>
                      </p>
                    </div>
                    <span className={'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ' + (svc.status === 'active' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50' : 'bg-amber-950 text-amber-300 border border-amber-700/50')}>
                      {svc.status}
                    </span>
                  </div>

                  <div className='grid grid-cols-2 gap-2 text-[11px] text-purple-300/80 bg-purple-950/40 p-3 rounded-xl border border-purple-900/30'>
                    <div>cPanel User: <strong className='text-emerald-300 font-mono'>{svcUser}</strong></div>
                    <div>Server IP: <strong className='text-white font-mono'>{svc.ipAddress || '127.0.0.1'}</strong></div>
                    <div>Cycle: <strong className='text-white capitalize'>{svc.billingCycle || 'Yearly'}</strong></div>
                    <div>Storage: <strong className='text-white'>{svc.diskLimitMb ? (svc.diskLimitMb / 1024) + ' GB SSD' : '5 GB'}</strong></div>
                    <div>Bandwidth: <strong className='text-white'>{svc.bandwidthLimitMb ? (svc.bandwidthLimitMb / 1024) + ' GB' : '50 GB'}</strong></div>
                    <div>SSL: <strong className='text-emerald-400 font-semibold'>Active (AutoSSL)</strong></div>
                    <div>Expires: <strong className='text-amber-300'>{svc.nextDueDate ? new Date(svc.nextDueDate).toLocaleDateString() : '2026-10-17'}</strong></div>
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-purple-800/30 text-xs'>
                  <button 
                    type='button'
                    onClick={() => onNavigate('domain_hosting', null, { serviceId: svc.id, domain: svc.domain })}
                    className='py-2.5 px-3 rounded-xl bg-purple-900/60 hover:bg-purple-800 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer transition border border-purple-700/40'
                    title={`Open dedicated Hosting Management Dashboard for ${svc.domain}`}
                  >
                    <span>Manage Hosting</span>
                  </button>

                  {svc.status === 'active' ? (
                    <button 
                      type='button'
                      onClick={() => {
                        const ctx = {
                          user: svcUser,
                          serviceId: svc.id,
                          domain: svc.domain,
                          package: svc.packageName || svc.package || 'Custom Cloud'
                        };
                        if (onOpenCpanel) {
                          onOpenCpanel(ctx);
                        } else {
                          onNavigate('dashboard');
                        }
                      }} 
                      className='py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white font-bold shadow-lg flex items-center justify-center gap-1.5 cursor-pointer transition'
                      title={`Direct SSO into cPanel for ${svc.domain}`}
                    >
                      <ExternalLink className='w-3.5 h-3.5' />
                      <span>Login to cPanel</span>
                    </button>
                  ) : (
                    <button 
                      type='button'
                      disabled
                      className='py-2.5 px-3 rounded-xl bg-purple-950/40 border border-purple-900/50 text-purple-400 font-bold flex items-center justify-center gap-1 cursor-not-allowed opacity-75 text-[11px]'
                    >
                      <Lock className='w-3 h-3 text-amber-400' />
                      <span>{svc.status === 'pending' ? 'cPanel Locked' : svc.status === 'suspended' ? 'Suspended' : 'Expired'}</span>
                    </button>
                  )}

                  <button 
                    type='button'
                    onClick={() => {
                      setSelectedService(svc);
                      setNewPassword('');
                      setConfirmPassword('');
                      setPassMsg({ type: '', text: '' });
                    }} 
                    className='py-2.5 px-3 rounded-xl bg-[#250c3d]/70 hover:bg-purple-800 text-purple-200 border border-purple-700/50 font-bold flex items-center justify-center gap-1.5 cursor-pointer transition'
                    title='Change Password for this specific domain cPanel'
                  >
                    <Key className='w-3.5 h-3.5 text-amber-400' />
                    <span>Password</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Change cPanel Password Modal */}
      {selectedService && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in'>
          <div className='w-full max-w-md bg-[#1c0830] border border-purple-700/60 rounded-2xl p-6 shadow-2xl space-y-4 text-white relative'>
            <button 
              onClick={() => setSelectedService(null)} 
              className='absolute top-4 right-4 text-purple-400 hover:text-white transition'
            >
              <X className='w-5 h-5' />
            </button>

            <div className='flex items-center gap-2.5'>
              <div className='w-9 h-9 rounded-xl bg-purple-900/60 flex items-center justify-center text-amber-400 border border-purple-700/50'>
                <Key className='w-5 h-5' />
              </div>
              <div>
                <h3 className='text-base font-bold text-white'>Change cPanel Password</h3>
                <p className='text-xs text-purple-300/70 font-mono'>{selectedService.domain}</p>
              </div>
            </div>

            <div className='p-3 bg-purple-950/60 rounded-xl border border-purple-800/40 text-xs space-y-1 text-purple-300/80'>
              <div className='flex justify-between'>
                <span>cPanel Username:</span>
                <strong className='text-emerald-300 font-mono'>{selectedService.username || selectedService.cpanelUser || 'cpanel_user'}</strong>
              </div>
              <div className='flex justify-between'>
                <span>Isolated Security:</span>
                <span className='text-emerald-400 font-semibold'>Per-domain credential</span>
              </div>
            </div>

            {passMsg.text && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                passMsg.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50' : 'bg-rose-950/80 text-rose-300 border border-rose-700/50'
              }`}>
                {passMsg.type === 'success' ? <CheckCircle2 className='w-4 h-4 text-emerald-400 shrink-0' /> : <AlertTriangle className='w-4 h-4 text-rose-400 shrink-0' />}
                <span>{passMsg.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className='space-y-3 text-xs'>
              <div>
                <label className='block font-semibold mb-1 text-purple-200'>New Password</label>
                <div className='relative'>
                  <input
                    type='password'
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder='Enter strong new password'
                    className='w-full px-3.5 py-2.5 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white focus:outline-none focus:border-purple-400'
                  />
                  <Lock className='w-4 h-4 text-purple-400 absolute right-3 top-3' />
                </div>
              </div>

              <div>
                <label className='block font-semibold mb-1 text-purple-200'>Confirm New Password</label>
                <div className='relative'>
                  <input
                    type='password'
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder='Confirm new password'
                    className='w-full px-3.5 py-2.5 bg-purple-950/70 border border-purple-700/60 rounded-xl text-white focus:outline-none focus:border-purple-400'
                  />
                  <Lock className='w-4 h-4 text-purple-400 absolute right-3 top-3' />
                </div>
              </div>

              <div className='text-[10px] text-purple-300/60 flex items-center gap-1.5 pt-1'>
                <Shield className='w-3.5 h-3.5 text-emerald-400 shrink-0' />
                <span>Password is securely salted and hashed using bcrypt (10 rounds).</span>
              </div>

              <div className='flex items-center justify-end gap-2 pt-2 border-t border-purple-800/40'>
                <button
                  type='button'
                  onClick={() => setSelectedService(null)}
                  className='px-4 py-2 bg-purple-900/50 hover:bg-purple-800 text-purple-300 rounded-xl text-xs font-semibold'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={passSubmitting}
                  className='px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5'
                >
                  {passSubmitting ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}