import { NextResponse } from "next/server";
import { db } from "@/db";
import { approvalGuardrails } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";
import { parseApprovalUpdate } from "@/lib/api/contracts";
import { handleRouteError, notFound, parseJsonObject } from "@/lib/api/errors";
import { eq } from "drizzle-orm";

const DASHBOARD_APPROVAL_CHANNELS = new Set([
  "Telegram-safe",
  "Telegram-safe-with-review",
]);

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const updates = parseApprovalUpdate(await parseJsonObject(req));

    const [existingApproval] = await db
      .select({
        id: approvalGuardrails.id,
        approvalChannel: approvalGuardrails.approvalChannel,
      })
      .from(approvalGuardrails)
      .where(eq(approvalGuardrails.id, id))
      .limit(1);

    if (!existingApproval) notFound("Approval request not found.");

    if (!DASHBOARD_APPROVAL_CHANNELS.has(existingApproval.approvalChannel)) {
      return NextResponse.json(
        {
          error:
            existingApproval.approvalChannel === "SSH-only"
              ? "SSH-only approvals must be reviewed manually outside the dashboard."
              : "OpenClaw backend-only items do not accept manual dashboard approval.",
        },
        { status: 403 },
      );
    }

    await db.update(approvalGuardrails).set(updates).where(eq(approvalGuardrails.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
