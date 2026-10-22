import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings, Game, PlayerProfile } from '../types/baseball';
import { STORAGE_KEYS, withTeams } from './gameContextDefaults';
import type { OppositionTeam } from './gameContextTypes';
import { recordDiagnosticError } from '../utils/errorDiagnostics';

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
}: GameRestoreOptions): void {
  useEffect(() => {
    try {
      const storedGames = localStorage.getItem(STORAGE_KEYS.GAMES);
      if (storedGames) {
        const parsed = JSON.parse(storedGames);
        if (Array.isArray(parsed)) {
          setGames(sortGames(parsed, 'oldestFirst'));
        }
      }

      const storedLiveGame = localStorage.getItem(STORAGE_KEYS.LIVE_GAME);
      if (storedLiveGame) {
        const restoredGame = JSON.parse(storedLiveGame) as Game;
        if (restoredGame && typeof restoredGame.id === 'string') {
          setLiveGame(restoredGame);
          setResumePromptPending(true);
        }
      }

      const storedEditingId = localStorage.getItem(STORAGE_KEYS.EDITING_GAME_ID);
      if (storedEditingId) {
        setEditingGameId(JSON.parse(storedEditingId));
      }
      const storedReopenedId = localStorage.getItem(STORAGE_KEYS.REOPENED_GAME_ID);
      if (storedReopenedId) {
        setReopenedGameId(JSON.parse(storedReopenedId));
      }

      const storedProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (storedProfiles) {
        const parsed = JSON.parse(storedProfiles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProfiles(parsed.map(withTeams));
        }
      }

      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (storedSettings) {
        setSettings((prev) => ({ ...prev, ...JSON.parse(storedSettings) }));
      }

      const storedOppositionTeams = localStorage.getItem('dugoutPulse.oppositionTeams.v1');
      if (storedOppositionTeams) {
        const parsed = JSON.parse(storedOppositionTeams);
        if (Array.isArray(parsed)) setOppositionTeams(parsed);
      }

      const storedOpponents = localStorage.getItem(STORAGE_KEYS.SAVED_OPPONENTS);
      if (storedOpponents) {
        const parsed = JSON.parse(storedOpponents);
        if (Array.isArray(parsed)) {
          setSavedOpponents(parsed);
        }
      }

      const storedTournaments = localStorage.getItem(STORAGE_KEYS.SAVED_TOURNAMENTS);
      if (storedTournaments) {
        const parsed = JSON.parse(storedTournaments);
        if (Array.isArray(parsed)) {
          setSavedTournaments(parsed);
        }
      }

      const storedAgeGroups = localStorage.getItem(STORAGE_KEYS.SAVED_AGE_GROUPS);
      if (storedAgeGroups) {
        const parsed = JSON.parse(storedAgeGroups);
        if (Array.isArray(parsed)) {
          setSavedAgeGroups(parsed);
        }
      }

      const storedSeasons = localStorage.getItem(STORAGE_KEYS.SAVED_SEASONS);
      if (storedSeasons) {
        const parsed = JSON.parse(storedSeasons);
        if (Array.isArray(parsed)) {
          setSavedSeasons(parsed);
        }
      }

      const loadList = (key: string, setter: (v: string[]) => void) => {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setter(parsed);
        }
      };
      loadList(STORAGE_KEYS.HIDDEN_TOURNAMENTS, setHiddenTournaments);
      loadList(STORAGE_KEYS.HIDDEN_AGE_GROUPS, setHiddenAgeGroups);
      loadList(STORAGE_KEYS.HIDDEN_SEASONS, setHiddenSeasons);
    } catch (err) {
      recordDiagnosticError('storage_load', err);
      console.error('Failed to load data from localStorage:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);
}
