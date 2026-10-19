import type { HitTrajectory } from '../types/baseball';

/**
 * Shared field geometry for the 2D field art (FieldArt.tsx / SprayChart.tsx) and the 3D replay
 * (HitField3D.tsx). Everything lives in the same 300 x 300 space hit locations are stored in
 * (x / y are percentages of it), with home plate at (150, 260).
 */
export const FIELD_SIZE = 300;
export const HOME = { x: 150, y: 260 };

/** Outfield fence is an ellipse centred (150,138); foul poles sit on the true 45-degree lines. */
export const FENCE = { cx: 150, cy: 138, rx: 122, ry: 112 };
export const FENCE_PATH = 'M 28 138 A 122 112 0 0 1 272 138';
export const FIELD_PATH = 'M 150 260 L 28 138 A 122 112 0 0 1 272 138 Z';
export const FOUL_POLES = [
  { x: 28, y: 138 },
  { x: 272, y: 138 },
];

export const BASES = [
  { id: '1B', x: 193.5, y: 213.5 },
  { id: '2B', x: 150, y: 170 },
  { id: '3B', x: 106.5, y: 213.5 },
] as const;
export const BASE_SIZE = 7;
export const MOUND = { x: 150, y: 215 };
export const MOUND_RADIUS = 9;
export const HOME_DIRT_RADIUS = 16;
/** Inner infield grass diamond (the dirt circle itself comes from INFIELD_CENTER / INFIELD_DIRT_RADIUS). */
export const GRASS_DIAMOND: [number, number][] = [
  [150, 247],
  [186, 213],
  [150, 178],
  [114, 213],
];

export const FIELD_COLORS = {
  surround: '#2f7a3d',
  grassA: '#3f9a4d',
  grassB: '#378f45',
  foul: '#2f7a3d',
  dirt: '#c2915b',
  dirtDark: '#a9743f',
  dirtLight: '#cfa06a',
  wallCap: '#f2c230',
  hit: '#ffd23f',
  out: '#ff6b70',
};

/** Mow stripes are concentric rings around home plate. */
export const STRIPE_STEP = 11;
export const STRIPE_COUNT = 20;

export const pctToField = (pct: number) => (pct / 100) * FIELD_SIZE;

/* ---------- top-down trace of the ball (2D) ---------- */

export interface TraceStyle {
  width: number;
  dash?: string;
  /** How far the path bows sideways, as a fraction of its length. */
  bend: number;
}

export const TRACE_STYLES: Record<HitTrajectory, TraceStyle> = {
  lineDrive: { width: 1.7, bend: 0.06 },
  flyBall: { width: 1.5, dash: '0.1 3.2', bend: 0.22 },
  popUp: { width: 1.5, dash: '0.1 3.2', bend: 0.38 },
  grounder: { width: 1.6, dash: '4 3', bend: 0 },
  bunt: { width: 2.2, dash: '2.4 2.4', bend: 0 },
};

/** SVG path from just in front of home plate to where the ball landed. */
export function getTracePath(xPct: number, yPct: number, trajectory: HitTrajectory): string {
  const start = { x: HOME.x, y: HOME.y - 4 };
  const end = { x: pctToField(xPct), y: pctToField(yPct) };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  // Always bow away from the centre line so left and right hits mirror each other.
  if (nx * (end.x - HOME.x) < 0) {
    nx = -nx;
    ny = -ny;
  }
  const bend = TRACE_STYLES[trajectory].bend * len;
  const cx = (start.x + end.x) / 2 + nx * bend;
  const cy = (start.y + end.y) / 2 + ny * bend;
  return `M ${start.x} ${start.y} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}