import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { ScoringSettingsPanel } from './settings/ScoringSettingsPanel';
import { ThemeSettingsPanel } from './settings/ThemeSettingsPanel';
import { exportJsonBackup } from '../utils/backup';
import { describeBackupAge, getBackupStatus } from '../utils/backupReminder';
import { getLastDiagnosticReference } from '../utils/errorDiagnostics';
import { explainFailure, reportFailure } from '../utils/userMessages';
import { ConfirmationModal } from './ConfirmationModal';
import { ToastMessage } from './ToastMessage';
import {
  ArrowLeft,
  AlertTriangle,
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToastMessage(null), []);
  const [operationAlert, setOperationAlert] = useState<{ title: string; message: string; variant: 'danger' | 'warning' | 'success' } | null>(null);
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>(initialSection);

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const settingsContentRef = useRef<HTMLDivElement>(null);

  const handleSettingsStatusMessage = (message: { text: string; isError: boolean } | null) => {
    if (message?.isError) {
      setStatusMessage(null);
      setOperationAlert({
        title: 'Could not complete settings change',
        message: message.text,
        variant: 'danger',
      });
      return;
    }
    setStatusMessage(message);
  };

  const [backupStatusTick, setBackupStatusTick] = useState(0);
  const backupStatus = React.useMemo(
    () => getBackupStatus(games.length > 0 || profiles.some((p) => p.playerName || p.teamName)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [games.length, profiles, backupStatusTick],
  );

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
      setStatusMessage(null);
      setOperationAlert({
        title: 'Logo could not be updated',
        message: reportFailure('logo_library', err, 'We could not use that image.'),
        variant: 'danger',
      });
    }
  };

  const handleExportBackup = async () => {
    try {
      const result = await exportJsonBackup({ games, profiles, settings });
      setBackupStatusTick((tick) => tick + 1);
      if (result.outcome === 'failed') {
        setStatusMessage(null);
        setOperationAlert({
          title: 'Backup could not be created',
          message: result.error ?? 'Dugout Pulse could not create the backup. Review the diagnostic report before retrying.',
          variant: 'danger',
        });
      } else if (result.outcome === 'cancelled') {
        setStatusMessage(null);
        setOperationAlert({
          title: 'Backup was not saved',
          message: 'No backup file was confirmed as saved. Choose a location outside Dugout Pulse and try again if you want a separate copy of your data.',
          variant: 'warning',
        });
      } else if (result.missingLogos.length > 0) {
        setStatusMessage(null);
        setOperationAlert({
          title: 'Backup created with missing logo files',
          message: 'The backup file was created, but ' + result.missingLogos.length + ' custom logo image(s) could not be included. Keep the original app data intact until you have reviewed the backup.',
          variant: 'warning',
        });
      } else {
        // Handoff is not proof of an external save. Use a non-blocking toast and never claim the file was saved.
        setStatusMessage(null);
        setOperationAlert(null);
        setToastMessage('Backup export started. Verify the file was saved outside Dugout Pulse before relying on it.');
      }
    } catch (error) {
      setStatusMessage(null);
      setOperationAlert({
        title: 'Backup could not be created',
        message: reportFailure('backup_export', error, 'Dugout Pulse could not create the backup. No backup file was confirmed as saved.'),
        variant: 'danger',
      });
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) throw new Error('The selected backup file was empty or unreadable.');
        const result = await importJsonData(content);
        if (!result.success) {
          setStatusMessage(null);
          setOperationAlert({ title: 'Backup could not be imported', message: result.message, variant: 'danger' });
        } else if (result.partial) {
          setStatusMessage(null);
          setOperationAlert({ title: 'Backup imported with warnings', message: result.message, variant: 'warning' });
        } else {
          setStatusMessage({ text: result.message, isError: false });
        }
        if (result.success) onRestoreComplete?.(result.message, Boolean(result.partial));
      } catch (error) {
        setStatusMessage(null);
        setOperationAlert({
          title: 'Backup could not be imported',
          message: reportFailure('backup_import', error, 'The selected backup could not be read or imported. No data was intentionally changed.'),
          variant: 'danger',
        });
      }
    };
    reader.onerror = () => {
      const error = new Error('The selected backup file could not be read.');
      setStatusMessage(null);
      setOperationAlert({
        title: 'Backup file could not be read',
        message: reportFailure('backup_import', error, 'The selected backup could not be read. No data was intentionally changed.'),
        variant: 'danger',
      });
    };
    try {
      reader.readAsText(file);
    } catch (error) {
      setStatusMessage(null);
      setOperationAlert({
        title: 'Backup file could not be read',
        message: reportFailure('backup_import', error, 'The selected backup could not be opened for reading. No data was intentionally changed.'),
        variant: 'danger',
      });
    }
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
              role={statusMessage.isError ? 'alert' : 'status'}
              aria-live={statusMessage.isError ? 'assertive' : 'polite'}
              className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between ${
                statusMessage.isError
                  ? 'bg-red-50 text-red-700 dark:bg-[#FF5252]/15 dark:text-[#D4626D]'
                  : 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMessage.isError
                  ? <AlertTriangle className="w-4 h-4 shrink-0" />
                  : <CheckCircle2 className="w-4 h-4 shrink-0" />}
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
            <TeamsSettingsPanel isActive={settingsSection === 'teams'} onStatusMessage={handleSettingsStatusMessage} />
            <PresetSettingsPanel
              isActive={settingsSection === 'teamLists' || settingsSection === 'seasons' || settingsSection === 'tournaments' || settingsSection === 'ageGroups'}
              settingsSection={settingsSection === 'seasons' || settingsSection === 'tournaments' || settingsSection === 'ageGroups' ? settingsSection : 'teamLists'}
              onStatusMessage={handleSettingsStatusMessage}
            />
            <VenuesSettingsPanel isActive={settingsSection === 'venue'} onStatusMessage={handleSettingsStatusMessage} />
            {settingsSection === 'scoring' && <ScoringSettingsPanel settings={settings} updateSettings={updateSettings} />}

            {settingsSection === 'displayTheme' && <ThemeSettingsPanel settings={settings} updateSettings={updateSettings} />}

            {settingsSection === 'notifications' && <NotificationsSettingsPanel />}

            {/* Player management */}
            <PlayerProfilesPanel isActive={settingsSection === 'players'} onStatusMessage={handleSettingsStatusMessage} />
            {settingsSection === 'oppositionTeams' && <OppositionTeamsSettings />}

            <LogoLibraryPanel isActive={settingsSection === 'logoLibrary'} onStatusMessage={handleSettingsStatusMessage} />

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

      <ToastMessage message={toastMessage} onDismiss={dismissToast} />
      <ConfirmationModal
        isOpen={operationAlert !== null}
        title={operationAlert?.title ?? 'Operation failed'}
        message={operationAlert?.message ?? ''}
        confirmLabel="OK"
        showCancelButton={false}
        closeOnBackdrop={false}
        variant={operationAlert?.variant ?? 'danger'}
        onCancel={() => setOperationAlert(null)}
        onConfirm={() => setOperationAlert(null)}
      />
      <ConfirmationModal
        isOpen={isResetConfirmOpen}
        title="Reset All Local Data?"
        message="This permanently deletes all recorded games, season statistics, settings, saved lists and your logo library from this device, then returns you to the setup screen. Export a backup first if you want to keep your data - backups include your logo images."
        confirmLabel="Yes, Reset Everything"
        variant="danger"
        onConfirm={async () => {
          setIsResetConfirmOpen(false);
          try {
            const applied = await resetAllData();
            if (applied) {
              setStatusMessage({ text: 'All data has been reset.', isError: false });
            } else {
              setStatusMessage(null);
              setOperationAlert({
                title: 'Data reset was stopped',
                message: explainFailure('The reset was stopped before it could be confirmed complete. If the failure occurred during storage clearing, some items may already have been removed from active storage. Your recovery checkpoints were retained. Do not repeat the reset; review diagnostics and use the Recovery Journal if needed.', getLastDiagnosticReference() || undefined),
                variant: 'danger',
              });
            }
          } catch (error) {
            setStatusMessage(null);
            setOperationAlert({
              title: 'Data reset could not be completed',
              message: reportFailure('data_reset', error, 'The data reset stopped unexpectedly. Do not repeat it until the diagnostic report has been reviewed.'),
              variant: 'danger',
            });
          }
        }}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </>
  );
};