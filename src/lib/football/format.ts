// Fonctions de formatage partagées (client + serveur), sans dépendance réseau.
import type { MatchStatus } from "./types";

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysToKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
}

const WEEKDAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS_FR = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

export interface DateOption {
  value: string;
  weekday: string;
  dayNumber: string;
  month: string;
  tag: string | null;
  isToday: boolean;
  isPast: boolean;
}

export function buildDateOptions(todayKey: string, daysBefore = 2, daysAfter = 4): DateOption[] {
  const options: DateOption[] = [];
  for (let offset = -daysBefore; offset <= daysAfter; offset += 1) {
    const key = addDaysToKey(todayKey, offset);
    const d = new Date(`${key}T00:00:00.000Z`);
    let tag: string | null = null;
    if (offset === 0) tag = "Aujourd'hui";
    else if (offset === -1) tag = "Hier";
    else if (offset === -2) tag = "Avant-hier";
    else if (offset === 1) tag = "Demain";
    options.push({
      value: key,
      weekday: WEEKDAYS_FR[d.getUTCDay()],
      dayNumber: String(d.getUTCDate()).padStart(2, "0"),
      month: MONTHS_FR[d.getUTCMonth()],
      tag,
      isToday: offset === 0,
      isPast: offset < 0,
    });
  }
  return options;
}

export function formatKickoffTime(utcDate: string): string {
  const d = new Date(utcDate);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

export function formatFullDate(utcDate: string): string {
  const d = new Date(utcDate);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });
}

const STATUS_LABELS: Record<MatchStatus, string> = {
  SCHEDULED: "À venir",
  TIMED: "À venir",
  IN_PLAY: "En direct",
  PAUSED: "Mi-temps",
  FINISHED: "Terminé",
  SUSPENDED: "Suspendu",
  POSTPONED: "Reporté",
  CANCELLED: "Annulé",
  AWARDED: "Attribué",
};

export function statusLabel(status: MatchStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function isLiveStatus(status: MatchStatus): boolean {
  return status === "IN_PLAY" || status === "PAUSED";
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
