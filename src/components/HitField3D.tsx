import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { HitLocation, HitTrajectory, PlayCode } from '../types/baseball';
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
  disposeMaterial,
  makeBeamTexture,
  makeFarGroundTexture,
  makeFieldTexture,
  makeHorizonTexture,
  makeRadialTexture,
  makeSkyTexture,
  wx,
  wz,
} from '../utils/HitField3DScenery';

/**
 * View-only 3D replay of a hit. The field uses the same 300 x 300 space as the 2D chart:
 * world X = fieldX - 150, world Z = fieldY - 260 (home plate at the origin, outfield toward -Z).
 * Scenery (textures, stadium, hill) lives in HitField3DScenery.ts.
 */

type ViewName = 'home' | 'top' | 'out';

/** What happened on the play, which decides the colour of the flight path. */
type Outcome = 'out' | 'foul' | 'homeRun' | 'other';

/**
 * Flight path colours. `core` is the bright line, `halo` tints the glow around it.
 * OUT red, FOUL grey, HOME RUN gold, everything else (singles, doubles, triples, errors) white.
 */
const OUTCOME_STYLE: Record<Outcome, { core: number; halo: number }> = {
  out: { core: 0xff2e2e, halo: 0xff3030 },
  foul: { core: 0x9aa1ad, halo: 0x838c9b },
  homeRun: { core: 0xffcf33, halo: 0xffb400 },
  other: { core: 0xffffff, halo: 0xfff4d6 },
};

const OUT_CODES: PlayCode[] = ['out', 'sacFly', 'sacBunt', 'fieldersChoice', 'groundedIntoDoublePlay', 'putout', 'doublePlay', 'triplePlay'];

/**
 * Works out the outcome. A play code wins when the caller passes one. Without it the outcome is read
 * from where the ball landed, so the colours are right even if a caller forgets `playCode`:
 * outside the foul lines = foul, past the fence while fair = home run, other hits = white, rest = out.
 */
function outcomeFor(code: PlayCode | undefined, isHit: boolean, location: HitLocation): Outcome {
  if (code) {
    if (code === 'pitchFoul') return 'foul';
    if (code === 'homeRun' || code === 'homeRunAllowed') return 'homeRun';
    if (OUT_CODES.includes(code)) return 'out';
    return 'other';
  }
  const x = pctToField(location.x);
  const y = pctToField(location.y);
  const fair = 260 - y >= Math.abs(x - 150);
  if (!fair) return 'foul';
  const beyondFence = ((x - 150) / 122) ** 2 + ((y - 138) / 112) ** 2 > 1;
  if (isHit && beyondFence) return 'homeRun';
  return isHit ? 'other' : 'out';
}

interface HitField3DProps {
  location: HitLocation;
  isHit: boolean;
  playCode?: PlayCode;
  /** Called once if WebGL is unavailable so the parent can fall back to the 2D field. */
  onUnsupported?: () => void;
}

interface SceneApi {
  setHit: (xPct: number, yPct: number, trajectory: HitTrajectory, isHit: boolean, outcome: Outcome, replay: boolean) => void;
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
function makePathPoints(tx: number, ty: number, tz: number, trajectory: HitTrajectory, homeRun: boolean): THREE.Vector3[] {
  const dist = Math.hypot(tx, tz);
  const start = new THREE.Vector3(0, 3, -2);
  const end = new THREE.Vector3(tx, ty, tz);
  let peak =
    trajectory === 'flyBall'
      ? Math.min(85, Math.max(30, dist * 0.55))
      : trajectory === 'lineDrive'
        ? Math.min(22, Math.max(5, dist * 0.12))
        : trajectory === 'popUp'
          ? Math.min(38, Math.max(20, 18 + dist * 0.16))
          : 0;
  // A home run has to clear the wall, whatever trajectory was picked
  if (homeRun) peak = Math.max(peak, 40);
  const bounces = Math.max(3, Math.round(dist / 26));
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= TUBE_SEGMENTS; i++) {
    const t = i / TUBE_SEGMENTS;
    const along = !homeRun && (trajectory === 'grounder' || trajectory === 'bunt') ? 1 - Math.pow(1 - t, 1.7) : t;
    const p = new THREE.Vector3().lerpVectors(start, end, along);
    if (peak) p.y = start.y + (end.y - start.y) * t + peak * 4 * t * (1 - t);
    else if (trajectory === 'grounder') p.y = ty + Math.abs(Math.sin(t * Math.PI * bounces)) * Math.pow(1 - t, 1.2) * 5;
    else p.y = ty + Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t) * 1.4;
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
  return { yaw: 0, pitch: 0.3, dist: Math.max(228, (252 / (0.93 * fit)) * 0.95), tz: -100 };
}


