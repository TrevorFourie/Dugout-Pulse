import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { ThemedDropdown } from './ThemedDropdown';
import { CalendarDays, MapPin, Plus, Pencil, Trash2, X, Check, Bell, BellOff, Trophy } from 'lucide-react';
import { checkGameNotificationPermission, requestGameNotificationPermission, syncGameReminders } from '../utils/gameNotifications';
import { ConfirmationModal } from './ConfirmationModal';
import { DatePicker } from './DatePicker';
import { TimePicker } from './TimePicker';
import teamIcon from '../assets/TeamIcon.png';
import { TeamLogoImage } from './TeamLogoImage';
import './UpcomingGames.css';
import { recordDiagnosticError } from '../utils/errorDiagnostics';
import { readSQLiteUpcomingGames, saveSQLiteUpcomingGames } from '../storage/sqliteRepository';

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
  fieldId?: string;
  field?: string;
  notes?: string;
  reminderMinutes?: number;
  reminderOptOut?: boolean;
}

const isScheduledGame = (value: unknown): value is ScheduledGame => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const game = value as any;
  const optionalStrings = ['playerTeamId', 'playerTeamName', 'gameType', 'ageGroup', 'time', 'venue', 'fieldId', 'field', 'notes'];
  return typeof game.id === 'string' && game.id.length > 0 &&
    typeof game.opponent === 'string' && typeof game.date === 'string' && game.date.length > 0 &&
    (game.isHome === undefined || typeof game.isHome === 'boolean') &&
    (game.reminderMinutes === undefined || typeof game.reminderMinutes === 'number') &&
    (game.reminderOptOut === undefined || typeof game.reminderOptOut === 'boolean') &&
    optionalStrings.every((key) => game[key] === undefined || typeof game[key] === 'string');
};

const inputClass = 'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#18212D] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00BFA5] dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA] dark:focus:ring-[#00D7BC]';

