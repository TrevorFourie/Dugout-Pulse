import React from 'react';
import type { PlayCode } from '../../types/baseball';
import { getPlaysForMode } from '../../utils/playDefinitions';

interface Props {
  currentInning: number;
  isBenchedCurrentInning: boolean;
  playerName: string;
  onReturnFromBench: () => void;
  currentPlaysForMode: ReturnType<typeof getPlaysForMode>;
  onScoringPlay: (code: PlayCode) => void;
}

export const FieldingActionBoard: React.FC<Props> = ({ currentInning, isBenchedCurrentInning, playerName, onReturnFromBench, currentPlaysForMode, onScoringPlay }) => (
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
              Player fielding appearance is paused.
            </p>
            <button
              type="button"
              onClick={onReturnFromBench}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] active:scale-95 text-[#18212D] dark:text-[#101419] text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Back in Game
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Dynamic Button Grid based on Active Position */}
            <div className="grid grid-cols-4 gap-1.5">
              {currentPlaysForMode.map((def) => {
                return (
                  <button
                    key={def.code}
                    type="button"
                    onClick={() => onScoringPlay(def.code)}
                    className="h-[72px] min-h-[72px] max-h-[72px] box-border rounded-lg p-1.5 flex flex-col items-center justify-center text-center transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-slate-300/90 dark:border-[#354050] bg-white dark:bg-[#252D38] text-[#18212D] dark:text-[#FAFAFA] hover:border-[#00BFA5]/70 dark:hover:border-[#00D7BC]/70 hover:bg-slate-50 dark:hover:bg-[#2D3643] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#246BFD] dark:focus-visible:ring-[#3478FF]"
                  >
                    <span className="text-[13px] sm:text-[14px] font-semibold leading-tight tracking-tight text-[#18212D] dark:text-[#FAFAFA]">{def.fullLabel}</span>
                    <span className="text-[10px] sm:text-[11px] font-semibold leading-tight text-center mt-1 text-slate-600 dark:text-[#D1D5DB]">{def.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
  </>
);
