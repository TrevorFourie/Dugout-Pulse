import React, { useState } from 'react';
import { Game, PlayerProfile } from '../types/baseball';
import { calculateGameStats, formatRate, getInningPositions } from '../utils/stats';
import {
  Download,
  Share2,
  X,
  Check,
  Award,
  Sparkles,
  Calendar,
  Shield,
  Activity,
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { saveBase64File, shareText } from '../utils/saveFile';

interface ShareRecapModalProps {
  game: Game;
  profile: PlayerProfile;
  inningsPerGame: number;
  onClose: () => void;
}

export const ShareRecapModal: React.FC<ShareRecapModalProps> = ({
  game,
  profile,
  inningsPerGame,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const stats = calculateGameStats(game, inningsPerGame);
  const { batting, pitching, fielding } = stats;

  const playerName = profile.playerName || 'Player';
  const jerseyNumber = profile.jerseyNumber ? `#${profile.jerseyNumber}` : '';
  const teamName = game.teamName || profile.teamName || 'Dugout Pulse';
  const isHomeTeam = game.isHome !== false;
  const opponentDisplay = game.opponent
    ? (isHomeTeam ? `vs ${game.opponent}` : `@ ${game.opponent}`)
    : 'Game Day';

  // Positions played summary
  const positionsPlayed = Object.keys(game.fieldingPositions || {})
    .map(Number)
    .sort((a, b) => a - b)
    .map((inn) => ({ inn, positions: getInningPositions(game, inn).filter((pos) => pos !== 'BENCH') }))
    .filter(({ positions }) => positions.length > 0)
    .map(({ inn, positions }) => `Inn ${inn}: ${positions.join(' → ')}`);

  const hasPitching = pitching.outs > 0 || pitching.pitches > 0;
  const hasFielding = fielding.chances > 0 || positionsPlayed.length > 0;

  // Text summary for clipboard / SMS
  const generateTextSummary = () => {
    let text = `⚾ ${teamName} ${opponentDisplay} (${game.date})\n`;
    if (game.tournament || game.ageGroup || game.season) {
      const tags = [
        game.tournament ? `🏆 ${game.tournament}` : null,
        game.ageGroup ? `${game.ageGroup}` : null,
        game.season ? `${game.season}` : null,
      ].filter(Boolean).join(' · ');
      text += `📋 ${tags}\n`;
    }
    text += `👤 ${playerName} ${jerseyNumber}\n\n`;
    text += `🏏 BATTING: ${batting.h}-for-${batting.ab}`;
    if (batting.hr > 0) text += `, ${batting.hr} HR`;
    if (batting.doubles > 0) text += `, ${batting.doubles} 2B`;
    if (batting.triples > 0) text += `, ${batting.triples} 3B`;
    if (batting.rbi > 0) text += `, ${batting.rbi} RBI`;
    if (batting.r > 0) text += `, ${batting.r} R`;
    if (batting.bb > 0) text += `, ${batting.bb} BB`;
    if (batting.sb > 0) text += `, ${batting.sb} SB`;
    text += ` (AVG: ${formatRate(batting.avg)})\n`;

    if (hasPitching) {
      text += `🎯 PITCHING: ${pitching.ipDisplay} IP, ${pitching.k} K, ${pitching.er} ER, ${pitching.pitches} Pitches`;
      if (pitching.restDaysRequired > 0) {
        text += ` (${pitching.restDaysRequired} Days Rest Req.)`;
      }
      text += `\n`;
    }

    if (hasFielding) {
      text += `🧤 FIELDING: ${fielding.po} PO, ${fielding.a} A, ${fielding.e} E (FPCT: ${formatRate(fielding.fpct)})\n`;
      if (positionsPlayed.length > 0) {
        text += `Positions: ${positionsPlayed.join(' · ')}\n`;
      }
    }

    text += `\nTracked with Dugout Pulse Offline Scorekeeper`;
    return text;
  };

  const handleCopyText = async () => {
    const text = generateTextSummary();
    const result = await shareText(`${teamName} ${opponentDisplay} - ${playerName}`, text);
    if (result === 'shared') return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Generate and download High-Res Canvas Card
  const handleDownloadImage = async () => {
    setDownloading(true);
    const canvas = document.createElement('canvas');
    const width = 1080;
    const height = 1350;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setDownloading(false);
      return;
    }

    // 1. Background gradient (follows the app theme so the exported card matches what is on screen)
    const isDark = document.documentElement.classList.contains('dark');
    const mutedText = isDark ? '#9CA3AF' : '#94A3B8';
    const grad = ctx.createLinearGradient(0, 0, width, height);
    if (isDark) {
      grad.addColorStop(0, '#252D38');
      grad.addColorStop(0.5, '#252D38');
      grad.addColorStop(1, '#1A2028');
    } else {
      grad.addColorStop(0, '#101419');
      grad.addColorStop(0.5, '#18212D');
      grad.addColorStop(1, '#0B0F14');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. Subtle baseball seam curves
    ctx.strokeStyle = 'rgba(0, 215, 188, 0.25)';
    ctx.lineWidth = 6;
    ctx.setLineDash([14, 10]);

    ctx.beginPath();
    ctx.bezierCurveTo(80, 100, 240, 600, 80, 1250);
    ctx.stroke();

    ctx.beginPath();
    ctx.bezierCurveTo(1000, 100, 840, 600, 1000, 1250);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Header Card Container
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(60, 60, width - 120, 160, 24);
    ctx.fill();
    ctx.stroke();

    // Header text
    ctx.fillStyle = '#00BFA5';
    ctx.font = '900 20px system-ui, -apple-system, sans-serif';
    ctx.fillText('DUGOUT PULSE · GAME RECAP', 96, 110);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 48px system-ui, -apple-system, sans-serif';
    ctx.fillText(teamName.toUpperCase(), 96, 165);

    ctx.fillStyle = mutedText;
    ctx.font = '700 24px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${opponentDisplay}  ·  ${game.date}`, 96, 198);

    // 4. Player Showcase Banner
    ctx.fillStyle = '#00BFA5';
    ctx.beginPath();
    ctx.roundRect(60, 250, width - 120, 120, 20);
    ctx.fill();

    ctx.fillStyle = '#18212D';
    ctx.font = '900 52px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${playerName} ${jerseyNumber}`, 96, 328);

    if (game.lineupSpot) {
      ctx.fillStyle = '#0B4A41';
      ctx.font = '700 24px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Batting Spot #${game.lineupSpot}`, width - 360, 324);
    }

    // 5. Batting Stat Strip
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.roundRect(60, 400, width - 120, 250, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '800 20px system-ui, -apple-system, sans-serif';
    ctx.fillText('BATTING PERFORMANCE', 96, 442);

    // Stat columns: H-AB, AVG, HR, RBI, R, OPS
    const battingItems = [
      { label: 'H - AB', val: `${batting.h} - ${batting.ab}`, highlight: true },
      { label: 'AVG', val: formatRate(batting.avg), highlight: false },
      { label: 'HR', val: batting.hr.toString(), highlight: batting.hr > 0 },
      { label: 'RBI', val: batting.rbi.toString(), highlight: batting.rbi > 0 },
      { label: 'RUNS', val: batting.r.toString(), highlight: batting.r > 0 },
      { label: 'OPS', val: formatRate(batting.ops), highlight: false },
    ];

    const colWidth = (width - 160) / 6;
    battingItems.forEach((item, idx) => {
      const x = 80 + idx * colWidth + colWidth / 2;
      ctx.textAlign = 'center';

      ctx.fillStyle = item.highlight ? '#00D7BC' : '#FFFFFF';
      ctx.font = '900 44px system-ui, -apple-system, sans-serif';
      ctx.fillText(item.val, x, 530);

      ctx.fillStyle = mutedText;
      ctx.font = '700 18px system-ui, -apple-system, sans-serif';
      ctx.fillText(item.label, x, 580);
    });

    // 6. Pitching & Fielding Side-by-Side
    let currentY = 680;

    if (hasPitching) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.roundRect(60, currentY, width - 120, 210, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#3478FF';
      ctx.font = '800 20px system-ui, -apple-system, sans-serif';
      ctx.fillText('PITCHING STATS & REST DAYS', 96, currentY + 42);

      const pitchingItems = [
        { label: 'INNINGS', val: pitching.ipDisplay },
        { label: 'STRIKEOUTS', val: pitching.k.toString() },
        { label: 'EARNED RUNS', val: pitching.er.toString() },
        { label: 'PITCHES', val: pitching.pitches.toString() },
        {
          label: 'REST REQUIRED',
          val: `${pitching.restDaysRequired} Day${pitching.restDaysRequired === 1 ? '' : 's'}`,
        },
      ];

      const pColWidth = (width - 160) / 5;
      pitchingItems.forEach((item, idx) => {
        const x = 80 + idx * pColWidth + pColWidth / 2;
        ctx.textAlign = 'center';

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 38px system-ui, -apple-system, sans-serif';
        ctx.fillText(item.val, x, currentY + 115);

        ctx.fillStyle = mutedText;
        ctx.font = '700 17px system-ui, -apple-system, sans-serif';
        ctx.fillText(item.label, x, currentY + 160);
      });

      currentY += 240;
    }

    if (hasFielding) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.roundRect(60, currentY, width - 120, 180, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00D7BC';
      ctx.font = '800 20px system-ui, -apple-system, sans-serif';
      ctx.fillText('DEFENSIVE FIELDING', 96, currentY + 40);

      const fieldingItems = [
        { label: 'PUTOUTS', val: fielding.po.toString() },
        { label: 'ASSISTS', val: fielding.a.toString() },
        { label: 'ERRORS', val: fielding.e.toString() },
        { label: 'FIELDING %', val: formatRate(fielding.fpct) },
      ];

      const fColWidth = (width - 160) / 4;
      fieldingItems.forEach((item, idx) => {
        const x = 80 + idx * fColWidth + fColWidth / 2;
        ctx.textAlign = 'center';

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 36px system-ui, -apple-system, sans-serif';
        ctx.fillText(item.val, x, currentY + 105);

        ctx.fillStyle = mutedText;
        ctx.font = '700 17px system-ui, -apple-system, sans-serif';
        ctx.fillText(item.label, x, currentY + 145);
      });

      currentY += 210;
    }

    // 7. Footer branding
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748B';
    ctx.font = '700 18px system-ui, -apple-system, sans-serif';
    ctx.fillText('RECORDED WITH DUGOUT PULSE · OFFLINE PERSONAL SCOREKEEPER', width / 2, height - 40);

    // Export image (browser download on web, share sheet on Android)
    const filename = `baseball-recap-${playerName.toLowerCase().replace(/\s+/g, '-')}-${game.date}.png`;
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    const ok = await saveBase64File(filename, base64, 'image/png');
    setDownloading(false);
    if (!ok) window.alert('Could not export the recap image. Please try again.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#18212D] dark:bg-[#1A2028] border border-slate-700/80 dark:border-[#354050] rounded-3xl max-w-xl w-full text-white shadow-2xl overflow-hidden my-auto">
        {/* Modal Top Actions */}
        <div className="p-4 sm:p-5 border-b border-slate-700/60 dark:border-[#354050] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-400" />
            <span className="font-extrabold text-sm sm:text-base tracking-tight">
              Game Recap Card
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 dark:hover:bg-[#354050] text-slate-400 dark:text-[#9CA3AF] dark:text-[#9CA3AF] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card Preview Container */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="bg-gradient-to-br from-[#1C2633] via-[#18212D] to-[#10161E] dark:bg-none dark:bg-[#252D38] border border-slate-700 dark:border-[#354050] rounded-2xl p-5 sm:p-6 space-y-5 shadow-inner relative overflow-hidden">
            {/* Header info */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-800 dark:bg-[#1A2028] border border-slate-700 dark:border-[#354050] flex items-center justify-center overflow-hidden shrink-0">
                  <AppLogo variant="logo" className="w-full h-full object-contain p-1" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-[#007A6A] dark:text-[#00D7BC] uppercase tracking-wider">
                    {teamName}
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-white leading-tight">
                    {opponentDisplay}
                  </h3>
                  <div className="text-xs text-slate-400 dark:text-[#9CA3AF] flex items-center gap-1.5 flex-wrap mt-0.5">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{game.date}</span>
                    </div>
                    <span>·</span>
                    <span>{game.innings} Innings</span>
                    {game.ageGroup && (
                      <span className="px-1.5 py-0.2 rounded bg-blue-900/60 text-blue-200 text-[10px] font-semibold">
                        {game.ageGroup}
                      </span>
                    )}
                    {game.season && (
                      <span className="px-1.5 py-0.2 rounded bg-teal-900/60 text-teal-200 text-[10px] font-semibold">
                        {game.season}
                      </span>
                    )}
                    {game.tournament && (
                      <span className="px-1.5 py-0.2 rounded bg-blue-900/60 text-blue-200 text-[10px] font-semibold">
                        🏆 {game.tournament}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {game.lineupSpot && (
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase font-semibold text-slate-400 dark:text-[#9CA3AF]">Batting Spot</div>
                  <div className="text-base font-semibold text-blue-400">#{game.lineupSpot}</div>
                </div>
              )}
            </div>

            {/* Player Banner */}
            <div className="bg-[linear-gradient(135deg,#1A2028_0%,#252D38_50%,#101419_100%)] border border-[rgba(56,61,68,0.4)] rounded-2xl overflow-hidden px-4 py-2.5 flex items-center justify-between text-white shadow-[0_20px_25px_-5px_rgb(0_0_0/0.10),0_8px_10px_-6px_rgb(0_0_0/0.10)]">
              <span className="text-base sm:text-lg font-semibold tracking-tight truncate">
                {playerName}
              </span>
              {jerseyNumber && (
                <span className="font-mono text-sm font-semibold bg-black/20 px-2 py-0.5 rounded-md">
                  {jerseyNumber}
                </span>
              )}
            </div>

            {/* Batting Stat Box */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-[#9CA3AF] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Batting Line</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-center bg-slate-900/80 dark:bg-[#1A2028] rounded-xl p-3 border border-slate-800 dark:border-[#354050]">
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-[#9CA3AF] uppercase">H - AB</div>
                  <div className="text-base sm:text-lg font-semibold text-blue-400">
                    {batting.h} - {batting.ab}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-[#9CA3AF] uppercase">AVG</div>
                  <div className="text-base sm:text-lg font-semibold text-white">
                    {formatRate(batting.avg)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-[#9CA3AF] uppercase">HR</div>
                  <div className="text-base sm:text-lg font-semibold text-teal-400">{batting.hr}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-[#9CA3AF] uppercase">RBI</div>
                  <div className="text-base sm:text-lg font-semibold text-teal-400">
                    {batting.rbi}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-[#9CA3AF] uppercase">RUNS</div>
                  <div className="text-base sm:text-lg font-semibold text-blue-400">{batting.r}</div>
                </div>
              </div>
            </div>

            {/* Pitching Box (if pitched) */}
            {hasPitching && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-[#9CA3AF] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                  <span>Pitching & Rest</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-center bg-slate-900/80 dark:bg-[#1A2028] rounded-xl p-3 border border-slate-800 dark:border-[#354050]">
                  <div>
                    <div className="text-[10px] font-semibold text-slate-400 dark:text-[#9CA3AF] uppercase">IP</div>
                    <div className="text-base font-semibold text-white">{pitching.ipDisplay}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-400 dark:text-[#9CA3AF] uppercase">K</div>
                    <div className="text-base font-semibold text-blue-400">{pitching.k}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-400 dark:text-[#9CA3AF] uppercase">PITCHES</div>
                    <div className="text-base font-semibold text-blue-400">{pitching.pitches}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-400 dark:text-[#9CA3AF] uppercase">REST</div>
                    <div className="text-xs font-semibold text-teal-400 mt-1">
                      {pitching.restDaysRequired}d Rest
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Defensive Positions */}
            {positionsPlayed.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-300 dark:text-[#D1D5DB] bg-slate-900/50 dark:bg-[#1A2028] px-3 py-2 rounded-md border border-slate-800 dark:border-[#354050]">
                <Shield className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span className="font-semibold text-slate-400 dark:text-[#9CA3AF]">Fielding:</span>
                <span className="truncate">{positionsPlayed.join(' · ')}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleDownloadImage}
              disabled={downloading}
              className="py-3 px-4 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Generating Image…' : 'Download Graphic (.PNG)'}</span>
            </button>

            <button
              onClick={handleCopyText}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-[#252D38] dark:hover:bg-[#354050] text-white font-extrabold text-sm flex items-center justify-center gap-2 border border-slate-700 dark:border-[#354050] transition-all active:scale-98"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-teal-400" />
                  <span className="text-teal-400">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-slate-300 dark:text-[#D1D5DB]" />
                  <span>Share / Copy Text</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};