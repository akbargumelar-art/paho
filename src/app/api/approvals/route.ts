import { NextResponse } from "next/server";
import { db } from "@/db";
import { approvalGuardrails } from "@/db/schema";
import { getAuthSession, unauthorized } from "@/lib/api-auth";

const riskPriority = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
} as const;

const reviewPriority = {
  pending: 3,
  rejected: 2,
  approved: 1,
} as const;

export async function GET() {
  const session = await getAuthSession();
  if (!session) return unauthorized();

  const all = await db.select().from(approvalGuardrails);

  const sorted = [...all].sort((a, b) => {
    const reviewDiff =
      reviewPriority[b.reviewStatus as keyof typeof reviewPriority] -
      reviewPriority[a.reviewStatus as keyof typeof reviewPriority];
    if (reviewDiff !== 0) return reviewDiff;

    const riskDiff =
      riskPriority[b.riskLevel as keyof typeof riskPriority] -
      riskPriority[a.riskLevel as keyof typeof riskPriority];
    if (riskDiff !== 0) return riskDiff;

    return b.id.localeCompare(a.id);
  });

  return NextResponse.json(sorted);
}
