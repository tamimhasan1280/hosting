import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { FileCode, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function PackageManager({ onBack, defaultMode = 'pear' }) {
  const [mode, setMode] = useState(defaultMode); // 'pear' | 'perl'
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = mode === 'pear' ? await api.getPearStatus() : await api.getPerlStatus();
      setStatus(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, [mode]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button onClick={onBack} className="hover:text-[#ff6c2c]">Software</button>
            <span>/</span>
            <span className="font-semibold text-slate-700">{mode === 'pear' ? 'PHP PEAR Packages' : 'Perl Modules'}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileCode className="w-6 h-6 text-[#ff6c2c]" />
            {mode === 'pear' ? 'PHP PEAR Packages' : 'Perl Modules & CPAN'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Inspect installed open-source library modules and system extensions for your account.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadStatus} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-4 text-xs font-semibold">
        <button
          onClick={() => setMode('pear')}
          className={`pb-2.5 px-2 border-b-2 transition ${mode === 'pear' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          PHP PEAR Packages
        </button>
        <button
          onClick={() => setMode('perl')}
          className={`pb-2.5 px-2 border-b-2 transition ${mode === 'perl' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Perl Modules
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <FileCode className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{mode === 'pear' ? 'PEAR Environment' : 'Perl Environment'}</h2>
              <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                status?.available ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {status?.available ? (status.version || 'Available') : 'Unavailable / Server-Managed'}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {status?.message}
            </p>
          </div>
        </div>

        {status?.available && (status.packages || status.modules) && (
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 mb-2">Installed Packages</h3>
            <div className="flex flex-wrap gap-2">
              {(status.packages || status.modules).map((pkg, idx) => (
                <span key={idx} className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-xs text-slate-700">
                  {pkg}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
