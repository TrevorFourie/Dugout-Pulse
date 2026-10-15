import { useEffect, useRef, useState } from 'react';
import {
  BattingPlayCode,
  DefensivePosition,
  FieldingPlayCode,
  PlayCode,
  PlayMode,
} from '../types/baseball';

type PrimaryBattingCode = Exclude<
  BattingPlayCode,
  'rbi' | 'run' | 'stolenBase' | 'cs'
>;

type PitchingTerminalCode =
  | 'strikeout'
  | 'walkAllowed'
  | 'intentionalWalkAllowed'
  | 'hitBatter'
  | 'hitAllowed'
  | 'homeRunAllowed'
  | 'pitchOut';

type PitchingIndependentCode = 'balk' | 'wildPitch' | 'earnedRun' | 'runAllowed' | 'pitchOther';
type CatcherFieldingCode =
  | 'passedBall'
  | 'caughtStealing'
  | 'stealAllowed'
  | 'catchersInterference'
  | 'pickoff'
  | 'droppedThirdStrike'
  | 'defensiveIndifference';

interface UsePlayFlowOptions {
  onEvent: (
    mode: PlayMode,
    code: PlayCode,
    options?: { autoOutcome?: boolean; isExtraOut?: boolean }
  ) => void;
  activePosition?: DefensivePosition | string;
  initialPitchCount?: number;
  homeRunAddsRunAndRbi?: boolean;
  flowKey?: string | null;
}

