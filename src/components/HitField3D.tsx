import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { HitLocation, HitTrajectory } from '../types/baseball';
import { INFIELD_CENTER, INFIELD_DIRT_RADIUS } from '../utils/sprayChart';
import {
  BASES,
  BASE_SIZE,
  FENCE,
  FIELD_COLORS as C,
  FIELD_SIZE,
  FOUL_POLES,
  GRASS_DIAMOND,
  HOME,
  HOME_DIRT_RADIUS,
  MOUND,
  MOUND_RADIUS,
  STRIPE_COUNT,
  STRIPE_STEP,
  pctToField,
} from '../utils/fieldGeometry';

/**
 * View-only 3D replay of a hit. The field uses the same 300 x 300 space as the 2D chart:
 * world X = fieldX - 150, world Z = fieldY - 260 (home plate at the origin, outfield toward -Z).
 */

type ViewName = 'home' | 'top' | 'out';

interface HitField3DProps {
  location: HitLocation;
  isHit: boolean;
  /** Called once if WebGL is unavailable so the parent can fall back to the 2D field. */
  onUnsupported?: () => void;
}

interface SceneApi {
  setHit: (xPct: number, yPct: number, trajectory: HitTrajectory, isHit: boolean, replay: boolean) => void;
  setView: (view: ViewName) => void;
  replay: () => void;
  resize: () => void;
  start: () => void;
  dispose: () => void;
}

const wx = (fieldX: number) => fieldX - HOME.x;
const wz = (fieldY: number) => fieldY - HOME.y;
const BALL_RADIUS = 1.5;
const TUBE_SEGMENTS = 90;
const TUBE_RADIAL = 5;

