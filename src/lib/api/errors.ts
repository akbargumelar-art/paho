import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function badRequest(message: string) {
  throw new ApiError(400, message);
}

export function notFound(message: string) {
  throw new ApiError(404, message);
}

export async function parseJsonObject(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    badRequest("Request body must be valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    badRequest("Request body must be a JSON object.");
  }

  return body as Record<string, unknown>;
}

export function handleRouteError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json(
    { error: "Internal server error." },
    { status: 500 },
  );
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

