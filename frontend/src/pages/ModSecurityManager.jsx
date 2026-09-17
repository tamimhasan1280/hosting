import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldX, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, RefreshCw, Layers, Terminal } from 'lucide-react';

export default function ModSecurityManager({ onBack, user = 'cpanel_user' }) {
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingDomain, setUpdatingDomain] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, evtRes] = await Promise.all([
        api.getModSecStatus(user),
        api.getModSecEvents(user)
      ]);
      setData(res);
      setEvents(evtRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user]);

  const handleToggle = async (domain, newStatus) => {
    setUpdatingDomain(domain);
    try {
      await api.setModSecDomain(domain, newStatus, user);
      setStatusMsg(`ModSecurity updated to "${newStatus}" for ${domain}`);
      setTimeout(() => setStatusMsg(''), 3500);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdatingDomain(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button onClick={onBack} className="hover:text-[#ff6c2c]">Security</button>
            <span>/</span>
            <span className="font-semibold text-slate-700">ModSecurity</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldX className="w-6 h-6 text-[#ff6c2c]" />
            ModSecurity® Web Application Firewall
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage real-time intrusion detection and web application firewall policies for your domains.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {statusMsg && (
            <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> {statusMsg}
            </div>
          )}
          <button onClick={loadData} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Engine Status Banner */}
      {data?.capabilities && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-slate-100 rounded-lg p-3 bg-slate-50">
            <div className="text-xs text-slate-500 font-medium">Engine Mode</div>
            <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              {data.capabilities.statusMessage || 'Active / Managed'}
            </div>
          </div>
          <div className="border border-slate-100 rounded-lg p-3 bg-slate-50">
            <div className="text-xs text-slate-500 font-medium">SecRuleEngine Directives</div>
            <div className="text-sm font-bold text-slate-800 mt-1">
              {data.activeProtectionCount} of {data.totalDomains} Domains Protected
            </div>
          </div>
          <div className="border border-slate-100 rounded-lg p-3 bg-slate-50">
            <div className="text-xs text-slate-500 font-medium">OWASP Core Rule Set</div>
            <div className="text-sm font-bold text-slate-800 mt-1">
              {data.capabilities.crsAvailable ? `CRS ${data.capabilities.crsVersion}` : 'Default Security Engine Rules'}
            </div>
          </div>
        </div>
      )}

      {/* Domains Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
          <h2 className="text-sm font-bold text-slate-800">Domain-Level ModSecurity Configuration</h2>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
            <tr>
              <th className="py-3 px-6">Domain</th>
              <th className="py-3 px-6">Document Root</th>
              <th className="py-3 px-6">Status</th>
              <th className="py-3 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.domainStatuses?.map((d, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="py-3 px-6 font-semibold text-slate-900">{d.domain}</td>
                <td className="py-3 px-6 font-mono text-slate-600">{d.docRoot}</td>
                <td className="py-3 px-6">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    d.status === 'On' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    d.status === 'DetectionOnly' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {d.status === 'On' ? 'On (Enforced)' : d.status === 'DetectionOnly' ? 'Detection Only' : 'Off (Disabled)'}
                  </span>
                </td>
                <td className="py-3 px-6 text-right space-x-2">
                  <button
                    disabled={updatingDomain === d.domain}
                    onClick={() => handleToggle(d.domain, d.status === 'On' ? 'Off' : 'On')}
                    className={`px-3 py-1 rounded font-semibold transition ${
                      d.status === 'On'
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {updatingDomain === d.domain ? 'Updating...' : (d.status === 'On' ? 'Disable' : 'Enable')}
                  </button>
                  <button
                    disabled={updatingDomain === d.domain}
                    onClick={() => handleToggle(d.domain, 'DetectionOnly')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 font-medium"
                  >
                    Detection Only
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Security Audit Events */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Recent ModSecurity Audit Events</h2>
          <span className="text-xs text-slate-500">{events.length} logged event(s)</span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
            <tr>
              <th className="py-3 px-6">Timestamp</th>
              <th className="py-3 px-6">Client IP</th>
              <th className="py-3 px-6">URI / Request</th>
              <th className="py-3 px-6">Rule ID & Message</th>
              <th className="py-3 px-6 text-right">Action Taken</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((evt, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="py-3 px-6 text-slate-500 font-mono text-[11px]">{new Date(evt.timestamp).toLocaleString()}</td>
                <td className="py-3 px-6 font-mono text-slate-700">{evt.clientIp}</td>
                <td className="py-3 px-6 font-mono text-slate-800 max-w-xs truncate">{evt.uri}</td>
                <td className="py-3 px-6 text-slate-700">
                  <span className="font-semibold text-rose-700 font-mono">[{evt.ruleId}]</span> {evt.ruleMessage}
                </td>
                <td className="py-3 px-6 text-right">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    {evt.action}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
