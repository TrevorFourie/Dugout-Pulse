import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import {
  PitchingAction,
  PitchingFlowState,
  classifyRun,
} from '../utils/pitchingFlow';
import { PitchInPlayModal } from './PitchInPlayModal';
import { ThirdStrikeModal } from './ThirdStrikeModal';
import { WildPitchModal } from './WildPitchModal';

/**
 * Pitching scoring board: a 2x2 primary grid + a row of secondary quick chips.
 *
 *   [ BALL ][ STRIKE ]        Every button adds its own pitch - no manual "+1 Pitch" exists.
 *   [ FOUL ][ IN PLAY ]       IN PLAY opens the stepped modal; the pitch is added when it is saved.
 *   ( WP ) ( PB ) ( BK ) ( Pickoff ) ( + Run )
 */

interface PitchingBoardProps {
  state: PitchingFlowState;
  pitchLimit: number;
  /** Pitcher's total pitches today (this game + earlier games the same day). Falls back to this game's count. */
  dailyPitches?: number;
  onAction: (action: PitchingAction) => void;
  /** Set when the inning ended on a pickoff / caught stealing (no plate appearance completed). */
  endedOnRunnerOut?: boolean;
}

const GRID_BTN =
  'min-h-[92px] rounded-lg p-3 flex flex-col items-center justify-center text-center transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-slate-300/90 dark:border-[#354050] bg-white dark:bg-[#252D38] text-[#18212D] dark:text-[#FAFAFA] hover:border-[#00BFA5]/70 dark:hover:border-[#00D7BC]/70 hover:bg-slate-50 dark:hover:bg-[#2D3643] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#246BFD] dark:focus-visible:ring-[#3478FF]';
const CHIP_BTN =
  'rounded-full border px-3.5 py-2 text-xs font-semibold transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-white text-slate-800 border-slate-300 hover:bg-slate-100 dark:bg-[#252D38] dark:text-[#FAFAFA] dark:border-[#465160] dark:hover:bg-[#354050]';

const SubModal: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  subtitle,
  onClose,
  children,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <section
      role="dialog"
      aria-modal="true"
      className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-[#354050] dark:bg-[#1A2028]"
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC]">Pitching</p>
          <h2 className="text-base font-semibold text-slate-950 dark:text-[#FAFAFA]">{title}</h2>
          {subtitle && <p className="text-[13px] font-semibold text-slate-500 dark:text-[#9CA3AF]">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#252D38]"
        >
          <X className="h-5 w-5" />
        </button>
      </header>
      {children}
    </section>
  </div>
);

