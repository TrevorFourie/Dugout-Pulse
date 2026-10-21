import * as THREE from 'three';
import { INFIELD_CENTER, INFIELD_DIRT_RADIUS } from '../utils/sprayChart';
import {
  FENCE,
  GRASS_DIAMOND,
  HOME,
  HOME_DIRT_RADIUS,
  MOUND,
  MOUND_RADIUS,
  STRIPE_STEP,
} from '../utils/fieldGeometry';

/**
 * Scenery for the 3D hit replay: painted textures (field, sky, crowd, wall) and the stadium that
 * wraps the outfield. Everything here is built procedurally, so there are no image assets to ship.
 * World space: X = fieldX - 150, Z = fieldY - 260 (home plate at the origin, outfield toward -Z).
 */

export const wx = (fieldX: number) => fieldX - HOME.x;
export const wz = (fieldY: number) => fieldY - HOME.y;

/* ---------- small helpers ---------- */

/** Deterministic random numbers so the painted textures look the same every time. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const makeCanvas = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')!];
};

const toTexture = (canvas: HTMLCanvasElement, srgb = true): THREE.CanvasTexture => {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mixColor = (a: [number, number, number], b: [number, number, number], t: number) =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;

/** Soft round blob with a feathered edge. `rgb` is "r,g,b". */
function blob(g: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, alpha: number) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(${rgb},${alpha})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** Frees every texture a material holds, then the material itself. */
export function disposeMaterial(material: THREE.Material) {
  Object.values(material).forEach((value) => {
    if (value && (value as THREE.Texture).isTexture) (value as THREE.Texture).dispose();
  });
  material.dispose();
}

/* ---------- field texture ---------- */

const PALETTE = {
  grassLight: '#52b45f',
  grassDark: '#3b9a4b',
  foulLight: '#3f9150',
  foulDark: '#37874a',
  base: '#2f7d3e',
  track: '#b9855a',
  dirt: '#c8975f',
  dirtLight: '#dcb27c',
  dirtDark: '#a8723f',
};

/** The painted ground covers field-space -100..400 so the grass runs past the foul lines. */
export const FIELD_TEXTURE = { origin: -100, span: 500 };

