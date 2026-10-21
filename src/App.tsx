import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import mobileSplashSrc from '../splash-source/splash-mobile.png';
import tabletSplashSrc from '../splash-source/splash-tablet.png';
import largeSplashSrc from '../splash-source/splash-large.png';
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
import { X, LayoutDashboard, UserPlus, Shield, Layers, Sliders, Palette, Users, Download, Bell, MapPin } from 'lucide-react';
import { AppLogo } from './components/AppLogo';
import { checkGameNotificationPermission, syncStoredGameReminders } from './utils/gameNotifications';
import { NotificationBlockedModal } from './components/NotificationBlockedModal';
import { StartGamePicker } from './components/StartGamePicker';

const MainApp: React.FC = () => {
  const { isFirstTimeUser, setIsFirstTimeUser, dismissResumePrompt, resumePromptPending, liveGame, settings, isLoading } = useGame();

  // On Android the full-screen splash artwork is the native launch window
  // background, visible through the transparent WebView from the first frame, so
  // nothing has to load or wait before the app replaces it.
  const isNativeLaunch = Capacitor.isNativePlatform();

  // Browser only: wait for the web splash image to load, and do not let a fast
  // localStorage restore reduce it to a flash (at least 1.2 seconds from mount).
  const [splashArtworkReady, setSplashArtworkReady] = useState(isNativeLaunch);
  const [minimumSplashTimeElapsed, setMinimumSplashTimeElapsed] = useState(isNativeLaunch);

  useEffect(() => {
    if (isNativeLaunch) return;
    const minimumDisplay = window.setTimeout(() => {
      setMinimumSplashTimeElapsed(true);
    }, 1200);
    return () => window.clearTimeout(minimumDisplay);
  }, [isNativeLaunch]);

  const markSplashArtworkReady = () => setSplashArtworkReady(true);

  const showSplash = isLoading || !splashArtworkReady || !minimumSplashTimeElapsed;

  // Make the page opaque again (index.html) in the same frame as the app's first
  // paint, so the app directly replaces the native splash artwork.
  useLayoutEffect(() => {
    if (!showSplash) document.documentElement.classList.remove('native-launch');
  }, [showSplash]);
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
  const [isStartGamePickerOpen, setIsStartGamePickerOpen] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const blockedDismissed = useRef(false);

  // If reminders are on but Android blocks notifications, ask once per app start.
  // When the user returns from system settings, re-check and close the prompt if fixed.
  useEffect(() => {
    if (settings.gameRemindersEnabled !== true) {
      setShowBlocked(false);
      return;
    }
    let disposed = false;
    const check = async () => {
      const ok = await checkGameNotificationPermission();
      if (disposed) return;
      if (ok) setShowBlocked(false);
      else if (!blockedDismissed.current) setShowBlocked(true);
    };
    void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [settings.gameRemindersEnabled]);

  // Android may remove scheduled alarms when exact-alarm access changes. Rebuild
  // reminders on launch and whenever the app returns to the foreground.
  useEffect(() => {
    const syncReminders = () => {
      void syncStoredGameReminders(settings.gameRemindersEnabled === true).catch(() => {
        // The Notifications settings panel shows status and a test button for recovery.
      });
    };
    syncReminders();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncReminders();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [settings.gameRemindersEnabled]);

  // Keep the complete app shell hidden until persisted data has loaded. Rendering
  // Navigation/dashboard first and replacing them after localStorage loads caused
  // visible startup movement and layout shifts on slower Android WebViews.
  if (showSplash) {
    // Android: render nothing, so the native splash artwork stays visible.
    if (isNativeLaunch) return null;
    return (
      <div
        className="fixed inset-0 h-full w-full overflow-hidden"
        style={{ backgroundColor: '#121923' }}
        aria-label="Loading Dugout Pulse"
      >
        <picture className="block h-full w-full">
          <source media="(min-width: 1024px) and (min-height: 600px)" srcSet={largeSplashSrc} />
          <source media="(min-width: 600px) and (min-height: 600px)" srcSet={tabletSplashSrc} />
          <img
            src={mobileSplashSrc}
            alt="Dugout Pulse"
            className="block h-full w-full object-cover landscape:object-contain"
            fetchPriority="high"
            decoding="sync"
            onLoad={markSplashArtworkReady}
            onError={markSplashArtworkReady}
            draggable={false}
          />
        </picture>
      </div>
    );
  }

  // The app hamburger opens only the sliding drawer. A settings page is opened only after selection.
  const handleOpenSettings = () => setIsSettingsMenuOpen(true);

  const handleSelectSettingsSection = (section: SettingsSectionId) => {
    setSettingsInitialSection(section);
    setIsSettingsMenuOpen(false);
    setIsSettingsOpen(true);
    setActiveTab('settings');
  };

  const handleStartGame = () => {
    if (liveGame) {
      setScoreView('score');
      setActiveTab('score');
      return;
    }
    setIsStartGamePickerOpen(true);
  };

  const handleLoadGameManually = () => {
    setIsStartGamePickerOpen(false);
    setScoreView('score');
    setActiveTab('score');
  };

  const handleOpenHelp = (mode?: PlayMode) => {
    if (mode) setHelpInitialMode(mode);
    setIsHelpOpen(true);
  };

  return (
      <div className="h-full overflow-hidden flex flex-col bg-[#F4F6F8] dark:bg-[#101419] text-[#18212D] dark:text-[#FAFAFA]">
      <NotificationBlockedModal
        isOpen={showBlocked}
        onClose={() => {
          blockedDismissed.current = true;
          setShowBlocked(false);
        }}
      />
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
            onNavigateToScore={handleStartGame}
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
          <GamesTab onNavigateToScore={() => { setScoreView('score'); setActiveTab('score'); }} />
        )}
      </main>
      </>

      <div className={`fixed inset-0 z-50 ${isSettingsMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!isSettingsMenuOpen}>
          <button
            type="button"
            tabIndex={isSettingsMenuOpen ? 0 : -1}
            aria-label="Close settings menu"
            onClick={() => setIsSettingsMenuOpen(false)}
            className={`absolute inset-0 bg-black/45 transition-opacity duration-300 ${isSettingsMenuOpen ? 'opacity-100' : 'opacity-0'}`}
          />
          <aside className={`absolute inset-y-0 left-0 z-10 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-[#F4F6F8] shadow-xl transition-transform duration-300 ease-out dark:border-[#354050] dark:bg-[#1A2028] ${isSettingsMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-label="Settings menu">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-[#354050]">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-[#18212D] dark:border-[#354050] dark:bg-[#252D38]">
                  <AppLogo variant="icon" className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold tracking-tight text-[#18212D] dark:text-[#FAFAFA]">DUGOUT PULSE</h2>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">Play for the love of it!</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsSettingsMenuOpen(false)} aria-label="Close settings menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]"><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3">
              <button
                type="button"
                onClick={() => {
                  setIsSettingsMenuOpen(false);
                  setIsSettingsOpen(false);
                  setActiveTab('dashboard');
                }}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${activeTab === 'dashboard' ? 'border-[#00BFA5] bg-[#E6FBF8] dark:border-[#00D7BC] dark:bg-[#252D38]' : 'border-slate-200 bg-white hover:border-[#00BFA5] hover:bg-slate-50 dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]'}`}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">Dashboard</span>
                  <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Your season at a glance</span>
                </span>
              </button>
              <div className="my-1 border-t border-slate-200 dark:border-[#354050]" />
              {([
                { id: 'playerDetails', label: 'Player Details', detail: 'Name and primary team', icon: UserPlus },
                { id: 'teams', label: 'Teams', detail: 'Add and manage teams', icon: Shield },
                { id: 'oppositionTeams', label: 'Opposition Teams', detail: 'Manage opponents and logos', icon: Shield },
                { id: 'teamLists', label: 'Team Setup Lists', detail: 'Seasons, tournaments, ages', icon: Layers },
                { id: 'venue', label: 'Venues', detail: 'Manage ballparks and fields', icon: MapPin },
                { id: 'scoring', label: 'Scoring', detail: 'Scoring rules', icon: Sliders },
                { id: 'displayTheme', label: 'Display', detail: 'App theme', icon: Palette },
                { id: 'notifications', label: 'Notifications', detail: 'Upcoming game reminders', icon: Bell },
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
            <div className="shrink-0 border-t border-slate-200 px-4 py-3 text-center dark:border-[#354050]">
              <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF]">© 2026 Dugout Pulse. All rights reserved.</p>
              <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF] opacity-75">Offline Scorekeeper • Build {__BUILD_ID__}</p>
            </div>
          </aside>
        </div>

      {isStartGamePickerOpen && (
        <StartGamePicker
          onClose={() => setIsStartGamePickerOpen(false)}
          onLoadManually={handleLoadGameManually}
          onGameSelected={() => {
            setScoreView('score');
            setActiveTab('score');
          }}
        />
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