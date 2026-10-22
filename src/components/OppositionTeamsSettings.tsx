import React, { useRef, useState } from 'react';
import { useGame, type OppositionTeam } from '../context/GameContext';
import { ImagePlus, Plus, Shield, Trash2, Pencil, X, Check } from 'lucide-react';

const resizeImage = (file: File, maxSize = 256): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read this image.'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('This is not a valid image.'));
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth || maxSize, image.naturalHeight || maxSize));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((image.naturalWidth || maxSize) * scale));
      canvas.height = Math.max(1, Math.round((image.naturalHeight || maxSize) * scale));
      const context = canvas.getContext('2d');
      if (!context) { reject(new Error('Image processing is not supported here.')); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    image.src = reader.result as string;
  };
  reader.readAsDataURL(file);
});

const fieldClass = 'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#18212D] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA] dark:focus:ring-[#00D7BC]';

export const OppositionTeamsSettings: React.FC = () => {
  const { oppositionTeams: teams, addOppositionTeam, updateOppositionTeam, deleteOppositionTeam } = useGame();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const addTeam = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (!addOppositionTeam(name)) {
      setError('That opposition team has already been added.');
      return;
    }
    setError('');
    setNewName('');
  };

  const uploadLogo = async (teamId: string, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file such as PNG or JPG.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Please choose an image smaller than 10 MB.'); return; }
    try {
      const logo = await resizeImage(file);
      if (!updateOppositionTeam(teamId, { logo })) {
        setError('Could not update this team logo.');
      } else {
        setError('');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not process that image.');
    }
  };

  const saveRename = (team: OppositionTeam) => {
    const name = editName.trim();
    if (!name) return;
    if (!updateOppositionTeam(team.id, { name })) {
      setError('An opposition team with that name already exists.');
      return;
    }
    setError('');
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]"><Shield className="h-4 w-4 text-[#007A6A] dark:text-[#00D7BC]" /> Opposition Teams</h3>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-[#9CA3AF]">Save each opponent once and upload its logo. The logo is reused on scheduled games for that team.</p>
      </div>
      <form onSubmit={addTeam} className="flex flex-col gap-2 sm:flex-row">
        <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Opposition team name" className={fieldClass} aria-label="Opposition team name" />
        <button type="submit" disabled={!newName.trim()} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#00BFA5] px-3 py-2 text-xs font-semibold text-[#18212D] hover:bg-[#00A892] disabled:opacity-50 dark:bg-[#00D7BC] dark:text-[#101419] dark:hover:bg-[#00C4AB]"><Plus className="h-3.5 w-3.5" />Add Team</button>
      </form>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-[#FF5252]/15 dark:text-[#D4626D]">{error}</p>}
      {teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-[#354050]">
          <Shield className="mx-auto h-6 w-6 text-slate-400 dark:text-[#6B7280]" />
          <p className="mt-2 text-xs font-medium text-slate-700 dark:text-[#D1D5DB]">No opposition teams added yet</p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-[#9CA3AF]">Add a team above, then upload its logo.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map((team) => (
            <article key={team.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-[#354050] dark:bg-[#252D38]/50">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-[#354050] dark:bg-[#1A2028]">
                {team.logo ? <img src={team.logo} alt={`${team.name} logo`} className="h-full w-full object-contain p-1" /> : <Shield className="h-5 w-5 text-slate-400 dark:text-[#6B7280]" />}
              </div>
              <div className="min-w-0 flex-1">
                {editingId === team.id ? (
                  <input autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} className={fieldClass} aria-label="Edit opposition team name" />
                ) : <p className="truncate text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">{team.name}</p>}
                <p className="mt-1 text-[10px] text-slate-500 dark:text-[#9CA3AF]">{team.logo ? 'Logo uploaded' : 'No logo uploaded'}</p>
              </div>
              {editingId === team.id ? (
                <>
                  <button type="button" onClick={() => saveRename(team)} aria-label="Save team name" className="rounded-lg p-2 text-[#007A6A] hover:bg-slate-100 dark:text-[#00D7BC] dark:hover:bg-[#354050]"><Check className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel rename" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#354050]"><X className="h-4 w-4" /></button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { setEditingId(team.id); setEditName(team.name); }} aria-label={`Rename ${team.name}`} title="Rename team" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-[#D1D5DB] dark:hover:bg-[#354050]"><Pencil className="h-4 w-4" /></button>
                  <label className="cursor-pointer rounded-lg p-2 text-[#007A6A] hover:bg-slate-100 dark:text-[#00D7BC] dark:hover:bg-[#354050]" title={team.logo ? 'Change logo' : 'Upload logo'}>
                    <ImagePlus className="h-4 w-4" />
                    <input ref={(element) => { inputRefs.current[team.id] = element; }} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void uploadLogo(team.id, file); }} />
                  </label>
                  {team.logo && <button type="button" onClick={() => updateOppositionTeam(team.id, { logo: undefined })} aria-label={`Remove ${team.name} logo`} title="Remove logo" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-[#D1D5DB] dark:hover:bg-[#354050]"><X className="h-4 w-4" /></button>}
                  <button type="button" onClick={() => deleteOppositionTeam(team.id)} aria-label={`Delete ${team.name}`} title="Delete opposition team" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-[#D1D5DB] dark:hover:bg-[#FF5252]/15"><Trash2 className="h-4 w-4" /></button>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

