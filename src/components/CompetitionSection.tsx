"use client";

import MatchCard from "./MatchCard";
import type { CompetitionGroup } from "@/lib/football/types";

export default function CompetitionSection({
  group,
  onOpenAnalysis,
}: {
  group: CompetitionGroup;
  onOpenAnalysis: (id: number) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        {group.competition.emblem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={group.competition.emblem} alt={group.competition.name} className="h-7 w-7 object-contain" loading="lazy" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300">
            {group.competition.code?.slice(0, 2)}
          </div>
        )}
        <h2 className="text-base font-bold text-white sm:text-lg">{group.competition.name}</h2>
        <span className="ml-auto text-xs font-medium text-zinc-500">{group.matches.length} match(s)</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {group.matches.map((item) => (
          <MatchCard key={item.match.id} item={item} onOpenAnalysis={onOpenAnalysis} />
        ))}
      </div>
    </section>
  );
}
