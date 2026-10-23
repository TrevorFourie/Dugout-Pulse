import React from 'react';
import type { PlayerProfile } from '../../types/baseball';
import TeamIcon from '../../assets/TeamIcon.png';
import { ImagePlus, UserPlus } from 'lucide-react';

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
