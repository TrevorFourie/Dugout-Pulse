import React from 'react';
import { X } from 'lucide-react';
import type { Play } from '../../types/baseball';
import { SprayChart } from '../SprayChart';

interface GameSprayChartModalProps {
  isOpen: boolean;
  plays: Play[];
  title: string;
  onClose: () => void;
}

export const GameSprayChartModal: React.FC<GameSprayChartModalProps> = ({ isOpen, plays, title, onClose }) => (
  <>
        {/* Live Game Spray Chart Modal */}
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div
              className="w-full max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-[#1A2028] rounded-3xl shadow-2xl border border-slate-200 dark:border-[#354050] overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-labelledby="game-spray-title"
            >
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#354050] flex items-center justify-between bg-slate-50 dark:bg-[#252D38]/60">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00BFA5] dark:bg-[#00D7BC]" />
                  <h3 id="game-spray-title" className="font-semibold text-sm text-slate-900 dark:text-[#FAFAFA]">
                    Game Spray Chart
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-[#D1D5DB]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                <SprayChart
                  plays={plays}
                  heightClass="h-64 sm:h-72"
                  showFilters={true}
                  showStats={true}
                  showLegend={true}
                  title={title}
                />
              </div>
              <div className="p-3 border-t border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38]/60 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsGameSprayModalOpen(false)}
                  className="px-5 py-2 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] text-xs font-semibold hover:bg-[#00A892] dark:hover:bg-[#00C4AB] "
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
  </>
);
