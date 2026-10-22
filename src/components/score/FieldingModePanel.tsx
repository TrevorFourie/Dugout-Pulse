import React from 'react';
import { ThemedDropdown } from '../ThemedDropdown';
import { DEFENSIVE_POSITIONS } from './scoreTabConstants';
import type { DefensivePosition } from '../../types/baseball';

interface FieldingModePanelProps {
  selectedPosition: DefensivePosition | undefined;
  onPositionSelect: (position: DefensivePosition) => void;
}

export const FieldingModePanel: React.FC<FieldingModePanelProps> = ({ selectedPosition, onPositionSelect }) => (
  <div className="grid grid-cols-1 text-xs">
    <div className="bg-white dark:bg-[#252D38] rounded-lg px-3.5 py-3 border border-slate-200 dark:border-[#354050] shadow-sm space-y-2">
      <label className="block text-[13px] font-semibold text-slate-800 dark:text-[#FAFAFA]">Fielding Position</label>
      <ThemedDropdown<DefensivePosition>
        value={selectedPosition}
        ariaLabel="Fielding Position"
        placeholder="Select fielding position"
        className="w-full"
        buttonClassName="h-10"
        allowClear={false}
        options={DEFENSIVE_POSITIONS.map((position) => ({
          value: position.code,
          label: position.code === 'BENCH' ? 'Bench' : `${position.code} - ${position.label.split('(')[0].trim()}`,
        }))}
        onChange={(value) => { if (value) onPositionSelect(value); }}
      />
    </div>
  </div>
);
