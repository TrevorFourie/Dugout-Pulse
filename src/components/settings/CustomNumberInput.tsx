import React, { useState } from 'react';

/** Small number box so a value outside the presets can be typed in manually. */
export const CustomNumberInput: React.FC<{
  value: number;
  presets: number[];
  min: number;
  max: number;
  label: string;
  onChange: (n: number) => void;
}> = ({ value, presets, min, max, label, onChange }) => {
  const isCustom = !presets.includes(value);
  const [text, setText] = useState(isCustom ? String(value) : '');

  // Keep the box in step when a preset is chosen or the value changes elsewhere
  React.useEffect(() => {
    setText(presets.includes(value) ? '' : String(value));
  }, [value, presets]);

  const commit = (raw: string) => {
    setText(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= min && n <= max) onChange(n);
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <label className="text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF] shrink-0">
        Or enter your own
      </label>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={text}
        placeholder={`${min}-${max}`}
        aria-label={label}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => setText(presets.includes(value) ? '' : String(value))}
        className={`w-24 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-white dark:bg-[#252D38] text-slate-900 dark:text-[#FAFAFA] border focus:outline-hidden focus:ring-2 focus:ring-[#18212D] dark:focus:ring-[#00D7BC] ${
          isCustom ? 'border-[#18212D] dark:border-[#00D7BC]' : 'border-slate-200 dark:border-[#354050]'
        }`}
      />
    </div>
  );
};
