"use client";

import { useEffect, useState } from "react";

type Props = { id: string; name: string; size: number; onClose: () => void };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(text: string) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-800 px-1 py-0.5 text-[12px] text-sky-200">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a class="text-sky-400 underline" href="$2" target="_blank" rel="noreferrer">$1</a>');
}

/** Minimal markdown renderer — no extra deps, handles the structures our .md files use. */
function renderMarkdown(md: string) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inCode = false;
  let inTable = false;
  let listType: "ul" | "ol" | null = null;

  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
  const closeTable = () => { if (inTable) { out.push("</tbody></table></div>"); inTable = false; } };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      if (inCode) { out.push("</code></pre>"); inCode = false; }
      else {
        closeList(); closeTable();
        out.push('<pre class="my-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[12px] leading-relaxed text-slate-200"><code>');
        inCode = true;
      }
      continue;
    }
    if (inCode) { out.push(escapeHtml(line)); continue; }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      if (/^[\s|:-]+$/.test(line)) continue;
      if (!inTable) {
        closeList();
        out.push('<div class="my-3 overflow-x-auto"><table class="w-full border-collapse text-[12px]"><tbody>');
        inTable = true;
        out.push("<tr>" + cells.map((c) => `<th class="border border-slate-800 bg-slate-900 px-2 py-1 text-left font-semibold">${inline(c)}</th>`).join("") + "</tr>");
        continue;
      }
      out.push("<tr>" + cells.map((c) => `<td class="border border-slate-800 px-2 py-1 align-top">${inline(c)}</td>`).join("") + "</tr>");
      continue;
    }
    closeTable();

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const sizes = ["text-xl", "text-lg", "text-base", "text-sm", "text-sm", "text-sm"];
      out.push(`<h${level} class="mt-4 mb-2 ${sizes[level - 1]} font-semibold text-slate-100">${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { closeList(); out.push('<hr class="my-4 border-slate-800" />'); continue; }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      if (listType !== "ol") { closeList(); out.push('<ol class="my-2 list-decimal space-y-1 pl-6">'); listType = "ol"; }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      if (listType !== "ul") { closeList(); out.push('<ul class="my-2 list-disc space-y-1 pl-6">'); listType = "ul"; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }
    closeList();

    if (!line.trim()) continue;
    out.push(`<p class="my-2 leading-relaxed text-slate-300">${inline(line)}</p>`);
  }

  if (inCode) out.push("</code></pre>");
  closeList(); closeTable();
  return out.join("\n");
}

export function AttachmentViewer({ id, name, size, onClose }: Props) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/chat/attachments/${id}/content`)
      .then(async (res) => {
        const type = res.headers.get("content-type") || "";
        if (!type.includes("application/json")) throw new Error("Server tidak mengembalikan JSON");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Gagal memuat file");
        return data;
      })
      .then((data) => { if (alive) { setContent(String(data.content || "")); setError(""); } })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : "Gagal memuat file"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const isMarkdown = /\.(md|markdown)$/i.test(name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex h-full max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/60 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-100">{name}</div>
            <div className="text-[11px] text-slate-500">{(size / 1024).toFixed(1)} KB · {content.length.toLocaleString("id-ID")} karakter</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isMarkdown && (
              <button onClick={() => setRaw((v) => !v)} className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800">
                {raw ? "Preview" : "Raw"}
              </button>
            )}
            <a href={`/api/chat/attachments/${id}`} download={name} className="rounded-md bg-sky-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-sky-500">
              Download
            </a>
            <button onClick={onClose} className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800">Tutup</button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && <div className="text-sm text-slate-400">Memuat file…</div>}
          {!loading && error && <div className="text-sm text-rose-400">{error}</div>}
          {!loading && !error && (
            raw || !isMarkdown
              ? <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-slate-200">{content}</pre>
              : <div className="text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          )}
        </div>
      </div>
    </div>
  );
}
