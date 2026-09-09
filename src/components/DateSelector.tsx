"use client";

import type { DateOption } from "@/lib/football/format";

export default function DateSelector({
  options,
  selected,
  onSelect,
}: {
  options: DateOption[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "thin" }}>
      {options.map((opt) => {
        const isActive = opt.value === selected;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={`flex min-w-[76px] shrink-0 flex-col items-center rounded-2xl border px-3 py-2 transition-all ${
              isActive
                ? "border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(52,211,153,0.4)]"
                : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900"
            }`}
          >
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${isActive ? "text-emerald-300" : "text-zinc-500"}`}>
              {opt.tag ?? opt.weekday}
            </span>
            <span className={`mt-1 text-lg font-bold ${isActive ? "text-white" : "text-zinc-200"}`}>{opt.dayNumber}</span>
            <span className={`text-[10px] uppercase tracking-wide ${isActive ? "text-emerald-300/80" : "text-zinc-500"}`}>
              {opt.month}
            </span>
          </button>
        );
      })}
    </div>
  );
}
