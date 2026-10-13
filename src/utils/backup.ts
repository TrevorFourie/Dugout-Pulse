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
  return saveTextFile(filename, JSON.stringify(data, null, 2), 'application/json');
}
