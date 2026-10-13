import React, { useState } from 'react';
import { X, BookOpen, HelpCircle } from 'lucide-react';
import { PlayMode } from '../types/baseball';
import { getPlaysForMode } from '../utils/playDefinitions';

type GuideSection = 'scoring' | 'stats';

interface StatGuideEntry {
  name: string;
  meaning: string;
}

const STAT_GUIDE: Record<PlayMode, StatGuideEntry[]> = {
  batting: [
    { name: 'Games played (G)', meaning: 'How many games are included in these totals.' },
    { name: 'Plate appearances (PA)', meaning: 'Every finished turn batting. A walk, being hit by a pitch, and a sacrifice all count, even when the batter is not charged with an official at-bat.' },
    { name: 'At-bats (AB)', meaning: 'Official tries to get a hit. Walks, being hit by a pitch, and sacrifice plays do not count as at-bats.' },
    { name: 'Hits (H)', meaning: 'Times the batter safely reaches base on a hit: a single, double, triple, or home run. Reaching on an error is not a hit.' },
    { name: 'Singles, doubles, triples, home runs (1B, 2B, 3B, HR)', meaning: 'Hits where the batter reaches first, second, or third, or circles all the bases for a home run.' },
    { name: 'Total bases (TB)', meaning: 'A way to credit how far hits take the batter: one for a single, two for a double, three for a triple, and four for a home run.' },
    { name: 'Runs scored (R)', meaning: 'How many times the player reaches home plate and scores.' },
    { name: 'Runs batted in (RBI)', meaning: 'Runs that score because of the player’s hit or other batting action, as credited by the scorer.' },
    { name: 'Walks (BB)', meaning: 'Times the batter is awarded first base after the pitcher throws four balls. This total includes intentional walks.' },
    { name: 'Intentional walks (IBB)', meaning: 'Walks the other team deliberately gives the batter. These are also included in the total walks.' },
    { name: 'Strikeouts (SO)', meaning: 'Times the batter is called out or put out after reaching strike three.' },
    { name: 'Hit by pitch (HBP)', meaning: 'Times the batter is awarded first base after a pitch hits them.' },
    { name: 'Sacrifice fly (SF)', meaning: 'The batter hits a fly ball that is caught, allowing a runner to advance or score. It is not an at-bat.' },
    { name: 'Sacrifice bunt (SH)', meaning: 'The batter bunts to move a runner forward and is usually thrown out at first. It counts as a turn batting, but not an at-bat.' },
    { name: 'Reached on error (ROE)', meaning: 'The batter reaches base because a fielder mishandles a play. The scorer does not count it as a hit.' },
    { name: 'Fielder’s choice (FC)', meaning: 'The batter reaches base because the defense tries to get another runner out instead. The play counts as an at-bat.' },
    { name: 'Grounded into double play (GIDP)', meaning: 'The batter hits a ground ball and the defense gets two outs on the play.' },
    { name: 'Stolen base / caught stealing (SB / CS)', meaning: 'Bases the player steals successfully, and times the player is thrown or tagged out trying to steal.' },
    { name: 'Batting average (AVG)', meaning: 'How often a batter gets a hit in official at-bats: hits divided by at-bats. For example, .300 means about 3 hits for every 10 at-bats.' },
    { name: 'On-base percentage (OBP)', meaning: 'How often the batter reaches base through a hit, walk, or hit by pitch. Sacrifice flies are included in the opportunities; sacrifice bunts are left out.' },
    { name: 'Slugging percentage (SLG)', meaning: 'Total bases from hits divided by at-bats. Extra-base hits raise this number more than singles.' },
    { name: 'On-base plus slugging (OPS)', meaning: 'On-base percentage plus slugging percentage. It combines getting on base and hitting for power.' },
  ],
  pitching: [
    { name: 'Games pitched (G)', meaning: 'How many games are included in these pitching totals.' },
    { name: 'Innings pitched (IP)', meaning: 'How many outs the pitcher recorded, shown as innings and leftover outs. Three outs make an inning, so 4.2 means 4 innings and 2 outs.' },
    { name: 'Strikeouts (K)', meaning: 'Opposing batters the pitcher retired by getting strike three.' },
    { name: 'Hits / home runs allowed (H / HR)', meaning: 'Hits the pitcher gave up. Home runs are included in the hit total and are also shown separately.' },
    { name: 'Walks / intentional walks allowed (BB / IBB)', meaning: 'Batters sent to first after four balls. Intentional walks are included in walks and also have their own count.' },
    { name: 'Hit batters (HBP)', meaning: 'Opposing batters who were hit by a pitch and awarded first base.' },
    { name: 'Runs / earned runs allowed (R / ER)', meaning: 'Runs scored while the pitcher is responsible for the runner. The scorer decides whether each run was earned; earned runs are also part of total runs.' },
    { name: 'Earned run average (ERA)', meaning: 'Earned runs allowed, scaled to the game length selected in Settings. A lower number means fewer earned runs allowed per game-length of innings pitched.' },
    { name: 'Walks plus hits per inning (WHIP)', meaning: 'The average number of walks and hits the pitcher allows per inning. Hit batters are not included.' },
    { name: 'Wild pitches / balks (WP / BK)', meaning: 'Wild pitches are pitches the catcher cannot stop with ordinary effort; a balk is an illegal pitching motion. Both can let runners advance.' },
    { name: 'Pitch count', meaning: 'The number of pitches you explicitly record using Ball, Strike, Foul, or +1 Pitch. A strikeout or other result does not add pitches by itself.' },
    { name: 'Balls and strikes', meaning: 'Pitch-by-pitch totals you selected. Fouls are counted with strikes for the overall pitch totals.' },
    { name: 'Strike percentage', meaning: 'The share of recorded pitches marked as strikes, including fouls.' },
    { name: 'Required rest days', meaning: 'How many days the player should rest before pitching again, based on the day’s pitch count and the configured youth pitch-count guidelines.' },
  ],
  fielding: [
    { name: 'Games fielded (G)', meaning: 'How many games are included in these fielding totals.' },
    { name: 'Putouts (PO)', meaning: 'Outs the player completes directly, such as catching a fly ball, tagging a runner, or stepping on a base for a force out.' },
    { name: 'Assists (A)', meaning: 'Plays where the player helps get an out, usually by fielding the ball and throwing it to the teammate who completes the out.' },
    { name: 'Errors (E)', meaning: 'Plays the official scorer rules should have been made with ordinary effort, but a misplay lets a batter or runner advance.' },
    { name: 'Total chances (TC)', meaning: 'The defensive plays handled or missed: putouts plus assists plus errors.' },
    { name: 'Fielding percentage (FPCT)', meaning: 'The share of chances handled without an error: (putouts + assists) divided by total chances.' },
    { name: 'Double plays / triple plays (DP / TP)', meaning: 'Times the player takes part in a continuous play that gets two or three outs. Record their putout or assist as well.' },
    { name: 'Passed balls (PB)', meaning: 'As catcher, times a catchable pitch gets past the player and lets a runner advance.' },
    { name: 'Caught stealing (CS)', meaning: 'As catcher or fielder, times an opposing runner is thrown or tagged out while trying to steal.' },
    { name: 'Stolen bases allowed (SB allowed)', meaning: 'Opponent steals recorded while the player is catching.' },
    { name: 'Innings by position', meaning: 'Innings the player was assigned to each defensive position in the game.' },
  ],
};

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: PlayMode;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'batting',
}) => {
  const [activeTab, setActiveTab] = useState<PlayMode>(initialMode);
  const [guideSection, setGuideSection] = useState<GuideSection>('scoring');

  if (!isOpen) return null;

  const plays = getPlaysForMode(activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-[#1A2028] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#354050] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#354050] flex items-center justify-between bg-slate-50 dark:bg-[#1A2028]/80">
          <div className="flex items-center gap-1.5">
            <div className="p-2 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block">
                {guideSection === 'scoring' ? 'Scoring Guide' : 'Stats Guide'}
              </span>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA] leading-tight">
                {guideSection === 'scoring' ? 'What does each button mean?' : 'What does each stat mean?'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-[#D1D5DB] hover:bg-slate-200/50 dark:hover:bg-[#252D38] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-3 pb-2 bg-slate-100/70 dark:bg-[#252D38]/50 border-b border-slate-200 dark:border-[#354050]">
          <div className="flex rounded-xl bg-slate-200/80 dark:bg-[#1A2028] p-1 mb-2">
            {([
              { id: 'scoring', label: 'Scoring Guide' },
              { id: 'stats', label: 'Stats Guide' },
            ] as const).map((section) => (
              <button
                key={section.id}
                onClick={() => setGuideSection(section.id)}
                className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                  guideSection === section.id
                    ? 'bg-white dark:bg-[#252D38] text-[#18212D] dark:text-[#FAFAFA] shadow-xs'
                    : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {guideSection === 'scoring' && (
        <div className="px-5 pt-0 pb-2 bg-slate-100/70 dark:bg-[#252D38]/50 border-b border-slate-200 dark:border-[#354050]">
          <div className="flex rounded-xl bg-slate-200/80 dark:bg-[#1A2028] p-1">
            {(['batting', 'pitching', 'fielding'] as PlayMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setActiveTab(mode)}
                className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all ${
                  activeTab === mode
                    ? 'bg-white dark:bg-[#252D38] text-[#18212D] dark:text-[#FAFAFA] shadow-xs'
                    : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                }`}
              >
                {mode} ({getPlaysForMode(mode).length})
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Guide content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {guideSection === 'scoring' && plays.map((def) => {
            return (
              <div
                key={def.code}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/50 border border-slate-200 dark:border-[#354050]/60 hover:border-slate-300 dark:hover:border-[#465160] transition-colors"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="inline-flex items-center justify-center min-w-[44px] h-9 px-2.5 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] font-extrabold text-sm tracking-wide shadow-xs shrink-0">
                    {def.shortLabel}
                  </span>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-[#FAFAFA] flex items-center gap-2">
                      {def.fullLabel}
                      <span className="text-[10px] font-mono text-slate-400 font-normal">
                        code: {def.code}
                      </span>
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-slate-700 dark:text-[#D1D5DB] ml-0 sm:ml-[56px] leading-relaxed">
                  {def.description}
                </p>

                {def.example && (
                  <div className="mt-2 ml-0 sm:ml-[56px] px-2.5 py-1.5 rounded-md bg-white dark:bg-[#1A2028] border border-slate-200 dark:border-[#354050] flex items-start gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-[#007A6A] dark:text-[#00D7BC] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-600 dark:text-[#9CA3AF] italic">
                      <strong className="font-semibold not-italic text-slate-700 dark:text-[#D1D5DB]">
                        Example:
                      </strong>{' '}
                      {def.example}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          {guideSection === 'stats' && (
            <>
              <div className="flex rounded-xl bg-slate-200/80 dark:bg-[#1A2028] p-1">
                {(['batting', 'pitching', 'fielding'] as PlayMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setActiveTab(mode)}
                    className={`flex-1 py-2 text-xs font-semibold uppercase rounded-md transition-all ${
                      activeTab === mode
                        ? 'bg-white dark:bg-[#252D38] text-[#18212D] dark:text-[#FAFAFA] shadow-xs'
                        : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="space-y-2 pt-1">
                {STAT_GUIDE[activeTab].map((stat) => (
                  <div
                    key={stat.name}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/50 border border-slate-200 dark:border-[#354050]/60"
                  >
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-[#FAFAFA]">{stat.name}</h3>
                    <p className="text-xs text-slate-700 dark:text-[#D1D5DB] mt-1 leading-relaxed">{stat.meaning}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#1A2028]/80 flex items-center justify-between text-xs text-slate-500 dark:text-[#9CA3AF]">
          <span>{guideSection === 'scoring' ? 'All score events save instantly on your device.' : 'Totals are based on events recorded in the app.'}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] font-semibold text-xs hover:bg-[#00A892] dark:hover:bg-[#00C4AB] transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
