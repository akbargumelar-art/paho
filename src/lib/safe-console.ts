/**
 * Read-only command console.
 *
 * Design constraints (deliberate, do not relax without an explicit decision):
 *  - No shell. Commands run via execFile with an argv array, so shell
 *    metacharacters have no meaning even if they slip through validation.
 *  - Allowlist of base commands, each with its own argument validator.
 *  - Every command here only READS state. Nothing writes, deletes, restarts,
 *    installs, or changes configuration.
 */

export type CommandSpec = {
  /** Base command as typed by the user. */
  name: string;
  /** Absolute binary path, so PATH cannot be hijacked. */
  bin: string;
  /** Fixed args always prepended. */
  fixedArgs?: string[];
  /** Validates the user-supplied args. Return null to reject. */
  validate: (args: string[]) => string[] | null;
  description: string;
};

const SAFE_TOKEN = /^[A-Za-z0-9._\/=:-]{1,120}$/;

/** Paths the console is allowed to talk about at all. */
const PATH_ROOTS = ["/root/paho", "/root/obsidian-vault", "/root/.hermes/cron/output", "/var/log/nginx"];

function pathAllowed(value: string) {
  if (!SAFE_TOKEN.test(value)) return false;
  if (value.includes("..")) return false;
  return PATH_ROOTS.some((root) => value === root || value.startsWith(`${root}/`));
}

function noArgs(args: string[]) {
  return args.length === 0 ? [] : null;
}

export const COMMANDS: CommandSpec[] = [
  {
    name: "pm2-status",
    bin: "/usr/bin/env",
    fixedArgs: ["pm2", "list", "--no-color"],
    validate: noArgs,
    description: "Status semua proses PM2",
  },
  {
    name: "pm2-logs",
    bin: "/usr/bin/env",
    fixedArgs: ["pm2", "logs", "--nostream", "--lines", "40", "--no-color"],
    validate: (args) => {
      if (args.length === 0) return [];
      if (args.length !== 1) return null;
      return /^[A-Za-z0-9._-]{1,40}$/.test(args[0]) ? [args[0]] : null;
    },
    description: "40 baris log terakhir (opsional: nama proses)",
  },
  {
    name: "df",
    bin: "/usr/bin/df",
    fixedArgs: ["-h"],
    validate: noArgs,
    description: "Pemakaian disk",
  },
  {
    name: "free",
    bin: "/usr/bin/free",
    fixedArgs: ["-h"],
    validate: noArgs,
    description: "Pemakaian memori",
  },
  {
    name: "uptime",
    bin: "/usr/bin/uptime",
    validate: noArgs,
    description: "Uptime dan load average",
  },
  {
    name: "ls",
    bin: "/usr/bin/ls",
    fixedArgs: ["-lah", "--color=never"],
    validate: (args) => (args.length === 1 && pathAllowed(args[0]) ? [args[0]] : null),
    description: "Isi folder (hanya folder yang diizinkan)",
  },
  {
    name: "du",
    bin: "/usr/bin/du",
    fixedArgs: ["-sh"],
    validate: (args) => (args.length === 1 && pathAllowed(args[0]) ? [args[0]] : null),
    description: "Ukuran folder",
  },
  {
    name: "git-log",
    bin: "/usr/bin/git",
    fixedArgs: ["-C", "/root/paho", "log", "--oneline", "-15", "--no-color"],
    validate: noArgs,
    description: "15 commit terakhir repo Paho",
  },
  {
    name: "git-status",
    bin: "/usr/bin/git",
    fixedArgs: ["-C", "/root/paho", "status", "--short", "--branch"],
    validate: noArgs,
    description: "Status working tree repo Paho",
  },
  {
    name: "nginx-test",
    bin: "/usr/sbin/nginx",
    fixedArgs: ["-t"],
    validate: noArgs,
    description: "Validasi konfigurasi Nginx (tidak reload)",
  },
];

export function findCommand(name: string) {
  return COMMANDS.find((command) => command.name === name) || null;
}

export function commandCatalog() {
  return COMMANDS.map(({ name, description }) => ({ name, description }));
}
