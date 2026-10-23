import React, { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { NotificationBlockedModal } from './NotificationBlockedModal';
import { ConfirmationModal } from './ConfirmationModal';
import { recordDiagnosticError } from '../utils/errorDiagnostics';
import {
  getReminderStatus,
  openAppNotificationSettings,
  openExactAlarmSettings,
  requestGameNotificationPermission,
  runNotificationTest,
  syncStoredGameReminders,
  ReminderStatus,
  TestOutcome,
} from '../utils/gameNotifications';

const STATUS_TEXT: Record<ReminderStatus, string> = {
  ok: 'Notifications are allowed.',
  blocked: 'Android is blocking notifications for this app.',
  late: 'Allowed, but reminders may arrive late. Turn on "Alarms & reminders" for this app.',
  web: 'Reminders only work in the installed Android app.',
};

const TEST_TEXT: Record<TestOutcome, string> = {
  web: 'Test notifications only work in the installed Android app.',
  blocked: '',
  suppressed:
    'Android accepted the notification but it never appeared, so your phone is blocking it. Check any Privacy / Permissions manager for this app.',
  shown:
    'Test 1 worked. A second test arrives in 30 seconds: close the app and wait. If it only appears when you reopen the app, allow background activity / auto-launch for this app in your phone settings.',
};

export const NotificationsSettingsPanel: React.FC = () => {
  const { settings, updateSettings } = useGame();
  const enabled = settings.gameRemindersEnabled === true;

  const [status, setStatus] = useState<ReminderStatus>('ok');
  const [showBlocked, setShowBlocked] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failureAlert, setFailureAlert] = useState<string | null>(null);

  const reportReminderFailure = (error: unknown, userMessage: string) => {
    const errorName = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
    const category = error instanceof SyntaxError
      ? 'data_corruption'
      : errorName === 'SecurityError' || errorName === 'QuotaExceededError'
        ? 'storage_read'
        : 'native_failure';
    recordDiagnosticError(category, error, 'A notification reminder operation failed.');
    setFailureAlert(userMessage);
  };

  const refresh = useCallback(async () => {
    const next = await getReminderStatus();
    setStatus(next);
    if (next !== 'blocked') setShowBlocked(false); // user fixed it in system settings and came back
  }, []);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const toggle = async () => {
    setMessage(null);
    if (enabled) {
      updateSettings({ gameRemindersEnabled: false });
      await syncStoredGameReminders(false).catch((error: unknown) => {
        reportReminderFailure(error, 'Dugout Pulse could not update scheduled reminders after reminders were turned off. Review the diagnostic report before retrying.');
      });
      return;
    }
    const ok = await requestGameNotificationPermission();
    if (!ok) {
      setShowBlocked(true);
      void refresh();
      return;
    }
    updateSettings({ gameRemindersEnabled: true });
    await syncStoredGameReminders(true).catch((error: unknown) => {
      reportReminderFailure(error, 'Dugout Pulse could not schedule some reminders. Check notification settings and review the diagnostic report.');
    });
    void refresh();
  };

  const test = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const outcome = await runNotificationTest();
      if (outcome === 'blocked') setShowBlocked(true);
      else setMessage(TEST_TEXT[outcome]);
    } catch (e) {
      reportReminderFailure(e, 'Dugout Pulse could not complete the notification test. Check notification settings and review the diagnostic report.');
    } finally {
      setTesting(false);
      void refresh();
    }
  };

  const fix = () => {
    if (status === 'late') void openExactAlarmSettings();
    else void openAppNotificationSettings();
  };

  const statusColor =
    status === 'ok'
      ? 'text-teal-700 dark:text-teal-300'
      : status === 'web'
      ? 'text-slate-500 dark:text-[#9CA3AF]'
      : 'text-red-600 dark:text-[#D4626D]';

  return (
    <div className="space-y-4">
      <NotificationBlockedModal isOpen={showBlocked} onClose={() => setShowBlocked(false)} />
      <ConfirmationModal
        isOpen={failureAlert !== null}
        title="Notification operation failed"
        message={failureAlert || ''}
        confirmLabel="OK"
        showCancelButton={false}
        closeOnBackdrop={false}
        variant="warning"
        onCancel={() => setFailureAlert(null)}
        onConfirm={() => setFailureAlert(null)}
      />

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#354050] dark:bg-[#252D38]/40">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">
              <Bell className="h-4 w-4 text-[#007A6A] dark:text-[#00D7BC]" />
              Game reminders
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#9CA3AF]">
              On: every upcoming game gets a reminder. Off: only games where you tap the bell.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Remind me about all upcoming games"
            onClick={() => void toggle()}
            className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${
              enabled ? 'bg-[#00BFA5] dark:bg-[#00D7BC]' : 'bg-slate-300 dark:bg-[#354050]'
            }`}
          >
            <span
              className={`h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <p className={`mt-3 text-xs font-semibold ${statusColor}`}>{STATUS_TEXT[status]}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={testing || status === 'web'}
            onClick={() => void test()}
            className="rounded-lg bg-[#00BFA5] px-3 py-2 text-xs font-semibold text-[#18212D] hover:bg-[#00A892] disabled:opacity-50 dark:bg-[#00D7BC] dark:text-[#101419]"
          >
            {testing ? 'Testing…' : 'Send test'}
          </button>
          {(status === 'blocked' || status === 'late') && (
            <button
              type="button"
              onClick={fix}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#252D38]"
            >
              Open settings
            </button>
          )}
        </div>

        {message && (
          <p className="mt-3 text-xs leading-snug text-slate-600 dark:text-[#D1D5DB]">{message}</p>
        )}
      </div>
    </div>
  );
};
