import { readdir, readFile } from "fs/promises";
import path from "path";

/**
 * Static responsive audit for Paho dashboard pages.
 *
 * Flags only patterns that actually clip on a ~360px viewport:
 *  - grid with 4+ columns and no responsive prefix
 *  - fixed pixel widths >= 300px
 *  - large min-width outside a table (tables are allowed to scroll)
 *  - a <table> with no overflow-x wrapper
 */
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const files = await walk("src/app/dashboard");
const issues = [];

for (const f of files) {
  const src = await readFile(f, "utf8");
  const rel = f.replace("src/app/dashboard/", "");
  src.split("\n").forEach((line, i) => {
    const n = i + 1;
    // 4+ base columns is only a problem when there is no responsive variant on
    // the same element to relax it (e.g. an icon picker that is 6-up on phones
    // and 8-up from sm: upward is intentional and fits).
    const dense = line.match(/(?<![a-z:])grid-cols-([4-9]|1[0-2])\b/g);
    const hasResponsiveGrid = /(sm|md|lg|xl):grid-cols-/.test(line);
    if (dense && !hasResponsiveGrid) issues.push([rel, n, "grid 4+ kolom tanpa breakpoint", dense.join(",")]);
    const fixed = line.match(/(?<!max-)(?<!min-)w-\[([3-9]\d{2}|\d{4,})px\]/g);
    if (fixed) issues.push([rel, n, "lebar tetap >=300px", fixed.join(",")]);
    const mw = line.match(/min-w-\[([3-9]\d{2}|\d{4,})px\]/g);
    if (mw && !line.includes("<table")) issues.push([rel, n, "min-width besar non-tabel", mw.join(",")]);
  });
  const tables = (src.match(/<table/g) || []).length;
  const wrappers = (src.match(/overflow-x-auto/g) || []).length;
  if (tables > wrappers) issues.push([rel, 0, "tabel tanpa wrapper scroll", `${tables} tabel / ${wrappers} wrapper`]);
}

console.log(`file diperiksa: ${files.length}`);
if (!issues.length) console.log("HASIL: BERSIH — tidak ada pola yang memotong layout di 360px.");
else {
  console.log(`HASIL: ${issues.length} temuan`);
  for (const [f, l, kind, detail] of issues) console.log(`  ${f}:${l || "-"}  ${kind.padEnd(32)} ${detail}`);
}

console.log("\ntabel wajib punya wrapper scroll:");
for (const f of files) {
  const src = await readFile(f, "utf8");
  const t = (src.match(/<table/g) || []).length;
  if (t) {
    const w = (src.match(/overflow-x-auto/g) || []).length;
    console.log(`  ${f.replace("src/app/dashboard/", "").padEnd(30)} tabel=${t} wrapper=${w} ${t <= w ? "OK" : "KURANG"}`);
  }
}

process.exit(issues.length ? 1 : 0);
