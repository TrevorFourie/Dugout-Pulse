import { Game, PlayerProfile } from '../types/baseball';
import { saveTextFile } from './saveFile';
import { createLogoSafeBackup } from './logoBackup';

/**
 * Export full JSON backup
 */
export async function exportJsonBackup(data: {
  games: Game[];
  profiles: PlayerProfile[];
  settings: unknown;
}): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const filename = `baseball-hub-backup-${today}.json`;
  const readStoredArray = (key: string): unknown[] => {
    try {
      const value = localStorage.getItem(key);
      const parsed = value ? JSON.parse(value) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const completeBackup = {
    ...data,
    upcomingGames: readStoredArray('dugoutPulse.upcomingGames.v1'),
    oppositionTeams: readStoredArray('dugoutPulse.oppositionTeams.v1'),
  };
  const safeBackup = createLogoSafeBackup(completeBackup);
  const exportPayload = {
    ...safeBackup.data,
    backupVersion: 2,
    logoBackupPolicy: {
      imagesIncluded: false,
      note: 'Custom logos are stored only on this device. This backup contains references, not image files. Logos can be restored only when the matching image is still available locally.',
    },
    customLogoReferences: safeBackup.customLogoReferences,
  };
  return saveTextFile(filename, JSON.stringify(exportPayload, null, 2), 'application/json');
}
