import { DefensivePosition, FieldingPlayCode, PlayCode, PlayDefinition, PlayMode } from '../types/baseball';

export const PLAY_DEFINITIONS: Record<PlayCode, PlayDefinition> = {
  // Batting (18 buttons)
  single: {
    code: 'single',
    mode: 'batting',
    shortLabel: '1B',
    fullLabel: 'Single',
    description: 'The batter hits the ball and safely reaches first base without fielding errors.',
    example: 'Line drive into right field, batter hustles to first base.',
    categoryColor: 'hit',
  },
  double: {
    code: 'double',
    mode: 'batting',
    shortLabel: '2B',
    fullLabel: 'Double',
    description: 'The batter hits the ball and safely reaches second base.',
    example: 'Deep hit into the left-center gap, slides safely into second base.',
    categoryColor: 'hit',
  },
  triple: {
    code: 'triple',
    mode: 'batting',
    shortLabel: '3B',
    fullLabel: 'Triple',
    description: 'The batter hits the ball and safely reaches third base.',
    example: 'Rattles down the right field line into the corner, slides in at third.',
    categoryColor: 'hit',
  },
  homeRun: {
    code: 'homeRun',
    mode: 'batting',
    shortLabel: 'HR',
    fullLabel: 'Home run',
    description: 'The batter hits the ball out of the park or completes an inside-the-park home run.',
    example: 'Deep drive over the outfield fence for a round-tripper.',
    categoryColor: 'hit',
  },
  walk: {
    code: 'walk',
    mode: 'batting',
    shortLabel: 'BB',
    fullLabel: 'Walk (Base on balls)',
    description: 'Four balls outside the strike zone awarded first base. Does not count as an official at-bat.',
    example: 'Full count, ball four called low, batter takes first base.',
    categoryColor: 'walk',
  },
  intentionalWalk: {
    code: 'intentionalWalk',
    mode: 'batting',
    shortLabel: 'IBB',
    fullLabel: 'Intentional walk',
    description: 'The batter is intentionally walked and awarded first base. It counts as a walk and plate appearance, but not an at-bat.',
    example: 'The pitcher is ordered to intentionally walk the batter to face the next hitter.',
    categoryColor: 'walk',
  },
  hbp: {
    code: 'hbp',
    mode: 'batting',
    shortLabel: 'HBP',
    fullLabel: 'Hit by pitch',
    description: 'The batter is struck by a pitch. Use even though it is not an official at-bat.',
    example: 'Pitch gets away inside and grazes batter arm; awarded first base.',
    categoryColor: 'walk',
  },
  strikeout: {
    code: 'strikeout',
    mode: 'batting', // Also dual used in pitching mode
    shortLabel: 'K',
    fullLabel: 'Strikeout',
    description: 'Batter strikes out (swinging or looking on strike three). Recorded as an official at-bat.',
    example: 'Swinging strike on a high fastball for out number two.',
    categoryColor: 'out',
  },
  out: {
    code: 'out',
    mode: 'batting',
    shortLabel: 'OUT',
    fullLabel: 'Out',
    description: 'Any other batting out (groundout, flyout, popout, lineout).',
    example: 'Sharp ground ball to shortstop, thrown out at first base.',
    categoryColor: 'out',
  },
  sacFly: {
    code: 'sacFly',
    mode: 'batting',
    shortLabel: 'SF',
    fullLabel: 'Sacrifice fly',
    description: 'Fly ball caught for an out that allows a baserunner to tag up and score. No official at-bat.',
    example: 'Deep fly to center field caught, runner on third tags and crosses home plate.',
    categoryColor: 'neutral',
  },
  sacBunt: {
    code: 'sacBunt',
    mode: 'batting',
    shortLabel: 'SH',
    fullLabel: 'Sacrifice bunt',
    description: 'A bunt that advances a runner and is scored as a sacrifice. It does not count as an at-bat.',
    example: 'Batter lays down a bunt, is thrown out at first, and the runner advances from first to second.',
    categoryColor: 'neutral',
  },
  reachedOnError: {
    code: 'reachedOnError',
    mode: 'batting',
    shortLabel: 'ROE',
    fullLabel: 'Reached on error',
    description: 'The batter reaches base because a fielder misplays a ball. It counts as an at-bat, not a hit.',
    example: 'Routine grounder is bobbled and the batter reaches first safely.',
    categoryColor: 'out',
  },
  fieldersChoice: {
    code: 'fieldersChoice',
    mode: 'batting',
    shortLabel: 'FC',
    fullLabel: "Fielder's choice",
    description: 'The defense retires or attempts to retire another runner and the batter reaches base. It counts as an at-bat.',
    example: 'Runner is forced out at second while the batter-runner reaches first.',
    categoryColor: 'out',
  },
  groundedIntoDoublePlay: {
    code: 'groundedIntoDoublePlay',
    mode: 'batting',
    shortLabel: 'GIDP',
    fullLabel: 'Grounded into double play',
    description: 'The batter hits a ground ball that results in two outs. Record the fielding double-play participation separately.',
    example: 'With a runner on first, the batter grounds into a 6-4-3 double play.',
    categoryColor: 'out',
  },
  rbi: {
    code: 'rbi',
    mode: 'batting',
    shortLabel: '+ RBI',
    fullLabel: 'Run batted in',
    description: 'A run scores as a result of the batter action at the plate or base hit.',
    example: 'Tap when a runner crosses home plate driven in by your player.',
    categoryColor: 'run',
  },
  run: {
    code: 'run',
    mode: 'batting',
    shortLabel: '+ RUN',
    fullLabel: 'Run scored',
    description: 'Your player touches home plate and scores a run for the team.',
    example: 'Your player rounds third and scores on a teammate base hit.',
    categoryColor: 'run',
  },
  stolenBase: {
    code: 'stolenBase',
    mode: 'batting',
    shortLabel: '+ SB',
    fullLabel: 'Stolen base',
    description: 'Your player advances safely to the next base during a pitch without a hit or error.',
    example: 'Great jump on the pitcher delivery, steals second base easily.',
    categoryColor: 'run',
  },
  cs: {
    code: 'cs',
    mode: 'batting',
    shortLabel: 'CS',
    fullLabel: 'Caught stealing (Baserunner)',
    description: 'Your player is tagged out while attempting to steal a base.',
    example: 'Attempting to steal second, catcher throw arrives in time for the tag.',
    categoryColor: 'out',
  },
  runnerAdvance: {
    code: 'runnerAdvance',
    mode: 'batting',
    shortLabel: 'ADV',
    fullLabel: 'Runner advance (non-steal)',
    description: 'Your runner advanced because of a teammate hit, balk, or pitching error. No stolen base is recorded.',
    example: 'Runner moves from first to second on a teammate single.',
    categoryColor: 'neutral',
  },
  runnerOut: {
    code: 'runnerOut',
    mode: 'batting',
    shortLabel: 'OUT',
    fullLabel: 'Runner out',
    description: 'Your runner was retired while advancing. This records an inning out without adding a batter at-bat.',
    example: 'Runner is thrown out trying to take third.',
    categoryColor: 'out',
  },
  leftOnBase: {
    code: 'leftOnBase',
    mode: 'batting',
    shortLabel: 'LOB',
    fullLabel: 'Left on base',
    description: 'The inning ended elsewhere while your runner remained safely on base.',
    example: 'Another player makes the third out before the runner can score.',
    categoryColor: 'neutral',
  },
  runnerHold: {
    code: 'runnerHold',
    mode: 'batting',
    shortLabel: 'SAFE',
    fullLabel: 'Runner confirmed safe',
    description: 'Internal runner-state marker used to remember that the runner is safely on base after the modal is closed.',
    example: 'Runner remains on base after Done / Stay on Base.',
    categoryColor: 'neutral',
  },
  runnerInjury: {
    code: 'runnerInjury',
    mode: 'batting',
    shortLabel: 'INJ',
    fullLabel: 'Runner injured / replaced',
    description: 'Internal runner-state marker used when the runner leaves due to injury or courtesy replacement.',
    example: 'Original runner leaves and a substitute takes the occupied base.',
    categoryColor: 'neutral',
  },

  // Pitching (15 guide actions)
  pitchOut: {
    code: 'pitchOut',
    mode: 'pitching',
    shortLabel: 'OUT',
    fullLabel: 'Out',
    description: 'An out is recorded by the defense while your player is pitching (groundout, flyout, etc.).',
    example: 'Fly ball to right field caught for the 1st out of the inning.',
    categoryColor: 'defense',
  },
  hitAllowed: {
    code: 'hitAllowed',
    mode: 'pitching',
    shortLabel: 'H',
    fullLabel: 'Hit allowed',
    description: 'Opponent batter reaches base safely on a clean hit against your pitcher.',
    example: 'Opponent hits a single into left field.',
    categoryColor: 'pitch',
  },
  homeRunAllowed: {
    code: 'homeRunAllowed',
    mode: 'pitching',
    shortLabel: 'HR',
    fullLabel: 'Home run allowed',
    description: 'The opposing batter hits a home run off your pitcher. Counts as a hit and a home run; record each run allowed separately.',
    example: 'Batter hits a solo home run over the center-field fence.',
    categoryColor: 'pitch',
  },
  walkAllowed: {
    code: 'walkAllowed',
    mode: 'pitching',
    shortLabel: 'BB',
    fullLabel: 'Walk allowed',
    description: 'Your pitcher issues four balls outside the strike zone, walking the batter.',
    example: 'Pitcher misses just outside on 3-2 count, batter awarded first.',
    categoryColor: 'pitch',
  },
  intentionalWalkAllowed: {
    code: 'intentionalWalkAllowed',
    mode: 'pitching',
    shortLabel: 'IBB',
    fullLabel: 'Intentional walk allowed',
    description: 'Your pitcher intentionally walks the batter. It counts as both a walk allowed and an intentional walk; do not also record a separate walk.',
    example: 'The defense elects to put the batter on first without pitching to them.',
    categoryColor: 'pitch',
  },
  hitBatter: {
    code: 'hitBatter',
    mode: 'pitching',
    shortLabel: 'HBP',
    fullLabel: 'Hit batter',
    description: 'Your pitcher hits the batter with a pitch and awards first base. This is tracked separately from walks.',
    example: 'An inside pitch hits the batter on the arm.',
    categoryColor: 'pitch',
  },
  runAllowed: {
    code: 'runAllowed',
    mode: 'pitching',
    shortLabel: 'R',
    fullLabel: 'Unearned run allowed',
    description: 'Record a run charged to your pitcher that is not earned. Use Earned run for an earned run; both increase runs allowed.',
    example: 'A runner scores after reaching on an error, and the scorer rules the run unearned.',
    categoryColor: 'pitch',
  },
  earnedRun: {
    code: 'earnedRun',
    mode: 'pitching',
    shortLabel: 'ER',
    fullLabel: 'Earned run',
    description: 'A run scored against your pitcher that is not attributable to fielding errors.',
    example: 'Runner on second scores on a clean single without any errors.',
    categoryColor: 'pitch',
  },
  wildPitch: {
    code: 'wildPitch',
    mode: 'pitching',
    shortLabel: 'WP',
    fullLabel: 'Wild pitch',
    description: 'A pitch is so high, low, or wide that the catcher cannot control it with ordinary effort, allowing a runner to advance.',
    example: 'A pitch skips past the catcher and a runner advances to the next base.',
    categoryColor: 'pitch',
  },
  balk: {
    code: 'balk',
    mode: 'pitching',
    shortLabel: 'BK',
    fullLabel: 'Balk',
    description: 'An illegal pitching motion is ruled a balk and runners advance. Apply the league rules in use.',
    example: 'The pitcher starts a delivery without coming to a legal stop, and the umpire calls a balk.',
    categoryColor: 'pitch',
  },
  pitchBall: {
    code: 'pitchBall',
    mode: 'pitching',
    shortLabel: 'BALL',
    fullLabel: 'Ball',
    description: 'Pitch thrown outside the strike zone that is not swung at.',
    example: 'Pitcher throws a fastball low and outside.',
    categoryColor: 'neutral',
  },
  pitchStrike: {
    code: 'pitchStrike',
    mode: 'pitching',
    shortLabel: 'STRIKE',
    fullLabel: 'Strike',
    description: 'Pitch inside the strike zone or swung at and missed.',
    example: 'Fastball over the heart of the plate or swing and miss.',
    categoryColor: 'pitch',
  },
  pitchFoul: {
    code: 'pitchFoul',
    mode: 'pitching',
    shortLabel: 'FOUL',
    fullLabel: 'Foul Ball',
    description: 'Pitch hit foul by the batter into out-of-play territory.',
    example: 'Batter fouls off a 2-strike curveball behind the plate.',
    categoryColor: 'pitch',
  },
  pitchOther: {
    code: 'pitchOther',
    mode: 'pitching',
    shortLabel: 'PITCH',
    fullLabel: 'Pitch',
    description: 'Pitch thrown in play or general pitch counter increment.',
    example: 'Ball put in play or pitch recorded.',
    categoryColor: 'pitch',
  },
  pickoffAttempt: {
    code: 'pickoffAttempt',
    mode: 'pitching',
    shortLabel: 'PICKOFF',
    fullLabel: 'Pickoff Attempt',
    description: 'Pitcher throws to base to keep runner close; runner safe (no pitch added).',
    example: 'Quick pickoff throw to first base; runner dives back safe.',
    categoryColor: 'neutral',
  },

  // Fielding (8 buttons)
  putout: {
    code: 'putout',
    mode: 'fielding',
    shortLabel: 'PO',
    fullLabel: 'Putout',
    description: 'Your player makes the direct out (catches a fly ball, tags a runner, or steps on the base for a force out).',
    example: 'Playing 1st base, catches the throw from shortstop to complete the out.',
    categoryColor: 'defense',
  },
  assist: {
    code: 'assist',
    mode: 'fielding',
    shortLabel: 'A',
    fullLabel: 'Assist',
    description: 'Your player fields the ball and throws or relays it to a teammate who records the putout.',
    example: 'Ground ball fielded at shortstop and thrown cleanly to first base.',
    categoryColor: 'defense',
  },
  error: {
    code: 'error',
    mode: 'fielding',
    shortLabel: 'E',
    fullLabel: 'Error',
    description: 'A fielding or throwing misplay that allows a batter or runner to advance. Use official scorer decision.',
    example: 'Routine ground ball bobbled or throw sails over the first baseman head.',
    categoryColor: 'out',
  },
  doublePlay: {
    code: 'doublePlay',
    mode: 'fielding',
    shortLabel: 'DP',
    fullLabel: 'Double play',
    description: 'Your player participates in recording two outs on the same continuous play.',
    example: 'Fields grounder at 2nd, steps on the bag and throws to 1st for the twin-killing.',
    categoryColor: 'defense',
  },
  triplePlay: {
    code: 'triplePlay',
    mode: 'fielding',
    shortLabel: 'TP',
    fullLabel: 'Triple play',
    description: 'Your player participates in recording three outs on one continuous play. Record any putout and assist separately.',
    example: 'The defense turns a line-drive triple play with your player recording an assist.',
    categoryColor: 'defense',
  },
  passedBall: {
    code: 'passedBall',
    mode: 'fielding',
    shortLabel: 'PB',
    fullLabel: 'Passed ball (Catcher)',
    description: 'A catchable pitch that the catcher fails to hold, allowing a runner to advance.',
    example: 'Only used when your player is playing catcher.',
    categoryColor: 'out',
  },
  catcherGloveDeadBall: {
    code: 'catcherGloveDeadBall',
    mode: 'fielding',
    shortLabel: 'DB',
    fullLabel: "Catcher's Glove — Dead Ball",
    description: "A pitched ball deflects off the catcher's glove and enters dead-ball territory; runners are awarded one base from the time the ball became dead.",
    example: 'A pitch glances off the catcher’s glove and rolls beyond the backstop boundary.',
    categoryColor: 'out',
  },
  caughtStealing: {
    code: 'caughtStealing',
    mode: 'fielding',
    shortLabel: 'CS',
    fullLabel: 'Caught stealing (Catcher)',
    description: 'Your catcher throws out an opponent trying to steal a base.',
    example: 'Catcher throws a strike to second base to gun down the runner.',
    categoryColor: 'defense',
  },
  stealAllowed: {
    code: 'stealAllowed',
    mode: 'fielding',
    shortLabel: 'SB',
    fullLabel: 'Steal allowed (Catcher)',
    description: 'An opponent successfully steals a base while your player is behind the plate.',
    example: 'Opponent runner steals second base on a pitch.',
    categoryColor: 'neutral',
  },
  catchersInterference: {
    code: 'catchersInterference',
    mode: 'fielding',
    shortLabel: 'CI',
    fullLabel: "Catcher's Interference",
    description: "The catcher interferes with the batter's swing or plate appearance.",
    example: "Catcher's glove contacts the bat during the swing; batter awarded first base.",
    categoryColor: 'out',
  },
  pickoff: {
    code: 'pickoff',
    mode: 'fielding',
    shortLabel: 'PK',
    fullLabel: 'Pickoff',
    description: 'Fielder or catcher picks off a baserunner leaning or straying off base.',
    example: 'Catcher snaps a throw to first base to pick off the runner.',
    categoryColor: 'defense',
  },
  droppedThirdStrike: {
    code: 'droppedThirdStrike',
    mode: 'fielding',
    shortLabel: 'D3S',
    fullLabel: 'Dropped 3rd Strike',
    description: 'Third strike is not cleanly held by the catcher.',
    example: 'Pitch in the dirt on strike three requires a throw to first.',
    categoryColor: 'neutral',
  },
  catcherObstruction: {
    code: 'catcherObstruction',
    mode: 'fielding',
    shortLabel: 'OBS',
    fullLabel: 'Catcher Obstruction',
    description: 'The catcher illegally hinders the batter or batter-runner; record this as a catcher event, not a pitching event.',
    example: 'The catcher obstructs the batter during the swing or play.',
    categoryColor: 'out',
  },
  catcherObstruction2: {
    code: 'catcherObstruction2',
    mode: 'fielding',
    shortLabel: 'OBS2',
    fullLabel: 'Catcher Obstruction (OBS2)',
    description: 'Record the second catcher-obstruction notation used by your scoring rules as a catcher event.',
    example: 'The scorer records an OBS2 catcher-obstruction event.',
    categoryColor: 'out',
  },
  pickoffCaughtStealing: {
    code: 'pickoffCaughtStealing',
    mode: 'fielding',
    shortLabel: 'POCS',
    fullLabel: 'Pickoff Caught Stealing',
    description: 'The catcher initiates a pickoff play and the runner is caught stealing and put out.',
    example: 'Catcher makes a pickoff attempt and the runner is tagged out.',
    categoryColor: 'defense',
  },
  defensiveIndifference: {
    code: 'defensiveIndifference',
    mode: 'fielding',
    shortLabel: 'DI',
    fullLabel: 'Defensive Indifference',
    description: 'The defense concedes an advancing runner without an attempted play or throw.',
    example: 'Late in the game with a large lead, defense allows runner to take second uncontested.',
    categoryColor: 'neutral',
  },
  outfieldAssist: {
    code: 'outfieldAssist',
    mode: 'fielding',
    shortLabel: 'OFA',
    fullLabel: 'Outfield Assist',
    description: 'Outfielder throws out a baserunner or assists in recording a putout from the outfield.',
    example: 'Right fielder guns down a runner attempting to advance from first to third.',
    categoryColor: 'defense',
  },
};

