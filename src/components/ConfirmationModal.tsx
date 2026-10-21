import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
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
  secondaryLabel,
  onSecondary,
}) => {
  if (!isOpen) return null;

  const confirmStyle =
    variant === 'danger'
      ? 'bg-[#FF5252] hover:bg-[#A82E38] text-white'
      : variant === 'warning'
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : 'bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419]';

  const iconStyle =
    variant === 'danger'
      ? 'bg-red-100 text-red-600 dark:bg-[#FF5252]/15 dark:text-[#D4626D]'
      : variant === 'warning'
      ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'
      : 'bg-blue-100 text-[#18212D] dark:bg-[#252D38] dark:text-blue-400';

  const secondaryBtn =
    'w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-[#354050] font-semibold text-sm text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm max-h-[85dvh] overflow-y-auto bg-white dark:bg-[#1A2028] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#354050] p-5"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${iconStyle}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA] leading-tight">{title}</h3>
            <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600 dark:text-[#D1D5DB] leading-snug">
              {message}
            </p>
          </div>
        </div>

        {/* Stacked on phones, a row from sm up. Primary action first on mobile. */}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className={secondaryBtn}>
            {cancelLabel}
          </button>
          {secondaryLabel && onSecondary && (
            <button type="button" onClick={onSecondary} className={secondaryBtn}>
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${confirmStyle}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