export function makeFieldTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const SIZE = 2048;
  const k = SIZE / FIELD_TEXTURE.span;
  const [canvas, g] = makeCanvas(SIZE, SIZE);
  g.setTransform(k, 0, 0, k, -FIELD_TEXTURE.origin * k, -FIELD_TEXTURE.origin * k);
  const rand = makeRng(11);
  const lo = FIELD_TEXTURE.origin;
  const hi = FIELD_TEXTURE.origin + FIELD_TEXTURE.span;

  const grassLight = hexRgb(PALETTE.grassLight);
  const grassDark = hexRgb(PALETTE.grassDark);
  /** Smooth square wave: broad flat bands with soft edges, so the mowing reads as cut grass. */
  const wave = (distance: number, period: number) => {
    const s = Math.sin((distance / period) * Math.PI) * 4;
    return (Math.max(-1, Math.min(1, s)) + 1) / 2;
  };

  const fairPath = () => {
    g.beginPath();
    g.moveTo(HOME.x, HOME.y);
    g.lineTo(28, 138);
    g.ellipse(FENCE.cx, FENCE.cy, FENCE.rx, FENCE.ry, 0, Math.PI, 2 * Math.PI);
    g.closePath();
  };
  const diamondPath = () => {
    g.beginPath();
    GRASS_DIAMOND.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };
  const rings = (clip: () => void) => {
    g.save();
    clip();
    g.clip();
    for (let r = 260; r > 0; r -= 1) {
      g.fillStyle = mixColor(grassDark, grassLight, wave(r, STRIPE_STEP));
      g.beginPath();
      g.arc(HOME.x, HOME.y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  };

  // Surrounding foul territory: natural, low-contrast turf rather than strong square mowing bands.
  // This softens the visual edge where the baseball-specific field texture meets the wider meadow.
  g.fillStyle = PALETTE.base;
  g.fillRect(lo, lo, hi - lo, hi - lo);
  for (let i = 0; i < 2600; i++) {
    const x = lo + rand() * (hi - lo);
    const y = lo + rand() * (hi - lo);
    const dark = rand() > 0.5;
    blob(g, x, y, 2 + rand() * 11, dark ? '10,40,18' : '210,255,170', 0.018 + rand() * 0.025);
  }
  // Keep the distinctive mowing rings on the playable fair-territory surface.
  rings(fairPath);

  // Soft patches of lighter and darker turf
  for (let i = 0; i < 520; i++) {
    const dark = rand() > 0.5;
    blob(g, lo + rand() * (hi - lo), lo + rand() * (hi - lo), 5 + rand() * 20, dark ? '10,40,18' : '210,255,170', 0.025 + rand() * 0.03);
  }

  /* warning track along the wall, fair and foul sides */
  // The warning track follows ONLY the curved outfield fence. Do not draw straight
  // sand-coloured extensions down the foul lines into the scenery behind home plate.
  const trackPath = (inset: number) => {
    g.beginPath();
    g.ellipse(FENCE.cx, FENCE.cy, FENCE.rx - inset, FENCE.ry - inset, 0, Math.PI, 2 * Math.PI);
  };
  g.lineCap = 'butt';
  g.lineJoin = 'round';
  [
    [20, 0.25],
    [18, 0.45],
    [16.5, 1],
  ].forEach(([w, a]) => {
    g.strokeStyle = PALETTE.track;
    g.globalAlpha = a;
    g.lineWidth = w;
    trackPath(8.7);
    g.stroke();
  });
  g.globalAlpha = 1;
  // Raked lines and a darker band hugging the wall
  for (let o = 1; o < 16; o += 0.9) {
    g.strokeStyle = Math.round(o * 10) % 2 ? 'rgba(255,238,205,0.09)' : 'rgba(70,40,18,0.1)';
    g.lineWidth = 0.28;
    trackPath(o);
    g.stroke();
  }
  g.strokeStyle = 'rgba(40,22,10,0.22)';
  g.lineWidth = 3;
  trackPath(1.5);
  g.stroke();
  for (let i = 0; i < 5200; i++) {
    const o = rand() * 17;
    let x: number;
    let y: number;
    // Keep all warning-track rake marks on the outfield arc; never extend
    // them along the foul lines or into the backstop scenery.
    const t = rand() * Math.PI;
    x = FENCE.cx + (FENCE.rx - o) * Math.cos(t);
    y = FENCE.cy - (FENCE.ry - o) * Math.sin(t);
    g.fillStyle = rand() > 0.5 ? 'rgba(255,235,200,0.16)' : 'rgba(60,34,14,0.18)';
    g.fillRect(x, y, 0.5 + rand() * 0.6, 0.5 + rand() * 0.6);
  }

  /* infield skin */
  const skin = g.createRadialGradient(HOME.x, 226, 2, HOME.x, 226, 82);
  skin.addColorStop(0, PALETTE.dirtLight);
  skin.addColorStop(0.55, PALETTE.dirt);
  skin.addColorStop(1, PALETTE.dirtDark);
  g.fillStyle = skin;
  g.beginPath();
  g.arc(INFIELD_CENTER.x, INFIELD_CENTER.y, INFIELD_DIRT_RADIUS, 0, Math.PI * 2);
  g.fill();
  // Ragged edge where the dirt meets the grass
  for (let i = 0; i < 2600; i++) {
    const a = rand() * Math.PI * 2;
    const outside = rand() > 0.5;
    const r = INFIELD_DIRT_RADIUS + (outside ? rand() * rand() * 2.2 : -rand() * rand() * 1.8);
    g.fillStyle = outside ? 'rgba(196,148,96,0.7)' : 'rgba(76,150,86,0.5)';
    const d = 0.25 + rand() * 0.4;
    g.fillRect(INFIELD_CENTER.x + Math.cos(a) * r, INFIELD_CENTER.y + Math.sin(a) * r, d, d);
  }
  g.strokeStyle = 'rgba(80,48,20,0.2)';
  g.lineWidth = 0.7;
  g.beginPath();
  g.arc(INFIELD_CENTER.x, INFIELD_CENTER.y, INFIELD_DIRT_RADIUS - 0.4, 0, Math.PI * 2);
  g.stroke();

  g.save();
  g.beginPath();
  g.arc(INFIELD_CENTER.x, INFIELD_CENTER.y, INFIELD_DIRT_RADIUS, 0, Math.PI * 2);
  g.clip();
  // Drag-mat arcs around the mound and home, plus a worked-in base path
  for (let r = 11; r < 82; r += 1.15) {
    g.strokeStyle = Math.round(r * 10) % 2 ? 'rgba(255,236,200,0.075)' : 'rgba(80,46,18,0.085)';
    g.lineWidth = 0.4;
    g.beginPath();
    g.arc(MOUND.x, MOUND.y + 4, r, 0, Math.PI * 2);
    g.stroke();
  }
  for (let r = 18; r < 46; r += 1.4) {
    g.strokeStyle = Math.round(r * 10) % 2 ? 'rgba(255,236,200,0.06)' : 'rgba(80,46,18,0.07)';
    g.lineWidth = 0.4;
    g.beginPath();
    g.arc(HOME.x, HOME.y, r, 0, Math.PI * 2);
    g.stroke();
  }
  for (let i = 0; i < 9000; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * INFIELD_DIRT_RADIUS;
    g.fillStyle = rand() > 0.5 ? 'rgba(255,232,190,0.16)' : 'rgba(70,40,16,0.2)';
    g.fillRect(INFIELD_CENTER.x + Math.cos(a) * r, INFIELD_CENTER.y + Math.sin(a) * r, 0.4 + rand() * 0.7, 0.4 + rand() * 0.7);
  }
  g.restore();

  // Home plate dirt
  const homeSkin = g.createRadialGradient(HOME.x, HOME.y, 0, HOME.x, HOME.y, HOME_DIRT_RADIUS);
  homeSkin.addColorStop(0, PALETTE.dirtLight);
  homeSkin.addColorStop(1, PALETTE.dirt);
  g.fillStyle = homeSkin;
  g.beginPath();
  g.arc(HOME.x, HOME.y, HOME_DIRT_RADIUS, 0, Math.PI * 2);
  g.fill();

  // Infield grass with its own mowing and a crisp edge
  rings(diamondPath);
  g.save();
  diamondPath();
  g.clip();
  g.strokeStyle = 'rgba(8,40,16,0.32)';
  g.lineWidth = 2.4;
  diamondPath();
  g.stroke();
  g.restore();

  // Mound
  const mound = g.createRadialGradient(MOUND.x - 2, MOUND.y - 2, 0, MOUND.x, MOUND.y, MOUND_RADIUS + 1);
  mound.addColorStop(0, PALETTE.dirtLight);
  mound.addColorStop(1, PALETTE.dirt);
  g.fillStyle = mound;
  g.beginPath();
  g.arc(MOUND.x, MOUND.y, MOUND_RADIUS, 0, Math.PI * 2);
  g.fill();

  /* chalk */
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,0.14)';
  g.lineWidth = 3.4;
  g.beginPath();
  g.moveTo(HOME.x, HOME.y);
  g.lineTo(28.6, 138.6);
  g.moveTo(HOME.x, HOME.y);
  g.lineTo(271.4, 138.6);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 1.5;
  g.stroke();
  g.lineWidth = 0.8;
  g.strokeRect(136, 253, 7, 12);
  g.strokeRect(157, 253, 7, 12);

  // No dark radial vignette: keep the grass bright and the golden-hour atmosphere intact.

  // Fine grain
  for (let i = 0; i < 60000; i++) {
    g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.055)';
    g.fillRect(lo + rand() * (hi - lo), lo + rand() * (hi - lo), 0.35, 0.35);
  }

  const texture = toTexture(canvas);
  texture.anisotropy = maxAnisotropy;
  return texture;
}

