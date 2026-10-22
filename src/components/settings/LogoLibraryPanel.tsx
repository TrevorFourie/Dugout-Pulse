import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Check, ImagePlus, Pencil, Trash2, Upload } from 'lucide-react';
import { processLogoImage } from '../../utils/logoImage';

type LogoItem = { id: string; name: string; fileName: string; uri: string; sizeBytes: number };
const KEY = 'dugoutPulse.logoLibrary.v1';
const DIR = 'team-logos';
const readItems = (): LogoItem[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const persist = (items: LogoItem[]) => { localStorage.setItem(KEY, JSON.stringify(items)); window.dispatchEvent(new CustomEvent('dugout-pulse-logo-library-changed')); };
const dataUrlToBase64 = (value: string) => value.slice(value.indexOf(',') + 1);

export const LogoLibraryPanel: React.FC<{ isActive: boolean; onStatusMessage: (message: { text: string; isError: boolean }) => void }> = ({ isActive, onStatusMessage }) => {
 const [items, setItems] = useState<LogoItem[]>(readItems); const [name, setName] = useState(''); const [editing, setEditing] = useState<string | null>(null); const [busy, setBusy] = useState(false);
 useEffect(() => { const refresh = () => setItems(readItems()); window.addEventListener('dugout-pulse-logo-library-changed', refresh); return () => window.removeEventListener('dugout-pulse-logo-library-changed', refresh); }, []);
 if (!isActive) return null;
 const saveName = (id: string) => { const trimmed = name.trim(); if (!trimmed) return; const next = items.map(item => item.id === id ? { ...item, name: trimmed } : item); persist(next); setItems(next); setEditing(null); setName(''); onStatusMessage({ text: 'Logo name updated.', isError: false }); };
 const addLogo = async (file?: File) => { if (!file) return; setBusy(true); try { const dataUrl = await processLogoImage(file, 512); const base64 = dataUrlToBase64(dataUrl); const id = `logo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; const fileName = `${id}.jpg`;
   await Filesystem.mkdir({ path: DIR, directory: Directory.Data, recursive: true }).catch(() => undefined);
   await Filesystem.writeFile({ path: `${DIR}/${fileName}`, data: base64, directory: Directory.Data, recursive: true });
   const fileUri = await Filesystem.getUri({ path: `${DIR}/${fileName}`, directory: Directory.Data });
   const uri = Capacitor.isNativePlatform() ? Capacitor.convertFileSrc(fileUri.uri) : fileUri.uri;
   const entry: LogoItem = { id, name: file.name.replace(/\.[^.]+$/, ''), fileName, uri, sizeBytes: Math.floor(base64.length * 3 / 4) };
   const next = [entry, ...items]; persist(next); setItems(next); onStatusMessage({ text: `Logo added (${(entry.sizeBytes / 1024).toFixed(0)} KB). It can now be assigned to either team type.`, isError: false });
 } catch (err) { onStatusMessage({ text: err instanceof Error ? err.message : 'Could not save logo file.', isError: true }); } finally { setBusy(false); } };
 const deleteLogo = async (item: LogoItem) => { if (!window.confirm(`Delete logo “${item.name}”? Teams using it will show the default logo until another is selected.`)) return; try { await Filesystem.deleteFile({ path: `${DIR}/${item.fileName}`, directory: Directory.Data }); } catch { /* File may already be missing; remove stale library entry anyway. */ } const next = items.filter(x => x.id !== item.id); persist(next); setItems(next); onStatusMessage({ text: 'Logo deleted from the library.', isError: false }); };
 return <section className="space-y-4"><div><h3 className="text-sm font-bold text-slate-900 dark:text-[#FAFAFA]">Team Logo Library</h3><p className="mt-1 text-xs text-slate-500 dark:text-[#9CA3AF]">Upload once, then reuse logos for player teams and opposition teams. Images are stored as files in the app’s private data directory, not in team records or JSON backups. Each processed logo is limited to 250 KB and resized to a maximum of 512 × 512 pixels.</p></div>
 <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-700 hover:border-teal-500 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB]"><ImagePlus className="h-5 w-5" />{busy ? 'Processing logo…' : 'Upload a logo'}<input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" disabled={busy} className="hidden" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void addLogo(file); }} /></label>
 {items.length === 0 ? <p className="rounded-lg border border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-[#354050]">No logos uploaded yet.</p> : <div className="space-y-2">{items.map(item => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-[#354050]"><img src={item.uri} alt={item.name} className="h-14 w-14 rounded-lg border border-slate-200 object-contain dark:border-[#354050]"/><div className="min-w-0 flex-1">{editing === item.id ? <div className="flex gap-2"><input value={name} onChange={e => setName(e.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-transparent px-2 py-1 text-xs dark:border-[#354050]"/><button type="button" onClick={() => saveName(item.id)} aria-label="Save logo name"><Check className="h-4 w-4"/></button></div> : <><p className="truncate text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">{item.name}</p><p className="text-[11px] text-slate-500">{(item.sizeBytes / 1024).toFixed(0)} KB · 512 px max</p></>}</div><button type="button" onClick={() => { setEditing(item.id); setName(item.name); }} title="Rename logo" className="rounded p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#354050]"><Pencil className="h-4 w-4"/></button><button type="button" onClick={() => void deleteLogo(item)} title="Delete logo" className="rounded p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4"/></button></div>)}</div>}
 <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">Selecting and linking a library logo is available from team settings once the logo is uploaded.</p></section>;
};
