import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { processLogoImage } from './logoImage';
import { protectedStorageSetItem } from '../context/gameStorageSafety';
import { createVerifiedRecoveryCheckpoint } from '../context/recoveryJournal';
import { UserFacingError, explainFailure } from './userMessages';
import { getLastDiagnosticReference, recordDiagnosticError } from './errorDiagnostics';

export type TeamLogoItem = { id: string; name: string; fileName: string; uri: string; sizeBytes: number; mimeType?: string };
const KEY = 'dugoutPulse.logoLibrary.v1';
const DIR = 'team-logos';
const changed = () => window.dispatchEvent(new CustomEvent('dugout-pulse-logo-library-changed'));
let logoLibraryReadFailureReported = false;
export const readTeamLogoLibrary = (): TeamLogoItem[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(parsed)) throw new SyntaxError('Saved team logo library did not contain a list.');
    logoLibraryReadFailureReported = false;
    return parsed as TeamLogoItem[];
  } catch (error) {
    if (!logoLibraryReadFailureReported) {
      recordDiagnosticError(
        error instanceof SyntaxError ? 'data_corruption' : 'storage_read',
        error,
        'The saved custom-logo library could not be read. The stored value was not changed.',
      );
      logoLibraryReadFailureReported = true;
    }
    return [];
  }
};
const writeTeamLogoLibrary = (items: TeamLogoItem[]): void => {
  if (!protectedStorageSetItem(KEY, JSON.stringify(items))) throw new Error('Could not safely update the saved team logo library.');
  changed();
};
const extensionForMime = (mime: string) => mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
export async function addTeamLogo(file: File): Promise<TeamLogoItem> {
  if (!(await createVerifiedRecoveryCheckpoint('Before adding a custom team logo'))) {
    throw new UserFacingError(explainFailure('Your logo could not be added because the app could not first make a safety copy of your data. Nothing was changed.', getLastDiagnosticReference()));
  }
  const dataUrl = await processLogoImage(file, 512);
  const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const id = 'logo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const fileName = id + '.' + extensionForMime(mimeType);
  await Filesystem.mkdir({ path: DIR, directory: Directory.Data, recursive: true }).catch(() => undefined);
  await Filesystem.writeFile({ path: DIR + '/' + fileName, data: base64, directory: Directory.Data, recursive: true });
  const fileUri = await Filesystem.getUri({ path: DIR + '/' + fileName, directory: Directory.Data });
  const uri = Capacitor.isNativePlatform() ? Capacitor.convertFileSrc(fileUri.uri) : fileUri.uri;
  const item: TeamLogoItem = { id, name: file.name.replace(/\.[^.]+$/, '') || 'Team logo', fileName, uri, mimeType, sizeBytes: Math.floor(base64.length * 3 / 4) };
  writeTeamLogoLibrary([item, ...readTeamLogoLibrary()]);
  return item;
}
export async function deleteTeamLogo(item: TeamLogoItem): Promise<void> {
  if (!(await createVerifiedRecoveryCheckpoint('Before deleting a custom team logo'))) {
    throw new UserFacingError(explainFailure('Your logo could not be deleted because the app could not first make a safety copy of your data. Nothing was changed.', getLastDiagnosticReference()));
  }
  // Update protected metadata before deleting the file, so a failed metadata write cannot destroy a referenced image.
  writeTeamLogoLibrary(readTeamLogoLibrary().filter((entry) => entry.id !== item.id));
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
