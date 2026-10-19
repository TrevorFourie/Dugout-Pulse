import { Game, PlayerProfile } from '../types/baseball';
import { saveTextFile } from './saveFile';

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
  return saveTextFile(filename, JSON.stringify(completeBackup, null, 2), 'application/json');
}
