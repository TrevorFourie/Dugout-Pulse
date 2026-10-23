import { PENDING_LIVE_GAME_WRITE_KEY, STORAGE_KEYS } from './gameContextDefaults';
import type { Game } from '../types/baseball';
import { recordDiagnosticError } from '../utils/errorDiagnostics';

export const RECOVERY_STORAGE_KEY = 'dugoutPulse.recoverySnapshot.v1';
const PREVIOUS_RECOVERY_KEY = 'dugoutPulse.recoverySnapshot.previous.v1';
const BEFORE_RECOVERY_KEY = 'dugoutPulse.beforeRecovery.v1';
const DIAGNOSTICS_KEY = 'dugoutPulse.diagnostics.v1';
const RECOVERY_VERSION = 1;

/**
 * Read and validate the write-ahead live-game marker used by scoring actions.
 * A missing mirror while the marker is pending is ambiguous, not proof that the
 * live game was cleared; callers must stop reconciliation rather than overwrite
 * SQLite with a potentially stale snapshot.
 */
export function readPendingLiveGameFromStorage(): Game | undefined {
  const marker = localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY);
  if (marker === null) return undefined;
  // Older in-progress builds may have stored the full game in the marker.
  const raw = marker === 'pending' ? localStorage.getItem(STORAGE_KEYS.LIVE_GAME) : marker;
  if (raw === null) {
    throw new Error('A pending live-game write has no recoverable game value; SQLite reconciliation was stopped to protect scoring data.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('A pending live-game write could not be parsed; SQLite reconciliation was stopped to protect scoring data.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('A pending live-game write has an invalid shape; SQLite reconciliation was stopped to protect scoring data.');
  }
  const game = parsed as Record<string, unknown>;
  if (typeof game.id !== 'string' || game.id.length === 0 ||
      (game.date !== undefined && typeof game.date !== 'string') ||
      (game.teamName !== undefined && typeof game.teamName !== 'string') ||
      (game.innings !== undefined && typeof game.innings !== 'number') ||
      (game.plays !== undefined && !Array.isArray(game.plays))) {
    throw new Error('A pending live-game write failed validation; SQLite reconciliation was stopped to protect scoring data.');
  }
  return parsed as Game;
}

// One pre-mutation snapshot per page lifetime. Preserve the best previous snapshot
// separately so a later reload cannot replace the only useful backup with damaged state.
let snapshotTakenForPage = false;
const reportedSnapshotIssues = new Set<string>();

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

function reportSnapshotReadIssue(key: string, error: unknown): void {
  if (reportedSnapshotIssues.has(key)) return;
  reportedSnapshotIssues.add(key);
  const errorName = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  const category = error instanceof SyntaxError ? 'data_corruption' : errorName === 'SecurityError' ? 'storage_read' : 'recovery_checkpoint';
  recordDiagnosticError(
    category,
    error,
    'Local recovery snapshot ' + key + ' could not be read or validated; it was not used.',
  );
}

