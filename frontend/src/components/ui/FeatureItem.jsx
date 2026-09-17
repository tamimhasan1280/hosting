import React from 'react';

/**
 * Reusable FeatureItem component
 * Modernized with sleek rounded styling, glowing icon containers,
 * high-contrast typography, and smooth hover micro-interactions.
 */
export default function FeatureItem({
  id,
  name,
  icon: IconComponent,
  desc,
  badge,
  disabled = false,
  onClick,
  className = ''
}) {
  const handleClick = (e) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    if (onClick) onClick();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onClick) onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-disabled={disabled}
      className={`group flex items-start gap-3 p-2.5 rounded-xl transition-all duration-200 text-left select-none outline-none ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'cursor-pointer hover:bg-gradient-to-r hover:from-purple-900/30 hover:to-emerald-900/20 border border-transparent hover:border-purple-700/35 hover:shadow-md hover:-translate-y-0.5'
      } ${className}`}
      title={desc || name}
    >
      {/* Icon Area */}
      <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-purple-800/35 to-emerald-800/25 border border-purple-700/30 flex items-center justify-center text-purple-200 group-hover:text-emerald-300 group-hover:scale-105 transition-all shadow-xs">
        {IconComponent && <IconComponent className="w-5 h-5 stroke-[1.8]" />}
      </div>

      {/* Text Area */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-bold text-[#f1f5f9] group-hover:text-purple-300 leading-snug transition-colors">
            {name}
          </span>
          {badge && (
            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700/40">
              {badge}
            </span>
          )}
        </div>
        {desc && (
          <p className="text-[11px] text-[#94a3b8] group-hover:text-slate-300 leading-snug line-clamp-2 mt-0.5 transition-colors">
            {desc}
          </p>
        )}
      </div>
    </div>
  );
}
