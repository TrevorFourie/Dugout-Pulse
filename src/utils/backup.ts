import { Game, PlayerProfile } from '../types/baseball';
import { saveTextFileDetailed } from './saveFile';
import { buildFullBackup } from './fullBackup';
import { recordBackupExported } from './backupReminder';

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
}): Promise<BackupExportResult> {
  const today = new Date().toISOString().split('T')[0];
  const filename = `dugout-pulse-backup-${today}.json`;
  let built;
  try {
    built = await buildFullBackup(data);
  } catch (err) {
    return { outcome: 'failed', logoCount: 0, missingLogos: [], error: err instanceof Error ? err.message : String(err) };
  }
  const outcome = await saveTextFileDetailed(filename, JSON.stringify(built.payload), 'application/json');
  if (outcome === 'handed-off') recordBackupExported();
  return { outcome, logoCount: built.logoCount, missingLogos: built.missingLogos };
}
