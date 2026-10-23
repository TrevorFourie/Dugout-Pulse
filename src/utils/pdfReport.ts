import type { jsPDF } from 'jspdf';
import { recordDiagnosticError } from './errorDiagnostics';
import { Game, HitFieldZone, PlayerProfile, Play, PlayCode } from '../types/baseball';
import {
  calculateBattingSplits,
  calculateBattingStats,
  calculateFieldingStats,
  calculatePitchingStats,
  formatEraWhip,
  formatRate,
  sortGames,
} from './stats';
import {
  calculateSprayStats,
  CENTER_HALF_ANGLE,
  INFIELD_CENTER,
  INFIELD_DIRT_RADIUS,
  infieldEdgeDistance,
  getDisplayZone,
  getZoneLabel,
  isBattedBallPlay,
  isHitPlay,
} from './sprayChart';
import { saveBase64File } from './saveFile';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface StatsPdfOptions {
  /** Games to report on (already filtered the same way as the dashboard). */
  games: Game[];
  profile: PlayerProfile;
  inningsPerGame: number;
  /** Human readable description of the active dashboard filters, e.g. "Spring 2026 | Tournaments only". */
  filterLabel: string;
  /** Team/app logo as a PNG or JPEG data URL (optional). */
  logoDataUrl?: string;
}

/** Build the report and return it as a base64 string (no data-URL prefix). */
export async function buildStatsPdfBase64(opts: StatsPdfOptions): Promise<string> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  renderReport(doc, opts);
  const uri = doc.output('datauristring');
  return uri.slice(uri.indexOf('base64,') + 'base64,'.length);
}

/** Build the report and hand it to the share sheet (Android) or download it (web). */
export async function exportStatsPdf(opts: StatsPdfOptions): Promise<boolean> {
  if (!opts.games || opts.games.length === 0) return false;
  try {
    const base64 = await buildStatsPdfBase64(opts);
    const today = new Date().toISOString().split('T')[0];
    const who = (opts.profile.playerName || 'player').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    return await saveBase64File(`baseball-hub-${who || 'player'}-stats-${today}.pdf`, base64, 'application/pdf');
  } catch (err) {
    console.error('PDF report failed:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Look & feel
// ---------------------------------------------------------------------------

type RGB = [number, number, number];
type Pt = [number, number];

const NAVY: RGB = [24, 33, 45];
const TEAL: RGB = [0, 191, 165];
const TEAL_TEXT: RGB = [0, 128, 110];
const BLUE: RGB = [36, 107, 253];
const HEAT: RGB = [52, 120, 255];
const INK: RGB = [30, 41, 59];
const MUTED: RGB = [100, 116, 139];
const LINE: RGB = [226, 232, 240];
const PANEL: RGB = [241, 245, 249];
const WHITE: RGB = [255, 255, 255];

const PLAY_COLORS: Record<string, RGB> = {
  homeRun: [0, 215, 188],
  triple: [52, 120, 255],
  double: [127, 235, 221],
  single: [169, 198, 255],
  out: [148, 163, 184],
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 9;

/** jsPDF's built-in fonts only cover Latin-1, so strip/replace anything outside it. */
function clean(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\xFF]/g, '')
    .trim();
}

const rate = (v: number | null | undefined) => clean(formatRate(v));
const era = (v: number | null | undefined) => clean(formatEraWhip(v));
const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return clean(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1] ?? ''} ${m[1]}`;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => Math.round(a[i] * (1 - t) + b[i] * t)) as RGB;
}

const fill = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
const stroke = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
const ink = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

function text(
  doc: jsPDF,
  str: string | number,
  x: number,
  y: number,
  opts: { size?: number; bold?: boolean; color?: RGB; align?: 'left' | 'center' | 'right' } = {}
) {
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(opts.size ?? 9);
  ink(doc, opts.color ?? INK);
  doc.text(clean(str), x, y, { align: opts.align ?? 'left' });
}

function fitText(doc: jsPDF, str: string, maxWidth: number): string {
  let s = clean(str);
  if (doc.getTextWidth(s) <= maxWidth) return s;
  while (s.length > 1 && doc.getTextWidth(s + '...') > maxWidth) s = s.slice(0, -1);
  return s + '...';
}

function poly(doc: jsPDF, pts: Pt[], style: 'F' | 'S' | 'FD') {
  const segs = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  doc.lines(segs, pts[0][0], pts[0][1], [1, 1], style, true);
}

function clipTo(doc: jsPDF, pts: Pt[]) {
  doc.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i][0], pts[i][1]);
  doc.close();
  doc.clip();
  doc.discardPath();
}

function sectionTitle(doc: jsPDF, y: number, label: string, right?: string, x = MARGIN, rightX = PAGE_W - MARGIN) {
  fill(doc, TEAL);
  doc.roundedRect(x, y - 4, 1.4, 5, 0.7, 0.7, 'F');
  text(doc, label.toUpperCase(), x + 3.5, y, { size: 9.5, bold: true, color: NAVY });
  if (right) text(doc, right, rightX, y, { size: 8, color: MUTED, align: 'right' });
}

function statTile(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  accent: RGB,
  sub?: string
) {
  fill(doc, WHITE);
  stroke(doc, LINE);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  fill(doc, accent);
  doc.roundedRect(x, y, w, 1.6, 0.8, 0.8, 'F');
  text(doc, label.toUpperCase(), x + w / 2, y + 6.4, { size: 6.5, bold: true, color: MUTED, align: 'center' });
  text(doc, value, x + w / 2, y + h / 2 + (sub ? 4.2 : 4.8), {
    size: h > 20 ? 21 : 14,
    bold: true,
    color: accent,
    align: 'center',
  });
  if (sub) text(doc, sub, x + w / 2, y + h - 3, { size: 6.5, color: MUTED, align: 'center' });
}

function tileRow(
  doc: jsPDF,
  y: number,
  h: number,
  items: { label: string; value: string; sub?: string }[],
  accent: RGB,
  gap = 3
) {
  const w = (CONTENT_W - gap * (items.length - 1)) / items.length;
  items.forEach((it, i) => statTile(doc, MARGIN + i * (w + gap), y, w, h, it.label, it.value, accent, it.sub));
}

// ---------------------------------------------------------------------------
// Page chrome
// ---------------------------------------------------------------------------

function drawLogo(doc: jsPDF, dataUrl: string | undefined, x: number, y: number, box: number) {
  fill(doc, WHITE);
  doc.roundedRect(x, y, box, box, 3, 3, 'F');
  if (!dataUrl) return;
  try {
    const props = doc.getImageProperties(dataUrl);
    const pad = 1.5;
    const max = box - pad * 2;
    const scale = Math.min(max / props.width, max / props.height);
    const w = props.width * scale;
    const h = props.height * scale;
    doc.addImage(dataUrl, props.fileType, x + (box - w) / 2, y + (box - h) / 2, w, h);
  } catch (error) {
    try {
      recordDiagnosticError('logo_library', error, 'A custom logo could not be included in the PDF report; the report continued without that logo.');
    } catch {
      // Keep the PDF report generation available if diagnostics cannot be recorded.
    }
  }
}

function bigHeader(doc: jsPDF, opts: StatsPdfOptions, gameCount: number) {
  fill(doc, NAVY);
  doc.rect(0, 0, PAGE_W, 44, 'F');
  fill(doc, TEAL);
  doc.rect(0, 44, PAGE_W, 1.8, 'F');
  // subtle diagonal accent
  fill(doc, mix(NAVY, WHITE, 0.07));
  poly(doc, [[PAGE_W - 70, 0], [PAGE_W, 0], [PAGE_W, 44], [PAGE_W - 95, 44]], 'F');

  drawLogo(doc, opts.logoDataUrl, MARGIN, 8, 28);

  const name = opts.profile.playerName || 'Player';
  const teamLine = [opts.profile.teamName, opts.profile.jerseyNumber ? `#${opts.profile.jerseyNumber}` : '']
    .filter(Boolean)
    .join('   ');
  text(doc, 'SEASON STATS REPORT', MARGIN + 34, 14, { size: 7.5, bold: true, color: TEAL });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(23);
  text(doc, fitText(doc, name, 118), MARGIN + 34, 24, { size: 23, bold: true, color: WHITE });
  text(doc, teamLine, MARGIN + 34, 31, { size: 10, bold: true, color: [203, 213, 225] });
  text(doc, `${gameCount} ${gameCount === 1 ? 'game' : 'games'}   |   ${opts.filterLabel}`, MARGIN + 34, 37.5, {
    size: 8,
    color: [148, 163, 184],
  });
}

