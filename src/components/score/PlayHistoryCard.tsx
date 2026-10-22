import React from 'react';
import { Crosshair, Edit2, Trash2 } from 'lucide-react';
import type { Play } from '../../types/baseball';
import { ordinal, positionName } from './scoreTabConstants';
import { getTrajectoryLabel, isHitPlay, resolveZone } from '../../utils/sprayChart';
import type { PlayPitchMeta } from '../../hooks/usePlayPresentation';

interface PlayDragProps {
  'data-play-id': string;
  'data-score-swipe-ignore': boolean;
  extraClass: string;
  style?: React.CSSProperties;
}

interface PlayHistoryCardProps {
  play: Play;
  meta: PlayPitchMeta;
  inningPitchLabel?: string;
  getDragProps: (playId: string) => PlayDragProps;
  onEdit: (play: Play) => void;
  onDelete: (playId: string) => void;
  onMapHit: (play: Play) => void;
}

export const PlayHistoryCard: React.FC<PlayHistoryCardProps> = ({
  play, meta, inningPitchLabel, getDragProps, onEdit, onDelete, onMapHit,
}) => {
  const { extraClass: dragClass, style: dragStyle, ...dragHandlers } = getDragProps(play.id);
  const isPitching = play.mode === 'pitching';
    return (
      <div
        key={play.id}
        {...dragHandlers}
        style={dragStyle}
        className={`p-2.5 sm:p-3 rounded-md border border-l-[5px] border-l-[#18212D] border-slate-300 bg-white shadow-2xs transition-all text-xs space-y-1.5 dark:border-[#354050] dark:border-l-[#18212D] dark:bg-[#252D38] ${dragClass}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
            {/* Innings */}
            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050] shrink-0">
              Inning {play.inning}
            </span>

            {/* Pitch count for pitching mode (dynamically recalculates when drag-and-drop reorders plays) */}
            {isPitching && (
              meta.pitchNumber !== null ? (
                <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border border-[#00BFA5] dark:border-[#00D7BC] shrink-0 tabular-nums">
                  {inningPitchLabel ?? `#${meta.pitchNumber}`}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-[#252D38] text-slate-500 dark:text-[#9CA3AF] border border-slate-200 dark:border-[#354050] shrink-0">
                  No pitch
                </span>
              )
            )}

            {/* What happened badge - single clean label, zero duplicate values */}
            <span
              className={`px-2.5 py-0.5 rounded-md text-xs font-semibold tracking-tight shrink-0 border ${meta.badgeStyle}`}
            >
              {meta.whatHappened}
            </span>
          </div>

          {/* Action buttons: Edit & Delete */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(play)}
              className="p-1 sm:p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-[#FAFAFA] hover:bg-slate-100 dark:hover:bg-[#252D38] transition-colors"
              title="Edit play"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(play.id)}
              className="p-1 sm:p-1.5 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-[#00D7BC]/15 transition-colors"
              title="Delete play"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Second row: details & context */}
        {(meta.whatHappenedDetail || play.pitcherHand || play.lineupSpot || play.defensivePosition || play.hitLocation || play.errorType) && (
          <div className="flex items-center gap-2 flex-wrap text-[13px] text-slate-500 dark:text-[#9CA3AF] pl-0.5">
            {meta.whatHappenedDetail && (
              <span className="text-slate-600 dark:text-[#D1D5DB] font-medium">
                {meta.whatHappenedDetail}
              </span>
            )}
            {play.pitcherHand && (
              <span className="font-semibold inline-flex items-center gap-1">
                Facing a <strong className="text-slate-700 dark:text-[#D1D5DB]">{play.pitcherHand === 'L' ? 'left-handed' : 'right-handed'}</strong> pitcher
              </span>
            )}
            {play.errorType && (
              <span className="font-semibold inline-flex items-center gap-1">
                • Error type: <strong className="text-slate-700 dark:text-[#D1D5DB]">{play.errorType === 'fielding' ? 'Fielding error' : play.errorType === 'throwing' ? 'Throwing error' : play.errorType === 'droppedCatch' ? 'Dropped catch' : 'Other error'}</strong>
              </span>
            )}
            {play.lineupSpot && (
              <span className="font-semibold inline-flex items-center gap-1 text-[#18212D] dark:text-[#D1D5DB]">
                • Batting <strong className="text-[#18212D] dark:text-[#D1D5DB]">{ordinal(Number(play.lineupSpot))}</strong> in the lineup
              </span>
            )}
            {play.defensivePosition && (
              <span className="font-semibold inline-flex items-center gap-1">
                • Position: <strong className="text-slate-700 dark:text-[#D1D5DB]">{positionName(play.defensivePosition)}</strong>
              </span>
            )}
            {play.hitLocation && (
              <button
                type="button"
                onClick={() => onEdit(play)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#252D38]/40 border border-slate-300 dark:border-[#354050] text-xs font-semibold text-[#18212D] dark:text-[#D1D5DB] hover:bg-slate-100 transition-colors"
                title="Click to view/edit hit location on field"
              >
                <Crosshair className="w-3 h-3" />
                <span>{positionName(resolveZone(play.hitLocation))}</span>
                {play.hitLocation.trajectory && (
                  <span className="opacity-80">· {getTrajectoryLabel(play.hitLocation.trajectory)}</span>
                )}
              </button>
            )}
            {!play.hitLocation && play.mode === 'batting' &&
              (isHitPlay(play.code) || ['out', 'sacFly', 'sacBunt', 'groundedIntoDoublePlay'].includes(play.code)) && (
              <button
                type="button"
                onClick={() => onMapHit(play)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-dashed text-xs font-semibold transition-colors ${isHitPlay(play.code) ? 'border-slate-300 dark:border-[#354050] text-slate-500 hover:text-[#007A6A] dark:hover:text-[#00D7BC] hover:border-[#00BFA5]' : 'border-red-300 dark:border-red-900/70 text-red-600 dark:text-red-400 hover:border-red-500 hover:text-red-700'}`}
                title="Map hit location"
              >
                <Crosshair className="w-3 h-3" />
                <span>{isHitPlay(play.code) ? 'Map Hit Spray' : 'Map Contact'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
};
