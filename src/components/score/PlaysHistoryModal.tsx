import React from 'react';
import { X, Zap, CircleDot, Shield } from 'lucide-react';
import type { Game, Play, PlayMode, PositionChange } from '../../types/baseball';
import { calculateGameStats } from '../../utils/stats';
import { PlayHistoryList } from './PlayHistoryList';

interface PlaysHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  liveGame: Game;
  playFeedFilter: 'all' | PlayMode;
  onPlayFeedFilterChange: (filter: 'all' | PlayMode) => void;
  battingPlaysCount: number;
  pitchingPlaysCount: number;
  batting: ReturnType<typeof calculateGameStats>['batting'];
  pitching: ReturnType<typeof calculateGameStats>['pitching'];
  filteredPlays: Play[];
  currentInning: number;
  reachedInning: number;
  onRemoveBench: (inning: number) => void;
  onUndoEmptyCurrentInning: () => void;
  renderPlayCard: (play: Play) => React.ReactNode;
  renderPositionChangeCard: (change: PositionChange) => React.ReactNode;
}

export const PlaysHistoryModal: React.FC<PlaysHistoryModalProps> = ({
  isOpen, onClose, liveGame, playFeedFilter, onPlayFeedFilterChange, battingPlaysCount,
  pitchingPlaysCount, batting, pitching, filteredPlays, currentInning, reachedInning,
  onRemoveBench, onUndoEmptyCurrentInning, renderPlayCard, renderPositionChangeCard,
}) => {
  if (!isOpen) return null;
  return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={() => onClose()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="plays-modal-title"
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-[#354050] bg-[#F4F6F8] dark:bg-[#101419] shadow-2xl"
        >
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-[#354050] bg-white dark:bg-[#1A2028]">
            <h2 id="plays-modal-title" className="text-base font-semibold text-[#18212D] dark:text-[#FAFAFA]">Plays</h2>
            <button
              type="button"
              onClick={() => onClose()}
              aria-label="Close plays"
              className="p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#18212D] dark:text-[#9CA3AF] dark:hover:bg-[#252D38] dark:hover:text-[#FAFAFA]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
      {/* Recent Plays Feed */}
      <div className="bg-white dark:bg-[#252D38] rounded-md p-4 sm:p-5 border border-slate-200/80 dark:border-[#354050] shadow-xs space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-xs text-slate-700 dark:text-[#D1D5DB]">
              Plays in This Game
            </span>
            <span className="px-2 py-0.5 rounded-full text-[13px] font-semibold bg-slate-100 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050]">
              {liveGame.plays.length}
            </span>

          </div>

        </div>

        {/* Filter Segmented Control: Batting / Pitching */}
        {liveGame.plays.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#252D38]/80 rounded-md border border-slate-200/80 dark:border-[#354050]">
            <button
              type="button"
              onClick={() => onPlayFeedFilterChange('batting')}
              className={`flex-1 min-w-[85px] py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                playFeedFilter === 'batting'
                  ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                  : 'text-slate-600 dark:text-[#9CA3AF] hover:text-[#18212D] dark:hover:text-[#D1D5DB]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Batting</span>
              <span className={`text-xs font-semibold ${playFeedFilter === 'batting' ? 'text-white/90' : 'text-slate-500'}`}>
                ({battingPlaysCount})
              </span>
            </button>

            <button
              type="button"
              onClick={() => onPlayFeedFilterChange('pitching')}
              className={`flex-1 min-w-[90px] py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                playFeedFilter === 'pitching'
                  ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                  : 'text-slate-600 dark:text-[#9CA3AF] hover:text-[#18212D] dark:hover:text-[#D1D5DB]'
              }`}
            >
              <CircleDot className="w-3.5 h-3.5" />
              <span>Pitching</span>
              <span className={`text-xs font-semibold ${playFeedFilter === 'pitching' ? 'text-white/90' : 'text-slate-500'}`}>
                ({pitchingPlaysCount})
              </span>
            </button>

            <button
              type="button"
              onClick={() => onPlayFeedFilterChange('fielding')}
              className={`flex-1 min-w-[90px] py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                playFeedFilter === 'fielding'
                  ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                  : 'text-slate-600 dark:text-[#9CA3AF] hover:text-[#18212D] dark:hover:text-[#D1D5DB]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Fielding</span>
              <span className={`text-xs font-semibold ${playFeedFilter === 'fielding' ? 'text-white/90' : 'text-slate-500'}`}>
                ({liveGame.plays.filter((p) => p.mode === 'fielding').length})
              </span>
            </button>

          </div>
        )}

        {/* Plays Rendering */}
        {liveGame.plays.length === 0 && liveGame.benchInnings.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 font-medium">
            No plays recorded yet. Tap any play button above to begin.
          </div>
        ) : (
          /* Plays for the selected tab, always all of them, split by inning */
          <div className="space-y-3">
            {/* Filter Mode Header Banner */}
            <div className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-md border border-slate-200/80 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38]/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border border-slate-200 dark:border-[#354050] bg-white dark:bg-[#354050]">
                  {playFeedFilter === 'batting' ? (
                    <Zap className="w-4 h-4 text-blue-500" />
                  ) : playFeedFilter === 'pitching' ? (
                    <CircleDot className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Shield className="w-4 h-4 text-blue-500" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-[#D1D5DB]">
                    {playFeedFilter === 'batting'
                      ? `All Batting Plays (${filteredPlays.length})`
                      : playFeedFilter === 'pitching'
                      ? `All Pitching Plays (${filteredPlays.length})`
                      : `All Fielding Plays (${filteredPlays.length})`}
                  </h4>
                  <p className="text-[13px] font-semibold text-slate-500 dark:text-[#9CA3AF]">
                    {(() => {
                      const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
                      if (playFeedFilter === 'batting') {
                        return [
                          `${n(batting.h, 'hit', 'hits')} in ${n(batting.ab, 'at-bat', 'at-bats')}`,
                          ...(batting.hr > 0 ? [n(batting.hr, 'home run', 'home runs')] : []),
                          ...(batting.rbi > 0 ? [n(batting.rbi, 'run batted in', 'runs batted in')] : []),
                          ...(batting.r > 0 ? [n(batting.r, 'run scored', 'runs scored')] : []),
                        ].join(' · ');
                      }
                      if (playFeedFilter === 'pitching') {
                        return [
                          `${pitching.ipDisplay} innings pitched`,
                          `${n(pitching.pitches, 'pitch', 'pitches')} (${n(pitching.strikes, 'strike', 'strikes')}, ${n(pitching.balls, 'ball', 'balls')})`,
                          n(pitching.k, 'strikeout', 'strikeouts'),
                        ].join(' · ');
                      }
                      return 'All defensive fielding plays';
                    })()}
                  </p>
                </div>
              </div>
            </div>

            {/* All plays for this tab, newest first, with a divider between innings */}
            <PlayHistoryList
                    liveGame={liveGame}
                    plays={filteredPlays}
                    currentInning={currentInning}
                    reachedInning={reachedInning}
                    playFeedFilter={playFeedFilter}
                    onRemoveBench={(inning) => onRemoveBench(inning)}
                    onUndoEmptyCurrentInning={onUndoEmptyCurrentInning}
                    renderPlayCard={renderPlayCard}
                    renderPositionChangeCard={renderPositionChangeCard}
                  />
          </div>
        )}
        </div>

          <div className="shrink-0 p-3 border-t border-slate-200 dark:border-[#354050] bg-white dark:bg-[#1A2028] flex justify-end">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-5 py-2 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] text-sm font-semibold hover:bg-[#00A892] dark:hover:bg-[#00C4AB]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
      </div>
  );
};
