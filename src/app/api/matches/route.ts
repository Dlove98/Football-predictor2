import { NextRequest } from "next/server";
import { buildDayPredictions } from "@/lib/football/predictionService";

export const dynamic = "force-dynamic";

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const date = dateParam && isValidDate(dateParam) ? dateParam : new Date().toISOString().slice(0, 10);

  try {
    const result = await buildDayPredictions(date);
    return Response.json({ ok: true, requestedDate: date, ...result });
  } catch (error) {
    console.error(`[api/matches] Erreur lors de la construction des prédictions pour ${date} ::`, error);
    return Response.json(
      { ok: false, requestedDate: date, competitions: [], widened: false, radiusDays: 0, isEmpty: true, error: "internal_error" },
      { status: 500 }
    );
  }
}
