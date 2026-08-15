"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircleMore, Plus, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Agent = { id: string; name: string };
type Room = { id: string; title: string; participants: string[]; model: string; createdAt: string; updatedAt: string };
type Msg = { id: string; role: "user" | "assistant"; agent?: string; name?: string; content: string; createdAt: string; pending?: boolean; error?: boolean; model?: string };
type Model = { id: string; featured: boolean };

export default function GroupChatPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState("hermes");
  const [selectedAgents, setSelectedAgents] = useState<string[]>(["corla", "oca"]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

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
      const res = await fetch(`/api/group-chat?roomId=${encodeURIComponent(roomId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal membuka room.");
      setRoom(data.room);
      setMessages(data.messages || []);
      setAgents(data.agents || []);
      setSelectedAgents(data.room.participants || ["corla", "oca"]);
      setModel(data.room.model || "hermes");
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
      const res = await fetch(`/api/group-chat?roomId=${encodeURIComponent(room.id)}`);
      const data = await res.json();
      if (res.ok) { setMessages(data.messages || []); setRooms((prev) => prev.map((r) => r.id === data.room.id ? data.room : r)); if (!data.pending) setSending(false); }
    }, 1500);
    return () => clearInterval(timer);
  }, [room]);

  const createRoom = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/group-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create-room", title: "Group Chat", participants: selectedAgents, model }) });
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
        body: JSON.stringify({ roomId: room.id, message: input, participants: selectedAgents, model }),
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

  return (
    <div className="space-y-5 fade-in-up">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Group Chat</h1>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">Satu pesan, beberapa agent menjawab dalam room yang sama.</p>
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
                <div className="truncate font-medium">{item.title}</div>
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
                <p className="mb-1 text-[11px] text-muted-foreground">Peserta</p>
                <div className="flex flex-wrap gap-2">
                  {agents.map((agent) => {
                    const active = selectedAgents.includes(agent.id);
                    return <button key={agent.id} type="button" onClick={() => setSelectedAgents((prev) => active ? prev.filter((x) => x !== agent.id) : [...prev, agent.id].slice(0, 5))} className={cn("rounded-full border px-3 py-1 text-xs", active ? "border-primary bg-primary/10 text-primary" : "border-border")}>{agent.name}</button>;
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tulis pesan untuk dibahas para agent..." className="min-h-[88px] rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                <div className="space-y-2">
                  <select value={model} onChange={(e) => setModel(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-xs">
                    {shownModels.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
                  </select>
                  <Button className="h-10 w-full gap-1.5 text-xs" disabled={!room || sending || !input.trim() || selectedAgents.length === 0} onClick={() => void send()}>
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Kirim ke {selectedAgents.length} agent
                  </Button>
                  <p className="text-[10px] text-muted-foreground">Model berlaku untuk ronde pesan berikutnya.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Percakapan</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat room…</div> : (
                <div className="space-y-3">
                  {messages.map((m) => (
                    <div key={m.id} className={cn("max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm", m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card border border-border")}>
                      {m.role === "assistant" && <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide opacity-70"><span>{m.name || m.agent}</span>{m.model && <span className="rounded border border-border/40 px-1.5 py-0.5 font-mono normal-case">{m.model}</span>}</div>}
                      <div className="whitespace-pre-wrap">{m.content || (m.pending ? "sedang memproses…" : "")}{m.pending && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-primary/70" />}</div>
                      <div className="mt-2 text-[10px] opacity-60">{new Date(m.createdAt).toLocaleTimeString()}</div>
                    </div>
                  ))}
                  {messages.length === 0 && <p className="text-xs text-muted-foreground">Belum ada percakapan di room ini.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
