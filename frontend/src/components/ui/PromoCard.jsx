import React from 'react';
import { ShieldCheck, X } from 'lucide-react';

/**
 * Reusable PromoCard component matching the reference screenshot:
 * "Site Quality Monitoring - We'll watch your site for you!" + "Start Monitoring" button.
 */
export default function PromoCard({
  title = "Site Quality Monitoring",
  description = "We'll watch your site for you!",
  buttonText = "Start Monitoring",
  onAction,
  onDismiss,
  className = ""
}) {
  return (
    <div className={`border border-[#ced4da] rounded-[4px] p-3 bg-white relative text-left shadow-xs ${className}`}>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss promotional message"
          className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="text-[12px] font-bold text-[#1f2533] leading-snug">
        {title} <span className="font-normal text-slate-600">— {description}</span>
      </div>

      <div className="mt-2.5">
        <button
          type="button"
          onClick={onAction || (() => {
            if (typeof window !== 'undefined' && window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('cpanel-navigate', { detail: 'site_quality_monitoring' }));
            }
          })}
          className="w-full bg-[#27235C] hover:bg-[#1e1b4b] text-white text-[11px] font-semibold py-1.5 px-3 rounded-[3px] transition cursor-pointer text-center"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
