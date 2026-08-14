"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HermesNavTabs } from "@/components/shared/hermes-nav-tabs";

type Session = {
  id: string;
  source: string;
  model: string;
  startedAt: number;
  messageCount: number;
  actualCostUsd: number;
  title: string;
};

type Message = {
  id: number;
  role: string;
  content: string;
  timestamp: number;
  toolName?: string;
  finishReason?: string;
};

export default function HermesDashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (activeSession) {
      fetchMessages(activeSession);
    }
  }, [activeSession]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/hermes/sessions?page=1&pageSize=20");
      if (!res.ok) throw new Error("Failed to load sessions. Pastikan state.db terhubung!");
      const data = await res.json();
      setSessions(data.data);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    setLoadingMessages(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/hermes/messages?sessionId=${sessionId}`);
      if (!res.ok) throw new Error("Gagal mengambil percakapan.");
      const data = await res.json();
      setMessages(data.data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col gap-4 animate-in fade-in zoom-in-95">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Hermes</h1>
          <p className="text-xs text-muted-foreground md:text-sm">Sessions dan Manager masih satu kategori, tapi dipisah via tab halaman.</p>
        </div>
        <HermesNavTabs />
      </div>
      <div className="flex min-h-0 flex-1 gap-6">
      
      {/* LEFT COLUMN: SESSIONS */}
      <Card className="w-1/3 flex flex-col h-full bg-slate-900/50 backdrop-blur-xl border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <span className="text-blue-400">🤖 Hermes</span> LLM Sessions
          </CardTitle>
          <CardDescription>Membaca langsung dari state.db FTS</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-3">
          {error && <div className="p-4 bg-red-900/50 text-red-200 rounded">{error}</div>}
          {loadingSessions ? (
            <div className="text-center text-slate-400 py-10">Memuat Sesi...</div>
          ) : (
            sessions.map(s => (
              <div 
                key={s.id} 
                onClick={() => setActiveSession(s.id)}
                className={`p-3 rounded-lg cursor-pointer transition-all border ${activeSession === s.id ? 'bg-blue-900/40 border-blue-500' : 'bg-slate-800/40 border-slate-700 hover:border-slate-500'}`}
              >
                <div className="font-semibold text-sm truncate">{s.title || "Percakapan Tanpa Judul"}</div>
                <div className="text-xs text-slate-400 mt-1 flex justify-between">
                   <span>{s.model || "Unknown Model"}</span>
                   <span>{s.messageCount} msg</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  ${(s.actualCostUsd || 0).toFixed(4)} • {new Date(s.startedAt * 1000).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* RIGHT COLUMN: CHAT VIEWER */}
      <Card className="w-2/3 flex flex-col h-full bg-slate-900/50 backdrop-blur-xl border-slate-800">
        <CardHeader>
          <CardTitle>Chat Viewer</CardTitle>
          <CardDescription>{activeSession || "Pilih sesi untuk melihat isi percakapan"}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4 pr-4">
          {!activeSession && !loadingMessages && (
             <div className="h-full flex items-center justify-center text-slate-500">Mulai eksplorasi dengan memilih sesi di sebelah kiri.</div>
          )}
          {loadingMessages && <div className="text-center text-slate-400 mt-10">Membongkar arsip percakapan...</div>}
          
          {!loadingMessages && messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl p-4 ${msg.role === 'user' ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-slate-800/60 border border-slate-700'}`}>
                 <div className="text-xs font-bold mb-2 uppercase tracking-wider text-slate-400">
                   {msg.role} {msg.toolName && <span className="text-yellow-400 ml-2">[{msg.toolName}]</span>}
                 </div>
                 <div className="whitespace-pre-wrap text-sm text-slate-200">
                    {msg.content || <i className="text-slate-500">(Panggilan Tool / Media Kosong)</i>}
                 </div>
                 <div className="text-[10px] text-slate-500 mt-2 text-right">
                    {new Date(msg.timestamp * 1000).toLocaleTimeString()}
                 </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
