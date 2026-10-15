import React, { useState } from 'react';
import { HitLocation, HitTrajectory, LINEUP_SPOTS, Play, PlayCode, PlayMode } from '../types/baseball';
import { getPlaysForMode } from '../utils/playDefinitions';
import {
  getAttachedRbiPlayIds,
  getDefaultTrajectoryForPlay,
  getZoneLabel,
  isBattedBallPlay,
  resolveZone,
} from '../utils/sprayChart';
import { SprayChart } from './SprayChart';
import { Check, Crosshair, MapPin, Trash2, X } from 'lucide-react';

interface EditPlayModalProps {
  play: Play | null;
  maxInnings: number;
  /** All plays in the game, used to work out how many RBIs are attached to this play. */
  allPlays?: Play[];
  /** Set the number of RBI plays attached to a batting play. */
  onSetRbis?: (playId: string, count: number) => void;
  onSave: (
    playId: string,
    inning: number,
    mode: PlayMode,
    code: PlayCode,
    lineupSpot?: number,
    hitLocation?: HitLocation | null,
    throwTo?: string
  ) => void;
  onDelete: (playId: string) => void;
  onMove?: (playId: string, direction: 'earlier' | 'later', sameModeOnly?: boolean) => void;
  moveWithinCategory?: boolean;
  onInsertAfter?: (
    afterPlayId: string,
    inning: number,
    mode: PlayMode,
    code: PlayCode,
    hitLocation?: HitLocation | null
  ) => void;
  canMoveEarlier?: boolean;
  canMoveLater?: boolean;
  onClose: () => void;
}

interface EditPlayDialogProps extends Omit<EditPlayModalProps, 'play'> {
  play: Play;
}

