import React from 'react';
import { Activity, ChevronRight } from 'lucide-react';

interface PitchingModePanelProps {
  isBenched: boolean;
  pitchLimit: number;
  pitches: number;
  pitchProgressPct: number;
  restDaysRequired: number;
  pitchingState: string;
  onNextBatter: () => void;
}

export const PitchingModePanel: React.FC<PitchingModePanelProps> = ({
  isBenched, pitchLimit, pitches, pitchProgressPct, restDaysRequired, pitchingState, onNextBatter,
}) => {
  if (isBenched) return null;
  return (
    <div className="bg-slate-900 text-white rounded-md p-3 border border-slate-800 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-300" />
          <span className="font-semibold text-slate-300">Pitch count</span>
        </div>
        <span className="text-[13px] font-semibold text-slate-300 flex items-center">
          Limit: {pitchLimit} pitches · Rest: <span className="text-slate-300 font-semibold">{restDaysRequired === 0 ? '0 Days' : `${restDaysRequired} Day(s)`}</span>
          {pitches >= pitchLimit && (
            <span className="flex items-center p-1"> · <span className="text-[#FF5252] px-1">[LIMIT REACHED - <span className="font-display text-[16px] leading-none font-semibold tabular-nums">{pitches}</span>/ {pitchLimit}]</span></span>
          )}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full transition-all duration-300 ${pitchProgressPct > 85 ? 'bg-[#FF5252]' : pitchProgressPct > 65 ? 'bg-[#FF6F00]' : 'bg-[#00BFA5]'}`} style={{ width: `${pitchProgressPct}%` }} />
      </div>
      {pitchingState === 'BATTER_RESOLVED' && (
        <button type="button" onClick={onNextBatter} className="w-full py-2.5 rounded-md bg-slate-200 hover:bg-slate-200 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
          Next Batter <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
