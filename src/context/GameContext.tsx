import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  AppSettings,
  DefensivePosition,
  Game,
  HitLocation,
  PitcherHand,
  Play,
  PlayCode,
  PlayerProfile,
  PlayerTeam,
  PlayMode,
  PlayScoringContext,
  PositionChange,
  RunnerOutReason,
} from '../types/baseball';
import { sortGames } from '../utils/stats';
import type { GameContextType, OppositionTeam } from './gameContextTypes';
export type { OppositionTeam } from './gameContextTypes';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, STORAGE_KEYS, getInningsPlayed, withTeams } from './gameContextDefaults';
import { getAttachedRbiPlayIds } from '../utils/sprayChart';
import type { PlaySeed } from '../utils/pitchingFlow';
import { collectLocalLogoDataUrls, restoreLocalLogoReferences } from '../utils/logoBackup';
import { clearAppDataPreservingDiagnostics } from '../utils/errorDiagnostics';
import { useGamePersistence } from './useGamePersistence';
import { useGameRestore } from './useGameRestore';
import { useGamePresets } from './useGamePresets';
import { useGameOpponents } from './useGameOpponents';
import { usePlayerTeams } from './usePlayerTeams';
import { useGameProfiles } from './useGameProfiles';
import { useInningManagement } from './useInningManagement';

const GameContext = createContext<GameContextType | undefined>(undefined);

/**
 * Number of innings actually played. Trailing innings with no plays and no bench/rest entry
 * (e.g. an inning opened accidentally or after a shortened game) are not counted.
 */
