import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { BarChart3, Users, AlertOctagon, Globe, Eye, RefreshCw } from 'lucide-react';

export default function MetricsManager() {
  const [visitors, setVisitors] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('visitors'); // 'visitors' | 'logs'

  const loadData = async () => {
    setLoading(true);
    try {
      const [v, l] = await Promise.all([
        api.getVisitorMetrics(),
        api.getErrorLogs()
      ]);
      setVisitors(v);
      setLogs(l);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!visitors) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#ff6c2c]" />
            Metrics, Awstats & Error Logs
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Analyze visitor traffic, page views, browser breakdown, and inspect real-time server error logs.
          </p>
        </div>
        <button
          onClick={loadData}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Metrics
        </button>
      </div>

      <div className="flex border-b border-slate-200 space-x-4 text-xs font-semibold">
        <button
          onClick={() => setTab('visitors')}
          className={`pb-2.5 px-2 border-b-2 transition ${
            tab === 'visitors' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Visitor Analytics & Traffic
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`pb-2.5 px-2 border-b-2 transition ${
            tab === 'logs' ? 'border-[#ff6c2c] text-[#ff6c2c]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Raw Error Logs (Apache / PHP)
        </button>
      </div>

      {tab === 'visitors' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 text-[#ff6c2c] flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-900">{visitors.todayVisitors}</div>
                <div className="text-xs text-slate-500 font-medium">Total Visitors Today</div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Eye className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-900">{visitors.todayPageViews}</div>
                <div className="text-xs text-slate-500 font-medium">Page Views</div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-900">{visitors.uniqueIps}</div>
                <div className="text-xs text-slate-500 font-medium">Unique IP Addresses</div>
              </div>
            </div>
          </div>

          {/* Top Pages Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
              <h2 className="text-sm font-bold text-slate-800">Top Visited Pages / URLs</h2>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-6">URL Path</th>
                  <th className="py-3 px-6 text-right">Hits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {visitors.topPages.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3 px-6 text-slate-800 font-medium">{p.url}</td>
                    <td className="py-3 px-6 text-right font-bold text-blue-600">{p.hits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-amber-500" /> Recent Web Server Errors (Last 300 entries)
          </h2>
          <div className="bg-slate-900 text-slate-300 font-mono text-xs p-4 rounded-xl space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className={`font-bold ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : 'text-slate-300'}`}>
                  [{log.level.toUpperCase()}]
                </span>
                <span className="text-slate-200">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
