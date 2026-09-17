import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldAlert, ShieldCheck, AlertCircle, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';

export default function SecuritySuiteManager({ onBack, mode = 'cpguard', user = 'cpanel_user' }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanStatus, setScanStatus] = useState('');

  const isCpGuard = mode === 'cpguard';
  const title = isCpGuard ? 'cPGuard Antivirus & Anti-Malware' : 'Imunify360 Multi-Layer Security';

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = isCpGuard ? await api.getCpguardStatus(user) : await api.getImunifyStatus(user);
      setStatus(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, [mode, user]);

  const handleScan = async () => {
    setScanStatus('Starting scan...');
    try {
      const res = isCpGuard 
        ? await api.scanCpguard('public_html', user) 
        : await api.scanImunify('public_html', user);
      setScanStatus(`Scan scheduled: ${res.scanId || res.status}`);
      setTimeout(() => setScanStatus(''), 4000);
    } catch (err) {
      alert(err.message);
      setScanStatus('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button onClick={onBack} className="hover:text-[#ff6c2c]">Security</button>
            <span>/</span>
            <span className="font-semibold text-slate-700">{isCpGuard ? 'cPGuard' : 'Imunify360'}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#ff6c2c]" />
            {title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise server defense and real-time security management for your hosting account.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {scanStatus && (
            <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> {scanStatus}
            </div>
          )}
          <button onClick={loadStatus} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Truthful Status Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${status?.available ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{isCpGuard ? 'cPGuard Status' : 'Imunify360 Status'}</h2>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                status?.available ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {status?.available ? 'Installed & Active' : 'Unavailable on this server'}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {status?.message || 'Inspecting server software status...'}
            </p>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500 font-medium">Real-Time Scanner</div>
            <div className="font-bold text-slate-800 mt-1">{status?.realtimeScanner || status?.malwareScanner || 'Disabled'}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500 font-medium">Quarantine Count</div>
            <div className="font-bold text-slate-800 mt-1">{status?.quarantineCount || 0} threats detected</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500 font-medium">Account Context</div>
            <div className="font-bold text-slate-800 mt-1 font-mono">{user} (Isolated)</div>
          </div>
        </div>

        {status?.available && (
          <div className="pt-2 flex justify-end">
            <button onClick={handleScan} className="px-4 py-2 bg-[#ff6c2c] hover:bg-[#e05b22] text-white rounded-lg text-xs font-semibold">
              Start Scan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
