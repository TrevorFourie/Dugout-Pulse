import {
  BattingStats,
  DefensivePosition,
  FieldingPositionStats,
  FieldingStats,
  Game,
  GroupedStats,
  LineupSpotStats,
  PitchingStats,
  Play,
} from '../types/baseball';

/**
 * Format a rate stat (AVG, OBP, SLG) to standard baseball 3-decimal string (e.g., .333, 1.000, .000)
 * Returns "—" if the value is null or NaN.
 */
export function formatRate(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return '—';
  }
  if (val >= 1) {
    return val.toFixed(3);
  }
  const formatted = val.toFixed(3);
  // Remove leading 0, e.g. 0.333 -> .333
  return formatted.startsWith('0') ? formatted.slice(1) : formatted;
}

/**
 * Format ERA or WHIP with 2 decimals (e.g. 2.50, 0.00) or "—" if undefined/infinite.
 */
export function formatEraWhip(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val) || !Number.isFinite(val)) {
    return '—';
  }
  return val.toFixed(2);
}

/**
 * Format innings pitched from total outs (e.g. 7 outs -> "2.1", 6 outs -> "2.0", 0 outs -> "0.0")
 */
export function formatInningsPitched(outs: number): string {
  const fullInnings = Math.floor(outs / 3);
  const remainder = outs % 3;
  return `${fullInnings}.${remainder}`;
}

/**
 * Calculate rest days required by USA Baseball / Pitch Smart / Little League standard:
 * 1-20: 0 days rest
 * 21-35: 1 day rest
 * 36-50: 2 days rest
 * 51-65: 3 days rest
 * 66+: 4 days rest
 */
export function calculateRestDays(pitches: number, gameDate?: string): {
  days: number;
  label: string;
  nextEligibleDate?: string;
} {
  let days = 0;
  if (pitches >= 66) {
    days = 4;
  } else if (pitches >= 51) {
    days = 3;
  } else if (pitches >= 36) {
    days = 2;
  } else if (pitches >= 21) {
    days = 1;
  } else {
    days = 0;
  }

  let nextEligibleDate: string | undefined = undefined;
  if (gameDate) {
    try {
      const parts = gameDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        // Next eligible day is game day + rest days + 1
        d.setDate(d.getDate() + days + 1);
        nextEligibleDate = d.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      }
    } catch {
      // Fallback
    }
  }

  const label =
    days === 0
      ? '0 Days (Eligible tomorrow)'
      : `${days} Day${days > 1 ? 's' : ''} Rest Required`;

  return { days, label, nextEligibleDate };
}

/**
 * Calculate batting stats from a collection of plays
 */
export function calculateBattingStats(plays: Play[], gameCount: number = 1): BattingStats {
  const battingPlays = plays.filter((p) => p.mode === 'batting');

  let singles = 0;
  let doubles = 0;
  let triples = 0;
  let hr = 0;
  let bb = 0;
  let ibb = 0;
  let hbp = 0;
  let so = 0;
  let out = 0;
  let sf = 0;
  let sh = 0;
  let roe = 0;
  let fc = 0;
  let gidp = 0;
  let rbi = 0;
  let r = 0;
  let sb = 0;
  let cs = 0;

  for (const play of battingPlays) {
    switch (play.code) {
      case 'single':
        singles++;
        break;
      case 'double':
        doubles++;
        break;
      case 'triple':
        triples++;
        break;
      case 'homeRun':
        hr++;
        break;
      case 'walk':
        bb++;
        break;
      case 'intentionalWalk':
        bb++;
        ibb++;
        break;
      case 'hbp':
        hbp++;
        break;
      case 'strikeout':
        so++;
        break;
      case 'out':
        out++;
        break;
      case 'sacFly':
        sf++;
        break;
      case 'sacBunt':
        sh++;
        break;
      case 'reachedOnError':
        roe++;
        break;
      case 'catchersInterference':
        // Catcher's interference awards first base but is not an at-bat or hit.
        break;
      case 'fieldersChoice':
        fc++;
        break;
      case 'groundedIntoDoublePlay':
        out++;
        gidp++;
        break;
      case 'rbi':
        rbi++;
        break;
      case 'run':
        r++;
        break;
      case 'stolenBase':
        sb++;
        break;
      case 'cs':
        cs++;
        break;
    }
  }

  const h = singles + doubles + triples + hr;
  const ab = h + so + out + roe + fc;
  const pa = ab + bb + hbp + sf + sh;
  const tb = singles + 2 * doubles + 3 * triples + 4 * hr;

  const avg = ab > 0 ? h / ab : null;
  const obpDenominator = ab + bb + hbp + sf;
  const obp = obpDenominator > 0 ? (h + bb + hbp) / obpDenominator : null;
  const slg = ab > 0 ? tb / ab : null;
  const ops = obp !== null && slg !== null ? obp + slg : null;

  return {
    games: gameCount,
    pa,
    ab,
    h,
    singles,
    doubles,
    triples,
    hr,
    rbi,
    r,
    bb,
    ibb,
    so,
    hbp,
    sf,
    sh,
    roe,
    fc,
    gidp,
    sb,
    cs,
    tb,
    avg,
    obp,
    slg,
    ops,
  };
}

