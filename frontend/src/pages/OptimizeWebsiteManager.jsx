import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Activity, CheckCircle2, Save, RefreshCw } from 'lucide-react';

export default function OptimizeWebsiteManager({ onBack, user = 'cpanel_user' }) {
  const [mode, setMode] = useState('all');
  const [mimeTypes, setMimeTypes] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await api.getOptimizationConfig();
      if (res) {
        setMode(res.mode || 'all');
        setMimeTypes(res.mimeTypes || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConfig(); }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.saveOptimizationConfig({ mode, mimeTypes }, user);
      setStatusMsg('Optimization configuration updated successfully!');
      setTimeout(() => setStatusMsg(''), 3000);
      loadConfig();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button onClick={onBack} className="hover:text-[#ff6c2c]">Software</button>
            <span>/</span>
            <span className="font-semibold text-slate-700">Optimize Website</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-[#ff6c2c]" />
            Optimize Website (Apache mod_deflate Compression)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Compress website content before sending it to client browsers to reduce bandwidth and speed up page load times.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {statusMsg && (
            <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> {statusMsg}
            </div>
          )}
          <button onClick={loadConfig} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-6">
        <div>
          <h2 className="text-sm font-bold text-slate-900 mb-3">Compression Settings</h2>
          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="optMode"
                value="off"
                checked={mode === 'off'}
                onChange={() => setMode('off')}
                className="text-[#ff6c2c] focus:ring-[#ff6c2c]"
              />
              <span className="font-semibold text-slate-800">Disabled</span>
              <span className="text-slate-400">— Turn off gzip / deflate compression.</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="optMode"
                value="all"
                checked={mode === 'all'}
                onChange={() => setMode('all')}
                className="text-[#ff6c2c] focus:ring-[#ff6c2c]"
              />
              <span className="font-semibold text-slate-800">Compress All Content (Recommended)</span>
              <span className="text-slate-400">— Compress all standard HTML, CSS, JS, and text files.</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="optMode"
                value="custom"
                checked={mode === 'custom'}
                onChange={() => setMode('custom')}
                className="text-[#ff6c2c] focus:ring-[#ff6c2c]"
              />
              <span className="font-semibold text-slate-800">Compress the specified MIME types</span>
              <span className="text-slate-400">— Custom filter list.</span>
            </label>
          </div>
        </div>

        {mode === 'custom' && (
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">MIME Types (space-separated)</label>
            <input
              type="text"
              value={mimeTypes}
              onChange={(e) => setMimeTypes(e.target.value)}
              placeholder="text/html text/plain text/xml text/css text/javascript"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#ff6c2c]"
            />
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button type="submit" className="px-5 py-2 bg-[#ff6c2c] hover:bg-[#e05b22] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Save className="w-4 h-4" /> Update Settings
          </button>
        </div>
      </form>
    </div>
  );
}
