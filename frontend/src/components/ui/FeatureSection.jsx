import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import FeatureItem from './FeatureItem';

/**
 * Reusable FeatureSection component (Card representing a cPanel category)
 * Styled with dark purple to emerald glassmorphism and modern header accents.
 */
export default function FeatureSection({
  id,
  title,
  icon: SectionIcon,
  tools = [],
  onOpenTool,
  defaultCollapsed = false,
  className = ''
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section 
      aria-labelledby={`section-title-${id}`}
      className={`bg-[#18092a]/80 backdrop-blur-md border border-purple-900/35 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.25)] overflow-hidden transition-all ${className}`}
    >
      {/* Section Header */}
      <header 
        onClick={() => setCollapsed(!collapsed)}
        className="px-4 py-3 bg-gradient-to-r from-[#210c38]/90 via-[#270e40]/80 to-[#12221b]/80 border-b border-purple-900/30 flex items-center justify-between cursor-pointer select-none hover:bg-purple-900/20 transition-colors"
      >
        <div className="flex items-center space-x-2.5">
          {SectionIcon && (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/25 to-emerald-500/25 flex items-center justify-center text-emerald-400 border border-purple-700/30 shadow-xs">
              <SectionIcon className="w-4 h-4 stroke-[2]" aria-hidden="true" />
            </div>
          )}
          <h2 
            id={`section-title-${id}`} 
            className="text-[14px] font-bold text-white tracking-tight"
          >
            {title}
          </h2>
        </div>

        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${title} section` : `Collapse ${title} section`}
          className="p-1 text-purple-300/60 hover:text-white transition"
        >
          {collapsed ? (
            <ChevronDown className="w-4 h-4 stroke-[2]" />
          ) : (
            <ChevronUp className="w-4 h-4 stroke-[2]" />
          )}
        </button>
      </header>

      {/* Feature Items Grid */}
      {!collapsed && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {tools.map((tool) => (
            <FeatureItem
              key={tool.id}
              id={tool.id}
              name={tool.name}
              icon={tool.icon}
              desc={tool.desc}
              badge={tool.badge}
              disabled={tool.disabled}
              onClick={() => onOpenTool && onOpenTool(tool.target, tool.jump, tool.extra)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