function slimHeader(doc: jsPDF, opts: StatsPdfOptions, title: string) {
  fill(doc, NAVY);
  doc.rect(0, 0, PAGE_W, 20, 'F');
  fill(doc, TEAL);
  doc.rect(0, 20, PAGE_W, 1.2, 'F');
  text(doc, title.toUpperCase(), MARGIN, 12.5, { size: 12, bold: true, color: WHITE });
  text(doc, `${opts.profile.playerName || 'Player'}  |  ${opts.filterLabel}`, PAGE_W - MARGIN, 12.5, {
    size: 8,
    color: [148, 163, 184],
    align: 'right',
  });
}

function footers(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  const stamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    stroke(doc, LINE);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, FOOTER_Y - 4, PAGE_W - MARGIN, FOOTER_Y - 4);
    text(doc, `Dugout Pulse  |  Generated ${stamp}`, MARGIN, FOOTER_Y, { size: 7, color: MUTED });
    text(doc, `Page ${i} of ${total}`, PAGE_W - MARGIN, FOOTER_Y, { size: 7, color: MUTED, align: 'right' });
  }
}

// ---------------------------------------------------------------------------
// Page 1: stats
// ---------------------------------------------------------------------------

interface BatCol {
  label: string;
  get: (s: ReturnType<typeof calculateBattingStats>) => string | number;
  strong?: boolean;
}