export const BATTING_PLAY_CODES: PlayCode[] = [
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
  'catchersInterference',
  'fieldersChoice',
  'groundedIntoDoublePlay',
  'rbi',
  'run',
  'stolenBase',
  'cs',
  'runnerAdvance',
  'runnerOut',
  'leftOnBase',
];

export const PITCHING_PLAY_CODES: PlayCode[] = [
  'pitchOut',
  'strikeout',
  'hitAllowed',
  'homeRunAllowed',
  'walkAllowed',
  'intentionalWalkAllowed',
  'hitBatter',
  'runAllowed',
  'earnedRun',
  'wildPitch',
  'balk',
  'pitchBall',
  'pitchStrike',
  'pitchFoul',
  'pitchOther',
];

export const FIELDING_PLAY_CODES: PlayCode[] = [
  'putout',
  'assist',
  'error',
  'doublePlay',
  'triplePlay',
  'passedBall',
  'caughtStealing',
  'stealAllowed',
  'catchersInterference',
  'pickoff',
  'droppedThirdStrike',
  'defensiveIndifference',
  'catcherObstruction',
  'catcherObstruction2',
  'pickoffCaughtStealing',
  'fieldersChoice',
  'outfieldAssist',
];

export const FIELDING_FC_DEF: PlayDefinition = {
  code: 'fieldersChoice',
  mode: 'fielding',
  shortLabel: 'FC',
  fullLabel: "Fielder's Choice",
  description: 'The infielder fields the ball and attempts to retire a lead runner rather than the batter.',
  example: 'Shortstop fields grounder and throws cleanly to second base for the force out on the runner.',
  categoryColor: 'defense',
};

