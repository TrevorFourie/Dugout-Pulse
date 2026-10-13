import React, { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import {
  calculateSeasonStats,
  calculateGroupedStats,
  filterGames,
  formatRate,
  formatEraWhip,
} from '../utils/stats';
import { Play as GamePlay } from '../types/baseball';
import {
  Play,
  PlayCircle,
  HelpCircle,
  Award,
  Shield,
  Activity,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Filter,
  Trophy,
  Calendar,
  Layers,
  RotateCcw,
  BarChart3,
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { SprayChart } from './SprayChart';
import { isHitPlay } from '../utils/sprayChart';

interface DashboardTabProps {
  onNavigateToScore: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  onNavigateToScore,
  onOpenHelp,
  onOpenSettings,
}) => {
  const {
    games,
    liveGame,
    activeProfile,
    settings,
    isLoading,
  } = useGame();

  const [activeStatGroup, setActiveStatGroup] = useState<'batting' | 'pitching' | 'fielding'>('batting');

  // Dashboard Filters
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL');
  const [selectedSeason, setSelectedSeason] = useState<string>('ALL');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('ALL');
  const [selectedTournament, setSelectedTournament] = useState<string>('ALL');

  // Breakdown View
  const [activeBreakdownGroup, setActiveBreakdownGroup] = useState<'tournament' | 'season' | 'ageGroup' | 'teamName'>('tournament');
  const [breakdownStatType, setBreakdownStatType] = useState<'batting' | 'pitching' | 'fielding'>('batting');

  // All games for this player
  const playerGames = useMemo(() => {
    return games.filter((g) => !g.playerId || g.playerId === activeProfile.id);
  }, [games, activeProfile.id]);

  // Filtered games based on active filters
  const filteredGames = useMemo(() => {
    return filterGames(playerGames, {
      teamName: selectedTeam,
      season: selectedSeason,
      ageGroup: selectedAgeGroup,
      tournament: selectedTournament,
    });
  }, [playerGames, selectedTeam, selectedSeason, selectedAgeGroup, selectedTournament]);

  // Distinct filter options
  const availableTeams = useMemo(() => {
    const set = new Set<string>();
    if (activeProfile.teamName) set.add(activeProfile.teamName);
    (activeProfile.teams || []).forEach((t) => {
      if (t.name) set.add(t.name);
    });
    playerGames.forEach((g) => {
      if (g.teamName) set.add(g.teamName);
    });
    return Array.from(set).sort();
  }, [activeProfile, playerGames]);

  const availableSeasons = useMemo(() => {
    const set = new Set<string>();
    playerGames.forEach((g) => {
      if (g.season) set.add(g.season);
    });
    (activeProfile.teams || []).forEach((t) => {
      if (t.season) set.add(t.season);
    });
    return Array.from(set).sort();
  }, [playerGames, activeProfile.teams]);

  const availableAgeGroups = useMemo(() => {
    const set = new Set<string>();
    playerGames.forEach((g) => {
      if (g.ageGroup) set.add(g.ageGroup);
    });
    (activeProfile.teams || []).forEach((t) => {
      if (t.ageGroup) set.add(t.ageGroup);
    });
    return Array.from(set).sort();
  }, [playerGames, activeProfile.teams]);

  const availableTournaments = useMemo(() => {
    const set = new Set<string>();
    playerGames.forEach((g) => {
      if (g.tournament) set.add(g.tournament);
    });
    return Array.from(set).sort();
  }, [playerGames]);

  const isFilterActive =
    selectedTeam !== 'ALL' ||
    selectedSeason !== 'ALL' ||
    selectedAgeGroup !== 'ALL' ||
    selectedTournament !== 'ALL';

  const handleResetFilters = () => {
    setSelectedTeam('ALL');
    setSelectedSeason('ALL');
    setSelectedAgeGroup('ALL');
    setSelectedTournament('ALL');
  };

  // Grouped stats breakdown
  const groupedBreakdown = useMemo(() => {
    return calculateGroupedStats(
      isFilterActive ? filteredGames : playerGames,
      activeBreakdownGroup,
      settings.inningsPerGame
    );
  }, [filteredGames, playerGames, isFilterActive, activeBreakdownGroup, settings.inningsPerGame]);

  const allSeasonPlays: GamePlay[] = useMemo(() => {
    const list: GamePlay[] = [];
    // When a saved game is being edited, the live game is a working copy of that saved game.
    // Use the live copy in its place so its plays are not counted twice.
    const liveIsSavedCopy = Boolean(liveGame && playerGames.some((g) => g.id === liveGame.id));
    filteredGames.forEach((g) => {
      if (liveGame && g.id === liveGame.id) return;
      if (g.plays) {
        list.push(...g.plays);
      }
    });
    if (liveGame && liveGame.plays) {
      const liveVisible = !liveIsSavedCopy || filteredGames.some((g) => g.id === liveGame.id);
      if (liveVisible) list.push(...liveGame.plays);
    }
    return list;
  }, [filteredGames, playerGames, liveGame]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <div className="w-10 h-10 border-3 border-[#18212D] dark:border-[#354050] border-t-[#00BFA5] rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600 dark:text-[#9CA3AF]">
            Loading your season…
          </p>
        </div>
      </div>
    );
  }

  const seasonStats = calculateSeasonStats(filteredGames, settings.inningsPerGame, activeProfile.id);
  const { gameCount, batting, pitching, fielding, lastGameHits } = seasonStats;

  const playerNameDisplay = activeProfile.playerName
    ? `${activeProfile.playerName}`
    : "Your player";

  const teamNameDisplay = activeProfile.teamName || 'Set team name in Settings';

  return (
    <div className="flex-1 overflow-y-auto pb-24 px-4 sm:px-6 pt-4 max-w-4xl mx-auto w-full space-y-5 animate-in fade-in duration-200">
      {/* App & Season Header */}
      <div className="bg-white dark:bg-[#252D38] rounded-2xl p-5 border border-slate-200/80 dark:border-[#354050] shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open Player Details settings"
            className="group flex min-w-0 items-center gap-3.5 rounded-xl text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00BFA5] sm:gap-2"
          >
            {/* Team Logo Badge */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-slate-100 dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] flex items-center justify-center shrink-0 shadow-xs group-hover:border-[#00BFA5]/50 transition-colors">
              {activeProfile.logo ? (
                <img src={activeProfile.logo} alt="" className="w-full h-full object-contain p-1" />
              ) : (
                <AppLogo variant="logo" className="w-full h-full object-contain p-1" />
              )}
            </div>

            <div className="space-y-1">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#007A6A] dark:text-[#00D7BC]">
                  GAME DAY SCORING
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold text-[#18212D] dark:text-[#FAFAFA] tracking-tight">
                {playerNameDisplay}
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-[#9CA3AF] flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB]">
                  {teamNameDisplay}
                </span>
                {activeProfile.jerseyNumber && (
                  <span className="font-mono text-xs">#{activeProfile.jerseyNumber}</span>
                )}
                {activeProfile.defaultLineupSpot && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-extrabold text-xs">
                    Batting #{activeProfile.defaultLineupSpot}
                  </span>
                )}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Hero Card */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#18212D] dark:from-[#252D38] via-[#202B3A] dark:via-[#1A2028] to-[#121923] dark:to-[#101419] text-white p-5 sm:p-6 shadow-xl relative border border-slate-700/40">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="space-y-1.5 max-w-md">
            {liveGame ? (
              <>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                  GAME IN PROGRESS
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold text-white">
                  Inning {liveGame.innings} · vs {liveGame.opponent || 'Opponent'}
                </h2>
                <p className="text-xs text-slate-300">
                  {liveGame.plays.length} plays recorded so far. Continue live scoring right from the stands.
                </p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  READY FOR NEXT GAME
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold text-white">
                  Start Game Scoring
                </h2>
                <p className="text-xs text-slate-300">
                  Tap big buttons one-handed as plays happen. All stats calculate automatically.
                </p>
              </>
            )}
          </div>

          <button
            onClick={onNavigateToScore}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] font-semibold text-sm tracking-wide shadow-lg shadow-teal-900/40 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            {liveGame ? (
              <>
                <PlayCircle className="w-5 h-5" />
                Continue Scoring
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                Start a Live Game
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Filters Bar (Team, Season, Age Group, Tournament) */}
      <div className="bg-white dark:bg-[#252D38] rounded-2xl p-4 border border-slate-200/80 dark:border-[#354050] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-[#FAFAFA]">
              Filter Stats
            </span>
            {isFilterActive && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-[#00D7BC]/15 text-[#007A6A] dark:text-[#00D7BC]">
                Filtered: {filteredGames.length} of {playerGames.length} games
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-[#D1D5DB] flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* 4 Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {/* Team Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">
              Team
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-1 focus:ring-[#18212D] dark:focus:ring-[#00D7BC]"
            >
              <option value="ALL">All Teams ({availableTeams.length || 1})</option>
              {availableTeams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Season Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">
              Season
            </label>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-1 focus:ring-[#18212D] dark:focus:ring-[#00D7BC]"
            >
              <option value="ALL">All Seasons</option>
              {availableSeasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Age Group Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">
              Age Group
            </label>
            <select
              value={selectedAgeGroup}
              onChange={(e) => setSelectedAgeGroup(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-1 focus:ring-[#18212D] dark:focus:ring-[#00D7BC]"
            >
              <option value="ALL">All Age Groups</option>
              {availableAgeGroups.map((ag) => (
                <option key={ag} value={ag}>
                  {ag}
                </option>
              ))}
            </select>
          </div>

          {/* Tournament Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">
              Tournament
            </label>
            <select
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-1 focus:ring-[#18212D] dark:focus:ring-[#00D7BC]"
            >
              <option value="ALL">All Games</option>
              <option value="__TOURNAMENTS_ONLY__">🏆 Tournaments Only</option>
              <option value="__LEAGUE_ONLY__">⚾ Regular League Only</option>
              {availableTournaments.map((tourney) => (
                <option key={tourney} value={tourney}>
                  {tourney}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Season Snapshot (4 Tiles) */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
            Season Snapshot
          </span>
          <span className="text-xs font-semibold text-slate-600 dark:text-[#D1D5DB]">
            {gameCount} {gameCount === 1 ? 'Game' : 'Games'} Logged
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Tile 1: Games */}
          <div className="bg-white dark:bg-[#252D38] rounded-xl p-4 border border-slate-200/80 dark:border-[#354050] shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
              Games
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">
                {gameCount}
              </span>
              <Activity className="w-4 h-4 text-slate-300 dark:text-[#6B7280]" />
            </div>
          </div>

          {/* Tile 2: Batting AVG */}
          <div className="bg-white dark:bg-[#252D38] rounded-xl p-4 border border-slate-200/80 dark:border-[#354050] shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
              Batting Avg
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-semibold text-[#007A6A] dark:text-[#00D7BC]">
                {formatRate(batting.avg)}
              </span>
              <Award className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]/40" />
            </div>
          </div>

          {/* Tile 3: Hits */}
          <div className="bg-white dark:bg-[#252D38] rounded-xl p-4 border border-slate-200/80 dark:border-[#354050] shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
              Hits
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">
                {batting.h}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                {batting.ab} AB
              </span>
            </div>
          </div>

          {/* Tile 4: Last Game Hits */}
          <div className="bg-white dark:bg-[#252D38] rounded-xl p-4 border border-slate-200/80 dark:border-[#354050] shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
              Last Game Hits
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">
                {lastGameHits !== null ? lastGameHits : '—'}
              </span>
              <TrendingUp className="w-4 h-4 text-teal-500/60" />
            </div>
          </div>
        </div>
      </div>

      {/* Player Statistics Card (Batting / Pitching / Fielding) */}
      <div className="bg-white dark:bg-[#252D38] rounded-2xl border border-slate-200/80 dark:border-[#354050] shadow-xs overflow-hidden">
        {/* Card Header & Group Switcher */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#354050] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 dark:bg-[#1A2028]/60">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block">
              Player Statistics
            </span>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA]">
              Calculated Season Totals
            </h3>
          </div>

          {/* Sub tabs */}
          <div className="flex p-1 rounded-xl bg-slate-200/80 dark:bg-[#252D38]">
            {(['batting', 'pitching', 'fielding'] as const).map((group) => (
              <button
                key={group}
                onClick={() => setActiveStatGroup(group)}
                className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-all ${
                  activeStatGroup === group
                    ? 'bg-white dark:bg-[#354050] text-[#18212D] dark:text-[#FAFAFA] shadow-xs'
                    : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                }`}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid Content */}
        <div className="p-4 sm:p-5">
          {activeStatGroup === 'batting' && (
            <div className="space-y-4">
              {/* Primary Slash line */}
              <div className="grid grid-cols-4 gap-2 text-center bg-slate-50 dark:bg-[#252D38]/40 p-3 rounded-xl border border-slate-200 dark:border-[#354050]">
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">AVG</div>
                  <div className="text-lg sm:text-xl font-semibold text-[#007A6A] dark:text-[#00D7BC]">
                    {formatRate(batting.avg)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">OBP</div>
                  <div className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-[#FAFAFA]">
                    {formatRate(batting.obp)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">SLG</div>
                  <div className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-[#FAFAFA]">
                    {formatRate(batting.slg)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">OPS</div>
                  <div className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-[#FAFAFA]">
                    {formatRate(batting.ops)}
                  </div>
                </div>
              </div>

              {/* Counting Metrics Grid (H, HR, RBI, R, BB, SO, SB, CS, PA) */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">H (Hits)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.h}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">HR (Home Runs)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.hr}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">2B (Doubles)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.doubles}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">3B (Triples)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.triples}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">RBI</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.rbi}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">R (Runs)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.r}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">BB (Walks)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.bb}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">IBB</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.ibb}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">SO (Strikeouts)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.so}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">SB (Stolen Bases)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.sb}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">CS (Caught Stealing)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.cs}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">PA (Appearances)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.pa}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">AB (At Bats)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.ab}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">SH (Sac Bunts)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.sh}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">ROE</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.roe}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">FC</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.fc}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">GIDP</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.gidp}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">HBP</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.hbp}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">SF</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.sf}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">TB</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{batting.tb}</div>
                </div>
              </div>

              {/* FEATURE 5: Batting Splits (vs RHP vs vs LHP) */}
              <div className="pt-2 border-t border-slate-200 dark:border-[#354050] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
                    Pitcher Handedness Splits
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-[#354050] text-[10px] font-extrabold uppercase text-slate-400">
                        <th className="py-2 pr-3">Split</th>
                        <th className="py-2 px-2 text-center">PA</th>
                        <th className="py-2 px-2 text-center">AB</th>
                        <th className="py-2 px-2 text-center">H</th>
                        <th className="py-2 px-2 text-center text-[#007A6A] dark:text-[#00D7BC]">AVG</th>
                        <th className="py-2 px-2 text-center">OBP</th>
                        <th className="py-2 px-2 text-center">SLG</th>
                        <th className="py-2 px-2 text-center">OPS</th>
                        <th className="py-2 px-2 text-center">HR</th>
                        <th className="py-2 pl-2 text-center">SO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#354050] font-semibold">
                      <tr>
                        <td className="py-2 pr-3 text-slate-900 dark:text-[#FAFAFA] font-extrabold">
                          vs Righties (RHP)
                        </td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsRHP.pa}</td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsRHP.ab}</td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsRHP.h}</td>
                        <td className="py-2 px-2 text-center text-[#007A6A] dark:text-[#00D7BC] font-semibold">
                          {formatRate(seasonStats.splits.vsRHP.avg)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {formatRate(seasonStats.splits.vsRHP.obp)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {formatRate(seasonStats.splits.vsRHP.slg)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {formatRate(seasonStats.splits.vsRHP.ops)}
                        </td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsRHP.hr}</td>
                        <td className="py-2 pl-2 text-center">{seasonStats.splits.vsRHP.so}</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-3 text-slate-900 dark:text-[#FAFAFA] font-extrabold">
                          vs Lefties (LHP)
                        </td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsLHP.pa}</td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsLHP.ab}</td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsLHP.h}</td>
                        <td className="py-2 px-2 text-center text-[#007A6A] dark:text-[#00D7BC] font-semibold">
                          {formatRate(seasonStats.splits.vsLHP.avg)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {formatRate(seasonStats.splits.vsLHP.obp)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {formatRate(seasonStats.splits.vsLHP.slg)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {formatRate(seasonStats.splits.vsLHP.ops)}
                        </td>
                        <td className="py-2 px-2 text-center">{seasonStats.splits.vsLHP.hr}</td>
                        <td className="py-2 pl-2 text-center">{seasonStats.splits.vsLHP.so}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* FEATURE 6: Performance by Batting Order Spot */}
              {seasonStats.lineupStats.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-[#354050] space-y-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] block">
                    Performance by Lineup Spot
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {seasonStats.lineupStats.map((item) => (
                      <div
                        key={item.spot}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-[#252D38]/40 border border-slate-200 dark:border-[#354050] flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]">
                            #{item.spot} Spot ({item.games} {item.games === 1 ? 'game' : 'games'})
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {item.batting.h} H · {item.batting.ab} AB · {item.batting.hr} HR · {item.batting.rbi} RBI
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-semibold text-[#007A6A] dark:text-[#00D7BC]">
                            {formatRate(item.batting.avg)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-semibold">AVG</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FEATURE 7: Batting Spray Chart & Hit Direction */}
              <div className="pt-3 border-t border-slate-200 dark:border-[#354050] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] block">
                    Batting Spray Chart & Hit Direction
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-[#9CA3AF]">
                    {(() => {
                      const tracked = allSeasonPlays.filter((p) => p.mode === 'batting' && p.hitLocation);
                      const hits = tracked.filter((p) => isHitPlay(p.code)).length;
                      const outs = tracked.filter((p) => !isHitPlay(p.code)).length;
                      return `${hits} hit${hits !== 1 ? 's' : ''}${outs > 0 ? ` · ${outs} out${outs !== 1 ? 's' : ''}` : ''} mapped`;
                    })()}
                  </span>
                </div>
                <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#252D38]/40 border border-slate-200 dark:border-[#354050]">
                  <SprayChart
                    plays={allSeasonPlays}
                    heightClass="h-72 sm:h-80"
                    showFilters={true}
                    showStats={true}
                    showLegend={true}
                    defaultView="zones"
                    showViewToggle={true}
                    title="Batting Spray Chart & Direction Tapper Analysis"
                  />
                </div>
              </div>
            </div>
          )}

          {activeStatGroup === 'pitching' && (
            <div className="space-y-4">
              {/* Pitching Summary */}
              <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 dark:bg-[#252D38]/40 p-3 rounded-xl border border-slate-200 dark:border-[#354050]">
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">IP</div>
                  <div className="text-lg sm:text-xl font-semibold text-[#18212D] dark:text-[#FAFAFA]">
                    {pitching.ipDisplay}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">
                    ERA ({settings.inningsPerGame} Inn)
                  </div>
                  <div className="text-lg sm:text-xl font-semibold text-[#007A6A] dark:text-[#00D7BC]">
                    {formatEraWhip(pitching.era)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">WHIP</div>
                  <div className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-[#FAFAFA]">
                    {formatEraWhip(pitching.whip)}
                  </div>
                </div>
              </div>

              {/* Pitching Details */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">K (Strikeouts)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.k}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">H (Hits Allowed)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.h}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">BB (Walks Allowed)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.bb}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">IBB</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.ibb}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">ER (Earned Runs)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.er}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">R (Runs Allowed)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.r}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">HR Allowed</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.hr}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">HBP</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.hbp}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">WP</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.wp}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">BK</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{pitching.bk}</div>
                </div>
              </div>

              {/* FEATURE 1: Pitch Count Season Totals & Pitch Smart Guidelines */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#252D38]/40 border border-slate-200 dark:border-[#354050] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-blue-500" />
                    Season Pitch Count Totals
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {pitching.pitches} Total Pitches
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-md bg-white dark:bg-[#1A2028] border border-slate-200 dark:border-[#354050]">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase">Strikes</div>
                    <div className="text-sm font-semibold text-blue-500">{pitching.strikes}</div>
                  </div>
                  <div className="p-2 rounded-md bg-white dark:bg-[#1A2028] border border-slate-200 dark:border-[#354050]">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase">Balls</div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-[#D1D5DB]">{pitching.balls}</div>
                  </div>
                  <div className="p-2 rounded-md bg-white dark:bg-[#1A2028] border border-slate-200 dark:border-[#354050]">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase">Strike %</div>
                    <div className="text-sm font-semibold text-teal-500">
                      {pitching.strikePercentage ? `${pitching.strikePercentage.toFixed(1)}%` : '—'}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF] bg-white dark:bg-[#1A2028] p-2.5 rounded-md border border-slate-200 dark:border-[#354050]">
                  <strong className="text-slate-800 dark:text-[#D1D5DB] block mb-0.5">Pitch Smart Rest Guidelines:</strong>
                  1-20 pitches: 0 days · 21-35 pitches: 1 day · 36-50 pitches: 2 days · 51-65 pitches: 3 days · 66+: 4 days rest.
                </div>
              </div>
            </div>
          )}

          {activeStatGroup === 'fielding' && (
            <div className="space-y-4">
              {/* Fielding Summary */}
              <div className="grid grid-cols-2 gap-2 text-center bg-slate-50 dark:bg-[#252D38]/40 p-3 rounded-xl border border-slate-200 dark:border-[#354050]">
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">Fielding % (FPCT)</div>
                  <div className="text-lg sm:text-xl font-semibold text-[#007A6A] dark:text-[#00D7BC]">
                    {formatRate(fielding.fpct)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">Total Chances</div>
                  <div className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-[#FAFAFA]">
                    {fielding.chances}
                  </div>
                </div>
              </div>

              {/* Fielding Details */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">PO (Putouts)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{fielding.po}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">A (Assists)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{fielding.a}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">E (Errors)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{fielding.e}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">DP (Double Plays)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{fielding.dp}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">PB (Passed Balls)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{fielding.pb}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">CS (Caught Steal)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{fielding.cs}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">TP (Triple Plays)</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{fielding.tp}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/30 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[10px] font-extrabold text-slate-400">SB Allowed</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{fielding.sbAllowed}</div>
                </div>
              </div>

              {/* FEATURE 2: Defensive Breakdown by Position Played */}
              {seasonStats.fieldingByPosition.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-[#354050] space-y-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] block">
                    Defensive Stats by Position
                  </span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-[#354050] text-[10px] font-extrabold uppercase text-slate-400">
                          <th className="py-2 pr-3">Position</th>
                          <th className="py-2 px-2 text-center">Innings</th>
                          <th className="py-2 px-2 text-center">Chances</th>
                          <th className="py-2 px-2 text-center">PO</th>
                          <th className="py-2 px-2 text-center">A</th>
                          <th className="py-2 px-2 text-center">E</th>
                          <th className="py-2 pl-2 text-center text-[#007A6A] dark:text-[#00D7BC]">FPCT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#354050] font-semibold">
                        {seasonStats.fieldingByPosition.map((pos) => (
                          <tr key={pos.position}>
                            <td className="py-2 pr-3 text-slate-900 dark:text-[#FAFAFA] font-extrabold flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-teal-500" />
                              <span>{pos.position}</span>
                            </td>
                            <td className="py-2 px-2 text-center">{pos.innings}.0</td>
                            <td className="py-2 px-2 text-center">{pos.chances}</td>
                            <td className="py-2 px-2 text-center">{pos.po}</td>
                            <td className="py-2 px-2 text-center">{pos.a}</td>
                            <td className="py-2 px-2 text-center">{pos.e}</td>
                            <td className="py-2 pl-2 text-center text-[#007A6A] dark:text-[#00D7BC] font-semibold">
                              {formatRate(pos.fpct)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footnote */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-[#252D38]/60 border-t border-slate-200 dark:border-[#354050] text-[11px] text-slate-500 dark:text-[#9CA3AF] italic">
          Totals are calculated strictly from recorded events. League or age-group rules can change official scoring.
        </div>
      </div>

      {/* Statistical Breakdowns Card (By Tournament, Season, Age Group, Team) */}
      <div className="bg-white dark:bg-[#252D38] rounded-2xl border border-slate-200/80 dark:border-[#354050] shadow-xs overflow-hidden">
        {/* Header & Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#354050] bg-slate-50/70 dark:bg-[#1A2028]/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block">
                Deep Dive Breakdowns
              </span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA] mt-0.5">
              Stats by Tournament, Season, Age & Team
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-0.5">
              Compare performance splits across competitions and teams.
            </p>
          </div>

          {/* Grouping switcher (Tournament, Season, Age Group, Team) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-slate-200/80 dark:bg-[#252D38] w-full md:w-auto">
            {[
              { id: 'tournament', label: '🏆 By Tournament' },
              { id: 'season', label: '🗓️ By Season' },
              { id: 'ageGroup', label: '🎂 By Age Group' },
              { id: 'teamName', label: '⚾ By Team' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveBreakdownGroup(tab.id as any)}
                className={`px-2 py-2 rounded-md text-xs font-semibold whitespace-nowrap truncate text-center transition-all ${
                  activeBreakdownGroup === tab.id
                    ? 'bg-white dark:bg-[#354050] text-[#18212D] dark:text-[#FAFAFA] shadow-xs'
                    : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-header: Stat Category (Batting / Pitching / Fielding) */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-100/60 dark:bg-[#252D38]/40 border-b border-slate-200 dark:border-[#354050] flex flex-col min-[420px]:flex-row min-[420px]:items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] uppercase tracking-wider">
            Display Columns:
          </span>
          <div className="grid grid-cols-3 gap-1 min-[420px]:flex">
            {(['batting', 'pitching', 'fielding'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setBreakdownStatType(cat)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider text-center transition-colors ${
                  breakdownStatType === cat
                    ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] '
                    : 'bg-white dark:bg-[#252D38] text-slate-600 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Breakdowns Table & Cards */}
        <div className="p-4 sm:p-5">
          {groupedBreakdown.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-[#252D38]/30 rounded-xl border border-dashed border-slate-200 dark:border-[#354050] space-y-2">
              <Trophy className="w-8 h-8 text-slate-300 dark:text-[#6B7280] mx-auto" />
              <div className="text-sm font-semibold text-slate-700 dark:text-[#D1D5DB]">
                No breakdown data available yet
              </div>
              <p className="text-xs text-slate-500 dark:text-[#9CA3AF] max-w-sm mx-auto">
                Start scoring games and assign a tournament, age group (e.g. U12), or season (e.g. Spring 2026) to see comparative stat splits here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#354050] text-[10px] font-extrabold uppercase text-slate-400">
                    <th className="py-2.5 pr-4">
                      {activeBreakdownGroup === 'tournament'
                        ? 'Tournament'
                        : activeBreakdownGroup === 'season'
                        ? 'Season'
                        : activeBreakdownGroup === 'ageGroup'
                        ? 'Age Group'
                        : 'Team'}
                    </th>
                    <th className="py-2.5 px-2 text-center">Games</th>
                    {breakdownStatType === 'batting' && (
                      <>
                        <th className="py-2.5 px-2 text-center">PA</th>
                        <th className="py-2.5 px-2 text-center">AB</th>
                        <th className="py-2.5 px-2 text-center">H</th>
                        <th className="py-2.5 px-2 text-center">2B</th>
                        <th className="py-2.5 px-2 text-center">3B</th>
                        <th className="py-2.5 px-2 text-center">HR</th>
                        <th className="py-2.5 px-2 text-center">RBI</th>
                        <th className="py-2.5 px-2 text-center">R</th>
                        <th className="py-2.5 px-2 text-center">BB</th>
                        <th className="py-2.5 px-2 text-center">SO</th>
                        <th className="py-2.5 px-2 text-center">SB</th>
                        <th className="py-2.5 px-2 text-center text-[#007A6A] dark:text-[#00D7BC]">AVG</th>
                        <th className="py-2.5 px-2 text-center">OBP</th>
                        <th className="py-2.5 px-2 text-center">SLG</th>
                        <th className="py-2.5 pl-2 text-center text-blue-600 dark:text-blue-400">OPS</th>
                      </>
                    )}
                    {breakdownStatType === 'pitching' && (
                      <>
                        <th className="py-2.5 px-2 text-center">IP</th>
                        <th className="py-2.5 px-2 text-center text-[#007A6A] dark:text-[#00D7BC]">ERA</th>
                        <th className="py-2.5 px-2 text-center">WHIP</th>
                        <th className="py-2.5 px-2 text-center">K</th>
                        <th className="py-2.5 px-2 text-center">BB</th>
                        <th className="py-2.5 px-2 text-center">H</th>
                        <th className="py-2.5 px-2 text-center">ER</th>
                        <th className="py-2.5 pl-2 text-center">Pitches</th>
                      </>
                    )}
                    {breakdownStatType === 'fielding' && (
                      <>
                        <th className="py-2.5 px-2 text-center">Chances</th>
                        <th className="py-2.5 px-2 text-center">PO</th>
                        <th className="py-2.5 px-2 text-center">A</th>
                        <th className="py-2.5 px-2 text-center">E</th>
                        <th className="py-2.5 px-2 text-center">DP</th>
                        <th className="py-2.5 px-2 text-center">PB</th>
                        <th className="py-2.5 pl-2 text-center text-[#007A6A] dark:text-[#00D7BC]">FPCT</th>
                      </>
                    )}
                    <th className="py-2.5 pl-3 text-right">Filter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#354050] font-semibold">
                  {groupedBreakdown.map((group) => {
                    const b = group.batting;
                    const p = group.pitching;
                    const f = group.fielding;

                    return (
                      <tr
                        key={group.groupKey}
                        className="hover:bg-slate-50 dark:hover:bg-[#252D38]/50 transition-colors"
                      >
                        <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-[#FAFAFA] flex items-center gap-2">
                          {activeBreakdownGroup === 'tournament' && (
                            <Trophy className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          )}
                          {activeBreakdownGroup === 'season' && (
                            <Calendar className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                          )}
                          {activeBreakdownGroup === 'ageGroup' && (
                            <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          )}
                          {activeBreakdownGroup === 'teamName' && (
                            <Shield className="w-3.5 h-3.5 text-[#007A6A] dark:text-[#00D7BC] shrink-0" />
                          )}
                          <span className="truncate max-w-[180px] sm:max-w-xs">{group.groupLabel}</span>
                        </td>
                        <td className="py-3 px-2 text-center font-extrabold text-slate-700 dark:text-[#D1D5DB]">
                          {group.gameCount}
                        </td>

                        {breakdownStatType === 'batting' && (
                          <>
                            <td className="py-3 px-2 text-center">{b.pa}</td>
                            <td className="py-3 px-2 text-center">{b.ab}</td>
                            <td className="py-3 px-2 text-center text-slate-900 dark:text-[#FAFAFA] font-semibold">{b.h}</td>
                            <td className="py-3 px-2 text-center">{b.doubles}</td>
                            <td className="py-3 px-2 text-center">{b.triples}</td>
                            <td className="py-3 px-2 text-center font-semibold text-[#007A6A] dark:text-[#00D7BC]">{b.hr}</td>
                            <td className="py-3 px-2 text-center">{b.rbi}</td>
                            <td className="py-3 px-2 text-center">{b.r}</td>
                            <td className="py-3 px-2 text-center">{b.bb}</td>
                            <td className="py-3 px-2 text-center">{b.so}</td>
                            <td className="py-3 px-2 text-center">{b.sb}</td>
                            <td className="py-3 px-2 text-center text-[#007A6A] dark:text-[#00D7BC] font-semibold text-sm">
                              {formatRate(b.avg)}
                            </td>
                            <td className="py-3 px-2 text-center">{formatRate(b.obp)}</td>
                            <td className="py-3 px-2 text-center">{formatRate(b.slg)}</td>
                            <td className="py-3 pl-2 text-center text-blue-600 dark:text-blue-400 font-semibold">
                              {formatRate(b.ops)}
                            </td>
                          </>
                        )}

                        {breakdownStatType === 'pitching' && (
                          <>
                            <td className="py-3 px-2 text-center">{p.ipDisplay}</td>
                            <td className="py-3 px-2 text-center font-semibold text-[#007A6A] dark:text-[#00D7BC]">
                              {formatEraWhip(p.era)}
                            </td>
                            <td className="py-3 px-2 text-center">{formatEraWhip(p.whip)}</td>
                            <td className="py-3 px-2 text-center font-semibold text-teal-500">{p.k}</td>
                            <td className="py-3 px-2 text-center">{p.bb}</td>
                            <td className="py-3 px-2 text-center">{p.h}</td>
                            <td className="py-3 px-2 text-center">{p.er}</td>
                            <td className="py-3 pl-2 text-center font-mono">{p.pitches}</td>
                          </>
                        )}

                        {breakdownStatType === 'fielding' && (
                          <>
                            <td className="py-3 px-2 text-center">{f.chances}</td>
                            <td className="py-3 px-2 text-center">{f.po}</td>
                            <td className="py-3 px-2 text-center">{f.a}</td>
                            <td className="py-3 px-2 text-center">{f.e}</td>
                            <td className="py-3 px-2 text-center">{f.dp}</td>
                            <td className="py-3 px-2 text-center">{f.pb}</td>
                            <td className="py-3 pl-2 text-center font-semibold text-[#007A6A] dark:text-[#00D7BC]">
                              {formatRate(f.fpct)}
                            </td>
                          </>
                        )}

                        <td className="py-3 pl-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (activeBreakdownGroup === 'tournament') {
                                setSelectedTournament(group.groupKey);
                              } else if (activeBreakdownGroup === 'season') {
                                setSelectedSeason(group.groupKey);
                              } else if (activeBreakdownGroup === 'ageGroup') {
                                setSelectedAgeGroup(group.groupKey);
                              } else if (activeBreakdownGroup === 'teamName') {
                                setSelectedTeam(group.groupKey);
                              }
                            }}
                            className="px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-[#252D38] hover:bg-slate-200 dark:hover:bg-[#354050] text-slate-700 dark:text-[#D1D5DB]"
                            title="Filter dashboard to this group"
                          >
                            Filter
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Help Link Footer */}
      <button
        onClick={onOpenHelp}
        className="w-full p-4 rounded-2xl bg-blue-50/70 dark:bg-[#252D38]/50 border border-blue-100 dark:border-[#354050] text-left flex items-center justify-between group transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] group-hover:bg-[#00BFA5] transition-colors">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-900 dark:text-[#FAFAFA]">
              New to scorekeeping?
            </div>
            <div className="text-xs text-slate-500 dark:text-[#9CA3AF]">
              Open the quick guide to see what every scoring button means with real examples.
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-[#D1D5DB]" />
      </button>

      <footer className="mt-8 border-t border-slate-800/50 py-6 text-center text-xs text-slate-500">
        <p>© 2026 Dugout Pulse (Trevor Fourie). All rights reserved.</p>
        <p className="mt-1 opacity-75">Offline Scorekeeper • Build {__BUILD_ID__}</p>
      </footer>
    </div>
  );
};