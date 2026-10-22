import React from 'react';
import { useGame } from '../../context/GameContext';
import type { PlayCode, PlayMode } from '../../types/baseball';
import { getPlaysForMode } from '../../utils/playDefinitions';
import { derivePitchingFlowState, type PitchingAction } from '../../utils/pitchingFlow';
import { BattingActionBoard } from './BattingActionBoard';
import { PitchingActionBoard } from './PitchingActionBoard';
import { FieldingActionBoard } from './FieldingActionBoard';
import type { ActiveRunnerChip } from './scoreTypes';

interface PrimaryActionBoardProps {
  currentInning: number;
  activeMode: PlayMode;
  activeRunnerChip: ActiveRunnerChip | null;
  onResumeRunner: () => void;
  currentPlaysForMode: ReturnType<typeof getPlaysForMode>;
  onScoringPlay: (code: PlayCode) => void;
  isPrimaryEventDisabled: boolean;
  onBatterStrike: () => void;
  onBatterBall: () => void;
  onOpenFoulTapper: () => void;
  pitchFlowState: ReturnType<typeof derivePitchingFlowState>;
  pitchLimit: number;
  dailyPitches: number;
  onPitchingAction: (action: PitchingAction) => void;
  endedOnRunnerOut: boolean;
}

export const PrimaryActionBoard: React.FC<PrimaryActionBoardProps> = ({
  currentInning,
  activeMode,
  activeRunnerChip,
  onResumeRunner,
  currentPlaysForMode,
  onScoringPlay,
  isPrimaryEventDisabled,
  onBatterStrike,
  onBatterBall,
  onOpenFoulTapper,
  pitchFlowState,
  pitchLimit,
  dailyPitches,
  onPitchingAction,
  endedOnRunnerOut,
}) => {
  const { liveGame, activeProfile, setInningBench } = useGame();
  if (!liveGame) return null;

  const isBenchedCurrentInning = liveGame.benchInnings.includes(currentInning);
  const onReturnFromBench = () => {
    if (liveGame.benchInnings.includes(currentInning)) setInningBench(currentInning, false);
  };
  const playerName = activeProfile.playerName || 'Player';

  return (
    <>
      {activeMode === 'batting' && (
        <BattingActionBoard
          currentInning={currentInning}
          isBenchedCurrentInning={isBenchedCurrentInning}
          playerName={playerName}
          activeRunnerChip={activeRunnerChip}
          onResumeRunner={onResumeRunner}
          onScoringPlay={onScoringPlay}
          isPrimaryEventDisabled={isPrimaryEventDisabled}
          onBatterStrike={onBatterStrike}
          onBatterBall={onBatterBall}
          onOpenFoulTapper={onOpenFoulTapper}
          onReturnFromBench={onReturnFromBench}
        />
      )}
      {activeMode === 'pitching' && (
        <PitchingActionBoard
          currentInning={currentInning}
          isBenchedCurrentInning={isBenchedCurrentInning}
          playerName={playerName}
          onReturnFromBench={onReturnFromBench}
          pitchFlowState={pitchFlowState}
          pitchLimit={pitchLimit}
          dailyPitches={dailyPitches}
          onPitchingAction={onPitchingAction}
          endedOnRunnerOut={endedOnRunnerOut}
        />
      )}
      {activeMode === 'fielding' && (
        <FieldingActionBoard
          currentInning={currentInning}
          isBenchedCurrentInning={isBenchedCurrentInning}
          playerName={playerName}
          onReturnFromBench={onReturnFromBench}
          currentPlaysForMode={currentPlaysForMode}
          onScoringPlay={onScoringPlay}
        />
      )}
    </>
  );
};
