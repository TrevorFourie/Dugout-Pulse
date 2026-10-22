import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings, Game, DefensivePosition, HitLocation, PitcherHand, Play, PlayCode, PlayMode, PlayScoringContext, RunnerOutReason } from '../types/baseball';
import type { PlaySeed } from '../utils/pitchingFlow';
import { getAttachedRbiPlayIds } from '../utils/sprayChart';
import { STORAGE_KEYS } from './gameContextDefaults';

interface GamePlayActionsOptions {
  liveGame: Game | null;
  setLiveGame: Dispatch<SetStateAction<Game | null>>;
  settings: AppSettings;
  triggerHaptic: () => void;
}

/** Owns play creation, correction, ordering, and undo behavior for the live game. */
export function useGamePlayActions({
  liveGame,
  setLiveGame,
  settings,
  triggerHaptic,
}: GamePlayActionsOptions) {
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


  return {
    addPlay,
    addPlays,
    undoLastPlay,
    deletePlay,
    updatePlayHitLocation,
    updatePlayOutcome,
    setPlayRbis,
    movePlay,
    movePlayTo,
    insertPlayAfter,
    editPlay,
  };
}
