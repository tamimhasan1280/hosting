import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Layers, Terminal, Play, Square, RefreshCw, Trash2, Plus, CheckCircle2, Code2, AlertTriangle } from 'lucide-react';

export default function AppManager({ onBack, defaultTab = 'node', user = 'cpanel_user' }) {
  const [tab, setTab] = useState(defaultTab); // 'node' | 'python' | 'all' | 'accelerate'
  const [nodeInfo, setNodeInfo] = useState(null);
  const [pythonInfo, setPythonInfo] = useState(null);
  const [nodeApps, setNodeApps] = useState([]);
  const [pythonApps, setPythonApps] = useState([]);
  const [accelerateStatus, setAccelerateStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  // Form
  const [appName, setAppName] = useState('');
  const [appDomain, setAppDomain] = useState('example.com');
  const [appPath, setAppPath] = useState('public_html/myapp');
  const [startupFile, setStartupFile] = useState('app.js');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [nInfo, pInfo, nApps, pApps, acc] = await Promise.all([
        api.getNodeInfo(),
        api.getPythonInfo(),
        api.getNodeApps(user),
        api.getPythonApps(user),
        api.getAccelerateWpStatus()
      ]);
      setNodeInfo(nInfo);
      setPythonInfo(pInfo);
      setNodeApps(nApps);
      setPythonApps(pApps);
      setAccelerateStatus(acc);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [user]);

  const handleCreateNode = async (e) => {
    e.preventDefault();
    try {
      await api.createNodeApp({ name: appName, domain: appDomain, appPath, startupFile }, user);
      setStatusMsg(`Node.js application '${appName}' created!`);
      setTimeout(() => setStatusMsg(''), 3000);
      setAppName('');
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStartNode = async (id) => {
    try {
      await api.startNodeApp(id);
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStopNode = async (id) => {
    try {
      await api.stopNodeApp(id);
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteNode = async (id) => {
    if (!window.confirm('Delete this application entry?')) return;
    try {
      await api.deleteNodeApp(id);
      loadAll();
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
            <span className="font-semibold text-slate-700">Application Manager</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#ff6c2c]" />
            Application Manager & Language Runtimes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Deploy and manage Node.js, Python, and WSGI applications under isolated user contexts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {statusMsg && (
            <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> {statusMsg}
            </div>
          )}
          <button onClick={loadAll} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-4 text-xs font-semibold">
        <button
          onClick={() => setTab('node')}
          className={`pb-2.5 px-2 border-b-2 transition ${tab === 'node' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Setup Node.js App
        </button>
        <button
          onClick={() => setTab('python')}
          className={`pb-2.5 px-2 border-b-2 transition ${tab === 'python' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Setup Python App
        </button>
        <button
          onClick={() => setTab('all')}
          className={`pb-2.5 px-2 border-b-2 transition ${tab === 'all' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          All Applications ({nodeApps.length + pythonApps.length})
        </button>
        <button
          onClick={() => setTab('accelerate')}
          className={`pb-2.5 px-2 border-b-2 transition ${tab === 'accelerate' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          AccelerateWP
        </button>
      </div>

      {tab === 'node' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Node.js Runtime Information</h2>
              <p className="text-xs text-slate-500 mt-0.5">Active runtime: <span className="font-mono font-bold text-emerald-600">{nodeInfo?.currentVersion}</span> | npm: <span className="font-mono">{nodeInfo?.npmVersion}</span></p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-bold">Node.js Ready</span>
          </div>

          {/* Create Form */}
          <form onSubmit={handleCreateNode} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Create New Node.js Application</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Application Name</label>
                <input
                  type="text"
                  required
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="e.g. My Express API"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff6c2c]"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Domain</label>
                <input
                  type="text"
                  required
                  value={appDomain}
                  onChange={(e) => setAppDomain(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff6c2c]"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Application Root Directory</label>
                <input
                  type="text"
                  required
                  value={appPath}
                  onChange={(e) => setAppPath(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#ff6c2c]"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Application Startup File</label>
                <input
                  type="text"
                  required
                  value={startupFile}
                  onChange={(e) => setStartupFile(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#ff6c2c]"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="px-4 py-2 bg-[#ff6c2c] hover:bg-[#e05b22] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Create Application
              </button>
            </div>
          </form>

          {/* Node Apps Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
              <h2 className="text-sm font-bold text-slate-800">Installed Node.js Applications</h2>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-6">Name</th>
                  <th className="py-3 px-6">Domain</th>
                  <th className="py-3 px-6">Path</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nodeApps.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400">No Node.js applications configured yet.</td></tr>
                ) : (
                  nodeApps.map(app => (
                    <tr key={app.id} className="hover:bg-slate-50">
                      <td className="py-3 px-6 font-semibold text-slate-800">{app.name}</td>
                      <td className="py-3 px-6 text-slate-600">{app.domain}</td>
                      <td className="py-3 px-6 font-mono text-slate-600">{app.path}</td>
                      <td className="py-3 px-6">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          app.status === 'Running' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {app.status} {app.pid ? `(PID ${app.pid})` : ''}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-right space-x-2">
                        {app.status === 'Running' ? (
                          <button onClick={() => handleStopNode(app.id)} className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-200 font-semibold">Stop</button>
                        ) : (
                          <button onClick={() => handleStartNode(app.id)} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold">Start</button>
                        )}
                        <button onClick={() => handleDeleteNode(app.id)} className="px-2 py-1 text-rose-600 hover:text-rose-800"><Trash2 className="w-3.5 h-3.5 inline" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'python' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Python Runtime Information</h2>
              <p className="text-xs text-slate-500 mt-0.5">Detected: <span className="font-mono font-bold text-slate-800">{pythonInfo?.version}</span> | WSGI: Supported</p>
            </div>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-bold">Python Ready</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
              <h2 className="text-sm font-bold text-slate-800">Installed Python & WSGI Applications</h2>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-6">Name</th>
                  <th className="py-3 px-6">Domain</th>
                  <th className="py-3 px-6">Path</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pythonApps.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400">No Python applications configured yet.</td></tr>
                ) : (
                  pythonApps.map(app => (
                    <tr key={app.id} className="hover:bg-slate-50">
                      <td className="py-3 px-6 font-semibold text-slate-800">{app.name}</td>
                      <td className="py-3 px-6 text-slate-600">{app.domain}</td>
                      <td className="py-3 px-6 font-mono text-slate-600">{app.path}</td>
                      <td className="py-3 px-6">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600">{app.status}</span>
                      </td>
                      <td className="py-3 px-6 text-right">
                        <button onClick={() => api.deletePythonApp(app.id).then(loadAll)} className="px-2 py-1 text-rose-600 hover:text-rose-800"><Trash2 className="w-3.5 h-3.5 inline" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'all' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
            <h2 className="text-sm font-bold text-slate-800">Unified Application Manager Overview</h2>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3 px-6">Application</th>
                <th className="py-3 px-6">Runtime</th>
                <th className="py-3 px-6">Domain</th>
                <th className="py-3 px-6">Path</th>
                <th className="py-3 px-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...nodeApps, ...pythonApps].map((app, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-3 px-6 font-semibold text-slate-900">{app.name}</td>
                  <td className="py-3 px-6 font-mono text-[#ff6c2c] font-semibold">{app.runtime}</td>
                  <td className="py-3 px-6 text-slate-600">{app.domain}</td>
                  <td className="py-3 px-6 font-mono text-slate-600">{app.path}</td>
                  <td className="py-3 px-6 text-right">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      app.status === 'Running' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {app.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'accelerate' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">AccelerateWP Status</h2>
            <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[11px] font-bold">Unavailable on this server</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {accelerateStatus?.message || 'AccelerateWP is exclusive to CloudLinux OS and is not available on this server environment.'}
          </p>
        </div>
      )}
    </div>
  );
}
