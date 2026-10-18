import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ThirdStrikeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: 'out' | 'droppedSafe') => void;
}

export const ThirdStrikeModal: React.FC<ThirdStrikeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [eligibleToAttemptFirst, setEligibleToAttemptFirst] = useState(false);

  useEffect(() => {
    if (isOpen) setEligibleToAttemptFirst(false);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="third-strike-title"
        className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-[#354050] dark:bg-[#1A2028]"
      >
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC]">
              Pitching · 3rd Strike
            </p>
            <h2 id="third-strike-title" className="text-base font-semibold text-slate-950 dark:text-[#FAFAFA]">
              3rd Strike Result
            </h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] mt-0.5">
              An uncaught third strike allows an attempt at first only if first base is unoccupied or there are two outs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#252D38] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-2.5">
          {/* Option 1: Standard Strikeout (Batter Out) */}
          <button
            type="button"
            onClick={() => onConfirm('out')}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-left transition-all hover:border-[#00BFA5] hover:bg-teal-50/50 dark:border-[#354050] dark:bg-[#252D38]/60 dark:hover:border-[#00D7BC] dark:hover:bg-[#00D7BC]/10 active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="block text-sm font-semibold text-slate-950 dark:text-[#FAFAFA]">
                Strike Out
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]">
                Batter Out
              </span>
            </div>
            <p className="text-xs font-medium text-slate-600 dark:text-[#D1D5DB] mt-1">
              Catcher caught the pitch or threw/tagged batter out at 1st base.
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#007A6A] dark:text-[#00D7BC]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>+1 Strikeout (K) · +1 Out recorded</span>
            </div>
          </button>

          {/* Rule 5.05(a)(2): batter may attempt first only with first base unoccupied or two outs. */}
          <label className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs font-semibold text-slate-700 dark:border-blue-700/50 dark:bg-blue-950/10 dark:text-[#D1D5DB]">
            <input
              type="checkbox"
              checked={eligibleToAttemptFirst}
              onChange={(event) => setEligibleToAttemptFirst(event.target.checked)}
              className="mt-0.5 accent-blue-600"
            />
            <span>Confirmed: first base is unoccupied, or there are already two outs.</span>
          </label>

          {/* Option 2: Dropped by Catcher (Batter Safe at 1st) */}
          <button
            type="button"
            onClick={() => onConfirm('droppedSafe')}
            disabled={!eligibleToAttemptFirst}
            className="w-full rounded-2xl border border-blue-300 bg-blue-50/60 p-3.5 text-left transition-all hover:border-blue-500 hover:bg-blue-100/60 dark:border-blue-600/60 dark:bg-blue-950/20 dark:hover:border-blue-500 dark:hover:bg-blue-950/30 active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="flex items-center justify-between">
              <span className="block text-sm font-semibold text-slate-950 dark:text-[#FAFAFA]">
                Dropped by Catcher
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-600 text-white">
                Safe at 1st
              </span>
            </div>
            <p className="text-xs font-medium text-slate-700 dark:text-[#D1D5DB] mt-1">
              Uncaught 3rd strike. Pitch dropped or in dirt; batter reached 1st base safely.
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>+1 Strikeout (K) · No out recorded</span>
            </div>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
};