export function getFieldingPlayDef(code: FieldingPlayCode): PlayDefinition {
  if (code === 'fieldersChoice') return FIELDING_FC_DEF;
  return PLAY_DEFINITIONS[code];
}

/**
 * Returns dynamic fielding buttons based on the active fielding position selection.
 * - All Positions (Universal Core): PO, A, E, DP, TP
 * - Catcher (C): Universal Core + PB, CS, SB, CI, PK, D3S, DI
 * - Infielders (1B, 2B, 3B, SS): Universal Core + FC
 * - Outfielders (LF, CF, RF): Universal Core + OFA
 * - Pitcher (P): Universal Core + PK
 */
export function getFieldingPlaysForPosition(position?: DefensivePosition): PlayDefinition[] {
  const coreCodes: FieldingPlayCode[] = ['putout', 'assist', 'error', 'doublePlay', 'triplePlay'];

  if (position === 'C') {
    const catcherCodes: FieldingPlayCode[] = [
      ...coreCodes,
      'passedBall',
      'catcherGloveDeadBall',
      'caughtStealing',
      'stealAllowed',
      'catchersInterference',
      'pickoff',
      'droppedThirdStrike',
      'defensiveIndifference',
      'catcherObstruction',
      'catcherObstruction2',
      'pickoffCaughtStealing',
    ];
    return [
      ...catcherCodes.map(getFieldingPlayDef),
      { ...PLAY_DEFINITIONS.wildPitch, mode: 'fielding' as const },
      { ...PLAY_DEFINITIONS.balk, mode: 'fielding' as const, description: 'Record a balk-related catcher event when the catcher leaves the catcher’s box before the pitch, according to the rules in use.' },
    ];
  }

  if (position === '1B' || position === '2B' || position === '3B' || position === 'SS') {
    const infieldCodes: FieldingPlayCode[] = [...coreCodes, 'fieldersChoice'];
    return infieldCodes.map(getFieldingPlayDef);
  }

  if (position === 'LF' || position === 'CF' || position === 'RF') {
    const outfieldCodes: FieldingPlayCode[] = [...coreCodes, 'outfieldAssist'];
    return outfieldCodes.map(getFieldingPlayDef);
  }

  if (position === 'P') {
    const pitcherCodes: FieldingPlayCode[] = [...coreCodes, 'pickoff'];
    return pitcherCodes.map(getFieldingPlayDef);
  }

  return coreCodes.map(getFieldingPlayDef);
}

