import React, { useId } from 'react';
import type { HitTrajectory } from '../types/baseball';
import { INFIELD_CENTER, INFIELD_DIRT_RADIUS } from '../utils/sprayChart';
import {
  BASES,
  BASE_SIZE,
  FENCE_PATH,
  FIELD_COLORS as C,
  FIELD_PATH,
  FOUL_POLES,
  GRASS_DIAMOND,
  HOME,
  HOME_DIRT_RADIUS,
  MOUND,
  MOUND_RADIUS,
  STRIPE_COUNT,
  STRIPE_STEP,
  TRACE_STYLES,
  getTracePath,
  pctToField,
} from '../utils/fieldGeometry';

/**
 * Shared keyframes for the trace + marker. Rendered inside the <svg> so no global CSS is needed.
 * Class names are prefixed so they cannot clash with Tailwind.
 */
const FIELD_ANIMATIONS = `
.hf-pulse{transform-box:fill-box;transform-origin:center;animation:hf-pulse 1.8s ease-out infinite}
.hf-pin{transform-box:fill-box;transform-origin:center;animation:hf-pop .45s cubic-bezier(.2,1.4,.4,1) both}
.hf-reveal{stroke-dasharray:1;stroke-dashoffset:1;animation:hf-draw .7s ease-out forwards}
@keyframes hf-pulse{0%{transform:scale(.8);opacity:.85}100%{transform:scale(2.6);opacity:0}}
@keyframes hf-pop{0%{transform:translateY(-14px) scale(.3);opacity:0}100%{transform:none;opacity:1}}
@keyframes hf-draw{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.hf-pulse{animation:none;opacity:.5}.hf-pin{animation:none}.hf-reveal{animation:none;stroke-dashoffset:0}}
`;

const useSvgId = () => useId().replace(/:/g, '');

const Stripes: React.FC<{ clip: string }> = ({ clip }) => (
  <g clipPath={`url(#${clip})`}>
    {Array.from({ length: STRIPE_COUNT }, (_, i) => STRIPE_COUNT - 1 - i).map((k) => (
      <circle key={k} cx={HOME.x} cy={HOME.y} r={k * STRIPE_STEP} fill={k % 2 ? C.grassA : C.grassB} />
    ))}
  </g>
);

/**
 * The field itself: mowed grass, infield dirt, warning track, wall, bases and lights.
 * Draw it first inside an <svg> that uses the 300 x 300 field space.
 * `dim` softens the grass so plotted dots stay readable on the stats screens.
 */
