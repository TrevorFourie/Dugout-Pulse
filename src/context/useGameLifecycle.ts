import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Game, PlayerProfile } from '../types/baseball';
import { sortGames } from '../utils/stats';
import { getInningsPlayed, PENDING_LIVE_GAME_WRITE_KEY } from './gameContextDefaults';
import { saveCompletedSQLiteGame } from '../storage/sqliteRepository';
import { recordDiagnosticError } from '../utils/errorDiagnostics';

type StateSetter<T> = Dispatch<SetStateAction<T>>;

interface GameLifecycleOptions {
  activeProfile: PlayerProfile;
  games: Game[];
  liveGame: Game | null;
  editingGameId: string | null;
  reopenedGameId: string | null;
  setGames: StateSetter<Game[]>;
  setLiveGame: StateSetter<Game | null>;
  setEditingGameId: StateSetter<string | null>;
  setReopenedGameId: StateSetter<string | null>;
  setResumePromptPending: StateSetter<boolean>;
  saveTournament: (name: string) => void;
  saveAgeGroup: (name: string) => void;
  saveSeason: (name: string) => void;
  triggerHaptic: () => void;
  storageWritesBlocked: boolean;
  onStorageProtectionFailure: () => void;
}

/** Owns starting, saving, reopening, editing, and discarding games. */
export function useGameLifecycle({
  activeProfile,
  games,
  liveGame,
  editingGameId,
  reopenedGameId,
  setGames,
  setLiveGame,
  setEditingGameId,
  setReopenedGameId,
  setResumePromptPending,
  saveTournament,
  saveAgeGroup,
  saveSeason,
  triggerHaptic,
  storageWritesBlocked,
  onStorageProtectionFailure,
}: GameLifecycleOptions) {
  // Start new live game
  const startLiveGame = useCallback(
    (details: {
      date: string;
      time?: string;
      opponent?: string;
      finalResult?: string;
      teamName?: string;
      tournament?: string;
      ageGroup?: string;
      season?: string;
      lineupSpot?: number;
      isHome?: boolean;
    }) => {
      if (storageWritesBlocked) return;
      const trimmedOpponent = details.opponent?.trim() || '';
      const trimmedTournament = details.tournament?.trim() || '';
      if (trimmedTournament) {
        saveTournament(trimmedTournament);
      }
      if (details.ageGroup?.trim()) {
        saveAgeGroup(details.ageGroup.trim());
      }
      if (details.season?.trim()) {
        saveSeason(details.season.trim());
      }

      const initialInningLineupSpots: Record<number, number> = {};
      if (details.lineupSpot) {
        initialInningLineupSpots[1] = details.lineupSpot;
      }

      const newGame: Game = {
        id: 'game_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        date: details.date || new Date().toISOString().split('T')[0],
        time: details.time || new Date().toTimeString().slice(0, 5),
        opponent: trimmedOpponent,
        finalResult: details.finalResult?.trim() || undefined,
        teamName: details.teamName || activeProfile.teamName || 'My Team',
        isHome: details.isHome !== undefined ? details.isHome : true,
        tournament: trimmedTournament || undefined,
        ageGroup: details.ageGroup?.trim() || activeProfile.defaultAgeGroup || undefined,
        season: details.season?.trim() || activeProfile.defaultSeason || undefined,
        innings: 1,
        benchInnings: [],
        fieldingPositions: {},
        lineupSpot: details.lineupSpot || undefined,
        inningLineupSpots: initialInningLineupSpots,
        plays: [],
        playerId: activeProfile.id,
        halfInningStatus: {},
      };
      setLiveGame(newGame);
      setEditingGameId(null);
      setReopenedGameId(null);
      triggerHaptic();
    },
    [activeProfile, triggerHaptic, saveTournament, saveAgeGroup, saveSeason]
  );


  // Update live game metadata (date, time, opponent, team, tournament, ageGroup, season, lineupSpot, fieldingPositions, inningLineupSpots)
  const updateLiveGameDetails = useCallback(
    (
      details: Partial<
        Pick<
          Game,
          | 'date'
          | 'time'
          | 'opponent'
          | 'finalResult'
          | 'teamName'
          | 'isHome'
          | 'tournament'
          | 'ageGroup'
          | 'season'
          | 'lineupSpot'
          | 'fieldingPositions'
          | 'inningLineupSpots'
          | 'innings'
          | 'inningsManual'
          | 'halfInningStatus'
        >
      >
    ) => {
      if (details.tournament && details.tournament.trim()) {
        saveTournament(details.tournament.trim());
      }
      if (details.ageGroup && details.ageGroup.trim()) {
        saveAgeGroup(details.ageGroup.trim());
      }
      if (details.season && details.season.trim()) {
        saveSeason(details.season.trim());
      }
      setLiveGame((prev) => {
        if (!prev) return null;
        let updatedPlays = prev.plays;
        if (
          details.lineupSpot !== undefined &&
          (!prev.lineupSpot || prev.plays.some((p) => p.mode === 'batting' && !p.lineupSpot))
        ) {
          updatedPlays = prev.plays.map((p) => {
            if (p.mode === 'batting' && !p.lineupSpot && details.lineupSpot !== undefined) {
              return { ...p, lineupSpot: details.lineupSpot };
            }
            return p;
          });
        }
        return { ...prev, ...details, plays: updatedPlays };
      });
    },
    [saveTournament, saveAgeGroup, saveSeason]
  );

  // Save current game (either adding new or updating edited)
  const saveGame = useCallback(async (finalResult: string): Promise<boolean> => {
    if (storageWritesBlocked || !liveGame) return false;
    const gameToSave = { ...liveGame, finalResult, innings: getInningsPlayed(liveGame) };

    const existingGameId = editingGameId ?? reopenedGameId;
    const completedGame = existingGameId ? { ...gameToSave, id: existingGameId } : gameToSave;

    // Once SQLite is authoritative, finish the database transaction before clearing
    // the live game from React state. A quick close/reload can therefore never leave
    // the saved game only in memory. Before cutover, the existing persistence effect
    // remains responsible for the legacy localStorage-backed path.
    try {
      const persisted = await saveCompletedSQLiteGame(completedGame);
      if (persisted && localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) !== null) {
        // The completed-game transaction also stored all current plays and cleared the
        // SQLite live-game reference, so the scoring write-ahead journal is now obsolete.
        localStorage.removeItem(PENDING_LIVE_GAME_WRITE_KEY);
        if (localStorage.getItem(PENDING_LIVE_GAME_WRITE_KEY) !== null) {
          throw new Error('The pending scoring journal could not be cleared after the completed game was verified in SQLite.');
        }
      }
    } catch (error) {
      try {
        recordDiagnosticError(
          'storage_write_games',
          error,
          'The completed game could not be fully confirmed in SQLite. The live game remains available for recovery; automatic storage writes have been paused.',
        );
      } catch {
        // Preserve the blocked persistence outcome even if diagnostics are unavailable.
      }
      onStorageProtectionFailure();
      return false;
    }

    // Update preset lists only after the completed-game transaction succeeds. This
    // keeps their React persistence effect from queueing a stale live-game snapshot
    // ahead of the final state transition.
    if (liveGame.tournament && liveGame.tournament.trim()) {
      saveTournament(liveGame.tournament.trim());
    }
    if (liveGame.ageGroup && liveGame.ageGroup.trim()) {
      saveAgeGroup(liveGame.ageGroup.trim());
    }
    if (liveGame.season && liveGame.season.trim()) {
      saveSeason(liveGame.season.trim());
    }

    setGames((prevGames) => {
      let updated: Game[];
      if (existingGameId) {
        updated = prevGames.map((g) => (g.id === existingGameId ? completedGame : g));
        if (!updated.some((g) => g.id === existingGameId)) updated.push(completedGame);
      } else {
        updated = [...prevGames, completedGame];
      }
      return sortGames(updated, 'oldestFirst');
    });

    setLiveGame(null);
    setEditingGameId(null);
    setReopenedGameId(null);
    triggerHaptic();
    return true;
  }, [
    liveGame, editingGameId, reopenedGameId, triggerHaptic, saveTournament,
    saveAgeGroup, saveSeason, storageWritesBlocked, onStorageProtectionFailure,
  ]);

  // Discard current live game
  const discardLiveGame = useCallback(() => {
    if (storageWritesBlocked) return;
    setLiveGame(null);
    setEditingGameId(null);
    setReopenedGameId(null);
    triggerHaptic();
  }, [triggerHaptic, storageWritesBlocked]);

  // Start editing a saved game
  const startEditingSavedGame = useCallback(
    (gameId: string): boolean => {
      if (storageWritesBlocked) return false;
      if (liveGame && editingGameId !== gameId) {
        // Blocked because a different live game is in progress
        return false;
      }
      const targetGame = games.find((g) => g.id === gameId);
      if (!targetGame) return false;

      // Deep clone target game
      setLiveGame(JSON.parse(JSON.stringify(targetGame)));
      setEditingGameId(gameId);
      setReopenedGameId(null);
      triggerHaptic();
      return true;
    },
    [games, liveGame, editingGameId, triggerHaptic, storageWritesBlocked]
  );

  // Re-open a completed game for continued live scoring (separate from Edit Game).
  const reopenSavedGame = useCallback(
    (gameId: string): boolean => {
      if (storageWritesBlocked || liveGame) return false;
      const targetGame = games.find((g) => g.id === gameId);
      if (!targetGame) return false;
      const resumedGame: Game = {
        ...JSON.parse(JSON.stringify(targetGame)),
        finalResult: '',
      };
      setLiveGame(resumedGame);
      setEditingGameId(null);
      setReopenedGameId(gameId);
      setResumePromptPending(false);
      triggerHaptic();
      return true;
    },
    [games, liveGame, triggerHaptic, storageWritesBlocked]
  );

  // Cancel editing saved game (restores unchanged)
  const cancelEditing = useCallback(() => {
    if (storageWritesBlocked) return;
    setLiveGame(null);
    setEditingGameId(null);
    setReopenedGameId(null);
    triggerHaptic();
  }, [triggerHaptic, storageWritesBlocked]);

  // Delete a saved game
  const deleteSavedGame = useCallback((gameId: string) => {
    if (storageWritesBlocked) return;
    setGames((prev) => prev.filter((g) => g.id !== gameId));
    setLiveGame((prev) => (prev?.id === gameId ? null : prev));
    setEditingGameId((prev) => (prev === gameId ? null : prev));
    setReopenedGameId((prev) => (prev === gameId ? null : prev));
  }, [storageWritesBlocked]);


  return {
    startLiveGame,
    updateLiveGameDetails,
    saveGame,
    discardLiveGame,
    startEditingSavedGame,
    reopenSavedGame,
    cancelEditing,
    deleteSavedGame,
  };
}