const EditPlayModalDialog: React.FC<EditPlayDialogProps> = ({
  play,
  maxInnings: _maxInnings,
  allPlays,
  onSetRbis,
  onSave,
  onDelete,
  onMove,
  moveWithinCategory = false,
  onInsertAfter,
  canMoveEarlier = false,
  canMoveLater = false,
  onClose,
}) => {

  // Plays stay in their original inning; ordering changes are handled by the Plays in the Game list.
  const inning = play.inning;
  const [mode, setMode] = useState<PlayMode>(play.mode);
  const [code, setCode] = useState<PlayCode>(play.code);
  const [lineupSpot, setLineupSpot] = useState<number | undefined>(play.lineupSpot);
  const [throwTo, setThrowTo] = useState<string | undefined>(play.throwTo || '1B');
  const [hitLocation, setHitLocation] = useState<HitLocation | null | undefined>(play.hitLocation);
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(Boolean(play.hitLocation));

  const originalRbis = allPlays ? getAttachedRbiPlayIds(play, allPlays).length : 0;
  const [rbiCount, setRbiCount] = useState<number>(originalRbis);

  const [insertMode, setInsertMode] = useState(false);
  const availablePlays = getPlaysForMode(mode);

  const switchToInsert = (insert: boolean) => {
    setInsertMode(insert);
    if (insert) {
      // New play starts without a location; keep the same inning/category as a convenient default
      setHitLocation(null);
      setShowLocationPicker(false);
    } else {
      setHitLocation(play.hitLocation);
      setShowLocationPicker(Boolean(play.hitLocation));
      setMode(play.mode);
      setCode(play.code);
      setLineupSpot(play.lineupSpot);
    }
  };

  const handleModeChange = (newMode: PlayMode) => {
    setMode(newMode);
    const newPlays = getPlaysForMode(newMode);
    if (!newPlays.some((p) => p.code === code)) {
      setCode(newPlays[0].code);
    }
  };

  const handleSave = () => {
    if (insertMode && onInsertAfter) {
      onInsertAfter(play.id, inning, mode, code, hitLocation);
      onClose();
      return;
    }
    onSave(play.id, inning, mode, code, lineupSpot, hitLocation, throwTo);
    if (onSetRbis && showRbi && rbiCount !== originalRbis) onSetRbis(play.id, rbiCount);
    onClose();
  };

  const handleDelete = () => {
    onDelete(play.id);
    onClose();
  };

  const isBattedBall = mode === 'batting' && isBattedBallPlay(code);
  // RBIs can be set on any batting at-bat result (not on the RBI/run bookkeeping plays themselves)
  const showRbi =
    !insertMode && Boolean(onSetRbis) && mode === 'batting' && code !== 'rbi' && code !== 'run' && isBattedBall;

  const trajectories: { id: HitTrajectory; label: string }[] = [
    { id: 'lineDrive', label: 'Line Drive' },
    { id: 'flyBall', label: 'Fly Ball' },
    { id: 'grounder', label: 'Grounder' },
    { id: 'popUp', label: 'Pop Up' },
    { id: 'bunt', label: 'Bunt' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md max-h-[92vh] flex flex-col bg-white dark:bg-[#1A2028] rounded-3xl shadow-2xl border border-slate-200 dark:border-[#354050] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-play-title"
      >
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#354050] flex items-center justify-between bg-slate-50 dark:bg-[#252D38]/60">
          <h3 id="edit-play-title" className="font-semibold text-sm text-slate-900 dark:text-[#FAFAFA] uppercase tracking-wider">
            Edit Recorded Play
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-[#D1D5DB]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Edit this play vs. add a new play after it, plus re-ordering */}
          {(onInsertAfter || onMove) && (
            <div className="space-y-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-[#252D38]/50 border border-slate-200 dark:border-[#354050]/80">
              {onInsertAfter && (
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#252D38]">
                  <button
                    type="button"
                    onClick={() => switchToInsert(false)}
                    className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                      !insertMode ? 'bg-white dark:bg-[#354050] text-[#18212D] dark:text-[#FAFAFA] shadow-xs' : 'text-slate-600 dark:text-[#9CA3AF]'
                    }`}
                  >
                    Edit this play
                  </button>
                  <button
                    type="button"
                    onClick={() => switchToInsert(true)}
                    className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                      insertMode ? 'bg-white dark:bg-[#354050] text-[#18212D] dark:text-[#FAFAFA] shadow-xs' : 'text-slate-600 dark:text-[#9CA3AF]'
                    }`}
                  >
                    + Add a play after it
                  </button>
                </div>
              )}
              {insertMode ? (
                <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                  The new play is placed right after this one, so plays recorded later stay where they are.
                </p>
              ) : (
                onMove && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={!canMoveEarlier}
                      onClick={() => onMove(play.id, 'earlier', moveWithinCategory)}
                      className="py-2 rounded-xl border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] disabled:opacity-40"
                    >
                      ↓ Move earlier
                    </button>
                    <button
                      type="button"
                      disabled={!canMoveLater}
                      onClick={() => onMove(play.id, 'later', moveWithinCategory)}
                      className="py-2 rounded-xl border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-700 dark:text-[#D1D5DB] disabled:opacity-40"
                    >
                      ↑ Move later
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          {/* Mode Switcher */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-[#9CA3AF] mb-1.5">
              Category / Mode
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#252D38]">
              {(['batting', 'pitching', 'fielding'] as PlayMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleModeChange(m)}
                  className={`py-2 text-xs font-semibold capitalize rounded-md transition-colors ${
                    mode === m
                      ? 'bg-white dark:bg-[#354050] text-[#18212D] dark:text-[#FAFAFA] shadow-xs'
                      : 'text-slate-600 dark:text-[#9CA3AF]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Play code selection grid */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-[#9CA3AF] mb-1.5">
              Select Action
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {availablePlays.map((def) => (
                <button
                  key={def.code}
                  type="button"
                  onClick={() => setCode(def.code)}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    code === def.code
                      ? 'border-[#00BFA5] bg-teal-50 dark:bg-[#00D7BC]/15 text-slate-900 dark:text-[#FAFAFA] ring-1 ring-[#00BFA5]'
                      : 'border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38]/60 text-slate-700 dark:text-[#D1D5DB]'
                  }`}
                >
                  <span className="font-extrabold text-[11px] px-1.5 py-0.5 rounded-md bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419]">
                    {def.shortLabel}
                  </span>
                  <span className="text-xs font-semibold truncate">{def.fullLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Batting Position / Lineup Spot for batting plays */}
          {mode === 'batting' && (
            <div className="pt-2 border-t border-slate-200 dark:border-[#354050] space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-[#9CA3AF]">
                Batting Position (Lineup Spot)
              </label>
              <select
                value={lineupSpot ?? ''}
                onChange={(e) => setLineupSpot(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#252D38] border border-slate-200 dark:border-[#354050] text-xs font-semibold text-slate-900 dark:text-[#FAFAFA] cursor-pointer"
              >
                <option value="">Not assigned</option>
                {LINEUP_SPOTS.map((s) => (
                  <option key={s.spot} value={s.spot}>
                    #{s.spot} · {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* RBIs for hits / batted-ball results */}
          {showRbi && (
            <div className="pt-2 border-t border-slate-200 dark:border-[#354050] space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-[#9CA3AF]">
                Runs Batted In (RBI)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(code === 'homeRun'
                  ? [
                      { count: 1, label: '1 RBI', sub: 'Solo HR' },
                      { count: 2, label: '2 RBI', sub: '2-Run HR' },
                      { count: 3, label: '3 RBI', sub: '3-Run HR' },
                      { count: 4, label: '4 RBI', sub: 'Grand Slam' },
                    ]
                  : [
                      { count: 0, label: '0 RBI', sub: 'None' },
                      { count: 1, label: '1 RBI', sub: '1 Run' },
                      { count: 2, label: '2 RBI', sub: '2 Runs' },
                      { count: 3, label: '3 RBI', sub: '3 Runs' },
                    ]
                ).map((item) => (
                  <button
                    key={item.count}
                    type="button"
                    onClick={() => setRbiCount(item.count)}
                    className={`py-1.5 px-1 rounded-xl text-center transition-all border font-semibold ${
                      rbiCount === item.count
                        ? 'bg-slate-200 text-slate-950 border-slate-300 shadow-xs ring-2 ring-slate-300'
                        : 'bg-white dark:bg-[#252D38] text-slate-700 dark:text-[#D1D5DB] border-slate-200 dark:border-[#354050] hover:bg-slate-100'
                    }`}
                  >
                    <span className="block text-xs leading-none">{item.label}</span>
                    <span className="block text-[10px] opacity-80 leading-tight mt-0.5">{item.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Base Thrown To for Pickoff or Caught Stealing */}
          {(code === 'pickoffAttempt' || (mode === 'pitching' && Boolean(play.pickoffKind))) && (
            <div className="pt-2 border-t border-slate-200 dark:border-[#354050] space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-[#9CA3AF]">
                Base Thrown To
              </label>
              <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#252D38]">
                {(['1B', '2B', '3B', 'HOME'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setThrowTo(b)}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      (throwTo || '1B') === b
                        ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                        : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#FAFAFA]'
                    }`}
                  >
                    {b === 'HOME' ? 'Home' : b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Batting Spray Chart & Hit Direction Tapper in Edit Mode */}
          {isBattedBall && (
            <div className="pt-2 border-t border-slate-200 dark:border-[#354050] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-[#D1D5DB] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#007A6A] dark:text-[#00D7BC]" />
                  Hit Location on Field
                </span>
                {hitLocation && (
                  <button
                    type="button"
                    onClick={() => {
                      setHitLocation(null);
                      setShowLocationPicker(false);
                    }}
                    className="text-[11px] font-semibold text-teal-600 hover:text-teal-700"
                  >
                    Clear Location
                  </button>
                )}
              </div>

              {showLocationPicker ? (
                <div className="space-y-2.5 rounded-2xl bg-slate-50 dark:bg-[#252D38]/40 p-3 border border-slate-200 dark:border-[#354050]">
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB] flex items-center justify-between">
                    <span>Tap field to reposition:</span>
                    <span className="text-[#007A6A] dark:text-[#00D7BC] font-semibold">
                      {hitLocation?.zone ? `${getZoneLabel(resolveZone(hitLocation))} (${resolveZone(hitLocation)})` : 'Tap field'}
                    </span>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-slate-300 dark:border-[#354050]">
                    <SprayChart
                      interactive
                      selectedLocation={hitLocation || { x: 50, y: 35, zone: 'CF', trajectory: getDefaultTrajectoryForPlay(code) }}
                      onSelectLocation={(loc) => setHitLocation(loc)}
                      heightClass="h-44 sm:h-52"
                      showLegend={false}
                    />
                  </div>

                  {/* Trajectory */}
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                      Trajectory
                    </span>
                    <div className="grid grid-cols-5 gap-1">
                      {trajectories.map((traj) => (
                        <button
                          key={traj.id}
                          type="button"
                          onClick={() =>
                            setHitLocation((prev) => ({
                              ...(prev || { x: 50, y: 35, zone: 'CF' }),
                              trajectory: traj.id,
                            }))
                          }
                          className={`py-1.5 px-1 rounded-md text-center text-[10px] font-semibold transition-all ${
                            (hitLocation?.trajectory || getDefaultTrajectoryForPlay(code)) === traj.id
                              ? 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] shadow-xs'
                              : 'bg-white dark:bg-[#354050] text-slate-600 dark:text-[#D1D5DB]'
                          }`}
                        >
                          {traj.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationPicker(true);
                    setHitLocation({
                      x: 50,
                      y: code === 'homeRun' ? 15 : 35,
                      zone: 'CF',
                      trajectory: getDefaultTrajectoryForPlay(code),
                    });
                  }}
                  className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-600 dark:text-[#D1D5DB] hover:border-[#00BFA5] hover:text-[#007A6A] dark:hover:text-[#00D7BC] flex items-center justify-center gap-1.5"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  + Add Hit Direction / Field Location
                </button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#252D38]/60 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDelete}
            style={insertMode ? { visibility: 'hidden' } : undefined}
            className="px-3 py-2 rounded-xl text-teal-600 hover:bg-teal-50 dark:hover:bg-[#00D7BC]/15 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Play
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-[#354050] text-xs font-semibold text-slate-700 dark:text-[#D1D5DB]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] hover:bg-[#00A892] dark:hover:bg-[#00C4AB] text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Check className="w-4 h-4" />
              {insertMode ? 'Add Play' : 'Apply Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const EditPlayModal: React.FC<EditPlayModalProps> = (props) => {
  if (!props.play) return null;
  return <EditPlayModalDialog {...props} play={props.play} />;
};