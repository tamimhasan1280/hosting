import React, { useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import Button from './Button';

/**
 * Reusable cPanel-styled Modal Dialog component.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  confirmText,
  cancelText = 'Cancel',
  onConfirm,
  confirmVariant = 'primary',
  loading = false,
  error = null,
  maxWidth = 'max-w-lg',
  className = ''
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4 animate-in fade-in duration-150"
    >
      <div 
        className={`bg-white w-full ${maxWidth} rounded-[6px] shadow-xl border border-[#ced4da] overflow-hidden flex flex-col max-h-[90vh] ${className}`}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-[#edf0f2] flex items-center justify-between bg-white">
          <h3 id="modal-title" className="text-[14px] font-semibold text-[#1f2533]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-slate-400 hover:text-slate-600 p-1 rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert inside Modal */}
        {error && (
          <div className="mx-5 mt-4 p-2.5 bg-[#ffebe9] border border-[#ffc1c0] rounded-[3px] text-[#cf222e] text-[11px]">
            {error}
          </div>
        )}

        {/* Body */}
        <div className="p-5 overflow-y-auto text-[12px] text-[#1f2533] leading-relaxed">
          {children}
        </div>

        {/* Footer */}
        {(onConfirm || onClose) && (
          <div className="px-5 py-3 border-t border-[#edf0f2] bg-slate-50/70 flex items-center justify-end space-x-2">
            {onClose && cancelText && (
              <Button 
                variant="secondary" 
                size="md" 
                onClick={onClose} 
                disabled={loading}
              >
                {cancelText}
              </Button>
            )}
            {onConfirm && confirmText && (
              <Button
                variant={confirmVariant}
                size="md"
                onClick={onConfirm}
                loading={loading}
              >
                {confirmText}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
