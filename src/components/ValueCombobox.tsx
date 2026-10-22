import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, X, Plus, LucideIcon, Trash2 } from 'lucide-react';

interface ValueComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  quickPills?: string[];
  placeholder?: string;
  required?: boolean;
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
  onDeleteOption?: (option: string) => void;
  ariaLabel?: string;
}

export const ValueCombobox: React.FC<ValueComboboxProps> = ({
  value,
  onChange,
  options,
  quickPills = [],
  placeholder = 'Select or type...',
  required = false,
  icon: Icon,
  disabled = false,
  className = '',
  onDeleteOption,
  ariaLabel = 'Select or type value',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isBrowsingAll, setIsBrowsingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsBrowsingAll(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsBrowsingAll(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Clean deduplicated list of options
  const allUniqueOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const opt of options) {
      const clean = opt.trim();
      const lower = clean.toLowerCase();
      if (clean && !seen.has(lower)) {
        seen.add(lower);
        list.push(clean);
      }
    }
    return list;
  }, [options]);

  // Check if current value matches one of the known options
  const exactMatchOption = useMemo(() => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    return allUniqueOptions.find((opt) => opt.toLowerCase() === trimmed) || null;
  }, [allUniqueOptions, value]);

  // Filtered options based on user typing
  const displayOptions = useMemo(() => {
    const trimmed = value.trim().toLowerCase();

    // If user clicked dropdown chevron or current value is already a known selection,
    // show ALL options so user can easily browse and select from the list
    if (isBrowsingAll || (isOpen && exactMatchOption)) {
      return allUniqueOptions;
    }

    if (!trimmed) {
      return allUniqueOptions;
    }

    return allUniqueOptions.filter((opt) => opt.toLowerCase().includes(trimmed));
  }, [allUniqueOptions, value, isBrowsingAll, isOpen, exactMatchOption]);

  const hasExactMatch = Boolean(exactMatchOption);

  const handleSelect = (selectedVal: string) => {
    onChange(selectedVal);
    setIsOpen(false);
    setIsBrowsingAll(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsBrowsingAll(true);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const handleToggleDropdown = () => {
    if (disabled) return;
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsBrowsingAll(true);
      }
      return next;
    });
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input container */}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3 pointer-events-none text-slate-400 dark:text-[#6B7280]">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsBrowsingAll(false);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setIsBrowsingAll(true);
          }}
          className={`w-full py-2.5 rounded-xl bg-white dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] placeholder:text-slate-400 placeholder:font-normal focus:outline-hidden focus:ring-2 focus:ring-[#00BFA5]/30 dark:focus:ring-[#00D7BC]/30 transition-colors ${
            Icon ? 'pl-9.5' : 'pl-3.5'
          } ${value ? 'pr-16' : 'pr-9'}`}
        />

        {/* Action icons */}
        <div className="absolute right-2 flex items-center gap-0.5">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-[#D1D5DB] transition-colors"
              title="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={handleToggleDropdown}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-[#D1D5DB] transition-colors"
            title="Browse all options"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${
                isOpen ? 'rotate-180 text-[#18212D] dark:text-[#FAFAFA]' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Quick Pills (1-tap selection) */}
      {quickPills.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          <span className="text-[10px] uppercase font-semibold text-slate-400 mr-0.5">Quick:</span>
          {quickPills.map((pill) => {
            const isSelected = value.trim().toLowerCase() === pill.trim().toLowerCase();
            return (
              <button
                key={pill}
                type="button"
                onClick={() => handleSelect(pill)}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all ${
                  isSelected
                    ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-[#00BFA5] dark:border-blue-600 shadow-2xs'
                    : 'bg-white dark:bg-[#252D38] text-slate-600 dark:text-[#D1D5DB] border-slate-200 dark:border-[#354050] hover:bg-slate-100 dark:hover:bg-[#354050]/60'
                }`}
              >
                {pill}
              </button>
            );
          })}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100 dark:divide-[#354050]">
          {/* Header showing item count or custom prompt */}
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#252D38]/60 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            <span>Choose from list ({allUniqueOptions.length})</span>
            {value.trim() && (
              <span className="text-slate-500 font-medium normal-case">
                Type to filter
              </span>
            )}
          </div>

          {/* Custom option prompt if user typed something not yet in the list */}
          {value.trim() && !hasExactMatch && (
            <button
              type="button"
              onClick={() => handleSelect(value.trim())}
              className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC] bg-teal-50/50 dark:bg-[#00D7BC]/15 hover:bg-teal-100/60 dark:hover:bg-[#00D7BC]/15 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Use &quot;{value.trim()}&quot;</span>
              </div>
              <span className="text-[10px] uppercase font-extrabold tracking-wider shrink-0 bg-teal-100 dark:bg-[#00D7BC]/15 text-teal-700 dark:text-[#00D7BC] px-1.5 py-0.5 rounded">
                Add Custom
              </span>
            </button>
          )}

          {/* List of matching options */}
          {displayOptions.length > 0 ? (
            <div className="py-1">
              {displayOptions.map((opt) => {
                const isSelected = value.trim().toLowerCase() === opt.toLowerCase();
                return (
                  <div
                    key={opt}
                    className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors group cursor-pointer ${
                      isSelected
                        ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]'
                        : 'text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#2D3643]'
                    }`}
                    onClick={() => handleSelect(opt)}
                  >
                    <span className="truncate flex-1">{opt}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#007A6A] dark:text-[#00D7BC]" />}
                      {onDeleteOption && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteOption(opt);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-teal-500 rounded transition-opacity"
                          title={`Remove ${opt}`}
                        >
                          <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 text-center text-xs text-slate-400">
              No matching options found. Press enter or click &quot;Use&quot; above to use &quot;{value}&quot;.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
