import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Game, DefensivePosition, PositionChange } from '../types/baseball';

type StateSetter<T> = Dispatch<SetStateAction<T>>;

interface InningManagementOptions {
  liveGame: Game | null;
  setLiveGame: StateSetter<Game | null>;
  triggerHaptic: () => void;
}

/** Owns inning navigation, fielding positions, lineup spots, and bench/rest state. */
export function useInningManagement({
  liveGame,
  setLiveGame,
  triggerHaptic,
}: InningManagementOptions) {
  // Inning controls
  const nextInning = useCallback(() => {
    if (!liveGame) return;
    triggerHaptic();
    setLiveGame((prev) => {
      if (!prev) return null;
      const nextInningNumber = prev.innings + 1;
      const previousPosition = prev.fieldingPositions?.[prev.innings];
      // Carry the player's defensive position into the next inning unless a position
      // has already been explicitly recorded there. Bench/rest remains inning-specific.
      const fieldingPositions =
        previousPosition && previousPosition !== 'BENCH' && !prev.fieldingPositions?.[nextInningNumber]
          ? { ...(prev.fieldingPositions || {}), [nextInningNumber]: previousPosition }
          : prev.fieldingPositions;
      const nextGame = {
        ...prev,
        innings: nextInningNumber,
        maxInning: Math.max(prev.maxInning ?? prev.innings, nextInningNumber),
        ...(fieldingPositions ? { fieldingPositions } : {}),
      };
      // useGamePersistence writes this state only after a verified private checkpoint.
      return nextGame;
    });
  }, [liveGame, triggerHaptic]);

  const prevInning = useCallback(() => {
    if (!liveGame || liveGame.innings <= 1) return;
    triggerHaptic();
    setLiveGame((prev) => {
      if (!prev || prev.innings <= 1) return prev;
      return {
        ...prev,
        innings: prev.innings - 1,
      };
    });
  }, [liveGame, triggerHaptic]);

  const setInning = useCallback((inning: number) => {
    if (inning < 1) return;
    setLiveGame((prev) => {
      if (!prev) return null;
      const currentPosition = prev.fieldingPositions?.[prev.innings];
      const fieldingPositions =
        currentPosition &&
        currentPosition !== 'BENCH' &&
        inning > prev.innings &&
        !prev.fieldingPositions?.[inning]
          ? { ...(prev.fieldingPositions || {}), [inning]: currentPosition }
          : prev.fieldingPositions;
      return {
        ...prev,
        innings: inning,
        maxInning: Math.max(prev.maxInning ?? prev.innings, inning),
        ...(fieldingPositions ? { fieldingPositions } : {}),
      };
    });
  }, []);

  const setInningPosition = useCallback(
    (inning: number, position: DefensivePosition) => {
      if (!liveGame) return;
      triggerHaptic();
      setLiveGame((prev) => {
        if (!prev) return null;
        const currentPositions = prev.fieldingPositions || {};
        const newPositions = { ...currentPositions, [inning]: position };
        let newBenchInnings = prev.benchInnings;
        if (position === 'BENCH' && !newBenchInnings.includes(inning)) {
          newBenchInnings = [...newBenchInnings, inning];
        } else if (position !== 'BENCH' && newBenchInnings.includes(inning)) {
          newBenchInnings = newBenchInnings.filter((i) => i !== inning);
        }
        return {
          ...prev,
          fieldingPositions: newPositions,
          benchInnings: newBenchInnings,
        };
      });
    },
    [liveGame, triggerHaptic]
  );

  const setInningLineupSpot = useCallback(
    (inning: number, spot: number | undefined) => {
      if (!liveGame) return;
      triggerHaptic();
      setLiveGame((prev) => {
        if (!prev) return null;
        const currentSpots = prev.inningLineupSpots || {};
        const newSpots = { ...currentSpots };
        if (spot === undefined) {
          delete newSpots[inning];
        } else {
          newSpots[inning] = spot;
        }

        // When batting spot is identified for this inning, backfill any batting plays in this inning
        // that were recorded before the position was known
        const updatedPlays = (prev.plays || []).map((p) => {
          if (p.inning === inning && !p.lineupSpot && spot !== undefined && p.mode === 'batting') {
            return { ...p, lineupSpot: spot };
          }
          return p;
        });

        return {
          ...prev,
          lineupSpot: spot !== undefined ? (prev.lineupSpot ?? spot) : prev.lineupSpot,
          inningLineupSpots: newSpots,
          plays: updatedPlays,
        };
      });
    },
    [liveGame, triggerHaptic]
  );

  const setLineupSpot = useCallback(
    (spot: number | undefined) => {
      if (!liveGame) return;
      triggerHaptic();
      setLiveGame((prev) => {
        if (!prev) return null;
        const currentSpots = prev.inningLineupSpots || {};
        const newSpots = { ...currentSpots };
        if (spot === undefined) {
          delete newSpots[prev.innings];
        } else {
          newSpots[prev.innings] = spot;
        }

        // When batting spot is identified, backfill earlier batting plays that were recorded
        // without a spot so spray charts and stats reflect this position
        const updatedPlays = (prev.plays || []).map((p) => {
          if (!p.lineupSpot && spot !== undefined && p.mode === 'batting') {
            return { ...p, lineupSpot: spot };
          }
          return p;
        });

        return {
          ...prev,
          lineupSpot: spot !== undefined ? spot : prev.lineupSpot,
          inningLineupSpots: newSpots,
          plays: updatedPlays,
        };
      });
    },
    [liveGame, triggerHaptic]
  );

  const toggleBenchCurrentInning = useCallback(() => {
    if (!liveGame) return;
    triggerHaptic();
    const currentInning = liveGame.innings;
    setLiveGame((prev) => {
      if (!prev) return null;
      const isBenched = prev.benchInnings.includes(currentInning);
      const newBench = isBenched
        ? prev.benchInnings.filter((i) => i !== currentInning)
        : [...prev.benchInnings, currentInning];
      // Bench/rest is player availability, not a defensive position. Preserve the
      // player's actual defensive position while sitting and restore CF if an old
      // game stored the legacy BENCH position.
      const newPositions = { ...(prev.fieldingPositions || {}) };
      if (isBenched && newPositions[currentInning] === 'BENCH') {
        newPositions[currentInning] = 'CF';
      }
      const nextGame = {
        ...prev,
        benchInnings: newBench,
        fieldingPositions: newPositions,
      };
      // useGamePersistence checkpoints and verifies before persisting this state change.
      return nextGame;
    });
  }, [liveGame, triggerHaptic]);

  const changeInningPosition = useCallback(
    (inning: number, to: DefensivePosition, mode: 'record' | 'correct') => {
      if (!liveGame) return;
      triggerHaptic();
      setLiveGame((prev) => {
        if (!prev) return null;
        const from = prev.fieldingPositions?.[inning];
        if (from === to) return prev;
        const now = Date.now();
        let positionChanges = prev.positionChanges || [];
        let plays = prev.plays;
        if (mode === 'record' && from) {
          positionChanges = [
            ...positionChanges,
            { id: 'pos_' + now + '_' + Math.random().toString(36).substring(2, 6), inning, from, to, timestamp: now },
          ];
        } else {
          // Correction: the whole inning was at the new position, so drop earlier switches and retag plays
          positionChanges = positionChanges.filter((c) => c.inning !== inning);
          plays = plays.map((p) =>
            p.inning === inning && p.mode === 'fielding' ? { ...p, defensivePosition: to } : p
          );
        }
        const nextGame = {
          ...prev,
          plays,
          positionChanges,
          fieldingPositions: { ...(prev.fieldingPositions || {}), [inning]: to },
          benchInnings: prev.benchInnings.filter((i) => i !== inning),
        };
        // useGamePersistence checkpoints and verifies before persisting this state change.
        return nextGame;
      });
    },
    [liveGame, triggerHaptic]
  );

  const removePositionChange = useCallback(
    (changeId: string) => {
      if (!liveGame) return;
      triggerHaptic();
      setLiveGame((prev) => {
        if (!prev) return null;
        const all = prev.positionChanges || [];
        const removed = all.find((c) => c.id === changeId);
        if (!removed) return prev;
        const inInning = all
          .filter((c) => c.inning === removed.inning)
          .sort((a, b) => a.timestamp - b.timestamp);
        const index = inInning.findIndex((c) => c.id === changeId);
        const following = inInning[index + 1];
        // The next change (if any) now starts from where the removed one started
        const positionChanges = all
          .filter((c) => c.id !== changeId)
          .map((c): PositionChange => (following && c.id === following.id ? { ...c, from: removed.from } : c));
        const remaining = inInning.filter((c) => c.id !== changeId);
        const current = remaining.length > 0 ? remaining[remaining.length - 1].to : removed.from;
        // Plays made during the removed segment go back to the position held before it
        const segmentEnd = following ? following.timestamp : Infinity;
        const plays = prev.plays.map((p) =>
          p.inning === removed.inning &&
          p.mode === 'fielding' &&
          (p.timestamp ?? 0) >= removed.timestamp &&
          (p.timestamp ?? 0) < segmentEnd
            ? { ...p, defensivePosition: removed.from }
            : p
        );
        const nextGame = {
          ...prev,
          plays,
          positionChanges,
          fieldingPositions: { ...(prev.fieldingPositions || {}), [removed.inning]: current },
        };
        // useGamePersistence checkpoints and verifies before persisting this state change.
        return nextGame;
      });
    },
    [liveGame, triggerHaptic]
  );

  const removeEmptyLastInning = useCallback((): boolean => {
    if (!liveGame) return false;
    const last = Math.max(
      liveGame.maxInning ?? 0,
      liveGame.innings,
      ...liveGame.plays.map((p) => p.inning),
      ...liveGame.benchInnings
    );
    const isEmpty =
      last > 1 &&
      !liveGame.plays.some((p) => p.inning === last) &&
      !liveGame.benchInnings.includes(last);
    if (!isEmpty) return false;
    triggerHaptic();
    setLiveGame((prev) => {
      if (!prev) return null;
      const dropKey = <T,>(rec: Record<number, T> | undefined) => {
        if (!rec) return rec;
        const copy = { ...rec };
        delete copy[last];
        return copy;
      };
      const nextGame = {
        ...prev,
        innings: Math.min(prev.innings, last - 1),
        maxInning: last - 1,
        positionChanges: (prev.positionChanges || []).filter((c) => c.inning !== last),
        halfInningStatus: dropKey(prev.halfInningStatus),
        fieldingPositions: dropKey(prev.fieldingPositions),
        inningLineupSpots: dropKey(prev.inningLineupSpots),
      };
      // useGamePersistence checkpoints and verifies before persisting this state change.
      return nextGame;
    });
    return true;
  }, [liveGame, triggerHaptic]);

  // Bench / un-bench a specific inning, e.g. from the "Plays in This Game" list when the player
  // is looking at a different inning than the one that was benched.
  const setInningBench = useCallback(
    (inning: number, benched: boolean) => {
      if (!liveGame) return;
      triggerHaptic();
      setLiveGame((prev) => {
        if (!prev) return null;
        const has = prev.benchInnings.includes(inning);
        const newPositions = { ...(prev.fieldingPositions || {}) };
        if (!benched && newPositions[inning] === 'BENCH') {
          // Legacy games stored BENCH as a position; drop it so the inning is no longer "resting".
          delete newPositions[inning];
        }
        if (benched === has && newPositions[inning] === (prev.fieldingPositions || {})[inning]) return prev;
        const nextGame = {
          ...prev,
          benchInnings: benched
            ? has ? prev.benchInnings : [...prev.benchInnings, inning]
            : prev.benchInnings.filter((i) => i !== inning),
          fieldingPositions: newPositions,
        };
        // useGamePersistence checkpoints and verifies before persisting this state change.
        return nextGame;
      });
    },
    [liveGame, triggerHaptic]
  );


  return {
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
  };
}