export const PitchingBoard: React.FC<PitchingBoardProps> = ({
  state,
  onAction,
  endedOnRunnerOut,
}) => {
  const [inPlayOpen, setInPlayOpen] = useState(false);
  const [wildPitchOpen, setWildPitchOpen] = useState(false);
  const [thirdStrikeOpen, setThirdStrikeOpen] = useState(false);
  const [pickoffOpen, setPickoffOpen] = useState(false);
  const [pickoffTargetBase, setPickoffTargetBase] = useState<'1B' | '2B' | '3B' | 'HOME'>('1B');
  const [runOpen, setRunOpen] = useState(false);
  const [runCount, setRunCount] = useState(1);
  const [runType, setRunType] = useState<'earned' | 'unearned'>('earned');

  const inningOver = state.outs >= 3;

  return (
    <div className="space-y-3">
      {/* Ending the inning is handled by the shared End Inning / End Half button under the board.
          The pitch buttons stay available at all times so a miscounted out never locks the scorer out. */}
      {inningOver && endedOnRunnerOut && (
        <p className="rounded-2xl border border-slate-300 bg-slate-100 p-3 text-center text-[13px] font-semibold text-[#18212D] dark:border-[#354050] dark:bg-[#252D38]/30 dark:text-[#D1D5DB]">
          The inning ended on a runner out, so no batter faced or plate appearance was added. The count resets for the next inning.
        </p>
      )}

      {(
        <>
          {/* Primary 2x2 grid */}
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onAction({ type: 'BALL' })}
              className={`${GRID_BTN} min-h-[92px]`}
            >
              <span className="text-[20px] font-semibold leading-none tracking-tight">Ball</span>
              <span className="mt-1 text-xs font-semibold opacity-80">Pitch Only</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (state.strikes >= 2) {
                  setThirdStrikeOpen(true);
                } else {
                  onAction({ type: 'STRIKE' });
                }
              }}
              className={`${GRID_BTN} min-h-[92px]`}
            >
              <span className="text-[20px] font-semibold leading-none tracking-tight">
                {state.strikes >= 2 ? 'Strike 3' : 'Strike'}
              </span>
              <span className="mt-1 text-xs font-semibold opacity-80">
                {state.strikes >= 2 ? 'Prompts Result' : 'Pitch Only'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onAction({ type: 'FOUL' })}
              className={`${GRID_BTN} min-h-[92px]`}
            >
              <span className="text-[20px] font-semibold leading-none tracking-tight">Foul</span>
              <span className="mt-1 text-xs font-semibold opacity-80">Will Add Strike (max 2)</span>
            </button>
            <button
              type="button"
              onClick={() => setInPlayOpen(true)}
              className={`${GRID_BTN} min-h-[92px]`}
            >
              <span className="text-[20px] font-semibold leading-none tracking-tight">Hit/Out</span>
              <span className="mt-1 text-xs font-semibold opacity-80">Other Action</span>
            </button>

            <button
              type="button"
              className={`${GRID_BTN} min-h-[92px]`}
              onClick={() => setWildPitchOpen(true)}
              title="Wild pitch: choose ball or strike and runner movement"
            >
              <span className="text-[20px] font-semibold leading-none tracking-tight">Wild Pitch</span>
              <span className="mt-1 text-xs font-semibold opacity-80">
                Ball / Strike · Runners
              </span>
            </button>
            <button 
              type="button"
              onClick={() => onAction( { type: 'BALK'} )}
              className={`${GRID_BTN} min-h-[92px]`}
              title="Balk: no pitch, runners advance one base">
              <span className="text-[20px] font-semibold leading-none tracking-tight">Balk</span>
              <span className="mt-1 text-xs font-semibold opacity-80">
                Deadball · Runner(s) Advance · Batter Remains
              </span>
            </button>
            <button 
              type="button"
              onClick={() => setPickoffOpen( true )}
              className={`${GRID_BTN} min-h-[92px]`}
              title="Pickoff attempt / out: no pitch">
              <span className="text-[20px] font-semibold leading-none tracking-tight">Pickoff</span>
              <span className="mt-1 text-xs font-semibold opacity-80">
                Choose Result · No Pitch Count
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRunCount(1);
                setRunType(classifyRun(state) === 'unearned' ? 'unearned' : 'earned');
                setRunOpen(true);
              }}
              className={`${GRID_BTN} min-h-[92px]`}
              title="Run scored on a wild pitch, balk or steal"
            >
              <span className="text-[20px] font-semibold leading-none tracking-tight">+Run</span>
              <span className="mt-1 text-xs font-semibold opacity-80">
                Earned / Unearned
              </span>
            </button>
          </div>
        </>
      )}

      <PitchInPlayModal
        isOpen={inPlayOpen}
        onClose={() => setInPlayOpen(false)}
        onConfirm={(selection) => onAction({ type: 'IN_PLAY', selection })}
      />

      <ThirdStrikeModal
        isOpen={thirdStrikeOpen}
        onClose={() => setThirdStrikeOpen(false)}
        onConfirm={(result) => {
          onAction({ type: 'THIRD_STRIKE', result });
          setThirdStrikeOpen(false);
        }}
      />

      <WildPitchModal
        isOpen={wildPitchOpen}
        onClose={() => setWildPitchOpen(false)}
        currentStrikes={state.strikes}
        currentBalls={state.balls}
        onConfirm={(data) => {
          onAction({
            type: 'WILD_PITCH',
            pitchType: data.pitchType,
            modifier: data.modifier,
            runs: data.runs,
            outs: data.outs,
            droppedThirdStrikeSafe: data.droppedThirdStrikeSafe,
          });
        }}
      />

      {pickoffOpen && (
        <SubModal
          title="Pickoff / Caught Stealing"
          subtitle="No pitch is added. A pickoff out is not a batter faced."
          onClose={() => {
            setPickoffOpen(false);
            setPickoffTargetBase('1B');
          }}
        >
          <div className="space-y-3">
            {/* Base thrown to selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-1.5">
                Base Thrown To
              </label>
              <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#252D38]">
                {(['1B', '2B', '3B', 'HOME'] as const).map((base) => (
                  <button
                    key={base}
                    type="button"
                    onClick={() => setPickoffTargetBase(base)}
                    className={`py-2 text-xs font-semibold rounded-md transition-all ${
                      pickoffTargetBase === base
                        ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-[#D1D5DB] dark:hover:text-[#FAFAFA]'
                    }`}
                  >
                    {base === 'HOME' ? 'Home' : base}
                  </button>
                ))}
              </div>
            </div>

            {/* Play outcome buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  onAction({
                    type: 'PICKOFF',
                    result: 'safe',
                    throwTo: pickoffTargetBase === 'HOME' ? '3B' : pickoffTargetBase,
                  });
                  setPickoffOpen(false);
                  setPickoffTargetBase('1B');
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-slate-300 dark:border-[#354050] dark:bg-[#252D38]/60 transition-all active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <span className="block text-sm font-semibold text-slate-950 dark:text-[#FAFAFA]">
                    Pickoff Attempt — SAFE at {pickoffTargetBase === 'HOME' ? 'Home' : pickoffTargetBase}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 dark:bg-[#354050] text-slate-700 dark:text-[#D1D5DB]">
                    Safe
                  </span>
                </div>
                <span className="block text-[13px] font-medium text-slate-600 dark:text-[#D1D5DB] mt-0.5">
                  Throw to {pickoffTargetBase === 'HOME' ? 'Home' : pickoffTargetBase}; runner safe. No pitch count.
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onAction({
                    type: 'PICKOFF',
                    result: 'out',
                    kind: 'pickoff',
                    throwTo: pickoffTargetBase === 'HOME' ? '3B' : pickoffTargetBase,
                  });
                  setPickoffOpen(false);
                  setPickoffTargetBase('1B');
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-slate-300 dark:border-[#354050] dark:bg-[#252D38]/60 transition-all active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <span className="block text-sm font-semibold text-slate-950 dark:text-[#FAFAFA]">
                    Runner Picked Off — OUT at {pickoffTargetBase === 'HOME' ? 'Home' : pickoffTargetBase}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]">
                    Out
                  </span>
                </div>
                <span className="block text-[13px] font-medium text-slate-600 dark:text-[#D1D5DB] mt-0.5">
                  Pitcher threw to {pickoffTargetBase === 'HOME' ? 'Home' : pickoffTargetBase} for the out. Pitcher gets assist (A).
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onAction({
                    type: 'PICKOFF',
                    result: 'out',
                    kind: 'caughtStealing',
                    throwTo: pickoffTargetBase,
                  });
                  setPickoffOpen(false);
                  setPickoffTargetBase('1B');
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-slate-300 dark:border-[#354050] dark:bg-[#252D38]/60 transition-all active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <span className="block text-sm font-semibold text-slate-950 dark:text-[#FAFAFA]">
                    Caught Stealing — OUT at {pickoffTargetBase === 'HOME' ? 'Home' : pickoffTargetBase + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]">
                    Out
                  </span>
                </div>
                <span className="block text-[13px] font-medium text-slate-600 dark:text-[#D1D5DB] mt-0.5">
                  Runner thrown out attempting to steal {pickoffTargetBase === 'HOME' ? 'Home' : pickoffTargetBase}.
                </span>
              </button>
            </div>
          </div>
        </SubModal>
      )}

      {runOpen && (
        <SubModal
          title="Run scored"
          subtitle="On a wild pitch, passed ball, balk or steal. Hits and errors have their own run counter."
          onClose={() => setRunOpen(false)}
        >
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-1.5">
                Number of Runs
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRunCount(n)}
                    className={`rounded-xl border py-2.5 text-base font-semibold cursor-pointer transition-all active:scale-95 ${
                      runCount === n
                        ? 'border-[#00BFA5] bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-[#465160] dark:bg-[#252D38] dark:text-[#FAFAFA] dark:hover:bg-[#354050]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-1.5">
                Run Type
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-[#252D38] rounded-2xl">
                <button
                  type="button"
                  onClick={() => setRunType('earned')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95 ${
                    runType === 'earned'
                      ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                      : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  <span className="text-sm font-semibold">Earned</span>
                  <span className="text-[11px] font-medium opacity-80">Pitcher ER + R</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRunType('unearned')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95 ${
                    runType === 'unearned'
                      ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                      : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  <span className="text-sm font-semibold">Unearned</span>
                  <span className="text-[11px] font-medium opacity-80">Unearned R only</span>
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-slate-100 dark:bg-[#252D38]/80 px-3 py-2 text-xs font-medium text-slate-600 dark:text-[#D1D5DB]">
              <span className="font-semibold text-slate-900 dark:text-[#FAFAFA]">
                {runType === 'earned' ? 'Earned run (ER)' : 'Unearned run (R)'}
              </span>
              {classifyRun(state) === 'unearned' && (
                <span className="text-slate-500 dark:text-[#9CA3AF]">
                  {' '}— an error or catcher passed ball put a runner on this inning
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onAction({
                  type: 'RUN',
                  runs: runCount,
                  forceUnearned: runType === 'unearned',
                  runType,
                });
                setRunOpen(false);
              }}
              className="w-full rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] px-4 py-3 text-sm font-semibold text-[#18212D] dark:text-[#101419] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] cursor-pointer transition-colors shadow-xs active:scale-[0.99]"
            >
              Record {runCount} {runType === 'earned' ? 'Earned' : 'Unearned'} Run{runCount > 1 ? 's' : ''}
            </button>
          </div>
        </SubModal>
      )}
    </div>
  );
};