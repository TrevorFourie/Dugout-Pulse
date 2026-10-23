import { useEffect } from 'react';
import type { AppSettings, Game, PlayerProfile } from '../types/baseball';
import { STORAGE_KEYS } from './gameContextDefaults';
import type { OppositionTeam } from './gameContextTypes';
import { recordDiagnosticError } from '../utils/errorDiagnostics';
import { protectedStorageRemoveItem, protectedStorageSetItem } from './gameStorageSafety';
import { createVerifiedRecoveryCheckpoint } from './recoveryJournal';
import { isLegacyStorageImportComplete, saveLiveSQLiteState } from '../storage/sqliteRepository';

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

const LOCAL_CUTOVER_MARKER = 'dugoutPulse.sqliteCutover.v1';
/** Persists one coherent GameContext snapshot after a verified recovery checkpoint. */
export function useGamePersistence({
  isLoading, onStorageProtectionFailure, games, oppositionTeams, savedOpponents,
  savedTournaments, savedAgeGroups, savedSeasons, hiddenTournaments, hiddenAgeGroups,
  hiddenSeasons, liveGame, editingGameId, reopenedGameId, profiles, settings,
}: GamePersistenceOptions): void {
  useEffect(() => {
    if (isLoading) return;

    void (async () => {
      try {
        const checkpointed = await createVerifiedRecoveryCheckpoint('Before saved application state changed');
        if (!checkpointed) {
          onStorageProtectionFailure();
          recordDiagnosticError('storage_write', new Error('Private recovery checkpoint failed; the requested storage write was blocked.'));
          return;
        }

        let cutoverComplete = false;
        try {
          cutoverComplete = await isLegacyStorageImportComplete();
        } catch (error) {
          // Before cutover, SQLite is optional and localStorage remains authoritative.
          // After cutover, failure to inspect SQLite must stop writes rather than split the stores.
          if (localStorage.getItem(LOCAL_CUTOVER_MARKER) === 'complete') throw error;
        }
        if (localStorage.getItem(LOCAL_CUTOVER_MARKER) === 'complete' && !cutoverComplete) {
          throw new Error('The local and database cutover markers disagree; persistence was paused for recovery.');
        }
        if (cutoverComplete && localStorage.getItem(LOCAL_CUTOVER_MARKER) !== 'complete') {
          localStorage.setItem(LOCAL_CUTOVER_MARKER, 'complete');
          if (localStorage.getItem(LOCAL_CUTOVER_MARKER) !== 'complete') {
            throw new Error('SQLite is authoritative, but its local cutover marker could not be reconciled.');
          }
        }

        if (cutoverComplete) {
          const setupCompleted = localStorage.getItem(STORAGE_KEYS.SETUP_COMPLETED) === 'true';
          await saveLiveSQLiteState({
            games,
            profiles,
            settings,
            liveGame,
            editingGameId,
            reopenedGameId,
            setupCompleted,
            savedOpponents,
            savedTournaments,
            savedAgeGroups,
            savedSeasons,
            hiddenTournaments,
            hiddenAgeGroups,
            hiddenSeasons,
            oppositionTeams,
            // Scheduled games and logo metadata have their own serialized write paths.
            // Do not rewrite them from a potentially stale compatibility mirror here.
            upcomingGames: [],
            logoLibrary: [],
          });
        }

        // Keep the established local recovery/backup/diagnostic paths usable as a
        // compatibility mirror. SQLite commits first once the cutover is complete.
        const results = [
          protectedStorageSetItem(STORAGE_KEYS.GAMES, JSON.stringify(games)),
          protectedStorageSetItem('dugoutPulse.oppositionTeams.v1', JSON.stringify(oppositionTeams)),
          protectedStorageSetItem(STORAGE_KEYS.SAVED_OPPONENTS, JSON.stringify(savedOpponents)),
          protectedStorageSetItem(STORAGE_KEYS.SAVED_TOURNAMENTS, JSON.stringify(savedTournaments)),
          protectedStorageSetItem(STORAGE_KEYS.SAVED_AGE_GROUPS, JSON.stringify(savedAgeGroups)),
          protectedStorageSetItem(STORAGE_KEYS.SAVED_SEASONS, JSON.stringify(savedSeasons)),
          protectedStorageSetItem(STORAGE_KEYS.HIDDEN_TOURNAMENTS, JSON.stringify(hiddenTournaments)),
          protectedStorageSetItem(STORAGE_KEYS.HIDDEN_AGE_GROUPS, JSON.stringify(hiddenAgeGroups)),
          protectedStorageSetItem(STORAGE_KEYS.HIDDEN_SEASONS, JSON.stringify(hiddenSeasons)),
          liveGame
            ? protectedStorageSetItem(STORAGE_KEYS.LIVE_GAME, JSON.stringify(liveGame))
            : protectedStorageRemoveItem(STORAGE_KEYS.LIVE_GAME),
          editingGameId
            ? protectedStorageSetItem(STORAGE_KEYS.EDITING_GAME_ID, JSON.stringify(editingGameId))
            : protectedStorageRemoveItem(STORAGE_KEYS.EDITING_GAME_ID),
          reopenedGameId
            ? protectedStorageSetItem(STORAGE_KEYS.REOPENED_GAME_ID, JSON.stringify(reopenedGameId))
            : protectedStorageRemoveItem(STORAGE_KEYS.REOPENED_GAME_ID),
          protectedStorageSetItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles)),
          protectedStorageSetItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)),
        ];
        if (results.some((success) => !success)) {
          onStorageProtectionFailure();
          recordDiagnosticError('storage_write', new Error('One or more compatibility-mirror writes failed verification.'));
        }
      } catch (error) {
        onStorageProtectionFailure();
        try {
          recordDiagnosticError('storage_write', error, 'A saved-data persistence operation failed before it could be verified. Automatic storage writes were paused.');
        } catch {
          // Preserve the storage pause even if diagnostic recording is unavailable.
        }
      }
    })();
  }, [
    isLoading, onStorageProtectionFailure, games, oppositionTeams, savedOpponents,
    savedTournaments, savedAgeGroups, savedSeasons, hiddenTournaments,
    hiddenAgeGroups, hiddenSeasons, liveGame, editingGameId, reopenedGameId,
    profiles, settings,
  ]);
}
