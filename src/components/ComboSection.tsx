"use client";

import { useEffect, useState } from "react";
import { formatKickoffTime, percent, statusLabel } from "@/lib/football/format";
import type { DailyCombo } from "@/lib/football/types";

const STATUS_STYLES: Record<DailyCombo["status"], { label: string; classes: string; dot: string }> = {
  WON: { label: "Combiné Gagné", classes: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-400" },
  LOST: { label: "Combiné Perdu", classes: "bg-red-500/15 text-red-400", dot: "bg-red-400" },
  PARTIAL: { label: "En cours (mixte)", classes: "bg-amber-500/15 text-amber-400", dot: "bg-amber-400" },
  PENDING: { label: "En attente", classes: "bg-blue-500/15 text-blue-400", dot: "bg-blue-400" },
};

export default function ComboSection({ date, onOpenAnalysis }: { date: string; onOpenAnalysis: (id: number) => void }) {
  const [combo, setCombo] = useState<DailyCombo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/combo?date=${date}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setCombo(data.combo);
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
  }, [date]);

  return (
    <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] via-zinc-900 to-blue-500/[0.06] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-white sm:text-xl">
            <span className="text-emerald-400">⚡</span> Le Combiné DTech du Jour
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Sélection automatique composée par l&apos;IA à partir de l&apos;ensemble des matchs de la journée.
          </p>
        </div>
        {combo && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[combo.status].classes}`}
          >
            <span className={`h-2 w-2 rounded-full ${STATUS_STYLES[combo.status].dot}`} />
            {STATUS_STYLES[combo.status].label}
          </span>
        )}
      </div>

      {loading && <p className="mt-6 text-sm text-zinc-500">Analyse des matchs du jour en cours…</p>}
      {!loading && error && <p className="mt-6 text-sm text-red-400">Impossible de générer le combiné pour cette date.</p>}
      {!loading && !error && combo && combo.selections.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500">Aucun match disponible pour composer un combiné à cette date.</p>
      )}

      {!loading && !error && combo && combo.selections.length > 0 && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Sélections</p>
              <p className="mt-1 text-xl font-black text-white">{combo.selections.length}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Cote cumulée est.</p>
              <p className="mt-1 text-xl font-black text-emerald-400">{combo.totalOdds.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Confiance moy.</p>
              <p className="mt-1 text-xl font-black text-blue-400">{combo.averageConfidence}%</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Objectif mini.</p>
              <p className="mt-1 text-xl font-black text-zinc-300">{combo.requestedMinimum}+</p>
            </div>
          </div>

          <div className="mt-5 divide-y divide-zinc-800/70 overflow-hidden rounded-xl border border-zinc-800">
            {combo.selections.map((s, idx) => {
              const finished = s.status === "FINISHED";
              const hit = s.verification.mainTrendHit;
              return (
                <button
                  key={s.matchId}
                  type="button"
                  onClick={() => onOpenAnalysis(s.matchId)}
                  className="flex w-full items-center gap-3 bg-zinc-950/30 px-3 py-2.5 text-left transition-colors hover:bg-zinc-900"
                >
                  <span className="w-5 shrink-0 text-center text-[11px] font-bold text-zinc-600">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-zinc-200">
                      {s.homeTeam} <span className="text-zinc-600">vs</span> {s.awayTeam}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {s.competition} · {formatKickoffTime(s.utcDate)} · {s.pickLabel}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-emerald-400">{s.estimatedOdds.toFixed(2)}</p>
                    <p className="text-[10px] text-zinc-500">{percent(s.probability)}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold text-zinc-500">
                    {finished ? (
                      <span className={hit ? "text-emerald-400" : "text-red-400"}>{hit ? "✓" : "✗"}</span>
                    ) : (
                      statusLabel(s.status)
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