/**
 * Calculate pitching stats from a collection of plays
 */
export function calculatePitchingStats(
  plays: Play[],
  gameCount: number = 1,
  inningsPerGame: number = 7,
  gameDate?: string
): PitchingStats {
  const pitchingPlays = plays.filter((p) => p.mode === 'pitching');

  let pitchOuts = 0;
  let strikeoutOuts = 0;
  let k = 0;
  let h = 0;
  let hr = 0;
  let bb = 0;
  let ibb = 0;
  let r = 0;
  let er = 0;
  let hbp = 0;
  let wp = 0;
  let bk = 0;
  let balls = 0;
  let strikes = 0;
  let explicitPitches = 0;
  let bf = 0; // batters faced
  let pickoffAttempts = 0;
  let pickoffOuts = 0;

  for (let i = 0; i < pitchingPlays.length; i++) {
    const play = pitchingPlays[i];
    const prevPlay = i > 0 ? pitchingPlays[i - 1] : null;

    switch (play.code) {
      case 'pickoffAttempt':
        pickoffAttempts++;
        break;
      case 'pitchOut':
        pitchOuts++;
        if (play.isExtraOut) {
          if (play.pickoffKind === 'pickoff') {
            pickoffAttempts++;
            pickoffOuts++;
          }
        } else {
          explicitPitches++;
          strikes++;
          bf++;
        }
        break;
      case 'strikeout': {
        k++;
        bf++;
        if (!play.droppedThirdStrikeSafe) {
          strikeoutOuts++;
        }
        const isAutoStrikeout =
          play.autoOutcome ||
          (prevPlay?.code === 'pitchStrike' &&
            Math.abs((play.timestamp || 0) - (prevPlay.timestamp || 0)) < 150) ||
          (prevPlay?.code === 'wildPitch' &&
            Math.abs((play.timestamp || 0) - (prevPlay.timestamp || 0)) < 150);
        if (!isAutoStrikeout) {
          explicitPitches++;
          strikes++;
        }
        break;
      }
      case 'hitAllowed':
        h++;
        bf++;
        explicitPitches++;
        strikes++;
        break;
      case 'homeRunAllowed':
        h++;
        hr++;
        bf++;
        explicitPitches++;
        strikes++;
        break;
      // Ball put in play and the batter reached on a defensive error / fielder's choice.
      // These are real pitches (a strike) and a batter faced, but never a hit.
      case 'reachedOnError':
      case 'fieldersChoice':
        bf++;
        explicitPitches++;
        strikes++;
        break;
      case 'walkAllowed': {
        bb++;
        bf++;
        const isAutoWalk =
          play.autoOutcome ||
          (prevPlay?.code === 'pitchBall' &&
            Math.abs((play.timestamp || 0) - (prevPlay.timestamp || 0)) < 150) ||
          (prevPlay?.code === 'wildPitch' &&
            Math.abs((play.timestamp || 0) - (prevPlay.timestamp || 0)) < 150);
        if (!isAutoWalk) {
          explicitPitches++;
          balls++;
        }
        break;
      }
      case 'intentionalWalkAllowed':
        bb++;
        ibb++;
        bf++;
        break;
      case 'hitBatter':
        hbp++;
        bf++;
        explicitPitches++;
        balls++;
        break;
      case 'runAllowed':
        r++;
        break;
      case 'earnedRun':
        r++;
        er++;
        break;
      case 'wildPitch':
        wp++;
        // New pitching flow: the wild pitch itself is the pitch (+1 pitch, +1 ball or strike).
        // Older games have pitchCounted unset, so a separate Ball tap is not double counted.
        if (play.pitchCounted) {
          explicitPitches++;
          if (play.wildPitchPitchType === 'strike') {
            strikes++;
          } else {
            balls++;
          }
        }
        break;
      case 'passedBall':
        // Defensive fault: not charged to the pitcher, but the pitch still counts as a ball.
        explicitPitches++;
        balls++;
        break;
      case 'balk':
        bk++;
        break;
      case 'pitchBall':
        balls++;
        explicitPitches++;
        break;
      case 'pitchStrike':
      case 'pitchFoul':
        strikes++;
        explicitPitches++;
        break;
      case 'pitchOther':
        explicitPitches++;
        break;
    }
  }

  const totalOuts = pitchOuts + strikeoutOuts;
  const ipDecimal = totalOuts / 3;

  const era = ipDecimal > 0 ? (er * inningsPerGame) / ipDecimal : null;
  const whip = ipDecimal > 0 ? (h + bb) / ipDecimal : null;

  const pickoffSuccessRate =
    pickoffAttempts > 0 ? (pickoffOuts / pickoffAttempts) * 100 : null;

  const totalPitches = explicitPitches;
  const strikePercentage =
    totalPitches > 0 ? ((strikes / totalPitches) * 100) : null;

  const restInfo = calculateRestDays(totalPitches, gameDate);

  return {
    games: gameCount,
    outs: totalOuts,
    ipDisplay: formatInningsPitched(totalOuts),
    era,
    whip,
    k,
    h,
    hr,
    bb,
    ibb,
    r,
    er,
    hbp,
    wp,
    bk,
    pitchOuts,
    pickoffAttempts,
    pickoffOuts,
    pickoffSuccessRate,
    bf,
    pitches: totalPitches,
    balls,
    strikes,
    strikePercentage,
    restDaysRequired: restInfo.days,
    nextEligibleDate: restInfo.nextEligibleDate,
  };
}

