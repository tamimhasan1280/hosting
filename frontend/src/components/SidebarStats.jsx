import React from 'react';
import { HardDrive, Cpu, Activity, Database, Globe, Info, Server, Mail } from 'lucide-react';

export default function SidebarStats({ stats, onOpenServerInfo }) {
  if (!stats) return null;

  const { generalInfo = {}, resources = {}, server = {} } = stats;

  const diskUsageMb = resources.disk?.homeUsedMb || 0;
  const diskTotalGb = resources.disk?.totalGb || 50;
  const diskPercent = resources.disk?.usagePercent || 5;

  const cpuPercent = resources.cpu?.usagePercent || 10;
  const memPercent = resources.memory?.usagePercent || 25;
  const memUsedMb = resources.memory?.usedMb || 2048;
  const memTotalMb = resources.memory?.totalMb || 8192;

  const bandwidthUsed = resources.bandwidth?.usedMb || 412;
  const bandwidthLimit = resources.bandwidth?.limitMb || 50000;
  const bandwidthPercent = resources.bandwidth?.usagePercent || 1;

  return (
    <aside className="w-80 flex-shrink-0 space-y-4">
      {/* General Information Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-[#ff6c2c]" />
            General Information
          </h2>
        </div>
        <div className="p-4 text-xs divide-y divide-slate-100 space-y-2.5">
          <div className="flex justify-between pt-1">
            <span className="text-slate-500 font-medium">Current User:</span>
            <span className="font-semibold text-slate-800">{generalInfo.currentUser || 'cpanel_user'}</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-slate-500 font-medium">Primary Domain:</span>
            <a href="/site" target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline">
              {generalInfo.primaryDomain || 'example.com'}
            </a>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-slate-500 font-medium">Shared IP Address:</span>
            <span className="font-mono text-slate-700">{generalInfo.sharedIp || '192.0.2.1'}</span>
          </div>
          <div className="flex flex-col pt-2">
            <span className="text-slate-500 font-medium mb-1">Home Directory:</span>
            <span className="font-mono text-[10px] bg-slate-100 p-1.5 rounded text-slate-700 truncate" title={generalInfo.homeDir}>
              {generalInfo.homeDir || '/home/cpanel_user'}
            </span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-slate-500 font-medium">Last Login:</span>
            <span className="text-slate-600">Today from {generalInfo.lastLoginIp || '127.0.0.1'}</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-slate-500 font-medium">cPanel Theme:</span>
            <span className="capitalize font-semibold text-slate-700">{generalInfo.theme || 'jupiter'}</span>
          </div>
          <div className="pt-2">
            <button
              onClick={onOpenServerInfo}
              className="w-full text-center text-xs font-semibold text-[#ff6c2c] hover:text-[#e55619] hover:underline flex items-center justify-center gap-1 py-1"
            >
              <Server className="w-3.5 h-3.5" />
              Server Information
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[#ff6c2c]" />
            Statistics
          </h2>
        </div>

        <div className="p-4 space-y-4 text-xs">
          {/* Disk Usage */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-600 font-medium flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                Disk Usage
              </span>
              <span className="font-semibold text-slate-700">{diskUsageMb} MB / {diskTotalGb} GB</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${diskPercent > 85 ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(diskPercent, 100)}%` }}
              ></div>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{resources.disk?.homeFiles || 0} files in home directory</div>
          </div>

          {/* MySQL Disk Usage */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-600 font-medium flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                MySQL® Disk Usage
              </span>
              <span className="font-semibold text-slate-700">1.2 MB / ∞</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '4%' }}></div>
            </div>
          </div>

          {/* Bandwidth */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-600 font-medium flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                Bandwidth
              </span>
              <span className="font-semibold text-slate-700">{(bandwidthUsed / 1024).toFixed(2)} GB / {(bandwidthLimit / 1024).toFixed(0)} GB</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${bandwidthPercent}%` }}></div>
            </div>
          </div>

          {/* CPU Usage */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-600 font-medium flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                CPU Usage ({resources.cpu?.cores || 4} Cores)
              </span>
              <span className="font-semibold text-slate-700">{cpuPercent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${cpuPercent > 80 ? 'bg-red-500' : 'bg-cyan-500'}`}
                style={{ width: `${cpuPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Memory Usage */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-600 font-medium flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-slate-400" />
                Physical Memory
              </span>
              <span className="font-semibold text-slate-700">{(memUsedMb / 1024).toFixed(1)} GB / {(memTotalMb / 1024).toFixed(1)} GB</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${memPercent > 85 ? 'bg-red-500' : 'bg-violet-500'}`}
                style={{ width: `${memPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Quick counts */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="font-bold text-slate-800 text-sm">3</div>
              <div className="text-[10px] text-slate-500">Domains / Subs</div>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="font-bold text-slate-800 text-sm">2</div>
              <div className="text-[10px] text-slate-500">Email Accounts</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
