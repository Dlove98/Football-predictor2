// Types partagés pour Football Predictor by DTech V3.0

export type MatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"
  | "AWARDED";

export interface ApiTeam {
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
}

export interface ApiCompetition {
  id: number;
  name: string;
  code: string;
  type?: string;
  emblem?: string | null;
}

export interface ApiScore {
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  duration?: string;
  fullTime: { home: number | null; away: number | null };
  halfTime?: { home: number | null; away: number | null };
}

export interface ApiMatch {
  id: number;
  utcDate: string;
  status: MatchStatus;
  matchday?: number | null;
  stage?: string | null;
  group?: string | null;
  lastUpdated?: string;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: ApiScore;
  competition: ApiCompetition;
  venue?: string | null;
}

export interface ApiMatchesResponse {
  count: number;
  filters?: Record<string, unknown>;
  resultSet?: { count: number; first?: string; last?: string; played?: number };
  matches: ApiMatch[];
}

export interface ApiHeadToHeadResponse {
  aggregates: {
    numberOfMatches: number;
    totalGoals: number;
    homeTeam: { id: number; name: string; wins: number; draws: number; losses: number };
    awayTeam: { id: number; name: string; wins: number; draws: number; losses: number };
  };
  matches: ApiMatch[];
}

export interface ApiTeamMatchesResponse {
  matches: ApiMatch[];
}

export interface StandingRow {
  position: number;
  team: ApiTeam;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form?: string | null;
}

export interface StandingBlock {
  stage: string;
  type: "TOTAL" | "HOME" | "AWAY";
  group?: string | null;
  table: StandingRow[];
}

export interface ApiStandingsResponse {
  competition: ApiCompetition;
  season?: { id: number; startDate: string; endDate: string; currentMatchday: number | null };
  standings: StandingBlock[];
}

// ---------- Modèle interne de prédiction ----------

export type Outcome1x2 = "HOME" | "DRAW" | "AWAY";

export type TrendCondition =
  | { type: "OUTCOME"; value: Outcome1x2 }
  | { type: "DOUBLE_CHANCE"; value: "1X" | "12" | "X2" }
  | { type: "OVER"; line: number }
  | { type: "UNDER"; line: number }
  | { type: "BTTS"; value: boolean };

export interface ScoreCell {
  home: number;
  away: number;
  probability: number;
}

export interface MainTrend {
  label: string;
  probability: number;
  conditions: TrendCondition[];
  estimatedOdds: number;
}

export interface MatchContext {
  leagueStrength: number;
  rotationRisk: { home: boolean; away: boolean };
  stakesNote: string | null;
  notes: string[];
}

export interface MatchPrediction {
  outcome1x2: { home: number; draw: number; away: number; pick: Outcome1x2 };
  doubleChance: { "1X": number; "12": number; X2: number };
  overUnder: { line: number; over: number; under: number }[];
  btts: { yes: number; no: number };
  scoreExact: ScoreCell;
  topScorelines: ScoreCell[];
  mainTrend: MainTrend;
  confidence: number;
  lambdaHome: number;
  lambdaAway: number;
  context: MatchContext;
}

export interface VerificationResult {
  evaluated: boolean;
  outcomeHit?: boolean;
  scoreExactHit?: boolean;
  mainTrendHit?: boolean;
  finalScore?: { home: number; away: number };
}

export interface MatchWithPrediction {
  match: ApiMatch;
  prediction: MatchPrediction;
  verification: VerificationResult;
}

export interface CompetitionGroup {
  competition: ApiCompetition;
  matches: MatchWithPrediction[];
}

export interface ComboSelection {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  utcDate: string;
  status: MatchStatus;
  pickLabel: string;
  probability: number;
  estimatedOdds: number;
  confidence: number;
  verification: VerificationResult;
}

export interface DailyCombo {
  date: string;
  selections: ComboSelection[];
  totalOdds: number;
  averageConfidence: number;
  status: "PENDING" | "WON" | "LOST" | "PARTIAL";
  requestedMinimum: number;
}

export interface TeamFormEntry {
  matchId: number;
  utcDate: string;
  competition: string;
  opponent: string;
  venue: "HOME" | "AWAY";
  goalsFor: number;
  goalsAgainst: number;
  result: "W" | "D" | "L";
}

export interface DetailedMatchAnalysis {
  match: ApiMatch;
  prediction: MatchPrediction;
  verification: VerificationResult;
  headToHead: {
    numberOfMatches: number;
    homeWins: number;
    draws: number;
    awayWins: number;
    averageGoals: number;
    recent: { utcDate: string; home: string; away: string; score: string }[];
  };
  form: { home: TeamFormEntry[]; away: TeamFormEntry[] };
  stats: {
    home: { attackIndex: number; defenseIndex: number; avgGoalsFor: number; avgGoalsAgainst: number; playedGames: number };
    away: { attackIndex: number; defenseIndex: number; avgGoalsFor: number; avgGoalsAgainst: number; playedGames: number };
  };
}