/**
 * Calculate fielding stats from a collection of plays
 */
export function calculateFieldingStats(plays: Play[], gameCount: number = 1): FieldingStats {
  const fieldingPlays = plays.filter((p) => p.mode === 'fielding');

  let po = 0;
  let a = 0;
  let e = 0;
  let dp = 0;
  let tp = 0;
  let pb = 0;
  let cs = 0;
  let sbAllowed = 0;

  for (const play of fieldingPlays) {
    switch (play.code) {
      case 'putout':
        po++;
        break;
      case 'assist':
        a++;
        break;
      case 'error':
        e++;
        break;
      case 'doublePlay':
        dp++;
        break;
      case 'triplePlay':
        tp++;
        break;
      case 'passedBall':
        pb++;
        break;
      case 'caughtStealing':
        cs++;
        break;
      case 'stealAllowed':
        sbAllowed++;
        break;
      case 'outfieldAssist':
        a++;
        break;
      case 'fieldersChoice':
        a++;
        break;
      case 'catchersInterference':
        e++;
        break;
      case 'pickoff':
        po++;
        break;
      case 'droppedThirdStrike':
        pb++;
        break;
      case 'defensiveIndifference':
        break;
    }
  }

  const chances = po + a + e;
  const fpct = chances > 0 ? (po + a) / chances : null;

  return {
    games: gameCount,
    chances,
    po,
    a,
    e,
    dp,
    tp,
    pb,
    cs,
    sbAllowed,
    fpct,
  };
}

/**
 * Calculate batting splits vs RHP and vs LHP
 */
export function calculateBattingSplits(plays: Play[]) {
  const battingPlays = plays.filter((p) => p.mode === 'batting');
  // Plays tagged LHP vs RHP (untagged defaults to RHP)
  const playsVsRHP = battingPlays.filter((p) => !p.pitcherHand || p.pitcherHand === 'R');
  const playsVsLHP = battingPlays.filter((p) => p.pitcherHand === 'L');

  return {
    vsRHP: calculateBattingStats(playsVsRHP, 1),
    vsLHP: calculateBattingStats(playsVsLHP, 1),
  };
}

/**
 * Every position the player held in an inning, in order. Usually one; more when the player
 * switched positions part-way through the inning (e.g. CF then SS).
 */
export function getInningPositions(
  game: Pick<Game, 'fieldingPositions' | 'positionChanges'>,
  inning: number
): DefensivePosition[] {
  const changes = (game.positionChanges || [])
    .filter((c) => c.inning === inning)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (changes.length === 0) {
    const pos = game.fieldingPositions?.[inning];
    return pos ? [pos] : [];
  }
  const positions: DefensivePosition[] = [changes[0].from];
  for (const change of changes) {
    if (positions[positions.length - 1] !== change.to) positions.push(change.to);
  }
  return positions;
}

