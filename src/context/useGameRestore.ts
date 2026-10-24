import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings, Game, PlayerProfile } from '../types/baseball';
import { sortGames } from '../utils/stats';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, PENDING_COMPLETED_GAME_SAVE_KEY, PENDING_LIVE_GAME_WRITE_KEY, STORAGE_KEYS, withTeams } from './gameContextDefaults';
import type { OppositionTeam } from './gameContextTypes';
import { recordDiagnosticError } from '../utils/errorDiagnostics';
import { hasOrphanedGameReferences, protectedStorageRemoveItem, protectedStorageSetItem, readPendingCompletedGameSaveFromStorage, readPendingLiveGameFromStorage } from './gameStorageSafety';
import { createVerifiedRecoveryCheckpoint, ensureRecoveryBaseline } from './recoveryJournal';
import { importLegacyStorageSnapshot, isLegacyStorageImportComplete, readLiveSQLiteState, readVerifiedSQLiteSnapshot, saveLiveSQLiteState, type SQLiteLiveState } from '../storage/sqliteRepository';
import { setTeamLogoLibraryCache } from '../utils/teamLogoLibrary';

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
  setIsFirstTimeUser: StateSetter<boolean>;
  setSetupCompleted: StateSetter<boolean>;
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
  setIsFirstTimeUser,
  setSetupCompleted,
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

      const LOCAL_CUTOVER_MARKER = 'dugoutPulse.sqliteCutover.v1';
      const LEGACY_APP_DATA_KEYS = new Set<string>([
        ...Object.values(STORAGE_KEYS),
        'dugoutPulse.games.v1',
        'dugoutPulse.savedGames.v1',
        'dugoutPulse.profiles.v1',
        'dugoutPulse.upcomingGames.v1',
        'dugoutPulse.oppositionTeams.v1',
        'dugoutPulse.logoLibrary.v1',
      ]);
      const clearLegacyAppDataMirrors = () => {
        // The validated source snapshot remains preserved in SQLite's legacy_values
        // table. Remove only known application-data copies; keep journals,
        // diagnostics, recovery points, cutover metadata and reminder metadata.
        for (const key of LEGACY_APP_DATA_KEYS) {
          localStorage.removeItem(key);
          if (localStorage.getItem(key) !== null) {
            throw new Error('A legacy application-data copy could not be removed after SQLite cutover.');
          }
        }
      };
      const clearPendingLiveGame = () => {
        localStorage.removeItem(PENDING_LIVE_GAME_WRITE_KEY);
        if (localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) !== null) {
          throw new Error('The pending live-game write could not be cleared after SQLite persistence.');
        }
      };
      const reconcilePendingLiveGame = async (state: SQLiteLiveState): Promise<SQLiteLiveState> => {
        const pendingGame = readPendingLiveGameFromStorage();
        if (!pendingGame) {
          if (localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) !== null) clearPendingLiveGame();
          return state;
        }
        if (!(await createVerifiedRecoveryCheckpoint('Before reconciling a pending live-game write to SQLite'))) {
          throw new Error('A recovery checkpoint could not be verified before reconciling the pending live-game write.');
        }
        const savedGameWithSameId = state.games.some((game) => game.id === pendingGame.id);
        const reconciled: SQLiteLiveState = {
          ...state,
          liveGame: pendingGame,
          ...(savedGameWithSameId && !state.editingGameId && !state.reopenedGameId
            ? { editingGameId: pendingGame.id }
            : {}),
        };
        await saveLiveSQLiteState(reconciled);
        clearPendingLiveGame();
        return reconciled;
      };
      const clearPendingCompletedGameSave = () => {
        localStorage.removeItem(PENDING_COMPLETED_GAME_SAVE_KEY);
        if (localStorage.getItem(PENDING_COMPLETED_GAME_SAVE_KEY) !== null) {
          throw new Error('The pending completed-game save could not be cleared after SQLite persistence.');
        }
      };
      const reconcilePendingCompletedGameSave = async (state: SQLiteLiveState): Promise<SQLiteLiveState> => {
        const completedGame = readPendingCompletedGameSaveFromStorage();
        if (!completedGame) return state;
        if (!(await createVerifiedRecoveryCheckpoint('Before reconciling a pending completed-game save to SQLite'))) {
          throw new Error('A recovery checkpoint could not be verified before reconciling the pending completed-game save.');
        }

        // The write-ahead marker records the user's explicit save intent. Upsert by
        // ID so recovery is safe whether the original transaction committed or not.
        const games = sortGames(
          [...state.games.filter((game) => game.id !== completedGame.id), completedGame],
          'oldestFirst',
        );
        const reconciled: SQLiteLiveState = {
          ...state,
          games,
          liveGame: state.liveGame?.id === completedGame.id ? null : state.liveGame,
          editingGameId: state.editingGameId === completedGame.id ? null : state.editingGameId,
          reopenedGameId: state.reopenedGameId === completedGame.id ? null : state.reopenedGameId,
        };
        await saveLiveSQLiteState(reconciled);

        // Clear an older live-game journal for this same game first. If the page
        // closes before the completed-save marker is cleared, startup can safely
        // repeat this idempotent reconciliation.
        const pendingLiveGame = readPendingLiveGameFromStorage();
        if (pendingLiveGame?.id === completedGame.id) {
          const comparable = (game: Game) => JSON.stringify(
            Object.fromEntries(Object.entries(game).filter(([key]) => key !== 'finalResult' && key !== 'innings')),
          );
          // If the pending live game contains later edits, preserve it for the next
          // reconciliation pass. Only the pre-save scoring snapshot is superseded.
          if (comparable(pendingLiveGame) === comparable(completedGame)) clearPendingLiveGame();
        }
        clearPendingCompletedGameSave();
        return reconciled;
      };
      const isMeaningfullyConfigured = (profiles: PlayerProfile[], setupCompleted: boolean) => {
        const first = profiles[0];
        return setupCompleted || Boolean(
          first?.playerName?.trim() &&
          (first?.teamName?.trim() || (first?.teams && first.teams.length > 0))
        );
      };
      const applyLiveState = (state: SQLiteLiveState) => {
        setTeamLogoLibraryCache(state.logoLibrary);
        setGames(sortGames(state.games, 'oldestFirst'));
        setProfiles(state.profiles.length > 0 ? state.profiles.map(withTeams) : [DEFAULT_PROFILE]);
        setSettings((previous) => ({ ...DEFAULT_SETTINGS, ...previous, ...state.settings }));
        setLiveGame(state.liveGame);
        if (state.liveGame) setResumePromptPending(true);
        setEditingGameId(state.editingGameId);
        setReopenedGameId(state.reopenedGameId);
        setOppositionTeams(state.oppositionTeams);
        setSavedOpponents(state.savedOpponents);
        setSavedTournaments(state.savedTournaments);
        setSavedAgeGroups(state.savedAgeGroups);
        setSavedSeasons(state.savedSeasons);
        setHiddenTournaments(state.hiddenTournaments);
        setHiddenAgeGroups(state.hiddenAgeGroups);
        setHiddenSeasons(state.hiddenSeasons);
        setSetupCompleted(state.setupCompleted);
        setIsFirstTimeUser(!isMeaningfullyConfigured(state.profiles, state.setupCompleted));
      };
      const mirrorLiveState = async (_state: SQLiteLiveState) => {
        // This marker records cutover status only. Application data is no longer
        // copied from SQLite into localStorage; SQLite is authoritative after cutover.
        localStorage.setItem(LOCAL_CUTOVER_MARKER, 'complete');
        if (localStorage.getItem(LOCAL_CUTOVER_MARKER) !== 'complete') {
          throw new Error('The local SQLite cutover marker could not be reconciled.');
        }
        clearLegacyAppDataMirrors();
      };
      const makeInitialLiveState = (snapshot: Awaited<ReturnType<typeof readVerifiedSQLiteSnapshot>>): SQLiteLiveState => {
        const appState = snapshot.appState;
        return {
          games: sortGames(snapshot.games, 'oldestFirst'),
          profiles: snapshot.profiles.length > 0 ? snapshot.profiles.map(withTeams) : [DEFAULT_PROFILE],
          settings: { ...DEFAULT_SETTINGS, ...(snapshot.settings || {}) } as AppSettings,
          liveGame: snapshot.liveGame,
          editingGameId: typeof appState[STORAGE_KEYS.EDITING_GAME_ID] === 'string' ? appState[STORAGE_KEYS.EDITING_GAME_ID] as string : null,
          reopenedGameId: typeof appState[STORAGE_KEYS.REOPENED_GAME_ID] === 'string' ? appState[STORAGE_KEYS.REOPENED_GAME_ID] as string : null,
          setupCompleted: appState[STORAGE_KEYS.SETUP_COMPLETED] === true,
          savedOpponents: snapshot.namedLists[STORAGE_KEYS.SAVED_OPPONENTS] || [],
          savedTournaments: snapshot.namedLists[STORAGE_KEYS.SAVED_TOURNAMENTS] || [],
          savedAgeGroups: snapshot.namedLists[STORAGE_KEYS.SAVED_AGE_GROUPS] || [],
          savedSeasons: snapshot.namedLists[STORAGE_KEYS.SAVED_SEASONS] || [],
          hiddenTournaments: snapshot.namedLists[STORAGE_KEYS.HIDDEN_TOURNAMENTS] || [],
          hiddenAgeGroups: snapshot.namedLists[STORAGE_KEYS.HIDDEN_AGE_GROUPS] || [],
          hiddenSeasons: snapshot.namedLists[STORAGE_KEYS.HIDDEN_SEASONS] || [],
          oppositionTeams: snapshot.oppositionTeams,
          upcomingGames: snapshot.upcomingGames as SQLiteLiveState['upcomingGames'],
          logoLibrary: snapshot.logoLibrary,
        };
      };

      let cutoverComplete = false;
      try {
        cutoverComplete = await isLegacyStorageImportComplete();
      } catch (error) {
        const localMarker = localStorage.getItem(LOCAL_CUTOVER_MARKER);
        if (localMarker === 'complete' || localMarker === 'pending') {
          setRestoreFailed(true);
          setIsLoading(false);
          recordDiagnosticError('storage_load', error, 'SQLite cutover state could not be inspected; saved-data restoration was stopped to protect the newer store.');
          return;
        }
        // Before cutover, a SQLite initialisation failure must not prevent the existing
        // localStorage-based app from starting.
      }

      let localCutoverMarker = localStorage.getItem(LOCAL_CUTOVER_MARKER);
      if (localCutoverMarker === 'pending' && !cutoverComplete) {
        // An interrupted attempt can return to localStorage only after removing the
        // pending flag and proving that the original source still matches its snapshot.
        try {
          localStorage.removeItem(LOCAL_CUTOVER_MARKER);
          if (localStorage.getItem(LOCAL_CUTOVER_MARKER) !== null) {
            throw new Error('The uncommitted SQLite cutover marker could not be cleared.');
          }
          await readVerifiedSQLiteSnapshot();
          localCutoverMarker = null;
        } catch (error) {
          setRestoreFailed(true);
          setIsLoading(false);
          recordDiagnosticError('storage_load', error, 'An interrupted SQLite cutover could not be reconciled against the original saved data; automatic saving is paused.');
          console.error('Interrupted SQLite cutover could not be safely reconciled.', error);
          return;
        }
      }
      if (cutoverComplete || localCutoverMarker === 'complete' || localCutoverMarker === 'pending') {
        try {
          if (!cutoverComplete) {
            throw new Error('The local cutover marker exists, but SQLite does not confirm a completed cutover.');
          }
          const savedState = await readLiveSQLiteState();
          const completedSaveReconciled = await reconcilePendingCompletedGameSave(savedState);
          const state = await reconcilePendingLiveGame(completedSaveReconciled);
          await mirrorLiveState(state);
          applyLiveState(state);
          setIsLoading(false);
          return;
        } catch (error) {
          setRestoreFailed(true);
          setIsLoading(false);
          recordDiagnosticError('storage_load', error, 'The SQLite live state could not be restored and verified; automatic saving is paused to protect saved data.');
          console.error('SQLite live-state restoration failed; automatic saving is paused.', error);
          return;
        }
      }

    // Merge legacy records by ID instead of letting one legacy key overwrite another.
    // Current-schema records win on ID conflicts; legacy keys are never deleted.
    const migrateLegacyArrays = async (
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
      ((item as { isHome?: unknown }).isHome === undefined || typeof (item as { isHome?: unknown }).isHome === 'boolean');
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

    // Create and verify the source snapshot only after established legacy-array merges
    // have completed. Until the database transaction commits its cutover marker,
    // localStorage remains authoritative and the existing restore path remains available.
    try {
      await importLegacyStorageSnapshot();
      const snapshot = await readVerifiedSQLiteSnapshot();
      const initialState = makeInitialLiveState(snapshot);
      const pendingLiveGame = readPendingLiveGameFromStorage();
      if (pendingLiveGame) initialState.liveGame = pendingLiveGame;
      if (!(await createVerifiedRecoveryCheckpoint('Before switching saved application state to SQLite'))) {
        throw new Error('A verified recovery checkpoint could not be created before switching storage.');
      }
      await saveLiveSQLiteState(initialState, { completeCutover: true });
      if (localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) !== null) clearPendingLiveGame();
      await mirrorLiveState(initialState);
      applyLiveState(initialState);
      setIsLoading(false);
      return;
    } catch (error) {
      let databaseCutoverComplete = false;
      try {
        databaseCutoverComplete = await isLegacyStorageImportComplete();
      } catch {
        // An unreadable database status is not evidence that cutover did not commit.
      }
      const localMarker = localStorage.getItem(LOCAL_CUTOVER_MARKER);
      if (databaseCutoverComplete) {
        // A competing startup or a failed final marker mirror may have committed
        // the database transaction. Read that authoritative snapshot and reconcile
        // it instead of leaving the app blocked unnecessarily.
        try {
          const committedSnapshot = await readLiveSQLiteState();
          const completedReconciled = await reconcilePendingCompletedGameSave(committedSnapshot);
          const committedState = await reconcilePendingLiveGame(completedReconciled);
          await mirrorLiveState(committedState);
          applyLiveState(committedState);
          setIsLoading(false);
          return;
        } catch (reconcileError) {
          setRestoreFailed(true);
          setIsLoading(false);
          recordDiagnosticError('storage_load', reconcileError, 'SQLite cutover committed, but the live state could not be reconciled safely. Automatic saving is paused.');
          console.error('Committed SQLite cutover could not be reconciled.', reconcileError);
          return;
        }
      }
      if (localMarker === 'complete' || localMarker === 'pending') {
        setRestoreFailed(true);
        setIsLoading(false);
        recordDiagnosticError('storage_load', error, 'SQLite cutover or startup reconciliation could not be verified; automatic saving is paused to protect saved data.');
        console.error('SQLite cutover requires recovery; automatic saving is paused.', error);
        return;
      }
      // Cutover did not commit and the pending marker was cleared. Continue the
      // existing localStorage restore path rather than blocking the app unnecessarily.
      recordDiagnosticError('storage_load', error, 'SQLite cutover did not complete; the app is continuing with its original localStorage state.');
    }

    // If SQLite is unavailable or cutover did not commit, localStorage remains
    // authoritative. Replay a pending scoring journal into that store before hydration.
    try {
      const hasPendingLiveGameMarker = localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) !== null;
      const pendingGame = readPendingLiveGameFromStorage();
      if (pendingGame) {
        if (!(await createVerifiedRecoveryCheckpoint('Before restoring a pending live-game write to local storage'))) {
          throw new Error('A recovery checkpoint could not be verified before restoring the pending live-game write.');
        }
        const serialized = JSON.stringify(pendingGame);
        localStorage.setItem(STORAGE_KEYS.LIVE_GAME, serialized);
        if (localStorage.getItem(STORAGE_KEYS.LIVE_GAME) !== serialized) {
          throw new Error('The pending live-game write could not be restored to local storage.');
        }
        clearPendingLiveGame();
      } else if (hasPendingLiveGameMarker) {
        clearPendingLiveGame();
      }
    } catch (error) {
      setRestoreFailed(true);
      setIsLoading(false);
      recordDiagnosticError('storage_load', error, 'A pending live-game write could not be reconciled safely. Automatic saving is paused to protect scoring data.');
      console.error('Pending live-game recovery failed; saved scoring data was not overwritten.', error);
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
      read<boolean>(STORAGE_KEYS.SETUP_COMPLETED, setSetupCompleted, (value): value is boolean => typeof value === 'boolean');

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
