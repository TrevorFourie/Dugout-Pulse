import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import type { Game, PlayerProfile } from '../types/baseball';
import { STORAGE_KEYS } from '../context/gameContextDefaults';
import { protectedStorageSetItem } from '../context/gameStorageSafety';
import { readLogoFileAsBase64, writeLogoFiles } from '../context/recoveryJournal';
import { TEAM_LOGO_LIBRARY_EVENT, readTeamLogoLibraryStrict, type TeamLogoItem } from './teamLogoLibrary';
import { BACKUP_APP_ID, BACKUP_FORMAT_VERSION, sealBackup, type BackupExtras } from './backupFormat';
import { isLegacyStorageImportComplete, readLiveSQLiteState, type SQLiteLiveState } from '../storage/sqliteRepository';
import { recordDiagnosticError } from './errorDiagnostics';

const LOGO_LIBRARY_KEY = 'dugoutPulse.logoLibrary.v1';

function isScheduledGameBackupRecord(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const game = value as Record<string, unknown>;
  return typeof game.id === 'string' && game.id.length > 0 &&
    typeof game.opponent === 'string' && typeof game.date === 'string' && game.date.length > 0 &&
    (game.isHome === undefined || typeof game.isHome === 'boolean');
}

function isOppositionTeamBackupRecord(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const team = value as Record<string, unknown>;
  return typeof team.id === 'string' && team.id.length > 0 &&
    typeof team.name === 'string' && team.name.length > 0 &&
    (team.logo === undefined || typeof team.logo === 'string');
}

function readStoredArray(key: string, isValidItem?: (item: unknown) => boolean): unknown[] {
  let value: string | null;
  try {
    value = localStorage.getItem(key);
  } catch (error) {
    recordDiagnosticError('storage_read', error, 'A saved list needed for backup could not be read. The backup was stopped rather than omitting saved data.');
    throw error;
  }
  if (value === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    recordDiagnosticError('data_corruption', error, 'A saved list needed for backup could not be parsed. The backup was stopped rather than omitting saved data.');
    throw error;
  }
  if (!Array.isArray(parsed) || (isValidItem && !parsed.every(isValidItem))) {
    const error = new Error('A saved list needed for backup has an unexpected format.');
    recordDiagnosticError('data_corruption', error, 'A saved list needed for backup has an unexpected format or contains invalid records. The backup was stopped rather than omitting or exporting malformed saved data.');
    throw error;
  }
  return parsed;
}

function readStoredStrings(key: string): string[] {
  const value = readStoredArray(key);
  if (!value.every((item): item is string => typeof item === 'string')) {
    const error = new Error('A saved preset list contains values in an unexpected format.');
    recordDiagnosticError('data_corruption', error, 'A saved preset list contains non-text entries. The backup was stopped rather than silently omitting values.');
    throw error;
  }
  return value;
}

/** Preset lists and flags that live outside games/profiles/settings but are needed for a complete restore. */
export function readBackupExtras(): BackupExtras {
  let setupCompleted: boolean;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETUP_COMPLETED);
    if (raw !== null && raw !== 'true' && raw !== 'false') {
      throw new Error('The setup-completed flag has an unexpected value.');
    }
    setupCompleted = raw === 'true';
  } catch (error) {
    recordDiagnosticError('storage_read', error, 'The setup-completed flag could not be read or validated while preparing a backup. The backup was stopped rather than using a default value.');
    throw error;
  }
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
  liveState?: Partial<Pick<SQLiteLiveState,
    'oppositionTeams' | 'savedOpponents' | 'savedTournaments' | 'savedAgeGroups' |
    'savedSeasons' | 'hiddenTournaments' | 'hiddenAgeGroups' | 'hiddenSeasons'
  >>;
}): Promise<FullBackupResult> {
  let sqliteCutoverComplete = false;
  try {
    sqliteCutoverComplete = await isLegacyStorageImportComplete();
  } catch (error) {
    const marker = localStorage.getItem('dugoutPulse.sqliteCutover.v1');
    if (marker === 'complete' || marker === 'pending') throw error;
    // Before cutover, localStorage remains the authoritative backup source.
  }

  let backupData: {
    games: Game[];
    profiles: PlayerProfile[];
    settings: unknown;
    upcomingGames: unknown[];
    oppositionTeams: unknown[];
    extras: BackupExtras;
  };
  let library: TeamLogoItem[];
  if (sqliteCutoverComplete) {
    // Core values come from the current React snapshot; scheduled games and
    // logo metadata come from their serialized SQLite write paths, never the mirror.
    const state = await readLiveSQLiteState();
    const current = data.liveState;
    backupData = {
      games: data.games,
      profiles: data.profiles,
      settings: data.settings,
      upcomingGames: state.upcomingGames,
      oppositionTeams: current?.oppositionTeams ?? state.oppositionTeams,
      extras: {
        savedTournaments: current?.savedTournaments ?? state.savedTournaments,
        savedAgeGroups: current?.savedAgeGroups ?? state.savedAgeGroups,
        savedSeasons: current?.savedSeasons ?? state.savedSeasons,
        savedOpponents: current?.savedOpponents ?? state.savedOpponents,
        hiddenTournaments: current?.hiddenTournaments ?? state.hiddenTournaments,
        hiddenAgeGroups: current?.hiddenAgeGroups ?? state.hiddenAgeGroups,
        hiddenSeasons: current?.hiddenSeasons ?? state.hiddenSeasons,
        setupCompleted: state.setupCompleted,
      },
    };
    library = state.logoLibrary;
  } else {
    backupData = {
      ...data,
      upcomingGames: readStoredArray('dugoutPulse.upcomingGames.v1', isScheduledGameBackupRecord),
      oppositionTeams: readStoredArray('dugoutPulse.oppositionTeams.v1', isOppositionTeamBackupRecord),
      extras: readBackupExtras(),
    };
    library = readTeamLogoLibraryStrict();
  }
  const completeBackup = backupData;
  // Inline (data URL) logos are kept inside the data itself; library logos are referenced by id and their
  // image files are embedded below. Nothing is replaced by a bare hash, so no logo bytes are lost.

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

  if (missingLogos.length > 0) {
    recordDiagnosticError('logo_library', new Error('One or more custom logo images could not be read during backup.'), 'Missing custom logo file count: ' + missingLogos.length + '.');
  }

  const payload = sealBackup({
    ...completeBackup,
    app: BACKUP_APP_ID,
    backupVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      games: backupData.games.length,
      profiles: backupData.profiles.length,
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
  // Validate the current library before writing any restored logo file. A corrupt
  // library must not be treated as empty and then overwritten by the imported subset.
  const existingLibrary = readTeamLogoLibraryStrict();

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
  const merged = [...restored, ...existingLibrary.filter((entry) => !restoredIds.has(entry.id))];
  if (!protectedStorageSetItem(LOGO_LIBRARY_KEY, JSON.stringify(merged))) {
    throw new Error('Could not safely update the logo library while restoring the backup.');
  }
  window.dispatchEvent(new CustomEvent(TEAM_LOGO_LIBRARY_EVENT));
  return restored.length;
}
