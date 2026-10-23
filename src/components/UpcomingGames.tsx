import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { ThemedDropdown } from './ThemedDropdown';
import { CalendarDays, Clock3, MapPin, Plus, Pencil, Trash2, X, Check, Shield, Bell } from 'lucide-react';
import { checkGameNotificationPermission, requestGameNotificationPermission, syncGameReminders } from '../utils/gameNotifications';
import { ConfirmationModal } from './ConfirmationModal';
import { protectedStorageSetItem } from '../context/gameStorageSafety';
import teamIcon from '../assets/TeamIcon.png';
import { TeamLogoImage } from './TeamLogoImage';
import { recordDiagnosticError } from '../utils/errorDiagnostics';

const GAMES_KEY = 'dugoutPulse.upcomingGames.v1';
const OPPOSITION_TEAMS_KEY = 'dugoutPulse.oppositionTeams.v1';

interface ScheduledGame {
  id: string;
  opponent: string;
  playerTeamId?: string;
  playerTeamName?: string;
  gameType?: string;
  ageGroup?: string;
  date: string;
  time?: string;
  isHome: boolean;
  venue?: string;
  notes?: string;
  reminderMinutes?: number;
  reminderOptOut?: boolean;
}

interface OppositionTeam {
  id: string;
  name: string;
  logo?: string;
}

type StoredArrayRead<T> = { value: T; error: string | null };

const readJson = <T,>(key: string, fallback: T): StoredArrayRead<T> => {
  try {
    const value = localStorage.getItem(key);
    if (!value) return { value: fallback, error: null };
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new SyntaxError('Saved list did not contain an array.');
    return { value: parsed as T, error: null };
  } catch (error) {
    recordDiagnosticError(
      error instanceof SyntaxError ? 'data_corruption' : 'storage_read',
      error,
      'Saved local list ' + key + ' could not be read. The stored value was not changed.',
    );
    return {
      value: fallback,
      error: 'Dugout Pulse could not read a saved upcoming-game or opposition-team list. No saved values were changed. Review the diagnostic report before making changes.',
    };
  }
};

const inputClass = 'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#18212D] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA] dark:focus:ring-[#00D7BC]';

