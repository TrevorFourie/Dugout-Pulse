/**
 * Tracks when the user last exported a backup so the app can remind them.
 * This is non-critical metadata: every read/write is wrapped so a storage failure never blocks the app.
 * It is intentionally NOT included in backup files.
 */
export const LAST_BACKUP_KEY = 'dugoutPulse.lastBackupExport.v1';
export const BACKUP_REMINDER_DAYS = 14;
export const REMINDER_SNOOZE_KEY = 'dugoutPulse.backupReminderSnoozedUntil.v1';
const DAY_MS = 24 * 60 * 60 * 1000;

export function recordBackupExported(now: Date = new Date()): void {
  try { localStorage.setItem(LAST_BACKUP_KEY, now.toISOString()); } catch { /* non-critical */ }
}

export function getLastBackupExport(): Date | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch { return null; }
}

export interface BackupStatus {
  lastExport: Date | null;
  daysSince: number | null;
  /** True when there is data worth protecting and no recent export. */
  due: boolean;
  /** True when the user dismissed the reminder recently. */
  snoozed: boolean;
}

export function getBackupStatus(hasData: boolean, now: Date = new Date()): BackupStatus {
  const lastExport = getLastBackupExport();
  const daysSince = lastExport ? Math.floor((now.getTime() - lastExport.getTime()) / DAY_MS) : null;
  let snoozed = false;
  try {
    const until = Number(localStorage.getItem(REMINDER_SNOOZE_KEY));
    snoozed = Number.isFinite(until) && until > now.getTime();
  } catch { /* non-critical */ }
  const due = hasData && (daysSince === null || daysSince >= BACKUP_REMINDER_DAYS);
  return { lastExport, daysSince, due, snoozed };
}

export function snoozeBackupReminder(days = 3, now: Date = new Date()): void {
  try { localStorage.setItem(REMINDER_SNOOZE_KEY, String(now.getTime() + days * DAY_MS)); } catch { /* non-critical */ }
}

export function describeBackupAge(status: BackupStatus): string {
  if (status.daysSince === null) return 'You have never exported a backup.';
  if (status.daysSince <= 0) return 'Last backup exported today.';
  if (status.daysSince === 1) return 'Last backup exported yesterday.';
  return `Last backup exported ${status.daysSince} days ago.`;
}
