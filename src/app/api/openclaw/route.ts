import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import {
  getApprovals,
  updateApprovals,
  approveItem,
  rejectItem,
  getOpenClawConfig,
  getCronJobs,
  createCronJob,
  updateCronJob,
  deleteCronJob,
  type ApprovalItem,
  type CronJob,
} from "@/lib/live-sources/openclaw-files";

// GET /api/openclaw — status + approvals + cron + config
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const [approvals, config, cronJobs] = await Promise.allSettled([
      getApprovals(),
      getOpenClawConfig(),
      getCronJobs(),
    ]);

    return NextResponse.json({
      approvals: approvals.status === "fulfilled" ? approvals.value : [],
      config: config.status === "fulfilled" ? config.value : null,
      cronJobs: cronJobs.status === "fulfilled" ? cronJobs.value : [],
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/openclaw — update approvals atau cron jobs
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const body = await req.json() as {
      action?: string;
      id?: string;
      data?: Partial<ApprovalItem> | Partial<CronJob>;
      // Legacy: raw data array
      approvals?: ApprovalItem[];
    };

    const action = body.action;

    // Legacy support: raw approval array update
    if (body.approvals) {
      await updateApprovals(body.approvals);
      return NextResponse.json({ success: true });
    }

    switch (action) {
      // Approval actions
      case "approve": {
        if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const ok = await approveItem(body.id);
        return NextResponse.json({ success: ok });
      }
      case "reject": {
        if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const ok = await rejectItem(body.id);
        return NextResponse.json({ success: ok });
      }

      // Cron job actions
      case "cron:create": {
        const job = await createCronJob(body.data as Omit<CronJob, "id">);
        return NextResponse.json({ success: true, job }, { status: 201 });
      }
      case "cron:update": {
        if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const ok = await updateCronJob(body.id, body.data as Partial<CronJob>);
        return NextResponse.json({ success: ok });
      }
      case "cron:delete": {
        if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const ok = await deleteCronJob(body.id);
        return NextResponse.json({ success: ok });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
