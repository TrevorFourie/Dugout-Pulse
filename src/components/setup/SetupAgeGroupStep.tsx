import React from 'react';
import { Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { PRESET_AGE_GROUPS } from '../setupScreenConstants';

type SetupStep = 1 | 2 | 3 | 4 | 5;

interface SetupAgeGroupStepProps {
  step: SetupStep;
  playerName: string;
  ageGroup: string;
  setAgeGroup: (value: string) => void;
  customAgeGroup: string;
  setCustomAgeGroup: (value: string) => void;
  isCustomAge: boolean;
  setIsCustomAge: (value: boolean) => void;
  error: string | null;
  setError: (value: string | null) => void;
  setStep: (value: SetupStep) => void;
  handleNextFromAge: () => void;
}

export const SetupAgeGroupStep: React.FC<SetupAgeGroupStepProps> = ({
  step,
  playerName,
  ageGroup,
  setAgeGroup,
  customAgeGroup,
  setCustomAgeGroup,
  isCustomAge,
  setIsCustomAge,
  error,
  setError,
  setStep,
  handleNextFromAge,
}) => (
  <>
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block mb-1">
                  Step 2 of 5
                </span>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-[#FAFAFA]">
                  What age group does {playerName || 'your player'} play in?
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1">
                  Select their division. This helps tailor pitch count rest guidelines and game stats.
                </p>
              </div>

              {/* Age Group Grid */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {PRESET_AGE_GROUPS.map((group) => {
                    const isSelected = !isCustomAge && ageGroup === group;
                    return (
                      <button
                        key={group}
                        type="button"
                        onClick={() => {
                          setAgeGroup(group);
                          setIsCustomAge(false);
                          if (error) setError(null);
                        }}
                        className={`min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-transparent shadow-xs'
                            : 'bg-slate-50 dark:bg-[#252D38] text-slate-800 dark:text-[#D1D5DB] border-slate-200 dark:border-[#354050] hover:bg-slate-100 dark:hover:bg-[#2D3643]'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        <span>{group}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Age Option */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCustomAge(!isCustomAge)}
                    className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC] hover:underline flex items-center gap-1"
                  >
                    <span>{isCustomAge ? 'Use preset age group' : '+ Or enter custom age group (e.g. 13U Major)'}</span>
                  </button>

                  {isCustomAge && (
                    <div className="mt-2 animate-in fade-in duration-150">
                      <input
                        type="text"
                        autoFocus
                        placeholder="e.g. 11U Travel, JV, 13U AAA"
                        value={customAgeGroup}
                        onChange={(e) => {
                          setCustomAgeGroup(e.target.value);
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
                    setStep(1);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#D1D5DB] hover:bg-slate-100 dark:hover:bg-[#252D38] flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextFromAge}
                  className="px-5 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] font-semibold text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <span>Continue to Season</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}


  </>
);
