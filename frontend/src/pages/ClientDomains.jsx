import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Globe, Server } from 'lucide-react';

export default function ClientDomains({ onNavigate }) {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getClientDomains().then(res => {
      setDomains(res || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className='min-h-[400px] flex items-center justify-center'>
        <div className='w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin' />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-bold text-white'>My Domains</h1>
          <p className='text-xs text-purple-300/70'>DNS nameserver routing configurations</p>
        </div>
        <button onClick={() => onNavigate('new_order')} className='px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg cursor-pointer'>+ Assign New Domain</button>
      </div>
      <div className='p-4 rounded-2xl bg-purple-950/70 border border-purple-800/40 text-xs space-y-2'>
        <p className='font-bold text-white flex items-center gap-1.5'><Server className='w-4 h-4 text-emerald-400' /><span>TAMIM HOSTING Nameservers</span></p>
        <p className='text-[11.5px] text-purple-300/70'>Point your domain's DNS nameservers to:</p>
        <div className='flex flex-wrap gap-3 font-mono font-bold text-emerald-300 text-xs'>
          <span className='px-3 py-1 bg-[#1a062d] border border-purple-700/50 rounded-lg'>ns1.tamimhosting.com</span>
          <span className='px-3 py-1 bg-[#1a062d] border border-purple-700/50 rounded-lg'>ns2.tamimhosting.com</span>
        </div>
      </div>
      {domains.length === 0 ? (
        <div className='p-12 text-center rounded-2xl bg-[#1c0830]/80 border border-purple-800/40 space-y-2'>
          <Globe className='w-10 h-10 text-purple-400/40 mx-auto' />
          <p className='text-xs text-purple-300/60'>No domains associated with your client account yet.</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {domains.map(dom => (
            <div key={dom.id} className='p-5 rounded-2xl bg-[#1c0830]/90 border border-purple-800/40 shadow-xl space-y-3'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2 font-mono font-bold text-sm text-white'><Globe className='w-4 h-4 text-emerald-400' /><span>{dom.domain}</span></div>
                <span className='px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-950 text-emerald-300 border border-emerald-700/50'>{dom.status || 'Active'}</span>
              </div>
              <p className='text-[11px] text-purple-300/70'>Document Root: <strong className='font-mono text-white'>/public_html</strong></p>
              <div className='pt-2 border-t border-purple-800/30 flex justify-end'>
                <button
                  type='button'
                  onClick={() => onNavigate('domain_hosting', null, { serviceId: dom.serviceId, domain: dom.domain })}
                  className='px-3 py-1.5 rounded-lg bg-purple-900/60 hover:bg-emerald-600 text-white font-bold text-xs transition cursor-pointer'
                >
                  Manage Hosting &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}