import React from 'react';
import { Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { PRESET_SEASONS } from '../setupScreenConstants';

type SetupStep = 1 | 2 | 3 | 4 | 5;

interface SetupSeasonStepProps {
  step: SetupStep;
  season: string;
  setSeason: (value: string) => void;
  customSeason: string;
  setCustomSeason: (value: string) => void;
  isCustomSeason: boolean;
  setIsCustomSeason: (value: boolean) => void;
  error: string | null;
  setError: (value: string | null) => void;
  setStep: (value: SetupStep) => void;
  handleNextFromSeason: () => void;
}

export const SetupSeasonStep: React.FC<SetupSeasonStepProps> = ({
  step,
  season,
  setSeason,
  customSeason,
  setCustomSeason,
  isCustomSeason,
  setIsCustomSeason,
  error,
  setError,
  setStep,
  handleNextFromSeason,
}) => (
  <>
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block mb-1">
                  Step 3 of 5
                </span>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-[#FAFAFA]">
                  Which season is this for?
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1">
                  Seasons keep games organized so you can view your player’s progress across spring, summer, or fall campaigns.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESET_SEASONS.map((s) => {
                    const isSelected = !isCustomSeason && season === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setSeason(s);
                          setIsCustomSeason(false);
                          if (error) setError(null);
                        }}
                        className={`min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-transparent shadow-xs'
                            : 'bg-slate-50 dark:bg-[#252D38] text-slate-800 dark:text-[#D1D5DB] border-slate-200 dark:border-[#354050] hover:bg-slate-100 dark:hover:bg-[#2D3643]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 opacity-70" />
                          <span>{s}</span>
                        </span>
                        {isSelected && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCustomSeason(!isCustomSeason)}
                    className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC] hover:underline flex items-center gap-1"
                  >
                    <span>{isCustomSeason ? 'Use preset season' : '+ Or enter custom season (e.g. Winter Showcase 2026)'}</span>
                  </button>

                  {isCustomSeason && (
                    <div className="mt-2 animate-in fade-in duration-150">
                      <input
                        type="text"
                        autoFocus
                        placeholder="e.g. Winter Dome 2026, Summer Travel"
                        value={customSeason}
                        onChange={(e) => {
                          setCustomSeason(e.target.value);
                          if (error) setError(null);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-300 dark:border-[#354050] text-sm font-semibold text-slate-900 dark:text-[#FAFAFA] focus:outline-hidden focus:ring-2 focus:ring-[#00BFA5]"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-[#354050]">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep(2);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextFromSeason}
                  className="px-5 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] font-semibold text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <span>Continue to Tournament</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}


  </>
);
