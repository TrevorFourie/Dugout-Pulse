import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const getConfirmStyle = () => {
    switch (variant) {
      case 'danger':
        return 'bg-[#FF5252] hover:bg-[#A82E38] text-white shadow-red-500/20';
      case 'warning':
        return 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20';
      case 'primary':
      default:
        return 'bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] shadow-slate-900/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white dark:bg-[#1A2028] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#354050] p-6 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-2">
          <div
            className={`p-3 rounded-xl shrink-0 ${
              variant === 'danger'
                ? 'bg-red-100 text-red-600 dark:bg-[#FF5252]/15 dark:text-[#D4626D]'
                : variant === 'warning'
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'
                : 'bg-blue-100 text-[#18212D] dark:bg-[#252D38] dark:text-blue-400'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA] leading-tight">
              {title}
            </h3>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-[#D1D5DB] leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-[#354050] font-semibold text-sm text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors flex items-center gap-1.5"
          >
            <X className="w-4 h-4" />
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md transition-all active:scale-95 flex items-center gap-1.5 ${getConfirmStyle()}`}
          >
            <Check className="w-4 h-4" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
