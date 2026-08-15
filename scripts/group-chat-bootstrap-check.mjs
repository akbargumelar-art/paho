/**
 * Regression guard for Group Chat's first-run deadlock.
 * It verifies that a zero-room API response reaches `setLoading(false)` and
 * that the Room baru action is only disabled while a request is in progress.
 */
import { readFile } from "fs/promises";

const page = await readFile("src/app/dashboard/group-chat/page.tsx", "utf8");
const failures = [];
const loadStart = page.indexOf("const loadRooms = useCallback");
const openRoom = page.indexOf("const openRoom", loadStart);
const loadBlock = page.slice(loadStart, openRoom);

if (!/finally\s*\{[\s\S]*setLoading\(false\)/.test(loadBlock)) failures.push("loadRooms tidak selalu mematikan loading");
if (/\}, \[room\]\);/.test(loadBlock)) failures.push("loadRooms masih tergantung room (risk reload loop)");
if (!/disabled=\{loading\}/.test(page)) failures.push("tombol Room baru tidak mengunci saat request");
if (!/setRoom\(\(current\) => current \|\| groupData\.rooms\?\.\[0\] \|\| null\)/.test(loadBlock)) failures.push("first room tidak dipilih secara aman");

console.log("== group bootstrap ==");
console.log(`loading_finally=${/finally\s*\{[\s\S]*setLoading\(false\)/.test(loadBlock)}`);
console.log(`room_dependency=${/\}, \[room\]\);/.test(loadBlock)}`);
console.log(`failures=${failures.length}`);
if (failures.length) throw new Error(failures.join("; "));
console.log("ALL_OK");
