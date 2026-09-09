"use client";

import { formatKickoffTime, isLiveStatus, percent, statusLabel } from "@/lib/football/format";
import type { MatchWithPrediction } from "@/lib/football/types";

function TeamCrest({ crest, name }: { crest?: string | null; name: string }) {
  if (crest) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={crest} alt={name} className="h-9 w-9 object-contain drop-shadow" loading="lazy" />;
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-300">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function VerdictBadge({ item }: { item: MatchWithPrediction }) {
  const { verification, match } = item;
  if (match.status !== "FINISHED" || !verification.evaluated) return null;
  const hit = verification.mainTrendHit;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
        hit ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${hit ? "bg-emerald-400" : "bg-red-400"}`} />
      {hit ? "Validé" : "Perdu"}
    </span>
  );
}

export default function MatchCard({ item, onOpenAnalysis }: { item: MatchWithPrediction; onOpenAnalysis: (id: number) => void }) {
  const { match, prediction } = item;
  const finished = match.status === "FINISHED";
  const live = isLiveStatus(match.status);
  const finalHome = match.score.fullTime.home;
  const finalAway = match.score.fullTime.away;

  return (
    <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-700">
      <div className="mb-3 flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
            live
              ? "bg-red-500/15 text-red-400"
              : finished
                ? "bg-zinc-800 text-zinc-300"
                : "bg-blue-500/15 text-blue-400"
          }`}
        >
          {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />}
          {finished ? statusLabel(match.status) : formatKickoffTime(match.utcDate)}
        </span>
        <VerdictBadge item={item} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamCrest crest={match.homeTeam.crest} name={match.homeTeam.name} />
          <span className="line-clamp-2 text-xs font-semibold text-zinc-200">{match.homeTeam.shortName ?? match.homeTeam.name}</span>
        </div>
        <div className="flex flex-col items-center px-2">
          {finished && finalHome != null && finalAway != null ? (
            <span className="text-xl font-black text-white">
              {finalHome} - {finalAway}
            </span>
          ) : (
            <span className="text-sm font-bold text-zinc-500">VS</span>
          )}
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamCrest crest={match.awayTeam.crest} name={match.awayTeam.name} />
          <span className="line-clamp-2 text-xs font-semibold text-zinc-200">{match.awayTeam.shortName ?? match.awayTeam.name}</span>
        </div>
      </div>

      <div className="my-4 h-px bg-zinc-800" />

      <div className="flex items-center justify-between rounded-xl bg-zinc-950/60 px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Score Exact IA</span>
        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-sm font-bold text-emerald-400">
          {prediction.scoreExact.home} - {prediction.scoreExact.away}
        </span>
      </div>

      <div className="mt-2 rounded-xl border border-zinc-800/80 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 px-3 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Tendance IA</p>
        <p className="mt-0.5 text-sm font-semibold text-white">{prediction.mainTrend.label}</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500"
              style={{ width: `${Math.min(100, prediction.confidence)}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-[11px] font-bold text-zinc-300">{prediction.confidence}% confiance</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Probabilité : {percent(prediction.mainTrend.probability)}</span>
          <span>Cote est. {prediction.mainTrend.estimatedOdds.toFixed(2)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpenAnalysis(match.id)}
        className="mt-3 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-xs font-bold uppercase tracking-wide text-emerald-400 transition-colors hover:bg-emerald-500/20"
      >
        Voir l&apos;analyse IA
      </button>
    </div>
  );
}
