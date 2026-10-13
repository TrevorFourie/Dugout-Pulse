import React, { useState, useMemo, useRef } from 'react';
import { HitFieldZone, HitLocation, Play, PlayCode } from '../types/baseball';
import {
  calculateSprayStats,
  CENTER_HALF_ANGLE,
  INFIELD_CENTER,
  INFIELD_DIRT_RADIUS,
  infieldEdgeDistance,
  getDisplayZone,
  getPlayRunContext,
  getTrajectoryLabel,
  getZoneFromCoordinates,
  getZoneLabel,
  resolveZone,
  isBattedBallPlay,
  isHitPlay,
} from '../utils/sprayChart';
import { getPlayShortLabel } from '../utils/playDefinitions';
import { Crosshair, Info } from 'lucide-react';

// The field is drawn in a 300x300 coordinate space. hit x/y are stored as
// percentages of that 300x300 space. The visible window (VIEW_BOX) is cropped
// tight around the field so there is no dead space and no letterboxing.
const FIELD_SIZE = 300;
const VB = { x: 10, y: 10, w: 280, h: 262 };
const VIEW_BOX = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`;

// Field geometry: home plate (150,260), foul poles (28,138) / (272,138) on true 45-degree lines,
// and a smooth elliptical fence (centre field at y=26).
const FENCE_PATH = 'M 28 138 A 122 112 0 0 1 272 138';
const FIELD_PATH = 'M 150 260 L 28 138 A 122 112 0 0 1 272 138 Z';

// Zone geometry mirrors getZoneFromCoordinates(): polar bins around home plate (150,260).
const HOME = { x: 150, y: 260 };
const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: HOME.x + r * Math.sin(a), y: HOME.y - r * Math.cos(a) };
};
// A wedge between two bearings. A radius of 'edge' means the edge of the infield dirt circle.
type Radius = number | 'edge';
const wedge = (r1: Radius, r2: Radius, a1: number, a2: number) => {
  const steps = 16;
  const rad = (r: Radius, a: number) => (r === 'edge' ? infieldEdgeDistance(a) : r);
  const angles = Array.from({ length: steps + 1 }, (_, i) => a1 + ((a2 - a1) * i) / steps);
  const pts = [
    ...angles.map((a) => polar(rad(r2, a), a)),
    ...angles.slice().reverse().map((a) => polar(rad(r1, a), a)),
  ];
  return 'M ' + pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ') + ' Z';
};
type Wedge = [r1: Radius, r2: Radius, a1: number, a2: number];
const buildZone = (zone: HitFieldZone, wedges: Wedge[], labelR: number, labelDeg: number) => {
  const l = polar(labelR, labelDeg);
  return { zone, paths: wedges.map((w) => wedge(...w)), lx: l.x, ly: l.y, circle: 0 };
};
const CH = CENTER_HALF_ANGLE; // left | center | right dividing angle
const OF_OUT = 400; // clipped to the fence by the field clip path
const ZONE_SHAPES: { zone: HitFieldZone; paths: string[]; lx: number; ly: number; circle: number }[] = [
  buildZone('LF', [['edge', OF_OUT, -45, -CH]], 150, -30),
  buildZone('CF', [['edge', OF_OUT, -CH, CH]], 165, 0),
  buildZone('RF', [['edge', OF_OUT, CH, 45]], 150, 30),
  buildZone('3B', [[72, 'edge', -45, -20], [32, 72, -45, -20]], 82, -32.5),
  buildZone('SS', [[72, 'edge', -20, -2]], 82, -11),
  buildZone('2B', [[72, 'edge', -2, 20]], 82, 9),
  buildZone('1B', [[72, 'edge', 20, 45], [32, 72, 20, 45]], 82, 32.5),
  // Display only: the classifier gives the 16-20 degree slivers beside the mound to SS/2B,
  // but drawing them makes a noisy double line, so the Zones view folds them into P.
  buildZone('P', [[32, 72, -20, 20]], 52, 0),
  { zone: 'C', paths: [], lx: 150, ly: 238, circle: 32 },
];

interface SprayChartProps {
  plays?: Play[];
  // If in interactive tapper mode:
  interactive?: boolean;
  selectedLocation?: HitLocation | null;
  onSelectLocation?: (loc: HitLocation) => void;
  heightClass?: string;
  showFilters?: boolean;
  showStats?: boolean;
  showLegend?: boolean;
  showSelectionPill?: boolean;
  // 'dots' plots every ball; 'zones' shades field zones by how often balls land there.
  defaultView?: 'dots' | 'zones';
  showViewToggle?: boolean;
  title?: string;
  gameDate?: string;
  opponent?: string;
}

export const SprayChart: React.FC<SprayChartProps> = ({
  plays = [],
  interactive = false,
  selectedLocation = null,
  onSelectLocation,
  heightClass = 'aspect-[280/262] max-h-[75vh]',
  showFilters = false,
  showStats = false,
  showLegend = true,
  showSelectionPill = true,
  defaultView = 'dots',
  showViewToggle = false,
  title,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Filters for display mode
  const [filterResult, setFilterResult] = useState<
    'all' | 'hits' | 'rbiHits' | 'outs' | 'single' | 'double' | 'triple' | 'homeRun'
  >('all');
  const [filterHand, setFilterHand] = useState<'all' | 'R' | 'L'>('all');
  const [activeTooltipPlay, setActiveTooltipPlay] = useState<Play | null>(null);
  const [showHitExplainer, setShowHitExplainer] = useState(false);
  const [view, setView] = useState<'dots' | 'zones'>(defaultView);
  const [activeZone, setActiveZone] = useState<HitFieldZone | null>(null);
  const zonesMode = !interactive && view === 'zones';

  // Filtered plays for visualization
  const displayedPlays = useMemo(() => {
    return plays.filter((play) => {
      if (play.mode !== 'batting' || !isBattedBallPlay(play.code) || !play.hitLocation) {
        return false;
      }
      if (filterHand !== 'all' && play.pitcherHand !== filterHand) {
        return false;
      }
      if (filterResult === 'hits') return isHitPlay(play.code);
      if (filterResult === 'rbiHits') {
        const runCtx = getPlayRunContext(play, plays);
        return isHitPlay(play.code) && runCtx.broughtRunIn;
      }
      if (filterResult === 'outs') return !isHitPlay(play.code);
      if (filterResult !== 'all') return play.code === filterResult;
      return true;
    });
  }, [plays, filterResult, filterHand]);

  // Per-zone totals for the currently filtered plays (drives the Zones view)
  const zoneData = useMemo(() => {
    const counts: Partial<Record<HitFieldZone, { total: number; hits: number }>> = {};
    displayedPlays.forEach((play) => {
      const loc = play.hitLocation!;
      const zone = getDisplayZone(loc);
      const entry = counts[zone] || (counts[zone] = { total: 0, hits: 0 });
      entry.total++;
      if (isHitPlay(play.code)) entry.hits++;
    });
    const max = Math.max(1, ...Object.values(counts).map((c) => c!.total));
    return { counts, max };
  }, [displayedPlays]);

  // Shrink + soften dots as the chart fills up so a full season stays readable
  const crowded = displayedPlays.length > 30;
  const dotScale = displayedPlays.length > 80 ? 0.55 : crowded ? 0.7 : 1;

  // Overall statistics from all batted plays with location
  const stats = useMemo(() => {
    return calculateSprayStats(plays);
  }, [plays]);

  // Handle tap on SVG field.
  // Uses the SVG's own screen transform so the tap maps to the exact point in
  // the drawing, regardless of how the SVG is scaled or letterboxed.
  const handleFieldClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!interactive || !onSelectLocation || !svg) return;

    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(ctm.inverse());

    // Keep the marker inside the visible window
    const pad = 6;
    const ux = Math.max(VB.x + pad, Math.min(VB.x + VB.w - pad, local.x));
    const uy = Math.max(VB.y + pad, Math.min(VB.y + VB.h - pad, local.y));

    // Convert to the 0-100 percentage space used everywhere else
    const xPct = Math.round((ux / FIELD_SIZE) * 100);
    const yPct = Math.round((uy / FIELD_SIZE) * 100);

    const trajectory = selectedLocation?.trajectory || 'lineDrive';
    const zone = getZoneFromCoordinates(xPct, yPct);

    onSelectLocation({
      x: xPct,
      y: yPct,
      zone,
      trajectory,
    });
  };

  const getPlayColor = (code: PlayCode) => {
    switch (code) {
      case 'homeRun':
        return '#00D7BC'; // Teal
      case 'triple':
        return '#3478FF'; // Blue
      case 'double':
        return '#7FEBDD'; // Light teal
      case 'single':
        return '#A9C6FF'; // Light blue
      default:
        return '#94A3B8'; // Slate out
    }
  };

  return (
    <div className="flex flex-col w-full space-y-3">
      {/* Title & Filter Bar if enabled */}
      {(title || showFilters) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1">
          {title && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00BFA5] dark:bg-[#00D7BC]" />
              <h4 className="text-xs font-semibold text-slate-800 dark:text-[#FAFAFA]">
                {title}
              </h4>
            </div>
          )}

          {showFilters && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {/* View toggle: zone heat map vs. individual dots */}
              {showViewToggle && (
                <div className="inline-flex rounded-md bg-slate-100 dark:bg-[#252D38] p-0.5 border border-slate-200 dark:border-[#354050]">
                  {(['zones', 'dots'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setView(v);
                        setActiveZone(null);
                        setActiveTooltipPlay(null);
                      }}
                      className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                        view === v
                          ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-2xs'
                          : 'text-slate-600 dark:text-[#9CA3AF]'
                      }`}
                    >
                      {v === 'zones' ? 'Zones' : 'Dots'}
                    </button>
                  ))}
                </div>
              )}

              {/* Result filter pills */}
              <div className="inline-flex rounded-md bg-slate-100 dark:bg-[#252D38] p-0.5 border border-slate-200 dark:border-[#354050]">
                <button
                  type="button"
                  onClick={() => setFilterResult('all')}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                    filterResult === 'all'
                      ? 'bg-white dark:bg-[#354050] text-slate-900 dark:text-[#FAFAFA] shadow-2xs'
                      : 'text-slate-600 dark:text-[#9CA3AF]'
                  }`}
                >
                  All ({stats.totalWithLocation})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterResult('hits')}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                    filterResult === 'hits'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-[#9CA3AF]'
                  }`}
                >
                  Hits ({stats.hitsCount})
                </button>
                {stats.rbiHitsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterResult('rbiHits')}
                    className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${
                      filterResult === 'rbiHits'
                        ? 'bg-blue-500 text-slate-950 shadow-2xs'
                        : 'text-blue-700 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-950/40'
                    }`}
                    title="Show only the hits (already counted in Hits) that drove in a run"
                  >
                    <span>★</span>
                    <span>RBI Hits ({stats.rbiHitsCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFilterResult('outs')}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                    filterResult === 'outs'
                      ? 'bg-slate-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-[#9CA3AF]'
                  }`}
                >
                  Outs ({stats.outsCount})
                </button>
                {stats.zoneCounts && (
                  <button
                    type="button"
                    onClick={() => setFilterResult('homeRun')}
                    className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                      filterResult === 'homeRun'
                        ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-2xs'
                        : 'text-slate-600 dark:text-[#9CA3AF]'
                    }`}
                  >
                    HR
                  </button>
                )}
              </div>

              {/* Pitcher hand filter */}
              <div className="inline-flex rounded-md bg-slate-100 dark:bg-[#252D38] p-0.5 border border-slate-200 dark:border-[#354050]">
                <button
                  type="button"
                  onClick={() => setFilterHand('all')}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                    filterHand === 'all'
                      ? 'bg-white dark:bg-[#354050] text-slate-900 dark:text-[#FAFAFA] shadow-2xs'
                      : 'text-slate-600 dark:text-[#9CA3AF]'
                  }`}
                >
                  All Pitchers
                </button>
                <button
                  type="button"
                  onClick={() => setFilterHand('R')}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                    filterHand === 'R'
                      ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-2xs'
                      : 'text-slate-600 dark:text-[#9CA3AF]'
                  }`}
                >
                  vs RHP
                </button>
                <button
                  type="button"
                  onClick={() => setFilterHand('L')}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                    filterHand === 'L'
                      ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-2xs'
                      : 'text-slate-600 dark:text-[#9CA3AF]'
                  }`}
                >
                  vs LHP
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Educational Base Hits vs Runs Brought In Summary Bar */}
      {!interactive && stats.totalWithLocation > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/60 border border-slate-200 dark:border-[#354050]/70 text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-slate-700 dark:text-[#D1D5DB]">
            <span className="font-semibold text-slate-900 dark:text-[#FAFAFA]">
              {stats.hitsCount} Base Hit{stats.hitsCount !== 1 ? 's' : ''}
            </span>
            <span className="text-slate-400">·</span>
            {stats.rbiHitsCount > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-300">
                <span className="text-blue-500">★</span>
                <span>
                  {stats.rbiHitsCount === stats.hitsCount
                    ? stats.hitsCount === 1
                      ? `drove in ${stats.totalRbisOnHits} run${stats.totalRbisOnHits !== 1 ? 's' : ''} (${stats.totalRbisOnHits} RBI)`
                      : `all drove in runs (${stats.totalRbisOnHits} RBI)`
                    : `${stats.rbiHitsCount} of them drove in runs (${stats.totalRbisOnHits} RBI)`}
                </span>
              </span>
            ) : (
              <span className="text-slate-500 dark:text-[#9CA3AF]">
                no RBI
              </span>
            )}
            {stats.nonRbiHitsCount > 0 && stats.rbiHitsCount > 0 && (
              <>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 dark:text-[#9CA3AF]">
                  {stats.nonRbiHitsCount} with no run scored
                </span>
              </>
            )}
            {stats.outsCount > 0 && (
              <>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 dark:text-[#9CA3AF]">
                  {stats.outsCount} out{stats.outsCount !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowHitExplainer(!showHitExplainer)}
            className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC] hover:underline inline-flex items-center gap-1 self-start sm:self-auto shrink-0"
            title="Learn how Base Hits and Runs/RBIs work"
          >
            <Info className="w-3 h-3" />
            <span>{showHitExplainer ? 'Hide Note' : 'What do ★ and RBI mean?'}</span>
          </button>
        </div>
      )}

      {/* Explainer Collapsible Note */}
      {showHitExplainer && (
        <div className="p-3 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-950 dark:text-blue-200 space-y-1.5 animate-in fade-in duration-150">
          <div className="font-semibold flex items-center gap-1.5 text-blue-900 dark:text-blue-100">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Understanding Base Hits vs. Runs Brought In (RBI)</span>
          </div>
          <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-300">
            In baseball rules, any <strong>Single (1B), Double (2B), Triple (3B), or Home Run (HR)</strong> is recorded as a <strong>Base Hit</strong> because the batter struck the ball and reached base safely. A hit does <em>not</em> need to score a runner (for example, leading off an inning or when runners hold at 2nd or 3rd base).
          </p>
          <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-300">
            Hits that directly brought a runner across home plate are marked with a <strong className="text-blue-700 dark:text-blue-300">★ Star & Teal Halo</strong> and count as <strong>RBIs (Runs Batted In)</strong>.
          </p>
        </div>
      )}

      {/* Baseball Field SVG Container */}
      <div
        className={`relative w-full ${heightClass} rounded-2xl overflow-hidden select-none bg-gradient-to-b from-[#1b3d2b] to-[#122b1e] border border-slate-300 dark:border-[#354050] shadow-inner flex items-center justify-center`}
      >
        <svg
          ref={svgRef}
          viewBox={VIEW_BOX}
          className={`w-full h-full max-h-full ${interactive ? 'cursor-crosshair' : 'cursor-default'}`}
          onClick={handleFieldClick}
          preserveAspectRatio="xMidYMid meet"
          aria-label="Baseball spray chart diagram"
        >
          <defs>
            <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e5238" />
              <stop offset="100%" stopColor="#153d29" />
            </linearGradient>
            <linearGradient id="dirtGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bf8a59" />
              <stop offset="100%" stopColor="#a36e3c" />
            </linearGradient>
            <clipPath id="fieldClip">
              <path d={FIELD_PATH} />
            </clipPath>
          </defs>

          {/* Fair territory */}
          <path d={FIELD_PATH} fill="url(#grassGrad)" />

          {/* Warning track (stroke along the fence, clipped to fair territory) */}
          <g clipPath="url(#fieldClip)">
            <path d={FENCE_PATH} fill="none" stroke="#8d633d" strokeOpacity="0.85" strokeWidth="18" />
          </g>
          {/* Outfield wall */}
          <path d={FENCE_PATH} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />

          {/* Left / Center / Right dividing lines (same angles the zones use) */}
          {[-CENTER_HALF_ANGLE, CENTER_HALF_ANGLE].map((deg) => {
            const from = polar(infieldEdgeDistance(deg), deg);
            const to = polar(235, deg);
            return (
              <line
                key={deg}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Infield dirt: circle around the mound plus the home plate area */}
          <g clipPath="url(#fieldClip)">
            <circle cx={INFIELD_CENTER.x} cy={INFIELD_CENTER.y} r={INFIELD_DIRT_RADIUS} fill="url(#dirtGrad)" />
            <circle cx="150" cy="260" r="16" fill="url(#dirtGrad)" />
          </g>

          {/* Infield grass diamond */}
          <polygon points="150,247 186,213 150,178 114,213" fill="#1b4d34" />

          {/* Pitcher's mound + rubber */}
          <circle cx="150" cy="215" r="9" fill="url(#dirtGrad)" />
          <rect x="147" y="214" width="6" height="2" fill="#ffffff" />

          {/* Foul lines */}
          <line x1="150" y1="260" x2="28" y2="138" stroke="#ffffff" strokeWidth="2" />
          <line x1="150" y1="260" x2="272" y2="138" stroke="#ffffff" strokeWidth="2" />

          {/* Foul poles */}
          <circle cx="28" cy="138" r="3" fill="#FFFFFF" />
          <circle cx="272" cy="138" r="3" fill="#FFFFFF" />

          {/* Bases */}
          <rect x="190" y="210" width="7" height="7" fill="#ffffff" transform="rotate(45 193.5 213.5)" />
          <rect x="146.5" y="166.5" width="7" height="7" fill="#ffffff" transform="rotate(45 150 170)" />
          <rect x="103" y="210" width="7" height="7" fill="#ffffff" transform="rotate(45 106.5 213.5)" />
          <polygon points="146,256 154,256 154,260 150,264 146,260" fill="#ffffff" />

          {/* Direction Sector Labels on Fence */}
          <text x="58" y="48" fill="rgba(255,255,255,0.4)" fontSize="9" fontWeight="800" textAnchor="middle">
            LEFT
          </text>
          <text x="150" y="22" fill="rgba(255,255,255,0.4)" fontSize="9" fontWeight="800" textAnchor="middle">
            CENTER
          </text>
          <text x="242" y="48" fill="rgba(255,255,255,0.4)" fontSize="9" fontWeight="800" textAnchor="middle">
            RIGHT
          </text>

          {/* Position Guide Micro-Labels */}
          {!zonesMode && (
            <>
          <text x="68" y="105" fill="rgba(255,255,255,0.25)" fontSize="8" fontWeight="700" textAnchor="middle">LF</text>
          <text x="150" y="68" fill="rgba(255,255,255,0.25)" fontSize="8" fontWeight="700" textAnchor="middle">CF</text>
          <text x="232" y="105" fill="rgba(255,255,255,0.25)" fontSize="8" fontWeight="700" textAnchor="middle">RF</text>
          <text x="122" y="186" fill="rgba(255,255,255,0.3)" fontSize="7" fontWeight="700" textAnchor="middle">SS</text>
          <text x="178" y="186" fill="rgba(255,255,255,0.3)" fontSize="7" fontWeight="700" textAnchor="middle">2B</text>
          <text x="126" y="228" fill="rgba(255,255,255,0.3)" fontSize="7" fontWeight="700" textAnchor="middle">3B</text>
          <text x="174" y="228" fill="rgba(255,255,255,0.3)" fontSize="7" fontWeight="700" textAnchor="middle">1B</text>
            </>
          )}

          {/* Zones view: each field zone shaded by how many balls landed there */}
          {zonesMode && (
            <g clipPath="url(#fieldClip)">
              {ZONE_SHAPES.map((z) => {
                const c = zoneData.counts[z.zone];
                const total = c?.total || 0;
                const pct = displayedPlays.length > 0 ? Math.round((total / displayedPlays.length) * 100) : 0;
                const intensity = total > 0 ? 0.22 + 0.62 * (total / zoneData.max) : 0;
                const isActive = activeZone === z.zone;
                return (
                  <g
                    key={z.zone}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveZone(isActive ? null : z.zone);
                    }}
                    className="cursor-pointer"
                  >
                    {z.circle ? (
                      <circle cx={150} cy={260} r={z.circle} fill="#3478FF" fillOpacity={intensity}
                        stroke={isActive ? '#ffffff' : 'rgba(255,255,255,0.35)'} strokeWidth={isActive ? 2 : 1} />
                    ) : (
                      <>
                        {z.paths.map((d, i) => (
                          <path key={i} d={d} fill="#3478FF" fillOpacity={intensity}
                            stroke={isActive ? '#ffffff' : 'rgba(255,255,255,0.35)'} strokeWidth={isActive ? 2 : 1} />
                        ))}
                      </>
                    )}
                    <text x={z.lx} y={z.ly - 1} fill="rgba(255,255,255,0.75)" fontSize="7" fontWeight="800" textAnchor="middle" pointerEvents="none">
                      {z.zone}
                    </text>
                    {total > 0 && (
                      <>
                        <text x={z.lx} y={z.ly + 11} fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="middle" pointerEvents="none"
                          style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.45)', strokeWidth: 2.5 }}>
                          {total}
                        </text>
                        <text x={z.lx} y={z.ly + 20} fill="#ffffff" fontSize="7.5" fontWeight="800" textAnchor="middle" pointerEvents="none"
                          style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.45)', strokeWidth: 2 }}>
                          {pct}%
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Visualized Plays in Display Mode */}
          {!interactive && !zonesMode &&
            displayedPlays.map((play, index) => {
              if (!play.hitLocation) return null;
              const px = (play.hitLocation.x / 100) * FIELD_SIZE;
              const py = (play.hitLocation.y / 100) * FIELD_SIZE;
              const color = getPlayColor(play.code);
              const isHit = isHitPlay(play.code);
              const isHR = play.code === 'homeRun';
              const isSelected = activeTooltipPlay?.id === play.id;
              const runCtx = getPlayRunContext(play, plays);
              const isRbiHit = runCtx.broughtRunIn;

              return (
                <g
                  key={play.id || index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTooltipPlay(play);
                  }}
                  className="cursor-pointer transition-transform hover:scale-125"
                >
                  {/* Glowing teal halo for hits/plays that drove in runs (RBI) */}
                  {isRbiHit && (
                    <circle
                      cx={px}
                      cy={py}
                      r={(isSelected ? 13 : isHR ? 11 : 9.5) * dotScale}
                      fill="none"
                      stroke="#00D7BC"
                      strokeWidth="1.8"
                      strokeDasharray="2.5 1.5"
                      opacity="0.95"
                    />
                  )}

                  {/* Main Play Circle */}
                  <circle
                    cx={px}
                    cy={py}
                    r={isSelected ? 9 : (isHR ? 7 : 5.5) * dotScale}
                    fill={color}
                    fillOpacity={isSelected ? 0.95 : crowded ? 0.75 : 0.9}
                    stroke={isRbiHit ? '#00D7BC' : '#ffffff'}
                    strokeWidth={isSelected ? 2.5 : isRbiHit ? 2 : 1.2}
                  />

                  {/* Inner star for RBI hit */}
                  {isRbiHit ? (
                    <text
                      x={px}
                      y={py + 2.5 * dotScale}
                      fill="#FFFFFF"
                      fontSize={isHR ? '6' : '5'}
                      fontWeight="900"
                      textAnchor="middle"
                      pointerEvents="none"
                    >
                      ★
                    </text>
                  ) : !isHit && !crowded ? (
                    /* Subtle X for Outs */
                    <text
                      x={px}
                      y={py + 2 * dotScale}
                      fill="#FFFFFF"
                      fontSize="5"
                      fontWeight="900"
                      textAnchor="middle"
                      pointerEvents="none"
                    >
                      ✕
                    </text>
                  ) : !crowded ? (
                    /* Subtle center dot for non-scoring hits */
                    <circle cx={px} cy={py} r={isSelected ? 2.5 : 1.5} fill="#ffffff" />
                  ) : null}
                </g>
              );
            })}

          {/* Interactive Mode Target / Marker */}
          {interactive && selectedLocation && (
            <g className="animate-in fade-in zoom-in-50 duration-150">
              {/* Outer pulsing ring */}
              <circle
                cx={(selectedLocation.x / 100) * FIELD_SIZE}
                cy={(selectedLocation.y / 100) * FIELD_SIZE}
                r="11"
                fill="#00BFA5"
                fillOpacity="0.25"
                stroke="#00BFA5"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              {/* Center target circle */}
              <circle
                cx={(selectedLocation.x / 100) * FIELD_SIZE}
                cy={(selectedLocation.y / 100) * FIELD_SIZE}
                r="5.5"
                fill="#00BFA5"
                stroke="#ffffff"
                strokeWidth="2"
              />
              {/* Center crosshair */}
              <circle
                cx={(selectedLocation.x / 100) * FIELD_SIZE}
                cy={(selectedLocation.y / 100) * FIELD_SIZE}
                r="1.5"
                fill="#ffffff"
              />
            </g>
          )}
        </svg>

        {/* Empty state overlay when no plays logged */}
        {!interactive && displayedPlays.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-black/40 backdrop-blur-2xs">
            <Crosshair className="w-8 h-8 text-white/50 mb-1" />
            <p className="text-xs font-semibold text-white">No batted balls recorded yet</p>
            <p className="text-xs text-slate-300 max-w-xs mt-0.5">
              Turn on “Mark where the ball landed” while batting, and every hit will show up here.
            </p>
          </div>
        )}

        {/* Interactive Mode: Current Selection Overlay Pill */}
        {interactive && showSelectionPill && (
          <div className="absolute bottom-2 left-2 right-2 pointer-events-none flex justify-center">
            <div className="px-3 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-xs text-white text-xs font-semibold flex items-center gap-2 border border-white/20 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-[#00BFA5] dark:bg-[#00D7BC] animate-pulse" />
              {selectedLocation ? (
                <span>
                  {getZoneLabel(resolveZone(selectedLocation))} ({resolveZone(selectedLocation)}) ·{' '}
                  {getTrajectoryLabel(selectedLocation.trajectory)}
                </span>
              ) : (
                <span className="text-slate-300">Tap anywhere on the field to place hit</span>
              )}
            </div>
          </div>
        )}

        {/* Active Tooltip Popover in Display Mode */}
        {!interactive && activeTooltipPlay && activeTooltipPlay.hitLocation && (() => {
          const runCtx = getPlayRunContext(activeTooltipPlay, plays);
          const isHit = isHitPlay(activeTooltipPlay.code);
          return (
            <div
              className="absolute top-2 left-2 right-2 p-3 sm:p-3.5 rounded-2xl bg-slate-950/95 text-white text-xs border border-slate-700 shadow-2xl flex flex-col gap-2 z-20 animate-in fade-in duration-150"
              onClick={() => setActiveTooltipPlay(null)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded-md text-xs font-semibold "
                    style={{
                      backgroundColor: getPlayColor(activeTooltipPlay.code),
                      color: '#ffffff',
                    }}
                  >
                    {getPlayShortLabel(activeTooltipPlay.code)}
                  </span>
                  <span className="font-semibold text-sm text-white">
                    {getZoneLabel(resolveZone(activeTooltipPlay.hitLocation))}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-semibold">
                    {getTrajectoryLabel(activeTooltipPlay.hitLocation.trajectory)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTooltipPlay(null);
                  }}
                  className="text-slate-400 hover:text-white px-2 py-1 rounded bg-white/10 text-xs font-semibold"
                >
                  Dismiss
                </button>
              </div>

              {/* Run scoring / RBI impact indicator */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {runCtx.rbiCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/25 text-blue-300 border border-blue-500/40 font-semibold">
                    <span className="text-blue-400 text-xs">★</span>
                    <span>Brought In {runCtx.rbiCount} Run{runCtx.rbiCount > 1 ? 's' : ''} ({runCtx.rbiCount} RBI)</span>
                  </span>
                ) : isHit ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-200 border border-blue-500/30 font-semibold">
                    <span>⚾</span>
                    <span>Base Hit · 0 Runs Brought In (Runners held / bases empty)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                    <span>✕</span>
                    <span>Out Recorded · 0 Runs Brought In</span>
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-3 border-t border-white/10 pt-1.5">
                <span>Inning {activeTooltipPlay.inning}</span>
                {activeTooltipPlay.pitcherHand && (
                  <span>vs {activeTooltipPlay.pitcherHand}HP</span>
                )}
                {activeTooltipPlay.lineupSpot && (
                  <span>#{activeTooltipPlay.lineupSpot} Lineup Spot</span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Zone detail popover */}
        {zonesMode && activeZone && (
          <div
            className="absolute top-2 left-2 right-2 p-3 rounded-xl bg-slate-950/95 text-white text-xs border border-slate-700 shadow-xl flex items-center justify-between z-20 animate-in fade-in duration-150"
            onClick={() => setActiveZone(null)}
          >
            <div>
              <div className="font-semibold text-sm">{getZoneLabel(activeZone)}</div>
              <div className="text-xs text-slate-400 mt-1">
                {zoneData.counts[activeZone]?.total || 0} ball{(zoneData.counts[activeZone]?.total || 0) !== 1 ? 's' : ''} in play ·{' '}
                {zoneData.counts[activeZone]?.hits || 0} hit{(zoneData.counts[activeZone]?.hits || 0) !== 1 ? 's' : ''}
              </div>
            </div>
            <span className="text-slate-400 px-2 py-1 rounded bg-white/10 text-xs font-semibold">Dismiss</span>
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && zonesMode && (
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] pt-1">
          <span>Fewer</span>
          <span className="h-2.5 w-24 rounded-full" style={{ background: 'linear-gradient(to right, rgba(52,120,255,0.15), rgba(52,120,255,0.9))' }} />
          <span>More balls</span>
          <span className="text-slate-400 font-semibold">· tap a zone for detail</span>
        </div>
      )}
      {showLegend && !zonesMode && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs font-semibold text-slate-600 dark:text-[#9CA3AF] pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00D7BC]" />
            <span>Home Run</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3478FF]" />
            <span>Triple</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#7FEBDD]" />
            <span>Double</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#A9C6FF]" />
            <span>Single</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#94A3B8]" />
            <span>Out / In Play</span>
          </div>
          <div className="flex items-center gap-1 text-blue-700 dark:text-blue-400">
            <span className="w-3.5 h-3.5 rounded-full border border-blue-400 bg-blue-400 flex items-center justify-center text-xs text-slate-950 font-semibold">★</span>
            <span>Brought in Run (RBI)</span>
          </div>
        </div>
      )}

      {/* Stats Breakdown Panel */}
      {showStats && stats.totalWithLocation > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          {/* Pull / Left */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/50 border border-slate-200 dark:border-[#354050] text-center">
            <span className="text-xs font-semibold text-slate-400">
              Left Field (Pull)
            </span>
            <div className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA] mt-0.5">
              {stats.leftPct}%
            </div>
            <div className="text-xs font-semibold text-slate-500">
              {stats.leftCount} ball{stats.leftCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Center */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/50 border border-slate-200 dark:border-[#354050] text-center">
            <span className="text-xs font-semibold text-slate-400">
              Center Field
            </span>
            <div className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA] mt-0.5">
              {stats.centerPct}%
            </div>
            <div className="text-xs font-semibold text-slate-500">
              {stats.centerCount} ball{stats.centerCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Oppo / Right */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/50 border border-slate-200 dark:border-[#354050] text-center">
            <span className="text-xs font-semibold text-slate-400">
              Right Field (Oppo)
            </span>
            <div className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA] mt-0.5">
              {stats.rightPct}%
            </div>
            <div className="text-xs font-semibold text-slate-500">
              {stats.rightCount} ball{stats.rightCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Contact Quality: LD / GB / FB */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252D38]/50 border border-slate-200 dark:border-[#354050] text-center">
            <span className="text-xs font-semibold text-slate-400">
              Line Drive Rate
            </span>
            <div className="text-lg font-semibold text-teal-600 dark:text-teal-400 mt-0.5">
              {stats.lineDrivePct}%
            </div>
            <div className="text-xs font-semibold text-slate-500">
              {stats.grounderPct}% GB · {stats.flyBallPct}% FB
            </div>
          </div>
        </div>
      )}
    </div>
  );
};