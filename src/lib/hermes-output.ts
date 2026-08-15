/**
 * Shared normalizer for Hermes CLI output.
 *
 * WHY THIS EXISTS
 * `hermes chat -q ... -Q` (quiet) intentionally buffers the whole answer and
 * prints it once on exit — verified: 2 stdout chunks, the second arriving at
 * ~14s with the complete text. A streaming UI fed by that only ever sees an
 * empty partial, so the bubble blinks without text.
 *
 * Non-quiet output IS incremental (~35 chunks for the same prompt) but is
 * wrapped in a TUI frame:
 *
 *   Warning: Unknown toolsets: moa, rl
 *   Query: <the prompt>
 *   Initializing agent...
 *   ────────────────────────────────
 *   ╭─ ⚕ Hermes ────────────────────╮
 *   <answer, double-spaced>
 *   ╰───────────────────────────────╯
 *   Resume this session with: ...
 *   Session:  ...
 *
 * So streaming callers must use non-quiet AND run every partial through this
 * function. It has to be correct on PARTIAL input: mid-stream the box is open
 * but not yet closed.
 */

/** The boxed renderer double-spaces lines; restore normal paragraphs. */
function collapseBlankLines(lines: string[]): string {
  const out: string[] = [];
  let blanks = 0;
  for (const line of lines) {
    if (line.trim() === "") {
      blanks += 1;
      continue;
    }
    // One blank between text lines is renderer padding; two or more is a real
    // paragraph break the model asked for.
    if (out.length && blanks >= 2) out.push("");
    blanks = 0;
    out.push(line.trimEnd());
  }
  return out.join("\n");
}

const NOISE_EXACT = new Set(["Initializing agent...", "Resume this session with:"]);
const NOISE_PREFIX = [
  "Warning: Unknown toolsets:",
  "session_id:",
  "Query:",
  "hermes --resume",
  "hermes -c ",
];
const NOISE_FIELD = /^(Session|Title|Duration|Messages|Tokens|Cost):\s/;

export function cleanHermesOutput(raw: string): string {
  if (!raw) return "";
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");

  // Prefer the boxed answer when a box has been opened. Use the LAST opening
  // box so a multi-turn transcript yields the current answer.
  let openIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trimStart().startsWith("╭")) openIdx = i;
  }

  if (openIdx >= 0) {
    const body: string[] = [];
    for (let i = openIdx + 1; i < lines.length; i += 1) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith("╰")) break;
      // The footer can appear without a closing box if the run was killed.
      if (NOISE_EXACT.has(trimmed) || NOISE_FIELD.test(trimmed)) break;
      if (/^[─╭╰]/.test(trimmed)) continue;
      // Some widths draw a "│" gutter around the content.
      body.push(line.replace(/^\s*│\s?/, "").replace(/\s*│\s*$/, ""));
    }
    return collapseBlankLines(body).trim();
  }

  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (NOISE_EXACT.has(trimmed)) return false;
    if (NOISE_FIELD.test(trimmed)) return false;
    if (NOISE_PREFIX.some((p) => trimmed.startsWith(p))) return false;
    if (/^[─╭╰│]/.test(trimmed)) return false;
    return true;
  });
  return collapseBlankLines(filtered).trim();
}

/**
 * Args for a streaming (incremental) Hermes run. Deliberately omits `-Q`.
 * `profile` is only applied when it actually exists — see availableProfiles().
 */
export function streamingChatArgs(prompt: string, model: string, profile?: string): string[] {
  const args = ["chat", "-q", prompt, "-m", model];
  if (profile) args.unshift("--profile", profile);
  return args;
}
