import React, { useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { DashboardTab } from './components/DashboardTab';
import { ScoreTab } from './components/ScoreTab';
import { GamesTab } from './components/GamesTab';
import { Navigation, TabId } from './components/Navigation';
import { HelpModal } from './components/HelpModal';
import { SettingsModal, SettingsSectionId } from './components/SettingsModal';
import { CrazyPlaysGuide } from './components/CrazyPlaysGuide';
import { SetupScreen } from './components/SetupScreen';
import { PlayMode } from './types/baseball';

const MainApp: React.FC = () => {
  const { isFirstTimeUser, setIsFirstTimeUser } = useGame();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [scoreView, setScoreView] = useState<'score' | 'plays'>('score');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpInitialMode, setHelpInitialMode] = useState<PlayMode>('batting');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSectionId>('playerDetails');
  const [isManualSetupOpen, setIsManualSetupOpen] = useState(false);

  const handleOpenSettings = (section: SettingsSectionId = 'playerDetails') => {
    setSettingsInitialSection(section);
    setIsSettingsOpen(true);
  };

  const handleOpenHelp = (mode?: PlayMode) => {
    if (mode) setHelpInitialMode(mode);
    setIsHelpOpen(true);
  };

  return (
    <div className="min-h-full flex flex-col bg-[#F4F6F8] dark:bg-[#101419] text-[#18212D] dark:text-[#FAFAFA]">
      {/* Top and Bottom Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => {
          // Tapping the Score tab always returns to the main scoring screen.
          if (tab === 'score') setScoreView('score');
          setActiveTab(tab);
        }}
        onOpenHelp={() => handleOpenHelp('batting')}
        onOpenSettings={handleOpenSettings}
      />

      {/* Main Tab Content */}
      <main className="flex-1 min-h-0 min-w-0 flex flex-col">
        {activeTab === 'dashboard' && (
          <DashboardTab
            onNavigateToScore={() => setActiveTab('score')}
            onOpenHelp={() => handleOpenHelp('batting')}
            onOpenSettings={() => handleOpenSettings()}
          />
        )}
        {activeTab === 'score' && (
          <ScoreTab
            onOpenHelp={(mode) => handleOpenHelp(mode)}
            onOpenSettings={() => handleOpenSettings()}
            onGameClosed={() => { setScoreView('score'); setActiveTab('dashboard'); }}
            view={scoreView}
            onChangeView={setScoreView}
          />
        )}
        {activeTab === 'games' && (
          <GamesTab onNavigateToScore={() => setActiveTab('score')} />
        )}
        {activeTab === 'crazyPlays' && <CrazyPlaysGuide />}
      </main>

      {/* Global Modals */}
      <HelpModal
        isOpen={isHelpOpen}
        initialMode={helpInitialMode}
        onClose={() => setIsHelpOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        initialSection={settingsInitialSection}
        onClose={() => setIsSettingsOpen(false)}
        onOpenSetupWizard={() => setIsManualSetupOpen(true)}
      />

      {/* First-Time User Setup Screen / Wizard */}
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
