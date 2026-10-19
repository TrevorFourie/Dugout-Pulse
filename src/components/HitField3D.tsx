import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { HitLocation, HitTrajectory } from '../types/baseball';
import {
  BASES,
  BASE_SIZE,
  FIELD_COLORS as C,
  FOUL_POLES,
  MOUND,
  MOUND_RADIUS,
  pctToField,
} from '../utils/fieldGeometry';
import {
  FIELD_TEXTURE,
  buildStadium,
  buildOutfieldLandscape,
  disposeMaterial,
  makeBeamTexture,
  makeFieldTexture,
  makeFarGroundTexture,
  makeHorizonTexture,
  makeRadialTexture,
  makeSkyTexture,
  wx,
  wz,
} from '../utils/HitField3DScenery';

/**
 * View-only 3D replay of a hit. The field uses the same 300 x 300 space as the 2D chart:
 * world X = fieldX - 150, world Z = fieldY - 260 (home plate at the origin, outfield toward -Z).
 * Scenery (textures, stadium) lives in HitField3DScenery.ts.
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

const BALL_RADIUS = 1.5;
const TUBE_SEGMENTS = 90;
/** Direction the sun pushes shadows on the ground (per unit of height). */
const SHADOW_SKEW = { x: 0.55, z: -0.6 };

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
          ? Math.min(38, Math.max(20, 18 + dist * 0.16))
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
  if (view === 'top') return { yaw: 0, pitch: 1.5, dist: Math.max(255, 255 / (0.93 * fit)), tz: -100 };
  // Behind centre field and above the roof line, looking in at the plate
  if (view === 'out') return { yaw: Math.PI, pitch: 0.5, dist: Math.max(300, 300 / (0.93 * fit)), tz: -35 };
  return { yaw: 0, pitch: 0.34, dist: Math.max(220, (242 / (0.93 * fit)) * 0.95), tz: -95 };
}

