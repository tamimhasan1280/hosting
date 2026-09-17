import React from 'react';

/**
 * Reusable Statistics Panel component
 * Styled with dark purple to emerald gradient progress indicators and modern glass cards.
 */
export default function StatisticsPanel({
  stats,
  className = ''
}) {
  const resources = stats?.resources || {};
  const disk = resources.disk || { usedGb: '0.00', totalGb: '10.0', usagePercent: 0, homeUsedMb: 0 };
  const cpu = resources.cpu || { usagePercent: 0, cores: 4 };
  const mem = resources.memory || { usedMb: 0, totalMb: 4096, usagePercent: 0 };
  const bandwidth = resources.bandwidth || { usedMb: 0, limitMb: 50000, usagePercent: 0 };

  const statItems = [
    {
      name: 'MySQL Databases',
      usage: '1',
      limit: '20',
      percent: 5,
      hasProgress: true
    },
    {
      name: 'Disk Usage',
      usage: `${disk.usedGb || (disk.homeUsedMb ? (disk.homeUsedMb / 1024).toFixed(2) : '0.01')} GB`,
      limit: `${disk.totalGb || '10.0'} GB`,
      percent: disk.usagePercent || 1,
      hasProgress: true
    },
    {
      name: 'Bandwidth',
      usage: `${(bandwidth.usedMb / 1024).toFixed(2)} GB`,
      limit: '50 GB',
      percent: bandwidth.usagePercent || 1,
      hasProgress: true
    },
    {
      name: 'Email Accounts',
      usage: '2',
      limit: '50',
      percent: 4,
      hasProgress: true
    },
    {
      name: 'FTP Accounts',
      usage: '1',
      limit: '20',
      percent: 5,
      hasProgress: true
    },
    {
      name: 'Domains',
      usage: '1',
      limit: '10',
      percent: 10,
      hasProgress: true
    },
    {
      name: 'Cron Jobs',
      usage: '1',
      limit: '20',
      percent: 5,
      hasProgress: true
    }
  ];

  return (
    <div className={`bg-[#18092a]/85 backdrop-blur-md border border-purple-900/35 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.25)] overflow-hidden text-left text-[12px] ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#210c38]/90 via-[#270e40]/80 to-[#12221b]/80 border-b border-purple-900/30 font-bold text-white text-[13px] flex items-center justify-between">
        <span>Hosting Statistics</span>
        <span className="text-[11px] font-semibold text-purple-300">Live Quotas</span>
      </div>

      <div className="p-3.5 space-y-3.5 divide-y divide-purple-900/30">
        {statItems.map((item, idx) => (
          <div key={idx} className={idx === 0 ? 'pt-0' : 'pt-2.5'}>
            <div className="flex items-center justify-between text-[11.5px] font-medium mb-1">
              <span className="text-purple-200">{item.name}</span>
              <span className="font-semibold text-white">
                {item.usage} / {item.limit}
              </span>
            </div>

            {item.hasProgress && (
              <div className="w-full bg-purple-950/70 rounded-full h-1.5 overflow-hidden border border-purple-800/30 mt-1">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    item.percent > 85 
                      ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' 
                      : item.percent > 65 
                        ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' 
                        : 'bg-gradient-to-r from-purple-500 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  }`}
                  style={{ width: `${Math.max(item.percent, 3)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
