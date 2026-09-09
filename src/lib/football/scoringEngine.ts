// Moteur statistique (loi de Poisson) - Football Predictor by DTech V3.0
// Fonctions pures : aucune dépendance réseau ici.

import { getDampingFactor } from "./leagueStrength";
import type { MainTrend, MatchContext, MatchPrediction, Outcome1x2, ScoreCell, TrendCondition } from "./types";

const MAX_GOALS = 6;

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.exp(-lambda) * lambda ** k) / factorial(k);
}

export function buildScoreMatrix(lambdaHome: number, lambdaAway: number, maxGoals: number = MAX_GOALS): number[][] {
  const homeProbs = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPmf(k, lambdaHome));
  const awayProbs = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPmf(k, lambdaAway));
  const matrix: number[][] = [];
  for (let i = 0; i <= maxGoals; i += 1) {
    matrix.push([]);
    for (let j = 0; j <= maxGoals; j += 1) {
      matrix[i][j] = homeProbs[i] * awayProbs[j];
    }
  }
  // Normalisation (la troncature à maxGoals laisse une masse résiduelle infime)
  const total = matrix.flat().reduce((a, b) => a + b, 0);
  if (total > 0 && total !== 1) {
    for (let i = 0; i <= maxGoals; i += 1) {
      for (let j = 0; j <= maxGoals; j += 1) {
        matrix[i][j] /= total;
      }
    }
  }
  return matrix;
}

function sumWhere(matrix: number[][], predicate: (home: number, away: number) => boolean): number {
  let sum = 0;
  for (let i = 0; i < matrix.length; i += 1) {
    for (let j = 0; j < matrix[i].length; j += 1) {
      if (predicate(i, j)) sum += matrix[i][j];
    }
  }
  return sum;
}

function outcomeOf(i: number, j: number): Outcome1x2 {
  if (i > j) return "HOME";
  if (i < j) return "AWAY";
  return "DRAW";
}

function conditionHolds(cond: TrendCondition, i: number, j: number): boolean {
  switch (cond.type) {
    case "OUTCOME":
      return outcomeOf(i, j) === cond.value;
    case "DOUBLE_CHANCE": {
      const outcome = outcomeOf(i, j);
      if (cond.value === "1X") return outcome !== "AWAY";
      if (cond.value === "X2") return outcome !== "HOME";
      return outcome !== "DRAW";
    }
    case "OVER":
      return i + j > cond.line;
    case "UNDER":
      return i + j < cond.line;
    case "BTTS":
      return cond.value ? i > 0 && j > 0 : !(i > 0 && j > 0);
    default:
      return false;
  }
}

function jointProbability(matrix: number[][], conditions: TrendCondition[]): number {
  return sumWhere(matrix, (i, j) => conditions.every((c) => conditionHolds(c, i, j)));
}

export function topScorelines(matrix: number[][], n = 5): ScoreCell[] {
  const cells: ScoreCell[] = [];
  for (let i = 0; i < matrix.length; i += 1) {
    for (let j = 0; j < matrix[i].length; j += 1) {
      cells.push({ home: i, away: j, probability: matrix[i][j] });
    }
  }
  return cells.sort((a, b) => b.probability - a.probability).slice(0, n);
}

function buildTrendCandidates(homeShort: string, awayShort: string): { conditions: TrendCondition[]; label: string }[] {
  return [
    { conditions: [{ type: "OUTCOME", value: "HOME" }, { type: "OVER", line: 1.5 }], label: `Victoire ${homeShort} + Plus de 1.5 but` },
    { conditions: [{ type: "OUTCOME", value: "AWAY" }, { type: "OVER", line: 1.5 }], label: `Victoire ${awayShort} + Plus de 1.5 but` },
    { conditions: [{ type: "OUTCOME", value: "HOME" }, { type: "BTTS", value: false }], label: `Victoire ${homeShort} & ${awayShort} ne marque pas` },
    { conditions: [{ type: "OUTCOME", value: "AWAY" }, { type: "BTTS", value: false }], label: `Victoire ${awayShort} & ${homeShort} ne marque pas` },
    { conditions: [{ type: "DOUBLE_CHANCE", value: "1X" }, { type: "UNDER", line: 2.5 }], label: `Double Chance ${homeShort} ou Nul + Moins de 2.5 buts` },
    { conditions: [{ type: "DOUBLE_CHANCE", value: "X2" }, { type: "UNDER", line: 2.5 }], label: `Double Chance Nul ou ${awayShort} + Moins de 2.5 buts` },
    { conditions: [{ type: "BTTS", value: true }, { type: "OVER", line: 2.5 }], label: `Les deux équipes marquent + Plus de 2.5 buts` },
    { conditions: [{ type: "OUTCOME", value: "HOME" }], label: `Victoire ${homeShort}` },
    { conditions: [{ type: "OUTCOME", value: "AWAY" }], label: `Victoire ${awayShort}` },
    { conditions: [{ type: "UNDER", line: 2.5 }], label: `Moins de 2.5 buts` },
    { conditions: [{ type: "OVER", line: 1.5 }], label: `Plus de 1.5 but` },
    { conditions: [{ type: "OUTCOME", value: "DRAW" }], label: `Match Nul` },
  ];
}

function estimateOdds(probability: number): number {
  const safe = Math.min(0.97, Math.max(0.03, probability));
  const margin = 1.07; // marge bookmaker simulée
  return Math.max(1.01, Math.round((margin / safe) * 100) / 100);
}

export interface TeamVenueStats {
  goalsForPerGame: number;
  goalsAgainstPerGame: number;
  playedGames: number;
  isFallback: boolean;
}

