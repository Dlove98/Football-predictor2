// Source de données football-data.org (v4) - Football Predictor by DTech V3.0
//
// RÈGLE CRITIQUE ANTI-CACHE : chaque fetch utilise { cache: "no-store" }.
// Traçabilité des erreurs : safeFetchJson ne renvoie jamais une erreur muette,
// toute défaillance HTTP/réseau est journalisée via console.error.

import { cached } from "./cache";
import type {
  ApiHeadToHeadResponse,
  ApiMatch,
  ApiMatchesResponse,
  ApiStandingsResponse,
  ApiTeamMatchesResponse,
} from "./types";

const BASE_URL = "https://api.football-data.org/v4";

function getAuthHeaders(): HeadersInit {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  const headers: HeadersInit = { Accept: "application/json" };
  if (token) {
    headers["X-Auth-Token"] = token;
  } else {
    console.error(
      "[dataSources] FOOTBALL_DATA_API_KEY manquant : les requêtes vers football-data.org seront très probablement rejetées (401)."
    );
  }
  return headers;
}

/**
 * Fetch JSON de manière sûre, sans jamais avaler une erreur en silence.
 * Retourne `null` uniquement après avoir explicitement journalisé la cause.
 */
export async function safeFetchJson<T>(url: string, context: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: getAuthHeaders(), cache: "no-store" });
    if (!res.ok) {
      let body = "";
      try {
        body = await res.text();
      } catch {
        body = "<corps illisible>";
      }
      console.error(
        `[safeFetchJson] Échec HTTP ${res.status} (${res.statusText}) pour "${context}" -> ${url} :: ${body.slice(0, 400)}`
      );
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.error(`[safeFetchJson] Erreur réseau pour "${context}" -> ${url} ::`, error);
    return null;
  }
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}

/** Fenêtre brute de matchs entre deux dates (toutes compétitions souscrites). */
export async function fetchMatchesWindow(dateFrom: string, dateTo: string): Promise<ApiMatch[]> {
  const key = `matches-window:${dateFrom}:${dateTo}`;
  return cached(key, 90_000, async () => {
    const url = `${BASE_URL}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    const data = await safeFetchJson<ApiMatchesResponse>(url, `matches ${dateFrom}->${dateTo}`);
    return data?.matches ?? [];
  });
}

export interface DateWindowResult {
  matches: ApiMatch[];
  widened: boolean;
  radiusDays: number;
  effectiveFrom: string;
  effectiveTo: string;
}

/**
 * Récupère les matchs pour une date précise. Si l'API ne renvoie rien,
 * élargit progressivement la fenêtre (1, 3 puis 7 jours) pour ne jamais
 * laisser l'interface vide - sans jamais inventer de faux match.
 */
export async function fetchMatchesForDate(dateStr: string): Promise<DateWindowResult> {
  const exact = await fetchMatchesWindow(dateStr, dateStr);
  if (exact.length > 0) {
    return { matches: exact, widened: false, radiusDays: 0, effectiveFrom: dateStr, effectiveTo: dateStr };
  }

  const radiuses = [1, 3, 7];
  for (const radius of radiuses) {
    const from = addDays(dateStr, -radius);
    const to = addDays(dateStr, radius);
    const widened = await fetchMatchesWindow(from, to);
    if (widened.length > 0) {
      return { matches: widened, widened: true, radiusDays: radius, effectiveFrom: from, effectiveTo: to };
    }
  }

  return { matches: [], widened: true, radiusDays: 7, effectiveFrom: addDays(dateStr, -7), effectiveTo: addDays(dateStr, 7) };
}

/** Fenêtre élargie (congestion de calendrier) réutilisée pour la détection de rotation. */
export async function fetchCongestionWindow(dateStr: string): Promise<ApiMatch[]> {
  const from = addDays(dateStr, -3);
  const to = addDays(dateStr, 7);
  return fetchMatchesWindow(from, to);
}

export async function fetchStandings(competitionCode: string): Promise<ApiStandingsResponse | null> {
  const key = `standings:${competitionCode}`;
  return cached(key, 10 * 60_000, async () => {
    const url = `${BASE_URL}/competitions/${competitionCode}/standings`;
    return safeFetchJson<ApiStandingsResponse>(url, `standings ${competitionCode}`);
  });
}

export async function fetchMatchById(matchId: number): Promise<ApiMatch | null> {
  const key = `match:${matchId}`;
  return cached(key, 30_000, async () => {
    const url = `${BASE_URL}/matches/${matchId}`;
    return safeFetchJson<ApiMatch>(url, `match ${matchId}`);
  });
}

export async function fetchHeadToHead(matchId: number, limit = 10): Promise<ApiHeadToHeadResponse | null> {
  const key = `h2h:${matchId}:${limit}`;
  return cached(key, 5 * 60_000, async () => {
    const url = `${BASE_URL}/matches/${matchId}/head2head?limit=${limit}`;
    return safeFetchJson<ApiHeadToHeadResponse>(url, `head2head ${matchId}`);
  });
}

/**
 * Matchs d'une équipe sur une large fenêtre (passé récent pour la forme,
 * futur proche pour la détection de congestion de calendrier / turn-over).
 */
export async function fetchTeamMatches(teamId: number, dateFrom: string, dateTo: string): Promise<ApiMatch[]> {
  const key = `team-matches:${teamId}:${dateFrom}:${dateTo}`;
  return cached(key, 5 * 60_000, async () => {
    const url = `${BASE_URL}/teams/${teamId}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&limit=25`;
    const data = await safeFetchJson<ApiTeamMatchesResponse>(url, `team matches ${teamId}`);
    return data?.matches ?? [];
  });
}

export { addDays, toDateStr };
