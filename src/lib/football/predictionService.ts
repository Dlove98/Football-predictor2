// Orchestration : combine dataSources + scoringEngine + intelligence
// contextuelle (module 6) pour produire les prédictions exploitées par l'UI.

import {
  fetchCongestionWindow,
  fetchHeadToHead,
  fetchMatchById,
  fetchMatchesForDate,
  fetchStandings,
  fetchTeamMatches,
} from "./dataSources";
import { competitionSortIndex, getDampingFactor, getLeagueStrength } from "./leagueStrength";
import {
  evaluateTrend,
  predictMatch,
  type ContextModifiers,
  type LeagueAverages,
  type TeamVenueStats,
} from "./scoringEngine";
import type {
  ApiMatch,
  ApiStandingsResponse,
  ApiTeam,
  CompetitionGroup,
  DailyCombo,
  DetailedMatchAnalysis,
  MatchWithPrediction,
  StandingBlock,
  StandingRow,
  TeamFormEntry,
  VerificationResult,
} from "./types";

function shortName(team: ApiTeam): string {
  return team.shortName ?? team.tla ?? team.name;
}

function findStandingsBlock(standings: ApiStandingsResponse | null, type: StandingBlock["type"]): StandingBlock | undefined {
  return standings?.standings.find((b) => b.type === type);
}

function findTeamRow(standings: ApiStandingsResponse | null, teamId: number, type: StandingBlock["type"]): StandingRow | null {
  const block = findStandingsBlock(standings, type);
  if (!block) return null;
  return block.table.find((r) => r.team.id === teamId) ?? null;
}

