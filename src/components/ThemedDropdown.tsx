import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
  logo?: string;
}

interface ThemedDropdownProps<T extends string | number> {
  value: T | undefined;
  options: DropdownOption<T>[];
  placeholder: string;
  onChange: (value: T | undefined) => void;
  className?: string;
  menuClassName?: string;
  buttonClassName?: string;
  ariaLabel?: string;
  /** Show the placeholder as a selectable "clear" row at the top of the list (default true). */
  allowClear?: boolean;
}

export function ThemedDropdown<T extends string | number>({
  value,
  options,
  placeholder,
  onChange,
  className = '',
  menuClassName = '',
  buttonClassName = '',
  ariaLabel,
  allowClear = true,
}: ThemedDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`w-full min-w-0 max-w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border bg-white dark:bg-[#252D38] border-slate-200 dark:border-[#354050] text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA] shadow-2xs transition-colors hover:border-slate-300 dark:hover:border-[#465160] focus:outline-hidden focus:ring-2 focus:ring-[#00BFA5]/30 ${buttonClassName}`}
      >
        <span className={`flex min-w-0 items-center gap-2 ${selected ? '' : 'text-slate-500 dark:text-[#9CA3AF]'}`}>
          {selected?.logo && <img src={selected.logo} alt="" className="h-5 w-5 shrink-0 rounded-sm bg-white object-contain" />}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 dark:text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[70] w-full max-w-full overflow-hidden rounded-xl border border-slate-200 dark:border-[#354050] bg-white dark:bg-[#252D38] shadow-xl ${menuClassName}`}
        >
          <div className="max-h-56 overflow-y-auto overscroll-contain p-1">
            {allowClear && (
              <button
                type="button"
                role="option"
                aria-selected={value === undefined}
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
                className={`w-full min-w-0 px-3 py-2.5 rounded-md text-left text-xs font-semibold truncate transition-colors ${
                  value === undefined
                    ? 'bg-slate-100 dark:bg-[#1A2028] text-[#18212D] dark:text-[#FAFAFA]'
                    : 'text-slate-600 dark:text-[#D1D5DB] hover:bg-slate-50 dark:hover:bg-[#2D3643]'
                }`}
              >
                {placeholder}
              </button>
            )}

            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  key={String(option.value)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`w-full min-w-0 flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-left text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] font-semibold'
                      : 'text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#2D3643]'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {option.logo && <img src={option.logo} alt="" className="h-6 w-6 shrink-0 rounded-sm bg-white object-contain" />}
                    <span className="truncate">{option.label}</span>
                  </span>
                  {isSelected && <Check className="w-4 h-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}