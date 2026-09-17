import React from 'react';
import { CheckCircle2, ExternalLink, ChevronRight, Server, ShieldCheck } from 'lucide-react';

/**
 * Reusable General Information Panel component
 * Styled with dark purple-emerald theme tokens.
 */
export default function GeneralInfoPanel({
  stats,
  onOpenServerInfo,
  className = '',
  activeHostingContext = null
}) {
  const ctx = activeHostingContext || (() => {
    try {
      return JSON.parse(localStorage.getItem('cpanel_active_hosting_context') || '{}');
    } catch { return {}; }
  })();

  const general = stats?.generalInfo || {};
  const currentUser = ctx.user || localStorage.getItem('cpanel_active_user') || general.currentUser || 'cpanel_user';
  const primaryDomain = ctx.domain || localStorage.getItem('cpanel_active_domain') || general.primaryDomain || 'example.com';
  const sharedIp = general.sharedIp || '208.72.218.129';
  const homeDir = `/home/${currentUser}`;
  const lastLoginIp = general.lastLoginIp || '127.0.0.1';

  return (
    <div className={`bg-[#18092a]/85 backdrop-blur-md border border-purple-900/35 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.25)] overflow-hidden text-left text-[12px] ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#210c38]/90 via-[#270e40]/80 to-[#12221b]/80 border-b border-purple-900/30 font-bold text-white text-[13px] flex items-center justify-between">
        <span>General Information</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>

      <div className="p-3.5 space-y-3 divide-y divide-purple-900/30">
        {/* Current User */}
        <div className="pt-0">
          <div className="text-[11px] text-purple-300/70 font-medium">Current User</div>
          <div className="font-bold text-white mt-0.5">{currentUser}</div>
        </div>

        {/* Primary Domain */}
        <div className="pt-2.5">
          <div className="text-[11px] text-purple-300/70 font-medium">Primary Domain</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <a 
              href={`http://${primaryDomain}`} 
              target="_blank" 
              rel="noreferrer" 
              className="text-purple-300 hover:text-emerald-300 hover:underline font-semibold break-all transition-colors"
            >
              {primaryDomain}
            </a>
            <ExternalLink className="w-3.5 h-3.5 text-purple-400/60 shrink-0" />
          </div>
        </div>

        {/* SSL Certificate Status */}
        <div className="pt-2.5">
          <div className="text-[11px] text-purple-300/70 font-medium flex items-center justify-between">
            <span>SSL Certificate</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px] bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Active SSL
            </span>
            <span className="text-[11px] text-purple-300 hover:text-emerald-300 hover:underline cursor-pointer">
              View SSL
            </span>
          </div>
        </div>

        {/* Shared IP Address */}
        <div className="pt-2.5">
          <div className="text-[11px] text-purple-300/70 font-medium">Shared IP Address</div>
          <div className="font-mono text-purple-200 mt-0.5">{sharedIp}</div>
        </div>

        {/* Home Directory */}
        <div className="pt-2.5">
          <div className="text-[11px] text-purple-300/70 font-medium">Home Directory</div>
          <div className="font-mono text-purple-200 mt-0.5 break-all text-[11px]">{homeDir}</div>
        </div>

        {/* Last Login IP Address */}
        <div className="pt-2.5">
          <div className="text-[11px] text-purple-300/70 font-medium">Last Login IP Address</div>
          <div className="font-mono text-purple-200 mt-0.5">{lastLoginIp}</div>
        </div>

        {/* Server Information Action */}
        <div className="pt-2.5">
          <button
            type="button"
            onClick={onOpenServerInfo}
            className="w-full flex items-center justify-between text-purple-300 hover:text-emerald-300 font-medium text-xs cursor-pointer py-1.5 px-2 rounded-lg bg-purple-950/30 hover:bg-purple-900/30 border border-purple-800/30 transition-all"
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              Server Information
            </span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
