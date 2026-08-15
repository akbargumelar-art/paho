"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircleMore, Plus, Send, Users, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Agent = { id: string; name: string };
type GroupMode = "parallel" | "roundtable";
type Room = { id: string; title: string; participants: string[]; model: string; mode: GroupMode; maxRounds: number; createdAt: string; updatedAt: string };
type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  agent?: string;
  name?: string;
  content: string;
  createdAt: string;
  pending?: boolean;
  error?: boolean;
  model?: string;
  round?: number;
  status?: "sepakat" | "beda" | "butuh_keputusan" | "unknown";
  kind?: "turn" | "summary" | "notice";
  discussionId?: string;
};
type Model = { id: string; featured: boolean };

const STATUS_LABEL: Record<string, string> = {
  sepakat: "sepakat",
  beda: "beda pendapat",
  butuh_keputusan: "butuh keputusan abay",
};

export default function GroupChatPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState("hermes");
  const [selectedAgents, setSelectedAgents] = useState<string[]>(["corla", "oca"]);
  const [mode, setMode] = useState<GroupMode>("parallel");
  const [maxRounds, setMaxRounds] = useState(3);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadRooms = useCallback(async () => {
    try {
      const [groupRes, modelRes] = await Promise.all([
        fetch("/api/group-chat", { cache: "no-store" }),
        fetch("/api/chat/models", { cache: "no-store" }),
      ]);
      const groupData = await groupRes.json();
      const modelData = await modelRes.json().catch(() => ({ models: [] }));
      if (!groupRes.ok) throw new Error(groupData?.error || "Gagal memuat group chat.");
      setRooms(groupData.rooms || []);
      setAgents(groupData.agents || []);
      setModel(groupData.defaultModel || "hermes");
      setModels((modelData.models || []).map((m: { id: string; featured: boolean }) => ({ id: m.id, featured: m.featured })));
      // Functional update avoids putting `room` in this callback's dependency
      // list. Previously selecting a room recreated loadRooms and triggered the
      // bootstrap effect again.
      setRoom((current) => current || groupData.rooms?.[0] || null);
      setMessage("");
    } finally {
      // Critical first-run path: when there are zero rooms there is no
      // openRoom() call to clear loading. Leaving this true disabled the
      // "Room baru" button forever, so a room could never be created.
      setLoading(false);
    }
  }, []);

  const openRoom = useCallback(async (roomId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/group-chat?roomId=${encodeURIComponent(roomId)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal membuka room.");
      setRoom(data.room);
      setMessages(data.messages || []);
      setAgents(data.agents || []);
      setSelectedAgents(data.room.participants || ["corla", "oca"]);
      setModel(data.room.model || "hermes");
      setMode(data.room.mode === "roundtable" ? "roundtable" : "parallel");
      setMaxRounds(data.room.maxRounds || 3);
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRooms().catch((e) => setMessage((e as Error).message)); }, [loadRooms]);
  useEffect(() => { if (room) void openRoom(room.id); }, [room?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!room) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/group-chat?roomId=${encodeURIComponent(room.id)}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) { setMessages(data.messages || []); setRooms((prev) => prev.map((r) => r.id === data.room.id ? data.room : r)); if (!data.pending) setSending(false); }
    }, 1500);
    return () => clearInterval(timer);
  }, [room]);

  useEffect(() => {
    // Keep replies visible while the composer stays pinned at the bottom. This
    // avoids the old flow where abay typed at the top, then had to scroll back
    // down to see agent replies.
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, messages.at(-1)?.content, sending]);

  const createRoom = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/group-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create-room", title: "Group Chat", participants: selectedAgents, model, mode, maxRounds }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal membuat room.");
      setRooms((prev) => [data.room, ...prev]);
      setRoom(data.room);
      setMessages([]);
      setMessage("");
    } catch (e) { setMessage((e as Error).message); }
    finally { setLoading(false); }
  };

  const send = async () => {
    if (!room || !input.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/group-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, message: input, participants: selectedAgents, model, mode, maxRounds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal mengirim pesan.");
      setMessages(data.messages || []);
      setRoom(data.room);
      setRooms((prev) => [data.room, ...prev.filter((r) => r.id !== data.room.id)]);
      setInput("");
      setMessage("");
    } catch (e) { setMessage((e as Error).message); setSending(false); }
  };

  const shownModels = useMemo(() => (models.length ? models.filter((m) => m.featured || m.id === model).slice(0, 12) : [{ id: "hermes", featured: true }]), [models, model]);
  const roundtable = mode === "roundtable";
  const tooFewForRoundtable = roundtable && selectedAgents.length < 2;
  const firstPendingId = useMemo(() => messages.find((m) => m.pending)?.id || "", [messages]);

  return (
    <div className="space-y-5 fade-in-up">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Group Chat</h1>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">
            {roundtable ? "Para agent berdiskusi bergiliran dan saling menanggapi." : "Satu pesan, beberapa agent menjawab dalam room yang sama."}
          </p>
        </div>
        <Button size="sm" onClick={() => void createRoom()} disabled={loading} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Room baru
        </Button>
      </div>
      {message && <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">{message}</div>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><MessageCircleMore className="h-4 w-4 text-primary" /> Room</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {rooms.map((item) => (
              <button key={item.id} type="button" onClick={() => setRoom(item)} className={cn("w-full rounded-lg border px-3 py-2 text-left text-xs", room?.id === item.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent") }>
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{item.title}</span>
                  {item.mode === "roundtable" && <Badge variant="secondary" className="shrink-0 text-[9px]">diskusi</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">{item.participants.map((p) => <Badge key={p} variant="outline" className="text-[9px]">{p}</Badge>)}</div>
              </button>
            ))}
            {rooms.length === 0 && <p className="text-xs text-muted-foreground">Belum ada room.</p>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Panel Group</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">Mode</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setMode("parallel")} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", !roundtable ? "border-primary bg-primary/10 text-primary" : "border-border")}>
                    <Send className="h-3 w-3" /> Jawab paralel
                  </button>
                  <button type="button" onClick={() => setMode("roundtable")} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", roundtable ? "border-primary bg-primary/10 text-primary" : "border-border")}>
                    <Users className="h-3 w-3" /> Diskusi roundtable
                  </button>
                  {roundtable && (
                    <select value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))} className="h-7 rounded-full border border-input bg-background px-2 text-xs">
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>maks {n} ronde</option>)}
                    </select>
                  )}
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                  {roundtable
                    ? "Agent bicara bergiliran dan menanggapi yang sebelumnya. Diskusi berhenti otomatis saat sepakat, saat argumen mulai berulang, atau saat butuh keputusan kamu."
                    : "Setiap agent menjawab sekali, tanpa saling menanggapi."}
                </p>
              </div>
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">Peserta</p>
                <div className="flex flex-wrap gap-2">
                  {agents.map((agent) => {
                    const active = selectedAgents.includes(agent.id);
                    return <button key={agent.id} type="button" onClick={() => setSelectedAgents((prev) => active ? prev.filter((x) => x !== agent.id) : [...prev, agent.id].slice(0, 5))} className={cn("rounded-full border px-3 py-1 text-xs", active ? "border-primary bg-primary/10 text-primary" : "border-border")}>{agent.name}</button>;
                  })}
                </div>
                {tooFewForRoundtable && <p className="mt-1.5 text-[10px] text-amber-500">Diskusi butuh minimal 2 agent.</p>}
              </div>
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
                Balasan agent muncul di area percakapan. Kolom reply sekarang tetap di bawah supaya kamu tidak perlu bolak-balik scroll setelah diskusi berjalan.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Percakapan</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat room…</div> : (
                <div ref={chatScrollRef} className="max-h-[58vh] space-y-3 overflow-y-auto pr-1 pb-3">
                  {messages.map((m, i) => {
                    if (m.kind === "notice") {
                      return (
                        <div key={m.id} className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                          <Info className="h-3.5 w-3.5 shrink-0" /> {m.content}
                        </div>
                      );
                    }
                    const prev = messages[i - 1];
                    const newRound = Boolean(m.round && m.kind === "turn" && (!prev || prev.round !== m.round || prev.discussionId !== m.discussionId));
                    return (
                      <div key={m.id}>
                        {newRound && (
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Ronde {m.round}</span>
                            <span className="h-px flex-1 bg-border" />
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                          m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "border border-border bg-card",
                          m.kind === "summary" && "border-primary/50 bg-primary/5",
                        )}>
                          {m.role === "assistant" && (
                            <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide opacity-70">
                              <span>{m.name || m.agent}</span>
                              {m.model && <span className="rounded border border-border/40 px-1.5 py-0.5 font-mono normal-case">{m.model}</span>}
                              {m.status && m.status !== "unknown" && (
                                <span className={cn(
                                  "rounded px-1.5 py-0.5 normal-case",
                                  m.status === "sepakat" && "bg-emerald-500/15 text-emerald-500",
                                  m.status === "beda" && "bg-amber-500/15 text-amber-500",
                                  m.status === "butuh_keputusan" && "bg-rose-500/15 text-rose-500",
                                )}>{STATUS_LABEL[m.status]}</span>
                              )}
                            </div>
                          )}
                          <div className="whitespace-pre-wrap">
                            {m.content || (m.pending ? (m.id === firstPendingId ? "sedang memproses…" : "menunggu giliran…") : "")}
                            {m.pending && m.id === firstPendingId && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-primary/70" />}
                          </div>
                          <div className="mt-2 text-[10px] opacity-60">{new Date(m.createdAt).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    );
                  })}
                  {messages.length === 0 && <p className="text-xs text-muted-foreground">Belum ada percakapan di room ini.</p>}
                  <div ref={bottomRef} />
                </div>
              )}

              <div className="sticky bottom-0 z-10 mt-3 border-t border-border bg-card/95 pt-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                <div className="space-y-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={roundtable ? "Topik yang mau didiskusikan para agent..." : "Tulis pesan untuk dibahas para agent..."}
                    className="min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{roundtable ? `Maks ${maxRounds} ronde · bisa berhenti lebih cepat` : "Model untuk pesan berikutnya"}</p>
                    <select value={model} onChange={(e) => setModel(e.target.value)} className="h-8 w-24 shrink-0 rounded-lg border border-input bg-background px-2 text-[10px] sm:w-36" title="Model">
                      {shownModels.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
                    </select>
                    <Button size="icon" className="h-8 w-8 shrink-0 rounded-lg" disabled={!room || sending || !input.trim() || selectedAgents.length === 0 || tooFewForRoundtable} onClick={() => void send()} title={roundtable ? `Mulai diskusi ${selectedAgents.length} agent` : `Kirim ke ${selectedAgents.length} agent`} aria-label={roundtable ? `Mulai diskusi ${selectedAgents.length} agent` : `Kirim ke ${selectedAgents.length} agent`}>
                      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