/* ---------- sky ---------- */

/**
 * Bright, warm ballpark sky: orange glow on the horizon, melting through peach and cream into a clear
 * blue. The replay cameras only look a few degrees above the horizon, so the whole blue-to-orange
 * transition is packed into the first ~10 degrees of elevation. No grey anywhere.
 */
export function makeSkyTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = 1024;
  const [canvas, g] = makeCanvas(W, H);
  const rand = makeRng(5);
  const yAt = (elevationDeg: number) => H / 2 - (elevationDeg / 180) * H;

  const grad = g.createLinearGradient(0, 0, 0, H);
  const stops: [number, string][] = [
    [90, '#1b5db6'],
    [40, '#2a74cc'],
    [20, '#2f80d6'],
    [11, '#3d8fe0'],
    [7.5, '#58a4ec'],
    [5.6, '#7cbcf0'],
    [4.4, '#b4dcf4'],
    [3.4, '#f6ecd6'],
    [2, '#ffd7a0'],
    [1, '#ffb877'],
    [0.2, '#ff9d52'],
    [-1, '#fbc58c'],
    [-6, '#f4c79a'],
    [-25, '#deb08a'],
    [-90, '#b98f72'],
  ];
  stops.forEach(([deg, color]) => grad.addColorStop(Math.min(1, Math.max(0, yAt(deg) / H)), color));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // Low, wide sun glow toward the outfield (u = 0.25 is straight out past centre field)
  const sunX = W * 0.29;
  const glow = (x: number, y: number, rx: number, ry: number, rgb: string, a: number) => {
    g.save();
    g.translate(x, y);
    g.scale(rx / ry, 1);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, ry, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  glow(sunX, yAt(1.4), 560, 40, '255,190,110', 0.7);
  glow(sunX, yAt(1.0), 240, 20, '255,226,170', 0.8);
  glow(sunX, yAt(0.7), 90, 10, '255,248,225', 0.9);

  // Soft sunset clouds: white tops, warm orange undersides, never grey
  const cloud = (cx: number, cy: number, rx: number, ry: number) => {
    const elev = ((H / 2 - cy) / H) * 180;
    const lowMix = Math.max(0, Math.min(1, 1 - elev / 14));
    const puffs = 6 + Math.floor(rand() * 5);
    for (let i = 0; i < puffs; i++) {
      const px = cx + (rand() - 0.5) * rx * 1.7;
      const py = cy + (rand() - 0.5) * ry * 0.7;
      const pr = ry * (0.7 + rand() * 0.7);
      glow(px, py + pr * 0.3, pr * 2.6, pr, `255,${Math.round(150 + 60 * (1 - lowMix))},${Math.round(100 + 70 * (1 - lowMix))}`, 0.16 + 0.06 * lowMix);
      glow(px, py - pr * 0.15, pr * 2.2, pr * 0.85, `255,${Math.round(240 - 25 * lowMix)},${Math.round(228 - 60 * lowMix)}`, 0.2);
    }
  };
  for (let i = 0; i < 26; i++) cloud(rand() * W, yAt(3 + rand() * 15), 90 + rand() * 150, 9 + rand() * 12);

  return toTexture(canvas);
}

