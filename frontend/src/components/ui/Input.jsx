import React from 'react';

/**
 * Reusable Form Input component with label, error, helper text, and icon support.
 */
export default function Input({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  helperText,
  disabled = false,
  required = false,
  icon: IconComponent,
  className = '',
  ...props
}) {
  const inputId = id || `input-${Math.random().toString(36).substring(2, 8)}`;

  return (
    <div className={`text-left ${className}`}>
      {label && (
        <label 
          htmlFor={inputId} 
          className="block text-[11px] font-semibold text-[#1f2533] mb-1"
        >
          {label} {required && <span className="text-[#cf222e]">*</span>}
        </label>
      )}

      <div className="relative">
        {IconComponent && (
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <IconComponent className="w-3.5 h-3.5" />
          </div>
        )}

        <input
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`w-full bg-white text-[#1f2533] text-[12px] rounded-[3px] border transition-colors outline-none focus:ring-2 ${
            IconComponent ? 'pl-8 pr-2.5 py-1.5' : 'px-2.5 py-1.5'
          } ${
            error
              ? 'border-[#cf222e] focus:border-[#cf222e] focus:ring-[#cf222e]/20'
              : 'border-[#ced4da] focus:border-[#0b69a3] focus:ring-[#0b69a3]/20'
          } ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
          {...props}
        />
      </div>

      {error && (
        <p className="mt-1 text-[11px] text-[#cf222e]">{error}</p>
      )}
      {!error && helperText && (
        <p className="mt-1 text-[11px] text-[#8c959f]">{helperText}</p>
      )}
    </div>
  );
}
