import React, { useEffect, useState } from 'react';
import { RUNNER_OUT_REASONS, RunnerOutReason } from '../types/baseball';
import {
  RunnerAdvanceCause,
  RunnerBase,
  RunnerLifecycleState,
  getRunnerBaseLabel,
} from '../utils/runnerLifecycle';

export interface RunnerLockdownModalProps {
  playerName: string;
  jerseyNumber?: string;
  state: RunnerLifecycleState;
  inningOuts?: number;
  historyCount?: number;
  onAdvance: (cause: RunnerAdvanceCause) => void;
  onOut: (reason: RunnerOutReason) => void;
  onScore: (cause?: RunnerAdvanceCause) => void;
  onWalkHbp: () => void;
  onThirdOut: () => void;
  onUndo: () => void;
  onHoldOnBase?: () => void;
  onInjurySub?: () => void;
}

// Dynamic state helper labels
const getTargetBaseShort = (base: RunnerBase): string => {
  if (base === 1) return '2B';
  if (base === 2) return '3B';
  return 'Home';
};

const getStealLabel = (base: RunnerBase): string => {
  return base === 3 ? 'Steal Home' : `Steal ${getTargetBaseShort(base)}`;
};

const getPitchMiscueLabel = (base: RunnerBase): string => {
  return base === 3 ? 'Wild Pitch / Balk' : `WP / PB to ${getTargetBaseShort(base)}`;
};

const getHitAdvanceLabel = (base: RunnerBase): string => {
  return base === 3 ? 'Score on Hit' : `Hit to ${getTargetBaseShort(base)}`;
};

const getErrorLabel = (base: RunnerBase): string => {
  return base === 3 ? 'Score on Error' : `Error to ${getTargetBaseShort(base)}`;
};

const getOutLabel = (_base: RunnerBase): string => 'Runner Out';

// Every action button is the same size and shape; only the colour differs.
const TILE_BASE =
  'h-full min-h-0 p-2 rounded-xl active:scale-[0.98] border shadow-2xs flex flex-col items-center justify-center text-center transition-all cursor-pointer';
const TILE_NAVY = `${TILE_BASE} bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] border-[#00BFA5] dark:border-[#00D7BC]`;
const TILE_OUT = `${TILE_BASE} bg-slate-700 dark:bg-[#465160] hover:bg-slate-800 dark:hover:bg-[#354050] text-white border-slate-800 dark:border-[#354050]`;
const TILE_END = `${TILE_BASE} bg-blue-500 hover:bg-blue-600 text-slate-950 border-blue-600`;
const TILE_LABEL = 'text-[clamp(11px,3vw,13px)] font-semibold tracking-tight leading-tight';
const TILE_SUB = 'text-[clamp(9px,2.2vw,10px)] font-extrabold uppercase tracking-wide opacity-80 mt-0.5';

