import React from 'react';
import type { DefensivePosition, PlayerProfile } from '../../types/baseball';
import TeamIcon from '../../assets/TeamIcon.png';
import { ImagePlus, UserPlus } from 'lucide-react';
import { ThemedDropdown } from '../ThemedDropdown';

const FIELDING_POSITION_OPTIONS: { value: DefensivePosition; label: string }[] = [
  { value: 'P', label: 'Pitcher' },
  { value: 'C', label: 'Catcher' },
  { value: '1B', label: 'First Base' },
  { value: '2B', label: 'Second Base' },
  { value: '3B', label: 'Third Base' },
  { value: 'SS', label: 'Shortstop' },
  { value: 'LF', label: 'Left Field' },
  { value: 'CF', label: 'Center Field' },
  { value: 'RF', label: 'Right Field' },
  { value: 'DH', label: 'Designated Hitter' },
];

const HANDEDNESS_OPTIONS = [
  { value: 'Right' as const, label: 'Right' },
  { value: 'Left' as const, label: 'Left' },
  { value: 'Both' as const, label: 'Both' },
];

interface PlayerDetailsPanelProps {
  activeProfile: PlayerProfile;
  updateActiveProfile: (updates: Partial<PlayerProfile>) => void;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
  onLogoFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: () => void;
}

export const PlayerDetailsPanel: React.FC<PlayerDetailsPanelProps> = ({
  activeProfile, updateActiveProfile, logoInputRef, onLogoFile, onRemoveLogo,
}) => (
              <div className="space-y-6">
             
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#18212D] dark:text-blue-400" />
                Player & Team Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-[#252D38]/40 p-4 rounded-xl border border-slate-200 dark:border-[#354050]">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1">
                    Player Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alex"
                    value={activeProfile.playerName}
                    onChange={(e) => updateActiveProfile({ playerName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#18212D] dark:focus:ring-[#00D7BC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1">
                    Primary Team Name
                  </label>
                  <input
                    type="text"
                    value={activeProfile.teams?.find((team) => team.isDefault)?.name || activeProfile.teamName || ''}
                    readOnly
                    aria-describedby="primary-team-help"
                    placeholder="Choose a primary team in Teams"
                    className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-semibold text-slate-600 dark:border-[#354050] dark:bg-[#252D38]/70 dark:text-[#D1D5DB]"
                  />
                  <p id="primary-team-help" className="mt-1 text-[10px] text-slate-500 dark:text-[#9CA3AF]">
                    Set or change the primary team in the Teams section.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1">
                    Jersey Number (Primary Team)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 24"
                    value={activeProfile.jerseyNumber || ''}
                    onChange={(e) => updateActiveProfile({ jerseyNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#18212D] dark:focus:ring-[#00D7BC]"
                  />
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-[#9CA3AF]">
                    Saved with primary team. You can set a different jersey number for each team in the Teams section.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <div className="mb-2">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1">
                      Fielding Positions (Optional)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-xl border border-slate-200 dark:border-[#354050] bg-white dark:bg-[#252D38] p-3">
                      {FIELDING_POSITION_OPTIONS.map((position) => {
                        const selected = activeProfile.fieldingPositions || [];
                        const checked = selected.includes(position.value);
                        return (
                          <label key={position.value} className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700 dark:text-[#D1D5DB]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => updateActiveProfile({
                                fieldingPositions: checked
                                  ? selected.filter((value) => value !== position.value)
                                  : [...selected, position.value],
                              })}
                              className="h-4 w-4 shrink-0 accent-[#00BFA5] dark:accent-[#00D7BC]"
                            />
                            <span>{position.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-[#9CA3AF]">
                      Select any positions that apply. Uncheck all to remove them.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1">
                        Batting (Optional)
                      </label>
                      <ThemedDropdown
                        value={activeProfile.battingSide}
                        onChange={(value) => updateActiveProfile({ battingSide: value })}
                        options={HANDEDNESS_OPTIONS}
                        placeholder="Choose batting side"
                        ariaLabel="Player batting side"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1">
                        Throwing Arm (Optional)
                      </label>
                      <ThemedDropdown
                        value={activeProfile.throwingArm}
                        onChange={(value) => updateActiveProfile({ throwingArm: value })}
                        options={HANDEDNESS_OPTIONS}
                        placeholder="Choose throwing arm"
                        ariaLabel="Player throwing arm"
                      />
                    </div>
                  </div>
                </div>
                {/* Custom logo */}
                <div className="sm:col-span-2 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-white dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] flex items-center justify-center shrink-0">
                    <img
                      src={activeProfile.logo || TeamIcon}
                      alt={activeProfile.logo ? 'Player logo' : 'Default team icon'}
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] mb-1">
                      Player Logo / Image
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] text-xs font-semibold flex items-center gap-1.5"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        {activeProfile.logo ? 'Change Logo' : 'Upload Logo'}
                      </button>
                      {activeProfile.logo && (
                        <button
                          type="button"
                          onClick={onRemoveLogo}
                          className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-600 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38]"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF] mt-1">
                      {activeProfile.logo ? 'Using your own logo.' : 'Using the default logo.'}
                    </p>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                      onChange={onLogoFile}
                      className="hidden"
                    />
                  </div>
                </div>
                <p className="sm:col-span-2 text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                  Stored only on this device. Custom logos are lost if app data is reset or the app is uninstalled.
                </p>
              </div>
            </div>
              </div>

);
