import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Sliders, Code2, CheckCircle2, Save, RefreshCw, AlertTriangle } from 'lucide-react';

export default function PhpManager() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('manager'); // 'manager' | 'ini'
  const [statusMsg, setStatusMsg] = useState('');

  // INI Form state
  const [directives, setDirectives] = useState({});

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await api.getPhpConfig();
      setConfig(res);
      setDirectives(res.iniDirectives || {});
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleUpdateDomainVersion = async (domain, version) => {
    try {
      await api.updateDomainPhp(domain, version);
      setStatusMsg(`Updated PHP version for ${domain} to ${version}!`);
      setTimeout(() => setStatusMsg(''), 3000);
      loadConfig();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveIni = async (e) => {
    e.preventDefault();
    try {
      await api.updatePhpIni(directives);
      setStatusMsg('MultiPHP INI directives saved successfully!');
      setTimeout(() => setStatusMsg(''), 3000);
      loadConfig();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!config) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Code2 className="w-6 h-6 text-[#ff6c2c]" />
            MultiPHP Manager & MultiPHP INI Editor
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure PHP versions for your websites and adjust critical limits like memory_limit and upload_max_filesize.
          </p>
        </div>
        {statusMsg && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-fade">
            <CheckCircle2 className="w-4 h-4" /> {statusMsg}
          </div>
        )}
      </div>

      <div className="flex border-b border-slate-200 space-x-4 text-xs font-semibold">
        <button
          onClick={() => setTab('manager')}
          className={`pb-2.5 px-2 border-b-2 transition ${
            tab === 'manager' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          MultiPHP Manager (PHP Versions)
        </button>
        <button
          onClick={() => setTab('ini')}
          className={`pb-2.5 px-2 border-b-2 transition ${
            tab === 'ini' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          MultiPHP INI Editor (Limits & Directives)
        </button>
      </div>

      {tab === 'manager' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
            <h2 className="text-sm font-bold text-slate-800">Domain PHP Version Assignments</h2>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3 px-6">Domain</th>
                <th className="py-3 px-6">Current PHP Version</th>
                <th className="py-3 px-6">Assign New Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(config.domainVersions || {}).map(([domain, currentVer]) => (
                <tr key={domain} className="hover:bg-slate-50">
                  <td className="py-3 px-6 font-semibold text-slate-800">{domain}</td>
                  <td className="py-3 px-6 font-mono text-emerald-700 font-semibold">{currentVer}</td>
                  <td className="py-3 px-6">
                    <select
                      value={currentVer}
                      onChange={(e) => handleUpdateDomainVersion(domain, e.target.value)}
                      className="border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#ff6c2c]"
                    >
                      {config.availableVersions.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'ini' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#ff6c2c]" /> Basic Mode: PHP INI Directives
            </h2>
          </div>
          <form onSubmit={handleSaveIni} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  memory_limit
                </label>
                <p className="text-[11px] text-slate-400 mb-1.5">Maximum amount of memory a script may consume.</p>
                <input
                  type="text"
                  value={directives.memory_limit || ''}
                  onChange={(e) => setDirectives({ ...directives, memory_limit: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  upload_max_filesize
                </label>
                <p className="text-[11px] text-slate-400 mb-1.5">Maximum size of an uploaded file (e.g. 128M).</p>
                <input
                  type="text"
                  value={directives.upload_max_filesize || ''}
                  onChange={(e) => setDirectives({ ...directives, upload_max_filesize: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  post_max_size
                </label>
                <p className="text-[11px] text-slate-400 mb-1.5">Maximum size of POST data that PHP will accept.</p>
                <input
                  type="text"
                  value={directives.post_max_size || ''}
                  onChange={(e) => setDirectives({ ...directives, post_max_size: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  max_execution_time
                </label>
                <p className="text-[11px] text-slate-400 mb-1.5">Maximum execution time of each script, in seconds.</p>
                <input
                  type="text"
                  value={directives.max_execution_time || ''}
                  onChange={(e) => setDirectives({ ...directives, max_execution_time: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  display_errors
                </label>
                <p className="text-[11px] text-slate-400 mb-1.5">Show or suppress PHP errors on web page.</p>
                <select
                  value={directives.display_errors || 'Off'}
                  onChange={(e) => setDirectives({ ...directives, display_errors: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
                >
                  <option value="Off">Off (Production Recommended)</option>
                  <option value="On">On (Development Debugging)</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow flex items-center gap-1.5 transition"
              >
                <Save className="w-4 h-4" /> Save PHP Configuration
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
