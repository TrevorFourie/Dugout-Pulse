import { Game, PlayerProfile } from '../types/baseball';
import { saveTextFileDetailed } from './saveFile';
import { buildFullBackup } from './fullBackup';
import type { SQLiteLiveState } from '../storage/sqliteRepository';
import { recordBackupExported } from './backupReminder';
import { getLastDiagnosticReference } from './errorDiagnostics';
import { reportFailure, explainFailure } from './userMessages';

export interface BackupExportResult {
  outcome: 'handed-off' | 'cancelled' | 'failed';
  logoCount: number;
  /** Logos whose image could not be read; the backup was still created without them. */
  missingLogos: string[];
  error?: string;
}

/**
 * Export a complete JSON backup (data, preset lists and the actual logo images) with an integrity check.
 * The "last backup" date is recorded only when the file was handed to the share sheet / download.
 */
export async function exportJsonBackup(data: {
  games: Game[];
  profiles: PlayerProfile[];
  settings: unknown;
  liveState?: Partial<Pick<SQLiteLiveState,
    'oppositionTeams' | 'savedOpponents' | 'savedTournaments' | 'savedAgeGroups' |
    'savedSeasons' | 'hiddenTournaments' | 'hiddenAgeGroups' | 'hiddenSeasons'
  >>;
}): Promise<BackupExportResult> {
  const today = new Date().toISOString().split('T')[0];
  const filename = `dugout-pulse-backup-${today}.json`;
  let built;
  try {
    built = await buildFullBackup(data);
  } catch (err) {
    return { outcome: 'failed', logoCount: 0, missingLogos: [], error: reportFailure('backup_export', err, 'We could not prepare your backup file. Nothing was saved and your data is unchanged.') };
  }
  const outcome = await saveTextFileDetailed(filename, JSON.stringify(built.payload), 'application/json');
  if (outcome === 'handed-off') recordBackupExported();
  if (outcome === 'failed') {
    // saveFile already recorded the true error; point the user at that report entry.
    return { outcome, logoCount: 0, missingLogos: built.missingLogos, error: explainFailure('We could not save or share your backup file. Nothing was saved and your data is unchanged.', getLastDiagnosticReference() || undefined) };
  }
  return { outcome, logoCount: built.logoCount, missingLogos: built.missingLogos };
}
