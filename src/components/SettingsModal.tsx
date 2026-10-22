import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { protectedStorageSetItem } from '../context/gameStorageSafety';
import { CustomNumberInput } from './settings/CustomNumberInput';
import { ScoringSettingsPanel } from './settings/ScoringSettingsPanel';
import { ThemeSettingsPanel } from './settings/ThemeSettingsPanel';
import { exportJsonBackup } from '../utils/backup';
import { ConfirmationModal } from './ConfirmationModal';
import teamIcon from '../assets/TeamIcon.png';
import {
  X,
  ArrowLeft,
  Sliders,
  Moon,
  Sun,
  Upload,
  Trash2,
  CheckCircle2,
  Plus,
  Edit2,
  Shield,
  Trophy,
  Check,
  Star,
  Users,
  Calendar,
  Layers,
  Palette,
  ListOrdered,
  MapPin,
} from 'lucide-react';
import { ValueCombobox } from './ValueCombobox';
import { processLogoImage } from '../utils/logoImage';
import { OppositionTeamsSettings } from './OppositionTeamsSettings';
import { NotificationsSettingsPanel } from './NotificationsSettingsPanel';
import { PlayerDetailsPanel } from './settings/PlayerDetailsPanel';
import { DataManagementPanel } from './settings/DataManagementPanel';
import { PlayerProfilesPanel } from './settings/PlayerProfilesPanel';
import { TeamsSettingsPanel } from './settings/TeamsSettingsPanel';

/** Small number box so a value outside the presets can be typed in manually. */
export type SettingsSectionId = 'playerDetails' | 'teams' | 'oppositionTeams' | 'teamLists' | 'seasons' | 'tournaments' | 'ageGroups' | 'venue' | 'scoring' | 'displayTheme' | 'notifications' | 'players' | 'data';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSectionId;
  onOpenSetupWizard?: () => void;
}

