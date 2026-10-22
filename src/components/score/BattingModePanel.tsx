import React from 'react';
import { ThemedDropdown } from '../ThemedDropdown';
import { LINEUP_SPOTS } from '../../types/baseball';
import type { PitcherHand } from '../../types/baseball';

interface BattingModePanelProps {
  isBenched: boolean;
  lineupSpot: number | null | undefined;
  onLineupSpotChange: (spot: number) => void;
  onOpenLineupSpotPrompt: () => void;
  pitcherHand: PitcherHand;
  onPitcherHandChange: (hand: PitcherHand) => void;
  hitTapperEnabled: boolean;
  onHitTapperEnabledChange: (enabled: boolean) => void;
}

export const BattingModePanel: React.FC<BattingModePanelProps> = ({
  isBenched, lineupSpot, onLineupSpotChange, onOpenLineupSpotPrompt,
  pitcherHand, onPitcherHandChange, hitTapperEnabled, onHitTapperEnabledChange,
}) => {
  if (isBenched) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
      <div className="bg-white dark:bg-[#252D38] rounded-md px-3.5 py-3 border border-slate-200/80 dark:border-[#354050] shadow-2xs flex flex-col justify-center gap-2 min-h-[48px]">
        {lineupSpot ? (
          <>
            <span className="text-[13px] font-semibold text-slate-800 dark:text-[#FAFAFA]">Batting Lineup Spot</span>
            <div className="flex items-center justify-between gap-2 min-h-8">
              <span className="text-[13px] font-semibold text-slate-800 dark:text-[#FAFAFA]">
                #{lineupSpot} · {LINEUP_SPOTS.find((spot) => spot.spot === lineupSpot)?.label || 'Selected'}
              </span>
              <button type="button" onClick={onOpenLineupSpotPrompt} className="shrink-0 rounded-md border border-slate-300 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#2D3643]">Change</button>
            </div>
          </>
        ) : (
          <>
            <label className="block text-[13px] font-semibold text-slate-800 dark:text-[#FAFAFA]">Batting Lineup Spot</label>
            <ThemedDropdown<number>
              value={undefined}
              onChange={(value) => { if (value !== undefined) onLineupSpotChange(value); }}
              placeholder="Select batting lineup spot"
              ariaLabel="Batting lineup spot"
              allowClear={false}
              className="w-full"
              buttonClassName="h-10"
              options={LINEUP_SPOTS.map((spot) => ({ value: spot.spot, label: `#${spot.spot} · ${spot.label}` }))}
            />
          </>
        )}
      </div>
      <div className="bg-white dark:bg-[#252D38] rounded-md px-3.5 py-3 border border-slate-200/80 dark:border-[#354050] shadow-2xs flex flex-col justify-center gap-2 min-h-[48px]">
        <span className="text-[13px] font-semibold text-slate-800 dark:text-[#FAFAFA]">Pitcher</span>
        <div className="flex p-0.5 bg-slate-100 dark:bg-[#1A2028] rounded-md border border-slate-200 dark:border-[#354050]">
          {([['R', 'Right'], ['L', 'Left']] as const).map(([hand, label]) => (
            <button key={hand} type="button" onClick={() => onPitcherHandChange(hand)} aria-pressed={pitcherHand === hand}
              className={`h-8 flex-1 rounded-md text-xs font-semibold transition-all ${pitcherHand === hand ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs' : 'text-slate-600 dark:text-[#D1D5DB]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-[#252D38] rounded-md px-3.5 py-3 border border-slate-200/80 dark:border-[#354050] shadow-2xs flex flex-col justify-center gap-2 min-h-[48px]">
        <span className="text-[13px] font-semibold text-slate-800 dark:text-[#FAFAFA]">Hit Location</span>
        <div className="flex items-center justify-between gap-2 min-h-8">
          <span className="text-xs font-medium text-slate-600 dark:text-[#D1D5DB]">Enable / Disable</span>
          <button type="button" role="switch" aria-label="Enable / Disable Hit Location" aria-checked={hitTapperEnabled}
            onClick={() => onHitTapperEnabledChange(!hitTapperEnabled)} className="cursor-pointer select-none shrink-0">
            <span aria-hidden="true" className={`relative block w-10 h-6 rounded-full transition-colors ${hitTapperEnabled ? 'bg-[#00BFA5] dark:bg-[#00D7BC]' : 'bg-slate-300 dark:bg-[#465160]'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${hitTapperEnabled ? 'translate-x-4' : ''}`} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
