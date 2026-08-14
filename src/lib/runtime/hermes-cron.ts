import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const HERMES_BIN = process.env.HERMES_BIN || "/root/.local/bin/hermes";

export type RuntimeReminderMode = "plan_only" | "hermes_cron";

export type CronReminderInput = {
  title: string;
  triggerTime: string;
  repeat?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  deliver?: string;
};

function cronScheduleFromReminder(triggerTime: string, repeat: string | undefined) {
  const d = new Date(triggerTime);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid triggerTime for cron schedule");

  const minute = d.getUTCMinutes();
  const hour = d.getUTCHours();
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const weekday = d.getUTCDay();

  switch (repeat || "none") {
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly":
      return `${minute} ${hour} * * ${weekday}`;
    case "monthly":
      return `${minute} ${hour} ${day} * *`;
    case "yearly":
      return `${minute} ${hour} ${day} ${month} *`;
    default:
      return triggerTime;
  }
}

function buildReminderPrompt(title: string) {
  return `Kirim pengingat singkat dalam bahasa Indonesia ke user: '${title}'.`;
}

function parseJobId(output: string) {
  const m = output.match(/Created job:\s*([a-z0-9]+)/i);
  return m ? m[1] : null;
}

export async function createHermesReminderCron(input: CronReminderInput) {
  const schedule = cronScheduleFromReminder(input.triggerTime, input.repeat);
  const prompt = buildReminderPrompt(input.title);
  const args = ["cron", "create", schedule, prompt, "--name", input.title, "--deliver", input.deliver || "origin"];
  const { stdout, stderr } = await execFileAsync(HERMES_BIN, args, { timeout: 60000 });
  const combined = `${stdout || ""}\n${stderr || ""}`.trim();
  return {
    ok: true,
    jobId: parseJobId(combined),
    schedule,
    output: combined,
  };
}

export async function updateHermesReminderCron(jobId: string, input: CronReminderInput) {
  const schedule = cronScheduleFromReminder(input.triggerTime, input.repeat);
  const prompt = buildReminderPrompt(input.title);
  const args = ["cron", "edit", jobId, "--schedule", schedule, "--prompt", prompt, "--name", input.title, "--deliver", input.deliver || "origin"];
  const { stdout, stderr } = await execFileAsync(HERMES_BIN, args, { timeout: 60000 });
  return {
    ok: true,
    schedule,
    output: `${stdout || ""}\n${stderr || ""}`.trim(),
  };
}

export async function removeHermesReminderCron(jobId: string) {
  const { stdout, stderr } = await execFileAsync(HERMES_BIN, ["cron", "remove", jobId], { timeout: 60000 });
  return {
    ok: true,
    output: `${stdout || ""}\n${stderr || ""}`.trim(),
  };
}
