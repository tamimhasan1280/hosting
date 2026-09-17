import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable Button component with cPanel theme variants and states.
 */
export default function Button({
  children,
  type = 'button',
  variant = 'primary', // 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost' | 'link' | 'orange'
  size = 'md', // 'sm' | 'md' | 'lg'
  loading = false,
  disabled = false,
  icon: IconComponent,
  iconPosition = 'left',
  onClick,
  className = '',
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-[4px] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 select-none cursor-pointer';

  const variantStyles = {
    primary: 'bg-[#0b69a3] hover:bg-[#085280] active:bg-[#063e61] text-white border border-[#0b69a3] focus:ring-[#0b69a3]/50',
    secondary: 'bg-white hover:bg-slate-50 active:bg-slate-100 text-[#1f2533] border border-[#ced4da] focus:ring-slate-300',
    orange: 'bg-[#ff6c2c] hover:bg-[#e55a1b] active:bg-[#cc4f16] text-white border border-[#ff6c2c] focus:ring-[#ff6c2c]/50',
    success: 'bg-[#1a7f37] hover:bg-[#14622b] active:bg-[#0e481f] text-white border border-[#1a7f37] focus:ring-[#1a7f37]/50',
    warning: 'bg-[#f59e0b] hover:bg-[#d97706] active:bg-[#b45309] text-white border border-[#f59e0b] focus:ring-[#f59e0b]/50',
    danger: 'bg-[#cf222e] hover:bg-[#a41a25] active:bg-[#82131c] text-white border border-[#cf222e] focus:ring-[#cf222e]/50',
    ghost: 'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-transparent focus:ring-slate-200',
    link: 'bg-transparent text-[#0b69a3] hover:underline p-0 h-auto border-none focus:ring-0'
  };

  const sizeStyles = {
    sm: 'text-[11px] py-1 px-2 gap-1.5',
    md: 'text-[12px] py-1.5 px-3 gap-2',
    lg: 'text-[14px] py-2 px-4 gap-2.5'
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant] || variantStyles.primary} ${variant !== 'link' ? sizeStyles[size] : ''} ${
        isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
      } ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
      {!loading && IconComponent && iconPosition === 'left' && (
        <IconComponent className="w-3.5 h-3.5 shrink-0" />
      )}
      <span>{children}</span>
      {!loading && IconComponent && iconPosition === 'right' && (
        <IconComponent className="w-3.5 h-3.5 shrink-0" />
      )}
    </button>
  );
}
