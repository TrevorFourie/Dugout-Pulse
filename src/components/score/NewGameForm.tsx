import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { ConfirmationModal } from '../ConfirmationModal';
import { ThemedDropdown } from '../ThemedDropdown';
import { OpponentCombobox } from '../OpponentCombobox';
import { ValueCombobox } from '../ValueCombobox';
import {
  Calendar, Check, Clock, Home, Plane, Play as PlayIcon, Plus, Shield, Trophy, Users,
} from 'lucide-react';

interface NewGameFormProps {
  startGameDate: string;
  onStartGameDateChange: (date: string) => void;
}

export const NewGameForm: React.FC<NewGameFormProps> = ({ startGameDate, onStartGameDateChange }) => {
  const {
    activeProfile, oppositionTeams, addOppositionTeam, allTournaments, saveTournament,
    allAgeGroups, saveAgeGroup, deleteAgeGroup, allSeasons, saveSeason, deleteSeason,
    addPlayerTeam, startLiveGame,
  } = useGame();

  const newGameDate = startGameDate;
  const setNewGameDate = onStartGameDateChange;
  // Normalize list of teams for the active player profile
  const playerTeams = React.useMemo(() => {
    if (activeProfile.teams && activeProfile.teams.length > 0) {
      return activeProfile.teams;
    }
    if (activeProfile.teamName) {
      return [
        {
          id: 'primary-team',
          name: activeProfile.teamName,
          ageGroup: activeProfile.defaultAgeGroup || 'U12',
          season: activeProfile.defaultSeason || 'Spring 2026',
          tournament: activeProfile.defaultTournament || '',
          isDefault: true,
        },
      ];
    }
    return [];
  }, [activeProfile]);

  // New game form state
  const newGameDate = startGameDate;
  const setNewGameDate = onStartGameDateChange;
  const [newGameTime, setNewGameTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [newGameOpponent, setNewGameOpponent] = useState('');
  const [newGameFormError, setNewGameFormError] = useState('');
  const [newGameIsHome, setNewGameIsHome] = useState<boolean>(true);
  const initialTeam = playerTeams.find((t) => t.isDefault) || playerTeams[0];
  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => initialTeam?.id || '');
  const [newGameTeam, setNewGameTeam] = useState(() => initialTeam?.name || activeProfile.teamName || 'My Team');
  const [newGameTournament, setNewGameTournament] = useState(() => initialTeam?.tournament || '');
  const [newGameAgeGroup, setNewGameAgeGroup] = useState(() => initialTeam?.ageGroup || '');
  const [newGameSeason, setNewGameSeason] = useState(() => initialTeam?.season || '');
  const [tournamentEditing, setTournamentEditing] = useState(false);

  const selectedTeam = playerTeams.find((t) => t.id === selectedTeamId) || initialTeam;
  const ageLocked = Boolean(selectedTeam?.ageGroup);
  const seasonLocked = Boolean(selectedTeam?.season);
  const tournamentLocked = Boolean(selectedTeam?.tournament);

  // Inline Quick-Add Team state
  const [showAddTeamInline, setShowAddTeamInline] = useState(false);
  const [inlineTeamName, setInlineTeamName] = useState('');
  const [inlineJerseyNumber, setInlineJerseyNumber] = useState('');
  const [inlineAgeGroup, setInlineAgeGroup] = useState('U12');
  const [inlineSeason, setInlineSeason] = useState('Spring 2026');
  const [inlineTournament, setInlineTournament] = useState('');

  const handleSelectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    const found = playerTeams.find((t) => t.id === teamId);
    if (found) {
      setNewGameTeam(found.name);
      setNewGameAgeGroup(found.ageGroup || '');
      setNewGameSeason(found.season || '');
      setNewGameTournament(found.tournament || '');
      setTournamentEditing(false);
    }
  };

  const handleSaveInlineTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineTeamName.trim()) return;

    const created = addPlayerTeam(activeProfile.id, {
      name: inlineTeamName.trim(),
      jerseyNumber: inlineJerseyNumber.trim() || undefined,
      ageGroup: inlineAgeGroup.trim(),
      season: inlineSeason.trim(),
      tournament: inlineTournament.trim(),
      isDefault: playerTeams.length === 0,
    });

    setNewGameTeam(created.name);
    setNewGameAgeGroup(created.ageGroup || '');
    setNewGameSeason(created.season || '');
    setNewGameTournament(created.tournament || '');
    setTournamentEditing(false);
    setSelectedTeamId(created.id);
    setInlineTeamName('');
    setInlineJerseyNumber('');
    setInlineTournament('');
    setShowAddTeamInline(false);
  };

  // If no live game is active, render Start New Game form
  if (!liveGame) {
    const handleStartGame = (e: React.FormEvent) => {
      e.preventDefault();
      setNewGameFormError('');

      const gameAgeGroup = (ageLocked ? selectedTeam?.ageGroup : newGameAgeGroup)?.trim() || '';
      const gameSeason = (seasonLocked ? selectedTeam?.season : newGameSeason)?.trim() || '';
      const gameTournament = (
        tournamentEditing && newGameTournament ? newGameTournament : (selectedTeam?.tournament || newGameTournament)
      ).trim();
      const gameTeamName = (selectedTeam?.name || newGameTeam || activeProfile.teamName).trim();
      const missingFields = [
        !newGameDate.trim() && 'game date',
        !newGameTime.trim() && 'game time',
        (!newGameOpponent.trim() || !oppositionTeams.some((team) => team.name.trim().toLocaleLowerCase() === newGameOpponent.trim().toLocaleLowerCase())) && 'an opposition team from Opposition Teams',
        !gameTeamName && 'team',
        !gameAgeGroup && 'age group',
        !gameSeason && 'season',
      ].filter(Boolean);

      if (missingFields.length > 0) {
        setNewGameFormError(
          `Please complete these required fields:\n${missingFields.map((field) => `• ${field}`).join('\n')}`
        );
        return;
      }

      if (!selectedTeam?.tournament || tournamentEditing) {
        if (gameTournament) saveTournament(gameTournament);
      }
      if (!ageLocked && gameAgeGroup) saveAgeGroup(gameAgeGroup);
      if (!seasonLocked && gameSeason) saveSeason(gameSeason);

      startLiveGame({
        date: newGameDate,
        time: newGameTime,
        opponent: newGameOpponent.trim(),
        teamName: gameTeamName,
        tournament: gameTournament || undefined,
        ageGroup: gameAgeGroup || undefined,
        season: gameSeason || undefined,
        isHome: newGameIsHome,
      });
    };

    return (
      <>
      <div className="flex-1 overflow-y-auto pb-24 px-4 sm:px-6 pt-4 max-w-xl mx-auto w-full animate-in fade-in duration-200">

        <div className="bg-white dark:bg-[#252D38] rounded-md p-6 border border-slate-200/80 dark:border-[#354050] shadow-md">
          <div className="mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#007A6A] dark:text-[#00D7BC]">
              LIVE SCOREKEEPING
            </span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-[#FAFAFA]">
            Start a New Game
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1 mb-5">
            Scoring for <strong className="text-slate-700 dark:text-[#D1D5DB]">{activeProfile.playerName || 'your player'}</strong>.
          </p>

          <form onSubmit={handleStartGame} noValidate className="space-y-4">
            <div className="p-3.5 rounded-md bg-slate-50 dark:bg-[#1A2028] border border-slate-200 dark:border-[#354050] space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#18212D] dark:text-[#D1D5DB]" />
                      Playing for Team *
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddTeamInline(!showAddTeamInline)}
                  className="text-xs font-semibold text-[#007A6A] hover:text-[#007A6A] dark:text-[#00D7BC] dark:hover:text-[#CCF7F1] flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {showAddTeamInline ? 'Cancel' : 'Add Another Team'}
                </button>
              </div>

              {showAddTeamInline && (
                <div className="p-3 bg-white dark:bg-[#252D38] rounded-md border border-teal-200 dark:border-[#00D7BC]/40 shadow-xs space-y-2.5 animate-in fade-in duration-150">
                  <div className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC] flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Add Another Team for {activeProfile.playerName || 'Player'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] mb-1">
                        Team Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Thunderbolts Travel, East High Varsity"
                        value={inlineTeamName}
                        onChange={(e) => setInlineTeamName(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#00BFA5]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] mb-1">
                        Jersey #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 24"
                        value={inlineJerseyNumber}
                        onChange={(e) => setInlineJerseyNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#00BFA5]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] mb-1">
                        Age Group (Select or type)
                      </label>
                      <ValueCombobox value={inlineAgeGroup} onChange={setInlineAgeGroup} options={allAgeGroups} placeholder="e.g. U12, U14" ariaLabel="e.g. U12, U14" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] mb-1">
                        Season (Select or type)
                      </label>
                      <ValueCombobox value={inlineSeason} onChange={setInlineSeason} options={allSeasons} placeholder="e.g. Spring 2026" ariaLabel="e.g. Spring 2026" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] mb-1">
                      Default Tournament (Select or type, optional)
                    </label>
                    <ValueCombobox value={inlineTournament} onChange={setInlineTournament} options={allTournaments} placeholder="e.g. Triple Crown Classic" ariaLabel="e.g. Triple Crown Classic" />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddTeamInline(false)}
                      className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-[#465160] text-xs font-semibold text-slate-600 dark:text-[#D1D5DB] hover:dark:bg-[#2D3643]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveInlineTeam}
                      disabled={!inlineTeamName.trim()}
                      className="px-3.5 py-1.5 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] dark:border-t dark:border-[#00D7BC] dark:border-b-2 dark:border-[#00D7BC]/40 disabled:opacity-50 text-[#18212D] dark:text-[#101419] text-xs font-semibold flex items-center gap-1 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Add Team
                    </button>
                  </div>
                </div>
              )}

              {playerTeams.length > 0 ? (
                <div className="space-y-1.5">
                  <ThemedDropdown
                    value={selectedTeamId}
                    onChange={(id) => {
                      if (id) handleSelectTeam(String(id));
                    }}
                    placeholder="Select a team"
                    ariaLabel="Playing for team"
                    allowClear={false}
                    className="w-full"
                    buttonClassName="py-2.5 text-sm font-medium"
                    options={playerTeams.map((team) => ({
                      value: team.id,
                      label: `${team.name}${team.jerseyNumber ? ` (#${team.jerseyNumber})` : ''}${team.ageGroup ? ` (${team.ageGroup})` : ''}${team.season ? ` · ${team.season}` : ''}`,
                    }))}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Enter team name"
                  required
                  value={newGameTeam}
                  onChange={(e) => setNewGameTeam(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-white dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]"
                />
              )}

              {selectedTeam && (selectedTeam.jerseyNumber || ageLocked || seasonLocked || tournamentLocked) && (
                <div className="pt-1 space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTeam.jerseyNumber && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#121923] dark:bg-[#00D7BC]/50 text-white border border-slate-300 dark:border-[#354050]">
                        <Shield className="w-3 h-3" />
                        #{selectedTeam.jerseyNumber}
                      </span>
                    )}
                    {ageLocked && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#121923] dark:bg-[#00D7BC]/50 text-white border border-slate-300 dark:border-[#354050]">
                        <Users className="w-3 h-3" />
                        {selectedTeam.ageGroup}
                      </span>
                    )}
                    {seasonLocked && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#121923] dark:bg-[#00D7BC]/50 text-white border border-slate-300 dark:border-[#354050]">
                        <Calendar className="w-3 h-3" />
                        {selectedTeam.season}
                      </span>
                    )}
                    {tournamentLocked && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#121923] dark:bg-[#00D7BC]/50 text-white border border-slate-300 dark:border-[#354050] max-w-full">
                        <Trophy className="w-3 h-3 shrink-0" />
                        <span className="truncate">{newGameTournament || selectedTeam.tournament}</span>
                      </span>
                    )}
                  </div>
                  {tournamentEditing && (
                    <div className="pt-2 flex items-center gap-2 animate-in fade-in duration-150">
                      <ValueCombobox value={newGameTournament} onChange={setNewGameTournament} options={allTournaments} placeholder="Type or select tournament for today" ariaLabel="Type or select tournament for today" className="flex-1" />
                      <button
                        type="button"
                        onClick={() => setTournamentEditing(false)}
                        className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-[#252D38] text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] border border-slate-300 dark:border-[#354050]"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Game Date
                </label>
                <input
                  type="date"
                  required
                  value={newGameDate}
                  onChange={(e) => setNewGameDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-md bg-slate-50 dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#18212D] dark:focus:ring-[#00D7BC] dark:[&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Game Time
                </label>
                <input
                type="time"
                required
                value={newGameTime}
                onChange={(e) => setNewGameTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-md bg-slate-50 dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#18212D] dark:focus:ring-[#00D7BC] 
                dark:[&::-webkit-calendar-picker-indicator]:invert"
              />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  Opponent *
                </span>
              </label>
              <OpponentCombobox
                value={newGameOpponent}
                onChange={setNewGameOpponent}
                oppositionTeams={oppositionTeams}
                onAddTeam={addOppositionTeam}
                placeholder="Search or select an opposition team"
              />
            </div>

            {/* Team Designation: Home Team vs Away Team */}
            <div className="p-3.5 rounded-md bg-slate-50 dark:bg-[#252D38]/50 border border-slate-200 dark:border-[#354050] space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#007A6A] dark:text-[#00D7BC]" />
                  Team Role
                </label>
                <span className="text-[12px] font-semibold text-slate-500 dark:text-[#FFFFFF]">
                  Away Teams Bat First
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-1 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200 dark:border-[#354050] shadow-2xs">
                <button
                  type="button"
                  onClick={() => setNewGameIsHome(true)}
                  className={`py-2 px-3 rounded-md text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    newGameIsHome
                      ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                      : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Home className="w-4 h-4" />
                    <span>Home</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewGameIsHome(false)}
                  className={`py-2 px-3 rounded-md text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    !newGameIsHome
                      ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                      : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Plane className="w-4 h-4" />
                    <span>Away</span>
                  </span>
                </button>
              </div>
            </div>

            {(!ageLocked || !seasonLocked) && (
              <div
                className={`grid grid-cols-1 gap-3 ${!ageLocked && !seasonLocked ? 'sm:grid-cols-2' : ''}`}
              >
                {!ageLocked && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-300" />
                        Age Group *
                      </label>
                      <span className="text-xs text-slate-400 font-semibold">
                        {allAgeGroups.length} in list
                      </span>
                    </div>
                    <ValueCombobox
                      value={newGameAgeGroup}
                      onChange={setNewGameAgeGroup}
                      required
                      options={allAgeGroups}
                      quickPills={allAgeGroups.slice(0, 6)}
                      onDeleteOption={deleteAgeGroup}
                      placeholder="Select age group (e.g. U12)"
                    />
                  </div>
                )}
                {!seasonLocked && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        Season *
                      </label>
                      <span className="text-xs text-slate-400 font-semibold">
                        {allSeasons.length} in list
                      </span>
                    </div>
                    <ValueCombobox
                      value={newGameSeason}
                      onChange={setNewGameSeason}
                      required
                      options={allSeasons}
                      quickPills={allSeasons.slice(0, 5)}
                      onDeleteOption={deleteSeason}
                      placeholder="Select season (e.g. Spring 2026)"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="pt-3">
              <button
                type="submit"
                className="w-full py-4 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] font-semibold text-sm shadow-lg shadow-teal-900/30 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <PlayIcon className="w-5 h-5 fill-current" />
                Start Scoring
              </button>
            </div>
          </form>
        </div>
      </div>
      <ConfirmationModal
        isOpen={Boolean(newGameFormError)}
        title="Complete Game Details"
        message={newGameFormError}
        confirmLabel="Got It"
        variant="warning"
        onConfirm={() => setNewGameFormError('')}
        onCancel={() => setNewGameFormError('')}
      />
      </>
    );
  }

  // Active Live Game View
  return null;
};
