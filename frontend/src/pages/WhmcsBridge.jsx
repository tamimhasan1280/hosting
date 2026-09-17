import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  CreditCard, ShieldCheck, CheckCircle2, RefreshCw, Zap, Server, 
  ExternalLink, Copy, Check, Users, Database, Layers, ArrowRight, Play
} from 'lucide-react';

const API_BASE = '';

export default function WhmcsBridge() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [accounts, setAccounts] = useState([]);
  
  // Simulate Order state
  const [simDomain, setSimDomain] = useState('hostingclient1.com');
  const [simPlan, setSimPlan] = useState('Premium SSD Hosting');
  const [simMsg, setSimMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [resStatus, resAccts] = await Promise.all([
        axios.get(`${API_BASE}/api/whmcs/status`).then(r => r.data),
        axios.get(`${API_BASE}/json-api/listaccts`).then(r => r.data)
      ]);
      setData(resStatus);
      setAccounts(resAccts.data?.acct || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await axios.post(`${API_BASE}/api/whmcs/test-connection`);
      setTestResult(res.data);
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.message || err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSimulateOrder = async (e) => {
    e.preventDefault();
    if (!simDomain) return;
    try {
      const res = await axios.post(`${API_BASE}/api/whmcs/simulate-order`, {
        domain: simDomain,
        plan: simPlan,
        clientName: 'Demo Client'
      });
      setSimMsg(res.data.message);
      setTimeout(() => setSimMsg(''), 4000);
      loadData();
    } catch (err) {
      alert('Simulation error: ' + err.message);
    }
  };

  const copyToken = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 shadow-md text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-indigo-900/50">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-xl bg-[#ff6c2c] flex items-center justify-center font-bold text-white shadow">
              WH
            </div>
            <h1 className="text-xl font-bold">WHMCS Billing, Provisioning &amp; Server Bridge</h1>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Direct integration bridge between your <strong>WHMCS</strong> project (<code>{data.whmcs.path}</code>) and this <strong>cPanel</strong> engine.
            All client themes and templates remain 100% protected and untouched.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="bg-[#ff6c2c] hover:bg-[#e55619] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {testing ? 'Testing Handshake...' : 'Test WHMCS Connection'}
          </button>
        </div>
      </div>

      {/* Test Result Toast */}
      {testResult && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm animate-fade ${
          testResult.success 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="font-bold text-sm">{testResult.message}</div>
              <div className="text-[11px] font-normal text-slate-600 mt-0.5">
                Latency: {testResult.latency} • API Version: {testResult.version} • WHMCS Database: {testResult.database}
              </div>
            </div>
          </div>
          <button onClick={() => setTestResult(null)} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
      )}

      {/* 4 Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">WHMCS Core</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Detected
            </span>
          </div>
          <div className="text-lg font-bold text-slate-800">WHMCS v{data.whmcs.version}</div>
          <div className="text-[11px] text-slate-500 font-mono truncate mt-1" title={data.whmcs.path}>
            {data.whmcs.path}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">WHMCS Theme</span>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Protected
            </span>
          </div>
          <div className="text-lg font-bold text-slate-800">Original Theme</div>
          <div className="text-[11px] text-slate-500 mt-1">Zero file or CSS modification</div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">WHMCS Database</span>
            <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              SQL Dump
            </span>
          </div>
          <div className="text-lg font-bold text-slate-800 font-mono">{data.whmcs.dbName}</div>
          <div className="text-[11px] text-slate-500 mt-1">{data.whmcs.sqlDumpSizeMb} MB dump ready</div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">cPanel / WHM API</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Live
            </span>
          </div>
          <div className="text-lg font-bold text-slate-800">WHM API 1 Active</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Port 5000 / 2083 Ready</div>
        </div>
      </div>

      {/* WHMCS Server Module Setup Guide */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Server className="w-4 h-4 text-[#ff6c2c]" /> WHMCS Server Settings (Copy to WHMCS Admin)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              In WHMCS: Navigate to <em>Setup &gt; Products/Services &gt; Servers &gt; Add New Server</em> and enter these exact credentials:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] uppercase font-bold text-slate-400">Server Name</div>
            <div className="text-slate-800 font-bold mt-1">{data.serverSettings.name}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] uppercase font-bold text-slate-400">Hostname / IP Address</div>
            <div className="text-slate-800 font-bold mt-1">{data.serverSettings.hostname} ({data.serverSettings.ipaddress})</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] uppercase font-bold text-slate-400">Server Type (Module)</div>
            <div className="text-[#ff6c2c] font-bold mt-1 uppercase">{data.serverSettings.type}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] uppercase font-bold text-slate-400">Port</div>
            <div className="text-slate-800 font-bold mt-1">{data.serverSettings.port} (Production: 2083 / 2087)</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] uppercase font-bold text-slate-400">Primary Nameserver</div>
            <div className="text-slate-800 font-bold mt-1">{data.serverSettings.nameserver1}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] uppercase font-bold text-slate-400">Secondary Nameserver</div>
            <div className="text-slate-800 font-bold mt-1">{data.serverSettings.nameserver2}</div>
          </div>
        </div>

        {/* API Token Box */}
        <div className="bg-slate-900 text-slate-200 p-4 rounded-xl flex items-center justify-between text-xs">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">WHM API Token / Access Hash:</div>
            <div className="font-mono text-emerald-400 select-all">{data.apiToken}</div>
          </div>
          <button
            onClick={() => copyToken(data.apiToken)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 transition text-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Token'}
          </button>
        </div>
      </div>

      {/* Interactive Account Provisioning Simulator */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Play className="w-4 h-4 text-emerald-600" /> Simulate WHMCS Hosting Order Provisioning
        </h2>
        <p className="text-xs text-slate-500">
          When a client completes an order in WHMCS, WHMCS sends an automated <code>/json-api/createacct</code> call. Test it here:
        </p>

        <form onSubmit={handleSimulateOrder} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Domain Name:</label>
            <input
              type="text"
              value={simDomain}
              onChange={(e) => setSimDomain(e.target.value)}
              placeholder="clientwebsite.com"
              className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[#ff6c2c]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Hosting Package / Plan:</label>
            <select
              value={simPlan}
              onChange={(e) => setSimPlan(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2 text-xs rounded-lg focus:outline-none"
            >
              <option value="Basic Shared Hosting">Basic Shared Hosting (1GB)</option>
              <option value="Premium SSD Hosting">Premium SSD Hosting (10GB)</option>
              <option value="Unlimited Business Cloud">Unlimited Business Cloud (∞)</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition h-[35px] flex items-center justify-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" /> Provision Account via WHM API
          </button>
        </form>

        {simMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold animate-fade">
            ✓ {simMsg}
          </div>
        )}
      </div>

      {/* Synchronized cPanel Accounts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            Accounts Provisioned in cPanel / WHMCS ({accounts.length})
          </h2>
          <button onClick={loadData} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
            <tr>
              <th className="py-3 px-6">cPanel User</th>
              <th className="py-3 px-6">Domain</th>
              <th className="py-3 px-6">Hosting Plan</th>
              <th className="py-3 px-6">Disk Usage</th>
              <th className="py-3 px-6">Status</th>
              <th className="py-3 px-6 text-right">WHMCS Single Sign-On</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.map((acct) => (
              <tr key={acct.user} className="hover:bg-slate-50">
                <td className="py-3 px-6 font-bold text-slate-800 flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-orange-100 text-[#ff6c2c] flex items-center justify-center text-[10px] font-bold">
                    cP
                  </div>
                  {acct.user}
                </td>
                <td className="py-3 px-6 font-semibold text-blue-600">{acct.domain}</td>
                <td className="py-3 px-6 text-slate-600">{acct.plan}</td>
                <td className="py-3 px-6 font-mono text-slate-600">{acct.diskused} / {acct.disklimit}</td>
                <td className="py-3 px-6">
                  {acct.suspended ? (
                    <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-[10px] font-bold">
                      Suspended ({acct.suspendreason || 'Overdue'})
                    </span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                      Active
                    </span>
                  )}
                </td>
                <td className="py-3 px-6 text-right">
                  <a
                    href={`/?user=${acct.user}`}
                    onClick={() => {
                      localStorage.setItem('cpanel_active_user', acct.user);
                    }}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-[11px] inline-flex items-center gap-1 cursor-pointer"
                  >
                    Log in to cPanel <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