export const UpcomingGames: React.FC<{ compact?: boolean; nextOnly?: boolean }> = ({ compact = false, nextOnly = false }) => {
  const { activeProfile, allTournaments, settings, isLoading, restoreFailed, oppositionTeams } = useGame();
  
  const playerTeams = useMemo(() => {
    const savedTeams = activeProfile.teams || [];
    if (savedTeams.length) return savedTeams;
    return activeProfile.teamName ? [{ id: 'primary-team', name: activeProfile.teamName, isDefault: true, logo: undefined, tournament: undefined, ageGroup: undefined }] : [];
  }, [activeProfile.teams, activeProfile.teamName]);

  const defaultPlayerTeam = useMemo(() => {
    return playerTeams.find((team: any) => team.isDefault) || playerTeams[0];
  }, [playerTeams]);

  const [gameType, setGameType] = useState('');

  useEffect(() => {
    if (defaultPlayerTeam) {
      setGameType(defaultPlayerTeam.tournament || allTournaments[0] || 'League');
    }
  }, [defaultPlayerTeam, allTournaments]);
  
  const gameTypes = useMemo(() => Array.from(new Set([...(allTournaments || []), ...playerTeams.map((team: any) => team.tournament).filter((value): value is string => Boolean(value?.trim()))])), [allTournaments, playerTeams]);
  const teamsForGameType = useMemo(() => playerTeams.filter((team: any) => (team.tournament || 'League').trim().toLocaleLowerCase() === gameType.trim().toLocaleLowerCase()), [playerTeams, gameType]);
  const [games, setGames] = useState<ScheduledGame[]>([]);
  const teams = oppositionTeams;
  const [failureAlert, setFailureAlert] = useState<string | null>(null);
  const [storedListsInvalid, setStoredListsInvalid] = useState(false);
  const [gamesLoaded, setGamesLoaded] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    const loadGames = () => {
      void readSQLiteUpcomingGames().then((saved) => {
        if (cancelled) return;
        setGames(saved as any);
        setStoredListsInvalid(false);
        setGamesLoaded(true);
      }).catch((error: unknown) => {
        if (cancelled) return;
        recordDiagnosticError('storage_read', error, 'Scheduled games could not be read from SQLite. No scheduled-game changes were enabled.');
        setStoredListsInvalid(true);
        setFailureAlert('Dugout Pulse could not load scheduled games from the device database. No saved data was changed. Review the diagnostic report before trying again.');
        setGamesLoaded(false);
      });
    };
    loadGames();
    window.addEventListener('dugout-pulse-upcoming-games-changed', loadGames);
    return () => {
      cancelled = true;
      window.removeEventListener('dugout-pulse-upcoming-games-changed', loadGames);
    };
  }, [isLoading]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [opponent, setOpponent] = useState('');
  const [playerTeamId, setPlayerTeamId] = useState('');

  useEffect(() => {
    if (defaultPlayerTeam) {
      const match = playerTeams.find((team: any) => (team.tournament || 'League').trim().toLocaleLowerCase() === gameType.trim().toLocaleLowerCase());
      setPlayerTeamId(match ? match.id : defaultPlayerTeam.id || '');
    }
  }, [defaultPlayerTeam, playerTeams, gameType]);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [venue, setVenue] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState(0);
  const [message, setMessage] = useState('');
  const [permissionPromptGame, setPermissionPromptGame] = useState<ScheduledGame | null>(null);
  const [permissionPromptError, setPermissionPromptError] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    if (!nextOnly) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [nextOnly]);

  useEffect(() => {
    const handleVenueRenamed = (event: Event) => {
      if (storedListsInvalid) {
        setFailureAlert('Dugout Pulse has paused scheduled-game changes because a saved list could not be validated. Restore or review the stored data before trying again.');
        return;
      }
      const detail = (event as CustomEvent<{ oldName: string; newName: string }>).detail;
      if (!detail?.oldName || !detail?.newName) return;
      if (restoreFailed) {
        setMessage('');
        setFailureAlert('Dugout Pulse has paused saved-data changes because storage recovery is required. Review the recovery points and diagnostic report before trying again.');
        return;
      }
      const next = games.map((game) =>
        game.venue?.trim().toLocaleLowerCase() === detail.oldName.trim().toLocaleLowerCase()
          ? { ...game, venue: detail.newName }
          : game
      );
      void (async () => {
        try {
          await saveSQLiteUpcomingGames(next as any);
          setGames(next);
          setVenue((current) =>
            current.trim().toLocaleLowerCase() === detail.oldName.trim().toLocaleLowerCase()
              ? detail.newName
              : current
          );
        } catch (error) {
          recordDiagnosticError('storage_write', error, 'Scheduled games could not be saved after a venue rename.');
          setFailureAlert('The venue was renamed, but scheduled games could not be saved. Review the diagnostic report before trying again.');
        }
      })();
    };
    window.addEventListener('dugout-pulse-venue-renamed', handleVenueRenamed);
    return () => window.removeEventListener('dugout-pulse-venue-renamed', handleVenueRenamed);
  }, [games, restoreFailed, storedListsInvalid]);

  useEffect(() => {
    if (isLoading || restoreFailed || storedListsInvalid || !gamesLoaded) return;
    void syncGameReminders(games, settings.gameRemindersEnabled === true).catch((error: unknown) => {
      recordDiagnosticError('native_failure', error, 'Game reminder synchronization failed after the scheduled-game list changed.');
      setFailureAlert('Dugout Pulse could not update game reminders. Your scheduled-game list remains saved; review notification settings and the diagnostic report.');
    });
  }, [games, settings.gameRemindersEnabled, isLoading, restoreFailed, storedListsInvalid, gamesLoaded]);

  const sortedGames = useMemo(
    () => [...games].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')),
    [games],
  );
  const logos = useMemo(() => new Map(teams.map((team) => [team.name.trim().toLocaleLowerCase(), team.logo])), [teams]);

  const persist = (next: ScheduledGame[]) => {
    if (storedListsInvalid) {
      setMessage('');
      setFailureAlert('Dugout Pulse has paused scheduled-game changes because a saved list could not be validated. Restore or review the stored data before trying again.');
      return;
    }
    if (restoreFailed) {
      setMessage('');
      setFailureAlert('Dugout Pulse has paused saved-data changes because storage recovery is required. Review the recovery points and diagnostic report before trying again.');
      return;
    }
    void (async () => {
      try {
        await saveSQLiteUpcomingGames(next as any);
        setGames(next);
        setMessage('');
      } catch (error) {
        recordDiagnosticError('storage_write', error, 'A scheduled-game write failed. The app did not confirm that the change was saved.');
        setFailureAlert('Dugout Pulse could not save this game on the device. Do not assume the change was saved; review the diagnostic report before retrying.');
      }
    })();
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
        setPermissionPromptError(null);
        setPermissionPromptGame(game);
        return;
      }
      const granted = await requestGameNotificationPermission();
      if (!granted) {
        setPermissionPromptError(null);
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
  };

  const resetForm = () => {
    setEditingId(null);
    setOpponent('');
    const nextType = defaultPlayerTeam?.tournament || allTournaments[0] || 'League';
    setGameType(nextType);
    setPlayerTeamId(playerTeams.find((team: any) => (team.tournament || 'League').trim().toLocaleLowerCase() === nextType.trim().toLocaleLowerCase())?.id || '');
    setDate('');
    setTime('');
    setIsHome(true);
    setVenue('');
    setFieldId('');
    setNotes('');
    setReminderMinutes(0);
    setShowForm(false);
  };

  const startEdit = (game: ScheduledGame) => {
    setEditingId(game.id);
    setOpponent(game.opponent);
    const existingTeam = playerTeams.find((team: any) => team.id === game.playerTeamId) || playerTeams.find((team: any) => team.name === game.playerTeamName);
    const nextType = game.gameType || existingTeam?.tournament || defaultPlayerTeam?.tournament || allTournaments[0] || 'League';
    setGameType(nextType);
    setPlayerTeamId((existingTeam && (existingTeam.tournament || 'League').trim().toLocaleLowerCase() === nextType.trim().toLocaleLowerCase() ? existingTeam.id : undefined) || playerTeams.find((team: any) => (team.tournament || 'League').trim().toLocaleLowerCase() === nextType.trim().toLocaleLowerCase())?.id || '');
    setDate(game.date);
    setTime(game.time || '');
    setIsHome(game.isHome);
    setVenue(game.venue || '');
    const venueFields = (settings.fields || []).filter((field) => field.venue.trim().toLocaleLowerCase() === (game.venue || '').trim().toLocaleLowerCase());
    setFieldId(game.fieldId && venueFields.some((field) => field.id === game.fieldId)
      ? game.fieldId
      : venueFields.find((field) => field.name === game.field)?.id || '');
    setNotes(game.notes || '');
    setReminderMinutes(game.reminderMinutes || 0);
    setShowForm(true);
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const selectedPlayerTeam = teamsForGameType.find((team: any) => team.id === playerTeamId);
    if (!opponent.trim() || !date || !gameType || !selectedPlayerTeam) return;
    const nextGame: ScheduledGame = {
      id: editingId || ('scheduled_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
      opponent: opponent.trim(),
      ...(selectedPlayerTeam ? { playerTeamId: selectedPlayerTeam.id, playerTeamName: selectedPlayerTeam.name } : {}),
      gameType,
      ...(selectedPlayerTeam.ageGroup ? { ageGroup: selectedPlayerTeam.ageGroup } : {}),
      date,
      ...(time ? { time } : {}),
      isHome,
      ...(venue.trim() ? { venue: venue.trim() } : {}),
      ...((settings.fields || []).some((item) => item.id === fieldId && item.venue.trim().toLocaleLowerCase() === venue.trim().toLocaleLowerCase())
        ? { fieldId, field: (settings.fields || []).find((item) => item.id === fieldId)!.name }
        : {}),
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
    const gameDate = new Date(game.date + 'T00:00:00');
    if (Number.isNaN(gameDate.getTime()) || gameDate < today) return false;
    if (!game.time) return true;
    const gameDateTime = new Date(game.date + 'T' + game.time + ':00');
    return !Number.isNaN(gameDateTime.getTime()) && gameDateTime.getTime() >= clockNow;
  });
  const displayedGames = nextOnly ? upcoming.slice(0, 1) : upcoming;

  const formatCountdown = (game: ScheduledGame) => {
    if (!game.time) {
      const targetDay = new Date(game.date + 'T00:00:00');
      const todayDay = new Date();
      todayDay.setHours(0, 0, 0, 0);
      const days = Math.round((targetDay.getTime() - todayDay.getTime()) / 86400000);
      return days <= 0 ? 'Today · time not set' : days === 1 ? 'Tomorrow · time not set' : 'In ' + days + ' days · time not set';
    }
    const target = new Date(game.date + 'T' + game.time + ':00').getTime();
    const remaining = target - clockNow;
    if (remaining <= 0) return 'Game time reached';
    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return (days > 0 ? days + 'd ' : '') + hours + 'h ' + minutes + 'm ' + seconds + 's';
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
      variant="danger"
      onCancel={() => setFailureAlert(null)}
      onConfirm={() => setFailureAlert(null)}
    />
    <ConfirmationModal
      isOpen={Boolean(permissionPromptGame)}
      title="Allow game notifications"
      message={permissionPromptError || "Dugout Pulse needs Android notification permission to send this game reminder. Tap Try Again to show the permission request. If Android no longer shows the request, open your phone's Settings → Apps → Dugout Pulse → Notifications and allow notifications, then return here."}
      confirmLabel="Try Again"
      cancelLabel="Not Now"
      onCancel={() => { setPermissionPromptGame(null); setPermissionPromptError(null); }}
      onConfirm={async () => {
        const target = permissionPromptGame;
        setPermissionPromptError(null);
        const granted = await requestGameNotificationPermission();
        if (!granted) {
          setPermissionPromptError('Notifications are still blocked. Allow them in Android Settings, then tap Try Again.');
          return;
        }
        setPermissionPromptGame(null);
        setPermissionPromptError(null);
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
            <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">{nextOnly ? (upcoming.length ? 'Next scheduled game' : 'No games scheduled') : upcoming.length + ' scheduled ' + (upcoming.length === 1 ? 'game' : 'games')}</p>
          </div>
        </div>
        <button type="button" onClick={() => { if (showForm) resetForm(); else { setEditingId(null); setOpponent(''); const nextType = defaultPlayerTeam?.tournament || allTournaments[0] || 'League'; setGameType(nextType); setPlayerTeamId(playerTeams.find((team: any) => (team.tournament || 'League').trim().toLocaleLowerCase() === nextType.trim().toLocaleLowerCase())?.id || ''); setDate(''); setTime(''); setIsHome(true); setVenue(''); setFieldId(''); setNotes(''); setReminderMinutes(0); setShowForm(true); } }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#00BFA5] px-3 py-2 text-xs font-semibold text-[#18212D] transition-colors hover:bg-[#00A892] dark:bg-[#00D7BC] dark:text-[#101419] dark:hover:bg-[#00C4AB]">
          {showForm ? 'Cancel' : 'Add Game'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="space-y-3 border-b border-slate-200 bg-slate-50 p-4 dark:border-[#354050] dark:bg-[#1A2028]/70">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Type *
              <ThemedDropdown<string> value={gameType || undefined} onChange={(next) => { const nextType = next || ''; setGameType(nextType); const nextTeam = playerTeams.find((team: any) => (team.tournament || '').trim().toLocaleLowerCase() === nextType.trim().toLocaleLowerCase()); setPlayerTeamId(nextTeam?.id || ''); }} options={gameTypes.map((type) => ({ value: type, label: type }))} placeholder="Select game type" allowClear={false} ariaLabel="Game type" className="mt-1 w-full" buttonClassName="!rounded-lg !py-2 !text-xs !font-normal" />
            </label>
            <label className="block min-w-0 text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">{"Player's Team *"}
              <ThemedDropdown<string> value={playerTeamId || undefined} onChange={(next) => setPlayerTeamId(next || '')} options={teamsForGameType.map((team: any) => ({ value: team.id, label: team.name, logo: team.logo }))} placeholder="Select player's team" allowClear={false} ariaLabel="Player's team for this game" className="mt-1 w-full" buttonClassName="!rounded-lg !py-2 !text-xs !font-normal" />
            </label>
            <label className="block min-w-0 text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Opposition Team *
              <ThemedDropdown<string> value={opponent || undefined} onChange={(next) => setOpponent(next || '')} options={teams.map((team) => ({ value: team.name, label: team.name, logo: team.logo || teamIcon }))} placeholder="Select opposition team" allowClear={false} ariaLabel="Opposition team" className="mt-1 w-full" buttonClassName="!rounded-lg !py-2 !text-xs !font-normal" />
              <input required value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Or type opposition team" className={inputClass + ' mt-1'} />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Game Date *
              <DatePicker value={date} onChange={setDate} ariaLabel="Game date" placeholder="Select game date" className={inputClass + ' mt-1'} />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Start Time
              <TimePicker value={time} onChange={setTime} ariaLabel="Start time" placeholder="Select start time" allowClear className={inputClass + ' mt-1'} />
            </label>
            <label className="block min-w-0 text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Venue
              <ThemedDropdown<string>
                value={venue && (settings.venues || []).some((savedVenue: string) => savedVenue.trim().toLocaleLowerCase() === venue.trim().toLocaleLowerCase()) ? (settings.venues || []).find((savedVenue: string) => savedVenue.trim().toLocaleLowerCase() === venue.trim().toLocaleLowerCase()) : undefined}
                onChange={(next) => {
                  const nextVenue = next || '';
                  setVenue(nextVenue);
                  if (nextVenue.trim().toLocaleLowerCase() !== venue.trim().toLocaleLowerCase()) setFieldId('');
                }}
                options={(settings.venues || []).map((savedVenue: string) => ({ value: savedVenue, label: savedVenue }))}
                placeholder={(settings.venues || []).length ? 'Select saved venue' : 'No saved venues yet'}
                allowClear={true}
                ariaLabel="Venue"
                className="mt-1 w-full"
                buttonClassName="!rounded-lg !py-2 !text-xs !font-normal"
              />
              <input
                value={venue}
                onChange={(e) => {
                  const nextVenue = e.target.value;
                  setVenue(nextVenue);
                  if (nextVenue.trim().toLocaleLowerCase() !== venue.trim().toLocaleLowerCase()) setFieldId('');
                }}
                placeholder="Or type a venue / field"
                aria-label="Or type a venue / field"
                className={inputClass + ' mt-1'}
              />
              {!(settings.venues || []).length && <span className="mt-1 block text-[10px] font-normal text-slate-500 dark:text-[#9CA3AF]">Add saved venues in Settings → Venues to select them here.</span>}
            </label>
            <label className="block min-w-0 text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Field (optional)
              <ThemedDropdown<string>
                value={fieldId && (settings.fields || []).some((item: any) => item.id === fieldId && item.venue.trim().toLocaleLowerCase() === venue.trim().toLocaleLowerCase()) ? fieldId : undefined}
                onChange={(next) => setFieldId(next || '')}
                options={(settings.fields || [])
                  .filter((item: any) => item.venue.trim().toLocaleLowerCase() === venue.trim().toLocaleLowerCase() && (settings.venues || []).some((savedVenue: string) => savedVenue.trim().toLocaleLowerCase() === venue.trim().toLocaleLowerCase()))
                  .map((item: any) => ({ value: item.id, label: item.name }))}
                placeholder={venue.trim() && (settings.venues || []).some((savedVenue: string) => savedVenue.trim().toLocaleLowerCase() === venue.trim().toLocaleLowerCase())
                  ? ((settings.fields || []).some((item: any) => item.venue.trim().toLocaleLowerCase() === venue.trim().toLocaleLowerCase()) ? 'Select field (optional)' : 'No fields linked to this venue')
                  : 'Select a saved venue first'}
                allowClear={true}
                ariaLabel="Field (optional)"
                disabled={!venue.trim() || !(settings.venues || []).some((savedVenue: string) => savedVenue.trim().toLocaleLowerCase() === venue.trim().toLocaleLowerCase()) || !(settings.fields || []).some((item: any) => item.venue.trim().toLocaleLowerCase() === venue.trim().toLocaleLowerCase())}
                className="mt-1 w-full"
                buttonClassName="!rounded-lg !py-2 !text-xs !font-normal"
              />
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
            <button type="button" onClick={() => setIsHome(true)} className={'rounded-lg border px-3 py-1.5 text-xs font-semibold ' + (isHome ? 'border-[#00BFA5] bg-[#E6FBF8] text-[#006B5D] dark:border-[#00D7BC] dark:bg-[#00D7BC]/10 dark:text-[#00D7BC]' : 'border-slate-200 text-slate-500 dark:border-[#354050] dark:text-[#9CA3AF]')}>Home</button>
            <button type="button" onClick={() => setIsHome(false)} className={'rounded-lg border px-3 py-1.5 text-xs font-semibold ' + (!isHome ? 'border-[#00BFA5] bg-[#E6FBF8] text-[#006B5D] dark:border-[#00D7BC] dark:bg-[#00D7BC]/10 dark:text-[#00D7BC]' : 'border-slate-200 text-slate-500 dark:border-[#354050] dark:text-[#9CA3AF]')}>Away</button>
          </div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">Notes (optional)
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember about this fixture" className={inputClass + ' mt-1'} />
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
          <div className="space-y-3">
            {displayedGames.map((game) => {
              const logo = logos.get(game.opponent.trim().toLocaleLowerCase());
              const playerTeam = playerTeams.find((team: any) => team.id === game.playerTeamId) || playerTeams.find((team: any) => team.name === game.playerTeamName) || (!game.playerTeamName ? defaultPlayerTeam : undefined) as any;
              const playerTeamName = game.playerTeamName || playerTeam?.name || 'Player team';
              const fieldName = game.fieldId
                ? (settings.fields || []).find((item: any) => item.id === game.fieldId && item.venue.trim().toLocaleLowerCase() === (game.venue || '').trim().toLocaleLowerCase())?.name
                : game.field;
              const gameDate = new Date(game.date + 'T00:00:00');
              const dateLabel = gameDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
              const dateTimeLabel = dateLabel + (game.time ? ' @ ' + game.time : '');
              
              const leftSide = { name: playerTeamName, logo: playerTeam?.logo, label: game.isHome ? 'HOME' : 'AWAY' };
              const rightSide = { name: game.opponent, logo, label: game.isHome ? 'AWAY' : 'HOME' };
              
              const reminderEnabled = settings.gameRemindersEnabled === true ? !game.reminderOptOut : Boolean(game.reminderMinutes);
              const matchContext = playerTeamName + ((playerTeam?.ageGroup || game.ageGroup) ? ' - ' + (playerTeam?.ageGroup || game.ageGroup) : '');
              
              return (
                <article key={game.id} className="upcoming-match-card">
                  <header className="upcoming-match-card__header">
                    <p className="upcoming-match-card__context" title={matchContext}>
                      <span>{matchContext}</span>
                    </p>
                    <div className="upcoming-match-card__actions">
                      <button type="button" onClick={() => startEdit(game)} aria-label={'Edit game against ' + game.opponent} title="Edit upcoming game" className="upcoming-match-card__action"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => persist(games.filter((item) => item.id !== game.id))} aria-label={'Delete game against ' + game.opponent} title="Delete upcoming game" className="upcoming-match-card__action upcoming-match-card__action--delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </header>

                  <div className="upcoming-match-card__body">
                    <div className="upcoming-match-card__versus">
                      <div className="upcoming-match-card__team">
                        <div className="upcoming-match-card__logo">
                          <TeamLogoImage value={leftSide.logo} alt={leftSide.name + ' logo'} />
                        </div>
                        <p className="upcoming-match-card__team-name">{leftSide.name}</p>
                        <span className="upcoming-match-card__side-label">{leftSide.label}</span>
                      </div>

                      <div className="upcoming-match-card__vs-badge" aria-label="versus">vs</div>

                      <div className="upcoming-match-card__team">
                        <div className="upcoming-match-card__logo">
                          <TeamLogoImage value={rightSide.logo} alt={rightSide.name + ' logo'} />
                        </div>
                        <p className="upcoming-match-card__team-name">{rightSide.name}</p>
                        <span className="upcoming-match-card__side-label">{rightSide.label}</span>
                      </div>
                    </div>

                    <div className="upcoming-match-card__details">
                      <div className="upcoming-match-card__detail">
                        <CalendarDays className="upcoming-match-card__detail-icon" aria-hidden="true" />
                        <span className="upcoming-match-card__detail-text">{dateTimeLabel}</span>
                      </div>
                      {(game.venue || fieldName) && <div className="upcoming-match-card__detail">
                        <MapPin className="upcoming-match-card__detail-icon" aria-hidden="true" />
                        <span className="upcoming-match-card__detail-text">{game.venue || ''}{game.venue && fieldName ? ' · ' + fieldName : fieldName ? fieldName : ''}</span>
                      </div>}
                      {game.gameType && <div className="upcoming-match-card__detail">
                        <Trophy className="upcoming-match-card__detail-icon" aria-hidden="true" />
                        <span className="upcoming-match-card__detail-text">{game.gameType}</span>
                      </div>}
                    </div>

                    {nextOnly && (
                      <div className="upcoming-match-card__countdown">
                        <span className="upcoming-match-card__countdown-time" aria-live="off">{formatCountdown(game)}</span>
                        <button
                          type="button"
                          onClick={() => toggleGameReminder(game)}
                          disabled={!game.time}
                          aria-label={!game.time ? 'Add a start time to enable a reminder for ' + game.opponent : reminderEnabled ? 'Turn off reminder for ' + game.opponent : 'Set a reminder for ' + game.opponent}
                          title={!game.time ? 'Add a start time to enable a reminder' : reminderEnabled ? 'Reminder on — click to turn off' : 'Remind me 1 hour before'}
                          className={'upcoming-match-card__reminder-action ' + (reminderEnabled ? 'upcoming-match-card__reminder-action--active' : '')}
                        >
                          {reminderEnabled ? <Bell className="h-4 w-4" aria-hidden="true" /> : <BellOff className="h-4 w-4" aria-hidden="true" />}
                        </button>
                      </div>
                    )}
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
