import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings, Game, PlayerProfile } from '../types/baseball';
import { sortGames } from '../utils/stats';
import { STORAGE_KEYS, withTeams } from './gameContextDefaults';
import type { OppositionTeam } from './gameContextTypes';
import { recordDiagnosticError } from '../utils/errorDiagnostics';
import { hasOrphanedGameReferences } from './gameStorageSafety';
import { createVerifiedRecoveryCheckpoint, ensureRecoveryBaseline } from './recoveryJournal';

type StateSetter<T> = Dispatch<SetStateAction<T>>;

interface GameRestoreOptions {
  setGames: StateSetter<Game[]>;
  setLiveGame: StateSetter<Game | null>;
  setEditingGameId: StateSetter<string | null>;
  setReopenedGameId: StateSetter<string | null>;
  setProfiles: StateSetter<PlayerProfile[]>;
  setSettings: StateSetter<AppSettings>;
  setOppositionTeams: StateSetter<OppositionTeam[]>;
  setSavedOpponents: StateSetter<string[]>;
  setSavedTournaments: StateSetter<string[]>;
  setSavedAgeGroups: StateSetter<string[]>;
  setSavedSeasons: StateSetter<string[]>;
  setHiddenTournaments: StateSetter<string[]>;
  setHiddenAgeGroups: StateSetter<string[]>;
  setHiddenSeasons: StateSetter<string[]>;
  setIsLoading: StateSetter<boolean>;
  setResumePromptPending: StateSetter<boolean>;
  setRestoreFailed: StateSetter<boolean>;
}

/**
 * Restores persisted GameContext state once on mount.
 * Resume-prompt decisions remain in the provider; this hook owns the storage read.
 */
