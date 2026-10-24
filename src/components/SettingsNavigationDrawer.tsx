import React from 'react';
import {
  X, LayoutDashboard, UserRound, SlidersHorizontal, CalendarDays, ChevronDown,
  FileText, Settings2, PlayCircle, History, Users, Shield, Trophy, UsersRound,
  MapPin, Bell, ClipboardList, Palette, Database, UserCog, CalendarRange, Scale, Image,
} from 'lucide-react';
import type { Game, PlayerProfile } from '../types/baseball';
import type { TabId } from './Navigation';
import type { SettingsSectionId } from './SettingsModal';
import { AppLogo } from './AppLogo';

type GamesView = 'schedule' | 'past';
type MenuGroup = 'profile' | 'matches' | 'setup' | 'preferences' | 'legal' | null;

interface SettingsNavigationDrawerProps {
  isSettingsMenuOpen: boolean;
  setIsSettingsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeTab: TabId;
  setActiveTab: React.Dispatch<React.SetStateAction<TabId>>;
  expandedMenuGroup: MenuGroup;
  setExpandedMenuGroup: React.Dispatch<React.SetStateAction<MenuGroup>>;
  handleSelectSettingsSection: (section: SettingsSectionId) => void;
  gamesView: GamesView;
  setGamesView: React.Dispatch<React.SetStateAction<GamesView>>;
  handleStartGame: () => void;
  isPdfBusy: boolean;
  handleExportReport: () => void | Promise<void>;
  games: Game[];
  activeProfile: PlayerProfile;
}

