import { useMemo } from 'react';
import type { Play } from '../../types/baseball';
import { RUNNER_OUT_REASONS } from '../types/baseball';
import { PLAY_DEFINITIONS } from '../../utils/playDefinitions';
import { positionName } from './scoreTabConstants';

export interface PlayPitchMeta {
  pitchNumber: number | null;
  whatHappened: string;
  whatHappenedDetail?: string;
  shortBadge: string;
  badgeStyle: string;
}

export function usePlayPresentation(plays: Play[]) {
  const getPlayBadgeStyle = (play: Play) => {
    if (play.mode === 'batting') {
      if (['single', 'double', 'triple', 'homeRun'].includes(play.code)) {
        return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-[#00A892] shadow-2xs';
      }
      if (['walk', 'intentionalWalk', 'hbp'].includes(play.code)) {
        return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-300 shadow-2xs';
      }
      if (['rbi', 'run', 'stolenBase'].includes(play.code)) {
        return 'bg-slate-200 text-white border-slate-300 shadow-2xs';
      }
      return 'bg-slate-700 dark:bg-[#465160] text-white border-slate-700 shadow-2xs';
    }
    if (play.mode === 'pitching') {
      if (['hitAllowed', 'homeRunAllowed'].includes(play.code)) {
        return 'bg-slate-600 text-white border-slate-700 shadow-2xs';
      }
      if (['pitchOut', 'strikeout'].includes(play.code)) {
        if (play.code === 'strikeout' && play.droppedThirdStrikeSafe) {
          return 'bg-blue-600 text-white border-blue-700 shadow-2xs';
        }
        return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-300 shadow-2xs';
      }
      if (['walkAllowed', 'intentionalWalkAllowed', 'hitBatter'].includes(play.code)) {
        return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-300 shadow-2xs';
      }
      if (play.code === 'pitchStrike' || play.code === 'pitchFoul') {
        return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-300 shadow-2xs';
      }
      if (play.code === 'pitchBall') {
        return 'bg-slate-600 text-white border-slate-700 shadow-2xs';
      }
      return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-300 shadow-2xs';
    }
    return 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-300 shadow-2xs';
  };

  // Derive dynamic pitch numbering and user-friendly event descriptions.
  // Re-evaluates whenever plays are re-ordered (drag-and-drop), added, or removed.
  const playPitchMetaMap = useMemo(() => {
    const map = new Map<
      string,
      {
        pitchNumber: number | null;
        whatHappened: string;
        whatHappenedDetail?: string;
        shortBadge: string;
        badgeStyle: string;
      }
    >();

    let cumulativePitches = 0;

    for (let i = 0; i < plays.length; i++) {
      const play = plays[i];
      const prevPlay = i > 0 ? plays[i - 1] : null;

      if (play.mode !== 'pitching') {
        const def = PLAY_DEFINITIONS[play.code];
        let title = def?.fullLabel || play.code;
        let badge = def?.shortLabel || play.code;
        let detail: string | undefined = undefined;

        if (play.mode === 'batting') {
          if (play.code === 'out') {
            if (play.outReason === 'batterRunnerInterference') {
              title = 'Batter-runner interference';
            } else {
              const traj = play.hitLocation?.trajectory;
              if (traj === 'grounder') title = 'Groundout';
              else if (traj === 'flyBall') title = 'Flyout';
              else if (traj === 'popUp') title = 'Pop Out';
              else if (traj === 'lineDrive') title = 'Lineout';
              else if (traj === 'bunt') title = 'Bunt Out';
              else title = 'Out';
            }
          } else if (play.code === 'strikeout') {
            title = 'Strikeout';
          } else if (play.code === 'single') {
            title = 'Single';
          } else if (play.code === 'double') {
            title = 'Double';
          } else if (play.code === 'triple') {
            title = 'Triple';
          } else if (play.code === 'homeRun') {
            title = 'Home run';
          } else if (play.code === 'walk') {
            title = 'Walk';
          } else if (play.code === 'intentionalWalk') {
            title = 'Intentional walk';
          } else if (play.code === 'hbp') {
            title = 'Hit by pitch';
          } else if (play.code === 'runnerOut') {
            const reasonLabel = RUNNER_OUT_REASONS.find((r) => r.code === play.runnerOutReason)?.label;
            const baseLabel = play.runnerFromBase
              ? ` (from ${play.runnerFromBase === 1 ? '1st' : play.runnerFromBase === 2 ? '2nd' : '3rd'})`
              : '';
            title = reasonLabel ? `Runner Out: ${reasonLabel}${baseLabel}` : play.runnerFromBase
              ? `Runner Out at ${play.runnerFromBase === 1 ? '1st' : play.runnerFromBase === 2 ? '2nd' : '3rd'}`
              : 'Runner Out';
          }
        } else if (play.mode === 'fielding') {
          if (play.code === 'fieldersChoice') {
            title = "Fielder's Choice";
            badge = 'FC';
          }
          if (play.defensivePosition) {
            detail = `Position: ${play.defensivePosition}`;
          }
        }

        map.set(play.id, {
          pitchNumber: null,
          whatHappened: title,
          whatHappenedDetail: detail,
          shortBadge: badge,
          badgeStyle: getPlayBadgeStyle(play),
        });
        continue;
      }

      // PITCHING MODE
      let isPitch = false;
      switch (play.code) {
        case 'pitchBall':
        case 'pitchStrike':
        case 'pitchFoul':
        case 'pitchOther':
          isPitch = true;
          break;
        case 'wildPitch':
          isPitch = play.pitchCounted !== false;
          break;
        case 'passedBall':
        case 'hitBatter':
        case 'hitAllowed':
        case 'homeRunAllowed':
        case 'reachedOnError':
        case 'fieldersChoice':
          isPitch = true;
          break;
        case 'pitchOut':
          isPitch = !play.isExtraOut && play.pickoffKind !== 'pickoff';
          break;
        case 'strikeout': {
          const isAuto =
            play.autoOutcome ||
            (prevPlay?.code === 'pitchStrike' &&
              Math.abs((play.timestamp || 0) - (prevPlay.timestamp || 0)) < 150);
          isPitch = !isAuto;
          break;
        }
        case 'walkAllowed': {
          const isAuto =
            play.autoOutcome ||
            (prevPlay?.code === 'pitchBall' &&
              Math.abs((play.timestamp || 0) - (prevPlay.timestamp || 0)) < 150);
          isPitch = !isAuto;
          break;
        }
        default:
          isPitch = false;
          break;
      }

      let currentPitchNumber: number | null = null;
      if (isPitch) {
        cumulativePitches++;
        currentPitchNumber = cumulativePitches;
      }

      let whatHappened = '';
      let whatHappenedDetail: string | undefined = undefined;
      let shortBadge = '';
      let badgeStyle = getPlayBadgeStyle(play);

      switch (play.code) {
        case 'pitchBall':
          whatHappened = 'Ball';
          shortBadge = 'BALL';
          badgeStyle = 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-[#252D38] dark:text-[#D1D5DB] dark:border-[#354050] shadow-2xs';
          break;
        case 'pitchStrike':
          whatHappened = 'Strike';
          shortBadge = 'STRIKE';
          badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          break;
        case 'pitchFoul':
          whatHappened = 'Foul Ball';
          shortBadge = 'FOUL';
          badgeStyle = 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-[#252D38] dark:text-[#D1D5DB] dark:border-[#354050] shadow-2xs';
          break;
        case 'pitchOther':
          whatHappened = 'In Play';
          shortBadge = 'IN PLAY';
          badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          break;
        case 'wildPitch': {
          const isStrike = play.wildPitchPitchType === 'strike';
          whatHappened = isStrike ? 'Wild Pitch (Swinging Strike)' : 'Wild Pitch (Ball)';
          if (play.wildPitchRunnerMovement === 'scored') {
            whatHappenedDetail = `Pitch got past catcher (${isStrike ? 'swinging strike' : 'ball'}); run scored`;
          } else if (play.wildPitchRunnerMovement === 'out') {
            whatHappenedDetail = `Pitch got past catcher (${isStrike ? 'swinging strike' : 'ball'}); runner thrown out`;
          } else if (play.wildPitchRunnerMovement === 'batterSafe1B') {
            whatHappenedDetail = `Uncaught 3rd strike on wild pitch; batter reached 1st base safely`;
          } else {
            whatHappenedDetail = `Pitch got past catcher (${isStrike ? 'swinging strike' : 'ball'}); runners advanced`;
          }
          shortBadge = isStrike ? 'WP (STR)' : 'WP';
          badgeStyle = 'bg-blue-600 text-white border-blue-700 shadow-2xs';
          break;
        }
        case 'passedBall':
          whatHappened = 'Passed Ball';
          whatHappenedDetail = 'Catcher misplay; runners advanced';
          shortBadge = 'PB';
          badgeStyle = 'bg-blue-600 text-white border-blue-700 shadow-2xs';
          break;
        case 'balk':
          whatHappened = 'Balk';
          whatHappenedDetail = 'Illegal pitch; runners advanced';
          shortBadge = 'BALK';
          badgeStyle = 'bg-blue-700 text-white border-blue-800 shadow-2xs';
          break;
        case 'pickoffAttempt': {
          const base = play.throwTo && play.throwTo !== 'unassisted' ? play.throwTo : '1B';
          whatHappened = `Pickoff attempt: runner safe at ${positionName(base).toLowerCase()}`;
          whatHappenedDetail = `Pitcher threw to ${positionName(base).toLowerCase()}; the runner got back safely`;
          shortBadge = 'PICKOFF';
          badgeStyle = 'bg-slate-700 text-white border-slate-800 shadow-2xs';
          break;
        }
        case 'strikeout':
          if (play.droppedThirdStrikeSafe) {
            whatHappened = 'Dropped 3rd Strike — Safe at 1st';
            whatHappenedDetail = 'Catcher dropped 3rd strike; batter reached 1st safely (K credited, no out recorded)';
            shortBadge = 'K (SAFE)';
            badgeStyle = 'bg-blue-600 text-white border-blue-700 shadow-2xs';
          } else {
            whatHappened = 'Strikeout';
            shortBadge = 'K';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          }
          break;
        case 'pitchOut': {
          if (play.pickoffKind === 'pickoff') {
            const base = play.throwTo && play.throwTo !== 'unassisted' ? play.throwTo : '1B';
            whatHappened = `Runner picked off at ${positionName(base).toLowerCase()}`;
            whatHappenedDetail = 'Pitcher threw to the base and got the runner out';
            shortBadge = 'PICKOFF OUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          } else if (play.pickoffKind === 'caughtStealing') {
            const base = play.throwTo && play.throwTo !== 'unassisted' ? play.throwTo : '2B';
            whatHappened = `Runner caught stealing ${positionName(base).toLowerCase()}`;
            whatHappenedDetail = 'Runner was thrown out trying to steal';
            shortBadge = 'CS OUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          } else if (play.isExtraOut) {
            const isTriplePlayOut = play.multiOutPlayType === 'triplePlay';
            const outNumber = play.multiOutNumber ?? 2;
            const playLabel = isTriplePlayOut ? 'Triple play' : 'Double play';
            const ordinal = outNumber === 3 ? 'third' : 'second';
            whatHappened = `${playLabel}: ${ordinal} out`;
            whatHappenedDetail = `The ${ordinal} out was recorded as part of the same ${isTriplePlayOut ? 'triple' : 'double'} play`;
            shortBadge = isTriplePlayOut ? 'TP OUT' : 'DP OUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          } else if (play.pitcherAction === 'caught') {
            whatHappened = 'Flyout caught by the pitcher';
            whatHappenedDetail = 'Pitcher caught the ball in the air for the out';
            shortBadge = 'FLYOUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          } else if (play.pitcherAction === 'covered') {
            whatHappened = 'Groundout: pitcher covered first base';
            whatHappenedDetail = play.assistBy
              ? `Pitcher covered first base for the out; ${positionName(play.assistBy).toLowerCase()} made the throw`
              : 'Pitcher covered first base for the out';
            shortBadge = 'GROUNDOUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          } else if (play.pitcherAction === 'fielded') {
            const target = play.throwTo && play.throwTo !== 'unassisted' ? play.throwTo : '';
            whatHappened = target ? `Groundout: pitcher threw to ${positionName(target).toLowerCase()}` : 'Groundout: pitcher fielded it unassisted';
            whatHappenedDetail = 'Pitcher fielded the ground ball';
            shortBadge = 'GROUNDOUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          } else if (play.hitLocation?.trajectory) {
            const traj = play.hitLocation.trajectory;
            if (traj === 'grounder') whatHappened = 'Groundout';
            else if (traj === 'flyBall') whatHappened = 'Flyout';
            else if (traj === 'popUp') whatHappened = 'Pop Out';
            else if (traj === 'lineDrive') whatHappened = 'Lineout';
            else if (traj === 'bunt') whatHappened = 'Bunt Out';
            else whatHappened = 'Out';
            shortBadge = 'OUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          } else {
            whatHappened = 'Out';
            whatHappenedDetail = 'Batted ball retired for out';
            shortBadge = 'OUT';
            badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          }
          break;
        }
        case 'hitAllowed':
          if (play.hitBases === 4) {
            whatHappened = 'Home Run Allowed';
            shortBadge = 'HR';
            badgeStyle = 'bg-slate-600 text-white border-slate-700 shadow-2xs';
          } else if (play.hitBases === 3) {
            whatHappened = 'Triple Allowed';
            shortBadge = '3B';
            badgeStyle = 'bg-slate-600 text-white border-slate-700 shadow-2xs';
          } else if (play.hitBases === 2) {
            whatHappened = 'Double Allowed';
            shortBadge = '2B';
            badgeStyle = 'bg-slate-600 text-white border-slate-700 shadow-2xs';
          } else {
            whatHappened = 'Single Allowed';
            shortBadge = '1B';
            badgeStyle = 'bg-slate-600 text-white border-slate-700 shadow-2xs';
          }
          break;
        case 'homeRunAllowed':
          whatHappened = 'Home Run Allowed';
          shortBadge = 'HR';
          badgeStyle = 'bg-slate-600 text-white border-slate-700 shadow-2xs';
          break;
        case 'walkAllowed':
          whatHappened = 'Walk';
          whatHappenedDetail = 'Batter awarded first base after four balls';
          shortBadge = 'WALK';
          badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          break;
        case 'intentionalWalkAllowed':
          whatHappened = 'Intentional walk';
          whatHappenedDetail = 'Batter awarded first base; no pitches counted';
          shortBadge = 'IBB';
          badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          break;
        case 'hitBatter':
          whatHappened = 'Hit batter';
          whatHappenedDetail = 'Pitch hit the batter; batter awarded first base';
          shortBadge = 'HBP';
          badgeStyle = 'bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] border-slate-700 shadow-2xs';
          break;
        case 'reachedOnError':
          whatHappened = 'Reached on Error';
          whatHappenedDetail = 'Defensive error; batter safe';
          shortBadge = 'ERROR';
          badgeStyle = 'bg-blue-600 text-white border-blue-700 shadow-2xs';
          break;
        case 'fieldersChoice':
          whatHappened = "Fielder's Choice";
          whatHappenedDetail = 'Lead runner retired; batter safe';
          shortBadge = 'FC';
          badgeStyle = 'bg-slate-700 text-white border-slate-800 shadow-2xs';
          break;
        case 'earnedRun':
          whatHappened = 'Earned run (+1)';
          whatHappenedDetail = 'Run scored against pitcher';
          shortBadge = 'ER';
          badgeStyle = 'bg-slate-700 text-white border-slate-800 shadow-2xs';
          break;
        case 'runAllowed':
          whatHappened = 'Unearned run (+1)';
          whatHappenedDetail = 'Run scored because of an error or passed ball';
          shortBadge = 'RUN';
          badgeStyle = 'bg-slate-600 text-white border-slate-700 shadow-2xs';
          break;
        default:
          whatHappened = PLAY_DEFINITIONS[play.code]?.fullLabel || play.code;
          shortBadge = PLAY_DEFINITIONS[play.code]?.shortLabel || play.code;
          break;
      }

      map.set(play.id, {
        pitchNumber: currentPitchNumber,
        whatHappened,
        whatHappenedDetail,
        shortBadge,
        badgeStyle,
      });
    }

    return map;
  }, [plays]);

  // Pitch number within the inning, shown as "inning.pitch" (e.g. 4.2 = 2nd pitch of the 4th inning).
  const inningPitchLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    let lastPitchNumber = 0;
    let baseForInning = 0;
    let currentInningSeen: number | null = null;
    for (const play of plays) {
      if (play.mode !== 'pitching') continue;
      const n = playPitchMetaMap.get(play.id)?.pitchNumber;
      if (n === null || n === undefined) continue;
      if (play.inning !== currentInningSeen) {
        baseForInning = lastPitchNumber;
        currentInningSeen = play.inning;
      }
      map.set(play.id, `${play.inning}.${n - baseForInning}`);
      lastPitchNumber = n;
    }
    return map;
  }, [plays, playPitchMetaMap]);


  return { getPlayBadgeStyle, playPitchMetaMap, inningPitchLabelMap };
};
