"use client";

import { useEffect, useState } from "react";
import { formatFullDate, formatKickoffTime, percent, statusLabel } from "@/lib/football/format";
import type { DetailedMatchAnalysis } from "@/lib/football/types";

function ResultPill({ result }: { result: "W" | "D" | "L" }) {
  const styles = result === "W" ? "bg-emerald-500/20 text-emerald-400" : result === "L" ? "bg-red-500/20 text-red-400" : "bg-zinc-700 text-zinc-300";
  return <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${styles}`}>{result}</span>;
}

export default function MatchModal({ matchId, onClose }: { matchId: number; onClose: () => void }) {
  const [data, setData] = useState<DetailedMatchAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setData(null);
    fetch(`/api/match/${matchId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.ok) setData(json.analysis);
        else setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-5 py-4 backdrop-blur">
          <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-400">Analyse IA détaillée</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-400 hover:bg-zinc-900"
          >
            Fermer ✕
          </button>
        </div>

        {loading && <p className="p-8 text-center text-sm text-zinc-500">Chargement de l&apos;analyse…</p>}
        {!loading && error && <p className="p-8 text-center text-sm text-red-400">Impossible de charger cette analyse.</p>}

        {!loading && !error && data && (
          <div className="space-y-6 p-5 sm:p-6">
            <div>
              <p className="text-center text-xs capitalize text-zinc-500">{formatFullDate(data.match.utcDate)}</p>
              <div className="mt-3 grid grid-cols-3 items-center gap-2 text-center">
                <div className="flex flex-col items-center gap-2">
                  {data.match.homeTeam.crest ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.match.homeTeam.crest} alt={data.match.homeTeam.name} className="h-12 w-12 object-contain" />
                  ) : null}
                  <span className="text-sm font-bold text-white">{data.match.homeTeam.name}</span>
                </div>
                <div>
                  {data.match.status === "FINISHED" ? (
                    <p className="text-2xl font-black text-white">
                      {data.match.score.fullTime.home} - {data.match.score.fullTime.away}
                    </p>
                  ) : (
                    <p className="text-lg font-bold text-zinc-500">{formatKickoffTime(data.match.utcDate)}</p>
                  )}
                  <p className="mt-1 text-[11px] font-semibold uppercase text-zinc-500">{statusLabel(data.match.status)}</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  {data.match.awayTeam.crest ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.match.awayTeam.crest} alt={data.match.awayTeam.name} className="h-12 w-12 object-contain" />
                  ) : null}
                  <span className="text-sm font-bold text-white">{data.match.awayTeam.name}</span>
                </div>
              </div>
            </div>

            {(data.prediction.context.notes.length > 0 || data.prediction.context.stakesNote) && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-400">Contexte stratégique détecté</p>
                <ul className="mt-1.5 space-y-1 text-xs text-amber-100/80">
                  {data.prediction.context.notes.map((note, idx) => (
                    <li key={idx}>• {note}</li>
                  ))}
                  {data.prediction.context.notes.length === 0 && data.prediction.context.stakesNote && (
                    <li>• {data.prediction.context.stakesNote}</li>
                  )}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-[11px] uppercase text-zinc-500">Domicile</p>
                <p className="mt-1 text-lg font-black text-emerald-400">{percent(data.prediction.outcome1x2.home)}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-[11px] uppercase text-zinc-500">Nul</p>
                <p className="mt-1 text-lg font-black text-zinc-300">{percent(data.prediction.outcome1x2.draw)}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-[11px] uppercase text-zinc-500">Extérieur</p>
                <p className="mt-1 text-lg font-black text-blue-400">{percent(data.prediction.outcome1x2.away)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-400">Matrice des scores les plus probables</p>
              <div className="flex flex-wrap gap-2">
                {data.prediction.topScorelines.map((s, idx) => (
                  <span
                    key={idx}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                      idx === 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {s.home}-{s.away} · {percent(s.probability)}
                  </span>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400 sm:grid-cols-4">
                {data.prediction.overUnder.map((ou) => (
                  <div key={ou.line} className="rounded-lg bg-zinc-950/60 px-2 py-1.5">
                    <p>+{ou.line} buts : {percent(ou.over)}</p>
                    <p>-{ou.line} buts : {percent(ou.under)}</p>
                  </div>
                ))}
                <div className="rounded-lg bg-zinc-950/60 px-2 py-1.5">
                  <p>BTTS Oui : {percent(data.prediction.btts.yes)}</p>
                  <p>BTTS Non : {percent(data.prediction.btts.no)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(["home", "away"] as const).map((side) => (
                <div key={side} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                    {side === "home" ? data.match.homeTeam.shortName ?? "Domicile" : data.match.awayTeam.shortName ?? "Extérieur"}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-zinc-400">
                    <p>xG offensif estimé : <span className="font-bold text-white">{data.stats[side].attackIndex}</span></p>
                    <p>Indice défensif : <span className="font-bold text-white">{data.stats[side].defenseIndex}</span></p>
                    <p>Buts marqués/j : <span className="font-bold text-white">{data.stats[side].avgGoalsFor}</span></p>
                    <p>Buts encaissés/j : <span className="font-bold text-white">{data.stats[side].avgGoalsAgainst}</span></p>
                    <p>Matchs analysés : <span className="font-bold text-white">{data.stats[side].playedGames}</span></p>
                  </div>
                  {data.form[side].length > 0 && (
                    <div className="mt-3 flex gap-1.5">
                      {data.form[side]
                        .slice()
                        .reverse()
                        .map((f) => (
                          <ResultPill key={f.matchId} result={f.result} />
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Historique des confrontations (H2H)</p>
              {data.headToHead.numberOfMatches === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">Aucune confrontation directe récente disponible.</p>
              ) : (
                <>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-400">
                    <span>Victoires dom. : <b className="text-white">{data.headToHead.homeWins}</b></span>
                    <span>Nuls : <b className="text-white">{data.headToHead.draws}</b></span>
                    <span>Victoires ext. : <b className="text-white">{data.headToHead.awayWins}</b></span>
                    <span>Moy. buts/match : <b className="text-white">{data.headToHead.averageGoals}</b></span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {data.headToHead.recent.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-lg bg-zinc-950/50 px-2.5 py-1.5 text-xs text-zinc-400">
                        <span className="truncate pr-2">{m.home} vs {m.away}</span>
                        <span className="font-bold text-white">{m.score}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-400">Pronostic recommandé</p>
              <p className="mt-1 text-base font-bold text-white">{data.prediction.mainTrend.label}</p>
              <p className="mt-1 text-xs text-zinc-400">
                Probabilité estimée : {percent(data.prediction.mainTrend.probability)} · Cote estimée : {data.prediction.mainTrend.estimatedOdds.toFixed(2)} · Confiance : {data.prediction.confidence}%
              </p>
              {data.verification.evaluated && (
                <p className={`mt-2 text-xs font-bold ${data.verification.mainTrendHit ? "text-emerald-400" : "text-red-400"}`}>
                  Résultat réel : {data.verification.finalScore?.home}-{data.verification.finalScore?.away} —{" "}
                  {data.verification.mainTrendHit ? "Pronostic Validé ✔" : "Pronostic Perdu ✘"}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
