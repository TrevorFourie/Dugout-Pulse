import { useEffect } from 'react';
import type { AppSettings, Game, PlayerProfile } from '../types/baseball';
import { STORAGE_KEYS } from './gameContextDefaults';
import type { OppositionTeam } from './gameContextTypes';
import { recordDiagnosticError } from '../utils/errorDiagnostics';
import { protectedStorageRemoveItem, protectedStorageSetItem } from './gameStorageSafety';
import { createVerifiedRecoveryCheckpoint } from './recoveryJournal';

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

/** Every persisted state transition gets a verified private checkpoint before its write. */
export function useGamePersistence({
  isLoading, onStorageProtectionFailure, games, oppositionTeams, savedOpponents,
  savedTournaments, savedAgeGroups, savedSeasons, hiddenTournaments, hiddenAgeGroups,
  hiddenSeasons, liveGame, editingGameId, reopenedGameId, profiles, settings,
}: GamePersistenceOptions): void {
  const persist = (reason: string, write: () => boolean, diagnostic?: string) => {
    void (async () => {
      try {
        const checkpointed = await createVerifiedRecoveryCheckpoint(reason);
        if (!checkpointed) {
          onStorageProtectionFailure();
          recordDiagnosticError('storage_write', new Error('Private recovery checkpoint failed; the requested storage write was blocked.'));
          return;
        }
        if (!write()) {
          onStorageProtectionFailure();
          if (diagnostic) recordDiagnosticError(diagnostic, new Error('Protected storage write failed'));
        }
      } catch (error) {
        // A thrown serializer/storage error must also pause later writes; an unhandled
        // rejection alone would diagnose the problem but leave state mutations enabled.
        onStorageProtectionFailure();
        try {
          recordDiagnosticError(diagnostic || 'storage_write', error, 'A saved-data persistence operation threw before it could be verified. Automatic storage writes were paused.');
        } catch {
          // Preserve the storage pause even if diagnostic recording is unavailable.
        }
      }
    })();
  };

  useEffect(() => {
    if (isLoading) return;
    persist('Before saved games changed', () => protectedStorageSetItem(STORAGE_KEYS.GAMES, JSON.stringify(games)), 'storage_write_games');
  }, [games, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    persist('Before opposition teams changed', () => protectedStorageSetItem('dugoutPulse.oppositionTeams.v1', JSON.stringify(oppositionTeams)), 'storage_write_opposition_teams');
  }, [oppositionTeams, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    persist('Before saved opponents changed', () => protectedStorageSetItem(STORAGE_KEYS.SAVED_OPPONENTS, JSON.stringify(savedOpponents)));
  }, [savedOpponents, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    persist('Before saved tournaments changed', () => protectedStorageSetItem(STORAGE_KEYS.SAVED_TOURNAMENTS, JSON.stringify(savedTournaments)));
  }, [savedTournaments, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    persist('Before saved age groups changed', () => protectedStorageSetItem(STORAGE_KEYS.SAVED_AGE_GROUPS, JSON.stringify(savedAgeGroups)));
  }, [savedAgeGroups, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    persist('Before saved seasons changed', () => protectedStorageSetItem(STORAGE_KEYS.SAVED_SEASONS, JSON.stringify(savedSeasons)));
  }, [savedSeasons, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    persist('Before hidden presets changed', () =>
      protectedStorageSetItem(STORAGE_KEYS.HIDDEN_TOURNAMENTS, JSON.stringify(hiddenTournaments)) &&
      protectedStorageSetItem(STORAGE_KEYS.HIDDEN_AGE_GROUPS, JSON.stringify(hiddenAgeGroups)) &&
      protectedStorageSetItem(STORAGE_KEYS.HIDDEN_SEASONS, JSON.stringify(hiddenSeasons)));
  }, [hiddenTournaments, hiddenAgeGroups, hiddenSeasons, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    persist('Before live game changed', () => liveGame
      ? protectedStorageSetItem(STORAGE_KEYS.LIVE_GAME, JSON.stringify(liveGame))
      : protectedStorageRemoveItem(STORAGE_KEYS.LIVE_GAME));
  }, [liveGame, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    persist('Before editing game reference changed', () => editingGameId
      ? protectedStorageSetItem(STORAGE_KEYS.EDITING_GAME_ID, JSON.stringify(editingGameId))
      : protectedStorageRemoveItem(STORAGE_KEYS.EDITING_GAME_ID));
  }, [editingGameId, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    persist('Before reopened game reference changed', () => reopenedGameId
      ? protectedStorageSetItem(STORAGE_KEYS.REOPENED_GAME_ID, JSON.stringify(reopenedGameId))
      : protectedStorageRemoveItem(STORAGE_KEYS.REOPENED_GAME_ID));
  }, [reopenedGameId, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    persist('Before player profiles changed', () => protectedStorageSetItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles)), 'storage_write_profiles');
  }, [profiles, isLoading, onStorageProtectionFailure]);

  useEffect(() => {
    if (isLoading) return;
    persist('Before app settings changed', () => protectedStorageSetItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)));
  }, [settings, isLoading, onStorageProtectionFailure]);
}
