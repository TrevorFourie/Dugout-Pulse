import { Capacitor } from '@capacitor/core';
import { protectedStorageSetItem } from '../context/gameStorageSafety';
import { createVerifiedRecoveryCheckpoint } from '../context/recoveryJournal';
import { LocalNotifications } from '@capacitor/local-notifications';
import { recordDiagnosticError } from './errorDiagnostics';
import { readSQLiteUpcomingGames } from '../storage/sqliteRepository';

export interface GameReminder {
  id: string;
  opponent: string;
  date: string;
  time?: string;
  venue?: string;
  reminderMinutes?: number | null;
  reminderOptOut?: boolean;
}

const REMINDER_IDS_KEY = 'dugoutPulse.gameReminderIds.v1';
const CHANNEL_ID = 'game-reminders';
const TEST_ID_NOW = 2_100_000_001;
const TEST_ID_LATER = 2_100_000_002;

type ReminderIdMap = Record<string, number>;

const isNative = () => Capacitor.isNativePlatform();
const isAndroid = () => Capacitor.getPlatform() === 'android';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* -------------------------------------------------------------------------- */
/* Channel                                                                     */
/* -------------------------------------------------------------------------- */

let channelReady = false;
let channelSetupFailureReported = false;
let channelInspectionFailureReported = false;
let permissionCheckFailureReported = false;
let permissionRequestFailureReported = false;
let notificationSettingsFailureReported = false;
let reminderIdsReadFailureReported = false;

/**
 * We own our channel instead of relying on the plugin's implicit "default" one.
 * createChannel is a no-op for an existing channel, so the user's own channel
 * settings are preserved.
 */
