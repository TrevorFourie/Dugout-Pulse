import { useEffect } from 'react';
import type { AppSettings, Game, PlayerProfile } from '../types/baseball';
import { STORAGE_KEYS } from './gameContextDefaults';
import type { OppositionTeam } from './gameContextTypes';
import { recordDiagnosticError } from '../utils/errorDiagnostics';
import { protectedStorageRemoveItem, protectedStorageSetItem } from './gameStorageSafety';

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

/** Persist state only after restore is complete and a pre-mutation snapshot exists. */
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
    if (!protectedStorageSetItem(STORAGE_KEYS.GAMES, JSON.stringify(games))) {
      onStorageProtectionFailure();
      recordDiagnosticError('storage_write_games', new Error('Protected write failed for saved games'));
    }
  }, [games, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    if (!protectedStorageSetItem('dugoutPulse.oppositionTeams.v1', JSON.stringify(oppositionTeams))) {
      onStorageProtectionFailure();
      recordDiagnosticError('storage_write_opposition_teams', new Error('Protected write failed for opposition teams'));
    }
  }, [oppositionTeams, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    if (!protectedStorageSetItem(STORAGE_KEYS.SAVED_OPPONENTS, JSON.stringify(savedOpponents))) onStorageProtectionFailure();
  }, [savedOpponents, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    if (!protectedStorageSetItem(STORAGE_KEYS.SAVED_TOURNAMENTS, JSON.stringify(savedTournaments))) onStorageProtectionFailure();
  }, [savedTournaments, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    if (!protectedStorageSetItem(STORAGE_KEYS.SAVED_AGE_GROUPS, JSON.stringify(savedAgeGroups))) onStorageProtectionFailure();
  }, [savedAgeGroups, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    if (!protectedStorageSetItem(STORAGE_KEYS.SAVED_SEASONS, JSON.stringify(savedSeasons))) onStorageProtectionFailure();
  }, [savedSeasons, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    if (!protectedStorageSetItem(STORAGE_KEYS.HIDDEN_TOURNAMENTS, JSON.stringify(hiddenTournaments))) {
      onStorageProtectionFailure();
      return;
    }
    if (!protectedStorageSetItem(STORAGE_KEYS.HIDDEN_AGE_GROUPS, JSON.stringify(hiddenAgeGroups))) {
      onStorageProtectionFailure();
      return;
    }
    if (!protectedStorageSetItem(STORAGE_KEYS.HIDDEN_SEASONS, JSON.stringify(hiddenSeasons))) onStorageProtectionFailure();
  }, [hiddenTournaments, hiddenAgeGroups, hiddenSeasons, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    const ok = liveGame
      ? protectedStorageSetItem(STORAGE_KEYS.LIVE_GAME, JSON.stringify(liveGame))
      : protectedStorageRemoveItem(STORAGE_KEYS.LIVE_GAME);
    if (!ok) onStorageProtectionFailure();
  }, [liveGame, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    const ok = editingGameId
      ? protectedStorageSetItem(STORAGE_KEYS.EDITING_GAME_ID, JSON.stringify(editingGameId))
      : protectedStorageRemoveItem(STORAGE_KEYS.EDITING_GAME_ID);
    if (!ok) onStorageProtectionFailure();
  }, [editingGameId, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    const ok = reopenedGameId
      ? protectedStorageSetItem(STORAGE_KEYS.REOPENED_GAME_ID, JSON.stringify(reopenedGameId))
      : protectedStorageRemoveItem(STORAGE_KEYS.REOPENED_GAME_ID);
    if (!ok) onStorageProtectionFailure();
  }, [reopenedGameId, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    if (!protectedStorageSetItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles))) {
      onStorageProtectionFailure();
      recordDiagnosticError('storage_write_profiles', new Error('Protected write failed for player profiles'));
    }
  }, [profiles, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    if (!protectedStorageSetItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))) onStorageProtectionFailure();
  }, [settings, isLoading, onStorageProtectionFailure]);
}
