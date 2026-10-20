import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { exportJsonBackup } from '../utils/backup';
import { ConfirmationModal } from './ConfirmationModal';
import { AppLogo } from './AppLogo';
import {
  X,
  ArrowLeft,
  Sliders,
  Moon,
  Sun,
  Download,
  Upload,
  UserPlus,
  Trash2,
  AlertOctagon,
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
  ImagePlus,
  Palette,
  ListOrdered,
  Bell,
} from 'lucide-react';
import { ValueCombobox } from './ValueCombobox';
import { LINEUP_SPOTS } from '../types/baseball';
import { OppositionTeamsSettings } from './OppositionTeamsSettings';
import { requestGameNotificationPermission } from '../utils/gameNotifications';

/** Small number box so a value outside the presets can be typed in manually. */
const CustomNumberInput: React.FC<{
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

export type SettingsSectionId = 'playerDetails' | 'teams' | 'oppositionTeams' | 'teamLists' | 'scoring' | 'displayTheme' | 'notifications' | 'players' | 'data';

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
    profiles,
    activeProfile,
    updateActiveProfile,
    addProfile,
    setActiveProfileId,
    deleteProfile,
    addPlayerTeam,
    updatePlayerTeam,
    deletePlayerTeam,
    setDefaultPlayerTeam,
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
  } = useGame();

  const [newPlayerName, setNewPlayerName] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newJersey, setNewJersey] = useState('');
  const [newDefaultLineupSpot, setNewDefaultLineupSpot] = useState<number | undefined>(undefined);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>(initialSection);

  // Presets management state (Tournaments, Seasons, Age Groups)
  const [activePresetTab, setActivePresetTab] = useState<'seasons' | 'tournaments' | 'ageGroups'>('seasons');
  const [newSeasonInput, setNewSeasonInput] = useState('');
  const [newTournamentInput, setNewTournamentInput] = useState('');
  const [newAgeGroupInput, setNewAgeGroupInput] = useState('');

  // Teams management state
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamInputName, setNewTeamInputName] = useState('');
  const [newTeamInputJersey, setNewTeamInputJersey] = useState('');
  const [newTeamInputAge, setNewTeamInputAge] = useState('');
  const [newTeamInputSeason, setNewTeamInputSeason] = useState('');
  const [newTeamInputTournament, setNewTeamInputTournament] = useState('');

  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  // Keep a local render fallback while the profile context persists the uploaded team logo.
  const [teamLogoPreviews, setTeamLogoPreviews] = useState<Record<string, string>>({});
  const [editTeamInputName, setEditTeamInputName] = useState('');
  const [editTeamInputJersey, setEditTeamInputJersey] = useState('');
  const [editTeamInputAge, setEditTeamInputAge] = useState('');
  const [editTeamInputSeason, setEditTeamInputSeason] = useState('');
  const [editTeamInputTournament, setEditTeamInputTournament] = useState('');
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

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    addProfile({
      playerName: newPlayerName.trim(),
      teamName: newTeamName.trim() || 'My Team',
      jerseyNumber: newJersey.trim(),
      defaultLineupSpot: newDefaultLineupSpot,
    });

    setNewPlayerName('');
    setNewTeamName('');
    setNewJersey('');
    setNewDefaultLineupSpot(undefined);
    setShowAddPlayer(false);
    setStatusMessage({ text: 'New player profile added!', isError: false });
  };

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

  // Shrink the chosen image so it stays small in local storage
  const resizeImage = (file: File, maxSize = 256): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the file'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('That file is not a valid image'));
        img.onload = () => {
          const srcW = img.naturalWidth || maxSize;
          const srcH = img.naturalHeight || maxSize;
          const scale = Math.min(1, maxSize / Math.max(srcW, srcH));
          const w = Math.max(1, Math.round(srcW * scale));
          const h = Math.max(1, Math.round(srcH * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Image processing is not supported here'));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (logoInputRef.current) logoInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatusMessage({ text: 'Please choose an image file (PNG, JPG, etc.).', isError: true });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatusMessage({ text: 'That image is too large. Please choose one under 10 MB.', isError: true });
      return;
    }
    try {
      const dataUrl = await resizeImage(file);
      updateActiveProfile({ logo: dataUrl });
      setStatusMessage({ text: 'Logo updated!', isError: false });
    } catch (err) {
      setStatusMessage({
        text: err instanceof Error ? err.message : 'Could not use that image.',
        isError: true,
      });
    }
  };

  const handleTeamLogoFile = async (e: React.ChangeEvent<HTMLInputElement>, teamId: string) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatusMessage({ text: 'Please choose an image file (PNG, JPG, etc.).', isError: true });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatusMessage({ text: 'That image is too large. Please choose one under 10 MB.', isError: true });
      return;
    }
    try {
      // Keep per-team logos smaller than player photos so multiple teams fit comfortably in local storage.
      const dataUrl = await resizeImage(file, 128);
      const teamExists = (activeProfile.teams || []).some((team) => team.id === teamId)
        || (!(activeProfile.teams || []).length && teamId === 'primary-team' && Boolean(activeProfile.teamName));
      if (!teamExists) {
        setStatusMessage({ text: 'Could not find that team. Close Settings and try again.', isError: true });
        return;
      }
      // Update the visible logo immediately as well as saving it to the profile context.
      setTeamLogoPreviews((prev) => ({ ...prev, [teamId]: dataUrl }));
      updatePlayerTeam(activeProfile.id, teamId, { logo: dataUrl });
      setStatusMessage({ text: 'Team logo updated!', isError: false });
    } catch (err) {
      setStatusMessage({ text: err instanceof Error ? err.message : 'Could not use that image.', isError: true });
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
            {settingsSection === 'playerDetails' && (
              <div className="space-y-6">
             

            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#18212D] dark:text-blue-400" />
                Player & Team Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-[#252D38]/40 p-4 rounded-xl border border-slate-200 dark:border-[#354050]">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1">
                    Player Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alex"
                    value={activeProfile.playerName}
                    onChange={(e) => updateActiveProfile({ playerName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#18212D] dark:focus:ring-[#00D7BC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1">
                    Primary Team Name
                  </label>
                  <input
                    type="text"
                    value={activeProfile.teams?.find((team) => team.isDefault)?.name || activeProfile.teamName || ''}
                    readOnly
                    aria-describedby="primary-team-help"
                    placeholder="Choose a primary team in Teams"
                    className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-semibold text-slate-600 dark:border-[#354050] dark:bg-[#252D38]/70 dark:text-[#D1D5DB]"
                  />
                  <p id="primary-team-help" className="mt-1 text-[10px] text-slate-500 dark:text-[#9CA3AF]">
                    Set or change the primary team in the Teams section.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1">
                    Jersey Number (Primary Team)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 24"
                    value={activeProfile.jerseyNumber || ''}
                    onChange={(e) => updateActiveProfile({ jerseyNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#18212D] dark:focus:ring-[#00D7BC]"
                  />
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-[#9CA3AF]">
                    Saved with primary team. You can set a different jersey number for each team in the Teams section.
                  </p>
                </div>
                {/* Custom logo */}
                <div className="sm:col-span-2 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-white dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] flex items-center justify-center shrink-0">
                    <AppLogo variant="logo" className="w-full h-full object-contain p-1" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1">
                      Player Logo / Image
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] text-xs font-semibold flex items-center gap-1.5"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        {activeProfile.logo ? 'Change Logo' : 'Upload Logo'}
                      </button>
                      {activeProfile.logo && (
                        <button
                          type="button"
                          onClick={() => {
                            updateActiveProfile({ logo: undefined });
                            setStatusMessage({ text: 'Logo removed. Using the default logo.', isError: false });
                          }}
                          className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-600 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38]"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF] mt-1">
                      {activeProfile.logo ? 'Using your own logo.' : 'Using the default logo.'}
                    </p>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFile}
                      className="hidden"
                    />
                  </div>
                </div>
                <p className="sm:col-span-2 text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                  Saved automatically on this device.
                </p>
              </div>
            </div>
              </div>

            )}

            {/* Teams for this Player (Multi-team with Tournament, Age Group, Season) */}
            {settingsSection === 'teams' && (
              <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1 basis-48">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]" />
                    Teams for {activeProfile.playerName || 'Player'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mt-0.5">
                    If he plays for multiple teams, add each team here with its tournament, age group, and season.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddTeam(!showAddTeam)}
                  className="px-2.5 py-1.5 rounded-md bg-teal-50 dark:bg-[#00D7BC]/15 text-[#007A6A] dark:text-[#00D7BC] text-xs font-semibold hover:bg-teal-100 dark:hover:bg-[#00D7BC]/15 flex items-center gap-1 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {showAddTeam ? 'Cancel' : 'Add Another Team'}
                </button>
              </div>

              {/* Add New Team Form */}
              {showAddTeam && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newTeamInputName.trim()) return;
                    addPlayerTeam(activeProfile.id, {
                      name: newTeamInputName.trim(),
                      jerseyNumber: newTeamInputJersey.trim() || undefined,
                      ageGroup: newTeamInputAge.trim() || undefined,
                      season: newTeamInputSeason.trim() || undefined,
                      tournament: newTeamInputTournament.trim() || undefined,
                      isDefault: (activeProfile.teams || []).length === 0,
                    });
                    setNewTeamInputName('');
                    setNewTeamInputJersey('');
                    setNewTeamInputAge('');
                    setNewTeamInputSeason('');
                    setNewTeamInputTournament('');
                    setShowAddTeam(false);
                    setStatusMessage({ text: 'New team added for player!', isError: false });
                  }}
                  className="p-4 mb-3 rounded-xl bg-slate-100 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] space-y-3 animate-in fade-in duration-150"
                >
                  <div className="font-extrabold text-xs text-slate-900 dark:text-[#FAFAFA] flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-[#007A6A] dark:text-[#00D7BC]" />
                    Add Another Team
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                        Team Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Thunderbolts U12 Travel, East High Varsity"
                        value={newTeamInputName}
                        onChange={(e) => setNewTeamInputName(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                        Jersey # on Team
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 14"
                        value={newTeamInputJersey}
                        onChange={(e) => setNewTeamInputJersey(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                        Age Group (Select or type)
                      </label>
                      <ValueCombobox value={newTeamInputAge} onChange={setNewTeamInputAge} options={allAgeGroups} placeholder="e.g. U12" ariaLabel="e.g. U12" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                        Season (Select or type)
                      </label>
                      <ValueCombobox value={newTeamInputSeason} onChange={setNewTeamInputSeason} options={allSeasons} placeholder="e.g. Spring 2026" ariaLabel="e.g. Spring 2026" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                      Default Tournament (Select or type, optional)
                    </label>
                    <ValueCombobox value={newTeamInputTournament} onChange={setNewTeamInputTournament} options={allTournaments} placeholder="e.g. Triple Crown Classic" ariaLabel="e.g. Triple Crown Classic" />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddTeam(false)}
                      className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-600 dark:text-[#9CA3AF]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newTeamInputName.trim()}
                      className="px-4 py-1.5 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] disabled:opacity-50 text-[#18212D] dark:text-[#101419] text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save Team
                    </button>
                  </div>
                </form>
              )}

              {/* List of registered teams */}
              <div className="space-y-2">
                {(() => {
                  const teams =
                    activeProfile.teams && activeProfile.teams.length > 0
                      ? activeProfile.teams
                      : activeProfile.teamName
                      ? [
                          {
                            id: 'primary-team',
                            name: activeProfile.teamName,
                            ageGroup: activeProfile.defaultAgeGroup || '',
                            season: activeProfile.defaultSeason || '',
                            tournament: activeProfile.defaultTournament || '',
                            logo: undefined,
                            isDefault: true,
                          },
                        ]
                      : [];

                  if (teams.length === 0) {
                    return (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/40 border border-dashed border-slate-300 dark:border-[#354050] text-center text-xs text-slate-500 dark:text-[#9CA3AF]">
                        No teams added yet. Click &quot;Add Another Team&quot; above to add his first team!
                      </div>
                    );
                  }

                  return teams.map((team) => {
                    const isEditingThisTeam = editingTeamId === team.id;

                    if (isEditingThisTeam) {
                      return (
                        <div
                          key={team.id}
                          className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-[#252D38] border border-blue-200 dark:border-blue-900 space-y-2"
                        >
                          <div className="font-semibold text-xs text-[#18212D] dark:text-blue-300">
                            Edit Team Details
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="sm:col-span-2">
                              <input
                                type="text"
                                value={editTeamInputName}
                                onChange={(e) => setEditTeamInputName(e.target.value)}
                                placeholder="Team name"
                                className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]"
                              />
                            </div>
                            <div>
                              <input
                                type="text"
                                value={editTeamInputJersey}
                                onChange={(e) => setEditTeamInputJersey(e.target.value)}
                                placeholder="Jersey # (e.g. 14)"
                                className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <ValueCombobox value={editTeamInputAge} onChange={setEditTeamInputAge} options={allAgeGroups} placeholder="Age group (e.g. U12)" ariaLabel="Age group (e.g. U12)" />
                            <ValueCombobox value={editTeamInputSeason} onChange={setEditTeamInputSeason} options={allSeasons} placeholder="Season (e.g. Spring 2026)" ariaLabel="Season (e.g. Spring 2026)" />
                          </div>
                          <ValueCombobox value={editTeamInputTournament} onChange={setEditTeamInputTournament} options={allTournaments} placeholder="Tournament (optional)" ariaLabel="Tournament (optional)" />
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingTeamId(null)}
                              className="px-3 py-1 rounded text-xs text-slate-500 font-semibold"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updatePlayerTeam(activeProfile.id, team.id, {
                                  name: editTeamInputName.trim() || team.name,
                                  jerseyNumber: editTeamInputJersey.trim() || undefined,
                                  ageGroup: editTeamInputAge.trim() || undefined,
                                  season: editTeamInputSeason.trim() || undefined,
                                  tournament: editTeamInputTournament.trim() || undefined,
                                });
                                setEditingTeamId(null);
                                setStatusMessage({ text: 'Team details updated!', isError: false });
                              }}
                              className="px-3 py-1 rounded bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] text-xs font-semibold"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={team.id}
                        className="grid min-w-0 w-full grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300 dark:border-[#354050] dark:bg-[#252D38]/40"
                      >
                        <div className="grid min-w-0 w-full grid-cols-[3rem_minmax(0,1fr)] items-start gap-3">
                          {(teamLogoPreviews[team.id] || team.logo) ? (
                            <img src={teamLogoPreviews[team.id] || team.logo} alt={`${team.name} logo`} className="h-12 w-12 shrink-0 rounded-md border border-slate-200 bg-white object-contain p-1 dark:border-[#354050] dark:bg-[#1A2028]" onError={() => setStatusMessage({ text: `The ${team.name} logo image could not be displayed. Please try a different image.`, isError: true })} />
                          ) : (
                            <div className="h-12 w-12 shrink-0 rounded-md border border-dashed border-slate-300 dark:border-[#354050] flex items-center justify-center text-[9px] text-slate-400">Logo</div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm text-slate-900 dark:text-[#FAFAFA] break-words">
                              {team.name}
                            </span>
                            {team.jerseyNumber && (
                              <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#354050] text-slate-800 dark:text-[#FAFAFA]">
                                #{team.jerseyNumber}
                              </span>
                            )}
                            {team.isDefault && (
                              <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                Primary
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs">
                            {team.ageGroup && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                                {team.ageGroup}
                              </span>
                            )}
                            {team.season && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                                {team.season}
                              </span>
                            )}
                            {team.tournament && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center gap-0.5">
                                <Trophy className="w-3 h-3 shrink-0" /> {team.tournament}
                              </span>
                            )}
                          </div>
                        </div>
                        </div>

                        <div className="flex w-full min-w-0 flex-col gap-2 border-t border-slate-100 pt-2 dark:border-[#354050] sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-1">
                            <input id={`team-logo-${team.id}`} type="file" accept="image/*" className="hidden" onChange={(e) => handleTeamLogoFile(e, team.id)} />
                            <button type="button" onClick={() => document.getElementById(`team-logo-${team.id}`)?.click()} className="px-2 py-1 rounded-md text-[10px] font-semibold text-slate-600 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#354050]" title={`${team.logo ? 'Change' : 'Upload'} ${team.name} logo`}>{team.logo ? 'Change Logo' : 'Upload Logo'}</button>
                            {(teamLogoPreviews[team.id] || team.logo) && <button type="button" onClick={() => { setTeamLogoPreviews((prev) => { const next = { ...prev }; delete next[team.id]; return next; }); updatePlayerTeam(activeProfile.id, team.id, { logo: undefined }); setStatusMessage({ text: 'Team logo removed.', isError: false }); }} className="px-2 py-1 rounded-md text-[10px] font-semibold text-slate-500 hover:bg-slate-100 dark:text-[#9CA3AF] dark:hover:bg-[#354050]">Remove Logo</button>}
                          </div>
                          {/* Team actions */}
                          <div className="flex flex-wrap items-center gap-1">
                          {!team.isDefault && (
                            <button
                              type="button"
                              onClick={() => {
                                setDefaultPlayerTeam(activeProfile.id, team.id);
                                setStatusMessage({ text: `Set ${team.name} as primary team!`, isError: false });
                              }}
                              className="px-2 py-1 rounded-md text-[10px] font-semibold text-slate-600 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#354050]"
                              title="Set as default team"
                            >
                              Make Primary
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTeamId(team.id);
                              setEditTeamInputName(team.name);
                              setEditTeamInputJersey(team.jerseyNumber || '');
                              setEditTeamInputAge(team.ageGroup || '');
                              setEditTeamInputSeason(team.season || '');
                              setEditTeamInputTournament(team.tournament || '');
                            }}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#354050]"
                            title="Edit team"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {teams.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                deletePlayerTeam(activeProfile.id, team.id);
                                setStatusMessage({ text: 'Team removed', isError: false });
                              }}
                              className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-[#FF5252]/15"
                              title="Delete team"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

              </div>
            )}

            {settingsSection === 'teamLists' && (
              <div className="space-y-6">
            {/* Master Presets: Seasons, Tournaments & Age Groups */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    Seasons, Tournaments & Age Groups
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mt-0.5">
                    Manage the seasons, tournaments, and age groups available when setting up teams.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#252D38]/40 p-4 rounded-xl border border-slate-200 dark:border-[#354050] space-y-4">
                {/* 3 Tab Switchers */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-white dark:bg-[#1A2028] rounded-xl border border-slate-200 dark:border-[#354050]/80">
                  <button
                    type="button"
                    onClick={() => setActivePresetTab('seasons')}
                    className={`min-w-0 py-2 px-1 sm:px-2 rounded-md text-[11px] sm:text-xs font-extrabold flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-all ${
                      activePresetTab === 'seasons'
                        ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                        : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-full">Seasons</span>
                    <span
                      className={`text-[10px] px-1.5 leading-4 rounded-full font-semibold ${
                        activePresetTab === 'seasons'
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
                      activePresetTab === 'tournaments'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-full">Tournaments</span>
                    <span
                      className={`text-[10px] px-1.5 leading-4 rounded-full font-semibold ${
                        activePresetTab === 'tournaments'
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
                      activePresetTab === 'ageGroups'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-full">Age Groups</span>
                    <span
                      className={`text-[10px] px-1.5 leading-4 rounded-full font-semibold ${
                        activePresetTab === 'ageGroups'
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-[#252D38] text-slate-500'
                      }`}
                    >
                      {allAgeGroups.length}
                    </span>
                  </button>
                </div>

                {/* TAB 1: SEASONS */}
                {activePresetTab === 'seasons' && (
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
                {activePresetTab === 'tournaments' && (
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
                {activePresetTab === 'ageGroups' && (
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

            {settingsSection === 'scoring' && (
              <div className="space-y-6">
            {/* Scoring rules */}
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-3 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#18212D] dark:text-blue-400" />
                Scoring & Formula Rules
              </h3>

              <div className="space-y-3 bg-slate-50 dark:bg-[#252D38]/40 p-4 rounded-xl border border-slate-200 dark:border-[#354050]">
                {/* Home run auto Run + RBI */}
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <label className="text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] block">
                      Home run also records Run & RBI
                    </label>
                    <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                      When enabled, tapping HR automatically records +1 Run and +1 RBI.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({
                        homeRunAddsRunAndRbi: !settings.homeRunAddsRunAndRbi,
                      })
                    }
                    className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                      settings.homeRunAddsRunAndRbi
                        ? 'bg-[#00BFA5] dark:bg-[#00D7BC]'
                        : 'bg-slate-300 dark:bg-[#354050]'
                    }`}
                  >
                    <div
                      className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                        settings.homeRunAddsRunAndRbi ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <hr className="border-slate-200 dark:border-[#354050]" />

                {/* Innings per game for ERA */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 mb-1.5">
                    <label className="text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">
                      Innings per game (for ERA formula)
                    </label>
                    <span className="font-extrabold text-sm text-[#007A6A] dark:text-[#00D7BC]">
                      {settings.inningsPerGame} innings
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mb-2">
                    Standard youth baseball is 6 or 7 innings; high school/pro is 9.
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {[6, 7, 8, 9].map((inn) => (
                      <button
                        key={inn}
                        type="button"
                        onClick={() => updateSettings({ inningsPerGame: inn })}
                        className={`py-2 rounded-md text-xs font-semibold transition-all ${
                          settings.inningsPerGame === inn
                            ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                            : 'bg-white dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050]'
                        }`}
                      >
                        {inn}<span className="hidden min-[400px]:inline"> Innings</span>
                      </button>
                    ))}
                  </div>
                  <CustomNumberInput
                    value={settings.inningsPerGame}
                    presets={[6, 7, 8, 9]}
                    min={1}
                    max={20}
                    label="Custom innings per game"
                    onChange={(n) => updateSettings({ inningsPerGame: n })}
                  />
                </div>

                <hr className="border-slate-200 dark:border-[#354050]" />

                {/* Pitch Count Daily Limit */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 mb-1.5">
                    <label className="text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">
                      Pitch Count Daily Limit
                    </label>
                    <span className="font-extrabold text-sm text-blue-600 dark:text-blue-400">
                      {settings.pitchCountLimit || 85} pitches max
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mb-2">
                    Official Little League / USA Baseball Pitch Smart maximum daily threshold.
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {[50, 75, 85, 95].map((limit) => (
                      <button
                        key={limit}
                        type="button"
                        onClick={() => updateSettings({ pitchCountLimit: limit })}
                        className={`py-2 rounded-md text-xs font-semibold transition-all ${
                          (settings.pitchCountLimit || 85) === limit
                            ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                            : 'bg-white dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050]'
                        }`}
                      >
                        {limit}<span className="hidden min-[400px]:inline"> Pitches</span>
                      </button>
                    ))}
                  </div>
                  <CustomNumberInput
                    value={settings.pitchCountLimit || 85}
                    presets={[50, 75, 85, 95]}
                    min={1}
                    max={200}
                    label="Custom pitch count limit"
                    onChange={(n) => updateSettings({ pitchCountLimit: n })}
                  />
                </div>

                <hr className="border-slate-200 dark:border-[#354050]" />

                {/* Hit Direction Tapper Toggle */}
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <label className="text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] block">
                      Spray Chart & Hit Direction Tapper
                    </label>
                    <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                      Prompt the interactive field tapper on batted balls to map hit zone (LF, CF, RF, infield) and trajectory.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({
                        trackHitLocation: !(settings.trackHitLocation ?? true),
                      })
                    }
                    className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                      (settings.trackHitLocation ?? true)
                        ? 'bg-[#00BFA5] dark:bg-[#00D7BC]'
                        : 'bg-slate-300 dark:bg-[#354050]'
                    }`}
                  >
                    <div
                      className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                        (settings.trackHitLocation ?? true) ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

              </div>
            </div>

            </div>
            )}

            {/* Theme management */}
            {settingsSection === 'displayTheme' && (
            <div className="space-y-6">
            {/* Appearance */}
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-3 flex items-center gap-2">
                <Sun className="w-4 h-4 text-blue-500" />
                Display Theme
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'dark', label: 'Dark', icon: Moon },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = settings.darkMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        updateSettings({
                          darkMode: item.id as 'system' | 'light' | 'dark',
                        })
                      }
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-[#00BFA5] shadow-md dark:border-[#00D7BC]'
                          : 'bg-slate-50 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border-slate-200 dark:border-[#354050]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            

              </div>
            )}

            {settingsSection === 'notifications' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#354050] dark:bg-[#252D38]/40">
                              <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">
                                    <Bell className="h-4 w-4 text-[#007A6A] dark:text-[#00D7BC]" />
                                    Game Reminders
                                  </h3>
                                  <p className="mt-1 text-xs text-slate-500 dark:text-[#9CA3AF]">
                                    Allow scheduled notifications for upcoming games. Reminders are handled by Android; Dugout Pulse does not need to keep running in the background.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={settings.gameRemindersEnabled === true}
                                  aria-label="Enable notifications for all game reminders"
                                  onClick={async () => {
                                    if (settings.gameRemindersEnabled === true) {
                                      updateSettings({ gameRemindersEnabled: false });
                                      setStatusMessage({ text: 'Game reminders disabled. Scheduled reminders have been cancelled.', isError: false });
                                      return;
                                    }
                                    const granted = await requestGameNotificationPermission();
                                    if (!granted) {
                                      setStatusMessage({ text: 'Allow notifications in the installed Android app to enable game reminders.', isError: true });
                                      return;
                                    }
                                    updateSettings({ gameRemindersEnabled: true });
                                    setStatusMessage({ text: 'Game reminders enabled. Games with a selected reminder will be scheduled.', isError: false });
                                  }}
                                  className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${settings.gameRemindersEnabled === true ? 'bg-[#00BFA5] dark:bg-[#00D7BC]' : 'bg-slate-300 dark:bg-[#354050]'}`}
                                >
                                  <span className={`h-5 w-5 rounded-full bg-white shadow-md transition-transform ${settings.gameRemindersEnabled === true ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                              </div>
                              <p className="mt-3 text-[10px] text-slate-500 dark:text-[#9CA3AF]">
                                Individual reminder times are selected when adding or editing each game. Only games with a reminder selected will notify you.
                              </p>
                            </div>
              </div>
            )}

            {/* Player management */}
            {settingsSection === 'players' && (
              <div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
                  Player Profiles ({profiles.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddPlayer(!showAddPlayer)}
                  className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC] hover:underline flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {showAddPlayer ? 'Cancel' : 'Add Player'}
                </button>
              </div>

              {showAddPlayer && (
                <form
                  onSubmit={handleAddPlayer}
                  className="p-3.5 mb-3 rounded-xl bg-slate-100 dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] space-y-2.5"
                >
                  <div className="font-semibold text-xs text-slate-800 dark:text-[#D1D5DB]">
                    Add New Player
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Player Name (e.g. Jack) *"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      required
                      className="px-3 py-2 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs text-slate-900 dark:text-[#FAFAFA]"
                    />
                    <input
                      type="text"
                      placeholder="Team Name (e.g. Tigers)"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="px-3 py-2 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs text-slate-900 dark:text-[#FAFAFA]"
                    />
                    <input
                      type="text"
                      placeholder="Jersey # (e.g. 24)"
                      value={newJersey}
                      onChange={(e) => setNewJersey(e.target.value)}
                      className="px-3 py-2 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs text-slate-900 dark:text-[#FAFAFA]"
                    />
                    <select
                      value={newDefaultLineupSpot ?? ''}
                      onChange={(e) => setNewDefaultLineupSpot(e.target.value ? Number(e.target.value) : undefined)}
                      className="px-3 py-2 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-medium text-slate-900 dark:text-[#FAFAFA]"
                    >
                      <option value="">Batting Spot (optional)</option>
                      {LINEUP_SPOTS.map((s) => (
                        <option key={s.spot} value={s.spot}>
                          #{s.spot} · {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] font-semibold text-xs hover:bg-[#00A892] dark:hover:bg-[#00C4AB]"
                    >
                      Save Player
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {profiles.map((p) => {
                  const isActive = p.id === activeProfile.id;
                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                        isActive
                          ? 'border-teal-400 bg-teal-50 dark:border-teal-700 dark:bg-teal-950/25'
                          : 'border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38]/30'
                      }`}
                    >
                      <div
                        onClick={() => setActiveProfileId(p.id)}
                        className="cursor-pointer flex-1 min-w-0"
                      >
                        <div className="font-semibold text-sm text-slate-900 dark:text-[#FAFAFA] flex items-center gap-2">
                          {p.playerName || 'Unnamed Player'}
                          {isActive && (
                            <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                          {p.teamName || 'No Team'}
                          {p.jerseyNumber ? ` · #${p.jerseyNumber}` : ''}
                          {p.defaultLineupSpot ? ` · Batting #${p.defaultLineupSpot}` : ''}
                        </div>
                      </div>

                      {profiles.length > 1 && !p.isDefault && (
                        <button
                          type="button"
                          onClick={() => deleteProfile(p.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-[#FF5252]/15"
                          title="Delete player"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

              </div>
            )}

            {settingsSection === 'oppositionTeams' && <OppositionTeamsSettings />}

            {settingsSection === 'data' && (
              <div className="space-y-6">
            {/* Backup & Restore */}
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-3 flex items-center gap-2">
                <Download className="w-4 h-4 text-teal-600" />
                Data Backup & Restore
              </h3>

              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="p-3 rounded-xl border border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38] hover:bg-slate-100 dark:hover:bg-[#2D3643] text-left flex flex-col gap-1 transition-colors"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-900 dark:text-[#FAFAFA]">
                    <Download className="w-4 h-4 text-blue-600" />
                    Export Full JSON
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                    Saves all games, profiles and settings to a JSON file.
                  </div>
                </button>

                <label className="p-3 rounded-xl border border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38] hover:bg-slate-100 dark:hover:bg-[#2D3643] text-left flex flex-col gap-1 cursor-pointer transition-colors">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-900 dark:text-[#FAFAFA]">
                    <Upload className="w-4 h-4 text-teal-600" />
                    Restore From JSON
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                    Upload a previously exported backup file.
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="pt-2 border-t border-slate-200 dark:border-[#354050]">
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-[#FF5252]/15 border border-red-200 dark:border-[#86252D] flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-xs text-red-900 dark:text-[#D4626D] flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-red-600" />
                    Reset All Local Data
                  </div>
                  <div className="text-[11px] text-red-700 dark:text-[#D4626D]">
                    Permanently deletes all saved games and history.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResetConfirmOpen(true)}
                  className="px-3 py-1.5 rounded-md bg-red-600 text-white font-semibold text-xs hover:bg-[#A82E38] shrink-0"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* About App */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#354050] dark:bg-[#252D38]">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
                About App
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-[#6B7280]">
                Build Version: B1001-1225
              </p>
            </div>
              </div>
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
        message="This will permanently delete all recorded games and season statistics on this device. This action cannot be undone."
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