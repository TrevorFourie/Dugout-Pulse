import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

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
type ReminderIdMap = Record<string, number>;

const readReminderIds = (): ReminderIdMap => {
  try {
    const value = localStorage.getItem(REMINDER_IDS_KEY);
    return value ? JSON.parse(value) as ReminderIdMap : {};
  } catch {
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

export interface GameNotificationDiagnostics {
  displayPermission: string;
  systemNotificationsEnabled: boolean | null;
  defaultChannelImportance: number | null;
  exactAlarmPermission: string;
  pendingReminderCount: number;
}

/** Check both the app-wide notification switch and the channel used by game reminders. */
const getEffectiveNotificationEnablement = async (): Promise<{
  enabled: boolean;
  systemNotificationsEnabled: boolean;
  defaultChannelImportance: number | null;
}> => {
  const [system, channelResult] = await Promise.all([
    LocalNotifications.areEnabled(),
    LocalNotifications.listChannels().catch(() => ({ channels: [] })),
  ]);
  const defaultChannel = channelResult.channels.find((channel) => channel.id === 'default');
  const defaultChannelImportance = defaultChannel?.importance ?? null;
  // Android IMPORTANCE_NONE is 0. A blocked default channel prevents game reminders
  // even when the app-wide notification switch is enabled.
  const channelEnabled = defaultChannelImportance === null || defaultChannelImportance > 0;
  return {
    enabled: system.value && channelEnabled,
    systemNotificationsEnabled: system.value,
    defaultChannelImportance,
  };
}

export const getGameNotificationDiagnostics = async (): Promise<GameNotificationDiagnostics> => {
  if (!Capacitor.isNativePlatform()) {
    return { displayPermission: 'not available in browser', systemNotificationsEnabled: null, defaultChannelImportance: null, exactAlarmPermission: 'not available in browser', pendingReminderCount: 0 };
  }
  const [permission, enablement, pending] = await Promise.all([
    LocalNotifications.checkPermissions(),
    getEffectiveNotificationEnablement(),
    LocalNotifications.getPending(),
  ]);
  // On Android 12 and older, checkPermissions() can report "granted"
  // even when the user has disabled all notifications for this app in Android Settings.
  // areEnabled() checks the effective system-level notification setting.
  const displayPermission = enablement.enabled ? permission.display : 'denied';
  let exactAlarmPermission = 'not applicable';
  if (Capacitor.getPlatform() === 'android') {
    try {
      exactAlarmPermission = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm;
    } catch {
      exactAlarmPermission = 'check failed';
    }
  }
  return {
    displayPermission,
    systemNotificationsEnabled: enablement.systemNotificationsEnabled,
    defaultChannelImportance: enablement.defaultChannelImportance,
    exactAlarmPermission,
    pendingReminderCount: pending.notifications.filter((item) => item.extra?.type === 'dugout-pulse-game-reminder').length,
  };
};

export const openExactAlarmSettings = async (): Promise<string> => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return 'not applicable';
  const before = await LocalNotifications.checkExactNotificationSetting();
  if (before.exact_alarm === 'granted') return 'granted';
  await LocalNotifications.changeExactNotificationSetting();
  return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm;
};

export const scheduleTestGameNotification = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) throw new Error('Test notifications are only available in the installed Android app.');
  const [permission, enablement] = await Promise.all([
    LocalNotifications.checkPermissions(),
    getEffectiveNotificationEnablement(),
  ]);
  if (permission.display !== 'granted' || !enablement.enabled) throw new Error('Android notifications are disabled for Dugout Pulse. Open Android Settings → Apps → Dugout Pulse → Notifications and allow notifications first.');
  const id = 1_999_999_999;
  try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch { /* no previous test notification */ }
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title: 'Dugout Pulse test notification',
      body: 'Notifications are reaching your phone. Game reminder scheduling can now be tested separately.',
      schedule: { at: new Date(Date.now() + 10_000), allowWhileIdle: true },
      extra: { type: 'dugout-pulse-test' },
    }],
  });
};

export const checkGameNotificationPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const [permission, enablement] = await Promise.all([
      LocalNotifications.checkPermissions(),
      getEffectiveNotificationEnablement(),
    ]);
    return permission.display === 'granted' && enablement.enabled;
  } catch {
    return false;
  }
};

export const requestGameNotificationPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    let permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') return false;
    // Runtime permission can be "granted" while the user has disabled notifications
    // globally for the app in Android Settings.
    return (await getEffectiveNotificationEnablement()).enabled;
  } catch {
    return false;
  }
};

/** Keep native reminders aligned with saved upcoming games without a background process. */
export const syncGameReminders = async (games: GameReminder[], enabled: boolean): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  const previousIds = readReminderIds();
  const nextIds: ReminderIdMap = {};
  const schedule = games.flatMap((game) => {
    // Master ON means every game is enabled unless explicitly opted out.
    // Master OFF means only games individually selected for a reminder are enabled.
    if (enabled && game.reminderOptOut) return [];
    const reminderMinutes = enabled ? (game.reminderMinutes || 60) : game.reminderMinutes;
    if (!reminderMinutes) return [];
    const at = getReminderTime({ ...game, reminderMinutes });
    if (!at) return [];
    const id = notificationIdFor(game.id);
    nextIds[game.id] = id;
    const gameDate = new Date(`${game.date}T00:00:00`);
    const weekday = gameDate.toLocaleDateString(undefined, { weekday: 'long' });
    return [{
      id,
      title: 'Upcoming game reminder',
      body: `Your team plays against ${game.opponent} on ${weekday} at ${game.time}. Remember to get ready!`,
      schedule: { at, allowWhileIdle: true },
      extra: { type: 'dugout-pulse-game-reminder', gameId: game.id },
    }];
  });

  const cancelIds = Object.values(previousIds).map((id) => ({ id }));
  if (cancelIds.length) {
    try { await LocalNotifications.cancel({ notifications: cancelIds }); } catch { /* stale IDs are harmless */ }
  }

  if (schedule.length) {
    const [permission, enablement] = await Promise.all([
      LocalNotifications.checkPermissions(),
      getEffectiveNotificationEnablement(),
    ]);
    if (permission.display !== 'granted' || !enablement.enabled) {
      localStorage.setItem(REMINDER_IDS_KEY, JSON.stringify({}));
      return;
    }
    await LocalNotifications.schedule({ notifications: schedule });
  }

  localStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(nextIds));
};

/** Resync directly from device storage, including when the Upcoming Games screen is not mounted. */
export const syncStoredGameReminders = async (enabled: boolean): Promise<void> => {
  try {
    const raw = localStorage.getItem('dugoutPulse.upcomingGames.v1');
    const games = raw ? JSON.parse(raw) as GameReminder[] : [];
    await syncGameReminders(Array.isArray(games) ? games : [], enabled);
  } catch (error) {
    throw error;
  }
};
