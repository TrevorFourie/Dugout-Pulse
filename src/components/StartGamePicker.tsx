import React, { useMemo, useState } from 'react';
import { Calendar, PlayCircle, Upload, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { ThemedDropdown } from './ThemedDropdown';

interface StartGamePickerProps {
  onClose: () => void;
  onLoadManually: () => void;
  onGameSelected: () => void;
}

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const StartGamePicker: React.FC<StartGamePickerProps> = ({
  onClose,
  onLoadManually,
  onGameSelected,
}) => {
  const { games, activeProfile, liveGame, reopenSavedGame } = useGame();
  const [gameDate, setGameDate] = useState(getLocalDate);
  const [selectedGameId, setSelectedGameId] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');

  const matchingGames = useMemo(
    () => games
      .filter((game) => game.date === gameDate && (!game.playerId || game.playerId === activeProfile.id))
      .sort((a, b) => (a.time || '').localeCompare(b.time || '') || (a.opponent || '').localeCompare(b.opponent || '')),
    [games, gameDate, activeProfile.id],
  );

  const options = matchingGames.map((game) => ({
    value: game.id,
    label: [
      game.time,
      game.teamName || activeProfile.teamName || 'My Team',
      game.isHome === false ? '@' : 'vs',
      game.opponent || 'Opponent',
      game.tournament,
      game.finalResult ? `(${game.finalResult})` : '',
    ].filter(Boolean).join(' · '),
  }));

  const handleDateChange = (value: string) => {
    setGameDate(value);
    setSelectedGameId(undefined);
    setError('');
  };

  const handleLoadSelected = () => {
    if (!selectedGameId) {
      setError('Please select a game from the list first.');
      return;
    }
    if (liveGame) {
      setError('A live game is already in progress. Save or discard it before loading another game.');
      return;
    }
    if (reopenSavedGame(selectedGameId)) {
      onClose();
      onGameSelected();
    } else {
      setError('This game could not be loaded. Please try again.');
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
            <p className="mt-1 text-sm text-slate-500 dark:text-[#9CA3AF]">Select the date to see all games already loaded for that day.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label htmlFor="start-game-date" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-[#D1D5DB]">Game date</label>
        <div className="relative mb-4">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input id="start-game-date" type="date" value={gameDate} onChange={(event) => handleDateChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-[#00BFA5] dark:border-[#354050] dark:bg-[#252D38] dark:text-[#FAFAFA]" />
        </div>

        {matchingGames.length > 0 ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-[#D1D5DB]">Available games</label>
              <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-800 dark:bg-[#00D7BC]/10 dark:text-[#00D7BC]">{matchingGames.length} found</span>
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
            <p className="mt-2 text-xs text-slate-500 dark:text-[#9CA3AF]">Every game on this date is listed separately. Nothing is loaded until you select a game and confirm.</p>
            {error && <p role="alert" className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
            <button type="button" onClick={handleLoadSelected} disabled={!selectedGameId || Boolean(liveGame)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00BFA5] px-4 py-3 text-sm font-semibold text-[#18212D] transition-colors hover:bg-[#00A892] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#00D7BC] dark:hover:bg-[#00C4AB]">
              <PlayCircle className="h-4 w-4" /> Load Selected Game
            </button>
            {liveGame && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">A live game is already in progress. Save or discard it before loading another game.</p>}
            <button type="button" onClick={onLoadManually} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#354050] dark:text-[#D1D5DB] dark:hover:bg-[#252D38]">
              Load a different game manually
            </button>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-[#354050] dark:bg-[#252D38]">
            <p className="text-sm font-semibold text-slate-800 dark:text-[#FAFAFA]">No games loaded for this date</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#9CA3AF]">You can continue with the existing manual game setup.</p>
            <button type="button" onClick={onLoadManually} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00BFA5] px-4 py-3 text-sm font-semibold text-[#18212D] hover:bg-[#00A892] dark:bg-[#00D7BC] dark:hover:bg-[#00C4AB]">
              <Upload className="h-4 w-4" /> Load Game Manually
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