/**
 * Forested ridges that ring the ballpark: the bowl of hills around Lamade Stadium. Three layers
 * fade from hazy blue in the distance to deeper green nearby. Wraps without a seam.
 */
export function makeHorizonTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = 256;
  const STEP = 8;
  const [canvas, g] = makeCanvas(W, H);
  const rand = makeRng(9);
  const columns = W / STEP;
  const layer = (base: number, amp: number, round: number, phase: number, top: string, bottom: string) => {
    const noise = Array.from({ length: columns }, () => rand() - 0.5);
    const grad = g.createLinearGradient(0, H - base - amp * 1.6, 0, H);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, H);
    for (let i = 0; i <= columns; i++) {
      const x = i * STEP;
      const a = (x / W) * Math.PI * 2;
      const hills = Math.sin(a * 3 + phase) * amp + Math.sin(a * 7 + phase * 2) * amp * 0.5 + Math.sin(a * 13 + phase * 3) * amp * 0.2;
      g.lineTo(x, H - base - hills - noise[i % columns] * round);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  };
  layer(146, 10, 2, 1, 'rgba(128,168,206,1)', 'rgba(170,196,214,1)');
  layer(122, 8, 4, 2.3, 'rgba(92,146,160,1)', 'rgba(124,168,164,1)');
  layer(98, 4, 12, 3.7, 'rgba(58,112,80,1)', 'rgba(70,116,72,1)');
  g.fillStyle = 'rgba(70,112,70,1)';
  g.fillRect(0, H - 80, W, 80);
  const texture = toTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

/**
 * Textured meadow beyond the painted field. This bridges the gap between the ballpark and the
 * distant horizon so the scene doesn't dissolve into one enormous, featureless green plane.
 */
