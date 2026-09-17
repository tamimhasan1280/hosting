import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

/**
 * Reusable Alert / Notification component with 4 variants and auto-dismiss.
 */
export default function Alert({
  variant = 'info', // 'success' | 'error' | 'warning' | 'info'
  title,
  message,
  children,
  onClose,
  autoDismiss = 0, // milliseconds, 0 = persistent
  className = ''
}) {
  useEffect(() => {
    if (autoDismiss > 0 && onClose) {
      const timer = setTimeout(onClose, autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, onClose]);

  const config = {
    success: {
      bg: 'bg-[#dafbe1]',
      border: 'border-[#aceebb]',
      text: 'text-[#1a7f37]',
      icon: CheckCircle2
    },
    error: {
      bg: 'bg-[#ffebe9]',
      border: 'border-[#ffc1c0]',
      text: 'text-[#cf222e]',
      icon: AlertCircle
    },
    warning: {
      bg: 'bg-[#fff8c5]',
      border: 'border-[#f1e05a]',
      text: 'text-[#9a6700]',
      icon: AlertTriangle
    },
    info: {
      bg: 'bg-[#ddf4ff]',
      border: 'border-[#a4d8ff]',
      text: 'text-[#0969da]',
      icon: Info
    }
  }[variant] || config.info;

  const IconComp = config.icon;

  return (
    <div 
      role="alert"
      className={`border rounded-[4px] p-3 flex items-start gap-2.5 text-[12px] text-left leading-normal ${config.bg} ${config.border} ${config.text} ${className}`}
    >
      <IconComp className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold mb-0.5">{title}</div>}
        <div>{message || children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className="shrink-0 p-0.5 opacity-60 hover:opacity-100 transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
