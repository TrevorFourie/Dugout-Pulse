import React from 'react';
import type { Play, PlayMode } from '../../types/baseball';

interface ScoreModeTabsProps {
  activeMode: PlayMode;
  onChange: (mode: PlayMode) => void;
  plays: Play[];
}

const MODES: PlayMode[] = ['batting', 'pitching', 'fielding'];

export const ScoreModeTabs: React.FC<ScoreModeTabsProps> = ({ activeMode, onChange, plays }) => (
  <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-0 pb-2">
    <div className="flex rounded-sm bg-slate-200/80 dark:bg-[#1A2028] border border-slate-300/40 dark:border-[#354050] p-1 gap-1">
      {MODES.map((mode) => {
        const count = plays.filter((play) => play.mode === mode).length;
        const active = activeMode === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            aria-pressed={active}
            className={`flex-1 h-10 text-[15px] rounded-sm transition-colors flex items-center justify-center gap-1.5 capitalize ${
              active
                ? 'bg-[#00BFA5]/60 dark:bg-[#252D38] text-[#FAFAFA] dark:text-[#FAFAFA] font-medium border-t-3 border-[#00BFA5] dark:border-[#465160]'
                : 'bg-white/40 text-slate-900 dark:text-[#9CA3AF] font-medium hover:bg-white/60 dark:hover:bg-[#252D38]/70 border-t-3 border-white/60'
            }`}
          >
            <span>{mode}</span>
            {count > 0 && (
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-medium leading-none ${
                  active
                    ? 'bg-[#18212D] dark:bg-[#00D7BC] text-white dark:text-[#101419]'
                    : 'bg-[#00BFA5] dark:bg-[#1A2028] text-white dark:text-[#D1D5DB]'
                }`}
              >
                <span className={count === 1 ? '-translate-x-[0.5px] -translate-y-[0.5px]' : ''}>{count}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);