export const RunnerLockdownModal: React.FC<RunnerLockdownModalProps> = ({
  playerName,
  jerseyNumber,
  state,
  onAdvance,
  onOut,
  onScore,
  onWalkHbp,
  onThirdOut,
  onUndo,
  onHoldOnBase,
  onInjurySub,
}) => {
  const [choosingOutReason, setChoosingOutReason] = useState(false);
  const currentBaseLabel = getRunnerBaseLabel(state.base);
  const isAtThird = state.base === 3;

  // Allow closing the modal via Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onHoldOnBase) {
        onHoldOnBase();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onHoldOnBase]);

  const handleSteal = () => {
    if (isAtThird) onScore('steal');
    else onAdvance('steal');
  };

  const handlePitchMiscue = () => {
    if (isAtThird) onScore('balkPitchingError');
    else onAdvance('balkPitchingError');
  };

  const handleHitAdvance = () => {
    if (isAtThird) onScore('teammateHit');
    else onAdvance('teammateHit');
  };

  const handleDefensiveError = () => {
    if (isAtThird) onScore('balkPitchingError');
    else onAdvance('balkPitchingError');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="runner-lockdown-title"
      onClick={onHoldOnBase}
    >
      <div
        className={`w-full max-w-md flex flex-col ${choosingOutReason ? 'max-h-[85vh] h-[85vh]' : 'max-h-[62vh] h-[62vh]'} bg-white dark:bg-[#1A2028] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#354050] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header: Pure text, no icons */}
        <div className="px-3.5 py-2 border-b border-slate-200 dark:border-[#354050] flex items-center justify-between bg-slate-50 dark:bg-[#252D38]/60 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] shrink-0">
              Runner
            </span>
            <h2
              id="runner-lockdown-title"
              className="text-xs sm:text-sm font-semibold text-slate-950 dark:text-[#FAFAFA] leading-tight truncate"
            >
              {playerName}{jerseyNumber ? ` #${jerseyNumber}` : ''}
            </h2>
          </div>

          <div className="text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB] shrink-0">
            Safe on <strong className="font-semibold text-slate-950 dark:text-[#FAFAFA]">{currentBaseLabel}</strong>
            {state.sb > 0 && (
              <span className="ml-1 text-teal-600 dark:text-teal-400 font-semibold">
                ({state.sb} SB)
              </span>
            )}
          </div>
        </div>

        {/* Modal Body: Strictly fit within 50vh, overflow hidden, no scrollbars */}
        <div className="flex-1 overflow-hidden flex flex-col justify-between p-2.5 sm:p-3 gap-2">
          {choosingOutReason ? (
            /* How was the runner put out? Only Caught Stealing counts as a CS. */
            <div className="grid grid-cols-2 auto-rows-[minmax(60px,1fr)] gap-2 flex-1 min-h-0 overflow-y-auto">
              {RUNNER_OUT_REASONS.map((reason) => (
                <button
                  key={reason.code}
                  type="button"
                  onClick={() => {
                    setChoosingOutReason(false);
                    onOut(reason.code);
                  }}
                  className={`${TILE_OUT}${reason.code === 'other' ? ' col-span-2' : ''}`}
                >
                  <span className={TILE_LABEL}>{reason.label}</span>
                  <span className={TILE_SUB}>{reason.sub}</span>
                </button>
              ))}
            </div>
          ) : (
          /* Two rows of three equal buttons */
          <div className="grid grid-cols-3 grid-rows-2 gap-2 flex-1 min-h-0">
            <button type="button" onClick={handleSteal} className={TILE_NAVY}>
              <span className={TILE_LABEL}>{getStealLabel(state.base)}</span>
              <span className={TILE_SUB}>+1 SB</span>
            </button>
            <button type="button" onClick={handlePitchMiscue} className={TILE_NAVY}>
              <span className={TILE_LABEL}>{getPitchMiscueLabel(state.base)}</span>
              <span className={TILE_SUB}>0 SB</span>
            </button>
            <button type="button" onClick={handleHitAdvance} className={TILE_NAVY}>
              <span className={TILE_LABEL}>{getHitAdvanceLabel(state.base)}</span>
              <span className={TILE_SUB}>0 SB</span>
            </button>
            <button type="button" onClick={handleDefensiveError} className={TILE_NAVY}>
              <span className={TILE_LABEL}>{getErrorLabel(state.base)}</span>
              <span className={TILE_SUB}>0 SB</span>
            </button>
            <button type="button" onClick={() => setChoosingOutReason(true)} className={TILE_OUT}>
              <span className={TILE_LABEL}>{getOutLabel(state.base)}</span>
              <span className={TILE_SUB}>+1 Out · Pick Reason</span>
            </button>
            <button type="button" onClick={onThirdOut} className={TILE_END}>
              <span className={TILE_LABEL}>{'Innings Ended'}</span>
              <span className={TILE_SUB}>3rd Out</span>
            </button>
            <button type="button" onClick={onWalkHbp} className={TILE_NAVY} title="Use when a walk or hit-by-pitch forces this runner to advance">
              <span className={TILE_LABEL}>{isAtThird ? 'Score on Walk / HBP' : 'Advance on Walk / HBP'}</span>
              <span className={TILE_SUB}>Forced · 0 SB</span>
            </button>
          </div>
          )}

          {/* Inline Footnote / Utility Row */}
          <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-200 dark:border-[#354050] shrink-0 text-[clamp(10px,2.4vw,11px)]">
            <button
              type="button"
              onClick={choosingOutReason ? () => setChoosingOutReason(false) : onUndo}
              className="px-2 py-1 rounded text-slate-600 dark:text-[#D1D5DB] hover:text-slate-950 dark:hover:text-[#FAFAFA] hover:bg-slate-100 dark:hover:bg-[#252D38] font-semibold transition-colors cursor-pointer"
            >
              {choosingOutReason ? 'Back' : 'Undo'}
            </button>

            <span className="text-slate-300 dark:text-[#465160]">|</span>

            <button
              type="button"
              onClick={onInjurySub || onHoldOnBase}
              className="px-2 py-1 rounded text-slate-600 dark:text-[#D1D5DB] hover:text-slate-950 dark:hover:text-[#FAFAFA] hover:bg-slate-100 dark:hover:bg-[#252D38] font-semibold transition-colors cursor-pointer"
            >
              Injury / Sub
            </button>

            <span className="text-slate-300 dark:text-[#465160]">|</span>

            <button
              type="button"
              onClick={onHoldOnBase}
              className="px-2 py-1 rounded text-slate-600 dark:text-[#D1D5DB] hover:text-slate-950 dark:hover:text-[#FAFAFA] hover:bg-slate-100 dark:hover:bg-[#252D38] font-semibold transition-colors cursor-pointer"
            >
              Hold Base
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};