export const FieldArt: React.FC<{ dim?: boolean }> = ({ dim = false }) => {
  const uid = useSvgId();
  const id = (name: string) => `${uid}-${name}`;
  const diamond = GRASS_DIAMOND.map((p) => p.join(',')).join(' ');
  const half = BASE_SIZE / 2;

  return (
    <g>
      <style>{FIELD_ANIMATIONS}</style>
      <defs>
        <clipPath id={id('fair')}>
          <path d={FIELD_PATH} />
        </clipPath>
        <clipPath id={id('inner')}>
          <polygon points={diamond} />
        </clipPath>
        <radialGradient id={id('dirt')} cx={HOME.x} cy={222} r={70} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.dirtLight} />
          <stop offset="1" stopColor={C.dirtDark} />
        </radialGradient>
        <radialGradient id={id('light')} cx={150} cy={190} r={170} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </radialGradient>
        <filter id={id('shadow')} x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0.5" dy="0.9" stdDeviation="0.7" floodColor="#000" floodOpacity="0.45" />
        </filter>
        <filter id={id('soft')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <rect x="0" y="0" width="300" height="300" fill={C.surround} />
      {/* Foul territory */}
      <path d="M 28 138 A 122 112 0 0 1 272 138 L 272 290 L 28 290 Z" fill={C.foul} />
      {/* Fair territory with mow stripes */}
      <Stripes clip={id('fair')} />

      {/* Warning track and soft wall shadow, fair side only */}
      <g clipPath={`url(#${id('fair')})`}>
        <path d={FENCE_PATH} fill="none" stroke={C.dirt} strokeWidth="18" />
        <path d={FENCE_PATH} fill="none" stroke="#000" strokeOpacity="0.28" strokeWidth="3" filter={`url(#${id('soft')})`} />
      </g>
      {/* Wall: dark band behind, yellow cap */}
      <path d={FENCE_PATH} fill="none" stroke="#10281c" strokeWidth="5" transform="translate(0 -2.5)" />
      <path d={FENCE_PATH} fill="none" stroke={C.wallCap} strokeWidth="1.5" />

      {/* Infield dirt: circle around the mound plus the home plate area */}
      <circle cx={INFIELD_CENTER.x} cy={INFIELD_CENTER.y} r={INFIELD_DIRT_RADIUS} fill={`url(#${id('dirt')})`} />
      <circle cx={HOME.x} cy={HOME.y} r={HOME_DIRT_RADIUS} fill={C.dirt} />
      {/* Infield grass diamond */}
      <Stripes clip={id('inner')} />
      <circle cx={MOUND.x} cy={MOUND.y} r={MOUND_RADIUS} fill={`url(#${id('dirt')})`} />
      <rect x={MOUND.x - 3} y={MOUND.y - 1} width="6" height="2" fill="#fff" />

      {/* Foul lines and batter's boxes */}
      <g stroke="#fff" strokeLinecap="round" fill="none" strokeOpacity="0.92">
        <line x1={HOME.x} y1={HOME.y} x2="28.6" y2="138.6" strokeWidth="1.4" />
        <line x1={HOME.x} y1={HOME.y} x2="271.4" y2="138.6" strokeWidth="1.4" />
        <rect x="136" y="253" width="7" height="12" strokeWidth="0.7" />
        <rect x="157" y="253" width="7" height="12" strokeWidth="0.7" />
      </g>

      {/* Bases and home plate */}
      {BASES.map((b) => (
        <rect
          key={b.id}
          x={b.x - half}
          y={b.y - half}
          width={BASE_SIZE}
          height={BASE_SIZE}
          rx="0.8"
          fill="#fff"
          transform={`rotate(45 ${b.x} ${b.y})`}
          filter={`url(#${id('shadow')})`}
        />
      ))}
      <polygon points="146,256 154,256 154,260 150,264 146,260" fill="#fff" filter={`url(#${id('shadow')})`} />

      {/* Foul poles */}
      {FOUL_POLES.map((p) => (
        <circle key={p.x} cx={p.x} cy={p.y} r="2.6" fill={C.wallCap} filter={`url(#${id('shadow')})`} />
      ))}

      {/* Lighting + vignette, plus a little extra dimming on the stats screens */}
      <rect x="0" y="0" width="300" height="300" fill={`url(#${id('light')})`} pointerEvents="none" />
      {dim && <rect x="0" y="0" width="300" height="300" fill="#000" opacity="0.16" pointerEvents="none" />}
    </g>
  );
};

/** TV-style trace of the ball from home plate to where it landed. Re-key it to replay the draw-in. */
export const TrajectoryTrace: React.FC<{ x: number; y: number; trajectory: HitTrajectory }> = ({ x, y, trajectory }) => {
  const uid = useSvgId();
  const maskId = `${uid}-reveal`;
  const style = TRACE_STYLES[trajectory];
  const d = getTracePath(x, y, trajectory);
  const dash = style.dash;

  return (
    <g pointerEvents="none">
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="300">
        <path d={d} pathLength={1} fill="none" stroke="#fff" strokeWidth="9" className="hf-reveal" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path d={d} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth={style.width + 1.6} strokeLinecap="round" strokeDasharray={dash} transform="translate(0.5 1)" />
        <path d={d} fill="none" stroke="#fffbe0" strokeWidth={style.width} strokeLinecap="round" strokeDasharray={dash} />
      </g>
    </g>
  );
};

/** Baseball marker for the chosen landing spot. Gold for a base hit, red for an out. */
export const HitMarker: React.FC<{ x: number; y: number; isHit: boolean }> = ({ x, y, isHit }) => {
  const px = pctToField(x);
  const py = pctToField(y);
  const color = isHit ? C.hit : C.out;
  return (
    <g pointerEvents="none">
      <ellipse cx={px + 0.8} cy={py + 4.8} rx="4.4" ry="1.5" fill="#000" opacity="0.35" />
      <circle className="hf-pulse" cx={px} cy={py} r="5" fill="none" stroke={color} strokeWidth="1.6" />
      <g className="hf-pin">
        <circle cx={px} cy={py} r="5.3" fill={color} opacity="0.95" />
        <circle cx={px} cy={py} r="3.9" fill="#fff" />
        <path
          d={`M ${px - 2.5} ${py - 2.6} Q ${px - 0.6} ${py} ${px - 2.5} ${py + 2.6} M ${px + 2.5} ${py - 2.6} Q ${px + 0.6} ${py} ${px + 2.5} ${py + 2.6}`}
          fill="none"
          stroke="#d6313a"
          strokeWidth="0.7"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
};