export function getTeamVenueStats(
  standings: ApiStandingsResponse | null,
  teamId: number,
  venue: "HOME" | "AWAY"
): TeamVenueStats {
  const venueRow = findTeamRow(standings, teamId, venue);
  if (venueRow && venueRow.playedGames > 0) {
    return {
      goalsForPerGame: venueRow.goalsFor / venueRow.playedGames,
      goalsAgainstPerGame: venueRow.goalsAgainst / venueRow.playedGames,
      playedGames: venueRow.playedGames,
      isFallback: false,
    };
  }
  const totalRow = findTeamRow(standings, teamId, "TOTAL");
  if (totalRow && totalRow.playedGames > 0) {
    const forAdj = venue === "HOME" ? 1.1 : 0.9;
    const againstAdj = venue === "HOME" ? 0.9 : 1.1;
    return {
      goalsForPerGame: (totalRow.goalsFor / totalRow.playedGames) * forAdj,
      goalsAgainstPerGame: (totalRow.goalsAgainst / totalRow.playedGames) * againstAdj,
      playedGames: totalRow.playedGames,
      isFallback: true,
    };
  }
  return { goalsForPerGame: 1.3, goalsAgainstPerGame: 1.25, playedGames: 0, isFallback: true };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function getLeagueAverages(standings: ApiStandingsResponse | null): LeagueAverages {
  const fallback: LeagueAverages = { avgHomeGoalsFor: 1.45, avgAwayGoalsFor: 1.15 };
  if (!standings) return fallback;

  const homeBlock = findStandingsBlock(standings, "HOME");
  const awayBlock = findStandingsBlock(standings, "AWAY");
  if (homeBlock && awayBlock && homeBlock.table.length && awayBlock.table.length) {
    const homeAvg = average(homeBlock.table.filter((r) => r.playedGames > 0).map((r) => r.goalsFor / r.playedGames));
    const awayAvg = average(awayBlock.table.filter((r) => r.playedGames > 0).map((r) => r.goalsFor / r.playedGames));
    if (homeAvg && awayAvg) return { avgHomeGoalsFor: homeAvg, avgAwayGoalsFor: awayAvg };
  }

  const totalBlock = findStandingsBlock(standings, "TOTAL");
  if (totalBlock && totalBlock.table.length) {
    const totalAvg = average(totalBlock.table.filter((r) => r.playedGames > 0).map((r) => r.goalsFor / r.playedGames));
    if (totalAvg) return { avgHomeGoalsFor: totalAvg * 1.12, avgAwayGoalsFor: totalAvg * 0.88 };
  }

  return fallback;
}

interface FixtureInfo {
  matchId: number;
  date: string;
  competitionCode: string;
  strength: number;
}

function buildTeamFixtureMap(matches: ApiMatch[]): Map<number, FixtureInfo[]> {
  const map = new Map<number, FixtureInfo[]>();
  for (const m of matches) {
    const info: FixtureInfo = {
      matchId: m.id,
      date: m.utcDate,
      competitionCode: m.competition.code,
      strength: getLeagueStrength(m.competition.code),
    };
    for (const teamId of [m.homeTeam.id, m.awayTeam.id]) {
      const list = map.get(teamId) ?? [];
      list.push(info);
      map.set(teamId, list);
    }
  }
  return map;
}

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

function detectRotationRisk(
  teamId: number,
  currentMatchId: number,
  currentDate: string,
  currentStrength: number,
  fixtureMap: Map<number, FixtureInfo[]>
): { risk: boolean; note: string | null } {
  const fixtures = fixtureMap.get(teamId) ?? [];
  for (const f of fixtures) {
    if (f.matchId === currentMatchId) continue;
    const gap = daysBetween(f.date, currentDate);
    if (gap > 0 && gap <= 4 && f.strength - currentStrength >= 0.15) {
      return {
        risk: true,
        note: `Calendrier chargé : échéance plus importante (${f.competitionCode}) à ${Math.round(gap)}j — rotation d'effectif probable.`,
      };
    }
  }
  return { risk: false, note: null };
}

function detectStakes(
  teamId: number,
  standings: ApiStandingsResponse | null,
  fixtureMap: Map<number, FixtureInfo[]>,
  currentDate: string
): { factor: number; note: string | null } {
  const totalBlock = findStandingsBlock(standings, "TOTAL");
  const totalRow = findTeamRow(standings, teamId, "TOTAL");
  if (!totalBlock || !totalRow || totalBlock.table.length < 4) return { factor: 1, note: null };

  const sorted = [...totalBlock.table].sort((a, b) => a.position - b.position);

  if (totalRow.position === 1) {
    const second = sorted[1];
    const gap = second ? totalRow.points - second.points : 0;
    if (gap >= 10) {
      const fixtures = fixtureMap.get(teamId) ?? [];
      const hasBigMatchSoon = fixtures.some((f) => {
        const gapDays = daysBetween(f.date, currentDate);
        return f.strength >= 1.05 && gapDays > 0 && gapDays <= 7;
      });
      if (hasBigMatchSoon) {
        return {
          factor: 0.85,
          note: `Leader avec large avance (+${gap} pts), gestion d'effectif probable avant une échéance européenne.`,
        };
      }
    }
  }

  if (totalRow.position >= sorted.length - 2) {
    return { factor: 1.04, note: "Bas de tableau : match à enjeu direct pour le maintien." };
  }

  return { factor: 1, note: null };
}

function buildMatchContext(params: {
  homeTeamId: number;
  awayTeamId: number;
  competitionCode: string;
  matchId: number;
  matchDate: string;
  standings: ApiStandingsResponse | null;
  fixtureMap: Map<number, FixtureInfo[]>;
}): ContextModifiers {
  const currentStrength = getLeagueStrength(params.competitionCode);
  const rotHome = detectRotationRisk(params.homeTeamId, params.matchId, params.matchDate, currentStrength, params.fixtureMap);
  const rotAway = detectRotationRisk(params.awayTeamId, params.matchId, params.matchDate, currentStrength, params.fixtureMap);
  const stakesHome = detectStakes(params.homeTeamId, params.standings, params.fixtureMap, params.matchDate);
  const stakesAway = detectStakes(params.awayTeamId, params.standings, params.fixtureMap, params.matchDate);

  const notes: string[] = [];
  let homeAttackFactor = 1;
  let awayAttackFactor = 1;
  const homeDefenseFactor = 1;
  const awayDefenseFactor = 1;

  if (rotHome.risk && rotHome.note) {
    homeAttackFactor *= 0.9;
    notes.push(`Domicile — ${rotHome.note}`);
  }
  if (rotAway.risk && rotAway.note) {
    awayAttackFactor *= 0.9;
    notes.push(`Extérieur — ${rotAway.note}`);
  }
  if (stakesHome.factor !== 1 && stakesHome.note) {
    homeAttackFactor *= stakesHome.factor;
    notes.push(`Domicile — ${stakesHome.note}`);
  }
  if (stakesAway.factor !== 1 && stakesAway.note) {
    awayAttackFactor *= stakesAway.factor;
    notes.push(`Extérieur — ${stakesAway.note}`);
  }

  return {
    homeAttackFactor,
    awayAttackFactor,
    homeDefenseFactor,
    awayDefenseFactor,
    notes,
    rotationRisk: { home: rotHome.risk, away: rotAway.risk },
    stakesNote: stakesHome.note ?? stakesAway.note ?? null,
  };
}

function buildVerification(match: ApiMatch, prediction: ReturnType<typeof predictMatch>): VerificationResult {
  if (match.status !== "FINISHED" || match.score.fullTime.home == null || match.score.fullTime.away == null) {
    return { evaluated: false };
  }
  const homeGoals = match.score.fullTime.home;
  const awayGoals = match.score.fullTime.away;
  const outcome = homeGoals > awayGoals ? "HOME" : homeGoals < awayGoals ? "AWAY" : "DRAW";
  const outcomeHit = prediction.outcome1x2.pick === outcome;
  const scoreExactHit = prediction.scoreExact.home === homeGoals && prediction.scoreExact.away === awayGoals;
  const mainTrendHit = evaluateTrend(prediction.mainTrend.conditions, { homeGoals, awayGoals });
  return { evaluated: true, outcomeHit, scoreExactHit, mainTrendHit, finalScore: { home: homeGoals, away: awayGoals } };
}

function buildPredictionForMatch(
  match: ApiMatch,
  standings: ApiStandingsResponse | null,
  fixtureMap: Map<number, FixtureInfo[]>
): MatchWithPrediction {
  const homeStats = getTeamVenueStats(standings, match.homeTeam.id, "HOME");
  const awayStats = getTeamVenueStats(standings, match.awayTeam.id, "AWAY");
  const league = getLeagueAverages(standings);
  const context = buildMatchContext({
    homeTeamId: match.homeTeam.id,
    awayTeamId: match.awayTeam.id,
    competitionCode: match.competition.code,
    matchId: match.id,
    matchDate: match.utcDate,
    standings,
    fixtureMap,
  });
  const prediction = predictMatch({
    home: homeStats,
    away: awayStats,
    league,
    competitionCode: match.competition.code,
    context,
    homeShortName: shortName(match.homeTeam),
    awayShortName: shortName(match.awayTeam),
  });
  const verification = buildVerification(match, prediction);
  return { match, prediction, verification };
}

export interface DayPredictionsResult {
  competitions: CompetitionGroup[];
  widened: boolean;
  radiusDays: number;
  effectiveFrom: string;
  effectiveTo: string;
  isEmpty: boolean;
}

export async function buildDayPredictions(dateStr: string): Promise<DayPredictionsResult> {
  const { matches, widened, radiusDays, effectiveFrom, effectiveTo } = await fetchMatchesForDate(dateStr);

  if (matches.length === 0) {
    return { competitions: [], widened, radiusDays, effectiveFrom, effectiveTo, isEmpty: true };
  }

  const congestionMatches = await fetchCongestionWindow(dateStr);
  const fixtureMap = buildTeamFixtureMap([...matches, ...congestionMatches]);

  const competitionCodes = Array.from(new Set(matches.map((m) => m.competition.code)));
  const standingsByCode = new Map<string, ApiStandingsResponse | null>();
  await Promise.all(
    competitionCodes.map(async (code) => {
      standingsByCode.set(code, await fetchStandings(code));
    })
  );

  const withPredictions = matches.map((match) =>
    buildPredictionForMatch(match, standingsByCode.get(match.competition.code) ?? null, fixtureMap)
  );

  const groups = new Map<number, CompetitionGroup>();
  for (const item of withPredictions) {
    const compId = item.match.competition.id;
    const existing = groups.get(compId);
    if (existing) {
      existing.matches.push(item);
    } else {
      groups.set(compId, { competition: item.match.competition, matches: [item] });
    }
  }
  for (const group of groups.values()) {
    group.matches.sort((a, b) => new Date(a.match.utcDate).getTime() - new Date(b.match.utcDate).getTime());
  }

  const competitions = Array.from(groups.values()).sort(
    (a, b) => competitionSortIndex(a.competition.code) - competitionSortIndex(b.competition.code)
  );

  return { competitions, widened, radiusDays, effectiveFrom, effectiveTo, isEmpty: false };
}

export async function buildDailyCombo(dateStr: string, minSelections = 13): Promise<DailyCombo> {
  const { competitions } = await buildDayPredictions(dateStr);
  const all = competitions.flatMap((c) => c.matches);

  const ranked = [...all].sort(
    (a, b) => b.prediction.mainTrend.probability * b.prediction.confidence - a.prediction.mainTrend.probability * a.prediction.confidence
  );

  const targetCount = ranked.length >= minSelections ? minSelections : ranked.length;
  const chosen = ranked.slice(0, targetCount);

  const selections = chosen.map((item) => ({
    matchId: item.match.id,
    homeTeam: item.match.homeTeam.name,
    awayTeam: item.match.awayTeam.name,
    competition: item.match.competition.name,
    utcDate: item.match.utcDate,
    status: item.match.status,
    pickLabel: item.prediction.mainTrend.label,
    probability: item.prediction.mainTrend.probability,
    estimatedOdds: item.prediction.mainTrend.estimatedOdds,
    confidence: item.prediction.confidence,
    verification: item.verification,
  }));

  const totalOdds = selections.reduce((acc, s) => acc * s.estimatedOdds, 1);
  const averageConfidence = selections.length
    ? Math.round(selections.reduce((acc, s) => acc + s.confidence, 0) / selections.length)
    : 0;

  let status: DailyCombo["status"] = "PENDING";
  if (selections.length > 0) {
    const anyLost = selections.some((s) => s.verification.evaluated && s.verification.mainTrendHit === false);
    const allEvaluated = selections.every((s) => s.verification.evaluated);
    const anyEvaluated = selections.some((s) => s.verification.evaluated);
    if (anyLost) status = "LOST";
    else if (allEvaluated) status = "WON";
    else if (anyEvaluated) status = "PARTIAL";
    else status = "PENDING";
  }

  return {
    date: dateStr,
    selections,
    totalOdds: Math.round(totalOdds * 100) / 100,
    averageConfidence,
    status,
    requestedMinimum: minSelections,
  };
}

function resultFor(goalsFor: number, goalsAgainst: number): "W" | "D" | "L" {
  if (goalsFor > goalsAgainst) return "W";
  if (goalsFor < goalsAgainst) return "L";
  return "D";
}

async function buildFormForTeam(teamId: number, beforeDate: string): Promise<TeamFormEntry[]> {
  const from = new Date(beforeDate);
  from.setUTCDate(from.getUTCDate() - 60);
  const to = new Date(beforeDate);
  to.setUTCDate(to.getUTCDate() + 7);
  const matches = await fetchTeamMatches(teamId, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));

  return matches
    .filter((m) => m.status === "FINISHED" && m.score.fullTime.home != null && m.score.fullTime.away != null)
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, 5)
    .map((m) => {
      const isHome = m.homeTeam.id === teamId;
      const goalsFor = (isHome ? m.score.fullTime.home : m.score.fullTime.away) ?? 0;
      const goalsAgainst = (isHome ? m.score.fullTime.away : m.score.fullTime.home) ?? 0;
      return {
        matchId: m.id,
        utcDate: m.utcDate,
        competition: m.competition.name,
        opponent: isHome ? m.awayTeam.name : m.homeTeam.name,
        venue: isHome ? "HOME" : "AWAY",
        goalsFor,
        goalsAgainst,
        result: resultFor(goalsFor, goalsAgainst),
      } satisfies TeamFormEntry;
    });
}