export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [liveGame, setLiveGame] = useState<Game | null>(null);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [reopenedGameId, setReopenedGameId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<PlayerProfile[]>([DEFAULT_PROFILE]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savedOpponents, setSavedOpponents] = useState<string[]>([]);
  const [oppositionTeams, setOppositionTeams] = useState<OppositionTeam[]>([]);
  const [savedTournaments, setSavedTournaments] = useState<string[]>([]);
  const [savedAgeGroups, setSavedAgeGroups] = useState<string[]>([]);
  const [savedSeasons, setSavedSeasons] = useState<string[]>([]);
  const [hiddenTournaments, setHiddenTournaments] = useState<string[]>([]);
  const [hiddenAgeGroups, setHiddenAgeGroups] = useState<string[]>([]);
  const [hiddenSeasons, setHiddenSeasons] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resumePromptPending, setResumePromptPending] = useState(false);
  const dismissResumePrompt = useCallback(() => setResumePromptPending(false), []);

  // First time user detection: true if setup has not been completed and no profile is filled out
  const [isFirstTimeUser, setIsFirstTimeUser] = useState<boolean>(() => {
    try {
      const completed = localStorage.getItem(STORAGE_KEYS.SETUP_COMPLETED);
      if (completed === 'true') return false;
      const storedProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (storedProfiles) {
        const parsed = JSON.parse(storedProfiles);
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed[0]?.playerName?.trim() &&
          (parsed[0]?.teamName?.trim() || (parsed[0]?.teams && parsed[0]?.teams.length > 0))
        ) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  });

  // Initial restore is separate from ongoing persistence writes.
  useGameRestore({
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
  });

  // Persistence writes are kept separate from the context's game and profile logic.
  useGamePersistence({
    isLoading,
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
  });

  // Dark mode effect
  useEffect(() => {
    const root = document.documentElement;
    if (settings.darkMode === 'dark') {
      root.classList.add('dark');
    } else if (settings.darkMode === 'light') {
      root.classList.remove('dark');
    } else {
      // System
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      if (mediaQuery.matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      const listener = (e: MediaQueryListEvent) => {
        if (settings.darkMode === 'system') {
          if (e.matches) root.classList.add('dark');
          else root.classList.remove('dark');
        }
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [settings.darkMode]);

  const activeProfile =
    profiles.find((p) => p.id === settings.activePlayerId) || profiles[0] || DEFAULT_PROFILE;

  // Trigger haptic vibration helper
  // Haptic vibration has been removed from the app
  const triggerHaptic = useCallback(() => {}, []);

  const {
    addOppositionTeam,
    updateOppositionTeam,
    deleteOppositionTeam,
    saveOpponent,
    deleteOpponent,
    allOpponents,
    recentOpponents,
  } = useGameOpponents({
    games,
    liveGame,
    oppositionTeams,
    setOppositionTeams,
    savedOpponents,
    setSavedOpponents,
  });

  const {
    restoreHiddenPresets,
    renamePreset,
    inUseTournaments,
    inUseAgeGroups,
    inUseSeasons,
    saveTournament,
    deleteTournament,
    allTournaments,
    saveAgeGroup,
    deleteAgeGroup,
    allAgeGroups,
    saveSeason,
    deleteSeason,
    allSeasons,
    allTeams,
  } = useGamePresets({
    games,
    activeProfile,
    setGames,
    setLiveGame,
    setProfiles,
    setSavedTournaments,
    setSavedAgeGroups,
    setSavedSeasons,
    setHiddenTournaments,
    setHiddenAgeGroups,
    setHiddenSeasons,
    triggerHaptic,
  });

  const { addPlayerTeam, updatePlayerTeam, deletePlayerTeam, setDefaultPlayerTeam } = usePlayerTeams({
    setProfiles,
    saveTournament,
    saveAgeGroup,
    saveSeason,
  });

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

  // Add a play to the live game
  const addPlay = useCallback(
    (
      mode: PlayMode,
      code: PlayCode,
      options?: {
        pitcherHand?: PitcherHand;
        defensivePosition?: DefensivePosition;
        lineupSpot?: number;
        hitLocation?: HitLocation;
        isExtraOut?: boolean;
        partOfMultiOutPlay?: boolean;
        autoOutcome?: boolean;
        runnerFromBase?: 1 | 2 | 3;
        runnerToBase?: 1 | 2 | 3 | 4;
        runnerAdvanceCause?: Play['runnerAdvanceCause'];
      droppedThirdStrikeSafe?: Play['droppedThirdStrikeSafe'];
        runnerOutReason?: RunnerOutReason;
      outReason?: Play['outReason'];
        runnerSubNumber?: string;
        extraOuts?: number;
        scoringContext?: PlayScoringContext;
        errorType?: Play['errorType'];
      /** Explicit inning for historical corrections; defaults to the live inning. */
      targetInning?: number;
      }
    ): Play | undefined => {
      if (!liveGame) return undefined;

      triggerHaptic();

      // Check if code is homeRun and homeRunAddsRunAndRbi setting is enabled
      const newPlays: Play[] = [];
      const now = Date.now();
      const targetInning = options?.targetInning ?? liveGame.innings;
      const currentPos = options?.defensivePosition || liveGame.fieldingPositions?.[targetInning];
      const currentInningSpot =
        liveGame.inningLineupSpots?.[targetInning] ?? liveGame.lineupSpot;
      const currentLineupSpot =
        mode === 'batting'
          ? (options?.lineupSpot !== undefined ? options.lineupSpot : currentInningSpot)
          : undefined;

      if (mode === 'batting' && code === 'homeRun' && settings.homeRunAddsRunAndRbi) {
        newPlays.push({
          id: 'play_' + now + '_hr',
          inning: targetInning,
          mode: 'batting',
          code: 'homeRun',
          timestamp: now,
          pitcherHand: options?.pitcherHand,
          lineupSpot: currentLineupSpot,
          hitLocation: options?.hitLocation,
        });
        newPlays.push({
          id: 'play_' + (now + 1) + '_rbi',
          inning: targetInning,
          mode: 'batting',
          code: 'rbi',
          timestamp: now + 1,
          pitcherHand: options?.pitcherHand,
          lineupSpot: currentLineupSpot,
        });
        newPlays.push({
          id: 'play_' + (now + 2) + '_run',
          inning: targetInning,
          mode: 'batting',
          code: 'run',
          timestamp: now + 2,
          pitcherHand: options?.pitcherHand,
          lineupSpot: currentLineupSpot,
        });
      } else {
        newPlays.push({
          id: 'play_' + now + '_' + Math.random().toString(36).substring(2, 6),
          inning: targetInning,
          mode,
          code,
          timestamp: now,
          pitcherHand: mode === 'batting' ? options?.pitcherHand : undefined,
          defensivePosition: mode === 'fielding' ? currentPos : undefined,
          lineupSpot: currentLineupSpot,
          hitLocation: mode === 'batting' ? options?.hitLocation : undefined,
          isExtraOut: options?.isExtraOut,
          partOfMultiOutPlay: options?.partOfMultiOutPlay,
          autoOutcome: options?.autoOutcome,
          runnerFromBase: options?.runnerFromBase,
          runnerToBase: options?.runnerToBase,
          runnerAdvanceCause: options?.runnerAdvanceCause,
          droppedThirdStrikeSafe: options?.droppedThirdStrikeSafe,
          runnerOutReason: options?.runnerOutReason,
          outReason: mode === 'batting' ? options?.outReason : undefined,
          runnerSubNumber: options?.runnerSubNumber,
          extraOuts: options?.extraOuts || undefined,
          scoringContext: mode === 'batting' ? options?.scoringContext : undefined,
          errorType: mode === 'batting' ? options?.errorType : undefined,
        });
      }

      setLiveGame((prev) => {
        if (!prev) return null;
        const nextGame = {
          ...prev,
          plays: [...prev.plays, ...newPlays],
        };
        // Scorekeeping is offline-first: commit the authoritative game snapshot to localStorage
        // in the same transaction that updates React state, before the UI renders the change.
        try {
          localStorage.setItem(STORAGE_KEYS.LIVE_GAME, JSON.stringify(nextGame));
        } catch (storageError) {
          console.error('Failed to persist live score locally:', storageError);
        }
        return nextGame;
      });

      return newPlays[0];
    },
    [liveGame, settings.homeRunAddsRunAndRbi, triggerHaptic]
  );

  // Append several plays from one action (e.g. pitch + auto-walk + run) as one undoable group.
  const addPlays = useCallback(
    (seeds: PlaySeed[], targetInning?: number): Play[] => {
      if (!liveGame || seeds.length === 0) return [];
      triggerHaptic();
      const now = Date.now();
      const groupId = seeds.length > 1 ? 'grp_' + now + '_' + Math.random().toString(36).substring(2, 6) : undefined;
      const inningForPlays = targetInning ?? liveGame.innings;
      const newPlays: Play[] = seeds.map((seed, index) => ({
        ...seed,
        id: 'play_' + (now + index) + '_' + Math.random().toString(36).substring(2, 6),
        inning: inningForPlays,
        timestamp: now + index,
        ...(groupId ? { groupId } : {}),
      }));

      setLiveGame((prev) => {
        if (!prev) return null;
        const nextGame = { ...prev, plays: [...prev.plays, ...newPlays] };
        try {
          localStorage.setItem(STORAGE_KEYS.LIVE_GAME, JSON.stringify(nextGame));
        } catch (storageError) {
          console.error('Failed to persist live score locally:', storageError);
        }
        return nextGame;
      });
      return newPlays;
    },
    [liveGame, triggerHaptic]
  );

  // Undo the last play
  const undoLastPlay = useCallback(() => {
    if (!liveGame || liveGame.plays.length === 0) return;
    triggerHaptic();

    setLiveGame((prev) => {
      if (!prev || prev.plays.length === 0) return prev;
      // Plays created by one button press share a groupId and are undone together.
      const last = prev.plays[prev.plays.length - 1];
      const nextGame = {
        ...prev,
        plays: last.groupId
          ? prev.plays.filter((p) => p.groupId !== last.groupId)
          : prev.plays.slice(0, -1),
      };
      try {
        localStorage.setItem(STORAGE_KEYS.LIVE_GAME, JSON.stringify(nextGame));
      } catch (storageError) {
        console.error('Failed to persist undo locally:', storageError);
      }
      return nextGame;
    });
  }, [liveGame, triggerHaptic]);

  // Delete an individual play anywhere in the list
  const deletePlay = useCallback((playId: string) => {
    setLiveGame((prev) => {
      if (!prev) return null;
      const nextGame = { ...prev, plays: prev.plays.filter((p) => p.id !== playId) };
      try {
        localStorage.setItem(STORAGE_KEYS.LIVE_GAME, JSON.stringify(nextGame));
      } catch (storageError) {
        console.error('Failed to persist deletion locally:', storageError);
      }
      return nextGame;
    });
  }, []);

  // Update hit location of a specific play
  const updatePlayHitLocation = useCallback((playId: string, hitLocation: HitLocation | undefined) => {
    setLiveGame((prev) => {
      if (!prev) return null;
      const nextGame = {
        ...prev,
        plays: prev.plays.map((p) => (p.id === playId ? { ...p, hitLocation } : p)),
      };
      try {
        localStorage.setItem(STORAGE_KEYS.LIVE_GAME, JSON.stringify(nextGame));
      } catch (storageError) {
        console.error('Failed to persist hit location locally:', storageError);
      }
      return nextGame;
    });
  }, []);

  // Correct the outcome of an existing batting play without creating a duplicate.
  // This is used when a hit is judged to be reached on error after its location was marked.
  const updatePlayOutcome = useCallback((
    playId: string,
    code: PlayCode,
    errorType?: Play['errorType']
  ) => {
    setLiveGame((prev) => {
      if (!prev) return null;
      const nextGame = {
        ...prev,
        plays: prev.plays.map((p) => {
          if (p.id !== playId) return p;
          const { errorType: _previousErrorType, ...playWithoutErrorType } = p;
          return {
            ...playWithoutErrorType,
            code,
            ...(errorType ? { errorType } : {}),
          };
        }),
      };
      try {
        localStorage.setItem(STORAGE_KEYS.LIVE_GAME, JSON.stringify(nextGame));
      } catch (storageError) {
        console.error('Failed to persist corrected play outcome locally:', storageError);
      }
      return nextGame;
    });
  }, []);

  // Make the number of RBI plays attached to a batting play equal `count`.
  const setPlayRbis = useCallback((playId: string, count: number) => {
    setLiveGame((prev) => {
      if (!prev) return null;
      const i = prev.plays.findIndex((p) => p.id === playId);
      if (i === -1) return prev;
      const ref = prev.plays[i];
      const target = Math.max(0, Math.floor(count));
      const attached = getAttachedRbiPlayIds(ref, prev.plays);
      if (attached.length === target) return prev;
      let plays = prev.plays;
      if (attached.length > target) {
        const drop = new Set(attached.slice(target)); // remove the latest ones
        plays = plays.filter((p) => !drop.has(p.id));
      } else {
        const now = Date.now();
        const added: Play[] = [];
        for (let k = 0; k < target - attached.length; k++) {
          added.push({
            id: 'play_' + (now + k) + '_rbi_' + Math.random().toString(36).substring(2, 6),
            inning: ref.inning,
            mode: 'batting',
            code: 'rbi',
            timestamp: (ref.timestamp ?? now) + 0.001 * (k + 1),
            pitcherHand: ref.pitcherHand,
            lineupSpot: ref.lineupSpot,
          });
        }
        plays = [...plays.slice(0, i + 1), ...added, ...plays.slice(i + 1)];
      }
      const nextGame = { ...prev, plays };
      try {
        localStorage.setItem(STORAGE_KEYS.LIVE_GAME, JSON.stringify(nextGame));
      } catch (storageError) {
        console.error('Failed to persist RBI change locally:', storageError);
      }
      return nextGame;
    });
  }, []);

  // Move a play one step earlier / later. With sameModeOnly the step is relative to the nearest
  // play of the same category (batting / pitching / fielding), which is what the split feed shows.
  const movePlay = useCallback(
    (playId: string, direction: 'earlier' | 'later', sameModeOnly = false) => {
      setLiveGame((prev) => {
        if (!prev) return null;
        const i = prev.plays.findIndex((p) => p.id === playId);
        if (i === -1) return prev;
        const step = direction === 'earlier' ? -1 : 1;
        let j = i + step;
        if (sameModeOnly) {
          while (j >= 0 && j < prev.plays.length && prev.plays[j].mode !== prev.plays[i].mode) j += step;
        }
        if (j < 0 || j >= prev.plays.length) return prev;
        const plays = [...prev.plays];
        const [moved] = plays.splice(i, 1);
        plays.splice(j, 0, moved);
        // Keep the timestamp consistent with the new position (between its new neighbours)
        const before = plays[j - 1]?.timestamp;
        const after = plays[j + 1]?.timestamp;
        let timestamp = moved.timestamp;
        if (before !== undefined && after !== undefined) timestamp = (before + after) / 2;
        else if (before !== undefined) timestamp = before + 1;
        else if (after !== undefined) timestamp = after - 1;
        plays[j] = { ...moved, timestamp };
        return { ...prev, plays };
      });
    },
    []
  );

  // Drop a play right before / after another play (used by drag and drop)
  const movePlayTo = useCallback((playId: string, targetId: string, position: 'before' | 'after') => {
    setLiveGame((prev) => {
      if (!prev || playId === targetId) return prev;
      const from = prev.plays.findIndex((p) => p.id === playId);
      if (from === -1 || prev.plays.findIndex((p) => p.id === targetId) === -1) return prev;
      const plays = [...prev.plays];
      const [moved] = plays.splice(from, 1);
      const targetIdx = plays.findIndex((p) => p.id === targetId);
      const targetInning = plays[targetIdx].inning;
      const at = position === 'before' ? targetIdx : targetIdx + 1;
      plays.splice(at, 0, moved);
      const before = plays[at - 1]?.timestamp;
      const after = plays[at + 1]?.timestamp;
      let timestamp = moved.timestamp;
      if (before !== undefined && after !== undefined) timestamp = (before + after) / 2;
      else if (before !== undefined) timestamp = before + 1;
      else if (after !== undefined) timestamp = after - 1;
      // Dropping among another inning's plays moves it into that inning
      plays[at] = { ...moved, timestamp, inning: targetInning };
      return { ...prev, plays };
    });
  }, []);

  // Insert a new play right after an existing one
  const insertPlayAfter = useCallback(
    (
      afterPlayId: string,
      inning: number,
      mode: PlayMode,
      code: PlayCode,
      hitLocation?: HitLocation | null
    ) => {
      setLiveGame((prev) => {
        if (!prev) return null;
        const i = prev.plays.findIndex((p) => p.id === afterPlayId);
        if (i === -1) return prev;
        const ref = prev.plays[i];
        const next = prev.plays[i + 1];
        const refTs = ref.timestamp ?? Date.now();
        const timestamp = next?.timestamp !== undefined && next.timestamp > refTs ? (refTs + next.timestamp) / 2 : refTs + 1;
        const newPlay: Play = {
          id: 'play_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          inning,
          mode,
          code,
          timestamp,
        };
        if (mode === 'batting') {
          newPlay.lineupSpot =
            ref.mode === 'batting' && ref.inning === inning
              ? ref.lineupSpot
              : prev.inningLineupSpots?.[inning] ?? prev.lineupSpot;
          if (ref.pitcherHand) newPlay.pitcherHand = ref.pitcherHand;
          if (hitLocation) newPlay.hitLocation = hitLocation;
        } else if (mode === 'fielding') {
          newPlay.defensivePosition = prev.fieldingPositions?.[inning] || ref.defensivePosition;
        }
        const plays = [...prev.plays.slice(0, i + 1), newPlay, ...prev.plays.slice(i + 1)];
        return { ...prev, plays };
      });
    },
    []
  );

  // Edit an individual play
  const editPlay = useCallback(
    (
      playId: string,
      newInning: number,
      newMode: PlayMode,
      newCode: PlayCode,
      newLineupSpot?: number,
      newHitLocation?: HitLocation | null,
      newThrowTo?: string
    ) => {
      setLiveGame((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          plays: prev.plays.map((p) => {
            if (p.id !== playId) return p;
            return {
              ...p,
              inning: newInning,
              mode: newMode,
              code: newCode,
              lineupSpot: newLineupSpot !== undefined ? newLineupSpot : p.lineupSpot,
              hitLocation:
                newHitLocation !== undefined
                  ? newHitLocation === null
                    ? undefined
                    : newHitLocation
                  : p.hitLocation,
              throwTo: newThrowTo !== undefined ? (newThrowTo === '' ? undefined : newThrowTo) : p.throwTo,
            };
          }),
        };
      });
    },
    []
  );

  const {
    nextInning,
    prevInning,
    setInning,
    setInningPosition,
    setInningLineupSpot,
    setLineupSpot,
    toggleBenchCurrentInning,
    changeInningPosition,
    removePositionChange,
    removeEmptyLastInning,
    setInningBench,
  } = useInningManagement({ liveGame, setLiveGame, triggerHaptic });

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
  const saveGame = useCallback((finalResult: string) => {
    if (!liveGame) return;
    const gameToSave = { ...liveGame, finalResult, innings: getInningsPlayed(liveGame) };

    if (liveGame.tournament && liveGame.tournament.trim()) {
      saveTournament(liveGame.tournament.trim());
    }
    if (liveGame.ageGroup && liveGame.ageGroup.trim()) {
      saveAgeGroup(liveGame.ageGroup.trim());
    }
    if (liveGame.season && liveGame.season.trim()) {
      saveSeason(liveGame.season.trim());
    }

    // Commit the completed game to localStorage in the same operation as the React state
    // update. This prevents a Save + unmount/navigation from ever losing the finished game.
    const existingGameId = editingGameId ?? reopenedGameId;
    const completedGame = existingGameId ? { ...gameToSave, id: existingGameId } : gameToSave;
    setGames((prevGames) => {
      let updated: Game[];
      if (existingGameId) {
        updated = prevGames.map((g) => (g.id === existingGameId ? completedGame : g));
        if (!updated.some((g) => g.id === existingGameId)) updated.push(completedGame);
      } else {
        updated = [...prevGames, completedGame];
      }
      const sorted = sortGames(updated, 'oldestFirst');
      try {
        localStorage.setItem(STORAGE_KEYS.GAMES, JSON.stringify(sorted));
      } catch (storageError) {
        console.error('Failed to persist saved game locally:', storageError);
      }
      return sorted;
    });

    try {
      localStorage.removeItem(STORAGE_KEYS.LIVE_GAME);
      localStorage.removeItem(STORAGE_KEYS.EDITING_GAME_ID);
      localStorage.removeItem(STORAGE_KEYS.REOPENED_GAME_ID);
    } catch (storageError) {
      console.error('Failed to clear completed live-game state locally:', storageError);
    }
    setLiveGame(null);
    setEditingGameId(null);
    setReopenedGameId(null);
    triggerHaptic();
  }, [liveGame, editingGameId, reopenedGameId, triggerHaptic, saveTournament, saveAgeGroup, saveSeason]);

  // Discard current live game
  const discardLiveGame = useCallback(() => {
    setLiveGame(null);
    setEditingGameId(null);
    setReopenedGameId(null);
    triggerHaptic();
  }, [triggerHaptic]);

  // Start editing a saved game
  const startEditingSavedGame = useCallback(
    (gameId: string): boolean => {
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
    [games, liveGame, editingGameId, triggerHaptic]
  );

  // Re-open a completed game for continued live scoring (separate from Edit Game).
  const reopenSavedGame = useCallback(
    (gameId: string): boolean => {
      if (liveGame) return false;
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
    [games, liveGame, triggerHaptic]
  );

  // Cancel editing saved game (restores unchanged)
  const cancelEditing = useCallback(() => {
    setLiveGame(null);
    setEditingGameId(null);
    setReopenedGameId(null);
    triggerHaptic();
  }, [triggerHaptic]);

  // Delete a saved game
  const deleteSavedGame = useCallback((gameId: string) => {
    setGames((prev) => prev.filter((g) => g.id !== gameId));
    setLiveGame((prev) => (prev?.id === gameId ? null : prev));
    setEditingGameId((prev) => (prev === gameId ? null : prev));
    setReopenedGameId((prev) => (prev === gameId ? null : prev));
  }, []);

  const { updateActiveProfile, addProfile, setActiveProfileId, deleteProfile } = useGameProfiles({
    profiles,
    activeProfile,
    setProfiles,
    setSettings,
  });

  // Update settings
  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  // Full backup import. Logo images are intentionally not embedded in JSON backups:
  // references are resolved against images that still exist in this app's local data.
  const importJsonData = useCallback((jsonStr: string) => {
    try {
      const parsedData = JSON.parse(jsonStr);
      const localLogos = new Map<string, string>();
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          collectLocalLogoDataUrls(JSON.parse(raw), localLogos);
        } catch {
          // Ignore unrelated non-JSON local storage values.
        }
      }
      const restored = restoreLocalLogoReferences(parsedData, localLogos);
      const data = restored.data as typeof parsedData;

      if (data && Array.isArray(data.games)) {
        setGames(sortGames(data.games, 'oldestFirst'));
      }
      if (data && Array.isArray(data.profiles) && data.profiles.length > 0) {
        setProfiles((data.profiles as PlayerProfile[]).map(withTeams));
      }
      if (data && data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
      if (data && Array.isArray(data.upcomingGames)) {
        localStorage.setItem('dugoutPulse.upcomingGames.v1', JSON.stringify(data.upcomingGames));
      }
      if (data && Array.isArray(data.oppositionTeams)) {
        setOppositionTeams(data.oppositionTeams);
        localStorage.setItem('dugoutPulse.oppositionTeams.v1', JSON.stringify(data.oppositionTeams));
      }

      if (restored.missingReferences.size > 0) {
        const count = restored.missingReferences.size;
        return {
          success: true,
          message: `Data restored, but ${count} custom logo image(s) could not be found on this device. Default logos will be used for those items. Logo images are not included in JSON backups.`,
        };
      }
      return { success: true, message: 'Season data successfully restored!' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid JSON file';
      return { success: false, message: `Failed to import backup: ${message}` };
    }
  }, []);

  const resetAllData = useCallback(() => {
    setGames([]);
    setLiveGame(null);
    setEditingGameId(null);
    setReopenedGameId(null);
    setProfiles([DEFAULT_PROFILE]);
    setSettings(DEFAULT_SETTINGS);
    setOppositionTeams([]);
    setHiddenTournaments([]);
    setHiddenAgeGroups([]);
    setHiddenSeasons([]);
    clearAppDataPreservingDiagnostics();
  }, []);

  const completeFirstTimeSetup = useCallback(
    (setup: {
      playerName: string;
      ageGroup: string;
      season: string;
      tournament?: string;
      teamName: string;
      jerseyNumber?: string;
    }) => {
      const trimmedPlayer = setup.playerName.trim();
      const trimmedTeam = setup.teamName.trim();
      const trimmedAge = setup.ageGroup.trim();
      const trimmedSeason = setup.season.trim();
      const trimmedTourney = setup.tournament?.trim() || '';
      const trimmedJersey = setup.jerseyNumber?.trim() || '';

      const newTeamId = 'team_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const primaryTeam: PlayerTeam = {
        id: newTeamId,
        name: trimmedTeam,
        jerseyNumber: trimmedJersey || undefined,
        ageGroup: trimmedAge,
        season: trimmedSeason,
        tournament: trimmedTourney || undefined,
        isDefault: true,
      };

      setProfiles((prev) => {
        const current = prev[0] || DEFAULT_PROFILE;
        const updatedProfile: PlayerProfile = {
          ...current,
          playerName: trimmedPlayer,
          teamName: trimmedTeam,
          jerseyNumber: trimmedJersey || current.jerseyNumber || undefined,
          defaultAgeGroup: trimmedAge,
          defaultSeason: trimmedSeason,
          defaultTournament: trimmedTourney || undefined,
          teams: [primaryTeam],
          isDefault: true,
        };
        return [updatedProfile, ...prev.slice(1)];
      });

      if (trimmedTourney) saveTournament(trimmedTourney);
      if (trimmedAge) saveAgeGroup(trimmedAge);
      if (trimmedSeason) saveSeason(trimmedSeason);

      try {
        localStorage.setItem(STORAGE_KEYS.SETUP_COMPLETED, 'true');
      } catch (err) {
        console.error('Failed to save setup completed flag:', err);
      }
      setIsFirstTimeUser(false);
      triggerHaptic();
    },
    [saveTournament, saveAgeGroup, saveSeason, triggerHaptic]
  );

  return (
    <GameContext.Provider
      value={{
        games,
        liveGame,
        editingGameId,
        profiles,
        activeProfile,
        settings,
        isLoading,
        resumePromptPending,
        dismissResumePrompt,
        savedOpponents,
        allOpponents,
        recentOpponents,
        saveOpponent,
        deleteOpponent,
        oppositionTeams,
        addOppositionTeam,
        updateOppositionTeam,
        deleteOppositionTeam,
        savedTournaments,
        allTournaments,
        saveTournament,
        deleteTournament,
        savedAgeGroups,
        allAgeGroups,
        saveAgeGroup,
        deleteAgeGroup,
        savedSeasons,
        allSeasons,
        saveSeason,
        deleteSeason,
        allTeams,
        hiddenTournaments,
        hiddenAgeGroups,
        hiddenSeasons,
        inUseTournaments,
        inUseAgeGroups,
        inUseSeasons,
        restoreHiddenPresets,
        renamePreset,
        addPlayerTeam,
        updatePlayerTeam,
        deletePlayerTeam,
        setDefaultPlayerTeam,
        startLiveGame,
        addPlay,
        addPlays,
        undoLastPlay,
        deletePlay,
        editPlay,
        updatePlayHitLocation,
        updatePlayOutcome,
        setPlayRbis,
        movePlay,
        movePlayTo,
        insertPlayAfter,
        nextInning,
        prevInning,
        setInning,
        setInningPosition,
        setInningLineupSpot,
        setLineupSpot,
        toggleBenchCurrentInning,
        removeEmptyLastInning,
        changeInningPosition,
        removePositionChange,
        setInningBench,
        saveGame,
        discardLiveGame,
        startEditingSavedGame,
        reopenSavedGame,
        cancelEditing,
        deleteSavedGame,
        updateLiveGameDetails,
        updateActiveProfile,
        addProfile,
        setActiveProfileId,
        deleteProfile,
        updateSettings,
        importJsonData,
        resetAllData,
        isFirstTimeUser,
        setIsFirstTimeUser,
        completeFirstTimeSetup,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};