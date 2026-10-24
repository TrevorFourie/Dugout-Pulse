import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import type { Game, PlayerProfile } from '../types/baseball';
import { readLogoFileAsBase64, writeLogoFiles } from '../context/recoveryJournal';
import { isMissingTeamLogoFileError, TEAM_LOGO_LIBRARY_EVENT, readTeamLogoLibraryStrict, setTeamLogoLibraryCache, type TeamLogoItem } from './teamLogoLibrary';
import { BACKUP_APP_ID, BACKUP_FORMAT_VERSION, sealBackup, type BackupExtras } from './backupFormat';
import { isLegacyStorageImportComplete, readLiveSQLiteState, saveSQLiteLogoLibrary, type SQLiteLiveState } from '../storage/sqliteRepository';
import { recordDiagnosticError } from './errorDiagnostics';

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
  const sqliteCutoverComplete = await isLegacyStorageImportComplete();
  if (!sqliteCutoverComplete) {
    throw new Error('SQLite is not the verified active store; backup export was stopped instead of reading localStorage.');
  }
  const state = await readLiveSQLiteState();
  const backupData: {
    games: Game[];
    profiles: PlayerProfile[];
    settings: unknown;
    upcomingGames: unknown[];
    oppositionTeams: unknown[];
    extras: BackupExtras;
  } = {
    games: state.games,
    profiles: state.profiles,
    settings: state.settings,
    upcomingGames: state.upcomingGames,
    oppositionTeams: state.oppositionTeams,
    extras: {
      savedTournaments: state.savedTournaments,
      savedAgeGroups: state.savedAgeGroups,
      savedSeasons: state.savedSeasons,
      savedOpponents: state.savedOpponents,
      hiddenTournaments: state.hiddenTournaments,
      hiddenAgeGroups: state.hiddenAgeGroups,
      hiddenSeasons: state.hiddenSeasons,
      setupCompleted: state.setupCompleted,
    },
  };
  const library: TeamLogoItem[] = state.logoLibrary;
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
  const previousFiles: Record<string, string> = {};
  const filesNotPreviouslyPresent = new Set<string>();
  for (const entry of usable) {
    toWrite[entry.fileName] = fileMap[entry.fileName];
    try {
      previousFiles[entry.fileName] = await readLogoFileAsBase64(entry.fileName);
    } catch {
      // Distinguish an absent file from an existing file that cannot be read safely.
      let exists = false;
      try {
        await Filesystem.stat({ path: 'team-logos/' + entry.fileName, directory: Directory.Data });
        exists = true;
      } catch (statError) {
        if (!isMissingTeamLogoFileError(statError)) {
          throw new Error('Could not verify whether a custom logo file is absent. No logo files were changed.');
        }
      }
      if (exists) {
        throw new Error('An existing custom logo could not be preserved before restore. No logo files were changed.');
      }
      filesNotPreviouslyPresent.add(entry.fileName);
    }
  }

  const writtenFiles = new Set<string>();
  try {
    await writeLogoFiles(toWrite, (fileName) => writtenFiles.add(fileName));

    const restored: TeamLogoItem[] = [];
    for (const entry of usable) {
      const fileUri = await Filesystem.getUri({ path: 'team-logos/' + entry.fileName, directory: Directory.Data });
      const uri = Capacitor.isNativePlatform() ? Capacitor.convertFileSrc(fileUri.uri) : fileUri.uri;
      restored.push({ ...entry, uri });
    }
    const restoredIds = new Set(restored.map((entry) => entry.id));
    const merged = [...restored, ...existingLibrary.filter((entry) => !restoredIds.has(entry.id))];
    await saveSQLiteLogoLibrary(merged);
    setTeamLogoLibraryCache(merged);
    window.dispatchEvent(new CustomEvent(TEAM_LOGO_LIBRARY_EVENT));
    return restored.length;
  } catch (restoreError) {
    let rollbackError: unknown = null;
    for (const fileName of writtenFiles) {
      try {
        if (filesNotPreviouslyPresent.has(fileName)) {
          try {
            await Filesystem.deleteFile({ path: 'team-logos/' + fileName, directory: Directory.Data });
          } catch (deleteError) {
            try {
              await Filesystem.stat({ path: 'team-logos/' + fileName, directory: Directory.Data });
              rollbackError = rollbackError || deleteError;
            } catch (statError) {
              if (!isMissingTeamLogoFileError(statError)) rollbackError = rollbackError || statError;
            }
          }
          try {
            await Filesystem.stat({ path: 'team-logos/' + fileName, directory: Directory.Data });
            rollbackError = rollbackError || new Error('A newly restored logo file still exists after rollback.');
          } catch (statError) {
            if (!isMissingTeamLogoFileError(statError)) rollbackError = rollbackError || statError;
          }
        } else {
          const previous = previousFiles[fileName];
          if (typeof previous !== 'string') throw new Error('The previous custom logo bytes were not captured.');
          await writeLogoFiles({ [fileName]: previous });
        }
      } catch (error) {
        rollbackError = rollbackError || error;
      }
    }
    if (rollbackError) {
      throw new Error('Logo restore failed and the previous logo files could not all be verified after rollback. ' +
        (rollbackError instanceof Error ? rollbackError.message : String(rollbackError)));
    }
    throw restoreError;
  }
}
