import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { ScoringSettingsPanel } from './settings/ScoringSettingsPanel';
import { ThemeSettingsPanel } from './settings/ThemeSettingsPanel';
import { exportJsonBackup } from '../utils/backup';
import { describeBackupAge, getBackupStatus } from '../utils/backupReminder';
import { ConfirmationModal } from './ConfirmationModal';
import {
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { processLogoImage } from '../utils/logoImage';
import { OppositionTeamsSettings } from './OppositionTeamsSettings';
import { NotificationsSettingsPanel } from './NotificationsSettingsPanel';
import { PlayerDetailsPanel } from './settings/PlayerDetailsPanel';
import { DataManagementPanel } from './settings/DataManagementPanel';
import { PlayerProfilesPanel } from './settings/PlayerProfilesPanel';
import { TeamsSettingsPanel } from './settings/TeamsSettingsPanel';
import { PresetSettingsPanel } from './settings/PresetSettingsPanel';
import { VenuesSettingsPanel } from './settings/VenuesSettingsPanel';
import { LogoLibraryPanel } from './settings/LogoLibraryPanel';

export type SettingsSectionId = 'playerDetails' | 'teams' | 'oppositionTeams' | 'teamLists' | 'seasons' | 'tournaments' | 'ageGroups' | 'venue' | 'scoring' | 'displayTheme' | 'notifications' | 'players' | 'data' | 'logoLibrary';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSectionId;
  onOpenSetupWizard?: () => void;
  /** Called after a backup was restored successfully (partial = restored, but something could not be). */
  onRestoreComplete?: (message: string, partial: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialSection = 'playerDetails',
  onOpenSetupWizard,
  onRestoreComplete,
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

  const [backupStatusTick, setBackupStatusTick] = useState(0);
  const backupStatus = React.useMemo(
    () => getBackupStatus(games.length > 0 || profiles.some((p) => p.playerName || p.teamName)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [games.length, profiles, backupStatusTick],
  );

  const handleExportBackup = async () => {
    const result = await exportJsonBackup({
      games,
      profiles,
      settings,
    });
    setBackupStatusTick((tick) => tick + 1);
    if (result.outcome === 'failed') {
      setStatusMessage({ text: `Backup export failed${result.error ? ` (${result.error})` : ''}. Nothing was saved. Please try again.`, isError: true });
    } else if (result.outcome === 'cancelled') {
      setStatusMessage({ text: 'Backup was not saved. Choose a place to keep the file (Drive, Files, email) to complete the backup.', isError: true });
    } else {
      const logoNote = result.missingLogos.length > 0
        ? ` Warning: ${result.missingLogos.length} custom logo image(s) could not be read and are not in this backup.`
        : '';
      setStatusMessage({
        text: `Backup file created. Make sure you saved it somewhere outside the app (Drive, Files, email or a computer) - a backup that stays only on this phone is lost if the app is uninstalled or the phone is lost.${logoNote}`,
        isError: result.missingLogos.length > 0,
      });
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = await importJsonData(content);
        setStatusMessage({ text: result.message, isError: !result.success });
        if (result.success) onRestoreComplete?.(result.message, Boolean(result.partial));
      }
    };
    reader.onerror = () => setStatusMessage({ text: 'Could not read the selected backup file. No data was changed.', isError: true });
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
            )}

            {/* Teams for this Player (Multi-team with Tournament, Age Group, Season) */}
            <TeamsSettingsPanel isActive={settingsSection === 'teams'} onStatusMessage={setStatusMessage} />
            <PresetSettingsPanel
              isActive={settingsSection === 'teamLists' || settingsSection === 'seasons' || settingsSection === 'tournaments' || settingsSection === 'ageGroups'}
              settingsSection={settingsSection === 'seasons' || settingsSection === 'tournaments' || settingsSection === 'ageGroups' ? settingsSection : 'teamLists'}
              onStatusMessage={setStatusMessage}
            />
            <VenuesSettingsPanel isActive={settingsSection === 'venue'} onStatusMessage={setStatusMessage} />
            {settingsSection === 'scoring' && <ScoringSettingsPanel settings={settings} updateSettings={updateSettings} />}

            {settingsSection === 'displayTheme' && <ThemeSettingsPanel settings={settings} updateSettings={updateSettings} />}

            {settingsSection === 'notifications' && <NotificationsSettingsPanel />}

            {/* Player management */}
            <PlayerProfilesPanel isActive={settingsSection === 'players'} onStatusMessage={setStatusMessage} />
            {settingsSection === 'oppositionTeams' && <OppositionTeamsSettings />}

            <LogoLibraryPanel isActive={settingsSection === 'logoLibrary'} onStatusMessage={setStatusMessage} />

            {settingsSection === 'data' && (
              <DataManagementPanel
                fileInputRef={fileInputRef}
                onExportBackup={handleExportBackup}
                backupStatus={{ text: describeBackupAge(backupStatus), due: backupStatus.due }}
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