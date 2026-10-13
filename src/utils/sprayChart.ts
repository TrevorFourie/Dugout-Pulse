import { HitFieldZone, HitLocation, HitTrajectory, Play, PlayCode } from '../types/baseball';

export interface SprayChartStats {
  totalPlays: number;
  totalWithLocation: number;
  hitsCount: number; // Base hits (1B, 2B, 3B, HR)
  rbiHitsCount: number; // Base hits that drove in at least 1 run (RBI)
  nonRbiHitsCount: number; // Base hits with 0 runs driven in
  totalRbisOnHits: number; // Total runs brought in on base hits
  outsCount: number; // Batted ball outs
  rbiOutsCount: number; // Outs that drove in a run (e.g. Sac Fly)
  // Directions
  leftCount: number;
  leftPct: number;
  centerCount: number;
  centerPct: number;
  rightCount: number;
  rightPct: number;
  // Infield vs Outfield
  infieldCount: number;
  infieldPct: number;
  outfieldCount: number;
  outfieldPct: number;
  // Trajectories
  grounderCount: number;
  grounderPct: number;
  lineDriveCount: number;
  lineDrivePct: number;
  flyBallCount: number;
  flyBallPct: number;
  popUpCount: number;
  popUpPct: number;
  buntCount: number;
  buntPct: number;
  // Per-zone counts
  zoneCounts: Record<HitFieldZone, { total: number; hits: number }>;
}

export const BATTED_BALL_CODES: PlayCode[] = [
  'single',
  'double',
  'triple',
  'homeRun',
  'out',
  'sacFly',
  'sacBunt',
  'reachedOnError',
  'fieldersChoice',
  'groundedIntoDoublePlay',
];

export const PRIMARY_BATTING_CODES: PlayCode[] = [
  'single',
  'double',
  'triple',
  'homeRun',
  'walk',
  'intentionalWalk',
  'hbp',
  'strikeout',
  'out',
  'sacFly',
  'sacBunt',
  'reachedOnError',
  'fieldersChoice',
  'groundedIntoDoublePlay',
];

export interface PlayRunContext {
  rbiCount: number;
  runsScoredCount: number;
  broughtRunIn: boolean;
}

/**
 * Determine whether a batted play drove in runs (RBI) or resulted in runs scored
 * by checking subsequent events in the same plate appearance or inning.
 */
export function getPlayRunContext(play: Play, allPlays: Play[]): PlayRunContext {
  if (!allPlays || allPlays.length === 0) {
    const isHr = play.code === 'homeRun';
    return {
      rbiCount: isHr ? 1 : 0,
      runsScoredCount: isHr ? 1 : 0,
      broughtRunIn: isHr,
    };
  }

  const index = allPlays.findIndex((p) => p.id === play.id);
  if (index === -1) {
    const isHr = play.code === 'homeRun';
    return {
      rbiCount: isHr ? 1 : 0,
      runsScoredCount: isHr ? 1 : 0,
      broughtRunIn: isHr,
    };
  }

  let rbiCount = 0;
  let runsScoredCount = 0;

  // Walk forward to inspect plays tied to this plate appearance in the same inning
  for (let i = index + 1; i < allPlays.length; i++) {
    const nextPlay = allPlays[i];
    if (nextPlay.inning !== play.inning) break;
    // Stop if next play is another primary at-bat event
    if (nextPlay.mode === 'batting' && PRIMARY_BATTING_CODES.includes(nextPlay.code)) {
      break;
    }
    if (nextPlay.mode === 'batting') {
      if (nextPlay.code === 'rbi') rbiCount++;
      if (nextPlay.code === 'run') runsScoredCount++;
    }
  }

  // Home run always drives in at least 1 run for the batter themselves
  if (play.code === 'homeRun') {
    rbiCount = Math.max(1, rbiCount);
    runsScoredCount = Math.max(1, runsScoredCount);
  }

  // Sac Fly always brings in at least 1 run by rule definition
  if (play.code === 'sacFly') {
    rbiCount = Math.max(1, rbiCount);
  }

  return {
    rbiCount,
    runsScoredCount,
    broughtRunIn: rbiCount > 0,
  };
}

/** IDs of the 'rbi' plays attached to a batting play (same window getPlayRunContext uses). */
export function getAttachedRbiPlayIds(play: Play, allPlays: Play[]): string[] {
  const index = allPlays.findIndex((p) => p.id === play.id);
  if (index === -1) return [];
  const ids: string[] = [];
  for (let i = index + 1; i < allPlays.length; i++) {
    const next = allPlays[i];
    if (next.inning !== play.inning) break;
    if (next.mode === 'batting' && PRIMARY_BATTING_CODES.includes(next.code)) break;
    if (next.mode === 'batting' && next.code === 'rbi') ids.push(next.id);
  }
  return ids;
}

export function isBattedBallPlay(code: PlayCode): boolean {
  return BATTED_BALL_CODES.includes(code);
}

export function isHitPlay(code: PlayCode): boolean {
  return code === 'single' || code === 'double' || code === 'triple' || code === 'homeRun';
}

/**
 * Returns human-friendly label for trajectory
 */
