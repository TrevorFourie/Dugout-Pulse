import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, X, Shield, History, Trash2, Plus } from 'lucide-react';

interface OpponentComboboxProps {
  value: string;
  onChange: (value: string) => void;
  allOpponents: string[];
  recentOpponents?: string[];
  onDeleteOpponent?: (name: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const OpponentCombobox: React.FC<OpponentComboboxProps> = ({
  value,
  onChange,
  allOpponents,
  recentOpponents = [],
  onDeleteOpponent,
  placeholder = 'e.g. Red Sox, Hawks, or type new team',
  required = false,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Filter opponents matching current typed value
  const filteredOpponents = useMemo(() => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      return allOpponents;
    }
    return allOpponents.filter((opp) => opp.toLowerCase().includes(trimmed));
  }, [allOpponents, value]);

  const hasExactMatch = useMemo(() => {
    const trimmed = value.trim().toLowerCase();
    return allOpponents.some((opp) => opp.trim().toLowerCase() === trimmed);
  }, [allOpponents, value]);

  const handleSelect = (opponentName: string) => {
    onChange(opponentName);
    setIsOpen(false);
    inputRef.current?.blur(); // don't refocus: it reopens the list and pops the keyboard
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleDelete = (e: React.MouseEvent, opponentName: string) => {
    e.stopPropagation();
    if (onDeleteOpponent) {
      onDeleteOpponent(opponentName);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Combobox Input Group */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          // Open only on a real tap/click. Programmatic focus (e.g. after picking a team)
          // must never reopen the list.
          onClick={() => {
            if (allOpponents.length > 0 && !hasExactMatch) {
              setIsOpen(true);
            }
          }}
          className="w-full pl-3.5 pr-20 py-2.5 rounded-xl bg-white dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] placeholder:text-slate-400 dark:placeholder:text-[#6B7280] focus:outline-hidden focus:ring-2 focus:ring-[#00BFA5]/30 dark:focus:ring-[#00D7BC]/30 transition-all shadow-2xs"
        />

        {/* Clear & Dropdown Actions */}
        <div className="absolute right-1.5 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-[#D1D5DB] hover:bg-slate-200/60 dark:hover:bg-[#354050] transition-colors"
              title="Clear opponent"
              aria-label="Clear opponent"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            className={`p-1.5 rounded-md text-slate-500 dark:text-[#9CA3AF] hover:text-slate-800 dark:hover:text-[#FAFAFA] hover:bg-slate-200/60 dark:hover:bg-[#354050] transition-all flex items-center gap-1 ${
              isOpen ? 'bg-slate-200/80 dark:bg-[#354050]' : ''
            }`}
            title="Choose from remembered opponents"
            aria-label="Choose from remembered opponents"
            aria-expanded={isOpen}
          >
            {allOpponents.length > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-[#354050] text-slate-600 dark:text-[#D1D5DB]">
                {allOpponents.length}
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-[#354050] bg-white dark:bg-[#252D38] shadow-xl animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header indicator */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-[#252D38]/80 border-b border-slate-100 dark:border-[#354050] flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
            <span className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-[#007A6A] dark:text-[#00D7BC]" />
              Previous Opponents ({allOpponents.length})
            </span>
            <span className="text-[10px] font-normal normal-case text-slate-400">
              Type or select
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto overscroll-contain p-1 divide-y divide-slate-100 dark:divide-[#354050]/60">
            {/* If user typed a new team name that doesn't match any saved opponent */}
            {value.trim() && !hasExactMatch && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
                className="w-full text-left px-3 py-2.5 rounded-md flex items-center gap-2 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-teal-700 dark:text-teal-400 transition-colors group"
              >
                <Plus className="w-4 h-4 shrink-0 text-teal-600 dark:text-teal-400" />
                <span className="text-xs font-semibold truncate">
                  Use <strong className="font-semibold underline">&quot;{value.trim()}&quot;</strong>{' '}
                  <span className="text-[10px] opacity-75 font-normal">
                    (will remember for future games)
                  </span>
                </span>
              </button>
            )}

            {/* List of remembered opponents */}
            {filteredOpponents.length > 0 ? (
              filteredOpponents.map((opp) => {
                const isSelected = value.trim().toLowerCase() === opp.toLowerCase();

                return (
                  <div
                    key={opp}
                    onClick={() => handleSelect(opp)}
                    className={`group w-full flex items-center justify-between gap-2 px-3 py-3.5 min-h-[48px] rounded-md cursor-pointer text-sm font-semibold transition-all ${
                      isSelected
                        ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]'
                        : 'text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#2D3643]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <Shield
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-blue-400' : 'text-slate-400 group-hover:text-[#18212D] dark:group-hover:text-[#FAFAFA]'
                        }`}
                      />
                      <span className="truncate">{opp}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected && <Check className="w-5 h-5 text-[#007A6A] dark:text-[#00D7BC] shrink-0" />}

                      {onDeleteOpponent && (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, opp)}
                          title={`Remove "${opp}" from remembered opponents`}
                          className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${
                            isSelected
                              ? 'text-slate-300 hover:text-white hover:bg-white/10'
                              : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-[#FF5252]/15'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 dark:text-[#9CA3AF]">
                {allOpponents.length === 0 ? (
                  <span>No saved opponents yet. Type a team name and it will be remembered!</span>
                ) : (
                  <span>
                    No saved opponents match &ldquo;{value}&rdquo;. Click outside to use this name.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Pick Chips for Recent Opponents (1-Tap Selection) */}
      {recentOpponents.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 animate-in fade-in duration-150">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] flex items-center gap-1 mr-0.5">
            <History className="w-3 h-3 text-[#007A6A] dark:text-[#00D7BC]" />
            Recent:
          </span>
          {recentOpponents.map((recent) => {
            const isSelected = value.trim().toLowerCase() === recent.toLowerCase();

            return (
              <button
                key={recent}
                type="button"
                onClick={() => handleSelect(recent)}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-[#00BFA5] dark:bg-[#00D7BC] border-[#00BFA5] dark:border-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                    : 'bg-white dark:bg-[#252D38]/80 border-slate-200 dark:border-[#354050] text-slate-700 dark:text-[#D1D5DB] hover:border-slate-400 dark:hover:border-[#465160] hover:bg-slate-50 dark:hover:bg-[#252D38]'
                }`}
              >
                {recent}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};