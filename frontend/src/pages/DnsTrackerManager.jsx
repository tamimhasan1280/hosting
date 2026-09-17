import React, { useState } from 'react';
import { api } from '../services/api';
import { Globe, Search, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export default function DnsTrackerManager({ onBack, user = 'cpanel_user' }) {
  const [domain, setDomain] = useState('example.com');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLookup = async (e) => {
    e?.preventDefault();
    if (!domain.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.trackDns(domain, user);
      setResults(res);
    } catch (err) {
      setError(err.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button onClick={onBack} className="hover:text-[#ff6c2c]">Advanced</button>
            <span>/</span>
            <span className="font-semibold text-slate-700">Track DNS</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-[#ff6c2c]" />
            Track DNS & Domain Resolver
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Perform live DNS lookups and inspect authoritative DNS propagation for authorized hostnames.
          </p>
        </div>
      </div>

      <form onSubmit={handleLookup} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex gap-3 items-center">
        <div className="flex-1">
          <input
            type="text"
            required
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Enter domain name, e.g. example.com"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#ff6c2c]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-[#ff6c2c] hover:bg-[#e05b22] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
        >
          <Search className="w-4 h-4" /> {loading ? 'Looking up...' : 'Lookup'}
        </button>
      </form>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {results && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Lookup Results for {results.domain}</h2>
              <span className="text-xs text-slate-500">Resolved in {results.latencyMs}ms at {new Date(results.timestamp).toLocaleTimeString()}</span>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-bold">Authoritative DNS Active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="font-bold text-slate-700 mb-1">A Records (IPv4):</div>
              {results.records?.a?.length > 0 ? (
                results.records.a.map((ip, i) => <div key={i} className="text-emerald-700">{ip}</div>)
              ) : <div className="text-slate-400">None found</div>}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="font-bold text-slate-700 mb-1">AAAA Records (IPv6):</div>
              {results.records?.aaaa?.length > 0 ? (
                results.records.aaaa.map((ip, i) => <div key={i} className="text-emerald-700">{ip}</div>)
              ) : <div className="text-slate-400">None found</div>}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="font-bold text-slate-700 mb-1">MX Records:</div>
              {results.records?.mx?.length > 0 ? (
                results.records.mx.map((m, i) => <div key={i} className="text-slate-800">{m.exchange} (Priority: {m.priority})</div>)
              ) : <div className="text-slate-400">None found</div>}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="font-bold text-slate-700 mb-1">Nameservers (NS):</div>
              {results.records?.ns?.length > 0 ? (
                results.records.ns.map((ns, i) => <div key={i} className="text-slate-800">{ns}</div>)
              ) : <div className="text-slate-400">None found</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