export function getTrajectoryLabel(trajectory?: HitTrajectory): string {
  switch (trajectory) {
    case 'grounder':
      return 'Ground Ball';
    case 'lineDrive':
      return 'Line Drive';
    case 'flyBall':
      return 'Fly Ball';
    case 'popUp':
      return 'Pop Up';
    case 'bunt':
      return 'Bunt';
    default:
      return 'In Play';
  }
}

/**
 * Returns full name for field zone
 */
export function getZoneLabel(zone?: HitFieldZone): string {
  switch (zone) {
    case 'LF':
      return 'Left Field';
    case 'CF':
      return 'Center Field';
    case 'RF':
      return 'Right Field';
    case '3B':
      return 'Third Base';
    case 'SS':
      return 'Shortstop';
    case '2B':
      return 'Second Base';
    case '1B':
      return 'First Base';
    case 'P':
      return 'Pitcher';
    case 'C':
      return 'Catcher';
    default:
      return 'Field';
  }
}

/**
 * Suggests default trajectory for a play code
 */
export function getDefaultTrajectoryForPlay(code: PlayCode): HitTrajectory {
  switch (code) {
    case 'homeRun':
      return 'flyBall';
    case 'triple':
      return 'lineDrive';
    case 'double':
      return 'lineDrive';
    case 'single':
      return 'lineDrive';
    case 'sacFly':
      return 'flyBall';
    case 'sacBunt':
      return 'bunt';
    case 'groundedIntoDoublePlay':
      return 'grounder';
    default:
      return 'lineDrive';
  }
}

/**
 * Quick preset coordinates (percentage 0..100) for standard zones
 */
export const ZONE_PRESET_COORDINATES: Record<HitFieldZone, { x: number; y: number }> = {
  LF: { x: 23, y: 38 },
  CF: { x: 50, y: 18 },
  RF: { x: 77, y: 38 },
  SS: { x: 41, y: 62 },
  '2B': { x: 59, y: 62 },
  '3B': { x: 34, y: 72 },
  '1B': { x: 66, y: 72 },
  P: { x: 50, y: 66 },
  C: { x: 50, y: 90 },
};

/**
 * The infield is the dirt circle around the pitcher's mound (what you see on a real field).
 * Everything inside it is infield; everything beyond it, in fair territory, is outfield.
 */
export const INFIELD_CENTER = { x: 150, y: 216 };
export const INFIELD_DIRT_RADIUS = 62;

/** Distance from home plate (150,260) to the edge of the infield dirt, along a bearing (0 = up the middle). */
export function infieldEdgeDistance(angleDeg: number): number {
  const a = (angleDeg * Math.PI) / 180;
  const k = 260 - INFIELD_CENTER.y; // home is this far below the circle centre
  const b = k * Math.cos(a);
  const disc = b * b - (k * k - INFIELD_DIRT_RADIUS * INFIELD_DIRT_RADIUS);
  return b + Math.sqrt(Math.max(0, disc));
}
/** Half-width of the centre-field sector, in degrees either side of straight-away centre. */
export const CENTER_HALF_ANGLE = 15;

/**
 * Calculate the zone from percentage coordinates (x: 0-100, y: 0-100)
 * SVG coordinate space: (150, 260) is home plate in a 300x300 viewBox
 */
export function getZoneFromCoordinates(xPct: number, yPct: number): HitFieldZone {
  // Convert percentage to 300x300 canvas coordinates
  const svgX = (xPct / 100) * 300;
  const svgY = (yPct / 100) * 300;

  // Home plate reference
  const homeX = 150;
  const homeY = 260;

  const dx = svgX - homeX;
  const dy = svgY - homeY; // Negative when moving toward outfield
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Angle from home plate in degrees: 0° is straight CF, negative is left, positive is right
  const angleDeg = Math.atan2(dx, -dy) * (180 / Math.PI);

  // Catcher / Home plate
  if (dist < 32 || dy > 10) {
    return 'C';
  }

  // Pitcher mound area
  if (dist < 72 && Math.abs(angleDeg) < 16) {
    return 'P';
  }

  // Infield: inside the dirt circle around the mound
  if (dist < infieldEdgeDistance(angleDeg)) {
    if (angleDeg < -20) return '3B';
    if (angleDeg < -2) return 'SS';
    if (angleDeg <= 20) return '2B';
    return '1B';
  }

  // Outfield: three equal 30-degree sectors (Left / Center / Right)
  if (angleDeg < -15) return 'LF';
  if (angleDeg <= 15) return 'CF';
  return 'RF';
}

/**
 * The zone for a stored hit location, always recomputed from where the ball landed and how it
 * was hit (so older saved plays pick up the same rules as new ones).
 */
export function resolveZone(loc: HitLocation): HitFieldZone {
  return getZoneFromCoordinates(loc.x, loc.y);
}

/**
 * Zone used for display (Zones view + PDF report). Same as the stored/classified zone, except the
 * thin 16-20 degree slivers beside the mound (classified SS / 2B) are folded into P so the drawn
 * zone map stays clean.
 */