function battingTable(
  doc: jsPDF,
  y: number,
  rows: { label: string; stats: ReturnType<typeof calculateBattingStats> }[]
): number {
  const cols: BatCol[] = [
    { label: 'PA', get: (s) => s.pa },
    { label: 'AB', get: (s) => s.ab },
    { label: 'H', get: (s) => s.h },
    { label: '2B', get: (s) => s.doubles },
    { label: '3B', get: (s) => s.triples },
    { label: 'HR', get: (s) => s.hr },
    { label: 'RBI', get: (s) => s.rbi },
    { label: 'BB', get: (s) => s.bb },
    { label: 'SO', get: (s) => s.so },
    { label: 'AVG', get: (s) => rate(s.avg), strong: true },
    { label: 'OBP', get: (s) => rate(s.obp), strong: true },
    { label: 'SLG', get: (s) => rate(s.slg), strong: true },
    { label: 'OPS', get: (s) => rate(s.ops), strong: true },
  ];
  const labelW = 22;
  const colW = (CONTENT_W - labelW) / cols.length;
  const headH = 7;
  const rowH = 7.5;

  fill(doc, NAVY);
  doc.roundedRect(MARGIN, y, CONTENT_W, headH, 1.5, 1.5, 'F');
  cols.forEach((c, i) =>
    text(doc, c.label, MARGIN + labelW + colW * i + colW / 2, y + 4.7, {
      size: 7,
      bold: true,
      color: c.strong ? [153, 239, 227] : WHITE,
      align: 'center',
    })
  );

  rows.forEach((row, r) => {
    const ry = y + headH + r * rowH;
    if (r % 2 === 0) {
      fill(doc, PANEL);
      doc.rect(MARGIN, ry, CONTENT_W, rowH, 'F');
    }
    text(doc, row.label, MARGIN + 3, ry + 5, { size: 8, bold: true, color: NAVY });
    cols.forEach((c, i) =>
      text(doc, c.get(row.stats), MARGIN + labelW + colW * i + colW / 2, ry + 5, {
        size: 8,
        bold: c.strong,
        color: c.strong ? TEAL_TEXT : INK,
        align: 'center',
      })
    );
  });
  return y + headH + rows.length * rowH;
}

function hitMixBar(doc: jsPDF, y: number, b: ReturnType<typeof calculateBattingStats>): number {
  const parts: { label: string; n: number; color: RGB }[] = [
    { label: 'Singles', n: b.singles, color: PLAY_COLORS.single },
    { label: 'Doubles', n: b.doubles, color: PLAY_COLORS.double },
    { label: 'Triples', n: b.triples, color: PLAY_COLORS.triple },
    { label: 'Home runs', n: b.hr, color: PLAY_COLORS.homeRun },
  ];
  const total = parts.reduce((s, p) => s + p.n, 0);
  if (total === 0) return y;

  const h = 8;
  let x = MARGIN;
  const active = parts.filter((p) => p.n > 0);
  active.forEach((p, i) => {
    const w = (p.n / total) * CONTENT_W;
    fill(doc, p.color);
    // round only the outer ends
    if (active.length === 1) doc.roundedRect(x, y, w, h, 2, 2, 'F');
    else if (i === 0) {
      doc.roundedRect(x, y, w, h, 2, 2, 'F');
      doc.rect(x + w - 2.5, y, 2.5, h, 'F');
    } else if (i === active.length - 1) {
      doc.roundedRect(x, y, w, h, 2, 2, 'F');
      doc.rect(x, y, 2.5, h, 'F');
    } else doc.rect(x, y, w, h, 'F');
    if (w > 7) text(doc, p.n, x + w / 2, y + 5.4, { size: 8, bold: true, color: WHITE, align: 'center' });
    x += w;
  });

  let lx = MARGIN;
  parts.forEach((p) => {
    fill(doc, p.color);
    doc.circle(lx + 1.3, y + h + 5, 1.3, 'F');
    const label = `${p.label} ${p.n} (${pct(p.n, total)}%)`;
    text(doc, label, lx + 4, y + h + 6.1, { size: 7.5, color: MUTED });
    lx += doc.getTextWidth(clean(label)) + 11;
  });
  return y + h + 9;
}

