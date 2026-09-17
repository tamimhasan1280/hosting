import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Settings, Save, CheckCircle2 } from 'lucide-react';

export default function AccountPreferencesManager({ onBack, user = 'cpanel_user' }) {
  const [prefs, setPrefs] = useState({
    contactEmail: '',
    secondaryEmail: '',
    notifyDiskQuota: true,
    notifyBandwidth: true,
    notifySslExpiry: true,
    timezone: 'UTC'
  });
  const [statusMsg, setStatusMsg] = useState('');

  const loadPrefs = async () => {
    try {
      const res = await api.getPreferences(user);
      if (res) setPrefs(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadPrefs(); }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.savePreferences(prefs, user);
      setStatusMsg('Account preferences updated successfully!');
      setTimeout(() => setStatusMsg(''), 3000);
      loadPrefs();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button onClick={onBack} className="hover:text-[#ff6c2c]">Preferences</button>
            <span>/</span>
            <span className="font-semibold text-slate-700">Contact Information</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#ff6c2c]" />
            Account Preferences & Contact Information
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure administrative email notifications, storage warnings, and timezone defaults.
          </p>
        </div>
        {statusMsg && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {statusMsg}
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-6 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Primary Contact Email</label>
            <input
              type="email"
              required
              value={prefs.contactEmail || ''}
              onChange={e => setPrefs({ ...prefs, contactEmail: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff6c2c]"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Secondary Contact Email</label>
            <input
              type="email"
              value={prefs.secondaryEmail || ''}
              onChange={e => setPrefs({ ...prefs, secondaryEmail: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff6c2c]"
            />
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <h3 className="font-bold text-slate-800 text-sm">Automated Alert Notifications</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!prefs.notifyDiskQuota}
              onChange={e => setPrefs({ ...prefs, notifyDiskQuota: e.target.checked })}
              className="rounded text-[#ff6c2c] focus:ring-[#ff6c2c]"
            />
            <span className="text-slate-700">Notify me when disk usage exceeds 80% of quota.</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!prefs.notifyBandwidth}
              onChange={e => setPrefs({ ...prefs, notifyBandwidth: e.target.checked })}
              className="rounded text-[#ff6c2c] focus:ring-[#ff6c2c]"
            />
            <span className="text-slate-700">Notify me when monthly bandwidth reaches limit threshold.</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!prefs.notifySslExpiry}
              onChange={e => setPrefs({ ...prefs, notifySslExpiry: e.target.checked })}
              className="rounded text-[#ff6c2c] focus:ring-[#ff6c2c]"
            />
            <span className="text-slate-700">Notify me before SSL/TLS certificate expires.</span>
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="px-5 py-2 bg-[#ff6c2c] hover:bg-[#e05b22] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Save className="w-4 h-4" /> Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
}
