import React, { useMemo, useState } from 'react';
import { PlayCircle, Upload, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { ThemedDropdown } from './ThemedDropdown';
import { ConfirmationModal } from './ConfirmationModal';
import { recordDiagnosticError } from '../utils/errorDiagnostics';
import { reportFailure } from '../utils/userMessages';

const SCHEDULED_GAMES_KEY = 'dugoutPulse.upcomingGames.v1';

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
}

interface StartGamePickerProps {
  gameDate: string;
  onClose: () => void;
  onLoadManually: () => void;
  onGameSelected: () => void;
}

export const StartGamePicker: React.FC<StartGamePickerProps> = ({
  gameDate,
  onClose,
  onLoadManually,
  onGameSelected,
}) => {
  const { games, activeProfile, liveGame, reopenSavedGame, startLiveGame } = useGame();
  const [selectedGameId, setSelectedGameId] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');
  const [loadFailureAlert, setLoadFailureAlert] = useState<string | null>(null);
  const [scheduledGamesLoad] = useState<{ games: ScheduledGame[]; error: string }>(() => {
    try {
      const stored = localStorage.getItem(SCHEDULED_GAMES_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed) || !parsed.every((item) =>
        !!item && typeof item === 'object' &&
        typeof (item as ScheduledGame).id === 'string' &&
        typeof (item as ScheduledGame).opponent === 'string' &&
        typeof (item as ScheduledGame).date === 'string' &&
        typeof (item as ScheduledGame).isHome === 'boolean'
      )) {
        throw new Error('Scheduled-game storage did not contain a valid list of games.');
      }
      return { games: parsed as ScheduledGame[], error: '' };
    } catch (loadError) {
      recordDiagnosticError(
        loadError instanceof SyntaxError ? 'data_corruption' : 'storage_read',
        loadError,
        'The saved scheduled-game list could not be read. No saved values were changed.',
      );
      return {
        games: [],
        error: "Dugout Pulse couldn't read the saved scheduled-game list. No saved data was intentionally changed. Review the diagnostic report before attempting recovery.",
      };
    }
  });
  const scheduledGames = scheduledGamesLoad.games;
  const [scheduledGamesAlertOpen, setScheduledGamesAlertOpen] = useState(Boolean(scheduledGamesLoad.error));

  const matchingGames = useMemo(
    () => games
      .filter((game) => game.date === gameDate && (!game.playerId || game.playerId === activeProfile.id))
      .sort((a, b) => (a.time || '').localeCompare(b.time || '') || (a.opponent || '').localeCompare(b.opponent || '')),
    [games, gameDate, activeProfile.id],
  );

  const matchingScheduledGames = useMemo(() => {
    const profileTeams = activeProfile.teams || [];
    return scheduledGames
      .filter((game) => {
        if (game.date !== gameDate) return false;
        if (!game.playerTeamId && !game.playerTeamName) return true;
        return profileTeams.some((team) =>
          (game.playerTeamId && team.id === game.playerTeamId) ||
          (game.playerTeamName && team.name.trim().toLocaleLowerCase() === game.playerTeamName.trim().toLocaleLowerCase())
        ) || (!profileTeams.length && game.playerTeamName && game.playerTeamName.trim().toLocaleLowerCase() === activeProfile.teamName.trim().toLocaleLowerCase());
      })
      .sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.opponent.localeCompare(b.opponent));
  }, [scheduledGames, gameDate, activeProfile.teams, activeProfile.teamName]);

  const options = [
    ...matchingGames.map((game) => ({
      value: `saved:${game.id}`,
      label: [
        game.time,
        game.teamName || activeProfile.teamName || 'My Team',
        game.isHome === false ? '@' : 'vs',
        game.opponent || 'Opponent',
        game.tournament,
        game.finalResult ? `(${game.finalResult})` : '',
      ].filter(Boolean).join(' · '),
    })),
    ...matchingScheduledGames.map((game) => ({
      value: `scheduled:${game.id}`,
      label: [
        game.time,
        game.playerTeamName || activeProfile.teamName || 'My Team',
        game.isHome === false ? '@' : 'vs',
        game.opponent || 'Opponent',
        game.gameType,
      ].filter(Boolean).join(' · '),
    })),
  ];

  const handleLoadSelected = () => {
    if (!selectedGameId) {
      setError('Please select a game from the list first.');
      return;
    }
    if (liveGame) {
      setError('A live game is already in progress. Save or discard it before loading another game.');
      return;
    }
    if (selectedGameId.startsWith('scheduled:')) {
      const scheduledGame = matchingScheduledGames.find((game) => `scheduled:${game.id}` === selectedGameId);
      if (!scheduledGame) {
        setLoadFailureAlert('The selected scheduled game is no longer available. Close this window, refresh the game list, and select it again.');
        return;
      }
      const playerTeam = (activeProfile.teams || []).find((team) =>
        (scheduledGame.playerTeamId && team.id === scheduledGame.playerTeamId) ||
        (scheduledGame.playerTeamName && team.name.trim().toLocaleLowerCase() === scheduledGame.playerTeamName.trim().toLocaleLowerCase())
      );
      startLiveGame({
        date: scheduledGame.date,
        time: scheduledGame.time,
        opponent: scheduledGame.opponent,
        teamName: scheduledGame.playerTeamName || playerTeam?.name || activeProfile.teamName || 'My Team',
        tournament: scheduledGame.gameType || playerTeam?.tournament,
        ageGroup: scheduledGame.ageGroup || playerTeam?.ageGroup,
        season: playerTeam?.season,
        isHome: scheduledGame.isHome,
      });
      onClose();
      onGameSelected();
      return;
    }

    const savedGameId = selectedGameId.startsWith('saved:') ? selectedGameId.slice('saved:'.length) : selectedGameId;
    if (reopenSavedGame(savedGameId)) {
      onClose();
      onGameSelected();
    } else {
      setLoadFailureAlert(reportFailure(
        'storage_load',
        new Error('The selected saved game could not be reopened.'),
        'Dugout Pulse could not load the selected saved game.',
      ));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="start-game-picker-title">
      <div className="w-full max-w-lg overflow-visible rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#354050] dark:bg-[#1A2028] sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[#007A6A] dark:text-[#00D7BC]">
              <PlayCircle className="h-5 w-5" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Start Game</span>
            </div>
            <h2 id="start-game-picker-title" className="text-xl font-semibold text-slate-900 dark:text-[#FAFAFA]">Choose a game</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-[#9CA3AF]">Games Scheduled for {new Date(`${gameDate}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {options.length > 0 ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-[#D1D5DB]">Available games</label>
              <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-800 dark:bg-[#00D7BC]/10 dark:text-[#00D7BC]">{options.length} found</span>
            </div>
            <ThemedDropdown<string>
              ariaLabel="Select a saved game"
              value={selectedGameId}
              placeholder="Choose a game…"
              allowClear={false}
              onChange={(value) => { setSelectedGameId(value); setError(''); }}
              options={options}
              className="w-full"
              menuClassName="max-h-64"
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-[#9CA3AF]">Saved and scheduled games for this date are listed separately. Nothing is loaded until you select a game and confirm.</p>
            {error && <p role="alert" className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
            <button type="button" onClick={handleLoadSelected} disabled={!selectedGameId || Boolean(liveGame)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00BFA5] px-4 py-3 text-sm font-semibold text-[#18212D] transition-colors hover:bg-[#00A892] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#00D7BC] dark:hover:bg-[#00C4AB]">
              <PlayCircle className="h-4 w-4" /> Load Selected Game
            </button>
            {liveGame && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">A live game is already in progress. Save or discard it before loading another game.</p>}
            <button type="button" onClick={onLoadManually} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">
              Load Game Manually
            </button>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-[#354050] dark:bg-[#252D38]">
            <p className="text-sm font-semibold text-slate-800 dark:text-[#FAFAFA]">No games loaded</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#9CA3AF]">You can continue with the existing manual game setup.</p>
            <button type="button" onClick={onLoadManually} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00BFA5] px-4 py-3 text-sm font-semibold text-[#18212D] hover:bg-[#00A892] dark:bg-[#00D7BC] dark:hover:bg-[#00C4AB]">
              <Upload className="h-4 w-4" /> Load Game Manually
            </button>
          </div>
        )}
      </div>
      <ConfirmationModal
        isOpen={scheduledGamesAlertOpen}
        title="Scheduled games could not be read"
        message={scheduledGamesLoad.error}
        confirmLabel="OK"
        showCancelButton={false}
        closeOnBackdrop={false}
        variant="warning"
        onCancel={() => setScheduledGamesAlertOpen(false)}
        onConfirm={() => setScheduledGamesAlertOpen(false)}
      />
      <ConfirmationModal
        isOpen={loadFailureAlert !== null}
        title="Could not load game"
        message={loadFailureAlert ?? ''}
        confirmLabel="OK"
        showCancelButton={false}
        closeOnBackdrop={false}
        variant="danger"
        onCancel={() => setLoadFailureAlert(null)}
        onConfirm={() => setLoadFailureAlert(null)}
      />
    </div>
  );
};