export function useGameRestore({
  setGames,
  setLiveGame,
  setEditingGameId,
  setReopenedGameId,
  setProfiles,
  setSettings,
  setOppositionTeams,
  setSavedOpponents,
  setSavedTournaments,
  setSavedAgeGroups,
  setSavedSeasons,
  setHiddenTournaments,
  setHiddenAgeGroups,
  setHiddenSeasons,
  setIsLoading,
  setResumePromptPending,
  setRestoreFailed,
}: GameRestoreOptions): void {
  useEffect(() => {
    void (async () => {
      const recoveryReady = await ensureRecoveryBaseline();
      if (!recoveryReady) {
        setRestoreFailed(true);
        setIsLoading(false);
        recordDiagnosticError('storage_load', new Error('Private recovery baseline could not be verified; automatic persistence is paused'));
        return;
      }
    // Merge legacy records by ID instead of letting one legacy key overwrite another.
    // Current-schema records win on ID conflicts; legacy keys are never deleted.
    const migrateLegacyArrays = (
      currentKey: string,
      legacyKeys: string[],
      isValidRecord: (item: unknown) => item is { id: string },
    ): Promise<boolean> => {
      try {
        const currentRaw = localStorage.getItem(currentKey);
        const currentParsed: unknown = currentRaw ? JSON.parse(currentRaw) : [];
        if (!Array.isArray(currentParsed)) throw new Error('Current data is not an array');
        const current = currentParsed.filter(isValidRecord);
        if (currentParsed.length !== current.length) throw new Error('Current data contains invalid records');
        const merged = [...current];
        const seen = new Set(current.map((item) => item.id));
        for (const legacyKey of legacyKeys) {
          const legacyRaw = localStorage.getItem(legacyKey);
          if (!legacyRaw) continue;
          const legacyParsed: unknown = JSON.parse(legacyRaw);
          if (!Array.isArray(legacyParsed)) throw new Error('Legacy data is not an array');
          if (!legacyParsed.every(isValidRecord)) {
            // Keep malformed source intact and stop startup writes rather than silently skip it.
            throw new Error('Legacy data contains records that cannot be safely migrated');
          }
          for (const item of legacyParsed) {
            if (!seen.has(item.id)) {
              merged.push(item);
              seen.add(item.id);
            }
          }
        }
        if (merged.length === current.length) return true;
        if (!(await createVerifiedRecoveryCheckpoint('Before legacy data migration to ' + currentKey))) {
          throw new Error('A verified recovery checkpoint could not be created; migration was stopped before writing.');
        }
        const serialized = JSON.stringify(merged);
        localStorage.setItem(currentKey, serialized);
        if (localStorage.getItem(currentKey) !== serialized) throw new Error('Migration read-back verification failed');
        return true;
      } catch (error) {
        setRestoreFailed(true);
        recordDiagnosticError('storage_load', new Error('Legacy data migration could not be verified; original data was retained.'));
        console.error('Legacy migration failed; automatic persistence is paused.', error);
        return false;
      }
    };
    const isIdentifiedRecord = (item: unknown): item is { id: string } =>
      !!item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' &&
      (item as { id: string }).id.length > 0;
    const isLegacyProfile = (item: unknown): item is { id: string } =>
      isIdentifiedRecord(item) && typeof (item as { playerName?: unknown }).playerName === 'string';
    const isLegacyScheduledGame = (item: unknown): item is { id: string } =>
      isIdentifiedRecord(item) &&
      typeof (item as { opponent?: unknown }).opponent === 'string' &&
      typeof (item as { date?: unknown }).date === 'string' &&
      typeof (item as { isHome?: unknown }).isHome === 'boolean';
    const isLegacyOppositionTeam = (item: unknown): item is { id: string } =>
      isIdentifiedRecord(item) && typeof (item as { name?: unknown }).name === 'string';

    if (!(await migrateLegacyArrays(STORAGE_KEYS.GAMES, ['dugoutPulse.games.v1', 'dugoutPulse.savedGames.v1'], isIdentifiedRecord)) ||
        !(await migrateLegacyArrays(STORAGE_KEYS.PROFILES, ['dugoutPulse.profiles.v1'], isLegacyProfile))) {
      setIsLoading(false);
      return;
    }

    // Scheduled games and opposition teams still use these established keys in the
    // current UI. Validate them in place; do not rename/move their storage keys.
    // This protects the saved records from being treated as an empty list if malformed.
    for (const [key, validator] of [
      ['dugoutPulse.upcomingGames.v1', isLegacyScheduledGame],
      ['dugoutPulse.oppositionTeams.v1', isLegacyOppositionTeam],
    ] as const) {
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed) || !parsed.every(validator)) {
          throw new Error('Stored legacy records failed validation');
        }
      } catch (error) {
        setRestoreFailed(true);
        recordDiagnosticError('storage_load', new Error('Saved scheduled games or opposition teams need recovery; automatic persistence is paused.'));
        console.error(`Legacy data validation failed for ${key}; stored source was retained.`, error);
        setIsLoading(false);
        return;
      }
    }

    // Restore each key independently. A malformed game record must not abort
    // profile/settings restoration simply because it appears earlier in storage.
    const read = <T,>(key: string, apply: (parsed: T) => void, validate: (value: unknown) => value is T) => {
      const raw = localStorage.getItem(key);
      if (raw === null) return;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!validate(parsed)) {
          throw new Error(`Stored value has an unexpected format: ${key}`);
        }
        apply(parsed);
      } catch (error) {
        setRestoreFailed(true);
        recordDiagnosticError('storage_load', error);
        console.error(`Failed to restore ${key}; automatic saving is paused to protect stored data.`, error);
      }
    };

    try {
      read<unknown[]>(STORAGE_KEYS.GAMES, (parsed) => {
        if (parsed.length === 0 && hasOrphanedGameReferences()) {
          setRestoreFailed(true);
          recordDiagnosticError(
            'storage_load',
            new Error('Saved games are empty but persisted game references remain; writes paused for recovery'),
          );
          return;
        }
        setGames(sortGames(parsed as Game[], 'oldestFirst'));
      }, Array.isArray);

      read<Game>(STORAGE_KEYS.LIVE_GAME, (game) => {
        if (game && typeof game.id === 'string') {
          setLiveGame(game);
          setResumePromptPending(true);
        } else {
          throw new Error('Stored live game has no valid ID');
        }
      }, (value): value is Game => !!value && typeof value === 'object');

      read<string | null>(STORAGE_KEYS.EDITING_GAME_ID, setEditingGameId, (value): value is string | null => value === null || typeof value === 'string');
      read<string | null>(STORAGE_KEYS.REOPENED_GAME_ID, setReopenedGameId, (value): value is string | null => value === null || typeof value === 'string');

      read<PlayerProfile[]>(STORAGE_KEYS.PROFILES, (parsed) => {
        if (parsed.length > 0) setProfiles(parsed.map(withTeams));
      }, (value): value is PlayerProfile[] => Array.isArray(value) && value.every((item) => !!item && typeof item === 'object' && typeof item.id === 'string'));

      read<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, (parsed) => {
        setSettings((prev) => ({ ...prev, ...parsed }));
      }, (value): value is Partial<AppSettings> => !!value && typeof value === 'object' && !Array.isArray(value));

      read<OppositionTeam[]>('dugoutPulse.oppositionTeams.v1', setOppositionTeams, Array.isArray);
      read<string[]>(STORAGE_KEYS.SAVED_OPPONENTS, setSavedOpponents, Array.isArray);
      read<string[]>(STORAGE_KEYS.SAVED_TOURNAMENTS, setSavedTournaments, Array.isArray);
      read<string[]>(STORAGE_KEYS.SAVED_AGE_GROUPS, setSavedAgeGroups, Array.isArray);
      read<string[]>(STORAGE_KEYS.SAVED_SEASONS, setSavedSeasons, Array.isArray);
      read<string[]>(STORAGE_KEYS.HIDDEN_TOURNAMENTS, setHiddenTournaments, Array.isArray);
      read<string[]>(STORAGE_KEYS.HIDDEN_AGE_GROUPS, setHiddenAgeGroups, Array.isArray);
      read<string[]>(STORAGE_KEYS.HIDDEN_SEASONS, setHiddenSeasons, Array.isArray);
    } catch (error) {
      // Storage itself can fail (for example, browser quota/security errors).
      setRestoreFailed(true);
      recordDiagnosticError('storage_load', error);
      console.error('Storage could not be inspected safely; automatic saving is paused.', error);
    } finally {
      setIsLoading(false);
    }
    })();
  }, []);
}