export const SettingsNavigationDrawer: React.FC<SettingsNavigationDrawerProps> = ({
  isSettingsMenuOpen, setIsSettingsMenuOpen, setIsSettingsOpen, activeTab, setActiveTab,
  expandedMenuGroup, setExpandedMenuGroup, handleSelectSettingsSection, gamesView,
  setGamesView, handleStartGame, isPdfBusy, handleExportReport, games, activeProfile,
}) => {
  return (
      <div className={`fixed inset-0 z-50 ${isSettingsMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!isSettingsMenuOpen}>
        <button
          type="button"
          tabIndex={isSettingsMenuOpen ? 0 : -1}
          aria-label="Close navigation menu"
          onClick={() => setIsSettingsMenuOpen(false)}
          className={`absolute inset-0 bg-black/45 transition-opacity duration-300 ${isSettingsMenuOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <aside className={`absolute inset-y-0 left-0 z-10 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-[#F4F6F8] shadow-xl transition-transform duration-300 ease-out dark:border-[#354050] dark:bg-[#1A2028] ${isSettingsMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-label="Main navigation">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-[#354050]">
            <button type="button" onClick={() => { setIsSettingsMenuOpen(false); setIsSettingsOpen(false); setActiveTab('dashboard'); }} className="flex min-w-0 items-center gap-3 text-left" aria-label="Dugout Pulse dashboard">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-[#18212D] dark:border-[#354050] dark:bg-[#252D38]">
                <AppLogo variant="icon" className="h-full w-full object-contain" />
              </div>
              <span className="min-w-0">
                <span className="block text-sm font-semibold tracking-tight text-[#18212D] dark:text-[#FAFAFA]">DUGOUT PULSE</span>
                <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">Play for the love of it!</span>
              </span>
            </button>
            <button type="button" onClick={() => setIsSettingsMenuOpen(false)} aria-label="Close navigation menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:text-[#D1D5DB] dark:hover:bg-[#252D38]"><X className="h-5 w-5" /></button>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
            <button
              type="button"
              onClick={() => { setIsSettingsMenuOpen(false); setIsSettingsOpen(false); setActiveTab('dashboard'); }}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${activeTab === 'dashboard' ? 'border-[#00BFA5] bg-[#E6FBF8] dark:border-[#00D7BC] dark:bg-[#252D38]' : 'border-slate-200 bg-white hover:border-[#00BFA5] hover:bg-slate-50 dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]'}`}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">Dashboard</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Your season at a glance</span></span>
            </button>

            <button type="button" onClick={() => setExpandedMenuGroup((current) => current === 'profile' ? null : 'profile')} aria-expanded={expandedMenuGroup === 'profile'} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-[#00BFA5] dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]">
              <UserRound className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">Player Profile</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Player details, profiles and report</span></span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expandedMenuGroup === 'profile' ? 'rotate-180' : ''}`} />
            </button>
            {expandedMenuGroup === 'profile' && (
              <div className="ml-2 flex flex-col gap-1.5 rounded-xl border border-[#00BFA5]/20 bg-[#E8F8F5] p-2 shadow-inner dark:border-[#00D7BC]/20 dark:bg-[#172A2B]">
                <button type="button" onClick={() => handleSelectSettingsSection('playerDetails')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><UserCog className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Player Name &amp; Primary Team</button>
                <button type="button" onClick={() => handleSelectSettingsSection('players')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Users className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Other Profiles</button>
                <button type="button" disabled={isPdfBusy || !games.some((game) => !game.playerId || game.playerId === activeProfile.id)} onClick={() => void handleExportReport()} title={games.some((game) => !game.playerId || game.playerId === activeProfile.id) ? 'Export player statistics as a PDF' : 'Save a game before creating a report'} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><FileText className="h-3.5 w-3.5" />{isPdfBusy ? 'Creating Report…' : 'Export Report'}</button>
              </div>
            )}

            <button type="button" onClick={() => setExpandedMenuGroup((current) => current === 'matches' ? null : 'matches')} aria-expanded={expandedMenuGroup === 'matches'} className="mt-1 flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-[#00BFA5] dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]">
              <CalendarRange className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">Matches</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Schedule, manage and review games</span></span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expandedMenuGroup === 'matches' ? 'rotate-180' : ''}`} />
            </button>
            {expandedMenuGroup === 'matches' && (
              <div className="ml-2 flex flex-col gap-1.5 rounded-xl border border-[#00BFA5]/20 bg-[#E8F8F5] p-2 shadow-inner dark:border-[#00D7BC]/20 dark:bg-[#172A2B]">
                <button type="button" onClick={() => { setIsSettingsMenuOpen(false); setIsSettingsOpen(false); setGamesView('schedule'); setActiveTab('games'); }} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47] ${activeTab === 'games' && gamesView === 'schedule' ? 'border-[#00BFA5] bg-[#E6FBF8] text-[#006B5E] dark:border-[#00D7BC] dark:bg-[#252D38] dark:text-[#FAFAFA]' : 'border-slate-200/80 bg-white text-slate-700 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB]'}`}>
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Schedule
                </button>
                <button type="button" onClick={() => { setIsSettingsMenuOpen(false); setIsSettingsOpen(false); handleStartGame(); }} className="flex w-full items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]">
                  <PlayCircle className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Manage Matches
                </button>
                <button type="button" onClick={() => { setIsSettingsMenuOpen(false); setIsSettingsOpen(false); setGamesView('past'); setActiveTab('games'); }} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47] ${activeTab === 'games' && gamesView === 'past' ? 'border-[#00BFA5] bg-[#E6FBF8] text-[#006B5E] dark:border-[#00D7BC] dark:bg-[#252D38] dark:text-[#FAFAFA]' : 'border-slate-200/80 bg-white text-slate-700 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB]'}`}>
                  <History className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Past Matches
                </button>
              </div>
            )}

            <button type="button" onClick={() => setExpandedMenuGroup((current) => current === 'setup' ? null : 'setup')} aria-expanded={expandedMenuGroup === 'setup'} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-[#00BFA5] dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]">
              <Settings2 className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">Setup &amp; Settings</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Teams, opponents, seasons, venues and fields</span></span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expandedMenuGroup === 'setup' ? 'rotate-180' : ''}`} />
            </button>
            {expandedMenuGroup === 'setup' && (
              <div className="ml-2 flex flex-col gap-1.5 rounded-xl border border-[#00BFA5]/20 bg-[#E8F8F5] p-2 shadow-inner dark:border-[#00D7BC]/20 dark:bg-[#172A2B]">
                <button type="button" onClick={() => handleSelectSettingsSection('teams')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Users className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Teams (Player)</button>
                <button type="button" onClick={() => handleSelectSettingsSection('oppositionTeams')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Shield className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Opposition Teams</button>
                <button type="button" onClick={() => handleSelectSettingsSection('seasons')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]" ><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Seasons</button>
                <button type="button" onClick={() => handleSelectSettingsSection('tournaments')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Trophy className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Tournaments &amp; Leagues</button>
                <button type="button" onClick={() => handleSelectSettingsSection('ageGroups')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><UsersRound className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Age Groups</button>
                <button type="button" onClick={() => handleSelectSettingsSection('venue')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Venues</button>
                <button type="button" onClick={() => handleSelectSettingsSection('fields')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Fields</button>
              </div>
            )}

            <button type="button" onClick={() => setExpandedMenuGroup((current) => current === 'preferences' ? null : 'preferences')} aria-expanded={expandedMenuGroup === 'preferences'} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-[#00BFA5] dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">App Preferences</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Notifications, scoring, display and data</span></span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expandedMenuGroup === 'preferences' ? 'rotate-180' : ''}`} />
            </button>
            {expandedMenuGroup === 'preferences' && (
              <div className="ml-2 flex flex-col gap-1.5 rounded-xl border border-[#00BFA5]/20 bg-[#E8F8F5] p-2 shadow-inner dark:border-[#00D7BC]/20 dark:bg-[#172A2B]">
                <button type="button" onClick={() => handleSelectSettingsSection('notifications')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Bell className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Notifications</button>
                <button type="button" onClick={() => handleSelectSettingsSection('scoring')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><ClipboardList className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Scoring Settings</button>
                <button type="button" onClick={() => handleSelectSettingsSection('displayTheme')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Palette className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Theme</button>
                <button type="button" onClick={() => handleSelectSettingsSection('logoLibrary')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Image className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Team Logo Library</button>
                <button type="button" onClick={() => handleSelectSettingsSection('data')} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-[#00BFA5] hover:shadow dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB] dark:hover:border-[#00D7BC] dark:hover:bg-[#303A47]"><Database className="h-3.5 w-3.5 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />Data &amp; About</button>
              </div>
            )}

            {/* Legal links stay visible but inactive until approved policy destinations are configured. */}
            <div className="mt-2 border-t border-slate-200 pt-3 dark:border-[#354050]">
              <button
                type="button"
                onClick={() => setExpandedMenuGroup((current) => current === 'legal' ? null : 'legal')}
                aria-expanded={expandedMenuGroup === 'legal'}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-[#00BFA5] dark:border-[#354050] dark:bg-[#252D38] dark:hover:bg-[#354050]"
              >
                <Scale className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA]">Legal</span>
                  <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-[#9CA3AF]">Terms and privacy information</span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expandedMenuGroup === 'legal' ? 'rotate-180' : ''}`} />
              </button>
              {expandedMenuGroup === 'legal' && (
                <div className="ml-2 mt-1.5 flex flex-col gap-1.5 rounded-xl border border-[#00BFA5]/20 bg-[#E8F8F5] p-2 dark:border-[#00D7BC]/20 dark:bg-[#172A2B]" role="group" aria-label="Legal information">
                  <div title="Legal destination not configured" className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-xs font-semibold text-slate-500 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#9CA3AF]">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    Terms and Conditions
                  </div>
                  <div title="Legal destination not configured" className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-xs font-semibold text-slate-500 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#9CA3AF]">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    Privacy Policy
                  </div>
                </div>
              )}
            </div>

          </nav>

          <div className="shrink-0 border-t border-slate-200 px-4 py-3 text-center dark:border-[#354050]">
            <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF]">© 2026 Dugout Pulse. All rights reserved.</p>
            <p className="text-[10px] text-slate-500 dark:text-[#9CA3AF] opacity-75">Offline Scorekeeper • Build {__BUILD_ID__}</p>
          </div>
        </aside>
      </div>
  );
};