function renderStatsPage(doc: jsPDF, opts: StatsPdfOptions, games: Game[]) {
  const plays: Play[] = games.flatMap((g) => g.plays || []);
  const gameCount = games.length;
  const batting = calculateBattingStats(plays, gameCount);
  const pitching = calculatePitchingStats(plays, gameCount, opts.inningsPerGame);
  const fielding = calculateFieldingStats(plays, gameCount);
  const splits = calculateBattingSplits(plays);

  bigHeader(doc, opts, gameCount);

  // Headline numbers
  let y = 56;
  tileRow(
    doc,
    y,
    25,
    [
      { label: 'Batting Avg', value: rate(batting.avg), sub: `${batting.h} for ${batting.ab}` },
      { label: 'On-Base %', value: rate(batting.obp), sub: `${batting.pa} plate appearances` },
      { label: 'Slugging %', value: rate(batting.slg), sub: `${batting.tb} total bases` },
      { label: 'OPS', value: rate(batting.ops), sub: 'OBP + SLG' },
    ],
    TEAL,
    4
  );

  y += 29;
  tileRow(
    doc,
    y,
    15,
    [
      { label: 'Games', value: String(gameCount) },
      { label: 'Hits', value: String(batting.h) },
      { label: 'Home Runs', value: String(batting.hr) },
      { label: 'RBI', value: String(batting.rbi) },
      { label: 'Runs', value: String(batting.r) },
      { label: 'Stolen Bases', value: String(batting.sb) },
    ],
    NAVY
  );

  // Batting table + splits
  y += 25;
  sectionTitle(doc, y, 'Batting');
  const rows = [{ label: 'Total', stats: batting }];
  if (splits.vsRHP.pa > 0) rows.push({ label: 'vs RHP', stats: splits.vsRHP });
  if (splits.vsLHP.pa > 0) rows.push({ label: 'vs LHP', stats: splits.vsLHP });
  y = battingTable(doc, y + 3.5, rows);

  // Hit mix
  if (batting.h > 0) {
    y += 8;
    sectionTitle(doc, y, 'Hit Mix', `${batting.h} hits`);
    y = hitMixBar(doc, y + 3.5, batting);
  }

  // Pitching
  const hasPitching = pitching.outs > 0 || pitching.pitches > 0 || pitching.k > 0 || pitching.bb > 0 || pitching.h > 0;
  if (hasPitching) {
    y += 8;
    const pitchedGames = games.filter((g) => (g.plays || []).some((p) => p.mode === 'pitching')).length;
    sectionTitle(doc, y, 'Pitching', `${pitchedGames} ${pitchedGames === 1 ? 'game' : 'games'}`);
    y += 3.5;
    tileRow(
      doc,
      y,
      15,
      [
        { label: 'IP', value: clean(pitching.ipDisplay) },
        { label: `ERA`, value: era(pitching.era) },
        { label: 'WHIP', value: era(pitching.whip) },
        { label: 'K', value: String(pitching.k) },
        { label: 'BB', value: String(pitching.bb) },
        { label: 'Hits', value: String(pitching.h) },
        { label: 'Pitches', value: String(pitching.pitches) },
        {
          label: 'Strike %',
          value: pitching.strikePercentage === null ? '-' : `${Math.round(pitching.strikePercentage)}%`,
        },
      ],
      NAVY,
      2.5
    );
    y += 15;
  }

  // Fielding
  if (fielding.chances > 0 || fielding.po > 0 || fielding.a > 0 || fielding.e > 0) {
    y += 8;
    sectionTitle(doc, y, 'Fielding');
    y += 3.5;
    tileRow(
      doc,
      y,
      15,
      [
        { label: 'Fld %', value: rate(fielding.fpct) },
        { label: 'Chances', value: String(fielding.chances) },
        { label: 'Putouts', value: String(fielding.po) },
        { label: 'Assists', value: String(fielding.a) },
        { label: 'Errors', value: String(fielding.e) },
        { label: 'Double Plays', value: String(fielding.dp) },
      ],
      NAVY
    );
  }
}

// ---------------------------------------------------------------------------
// Page 2: spray chart (drawn as vector shapes)
// ---------------------------------------------------------------------------