export async function buildDetailedAnalysis(matchId: number): Promise<DetailedMatchAnalysis | null> {
  const match = await fetchMatchById(matchId);
  if (!match) return null;

  const dateStr = match.utcDate.slice(0, 10);

  const [dayData, h2h, standings, homeForm, awayForm] = await Promise.all([
    buildDayPredictions(dateStr),
    fetchHeadToHead(matchId, 8),
    fetchStandings(match.competition.code),
    buildFormForTeam(match.homeTeam.id, dateStr),
    buildFormForTeam(match.awayTeam.id, dateStr),
  ]);

  let prediction: MatchWithPrediction["prediction"] | null = null;
  let verification: VerificationResult = { evaluated: false };
  for (const group of dayData.competitions) {
    const found = group.matches.find((m) => m.match.id === matchId);
    if (found) {
      prediction = found.prediction;
      verification = found.verification;
      break;
    }
  }

  if (!prediction) {
    const congestionMatches = await fetchCongestionWindow(dateStr);
    const fixtureMap = buildTeamFixtureMap(congestionMatches.length ? congestionMatches : [match]);
    const built = buildPredictionForMatch(match, standings, fixtureMap);
    prediction = built.prediction;
    verification = built.verification;
  }

  const homeStats = getTeamVenueStats(standings, match.homeTeam.id, "HOME");
  const awayStats = getTeamVenueStats(standings, match.awayTeam.id, "AWAY");
  const damping = getDampingFactor(match.competition.code);
  const league = getLeagueAverages(standings);

  const attackIndexHome = league.avgHomeGoalsFor > 0 ? 1 + (homeStats.goalsForPerGame / league.avgHomeGoalsFor - 1) * damping : 1;
  const attackIndexAway = league.avgAwayGoalsFor > 0 ? 1 + (awayStats.goalsForPerGame / league.avgAwayGoalsFor - 1) * damping : 1;
  const defenseIndexHome = league.avgAwayGoalsFor > 0 ? 1 + (homeStats.goalsAgainstPerGame / league.avgAwayGoalsFor - 1) * damping : 1;
  const defenseIndexAway = league.avgHomeGoalsFor > 0 ? 1 + (awayStats.goalsAgainstPerGame / league.avgHomeGoalsFor - 1) * damping : 1;

  const h2hMatches = h2h?.matches ?? [];
  const totalGoals = h2h?.aggregates?.totalGoals ?? 0;
  const numberOfMatches = h2h?.aggregates?.numberOfMatches ?? h2hMatches.length;

  return {
    match,
    prediction,
    verification,
    headToHead: {
      numberOfMatches,
      homeWins: h2h?.aggregates?.homeTeam?.wins ?? 0,
      draws: h2h?.aggregates?.homeTeam?.draws ?? 0,
      awayWins: h2h?.aggregates?.awayTeam?.wins ?? 0,
      averageGoals: numberOfMatches > 0 ? Math.round((totalGoals / numberOfMatches) * 100) / 100 : 0,
      recent: h2hMatches.slice(0, 6).map((m) => ({
        utcDate: m.utcDate,
        home: m.homeTeam.name,
        away: m.awayTeam.name,
        score: `${m.score.fullTime.home ?? "-"}-${m.score.fullTime.away ?? "-"}`,
      })),
    },
    form: { home: homeForm, away: awayForm },
    stats: {
      home: {
        attackIndex: Math.round(attackIndexHome * 100) / 100,
        defenseIndex: Math.round(defenseIndexHome * 100) / 100,
        avgGoalsFor: Math.round(homeStats.goalsForPerGame * 100) / 100,
        avgGoalsAgainst: Math.round(homeStats.goalsAgainstPerGame * 100) / 100,
        playedGames: homeStats.playedGames,
      },
      away: {
        attackIndex: Math.round(attackIndexAway * 100) / 100,
        defenseIndex: Math.round(defenseIndexAway * 100) / 100,
        avgGoalsFor: Math.round(awayStats.goalsForPerGame * 100) / 100,
        avgGoalsAgainst: Math.round(awayStats.goalsAgainstPerGame * 100) / 100,
        playedGames: awayStats.playedGames,
      },
    },
  };
}
