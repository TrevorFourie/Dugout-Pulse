import { STORAGE_KEYS } from './gameContextDefaults';

export const RECOVERY_STORAGE_KEY = 'dugoutPulse.recoverySnapshot.v1';
const PREVIOUS_RECOVERY_KEY = 'dugoutPulse.recoverySnapshot.previous.v1';
const BEFORE_RECOVERY_KEY = 'dugoutPulse.beforeRecovery.v1';
const DIAGNOSTICS_KEY = 'dugoutPulse.diagnostics.v1';
const RECOVERY_VERSION = 1;

// One pre-mutation snapshot per page lifetime. Preserve the best previous snapshot
// separately so a later reload cannot replace the only useful backup with damaged state.
let snapshotTakenForPage = false;

interface RecoverySnapshot {
  version: number;
  createdAt: string;
  reason: string;
  values: Record<string, string>;
}

export interface RecoverySnapshotInfo {
  available: boolean;
  createdAt?: string;
  gameCount: number;
  profileCount: number;
  upcomingGameCount: number;
  hasMeaningfulData: boolean;
}

function readSnapshot(key: string): RecoverySnapshot | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<RecoverySnapshot>;
    if (candidate.version !== RECOVERY_VERSION || typeof candidate.createdAt !== 'string' ||
        !candidate.values || typeof candidate.values !== 'object' || Array.isArray(candidate.values)) return null;
    if (!Object.values(candidate.values).every((value) => typeof value === 'string')) return null;
    return candidate as RecoverySnapshot;
  } catch {
    return null;
  }
}

function getSnapshotMetrics(snapshot: RecoverySnapshot) {
  let gameCount = 0;
  let profileCount = 0;
  let meaningfulProfiles = 0;
  let upcomingCount = 0;
  try {
    const games = JSON.parse(snapshot.values[STORAGE_KEYS.GAMES] || '[]');
    if (Array.isArray(games)) gameCount = games.length;
  } catch { /* malformed saved games are not counted */ }
  try {
    const profiles = JSON.parse(snapshot.values[STORAGE_KEYS.PROFILES] || '[]');
    if (Array.isArray(profiles)) {
      profileCount = profiles.length;
      meaningfulProfiles = profiles.filter((profile) => profile && typeof profile === 'object' &&
        (String(profile.playerName || '').trim() || String(profile.teamName || '').trim() ||
         (Array.isArray(profile.teams) && profile.teams.length > 0))).length;
    }
  } catch { /* malformed profiles are not counted */ }
  try {
    const upcoming = JSON.parse(snapshot.values['dugoutPulse.upcomingGames.v1'] || '[]');
    if (Array.isArray(upcoming)) upcomingCount = upcoming.length;
  } catch { /* optional */ }
  const score = gameCount * 10 + meaningfulProfiles * 20 + upcomingCount * 2 +
    (snapshot.values[STORAGE_KEYS.LIVE_GAME] ? 3 : 0);
  return { gameCount, profileCount, upcomingCount, meaningfulProfiles, score, hasMeaningfulData: score > 0 };
}

/** Select the snapshot with the most recoverable data, not merely the newest one. */
function selectRecoverySnapshot(): RecoverySnapshot | null {
  const candidates = [readSnapshot(RECOVERY_STORAGE_KEY), readSnapshot(PREVIOUS_RECOVERY_KEY)]
    .filter((value): value is RecoverySnapshot => value !== null);
  candidates.sort((a, b) => {
    const scoreDifference = getSnapshotMetrics(b).score - getSnapshotMetrics(a).score;
    return scoreDifference || b.createdAt.localeCompare(a.createdAt);
  });
  return candidates[0] || null;
}

/**
 * Capture complete app storage once before the first mutation in this page lifetime.
 * The best prior snapshot is preserved in a second slot before the current slot rotates.
 * Fail closed: callers must not mutate storage if this fails.
 */
export function snapshotBeforeGameWrite(): boolean {
  if (snapshotTakenForPage) return true;
  try {
    const prior = selectRecoverySnapshot();
    if (prior) localStorage.setItem(PREVIOUS_RECOVERY_KEY, JSON.stringify(prior));

    const values: Record<string, string> = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || key === RECOVERY_STORAGE_KEY || key === PREVIOUS_RECOVERY_KEY ||
          key === BEFORE_RECOVERY_KEY || key === DIAGNOSTICS_KEY) continue;
      const value = localStorage.getItem(key);
      if (value !== null) values[key] = value;
    }

    const snapshot: RecoverySnapshot = {
      version: RECOVERY_VERSION,
      createdAt: new Date().toISOString(),
      reason: 'Before the first app-data write in this page session',
      values,
    };
    localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(snapshot));
    snapshotTakenForPage = true;
    return true;
  } catch (error) {
    console.error('Could not create a recovery snapshot; saved data was not changed.', error);
    return false;
  }
}

/** Snapshot before a write; refuse the write if the snapshot cannot be created. */
export function protectedStorageSetItem(key: string, value: string): boolean {
  if (key !== RECOVERY_STORAGE_KEY && key !== PREVIOUS_RECOVERY_KEY && !snapshotBeforeGameWrite()) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Could not save browser storage key "${key}".`, error);
    return false;
  }
}

/** Snapshot before a removal; refuse the removal if the snapshot cannot be created. */
export function protectedStorageRemoveItem(key: string): boolean {
  if (key !== RECOVERY_STORAGE_KEY && key !== PREVIOUS_RECOVERY_KEY && !snapshotBeforeGameWrite()) return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Could not remove browser storage key "${key}".`, error);
    return false;
  }
}