const ensureChannel = async (): Promise<void> => {
  if (!isAndroid() || channelReady) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Game reminders',
      description: 'Reminders before upcoming games',
      importance: 4,
      visibility: 1,
    });
    channelReady = true;
    channelSetupFailureReported = false;
  } catch (error) {
    if (!channelSetupFailureReported) {
      recordDiagnosticError('native_failure', error, 'Android notification channel setup failed; the app will retry on the next reminder operation.');
      channelSetupFailureReported = true;
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Permission / status                                                         */
/* -------------------------------------------------------------------------- */

/** True when Android will actually let us post a notification right now. */
const isDeliverable = async (): Promise<boolean> => {
  await ensureChannel();
  const [permission, system, channels] = await Promise.all([
    LocalNotifications.checkPermissions(),
    LocalNotifications.areEnabled(),
    LocalNotifications.listChannels().then((result) => {
      channelInspectionFailureReported = false;
      return result;
    }).catch((error: unknown) => {
      if (!channelInspectionFailureReported) {
        recordDiagnosticError('native_failure', error, 'Could not inspect notification channels; delivery status may be incomplete.');
        channelInspectionFailureReported = true;
      }
      return { channels: [] as { id: string; importance: number }[] };
    }),
  ]);
  const channel = channels.channels.find((c) => c.id === CHANNEL_ID);
  const channelOk = !channel || channel.importance === undefined || channel.importance > 0; // 0 = IMPORTANCE_NONE (blocked)
  return permission.display === 'granted' && system.value && channelOk;
};

export const checkGameNotificationPermission = async (): Promise<boolean> => {
  if (!isNative()) return false;
  try {
    const result = await isDeliverable();
    permissionCheckFailureReported = false;
    return result;
  } catch (error) {
    if (!permissionCheckFailureReported) {
      recordDiagnosticError('native_failure', error, 'Could not check native notification permission or delivery status.');
      permissionCheckFailureReported = true;
    }
    return false;
  }
};

export const requestGameNotificationPermission = async (): Promise<boolean> => {
  if (!isNative()) return false;
  try {
    await ensureChannel();
    let permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') return false;
    const result = await isDeliverable();
    permissionRequestFailureReported = false;
    return result;
  } catch (error) {
    if (!permissionRequestFailureReported) {
      recordDiagnosticError('native_failure', error, 'Could not request or verify native notification permission.');
      permissionRequestFailureReported = true;
    }
    return false;
  }
};

export type ReminderStatus = 'ok' | 'blocked' | 'late' | 'web';

/**
 * ok      - notifications allowed and exact alarms available
 * blocked - Android notifications off (app switch or channel)
 * late    - allowed, but "Alarms & reminders" is off so delivery may be delayed
 * web     - not running as the installed app
 */
export const getReminderStatus = async (): Promise<ReminderStatus> => {
  if (!isNative()) return 'web';
  if (!(await checkGameNotificationPermission())) return 'blocked';
  if (isAndroid()) {
    try {
      const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
      if (exact_alarm !== 'granted') return 'late';
    } catch {
      /* older Android: nothing to check */
    }
  }
  return 'ok';
};

/* -------------------------------------------------------------------------- */
/* Opening system settings                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Opens this app's notification settings page.
 * Requires:  npm i capacitor-native-settings && npx cap sync android
 * (A plain `intent:` URL assigned to window.location does not work inside a Capacitor WebView.)
 */
export const openAppNotificationSettings = async (): Promise<boolean> => {
  if (!isAndroid()) return false;
  try {
    const { NativeSettings, AndroidSettings } = await import('capacitor-native-settings');
    try {
      await NativeSettings.openAndroid({ option: AndroidSettings.AppNotification });
    } catch {
      await NativeSettings.openAndroid({ option: AndroidSettings.ApplicationDetails });
    }
    notificationSettingsFailureReported = false;
    return true;
  } catch (error) {
    if (!notificationSettingsFailureReported) {
      recordDiagnosticError('native_failure', error, 'Could not open notification settings from Dugout Pulse.');
      notificationSettingsFailureReported = true;
    }
    return false;
  }
};

/** Opens the "Alarms & reminders" screen (Android 12+). */
export const openExactAlarmSettings = async (): Promise<void> => {
  if (!isAndroid()) return;
  try {
    await LocalNotifications.changeExactNotificationSetting();
  } catch {
    /* not supported on this Android version */
  }
};

/* -------------------------------------------------------------------------- */
/* Test                                                                        */
/* -------------------------------------------------------------------------- */

export type TestOutcome =
  | 'web'        // not the installed app
  | 'blocked'    // Android notifications are off
  | 'suppressed' // Android accepted the post but it never appeared (OEM-level block)
  | 'shown';     // appeared; a second, delayed test (30s) has been scheduled

/**
 * Two-stage test:
 *  1. Post a notification immediately, wait, and ask Android whether it is actually in the
 *     notification shade. This catches blocks that accept the post but silently drop it.
 *     (Best effort: vendor behaviour varies.)
 *  2. If that worked, schedule a second one 30s out. If it arrives on time with the app closed,
 *     background delivery works. If it only appears when the app is reopened, the phone is
 *     stopping the app from waking up (battery / auto-launch).
 */
export const runNotificationTest = async (): Promise<TestOutcome> => {
  if (!isNative()) return 'web';
  if (!(await isDeliverable())) return 'blocked';

  try {
    await LocalNotifications.cancel({ notifications: [{ id: TEST_ID_NOW }, { id: TEST_ID_LATER }] });
  } catch {
    /* nothing to cancel */
  }

  await LocalNotifications.schedule({
    notifications: [
      { id: TEST_ID_NOW, title: 'Dugout Pulse', body: 'Test 1 of 2: notifications are showing.', channelId: CHANNEL_ID },
    ],
  });
  await sleep(1500);

  const { notifications } = await LocalNotifications.getDeliveredNotifications();
  const mine = notifications.filter((n) => n.id === TEST_ID_NOW);
  if (mine.length === 0) return 'suppressed';
  try {
    await LocalNotifications.removeDeliveredNotifications({ notifications: mine });
  } catch {
    /* harmless */
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: TEST_ID_LATER,
        title: 'Dugout Pulse',
        body: 'Test 2 of 2: background delivery works.',
        channelId: CHANNEL_ID,
        schedule: { at: new Date(Date.now() + 30_000), allowWhileIdle: true },
      },
    ],
  });
  return 'shown';
};

