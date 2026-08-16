import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { createClient } from "@libsql/client";

export const runtime = "nodejs";
const DB_PATH = "/root/paho/data/ai_promo.db";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();
  
  const db = createClient({ url: `file:${DB_PATH}` });
  try {
    const promosRes = await db.execute("SELECT * FROM promos ORDER BY first_seen DESC LIMIT 50");
    const reportsRes = await db.execute("SELECT * FROM daily_reports ORDER BY date DESC LIMIT 10");
    const sourcesRes = await db.execute("SELECT * FROM sources");
    const settingsRes = await db.execute("SELECT * FROM settings");
    
    return NextResponse.json({
      promos: promosRes.rows,
      reports: reportsRes.rows,
      sources: sourcesRes.rows,
      settings: settingsRes.rows
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    db.close();
  }
}