/**
 * Calculate fielding statistics broken down by defensive position
 */
export function calculateFieldingByPosition(games: Game[]): FieldingPositionStats[] {
  const positionMap = new Map<DefensivePosition, { innings: number; plays: Play[] }>();

  for (const game of games) {
    const fieldingPositions = game.fieldingPositions || {};
    // Track innings per position
    for (let inn = 1; inn <= game.innings; inn++) {
      // A mid-inning switch credits the inning to every position played in it
      for (const pos of new Set(getInningPositions(game, inn))) {
        if (pos && pos !== 'BENCH') {
          if (!positionMap.has(pos)) {
            positionMap.set(pos, { innings: 0, plays: [] });
          }
          positionMap.get(pos)!.innings += 1;
        }
      }
    }

    // Assign plays to position based on play.defensivePosition or inning position
    for (const play of game.plays) {
      if (play.mode === 'fielding') {
        const pos = play.defensivePosition || fieldingPositions[play.inning];
        if (pos && pos !== 'BENCH') {
          if (!positionMap.has(pos)) {
            positionMap.set(pos, { innings: 0, plays: [] });
          }
          positionMap.get(pos)!.plays.push(play);
        }
      }
    }
  }

  const results: FieldingPositionStats[] = [];
  positionMap.forEach((data, position) => {
    const stats = calculateFieldingStats(data.plays, 1);
    results.push({
      position,
      innings: data.innings,
      chances: stats.chances,
      po: stats.po,
      a: stats.a,
      e: stats.e,
      fpct: stats.fpct,
    });
  });

  // Sort by innings played descending
  return results.sort((a, b) => b.innings - a.innings);
}

/**
 * Calculate batting stats grouped by lineup spot (1-10)
 * Evaluates play-level lineup spot if order changed mid-game, falling back to game lineup spot
 */
export function calculateLineupStats(games: Game[], playerId?: string): LineupSpotStats[] {
  const filtered = playerId ? games.filter((g) => !g.playerId || g.playerId === playerId) : games;
  const spotMap = new Map<number, { plays: Play[]; gameIds: Set<string> }>();

  for (const game of filtered) {
    const battingPlays = game.plays.filter((p) => p.mode === 'batting');
    for (const play of battingPlays) {
      const spot = play.lineupSpot || game.lineupSpot;
      if (spot && spot >= 1 && spot <= 12) {
        if (!spotMap.has(spot)) {
          spotMap.set(spot, { plays: [], gameIds: new Set() });
        }
        const entry = spotMap.get(spot)!;
        entry.plays.push(play);
        entry.gameIds.add(game.id);
      }
    }
  }

  const results: LineupSpotStats[] = [];
  spotMap.forEach((entry, spot) => {
    results.push({
      spot,
      games: entry.gameIds.size,
      batting: calculateBattingStats(entry.plays, entry.gameIds.size),
    });
  });

  return results.sort((a, b) => a.spot - b.spot);
}

/**
 * Calculate full aggregated season stats across all saved games
 */
export function calculateSeasonStats(
  games: Game[],
  inningsPerGame: number = 7,
  playerId?: string
) {
  const filteredGames = playerId ? games.filter((g) => !g.playerId || g.playerId === playerId) : games;
  const allPlays = filteredGames.flatMap((g) => g.plays);
  const gameCount = filteredGames.length;

  const batting = calculateBattingStats(allPlays, gameCount);
  const pitching = calculatePitchingStats(allPlays, gameCount, inningsPerGame);
  const fielding = calculateFieldingStats(allPlays, gameCount);
  const splits = calculateBattingSplits(allPlays);
  const fieldingByPosition = calculateFieldingByPosition(filteredGames);
  const lineupStats = calculateLineupStats(filteredGames, playerId);

  // Last game hits
  let lastGameHits: number | null = null;
  if (filteredGames.length > 0) {
    const sorted = [...filteredGames].sort((a, b) => {
      const dateA = `${a.date} ${a.time || '00:00'}`;
      const dateB = `${b.date} ${b.time || '00:00'}`;
      return dateB.localeCompare(dateA); // newest first
    });
    const latestGame = sorted[0];
    const latestBatting = calculateBattingStats(latestGame.plays, 1);
    lastGameHits = latestBatting.h;
  }

  return {
    gameCount,
    batting,
    pitching,
    fielding,
    splits,
    fieldingByPosition,
    lineupStats,
    lastGameHits,
  };
}

