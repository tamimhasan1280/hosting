import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Rocket, Star, ExternalLink, Trash2, CheckCircle2, Download, RefreshCw } from 'lucide-react';

export default function SoftaculousManager() {
  const [available, setAvailable] = useState([]);
  const [installed, setInstalled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [selectedScript, setSelectedScript] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  // Install Form
  const [siteName, setSiteName] = useState('My Blog Website');
  const [installDir, setInstallDir] = useState('wordpress');
  const [adminUser, setAdminUser] = useState('admin');
  const [adminEmail, setAdminEmail] = useState('admin@example.com');

  const loadData = async () => {
    setLoading(true);
    try {
      const [resAvail, resInst] = await Promise.all([
        api.getAvailableApps(),
        api.getInstalledApps()
      ]);
      setAvailable(resAvail);
      setInstalled(resInst);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenInstall = (script) => {
    setSelectedScript(script);
    setSiteName(`My ${script.name} Site`);
    setInstallDir(script.id === 'wordpress' ? 'wordpress' : script.id);
  };

  const handleInstallSubmit = async (e) => {
    e.preventDefault();
    setInstalling(true);
    try {
      await api.installApp({
        scriptId: selectedScript.id,
        siteName,
        installDir,
        adminUser,
        adminEmail
      });
      setStatusMsg(`Successfully installed ${selectedScript.name}!`);
      setTimeout(() => setStatusMsg(''), 4000);
      setSelectedScript(null);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setInstalling(false);
    }
  };

  const handleDeleteApp = async (id, name) => {
    if (!window.confirm(`Uninstall and remove "${name}"? Files and database will be deleted.`)) return;
    try {
      await api.deleteInstalledApp(id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-[#ff6c2c]" />
            Softaculous 1-Click App Installer
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Instantly install popular web scripts like WordPress, Laravel, and Joomla with automated database setup.
          </p>
        </div>
        {statusMsg && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-fade">
            <CheckCircle2 className="w-4 h-4" /> {statusMsg}
          </div>
        )}
      </div>

      {/* Available Scripts Grid */}
      <div>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Top Scripts Available</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {available.map((script) => (
            <div key={script.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between hover:border-[#ff6c2c]/40 transition group">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#ff6c2c] flex items-center justify-center font-bold text-base shadow-sm group-hover:bg-[#ff6c2c] group-hover:text-white transition">
                    {script.name.charAt(0)}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    v{script.version}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">{script.name}</h3>
                <div className="text-[11px] text-amber-500 flex items-center gap-1 mb-2 font-semibold">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 inline" /> {script.rating} ({script.reviews})
                </div>
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {script.description}
                </p>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100">
                <button
                  onClick={() => handleOpenInstall(script)}
                  className="w-full bg-slate-900 hover:bg-[#ff6c2c] text-white text-xs font-semibold py-2 rounded-lg transition shadow flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Install Now
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Installed Scripts */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
          <h2 className="text-sm font-bold text-slate-800">Current Installations ({installed.length})</h2>
        </div>
        {installed.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 italic">
            No scripts installed yet. Click "Install Now" on WordPress or any script above.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3 px-6">Application</th>
                <th className="py-3 px-6">Directory</th>
                <th className="py-3 px-6">Database</th>
                <th className="py-3 px-6">Admin User</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {installed.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50">
                  <td className="py-3 px-6 font-bold text-slate-800 flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-[#ff6c2c]" /> {app.name}
                  </td>
                  <td className="py-3 px-6 font-mono text-slate-600">/{app.path}</td>
                  <td className="py-3 px-6 font-mono text-emerald-700">{app.database}</td>
                  <td className="py-3 px-6 text-slate-700">{app.adminUser}</td>
                  <td className="py-3 px-6 text-right space-x-2">
                    <a
                      href={`/site/${app.path.replace('public_html/', '')}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-[11px] inline-flex items-center gap-1"
                    >
                      Visit Site <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => handleDeleteApp(app.id, app.name)}
                      className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[11px]"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Install Modal */}
      {selectedScript && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
              <Rocket className="w-5 h-5 text-[#ff6c2c]" /> Install {selectedScript.name} (v{selectedScript.version})
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure your software setup. Softaculous will automatically configure database, permissions, and initial scripts.
            </p>

            <form onSubmit={handleInstallSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Site Name:</label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">In Directory (relative to public_html):</label>
                <div className="flex items-center">
                  <span className="bg-slate-100 border border-r-0 border-slate-300 px-3 py-2 text-xs text-slate-500 rounded-l-lg">
                    public_html/
                  </span>
                  <input
                    type="text"
                    value={installDir}
                    onChange={(e) => setInstallDir(e.target.value)}
                    placeholder="leave blank for root"
                    className="flex-1 border border-slate-300 px-3 py-2 text-xs rounded-r-lg focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Admin Username:</label>
                  <input
                    type="text"
                    value={adminUser}
                    onChange={(e) => setAdminUser(e.target.value)}
                    className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Admin Email:</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedScript(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={installing}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#ff6c2c] hover:bg-[#e55619] text-white shadow disabled:opacity-50 flex items-center gap-1.5"
                >
                  {installing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  {installing ? 'Installing...' : 'Quick Install'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