export const UpcomingGames: React.FC<{ compact?: boolean; nextOnly?: boolean }> = ({ compact = false, nextOnly = false }) => {
  const { activeProfile, allTournaments, settings, isLoading, restoreFailed } = useGame();
  const playerTeams = useMemo(() => {
    const savedTeams = activeProfile.teams || [];
    if (savedTeams.length) return savedTeams;
    return activeProfile.teamName ? [{ id: 'primary-team', name: activeProfile.teamName, isDefault: true, logo: undefined }] : [];
  }, [activeProfile.teams, activeProfile.teamName]);
  const defaultPlayerTeam = playerTeams.find((team) => team.isDefault) || playerTeams[0];
  const [gameType, setGameType] = useState(defaultPlayerTeam?.tournament || allTournaments[0] || 'League');
  const gameTypes = useMemo(() => Array.from(new Set([...(allTournaments || []), ...playerTeams.map((team) => team.tournament).filter((value): value is string => Boolean(value?.trim()))])), [allTournaments, playerTeams]);
  const teamsForGameType = useMemo(() => playerTeams.filter((team) => (team.tournament || 'League').trim().toLocaleLowerCase() === gameType.trim().toLocaleLowerCase()), [playerTeams, gameType]);
  const [initialGames] = useState(() => readJson<ScheduledGame[]>(GAMES_KEY, []));
  const [initialTeams] = useState(() => readJson<OppositionTeam[]>(OPPOSITION_TEAMS_KEY, []));
  const [games, setGames] = useState<ScheduledGame[]>(initialGames.value);
  const [teams, setTeams] = useState<OppositionTeam[]>(initialTeams.value);
  const [failureAlert, setFailureAlert] = useState<string | null>(() => initialGames.error || initialTeams.error);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [opponent, setOpponent] = useState('');
  const [playerTeamId, setPlayerTeamId] = useState(playerTeams.find((team) => (team.tournament || 'League').trim().toLocaleLowerCase() === (defaultPlayerTeam?.tournament || allTournaments[0] || 'League').trim().toLocaleLowerCase())?.id || '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [venue, setVenue] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState(0);
  const [message, setMessage] = useState('');
  const [permissionPromptGame, setPermissionPromptGame] = useState<ScheduledGame | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    if (!nextOnly) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [nextOnly]);

  // Reflect venue renames immediately if Upcoming Games is still mounted.
  useEffect(() => {
    const handleVenueRenamed = (event: Event) => {
      const detail = (event as CustomEvent<{ oldName: string; newName: string }>).detail;
      if (!detail?.oldName || !detail?.newName) return;
      if (restoreFailed) {
        setMessage('Storage recovery is required before scheduled games can be changed.');
        return;
      }
      const next = games.map((game) =>
        game.venue?.trim().toLocaleLowerCase() === detail.oldName.trim().toLocaleLowerCase()
          ? { ...game, venue: detail.newName }
          : game
      );
      try {
        if (!protectedStorageSetItem(GAMES_KEY, JSON.stringify(next))) {
          setFailureAlert('Dugout Pulse could not safely save the venue change to scheduled games. No scheduled-game changes were saved.');
          return;
        }
      } catch (error) {
        recordDiagnosticError('storage_write', error, 'Scheduled games could not be saved after a venue rename.');
        setFailureAlert('The venue was renamed, but scheduled games could not be saved. Review the diagnostic report before trying again.');
        return;
      }
      setGames(next);
      setVenue((current) =>
        current.trim().toLocaleLowerCase() === detail.oldName.trim().toLocaleLowerCase()
          ? detail.newName
          : current
      );
    };
    window.addEventListener('dugout-pulse-venue-renamed', handleVenueRenamed);
    return () => window.removeEventListener('dugout-pulse-venue-renamed', handleVenueRenamed);
  }, [games, restoreFailed]);

  useEffect(() => {
    if (isLoading || restoreFailed) return;
    void syncGameReminders(games, settings.gameRemindersEnabled === true).catch((error: unknown) => {
      recordDiagnosticError('native_failure', error, 'Game reminder synchronization failed after the scheduled-game list changed.');
      setFailureAlert('Dugout Pulse could not update game reminders. Your scheduled-game list remains saved; review notification settings and the diagnostic report.');
    });
  }, [games, settings.gameRemindersEnabled, isLoading, restoreFailed]);

  const sortedGames = useMemo(
    () => [...games].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')),
    [games],
  );
  const logos = useMemo(() => new Map(teams.map((team) => [team.name.trim().toLocaleLowerCase(), team.logo])), [teams]);

  const persist = (next: ScheduledGame[]) => {
    if (restoreFailed) {
      setMessage('Storage recovery is required before scheduled games can be changed.');
      return;
    }
    try {
      if (!protectedStorageSetItem(GAMES_KEY, JSON.stringify(next))) {
        setFailureAlert('Dugout Pulse could not safely save this scheduled-game change. No scheduled-game changes were saved.');
        return;
      }
      setGames(next);
      setMessage('');
    } catch (error) {
      recordDiagnosticError('storage_write', error, 'A scheduled-game write failed. The app did not confirm that the change was saved.');
      setFailureAlert('Dugout Pulse could not save this game on the device. Do not assume the change was saved; review the diagnostic report before retrying.');
    }
  };

  const toggleGameReminder = async (game: ScheduledGame) => {
    if (!game.time) {
      setMessage('Add a start time to this game before enabling its reminder.');
      return;
    }

    const allGamesEnabled = settings.gameRemindersEnabled === true;
    const currentlyEnabled = allGamesEnabled ? !game.reminderOptOut : Boolean(game.reminderMinutes);
    if (!currentlyEnabled) {
      const alreadyGranted = await checkGameNotificationPermission();
      if (!alreadyGranted) {
        setPermissionPromptGame(game);
        return;
      }
      const granted = await requestGameNotificationPermission();
      if (!granted) {
        setPermissionPromptGame(game);
        return;
      }
    }

    persist(games.map((item) => {
      if (item.id !== game.id) return item;
      if (allGamesEnabled) {
        return { ...item, reminderOptOut: currentlyEnabled ? true : false };
      }
      return { ...item, reminderMinutes: currentlyEnabled ? undefined : 60, reminderOptOut: false };
    }));
    // The bell itself reflects the choice; avoid success pop-ups for every tap.
  };

  const resetForm = () => {
    setEditingId(null);
    setOpponent('');
    const nextType = defaultPlayerTeam?.tournament || allTournaments[0] || 'League';
    setGameType(nextType);
    setPlayerTeamId(playerTeams.find((team) => (team.tournament || 'League').trim().toLocaleLowerCase() === nextType.trim().toLocaleLowerCase())?.id || '');
    setDate('');
    setTime('');
    setIsHome(true);
    setVenue('');
    setNotes('');
    setReminderMinutes(0);
    setShowForm(false);
  };

  const startEdit = (game: ScheduledGame) => {
    setEditingId(game.id);
    setOpponent(game.opponent);
    const existingTeam = playerTeams.find((team) => team.id === game.playerTeamId) || playerTeams.find((team) => team.name === game.playerTeamName);
    const nextType = game.gameType || existingTeam?.tournament || defaultPlayerTeam?.tournament || allTournaments[0] || 'League';
    setGameType(nextType);
    setPlayerTeamId((existingTeam && (existingTeam.tournament || 'League').trim().toLocaleLowerCase() === nextType.trim().toLocaleLowerCase() ? existingTeam.id : undefined) || playerTeams.find((team) => (team.tournament || 'League').trim().toLocaleLowerCase() === nextType.trim().toLocaleLowerCase())?.id || '');
    setDate(game.date);
    setTime(game.time || '');
    setIsHome(game.isHome);
    setVenue(game.venue || '');
    setNotes(game.notes || '');
    setReminderMinutes(game.reminderMinutes || 0);
    setShowForm(true);
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const selectedPlayerTeam = teamsForGameType.find((team) => team.id === playerTeamId);
    if (!opponent.trim() || !date || !gameType || !selectedPlayerTeam) return;
    const nextGame: ScheduledGame = {
      id: editingId || `scheduled_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      opponent: opponent.trim(),
      ...(selectedPlayerTeam ? { playerTeamId: selectedPlayerTeam.id, playerTeamName: selectedPlayerTeam.name } : {}),
      gameType,
      ...(selectedPlayerTeam.ageGroup ? { ageGroup: selectedPlayerTeam.ageGroup } : {}),
      date,
      ...(time ? { time } : {}),
      isHome,
      ...(venue.trim() ? { venue: venue.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(reminderMinutes ? { reminderMinutes } : {}),
      ...(editingId && games.find((game) => game.id === editingId)?.reminderOptOut ? { reminderOptOut: true } : {}),
    };
    persist(editingId ? games.map((game) => game.id === editingId ? nextGame : game) : [...games, nextGame]);
    resetForm();
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = sortedGames.filter((game) => {
    const gameDate = new Date(`${game.date}T00:00:00`);
    if (Number.isNaN(gameDate.getTime()) || gameDate < today) return false;
    if (!game.time) return true;
    const gameDateTime = new Date(`${game.date}T${game.time}:00`);
    return !Number.isNaN(gameDateTime.getTime()) && gameDateTime.getTime() >= clockNow;
  });
  const displayedGames = nextOnly ? upcoming.slice(0, 1) : upcoming;
  const formatCountdown = (game: ScheduledGame) => {
    if (!game.time) {
      const targetDay = new Date(`${game.date}T00:00:00`);
      const todayDay = new Date();
      todayDay.setHours(0, 0, 0, 0);
      const days = Math.round((targetDay.getTime() - todayDay.getTime()) / 86400000);
      return days <= 0 ? 'Today · time not set' : days === 1 ? 'Tomorrow · time not set' : `In ${days} days · time not set`;
    }
    const target = new Date(`${game.date}T${game.time}:00`).getTime();
    const remaining = target - clockNow;
    if (remaining <= 0) return 'Game time reached';
    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <>
    <ConfirmationModal
      isOpen={Boolean(failureAlert)}
      title="Could not complete operation"
      message={failureAlert || ''}
      confirmLabel="OK"
      showCancelButton={false}
      closeOnBackdrop={false}
      variant="warning"
      onCancel={() => setFailureAlert(null)}
      onConfirm={() => setFailureAlert(null)}
    />
    <ConfirmationModal
      isOpen={Boolean(permissionPromptGame)}
      title="Allow game notifications"
      message="Dugout Pulse needs Android notification permission to send this game reminder. Tap Try Again to show the permission request. If Android no longer shows the request, open your phone's Settings → Apps → Dugout Pulse → Notifications and allow notifications, then return here."
      confirmLabel="Try Again"
      cancelLabel="Not Now"
      onCancel={() => setPermissionPromptGame(null)}
      onConfirm={async () => {
        const target = permissionPromptGame;
        const granted = await requestGameNotificationPermission();
        if (!granted) {
          setMessage('Notifications are still blocked. Allow them in Android Settings, then tap the game bell again.');
          return;
        }
        setPermissionPromptGame(null);
        if (target) await toggleGameReminder(target);
      }}
    />
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-[#354050] dark:bg-[#252D38]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-[#354050]">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E6FBF8] text-[#007A6A] dark:bg-[#00D7BC]/10 dark:text-[#00D7BC]">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#18212D] dark:text-[#FAFAFA]">Upcoming Games</h2>
            <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">{nextOnly ? (upcoming.length ? 'Next scheduled game' : 'No games scheduled') : `${upcoming.length} scheduled ${upcoming.length === 1 ? 'game' : 'games'}`}</p>
          </div>
        </div>
        <button type="button" onClick={() => { if (showForm) resetForm(); else { setEditingId(null); setOpponent(''); setGameType(defaultPlayerTeam?.tournament || allTournaments[0] || 'League'); setPlayerTeamId(playerTeams.find((team) => (team.tournament || 'League').trim().toLocaleLowerCase() === (defaultPlayerTeam?.tournament || allTournaments[0] || 'League').trim().toLocaleLowerCase())?.id || ''); setDate(''); setTime(''); setIsHome(true); setVenue(''); setNotes(''); setReminderMinutes(0); setShowForm(true); } }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#00BFA5] px-3 py-2 text-xs font-semibold text-[#18212D] transition-colors hover:bg-[#00A892] dark:bg-[#00D7BC] dark:text-[#101419] dark:hover:bg-[#00C4AB]">
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{showForm ? 'Cancel' : 'Add Game'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="space-y-3 border-b border-slate-200 bg-slate-50 p-4 dark:border-[#354050] dark:bg-[#1A2028]/70">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Type *
              <ThemedDropdown<string> value={gameType || undefined} onChange={(next) => { const nextType = next || ''; setGameType(nextType); const nextTeam = playerTeams.find((team) => (team.tournament || '').trim().toLocaleLowerCase() === nextType.trim().toLocaleLowerCase()); setPlayerTeamId(nextTeam?.id || ''); }} options={gameTypes.map((type) => ({ value: type, label: type }))} placeholder="Select game type" allowClear={false} ariaLabel="Game type" className="mt-1 w-full" buttonClassName="!rounded-lg !py-2 !text-xs !font-normal" />
            </label>
            <label className="block min-w-0 text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Player's Team *
              <ThemedDropdown<string> value={playerTeamId || undefined} onChange={(next) => setPlayerTeamId(next || '')} options={teamsForGameType.map((team) => ({ value: team.id, label: team.name, logo: team.logo }))} placeholder="Select player's team" allowClear={false} ariaLabel="Player's team for this game" className="mt-1 w-full" buttonClassName="!rounded-lg !py-2 !text-xs !font-normal" />
            </label>
            <label className="block min-w-0 text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Opposition Team *
              <ThemedDropdown<string> value={opponent || undefined} onChange={(next) => setOpponent(next || '')} options={teams.map((team) => ({ value: team.name, label: team.name, logo: team.logo || teamIcon }))} placeholder="Select opposition team" allowClear={false} ariaLabel="Opposition team" className="mt-1 w-full" buttonClassName="!rounded-lg !py-2 !text-xs !font-normal" />
              <input required value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Or type opposition team" className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Game Date *
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Start Time
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <label className="block min-w-0 text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Venue
              <ThemedDropdown<string>
                value={venue && (settings.venues || []).includes(venue) ? venue : undefined}
                onChange={(next) => setVenue(next || '')}
                options={(settings.venues || []).map((savedVenue) => ({ value: savedVenue, label: savedVenue }))}
                placeholder={(settings.venues || []).length ? 'Select saved venue' : 'No saved venues yet'}
                allowClear={true}
                ariaLabel="Venue"
                className="mt-1 w-full"
                buttonClassName="!rounded-lg !py-2 !text-xs !font-normal"
              />
              <input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Or type a venue / field"
                aria-label="Or type a venue / field"
                className={`${inputClass} mt-1`}
              />
              {!(settings.venues || []).length && <span className="mt-1 block text-[10px] font-normal text-slate-500 dark:text-[#9CA3AF]">Add saved venues in Settings → Venues to select them here.</span>}
            </label>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Game Reminder (optional)
              <ThemedDropdown<number>
                value={reminderMinutes}
                disabled={!time}
                onChange={(next) => next !== undefined && setReminderMinutes(next)}
                options={[
                  { value: 0, label: 'No reminder' },
                  { value: 1440, label: '1 day before' },
                  { value: 120, label: '2 hours before' },
                  { value: 60, label: '1 hour before' },
                ]}
                placeholder="Choose reminder"
                ariaLabel="Game reminder"
                allowClear={false}
                className="mt-1 w-full"
              />
              {!time && <span className="mt-1 block text-[10px] font-normal text-slate-500 dark:text-[#9CA3AF]">Add a start time to schedule a reminder.</span>}
              {time && settings.gameRemindersEnabled === true && <span className="mt-1 block text-[10px] font-normal text-slate-500 dark:text-[#9CA3AF]">All games are reminded by default. Use the bell on a game to opt out.</span>}
              {time && settings.gameRemindersEnabled !== true && <span className="mt-1 block text-[10px] font-normal text-slate-500 dark:text-[#9CA3AF]">This game can have its own reminder even when all-game reminders are off.</span>}
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
        {displayedGames.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center dark:border-[#354050]">
            <CalendarDays className="mx-auto h-5 w-5 text-slate-400 dark:text-[#6B7280]" />
            <p className="mt-2 text-xs font-medium text-slate-700 dark:text-[#D1D5DB]">No upcoming games scheduled</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-[#9CA3AF]">Add a fixture here. It won't affect completed-game statistics.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedGames.map((game) => {
              const logo = logos.get(game.opponent.trim().toLocaleLowerCase());
              const playerTeam = playerTeams.find((team) => team.id === game.playerTeamId) || playerTeams.find((team) => team.name === game.playerTeamName) || (!game.playerTeamName ? defaultPlayerTeam : undefined);
              const playerTeamName = game.playerTeamName || playerTeam?.name;
              const gameDate = new Date(`${game.date}T00:00:00`);
              return (
                <article key={game.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-[#354050] dark:bg-[#1A2028]/60">
                  <div className="flex min-w-0 items-center gap-2">
                    {playerTeam?.logo && <TeamLogoImage value={playerTeam.logo} alt="" className="h-5 w-5 shrink-0 rounded-sm bg-white object-contain" />}
                    <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#18212D] dark:text-[#FAFAFA]">
                      {playerTeamName || 'Player team'} : {playerTeam?.ageGroup || game.ageGroup}
                    </p>
                  </div>
                  
                  <div className="mt-2 flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#354050] dark:bg-[#252D38]">
                      {logo ? <TeamLogoImage value={logo} alt={`${game.opponent} logo`} className="h-full w-full object-contain p-1" /> : <img src={teamIcon} alt={`${game.opponent} default icon`} className="h-full w-full object-contain p-1" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-[#18212D] dark:text-[#FAFAFA]">{game.isHome ? 'vs' : '@'} {game.opponent}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-[#9CA3AF]">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{gameDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} @ {game.time}</span>
                        {game.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{game.venue}</span>}
                        {game.gameType && <span className="inline-flex items-center gap-1"><Shield className="h-3 w-3" />{game.gameType}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 flex justify-end gap-1">
                    {nextOnly && <p className="py-1 pt-1 mt-1 rounded-xl text-[13px] border border-[#00BFA5] font-semibold bg-[#00BFA5]/20 flex-1 items-center justify-self-center text-center tabular-nums text-[#007A6A] dark:text-[#00D7BC]" aria-live="off">{formatCountdown(game)}</p>}
                    <button
                      type="button"
                      onClick={() => toggleGameReminder(game)}
                      disabled={!game.time}
                      aria-label={(settings.gameRemindersEnabled === true ? !game.reminderOptOut : Boolean(game.reminderMinutes)) ? `Disable reminder for ${game.opponent}` : `Enable reminder for ${game.opponent}`}
                      title={!game.time ? 'Add a start time to enable a reminder' : (settings.gameRemindersEnabled === true ? !game.reminderOptOut : Boolean(game.reminderMinutes)) ? 'Reminder on — click to turn off' : 'Remind me 1 hour before'}
                      className={`rounded-lg p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${(settings.gameRemindersEnabled === true ? !game.reminderOptOut : Boolean(game.reminderMinutes)) ? 'bg-[#E6FBF8] text-[#007A6A] dark:bg-[#00D7BC]/10 dark:text-[#00D7BC]' : 'text-slate-500 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#354050]'}`}
                    ><Bell className="h-3.5 w-3.5" /></button>
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
    </>
  );
};
