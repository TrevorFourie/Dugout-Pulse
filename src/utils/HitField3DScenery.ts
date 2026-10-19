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
  const trackPath = (inset: number) => {
    g.beginPath();
    g.moveTo(28 + inset, 330);
    g.lineTo(28 + inset, FENCE.cy);
    g.ellipse(FENCE.cx, FENCE.cy, FENCE.rx - inset, FENCE.ry - inset, 0, Math.PI, 2 * Math.PI);
    g.lineTo(272 - inset, 330);
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
    const part = rand();
    if (part < 0.64) {
      const t = rand() * Math.PI;
      x = FENCE.cx + (FENCE.rx - o) * Math.cos(t);
      y = FENCE.cy - (FENCE.ry - o) * Math.sin(t);
    } else {
      x = (part < 0.82 ? 28 : 272) + (part < 0.82 ? o : -o);
      y = FENCE.cy + rand() * (330 - FENCE.cy);
    }
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

/** Equirectangular dusk sky: blue overhead, peach at the horizon, soft lit clouds. */
export function makeSkyTexture(): THREE.CanvasTexture {
  const W = 1536;
  const H = 768;
  const [canvas, g] = makeCanvas(W, H);
  const rand = makeRng(5);
  // Clear summer afternoon like the LLWS broadcast look, not a dramatic sunset sky.
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#2e72bb');
  grad.addColorStop(0.28, '#5b9bd8');
  grad.addColorStop(0.42, '#91c4ed');
  grad.addColorStop(0.47, '#b9dcf5');
  grad.addColorStop(0.5, '#a8d2f0');
  grad.addColorStop(1, '#8dbfe5');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // Gentle daylight haze at the horizon; avoid the heavy orange sun-glow effect.
  blob(g, W * 0.5, H * 0.49, 300, '235,247,255', 0.16);

  // Soft white summer clouds with restrained cool shadows.
  for (let c = 0; c < 22; c++) {
    const cx = rand() * W;
    const cy = H * (0.28 + rand() * 0.17);
    const size = 28 + rand() * 62;
    const puffs = 6 + Math.floor(rand() * 7);
    for (let p = 0; p < puffs; p++) {
      const px = cx + (rand() - 0.5) * size * 4.4;
      const py = cy + (rand() - 0.5) * size * 0.45;
      const r = size * (0.5 + rand() * 0.8);
      blob(g, px, py + r * 0.18, r, '112,143,166', 0.07);
      blob(g, px, py - r * 0.12, r * 0.82, '255,255,250', 0.23);
    }
  }
  return toTexture(canvas);
}

/** Tree line and distant hills, drawn as a ring around the stadium. Wraps without a seam. */
export function makeHorizonTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = 160;
  const STEP = 8;
  const [canvas, g] = makeCanvas(W, H);
  const rand = makeRng(9);
  const columns = W / STEP;
  const layer = (base: number, amp: number, color: string, round: number, phase: number) => {
    const noise = Array.from({ length: columns }, () => rand() - 0.5);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    for (let i = 0; i <= columns; i++) {
      const x = i * STEP;
      const a = (x / W) * Math.PI * 2;
      const hills = Math.sin(a * 3 + phase) * amp + Math.sin(a * 8 + phase * 2) * amp * 0.5;
      g.lineTo(x, H - base - hills - noise[i % columns] * round);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  };
  // Low tree-covered ridgeline rather than towering purple mountains.
  layer(45, 7, 'rgba(123,139,103,0.92)', 3, 1);
  layer(30, 5, 'rgba(82,112,76,0.96)', 5, 2);
  layer(18, 3, 'rgba(49,81,54,1)', 8, 3);
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

/**
 * Compact LLWS-style berm and tree line sit just beyond the outfield fence. The replay should
 * feel like a youth ballpark, not a huge arena surrounded by distant mountains.
 */
export function buildOutfieldLandscape(): THREE.Group {
  const group = new THREE.Group();
  const rand = makeRng(117);

  // Follow the actual baseball outfield arc. The terrain is an unbroken berm BEHIND
  // the fence, not four isolated mounds and not a ring around the entire stadium.
  const fullPath = wallPath();
  const fenceStart = PATH_BACK + PATH_SIDE;
  const fencePath = fullPath.slice(fenceStart, fenceStart + PATH_ARC + 1);
  const berm = new THREE.Mesh(
    sweep(
      fencePath,
      [[3, -0.4], [9, 1], [20, 6], [36, 13], [54, 17], [76, 14], [98, 6], [118, -0.4]],
      55,
      8,
    ),
    new THREE.MeshStandardMaterial({
      color: '#648b4a',
      roughness: 1,
      side: THREE.DoubleSide,
      flatShading: false,
    }),
  );
  berm.receiveShadow = true;
  group.add(berm);

  // A close tree line tracks the outside of the curved berm. Trees are distributed
  // by distance along the arc, rather than scattered in a straight band.
  const trunkGeometry = new THREE.CylinderGeometry(0.8, 1.25, 7, 7);
  const crownGeometry = new THREE.IcosahedronGeometry(1, 1);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#6e5138', roughness: 1 });
  const crownMaterials = [
    new THREE.MeshStandardMaterial({ color: '#3f6f3d', roughness: 1, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#527f45', roughness: 1, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#66884a', roughness: 1, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#345e38', roughness: 1, flatShading: true }),
  ];

  for (let i = 2; i < fencePath.length - 2; i += 2) {
    // Leave small natural breaks, never large empty sections that expose the terrain edge.
    if (rand() < 0.13) continue;
    const p = fencePath[i];
    const distance = 112 + rand() * 28;
    const x = p.x + p.nx * distance;
    const z = p.z + p.nz * distance;
    const scale = 0.7 + rand() * 0.55;
    const tree = new THREE.Group();
    tree.position.set(x, -0.2, z);
    tree.scale.setScalar(scale);

    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 3.5;
    tree.add(trunk);
    const crownCount = 2 + Math.floor(rand() * 3);
    for (let j = 0; j < crownCount; j++) {
      const crown = new THREE.Mesh(
        crownGeometry,
        crownMaterials[Math.floor(rand() * crownMaterials.length)],
      );
      crown.position.set((rand() - 0.5) * 3.4, 6 + rand() * 4.2, (rand() - 0.5) * 3.4);
      crown.scale.set(2.8 + rand() * 2.4, 3 + rand() * 3.5, 2.8 + rand() * 2.4);
      crown.castShadow = true;
      tree.add(crown);
    }
    group.add(tree);
  }
  return group;
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

/* ---------- stadium ---------- */

interface PathPoint {
  x: number;
  z: number;
  nx: number;
  nz: number;
  length: number;
  taper: number;
}

const PATH_SIDE = 14;
const PATH_ARC = 84;
const PATH_BACK = 22;
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Wall line as one loop starting behind home plate: back arc, down the left foul side, around the
 * outfield fence, down the right side and back along the other half of the back arc.
 * The seating behind home is built lower so the plate stays in view from the usual camera.
 */
function wallPath(): PathPoint[] {
  const raw: { x: number; z: number; scale: number }[] = [];
  const backCentreZ = wz(300);
  const backRx = wx(272);
  const backRy = 100;
  const back = (i: number) => {
    const s = i / PATH_BACK; // 0 at the apex behind home, 1 where it meets the straight
    const a = (Math.PI / 2) * s;
    return { sx: Math.sin(a), z: backCentreZ + backRy * Math.cos(a), scale: 0.3 + 0.7 * smooth(Math.min(1, s / 0.85)) };
  };
  for (let i = 0; i < PATH_BACK; i++) {
    const p = back(i);
    raw.push({ x: -backRx * p.sx, z: p.z, scale: p.scale });
  }
  for (let i = 0; i < PATH_SIDE; i++) raw.push({ x: wx(28), z: wz(300) + ((wz(FENCE.cy) - wz(300)) * i) / PATH_SIDE, scale: 1 });
  for (let i = 0; i <= PATH_ARC; i++) {
    const t = Math.PI - (Math.PI * i) / PATH_ARC;
    raw.push({ x: wx(FENCE.cx + FENCE.rx * Math.cos(t)), z: wz(FENCE.cy - FENCE.ry * Math.sin(t)), scale: 1 });
  }
  for (let i = 1; i <= PATH_SIDE; i++) raw.push({ x: wx(272), z: wz(FENCE.cy) + ((wz(300) - wz(FENCE.cy)) * i) / PATH_SIDE, scale: 1 });
  for (let i = PATH_BACK; i >= 0; i--) {
    const p = back(i);
    raw.push({ x: backRx * p.sx, z: p.z, scale: p.scale });
  }

  const centre = { x: 0, z: wz(150) };
  let length = 0;
  return raw.map((p, i) => {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[Math.min(raw.length - 1, i + 1)];
    let tx = b.x - a.x;
    let tz = b.z - a.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    let nx = tz;
    let nz = -tx;
    if (nx * (p.x - centre.x) + nz * (p.z - centre.z) < 0) {
      nx = -nx;
      nz = -nz;
    }
    if (i) length += Math.hypot(p.x - raw[i - 1].x, p.z - raw[i - 1].z);
    return { x: p.x, z: p.z, nx, nz, length, taper: p.scale };
  });
}

/** A separate, open grandstand arc behind home plate. It is not a loop around the field. */
function grandstandPath(): PathPoint[] {
  const points: { x: number; z: number }[] = [];
  const count = 56;
  for (let i = 0; i <= count; i++) {
    const t = (Math.PI * i) / count;
    points.push({ x: -122 * Math.cos(t), z: 40 + 100 * Math.sin(t) });
  }
  let length = 0;
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    let tx = b.x - a.x;
    let tz = b.z - a.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    let nx = tz;
    let nz = -tx;
    // The seating's outward normal must point away from the playing field.
    if (nx * p.x + nz * (p.z + 40) < 0) {
      nx = -nx;
      nz = -nz;
    }
    if (i) length += Math.hypot(p.x - a.x, p.z - a.z);
    const edgeFade = smooth(Math.min(1, i / 8)) * smooth(Math.min(1, (count - i) / 8));
    return { ...p, nx, nz, length, taper: edgeFade };
  });
}

/** A ribbon swept along the wall path. `profile` is [outward distance, height] pairs. */
function sweep(path: PathPoint[], profile: [number, number][], uScale: number, vScale: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const profileLength: number[] = [0];
  for (let j = 1; j < profile.length; j++) {
    profileLength.push(profileLength[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
  }
  path.forEach((p) => {
    profile.forEach(([d, h], j) => {
      positions.push(p.x + p.nx * d * p.taper, h * p.taper, p.z + p.nz * d * p.taper);
      uvs.push(p.length / uScale, profileLength[j] / vScale);
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

/** Mostly neutrals with the odd splash of team colour, so the crowd reads as a crowd and not confetti. */
const CROWD_COLORS = ['#d9dbe0', '#c2c7d0', '#aab1bd', '#8d97a8', '#6c7a93', '#4d5d7a', '#34445f', '#e8e3d6', '#d6d0c2', '#a63a3d', '#c98a3a'];
const SKIN = ['#e8b894', '#d29a72', '#a9714e', '#7a4a32', '#f1cdb0'];

/** One staircase step of seating: the crowd seen from the field. Tiles once per step. */
function makeCrowdTexture(seed: number, seat: string, density: number, riseFraction: number): THREE.CanvasTexture {
  const W = 512;
  const H = 128;
  const [canvas, g] = makeCanvas(W, H);
  const rand = makeRng(seed);
  const split = H * (1 - riseFraction); // canvas y of the riser/tread seam (riser sits lower, v = 0 at the bottom)
  g.fillStyle = seat;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.fillRect(0, 0, W, split);
  const STEP = 16;
  for (let x = 0; x < W; x += STEP) {
    if (rand() > density) continue;
    const shirt = CROWD_COLORS[Math.floor(rand() * CROWD_COLORS.length)];
    const skin = SKIN[Math.floor(rand() * SKIN.length)];
    g.fillStyle = shirt;
    g.fillRect(x + 1.5, split - 14, STEP - 3, H - split + 22);
    g.fillStyle = `rgba(0,0,0,${(rand() * 0.22).toFixed(2)})`;
    g.fillRect(x + 1.5, split - 14, STEP - 3, H - split + 22);
    g.fillStyle = skin;
    g.beginPath();
    g.arc(x + STEP / 2, split - 22, 5.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(x + STEP / 2 + 1, split - 18, STEP / 2 - 3, 8);
  }
  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(0,0,0,0.22)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.08)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
  const texture = toTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** Padded outfield wall: dark green panels, sponsor-style blocks, lit seams. */
function makeWallTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 128;
  const [canvas, g] = makeCanvas(W, H);
  const rand = makeRng(21);
  const panels = ['#12351f', '#17402a', '#12351f', '#102e1c', '#1a4a2f'];
  const PANEL = 64;
  for (let x = 0; x < W; x += PANEL) {
    g.fillStyle = panels[Math.floor(rand() * panels.length)];
    g.fillRect(x, 0, PANEL, H);
    if (rand() > 0.55) {
      g.fillStyle = ['#c9373f', '#2f4f8f', '#f2f2f2', '#e0a82e'][Math.floor(rand() * 4)];
      g.globalAlpha = 0.85;
      g.fillRect(x + 8, 26, PANEL * (1 + Math.floor(rand() * 2)) - 16, 50);
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillRect(x + 14, 46, PANEL - 28, 6);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x, 0, 2, H);
  }
  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(255,255,255,0.14)');
  shade.addColorStop(0.18, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
  const texture = toTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export const WALL_HEIGHT = 8;

/**
 * The ballpark: padded wall, two tiers of seats with a crowd, a lit suite level, a roof edge
 * and light towers. Returns a group plus the sprite glow texture the caller owns nothing of.
 */
export function buildStadium(): THREE.Group {
  const group = new THREE.Group();
  const fullPath = wallPath();
  // The outfield fence is only the curved arc between the foul poles. Do not connect it
  // to the backstop with side walls: that creates the continuous oval stadium silhouette.
  const fenceStart = PATH_BACK + PATH_SIDE;
  const fencePath = fullPath.slice(fenceStart, fenceStart + PATH_ARC + 1);
  // Permanent seating is a separate open horseshoe behind home plate, not a bowl around
  // the outfield. The berm beyond the outfield fence is built by buildOutfieldLandscape().
  const standPath = grandstandPath();

  // Wall
  const wallTexture = makeWallTexture();
  const wall = new THREE.Mesh(
    sweep(fencePath, [[0, 0], [0, WALL_HEIGHT - 0.9]], 64, 8),
    new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.85, side: THREE.DoubleSide }),
  );
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);
  const cap = new THREE.Mesh(
    sweep(fencePath, [[-0.5, WALL_HEIGHT - 0.9], [-0.5, WALL_HEIGHT], [0.9, WALL_HEIGHT]], 10, 1),
    new THREE.MeshStandardMaterial({ color: 0xf5c93a, roughness: 0.5, emissive: 0x6b4d00, emissiveIntensity: 0.5, side: THREE.DoubleSide }),
  );
  cap.castShadow = true;
  group.add(cap);

  const stairs = (d0: number, h0: number, rows: number, tread: number, rise: number): [number, number][] => {
    const pts: [number, number][] = [[d0, h0]];
    for (let i = 0; i < rows; i++) {
      pts.push([d0 + i * tread, h0 + (i + 1) * rise], [d0 + (i + 1) * tread, h0 + (i + 1) * rise]);
    }
    return pts;
  };

  // Lower deck
  const LOWER = { rows: 6, tread: 2.25, rise: 1.25 };
  const lowerTexture = makeCrowdTexture(41, '#27415e', 0.9, LOWER.rise / (LOWER.rise + LOWER.tread));
  const walkway: [number, number][] = [[0.9, WALL_HEIGHT], [3, WALL_HEIGHT]];
  const lower = new THREE.Mesh(
    sweep(standPath, [...walkway, ...stairs(3, WALL_HEIGHT, LOWER.rows, LOWER.tread, LOWER.rise).slice(1)], 40, LOWER.rise + LOWER.tread),
    new THREE.MeshStandardMaterial({ map: lowerTexture, roughness: 0.95, side: THREE.DoubleSide }),
  );
  lower.castShadow = true;
  lower.receiveShadow = true;
  group.add(lower);

  const lowerTopD = 3 + LOWER.rows * LOWER.tread;
  const lowerTopH = WALL_HEIGHT + LOWER.rows * LOWER.rise;

  // One modest upper fascia/canopy edge instead of a second stadium deck.
  const roofD = lowerTopD + 2.5;
  const roofH = lowerTopH + 1.8;
  const fascia = new THREE.Mesh(
    sweep(standPath, [[roofD, roofH], [roofD, roofH + 1.6], [roofD + 2.5, roofH + 1.8]], 40, 5),
    new THREE.MeshStandardMaterial({ color: 0x34404a, roughness: 0.82, side: THREE.DoubleSide }),
  );
  fascia.castShadow = true;
  group.add(fascia);
  const strip = new THREE.Mesh(
    sweep(standPath, [[roofD - 0.05, roofH + 1.0], [roofD - 0.05, roofH + 1.35]], 40, 1),
    new THREE.MeshBasicMaterial({ color: 0xffe8bf, toneMapped: false, side: THREE.DoubleSide }),
  );
  group.add(strip);

  // No tall floodlight towers: the LLWS look is open, compact and centred on the diamond.
  return group;
}
