import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { ScoringSettingsPanel } from './settings/ScoringSettingsPanel';
import { ThemeSettingsPanel } from './settings/ThemeSettingsPanel';
import { exportJsonBackup } from '../utils/backup';
import { ConfirmationModal } from './ConfirmationModal';
import {
  X,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  Plus,
  Edit2,
  Check,
  MapPin,
} from 'lucide-react';
import { processLogoImage } from '../utils/logoImage';
import { OppositionTeamsSettings } from './OppositionTeamsSettings';
import { NotificationsSettingsPanel } from './NotificationsSettingsPanel';
import { PlayerDetailsPanel } from './settings/PlayerDetailsPanel';
import { DataManagementPanel } from './settings/DataManagementPanel';
import { PlayerProfilesPanel } from './settings/PlayerProfilesPanel';
import { TeamsSettingsPanel } from './settings/TeamsSettingsPanel';
import { PresetSettingsPanel } from './settings/PresetSettingsPanel';

/** Small number box so a value outside the presets can be typed in manually. */
export type SettingsSectionId = 'playerDetails' | 'teams' | 'oppositionTeams' | 'teamLists' | 'seasons' | 'tournaments' | 'ageGroups' | 'venue' | 'scoring' | 'displayTheme' | 'notifications' | 'players' | 'data';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSectionId;
  onOpenSetupWizard?: () => void;
}


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
    games,
    importJsonData,
    resetAllData,
  } = useGame();

  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>(initialSection);

  const [newVenueInput, setNewVenueInput] = useState('');
  const [editingVenue, setEditingVenue] = useState<string | null>(null);
  const [editingVenueValue, setEditingVenueValue] = useState('');

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);


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
              <PresetSettingsPanel settingsSection={settingsSection} onStatusMessage={setStatusMessage} />
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