// Field geometry in the app's 300x300 space (visible window x 10..290, y 10..272)
const VB = { x: 10, y: 10, w: 280, h: 262 };
const HOME = { x: 150, y: 260 };
const FENCE = { cx: 150, cy: 138, rx: 122, ry: 112 };
const GRASS: RGB = [30, 82, 56];
const GRASS_DARK: RGB = [27, 77, 52];
const DIRT: RGB = [178, 125, 76];
const TRACK: RGB = [141, 99, 61];

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distance from home plate to the outfield fence along a bearing (0 = straight to CF). */
function fenceDist(deg: number): number {
  const a = toRad(deg);
  const s = Math.sin(a);
  const c = Math.cos(a);
  const A = (s * s) / (FENCE.rx * FENCE.rx) + (c * c) / (FENCE.ry * FENCE.ry);
  const B = (-2 * (HOME.y - FENCE.cy) * c) / (FENCE.ry * FENCE.ry);
  const C = ((HOME.y - FENCE.cy) / FENCE.ry) ** 2 - 1;
  return (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
}

const polar = (r: number, deg: number): Pt => [HOME.x + r * Math.sin(toRad(deg)), HOME.y - r * Math.cos(toRad(deg))];

type Wedge = [r1: number | 'edge', r2: number | 'fence' | 'edge', a1: number, a2: number];

function wedgePts(w: Wedge): Pt[] {
  const [r1, r2, a1, a2] = w;
  const steps = 14;
  const angles = Array.from({ length: steps + 1 }, (_, i) => a1 + ((a2 - a1) * i) / steps);
  const rad = (r: number | 'fence' | 'edge', a: number) =>
    r === 'fence' ? fenceDist(a) : r === 'edge' ? infieldEdgeDistance(a) : r;
  const outer = angles.map((a) => polar(rad(r2, a), a));
  const inner = angles.slice().reverse().map((a) => polar(rad(r1, a), a));
  return [...outer, ...inner];
}

// Mirrors getZoneFromCoordinates() / the on-screen Zones view (mound slivers folded into P).
const ZONES: { zone: HitFieldZone; wedges: Wedge[]; label: Pt }[] = [
  { zone: 'LF', wedges: [['edge', 'fence', -45, -CENTER_HALF_ANGLE]], label: polar(150, -30) },
  { zone: 'CF', wedges: [['edge', 'fence', -CENTER_HALF_ANGLE, CENTER_HALF_ANGLE]], label: polar(165, 0) },
  { zone: 'RF', wedges: [['edge', 'fence', CENTER_HALF_ANGLE, 45]], label: polar(150, 30) },
  { zone: '3B', wedges: [[72, 'edge', -45, -20], [32, 72, -45, -20]], label: polar(82, -32.5) },
  { zone: 'SS', wedges: [[72, 'edge', -20, -2]], label: polar(82, -11) },
  { zone: '2B', wedges: [[72, 'edge', -2, 20]], label: polar(82, 9) },
  { zone: '1B', wedges: [[72, 'edge', 20, 45], [32, 72, 20, 45]], label: polar(82, 32.5) },
  { zone: 'P', wedges: [[32, 72, -20, 20]], label: polar(52, 0) },
  { zone: 'C', wedges: [[0, 32, -45, 45]], label: [150, 243] },
];

class FieldCanvas {
  readonly h: number;
  private readonly k: number;
  constructor(private doc: jsPDF, private ox: number, private oy: number, private w: number) {
    this.k = w / VB.w;
    this.h = VB.h * this.k;
  }
  p = (x: number, y: number): Pt => [this.ox + (x - VB.x) * this.k, this.oy + (y - VB.y) * this.k];
  pp = (pt: Pt): Pt => this.p(pt[0], pt[1]);
  len = (v: number) => v * this.k;

  drawField(showPositionLabels: boolean) {
    const { doc } = this;
    // Dark backdrop card
    fill(doc, [18, 43, 30]);
    doc.roundedRect(this.ox, this.oy, this.w, this.h, 3, 3, 'F');

    // Fair territory
    const arc: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = (Math.PI * i) / 40;
      arc.push([FENCE.cx - FENCE.rx * Math.cos(t), FENCE.cy - FENCE.ry * Math.sin(t)]);
    }
    const fair: Pt[] = ([[HOME.x, HOME.y], ...arc] as Pt[]).map(this.pp);
    fill(doc, GRASS);
    poly(doc, fair, 'F');

    // Warning track band (between fence and a slightly smaller ellipse)
    const inner: Pt[] = [];
    for (let i = 40; i >= 0; i--) {
      const t = (Math.PI * i) / 40;
      inner.push([FENCE.cx - (FENCE.rx - 9) * Math.cos(t), FENCE.cy - (FENCE.ry - 9) * Math.sin(t)]);
    }
    fill(doc, TRACK);
    poly(doc, [...arc, ...inner].map(this.pp), 'F');

    // Infield dirt (clipped to fair territory)
    doc.saveGraphicsState();
    clipTo(doc, fair);
    fill(doc, DIRT);
    const [dx, dy] = this.p(INFIELD_CENTER.x, INFIELD_CENTER.y);
    doc.circle(dx, dy, this.len(INFIELD_DIRT_RADIUS), 'F');
    const [hx, hy] = this.p(150, 260);
    doc.circle(hx, hy, this.len(16), 'F');
    doc.restoreGraphicsState();

    // Infield grass diamond
    fill(doc, GRASS_DARK);
    poly(doc, ([[150, 247], [186, 213], [150, 178], [114, 213]] as Pt[]).map(this.pp), 'F');

    // Mound
    fill(doc, DIRT);
    const [mx, my] = this.p(150, 215);
    doc.circle(mx, my, this.len(9), 'F');
    fill(doc, WHITE);
    const [rx, ry] = this.p(147, 214);
    doc.rect(rx, ry, this.len(6), this.len(2), 'F');

    // Outfield wall + foul lines
    stroke(doc, [235, 240, 236]);
    doc.setLineWidth(0.35);
    const wall = arc.map(this.pp);
    for (let i = 1; i < wall.length; i++) doc.line(wall[i - 1][0], wall[i - 1][1], wall[i][0], wall[i][1]);
    doc.setLineWidth(0.5);
    const [fx, fy] = this.p(HOME.x, HOME.y);
    const [lx, ly] = this.p(28, 138);
    const [rx2, ry2] = this.p(272, 138);
    doc.line(fx, fy, lx, ly);
    doc.line(fx, fy, rx2, ry2);

    // Foul poles
    fill(doc, WHITE);
    doc.circle(lx, ly, this.len(3), 'F');
    doc.circle(rx2, ry2, this.len(3), 'F');

    // Bases
    fill(doc, WHITE);
    for (const [bx, by] of [[193.5, 213.5], [150, 170], [106.5, 213.5]]) {
      poly(doc, ([[bx, by - 5], [bx + 5, by], [bx, by + 5], [bx - 5, by]] as Pt[]).map(this.pp), 'F');
    }
    poly(doc, ([[146, 256], [154, 256], [154, 260], [150, 264], [146, 260]] as Pt[]).map(this.pp), 'F');

    if (showPositionLabels) {
      const faint = mix(GRASS, WHITE, 0.4);
      for (const [label, x, y] of [['LF', 68, 105], ['CF', 150, 68], ['RF', 232, 105]] as [string, number, number][]) {
        const [tx, ty] = this.p(x, y);
        text(doc, label, tx, ty, { size: 6, bold: true, color: faint, align: 'center' });
      }
    }
  }

  drawDots(plays: Play[]) {
    const { doc } = this;
    const n = plays.length;
    const scale = n > 80 ? 0.6 : n > 30 ? 0.78 : 1;
    // Hits on top of outs so they never get buried
    const order = (c: PlayCode) => (c === 'homeRun' ? 4 : c === 'triple' ? 3 : c === 'double' ? 2 : c === 'single' ? 1 : 0);
    [...plays]
      .sort((a, b) => order(a.code) - order(b.code))
      .forEach((play) => {
        const loc = play.hitLocation!;
        // Keep every dot inside the drawn field window
        const ux = Math.max(VB.x + 4, Math.min(VB.x + VB.w - 4, (loc.x / 100) * 300));
        const uy = Math.max(VB.y + 4, Math.min(VB.y + VB.h - 4, (loc.y / 100) * 300));
        const [x, y] = this.p(ux, uy);
        const color = PLAY_COLORS[play.code] ?? PLAY_COLORS.out;
        const r = this.len((play.code === 'homeRun' ? 7 : 5.5) * scale);
        fill(doc, color);
        stroke(doc, WHITE);
        doc.setLineWidth(0.25);
        doc.circle(x, y, r, 'FD');
      });
  }

  drawZones(plays: Play[]) {
    const { doc } = this;
    const counts = new Map<HitFieldZone, { total: number; hits: number }>();
    plays.forEach((p) => {
      const z = getDisplayZone(p.hitLocation!);
      const e = counts.get(z) ?? { total: 0, hits: 0 };
      e.total++;
      if (isHitPlay(p.code)) e.hits++;
      counts.set(z, e);
    });
    const max = Math.max(1, ...Array.from(counts.values()).map((c) => c.total));

    // Clip to the field so wedge corners never poke out
    const fair: Pt[] = [[HOME.x, HOME.y]];
    for (let i = 0; i <= 40; i++) {
      const t = (Math.PI * i) / 40;
      fair.push([FENCE.cx - FENCE.rx * Math.cos(t), FENCE.cy - FENCE.ry * Math.sin(t)]);
    }
    doc.saveGraphicsState();
    clipTo(doc, fair.map(this.pp));
    ZONES.forEach((z) => {
      const total = counts.get(z.zone)?.total ?? 0;
      const intensity = total > 0 ? 0.25 + 0.7 * (total / max) : 0;
      const color = total > 0 ? mix(GRASS, HEAT, intensity) : null;
      stroke(doc, [186, 210, 196]);
      doc.setLineWidth(0.2);
      z.wedges.forEach((w) => {
        const pts = wedgePts(w).map(this.pp);
        if (color) {
          fill(doc, color);
          poly(doc, pts, 'FD');
        } else {
          poly(doc, pts, 'S');
        }
      });
    });
    doc.restoreGraphicsState();

    ZONES.forEach((z) => {
      const c = counts.get(z.zone);
      const [x, y] = this.p(z.label[0], z.label[1]);
      text(doc, z.zone, x, y - 0.6, { size: 5.5, bold: true, color: [225, 236, 229], align: 'center' });
      if (c && c.total > 0) {
        text(doc, c.total, x, y + 3.6, { size: 9.5, bold: true, color: WHITE, align: 'center' });
        text(doc, `${pct(c.total, plays.length)}%`, x, y + 6.8, { size: 5.5, bold: true, color: [240, 244, 241], align: 'center' });
      }
    });
    return counts;
  }
}

