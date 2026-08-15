import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const DATA_DIR = "/root/paho/data/web-chat";
const HEALTH_PATH = path.join(DATA_DIR, "model-health.json");

export type ModelHealth = {
  model: string;
  status: "healthy" | "slow" | "failed";
  latencyMs: number | null;
  checkedAt: string;
  note?: string;
};

export type HealthStore = { models: Record<string, ModelHealth> };

export async function readHealth(): Promise<HealthStore> {
  try {
    const parsed = JSON.parse(await readFile(HEALTH_PATH, "utf8")) as Partial<HealthStore>;
    return { models: parsed.models && typeof parsed.models === "object" ? parsed.models : {} };
  } catch {
    return { models: {} };
  }
}

export async function saveHealth(store: HealthStore) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(HEALTH_PATH, JSON.stringify(store, null, 2), "utf8");
}

/** Latency bands used consistently by the API and the UI badges. */
export function classify(latencyMs: number): "healthy" | "slow" {
  return latencyMs <= 20_000 ? "healthy" : "slow";
}