function createScene(canvas: HTMLCanvasElement): SceneApi {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8dbfe0, 420, 1100);
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 4000);

  /* sky and horizon follow the camera, so they never show parallax */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 40, 20),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  sky.renderOrder = -2;
  sky.rotation.y = Math.PI;
  scene.add(sky);
  const horizonTexture = makeHorizonTexture();
  horizonTexture.repeat.set(2, 1);
  const horizon = new THREE.Mesh(
    new THREE.CylinderGeometry(850, 850, 130, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: horizonTexture, side: THREE.BackSide, transparent: true, fog: false, depthWrite: false }),
  );
  horizon.position.y = 38;
  horizon.renderOrder = -1;
  scene.add(horizon);

  /* golden-hour light: warm low sun, cool sky fill */
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x4a5a3a, 1.55));
  const sun = new THREE.DirectionalLight(0xffe0b4, 3.4);
  sun.position.set(-130, 190, 110);
  sun.target.position.set(0, 0, -100);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, near: 10, far: 700 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);

  /* ground */
  const fieldTexture = makeFieldTexture(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_TEXTURE.span, FIELD_TEXTURE.span),
    new THREE.MeshStandardMaterial({ map: fieldTexture, roughness: 0.96 }),
  );
  ground.rotation.x = -Math.PI / 2;
  const groundCentre = FIELD_TEXTURE.origin + FIELD_TEXTURE.span / 2;
  ground.position.set(wx(groundCentre), 0, wz(groundCentre));
  ground.receiveShadow = true;
  scene.add(ground);
  // The meadow beyond the painted field has its own terrain texture and mid-distance landmarks.
  // This avoids the old hard visual jump from detailed turf to a single flat green plane.
  const farGroundTexture = makeFarGroundTexture();
  // Keep the distant terrain under the camera even at maximum zoom and during a full orbit.
  // The old 850-unit square could expose its edge when the camera moved around the field.
  farGroundTexture.repeat.set(8, 8);
  const farGround = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshStandardMaterial({ map: farGroundTexture, color: 0xffffff, roughness: 1 }),
  );
  farGround.rotation.x = -Math.PI / 2;
  farGround.position.set(0, -0.3, -95);
  farGround.receiveShadow = true;
  scene.add(farGround);
  scene.add(buildOutfieldLandscape());

  scene.add(buildStadium());
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0xf5c93a, roughness: 0.45, emissive: 0x6b4d00, emissiveIntensity: 0.4 });
  FOUL_POLES.forEach((pole) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 30, 10), poleMaterial);
    mesh.position.set(wx(pole.x), 15, wz(pole.y));
    mesh.castShadow = true;
    scene.add(mesh);
    const mesh2 = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), poleMaterial);
    mesh2.position.set(wx(pole.x), 30, wz(pole.y));
    scene.add(mesh2);
  });

  /* chalk foul lines: real geometry so they stay bright white */
  const chalk = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  FOUL_POLES.forEach((pole) => {
    const dx = wx(pole.x);
    const dz = wz(pole.y);
    const length = Math.hypot(dx, dz);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1.5, length), chalk);
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = Math.atan2(-dx, -dz) + Math.PI;
    line.position.set(dx / 2, 0.06, dz / 2);
    scene.add(line);
  });

  /* bases, plate, mound */
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  BASES.forEach((b) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(BASE_SIZE, 1.3, BASE_SIZE), white);
    mesh.position.set(wx(b.x), 0.55, wz(b.y));
    mesh.rotation.y = Math.PI / 4;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  });
  const plate = new THREE.Shape();
  [[-4, 4], [4, 4], [4, 0], [0, -4], [-4, 0]].forEach(([x, y], i) => (i ? plate.lineTo(x, y) : plate.moveTo(x, y)));
  const plateMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(plate, { depth: 0.6, bevelEnabled: false }), white);
  plateMesh.rotation.x = -Math.PI / 2;
  plateMesh.position.set(0, 0.05, 0);
  plateMesh.castShadow = true;
  scene.add(plateMesh);
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(MOUND_RADIUS - 2, MOUND_RADIUS + 2.5, 2.2, 48), new THREE.MeshStandardMaterial({ color: 0xcf9f6d, roughness: 1 }));
  mound.position.set(0, 1.1, wz(MOUND.y));
  mound.castShadow = true;
  mound.receiveShadow = true;
  scene.add(mound);
  const rubber = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 1.6), white);
  rubber.position.set(0, 2.35, wz(MOUND.y));
  scene.add(rubber);

  const glowTexture = makeRadialTexture();

  /* landing marker: crisp ring, ripple, soft ground glow and a fading beam */
  const marker = new THREE.Group();
  scene.add(marker);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: C.hit, transparent: true, opacity: 0.98, toneMapped: false });
  const pulseMaterial = new THREE.MeshBasicMaterial({ color: C.hit, transparent: true, toneMapped: false, depthWrite: false });
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: C.hit,
    transparent: true,
    opacity: 0.5,
    alphaMap: makeBeamTexture(),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: C.hit, map: glowTexture, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(5, 6.2, 64), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.35;
  const pulse = new THREE.Mesh(new THREE.RingGeometry(5.2, 5.8, 64), pulseMaterial);
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.y = 0.34;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 4.6, 52, 32, 1, true), beamMaterial);
  beam.position.y = 26;
  const glow = new THREE.Mesh(new THREE.CircleGeometry(18, 48), glowMaterial);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.25;
  marker.add(glow, ring, pulse, beam);

  /* ball, its soft ground shadow and a little glow */
  const ball = new THREE.Group();
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 28, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }));
  ballMesh.castShadow = true;
  const seamMaterial = new THREE.MeshBasicMaterial({ color: 0xd6313a });
  const seam = new THREE.Mesh(new THREE.TorusGeometry(BALL_RADIUS + 0.01, 0.09, 6, 32), seamMaterial);
  const seam2 = seam.clone();
  seam2.rotation.y = Math.PI / 2;
  const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xfff1c0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
  ballGlow.scale.set(11, 11, 1);
  ball.add(ballMesh, seam, seam2, ballGlow);
  scene.add(ball);
  const ballShadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, map: glowTexture, transparent: true, depthWrite: false, opacity: 0.5 });
  const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24), ballShadowMaterial);
  ballShadow.rotation.x = -Math.PI / 2;
  ballShadow.position.y = 0.2;
  scene.add(ballShadow);

  /* trail: bright core, soft halo, and a faint line on the grass under the flight */
  interface Trail {
    mesh: THREE.Mesh;
    radial: number;
  }
  let trails: Trail[] = [];
  let curve: THREE.CatmullRomCurve3 | null = null;
  let duration = 1.5;
  let playStart = 0;
  let playing = false;

  const clearTrails = () => {
    trails.forEach(({ mesh }) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    trails = [];
  };
  const addTrail = (points: THREE.Vector3[], radius: number, radial: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), TUBE_SEGMENTS, radius, radial, false), material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    trails.push({ mesh, radial });
  };

  const applyProgress = (t: number) => {
    if (!curve) return;
    trails.forEach(({ mesh, radial }) => mesh.geometry.setDrawRange(0, Math.floor(t * TUBE_SEGMENTS) * radial * 6));
    ball.position.copy(curve.getPointAt(Math.min(1, t)));
    ball.rotation.x = t * 30;
    ball.rotation.z = t * 18;
    const h = Math.max(0, ball.position.y - BALL_RADIUS);
    ballShadow.position.set(ball.position.x + h * SHADOW_SKEW.x, 0.2, ball.position.z + h * SHADOW_SKEW.z);
    ballShadow.scale.setScalar(1 + h * 0.018);
    ballShadowMaterial.opacity = Math.max(0.12, 0.62 - h * 0.012);
  };

  const setHit: SceneApi['setHit'] = (xPct, yPct, trajectory, isHit, replay) => {
    const tx = wx(pctToField(xPct));
    const tz = wz(pctToField(yPct));
    const color = isHit ? C.hit : C.out;
    marker.position.set(tx, 0, tz);
    [ringMaterial, pulseMaterial, beamMaterial, glowMaterial].forEach((m) => m.color.set(color));
    const points = makePathPoints(tx, tz, trajectory);
    curve = new THREE.CatmullRomCurve3(points);
    clearTrails();
    addTrail(points, 1.25, 6, new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    addTrail(points, 0.42, 6, new THREE.MeshBasicMaterial({ color: 0xfffbe6, transparent: true, opacity: 0.95, toneMapped: false }));
    addTrail(
      points.map((p) => new THREE.Vector3(p.x + p.y * SHADOW_SKEW.x, 0.18, p.z + p.y * SHADOW_SKEW.z)),
      0.35,
      4,
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
    );
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
      const k = reduceMotion ? 1 : 0.07;
      cam.yaw += (goal.yaw - cam.yaw) * k;
      cam.pitch += (goal.pitch - cam.pitch) * k;
      cam.dist += (goal.dist - cam.dist) * k;
      cam.tz += (goal.tz - cam.tz) * k;
    }
    const cp = Math.cos(cam.pitch);
    camera.position.set(Math.sin(cam.yaw) * cp * cam.dist, Math.sin(cam.pitch) * cam.dist, cam.tz + Math.cos(cam.yaw) * cp * cam.dist);
    camera.lookAt(0, 0, cam.tz);
    sky.position.copy(camera.position);
    horizon.position.x = camera.position.x;
    horizon.position.z = camera.position.z;

    const s = now / 1000;
    if (!reduceMotion) {
      const phase = (s * 0.9) % 1;
      ring.scale.setScalar(1 + Math.sin(s * 3) * 0.05);
      pulse.scale.setScalar(1 + phase * 1.1);
      pulseMaterial.opacity = (1 - phase) * 0.8;
      beamMaterial.opacity = 0.45 + Math.sin(s * 2.4) * 0.08;
      glowMaterial.opacity = 0.75 + Math.sin(s * 2.4) * 0.1;
    }
    if (playing) {
      const t = Math.min(1, (performance.now() - playStart) / 1000 / duration);
      applyProgress(t);
      if (t >= 1) playing = false;
    }
    renderer.render(scene, camera);
  };

  const homeView = () => viewPreset('home', camera.aspect || 1);

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
      const target = homeView();
      goal = target;
      // Open slightly high and wide, then settle into the broadcast angle
      Object.assign(cam, reduceMotion ? target : { yaw: -0.22, pitch: target.pitch + 0.2, dist: target.dist * 1.22, tz: target.tz });
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
        if (!mesh.isMesh && !(obj as THREE.Sprite).isSprite) return;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach(disposeMaterial);
      });
      glowTexture.dispose();
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
      <div className="relative w-full aspect-[1/0.95] bg-[#2b3550]">
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