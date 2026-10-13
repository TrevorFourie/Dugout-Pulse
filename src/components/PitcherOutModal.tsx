import React, { useState } from 'react';
import { X } from 'lucide-react';

export type PitcherOutFielding = 'none' | 'putout' | 'assist';
export type PitcherOutExtra = 'none' | 'doublePlay' | 'triplePlay';

export interface PitcherOutSelection {
  fielding: PitcherOutFielding;
  extra: PitcherOutExtra;
}

interface PitcherOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: PitcherOutSelection) => void;
}

const OUT_OPTIONS: { value: PitcherOutFielding; title: string; description: string }[] = [
  {
    value: 'none',
    title: 'Standard Out',
    description: 'Another fielder made the play. Records a pitching out only.',
  },
  {
    value: 'putout',
    title: 'Catch or Tag',
    description: 'The pitcher caught the ball or tagged the runner for the out.',
  },
  {
    value: 'assist',
    title: 'Throw to Base',
    description: 'The pitcher fielded the ball and threw to a base to record the out.',
  },
];

export const PitcherOutModal: React.FC<PitcherOutModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [fielding, setFielding] = useState<PitcherOutFielding>('none');
  const [extra, setExtra] = useState<PitcherOutExtra>('none');

  if (!isOpen) return null;

  const submitSelection = () => {
    onSelect({ fielding, extra });
    setFielding('none');
    setExtra('none');
    onClose();
  };

  const cancel = () => {
    setFielding('none');
    setExtra('none');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pitcher-out-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#354050] dark:bg-[#1A2028]"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-[#007A6A] dark:text-[#00D7BC]">Pitching</p>
            <h2 id="pitcher-out-title" className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA]">
              How was the out made?
            </h2>
          </div>
          <button
            type="button"
            onClick={cancel}
            aria-label="Cancel recording out"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#252D38]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <fieldset className="space-y-2">
          <legend className="sr-only">Out type</legend>
          {OUT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                fielding === option.value
                  ? 'border-[#00BFA5] bg-teal-50 dark:bg-[#00D7BC]/15'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-[#354050] dark:bg-[#252D38]/50'
              }`}
            >
              <input
                type="radio"
                name="pitcher-out-fielding"
                value={option.value}
                checked={fielding === option.value}
                onChange={() => setFielding(option.value)}
                className="mt-1 accent-[#00BFA5]"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">{option.title}</span>
                <span className="mt-0.5 block text-xs text-slate-600 dark:text-[#D1D5DB]">{option.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-xs font-semibold text-slate-700 dark:text-[#D1D5DB]">
            Multiple-out play (optional)
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'none', label: 'None' },
              { value: 'doublePlay', label: 'Double Play' },
              { value: 'triplePlay', label: 'Triple Play' },
            ] as const).map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-md border px-2 py-2 text-center text-xs font-semibold ${
                  extra === option.value
                    ? 'border-[#00BFA5] bg-teal-50 text-[#007A6A] dark:text-[#00D7BC] dark:bg-[#00D7BC]/15'
                    : 'border-slate-200 text-slate-600 dark:border-[#354050] dark:text-[#D1D5DB]'
                }`}
              >
                <input
                  type="radio"
                  name="pitcher-out-extra"
                  value={option.value}
                  checked={extra === option.value}
                  onChange={() => setExtra(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={submitSelection}
          className="mt-5 w-full rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] px-4 py-3 text-sm font-semibold text-[#18212D] dark:text-[#101419] hover:bg-[#00A892] dark:hover:bg-[#00C4AB]"
        >
          Record Out
        </button>
      </section>
    </div>
  );
};
