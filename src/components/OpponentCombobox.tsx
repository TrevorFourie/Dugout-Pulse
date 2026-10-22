import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Shield, X } from 'lucide-react';
import type { OppositionTeam } from '../context/GameContext';

interface OpponentComboboxProps {
  value: string;
  onChange: (value: string) => void;
  oppositionTeams: OppositionTeam[];
  onAddTeam: (name: string) => boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const OpponentCombobox: React.FC<OpponentComboboxProps> = ({
  value,
  onChange,
  oppositionTeams,
  onAddTeam,
  placeholder = 'Search opposition teams',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [addError, setAddError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the visible selection in sync when the game or its opponent changes externally.
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Scope document listeners to the open menu and always remove them on close/unmount.
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery(value);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setQuery(value);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, value]);

  const isSearching = query.trim().toLocaleLowerCase() !== value.trim().toLocaleLowerCase();

  const filteredTeams = useMemo(() => {
    // Opening a selected field shows the full list; changing the text filters it.
    const term = (isSearching ? query : '').trim().toLocaleLowerCase();
    return [...oppositionTeams]
      .filter((team) => !term || team.name.toLocaleLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [oppositionTeams, query, isSearching]);

  const exactMatch = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term ? oppositionTeams.some((team) => team.name.trim().toLocaleLowerCase() === term) : false;
  }, [oppositionTeams, query]);

  const handleSelect = (team: OppositionTeam) => {
    setAddError('');
    onChange(team.name);
    setQuery(team.name);
    setIsOpen(false);
  };

  const handleAddTeam = () => {
    const name = query.trim();
    if (!name || exactMatch) return;
    if (!onAddTeam(name)) {
      setAddError('Could not add this team. It may already exist or storage may be full.');
      return;
    }
    setAddError('');
    onChange(name);
    setQuery(name);
    setIsOpen(false);
  };

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange('');
    setQuery('');
    setIsOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <div className="relative flex min-w-0 items-center">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          autoComplete="off"
          aria-label="Search opposition teams"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setAddError('');
            setIsOpen(true);
          }}
          onBlur={(event) => {
            // Keep focus changes inside the menu (option/add buttons) from clearing the search.
            // Leaving the whole control resets unselected text; no timer or deferred work is needed.
            if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
              setIsOpen(false);
              setQuery(value);
            }
          }}
          className="w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-20 text-xs font-semibold text-[#18212D] shadow-2xs transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#00BFA5]/30 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#FAFAFA] dark:placeholder:text-[#6B7280] dark:hover:border-[#465160] dark:focus:ring-[#00D7BC]/30 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="absolute right-1.5 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear opponent selection"
              title="Clear selection"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#354050] dark:hover:text-[#FAFAFA]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
                setQuery(value);
              } else {
                setIsOpen(true);
                setQuery('');
                inputRef.current?.focus();
              }
            }}
            aria-label="Show opposition teams"
            aria-expanded={isOpen}
            className={`flex items-center gap-1 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-[#9CA3AF] dark:hover:bg-[#354050] dark:hover:text-[#FAFAFA] ${isOpen ? 'bg-slate-100 dark:bg-[#354050]' : ''}`}
          >
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-[#354050] dark:text-[#D1D5DB]">{oppositionTeams.length}</span>
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && !disabled && (
        <div
          role="listbox"
          aria-label="Opposition teams"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[70] w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-[#354050] dark:bg-[#252D38]"
        >
          <div className="max-h-60 overflow-y-auto overscroll-contain p-1">
            {addError && <p role="alert" className="px-3 py-2 text-[11px] text-red-600 dark:text-[#D4626D]">{addError}</p>}

            {isSearching && query.trim() && !exactMatch && (
              <button
                type="button"
                onClick={handleAddTeam}
                className="flex w-full min-w-0 items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/40"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">Add “{query.trim()}” to Opposition Teams</span>
              </button>
            )}

            {filteredTeams.map((team) => {
              const selected = team.name.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase();
              return (
                <button
                  key={team.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => handleSelect(team)}
                  className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                    selected
                      ? 'bg-[#00BFA5] text-[#18212D] dark:bg-[#00D7BC] dark:text-[#101419]'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-[#D1D5DB] dark:hover:bg-[#2D3643]'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {team.logo ? (
                      <img src={team.logo} alt="" className="h-6 w-6 shrink-0 rounded-sm bg-white object-contain" />
                    ) : (
                      <Shield className="h-4 w-4 shrink-0 text-slate-400 dark:text-[#9CA3AF]" />
                    )}
                    <span className="truncate">{team.name}</span>
                  </span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />}
                </button>
              );
            })}

            {filteredTeams.length === 0 && !query.trim() && (
              <p className="px-3 py-4 text-center text-xs text-slate-500 dark:text-[#9CA3AF]">No opposition teams have been added yet.</p>
            )}
            {filteredTeams.length === 0 && isSearching && query.trim() && exactMatch === false && (
              <p className="px-3 py-3 text-center text-[11px] text-slate-500 dark:text-[#9CA3AF]">No matching team. Use the action above to add it to Opposition Teams.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
