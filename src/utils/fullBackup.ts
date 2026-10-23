import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import type { Game, PlayerProfile } from '../types/baseball';
import { STORAGE_KEYS } from '../context/gameContextDefaults';
import { protectedStorageSetItem } from '../context/gameStorageSafety';
import { readLogoFileAsBase64, writeLogoFiles } from '../context/recoveryJournal';
import { TEAM_LOGO_LIBRARY_EVENT, readTeamLogoLibrary, type TeamLogoItem } from './teamLogoLibrary';
import { BACKUP_APP_ID, BACKUP_FORMAT_VERSION, sealBackup, type BackupExtras } from './backupFormat';

const LOGO_LIBRARY_KEY = 'dugoutPulse.logoLibrary.v1';

function readStoredArray(key: string): unknown[] {
  try {
    const value = localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStoredStrings(key: string): string[] {
  return readStoredArray(key).filter((item): item is string => typeof item === 'string');
}

/** Preset lists and flags that live outside games/profiles/settings but are needed for a complete restore. */
export function readBackupExtras(): BackupExtras {
  let setupCompleted = false;
  try { setupCompleted = localStorage.getItem(STORAGE_KEYS.SETUP_COMPLETED) === 'true'; } catch { /* default false */ }
  return {
    savedTournaments: readStoredStrings(STORAGE_KEYS.SAVED_TOURNAMENTS),
    savedAgeGroups: readStoredStrings(STORAGE_KEYS.SAVED_AGE_GROUPS),
    savedSeasons: readStoredStrings(STORAGE_KEYS.SAVED_SEASONS),
    savedOpponents: readStoredStrings(STORAGE_KEYS.SAVED_OPPONENTS),
    hiddenTournaments: readStoredStrings(STORAGE_KEYS.HIDDEN_TOURNAMENTS),
    hiddenAgeGroups: readStoredStrings(STORAGE_KEYS.HIDDEN_AGE_GROUPS),
    hiddenSeasons: readStoredStrings(STORAGE_KEYS.HIDDEN_SEASONS),
    setupCompleted,
  };
}

export interface FullBackupResult {
  payload: Record<string, unknown>;
  logoCount: number;
  /** Logo library entries whose image file could not be read at export time. */
  missingLogos: string[];
}

/** Build a complete, self-verifying backup including the actual logo images. */
export async function buildFullBackup(data: {
  games: Game[];
  profiles: PlayerProfile[];
  settings: unknown;
}): Promise<FullBackupResult> {
  const completeBackup = {
    ...data,
    upcomingGames: readStoredArray('dugoutPulse.upcomingGames.v1'),
    oppositionTeams: readStoredArray('dugoutPulse.oppositionTeams.v1'),
    extras: readBackupExtras(),
  };
  // Inline (data URL) logos are kept inside the data itself; library logos are referenced by id and their
  // image files are embedded below. Nothing is replaced by a bare hash, so no logo bytes are lost.

  const library = readTeamLogoLibrary();
  const logoFiles: Record<string, string> = {};
  const missingLogos: string[] = [];
  for (const item of library) {
    try {
      const base64 = await readLogoFileAsBase64(item.fileName);
      if (!base64) throw new Error('empty');
      logoFiles[item.fileName] = base64;
    } catch {
      missingLogos.push(item.fileName);
    }
  }

  const payload = sealBackup({
    ...completeBackup,
    app: BACKUP_APP_ID,
    backupVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      games: data.games.length,
      profiles: data.profiles.length,
      logos: Object.keys(logoFiles).length,
    },
    logoBackupPolicy: {
      imagesIncluded: true,
      note: 'Custom logo images are embedded in this file (logoFiles). Keep the file safe; it contains all of your saved data.',
    },
    logoLibrary: library,
    logoFiles,
    missingLogoFiles: missingLogos,
  });
  return { payload, logoCount: Object.keys(logoFiles).length, missingLogos };
}

/**
 * Restore the logo images and library entries from a (already verified) backup.
 * Existing local logos that are not in the backup are kept. Throws before touching app state on failure.
 * Returns the number of logos restored.
 */
export async function restoreLogosFromBackup(data: Record<string, unknown>): Promise<number> {
  const library = data.logoLibrary;
  const files = data.logoFiles;
  if (!Array.isArray(library) || !files || typeof files !== 'object') return 0;
  const fileMap = files as Record<string, string>;
  const usable = (library as TeamLogoItem[]).filter((entry) => typeof fileMap[entry.fileName] === 'string');
  if (usable.length === 0) return 0;

  const toWrite: Record<string, string> = {};
  for (const entry of usable) toWrite[entry.fileName] = fileMap[entry.fileName];
  await writeLogoFiles(toWrite); // writes each file, reads it back and compares

  const restored: TeamLogoItem[] = [];
  for (const entry of usable) {
    const fileUri = await Filesystem.getUri({ path: 'team-logos/' + entry.fileName, directory: Directory.Data });
    const uri = Capacitor.isNativePlatform() ? Capacitor.convertFileSrc(fileUri.uri) : fileUri.uri;
    restored.push({ ...entry, uri });
  }
  const restoredIds = new Set(restored.map((entry) => entry.id));
  const merged = [...restored, ...readTeamLogoLibrary().filter((entry) => !restoredIds.has(entry.id))];
  if (!protectedStorageSetItem(LOGO_LIBRARY_KEY, JSON.stringify(merged))) {
    throw new Error('Could not safely update the logo library while restoring the backup.');
  }
  window.dispatchEvent(new CustomEvent(TEAM_LOGO_LIBRARY_EVENT));
  return restored.length;
}