export interface LeagueAverages {
  avgHomeGoalsFor: number; // moyenne de buts marqués à domicile par match
  avgAwayGoalsFor: number; // moyenne de buts marqués à l'extérieur par match
}

export interface ContextModifiers {
  homeAttackFactor: number;
  awayAttackFactor: number;
  homeDefenseFactor: number;
  awayDefenseFactor: number;
  notes: string[];
  rotationRisk: { home: boolean; away: boolean };
  stakesNote: string | null;
}

export interface PredictMatchInput {
  home: TeamVenueStats;
  away: TeamVenueStats;
  league: LeagueAverages;
  competitionCode: string | null;
  context: ContextModifiers;
  homeShortName: string;
  awayShortName: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function predictMatch(input: PredictMatchInput): MatchPrediction {
  const damping = getDampingFactor(input.competitionCode);

  const rawAttackHome = input.league.avgHomeGoalsFor > 0 ? input.home.goalsForPerGame / input.league.avgHomeGoalsFor : 1;
  const rawAttackAway = input.league.avgAwayGoalsFor > 0 ? input.away.goalsForPerGame / input.league.avgAwayGoalsFor : 1;
  const rawDefenseHome = input.league.avgAwayGoalsFor > 0 ? input.home.goalsAgainstPerGame / input.league.avgAwayGoalsFor : 1;
  const rawDefenseAway = input.league.avgHomeGoalsFor > 0 ? input.away.goalsAgainstPerGame / input.league.avgHomeGoalsFor : 1;

  // Amortissement des écarts par rapport à la moyenne (1.0) pour les ligues
  // mineures : empêche les xG aberrants issus d'échantillons peu fiables.
  const dampen = (raw: number) => 1 + (raw - 1) * damping;

  let attackHome = dampen(rawAttackHome);
  let attackAway = dampen(rawAttackAway);
  const defenseHome = dampen(rawDefenseHome);
  const defenseAway = dampen(rawDefenseAway);

  // Application des modificateurs contextuels (rotation, enjeux de classement...)
  attackHome *= input.context.homeAttackFactor;
  attackAway *= input.context.awayAttackFactor;
  const defenseHomeAdj = defenseHome * input.context.homeDefenseFactor;
  const defenseAwayAdj = defenseAway * input.context.awayDefenseFactor;

  let lambdaHome = input.league.avgHomeGoalsFor * attackHome * defenseAwayAdj;
  let lambdaAway = input.league.avgAwayGoalsFor * attackAway * defenseHomeAdj;

  lambdaHome = clamp(lambdaHome, 0.15, 4.5);
  lambdaAway = clamp(lambdaAway, 0.15, 4.5);

  const matrix = buildScoreMatrix(lambdaHome, lambdaAway);

  const home1x2 = sumWhere(matrix, (i, j) => i > j);
  const draw1x2 = sumWhere(matrix, (i, j) => i === j);
  const away1x2 = sumWhere(matrix, (i, j) => i < j);

  const pick: Outcome1x2 = home1x2 >= draw1x2 && home1x2 >= away1x2 ? "HOME" : draw1x2 >= away1x2 ? "DRAW" : "AWAY";

  const overUnderLines = [1.5, 2.5, 3.5].map((line) => ({
    line,
    over: sumWhere(matrix, (i, j) => i + j > line),
    under: sumWhere(matrix, (i, j) => i + j < line),
  }));

  const bttsYes = sumWhere(matrix, (i, j) => i > 0 && j > 0);

  const scorelines = topScorelines(matrix, 5);
  const scoreExact = scorelines[0] ?? { home: 1, away: 1, probability: 0 };

  const candidates = buildTrendCandidates(input.homeShortName, input.awayShortName).map((c) => ({
    ...c,
    probability: jointProbability(matrix, c.conditions),
  }));
  candidates.sort((a, b) => b.probability - a.probability);
  const preferred = candidates.find((c) => c.probability >= 0.42) ?? candidates[0];

  const mainTrend: MainTrend = {
    label: preferred.label,
    probability: preferred.probability,
    conditions: preferred.conditions,
    estimatedOdds: estimateOdds(preferred.probability),
  };

  const sampleReliability = clamp(Math.min(input.home.playedGames, input.away.playedGames) / 12, 0.55, 1);
  const fallbackPenalty = (input.home.isFallback ? 1 : 0) + (input.away.isFallback ? 1 : 0);
  const contextPenalty = input.context.notes.length * 3 + fallbackPenalty * 6;
  const peak = Math.max(home1x2, draw1x2, away1x2);
  let confidence = (40 + peak * 55) * sampleReliability - contextPenalty;
  confidence = clamp(confidence, 32, 96);

  const context: MatchContext = {
    leagueStrength: damping,
    rotationRisk: input.context.rotationRisk,
    stakesNote: input.context.stakesNote,
    notes: input.context.notes,
  };

  return {
    outcome1x2: { home: home1x2, draw: draw1x2, away: away1x2, pick },
    doubleChance: {
      "1X": home1x2 + draw1x2,
      "12": home1x2 + away1x2,
      X2: draw1x2 + away1x2,
    },
    overUnder: overUnderLines,
    btts: { yes: bttsYes, no: 1 - bttsYes },
    scoreExact,
    topScorelines: scorelines,
    mainTrend,
    confidence: Math.round(confidence),
    lambdaHome: Math.round(lambdaHome * 100) / 100,
    lambdaAway: Math.round(lambdaAway * 100) / 100,
    context,
  };
}

export function evaluateTrend(conditions: TrendCondition[], actual: { homeGoals: number; awayGoals: number }): boolean {
  return conditions.every((c) => conditionHolds(c, actual.homeGoals, actual.awayGoals));
}