/**
 * Light-trail material. Brightest down the middle of the tube and fading to nothing at its edges
 * (using the view-facing normal), and dimmer the further behind the ball it is, so the path reads
 * as a glowing comet tail and not a flat translucent line.
 */
function makeTrailMaterial(opts: { color: THREE.Color; power: number; strength: number; tail: number; additive: boolean; hot: number; depthTest: boolean }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: opts.color },
      uHead: { value: 1 },
      uPower: { value: opts.power },
      uStrength: { value: opts.strength },
      uTail: { value: opts.tail },
      uHot: { value: opts.hot },
    },
    vertexShader: `
      varying vec3 vN;
      varying float vT;
      void main() {
        vT = uv.x;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uHead, uPower, uStrength, uTail, uHot;
      varying vec3 vN;
      varying float vT;
      void main() {
        float f = clamp(abs(normalize(vN).z), 0.0, 1.0);
        float edge = pow(f, uPower);
        float fade = mix(0.3, 1.0, exp(-max(uHead - vT, 0.0) * uTail));
        vec3 c = mix(uColor, vec3(1.0), uHot * pow(f, 5.0));
        float a = clamp(edge * fade * uStrength, 0.0, 1.0);
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: opts.depthTest,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

function createScene(canvas: HTMLCanvasElement): SceneApi {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Three passes per frame (scenery, wall-only depth, flight path), so clearing is manual
  renderer.autoClear = false;

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const scene = new THREE.Scene();
  // Same warm haze colour as the sky below the horizon, so the distant meadow melts into it
  scene.fog = new THREE.Fog(0xf4c79a, 380, 1000);
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 4000);

  /* sky and hills follow the camera, so they never show parallax */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 48, 24),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }),
  );
  sky.renderOrder = -2;
  sky.rotation.y = Math.PI;
  scene.add(sky);
  const horizonTexture = makeHorizonTexture();
  horizonTexture.repeat.set(2, 1);
  const horizon = new THREE.Mesh(
    new THREE.CylinderGeometry(600, 600, 200, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: horizonTexture, side: THREE.BackSide, transparent: true, fog: false, depthWrite: false, toneMapped: false }),
  );
  horizon.position.y = 60;
  horizon.renderOrder = -1;
  scene.add(horizon);

  /* warm, bright light: sky mood comes from the sky texture, the field stays vivid */
  scene.add(new THREE.HemisphereLight(0xdcebff, 0x5a6a3e, 1.6));
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
  // Meadow beyond the painted field, large enough to stay under the camera at any zoom or orbit
  const farGroundTexture = makeFarGroundTexture();
  farGroundTexture.repeat.set(8, 8);
  const farGround = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshStandardMaterial({ map: farGroundTexture, color: 0xffffff, roughness: 1 }),
  );
  farGround.rotation.x = -Math.PI / 2;
  farGround.position.set(0, -0.3, -95);
  farGround.receiveShadow = true;
  scene.add(farGround);

  const stadium = buildStadium();
  scene.add(stadium.group);
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

  /* landing marker: crisp ring, ripple, soft ground glow (these lie on the surface) and a fading beam */
  const marker = new THREE.Group();
  const flat = new THREE.Group();
  marker.add(flat);
  scene.add(marker);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: C.hit, transparent: true, opacity: 0.98, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const pulseMaterial = new THREE.MeshBasicMaterial({ color: C.hit, transparent: true, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
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
  const glowMaterial = new THREE.MeshBasicMaterial({ color: C.hit, map: glowTexture, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const markerMaterials = [ringMaterial, pulseMaterial, beamMaterial, glowMaterial];
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
  flat.add(glow, ring, pulse);
  marker.add(beam);
  [glow, ring, pulse, beam].forEach((m) => (m.renderOrder = 500));

  /* ball, its soft ground shadow and a glow */
  // The ball and the flight path live in their own scene, drawn last, so scenery can never cover
  // them. Only a home run is checked against the wall (see the render loop).
  const trailScene = new THREE.Scene();
  trailScene.add(new THREE.HemisphereLight(0xdcebff, 0x5a6a3e, 1.6));
  const trailSun = new THREE.DirectionalLight(0xffe0b4, 3.4);
  trailSun.position.set(-130, 190, 110);
  trailScene.add(trailSun);
  const occluderScene = new THREE.Scene();
  occluderScene.add(stadium.occluder);

  const ball = new THREE.Group();
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 28, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }));
  const seamMaterial = new THREE.MeshBasicMaterial({ color: 0xd6313a });
  const seam = new THREE.Mesh(new THREE.TorusGeometry(BALL_RADIUS + 0.01, 0.09, 6, 32), seamMaterial);
  const seam2 = seam.clone();
  seam2.rotation.y = Math.PI / 2;
  const ballGlowMaterial = new THREE.SpriteMaterial({ map: glowTexture, color: 0xfff1c0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.7 });
  const ballGlow = new THREE.Sprite(ballGlowMaterial);
  ballGlow.scale.set(13, 13, 1);
  ball.add(ballMesh, seam, seam2, ballGlow);
  trailScene.add(ball);
  const ballShadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, map: glowTexture, transparent: true, depthWrite: false, opacity: 0.5 });
  const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24), ballShadowMaterial);
  ballShadow.rotation.x = -Math.PI / 2;
  ballShadow.position.y = 0.2;
  scene.add(ballShadow);

  /* trail: a thin bright core wrapped in two soft additive halos, plus a faint line on the ground */
  interface Trail {
    mesh: THREE.Mesh;
    radial: number;
    owner: THREE.Scene;
  }
  let trails: Trail[] = [];
  let curve: THREE.CatmullRomCurve3 | null = null;
  let duration = 1.5;
  let playStart = 0;
  let playing = false;
  let behindWall = false;
  let showGroundShadow = true;
  let glowMaterials: THREE.ShaderMaterial[] = [];

  const clearTrails = () => {
    trails.forEach(({ mesh, owner }) => {
      owner.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    trails = [];
  };
  const addTrail = (owner: THREE.Scene, points: THREE.Vector3[], radius: number, radial: number, material: THREE.Material, order: number) => {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), TUBE_SEGMENTS, radius, radial, false), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    owner.add(mesh);
    trails.push({ mesh, radial, owner });
  };

  const applyProgress = (t: number) => {
    if (!curve) return;
    trails.forEach(({ mesh, radial }) => mesh.geometry.setDrawRange(0, Math.floor(t * TUBE_SEGMENTS) * radial * 6));
    glowMaterials.forEach((m) => (m.uniforms.uHead.value = t));
    ball.position.copy(curve.getPointAt(Math.min(1, t)));
    ball.rotation.x = t * 30;
    ball.rotation.z = t * 18;
    ballShadow.visible = showGroundShadow;
    const h = Math.max(0, ball.position.y - BALL_RADIUS);
    ballShadow.position.set(ball.position.x + h * SHADOW_SKEW.x, 0.2, ball.position.z + h * SHADOW_SKEW.z);
    ballShadow.scale.setScalar(1 + h * 0.018);
    ballShadowMaterial.opacity = Math.max(0.12, 0.62 - h * 0.012);
  };

  const setHit: SceneApi['setHit'] = (xPct, yPct, trajectory, isHit, outcome, replay) => {
    const tx = wx(pctToField(xPct));
    const tz = wz(pctToField(yPct));
    const homeRun = outcome === 'homeRun';
    const style = OUTCOME_STYLE[outcome];
    const markerColor = isHit ? C.hit : C.out;

    // Landings past the fence come down on the hill, so sit the ball and marker on its surface
    const surface = stadium.surfaceAt(tx, tz);
    marker.position.set(tx, surface.y, tz);
    flat.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surface.normal);
    markerMaterials.forEach((m) => {
      m.color.set(markerColor);
      // Home runs are checked against depth so the marker sits on the hill; everything else shows on top
      m.depthTest = homeRun;
      m.needsUpdate = true;
    });

    const points = makePathPoints(tx, surface.y + BALL_RADIUS, tz, trajectory, homeRun);
    curve = new THREE.CatmullRomCurve3(points);
    clearTrails();
    behindWall = homeRun;
    showGroundShadow = !homeRun;

    const haloColor = new THREE.Color().setHex(style.halo, THREE.SRGBColorSpace);
    const coreColor = new THREE.Color().setHex(style.core, THREE.SRGBColorSpace);
    // Everything except a home run ignores depth, so the path always draws in front of the hills,
    // stands and wall. A home run keeps depth testing against the wall alone (render loop).
    const depthTest = homeRun;
    glowMaterials = [
      makeTrailMaterial({ color: haloColor, power: 2.0, strength: 0.6, tail: 2.2, additive: false, hot: 0, depthTest }),
      makeTrailMaterial({ color: haloColor, power: 1.3, strength: 0.85, tail: 1.8, additive: false, hot: 0, depthTest }),
      makeTrailMaterial({ color: coreColor, power: 0.5, strength: 1.0, tail: 1.2, additive: false, hot: 0.3, depthTest }),
    ];
    // Thin dark under-line so a white path never vanishes against clouds or bright grass
    addTrail(trailScene, points, 1.25, 8, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false, depthTest }), 999);
    addTrail(trailScene, points, 3.8, 12, glowMaterials[0], 1000);
    addTrail(trailScene, points, 1.8, 12, glowMaterials[1], 1001);
    addTrail(trailScene, points, 0.7, 10, glowMaterials[2], 1002);
    ballGlowMaterial.color.copy(haloColor);
    ballGlowMaterial.depthTest = depthTest;
    ballGlowMaterial.needsUpdate = true;
    if (!homeRun) {
      addTrail(
        scene,
        points.map((p) => new THREE.Vector3(p.x + p.y * SHADOW_SKEW.x, 0.18, p.z + p.y * SHADOW_SKEW.z)),
        0.35,
        4,
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
        10,
      );
    }
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

    // Pass 1: the whole ballpark
    renderer.clear();
    renderer.render(scene, camera);
    // Pass 2 (home runs only): rebuild the depth buffer from the outfield wall alone, so the wall
    // is the one thing that can hide the ball. Hills, trees and stands never do.
    renderer.clearDepth();
    if (behindWall) renderer.render(occluderScene, camera);
    // Pass 3: flight path and ball on top
    renderer.render(trailScene, camera);
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
      [scene, trailScene, occluderScene].forEach((root) =>
        root.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh && !(obj as THREE.Sprite).isSprite) return;
          mesh.geometry?.dispose();
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach(disposeMaterial);
        }),
      );
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

const HitField3D: React.FC<HitField3DProps> = ({ location, isHit, playCode, onUnsupported }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const apiRef = useRef<SceneApi | null>(null);
  const unsupportedRef = useRef(onUnsupported);
  unsupportedRef.current = onUnsupported;
  const [view, setView] = useState<ViewName>('home');
  const trajectory = location.trajectory ?? 'lineDrive';
  const outcome = outcomeFor(playCode, isHit, location);

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
    apiRef.current?.setHit(location.x, location.y, trajectory, isHit, outcome, true);
  }, [location.x, location.y, trajectory, isHit, outcome]);

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
