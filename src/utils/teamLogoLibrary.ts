import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { processLogoImage } from './logoImage';

export type TeamLogoItem = { id: string; name: string; fileName: string; uri: string; sizeBytes: number };
const KEY = 'dugoutPulse.logoLibrary.v1';
const DIR = 'team-logos';
const changed = () => window.dispatchEvent(new CustomEvent('dugout-pulse-logo-library-changed'));
export const readTeamLogoLibrary = (): TeamLogoItem[] => {
  try { const parsed = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};
const writeTeamLogoLibrary = (items: TeamLogoItem[]) => { localStorage.setItem(KEY, JSON.stringify(items)); changed(); };
export async function addTeamLogo(file: File): Promise<TeamLogoItem> {
  const dataUrl = await processLogoImage(file, 512);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const id = 'logo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const fileName = id + '.jpg';
  await Filesystem.mkdir({ path: DIR, directory: Directory.Data, recursive: true }).catch(() => undefined);
  await Filesystem.writeFile({ path: DIR + '/' + fileName, data: base64, directory: Directory.Data, recursive: true });
  const fileUri = await Filesystem.getUri({ path: DIR + '/' + fileName, directory: Directory.Data });
  const uri = Capacitor.isNativePlatform() ? Capacitor.convertFileSrc(fileUri.uri) : fileUri.uri;
  const item: TeamLogoItem = { id, name: file.name.replace(/\.[^.]+$/, '') || 'Team logo', fileName, uri, sizeBytes: Math.floor(base64.length * 3 / 4) };
  writeTeamLogoLibrary([item, ...readTeamLogoLibrary()]);
  return item;
}
export async function deleteTeamLogo(item: TeamLogoItem): Promise<void> {
  try { await Filesystem.deleteFile({ path: DIR + '/' + item.fileName, directory: Directory.Data }); } catch { /* remove stale library entries too */ }
  writeTeamLogoLibrary(readTeamLogoLibrary().filter((entry) => entry.id !== item.id));
}
export const TEAM_LOGO_LIBRARY_EVENT = 'dugout-pulse-logo-library-changed';
export async function migrateLegacyLogoDataUrl(dataUrl: string): Promise<string> {
  const match = /^data:image\/(png|jpeg|webp);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error('Legacy logo format is unsupported.');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
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