/* -------------------------------------------------------------------------- */
/* Game reminders                                                              */
/* -------------------------------------------------------------------------- */

const readReminderIds = (): ReminderIdMap => {
  try {
    const value = localStorage.getItem(REMINDER_IDS_KEY);
    const parsed: unknown = value ? JSON.parse(value) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
        !Object.values(parsed).every((id) => typeof id === 'number')) {
      throw new SyntaxError('Saved notification reminder IDs have an invalid structure.');
    }
    reminderIdsReadFailureReported = false;
    return parsed as ReminderIdMap;
  } catch (error) {
    if (!reminderIdsReadFailureReported) {
      recordDiagnosticError(error instanceof SyntaxError ? 'data_corruption' : 'storage_read', error, 'Saved notification reminder IDs could not be read.');
      reminderIdsReadFailureReported = true;
    }
    return {};
  }
};

const getReminderTime = (game: GameReminder): Date | null => {
  if (!game.reminderMinutes || !game.time) return null;
  const startsAt = new Date(`${game.date}T${game.time}:00`);
  if (Number.isNaN(startsAt.getTime())) return null;
  const reminderAt = new Date(startsAt.getTime() - game.reminderMinutes * 60_000);
  return reminderAt.getTime() > Date.now() ? reminderAt : null;
};

const notificationIdFor = (gameId: string): number => {
  let hash = 0;
  for (let i = 0; i < gameId.length; i += 1) hash = (hash * 31 + gameId.charCodeAt(i)) | 0;
  return 1_000_000_000 + (Math.abs(hash) % 1_000_000_000);
};

/** Keep native reminders aligned with saved upcoming games without a background process. */
export const syncGameReminders = async (games: GameReminder[], enabled: boolean): Promise<void> => {
  if (!isNative()) return;
  await ensureChannel();

  const previousIds = readReminderIds();
  const nextIds: ReminderIdMap = {};

  const notifications = games.flatMap((game) => {
    // Master ON: every game is enabled unless explicitly opted out.
    // Master OFF: only games individually given a reminder are enabled.
    if (enabled && game.reminderOptOut) return [];
    const reminderMinutes = enabled ? game.reminderMinutes || 60 : game.reminderMinutes;
    if (!reminderMinutes) return [];
    const at = getReminderTime({ ...game, reminderMinutes });
    if (!at) return [];
    const id = notificationIdFor(game.id);
    nextIds[game.id] = id;
    const weekday = new Date(`${game.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
    return [
      {
        id,
        title: 'Upcoming game reminder',
        body: `Your team plays against ${game.opponent} on ${weekday} at ${game.time}. Remember to get ready!`,
        channelId: CHANNEL_ID,
        schedule: { at, allowWhileIdle: true },
        extra: { type: 'dugout-pulse-game-reminder', gameId: game.id },
      },
    ];
  });

  if (!(await createVerifiedRecoveryCheckpoint('Before synchronizing game reminders'))) {
    throw new Error('Could not create and verify a recovery checkpoint. Game reminders were not changed.');
  }

  const cancelIds = Object.values(previousIds).map((id) => ({ id }));
  if (cancelIds.length) {
    try {
      await LocalNotifications.cancel({ notifications: cancelIds });
    } catch {
      /* stale IDs are harmless */
    }
  }

  if (notifications.length) {
    if (!(await isDeliverable())) {
      if (!protectedStorageSetItem(REMINDER_IDS_KEY, JSON.stringify({}))) throw new Error('Could not protect storage before saving reminder IDs');
      return;
    }
    await LocalNotifications.schedule({ notifications });
  }

  if (!protectedStorageSetItem(REMINDER_IDS_KEY, JSON.stringify(nextIds))) throw new Error('Could not protect storage before saving reminder IDs');
};

/** Resync straight from device storage, even when the Upcoming Games screen is not mounted. */
export const syncStoredGameReminders = async (enabled: boolean): Promise<void> => {
  const games = await readSQLiteUpcomingGames();
  await syncGameReminders(games as GameReminder[], enabled);
};