export function getPlaysForMode(mode: PlayMode): PlayDefinition[] {
  if (mode === 'batting') {
    return BATTING_PLAY_CODES.map((code) => {
      if (code === 'catchersInterference') {
        return {
          ...PLAY_DEFINITIONS[code],
          mode: 'batting' as const,
          shortLabel: 'CI',
          fullLabel: "Catcher's Interference",
          description: "The batter is awarded first base after catcher interference; this is not an at-bat or hit.",
        };
      }
      return PLAY_DEFINITIONS[code];
    });
  }
  if (mode === 'pitching') {
    return PITCHING_PLAY_CODES.map((code) => {
      if (code === 'strikeout') {
        return {
          code: 'strikeout',
          mode: 'pitching',
          shortLabel: 'K',
          fullLabel: 'Strikeout (Pitcher)',
          description: 'Your pitcher strikes out the opponent batter (counts as an out too).',
          example: 'Strikes out the cleanup hitter on a filthy curveball.',
          categoryColor: 'pitch',
        };
      }
      return PLAY_DEFINITIONS[code];
    });
  }
  return FIELDING_PLAY_CODES.map((code) => {
    if (code === 'fieldersChoice') return FIELDING_FC_DEF;
    return PLAY_DEFINITIONS[code];
  });
}

