import React, { useState, useMemo, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { Game } from '../types/baseball';
import { calculateGameStats, formatRate, sortGames, filterGames } from '../utils/stats';
import { ConfirmationModal } from './ConfirmationModal';
import { BoxScoreModal } from './BoxScoreModal';
import { ShareRecapModal } from './ShareRecapModal';
import {
  ChevronDown,
  Trash2,
  Edit,
  Eye,
  Search,
  ArrowUpDown,
  AlertCircle,
  Award,
  Filter,
  RotateCcw,
  Home,
  Plane,
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { ThemedDropdown } from './ThemedDropdown';
import { UpcomingGames } from './UpcomingGames';

interface GameHistoryRowProps {
  game: Game;
  stats: ReturnType<typeof calculateGameStats>;
  metadataFilterActive: boolean;
  onView: () => void;
  onRecap: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const GameHistoryRow: React.FC<GameHistoryRowProps> = ({
  game,
  stats,
  metadataFilterActive,
  onView,
  onRecap,
  onEdit,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const date = new Date(`${game.date}T00:00:00`);
  const shortDate = Number.isNaN(date.getTime())
    ? game.date
    : date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
  const isHomeTeam = game.isHome !== false;
  const opponent = game.opponent
    ? (isHomeTeam ? `vs ${game.opponent}` : `@ ${game.opponent}`)
    : (isHomeTeam ? 'vs Opponent' : '@ Opponent');
  const { batting, pitching } = stats;

  return (
    <article className="border-b border-slate-200 dark:border-[#354050] last:border-b-0">
      <div className="flex min-h-[52px] items-center gap-1 px-2 py-1 sm:gap-3 sm:px-3">
        <button
          type="button"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          aria-expanded={isExpanded}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <span className="shrink-0 text-[10px] font-semibold text-slate-500 dark:text-[#9CA3AF] sm:text-xs">
            {shortDate}
          </span>
          <span className="min-w-0 truncate text-[11px] font-semibold text-slate-900 dark:text-[#FAFAFA] sm:text-sm">
            {opponent}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        <div className="flex shrink-0 items-center justify-end gap-0 sm:gap-1">
          {game.finalResult && (
            <span
              title={`Final result: ${game.finalResult}`}
              className={`max-w-16 truncate rounded px-1 py-0.5 text-[8px] font-extrabold sm:max-w-none sm:text-[10px] ${
                game.finalResult.startsWith('W')
                  ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                  : game.finalResult.startsWith('L')
                  ? 'bg-slate-200 text-slate-700 dark:bg-[#252D38] dark:text-[#D1D5DB]'
                  : game.finalResult.startsWith('D')
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'bg-slate-100 text-slate-700 dark:bg-[#252D38] dark:text-[#D1D5DB]'
              }`}
            >
              {game.finalResult}
            </span>
          )}
          <button type="button" onClick={onRecap} aria-label="Share game recap" title="Share game recap" className="rounded-md p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 sm:p-2">
            <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
          <button type="button" onClick={onView} aria-label="View box score" title="View box score" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:text-[#D1D5DB] dark:hover:bg-[#252D38] sm:p-2">
            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
          <button type="button" onClick={onEdit} aria-label="Edit game" title="Edit game" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:text-[#D1D5DB] dark:hover:bg-[#252D38] sm:p-2">
            <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
          <button type="button" onClick={onDelete} aria-label="Delete game" title="Delete game" className="rounded-md p-1 text-red-500 hover:bg-red-50 dark:hover:bg-[#FF5252]/15 sm:p-2">
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-3 dark:border-[#354050] dark:bg-[#252D38]">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div><span className="text-slate-500 dark:text-[#9CA3AF]">Innings</span><strong className="ml-1.5 text-slate-900 dark:text-[#FAFAFA]">{game.innings}</strong></div>
            <div><span className="text-slate-500 dark:text-[#9CA3AF]">H-AB</span><strong className="ml-1.5 text-slate-900 dark:text-[#FAFAFA]">{batting.h}-{batting.ab}</strong></div>
            <div><span className="text-slate-500 dark:text-[#9CA3AF]">IP</span><strong className="ml-1.5 text-slate-900 dark:text-[#FAFAFA]">{pitching.ipDisplay}</strong></div>
            <div><span className="text-slate-500 dark:text-[#9CA3AF]">Pitches</span><strong className="ml-1.5 text-slate-900 dark:text-[#FAFAFA]">{pitching.pitches}</strong></div>
            <div><span className="text-slate-500 dark:text-[#9CA3AF]">AVG</span><strong className="ml-1.5 text-slate-900 dark:text-[#FAFAFA]">{formatRate(batting.avg)}</strong></div>
            <div><span className="text-slate-500 dark:text-[#9CA3AF]">Runs</span><strong className="ml-1.5 text-slate-900 dark:text-[#FAFAFA]">{batting.r}</strong></div>
            <div><span className="text-slate-500 dark:text-[#9CA3AF]">RBI</span><strong className="ml-1.5 text-slate-900 dark:text-[#FAFAFA]">{batting.rbi}</strong></div>
            <div><span className="text-slate-500 dark:text-[#9CA3AF]">Plays</span><strong className="ml-1.5 text-slate-900 dark:text-[#FAFAFA]">{game.plays?.length || 0}</strong></div>
          </div>

          {(metadataFilterActive || game.teamName || game.season || game.ageGroup || game.isHome !== undefined || game.lineupSpot) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {game.lineupSpot && (
                <span className="rounded bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                  Batting #{game.lineupSpot} Spot
                </span>
              )}
              {game.isHome !== undefined && (
                <span className={`rounded px-2 py-1 text-[10px] font-semibold inline-flex items-center gap-1 ${
                  isHomeTeam
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'bg-teal-100 text-teal-800 dark:bg-[#00D7BC]/15 dark:text-[#00D7BC]'
                }`}>
                  {isHomeTeam ? <><Home className="w-3 h-3" /> Home Team (vs)</> : <><Plane className="w-3 h-3" /> Away / Visitor (@)</>}
                </span>
              )}
              {game.teamName && <span className="rounded bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:bg-[#252D38] dark:text-[#D1D5DB]">{game.teamName}</span>}
              {game.season && <span className="rounded bg-teal-100 px-2 py-1 text-[10px] font-semibold text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">{game.season}</span>}
              {game.ageGroup && <span className="rounded bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">{game.ageGroup}</span>}
              {game.tournament && <span className="rounded bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">{game.tournament}</span>}
            </div>
          )}
        </div>
      )}
    </article>
  );
};

interface GamesTabProps {
  onNavigateToScore: () => void;
}

export const GamesTab: React.FC<GamesTabProps> = ({ onNavigateToScore }) => {
  const {
    games,
    liveGame,
    editingGameId,
    startEditingSavedGame,
    reopenSavedGame,
    deleteSavedGame,
    activeProfile,
    settings,
  } = useGame();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newestFirst' | 'oldestFirst'>('newestFirst');
  const [filterTeam, setFilterTeam] = useState<string>('ALL');
  const [filterSeason, setFilterSeason] = useState<string>('ALL');
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>('ALL');
  const [filterTournament, setFilterTournament] = useState<string>('ALL');
  const [visibleGameCount, setVisibleGameCount] = useState(10);

  const [gameToDelete, setGameToDelete] = useState<string | null>(null);
  const [gameForBoxScore, setGameForBoxScore] = useState<Game | null>(null);
  const [gameForRecapCard, setGameForRecapCard] = useState<Game | null>(null);
  const [editBlockedMessage, setEditBlockedMessage] = useState<string | null>(null);

  // Distinct filter options
  const availableTeams = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => { if (g.teamName) set.add(g.teamName); });
    return Array.from(set).sort();
  }, [games]);

  const availableSeasons = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => { if (g.season) set.add(g.season); });
    return Array.from(set).sort();
  }, [games]);

  const availableAgeGroups = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => { if (g.ageGroup) set.add(g.ageGroup); });
    return Array.from(set).sort();
  }, [games]);

  const availableTournaments = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => { if (g.tournament) set.add(g.tournament); });
    return Array.from(set).sort();
  }, [games]);

  const isFilterActive =
    filterTeam !== 'ALL' ||
    filterSeason !== 'ALL' ||
    filterAgeGroup !== 'ALL' ||
    filterTournament !== 'ALL';

  const handleResetFilters = () => {
    setFilterTeam('ALL');
    setFilterSeason('ALL');
    setFilterAgeGroup('ALL');
    setFilterTournament('ALL');
    setSearchQuery('');
  };

  // Filter & sort
  const filteredGames = useMemo(() => {
    const filtered = filterGames(games, {
      teamName: filterTeam,
      season: filterSeason,
      ageGroup: filterAgeGroup,
      tournament: filterTournament,
      searchQuery: searchQuery.trim(),
    });
    return sortGames(filtered, sortOrder);
  }, [games, filterTeam, filterSeason, filterAgeGroup, filterTournament, searchQuery, sortOrder]);

  useEffect(() => {
    setVisibleGameCount(10);
  }, [filterTeam, filterSeason, filterAgeGroup, filterTournament, searchQuery, sortOrder]);

  const groupedVisibleGames = useMemo(() => {
    const groups = new Map<string, { label: string; games: Game[] }>();
    filteredGames.slice(0, visibleGameCount).forEach((game) => {
      const date = new Date(`${game.date}T00:00:00`);
      const key = Number.isNaN(date.getTime()) ? 'unknown' : game.date.slice(0, 7);
      const label = Number.isNaN(date.getTime())
        ? 'Other Dates'
        : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      if (!groups.has(key)) groups.set(key, { label, games: [] });
      groups.get(key)!.games.push(game);
    });
    return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }));
  }, [filteredGames, visibleGameCount]);

  const lastSavedGame = useMemo(() => sortGames(games, 'newestFirst')[0] ?? null, [games]);

  const handleReopenLastGame = () => {
    if (!lastSavedGame || liveGame) return;
    if (reopenSavedGame(lastSavedGame.id)) onNavigateToScore();
  };

  const handleStartEdit = (gameId: string) => {
    if (liveGame && editingGameId !== gameId) {
      setEditBlockedMessage(
        'A live game is currently in progress! Please save or discard the live game before editing a past game.'
      );
      return;
    }
    const success = startEditingSavedGame(gameId);
    if (success) {
      onNavigateToScore();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-24 px-4 sm:px-6 pt-4 max-w-4xl mx-auto w-full space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-[#252D38] rounded-2xl p-5 border border-slate-200/80 dark:border-[#354050] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#00BFA5] dark:bg-[#00D7BC]" />
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC]">
              SEASON LOG
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-[#FAFAFA] flex items-center gap-1.5">
            Game History
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] font-extrabold">
              {games.length}
            </span>
          </h1>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search opponent, team, tourney…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-xs text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              setSortOrder((prev) => (prev === 'newestFirst' ? 'oldestFirst' : 'newestFirst'))
            }
            className="p-2 rounded-xl border border-slate-200 dark:border-[#354050] text-slate-600 dark:text-[#D1D5DB] hover:bg-slate-50 dark:hover:bg-[#252D38] text-xs font-semibold flex items-center gap-1 shrink-0"
            title="Toggle sort direction"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {sortOrder === 'newestFirst' ? 'Newest' : 'Oldest'}
            </span>
          </button>
        </div>
      </div>

      <UpcomingGames />

      {lastSavedGame && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs dark:border-[#354050] dark:bg-[#252D38] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]">Re-open last game</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-[#9CA3AF]">
              {lastSavedGame.opponent ? ('vs ' + lastSavedGame.opponent) : 'Most recently saved game'} · {lastSavedGame.date}
            </p>
            <p className="mt-1 text-[10px] text-slate-500 dark:text-[#9CA3AF]">
              Continue live scoring from the saved plays. This is separate from Edit Game.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReopenLastGame}
            disabled={Boolean(liveGame)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#00BFA5] px-4 py-2.5 text-xs font-semibold text-[#18212D] transition-colors hover:bg-[#00A892] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#00D7BC] dark:text-[#101419] dark:hover:bg-[#00C4AB]"
            title={liveGame ? 'Save or discard the current live game first' : 'Continue scoring the most recently saved game'}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {liveGame ? 'Live Game in Progress' : 'Re-open to Score'}
          </button>
        </div>
      )}

      {/* Filter Bar (Team, Season, Age Group, Tournament) */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 bg-white/95 px-4 py-3.5 shadow-xs backdrop-blur-md dark:bg-[#101419]/95 sm:px-6 sm:py-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#007A6A] dark:text-[#00D7BC]" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-[#D1D5DB]">
              Filter Games
            </span>
            {isFilterActive && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-[#00D7BC]/15 text-[#007A6A] dark:text-[#00D7BC]">
                {filteredGames.length} of {games.length}
              </span>
            )}
          </div>
          {isFilterActive && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-[#D1D5DB] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ThemedDropdown<string>
            ariaLabel="Filter games by team"
            value={filterTeam}
            placeholder="All Teams"
            allowClear={false}
            onChange={(next) => next && setFilterTeam(next)}
            options={[
              { value: 'ALL', label: `All Teams (${availableTeams.length || 1})` },
              ...availableTeams.map((team) => ({ value: team, label: team })),
            ]}
            className="w-full"
          />

          <ThemedDropdown<string>
            ariaLabel="Filter games by season"
            value={filterSeason}
            placeholder="All Seasons"
            allowClear={false}
            onChange={(next) => next && setFilterSeason(next)}
            options={[
              { value: 'ALL', label: 'All Seasons' },
              ...availableSeasons.map((season) => ({ value: season, label: season })),
            ]}
            className="w-full"
          />

          <ThemedDropdown<string>
            ariaLabel="Filter games by age group"
            value={filterAgeGroup}
            placeholder="All Age Groups"
            allowClear={false}
            onChange={(next) => next && setFilterAgeGroup(next)}
            options={[
              { value: 'ALL', label: 'All Age Groups' },
              ...availableAgeGroups.map((ageGroup) => ({ value: ageGroup, label: ageGroup })),
            ]}
            className="w-full"
          />

          <ThemedDropdown<string>
            ariaLabel="Filter games by tournament"
            value={filterTournament}
            placeholder="All Games"
            allowClear={false}
            onChange={(next) => next && setFilterTournament(next)}
            options={[
              { value: 'ALL', label: 'All Games' },
              ...availableTournaments.map((tournament) => ({ value: tournament, label: tournament })),
            ]}
            className="w-full"
          />
        </div>
      </div>

      {/* Blocked Edit Alert Modal */}
      {editBlockedMessage && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-blue-900 dark:text-blue-200">
            <strong className="font-semibold block mb-1">Cannot Edit Past Game Right Now</strong>
            {editBlockedMessage}
          </div>
          <button
            onClick={() => setEditBlockedMessage(null)}
            className="text-xs font-semibold text-blue-800 dark:text-blue-300 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Games List */}
      {filteredGames.length === 0 ? (
        <div className="bg-white dark:bg-[#252D38] rounded-2xl p-8 border border-slate-200/80 dark:border-[#354050] text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-[#252D38] mx-auto flex items-center justify-center p-2.5 border border-slate-200 dark:border-[#354050] shadow-2xs overflow-hidden">
            <AppLogo variant="logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">
              No matching games found
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1 max-w-sm mx-auto">
              {isFilterActive
                ? 'Try clearing or changing your filters above to see more games.'
                : 'Start a live game to build your season history.'}
            </p>
          </div>
          {isFilterActive ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-5 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] font-semibold text-xs hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          ) : (
            <button
              type="button"
              onClick={onNavigateToScore}
              className="px-5 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] font-semibold text-xs hover:bg-[#00A892] dark:hover:bg-[#00C4AB] transition-colors inline-flex items-center gap-2 shadow-md"
            >
              Start First Game
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedVisibleGames.map((group) => (
            <section key={group.key}>
              <h2 className="border-b border-slate-200 bg-[#F4F6F8]/95 px-2 py-2 text-xs font-extrabold text-slate-500 dark:border-[#354050] dark:bg-[#101419] dark:text-[#D1D5DB]">
                {group.label}
              </h2>
              <div className="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-[#354050] dark:bg-[#252D38]">
                {group.games.map((game) => (
                  <GameHistoryRow
                    key={game.id}
                    game={game}
                    stats={calculateGameStats(game, settings.inningsPerGame)}
                    metadataFilterActive={filterTeam !== 'ALL' || filterSeason !== 'ALL' || filterAgeGroup !== 'ALL'}
                    onView={() => setGameForBoxScore(game)}
                    onRecap={() => setGameForRecapCard(game)}
                    onEdit={() => handleStartEdit(game.id)}
                    onDelete={() => setGameToDelete(game.id)}
                  />
                ))}
              </div>
            </section>
          ))}

          {visibleGameCount < filteredGames.length && (
            <button
              type="button"
              onClick={() => setVisibleGameCount((count) => count + 10)}
              className="w-full rounded-md border border-slate-300 bg-white py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:bg-[#252D38]"
            >
              Load More ({filteredGames.length - visibleGameCount} remaining)
            </button>
          )}
        </div>
      )}

      {/* Box Score Modal */}
      <BoxScoreModal
        game={gameForBoxScore}
        inningsPerGame={settings.inningsPerGame}
        onClose={() => setGameForBoxScore(null)}
        onShareCard={(g) => {
          setGameForBoxScore(null);
          setGameForRecapCard(g);
        }}
        onEdit={(id) => {
          setGameForBoxScore(null);
          handleStartEdit(id);
        }}
      />

      {/* Share Game Recap Modal */}
      {gameForRecapCard && (
        <ShareRecapModal
          game={gameForRecapCard}
          profile={activeProfile}
          inningsPerGame={settings.inningsPerGame}
          onClose={() => setGameForRecapCard(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(gameToDelete)}
        title="Delete Game Log?"
        message="Are you sure you want to permanently delete this game? Its plays will be removed from your season totals."
        confirmLabel="Yes, Delete Game"
        variant="danger"
        onConfirm={() => {
          if (gameToDelete) {
            deleteSavedGame(gameToDelete);
            setGameToDelete(null);
          }
        }}
        onCancel={() => setGameToDelete(null)}
      />
    </div>
  );
};