export function getDisplayZone(loc: HitLocation): HitFieldZone {
  const zone = resolveZone(loc);
  if (zone === 'SS' || zone === '2B') {
    const dx = (loc.x / 100) * 300 - 150;
    const dy = (loc.y / 100) * 300 - 260;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ang = Math.abs(Math.atan2(dx, -dy) * (180 / Math.PI));
    if (dist >= 32 && dist < 72 && ang >= 16 && ang <= 20) return 'P';
  }
  return zone;
}

/**
 * Returns broad direction: 'left' | 'center' | 'right'
 */
export function getDirectionFromCoordinates(xPct: number, yPct: number): 'left' | 'center' | 'right' {
  const svgX = (xPct / 100) * 300;
  const svgY = (yPct / 100) * 300;
  const dx = svgX - 150;
  const dy = svgY - 260;
  const angleDeg = Math.atan2(dx, -dy) * (180 / Math.PI);

  if (angleDeg < -CENTER_HALF_ANGLE) return 'left';
  if (angleDeg > CENTER_HALF_ANGLE) return 'right';
  return 'center';
}

/**
 * Aggregate spray chart statistics across any collection of plays
 */
export function calculateSprayStats(plays: Play[]): SprayChartStats {
  const battedPlays = plays.filter(
    (p) => p.mode === 'batting' && isBattedBallPlay(p.code) && p.hitLocation
  );

  const initialZoneCounts: Record<HitFieldZone, { total: number; hits: number }> = {
    LF: { total: 0, hits: 0 },
    CF: { total: 0, hits: 0 },
    RF: { total: 0, hits: 0 },
    '3B': { total: 0, hits: 0 },
    SS: { total: 0, hits: 0 },
    '2B': { total: 0, hits: 0 },
    '1B': { total: 0, hits: 0 },
    P: { total: 0, hits: 0 },
    C: { total: 0, hits: 0 },
  };

  let hitsCount = 0;
  let rbiHitsCount = 0;
  let nonRbiHitsCount = 0;
  let totalRbisOnHits = 0;
  let outsCount = 0;
  let rbiOutsCount = 0;
  let leftCount = 0;
  let centerCount = 0;
  let rightCount = 0;
  let infieldCount = 0;
  let outfieldCount = 0;

  let grounderCount = 0;
  let lineDriveCount = 0;
  let flyBallCount = 0;
  let popUpCount = 0;
  let buntCount = 0;

  battedPlays.forEach((play) => {
    const loc = play.hitLocation!;
    const isHit = isHitPlay(play.code);
    const runCtx = getPlayRunContext(play, plays);

    if (isHit) {
      hitsCount++;
      if (runCtx.rbiCount > 0) {
        rbiHitsCount++;
        totalRbisOnHits += runCtx.rbiCount;
      } else {
        nonRbiHitsCount++;
      }
    } else {
      outsCount++;
      if (runCtx.rbiCount > 0) {
        rbiOutsCount++;
      }
    }

    const zone = resolveZone(loc);
    if (initialZoneCounts[zone]) {
      initialZoneCounts[zone].total++;
      if (isHit) initialZoneCounts[zone].hits++;
    }

    // Infield vs Outfield
    if (['3B', 'SS', '2B', '1B', 'P', 'C'].includes(zone)) {
      infieldCount++;
    } else {
      outfieldCount++;
    }

    // Direction
    const dir = getDirectionFromCoordinates(loc.x, loc.y);
    if (dir === 'left') leftCount++;
    else if (dir === 'right') rightCount++;
    else centerCount++;

    // Trajectory
    const traj = loc.trajectory || getDefaultTrajectoryForPlay(play.code);
    if (traj === 'grounder') grounderCount++;
    else if (traj === 'lineDrive') lineDriveCount++;
    else if (traj === 'flyBall') flyBallCount++;
    else if (traj === 'popUp') popUpCount++;
    else if (traj === 'bunt') buntCount++;
  });

  const totalWithLocation = battedPlays.length;
  const calcPct = (count: number) =>
    totalWithLocation > 0 ? Math.round((count / totalWithLocation) * 100) : 0;

  return {
    totalPlays: plays.filter((p) => p.mode === 'batting' && isBattedBallPlay(p.code)).length,
    totalWithLocation,
    hitsCount,
    rbiHitsCount,
    nonRbiHitsCount,
    totalRbisOnHits,
    outsCount,
    rbiOutsCount,
    leftCount,
    leftPct: calcPct(leftCount),
    centerCount,
    centerPct: calcPct(centerCount),
    rightCount,
    rightPct: calcPct(rightCount),
    infieldCount,
    infieldPct: calcPct(infieldCount),
    outfieldCount,
    outfieldPct: calcPct(outfieldCount),
    grounderCount,
    grounderPct: calcPct(grounderCount),
    lineDriveCount,
    lineDrivePct: calcPct(lineDriveCount),
    flyBallCount,
    flyBallPct: calcPct(flyBallCount),
    popUpCount,
    popUpPct: calcPct(popUpCount),
    buntCount,
    buntPct: calcPct(buntCount),
    zoneCounts: initialZoneCounts,
  };
}