/* ---------- ground texture (same art as the 2D field, painted once to a canvas) ---------- */
function makeFieldTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const K = 4;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = FIELD_SIZE * K;
  const g = canvas.getContext('2d')!;
  g.scale(K, K);

  const fair = () => {
    g.beginPath();
    g.moveTo(HOME.x, HOME.y);
    g.lineTo(28, 138);
    g.ellipse(FENCE.cx, FENCE.cy, FENCE.rx, FENCE.ry, 0, Math.PI, 2 * Math.PI);
    g.closePath();
  };
  const stripes = (clip: () => void) => {
    g.save();
    clip();
    g.clip();
    for (let k = STRIPE_COUNT - 1; k >= 0; k--) {
      g.fillStyle = k % 2 ? C.grassA : C.grassB;
      g.beginPath();
      g.arc(HOME.x, HOME.y, k * STRIPE_STEP, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  };

  g.fillStyle = C.surround;
  g.fillRect(0, 0, FIELD_SIZE, FIELD_SIZE);
  g.fillStyle = C.foul;
  g.beginPath();
  g.ellipse(FENCE.cx, FENCE.cy, FENCE.rx, FENCE.ry, 0, Math.PI, 2 * Math.PI);
  g.lineTo(272, 290);
  g.lineTo(28, 290);
  g.closePath();
  g.fill();
  stripes(fair);

  g.save();
  fair();
  g.clip();
  g.strokeStyle = C.dirt;
  g.lineWidth = 18;
  g.beginPath();
  g.ellipse(FENCE.cx, FENCE.cy, FENCE.rx, FENCE.ry, 0, Math.PI, 2 * Math.PI);
  g.stroke();
  g.restore();

  const dirt = g.createRadialGradient(HOME.x, 222, 0, HOME.x, 222, 70);
  dirt.addColorStop(0, C.dirtLight);
  dirt.addColorStop(1, C.dirtDark);
  g.fillStyle = dirt;
  g.beginPath();
  g.arc(INFIELD_CENTER.x, INFIELD_CENTER.y, INFIELD_DIRT_RADIUS, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = C.dirt;
  g.beginPath();
  g.arc(HOME.x, HOME.y, HOME_DIRT_RADIUS, 0, Math.PI * 2);
  g.fill();
  stripes(() => {
    g.beginPath();
    GRASS_DIAMOND.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  });
  g.fillStyle = dirt;
  g.beginPath();
  g.arc(MOUND.x, MOUND.y, MOUND_RADIUS, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = 'rgba(255,255,255,.92)';
  g.lineCap = 'round';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(HOME.x, HOME.y);
  g.lineTo(28.6, 138.6);
  g.moveTo(HOME.x, HOME.y);
  g.lineTo(271.4, 138.6);
  g.stroke();
  g.lineWidth = 0.7;
  g.strokeRect(136, 253, 7, 12);
  g.strokeRect(157, 253, 7, 12);

  // Fine grain so the grass and dirt do not look flat up close
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)';
    g.fillRect(Math.random() * FIELD_SIZE, Math.random() * FIELD_SIZE, 0.35, 0.35);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

function makeSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const g = canvas.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5b9bd6');
  grad.addColorStop(0.55, '#a9cfee');
  grad.addColorStop(1, '#e8f1f4');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A strip of wall following the outfield fence ellipse. */
function makeWall(height: number, y0: number, color: number): THREE.Mesh {
  const SEGMENTS = 80;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = (Math.PI * i) / SEGMENTS;
    const x = wx(FENCE.cx + FENCE.rx * Math.cos(t));
    const z = wz(FENCE.cy - FENCE.ry * Math.sin(t));
    positions.push(x, y0, z, x, y0 + height, z);
  }
  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Ball path from the bat to the landing spot, with a height profile per trajectory. */
function makePathPoints(tx: number, tz: number, trajectory: HitTrajectory): THREE.Vector3[] {
  const dist = Math.hypot(tx, tz);
  const start = new THREE.Vector3(0, 3, -2);
  const end = new THREE.Vector3(tx, BALL_RADIUS, tz);
  const peak =
    trajectory === 'flyBall'
      ? Math.min(85, Math.max(30, dist * 0.55))
      : trajectory === 'lineDrive'
        ? Math.min(22, Math.max(5, dist * 0.12))
        : trajectory === 'popUp'
          ? Math.min(95, 55 + dist * 0.4)
          : 0;
  const bounces = Math.max(3, Math.round(dist / 26));
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= TUBE_SEGMENTS; i++) {
    const t = i / TUBE_SEGMENTS;
    const along = trajectory === 'grounder' || trajectory === 'bunt' ? 1 - Math.pow(1 - t, 1.7) : t;
    const p = new THREE.Vector3().lerpVectors(start, end, along);
    if (peak) p.y = start.y + (end.y - start.y) * t + peak * 4 * t * (1 - t);
    else if (trajectory === 'grounder') p.y = BALL_RADIUS + Math.abs(Math.sin(t * Math.PI * bounces)) * Math.pow(1 - t, 1.2) * 5;
    else p.y = BALL_RADIUS + Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t) * 1.4;
    points.push(p);
  }
  return points;
}

function replaySeconds(trajectory: HitTrajectory, dist: number): number {
  switch (trajectory) {
    case 'flyBall':
      return 1.7 + dist / 230;
    case 'lineDrive':
      return 0.9 + dist / 320;
    case 'popUp':
      return 2.2;
    case 'grounder':
      return 1.1 + dist / 200;
    default:
      return 1.5;
  }
}

interface CameraState {
  yaw: number;
  pitch: number;
  dist: number;
  tz: number;
}

/** Camera presets, fitted to the canvas aspect so the whole field stays in frame in portrait. */
function viewPreset(view: ViewName, aspect: number): CameraState {
  const fit = Math.min(1, aspect);
  if (view === 'top') return { yaw: 0, pitch: 1.5, dist: Math.max(255, 255 / (0.93 * fit)), tz: -105 };
  if (view === 'out') return { yaw: Math.PI, pitch: 0.32, dist: Math.max(270, (280 / (0.93 * fit)) * 0.95), tz: -110 };
  return { yaw: 0, pitch: 0.5, dist: Math.max(230, (255 / (0.93 * fit)) * 0.95), tz: -95 };
}

function createScene(canvas: HTMLCanvasElement): SceneApi {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(0xcfe3ee, 320, 820);
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 2000);

  // Light intensities are physically based in current three.js (about pi x the old values).
  scene.add(new THREE.HemisphereLight(0xdcecff, 0x2c4a31, 2.6));
  const sun = new THREE.DirectionalLight(0xfff2d6, 3.2);
  sun.position.set(-110, 170, 90);
  sun.target.position.set(0, 0, -90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -190, right: 190, top: 190, bottom: -190, near: 10, far: 520 });
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  const fieldTexture = makeFieldTexture(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_SIZE, FIELD_SIZE), new THREE.MeshStandardMaterial({ map: fieldTexture, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, wz(FIELD_SIZE / 2));
  ground.receiveShadow = true;
  scene.add(ground);
  const farGround = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0x1b3325, roughness: 1 }));
  farGround.rotation.x = -Math.PI / 2;
  farGround.position.set(0, -0.2, -110);
  scene.add(farGround);

  scene.add(makeWall(6, 0, 0x153b27));
  scene.add(makeWall(1, 6, 0xf2c230));
  const stands = makeWall(24, 0, 0x0f2a1c);
  stands.scale.set(1.12, 1, 1.12);
  scene.add(stands);
  FOUL_POLES.forEach((pole) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 24, 10), new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 }));
    mesh.position.set(wx(pole.x), 12, wz(pole.y));
    mesh.castShadow = true;
    scene.add(mesh);
  });

  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  BASES.forEach((b) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(BASE_SIZE, 1, BASE_SIZE), white);
    mesh.position.set(wx(b.x), 0.5, wz(b.y));
    mesh.rotation.y = Math.PI / 4;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  });
  const plate = new THREE.Shape();
  [[-4, 4], [4, 4], [4, 0], [0, -4], [-4, 0]].forEach(([x, y], i) => (i ? plate.lineTo(x, y) : plate.moveTo(x, y)));
  const plateMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(plate, { depth: 0.5, bevelEnabled: false }), white);
  plateMesh.rotation.x = -Math.PI / 2;
  plateMesh.position.set(0, 0.05, 0);
  plateMesh.castShadow = true;
  scene.add(plateMesh);
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(MOUND_RADIUS - 1.5, MOUND_RADIUS + 3, 2.2, 40), new THREE.MeshStandardMaterial({ color: 0xc9996a, roughness: 1 }));
  mound.position.set(0, 1.1, wz(MOUND.y));
  mound.castShadow = true;
  mound.receiveShadow = true;
  scene.add(mound);
  const rubber = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 1.6), white);
  rubber.position.set(0, 2.35, wz(MOUND.y));
  scene.add(rubber);

  /* landing marker: ring, pulse ring, beam, ground glow */
  const marker = new THREE.Group();
  scene.add(marker);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: C.hit, transparent: true, opacity: 0.95 });
  const pulseMaterial = new THREE.MeshBasicMaterial({ color: C.hit, transparent: true });
  const beamMaterial = new THREE.MeshBasicMaterial({ color: C.hit, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: C.hit, transparent: true, opacity: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.65, 10, 48), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  const pulse = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.35, 8, 48), pulseMaterial);
  pulse.rotation.x = Math.PI / 2;
  pulse.position.y = 0.4;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 4.4, 46, 24, 1, true), beamMaterial);
  beam.position.y = 23;
  const glow = new THREE.Mesh(new THREE.CircleGeometry(4.8, 32), glowMaterial);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.25;
  marker.add(ring, pulse, beam, glow);

  const ball = new THREE.Group();
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
  ballMesh.castShadow = true;
  const seam = new THREE.Mesh(new THREE.TorusGeometry(BALL_RADIUS + 0.01, 0.08, 6, 28), new THREE.MeshBasicMaterial({ color: 0xd6313a }));
  const seam2 = seam.clone();
  seam2.rotation.y = Math.PI / 2;
  ball.add(ballMesh, seam, seam2);
  scene.add(ball);

  let trail: THREE.Mesh | null = null;
  let curve: THREE.CatmullRomCurve3 | null = null;
  let duration = 1.5;
  let playStart = 0;
  let playing = false;

  const applyProgress = (t: number) => {
    if (!curve || !trail) return;
    trail.geometry.setDrawRange(0, Math.floor(t * TUBE_SEGMENTS) * TUBE_RADIAL * 6);
    ball.position.copy(curve.getPointAt(Math.min(1, t)));
    ball.rotation.x = t * 30;
    ball.rotation.z = t * 18;
  };

  const setHit: SceneApi['setHit'] = (xPct, yPct, trajectory, isHit, replay) => {
    const tx = wx(pctToField(xPct));
    const tz = wz(pctToField(yPct));
    const color = isHit ? C.hit : C.out;
    marker.position.set(tx, 0, tz);
    [ringMaterial, pulseMaterial, beamMaterial, glowMaterial].forEach((m) => m.color.set(color));
    curve = new THREE.CatmullRomCurve3(makePathPoints(tx, tz, trajectory));
    if (trail) {
      scene.remove(trail);
      trail.geometry.dispose();
      (trail.material as THREE.Material).dispose();
    }
    trail = new THREE.Mesh(new THREE.TubeGeometry(curve, TUBE_SEGMENTS, 0.4, TUBE_RADIAL, false), new THREE.MeshBasicMaterial({ color: 0xfffbe0, transparent: true, opacity: 0.9 }));
    trail.frustumCulled = false;
    scene.add(trail);
    duration = replaySeconds(trajectory, Math.hypot(tx, tz));
    if (replay && !reduceMotion) {
      playing = true;
      playStart = performance.now();
      applyProgress(0);
    } else {
      playing = false;
      applyProgress(1);
    }
  };

  /* camera: presets glide, one finger orbits, two fingers pinch */
  const cam: CameraState = viewPreset('home', 1);
  let goal: CameraState | null = cam;
  const pointers = new Map<number, { x: number; y: number }>();
  let lastPinch = 0;
  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    goal = null;
  };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    if (pointers.size === 1) {
      cam.yaw -= (e.clientX - prev.x) * 0.006;
      cam.pitch = Math.max(0.12, Math.min(1.52, cam.pitch + (e.clientY - prev.y) * 0.005));
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinch) cam.dist = Math.max(70, Math.min(520, cam.dist * (lastPinch / d)));
      lastPinch = d;
    }
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    lastPinch = 0;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    goal = null;
    cam.dist = Math.max(70, Math.min(520, cam.dist * (1 + e.deltaY * 0.0012)));
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  let frameId = 0;
  let running = false;
  const frame = (now: number) => {
    if (!running) return;
    frameId = requestAnimationFrame(frame);
    if (goal) {
      const k = reduceMotion ? 1 : 0.09;
      cam.yaw += (goal.yaw - cam.yaw) * k;
      cam.pitch += (goal.pitch - cam.pitch) * k;
      cam.dist += (goal.dist - cam.dist) * k;
      cam.tz += (goal.tz - cam.tz) * k;
    }
    const cp = Math.cos(cam.pitch);
    camera.position.set(Math.sin(cam.yaw) * cp * cam.dist, Math.sin(cam.pitch) * cam.dist, cam.tz + Math.cos(cam.yaw) * cp * cam.dist);
    camera.lookAt(0, 0, cam.tz);

    const s = now / 1000;
    if (!reduceMotion) {
      ring.scale.setScalar(1 + Math.sin(s * 3) * 0.07);
      pulse.scale.setScalar(1.25 + ((s * 0.9) % 1) * 0.9);
      pulseMaterial.opacity = 1 - ((s * 0.9) % 1);
      beamMaterial.opacity = 0.22 + Math.sin(s * 2.4) * 0.05;
    }
    if (playing) {
      const t = Math.min(1, (performance.now() - playStart) / 1000 / duration);
      applyProgress(t);
      if (t >= 1) playing = false;
    }
    renderer.render(scene, camera);
  };

  return {
    setHit,
    setView: (view) => {
      goal = viewPreset(view, camera.aspect || 1);
    },
    replay: () => {
      if (!curve) return;
      playing = !reduceMotion;
      playStart = performance.now();
      applyProgress(playing ? 0 : 1);
    },
    resize,
    start: () => {
      resize();
      Object.assign(cam, viewPreset('home', camera.aspect || 1));
      goal = viewPreset('home', camera.aspect || 1);
      running = true;
      frameId = requestAnimationFrame(frame);
    },
    dispose: () => {
      running = false;
      cancelAnimationFrame(frameId);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((m) => {
          (m as THREE.MeshStandardMaterial).map?.dispose();
          m.dispose();
        });
      });
      (scene.background as THREE.Texture | null)?.dispose();
      renderer.dispose();
    },
  };
}

