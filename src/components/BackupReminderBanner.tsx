import React, { useState } from 'react';
import { describeBackupAge, getBackupStatus, snoozeBackupReminder } from '../utils/backupReminder';

interface BackupReminderBannerProps {
  /** True when there is saved data worth protecting. */
  hasData: boolean;
  /** Hide while the user is busy (e.g. scoring a live game). */
  suppressed?: boolean;
  onBackUp: () => void;
}

/** Gentle, dismissible reminder to export a backup. Snoozes for 3 days when dismissed. */
export const BackupReminderBanner: React.FC<BackupReminderBannerProps> = ({ hasData, suppressed, onBackUp }) => {
  const [dismissed, setDismissed] = useState(false);
  if (suppressed || dismissed) return null;
  const status = getBackupStatus(hasData);
  if (!status.due || status.snoozed) return null;
  return (
    <div
      role="status"
      className="shrink-0 flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <span className="min-w-0 leading-snug">
        {describeBackupAge(status)} Your data lives only on this phone - save a backup file outside the app.
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={onBackUp} className="rounded-md bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-700">
          Back up
        </button>
        <button
          type="button"
          onClick={() => { snoozeBackupReminder(3); setDismissed(true); }}
          className="rounded-md px-2 py-1 font-semibold hover:underline"
        >
          Later
        </button>
      </span>
    </div>
  );
};
