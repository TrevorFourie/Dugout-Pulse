import { STORAGE_KEYS } from './gameContextDefaults';

const RECOVERY_KEY = 'dugoutPulse.recoverySnapshot.v1';
const RECOVERY_VERSION = 1;

interface RecoverySnapshot {
  version: number;
  createdAt: string;
  reason: string;
  values: Record<string, string>;
}

/**
 * Save a local, one-generation recovery snapshot before replacing non-empty game
 * storage. If the snapshot cannot be written, callers must not overwrite games.
 */
export function snapshotBeforeGameWrite(): boolean {
  try {
    // Snapshot the complete current storage before any game-list write, including
    // empty/new installs. Other profile/settings keys can be overwritten by the
    // same startup persistence cycle, so protection must not depend on game count.
    const values: Record<string, string> = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || key === RECOVERY_KEY) continue;
      const value = localStorage.getItem(key);
      if (value !== null) values[key] = value;
    }

    const snapshot: RecoverySnapshot = {
      version: RECOVERY_VERSION,
      createdAt: new Date().toISOString(),
      reason: 'Before replacing saved game data',
      values,
    };
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(snapshot));
    return true;
  } catch (error) {
    // Fail closed: if we cannot protect the current saved games, don't overwrite them.
    console.error('Could not create a recovery snapshot; saved games were not overwritten.', error);
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

    const gameIdPattern = /game_\d+_[a-z0-9]+/i;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || key === RECOVERY_KEY || key === 'dugoutPulse.diagnostics.v1') continue;
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
    // If storage cannot be inspected, conservatively block automatic persistence.
    console.error('Could not verify saved-game storage integrity.', error);
    return true;
  }
  return false;
}
