import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { ThemedDropdown } from './ThemedDropdown';
import { CalendarDays, Clock3, MapPin, Plus, Pencil, Trash2, X, Check, Shield } from 'lucide-react';

const GAMES_KEY = 'dugoutPulse.upcomingGames.v1';
const OPPOSITION_TEAMS_KEY = 'dugoutPulse.oppositionTeams.v1';

interface ScheduledGame {
  id: string;
  opponent: string;
  playerTeamId?: string;
  playerTeamName?: string;
  gameType?: string;
  date: string;
  time?: string;
  isHome: boolean;
  venue?: string;
  notes?: string;
}

interface OppositionTeam {
  id: string;
  name: string;
  logo?: string;
}

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T : fallback;
  } catch {
    return fallback;
  }
};

const inputClass = 'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#18212D] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA] dark:focus:ring-[#00D7BC]';

export const UpcomingGames: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { activeProfile, allTournaments } = useGame();
  const playerTeams = useMemo(() => {
    const savedTeams = activeProfile.teams || [];
    if (savedTeams.length) return savedTeams;
    return activeProfile.teamName ? [{ id: 'primary-team', name: activeProfile.teamName, isDefault: true, logo: undefined }] : [];
  }, [activeProfile.teams, activeProfile.teamName]);
  const defaultPlayerTeam = playerTeams.find((team) => team.isDefault) || playerTeams[0];
  const [gameType, setGameType] = useState(defaultPlayerTeam?.tournament || allTournaments[0] || 'League');
  const gameTypes = useMemo(() => Array.from(new Set([...(allTournaments || []), ...playerTeams.map((team) => team.tournament).filter((value): value is string => Boolean(value?.trim()))])), [allTournaments, playerTeams]);
  const teamsForGameType = useMemo(() => playerTeams.filter((team) => (team.tournament || '').trim().toLocaleLowerCase() === gameType.trim().toLocaleLowerCase()), [playerTeams, gameType]);
  const [games, setGames] = useState<ScheduledGame[]>(() => readJson(GAMES_KEY, []));
  const [teams, setTeams] = useState<OppositionTeam[]>(() => readJson(OPPOSITION_TEAMS_KEY, []));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [opponent, setOpponent] = useState('');
  const [playerTeamId, setPlayerTeamId] = useState(defaultPlayerTeam?.id || '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [venue, setVenue] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setGames(readJson<ScheduledGame[]>(GAMES_KEY, []));
    setTeams(readJson<OppositionTeam[]>(OPPOSITION_TEAMS_KEY, []));
  }, []);

  const sortedGames = useMemo(
    () => [...games].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')),
    [games],
  );
  const logos = useMemo(() => new Map(teams.map((team) => [team.name.trim().toLocaleLowerCase(), team.logo])), [teams]);

  const persist = (next: ScheduledGame[]) => {
    setGames(next);
    try {
      localStorage.setItem(GAMES_KEY, JSON.stringify(next));
      setMessage('');
    } catch {
      setMessage('Could not save this game on the device. Please free up storage and try again.');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setOpponent('');
    const nextType = defaultPlayerTeam?.tournament || allTournaments[0] || 'League';
    setGameType(nextType);
    setPlayerTeamId(playerTeams.find((team) => (team.tournament || '').trim().toLocaleLowerCase() === nextType.trim().toLocaleLowerCase())?.id || '');
    setDate('');
    setTime('');
    setIsHome(true);
    setVenue('');
    setNotes('');
    setShowForm(false);
  };

  const startEdit = (game: ScheduledGame) => {
    setEditingId(game.id);
    setOpponent(game.opponent);
    const existingTeam = playerTeams.find((team) => team.id === game.playerTeamId) || playerTeams.find((team) => team.name === game.playerTeamName);
    const nextType = game.gameType || existingTeam?.tournament || defaultPlayerTeam?.tournament || allTournaments[0] || 'League';
    setGameType(nextType);
    setPlayerTeamId((existingTeam && (existingTeam.tournament || '').trim().toLocaleLowerCase() === nextType.trim().toLocaleLowerCase() ? existingTeam.id : undefined) || playerTeams.find((team) => (team.tournament || '').trim().toLocaleLowerCase() === nextType.trim().toLocaleLowerCase())?.id || '');
    setDate(game.date);
    setTime(game.time || '');
    setIsHome(game.isHome);
    setVenue(game.venue || '');
    setNotes(game.notes || '');
    setShowForm(true);
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!opponent.trim() || !date || !gameType || !teamsForGameType.some((team) => team.id === playerTeamId)) return;
    const selectedPlayerTeam = teamsForGameType.find((team) => team.id === playerTeamId);
    const nextGame: ScheduledGame = {
      id: editingId || `scheduled_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      opponent: opponent.trim(),
      ...(selectedPlayerTeam ? { playerTeamId: selectedPlayerTeam.id, playerTeamName: selectedPlayerTeam.name } : {}),
      gameType,
      date,
      ...(time ? { time } : {}),
      isHome,
      ...(venue.trim() ? { venue: venue.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    persist(editingId ? games.map((game) => game.id === editingId ? nextGame : game) : [...games, nextGame]);
    resetForm();
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = sortedGames.filter((game) => {
    const gameDate = new Date(`${game.date}T00:00:00`);
    return !Number.isNaN(gameDate.getTime()) && gameDate >= today;
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-[#354050] dark:bg-[#252D38]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-[#354050]">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E6FBF8] text-[#007A6A] dark:bg-[#00D7BC]/10 dark:text-[#00D7BC]">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#18212D] dark:text-[#FAFAFA]">Upcoming Games</h2>
            <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">{upcoming.length} scheduled {upcoming.length === 1 ? 'game' : 'games'}</p>
          </div>
        </div>
        <button type="button" onClick={() => { if (showForm) resetForm(); else { setEditingId(null); setOpponent(''); setGameType(defaultPlayerTeam?.tournament || allTournaments[0] || 'League'); setPlayerTeamId(playerTeams.find((team) => (team.tournament || '').trim().toLocaleLowerCase() === (defaultPlayerTeam?.tournament || allTournaments[0] || 'League').trim().toLocaleLowerCase())?.id || ''); setDate(''); setTime(''); setIsHome(true); setVenue(''); setNotes(''); setShowForm(true); } }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#00BFA5] px-3 py-2 text-xs font-semibold text-[#18212D] transition-colors hover:bg-[#00A892] dark:bg-[#00D7BC] dark:text-[#101419] dark:hover:bg-[#00C4AB]">
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{showForm ? 'Cancel' : 'Add Game'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="space-y-3 border-b border-slate-200 bg-slate-50 p-4 dark:border-[#354050] dark:bg-[#1A2028]/70">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Type *
              <ThemedDropdown<string> value={gameType || undefined} onChange={(next) => { const nextType = next || ''; setGameType(nextType); setPlayerTeamId(playerTeams.find((team) => (team.tournament || '').trim().toLocaleLowerCase() === nextType.trim().toLocaleLowerCase())?.id || ''); }} options={gameTypes.map((type) => ({ value: type, label: type }))} placeholder="Select game type" allowClear={false} ariaLabel="Game type" className="mt-1 w-full" buttonClassName="!rounded-lg !py-2 !text-xs !font-normal" />
            </label>
            <label className="block min-w-0 text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Player's Team *
              <ThemedDropdown<string> value={playerTeamId || undefined} onChange={(next) => setPlayerTeamId(next || '')} options={teamsForGameType.map((team) => ({ value: team.id, label: team.name, logo: team.logo }))} placeholder="Select player's team" allowClear={false} ariaLabel="Player's team for this game" className="mt-1 w-full" buttonClassName="!rounded-lg !py-2 !text-xs !font-normal" />
            </label>
            <label className="block min-w-0 text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Opposition Team *
              <ThemedDropdown<string> value={opponent || undefined} onChange={(next) => setOpponent(next || '')} options={teams.map((team) => ({ value: team.name, label: team.name, logo: team.logo }))} placeholder="Select opposition team" allowClear={false} ariaLabel="Opposition team" className="mt-1 w-full" buttonClassName="!rounded-lg !py-2 !text-xs !font-normal" />
              <input required value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Or type opposition team" className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Game Date *
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Start Time
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Venue
              <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Field / stadium" className={`${inputClass} mt-1`} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Game location:</span>
            <button type="button" onClick={() => setIsHome(true)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${isHome ? 'border-[#00BFA5] bg-[#E6FBF8] text-[#006B5D] dark:border-[#00D7BC] dark:bg-[#00D7BC]/10 dark:text-[#00D7BC]' : 'border-slate-200 text-slate-500 dark:border-[#354050] dark:text-[#9CA3AF]'}`}>Home</button>
            <button type="button" onClick={() => setIsHome(false)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${!isHome ? 'border-[#00BFA5] bg-[#E6FBF8] text-[#006B5D] dark:border-[#00D7BC] dark:bg-[#00D7BC]/10 dark:text-[#00D7BC]' : 'border-slate-200 text-slate-500 dark:border-[#354050] dark:text-[#9CA3AF]'}`}>Away</button>
          </div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Notes (optional)
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember about this fixture" className={`${inputClass} mt-1`} />
          </label>
          <div className="flex justify-end">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-[#00BFA5] px-4 py-2 text-xs font-semibold text-[#18212D] hover:bg-[#00A892] dark:bg-[#00D7BC] dark:text-[#101419] dark:hover:bg-[#00C4AB]"><Check className="h-3.5 w-3.5" />{editingId ? 'Save Changes' : 'Save Upcoming Game'}</button>
          </div>
        </form>
      )}

      <div className={compact ? 'p-3' : 'p-4'}>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center dark:border-[#354050]">
            <CalendarDays className="mx-auto h-5 w-5 text-slate-400 dark:text-[#6B7280]" />
            <p className="mt-2 text-xs font-medium text-slate-700 dark:text-[#D1D5DB]">No upcoming games scheduled</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-[#9CA3AF]">Add a fixture here. It won't affect completed-game statistics.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((game) => {
              const logo = logos.get(game.opponent.trim().toLocaleLowerCase());
              const playerTeam = playerTeams.find((team) => team.id === game.playerTeamId) || playerTeams.find((team) => team.name === game.playerTeamName) || (!game.playerTeamName ? defaultPlayerTeam : undefined);
              const playerTeamName = game.playerTeamName || playerTeam?.name;
              const gameDate = new Date(`${game.date}T00:00:00`);
              return (
                <article key={game.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#354050] dark:bg-[#1A2028]/60">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#354050] dark:bg-[#252D38]">
                    {logo ? <img src={logo} alt={`${game.opponent} logo`} className="h-full w-full object-contain p-1" /> : <Shield className="h-5 w-5 text-slate-400 dark:text-[#6B7280]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">{playerTeam?.logo && <img src={playerTeam.logo} alt={`${playerTeamName || playerTeam.name} logo`} className="h-4 w-4 shrink-0 rounded-sm bg-white object-contain" />}<span className="truncate">{playerTeamName ? `${playerTeamName} ${game.isHome ? 'vs' : '@'} ${game.opponent}` : `${game.isHome ? 'vs' : '@'} ${game.opponent}`}</span></p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-[#9CA3AF]">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{gameDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      {game.time && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{game.time}</span>}
                      {game.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{game.venue}</span>}
                    </div>
                    {game.notes && <p className="mt-1 text-[10px] text-slate-500 dark:text-[#9CA3AF]">{game.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => startEdit(game)} aria-label={`Edit game against ${game.opponent}`} title="Edit upcoming game" className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#354050]"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => persist(games.filter((item) => item.id !== game.id))} aria-label={`Delete game against ${game.opponent}`} title="Delete upcoming game" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-[#D1D5DB] dark:hover:bg-[#FF5252]/15"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {message && <p role="alert" className="mt-2 text-[11px] text-red-600 dark:text-[#D4626D]">{message}</p>}
      </div>
    </section>
  );
};
