import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Server, CheckCircle2, Shield, Cpu, HardDrive, RefreshCw } from 'lucide-react';

export default function ServerInfoPage({ onBack, user = 'cpanel_user' }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadInfo = async () => {
    setLoading(true);
    try {
      const res = await api.getServerInformation(user);
      setInfo(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInfo(); }, [user]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button onClick={onBack} className="hover:text-[#ff6c2c]">General</button>
            <span>/</span>
            <span className="font-semibold text-slate-700">Server Information</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Server className="w-6 h-6 text-[#ff6c2c]" />
            Server Specifications & Daemon Status
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Inspecting physical hosting hardware, web server binaries, database daemon, and operating system.
          </p>
        </div>
        <button onClick={loadInfo} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hardware & OS */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Cpu className="w-4 h-4 text-[#ff6c2c]" /> Host & Processor Specifications
          </h2>
          <div className="divide-y divide-slate-100">
            <div className="flex justify-between py-2"><span className="text-slate-500">Hostname:</span><span className="font-mono font-bold text-slate-800">{info?.hostname}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">Operating System:</span><span className="font-mono text-slate-800">{info?.operatingSystem}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">Architecture:</span><span className="font-mono text-slate-800">{info?.architecture}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">CPU Model:</span><span className="font-mono text-slate-800">{info?.cpuModel}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">CPU Cores:</span><span className="font-mono text-slate-800">{info?.cpuCount} Logical Cores</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">Total Memory:</span><span className="font-mono text-slate-800">{info?.memoryTotal}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">Available Memory:</span><span className="font-mono text-emerald-600 font-bold">{info?.memoryFree}</span></div>
          </div>
        </div>

        {/* Software & Daemons */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Shield className="w-4 h-4 text-[#ff6c2c]" /> Software & Service Statuses
          </h2>
          <div className="divide-y divide-slate-100">
            <div className="flex justify-between py-2"><span className="text-slate-500">Web Server:</span><span className="font-mono text-slate-800">{info?.webServer}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">PHP Version:</span><span className="font-mono text-slate-800">{info?.phpVersion}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">MySQL / MariaDB:</span><span className="font-mono text-slate-800">{info?.mysqlVersion}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">Node.js Version:</span><span className="font-mono text-slate-800">{info?.nodeVersion}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">SSL Engine:</span><span className="font-mono text-slate-800">{info?.securityStatus?.sslEngine}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">Server Timezone:</span><span className="font-mono text-slate-800">{info?.timezone}</span></div>
            <div className="flex justify-between py-2"><span className="text-slate-500">Security Isolation:</span><span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">Multi-Tenant Isolated</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