const VIEWS: { id: ViewName; label: string }[] = [
  { id: 'home', label: 'Behind home' },
  { id: 'top', label: 'Top-down' },
  { id: 'out', label: 'Outfield' },
];

const HitField3D: React.FC<HitField3DProps> = ({ location, isHit, onUnsupported }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const apiRef = useRef<SceneApi | null>(null);
  const unsupportedRef = useRef(onUnsupported);
  unsupportedRef.current = onUnsupported;
  const [view, setView] = useState<ViewName>('home');
  const trajectory = location.trajectory ?? 'lineDrive';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let api: SceneApi;
    try {
      api = createScene(canvas);
    } catch {
      unsupportedRef.current?.();
      return;
    }
    apiRef.current = api;
    const observer = new ResizeObserver(() => api.resize());
    observer.observe(canvas);
    api.start();
    return () => {
      observer.disconnect();
      api.dispose();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    apiRef.current?.setHit(location.x, location.y, trajectory, isHit, true);
  }, [location.x, location.y, trajectory, isHit]);

  const pickView = (next: ViewName) => {
    setView(next);
    apiRef.current?.setView(next);
  };

  return (
    <div className="w-full">
      <div className="relative w-full aspect-[1/0.95] bg-[#1b3325]">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          aria-label="3D baseball field. Drag to rotate, pinch to zoom."
        />
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-xs">
          Drag to rotate · pinch to zoom
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 p-2.5 dark:border-[#354050] dark:bg-[#252D38]/60">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Camera view">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={view === item.id}
              onClick={() => pickView(item.id)}
              className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                view === item.id
                  ? 'bg-[#00BFA5] text-[#18212D] dark:bg-[#00D7BC] dark:text-[#101419]'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#354050] dark:bg-[#252D38] dark:text-[#D1D5DB]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => apiRef.current?.replay()}
          className="cursor-pointer rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
        >
          Replay hit
        </button>
      </div>
    </div>
  );
};

export default HitField3D;