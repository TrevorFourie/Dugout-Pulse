import { useEffect, useRef } from 'react';
import type { AppSettings, Game, PlayerProfile } from '../types/baseball';
import { PENDING_COMPLETED_GAME_SAVE_KEY, PENDING_LIVE_GAME_WRITE_KEY, STORAGE_KEYS } from './gameContextDefaults';
import type { OppositionTeam } from './gameContextTypes';
import { recordDiagnosticError } from '../utils/errorDiagnostics';
import { protectedStorageRemoveItem, protectedStorageSetItem, readPendingCompletedGameSaveFromStorage } from './gameStorageSafety';
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

/** A newer scoring action owns the live-game mirror while its journal is pending. */
function hasNewerPendingLiveGameWrite(expectedLiveGame: string | null): boolean {
  if (localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) === null) return false;
  return localStorage.getItem(STORAGE_KEYS.LIVE_GAME) !== expectedLiveGame;
}

/** Persists one coherent GameContext snapshot after a verified recovery checkpoint. */
export function useGamePersistence({
  isLoading, onStorageProtectionFailure, games, oppositionTeams, savedOpponents,
  savedTournaments, savedAgeGroups, savedSeasons, hiddenTournaments, hiddenAgeGroups,
  hiddenSeasons, liveGame, editingGameId, reopenedGameId, profiles, settings,
}: GamePersistenceOptions): void {
  // Effects can overlap while recovery checkpoints or SQLite writes are awaiting I/O.
  // Serialize complete snapshots so an older render cannot commit after a newer one.
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (isLoading) return;

    const persistSnapshot = async () => {
      try {
        const expectedLiveGame = liveGame === null ? null : JSON.stringify(liveGame);
        const matchesPendingCompletedSave = (pendingGame: Game) =>
          games.some((game) => game.id === pendingGame.id && JSON.stringify(game) === JSON.stringify(pendingGame)) &&
          liveGame?.id !== pendingGame.id &&
          editingGameId !== pendingGame.id &&
          reopenedGameId !== pendingGame.id;
        const shouldAbortForNewerWrite = () => {
          const pendingCompletedGame = readPendingCompletedGameSaveFromStorage();
          if (pendingCompletedGame && !matchesPendingCompletedSave(pendingCompletedGame)) return true;
          return hasNewerPendingLiveGameWrite(expectedLiveGame);
        };
        if (shouldAbortForNewerWrite()) return;

        const checkpointed = await createVerifiedRecoveryCheckpoint('Before saved application state changed');
        if (!checkpointed) {
          onStorageProtectionFailure();
          recordDiagnosticError('storage_write', new Error('Private recovery checkpoint failed; the requested storage write was blocked.'));
          return;
        }

        if (shouldAbortForNewerWrite()) return;

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

        if (shouldAbortForNewerWrite()) return;

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
          // SQLite has committed the complete state, so clear completed-save and
          // scoring journals only after the exact current snapshot is durable.
          const pendingCompletedGame = readPendingCompletedGameSaveFromStorage();
          if (pendingCompletedGame && matchesPendingCompletedSave(pendingCompletedGame)) {
            localStorage.removeItem(PENDING_COMPLETED_GAME_SAVE_KEY);
            if (localStorage.getItem(PENDING_COMPLETED_GAME_SAVE_KEY) !== null) {
              throw new Error('The completed-game journal could not be cleared after SQLite committed the matching snapshot.');
            }
          }
        }

        // A scoring action may have landed while SQLite was committing this snapshot.
        // Leave its pending journal intact and let the queued newer snapshot reconcile it.
        if (shouldAbortForNewerWrite()) return;

        if (cutoverComplete) {
          if (localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) !== null) {
            localStorage.removeItem(PENDING_LIVE_GAME_WRITE_KEY);
            if (localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) !== null) {
              throw new Error('The pending live-game journal could not be cleared after SQLite committed.');
            }
          }
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
          return;
        }

        // Before cutover, localStorage remains authoritative, so retain the journal
        // until all compatibility writes have been verified.
        if (!cutoverComplete && localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) !== null) {
          try {
            localStorage.removeItem(PENDING_LIVE_GAME_WRITE_KEY);
            if (localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) !== null) {
              throw new Error('The pending live-game journal could not be cleared after localStorage persistence.');
            }
          } catch (error) {
            onStorageProtectionFailure();
            recordDiagnosticError('storage_write_games', error, 'The live game was saved, but its pending journal could not be cleared. Saving has been paused so startup can safely reconcile it.');
          }
        }
      } catch (error) {
        onStorageProtectionFailure();
        try {
          recordDiagnosticError('storage_write', error, 'A saved-data persistence operation failed before it could be verified. Automatic storage writes were paused.');
        } catch {
          // Preserve the storage pause even if diagnostic recording is unavailable.
        }
      }
    };

    const queuedPersistence = persistenceQueue.current.then(persistSnapshot, persistSnapshot);
    persistenceQueue.current = queuedPersistence.catch(() => undefined);
  }, [
    isLoading, onStorageProtectionFailure, games, oppositionTeams, savedOpponents,
    savedTournaments, savedAgeGroups, savedSeasons, hiddenTournaments,
    hiddenAgeGroups, hiddenSeasons, liveGame, editingGameId, reopenedGameId,
    profiles, settings,
  ]);
}
