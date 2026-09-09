"use client";

import { useEffect, useMemo, useState } from "react";
import ComboSection from "./ComboSection";
import CompetitionSection from "./CompetitionSection";
import DateSelector from "./DateSelector";
import MatchModal from "./MatchModal";
import Logo from "./Logo";
import { buildDateOptions, toDateKey } from "@/lib/football/format";
import type { CompetitionGroup } from "@/lib/football/types";

interface MatchesApiResponse {
  ok: boolean;
  competitions: CompetitionGroup[];
  widened: boolean;
  radiusDays: number;
  isEmpty: boolean;
}

export default function Dashboard() {
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const dateOptions = useMemo(() => buildDateOptions(todayKey, 2, 4), [todayKey]);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [data, setData] = useState<MatchesApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeMatchId, setActiveMatchId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/matches?date=${selectedDate}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.ok) setData(json);
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
  }, [selectedDate]);

  const totalMatches = data?.competitions.reduce((acc, g) => acc + g.matches.length, 0) ?? 0;

  return (
    <div className="min-h-screen bg-slate-950 pb-16 text-white">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Moteur de Poisson + IA contextuelle</p>
            <p className="text-[11px] text-emerald-400">football-data.org · temps réel</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 pt-6 sm:px-6">
        <section>
          <DateSelector options={dateOptions} selected={selectedDate} onSelect={setSelectedDate} />
        </section>

        <ComboSection date={selectedDate} onOpenAnalysis={setActiveMatchId} />

        {data?.widened && !data.isEmpty && (
          <p className="rounded-xl border border-blue-500/25 bg-blue-500/5 px-4 py-2.5 text-xs text-blue-300">
            Aucun match précis à cette date : affichage élargi (±{data.radiusDays}j) pour ne rien laisser vide.
          </p>
        )}

        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-6 text-center text-sm text-red-400">
            Une erreur est survenue lors de la récupération des matchs. Réessayez dans quelques instants.
          </p>
        )}

        {!loading && !error && data && totalMatches === 0 && (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
            Aucun match disponible sur la fenêtre analysée (±7 jours). Revenez plus tard.
          </p>
        )}

        {!loading && !error && data && totalMatches > 0 && (
          <div className="space-y-10">
            {data.competitions.map((group) => (
              <CompetitionSection key={group.competition.id} group={group} onOpenAnalysis={setActiveMatchId} />
            ))}
          </div>
        )}
      </main>

      {activeMatchId != null && <MatchModal matchId={activeMatchId} onClose={() => setActiveMatchId(null)} />}

      <footer className="mx-auto mt-16 max-w-6xl px-4 text-center text-[11px] text-zinc-600 sm:px-6">
        Football Predictor by DTech — Pronostics générés automatiquement par un modèle statistique (loi de Poisson +
        intelligence contextuelle). Ne constitue pas un conseil financier ou un encouragement au jeu d&apos;argent.
      </footer>
    </div>
  );
}
