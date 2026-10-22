import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, X, Trophy, Plus, Trash2 } from 'lucide-react';
import { THEMED_DROPDOWN_CONTROL_CLASS } from './ThemedDropdown';

interface TournamentComboboxProps {
  value: string;
  onChange: (value: string) => void;
  allTournaments: string[];
  onDeleteTournament?: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const TournamentCombobox: React.FC<TournamentComboboxProps> = ({
  value,
  onChange,
  allTournaments,
  onDeleteTournament,
  placeholder = 'e.g. Triple Crown Classic, or leave blank for league',
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

  const filteredTournaments = useMemo(() => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      return allTournaments;
    }
    return allTournaments.filter((t) => t.toLowerCase().includes(trimmed));
  }, [allTournaments, value]);

  const hasExactMatch = useMemo(() => {
    const trimmed = value.trim().toLowerCase();
    return allTournaments.some((t) => t.trim().toLowerCase() === trimmed);
  }, [allTournaments, value]);

  const handleSelect = (tournamentName: string) => {
    onChange(tournamentName);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (allTournaments.length > 0) {
              setIsOpen(true);
            }
          }}
          className={`${THEMED_DROPDOWN_CONTROL_CLASS} py-2.5 pl-3.5 pr-16 placeholder:text-slate-400 dark:placeholder:text-[#6B7280]`}
        />

        <div className="absolute right-1.5 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-[#D1D5DB] hover:bg-slate-200/60 dark:hover:bg-[#354050] transition-colors"
              title="Clear tournament (set to regular league)"
              aria-label="Clear tournament"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            className={`p-1.5 rounded-md text-slate-500 dark:text-[#9CA3AF] hover:text-slate-800 dark:hover:text-[#FAFAFA] hover:bg-slate-200/60 dark:hover:bg-[#354050] transition-all ${
              isOpen ? 'bg-slate-200/80 dark:bg-[#354050]' : ''
            }`}
            title="Choose from remembered tournaments"
            aria-label="Choose from remembered tournaments"
          >
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
          <div className="px-3 py-2 bg-slate-50 dark:bg-[#252D38]/80 border-b border-slate-100 dark:border-[#354050] flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
            <span className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-blue-500" />
              Tournament / Event
            </span>
            <span className="text-[10px] font-normal normal-case text-slate-400">
              Type or select
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto overscroll-contain p-1 divide-y divide-slate-100 dark:divide-[#354050]/60">
            {/* Quick Option: Regular League Game (No tournament) */}
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full text-left px-3 py-2.5 rounded-md flex items-center justify-between gap-2 text-xs font-semibold transition-colors ${
                !value.trim()
                  ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]'
                  : 'text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#2D3643]'
              }`}
            >
              <span>Regular Season / League Game (No Tournament)</span>
              {!value.trim() && <Check className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC] shrink-0" />}
            </button>

            {/* If user typed a new tournament not in list */}
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

            {/* List of tournaments */}
            {filteredTournaments.map((t) => {
              const isSelected = value.trim().toLowerCase() === t.toLowerCase();

              return (
                <div
                  key={t}
                  onClick={() => handleSelect(t)}
                  className={`group w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md cursor-pointer text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]'
                      : 'text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#2D3643]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    <Trophy
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-blue-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{t}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSelected && <Check className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC] shrink-0" />}
                    {onDeleteTournament && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTournament(t);
                        }}
                        title={`Remove "${t}" from list`}
                        className="p-1 rounded-md opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-[#FF5252]/15"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Pick Chips */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 animate-in fade-in duration-150">
        <button
          type="button"
          onClick={() => handleSelect('')}
          className={`text-[11px] px-2.5 py-1 rounded-md font-semibold border transition-all ${
            !value.trim()
              ? 'bg-[#00BFA5] dark:bg-[#00D7BC] border-[#00BFA5] dark:border-[#00D7BC] text-[#18212D] dark:text-[#101419]'
              : 'bg-white dark:bg-[#252D38]/80 border-slate-200 dark:border-[#354050] text-slate-600 dark:text-[#9CA3AF] hover:bg-slate-50'
          }`}
        >
          League Play
        </button>

        {allTournaments.slice(0, 3).map((t) => {
          const isSelected = value.trim().toLowerCase() === t.toLowerCase();
          return (
            <button
              key={t}
              type="button"
              onClick={() => handleSelect(t)}
              className={`text-[11px] px-2.5 py-1 rounded-md font-semibold border transition-all truncate max-w-[180px] ${
                isSelected
                  ? 'bg-[#00BFA5] dark:bg-[#00D7BC] border-[#00BFA5] dark:border-[#00D7BC] text-[#18212D] dark:text-[#101419]'
                  : 'bg-white dark:bg-[#252D38]/80 border-slate-200 dark:border-[#354050] text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-50'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 shrink-0" /> {t}
            </button>
          );
        })}
      </div>
    </div>
  );
};