export function makeFarGroundTexture(): THREE.CanvasTexture {
  const SIZE = 1024;
  const [canvas, g] = makeCanvas(SIZE, SIZE);
  const rand = makeRng(63);
  g.fillStyle = '#527f43';
  g.fillRect(0, 0, SIZE, SIZE);

  // Broad, overlapping meadow tones read as terrain from the normal replay camera.
  const meadow = ['#60894a', '#47783f', '#709351', '#527f43', '#3f713b', '#789654'];
  for (let i = 0; i < 230; i++) {
    const x = rand() * SIZE;
    const y = rand() * SIZE;
    const rx = 18 + rand() * 105;
    const ry = 12 + rand() * 70;
    g.fillStyle = meadow[Math.floor(rand() * meadow.length)];
    g.globalAlpha = 0.08 + rand() * 0.13;
    g.beginPath();
    g.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  // Fine mottling prevents the distant grass from looking like a single flat colour.
  for (let i = 0; i < 18000; i++) {
    const light = rand() > 0.54;
    g.fillStyle = light ? 'rgba(196,218,145,0.09)' : 'rgba(22,55,27,0.10)';
    const size = 1 + rand() * 4;
    g.fillRect(rand() * SIZE, rand() * SIZE, size, size * (0.35 + rand() * 0.8));
  }

  // Small irregular shrub/tree marks in loose groves, not a repeated pattern.
  for (let grove = 0; grove < 34; grove++) {
    const cx = rand() * SIZE;
    const cy = rand() * SIZE;
    const count = 12 + Math.floor(rand() * 28);
    for (let i = 0; i < count; i++) {
      const x = cx + (rand() - 0.5) * 100;
      const y = cy + (rand() - 0.5) * 80;
      const r = 1.5 + rand() * 4;
      g.fillStyle = rand() > 0.5 ? 'rgba(35,74,36,0.30)' : 'rgba(31,63,33,0.22)';
      g.beginPath();
      g.ellipse(x, y, r * 1.3, r, rand() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  }
  const texture = toTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.anisotropy = 4;
  return texture;
}

/* ---------- soft sprites ---------- */

/** Soft glow texture retained for compatibility with existing replay imports. */
export function makeRadialTexture(): THREE.CanvasTexture {
  const [canvas, g] = makeCanvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.65, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return toTexture(canvas);
}

/** Vertical fade used as an alpha map: solid at the bottom of the shape, clear at the top. */
export function makeBeamTexture(): THREE.CanvasTexture {
  const [canvas, g] = makeCanvas(4, 128);
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.55, '#222');
  grad.addColorStop(1, '#fff');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  return toTexture(canvas, false);
}

/* ---------- the ballpark ---------- */

/**
 * Howard J. Lamade Stadium, kept simple: a green outfield wall with a yellow cap, a big terraced
 * grass hill behind it dotted with fans and ringed by trees, and a roofed concrete grandstand that
 * wraps behind home plate and runs down both baselines.
 */

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => t * t * (3 - 2 * t);

export const WALL_HEIGHT = 8;

interface PathPoint {
  x: number;
  z: number;
  nx: number;
  nz: number;
  /** Distance travelled along the path, used for texture coordinates. */
  length: number;
  /** 1 along the outfield arc, easing to 0 at the far ends of the side returns. */
  k: number;
}

const SIDE_N = 18;
const SIDE_LEN = 44;
const ARC_N = 96;

/**
 * Outfield wall line, left to right: a short return down the left foul side, the curved fence
 * between the foul poles, and a short return down the right side. Normals point away from the field.
 */
function outfieldPath(): PathPoint[] {
  const raw: Omit<PathPoint, 'length'>[] = [];
  const poleZ = wz(FENCE.cy);
  const leftX = wx(FENCE.cx - FENCE.rx);
  const rightX = wx(FENCE.cx + FENCE.rx);
  for (let i = 0; i < SIDE_N; i++) {
    const f = 1 - i / SIDE_N;
    raw.push({ x: leftX, z: poleZ + SIDE_LEN * f, nx: -1, nz: 0, k: 1 - smooth(f) });
  }
  for (let i = 0; i <= ARC_N; i++) {
    const t = Math.PI - (Math.PI * i) / ARC_N;
    const ex = Math.cos(t) / FENCE.rx;
    const ez = -Math.sin(t) / FENCE.ry;
    const len = Math.hypot(ex, ez);
    raw.push({ x: wx(FENCE.cx + FENCE.rx * Math.cos(t)), z: wz(FENCE.cy - FENCE.ry * Math.sin(t)), nx: ex / len, nz: ez / len, k: 1 });
  }
  for (let i = 1; i <= SIDE_N; i++) {
    const f = i / SIDE_N;
    raw.push({ x: rightX, z: poleZ + SIDE_LEN * f, nx: 1, nz: 0, k: 1 - smooth(f) });
  }
  let length = 0;
  return raw.map((p, i) => {
    if (i) length += Math.hypot(p.x - raw[i - 1].x, p.z - raw[i - 1].z);
    return { ...p, length };
  });
}

/* ----- fence ----- */

/** A ribbon swept along the fence line. `profile` is [outward distance, height] pairs. */
function fenceRibbon(path: PathPoint[], profile: [number, number][], uScale: number, vScale: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const along: number[] = [0];
  for (let j = 1; j < profile.length; j++) along.push(along[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
  path.forEach((p) => {
    // The return fences sink to a low rail as the hill dies away
    const hf = 0.45 + 0.55 * p.k;
    profile.forEach(([d, h], j) => {
      positions.push(p.x + p.nx * d, h * hf, p.z + p.nz * d);
      uvs.push(p.length / uScale, along[j] / vScale);
    });
  });
  const row = profile.length;
  for (let i = 0; i < path.length - 1; i++) {
    for (let j = 0; j < row - 1; j++) {
      const a = i * row + j;
      indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Padded outfield wall: dark green panels with a few sponsor-style blocks. */
function makeWallTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 128;
  const [canvas, g] = makeCanvas(W, H);
  const rand = makeRng(21);
  const panels = ['#154226', '#1a4a2b', '#154226', '#123a22', '#1d5030'];
  const PANEL = 64;
  for (let x = 0; x < W; x += PANEL) {
    g.fillStyle = panels[Math.floor(rand() * panels.length)];
    g.fillRect(x, 0, PANEL, H);
    if (rand() > 0.6) {
      g.fillStyle = ['#d8d8d8', '#e0a82e', '#c9373f', '#f2f2f2'][Math.floor(rand() * 4)];
      g.globalAlpha = 0.8;
      g.fillRect(x + 8, 30, PANEL * (1 + Math.floor(rand() * 2)) - 16, 44);
      g.globalAlpha = 1;
    }
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x, 0, 2, H);
  }
  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(255,255,255,0.14)');
  shade.addColorStop(0.2, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.32)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
  const texture = toTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/* ----- the hill ----- */

const HILL = {
  /** How far the hill reaches back from the fence. */
  depth: 122,
  rows: 64,
  crest: 17,
  terraces: 5,
  /** Distance from the wall at which the terraced face reaches the crest. */
  riseEnd: 56,
  fallStart: 64,
  fallLen: 58,
};
const TERRACE_SPAN = HILL.riseEnd / HILL.terraces;

/** Height of the hill at distance `d` behind the fence, before the end-taper `k` is applied. */
function hillProfile(d: number): number {
  const n = HILL.terraces;
  const u = clamp01(d / HILL.riseEnd);
  const q = u * n;
  const step = Math.floor(q);
  // Flat bench for the first part of every step, then a gentle riser up to the next one
  const v = u >= 1 ? 1 : (step + smooth(clamp01((q - step - 0.4) / 0.6))) / n;
  const fall = 1 - smooth(clamp01((d - HILL.fallStart) / HILL.fallLen));
  return HILL.crest * v * fall;
}

/** The hill surface, one smooth grid with no seams. Both ends ease down into the ground. */
function makeHillGeometry(path: PathPoint[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const cols = HILL.rows + 1;
  path.forEach((p) => {
    for (let j = 0; j <= HILL.rows; j++) {
      const d = (HILL.depth * j) / HILL.rows;
      positions.push(p.x + p.nx * d, 0.04 + p.k * hillProfile(d), p.z + p.nz * d);
      uvs.push(p.length / 64, d / TERRACE_SPAN);
    }
  });
  for (let i = 0; i < path.length - 1; i++) {
    for (let j = 0; j < HILL.rows; j++) {
      const a = i * cols + j;
      const b = a + cols;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** One terrace of lawn: mown bench, darker riser, and the odd blanket or chair dotted about. */
function makeHillTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 256;
  const [canvas, g] = makeCanvas(W, H);
  const rand = makeRng(77);
  const benchEnd = H * 0.4; // matches the flat part of each step (canvas y runs opposite to v)
  g.fillStyle = '#5fa046';
  g.fillRect(0, 0, W, H);
  const lawn = g.createLinearGradient(0, 0, 0, H);
  lawn.addColorStop(0, '#67aa4b');
  lawn.addColorStop(0.55, '#5c9c44');
  lawn.addColorStop(1, '#4f8c3b');
  g.fillStyle = lawn;
  g.fillRect(0, 0, W, H);
  void benchEnd;
  for (let i = 0; i < 520; i++) {
    g.fillStyle = rand() > 0.5 ? 'rgba(190,235,140,0.10)' : 'rgba(20,70,25,0.10)';
    g.fillRect(rand() * W, rand() * H, 6 + rand() * 30, 2 + rand() * 5);
  }
  const palette = ['#e8e8e8', '#d9453d', '#3f6fc4', '#f0c040', '#ffffff', '#e38a3a', '#7b5fb5'];
  for (let i = 0; i < 90; i++) {
    const x = rand() * W;
    const y = H * (0.12 + rand() * 0.45);
    g.fillStyle = palette[Math.floor(rand() * palette.length)];
    g.fillRect(x, y, 6 + rand() * 5, 4 + rand() * 3);
    g.fillStyle = 'rgba(70,45,30,0.9)';
    g.fillRect(x + 2, y - 5, 3, 5);
  }
  const texture = toTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 6;
  return texture;
}

/** A ring of trees along the crest and back slope: simple rounded crowns on short trunks. */
function makeTrees(path: PathPoint[]): THREE.Group {
  const group = new THREE.Group();
  const rand = makeRng(117);
  const spots: { x: number; y: number; z: number; s: number; c: number }[] = [];
  for (let i = 0; i < path.length; i += 2) {
    const p = path[i];
    for (let r = 0; r < 3; r++) {
      if (rand() < 0.14) continue;
      const d = 68 + r * 15 + rand() * 12;
      spots.push({
        x: p.x + p.nx * d + (rand() - 0.5) * 6,
        z: p.z + p.nz * d + (rand() - 0.5) * 6,
        y: p.k * hillProfile(d) + 0.04,
        s: 0.85 + rand() * 0.75,
        c: rand(),
      });
    }
  }
  const greens = ['#3f7a3a', '#4f8c42', '#5f9a4a', '#2f6a38', '#6aa04f'].map((c) => new THREE.Color(c));
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 1.05, 6, 6).translate(0, 3, 0), new THREE.MeshStandardMaterial({ color: '#6b4d36', roughness: 1 }), spots.length);
  const crownA = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), spots.length);
  const crownB = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  spots.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.c * 6.28);
    trunks.setMatrixAt(i, m.compose(pos.set(t.x, t.y, t.z), q, scl.set(t.s, t.s, t.s)));
    crownA.setMatrixAt(i, m.compose(pos.set(t.x, t.y + 9 * t.s, t.z), q, scl.set(4.6 * t.s, 5 * t.s, 4.6 * t.s)));
    crownB.setMatrixAt(i, m.compose(pos.set(t.x + 0.6 * t.s, t.y + 13.4 * t.s, t.z - 0.4 * t.s), q, scl.set(3.1 * t.s, 3.5 * t.s, 3.1 * t.s)));
    const col = greens[Math.floor(t.c * greens.length) % greens.length];
    crownA.setColorAt(i, col);
    crownB.setColorAt(i, col.clone().offsetHSL(0.01, 0.02, 0.05));
  });
  [trunks, crownA, crownB].forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  return group;
}

/* ----- the grandstand ----- */

interface Seg {
  a: [number, number];
  b: [number, number];
  color: string;
}

/**
 * Straight front edge of one grandstand, parallel to a foul line and set back from it.
 * `side` is -1 for the third-base (left) stand and 1 for the first-base (right) stand.
 */
function grandstandPath(side: -1 | 1): PathPoint[] {
  const STEPS = 30;
  const OFFSET = 26; // sideways distance from the foul line
  const FROM = 22; // distance along the foul line where the stand starts
  const TO = 95; // ...and where it ends
  const along = (t: number) => ({ x: side * (t + OFFSET / Math.SQRT2), z: -t + OFFSET / Math.SQRT2 });
  const pts = Array.from({ length: STEPS + 1 }, (_, i) => along(FROM + ((TO - FROM) * i) / STEPS));
  let length = 0;
  return pts.map((p, i) => {
    if (i) length += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    // Outward normal: away from the field, perpendicular to the foul line
    return { x: p.x, z: p.z, nx: side * Math.SQRT1_2, nz: Math.SQRT1_2, length, k: 1 };
  });
}

/**
 * Sweeps a closed profile along the path as a solid, flat-shaded body with its own colour per
 * face, and caps both ends so nothing is ever see-through.
 */
function sweepSolid(path: PathPoint[], segs: Seg[], outline: [number, number][]): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  const at = (p: PathPoint, [d, h]: [number, number]) => new THREE.Vector3(p.x + p.nx * d, h, p.z + p.nz * d);
  for (let i = 0; i < path.length - 1; i++) {
    for (const seg of segs) {
      const a0 = at(path[i], seg.a);
      const b0 = at(path[i], seg.b);
      const a1 = at(path[i + 1], seg.a);
      const b1 = at(path[i + 1], seg.b);
      color.set(seg.color);
      [a0, b0, a1, a1, b0, b1].forEach((v) => {
        positions.push(v.x, v.y, v.z);
        colors.push(color.r, color.g, color.b);
      });
    }
  }
  const tris = THREE.ShapeUtils.triangulateShape(
    outline.map(([d, h]) => new THREE.Vector2(d, h)),
    [],
  );
  [path[0], path[path.length - 1]].forEach((p) => {
    color.set('#aeb3ba');
    tris.forEach((tri) =>
      tri.forEach((index) => {
        const v = at(p, outline[index]);
        positions.push(v.x, v.y, v.z);
        colors.push(color.r, color.g, color.b);
      }),
    );
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** One roofed concrete grandstand: low front wall, blue seats in stepped rows, white roof on posts. */
function makeGrandstand(path: PathPoint[], material: THREE.Material): THREE.Group {
  const group = new THREE.Group();

  const ROWS = 7;
  const TREAD = 2;
  const RISE = 1.25;
  const FRONT = 3.2;
  const segs: Seg[] = [];
  const outline: [number, number][] = [[0, 0], [0, FRONT], [1.2, FRONT]];
  segs.push({ a: [0, 0], b: [0, FRONT], color: '#c4c8cd' });
  segs.push({ a: [0, FRONT], b: [1.2, FRONT], color: '#d8dbde' });
  let d = 1.2;
  let h = FRONT;
  for (let r = 0; r < ROWS; r++) {
    segs.push({ a: [d, h], b: [d, h + RISE], color: '#27497d' });
    outline.push([d, h + RISE]);
    segs.push({ a: [d, h + RISE], b: [d + TREAD, h + RISE], color: '#3f70b8' });
    outline.push([d + TREAD, h + RISE]);
    d += TREAD;
    h += RISE;
  }
  segs.push({ a: [d, h], b: [d, h + 1.2], color: '#b4b9bf' });
  segs.push({ a: [d, h + 1.2], b: [d, 0], color: '#9aa0a8' });
  segs.push({ a: [d, 0], b: [0, 0], color: '#7c828a' });
  outline.push([d, h + 1.2], [d, 0]);
  const bowl = new THREE.Mesh(sweepSolid(path, segs, outline), material);
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  group.add(bowl);

  const roofBack = d + 2.5;
  const roofSegs: Seg[] = [
    { a: [-1.8, 16.2], b: [roofBack, 17.8], color: '#80868e' },
    { a: [roofBack, 17.8], b: [roofBack, 18.9], color: '#a9aeb5' },
    { a: [roofBack, 18.9], b: [-1.8, 18.2], color: '#ffffff' },
    { a: [-1.8, 18.2], b: [-1.8, 16.2], color: '#2e61ab' },
  ];
  const roofOutline: [number, number][] = [[-1.8, 16.2], [roofBack, 17.8], [roofBack, 18.9], [-1.8, 18.2]];
  const roof = new THREE.Mesh(sweepSolid(path, roofSegs, roofOutline), material);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // Posts holding the roof up, along the back of the bowl
  const SPACING = 9;
  const spots = path.filter((p, i) => i === 0 || i === path.length - 1 || Math.floor(p.length / SPACING) !== Math.floor(path[i - 1].length / SPACING));
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 16.6, 0.8).translate(0, 8.3, 0), new THREE.MeshStandardMaterial({ color: '#b9bec4', roughness: 0.8 }), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  spots.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(p.nx, p.nz));
    posts.setMatrixAt(i, m.compose(new THREE.Vector3(p.x + p.nx * (d - 0.6), 0, p.z + p.nz * (d - 0.6)), q, new THREE.Vector3(1, 1, 1)));
  });
  posts.castShadow = true;
  group.add(posts);
  return group;
}

