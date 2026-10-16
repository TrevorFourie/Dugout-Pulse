import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { DefensivePosition } from '../types/baseball';
import {
  InPlayOutcome,
  InPlaySelection,
  PitcherFieldingAction,
  ThrowTarget,
} from '../utils/pitchingFlow';

/**
 * Level 2 stepped modal for "IN PLAY / ACTION".
 *
 *   Step 1  Primary outcome   (Out / Hit Allowed 1B-2B-3B-HR / Fielder's Choice / Error / HBP / IBB)
 *   Step 2  Was the pitcher directly involved in fielding or receiving the ball?   (Out, FC, Error)
 *   Step 3  What did the pitcher do?  (fielded / covered a base / caught a fly)    (only if "Yes")
 *
 * The pitch itself is added by the outcome - there is no separate "+1 Pitch" tap. Nothing is
 * recorded until the final confirm, so cancelling at any step leaves the pitch count untouched.
 */

interface PitchInPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selection: InPlaySelection) => void;
}

type Step = 'outcome' | 'involvement' | 'action';
type PitcherMultiOutAction = 'catch' | 'tag' | 'step' | 'throw';

const MULTI_OUT_ACTIONS: { action: PitcherMultiOutAction; title: string; description: string }[] = [
  { action: 'catch', title: 'Caught the ball', description: 'Caught a fly ball or line drive for an out (Putout)' },
  { action: 'tag', title: 'Tagged a runner', description: 'Recorded an out by tagging a runner (Putout)' },
  { action: 'step', title: 'Stepped on a base', description: 'Recorded an out by touching a base, including a force or appeal play (Putout)' },
  { action: 'throw', title: 'Threw to a base', description: 'Made a throw that helped complete the play (Assist)' },
];

const HIT_OPTIONS: { bases: 1 | 2 | 3 | 4; label: string }[] = [
  { bases: 1, label: 'Single' },
  { bases: 2, label: 'Double' },
  { bases: 3, label: 'Triple' },
  { bases: 4, label: 'Home Run' },
];

const THROW_TARGETS: { value: ThrowTarget; label: string }[] = [
  { value: '1B', label: '1st' },
  { value: '2B', label: '2nd' },
  { value: '3B', label: '3rd' },
  { value: 'HOME', label: 'Home' },
  { value: 'unassisted', label: 'Tagged / made the play himself' },
];

const ASSIST_FROM: DefensivePosition[] = ['1B', '2B', '3B', 'SS', 'C'];

const CARD =
  'w-full rounded-2xl border p-3.5 text-left transition-all active:scale-[0.99] cursor-pointer';
const CARD_OFF =
  'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 dark:border-[#354050] dark:bg-[#252D38]/60 dark:text-[#FAFAFA]';
const CARD_ON = 'border-[#00BFA5] bg-teal-50 text-slate-950 dark:bg-[#00D7BC]/15 dark:text-[#FAFAFA]';
const CHIP =
  'rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer';
const CHIP_OFF =
  'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#465160] dark:bg-[#252D38] dark:text-[#D1D5DB]';
const CHIP_ON = 'border-[#00BFA5] bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]';

