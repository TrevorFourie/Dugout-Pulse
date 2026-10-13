import React, { useEffect, useState } from 'react';
import { X, Trophy, ShieldAlert, AlertCircle, UserCheck, UserX } from 'lucide-react';

interface WildPitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStrikes: number;
  currentBalls: number;
  onConfirm: (data: {
    pitchType: 'ball' | 'strike';
    modifier?: 'runScored' | 'runnerOut';
    runs?: number;
    outs?: number;
    droppedThirdStrikeSafe?: boolean;
  }) => void;
}

export const WildPitchModal: React.FC<WildPitchModalProps> = ({
  isOpen,
  onClose,
  currentStrikes,
  currentBalls,
  onConfirm,
}) => {
  const [pitchType, setPitchType] = useState<'ball' | 'strike'>('ball');
  // Optional modifiers: null = baseline (runners advance safely, +1 WP)
  const [selectedModifier, setSelectedModifier] = useState<'runScored' | 'runnerOut' | null>(null);
  const [runsCount, setRunsCount] = useState<number>(1);
  const [outsCount, setOutsCount] = useState<number>(1);
  const [strikeThreeBatterSafe, setStrikeThreeBatterSafe] = useState<boolean>(true);

  const isThirdStrike = pitchType === 'strike' && currentStrikes >= 2;
  const isFourthBall = pitchType === 'ball' && currentBalls >= 3;

  useEffect(() => {
    if (isOpen) {
      setPitchType('ball');
      setSelectedModifier(null);
      setRunsCount(1);
      setOutsCount(1);
      setStrikeThreeBatterSafe(true);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleModifier = (mod: 'runScored' | 'runnerOut') => {
    setSelectedModifier((prev) => (prev === mod ? null : mod));
  };

  const handleSave = () => {
    if (isThirdStrike) {
      if (!strikeThreeBatterSafe) {
        // Batter out at 1st base.
        // Rule 9.13:
        // - If Run Scored modifier is selected: WP is CHARGED (+1 WP, +1 K, +1 Out, +runs R/ER).
        // - If no runner safely advanced/scored: WP is REVERTED (0 WP, +1 K, +1 or +outs Outs).
        if (selectedModifier === 'runScored') {
          onConfirm({
            pitchType: 'strike',
            modifier: 'runScored',
            runs: runsCount,
            droppedThirdStrikeSafe: false,
          });
        } else if (selectedModifier === 'runnerOut') {
          // Secondary runner also thrown out -> +2 Outs (or 1 batter out + outsCount secondary outs), 0 WP
          onConfirm({
            pitchType: 'strike',
            modifier: 'runnerOut',
            outs: 1 + outsCount, // batter out + secondary runner(s) out
            droppedThirdStrikeSafe: false,
          });
        } else {
          // No modifier: batter only thrown out at 1st base -> 0 WP, +1 Out
          onConfirm({
            pitchType: 'strike',
            modifier: 'runnerOut',
            outs: 1,
            droppedThirdStrikeSafe: false,
          });
        }
      } else {
        // Batter safe at 1st base -> always retains +1 WP
        onConfirm({
          pitchType: 'strike',
          modifier: selectedModifier || undefined,
          runs: selectedModifier === 'runScored' ? runsCount : undefined,
          outs: selectedModifier === 'runnerOut' ? outsCount : undefined,
          droppedThirdStrikeSafe: true,
        });
      }
    } else {
      onConfirm({
        pitchType,
        modifier: selectedModifier || undefined,
        runs: selectedModifier === 'runScored' ? runsCount : undefined,
        outs: selectedModifier === 'runnerOut' ? outsCount : undefined,
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="wild-pitch-title"
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-[#354050] dark:bg-[#1A2028]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#354050] dark:bg-[#252D38]/60">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC]">
              Pitching · Wild Pitch
            </p>
            <h2 id="wild-pitch-title" className="text-base font-semibold text-slate-950 dark:text-[#FAFAFA]">
              Wild Pitch Workflow
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF]">
              Pre-records pitch count & +1 WP. Runner advance is automatic.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-[#354050] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {/* Pitch Result: Ball or Swinging Strike */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-1.5">
              Pitch Result *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPitchType('ball')}
                className={`py-3 px-3 rounded-2xl border text-center transition-all cursor-pointer active:scale-95 ${
                  pitchType === 'ball'
                    ? 'border-[#00BFA5] bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-[#465160] dark:bg-[#1A2028] dark:text-[#FAFAFA] dark:hover:bg-[#252D38]'
                }`}
              >
                <div className="text-base font-semibold">Ball</div>
                <div className="text-[11px] opacity-80 mt-0.5 font-medium">
                  +1 Ball {isFourthBall ? '(Ball 4 · Walk)' : `(Count: ${currentBalls + 1})`}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPitchType('strike')}
                className={`py-3 px-3 rounded-2xl border text-center transition-all cursor-pointer active:scale-95 ${
                  pitchType === 'strike'
                    ? 'border-[#00BFA5] bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-[#465160] dark:bg-[#1A2028] dark:text-[#FAFAFA] dark:hover:bg-[#252D38]'
                }`}
              >
                <div className="text-base font-semibold">Swinging Strike</div>
                <div className="text-[11px] opacity-80 mt-0.5 font-medium">
                  +1 Strike {currentStrikes >= 2 ? '(Strike 3!)' : `(Count: ${currentStrikes + 1})`}
                </div>
              </button>
            </div>
          </div>

          {/* Conditional: Strike 3 (Uncaught Third Strike) */}
          {isThirdStrike && (
            <div className="rounded-2xl border border-blue-300 bg-blue-50/70 p-3.5 dark:border-blue-600/60 dark:bg-blue-950/20 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Strike 3 on Wild Pitch (Uncaught 3rd Strike)</span>
              </div>
              <p className="text-[11px] font-medium text-slate-700 dark:text-[#D1D5DB]">
                Batter may run to 1st. Select batter result at 1st base:
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStrikeThreeBatterSafe(true)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    strikeThreeBatterSafe
                      ? 'border-blue-600 bg-white dark:bg-[#1A2028] text-blue-950 dark:text-blue-200 font-semibold shadow-xs ring-1 ring-blue-500'
                      : 'border-blue-200 bg-blue-100/40 text-slate-800 dark:border-blue-800 dark:bg-[#1A2028]/60 dark:text-[#D1D5DB]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-xs font-semibold">Safe at 1st</span>
                  </div>
                  <div className="text-[10px] font-normal opacity-80 mt-1">
                    +1 K · 0 Outs · Retains +1 WP
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStrikeThreeBatterSafe(false)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    !strikeThreeBatterSafe
                      ? 'border-[#00BFA5] bg-white dark:bg-[#1A2028] text-slate-900 dark:text-[#FAFAFA] font-semibold shadow-xs ring-1 ring-[#00BFA5]'
                      : 'border-blue-200 bg-blue-100/40 text-slate-800 dark:border-blue-800 dark:bg-[#1A2028]/60 dark:text-[#D1D5DB]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <UserX className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span className="text-xs font-semibold">Out at 1st</span>
                  </div>
                  <div className="text-[10px] font-normal opacity-80 mt-1">
                    +1 K · +1 Out · Reverts WP (Rule 9.13)
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Selectable Modifiers (Option 2 and Option 3) - NEVER hidden */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-1.5">
              Play Modifiers (Optional)
            </label>
              <div className="space-y-2">
                {/* Option 2: Run Scored from 3rd (+1 Run) */}
                <div
                  className={`rounded-2xl border transition-all ${
                    selectedModifier === 'runScored'
                      ? 'border-[#00BFA5] bg-teal-50/70 dark:border-[#00D7BC] dark:bg-[#00D7BC]/15'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-[#354050] dark:bg-[#252D38]/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleModifier('runScored')}
                    className="w-full p-3 text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-teal-500 shrink-0" />
                        <span className="text-xs font-semibold text-slate-950 dark:text-[#FAFAFA]">
                          Run Scored from 3rd (+{runsCount} Run)
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          selectedModifier === 'runScored'
                            ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]'
                            : 'bg-slate-200 dark:bg-[#354050] text-slate-600 dark:text-[#D1D5DB]'
                        }`}
                      >
                        {selectedModifier === 'runScored' ? 'Selected' : 'Add Modifier'}
                      </span>
                    </div>
                    <div className="text-[11px] font-normal opacity-75 mt-0.5 text-slate-700 dark:text-[#D1D5DB]">
                      Retains +1 WP · Charges +{runsCount} Run Allowed (+1 ER) to pitcher
                    </div>
                  </button>

                  {/* Run count stepper if selected */}
                  {selectedModifier === 'runScored' && (
                    <div className="px-3 pb-2.5 pt-0 flex items-center gap-2 border-t border-teal-200 dark:border-[#00D7BC]/30 mt-1 pt-2">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-[#9CA3AF]">
                        Runs scored:
                      </span>
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRunsCount(n)}
                          className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                            runsCount === n
                              ? 'border-[#00BFA5] bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#465160] dark:bg-[#252D38] dark:text-[#D1D5DB]'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Option 3: Runner(s) Thrown Out with Multi-Out Choice (1 Out or 2 Outs) */}
                <div
                  className={`rounded-2xl border transition-all ${
                    selectedModifier === 'runnerOut'
                      ? 'border-[#18212D] bg-slate-100 dark:border-[#354050] dark:bg-[#252D38]'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-[#354050] dark:bg-[#252D38]/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleModifier('runnerOut')}
                    className="w-full p-3 text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                        <span className="text-xs font-semibold text-slate-950 dark:text-[#FAFAFA]">
                          Runner(s) Thrown Out (+{outsCount} Out{outsCount > 1 ? 's' : ''})
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          selectedModifier === 'runnerOut'
                            ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]'
                            : 'bg-slate-200 dark:bg-[#354050] text-slate-600 dark:text-[#D1D5DB]'
                        }`}
                      >
                        {selectedModifier === 'runnerOut' ? 'Selected' : 'Add Modifier'}
                      </span>
                    </div>
                    <div className="text-[11px] font-normal opacity-75 mt-0.5 text-slate-700 dark:text-[#D1D5DB]">
                      Rule 9.13: Reverts WP (-1 WP → 0 WP) · Credits +{outsCount} Out{outsCount > 1 ? 's' : ''} (+{outsCount * 0.1} IP)
                    </div>
                  </button>

                  {/* Multi-Out choice: 1 Out or 2 Outs */}
                  {selectedModifier === 'runnerOut' && (
                    <div className="px-3 pb-2.5 pt-0 flex items-center gap-2 border-t border-slate-200 dark:border-[#354050] mt-1 pt-2">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-[#9CA3AF]">
                        Outs recorded:
                      </span>
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setOutsCount(n)}
                          className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                            outsCount === n
                              ? 'border-[#00BFA5] bg-[#00BFA5] dark:bg-[#00D7BC] dark:border-[#00D7BC] text-[#18212D] dark:text-[#101419]'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#465160] dark:bg-[#1A2028] dark:text-[#D1D5DB]'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        <footer className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 dark:border-[#354050] dark:bg-[#252D38]/60 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-2 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] font-semibold text-xs hover:bg-[#00A892] dark:hover:bg-[#00C4AB] transition-colors shadow-xs active:scale-[0.99] cursor-pointer"
          >
            {(() => {
              if (isThirdStrike) {
                if (!strikeThreeBatterSafe) {
                  // Out at 1st
                  if (selectedModifier === 'runScored') {
                    return `Record Play (+1 K · +1 Out · +${runsCount} Run · +1 WP)`;
                  }
                  if (selectedModifier === 'runnerOut') {
                    return `Record Play (+1 K · +${1 + outsCount} Outs · 0 WP)`;
                  }
                  return 'Record Play (+1 K · +1 Out · 0 WP)';
                } else {
                  // Safe at 1st
                  if (selectedModifier === 'runScored') {
                    return `Record Wild Pitch (+1 K · +${runsCount} Run · +1 WP)`;
                  }
                  if (selectedModifier === 'runnerOut') {
                    return `Record Wild Pitch (+1 K · +${outsCount} Out · +1 WP)`;
                  }
                  return 'Record Wild Pitch (+1 K · Safe · +1 WP)';
                }
              }

              if (selectedModifier === 'runnerOut') {
                return `Record Pitch (+${outsCount} Out${outsCount > 1 ? 's' : ''} · 0 WP)`;
              }
              if (selectedModifier === 'runScored') {
                return `Record Wild Pitch (+${runsCount} Run · +1 WP)`;
              }
              return 'Record Wild Pitch (+1 WP)';
            })()}
          </button>
        </footer>
      </section>
    </div>
  );
};
