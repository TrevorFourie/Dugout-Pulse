import React, { useState } from 'react';
import { PlayCode, HitLocation, HitTrajectory } from '../types/baseball';
import {
  getDefaultTrajectoryForPlay,
  getZoneLabel,
  isHitPlay,
  resolveZone,
} from '../utils/sprayChart';
import { getPlayLabel, getPlayShortLabel } from '../utils/playDefinitions';
import { SprayChart } from './SprayChart';
import { Check, X, Crosshair, Star } from 'lucide-react';
import { BaseballBallIcon } from './BaseballIcons';

interface HitLocationModalProps {
  isOpen: boolean;
  playCode: PlayCode;
  initialLocation?: HitLocation | null;
  allowPlayChange?: boolean;
  onSave: (location: HitLocation, selectedPlayCode: PlayCode, rbiCount: number) => void;
  onSkip: () => void;
  onClose: () => void;
}

const POPULAR_BATTING_CODES: { code: PlayCode; label: string; badge: string; isHit: boolean }[] = [
  { code: 'single', label: 'Single', badge: '1B', isHit: true },
  { code: 'double', label: 'Double', badge: '2B', isHit: true },
  { code: 'triple', label: 'Triple', badge: '3B', isHit: true },
  { code: 'homeRun', label: 'Home Run', badge: 'HR', isHit: true },
  { code: 'walk', label: 'Walk', badge: 'BB', isHit: false },
  { code: 'hbp', label: 'Hit by Pitch', badge: 'HBP', isHit: false },
  { code: 'out', label: 'Out', badge: 'OUT', isHit: false },
  { code: 'reachedOnError', label: 'Reached on Error', badge: 'ROE', isHit: false },
  { code: 'sacFly', label: 'Sac Fly', badge: 'SF', isHit: false },
  { code: 'sacBunt', label: 'Sac Bunt', badge: 'SH', isHit: false },
  { code: 'fieldersChoice', label: "Fielder's Choice", badge: 'FC', isHit: false },
  { code: 'groundedIntoDoublePlay', label: 'Double Play', badge: 'DP', isHit: false },
];