export function getPlayLabel(code: PlayCode, mode?: PlayMode): string {
  if (mode === 'pitching') {
    if (code === 'strikeout') return 'Strikeout (Pitcher)';
    if (code === 'reachedOnError') return 'Batter reached on error';
    if (code === 'fieldersChoice') return "Fielder's choice (batter safe)";
    if (code === 'passedBall') return 'Passed ball (not charged)';
  }
  if (mode === 'fielding') {
    if (code === 'fieldersChoice') return "Fielder's Choice";
    if (code === 'catcherGloveDeadBall') return "Catcher's Glove — Dead Ball";
    if (code === 'catchersInterference') return "Catcher's Interference";
    if (code === 'pickoff') return 'Pickoff';
    if (code === 'droppedThirdStrike') return 'Dropped 3rd Strike';
    if (code === 'defensiveIndifference') return 'Defensive Indifference';
    if (code === 'outfieldAssist') return 'Outfield Assist';
  }
  return PLAY_DEFINITIONS[code]?.fullLabel || code;
}

export function getPlayShortLabel(code: PlayCode, mode?: PlayMode): string {
  if (mode === 'fielding') {
    if (code === 'fieldersChoice') return 'FC';
    if (code === 'catcherGloveDeadBall') return 'DB';
    if (code === 'outfieldAssist') return 'OFA';
    if (code === 'catchersInterference') return 'CI';
    if (code === 'pickoff') return 'PK';
    if (code === 'droppedThirdStrike') return 'D3S';
    if (code === 'defensiveIndifference') return 'DI';
  }
  return PLAY_DEFINITIONS[code]?.shortLabel || code;
}