function directionTile(doc: jsPDF, x: number, y: number, w: number, label: string, sub: string, count: number, percent: number, color: RGB) {
  fill(doc, WHITE);
  stroke(doc, LINE);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, 25, 2, 2, 'FD');
  text(doc, label.toUpperCase(), x + 4, y + 6, { size: 6.5, bold: true, color: MUTED });
  text(doc, sub, x + w - 4, y + 6, { size: 6.5, color: MUTED, align: 'right' });
  text(doc, `${percent}%`, x + 4, y + 16, { size: 18, bold: true, color });
  text(doc, `${count} ball${count === 1 ? '' : 's'}`, x + w - 4, y + 15.5, { size: 7.5, bold: true, color: MUTED, align: 'right' });
  fill(doc, PANEL);
  doc.roundedRect(x + 4, y + 19.5, w - 8, 2.6, 1.3, 1.3, 'F');
  if (percent > 0) {
    fill(doc, color);
    doc.roundedRect(x + 4, y + 19.5, Math.max(2.6, ((w - 8) * percent) / 100), 2.6, 1.3, 1.3, 'F');
  }
}

function renderSprayPage(doc: jsPDF, opts: StatsPdfOptions, games: Game[]) {
  doc.addPage();
  slimHeader(doc, opts, 'Hitting Location');

  const plays = games
    .flatMap((g) => g.plays || [])
    .filter((p) => p.mode === 'batting' && isBattedBallPlay(p.code) && p.hitLocation);
  const stats = calculateSprayStats(plays);
  const batted = games.flatMap((g) => g.plays || []).filter((p) => p.mode === 'batting' && isBattedBallPlay(p.code)).length;

  if (plays.length === 0) {
    fill(doc, PANEL);
    doc.roundedRect(MARGIN, 40, CONTENT_W, 40, 3, 3, 'F');
    text(doc, 'No hit locations recorded yet', PAGE_W / 2, 58, { size: 12, bold: true, color: NAVY, align: 'center' });
    text(doc, 'Tap the field after each ball in play during a game and this page fills in automatically.', PAGE_W / 2, 66, {
      size: 8.5,
      color: MUTED,
      align: 'center',
    });
    return;
  }

  // Two charts side by side
  const chartW = 88;
  const leftX = MARGIN;
  const rightX = PAGE_W - MARGIN - chartW;
  let y = 34;
  sectionTitle(doc, y, 'Every Ball In Play', `${plays.length} mapped`, leftX, leftX + chartW);
  sectionTitle(doc, y, 'Zone Heat Map', undefined, rightX);
  y += 5;

  const dots = new FieldCanvas(doc, leftX, y, chartW);
  dots.drawField(true);
  dots.drawDots(plays);

  const zones = new FieldCanvas(doc, rightX, y, chartW);
  zones.drawField(false);
  const counts = zones.drawZones(plays);

  // Legends
  let ly = y + dots.h + 6;
  let lx = leftX;
  ([['Single', 'single'], ['Double', 'double'], ['Triple', 'triple'], ['HR', 'homeRun'], ['Out / In play', 'out']] as [string, string][]).forEach(
    ([label, key]) => {
      fill(doc, PLAY_COLORS[key]);
      doc.circle(lx + 1.2, ly - 1, 1.2, 'F');
      text(doc, label, lx + 3.4, ly, { size: 6.5, bold: true, color: MUTED });
      lx += doc.getTextWidth(label) + 8.5;
    }
  );
  text(doc, 'FEWER', rightX, ly, { size: 6.5, bold: true, color: MUTED });
  for (let i = 0; i < 7; i++) {
    fill(doc, mix(GRASS, HEAT, 0.25 + (0.7 * i) / 6));
    doc.rect(rightX + 12 + i * 5.5, ly - 2.4, 5.5, 3, 'F');
  }
  text(doc, 'MORE BALLS', rightX + 12 + 7 * 5.5 + 2, ly, { size: 6.5, bold: true, color: MUTED });

  // Hot-zone callouts
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1].total - a[1].total);
  const byHits = Array.from(counts.entries()).sort((a, b) => b[1].hits - a[1].hits);
  y = ly + 9;
  if (ranked.length > 0) {
    const w = (CONTENT_W - 5) / 2;
    const [topZone, top] = ranked[0];
    const [hitZone, hit] = byHits[0];
    const callout = (x: number, label: string, zone: HitFieldZone, big: string, small: string, color: RGB) => {
      fill(doc, PANEL);
      doc.roundedRect(x, y, w, 15, 2, 2, 'F');
      fill(doc, color);
      doc.roundedRect(x, y, 1.6, 15, 0.8, 0.8, 'F');
      text(doc, label.toUpperCase(), x + 5, y + 5.2, { size: 6.5, bold: true, color: MUTED });
      text(doc, `${getZoneLabel(zone)}`, x + 5, y + 11.6, { size: 11, bold: true, color: NAVY });
      text(doc, big, x + w - 4, y + 8.2, { size: 13, bold: true, color, align: 'right' });
      text(doc, small, x + w - 4, y + 12.4, { size: 6.5, color: MUTED, align: 'right' });
    };
    callout(MARGIN, 'Most balls hit to', topZone, String(top.total), `${pct(top.total, plays.length)}% of balls in play`, TEAL);
    if (hit.hits > 0) {
      callout(MARGIN + w + 5, 'Most hits to', hitZone, String(hit.hits), `${hit.hits} of ${hit.total} balls fell in`, NAVY);
    }
    y += 21;
  }

  // Direction tiles
  sectionTitle(doc, y + 2, 'Direction');
  y += 6;
  const tw = (CONTENT_W - 8) / 3;
  directionTile(doc, MARGIN, y, tw, 'Left field', 'pull side', stats.leftCount, stats.leftPct, TEAL);
  directionTile(doc, MARGIN + tw + 4, y, tw, 'Center field', 'up the middle', stats.centerCount, stats.centerPct, NAVY);
  directionTile(doc, MARGIN + (tw + 4) * 2, y, tw, 'Right field', 'oppo side', stats.rightCount, stats.rightPct, PLAY_COLORS.single);
  y += 33;

  // Contact quality bars
  sectionTitle(doc, y, 'Contact Quality');
  y += 5;
  const bars: { label: string; n: number; p: number; color: RGB }[] = [
    { label: 'Line drives', n: stats.lineDriveCount, p: stats.lineDrivePct, color: BLUE },
    { label: 'Ground balls', n: stats.grounderCount, p: stats.grounderPct, color: PLAY_COLORS.double },
    { label: 'Fly balls', n: stats.flyBallCount, p: stats.flyBallPct, color: PLAY_COLORS.single },
    { label: 'Pop ups', n: stats.popUpCount, p: stats.popUpPct, color: MUTED },
  ];
  if (stats.buntCount > 0) bars.push({ label: 'Bunts', n: stats.buntCount, p: stats.buntPct, color: PLAY_COLORS.triple });
  const labelW = 28;
  const trackW = CONTENT_W - labelW - 26;
  bars.forEach((b, i) => {
    const by = y + i * 8;
    text(doc, b.label, MARGIN + 1, by + 4.6, { size: 8, bold: true, color: INK });
    fill(doc, PANEL);
    doc.roundedRect(MARGIN + labelW, by + 1, trackW, 4.4, 2.2, 2.2, 'F');
    if (b.p > 0) {
      fill(doc, b.color);
      doc.roundedRect(MARGIN + labelW, by + 1, Math.max(4.4, (trackW * b.p) / 100), 4.4, 2.2, 2.2, 'F');
    }
    text(doc, `${b.p}%`, MARGIN + labelW + trackW + 4, by + 4.8, { size: 8, bold: true, color: INK });
    text(doc, `(${b.n})`, PAGE_W - MARGIN, by + 4.8, { size: 7, color: MUTED, align: 'right' });
  });
  y += bars.length * 8 + 4;

  const note =
    batted > plays.length
      ? `Based on ${plays.length} of ${batted} balls in play that have a recorded hit location.`
      : `Based on ${plays.length} balls in play with a recorded hit location.`;
  text(doc, note, MARGIN, y + 3, { size: 7, color: MUTED });
}

