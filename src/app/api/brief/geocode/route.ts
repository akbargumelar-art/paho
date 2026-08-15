import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

// Location search via Open-Meteo geocoding (no API key needed).
export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=id&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`geocode ${res.status}`);
    const data = await res.json();
    const results = (data?.results || []).map((r: Record<string, unknown>) => ({
      name: r.name,
      admin1: r.admin1 ?? "",
      country: r.country ?? "",
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone ?? "Asia/Jakarta",
      label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    }));
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ results: [], error: (error as Error).message }, { status: 200 });
  }
}