const HitLocationModalDialog: React.FC<HitLocationModalProps> = ({
  playCode: initialPlayCode,
  initialLocation,
  allowPlayChange = true,
  onSave,
  onSkip,
}) => {
  const [currentCode, setCurrentCode] = useState<PlayCode>(initialPlayCode);
  const [rbiCount, setRbiCount] = useState<number>(() => {
    if (initialLocation?.rbiCount !== undefined) return initialLocation.rbiCount;
    if (initialPlayCode === 'homeRun') return 1;
    if (initialLocation?.rbi) return 1;
    return 0;
  });

  // Initial location fallback based on play code
  const defaultInitialLoc = (): HitLocation => {
    if (initialLocation) return initialLocation;
    const defaultTraj = getDefaultTrajectoryForPlay(initialPlayCode);
    if (initialPlayCode === 'homeRun') {
      return { x: 50, y: 15, zone: 'CF', trajectory: defaultTraj };
    }
    if (isHitPlay(initialPlayCode)) {
      return { x: 50, y: 35, zone: 'CF', trajectory: defaultTraj };
    }
    return { x: 42, y: 62, zone: 'SS', trajectory: 'grounder' };
  };

  const [location, setLocation] = useState<HitLocation>(defaultInitialLoc);

  const trajectories: { id: HitTrajectory; label: string }[] = [
    { id: 'lineDrive', label: 'Line Drive' },
    { id: 'flyBall', label: 'Fly Ball' },
    { id: 'grounder', label: 'Ground Ball' },
    { id: 'popUp', label: 'Pop Up' },
    { id: 'bunt', label: 'Bunt' },
  ];

  const handleFieldSelect = (newLoc: HitLocation) => {
    setLocation(newLoc);
  };

  const handleCodeChange = (newCode: PlayCode) => {
    setCurrentCode(newCode);
    if (newCode === 'homeRun' && rbiCount < 1) {
      setRbiCount(1);
    }
    const suggestedTraj = getDefaultTrajectoryForPlay(newCode);
    setLocation((prev) => ({
      ...prev,
      trajectory: suggestedTraj,
      ...(newCode === 'homeRun' && prev.y > 25 ? { y: 15 } : {}),
    }));
  };

  const handleSave = () => {
    const locWithRbi: HitLocation = {
      ...location,
      rbi: rbiCount > 0,
      rbiCount,
    };
    onSave(locWithRbi, currentCode, rbiCount);
  };

  const isHomeRun = currentCode === 'homeRun';

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md max-h-[95vh] flex flex-col bg-white dark:bg-[#1A2028] rounded-3xl shadow-2xl border border-slate-200 dark:border-[#354050] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hit-tapper-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#354050] flex items-center justify-between bg-slate-50 dark:bg-[#252D38]/60">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00BFA5] dark:bg-[#00D7BC] animate-pulse" />
            <div>
              <h3 id="hit-tapper-title" className="font-semibold text-sm text-slate-900 dark:text-[#FAFAFA] ">
                Where did the ball go?
              </h3>
              <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 flex-wrap">
                <span>Outcome:</span>
                <span className="font-semibold text-slate-800 dark:text-[#D1D5DB] ">
                  {getPlayLabel(currentCode, 'batting')}
                </span>
                <span className="font-mono text-xs px-1 rounded bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]">
                  {getPlayShortLabel(currentCode)}
                </span>
                <span className={`text-xs font-semibold px-1.5 py-0.2 rounded ${isHitPlay(currentCode) ? 'bg-slate-100 dark:bg-[#252D38] text-[#18212D] dark:text-[#D1D5DB]' : 'bg-slate-200 dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB]'}`}>
                  {isHitPlay(currentCode) ? <span className="inline-flex items-center gap-1"><BaseballBallIcon size={12} /> BASE HIT</span> : '✕ OUT'}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-[#D1D5DB] cursor-pointer"
            aria-label="Skip hit location"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Optional Play Code Selector */}
          {allowPlayChange && (
            <div className="space-y-1.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-[#252D38]/50 border border-slate-200 dark:border-[#354050]/80">
              <span className="text-xs font-semibold text-slate-400 block">
                Select Play Outcome
              </span>
              <div className="flex flex-col gap-1.5">
                <div>
                  <span className="text-xs font-semibold text-[#18212D] dark:text-[#D1D5DB] block mb-0.5">
                    Base Hits (Reaches Base Safely):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {POPULAR_BATTING_CODES.filter((item) => item.isHit).map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => handleCodeChange(item.code)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          currentCode === item.code
                            ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                            : 'bg-white dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-200 dark:border-[#354050] hover:bg-slate-100'
                        }`}
                      >
                        {item.badge}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-[#9CA3AF] block mb-0.5">
                    Outs / Fielder Decisions:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {POPULAR_BATTING_CODES.filter((item) => !item.isHit).map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => handleCodeChange(item.code)}
                        className={`px-2 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          currentCode === item.code
                            ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-xs'
                            : 'bg-white dark:bg-[#252D38] text-slate-600 dark:text-[#9CA3AF] border border-slate-200 dark:border-[#354050] hover:bg-slate-100'
                        }`}
                      >
                        {item.badge}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Runs Batted In (RBI) Selector */}
          <div className="p-3 rounded-2xl border border-slate-300 dark:border-[#354050] bg-slate-100/70 dark:bg-[#252D38]/30 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-950 font-semibold text-xs inline-flex items-center justify-center">
                  <Star className="w-3 h-3 fill-current" />
                </span>
                <div>
                  <span className="text-xs font-semibold text-[#18212D] dark:text-[#D1D5DB] block">
                    {isHomeRun ? 'Home Run RBIs (batter +1 automatic)' : 'Runs Batted In (RBI)'}
                  </span>
                  <span className="text-xs text-[#18212D] dark:text-[#D1D5DB]">
                    {isHomeRun
                      ? 'Batter\'s own RBI is added automatically (+1). Add the other runners who scored:'
                      : 'RBI\`s brought in:'}
                  </span>
                </div>
              </div>
              {rbiCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#252D38]/60 text-[#18212D] dark:text-[#D1D5DB] text-xs font-semibold shrink-0">
                  <Star className="w-3 h-3 inline fill-current" /> {rbiCount} {rbiCount === 1 ? 'RBI' : 'RBIs'}
                </span>
              )}
            </div>

            {/* RBI Buttons */}
            {isHomeRun ? (
              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                {[
                  { count: 1, label: '+0', sub: 'Solo HR' },
                  { count: 2, label: '+1', sub: '2-Run HR' },
                  { count: 3, label: '+2', sub: '3-Run HR' },
                  { count: 4, label: '+3', sub: 'Grand Slam' },
                ].map((item) => (
                  <button
                    key={item.count}
                    type="button"
                    onClick={() => setRbiCount(item.count)}
                    className={`py-1.5 px-1 rounded-xl text-center transition-all cursor-pointer border ${
                      rbiCount === item.count
                        ? 'bg-slate-200 text-slate-950 border-slate-300 shadow-xs font-semibold ring-2 ring-slate-300'
                        : 'bg-white dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border-slate-200 dark:border-[#354050] hover:bg-slate-100 font-semibold'
                    }`}
                  >
                    <span className="block text-xs leading-none">{item.label}</span>
                    <span className="block text-xs opacity-80 leading-tight mt-0.5">{item.sub}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                {[
                  { count: 0, label: '0 RBI', sub: 'None' },
                  { count: 1, label: '1 RBI', sub: '1 Run' },
                  { count: 2, label: '2 RBI', sub: '2 Runs' },
                  { count: 3, label: '3 RBI', sub: '3 Runs' },
                ].map((item) => (
                  <button
                    key={item.count}
                    type="button"
                    onClick={() => setRbiCount(item.count)}
                    className={`py-1.5 px-1 rounded-xl text-center transition-all cursor-pointer border ${
                      rbiCount === item.count
                        ? 'bg-slate-200 text-slate-950 border-slate-300 shadow-xs font-semibold ring-2 ring-slate-300'
                        : 'bg-white dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border-slate-200 dark:border-[#354050] hover:bg-slate-100 font-semibold'
                    }`}
                  >
                    <span className="block text-xs leading-none">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Instruction banner */}
          <div className="flex items-center justify-between text-xs px-0.5">
            <span className="font-semibold text-slate-700 dark:text-[#D1D5DB] flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-[#007A6A] dark:text-[#00D7BC]" />
              Tap the field where the ball landed:
            </span>
            <span className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC]">
              {location.zone ? `${getZoneLabel(resolveZone(location))} (${resolveZone(location)})` : 'Tap to place'}
            </span>
          </div>

          {/* Interactive Baseball Field */}
          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-[#354050]">
            <SprayChart
              interactive
              selectedLocation={location}
              onSelectLocation={handleFieldSelect}
              showFilters={false}
              showLegend={false}
              showSelectionPill={false}
            />
          </div>

          {/* Hit Trajectory Selector */}
          <div className="space-y-2 rounded-2xl border border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38]/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#18212D] dark:text-[#FAFAFA] block">
                How was it hit?
              </span>
              <span className="text-xs font-semibold text-[#007A6A] dark:text-[#00D7BC]">
                Ball Trajectory
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {trajectories.map((traj) => (
                <button
                  key={traj.id}
                  type="button"
                  onClick={() =>
                    setLocation((prev) => ({
                      ...prev,
                      trajectory: traj.id,
                    }))
                  }
                  className={`min-h-[52px] py-2 px-1 rounded-xl text-center text-xs font-semibold leading-tight transition-all active:scale-95 cursor-pointer ${
                    location.trajectory === traj.id
                      ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-md ring-2 ring-[#00BFA5]/40'
                      : 'bg-white dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border border-slate-300 dark:border-[#465160] hover:bg-slate-100'
                  }`}
                >
                  {traj.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38]/80 flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-[#354050] text-slate-700 dark:text-[#D1D5DB] text-xs font-semibold hover:bg-slate-200/50 cursor-pointer"
          >
            Skip
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-[#18212D] dark:text-[#101419] text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 transition-colors active:scale-98 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Save hit spot</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const HitLocationModal: React.FC<HitLocationModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <HitLocationModalDialog {...props} />;
};