/**
 * Calculate per-game box score stats
 */
export function calculateGameStats(game: Game, inningsPerGame: number = 7) {
  const batting = calculateBattingStats(game.plays, 1);
  const pitching = calculatePitchingStats(game.plays, 1, inningsPerGame, game.date);
  const fielding = calculateFieldingStats(game.plays, 1);
  const splits = calculateBattingSplits(game.plays);

  return {
    batting,
    pitching,
    fielding,
    splits,
  };
}

/**
 * Sort games by date then time (oldest first or newest first)
 */
export function sortGames(games: Game[], order: 'oldestFirst' | 'newestFirst' = 'oldestFirst'): Game[] {
  return [...games].sort((a, b) => {
    const timeA = a.time || '00:00';
    const timeB = b.time || '00:00';
    const dateCompA = `${a.date}T${timeA}`;
    const dateCompB = `${b.date}T${timeB}`;
    return order === 'oldestFirst'
      ? dateCompA.localeCompare(dateCompB)
      : dateCompB.localeCompare(dateCompA);
  });
}

export interface GameFilters {
  playerId?: string;
  teamName?: string;
  season?: string;
  tournament?: string;
  ageGroup?: string;
  searchQuery?: string;
}

/**
 * Filter games by player, team, season, tournament, age group, or search term
 */
export function filterGames(games: Game[], filters: GameFilters): Game[] {
  return games.filter((game) => {
    if (filters.playerId && game.playerId && game.playerId !== filters.playerId) {
      return false;
    }
    if (filters.teamName && filters.teamName !== 'ALL' && game.teamName !== filters.teamName) {
      return false;
    }
    if (filters.season && filters.season !== 'ALL' && (game.season || 'Unassigned') !== filters.season) {
      return false;
    }
    if (filters.ageGroup && filters.ageGroup !== 'ALL' && (game.ageGroup || 'Unassigned') !== filters.ageGroup) {
      return false;
    }
    if (filters.tournament && filters.tournament !== 'ALL') {
      if (filters.tournament === '__TOURNAMENTS_ONLY__') {
        if (!game.tournament || !game.tournament.trim()) return false;
      } else if (filters.tournament === '__LEAGUE_ONLY__') {
        if (game.tournament && game.tournament.trim()) return false;
      } else {
        const gameTourney = game.tournament?.trim() || 'Regular / League Games';
        if (gameTourney !== filters.tournament) return false;
      }
    }
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      const matchOpponent = game.opponent && game.opponent.toLowerCase().includes(q);
      const matchTeam = game.teamName && game.teamName.toLowerCase().includes(q);
      const matchTournament = game.tournament && game.tournament.toLowerCase().includes(q);
      const matchAge = game.ageGroup && game.ageGroup.toLowerCase().includes(q);
      const matchSeason = game.season && game.season.toLowerCase().includes(q);
      const matchDate = game.date.includes(q);
      if (!matchOpponent && !matchTeam && !matchTournament && !matchAge && !matchSeason && !matchDate) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Calculate grouped stats broken down by Tournament, Season, Age Group, or Team
 */
export function calculateGroupedStats(
  games: Game[],
  groupBy: 'tournament' | 'ageGroup' | 'season' | 'teamName',
  inningsPerGame: number = 7
): GroupedStats[] {
  const groupMap = new Map<string, Game[]>();

  for (const game of games) {
    let key = '';
    if (groupBy === 'tournament') {
      key = game.tournament?.trim() || 'Regular / League Games';
    } else if (groupBy === 'ageGroup') {
      key = game.ageGroup?.trim() || 'Unassigned Age Group';
    } else if (groupBy === 'season') {
      key = game.season?.trim() || 'Unassigned Season';
    } else if (groupBy === 'teamName') {
      key = game.teamName?.trim() || 'My Team';
    }

    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(game);
  }

  const results: GroupedStats[] = [];
  groupMap.forEach((groupGames, key) => {
    const gameCount = groupGames.length;
    const allPlays = groupGames.flatMap((g) => g.plays);
    results.push({
      groupKey: key,
      groupLabel: key,
      gameCount,
      batting: calculateBattingStats(allPlays, gameCount),
      pitching: calculatePitchingStats(allPlays, gameCount, inningsPerGame),
      fielding: calculateFieldingStats(allPlays, gameCount),
    });
  });

  // Sort by game count descending
  return results.sort((a, b) => b.gameCount - a.gameCount);
}