// ---------------------------------------------------------------------------
// Page 3+: game log
// ---------------------------------------------------------------------------

function renderGameLog(doc: jsPDF, opts: StatsPdfOptions, games: Game[]) {
  const sorted = sortGames(games, 'newestFirst');
  const cols = [
    { label: 'DATE', w: 25, align: 'left' as const },
    { label: 'OPPONENT', w: 56, align: 'left' as const },
    { label: 'RESULT', w: 19, align: 'center' as const },
    { label: 'AB', w: 11, align: 'center' as const },
    { label: 'H', w: 11, align: 'center' as const },
    { label: 'R', w: 11, align: 'center' as const },
    { label: 'RBI', w: 11, align: 'center' as const },
    { label: 'BB', w: 11, align: 'center' as const },
    { label: 'SO', w: 11, align: 'center' as const },
    { label: 'HIGHLIGHTS', w: CONTENT_W - 25 - 56 - 19 - 11 * 6, align: 'left' as const },
  ];
  const rowH = 7;
  const bottom = FOOTER_Y - 8;

  const startPage = (first: boolean) => {
    doc.addPage();
    slimHeader(doc, opts, first ? 'Game Log' : 'Game Log (continued)');
    let y = 30;
    fill(doc, NAVY);
    doc.roundedRect(MARGIN, y, CONTENT_W, 7, 1.5, 1.5, 'F');
    let x = MARGIN;
    cols.forEach((c) => {
      const tx = c.align === 'center' ? x + c.w / 2 : x + 3;
      text(doc, c.label, tx, y + 4.6, { size: 6.5, bold: true, color: WHITE, align: c.align });
      x += c.w;
    });
    return y + 7;
  };

  let y = startPage(true);
  sorted.forEach((game, i) => {
    if (y + rowH > bottom) y = startPage(false);
    const b = calculateBattingStats(game.plays || [], 1);
    if (i % 2 === 0) {
      fill(doc, PANEL);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    }
    const highlights = [
      b.doubles ? (b.doubles > 1 ? `${b.doubles} 2B` : '2B') : '',
      b.triples ? (b.triples > 1 ? `${b.triples} 3B` : '3B') : '',
      b.hr ? (b.hr > 1 ? `${b.hr} HR` : 'HR') : '',
      b.sb ? `${b.sb} SB` : '',
    ]
      .filter(Boolean)
      .join(', ');
    const result = clean(game.finalResult || '-');
    const resultColor = result.startsWith('W') ? TEAL_TEXT : result.startsWith('L') ? INK : MUTED;

    const vals: (string | number)[] = [
      formatDate(game.date),
      '',
      result,
      b.ab,
      b.h,
      b.r,
      b.rbi,
      b.bb,
      b.so,
      highlights,
    ];
    let x = MARGIN;
    cols.forEach((c, ci) => {
      const tx = c.align === 'center' ? x + c.w / 2 : x + 3;
      if (ci === 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        text(doc, fitText(doc, game.opponent ? `vs ${game.opponent}` : 'Opponent', c.w - 5), tx, y + 4.8, {
          size: 8,
          bold: true,
          color: NAVY,
        });
      } else {
        text(doc, vals[ci], tx, y + 4.8, {
          size: ci === 9 ? 7 : 8,
          bold: ci === 2 || ci === 4,
          color: ci === 2 ? resultColor : ci === 9 ? MUTED : INK,
          align: c.align,
        });
      }
      x += c.w;
    });
    y += rowH;
  });
}

// ---------------------------------------------------------------------------

function renderReport(doc: jsPDF, opts: StatsPdfOptions) {
  const games = opts.games;
  doc.setProperties({
    title: `${opts.profile.playerName || 'Player'} - Season Stats Report`,
    subject: 'Baseball stats and hit location report',
    creator: 'Dugout Pulse',
  });
  renderStatsPage(doc, opts, games);
  renderSprayPage(doc, opts, games);
  renderGameLog(doc, opts, games);
  footers(doc);
}
