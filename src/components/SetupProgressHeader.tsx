import React from 'react';
import { AppLogo } from './AppLogo';

type SetupStep = 1 | 2 | 3 | 4 | 5;

interface SetupProgressHeaderProps {
  step: SetupStep;
}

export const SetupProgressHeader: React.FC<SetupProgressHeaderProps> = ({ step }) => (
          <div className="bg-gradient-to-r from-[#18212D] via-[#1E293B] to-[#18212D] dark:from-[#101419] dark:via-[#1A2028] dark:to-[#101419] text-white p-5 border-b border-slate-700/50 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] flex items-center justify-center shadow-md">
                  <AppLogo variant="icon" className="w-6 h-6 object-contain" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#007A6A] block">
                    DUGOUT PULSE SETUP
                  </span>
                  <h1 className="text-lg font-semibold text-white tracking-tight">
                    Welcome to Fast Scorekeeping
                  </h1>
                </div>
              </div>
  
  
            </div>
  
            {/* 5-Step Visual Progress Bar */}
            <div className="mt-4 pt-3 border-t border-slate-700/40">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1.5">
                <span>Step {step} of 5</span>
                <span className="text-white">
                  {step === 1 && '1. Player Name'}
                  {step === 2 && '2. Age Group'}
                  {step === 3 && '3. Season'}
                  {step === 4 && '4. Tournament'}
                  {step === 5 && '5. Team & Link Options'}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 h-1.5 rounded-full overflow-hidden bg-slate-800">
                {[1, 2, 3, 4, 5].map((s) => (
                  <div
                    key={s}
                    className={`h-full rounded-full transition-all duration-300 ${
                      s <= step ? 'bg-[#00BFA5] dark:bg-[#00D7BC]' : 'bg-slate-700/60'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
);
