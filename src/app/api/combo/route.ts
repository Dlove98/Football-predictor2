import { NextRequest } from "next/server";
import { buildDailyCombo } from "@/lib/football/predictionService";

export const dynamic = "force-dynamic";

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const date = dateParam && isValidDate(dateParam) ? dateParam : new Date().toISOString().slice(0, 10);

  try {
    const combo = await buildDailyCombo(date, 13);
    return Response.json({ ok: true, combo });
  } catch (error) {
    console.error(`[api/combo] Erreur lors de la construction du combiné pour ${date} ::`, error);
    return Response.json({ ok: false, combo: null, error: "internal_error" }, { status: 500 });
  }
}
