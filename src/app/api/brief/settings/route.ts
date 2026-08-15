import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { type BriefSettings, num, readBriefSettings, saveBriefSettings } from "@/lib/brief-settings";

export const runtime = "nodejs";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  return NextResponse.json({ settings: await readBriefSettings() });
}

export async function PUT(req: Request) {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as Partial<BriefSettings>;
    const current = await readBriefSettings();
    const lat = body.latitude === null ? null : num(body.latitude) ?? current.latitude;
    const lon = body.longitude === null ? null : num(body.longitude) ?? current.longitude;

    const next: BriefSettings = {
      ...current,
      locationName: typeof body.locationName === "string" ? body.locationName.slice(0, 120) : current.locationName,
      latitude: lat,
      longitude: lon,
      timezone: typeof body.timezone === "string" && body.timezone ? body.timezone.slice(0, 64) : current.timezone,
      prayerMethod: num(body.prayerMethod) ?? current.prayerMethod,
      wakeTime: /^\d{2}:\d{2}$/.test(String(body.wakeTime)) ? String(body.wakeTime) : current.wakeTime,
      showWeather: typeof body.showWeather === "boolean" ? body.showWeather : current.showWeather,
      showPrayer: typeof body.showPrayer === "boolean" ? body.showPrayer : current.showPrayer,
      showAgenda: typeof body.showAgenda === "boolean" ? body.showAgenda : current.showAgenda,
      updatedAt: new Date().toISOString(),
    };
    await saveBriefSettings(next);
    return NextResponse.json({ settings: next });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