function readSnapshot(key: string): RecoverySnapshot | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch (error) {
    reportSnapshotReadIssue(key, error);
    return null;
  }
  if (!raw) {
    reportedSnapshotIssues.delete(key);
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    reportSnapshotReadIssue(key, error);
    return null;
  }
  if (!parsed || typeof parsed !== 'object') {
    reportSnapshotReadIssue(key, new Error('Recovery snapshot payload has an invalid structure.'));
    return null;
  }
  const candidate = parsed as Partial<RecoverySnapshot>;
  if (candidate.version !== RECOVERY_VERSION || typeof candidate.createdAt !== 'string' ||
      !candidate.values || typeof candidate.values !== 'object' || Array.isArray(candidate.values) ||
      !Object.values(candidate.values).every((value) => typeof value === 'string')) {
    reportSnapshotReadIssue(key, new Error('Recovery snapshot payload failed structural validation.'));
    return null;
  }
  reportedSnapshotIssues.delete(key);
  return candidate as RecoverySnapshot;
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
    if (prior) {
      const previousRaw = JSON.stringify(prior);
      localStorage.setItem(PREVIOUS_RECOVERY_KEY, previousRaw);
      if (localStorage.getItem(PREVIOUS_RECOVERY_KEY) !== previousRaw) {
        throw new Error('Previous recovery snapshot failed read-back verification.');
      }
    }

    const values: Record<string, string> = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || key === RECOVERY_STORAGE_KEY || key === PREVIOUS_RECOVERY_KEY ||
          key === BEFORE_RECOVERY_KEY || key === DIAGNOSTICS_KEY ||
          key === PENDING_LIVE_GAME_WRITE_KEY) continue;
      const value = localStorage.getItem(key);
      if (value !== null) values[key] = value;
    }

    const snapshot: RecoverySnapshot = {
      version: RECOVERY_VERSION,
      createdAt: new Date().toISOString(),
      reason: 'Before the first app-data write in this page session',
      values,
    };
    const serialized = JSON.stringify(snapshot);
    localStorage.setItem(RECOVERY_STORAGE_KEY, serialized);
    if (localStorage.getItem(RECOVERY_STORAGE_KEY) !== serialized) {
      throw new Error('Recovery snapshot failed read-back verification.');
    }
    snapshotTakenForPage = true;
    return true;
  } catch (error) {
    recordDiagnosticError('recovery_checkpoint', error, 'A pre-write recovery snapshot could not be created and read back successfully.');
    console.error('Could not create and verify a recovery snapshot; the requested saved-data change was blocked.', error);
    return false;
  }
}

/** Snapshot before a write; verify the write and roll back the key if it fails. */
export function protectedStorageSetItem(key: string, value: string): boolean {
  if (key !== RECOVERY_STORAGE_KEY && key !== PREVIOUS_RECOVERY_KEY && !snapshotBeforeGameWrite()) return false;
  let previousValue: string | null | undefined;
  try {
    previousValue = localStorage.getItem(key);
    localStorage.setItem(key, value);
    if (localStorage.getItem(key) !== value) {
      throw new Error('Saved value failed read-back verification.');
    }
    return true;
  } catch (error) {
    if (previousValue !== undefined) {
      try {
        if (previousValue === null) localStorage.removeItem(key);
        else localStorage.setItem(key, previousValue);
        if (localStorage.getItem(key) !== previousValue) {
          throw new Error('The previous saved value failed read-back verification during rollback.');
        }
      } catch (rollbackError) {
        recordDiagnosticError(
          'storage_write',
          rollbackError,
          'A failed storage write could not be rolled back and verified. The recovery snapshots were retained.',
        );
      }
    }
    recordDiagnosticError('storage_write', error, 'A protected storage write failed verification; the previous value was restored when possible.');
    console.error(`Could not save browser storage key "${key}" and verify its previous value.`, error);
    return false;
  }
}