export function usePlayFlow({
  onEvent,
  activePosition,
  initialPitchCount = 0,
  homeRunAddsRunAndRbi = true,
  flowKey,
}: UsePlayFlowOptions) {
  const [battingState, setBattingState] = useState<'IDLE_AT_BAT' | 'ON_BASE' | 'PA_COMPLETE'>('IDLE_AT_BAT');
  const [runnerOnBase, setRunnerOnBase] = useState(false);
  const [pitchingState, setPitchingState] = useState<'PITCHING_ACTIVE' | 'BATTER_RESOLVED'>('PITCHING_ACTIVE');
  const [balls, setBalls] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [pitchCount, setPitchCount] = useState(initialPitchCount);

  type FlowSnapshot = {
    battingState: 'IDLE_AT_BAT' | 'ON_BASE' | 'PA_COMPLETE';
    runnerOnBase: boolean;
    pitchingState: 'PITCHING_ACTIVE' | 'BATTER_RESOLVED';
    balls: number;
    strikes: number;
    pitchCount: number;
  };
  const flowSnapshots = useRef(new Map<string, FlowSnapshot>());
  const activeFlowKey = flowKey ?? '__default__';
  const lastRenderedKey = useRef(activeFlowKey);

  // Persist state only while rendering the key that owns it. When the key changes,
  // skip saving the old React state under the newly selected inning's key.
  useEffect(() => {
    if (lastRenderedKey.current !== activeFlowKey) return;
    flowSnapshots.current.set(activeFlowKey, {
      battingState,
      runnerOnBase,
      pitchingState,
      balls,
      strikes,
      pitchCount,
    });
  }, [activeFlowKey, battingState, runnerOnBase, pitchingState, balls, strikes, pitchCount]);

  useEffect(() => {
    if (lastRenderedKey.current === activeFlowKey) return;

    const snapshot = flowSnapshots.current.get(activeFlowKey);
    lastRenderedKey.current = activeFlowKey;
    setBattingState(snapshot?.battingState ?? 'IDLE_AT_BAT');
    setRunnerOnBase(snapshot?.runnerOnBase ?? false);
    setPitchingState(snapshot?.pitchingState ?? 'PITCHING_ACTIVE');
    setBalls(snapshot?.balls ?? 0);
    setStrikes(snapshot?.strikes ?? 0);
    setPitchCount(snapshot?.pitchCount ?? initialPitchCount);
  }, [activeFlowKey, initialPitchCount]);

  const isPrimaryEventDisabled = battingState !== 'IDLE_AT_BAT';
  const isHitDisabled = isPrimaryEventDisabled;
  const isBaserunningDisabled = !runnerOnBase;
  const isRunDisabled = !runnerOnBase;
  const isRbiDisabled = false;
  const isPitchCounterDisabled = pitchingState !== 'PITCHING_ACTIVE';
  const isPitchingTerminalDisabled = pitchingState !== 'PITCHING_ACTIVE';
  const isIndependentPitchActionDisabled = false;
  const isCatcherActionDisabled = activePosition !== 'C' && activePosition !== 'Catcher (C)';

  const handlePrimaryBattingEvent = (code: PrimaryBattingCode) => {
    if (isPrimaryEventDisabled) return;

    onEvent('batting', code);
    if (code === 'homeRun') {
      setRunnerOnBase(false);
      if (homeRunAddsRunAndRbi) {
        onEvent('batting', 'rbi');
        onEvent('batting', 'run');
      }
      setBattingState('PA_COMPLETE');
      return;
    }

    if (
      code === 'single' ||
      code === 'double' ||
      code === 'triple' ||
      code === 'walk' ||
      code === 'intentionalWalk' ||
      code === 'hbp' ||
      code === 'reachedOnError' ||
      code === 'fieldersChoice'
    ) {
      setRunnerOnBase(true);
      setBattingState('PA_COMPLETE');
      return;
    }

    setBattingState('PA_COMPLETE');
  };

  const handleBaserunningEvent = (code: 'stolenBase' | 'cs') => {
    if (isBaserunningDisabled) return;
    onEvent('batting', code);
    if (code === 'cs') setRunnerOnBase(false);
  };

  const handleRbi = () => onEvent('batting', 'rbi');

  const handleRun = () => {
    if (isRunDisabled) return;
    onEvent('batting', 'run');
    setRunnerOnBase(false);
  };

  const nextPlateAppearance = () => setBattingState('IDLE_AT_BAT');

  const recordPitch = (code: 'pitchBall' | 'pitchStrike' | 'pitchFoul' | 'pitchOther') => {
    onEvent('pitching', code);
    setPitchCount((count) => count + 1);
  };

  const handlePitchBall = () => {
    if (isPitchCounterDisabled) return;
    recordPitch('pitchBall');
    const nextBalls = balls + 1;
    if (nextBalls >= 4) {
      setBalls(nextBalls);
      onEvent('pitching', 'walkAllowed', { autoOutcome: true });
      setPitchingState('BATTER_RESOLVED');
    } else {
      setBalls(nextBalls);
    }
  };

  const handlePitchStrike = () => {
    if (isPitchCounterDisabled) return;
    recordPitch('pitchStrike');
    const nextStrikes = strikes + 1;
    if (nextStrikes >= 3) {
      setStrikes(nextStrikes);
      onEvent('pitching', 'strikeout', { autoOutcome: true });
      setPitchingState('BATTER_RESOLVED');
    } else {
      setStrikes(nextStrikes);
    }
  };

  const handlePitchFoul = () => {
    if (isPitchCounterDisabled) return;
    recordPitch('pitchFoul');
    setStrikes((count) => Math.min(2, count + 1));
  };

  const handlePitchingTerminal = (code: PitchingTerminalCode) => {
    if (isPitchingTerminalDisabled) return;
    onEvent('pitching', code);
    if (code === 'hitBatter') {
      setPitchCount((count) => count + 1);
      setBalls((b) => Math.min(4, b + 1));
    } else if (
      code === 'hitAllowed' ||
      code === 'homeRunAllowed' ||
      code === 'pitchOut' ||
      code === 'strikeout'
    ) {
      setPitchCount((count) => count + 1);
      setStrikes((s) => Math.min(3, s + 1));
    } else if (code === 'walkAllowed') {
      setPitchCount((count) => count + 1);
      setBalls((b) => Math.min(4, b + 1));
    }
    setPitchingState('BATTER_RESOLVED');
  };

  const handlePitchingIndependentEvent = (code: PitchingIndependentCode) => {
    onEvent('pitching', code);
    if (code === 'pitchOther') setPitchCount((count) => count + 1);
  };

  const nextPitcherBatter = () => {
    setBalls(0);
    setStrikes(0);
    setPitchingState('PITCHING_ACTIVE');
  };

  const reopenPitcherBatter = (restoredBalls = 0, restoredStrikes = 0) => {
    setBalls(restoredBalls);
    setStrikes(restoredStrikes);
    setPitchingState('PITCHING_ACTIVE');
  };

  const syncPitcherCount = (restoredBalls = 0, restoredStrikes = 0) => {
    setBalls(restoredBalls);
    setStrikes(restoredStrikes);
  };

  // Re-enable batting buttons after a primary batting play is undone/deleted.
  const reopenBatter = (runner: boolean) => {
    setBattingState('IDLE_AT_BAT');
    setRunnerOnBase(runner);
  };

  const restoreRunner = (runner: boolean) => setRunnerOnBase(runner);

  const handleFieldingEvent = (code: Exclude<FieldingPlayCode, CatcherFieldingCode>) => {
    onEvent('fielding', code);
  };

  const handleCatcherEvent = (code: CatcherFieldingCode) => {
    if (isCatcherActionDisabled) return;
    onEvent('fielding', code);
  };

  return {
    battingState,
    pitchingState,
    balls,
    strikes,
    pitchCount,
    isPrimaryEventDisabled,
    isHitDisabled,
    runnerOnBase,
    isBaserunningDisabled,
    isRunDisabled,
    isRbiDisabled,
    isPitchCounterDisabled,
    isPitchingTerminalDisabled,
    isIndependentPitchActionDisabled,
    isCatcherActionDisabled,
    handlePrimaryBattingEvent,
    handleBaserunningEvent,
    handleRbi,
    handleRun,
    nextPlateAppearance,
    handlePitchBall,
    handlePitchStrike,
    handlePitchFoul,
    handlePitchingTerminal,
    handlePitchingIndependentEvent,
    nextPitcherBatter,
    reopenPitcherBatter,
    syncPitcherCount,
    reopenBatter,
    restoreRunner,
    handleFieldingEvent,
    handleCatcherEvent,
  };
}
