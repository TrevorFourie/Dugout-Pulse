import { STORAGE_KEYS } from './gameContextDefaults';

export const RECOVERY_STORAGE_KEY = 'dugoutPulse.recoverySnapshot.v1';
const RECOVERY_VERSION = 1;

// One snapshot per page lifetime: startup persistence effects must not overwrite
// the pre-write snapshot with a partially updated state later in the same effect cycle.
let snapshotTakenForPage = false;

interface RecoverySnapshot {
  version: number;
  createdAt: string;
  reason: string;
  values: Record<string, string>;
}

/**
 * Capture the complete current localStorage once before the first app-data mutation
 * in this page lifetime. Fail closed: callers must not mutate storage if this fails.
 */
export function snapshotBeforeGameWrite(): boolean {
  if (snapshotTakenForPage) return true;
  try {
    const values: Record<string, string> = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || key === RECOVERY_STORAGE_KEY) continue;
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
  if (key !== RECOVERY_STORAGE_KEY && !snapshotBeforeGameWrite()) return false;
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
  if (key !== RECOVERY_STORAGE_KEY && !snapshotBeforeGameWrite()) return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Could not remove browser storage key "${key}".`, error);
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
    const gamesRaw = localStorage.getItem(STORAGE_KEYS.GAMES);
    if (gamesRaw) {
      const parsed: unknown = JSON.parse(gamesRaw);
      if (Array.isArray(parsed) && parsed.length > 0) return false;
    }

    const gameIdPattern = /game_\\d+_[a-z0-9]+/i;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || key === RECOVERY_STORAGE_KEY || key === 'dugoutPulse.diagnostics.v1') continue;
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
