import React, { useEffect, useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { DashboardTab } from './components/DashboardTab';
import { StatsTab } from './components/StatsTab';
import { ScoreTab } from './components/ScoreTab';
import { GamesTab } from './components/GamesTab';
import { Navigation, TabId } from './components/Navigation';
import { HelpModal } from './components/HelpModal';
import { SettingsModal, SettingsSectionId } from './components/SettingsModal';
import { SetupScreen } from './components/SetupScreen';
import { PlayMode } from './types/baseball';
import { X, UserPlus, Shield, Layers, Sliders, Palette, Users, Download } from 'lucide-react';

const MainApp: React.FC = () => {
  const { isFirstTimeUser, setIsFirstTimeUser, dismissResumePrompt, resumePromptPending, liveGame } = useGame();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // A recovered in-progress game must be shown immediately on app startup.
  useEffect(() => {
    if (resumePromptPending && liveGame) {
      setScoreView('score');
      setActiveTab('score');
    }
  }, [resumePromptPending, liveGame]);
  const [scoreView, setScoreView] = useState<'score' | 'plays'>('score');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpInitialMode, setHelpInitialMode] = useState<PlayMode>('batting');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSectionId>('playerDetails');
  const [isManualSetupOpen, setIsManualSetupOpen] = useState(false);

  // The app hamburger opens only the sliding drawer. A settings page is opened only after selection.
  const handleOpenSettings = () => setIsSettingsMenuOpen(true);

  const handleSelectSettingsSection = (section: SettingsSectionId) => {
    setSettingsInitialSection(section);
    setIsSettingsMenuOpen(false);
    setIsSettingsOpen(true);
    setActiveTab('settings');
  };

  const handleOpenHelp = (mode?: PlayMode) => {
    if (mode) setHelpInitialMode(mode);
    setIsHelpOpen(true);
  };

  return (
      <div className="h-full overflow-hidden flex flex-col bg-[#F4F6F8] dark:bg-[#101419] text-[#18212D] dark:text-[#FAFAFA]">
      <>
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'score') setScoreView('score');
          setActiveTab(tab);
        }}
        onOpenHelp={() => handleOpenHelp('batting')}
        onOpenSettings={handleOpenSettings}
      />

      <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
        {activeTab === 'settings' && (
          <SettingsModal
            isOpen={isSettingsOpen}
            initialSection={settingsInitialSection}
            onClose={() => {
              setIsSettingsOpen(false);
              setActiveTab('dashboard');
            }}
            onOpenSetupWizard={() => setIsManualSetupOpen(true)}
          />
        )}
        {activeTab === 'dashboard' && (
          <DashboardTab
            onNavigateToScore={() => setActiveTab('score')}
            onNavigateToStats={() => setActiveTab('stats')}
            onOpenHelp={() => handleOpenHelp('batting')}
            onOpenSettings={() => handleOpenSettings()}
          />
        )}
        {activeTab === 'stats' && (
          <StatsTab
            onOpenHelp={() => handleOpenHelp('batting')}
            onOpenSettings={() => handleOpenSettings()}
          />
        )}
        <div
          className="flex-1 min-h-0 min-w-0 flex-col"
          style={{ display: activeTab === 'score' ? 'flex' : 'none' }}
          aria-hidden={activeTab !== 'score'}
        >
          <ScoreTab
            onOpenHelp={(mode) => handleOpenHelp(mode)}
            onOpenSettings={() => handleOpenSettings()}
            onGameClosed={() => { setScoreView('score'); setActiveTab('dashboard'); }}
            onCancelResume={() => { dismissResumePrompt(); setScoreView('score'); setActiveTab('dashboard'); }}
            view={scoreView}
            onChangeView={setScoreView}
          />
        </div>
        {activeTab === 'games' && (
          <GamesTab onNavigateToScore={() => setActiveTab('score')} />
        )}
      </main>
      </>

      {isSettingsMenuOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close settings menu"
            onClick={() => setIsSettingsMenuOpen(false)}
            className="absolute inset-0 bg-black/45"
          />
          <aside className="absolute inset-y-0 left-0 z-10 flex w-72 max-w-[85vw] animate-in slide-in-from-left duration-300 flex-col border-r border-slate-200 bg-[#F4F6F8] shadow-xl dark:border-[#354050] dark:bg-[#1A2028]" aria-label="Settings menu">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-[#354050]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC]">Dugout Pulse</p>
                <h2 className="text-base font-semibold text-[#18212D] dark:text-[#FAFAFA]">Settings</h2>
              </div>
              <button type="button" onClick={() => setIsSettingsMenuOpen(false)} aria-label="Close settings menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]"><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex flex-col gap-1.5 overflow-y-auto p-3">
              {([
                { id: 'playerDetails', label: 'Player Details', detail: 'Name and primary team', icon: UserPlus },
                { id: 'teams', label: 'Teams', detail: 'Add and manage teams', icon: Shield },
                { id: 'teamLists', label: 'Team Setup Lists', detail: 'Seasons, tournaments, ages', icon: Layers },
                { id: 'scoring', label: 'Scoring', detail: 'Scoring rules', icon: Sliders },
                { id: 'displayTheme', label: 'Display', detail: 'App theme', icon: Palette },
                { id: 'players', label: 'Profiles', detail: 'Manage player profiles', icon: Users },
                { id: 'data', label: 'Data & About', detail: 'Backup and app info', icon: Download },
              ] as const).map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} type="button" onClick={() => handleSelectSettingsSection(item.id)} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-[#00BFA5] hover:bg-slate-50 dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]">
                    <Icon className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
                    <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">{item.label}</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">{item.detail}</span></span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <HelpModal
        isOpen={isHelpOpen}
        initialMode={helpInitialMode}
        onClose={() => setIsHelpOpen(false)}
      />

      {(isFirstTimeUser || isManualSetupOpen) && (
        <SetupScreen
          onComplete={() => {
            setIsManualSetupOpen(false);
            setIsFirstTimeUser(false);
            setActiveTab('score');
          }}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <GameProvider>
      <MainApp />
    </GameProvider>
  );
}