/** Snapshot before a removal; verify removal and restore the key if it fails. */
export function protectedStorageRemoveItem(key: string): boolean {
  if (key !== RECOVERY_STORAGE_KEY && key !== PREVIOUS_RECOVERY_KEY && !snapshotBeforeGameWrite()) return false;
  let previousValue: string | null | undefined;
  try {
    previousValue = localStorage.getItem(key);
    localStorage.removeItem(key);
    if (localStorage.getItem(key) !== null) {
      throw new Error('Removed value is still present after the storage operation.');
    }
    return true;
  } catch (error) {
    if (previousValue !== undefined && previousValue !== null) {
      try {
        localStorage.setItem(key, previousValue);
        if (localStorage.getItem(key) !== previousValue) {
          throw new Error('The removed value failed read-back verification during rollback.');
        }
      } catch (rollbackError) {
        recordDiagnosticError(
          'storage_write',
          rollbackError,
          'A failed storage removal could not be rolled back and verified. The recovery snapshots were retained.',
        );
      }
    }
    recordDiagnosticError('storage_write', error, 'A protected storage removal failed verification; the previous value was restored when possible.');
    console.error(`Could not remove browser storage key "${key}" and verify the removal.`, error);
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

  const preservedKeys = new Set([RECOVERY_STORAGE_KEY, PREVIOUS_RECOVERY_KEY, BEFORE_RECOVERY_KEY, DIAGNOSTICS_KEY, PENDING_LIVE_GAME_WRITE_KEY]);
  const captureCurrentValues = (): Record<string, string> => {
    const values: Record<string, string> = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || preservedKeys.has(key)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) values[key] = value;
    }
    return values;
  };
  const matchesStoredValues = (expected: Record<string, string>): boolean => {
    const actual = captureCurrentValues();
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);
    return expectedKeys.length === actualKeys.length &&
      expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(actual, key) && actual[key] === expected[key]);
  };

  let currentValues: Record<string, string>;
  try {
    currentValues = captureCurrentValues();
    const beforeRecovery: RecoverySnapshot = {
      version: RECOVERY_VERSION,
      createdAt: new Date().toISOString(),
      reason: 'Before restoring recovery snapshot',
      values: currentValues,
    };
    const beforeRecoveryRaw = JSON.stringify(beforeRecovery);
    localStorage.setItem(BEFORE_RECOVERY_KEY, beforeRecoveryRaw);
    if (localStorage.getItem(BEFORE_RECOVERY_KEY) !== beforeRecoveryRaw) {
      throw new Error('The pre-restore safety copy failed read-back verification.');
    }
  } catch (error) {
    recordDiagnosticError('recovery_restore', error, 'The current saved state could not be preserved and verified before snapshot restoration; no restore was started.');
    console.error('Could not verify the pre-restore safety copy. Snapshot restoration was not started.', error);
    return false;
  }

  let restoreStarted = false;
  try {
    restoreStarted = true;
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key && !preservedKeys.has(key) && !(key in snapshot.values)) localStorage.removeItem(key);
    }
    for (const [key, value] of Object.entries(snapshot.values)) {
      if (!preservedKeys.has(key)) localStorage.setItem(key, value);
    }

    if (!matchesStoredValues(snapshot.values)) {
      throw new Error('Restored recovery snapshot failed exact read-back verification.');
    }
    snapshotTakenForPage = true;
    return true;
  } catch (error) {
    let rollbackVerified = !restoreStarted;
    if (restoreStarted) {
      try {
        for (let index = localStorage.length - 1; index >= 0; index -= 1) {
          const key = localStorage.key(index);
          if (key && !preservedKeys.has(key) && !(key in currentValues)) localStorage.removeItem(key);
        }
        for (const [key, value] of Object.entries(currentValues)) {
          if (!preservedKeys.has(key)) localStorage.setItem(key, value);
        }
        rollbackVerified = matchesStoredValues(currentValues);
        if (!rollbackVerified) throw new Error('The pre-restore state failed exact read-back verification during rollback.');
      } catch (rollbackError) {
        rollbackVerified = false;
        recordDiagnosticError('recovery_restore', rollbackError, 'Automatic rollback after a failed snapshot restore could not be verified. The pre-restore safety copy and original recovery snapshots were retained for manual recovery.');
        console.error('Snapshot restore rollback could not be verified; recovery copies were retained.', rollbackError);
      }
    }

    const detail = rollbackVerified
      ? 'Snapshot restoration failed; the original saved state was restored and verified. The pre-restore safety copy and recovery snapshots were retained.'
      : 'Snapshot restoration failed and automatic rollback could not be verified. The pre-restore safety copy and recovery snapshots were retained for manual recovery.';
    recordDiagnosticError('recovery_restore', error, detail);
    console.error(detail, error);
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
    recordDiagnosticError('data_corruption', error, 'Saved-game storage integrity could not be verified.');
    console.error('Could not verify saved-game storage integrity.', error);
    return true;
  }
  return false;
}