export const PitchInPlayModal: React.FC<PitchInPlayModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [step, setStep] = useState<Step>('outcome');
  const [outcome, setOutcome] = useState<InPlayOutcome | null>(null);
  const [hitBases, setHitBases] = useState<1 | 2 | 3 | 4>(1);
  const [runs, setRuns] = useState(0);
  const [extraOuts, setExtraOuts] = useState<'none' | 'doublePlay' | 'triplePlay'>('none');
  const [involved, setInvolved] = useState<boolean | null>(null);
  const [action, setAction] = useState<PitcherFieldingAction | null>(null);
  const [throwTo, setThrowTo] = useState<ThrowTarget>('1B');
  const [assistFrom, setAssistFrom] = useState<DefensivePosition>('1B');
  const [multiOutActions, setMultiOutActions] = useState<PitcherMultiOutAction[]>([]);

  const reset = () => {
    setStep('outcome');
    setOutcome(null);
    setHitBases(1);
    setRuns(0);
    setExtraOuts('none');
    setInvolved(null);
    setAction(null);
    setThrowTo('1B');
    setAssistFrom('1B');
    setMultiOutActions([]);
  };

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen]);

  if (!isOpen) return null;

  const isHomeRun = outcome === 'hit' && hitBases === 4;
  const minRuns = isHomeRun ? 1 : 0;
  const effectiveRuns = Math.max(runs, minRuns);
  const needsFieldingSteps = outcome === 'out' || outcome === 'fieldersChoice' || outcome === 'error';
  const isMultiOut = outcome === 'out' && extraOuts !== 'none';
  const maxMultiOutActions = extraOuts === 'triplePlay' ? 3 : 2;

  const addMultiOutAction = (action: PitcherMultiOutAction) => {
    setMultiOutActions((previous) => previous.length >= maxMultiOutActions ? previous : [...previous, action]);
  };

  const removeMultiOutAction = (action: PitcherMultiOutAction) => {
    setMultiOutActions((previous) => {
      const index = previous.lastIndexOf(action);
      return index < 0 ? previous : previous.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const cancel = () => {
    reset();
    onClose();
  };

  const finish = (extra: Partial<InPlaySelection> = {}) => {
    if (!outcome) return;
    onConfirm({
      outcome,
      hitBases: outcome === 'hit' ? hitBases : undefined,
      runs: effectiveRuns,
      extraOuts: outcome === 'out' ? extraOuts : 'none',
      ...extra,
    });
    reset();
    onClose();
  };

  const creditSummary = (): string => {
    if (!involved || !action) return 'No pitcher fielding credit.';
    if (outcome === 'error') return 'Error charged to the pitcher (E).';
    if (action === 'covered') return `Pitcher: Putout (PO) · ${assistFrom}: Assist (A)`;
    if (action === 'caught') return 'Pitcher: Putout (PO), unassisted';
    if (throwTo === 'unassisted') return 'Pitcher: Putout (PO)';
    return `Pitcher: Assist (A) · ${throwTo === 'HOME' ? 'Catcher' : throwTo}: Putout (PO)`;
  };

  const stepNumber = step === 'outcome' ? 1 : step === 'involvement' ? 2 : 3;
  const stepCount = needsFieldingSteps ? (involved ? 3 : 2) : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pitch-in-play-title"
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-[#354050] dark:bg-[#1A2028]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#354050] dark:bg-[#252D38]/60">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC]">
              In Play · Step {stepNumber}{needsFieldingSteps ? ` of ${stepCount}` : ''}
            </p>
            <h2 id="pitch-in-play-title" className="text-base font-semibold text-slate-950 dark:text-[#FAFAFA]">
              {step === 'outcome' && 'What happened on the pitch?'}
              {step === 'involvement' && 'Was the pitcher involved in the play?'}
              {step === 'action' && 'What did the pitcher do?'}
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF]">
              The pitch (+1) is added automatically when you record the play.
            </p>
          </div>
          <button
            type="button"
            onClick={cancel}
            aria-label="Cancel"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-[#354050]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {/* ------------------------------ Step 1 ------------------------------ */}
          {step === 'outcome' && (
            <>
              <button
                type="button"
                onClick={() => { setOutcome('out'); setMultiOutActions([]); setAction(null); }}
                className={`${CARD} ${outcome === 'out' ? CARD_ON : CARD_OFF}`}
              >
                <span className="block text-sm font-semibold">Out Recorded</span>
                <span className="block text-[11px] font-medium opacity-75">
                  Strikeout is automatic on strike three — use this for ground, fly, line and pop outs.
                </span>
              </button>
              {outcome === 'out' && (
                <div className="flex flex-wrap items-center gap-1.5 pl-1">
                  <span className="text-[11px] font-semibold text-slate-500">Multiple outs:</span>
                  {([
                    ['none', 'Single out'],
                    ['doublePlay', 'Double play'],
                    ['triplePlay', 'Triple play'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setExtraOuts(value); setMultiOutActions([]); }}
                      className={`${CHIP} ${extraOuts === value ? CHIP_ON : CHIP_OFF}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setOutcome('hit')}
                className={`${CARD} ${outcome === 'hit' ? CARD_ON : CARD_OFF}`}
              >
                <span className="block text-sm font-semibold">Hit Allowed</span>
                <span className="block text-[11px] font-medium opacity-75">
                  Single, double, triple or home run.
                </span>
              </button>
              {outcome === 'hit' && (
                <div className="grid grid-cols-4 gap-1.5">
                  {HIT_OPTIONS.map((hit) => (
                    <button
                      key={hit.bases}
                      type="button"
                      onClick={() => setHitBases(hit.bases)}
                      className={`${CHIP} py-2.5 ${hitBases === hit.bases ? CHIP_ON : CHIP_OFF}`}
                    >
                      {hit.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOutcome('fieldersChoice')}
                  className={`${CARD} ${outcome === 'fieldersChoice' ? CARD_ON : CARD_OFF}`}
                >
                  <span className="block text-sm font-semibold">Fielder's Choice</span>
                  <span className="block text-[11px] font-medium opacity-75">Batter safe, runner out</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOutcome('error')}
                  className={`${CARD} ${outcome === 'error' ? CARD_ON : CARD_OFF}`}
                >
                  <span className="block text-sm font-semibold">Defensive Error</span>
                  <span className="block text-[11px] font-medium opacity-75">Batter safe, no out</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOutcome('hitBatter')}
                  className={`${CARD} py-2.5 ${outcome === 'hitBatter' ? CARD_ON : CARD_OFF}`}
                >
                  <span className="block text-sm font-semibold">Hit Batter</span>
                  <span className="block text-[11px] font-medium opacity-75">Pitch hit batter (HBP)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOutcome('intentionalWalk')}
                  className={`${CARD} py-2.5 ${outcome === 'hitBatter' ? CARD_ON : CARD_OFF}`}
                >
                  <span className="block text-sm font-semibold">Intentional Walk</span>
                  <span className="block text-[11px] font-medium opacity-75">No Pitch, batter walks</span>
                </button>
              </div>

              {outcome && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-800/60 dark:bg-blue-950/30">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-950 dark:text-blue-200">
                      Runs scoring on this play
                    </span>
                    <span className="text-[10px] font-semibold text-blue-800 dark:text-blue-300">
                      Earned / unearned is worked out for you
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[0, 1, 2, 3, 4].map((n) => {
                      const disabled = n < minRuns;
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={disabled}
                          onClick={() => setRuns(n)}
                          className={`${CHIP} py-2 disabled:cursor-not-allowed disabled:opacity-30 ${
                            effectiveRuns === n ? CHIP_ON : CHIP_OFF
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                  {isHomeRun && (
                    <p className="mt-1.5 text-[10px] font-semibold text-blue-800 dark:text-blue-300">
                      Home run: the batter's run is included (minimum 1).
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* ------------------------------ Step 2 ------------------------------ */}
          {step === 'involvement' && (
            <>
              <p className="text-sm font-semibold text-slate-700 dark:text-[#D1D5DB]">
                Was the pitcher directly involved in fielding or receiving the ball?
              </p>
              <button
                type="button"
                onClick={() => {
                  setInvolved(false);
                  finish({ pitcherInvolved: false });
                }}
                className={`${CARD} ${CARD_OFF}`}
              >
                <span className="block text-sm font-semibold">No / Standard Play</span>
                <span className="block text-[11px] font-medium opacity-75">
                  Another fielder handled it. Records the out only.
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInvolved(true);
                  setStep('action');
                }}
                className={`${CARD} ${CARD_OFF}`}
              >
                <span className="block text-sm font-semibold">Yes — Pitcher Involved</span>
                <span className="block text-[11px] font-medium opacity-75">
                  Choose what the pitcher did to assign the putout / assist.
                </span>
              </button>
            </>
          )}

          {/* ------------------------------ Step 3 ------------------------------ */}
          {step === 'action' && isMultiOut && (
            <div className="space-y-2.5">
              <p className="text-sm font-semibold text-slate-700 dark:text-[#D1D5DB]">
                Select what the pitcher did on this {extraOuts === 'triplePlay' ? 'triple play' : 'double play'}.
              </p>
              {MULTI_OUT_ACTIONS.filter((option) => extraOuts === 'triplePlay' || option.action !== 'tag').map((option) => {
                const count = multiOutActions.filter((selected) => selected === option.action).length;
                return (
                  <div key={option.action} className={`w-full rounded-md border px-3 py-3 transition-all ${count > 0 ? 'border-[#00BFA5] dark:border-[#00D7BC] bg-[#00BFA5]/10 dark:bg-[#00D7BC]/10' : 'border-slate-300 dark:border-[#354050]'}`}>
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">{option.title}</span>
                        <span className="block text-xs text-slate-600 dark:text-[#D1D5DB]">{option.description}</span>
                        {count > 0 && <span className="mt-1 block text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC]">Selected {count} {count === 1 ? 'time' : 'times'}</span>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" onClick={() => removeMultiOutAction(option.action)} disabled={count === 0} aria-label={`Remove one: ${option.title}`} className="h-9 w-9 rounded-md border border-slate-300 dark:border-[#465160] text-lg font-semibold text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] disabled:opacity-30 disabled:cursor-not-allowed">−</button>
                        <span className="w-5 text-center text-sm font-bold tabular-nums text-slate-900 dark:text-[#FAFAFA]">{count}</span>
                        <button type="button" onClick={() => addMultiOutAction(option.action)} disabled={multiOutActions.length >= maxMultiOutActions} aria-label={`Add one: ${option.title}`} className="h-9 w-9 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] text-lg font-semibold hover:bg-[#00A892] dark:hover:bg-[#00C4AB] disabled:opacity-30 disabled:cursor-not-allowed">+</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">Maximum {maxMultiOutActions} fielding contributions. Putouts and assists are credited to the pitcher.</p>
            </div>
          )}

          {step === 'action' && !isMultiOut && (
            <>
              <button
                type="button"
                onClick={() => setAction('fielded')}
                className={`${CARD} ${action === 'fielded' ? CARD_ON : CARD_OFF}`}
              >
                <span className="block text-sm font-semibold">Pitcher Fielded Ball</span>
                <span className="block text-[11px] font-medium opacity-75">
                  Grounder back to the mound (1-3, 1-4 ...). Assist if he threw to a base, putout if he made the play.
                </span>
              </button>
              {action === 'fielded' && (
                <div className="flex flex-wrap items-center gap-1.5 pl-1">
                  <span className="text-[11px] font-semibold text-slate-500">Threw to:</span>
                  {THROW_TARGETS.map((target) => (
                    <button
                      key={target.value}
                      type="button"
                      onClick={() => setThrowTo(target.value)}
                      className={`${CHIP} ${throwTo === target.value ? CHIP_ON : CHIP_OFF}`}
                    >
                      {target.label}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setAction('covered')}
                className={`${CARD} ${action === 'covered' ? CARD_ON : CARD_OFF}`}
              >
                <span className="block text-sm font-semibold">Pitcher Covered Base</span>
                <span className="block text-[11px] font-medium opacity-75">
                  3-1 play: 1B fields it and throws to the pitcher covering first. Putout to the pitcher, assist to the fielder.
                </span>
              </button>
              {action === 'covered' && (
                <div className="flex flex-wrap items-center gap-1.5 pl-1">
                  <span className="text-[11px] font-semibold text-slate-500">Thrown by:</span>
                  {ASSIST_FROM.map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setAssistFrom(pos)}
                      className={`${CHIP} ${assistFrom === pos ? CHIP_ON : CHIP_OFF}`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setAction('caught')}
                className={`${CARD} ${action === 'caught' ? CARD_ON : CARD_OFF}`}
              >
                <span className="block text-sm font-semibold">Pitcher Caught Fly / Popup</span>
                <span className="block text-[11px] font-medium opacity-75">
                  Unassisted (1). Putout to the pitcher.
                </span>
              </button>

              {action && (
                <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-[#252D38] dark:text-[#D1D5DB]">
                  {creditSummary()}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-slate-200 p-3 dark:border-[#354050]">
          {step !== 'outcome' && (
            <button
              type="button"
              onClick={() => setStep(step === 'action' ? 'involvement' : 'outcome')}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#252D38]"
            >
              Back
            </button>
          )}
          {step === 'outcome' && (
            <button
              type="button"
              disabled={!outcome}
              onClick={() => {
                if (!outcome) return;
                if (needsFieldingSteps) setStep('involvement');
                else finish();
              }}
              className="flex-1 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] px-4 py-3 text-sm font-semibold text-[#18212D] dark:text-[#101419] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {needsFieldingSteps ? 'Next' : 'Record Play'}
            </button>
          )}
          {step === 'action' && (
            <button
              type="button"
              disabled={isMultiOut ? multiOutActions.length === 0 : !action}
              onClick={() =>
                finish(isMultiOut ? {
                  pitcherInvolved: true,
                  pitcherMultiOutActions: multiOutActions,
                } : {
                  pitcherInvolved: true,
                  pitcherAction: action ?? undefined,
                  throwTo: action === 'fielded' ? throwTo : undefined,
                  assistFrom: action === 'covered' ? assistFrom : undefined,
                })
              }
              className="flex-1 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] px-4 py-3 text-sm font-semibold text-[#18212D] dark:text-[#101419] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Record Play
            </button>
          )}
        </footer>
      </section>
    </div>
  );
};
