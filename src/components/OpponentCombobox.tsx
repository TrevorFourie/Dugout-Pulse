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

const normalizeName = (name: string) => name.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

const editDistance = (left: string, right: string): number => {
  const a = normalizeName(left);
  const b = normalizeName(right);
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }

  return previous[b.length];
};

const isSimilarName = (candidate: string, existing: string) => {
  const a = normalizeName(candidate);
  const b = normalizeName(existing);
  if (!a || !b) return false;
  if (a === b || a.startsWith(b) || b.startsWith(a)) return true;
  const maxLength = Math.max(a.length, b.length);
  const allowedDistance = maxLength >= 8 ? 2 : 1;
  return maxLength >= 4 && editDistance(a, b) <= allowedDistance;
};

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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [addError, setAddError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addTeamInputRef = useRef<HTMLInputElement>(null);

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
      if (event.key === 'Escape' && !isAddModalOpen) {
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
  }, [isOpen, isAddModalOpen, value]);

  useEffect(() => {
    if (!isAddModalOpen) return;
    const frame = window.requestAnimationFrame(() => addTeamInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isAddModalOpen]);

  const isSearching = normalizeName(query) !== normalizeName(value);

  const filteredTeams = useMemo(() => {
    // Opening a selected field shows the full list; changing the text filters it.
    const term = (isSearching ? query : '').trim().toLocaleLowerCase();
    return [...oppositionTeams]
      .filter((team) => !term || team.name.toLocaleLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [oppositionTeams, query, isSearching]);

  const handleSelect = (team: OppositionTeam) => {
    setAddError('');
    onChange(team.name);
    setQuery(team.name);
    setIsOpen(false);
    setIsAddModalOpen(false);
  };

  const openAddModal = () => {
    setNewTeamName(query.trim());
    setAddError('');
    setIsAddModalOpen(true);
  };

  const modalMatches = useMemo(() => {
    const term = normalizeName(newTeamName);
    if (!term) return [];
    return [...oppositionTeams]
      .filter((team) => {
        const name = normalizeName(team.name);
        return name.includes(term) || term.includes(name) || isSimilarName(term, name);
      })
      .sort((a, b) => {
        const aExact = normalizeName(a.name) === term ? 0 : 1;
        const bExact = normalizeName(b.name) === term ? 0 : 1;
        return aExact - bExact || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
  }, [oppositionTeams, newTeamName]);

  const handleAddTeam = () => {
    const name = newTeamName.trim();
    if (!name || modalMatches.length > 0) return;
    if (!onAddTeam(name)) {
      setAddError('Could not add this team. Please try again.');
      return;
    }

    // The shared context updates the canonical list; keep the new team selected and
    // the dropdown open so it is immediately available in the normal selection list.
    onChange(name);
    setQuery(name);
    setAddError('');
    setIsAddModalOpen(false);
    setIsOpen(true);
  };

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange('');
    setQuery('');
    setIsOpen(true);
    inputRef.current?.focus();
  };

  return (
    <>
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
            onFocus={(event) => {
              setIsOpen(true);
              if (value && query === value) event.currentTarget.select();
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setAddError('');
              setIsOpen(true);
            }}
            onBlur={(event) => {
              // Keep focus changes inside the menu from clearing the search.
              const nextTarget = event.relatedTarget;
              if (!(nextTarget instanceof Node) || !containerRef.current?.contains(nextTarget)) {
                if (!isAddModalOpen) {
                  setIsOpen(false);
                  setQuery(value);
                }
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

              <button
                type="button"
                onClick={openAddModal}
                className="flex w-full min-w-0 items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/40"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">Add missing team…</span>
              </button>

              {filteredTeams.map((team) => {
                const selected = normalizeName(team.name) === normalizeName(value);
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
              {filteredTeams.length === 0 && isSearching && query.trim() && (
                <p className="px-3 py-3 text-center text-[11px] text-slate-500 dark:text-[#9CA3AF]">No matching team. Use “Add missing team” to check for similar names.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsAddModalOpen(false);
              setAddError('');
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-opposition-team-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#354050] dark:bg-[#252D38]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="add-opposition-team-title" className="text-sm font-bold text-[#18212D] dark:text-[#FAFAFA]">Add Opposition Team</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-[#9CA3AF]">Check the existing teams before adding a new one.</p>
              </div>
              <button
                type="button"
                onClick={() => { setIsAddModalOpen(false); setAddError(''); }}
                aria-label="Close add opposition team dialog"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-[#D1D5DB] dark:hover:bg-[#354050]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label htmlFor="new-opposition-team-name" className="mt-4 block text-xs font-semibold text-slate-700 dark:text-[#D1D5DB]">Team name</label>
            <input
              ref={addTeamInputRef}
              id="new-opposition-team-name"
              type="text"
              value={newTeamName}
              onChange={(event) => { setNewTeamName(event.target.value); setAddError(''); }}
              placeholder="Start typing a team name"
              autoComplete="off"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#18212D] outline-none transition-colors placeholder:text-slate-400 focus:border-[#00BFA5] focus:ring-2 focus:ring-[#00BFA5]/25 dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA] dark:placeholder:text-[#6B7280] dark:focus:border-[#00D7BC] dark:focus:ring-[#00D7BC]/25"
            />

            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#9CA3AF]">
                {modalMatches.length > 0 ? 'Matching or similar teams' : 'No matching teams'}
              </p>
              {modalMatches.length > 0 ? (
                <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1 dark:border-[#354050]">
                  {modalMatches.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => handleSelect(team)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-[#D1D5DB] dark:hover:bg-[#354050]"
                    >
                      {team.logo ? (
                        <img src={team.logo} alt="" className="h-6 w-6 shrink-0 rounded-sm bg-white object-contain" />
                      ) : (
                        <Shield className="h-4 w-4 shrink-0 text-slate-400 dark:text-[#9CA3AF]" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{team.name}</span>
                      <span className="text-[10px] font-medium text-slate-500 dark:text-[#9CA3AF]">Select</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-[#354050] dark:text-[#9CA3AF]">
                  No existing team looks like “{newTeamName.trim() || '…'}”. You can add it below.
                </p>
              )}
            </div>

            {addError && <p role="alert" className="mt-3 text-xs text-red-600 dark:text-[#D4626D]">{addError}</p>}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => { setIsAddModalOpen(false); setAddError(''); }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#2D3643]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddTeam}
                disabled={!newTeamName.trim() || modalMatches.length > 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00BFA5] px-4 py-2.5 text-xs font-semibold text-[#18212D] transition-colors hover:bg-[#00A892] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#00D7BC] dark:text-[#101419] dark:hover:bg-[#00C4AB]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Team
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
};