/** Summarize the best available snapshot without exposing its stored contents. */
export function getRecoverySnapshotInfo(): RecoverySnapshotInfo {
  const snapshot = selectRecoverySnapshot();
  if (!snapshot) return { available: false, gameCount: 0, profileCount: 0, upcomingGameCount: 0, hasMeaningfulData: false };
  const metrics = getSnapshotMetrics(snapshot);
  return {
    available: true,
    createdAt: snapshot.createdAt,
    gameCount: metrics.gameCount,
    profileCount: metrics.meaningfulProfiles,
    upcomingGameCount: metrics.upcomingCount,
    hasMeaningfulData: metrics.hasMeaningfulData,
  };
}

/**
 * Restore the best local snapshot only after explicit user action. Keep a copy of
 * the current state before restoring, and retain both snapshots for verification.
 */
export function restoreRecoverySnapshot(): boolean {
  const snapshot = selectRecoverySnapshot();
  if (!snapshot) return false;
  try {
    const currentValues: Record<string, string> = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || [RECOVERY_STORAGE_KEY, PREVIOUS_RECOVERY_KEY, BEFORE_RECOVERY_KEY, DIAGNOSTICS_KEY].includes(key)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) currentValues[key] = value;
    }
    localStorage.setItem(BEFORE_RECOVERY_KEY, JSON.stringify({
      version: RECOVERY_VERSION,
      createdAt: new Date().toISOString(),
      reason: 'Before restoring recovery snapshot',
      values: currentValues,
    } satisfies RecoverySnapshot));

    const preservedKeys = new Set([RECOVERY_STORAGE_KEY, PREVIOUS_RECOVERY_KEY, BEFORE_RECOVERY_KEY, DIAGNOSTICS_KEY]);
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key && !preservedKeys.has(key) && !(key in snapshot.values)) localStorage.removeItem(key);
    }
    for (const [key, value] of Object.entries(snapshot.values)) {
      if (preservedKeys.has(key)) continue;
      localStorage.setItem(key, value);
    }
    snapshotTakenForPage = true;
    return true;
  } catch (error) {
    console.error('Recovery snapshot could not be fully restored. The recovery copies were retained.', error);
    return false;
  }
}

/**
 * An empty game array is valid for a new user, but suspicious if other persisted
 * app state still refers to saved game IDs. In that case, stop automatic writes
 * so a failed restore cannot turn a partial/default state into permanent data loss.
 */
export function hasOrphanedGameReferences(): boolean {
  try {
    // A missing current-schema key is not proof of a new installation. Earlier app
    // versions stored scheduled games and other user data under dugoutPulse.* keys.
    // If that legacy data exists, pause writes rather than persisting empty defaults.
    const currentGamesRaw = localStorage.getItem(STORAGE_KEYS.GAMES);
    const legacyDataKeys = [
      'dugoutPulse.games.v1',
      'dugoutPulse.savedGames.v1',
      'dugoutPulse.upcomingGames.v1',
      'dugoutPulse.profiles.v1',
      'dugoutPulse.oppositionTeams.v1',
    ];
    const currentProfilesRaw = localStorage.getItem(STORAGE_KEYS.PROFILES);
    const currentGamesAreEmpty = !currentGamesRaw || (() => {
      try { const value: unknown = JSON.parse(currentGamesRaw); return Array.isArray(value) && value.length === 0; }
      catch { return true; }
    })();
    const currentProfilesAreEmpty = !currentProfilesRaw || (() => {
      try { const value: unknown = JSON.parse(currentProfilesRaw); return Array.isArray(value) && value.length === 0; }
      catch { return true; }
    })();
    if (currentGamesAreEmpty || currentProfilesAreEmpty) {
      for (const key of legacyDataKeys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const value: unknown = JSON.parse(raw);
          if (Array.isArray(value) && value.length > 0) return true;
          if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0) return true;
        } catch {
          // Malformed legacy data is still evidence of user state; do not overwrite it.
          return true;
        }
      }
    }

    const gamesRaw = currentGamesRaw;
    if (gamesRaw) {
      const parsed: unknown = JSON.parse(gamesRaw);
      if (Array.isArray(parsed) && parsed.length > 0) return false;
    }

    const gameIdPattern = /game_\d+_[a-z0-9]+/i;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || [RECOVERY_STORAGE_KEY, PREVIOUS_RECOVERY_KEY, BEFORE_RECOVERY_KEY, DIAGNOSTICS_KEY].includes(key)) continue;
      if (
        key === STORAGE_KEYS.GAMES ||
        key === STORAGE_KEYS.LIVE_GAME ||
        key === STORAGE_KEYS.EDITING_GAME_ID ||
        key === STORAGE_KEYS.REOPENED_GAME_ID
      ) continue;

      const value = localStorage.getItem(key);
      if (value && gameIdPattern.test(value)) return true;
    }
  } catch (error) {
    console.error('Could not verify saved-game storage integrity.', error);
    return true;
  }
  return false;
}
