import React, { useEffect } from 'react';
import { Info } from 'lucide-react';

interface ToastMessageProps {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Shared, non-blocking status toast. Uses the app's existing slate surfaces,
 * borders, typography and Pulse Teal theme tokens in both light and dark mode.
 */
export const ToastMessage: React.FC<ToastMessageProps> = ({
  message,
  onDismiss,
  durationMs = 5000,
}) => {
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss, durationMs]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-[100] mx-auto flex w-auto max-w-md items-start gap-2.5 rounded-xl border border-slate-200 border-l-4 border-l-[#00BFA5] bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-xl dark:border-[#354050] dark:border-l-[#00D7BC] dark:bg-[#1A2028] dark:text-[#FAFAFA]"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#00806E] dark:text-[#00D7BC]" aria-hidden="true" />
      <span className="min-w-0 leading-relaxed">{message}</span>
    </div>
  );
};
