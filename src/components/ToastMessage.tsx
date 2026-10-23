import React, { useEffect } from 'react';

interface ToastMessageProps {
  message: string | null;
  onDismiss: () => void;
  title?: string;
  durationMs?: number;
}

/**
 * Shared, non-blocking success toast. Matches the established site toast used for logo uploads and
 * opposition-team actions: top-centred card, emerald check badge, title + message, dismiss button,
 * slate/Pulse Teal tokens in light and dark mode, and an auto-dismiss (default 5s; durationMs={0} keeps it until dismissed).
 */
export const ToastMessage: React.FC<ToastMessageProps> = ({
  message,
  onDismiss,
  title = 'Done',
  durationMs = 5000,
}) => {
  useEffect(() => {
    // durationMs <= 0 means no automatic close: the user dismisses it with the × button.
    if (!message || durationMs <= 0) return;
    const timeout = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss, durationMs]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-5 z-[110] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-in fade-in slide-in-from-top-3 duration-200 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-xl dark:border-[#236B60] dark:bg-[#1A2028]"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-[#00D7BC]/15 dark:text-[#00D7BC]">✓</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">{title}</p>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-[#D1D5DB]">{message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="rounded-md px-1 text-lg leading-5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#354050]"
        >
          ×
        </button>
      </div>
    </div>
  );
};
