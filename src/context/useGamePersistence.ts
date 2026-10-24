import { useEffect, useRef } from 'react';
import type { AppSettings, Game, PlayerProfile } from '../types/baseball';
import { PENDING_COMPLETED_GAME_SAVE_KEY, PENDING_LIVE_GAME_WRITE_KEY, STORAGE_KEYS } from './gameContextDefaults';
import type { OppositionTeam } from './gameContextTypes';
import { recordDiagnosticError } from '../utils/errorDiagnostics';
import { readPendingCompletedGameSaveFromStorage } from './gameStorageSafety';
import { isLegacyStorageImportComplete, readSQLiteAuxiliaryState, saveLiveSQLiteState } from '../storage/sqliteRepository';

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
  setupCompleted: boolean;
}

const LOCAL_CUTOVER_MARKER = 'dugoutPulse.sqliteCutover.v1';

/** A newer scoring action owns the live-game write-ahead journal while it is pending. */
function hasNewerPendingLiveGameWrite(expectedLiveGame: string | null): boolean {
  const pending = localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY);
  if (pending === null) return false;
  // Older builds used a sentinel plus a duplicate live-game value. Continue to
  // recognize that journal shape during upgrades, but new writes carry the game.
  if (pending === 'pending') return localStorage.getItem(STORAGE_KEYS.LIVE_GAME) !== expectedLiveGame;
  return pending !== expectedLiveGame;
}

/** Persist context state to SQLite after cutover; localStorage remains only for migration/recovery metadata. */
export function useGamePersistence({
  isLoading, onStorageProtectionFailure, games, oppositionTeams, savedOpponents,
  savedTournaments, savedAgeGroups, savedSeasons, hiddenTournaments, hiddenAgeGroups,
  hiddenSeasons, liveGame, editingGameId, reopenedGameId, profiles, settings, setupCompleted,
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
          const persistedState = await readSQLiteAuxiliaryState();
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
            upcomingGames: persistedState.upcomingGames,
            logoLibrary: persistedState.logoLibrary,
          });

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

        throw new Error('SQLite is not the active storage store; application-state persistence was stopped rather than writing to localStorage.');
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
    profiles, settings, setupCompleted,
  ]);
}
