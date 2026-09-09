import { buildDetailedAnalysis } from "@/lib/football/predictionService";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const matchId = Number(id);

  if (!Number.isFinite(matchId)) {
    return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  try {
    const analysis = await buildDetailedAnalysis(matchId);
    if (!analysis) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return Response.json({ ok: true, analysis });
  } catch (error) {
    console.error(`[api/match/${matchId}] Erreur lors de la construction de l'analyse détaillée ::`, error);
    return Response.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
