import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const DATA_DIR = "/root/paho/data/web-chat";
const SETTINGS_PATH = path.join(DATA_DIR, "brief-settings.json");

export type BriefSettings = {
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  // Aladhan prayer calculation method id (3 = Muslim World League, 20 = Kemenag RI).
  prayerMethod: number;
  wakeTime: string; // "HH:MM"
  showWeather: boolean;
  showPrayer: boolean;
  showAgenda: boolean;
  updatedAt: string;
};

export const DEFAULT_BRIEF_SETTINGS: BriefSettings = {
  locationName: "",
  latitude: null,
  longitude: null,
  timezone: "Asia/Jakarta",
  prayerMethod: 20,
  wakeTime: "05:00",
  showWeather: true,
  showPrayer: true,
  showAgenda: true,
  updatedAt: new Date(0).toISOString(),
};

export async function readBriefSettings(): Promise<BriefSettings> {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf8");
    return { ...DEFAULT_BRIEF_SETTINGS, ...(JSON.parse(raw) as Partial<BriefSettings>) };
  } catch {
    return { ...DEFAULT_BRIEF_SETTINGS };
  }
}

export async function saveBriefSettings(settings: BriefSettings) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
}

export function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
