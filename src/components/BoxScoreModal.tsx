import React, { useState } from 'react';
import { Game } from '../types/baseball';
import { calculateGameStats, formatRate, formatEraWhip, getInningPositions } from '../utils/stats';
import { getPlayLabel, getPlayShortLabel } from '../utils/playDefinitions';
import { Calendar, Clock, X, Award, Crosshair, Trophy } from 'lucide-react';
import { SprayChart } from './SprayChart';
import { getTrajectoryLabel, isHitPlay, resolveZone } from '../utils/sprayChart';

interface BoxScoreModalProps {
  game: Game | null;
  inningsPerGame: number;
  onClose: () => void;
  onEdit?: (gameId: string) => void;
  onShareCard?: (game: Game) => void;
}

interface BoxScoreDialogProps extends Omit<BoxScoreModalProps, 'game'> {
  game: Game;
}

const BoxScoreModalDialog: React.FC<BoxScoreDialogProps> = ({
  game,
  inningsPerGame,
  onClose,
  onEdit,
  onShareCard,
}) => {
  const [showSprayChart, setShowSprayChart] = useState(false);

  const stats = calculateGameStats(game, inningsPerGame);
  const { batting, pitching, fielding } = stats;

  const mappedBattingPlays = (game.plays || []).filter((p) => p.mode === 'batting' && p.hitLocation);
  const trackedHitsCount = mappedBattingPlays.filter((p) => isHitPlay(p.code)).length;
  const trackedOutsCount = mappedBattingPlays.filter((p) => !isHitPlay(p.code)).length;

  const positionsPlayed = Object.keys(game.fieldingPositions || {})
    .map(Number)
    .sort((a, b) => a - b)
    .map((inn) => ({ inn, positions: getInningPositions(game, inn).filter((pos) => pos !== 'BENCH') }))
    .filter(({ positions }) => positions.length > 0)
    .map(({ inn, positions }) => `Inn ${inn}: ${positions.join(' → ')}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-[#1A2028] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#354050] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#354050] flex items-center justify-between bg-slate-50 dark:bg-[#101419]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#007A6A] dark:text-[#00D7BC] block">
                Game Box Score
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] font-semibold">
                {game.innings} Inning{game.innings !== 1 ? 's' : ''}
              </span>
              {game.inningLineupSpots && Object.keys(game.inningLineupSpots).length > 0 ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-semibold">
                  Batting: {Object.entries(game.inningLineupSpots).map(([inn, spot]) => `Inn ${inn}: #${spot}`).join(', ')}
                </span>
              ) : game.lineupSpot ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-semibold">
                  #{game.lineupSpot} Spot
                </span>
              ) : null}
              {game.isHome !== undefined && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  game.isHome !== false
                    ? 'bg-blue-100 dark:bg-[#252D38] text-blue-800 dark:text-[#FAFAFA]'
                    : 'bg-teal-100 dark:bg-[#252D38] text-teal-800 dark:text-[#FAFAFA]'
                }`}>
                  {game.isHome !== false ? 'Home' : 'Away'}
                </span>
              )}
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-[#FAFAFA] mt-0.5">
              {game.teamName || 'My Team'}{' '}
              <span className="text-[#007A6A] dark:text-[#00D7BC] font-semibold">{game.isHome !== false ? 'vs' : '@'}</span>{' '}
              {game.opponent || 'Opponent'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 dark:text-[#9CA3AF] hover:text-slate-600 dark:hover:text-[#FAFAFA]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Game metadata strip */}
        <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-[#101419]/70 border-b border-slate-200 dark:border-[#354050] flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600 dark:text-[#9CA3AF]">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-[#9CA3AF]" />
            <span>{game.date}</span>
          </div>
          {game.time && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-[#9CA3AF]" />
              <span>{game.time}</span>
            </div>
          )}
          {game.ageGroup && (
            <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-[#252D38] text-blue-800 dark:text-[#FAFAFA] font-semibold">
              {game.ageGroup}
            </span>
          )}
          {game.season && (
            <span className="px-2 py-0.5 rounded-md bg-teal-100 dark:bg-[#252D38] text-teal-800 dark:text-[#FAFAFA] font-semibold">
              {game.season}
            </span>
          )}
          {game.tournament && (
            <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-[#252D38] text-blue-800 dark:text-[#FAFAFA] font-semibold flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 shrink-0" /> {game.tournament}
            </span>
          )}
          {game.benchInnings.length > 0 && (
            <span className="text-blue-600 dark:text-blue-400">
              Benched Innings: {game.benchInnings.join(', ')}
            </span>
          )}
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Batting Line */}
          <div className="bg-slate-50 dark:bg-[#252D38] rounded-xl p-4 border border-slate-200 dark:border-[#354050]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#18212D] dark:text-[#FAFAFA]">
                Batting Performance
              </h3>
              <span className="text-xs font-mono font-semibold text-slate-500 dark:text-[#9CA3AF]">
                {batting.h}-for-{batting.ab}
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 text-center text-xs">
              <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">AVG</div>
                <div className="font-extrabold text-[#007A6A] dark:text-[#00D7BC]">{formatRate(batting.avg)}</div>
              </div>
              <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">H</div>
                <div className="font-extrabold text-slate-900 dark:text-[#FAFAFA]">{batting.h}</div>
              </div>
              <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">HR</div>
                <div className="font-extrabold text-slate-900 dark:text-[#FAFAFA]">{batting.hr}</div>
              </div>
              <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">RBI</div>
                <div className="font-extrabold text-slate-900 dark:text-[#FAFAFA]">{batting.rbi}</div>
              </div>
              <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">R</div>
                <div className="font-extrabold text-slate-900 dark:text-[#FAFAFA]">{batting.r}</div>
              </div>
              <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">BB</div>
                <div className="font-extrabold text-slate-900 dark:text-[#FAFAFA]">{batting.bb}</div>
              </div>
              <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">SO</div>
                <div className="font-extrabold text-slate-900 dark:text-[#FAFAFA]">{batting.so}</div>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-[#354050] flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-[#D1D5DB]">
              <span><strong>OBP:</strong> {formatRate(batting.obp)}</span>
              <span><strong>SLG:</strong> {formatRate(batting.slg)}</span>
              <span><strong>OPS:</strong> {formatRate(batting.ops)}</span>
              <span><strong>SB:</strong> {batting.sb}</span>
              <span><strong>CS:</strong> {batting.cs}</span>
              <span><strong>HBP:</strong> {batting.hbp}</span>
              <span><strong>SF:</strong> {batting.sf}</span>
              <span><strong>IBB:</strong> {batting.ibb}</span>
              <span><strong>2B:</strong> {batting.doubles}</span>
              <span><strong>3B:</strong> {batting.triples}</span>
              <span><strong>TB:</strong> {batting.tb}</span>
              <span><strong>SH:</strong> {batting.sh}</span>
              <span><strong>ROE:</strong> {batting.roe}</span>
              <span><strong>FC:</strong> {batting.fc}</span>
              <span><strong>GIDP:</strong> {batting.gidp}</span>
            </div>
          </div>

          {/* Pitching & Fielding Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* Pitching */}
            <div className="bg-slate-50 dark:bg-[#252D38] rounded-xl p-4 border border-slate-200 dark:border-[#354050]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#18212D] dark:text-[#FAFAFA]">
                  Pitching Line
                </h3>
                {pitching.pitches > 0 && (
                  <span className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC]">
                    {pitching.pitches} Pitches ({pitching.restDaysRequired}d rest)
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                  <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">IP</div>
                  <div className="font-extrabold text-slate-900 dark:text-[#FAFAFA]">{pitching.ipDisplay}</div>
                </div>
                <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                  <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">K</div>
                  <div className="font-extrabold text-slate-900 dark:text-[#FAFAFA]">{pitching.k}</div>
                </div>
                <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                  <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">ER</div>
                  <div className="font-extrabold text-slate-900 dark:text-[#FAFAFA]">{pitching.er}</div>
                </div>
                <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                  <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">ERA</div>
                  <div className="font-extrabold text-slate-900 dark:text-[#FAFAFA]">{formatEraWhip(pitching.era)}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-[#D1D5DB] flex flex-wrap gap-x-3 gap-y-1">
                <span>R: {pitching.r}</span>
                <span>H: {pitching.h}</span>
                <span>HR: {pitching.hr}</span>
                <span>BB: {pitching.bb}</span>
                <span>IBB: {pitching.ibb}</span>
                <span>HBP: {pitching.hbp}</span>
                <span>WP: {pitching.wp}</span>
                <span>BK: {pitching.bk}</span>
                <span>Strikes: {pitching.strikes}</span>
                <span>Balls: {pitching.balls}</span>
              </div>
            </div>

            {/* Fielding */}
            <div className="bg-slate-50 dark:bg-[#252D38] rounded-xl p-4 border border-slate-200 dark:border-[#354050]">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#18212D] dark:text-[#FAFAFA] mb-2">
                Fielding Line
              </h3>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                  <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">PO</div>
                  <div className="font-extrabold text-slate-900 dark:text-[#FAFAFA]">{fielding.po}</div>
                </div>
                <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                  <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">A</div>
                  <div className="font-extrabold text-slate-900 dark:text-[#FAFAFA]">{fielding.a}</div>
                </div>
                <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                  <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">E</div>
                  <div className="font-extrabold text-slate-900 dark:text-[#FAFAFA]">{fielding.e}</div>
                </div>
                <div className="p-2 bg-white dark:bg-[#1A2028] rounded-md border border-slate-200/80 dark:border-[#354050]">
                  <div className="text-slate-400 dark:text-[#9CA3AF] text-[10px] font-semibold">FPCT</div>
                  <div className="font-extrabold text-slate-900 dark:text-[#FAFAFA]">{formatRate(fielding.fpct)}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-[#D1D5DB] flex flex-wrap gap-x-3 gap-y-1">
                <span>DP: {fielding.dp}</span>
                <span>TP: {fielding.tp}</span>
                <span>PB: {fielding.pb}</span>
                <span>CS: {fielding.cs}</span>
                <span>SB allowed: {fielding.sbAllowed}</span>
              </div>
              {positionsPlayed.length > 0 && (
                <div className="mt-2 text-xs text-slate-500 dark:text-[#D1D5DB]">
                  Positions: {positionsPlayed.join(' · ')}
                </div>
              )}
            </div>
          </div>

          {/* Spray Chart Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
                Hit Spray Chart
              </h3>
              <button
                type="button"
                onClick={() => setShowSprayChart(!showSprayChart)}
                className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC] hover:underline flex items-center gap-1 transition-colors"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>
                  {showSprayChart
                    ? 'Hide Spray Chart'
                    : `View Spray Chart (${trackedHitsCount} hit${trackedHitsCount !== 1 ? 's' : ''}${trackedOutsCount > 0 ? `, ${trackedOutsCount} out${trackedOutsCount !== 1 ? 's' : ''}` : ''})`}
                </span>
              </button>
            </div>
            {showSprayChart && (
              <div className="p-3 bg-slate-50 dark:bg-[#101419] rounded-xl border border-slate-200 dark:border-[#354050] animate-in fade-in duration-150">
                <SprayChart
                  plays={game.plays}
                  heightClass="h-64 sm:h-72"
                  showFilters={true}
                  showStats={true}
                  showLegend={true}
                  title="Game Spray Chart"
                />
              </div>
            )}
          </div>

          {/* Full Play-by-Play List */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-2">
              Play-by-Play Log ({game.plays.length} plays)
            </h3>
            {game.plays.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-[#9CA3AF] italic">No plays were recorded in this game.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {game.plays.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className="flex items-center justify-between p-2 rounded-md bg-slate-50 dark:bg-[#1A2028] border border-slate-200/70 dark:border-[#354050] text-xs"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-slate-400 dark:text-[#9CA3AF] w-5">#{idx + 1}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] font-semibold text-[10px]">
                        Inn {p.inning}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-[#FAFAFA]">
                        {getPlayLabel(p.code, p.mode)}
                      </span>
                      {p.pitcherHand && (
                        <span className="text-[10px] text-slate-400 dark:text-[#9CA3AF]">vs {p.pitcherHand}HP</span>
                      )}
                      {p.hitLocation && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 dark:bg-[#101419] text-[10px] font-semibold text-teal-700 dark:text-[#FAFAFA] border border-teal-200 dark:border-[#354050]">
                          <Crosshair className="w-2.5 h-2.5 text-[#007A6A] dark:text-[#00D7BC]" />
                          <span>{resolveZone(p.hitLocation)}</span>
                          {p.hitLocation.trajectory && (
                            <span className="opacity-75">· {getTrajectoryLabel(p.hitLocation.trajectory)}</span>
                          )}
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-semibold text-[11px] px-2 py-0.5 rounded bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] ">
                      {getPlayShortLabel(p.code)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#101419] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onShareCard && (
              <button
                type="button"
                onClick={() => onShareCard(game)}
                className="px-4 py-2 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Award className="w-3.5 h-3.5" />
                Share Recap Card
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(game.id);
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#465160] text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] hover:bg-slate-200/50 dark:hover:bg-[#2D3643] transition-colors"
              >
                Edit Game
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export const BoxScoreModal: React.FC<BoxScoreModalProps> = (props) => {
  if (!props.game) return null;
  return <BoxScoreModalDialog {...props} game={props.game} />;
};