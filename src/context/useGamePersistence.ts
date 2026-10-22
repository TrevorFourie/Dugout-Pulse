import { useEffect } from 'react';
import type { AppSettings, Game, PlayerProfile } from '../types/baseball';
import { STORAGE_KEYS } from './gameContextDefaults';
import type { OppositionTeam } from './gameContextTypes';
import { recordDiagnosticError } from '../utils/errorDiagnostics';
import { snapshotBeforeGameWrite } from './gameStorageSafety';

interface GamePersistenceOptions {
  isLoading: boolean;
  onStorageProtectionFailure: () => void;
  games: Game[];
  oppositionTeams: OppositionTeam[];
  savedOpponents: string[];
  savedTournaments: string[];
  savedAgeGroups: string[];
  savedSeasons: string[];
  hiddenTournaments: string[];
  hiddenAgeGroups: string[];
  hiddenSeasons: string[];
  liveGame: Game | null;
  editingGameId: string | null;
  reopenedGameId: string | null;
  profiles: PlayerProfile[];
  settings: AppSettings;
}

/**
 * Keeps the GameContext's persisted state in localStorage.
 * The initial restore remains in GameContext so loading and resume-prompt
 * behavior stay coordinated; these effects only write subsequent state changes.
 */
export function useGamePersistence({
  isLoading,
  onStorageProtectionFailure,
  games,
  oppositionTeams,
  savedOpponents,
  savedTournaments,
  savedAgeGroups,
  savedSeasons,
  hiddenTournaments,
  hiddenAgeGroups,
  hiddenSeasons,
  liveGame,
  editingGameId,
  reopenedGameId,
  profiles,
  settings,
}: GamePersistenceOptions): void {
  useEffect(() => {
    if (isLoading) return;
    if (!snapshotBeforeGameWrite()) {
      onStorageProtectionFailure();
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.GAMES, JSON.stringify(games));
    } catch (error) {
      onStorageProtectionFailure();
      recordDiagnosticError('storage_write_games', error);
      console.error('Failed to persist games; automatic persistence has been paused.', error);
    }
  }, [games, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem('dugoutPulse.oppositionTeams.v1', JSON.stringify(oppositionTeams));
      } catch (error) {
        recordDiagnosticError('storage_write_opposition_teams', error);
        console.error('Failed to persist opposition teams:', error);
      }
    }
  }, [oppositionTeams, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.SAVED_OPPONENTS, JSON.stringify(savedOpponents));
    }
  }, [savedOpponents, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.SAVED_TOURNAMENTS, JSON.stringify(savedTournaments));
    }
  }, [savedTournaments, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.SAVED_AGE_GROUPS, JSON.stringify(savedAgeGroups));
    }
  }, [savedAgeGroups, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.SAVED_SEASONS, JSON.stringify(savedSeasons));
    }
  }, [savedSeasons, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.HIDDEN_TOURNAMENTS, JSON.stringify(hiddenTournaments));
      localStorage.setItem(STORAGE_KEYS.HIDDEN_AGE_GROUPS, JSON.stringify(hiddenAgeGroups));
      localStorage.setItem(STORAGE_KEYS.HIDDEN_SEASONS, JSON.stringify(hiddenSeasons));
    }
  }, [hiddenTournaments, hiddenAgeGroups, hiddenSeasons, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      if (liveGame) {
        localStorage.setItem(STORAGE_KEYS.LIVE_GAME, JSON.stringify(liveGame));
      } else {
        localStorage.removeItem(STORAGE_KEYS.LIVE_GAME);
      }
    }
  }, [liveGame, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      if (editingGameId) {
        localStorage.setItem(STORAGE_KEYS.EDITING_GAME_ID, JSON.stringify(editingGameId));
      } else {
        localStorage.removeItem(STORAGE_KEYS.EDITING_GAME_ID);
      }
    }
  }, [editingGameId, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    if (reopenedGameId) {
      localStorage.setItem(STORAGE_KEYS.REOPENED_GAME_ID, JSON.stringify(reopenedGameId));
    } else {
      localStorage.removeItem(STORAGE_KEYS.REOPENED_GAME_ID);
    }
  }, [reopenedGameId, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    // Profiles are just as important as games: snapshot the complete storage
    // before a profile write so a startup/default-profile overwrite is recoverable.
    if (!snapshotBeforeGameWrite()) {
      onStorageProtectionFailure();
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    } catch (error) {
      onStorageProtectionFailure();
      recordDiagnosticError('storage_write_profiles', error);
      console.error('Failed to persist profiles; automatic persistence has been paused.', error);
    }
  }, [profiles, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }
  }, [settings, isLoading]);
}
