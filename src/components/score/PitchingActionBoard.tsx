import React from 'react';
import { PitchingBoard } from '../PitchingBoard';
import { derivePitchingFlowState, type PitchingAction } from '../../utils/pitchingFlow';

interface Props {
  currentInning: number;
  isBenchedCurrentInning: boolean;
  playerName: string;
  onReturnFromBench: () => void;
  pitchFlowState: ReturnType<typeof derivePitchingFlowState>;
  pitchLimit: number;
  dailyPitches: number;
  onPitchingAction: (action: PitchingAction) => void;
  endedOnRunnerOut: boolean;
}

export const PitchingActionBoard: React.FC<Props> = ({ currentInning, isBenchedCurrentInning, playerName, onReturnFromBench, pitchFlowState, pitchLimit, dailyPitches, onPitchingAction, endedOnRunnerOut }) => (
  <>
    {isBenchedCurrentInning ? (
          <div className="rounded-md border border-slate-300 dark:border-[#354050] bg-slate-100/70 dark:bg-[#252D38]/20 p-5 text-center space-y-2.5 shadow-2xs">
            <div className="inline-flex px-3 py-0.5 rounded-full text-[13px] font-semibold bg-slate-100/80 dark:bg-[#252D38]/60 text-[#18212D] dark:text-[#D1D5DB]">
              Bench / Resting for Inning {currentInning}
            </div>
            <h3 className="font-semibold text-base text-slate-900 dark:text-[#FAFAFA]">
              {playerName || 'Player'} is on Bench / Resting
            </h3>
            <p className="text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] max-w-sm mx-auto">
              Player pitching appearance is paused.
            </p>
            <button
              type="button"
              onClick={onReturnFromBench}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] active:scale-95 text-[#18212D] dark:text-[#101419] text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Back in Game
            </button>
          </div>}
  </>
);
