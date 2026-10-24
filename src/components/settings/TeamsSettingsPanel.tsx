import React, { useEffect, useState } from 'react';
import teamIcon from '../../assets/TeamIcon.png';
import { Check, Edit2, Plus, Shield, Star, Trash2, Trophy } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { TeamLogoPicker } from '../TeamLogoPicker';
import { migrateLegacyLogoDataUrl, resolveTeamLogoSrc } from '../../utils/teamLogoLibrary';
import { reportFailure } from '../../utils/userMessages';
import { TeamLogoImage } from '../TeamLogoImage';
import { ValueCombobox } from '../ValueCombobox';

interface TeamsSettingsPanelProps {
  isActive: boolean;
  onStatusMessage: (message: { text: string; isError: boolean }) => void;
}

export const TeamsSettingsPanel: React.FC<TeamsSettingsPanelProps> = ({ isActive, onStatusMessage }) => {
  const { activeProfile, addPlayerTeam, updatePlayerTeam, deletePlayerTeam, setDefaultPlayerTeam, allAgeGroups, allSeasons, allTournaments } = useGame();
  // Teams management state
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamInputName, setNewTeamInputName] = useState('');
  const [newTeamInputJersey, setNewTeamInputJersey] = useState('');
  const [newTeamInputAge, setNewTeamInputAge] = useState('');
  const [newTeamInputSeason, setNewTeamInputSeason] = useState('');
  const [newTeamInputTournament, setNewTeamInputTournament] = useState('');

  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamInputName, setEditTeamInputName] = useState('');
  const [editTeamInputJersey, setEditTeamInputJersey] = useState('');
  const [editTeamInputAge, setEditTeamInputAge] = useState('');
  const [editTeamInputSeason, setEditTeamInputSeason] = useState('');
  const [editTeamInputTournament, setEditTeamInputTournament] = useState('');

  // Preserve existing data URLs unless the private-file migration succeeds.
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    const migrateLegacyTeamLogos = async () => {
      for (const team of activeProfile.teams || []) {
        if (!team.logo?.startsWith('data:image/')) continue;
        try {
          const logo = await migrateLegacyLogoDataUrl(team.logo);
          if (!cancelled) updatePlayerTeam(activeProfile.id, team.id, { logo });
        } catch (cause) {
          if (!cancelled) {
            onStatusMessage({
              text: reportFailure('team_logo_migration', cause, `We could not update the logo for ${team.name}. Your original image has been kept.`),
              isError: true,
            });
          }
        }
      }
    };
    void migrateLegacyTeamLogos();
    return () => { cancelled = true; };
  }, [isActive, activeProfile.id, activeProfile.teams, updatePlayerTeam, onStatusMessage]);

  if (!isActive) return null;

  return (
              <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1 basis-48">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#007A6A] dark:text-[#00D7BC]" />
                    Teams for {activeProfile.playerName || 'Player'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mt-0.5">
                    If he plays for multiple teams, add each team here with its tournament, age group, and season.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddTeam(!showAddTeam)}
                  className="px-2.5 py-1.5 rounded-md bg-teal-50 dark:bg-[#00D7BC]/15 text-[#007A6A] dark:text-[#00D7BC] text-xs font-semibold hover:bg-teal-100 dark:hover:bg-[#00D7BC]/15 flex items-center gap-1 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {showAddTeam ? 'Cancel' : 'Add Another Team'}
                </button>
              </div>

              {/* Add New Team Form */}
              {showAddTeam && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newTeamInputName.trim()) return;
                    addPlayerTeam(activeProfile.id, {
                      name: newTeamInputName.trim(),
                      jerseyNumber: newTeamInputJersey.trim() || undefined,
                      ageGroup: newTeamInputAge.trim() || undefined,
                      season: newTeamInputSeason.trim() || undefined,
                      tournament: newTeamInputTournament.trim() || undefined,
                      isDefault: (activeProfile.teams || []).length === 0,
                    });
                    setNewTeamInputName('');
                    setNewTeamInputJersey('');
                    setNewTeamInputAge('');
                    setNewTeamInputSeason('');
                    setNewTeamInputTournament('');
                    setShowAddTeam(false);
                    onStatusMessage({ text: 'New team added for player!', isError: false });
                  }}
                  className="p-4 mb-3 rounded-xl bg-slate-100 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] space-y-3 animate-in fade-in duration-150"
                >
                  <div className="font-extrabold text-xs text-slate-900 dark:text-[#FAFAFA] flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-[#007A6A] dark:text-[#00D7BC]" />
                    Add Another Team
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                        Team Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Thunderbolts U12 Travel, East High Varsity"
                        value={newTeamInputName}
                        onChange={(e) => setNewTeamInputName(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                        Jersey # on Team
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 14"
                        value={newTeamInputJersey}
                        onChange={(e) => setNewTeamInputJersey(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                        Age Group (Select or type)
                      </label>
                      <ValueCombobox value={newTeamInputAge} onChange={setNewTeamInputAge} options={allAgeGroups} placeholder="e.g. U12" ariaLabel="e.g. U12" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                        Season (Select or type)
                      </label>
                      <ValueCombobox value={newTeamInputSeason} onChange={setNewTeamInputSeason} options={allSeasons} placeholder="e.g. Spring 2026" ariaLabel="e.g. Spring 2026" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                      Default Tournament (Select or type, optional)
                    </label>
                    <ValueCombobox value={newTeamInputTournament} onChange={setNewTeamInputTournament} options={allTournaments} placeholder="e.g. Triple Crown Classic" ariaLabel="e.g. Triple Crown Classic" />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddTeam(false)}
                      className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-600 dark:text-[#9CA3AF]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newTeamInputName.trim()}
                      className="px-4 py-1.5 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] disabled:opacity-50 text-[#18212D] dark:text-[#101419] text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save Team
                    </button>
                  </div>
                </form>
              )}

              {/* List of registered teams */}
              <div className="space-y-2">
                {(() => {
                  const teams =
                    activeProfile.teams && activeProfile.teams.length > 0
                      ? activeProfile.teams
                      : activeProfile.teamName
                      ? [
                          {
                            id: 'primary-team',
                            name: activeProfile.teamName,
                            ageGroup: activeProfile.defaultAgeGroup || '',
                            season: activeProfile.defaultSeason || '',
                            tournament: activeProfile.defaultTournament || '',
                            logo: undefined,
                            isDefault: true,
                          },
                        ]
                      : [];

                  if (teams.length === 0) {
                    return (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/40 border border-dashed border-slate-300 dark:border-[#354050] text-center text-xs text-slate-500 dark:text-[#9CA3AF]">
                        No teams yet. Add a team above to get started.
                      </div>
                    );
                  }

                  return teams.map((team) => {
                    const isEditingThisTeam = editingTeamId === team.id;

                    if (isEditingThisTeam) {
                      return (
                        <div
                          key={team.id}
                          className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-[#252D38] border border-blue-200 dark:border-blue-900 space-y-2"
                        >
                          <div className="font-semibold text-xs text-[#18212D] dark:text-blue-300">
                            Edit Team Details
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="sm:col-span-2">
                              <input
                                type="text"
                                value={editTeamInputName}
                                onChange={(e) => setEditTeamInputName(e.target.value)}
                                placeholder="Team name"
                                className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]"
                              />
                            </div>
                            <div>
                              <input
                                type="text"
                                value={editTeamInputJersey}
                                onChange={(e) => setEditTeamInputJersey(e.target.value)}
                                placeholder="Jersey # (e.g. 14)"
                                className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-[#1A2028] border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA]"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <ValueCombobox value={editTeamInputAge} onChange={setEditTeamInputAge} options={allAgeGroups} placeholder="Age group (e.g. U12)" ariaLabel="Age group (e.g. U12)" />
                            <ValueCombobox value={editTeamInputSeason} onChange={setEditTeamInputSeason} options={allSeasons} placeholder="Season (e.g. Spring 2026)" ariaLabel="Season (e.g. Spring 2026)" />
                          </div>
                          <ValueCombobox value={editTeamInputTournament} onChange={setEditTeamInputTournament} options={allTournaments} placeholder="Tournament (optional)" ariaLabel="Tournament (optional)" />
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingTeamId(null)}
                              className="px-3 py-1 rounded text-xs text-slate-500 font-semibold"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updatePlayerTeam(activeProfile.id, team.id, {
                                  name: editTeamInputName.trim() || team.name,
                                  jerseyNumber: editTeamInputJersey.trim() || undefined,
                                  ageGroup: editTeamInputAge.trim() || undefined,
                                  season: editTeamInputSeason.trim() || undefined,
                                  tournament: editTeamInputTournament.trim() || undefined,
                                });
                                setEditingTeamId(null);
                                onStatusMessage({ text: 'Team details updated!', isError: false });
                              }}
                              className="px-3 py-1 rounded bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] text-xs font-semibold"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={team.id}
                        className="grid min-w-0 w-full grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300 dark:border-[#354050] dark:bg-[#252D38]/40"
                      >
                        <div className="grid min-w-0 w-full grid-cols-[3rem_minmax(0,1fr)] items-start gap-3">
                          {resolveTeamLogoSrc(team.logo) ? (
                            <TeamLogoImage value={team.logo} alt={`${team.name} logo`} className="h-12 w-12 shrink-0 rounded-md border border-slate-200 bg-white object-contain p-1 dark:border-[#354050] dark:bg-[#1A2028]" onError={() => onStatusMessage({ text: `The ${team.name} logo file could not be read from app storage. The saved logo reference has been preserved.`, isError: true })} />
                          ) : (
                            <img src={teamIcon} alt={`${team.name} default logo`} className="h-12 w-12 shrink-0 rounded-md border border-slate-200 bg-white object-contain p-1 dark:border-[#354050] dark:bg-[#1A2028]" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm text-slate-900 dark:text-[#FAFAFA] break-words">
                              {team.name}
                            </span>
                            {team.jerseyNumber && (
                              <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#354050] text-slate-800 dark:text-[#FAFAFA]">
                                #{team.jerseyNumber}
                              </span>
                            )}
                            {team.isDefault && (
                              <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                Primary
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs">
                            {team.ageGroup && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                                {team.ageGroup}
                              </span>
                            )}
                            {team.season && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                                {team.season}
                              </span>
                            )}
                            {team.tournament && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center gap-0.5">
                                <Trophy className="w-3 h-3 shrink-0" /> {team.tournament}
                              </span>
                            )}
                          </div>
                        </div>
                        </div>

                        <div className="flex w-full min-w-0 flex-col gap-2 border-t border-slate-100 pt-2 dark:border-[#354050] sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-1">
                            <TeamLogoPicker compact value={team.logo} onChange={(logo) => { updatePlayerTeam(activeProfile.id, team.id, { logo }); onStatusMessage({ text: logo ? 'Team logo linked.' : 'Team logo removed.', isError: false }); }} onError={(message) => onStatusMessage({ text: message, isError: true })} />
                          </div>
                          {/* Team actions */}
                          <div className="flex flex-wrap items-center gap-1">
                          {!team.isDefault && (
                            <button
                              type="button"
                              onClick={() => {
                                setDefaultPlayerTeam(activeProfile.id, team.id);
                                onStatusMessage({ text: `Set ${team.name} as primary team!`, isError: false });
                              }}
                              className="px-2 py-1 rounded-md text-[10px] font-semibold text-slate-600 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#354050]"
                              title="Set as default team"
                            >
                              Make Primary
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTeamId(team.id);
                              setEditTeamInputName(team.name);
                              setEditTeamInputJersey(team.jerseyNumber || '');
                              setEditTeamInputAge(team.ageGroup || '');
                              setEditTeamInputSeason(team.season || '');
                              setEditTeamInputTournament(team.tournament || '');
                            }}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#354050]"
                            title="Edit team"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {teams.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                deletePlayerTeam(activeProfile.id, team.id);
                                onStatusMessage({ text: 'Team removed', isError: false });
                              }}
                              className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-[#FF5252]/15"
                              title="Delete team"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

              </div>
  );
};
