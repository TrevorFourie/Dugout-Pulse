import { useEffect, useRef } from 'react';
import type { AppSettings, Game, PlayerProfile } from '../types/baseball';
import { PENDING_COMPLETED_GAME_SAVE_KEY, PENDING_LIVE_GAME_WRITE_KEY, STORAGE_KEYS } from './gameContextDefaults';
import type { OppositionTeam } from './gameContextTypes';
import { recordDiagnosticError } from '../utils/errorDiagnostics';
import { protectedStorageRemoveItem, protectedStorageSetItem, readPendingCompletedGameSaveFromStorage } from './gameStorageSafety';
import { createVerifiedRecoveryCheckpoint } from './recoveryJournal';
import { isLegacyStorageImportComplete, readLiveSQLiteState, saveLiveSQLiteState } from '../storage/sqliteRepository';

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

/** A newer scoring action owns the live-game write-ahead journal while it is pending. */
function hasNewerPendingLiveGameWrite(expectedLiveGame: string | null): boolean {
  if (localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) === null) return false;
  return localStorage.getItem(STORAGE_KEYS.LIVE_GAME) !== expectedLiveGame;
}

/** Persist context state to SQLite after cutover; localStorage remains only for migration/recovery metadata. */
export function useGamePersistence({
  isLoading, onStorageProtectionFailure, games, oppositionTeams, savedOpponents,
  savedTournaments, savedAgeGroups, savedSeasons, hiddenTournaments, hiddenAgeGroups,
  hiddenSeasons, liveGame, editingGameId, reopenedGameId, profiles, settings,
}: GamePersistenceOptions): void {
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (isLoading) return;

    const persistSnapshot = async () => {
      try {
        const expectedLiveGame = liveGame === null ? null : JSON.stringify(liveGame);
        const matchesPendingCompletedSave = (pendingGame: Game) =>
          games.some((game) => game.id === pendingGame.id && JSON.stringify(game) === JSON.stringify(pendingGame)) &&
          (liveGame?.id !== pendingGame.id || editingGameId === pendingGame.id || reopenedGameId === pendingGame.id);
        const shouldAbortForNewerWrite = () => {
          const pendingCompletedGame = readPendingCompletedGameSaveFromStorage();
          if (pendingCompletedGame && !matchesPendingCompletedSave(pendingCompletedGame)) return true;
          return hasNewerPendingLiveGameWrite(expectedLiveGame);
        };
        if (shouldAbortForNewerWrite()) return;

        let cutoverComplete = false;
        try {
          cutoverComplete = await isLegacyStorageImportComplete();
        } catch (error) {
          if (localStorage.getItem(LOCAL_CUTOVER_MARKER) === 'complete') throw error;
        }
        if (localStorage.getItem(LOCAL_CUTOVER_MARKER) === 'complete' && !cutoverComplete) {
          throw new Error('The local and database cutover markers disagree; persistence was paused for recovery.');
        }

        if (cutoverComplete) {
          // A committed SQLite snapshot is the source of truth. Do not checkpoint or
          // rewrite application data into localStorage after cutover.
          if (shouldAbortForNewerWrite()) return;
          const persistedState = await readLiveSQLiteState();
          await saveLiveSQLiteState({
            games,
            profiles,
            settings,
            liveGame,
            editingGameId,
            reopenedGameId,
            setupCompleted: persistedState.setupCompleted,
            savedOpponents,
            savedTournaments,
            savedAgeGroups,
            savedSeasons,
            hiddenTournaments,
            hiddenAgeGroups,
            hiddenSeasons,
            oppositionTeams,
            upcomingGames: persistedState.upcomingGames,
            logoLibrary: persistedState.logoLibrary,
          }, { includeAuxiliary: true });

          const pendingCompletedGame = readPendingCompletedGameSaveFromStorage();
          if (pendingCompletedGame && matchesPendingCompletedSave(pendingCompletedGame)) {
            localStorage.removeItem(PENDING_COMPLETED_GAME_SAVE_KEY);
            if (localStorage.getItem(PENDING_COMPLETED_GAME_SAVE_KEY) !== null) {
              throw new Error('The completed-game journal could not be cleared after SQLite committed the matching snapshot.');
            }
          }
          if (shouldAbortForNewerWrite()) return;
          if (localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) !== null) {
            localStorage.removeItem(PENDING_LIVE_GAME_WRITE_KEY);
            if (localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) !== null) {
              throw new Error('The pending live-game journal could not be cleared after SQLite committed.');
            }
          }
          return;
        }

        // One-time legacy mode only: preserve the old storage behavior until the
        // validated SQLite import transaction completes. This is not the post-cutover path.
        const checkpointed = await createVerifiedRecoveryCheckpoint('Before saved application state changed during legacy migration');
        if (!checkpointed) {
          onStorageProtectionFailure();
          recordDiagnosticError('storage_write', new Error('Private recovery checkpoint failed; the requested legacy storage write was blocked.'));
          return;
        }
        if (shouldAbortForNewerWrite()) return;
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
          liveGame ? protectedStorageSetItem(STORAGE_KEYS.LIVE_GAME, JSON.stringify(liveGame)) : protectedStorageRemoveItem(STORAGE_KEYS.LIVE_GAME),
          editingGameId ? protectedStorageSetItem(STORAGE_KEYS.EDITING_GAME_ID, JSON.stringify(editingGameId)) : protectedStorageRemoveItem(STORAGE_KEYS.EDITING_GAME_ID),
          reopenedGameId ? protectedStorageSetItem(STORAGE_KEYS.REOPENED_GAME_ID, JSON.stringify(reopenedGameId)) : protectedStorageRemoveItem(STORAGE_KEYS.REOPENED_GAME_ID),
          protectedStorageSetItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles)),
          protectedStorageSetItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)),
        ];
        if (results.some((success) => !success)) {
          onStorageProtectionFailure();
          recordDiagnosticError('storage_write', new Error('One or more legacy storage writes failed verification.'));
          return;
        }
        if (localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) !== null) {
          localStorage.removeItem(PENDING_LIVE_GAME_WRITE_KEY);
          if (localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) !== null) {
            onStorageProtectionFailure();
            recordDiagnosticError('storage_write_games', new Error('The pending live-game journal could not be cleared after legacy storage persistence.'));
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
