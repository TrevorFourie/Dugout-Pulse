import React from 'react';
import { AlertTriangle, Zap } from 'lucide-react';
import { ThemedDropdown } from '../ThemedDropdown';
import { LINEUP_SPOTS, type PlayMode, type DefensivePosition } from '../../types/baseball';
import { DOUBLE_PLAY_ACTIONS, TRIPLE_PLAY_ACTIONS } from './scoreTabConstants';
import type { MultiOutPlayAction } from './scoreTabConstants';

type PendingPositionChange = { inning: number; from: string; to: string };
type FieldingChain = { endsHalfInning: boolean; playType: 'doublePlay' | 'triplePlay' } | null;

interface ScoreWorkflowModalsProps {
  lineupSpotPromptOpen: boolean;
  currentInningLineupSpot: number | undefined;
  setLineupSpot: (spot: number) => void;
  setLineupSpotPromptOpen: (open: boolean) => void;
  pendingPositionChange: PendingPositionChange | null;
  playerName: string;
  changeInningPosition: (inning: number, position: DefensivePosition, action: 'record' | 'correct') => void;
  setActiveMode: (mode: PlayMode) => void;
  setPendingPositionChange: (value: null) => void;
  fieldingChain: FieldingChain;
  dpActions: MultiOutPlayAction[];
  removeDpAction: (action: MultiOutPlayAction) => void;
  maxMultiOutActions: number;
  addDpAction: (action: MultiOutPlayAction) => void;
  handleConfirmDoublePlay: () => void;
  handleDismissFieldingChain: () => void;
}

