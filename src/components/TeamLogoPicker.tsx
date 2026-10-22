import React, { useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';
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
      setItems(readTeamLogoLibrary());
      onChange(logoLibraryReference(item.id));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save that logo.');
    } finally { setBusy(false); }
  };
  return <div className={compact ? 'flex items-center gap-2' : 'mt-2 flex flex-wrap items-center gap-2'}>
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-semibold text-slate-700 hover:border-teal-500 dark:border-[#354050] dark:text-[#D1D5DB]">
      <ImagePlus className="h-3.5 w-3.5" />{busy ? 'Processing…' : 'Upload logo'}
      <input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" disabled={busy} className="hidden" onChange={e => { const file=e.target.files?.[0]; e.target.value=''; void upload(file); }} />
    </label>
    <select aria-label="Choose an existing team logo" value={value || ''} onChange={e => onChange(e.target.value || undefined)} className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-700 dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#D1D5DB]">
      <option value="">Use default logo</option>
      {items.map(item => <option key={item.id} value={logoLibraryReference(item.id)}>{item.name} ({Math.round(item.sizeBytes / 1024)} KB)</option>)}
    </select>
  </div>;
};
