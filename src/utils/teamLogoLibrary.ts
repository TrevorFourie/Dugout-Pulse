import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { processLogoImage } from './logoImage';
import { protectedStorageSetItem } from '../context/gameStorageSafety';
import { createVerifiedRecoveryCheckpoint, readLogoFileAsBase64 } from '../context/recoveryJournal';
import { UserFacingError, explainFailure } from './userMessages';
import { getLastDiagnosticReference, recordDiagnosticError } from './errorDiagnostics';
import { isLegacyStorageImportComplete, saveSQLiteLogoLibrary } from '../storage/sqliteRepository';

export type TeamLogoItem = { id: string; name: string; fileName: string; uri: string; sizeBytes: number; mimeType?: string };
const KEY = 'dugoutPulse.logoLibrary.v1';
const DIR = 'team-logos';
const changed = () => window.dispatchEvent(new CustomEvent('dugout-pulse-logo-library-changed'));
let logoLibraryReadFailureReported = false;

function isTeamLogoItem(value: unknown): value is TeamLogoItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && item.id.length > 0 &&
    typeof item.name === 'string' && typeof item.fileName === 'string' &&
    typeof item.uri === 'string' && typeof item.sizeBytes === 'number' &&
    Number.isFinite(item.sizeBytes) && item.sizeBytes >= 0 &&
    (item.mimeType === undefined || typeof item.mimeType === 'string');
}

function readStoredTeamLogoLibrary(): TeamLogoItem[] {
  const raw = localStorage.getItem(KEY);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(isTeamLogoItem)) {
    throw new SyntaxError('Saved team logo library contains invalid entries.');
  }
  return parsed;
}

/** Strict read for operations that must not replace or export an unreadable logo library. */
export function readTeamLogoLibraryStrict(): TeamLogoItem[] {
  try {
    const items = readStoredTeamLogoLibrary();
    logoLibraryReadFailureReported = false;
    return items;
  } catch (error) {
    if (!logoLibraryReadFailureReported) {
      try {
        recordDiagnosticError(
          error instanceof SyntaxError ? 'data_corruption' : 'storage_read',
          error,
          'The saved custom-logo library could not be read or validated. The stored value was not changed.',
        );
      } catch {
        // Preserve the original read failure.
      }
      logoLibraryReadFailureReported = true;
    }
    throw error;
  }
}

/** Non-destructive display read: keep UI rendering available, but never use this fallback for writes or backups. */
export const readTeamLogoLibrary = (): TeamLogoItem[] => {
  try {
    return readTeamLogoLibraryStrict();
  } catch {
    return [];
  }
};
const writeTeamLogoLibrary = async (items: TeamLogoItem[]): Promise<void> => {
  await saveSQLiteLogoLibrary(items);
  if (!protectedStorageSetItem(KEY, JSON.stringify(items))) {
    let sqliteIsAuthoritative = false;
    try {
      sqliteIsAuthoritative = await isLegacyStorageImportComplete();
    } catch {
      // Do not claim SQLite success if its authority cannot be confirmed.
    }
    if (sqliteIsAuthoritative) {
      // The primary write has committed. Keep mounted logo pickers aligned with it,
      // while still surfacing the failed compatibility mirror to the caller.
      changed();
      throw new Error('The logo library was saved to SQLite, but its compatibility copy could not be verified. Reload the app before making further changes and review the diagnostic report.');
    }
    throw new Error('Could not safely update the saved team logo library. The change was not confirmed.');
  }
  changed();
};

export async function renameTeamLogo(id: string, name: string): Promise<void> {
  const current = readTeamLogoLibraryStrict();
  if (!current.some((item) => item.id === id)) {
    throw new Error('The selected logo could not be found in the saved library.');
  }
  await writeTeamLogoLibrary(current.map((item) => item.id === id ? { ...item, name } : item));
}
const extensionForMime = (mime: string) => mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
export async function addTeamLogo(file: File): Promise<TeamLogoItem> {
  if (!(await createVerifiedRecoveryCheckpoint('Before adding a custom team logo'))) {
    throw new UserFacingError(explainFailure('Your logo could not be added because the app could not first make a safety copy of your data. Nothing was changed.', getLastDiagnosticReference()));
  }
  const existingLibrary = readTeamLogoLibraryStrict();
  const dataUrl = await processLogoImage(file, 256);
  const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const id = 'logo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const fileName = id + '.' + extensionForMime(mimeType);
  await Filesystem.mkdir({ path: DIR, directory: Directory.Data, recursive: true }).catch(() => undefined);
  await Filesystem.writeFile({ path: DIR + '/' + fileName, data: base64, directory: Directory.Data, recursive: true });
  const storedBase64 = await readLogoFileAsBase64(fileName);
  if (storedBase64 !== base64) {
    throw new Error('The custom logo file failed read-back verification; its library entry was not saved.');
  }
  const fileUri = await Filesystem.getUri({ path: DIR + '/' + fileName, directory: Directory.Data });
  const uri = Capacitor.isNativePlatform() ? Capacitor.convertFileSrc(fileUri.uri) : fileUri.uri;
  const item: TeamLogoItem = { id, name: file.name.replace(/\.[^.]+$/, '') || 'Team logo', fileName, uri, mimeType, sizeBytes: Math.floor(base64.length * 3 / 4) };
  await writeTeamLogoLibrary([item, ...existingLibrary]);
  return item;
}
export async function deleteTeamLogo(item: TeamLogoItem): Promise<void> {
  if (!(await createVerifiedRecoveryCheckpoint('Before deleting a custom team logo'))) {
    throw new UserFacingError(explainFailure('Your logo could not be deleted because the app could not first make a safety copy of your data. Nothing was changed.', getLastDiagnosticReference()));
  }
  // Validate metadata before mutation, then update protected metadata before deleting the file.
  // An unreadable library must never be treated as empty and overwritten.
  const existingLibrary = readTeamLogoLibraryStrict();
  await writeTeamLogoLibrary(existingLibrary.filter((entry) => entry.id !== item.id));
  try { await Filesystem.deleteFile({ path: DIR + '/' + item.fileName, directory: Directory.Data }); } catch { /* Preserve an orphaned file rather than risk deleting referenced data. */ }
}
export const TEAM_LOGO_LIBRARY_EVENT = 'dugout-pulse-logo-library-changed';
export async function migrateLegacyLogoDataUrl(dataUrl: string): Promise<string> {
  const match = /^data:image\/(png|jpeg|webp);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error('Legacy logo format is unsupported.');
  const binary = atob(match[2]); const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const file = new File([bytes], 'legacy-logo.' + ext, { type: ext === 'jpg' ? 'image/jpeg' : 'image/' + ext });
  const item = await addTeamLogo(file);
  return logoLibraryReference(item.id);
}
export const logoLibraryReference = (id: string) => 'logo-ref-v1:' + id;
export function resolveTeamLogoSrc(value?: string): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith('logo-ref-v1:')) return value;
  const id = value.slice('logo-ref-v1:'.length);
  return readTeamLogoLibrary().find((item) => item.id === id)?.uri;
}
