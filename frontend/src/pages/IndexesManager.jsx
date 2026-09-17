import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Folder, CheckCircle2, Save, RefreshCw } from 'lucide-react';

export default function IndexesManager({ onBack }) {
  const [path, setPath] = useState('public_html');
  const [setting, setSetting] = useState('default');
  const [statusMsg, setStatusMsg] = useState('');

  const loadSetting = async () => {
    try {
      const res = await api.getIndexSetting(path);
      if (res) setSetting(res.setting || 'default');
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadSetting(); }, [path]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.saveIndexSetting(path, setting);
      setStatusMsg('Indexing settings updated!');
      setTimeout(() => setStatusMsg(''), 3000);
      loadSetting();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button onClick={onBack} className="hover:text-[#ff6c2c]">Advanced</button>
            <span>/</span>
            <span className="font-semibold text-slate-700">Indexes</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Folder className="w-6 h-6 text-[#ff6c2c]" />
            Index Manager (Directory Listing Control)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Customize how Apache presents directory listings when no default index file exists.
          </p>
        </div>
        {statusMsg && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {statusMsg}
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">Target Directory</label>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="w-full md:w-80 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#ff6c2c]"
          />
        </div>

        <div className="space-y-3 text-xs">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="radio" name="idx" value="default" checked={setting === 'default'} onChange={() => setSetting('default')} />
            <span className="font-semibold text-slate-800">Default System Setting (Inherit)</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="radio" name="idx" value="disabled" checked={setting === 'disabled'} onChange={() => setSetting('disabled')} />
            <span className="font-semibold text-slate-800">No Indexing (Recommended for Security)</span>
            <span className="text-slate-400">— Prevents directory browsing.</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="radio" name="idx" value="standard" checked={setting === 'standard'} onChange={() => setSetting('standard')} />
            <span className="font-semibold text-slate-800">Standard Indexing</span>
            <span className="text-slate-400">— Plain text filename list.</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="radio" name="idx" value="fancy" checked={setting === 'fancy'} onChange={() => setSetting('fancy')} />
            <span className="font-semibold text-slate-800">Fancy Indexing</span>
            <span className="text-slate-400">— Shows file size, description, and icons.</span>
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="px-5 py-2 bg-[#ff6c2c] hover:bg-[#e05b22] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Save className="w-4 h-4" /> Save Index Settings
          </button>
        </div>
      </form>
    </div>
  );
}
