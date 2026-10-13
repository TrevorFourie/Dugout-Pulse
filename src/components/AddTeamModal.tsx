import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { X, Shield, Trophy, Calendar, Users, Plus, Check } from 'lucide-react';
import { PlayerTeam } from '../types/baseball';
import { ValueCombobox } from './ValueCombobox';

interface AddTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamAdded?: (newTeam: PlayerTeam) => void;
  initialAgeGroup?: string;
  initialSeason?: string;
}

export const AddTeamModal: React.FC<AddTeamModalProps> = ({
  isOpen,
  onClose,
  onTeamAdded,
  initialAgeGroup,
  initialSeason,
}) => {
  const {
    activeProfile,
    allAgeGroups,
    allSeasons,
    allTournaments,
    addPlayerTeam,
  } = useGame();

  const [teamName, setTeamName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [ageGroup, setAgeGroup] = useState(() => initialAgeGroup || activeProfile.defaultAgeGroup || '12U');

  const [season, setSeason] = useState(() => initialSeason || activeProfile.defaultSeason || `Spring ${new Date().getFullYear()}`);

  const [tournament, setTournament] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = teamName.trim();
    if (!trimmedName) {
      setError('Please enter a team name');
      return;
    }

    const finalAgeGroup = ageGroup.trim() || '12U';
    const finalSeason = season.trim() || `Spring ${new Date().getFullYear()}`;

    const createdTeam = addPlayerTeam(activeProfile.id, {
      name: trimmedName,
      jerseyNumber: jerseyNumber.trim() || undefined,
      ageGroup: finalAgeGroup,
      season: finalSeason,
      tournament: tournament.trim() || undefined,
      isDefault,
    });

    if (onTeamAdded) {
      onTeamAdded(createdTeam);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white dark:bg-[#1A2028] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#354050]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#354050] flex items-center justify-between bg-slate-50 dark:bg-[#1A2028]/80 rounded-t-2xl">
          <div className="flex items-center gap-1.5">
            <div className="p-2 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block">
                Player Team Management
              </span>
              <h3 className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">
                Add Team for {activeProfile.playerName || 'Player'}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-[#D1D5DB]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-md bg-red-50 dark:bg-[#FF5252]/15 text-red-600 dark:text-[#D4626D] text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Team Name and Jersey Number */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-[#9CA3AF] mb-1.5 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                Team Name *
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Eastside Thunder, Hawks Travel, Bears JV"
                value={teamName}
                onChange={(e) => {
                  setTeamName(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#18212D] dark:focus:ring-[#00D7BC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-[#9CA3AF] mb-1.5 flex items-center gap-1.5">
                <span>Jersey #</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 14"
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#18212D] dark:focus:ring-[#00D7BC]"
              />
            </div>
          </div>

          {/* Age Group */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-[#9CA3AF] mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              Age Group
            </label>
            <ValueCombobox
              value={ageGroup}
              onChange={setAgeGroup}
              options={allAgeGroups}
              placeholder="Select or type (e.g. 12U)"
              ariaLabel="Age group"
            />
          </div>

          {/* Season */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-[#9CA3AF] mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Season
            </label>
            <ValueCombobox
              value={season}
              onChange={setSeason}
              options={allSeasons}
              placeholder="Select or type (e.g. Spring 2026)"
              ariaLabel="Season"
            />
          </div>

          {/* Tournament (Optional) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-[#9CA3AF] mb-1.5 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-blue-500" />
              Tournament / Event (Optional)
            </label>
            <ValueCombobox
              value={tournament}
              onChange={setTournament}
              options={allTournaments}
              placeholder="Select or type (or leave blank for league)"
              ariaLabel="Tournament or event"
            />
          </div>

          {/* Set as Default Team toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="set-default-team-cb"
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded text-[#007A6A] dark:text-[#00D7BC] border-slate-300 focus:ring-[#00BFA5]"
            />
            <label htmlFor="set-default-team-cb" className="text-xs font-semibold text-slate-700 dark:text-[#D1D5DB]">
              Set as current primary team for {activeProfile.playerName || 'player'}
            </label>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-[#354050]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-600 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] font-semibold text-xs shadow-md shadow-teal-900/20 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Save Team
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};