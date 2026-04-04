import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import {
  getHermesGatewayState,
  getHermesProcesses,
  formatUptime,
} from "@/lib/live-sources/hermes-gateway";
import {
  getHermesMemory,
  getHermesUserProfile,
} from "@/lib/live-sources/hermes-memories";

// GET /api/hermes — status live Hermes + memory context
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const [gateway, processes, memory, userProfile] = await Promise.allSettled([
      getHermesGatewayState(),
      getHermesProcesses(),
      getHermesMemory(),
      getHermesUserProfile(),
    ]);

    const gw = gateway.status === "fulfilled" ? gateway.value : null;
    const uptime = gw?.start_time ? formatUptime(gw.start_time) : null;

    return NextResponse.json({
      gateway: gw,
      uptime,
      processes: processes.status === "fulfilled" ? processes.value : [],
      memory: memory.status === "fulfilled" ? memory.value : null,
      userProfile: userProfile.status === "fulfilled" ? userProfile.value : null,
      isLive: !!gw,
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
