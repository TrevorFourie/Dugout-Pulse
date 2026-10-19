import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import {
  LayoutDashboard,
  CircleDot,
  History,
  BookOpen,
  FileText,
  Loader2,
  Menu,
  BarChart3,
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { exportStatsPdf } from '../utils/pdfReport';
import defaultLogoSrc from '../assets/dugout-pulse-logo.png?inline';

export type TabId = 'dashboard' | 'score' | 'games' | 'crazyPlays' | 'stats';

interface NavigationProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onOpenHelp: () => void;
  onOpenSettings: (section?: 'playerDetails' | 'teams' | 'teamLists' | 'scoring' | 'players' | 'data') => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onOpenHelp,
  onOpenSettings,
}) => {
  const { liveGame, games, activeProfile, settings } = useGame();
  const [isPdfBusy, setIsPdfBusy] = useState(false);
  const playerGames = games.filter((game) => !game.playerId || game.playerId === activeProfile.id);

  const handleExportPdf = async () => {
    if (isPdfBusy || playerGames.length === 0) return;

    setIsPdfBusy(true);
    await exportStatsPdf({
      games: playerGames,
      profile: activeProfile,
      inningsPerGame: settings.inningsPerGame,
      filterLabel: 'All games',
      logoDataUrl: activeProfile.logo || defaultLogoSrc,
    });
    setIsPdfBusy(false);
  };

  return (
    <>
      {/* Top App Header */}
      <header
        className={`sticky top-0 z-30 bg-[#F4F6F8]/95 dark:bg-[#101419]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-[#354050] px-4 ${activeTab === 'score' ? 'py-1' : 'py-2.5'}`}
        style={{ paddingTop: activeTab === 'score' ? 'max(0.35rem, env(safe-area-inset-top))' : 'max(0.625rem, env(safe-area-inset-top))' }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-1.5 cursor-pointer group"
          >
            <div
              className="w-9 h-9 rounded-xl overflow-hidden bg-[#18212D] dark:bg-[#252D38] flex items-center justify-center shadow-xs border border-slate-200 dark:border-[#354050] shrink-0 group-hover:scale-105 transition-transform"
              style={activeTab === 'score' ? { width: 30, height: 30, minWidth: 30 } : { width: 36, height: 36, minWidth: 36 }}
            >
              <AppLogo variant="icon" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-[#18212D] dark:text-[#FAFAFA] leading-none block">
                DUGOUT PULSE
              </span>
              <span className={`${activeTab === 'score' ? 'hidden' : 'block'} text-[10px] font-semibold text-slate-400 dark:text-[#9CA3AF] uppercase tracking-widest leading-tight`}>
                PLAY FOR THE LOVE OF IT!
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenHelp}
              className="p-1 flex items-center"
              title="Quick button guide"
            >
              <BookOpen className="w-5 h-5 text-[#007A6A] dark:text-[#00D7BC]" />
            </button>

            <button
              onClick={() => onOpenSettings()}
              className="p-1 flex items-center"
              title="Open Settings menu"
              aria-label="Open Settings menu"
            >
              <Menu className="w-5 h-5 text-[#007A6A] dark:text-[#00D7BC]" />
            </button>
          </div>
        </div>
      </header>

      {/* Bottom Sticky Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#F4F6F8]/95 dark:bg-[#101419]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#354050] pb-safe">
        <div className="max-w-md mx-auto grid grid-cols-5 p-1.5 gap-1">
          {/* Dashboard Tab */}
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
              activeTab === 'dashboard'
                ? 'bg-[#E6FBF8] dark:bg-[#252D38] text-[#006B5D] dark:text-[#00D7BC] border border-[#00BFA5]/40 dark:border-[#00D7BC]/40 shadow-none'
                : 'text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] font-semibold">Dashboard</span>
          </button>

          {/* Score Tab */}
          <button
            type="button"
            onClick={() => onSelectTab('score')}
            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center relative transition-all ${
              activeTab === 'score'
                ? 'bg-[#E6FBF8] dark:bg-[#252D38] text-[#006B5D] dark:text-[#00D7BC] border border-[#00BFA5]/40 dark:border-[#00D7BC]/40 shadow-none'
                : 'text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
            }`}
          >
            <div className="relative">
              <CircleDot className="w-5 h-5 mb-0.5" />
              {liveGame && (
                <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-[#00BFA5] dark:bg-[#00D7BC] ring-2 ring-white dark:ring-[#18212D] animate-pulse" />
              )}
            </div>
            <span className="text-[11px] font-semibold">
              {liveGame ? 'Scoring' : 'Score'}
            </span>
          </button>

          {/* Stats Tab */}
          <button
            type="button"
            onClick={() => onSelectTab('stats')}
            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
              activeTab === 'stats'
                ? 'bg-[#E6FBF8] dark:bg-[#252D38] text-[#006B5D] dark:text-[#00D7BC] border border-[#00BFA5]/40 dark:border-[#00D7BC]/40 shadow-none'
                : 'text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
            }`}
          >
            <BarChart3 className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] font-semibold">Stats</span>
          </button>

          {/* Games History Tab */}
          <button
            type="button"
            onClick={() => onSelectTab('games')}
            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center relative transition-all ${
              activeTab === 'games'
                ? 'bg-[#E6FBF8] dark:bg-[#252D38] text-[#006B5D] dark:text-[#00D7BC] border border-[#00BFA5]/40 dark:border-[#00D7BC]/40 shadow-none'
                : 'text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
            }`}
          >
            <div className="relative">
              <History className="w-5 h-5 mb-0.5" />
            </div>
            <span className="text-[11px] font-semibold">Games</span>
          </button>

          {/* PDF report */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isPdfBusy || playerGames.length === 0}
            aria-label="Create PDF stats report"
            className="py-2 px-1 rounded-xl flex flex-col items-center justify-center text-slate-500 transition-all hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#9CA3AF] dark:hover:text-[#FAFAFA]"
            title={playerGames.length === 0 ? 'Save a game before creating a report' : 'Create PDF stats report'}
          >
            {isPdfBusy ? <Loader2 className="w-5 h-5 mb-0.5 animate-spin" /> : <FileText className="w-5 h-5 mb-0.5" />}
            <span className="text-[11px] font-semibold">Report</span>
          </button>
        </div>
      </nav>
    </>
  );
};