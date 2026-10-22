import React, { useEffect, useState } from 'react';
import { Check, ImagePlus, X } from 'lucide-react';
import { addTeamLogo, logoLibraryReference, readTeamLogoLibrary, type TeamLogoItem } from '../utils/teamLogoLibrary';

interface TeamLogoPickerProps {
  value?: string;
  onChange: (logo?: string) => void;
  onError: (message: string) => void;
  compact?: boolean;
}
export const TeamLogoPicker: React.FC<TeamLogoPickerProps> = ({ value, onChange, onError, compact = false }) => {
  const [items, setItems] = useState<TeamLogoItem[]>(readTeamLogoLibrary);
  const [busy, setBusy] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    const refresh = () => setItems(readTeamLogoLibrary());
    window.addEventListener('dugout-pulse-logo-library-changed', refresh);
    return () => window.removeEventListener('dugout-pulse-logo-library-changed', refresh);
  }, []);

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const item = await addTeamLogo(file);
      const latest = readTeamLogoLibrary();
      setItems(latest);
      onChange(logoLibraryReference(item.id));
      setShowPicker(false);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save that logo.');
    } finally {
      setBusy(false);
    }
  };

  const selectLogo = (item: TeamLogoItem) => {
    const reference = logoLibraryReference(item.id);
    onChange(value === reference ? undefined : reference);
    setShowPicker(false);
  };

  return <>
    <div className={compact ? 'flex flex-wrap items-center gap-2' : 'mt-2 flex flex-wrap items-center gap-2'}>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-semibold text-slate-700 hover:border-teal-500 dark:border-[#354050] dark:text-[#D1D5DB]">
        <ImagePlus className="h-3.5 w-3.5" />{busy ? 'Processing…' : 'Upload logo'}
        <input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" disabled={busy} className="hidden" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void upload(file); }} />
      </label>
      <button type="button" onClick={() => { setItems(readTeamLogoLibrary()); setShowPicker(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-semibold text-slate-700 hover:border-teal-500 dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#D1D5DB]" aria-haspopup="dialog">
        <ImagePlus className="h-3.5 w-3.5" />Choose from library{items.length ? ` (${items.length})` : ''}
      </button>
      {value && <button type="button" onClick={() => onChange(undefined)} className="rounded-lg px-2 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 dark:text-[#9CA3AF] dark:hover:bg-[#354050]">Unselect logo</button>}
    </div>

    {showPicker && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowPicker(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="team-logo-picker-title" className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#354050] dark:bg-[#1A2028]">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-[#354050]">
          <div>
            <h3 id="team-logo-picker-title" className="text-sm font-bold text-slate-900 dark:text-[#FAFAFA]">Choose a team logo</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#9CA3AF]">Select an image to link it to this team. Select it again or use “Unselect” to remove the link.</p>
          </div>
          <button type="button" onClick={() => setShowPicker(false)} aria-label="Close logo picker" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-[#D1D5DB] dark:hover:bg-[#354050]"><X className="h-4 w-4" /></button>
        </header>
        <div className="overflow-y-auto p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-[#D1D5DB]">{items.length} {items.length === 1 ? 'image' : 'images'} in library</p>
            {value && <button type="button" onClick={() => { onChange(undefined); setShowPicker(false); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-teal-500 dark:border-[#354050] dark:text-[#D1D5DB]">Unselect current image</button>}
          </div>
          {items.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-[#354050]">
            <ImagePlus className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-[#D1D5DB]">No saved logos yet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#9CA3AF]">Upload a logo first, or use the upload button below.</p>
          </div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map(item => {
              const selected = value === logoLibraryReference(item.id);
              return <button key={item.id} type="button" onClick={() => selectLogo(item)} aria-pressed={selected} aria-label={`${selected ? 'Unselect' : 'Select'} ${item.name}`} className={`relative flex min-w-0 flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors hover:border-teal-500 hover:bg-teal-50/50 dark:hover:bg-[#252D38] ${selected ? 'border-teal-600 bg-teal-50 dark:border-[#00D7BC] dark:bg-[#123632]' : 'border-slate-200 dark:border-[#354050]'}`}>
                {selected && <span className="absolute right-2 top-2 rounded-full bg-teal-600 p-1 text-white"><Check className="h-3 w-3" /></span>}
                <span className="flex h-20 w-full items-center justify-center rounded-lg bg-slate-50 p-2 dark:bg-[#252D38]"><img src={item.uri} alt="" className="max-h-full max-w-full object-contain" onError={() => { /* Keep the tile available so the broken stored path is visible as an issue. */ }} /></span>
                <span className="w-full truncate text-xs font-semibold text-slate-800 dark:text-[#FAFAFA]">{item.name}</span>
                <span className="text-[10px] text-slate-500 dark:text-[#9CA3AF]">{Math.round(item.sizeBytes / 1024)} KB{selected ? ' · Selected' : ''}</span>
              </button>;
            })}
          </div>}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-3 dark:border-[#354050]">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-teal-500 dark:border-[#354050] dark:text-[#D1D5DB]">
            <ImagePlus className="h-4 w-4" />{busy ? 'Processing…' : 'Upload new logo'}
            <input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" disabled={busy} className="hidden" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void upload(file); }} />
          </label>
          <button type="button" onClick={() => setShowPicker(false)} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-[#00BFA5] dark:text-[#10211F]">Done</button>
        </footer>
      </section>
    </div>}
  </>;
};