/* ----- put it together ----- */

export interface Stadium {
  group: THREE.Group;
  /** The outfield wall only, as a depth-only copy. Home runs are hidden behind it and nothing else. */
  occluder: THREE.Group;
  /** Hill surface height and up-direction at a world position (flat ground inside the fence). */
  surfaceAt: (x: number, z: number) => { y: number; normal: THREE.Vector3 };
}

export function buildStadium(): Stadium {
  const group = new THREE.Group();
  const occluder = new THREE.Group();
  const path = outfieldPath();

  // Hill first: it is the base everything else sits on
  const hill = new THREE.Mesh(
    makeHillGeometry(path),
    new THREE.MeshStandardMaterial({ map: makeHillTexture(), roughness: 1, side: THREE.DoubleSide }),
  );
  hill.receiveShadow = true;
  group.add(hill);
  group.add(makeTrees(path));

  // Wall and cap
  const wallGeometry = fenceRibbon(path, [[0, 0], [0, WALL_HEIGHT - 0.9]], 64, 8);
  const capGeometry = fenceRibbon(path, [[-0.5, WALL_HEIGHT - 0.9], [-0.5, WALL_HEIGHT], [0.9, WALL_HEIGHT]], 10, 1);
  const wall = new THREE.Mesh(wallGeometry, new THREE.MeshStandardMaterial({ map: makeWallTexture(), roughness: 0.85, side: THREE.DoubleSide }));
  const cap = new THREE.Mesh(capGeometry, new THREE.MeshStandardMaterial({ color: 0xf5c93a, roughness: 0.5, emissive: 0x6b4d00, emissiveIntensity: 0.5, side: THREE.DoubleSide }));
  [wall, cap].forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  occluder.add(new THREE.Mesh(wallGeometry, depthOnly), new THREE.Mesh(capGeometry, depthOnly));

  const standMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, side: THREE.DoubleSide });
  group.add(makeGrandstand(grandstandPath(-1), standMaterial), makeGrandstand(grandstandPath(1), standMaterial));

  const heightAt = (x: number, z: number) => {
    let best = path[0];
    let bestD2 = Infinity;
    for (const p of path) {
      const d2 = (x - p.x) ** 2 + (z - p.z) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = p;
      }
    }
    const d = (x - best.x) * best.nx + (z - best.z) * best.nz;
    return d <= 0 || d > HILL.depth ? 0 : best.k * hillProfile(d) + 0.04;
  };
  const surfaceAt: Stadium['surfaceAt'] = (x, z) => {
    const e = 0.8;
    const y = heightAt(x, z);
    const normal = new THREE.Vector3(-(heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), 1, -(heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e)).normalize();
    return { y, normal };
  };

  return { group, occluder, surfaceAt };
}