export const ScoreWorkflowModals: React.FC<ScoreWorkflowModalsProps> = ({
  lineupSpotPromptOpen,
  currentInningLineupSpot,
  setLineupSpot,
  setLineupSpotPromptOpen,
  pendingPositionChange,
  playerName,
  changeInningPosition,
  setActiveMode,
  setPendingPositionChange,
  fieldingChain,
  dpActions,
  removeDpAction,
  maxMultiOutActions,
  addDpAction,
  handleConfirmDoublePlay,
  handleDismissFieldingChain,
}) => (
  <>
      {lineupSpotPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="lineup-spot-prompt-title"
            className="w-full max-w-md rounded-md border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#354050] dark:bg-[#1A2028]"
          >
            <h2 id="lineup-spot-prompt-title" className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA]">
              Select batting lineup spot
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#9CA3AF]">
              Choose the batter's position in the lineup before recording this play.
            </p>
            <div className="mt-4">
              <ThemedDropdown<number>
                value={currentInningLineupSpot}
                onChange={(value) => {
                  if (value === undefined) return;
                  setLineupSpot(value);
                  setLineupSpotPromptOpen(false);
                }}
                placeholder="Select batting lineup spot"
                ariaLabel="Batting lineup spot"
                allowClear={false}
                className="w-full"
                buttonClassName="h-11"
                options={LINEUP_SPOTS.map((spot) => ({
                  value: spot.spot,
                  label: `#${spot.spot} · ${spot.label}`,
                }))}
              />
            </div>
            <button
              type="button"
              onClick={() => setLineupSpotPromptOpen(false)}
              className="mt-4 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-[#9CA3AF] dark:hover:bg-[#252D38]"
            >
              Cancel
            </button>
          </section>
        </div>
      )}

      {pendingPositionChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white dark:bg-[#1A2028] rounded-md shadow-2xl border border-slate-200 dark:border-[#354050] p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="position-change-title"
          >
            <div className="flex items-start gap-2">
              <div className="p-3 rounded-md shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="position-change-title" className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA] leading-tight">
                  Change position in Inning {pendingPositionChange.inning}?
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-[#D1D5DB] leading-relaxed">
                  {playerName || 'The player'} is at <strong>{pendingPositionChange.from}</strong> and you picked{' '}
                  <strong>{pendingPositionChange.to}</strong>. How should this be recorded?
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  changeInningPosition(pendingPositionChange.inning, pendingPositionChange.to, 'record');
                  if (pendingPositionChange.to === 'P') setActiveMode('pitching');
                  setPendingPositionChange(null);
                }}
                className="w-full rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] px-4 py-3 text-left text-[#18212D] dark:text-[#101419] shadow-md active:scale-[0.99] transition-all cursor-pointer"
              >
                <span className="block text-sm font-semibold">Switched during the inning</span>
                <span className="block text-xs font-normal opacity-80">
                  Keeps {pendingPositionChange.from} for plays so far and uses {pendingPositionChange.to} from now on. Both positions get the inning.
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  changeInningPosition(pendingPositionChange.inning, pendingPositionChange.to, 'correct');
                  if (pendingPositionChange.to === 'P') setActiveMode('pitching');
                  setPendingPositionChange(null);
                }}
                className="w-full rounded-md border border-slate-300 dark:border-[#354050] px-4 py-3 text-left text-slate-800 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] active:scale-[0.99] transition-all cursor-pointer"
              >
                <span className="block text-sm font-semibold">I picked the wrong position</span>
                <span className="block text-xs font-normal opacity-80">
                  Replaces {pendingPositionChange.from} with {pendingPositionChange.to} for the whole inning, including plays already recorded.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPendingPositionChange(null)}
                className="w-full rounded-md px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {fieldingChain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white dark:bg-[#1A2028] rounded-md shadow-2xl border border-slate-200 dark:border-[#354050] p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="multi-out-play-title"
          >
            <div className="flex items-start gap-2">
              <div className="p-3 rounded-md shrink-0 bg-teal-100 text-[#00BFA5] dark:bg-[#00D7BC]/15 dark:text-[#00D7BC]">
                <Zap className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="multi-out-play-title" className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA] leading-tight">
                  {fieldingChain.playType === 'triplePlay' ? 'Triple Play' : 'Double Play'}: what did {playerName || 'the player'} do?
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-[#D1D5DB] leading-relaxed">
                  Select everything that applies.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              {(fieldingChain.playType === 'triplePlay' ? TRIPLE_PLAY_ACTIONS : DOUBLE_PLAY_ACTIONS).map((opt) => {
                const count = dpActions.filter((action) => action === opt.action).length;
                return (
                  <div
                    key={opt.action}
                    className={`w-full rounded-md border px-3 py-3 transition-all ${
                      count > 0
                        ? 'border-[#00BFA5] dark:border-[#00D7BC] bg-[#00BFA5]/10 dark:bg-[#00D7BC]/10'
                        : 'border-slate-300 dark:border-[#354050]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">{opt.title}</span>
                        <span className="block text-xs text-slate-600 dark:text-[#D1D5DB]">{opt.description}</span>
                        {count > 0 && (
                          <span className="mt-1 block text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC]">
                            Selected {count} {count === 1 ? 'time' : 'times'}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => removeDpAction(opt.action)}
                          disabled={count === 0}
                          aria-label={`Remove one: ${opt.title}`}
                          className="h-9 w-9 rounded-md border border-slate-300 dark:border-[#465160] text-lg font-semibold text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-bold tabular-nums text-slate-900 dark:text-[#FAFAFA]" aria-label={`${count} selected`}>
                          {count}
                        </span>
                        <button
                          type="button"
                          onClick={() => addDpAction(opt.action)}
                          disabled={dpActions.length >= maxMultiOutActions}
                          aria-label={`Add one: ${opt.title}`}
                          className="h-9 w-9 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] text-lg font-semibold hover:bg-[#00A892] dark:hover:bg-[#00C4AB] disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={handleConfirmDoublePlay}
                disabled={dpActions.length === 0}
                className="w-full rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] px-4 py-3 text-sm font-semibold text-[#18212D] dark:text-[#101419] shadow-md active:scale-[0.99] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={handleDismissFieldingChain}
                className="w-full rounded-md px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors cursor-pointer"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}


  </>
);