type PresetKind = 'seasons' | 'tournaments' | 'ageGroups';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialSection = 'playerDetails',
  onOpenSetupWizard,
}) => {
  const {
    settings,
    updateSettings,
    activeProfile,
    updateActiveProfile,
    savedTournaments,
    allTournaments,
    saveTournament,
    deleteTournament,
    savedAgeGroups,
    allAgeGroups,
    saveAgeGroup,
    deleteAgeGroup,
    savedSeasons,
    allSeasons,
    saveSeason,
    deleteSeason,
    games,
    importJsonData,
    resetAllData,
    hiddenTournaments,
    hiddenAgeGroups,
    hiddenSeasons,
    inUseTournaments,
    inUseAgeGroups,
    inUseSeasons,
    restoreHiddenPresets,
    renamePreset,
    restoreFailed,
  } = useGame();

  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>(initialSection);

  // Presets management state (Tournaments, Seasons, Age Groups)
  const [activePresetTab, setActivePresetTab] = useState<'seasons' | 'tournaments' | 'ageGroups'>('seasons');
  const presetSection: 'seasons' | 'tournaments' | 'ageGroups' = settingsSection === 'seasons' || settingsSection === 'tournaments' || settingsSection === 'ageGroups' ? settingsSection : activePresetTab;
  const [newSeasonInput, setNewSeasonInput] = useState('');
  const [newTournamentInput, setNewTournamentInput] = useState('');
  const [newAgeGroupInput, setNewAgeGroupInput] = useState('');
  const [newVenueInput, setNewVenueInput] = useState('');
  const [editingVenue, setEditingVenue] = useState<string | null>(null);
  const [editingVenueValue, setEditingVenueValue] = useState('');

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<{ kind: PresetKind; original: string } | null>(null);
  const [editingPresetValue, setEditingPresetValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const settingsContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSettingsSection(initialSection);
      settingsContentRef.current?.scrollTo({ top: 0 });
    }
  }, [isOpen, initialSection]);

  if (!isOpen) return null;


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
    setStatusMessage({
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
    setStatusMessage({ text: `Season "${val}" added to master list!`, isError: false });
    setNewSeasonInput('');
  };

  const handleAddTournament = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newTournamentInput.trim();
    if (!val) return;
    saveTournament(val);
    setStatusMessage({ text: `Tournament "${val}" added to master list!`, isError: false });
    setNewTournamentInput('');
  };

  const handleAddAgeGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newAgeGroupInput.trim();
    if (!val) return;
    saveAgeGroup(val);
    setStatusMessage({ text: `Age Group "${val}" added to master list!`, isError: false });
    setNewAgeGroupInput('');
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (logoInputRef.current) logoInputRef.current.value = '';
    if (!file) return;
    try {
      const dataUrl = await processLogoImage(file);
      updateActiveProfile({ logo: dataUrl });
      setStatusMessage({ text: 'Logo updated!', isError: false });
    } catch (err) {
      setStatusMessage({
        text: err instanceof Error ? err.message : 'Could not use that image.',
        isError: true,
      });
    }
  };


  const handleExportBackup = async () => {
    const ok = await exportJsonBackup({
      games,
      profiles,
      settings,
    });
    setStatusMessage(
      ok
        ? { text: 'Backup exported successfully!', isError: false }
        : { text: 'Backup export failed. Please try again.', isError: true },
    );
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = importJsonData(content);
        setStatusMessage({ text: result.message, isError: !result.success });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <div className="h-full min-h-0 flex-1 flex flex-col bg-white dark:bg-[#1A2028]">
        <div className="relative h-full w-full min-w-0 max-h-full flex flex-col bg-white dark:bg-[#1A2028] overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-[#354050] flex items-center justify-between bg-slate-50 dark:bg-[#1A2028]/80">
            <div className="min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block">
                Preferences
              </span>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA] leading-tight">
                Settings
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Back to app"
              aria-label="Back to app"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-[#D1D5DB]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Status alert banner */}
          {statusMessage && (
            <div
              className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between ${
                statusMessage.isError
                  ? 'bg-red-50 text-red-700 dark:bg-[#FF5252]/15 dark:text-[#D4626D]'
                  : 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{statusMessage.text}</span>
              </div>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-[10px] uppercase font-semibold underline ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Settings page content; navigation is provided by the app-wide drawer. */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div ref={settingsContentRef} className="app-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
              <div className="space-y-6">

            {/* Player & team details (auto-saved) */}
            <PlayerDetailsPanel
              activeProfile={activeProfile}
              updateActiveProfile={updateActiveProfile}
              logoInputRef={logoInputRef}
              onLogoFile={handleLogoFile}
              onRemoveLogo={() => {
                updateActiveProfile({ logo: undefined });
                setStatusMessage({ text: 'Logo removed. Using the default logo.', isError: false });
              }}
            />

            {/* Teams for this Player (Multi-team with Tournament, Age Group, Season) */}
            {settingsSection === 'teams' && (
              <TeamsSettingsPanel onStatusMessage={setStatusMessage} />
            )}
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
                              setStatusMessage({ text: 'Restored default seasons', isError: false });
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
                                  setStatusMessage({
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
                              setStatusMessage({ text: 'Restored default tournaments', isError: false });
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
                                  setStatusMessage({
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
                              setStatusMessage({ text: 'Restored default age groups', isError: false });
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
                                  setStatusMessage({
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
            )}

            {settingsSection === 'venue' && (
              <div className="space-y-5">
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
                    <MapPin className="h-4 w-4 text-[#007A6A] dark:text-[#00D7BC]" />
                    Venues
                  </h3>
                  <p className="mb-4 text-xs text-slate-500 dark:text-[#9CA3AF]">
                    Save the ballparks and fields where your team plays. You can manage this list here for use in game scheduling.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const venue = newVenueInput.trim();
                      if (!venue) return;
                      const currentVenues = settings.venues || [];
                      if (currentVenues.some((item) => item.toLowerCase() === venue.toLowerCase())) {
                        setStatusMessage({ text: 'That venue is already in your list.', isError: true });
                        return;
                      }
                      updateSettings({ venues: [...currentVenues, venue] });
                      setNewVenueInput('');
                      setStatusMessage({ text: `Venue "${venue}" added.`, isError: false });
                    }}
                    className="flex flex-col gap-2 sm:flex-row"
                  >
                    <input
                      type="text"
                      value={newVenueInput}
                      onChange={(e) => setNewVenueInput(e.target.value)}
                      placeholder="Venue or field name"
                      aria-label="Venue or field name"
                      className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA]"
                    />
                    <button
                      type="submit"
                      disabled={!newVenueInput.trim()}
                      className="flex shrink-0 items-center justify-center gap-1 rounded-xl bg-[#00BFA5] px-3.5 py-2.5 text-xs font-semibold text-[#18212D] shadow-xs hover:bg-[#00AD96] disabled:opacity-50 dark:bg-[#00D7BC] dark:text-[#101419]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Venue
                    </button>
                  </form>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF]">
                    Saved Venues ({(settings.venues || []).length})
                  </div>
                  {(settings.venues || []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500 dark:border-[#354050] dark:text-[#9CA3AF]">
                      No venues saved yet. Add your first venue above.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(settings.venues || []).map((venue) => {
                        const isEditingVenue = editingVenue === venue;
                        const saveVenueEdit = () => {
                          const renamedVenue = editingVenueValue.trim();
                          if (!renamedVenue) {
                            setStatusMessage({ text: 'Venue name cannot be empty.', isError: true });
                            return;
                          }
                          if ((settings.venues || []).some((item) => item !== venue && item.toLowerCase() === renamedVenue.toLowerCase())) {
                            setStatusMessage({ text: 'A venue with that name already exists.', isError: true });
                            return;
                          }
                          if (renamedVenue !== venue) {
                            const updatedVenues = (settings.venues || []).map((item) => item === venue ? renamedVenue : item);
                            updateSettings({ venues: updatedVenues });
                            // Keep previously scheduled games in sync with the renamed master venue.
                            try {
                              const upcomingGamesKey = 'dugoutPulse.upcomingGames.v1';
                              const storedGames = localStorage.getItem(upcomingGamesKey);
                              if (storedGames) {
                                const parsedGames = JSON.parse(storedGames);
                                if (Array.isArray(parsedGames)) {
                                  const updatedGames = parsedGames.map((game) =>
                                    game && typeof game.venue === 'string' && game.venue.trim().toLocaleLowerCase() === venue.trim().toLocaleLowerCase()
                                      ? { ...game, venue: renamedVenue }
                                      : game
                                  );
                                  localStorage.setItem(upcomingGamesKey, JSON.stringify(updatedGames));
                                }
                              }
                              window.dispatchEvent(new CustomEvent('dugout-pulse-venue-renamed', {
                                detail: { oldName: venue, newName: renamedVenue },
                              }));
                              setStatusMessage({ text: `Venue "${venue}" renamed to "${renamedVenue}" across saved venues and scheduled games.`, isError: false });
                            } catch {
                              setStatusMessage({ text: 'Venue name updated, but scheduled games could not be synchronized on this device. Please reopen Upcoming Games and check them.', isError: true });
                            }
                          }
                          setEditingVenue(null);
                          setEditingVenueValue('');
                        };
                        return (
                          <div key={venue} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-[#354050] dark:bg-[#252D38]/40">
                            <MapPin className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
                            {isEditingVenue ? (
                              <>
                                <input
                                  autoFocus
                                  type="text"
                                  value={editingVenueValue}
                                  onChange={(e) => setEditingVenueValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      saveVenueEdit();
                                    } else if (e.key === 'Escape') {
                                      setEditingVenue(null);
                                      setEditingVenueValue('');
                                    }
                                  }}
                                  aria-label={`Edit venue name ${venue}`}
                                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-semibold text-slate-900 dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA]"
                                />
                                <button
                                  type="button"
                                  onClick={saveVenueEdit}
                                  aria-label={`Save venue name ${venue}`}
                                  title="Save venue name"
                                  className="rounded-lg p-2 text-teal-600 hover:bg-teal-50 dark:text-[#00D7BC] dark:hover:bg-teal-950/40"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingVenue(null); setEditingVenueValue(''); }}
                                  aria-label="Cancel venue edit"
                                  title="Cancel"
                                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#354050]"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">{venue}</span>
                                <button
                                  type="button"
                                  onClick={() => { setEditingVenue(venue); setEditingVenueValue(venue); }}
                                  aria-label={`Edit ${venue}`}
                                  title="Edit venue"
                                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#007A6A] dark:text-[#9CA3AF] dark:hover:bg-[#354050] dark:hover:text-[#00D7BC]"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateSettings({ venues: (settings.venues || []).filter((item) => item !== venue) });
                                    if (editingVenue === venue) { setEditingVenue(null); setEditingVenueValue(''); }
                                    setStatusMessage({ text: `Venue "${venue}" removed.`, isError: false });
                                  }}
                                  aria-label={`Remove ${venue}`}
                                  title="Remove venue"
                                  className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-[#FF5252]/15"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {settingsSection === 'scoring' && <ScoringSettingsPanel settings={settings} updateSettings={updateSettings} />}

            {settingsSection === 'displayTheme' && <ThemeSettingsPanel settings={settings} updateSettings={updateSettings} />}

            {settingsSection === 'notifications' && <NotificationsSettingsPanel />}

            {/* Player management */}
            {settingsSection === 'players' && (
              <PlayerProfilesPanel onStatusMessage={setStatusMessage} />
            )}
            {settingsSection === 'oppositionTeams' && <OppositionTeamsSettings />}

            {settingsSection === 'data' && (
              <DataManagementPanel
                fileInputRef={fileInputRef}
                onExportBackup={handleExportBackup}
                onImportFile={handleImportFile}
                onOpenResetConfirm={() => setIsResetConfirmOpen(true)}
              />
            )}
          </div>
          </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#1A2028]/80 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] text-xs font-semibold hover:bg-[#00A892] dark:hover:bg-[#00C4AB] "
            >
              Done
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isResetConfirmOpen}
        title="Reset All Local Data?"
        message="This permanently deletes all recorded games, season statistics, settings, and custom logo images stored on this device. JSON backups do not contain the image files, so logos cannot be recovered from a backup after the local images are deleted. This action cannot be undone."
        confirmLabel="Yes, Reset Everything"
        variant="danger"
        onConfirm={() => {
          resetAllData();
          setIsResetConfirmOpen(false);
          setStatusMessage({ text: 'All data has been reset.', isError: false });
        }}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </>
  );
};