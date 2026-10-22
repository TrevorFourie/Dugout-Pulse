import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings, Game, PlayerProfile } from '../types/baseball';
import { sortGames } from '../utils/stats';
import { STORAGE_KEYS, withTeams } from './gameContextDefaults';
import type { OppositionTeam } from './gameContextTypes';
import { recordDiagnosticError } from '../utils/errorDiagnostics';
import { hasOrphanedGameReferences } from './gameStorageSafety';
import { ensureRecoveryBaseline } from './recoveryJournal';

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
    // Preserve legacy source keys; only copy valid records into an empty current-schema key.
    const migrateLegacy = (legacyKey: string, currentKey: string): boolean => {
      try {
        const currentRaw = localStorage.getItem(currentKey);
        if (currentRaw) {
          const current = JSON.parse(currentRaw) as unknown;
          if (!Array.isArray(current) || current.length > 0) return true;
        }
        const legacyRaw = localStorage.getItem(legacyKey);
        if (!legacyRaw) return true;
        const legacy = JSON.parse(legacyRaw) as unknown;
        if (!Array.isArray(legacy) || legacy.length === 0 ||
            !legacy.every((item) => !!item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string')) return true;
        const serialized = JSON.stringify(legacy);
        localStorage.setItem(currentKey, serialized);
        if (localStorage.getItem(currentKey) !== serialized) throw new Error('Migration verification failed');
        return true;
      } catch (error) {
        setRestoreFailed(true);
        recordDiagnosticError('storage_load', new Error('Legacy data migration failed; original data was retained.'));
        console.error('Legacy migration failed; automatic persistence is paused.', error);
        return false;
      }
    };
    if (!migrateLegacy('dugoutPulse.games.v1', STORAGE_KEYS.GAMES) ||
        !migrateLegacy('dugoutPulse.savedGames.v1', STORAGE_KEYS.GAMES) ||
        !migrateLegacy('dugoutPulse.profiles.v1', STORAGE_KEYS.PROFILES)) {
      setIsLoading(false);
      return;
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
