// Pondération par niveau de championnat (League Strength Factor)
// Utilisé pour amortir les écarts statistiques bruts des ligues mineures et
// éviter d'attribuer des xG irréalistes à une équipe sur-performante dans un
// championnat de second plan face à un cador européen.

export const LEAGUE_STRENGTH: Record<string, number> = {
  CL: 1.1, // UEFA Champions League
  WC: 1.08, // Coupe du Monde
  EC: 1.06, // Euro
  PL: 1.05, // Premier League
  PD: 1.05, // La Liga
  BL1: 1.03, // Bundesliga
  SA: 1.03, // Serie A
  FL1: 1.0, // Ligue 1
  DED: 0.9, // Eredivisie
  PPL: 0.88, // Primeira Liga
  BSA: 0.85, // Brasileirão
  ELC: 0.85, // Championship
};

export function getLeagueStrength(code?: string | null): number {
  if (!code) return 0.8;
  return LEAGUE_STRENGTH[code] ?? 0.8;
}

// Facteur d'amortissement utilisé pour réduire les écarts par rapport à la
// moyenne de la ligue pour les compétitions mineures (moins fiables
// statistiquement / niveau plus hétérogène).
export function getDampingFactor(code?: string | null): number {
  const strength = getLeagueStrength(code);
  return Math.min(1.05, Math.max(0.72, strength));
}

export const COMPETITION_ORDER = [
  "CL",
  "PL",
  "PD",
  "BL1",
  "SA",
  "FL1",
  "DED",
  "PPL",
  "ELC",
  "BSA",
  "WC",
  "EC",
];

export function competitionSortIndex(code?: string | null): number {
  if (!code) return COMPETITION_ORDER.length + 1;
  const idx = COMPETITION_ORDER.indexOf(code);
  return idx === -1 ? COMPETITION_ORDER.length : idx;
}
