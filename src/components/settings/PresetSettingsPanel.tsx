import React, { useState } from 'react';
import { Check, Edit2, Layers, Plus, Trash2, Trophy, Calendar, Users, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';

type PresetKind = 'seasons' | 'tournaments' | 'ageGroups';
type PresetSettingsSection = 'teamLists' | PresetKind;
interface PresetSettingsPanelProps {
  isActive: boolean;
  settingsSection: PresetSettingsSection;
  onStatusMessage: (message: { text: string; isError: boolean }) => void;
}

export const PresetSettingsPanel: React.FC<PresetSettingsPanelProps> = ({ isActive, settingsSection, onStatusMessage }) => {
  const {
    savedTournaments, allTournaments, saveTournament, deleteTournament,
    savedAgeGroups, allAgeGroups, saveAgeGroup, deleteAgeGroup,
    savedSeasons, allSeasons, saveSeason, deleteSeason,
    hiddenTournaments, hiddenAgeGroups, hiddenSeasons,
    inUseTournaments, inUseAgeGroups, inUseSeasons, restoreHiddenPresets, renamePreset,
  } = useGame();
  // Presets management state (Tournaments, Seasons, Age Groups)
  const [activePresetTab, setActivePresetTab] = useState<'seasons' | 'tournaments' | 'ageGroups'>('seasons');
  const presetSection: 'seasons' | 'tournaments' | 'ageGroups' = settingsSection === 'seasons' || settingsSection === 'tournaments' || settingsSection === 'ageGroups' ? settingsSection : activePresetTab;
  const [newSeasonInput, setNewSeasonInput] = useState('');
  const [newTournamentInput, setNewTournamentInput] = useState('');
  const [newAgeGroupInput, setNewAgeGroupInput] = useState('');

  const [editingPreset, setEditingPreset] = useState<{ kind: PresetKind; original: string } | null>(null);
  const [editingPresetValue, setEditingPresetValue] = useState('');
  // Inline rename of a season / tournament / age group
  const presetLabel: Record<PresetKind, string> = {
    seasons: 'Season',
    tournaments: 'Tournament',
    ageGroups: 'Age Group',
  };
  const startEditPreset = (kind: PresetKind, name: string) => {
    setEditingPreset({ kind, original: name });
    setEditingPresetValue(name);
  };
  const commitEditPreset = () => {
    if (!editingPreset) return;
    const val = editingPresetValue.trim();
    const { kind, original } = editingPreset;
    setEditingPreset(null);
    if (!val || val === original) return;
    renamePreset(kind, original, val);
    onStatusMessage({
      text: `${presetLabel[kind]} "${original}" renamed to "${val}" everywhere`,
      isError: false,
    });
  };
  const renderPresetEditor = (kind: PresetKind, name: string) => {
    if (!editingPreset || editingPreset.kind !== kind || editingPreset.original !== name) return null;
    return (
      <>
        <input
          autoFocus
          type="text"
          value={editingPresetValue}
          onChange={(e) => setEditingPresetValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitEditPreset();
            } else if (e.key === 'Escape') {
              setEditingPreset(null);
            }
          }}
          className="min-w-0 w-32 px-1.5 py-0.5 rounded bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]"
          aria-label={`Rename ${presetLabel[kind]}`}
        />
        <button type="button" onClick={commitEditPreset} className="p-0.5 text-teal-600 hover:text-teal-800" title="Save">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => setEditingPreset(null)} className="p-0.5 text-slate-500 hover:text-slate-700" title="Cancel">
          <X className="w-3.5 h-3.5" />
        </button>
      </>
    );
  };
  const isEditingPreset = (kind: PresetKind, name: string) =>
    editingPreset?.kind === kind && editingPreset.original === name;

  const handleAddSeason = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newSeasonInput.trim();
    if (!val) return;
    saveSeason(val);
    onStatusMessage({ text: `Season "${val}" added to master list!`, isError: false });
    setNewSeasonInput('');
  };

  const handleAddTournament = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newTournamentInput.trim();
    if (!val) return;
    saveTournament(val);
    onStatusMessage({ text: `Tournament "${val}" added to master list!`, isError: false });
    setNewTournamentInput('');
  };

  const handleAddAgeGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newAgeGroupInput.trim();
    if (!val) return;
    saveAgeGroup(val);
    onStatusMessage({ text: `Age Group "${val}" added to master list!`, isError: false });
    setNewAgeGroupInput('');
  };


  if (!isActive) return null;

  return (
            {(settingsSection === 'teamLists' || settingsSection === 'seasons' || settingsSection === 'tournaments' || settingsSection === 'ageGroups') && (
              <div className="space-y-6">
            {/* Master Presets: Seasons, Tournaments & Age Groups */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    {presetSection === 'seasons' ? 'Seasons' : presetSection === 'tournaments' ? 'Tournaments & Leagues' : 'Age Groups'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mt-0.5">
                    {presetSection === 'seasons' ? 'Manage the seasons available when setting up teams.' : presetSection === 'tournaments' ? 'Manage tournaments and leagues available when setting up teams.' : 'Manage the age groups available when setting up teams.'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#252D38]/40 p-4 rounded-xl border border-slate-200 dark:border-[#354050] space-y-4">
                {/* 3 Tab Switchers */}
                {settingsSection === 'teamLists' && (
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-white dark:bg-[#1A2028] rounded-xl border border-slate-200 dark:border-[#354050]/80">
                  <button
                    type="button"
                    onClick={() => setActivePresetTab('seasons')}
                    className={`min-w-0 py-2 px-1 sm:px-2 rounded-md text-[11px] sm:text-xs font-extrabold flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-all ${
                      presetSection === 'seasons'
                        ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                        : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-full">Seasons</span>
                    <span
                      className={`text-[10px] px-1.5 leading-4 rounded-full font-semibold ${
                        presetSection === 'seasons'
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-[#252D38] text-slate-500'
                      }`}
                    >
                      {allSeasons.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePresetTab('tournaments')}
                    className={`min-w-0 py-2 px-1 sm:px-2 rounded-md text-[11px] sm:text-xs font-extrabold flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-all ${
                      presetSection === 'tournaments'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-full">Tournaments</span>
                    <span
                      className={`text-[10px] px-1.5 leading-4 rounded-full font-semibold ${
                        presetSection === 'tournaments'
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-[#252D38] text-slate-500'
                      }`}
                    >
                      {allTournaments.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePresetTab('ageGroups')}
                    className={`min-w-0 py-2 px-1 sm:px-2 rounded-md text-[11px] sm:text-xs font-extrabold flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-all ${
                      presetSection === 'ageGroups'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-full">Age Groups</span>
                    <span
                      className={`text-[10px] px-1.5 leading-4 rounded-full font-semibold ${
                        presetSection === 'ageGroups'
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-[#252D38] text-slate-500'
                      }`}
                    >
                      {allAgeGroups.length}
                    </span>
                  </button>
                </div>
                )}

                {/* TAB 1: SEASONS */}
                {presetSection === 'seasons' && (
                  <div className="space-y-3">
                    <form onSubmit={handleAddSeason} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Add new season (e.g. Summer 2026)"
                        value={newSeasonInput}
                        onChange={(e) => setNewSeasonInput(e.target.value)}
                        className="flex-1 min-w-0 w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] placeholder:text-slate-400"
                      />
                      <button
                        type="submit"
                        disabled={!newSeasonInput.trim()}
                        className="px-3.5 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] disabled:opacity-50 text-[#18212D] dark:text-[#101419] text-xs font-semibold flex items-center justify-center gap-1 shrink-0 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Season
                      </button>
                    </form>

                    <div className="text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                      <span>Available Seasons ({allSeasons.length})</span>
                      <span className="text-[10px] text-slate-400 flex flex-wrap items-center gap-x-2">
                        <span>Tap the bin to remove. Items used by a team or game stay.</span>
                        {hiddenSeasons.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              restoreHiddenPresets('seasons');
                              onStatusMessage({ text: 'Restored default seasons', isError: false });
                            }}
                            className="font-semibold text-[#007A6A] dark:text-[#00D7BC] hover:underline"
                          >
                            Restore {hiddenSeasons.length} removed default{hiddenSeasons.length > 1 ? 's' : ''}
                          </button>
                        )}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto overflow-x-hidden p-2 app-scroll bg-white dark:bg-[#1A2028] rounded-xl border border-slate-200 dark:border-[#354050]">
                      {allSeasons.map((season) => {
                        const isSavedCustom = savedSeasons.some(
                          (s) => s.toLowerCase() === season.toLowerCase()
                        );
                        const inUse = inUseSeasons.includes(season.trim().toLowerCase());
                        return (
                          <div
                            key={season}
                            className={`max-w-full min-w-0 px-2.5 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                              isSavedCustom
                                ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-300'
                                : 'bg-slate-50 dark:bg-[#252D38]/60 border-slate-200 dark:border-[#354050] text-slate-700 dark:text-[#D1D5DB]'
                            }`}
                          >
                            <Calendar className="w-3 h-3 opacity-60" />
                            {isEditingPreset('seasons', season) ? (
                              renderPresetEditor('seasons', season)
                            ) : (
                              <>
                            <span className="truncate">{season}</span>
                            <button
                              type="button"
                              onClick={() => startEditPreset('seasons', season)}
                              className="ml-0.5 p-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded transition-colors"
                              title="Edit season"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {!inUse ? (
                              <button
                                type="button"
                                onClick={() => {
                                  deleteSeason(season);
                                  onStatusMessage({
                                    text: `Removed season "${season}"`,
                                    isError: false,
                                  });
                                }}
                                className="ml-1 p-0.5 text-teal-500 hover:text-teal-700 rounded transition-colors"
                                title="Remove season"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-slate-200/60 dark:bg-[#354050] text-slate-400 font-extrabold ml-1">
                                In use
                              </span>
                            )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 2: TOURNAMENTS */}
                {presetSection === 'tournaments' && (
                  <div className="space-y-3">
                    <form onSubmit={handleAddTournament} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Add new tournament (e.g. USSSA State)"
                        value={newTournamentInput}
                        onChange={(e) => setNewTournamentInput(e.target.value)}
                        className="flex-1 min-w-0 w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] placeholder:text-slate-400"
                      />
                      <button
                        type="submit"
                        disabled={!newTournamentInput.trim()}
                        className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1 shrink-0 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Tournament
                      </button>
                    </form>

                    <div className="text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                      <span>Available Tournaments ({allTournaments.length})</span>
                      <span className="text-[10px] text-slate-400 flex flex-wrap items-center gap-x-2">
                        <span>Tap the bin to remove. Items used by a team or game stay.</span>
                        {hiddenTournaments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              restoreHiddenPresets('tournaments');
                              onStatusMessage({ text: 'Restored default tournaments', isError: false });
                            }}
                            className="font-semibold text-[#007A6A] dark:text-[#00D7BC] hover:underline"
                          >
                            Restore {hiddenTournaments.length} removed default{hiddenTournaments.length > 1 ? 's' : ''}
                          </button>
                        )}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto overflow-x-hidden p-2 app-scroll bg-white dark:bg-[#1A2028] rounded-xl border border-slate-200 dark:border-[#354050]">
                      {allTournaments.map((tournament) => {
                        const isSavedCustom = savedTournaments.some(
                          (t) => t.toLowerCase() === tournament.toLowerCase()
                        );
                        const inUse = inUseTournaments.includes(tournament.trim().toLowerCase());
                        return (
                          <div
                            key={tournament}
                            className={`max-w-full min-w-0 px-2.5 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                              isSavedCustom
                                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                                : 'bg-slate-50 dark:bg-[#252D38]/60 border-slate-200 dark:border-[#354050] text-slate-700 dark:text-[#D1D5DB]'
                            }`}
                          >
                            <Trophy className="w-3 h-3 text-blue-500 shrink-0" />
                            {isEditingPreset('tournaments', tournament) ? (
                              renderPresetEditor('tournaments', tournament)
                            ) : (
                              <>
                            <span className="truncate">{tournament}</span>
                            <button
                              type="button"
                              onClick={() => startEditPreset('tournaments', tournament)}
                              className="ml-0.5 p-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded transition-colors"
                              title="Edit tournament"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {!inUse ? (
                              <button
                                type="button"
                                onClick={() => {
                                  deleteTournament(tournament);
                                  onStatusMessage({
                                    text: `Removed tournament "${tournament}"`,
                                    isError: false,
                                  });
                                }}
                                className="ml-1 p-0.5 text-teal-500 hover:text-teal-700 rounded transition-colors"
                                title="Remove tournament"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-slate-200/60 dark:bg-[#354050] text-slate-400 font-extrabold ml-1">
                                In use
                              </span>
                            )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 3: AGE GROUPS */}
                {presetSection === 'ageGroups' && (
                  <div className="space-y-3">
                    <form onSubmit={handleAddAgeGroup} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Add new age group (e.g. 15U)"
                        value={newAgeGroupInput}
                        onChange={(e) => setNewAgeGroupInput(e.target.value)}
                        className="flex-1 min-w-0 w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] placeholder:text-slate-400"
                      />
                      <button
                        type="submit"
                        disabled={!newAgeGroupInput.trim()}
                        className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1 shrink-0 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Age Group
                      </button>
                    </form>

                    <div className="text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                      <span>Available Age Groups ({allAgeGroups.length})</span>
                      <span className="text-[10px] text-slate-400 flex flex-wrap items-center gap-x-2">
                        <span>Tap the bin to remove. Items used by a team or game stay.</span>
                        {hiddenAgeGroups.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              restoreHiddenPresets('ageGroups');
                              onStatusMessage({ text: 'Restored default age groups', isError: false });
                            }}
                            className="font-semibold text-[#007A6A] dark:text-[#00D7BC] hover:underline"
                          >
                            Restore {hiddenAgeGroups.length} removed default{hiddenAgeGroups.length > 1 ? 's' : ''}
                          </button>
                        )}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto overflow-x-hidden p-2 app-scroll bg-white dark:bg-[#1A2028] rounded-xl border border-slate-200 dark:border-[#354050]">
                      {allAgeGroups.map((ageGroup) => {
                        const isSavedCustom = savedAgeGroups.some(
                          (ag) => ag.toLowerCase() === ageGroup.toLowerCase()
                        );
                        const inUse = inUseAgeGroups.includes(ageGroup.trim().toLowerCase());
                        return (
                          <div
                            key={ageGroup}
                            className={`max-w-full min-w-0 px-2.5 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                              isSavedCustom
                                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                                : 'bg-slate-50 dark:bg-[#252D38]/60 border-slate-200 dark:border-[#354050] text-slate-700 dark:text-[#D1D5DB]'
                            }`}
                          >
                            <Users className="w-3 h-3 opacity-60" />
                            {isEditingPreset('ageGroups', ageGroup) ? (
                              renderPresetEditor('ageGroups', ageGroup)
                            ) : (
                              <>
                            <span className="truncate">{ageGroup}</span>
                            <button
                              type="button"
                              onClick={() => startEditPreset('ageGroups', ageGroup)}
                              className="ml-0.5 p-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded transition-colors"
                              title="Edit ageGroup"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {!inUse ? (
                              <button
                                type="button"
                                onClick={() => {
                                  deleteAgeGroup(ageGroup);
                                  onStatusMessage({
                                    text: `Removed age group "${ageGroup}"`,
                                    isError: false,
                                  });
                                }}
                                className="ml-1 p-0.5 text-teal-500 hover:text-teal-700 rounded transition-colors"
                                title="Remove age group"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-slate-200/60 dark:bg-[#354050] text-slate-400 font-extrabold ml-1">
                                In use
                              </span>
                            )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

              </div>

  );
};
