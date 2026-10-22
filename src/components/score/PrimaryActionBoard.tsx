import React from 'react';
import { ChevronRight, Footprints } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { PlayMode, PlayCode } from '../../types/baseball';
import { PRIMARY_BATTING_CODES } from './scoreTabConstants';
import { PitchingBoard } from '../PitchingBoard';
import { getPlaysForMode } from '../../utils/playDefinitions';
import { derivePitchingFlowState, type PitchingAction } from '../../utils/pitchingFlow';
import type { RunnerAdvanceCause } from '../../utils/runnerLifecycle';

interface ActiveRunnerChip {
  inning: number;
  base: 1 | 2 | 3;
  sb: number;
  cause: RunnerAdvanceCause;
  subNumber?: string;
}

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
  currentInning, activeMode, activeRunnerChip, onResumeRunner, currentPlaysForMode,
  onScoringPlay, isPrimaryEventDisabled, onBatterStrike, onBatterBall, onOpenFoulTapper,
  pitchFlowState, pitchLimit, dailyPitches, onPitchingAction, endedOnRunnerOut,
}) => {
  const { liveGame, activeProfile, setInningBench } = useGame();
  if (!liveGame) return null;
  const isBenchedCurrentInning = liveGame.benchInnings.includes(currentInning);
  return (
      {activeMode === 'batting' ? (
        isBenchedCurrentInning ? (
          <div className="rounded-md border border-slate-300 dark:border-[#354050] bg-slate-100/70 dark:bg-[#252D38]/20 p-5 text-center space-y-2.5 shadow-2xs">
            <div className="inline-flex px-3 py-0.5 rounded-full text-[13px] font-semibold bg-slate-100/80 dark:bg-[#252D38]/60 text-[#18212D] dark:text-[#D1D5DB]">
              Bench / Resting for Inning {currentInning}
            </div>
            <h3 className="font-semibold text-base text-slate-900 dark:text-[#FAFAFA]">
              {activeProfile.playerName || 'Player'} is on Bench / Resting
            </h3>
            <p className="text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] max-w-sm mx-auto">
              Player batting appearance is paused.
            </p>
            <button
              type="button"
              onClick={() => {
                if (liveGame.benchInnings.includes(currentInning)) setInningBench(currentInning, false);
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] active:scale-95 text-[#18212D] dark:text-[#101419] text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Back in Game
            </button>
          </div>
        ) : activeRunnerChip?.inning === currentInning ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                onResumeRunner();
                
              }}
              className="w-full rounded-lg border border-[#00BFA5]/70 dark:border-[#00D7BC]/60 bg-white dark:bg-[#252D38] p-3.5 text-left shadow-sm hover:border-[#00BFA5] dark:hover:border-[#00D7BC] hover:shadow-md transition-all active:scale-[0.99] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#246BFD] dark:focus-visible:ring-[#3478FF]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-[#18212D] dark:text-[#D1D5DB] bg-[#00BFA5]/20  dark:bg-[#00D7BC]/40 py-1.5 px-3 rounded-xl">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#00BFA5] dark:bg-[#00D7BC]" />
                  <span className="font-medium flex">Play in Progress</span>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] px-3 py-2 text-xs font-bold text-[#18212D] dark:text-[#101419] shadow-sm">
                  <Footprints className="h-4 w-4" />
                  Manage Runner
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 font-semibold text-slate-950 dark:text-[#FAFAFA] text-sm sm:text-base flex items-center gap-2">
                <Footprints className="w-5 h-5 text-[#246BFD] dark:text-[#3478FF] shrink-0" />
                <span>{activeProfile.playerName || 'Player'} safe on {activeRunnerChip.base === 1 ? '1st' : activeRunnerChip.base === 2 ? '2nd' : '3rd'} Base</span>
              </div>
            </button>

          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5 pb-1">
            {PRIMARY_BATTING_CODES.map((code) => {
              const labels: Record<string, [string, string]> = {
                single: ['Single', '1B'],
                double: ['Double', '2B'],
                triple: ['Triple', '3B'],
                homeRun: ['Home Run', 'HR'],
                walk: ['Walk', 'BB'],
                hbp: ['Hit Batter', 'HBP'],
                out: ['Out', 'OUT'],
                catchersInterference: ['Catcher Int.', 'CI'],
              };
              const [label, subtitle] = labels[code];

              // Neutral scoring cards keep the action grid calm; the code carries the brand accent.
              const buttonColor = 'h-[72px] min-h-[72px] max-h-[72px] box-border rounded-lg p-1.5 flex flex-col items-center justify-center text-center transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-slate-300/90 dark:border-[#354050] bg-white dark:bg-[#252D38] text-[#18212D] dark:text-[#FAFAFA] hover:border-[#00BFA5]/70 dark:hover:border-[#00D7BC]/70 hover:bg-slate-50 dark:hover:bg-[#2D3643] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#246BFD] dark:focus-visible:ring-[#3478FF]';


              return (
                <div key={code} className="relative">
                  <button
                    type="button"
                    onClick={() => onScoringPlay(code)}
                    disabled={isPrimaryEventDisabled}
                    className={`w-full h-[72px] min-h-[72px] max-h-[72px] box-border rounded-md p-1.5 text-center flex flex-col items-center justify-center transition-[transform,filter] active:scale-[0.97] active:brightness-90 disabled:opacity-40 cursor-pointer ${buttonColor}`}
                  >
                    <span className="text-[14px] sm:text-[15px] font-semibold leading-tight tracking-tight text-[#18212D] dark:text-[#FAFAFA]">{label}</span>
                    <span className="mt-1 text-[10px] sm:text-[11px] font-semibold tracking-wide text-slate-600 dark:text-[#D1D5DB]">{subtitle}</span>
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={onBatterStrike}
              disabled={isPrimaryEventDisabled}
              className="h-[72px] min-h-[72px] max-h-[72px] box-border rounded-md border border-slate-300/90 dark:border-[#354050] bg-white dark:bg-[#252D38] p-1.5 text-center flex flex-col items-center justify-center transition-colors hover:border-[#00BFA5]/70 dark:hover:border-[#00D7BC]/70 hover:bg-slate-50 dark:hover:bg-[#2D3643] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              title="Record a strike seen by the batter; does not affect pitching or fielding statistics"
            >
              <span className="text-[14px] sm:text-[15px] font-semibold leading-tight text-[#18212D] dark:text-[#FAFAFA]">Strike</span>
              <span className="mt-1 text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">K</span>
            </button>
            <button
              type="button"
              onClick={onBatterBall}
              disabled={isPrimaryEventDisabled}
              className="h-[72px] min-h-[72px] max-h-[72px] box-border rounded-md border border-slate-300/90 dark:border-[#354050] bg-white dark:bg-[#252D38] p-1.5 text-center flex flex-col items-center justify-center transition-colors hover:border-[#00BFA5]/70 dark:hover:border-[#00D7BC]/70 hover:bg-slate-50 dark:hover:bg-[#2D3643] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              title="Record a ball received by the batter; does not affect pitching or fielding statistics"
            >
              <span className="text-[14px] sm:text-[15px] font-semibold leading-tight text-[#18212D] dark:text-[#FAFAFA]">Ball</span>
              <span className="mt-1 text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">B</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenFoulTapper()}
              disabled={isPrimaryEventDisabled}
              className="h-[72px] min-h-[72px] max-h-[72px] box-border rounded-md border border-slate-300/90 dark:border-[#354050] bg-white dark:bg-[#252D38] p-1.5 text-center flex flex-col items-center justify-center transition-colors hover:border-[#00BFA5]/70 dark:hover:border-[#00D7BC]/70 hover:bg-slate-50 dark:hover:bg-[#2D3643] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              title="Record a foul ball and map where it went without ending the plate appearance"
            >
              <span className="text-[14px] sm:text-[15px] font-semibold leading-tight text-[#18212D] dark:text-[#FAFAFA]">Foul</span>
              <span className="mt-1 text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">F</span>
            </button>
          </div>
        )
      ) : activeMode === 'pitching' ? (
        isBenchedCurrentInning ? (
          <div className="rounded-md border border-slate-300 dark:border-[#354050] bg-slate-100/70 dark:bg-[#252D38]/20 p-5 text-center space-y-2.5 shadow-2xs">
            <div className="inline-flex px-3 py-0.5 rounded-full text-[13px] font-semibold bg-slate-100/80 dark:bg-[#252D38]/60 text-[#18212D] dark:text-[#D1D5DB]">
              Bench / Resting for Inning {currentInning}
            </div>
            <h3 className="font-semibold text-base text-slate-900 dark:text-[#FAFAFA]">
              {activeProfile.playerName || 'Player'} is on Bench / Resting
            </h3>
            <p className="text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] max-w-sm mx-auto">
              Player pitching appearance is paused.
            </p>
            <button
              type="button"
              onClick={() => {
                if (liveGame.benchInnings.includes(currentInning)) setInningBench(currentInning, false);
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] active:scale-95 text-[#18212D] dark:text-[#101419] text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Back in Game
            </button>
          </div>
        ) : (
          <>


            <PitchingBoard
              state={pitchFlowState}
              pitchLimit={pitchLimit}
              dailyPitches={dailyPitches}
              onAction={onPitchingAction}
              endedOnRunnerOut={endedOnRunnerOut}
            />
          </>
        )
      ) : (
        isBenchedCurrentInning ? (
          <div className="rounded-md border border-slate-300 dark:border-[#354050] bg-slate-100/70 dark:bg-[#252D38]/20 p-5 text-center space-y-2.5 shadow-2xs">
            <div className="inline-flex px-3 py-0.5 rounded-full text-[13px] font-semibold bg-slate-100/80 dark:bg-[#252D38]/60 text-[#18212D] dark:text-[#D1D5DB]">
              Bench / Resting for Inning {currentInning}
            </div>
            <h3 className="font-semibold text-base text-slate-900 dark:text-[#FAFAFA]">
              {activeProfile.playerName || 'Player'} is on Bench / Resting
            </h3>
            <p className="text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] max-w-sm mx-auto">
              Player fielding appearance is paused.
            </p>
            <button
              type="button"
              onClick={() => {
                if (liveGame.benchInnings.includes(currentInning)) setInningBench(currentInning, false);
              }}
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
        )
      )}
  );
};
