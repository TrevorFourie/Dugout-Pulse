import React from 'react';
import { Trash2 } from 'lucide-react';
import type { Game, Play, PlayMode, PositionChange } from '../../types/baseball';

interface PlayHistoryListProps {
  liveGame: Game;
  plays: Play[];
  currentInning: number;
  reachedInning: number;
  playFeedFilter: 'all' | PlayMode;
  onRemoveBench: (inning: number) => void;
  onUndoEmptyCurrentInning: () => void;
  renderPlayCard: (play: Play) => React.ReactNode;
  renderPositionChangeCard: (change: PositionChange) => React.ReactNode;
}

export const PlayHistoryList: React.FC<PlayHistoryListProps> = ({
  liveGame, plays, currentInning, reachedInning, playFeedFilter, onRemoveBench,
  onUndoEmptyCurrentInning, renderPlayCard, renderPositionChangeCard,
}) => {

    const allPlays = liveGame.plays;
    const benched = liveGame.benchInnings || [];
    const lastInning = Math.max(currentInning, 1, liveGame.maxInning ?? 0, ...allPlays.map((p) => p.inning), ...benched);
    const tabLabel = playFeedFilter === 'pitching' ? 'pitching' : playFeedFilter === 'fielding' ? 'fielding' : 'batting';

    return (
      <div className="space-y-2">
        {Array.from({ length: lastInning }, (_, i) => lastInning - i).map((inning, index) => {
          const tabPlays = plays.filter((p) => p.inning === inning);
          const isBenched = benched.includes(inning);
          const batOrPitchCount = allPlays.filter(
            (p) => p.inning === inning && (p.mode === 'batting' || p.mode === 'pitching')
          ).length;

          let status: { text: string; tone: 'bench' | 'none' | 'info' } | null = null;
          if (isBenched) {
            status = { text: 'Benched / Resting this inning', tone: 'bench' };
          } else if (batOrPitchCount === 0) {
            status =
              inning === currentInning
                ? { text: 'No plays yet this inning', tone: 'info' }
                : { text: 'No plays made', tone: 'none' };
          } else if (tabPlays.length === 0) {
            status = { text: `No ${tabLabel} plays this inning`, tone: 'info' };
          }

          return (
            <React.Fragment key={inning}>
              <div className={`flex items-center gap-2 px-0.5 ${index === 0 ? 'pb-1' : 'pt-3 pb-1'}`}>
                <div className="h-px flex-1 bg-slate-300 dark:bg-[#354050]" />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-800 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB]">
                  Inning {inning}
                  {tabPlays.length > 0 && (
                    <span className="font-medium text-slate-500 dark:text-[#9CA3AF]">
                      · {tabPlays.length} {tabPlays.length === 1 ? 'play' : 'plays'}
                    </span>
                  )}
                </span>
                <div className="h-px flex-1 bg-slate-300 dark:bg-[#354050]" />
              </div>

              {status && status.tone === 'bench' && (
                /* Same card layout as a play: inning chip, badge, delete icon */
                <div className="p-2.5 sm:p-3 rounded-md border border-l-[5px] border-l-[#18212D] border-slate-300 bg-white shadow-2xs text-xs dark:border-[#354050] dark:border-l-[#18212D] dark:bg-[#252D38]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050] shrink-0">
                        Inning {inning}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold tracking-tight shrink-0 border bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-[#00BFA5] dark:border-[#00D7BC]">
                        Benched / Resting
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onRemoveBench(inning)}
                        className="p-1 sm:p-1.5 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-[#00D7BC]/15 transition-colors"
                        title="Remove bench / rest"
                        aria-label={`Remove bench / rest from inning ${inning}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {status && status.tone !== 'bench' && (
                /* Same card layout as a play: inning chip + badge */
                <div className="p-2.5 sm:p-3 rounded-md border border-l-[5px] border-l-[#18212D] border-slate-300 bg-white shadow-2xs text-xs dark:border-[#354050] dark:border-l-[#18212D] dark:bg-[#252D38]">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050] shrink-0">
                      Inning {inning}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold tracking-tight shrink-0 border bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#252D38] dark:text-[#D1D5DB] dark:border-[#354050]">
                      {status.text}
                    </span>
                  </div>
                  {inning === currentInning &&
                    inning > 1 &&
                    inning === reachedInning &&
                    !isBenched &&
                    !allPlays.some((p) => p.inning === inning) && (
                      <button
                        type="button"
                        onClick={onUndoEmptyCurrentInning}
                        className="mt-2 rounded-md border border-slate-300 dark:border-[#354050] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors"
                      >
                        Undo empty inning &amp; return to Inning {inning - 1}
                      </button>
                    )}
                </div>
              )}

              {/* Plays newest first, with position changes slotted in where they happened */}
              {(() => {
                const changes = (liveGame.positionChanges || [])
                  .filter((c) => {
                    if (c.inning !== inning) return false;

                    // Position changes never belong in Batting.
                    if (playFeedFilter === 'batting') return false;

                    // Fielding shows every defensive position change.
                    if (playFeedFilter === 'fielding') return true;

                    // Pitching only also shows transitions into or out of Pitcher (P).
                    return playFeedFilter === 'pitching' && (c.from === 'P' || c.to === 'P');
                  })
                  .sort((a, b) => b.timestamp - a.timestamp);
                const items: React.ReactNode[] = [];
                let next = 0;
                tabPlays.forEach((play) => {
                  while (next < changes.length && changes[next].timestamp > (play.timestamp ?? 0)) {
                    items.push(renderPositionChangeCard(changes[next]));
                    next += 1;
                  }
                  items.push(renderPlayCard(play));
                });
                while (next < changes.length) {
                  items.push(renderPositionChangeCard(changes[next]));
                  next += 1;
                }
                return items;
              })()}
            </React.Fragment>
          );
        })}
      </div>
    );
};
