import React, { useEffect, useRef, useState } from 'react';
import { useGame, type OppositionTeam } from '../context/GameContext';
import { Plus, Shield, Trash2, Pencil, X, Check } from 'lucide-react';
import teamIcon from '../assets/TeamIcon.png';
import { TeamLogoPicker } from './TeamLogoPicker';
import { migrateLegacyLogoDataUrl, resolveTeamLogoSrc } from '../utils/teamLogoLibrary';
import { TeamLogoImage } from './TeamLogoImage';

const fieldClass = 'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#18212D] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA] dark:focus:ring-[#00D7BC]';

export const OppositionTeamsSettings: React.FC = () => {
  const { oppositionTeams: teams, addOppositionTeam, updateOppositionTeam, deleteOppositionTeam } = useGame();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current); }, []);
  const showSuccess = (message: string) => {
    if (successTimer.current) clearTimeout(successTimer.current);
    setSuccess(message);
    successTimer.current = setTimeout(() => setSuccess(''), 3200);
  };
  useEffect(() => {
    let cancelled = false;
    const migrate = async () => {
      for (const team of teams) {
        if (!team.logo?.startsWith('data:image/')) continue;
        try {
          const logo = await migrateLegacyLogoDataUrl(team.logo);
          if (!cancelled) updateOppositionTeam(team.id, { logo });
        } catch (cause) {
          if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not migrate an existing team logo.');
        }
      }
    };
    void migrate();
    return () => { cancelled = true; };
  }, [teams, updateOppositionTeam]);

  const addTeam = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (!addOppositionTeam(name)) {
      setError('Could not add this team. It may already exist, or there may not be enough storage.');
      return;
    }
    setError('');
    showSuccess(`“${name}” added to opposition teams.`);
    setNewName('');
  };

  const setTeamLogo = (teamId: string, logo?: string) => {
    setSuccess('');
    if (!updateOppositionTeam(teamId, { logo })) {
      setError('Could not update this team logo.');
      return;
    }
    setError('');
    showSuccess(logo ? 'Team logo saved and linked.' : 'Team logo removed. The default team icon will be used.');
  };

  const removeLogo = (teamId: string) => {
    setSuccess('');
    if (!updateOppositionTeam(teamId, { logo: undefined })) {
      setError('Could not save this team. The logo may be too large or storage may be full.');
      return;
    }
    setError('');
    showSuccess('Team logo removed. The default team icon will be used.');
  };

  const removeTeam = (teamId: string) => {
    if (!deleteOppositionTeam(teamId)) {
      setError('Could not delete this team. Please try again.');
      return;
    }
    setError('');
    showSuccess('Opposition team deleted.');
  };

  const saveRename = (team: OppositionTeam) => {
    const name = editName.trim();
    if (!name) return;
    if (teams.some((item) => item.id !== team.id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError('An opposition team with that name already exists.');
      return;
    }
    if (!updateOppositionTeam(team.id, { name })) {
      setError('Could not save this team. Check the name and available storage.');
      return;
    }
    setError('');
    showSuccess('Opposition team name updated.');
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
      {success && <div role="status" aria-live="polite" className="fixed top-5 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-in fade-in slide-in-from-top-3 duration-200 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-xl dark:border-[#236B60] dark:bg-[#1A2028]">
        <div className="flex items-start gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-[#00D7BC]/15 dark:text-[#00D7BC]">✓</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">Done</p><p className="mt-0.5 text-xs text-slate-600 dark:text-[#D1D5DB]">{success}</p></div><button type="button" onClick={() => { if (successTimer.current) clearTimeout(successTimer.current); setSuccess(''); }} aria-label="Dismiss notification" className="rounded-md px-1 text-lg leading-5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#354050]">×</button></div>
      </div>}
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
                {resolveTeamLogoSrc(team.logo) ? <TeamLogoImage value={team.logo} alt={`${team.name} logo`} className="h-full w-full object-contain p-1" /> : <img src={teamIcon} alt={`${team.name} default icon`} className="h-full w-full object-contain p-1" />}
              </div>
              <div className="min-w-0 flex-1">
                {editingId === team.id ? (
                  <input autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} className={fieldClass} aria-label="Edit opposition team name" />
                ) : <p className="truncate text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">{team.name}</p>}
                <p className="mt-1 text-[10px] text-slate-500 dark:text-[#9CA3AF]">{resolveTeamLogoSrc(team.logo) ? 'Logo selected' : 'Using default team icon'}</p>
                <TeamLogoPicker compact value={team.logo} onChange={(logo) => setTeamLogo(team.id, logo)} onError={setError} />
              </div>
              {editingId === team.id ? (
                <>
                  <button type="button" onClick={() => saveRename(team)} aria-label="Save team name" className="rounded-lg p-2 text-[#007A6A] hover:bg-slate-100 dark:text-[#00D7BC] dark:hover:bg-[#354050]"><Check className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel rename" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#354050]"><X className="h-4 w-4" /></button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { setEditingId(team.id); setEditName(team.name); }} aria-label={`Rename ${team.name}`} title="Rename team" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-[#D1D5DB] dark:hover:bg-[#354050]"><Pencil className="h-4 w-4" /></button>
                  {team.logo && <button type="button" onClick={() => removeLogo(team.id)} aria-label={`Remove ${team.name} logo`} title="Remove logo" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-[#D1D5DB] dark:hover:bg-[#354050]"><X className="h-4 w-4" /></button>}
                  <button type="button" onClick={() => removeTeam(team.id)} aria-label={`Delete ${team.name}`} title="Delete opposition team" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-[#D1D5DB] dark:hover:bg-[#FF5252]/15"><Trash2 className="h-4 w-4" /></button>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

