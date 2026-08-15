"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Bot, BriefcaseBusiness, FileText, FolderKanban, Heart, Loader2, MessageSquare, Paperclip, Pencil, Plus, RotateCcw, Send, Sparkles, User, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type AgentId = "corla" | "oca" | "gadis" | "priska" | "bunga";
type ProjectDomain = "general" | "work" | "personal" | "business";
type Agent = { id: AgentId; name: string; label: string; domain: string; tone: string };
type UploadedFile = { id: string; name: string; type: string; size: number; path: string; uploadedAt: string; extractedChars: number };
type ChatProject = { id: string; title: string; domain: ProjectDomain; status?: "active" | "archived"; instruction: string; knowledge: string; uploadedFiles?: UploadedFile[]; createdAt: string; updatedAt: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string };
type ChatThread = { id: string; title: string; agentId: AgentId; projectId: string; status?: "active" | "archived"; createdAt: string; updatedAt: string };
type ProjectMemory = { summary: string; facts: string[]; decisions: string[]; todos: string[]; preferences: string[] };
type MemoryStats = { chunkCount: number; totalTokensEstimate: number; sources: string[]; updatedAt: string } | null;

const fallbackAgents: Agent[] = [
  { id: "corla", name: "Corla", label: "Core coordinator", domain: "Lintas domain", tone: "text-hermes" },
  { id: "oca", name: "Oca", label: "OpenClaw support", domain: "Backend worker", tone: "text-openclaw" },
  { id: "gadis", name: "Gadis", label: "Work Agrabudi", domain: "Work", tone: "text-blue-500" },
  { id: "priska", name: "Priska", label: "Personal", domain: "Personal", tone: "text-rose-500" },
  { id: "bunga", name: "Bunga", label: "Business / SJNet", domain: "Bisnis", tone: "text-emerald-500" },
];

const agentIcons: Record<AgentId, typeof Bot> = { corla: Bot, oca: Zap, gadis: BriefcaseBusiness, priska: Heart, bunga: Sparkles };
function domainLabel(domain: ProjectDomain) { return domain === "work" ? "Work" : domain === "personal" ? "Personal" : domain === "business" ? "Bisnis" : "General"; }
function defaultAgentForDomain(domain?: ProjectDomain): AgentId { return domain === "work" ? "gadis" : domain === "personal" ? "priska" : domain === "business" ? "bunga" : "corla"; }

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server mengembalikan ${res.headers.get("content-type") || "non-JSON"} (${res.status}). ${text.slice(0, 120).replace(/\s+/g, " ")}`);
  }
}

export default function ProjectContextDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = decodeURIComponent(String(params.id || ""));
  const [project, setProject] = useState<ChatProject | null>(null);
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);
  const [activeAgent, setActiveAgent] = useState<AgentId>("corla");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);
  const [memoryExpanded, setMemoryExpanded] = useState(false);
  const [memory, setMemory] = useState<ProjectMemory | null>(null);
  const [memoryStats, setMemoryStats] = useState<MemoryStats>(null);
  const [analysisQuestion, setAnalysisQuestion] = useState("");
  const [analysisJob, setAnalysisJob] = useState<{ id: string; status: string; result?: string; error?: string } | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentAgent = useMemo(() => agents.find((agent) => agent.id === activeAgent) || fallbackAgents[0], [activeAgent, agents]);
  const CurrentIcon = agentIcons[currentAgent.id] || Bot;

  const loadProject = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/chat/projects?includeArchived=true");
      const data = await readJson(res);
      if (!res.ok) throw new Error(data?.error || "Gagal memuat project.");
      const found = (data.projects || []).find((item: ChatProject) => item.id === projectId);
      if (!found) throw new Error("Project tidak ditemukan.");
      setProject(found);
      setActiveAgent(defaultAgentForDomain(found.domain));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchThreads = async (agent: AgentId) => {
    const res = await fetch(`/api/chat/threads?agent=${agent}&projectId=${encodeURIComponent(projectId)}`);
    const data = await readJson(res);
    if (!res.ok) throw new Error(data?.error || "Gagal memuat daftar chat.");
    setThreads(data.threads || []);
  };

  const fetchHistory = async (agent: AgentId, threadId = "") => {
    const qs = new URLSearchParams({ agent, projectId });
    if (threadId) qs.set("threadId", threadId);
    const res = await fetch(`/api/chat?${qs.toString()}`);
    const data = await readJson(res);
    if (!res.ok) throw new Error(data?.error || "Gagal memuat chat.");
    setMessages(data.messages || []);
    setAgents(data.agents || fallbackAgents);
  };

  useEffect(() => { void loadProject(); }, [projectId]);
  useEffect(() => { void fetchMemory(); }, [projectId]);
  useEffect(() => {
    if (!project) return;
    setActiveThreadId("");
    void fetchThreads(activeAgent).catch((err) => setError((err as Error).message));
    void fetchHistory(activeAgent).catch((err) => setError((err as Error).message));
  }, [project, activeAgent]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, chatLoading]);

  const saveProject = async () => {
    if (!project) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/chat/projects", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(project) });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan project.");
      setProject(data.project);
      void fetchMemory();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };

  const uploadFile = async (file: File) => {
    if (!project) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("projectId", project.id);
      formData.append("file", file);
      const res = await fetch("/api/chat/projects/upload", { method: "POST", body: formData });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data?.error || "Gagal upload file context.");
      setProject(data.project);
      void fetchMemory();
    } catch (err) { setError((err as Error).message); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const newChat = async () => {
    const res = await fetch("/api/chat/threads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent: activeAgent, projectId, title: "Chat baru" }) });
    const data = await readJson(res);
    if (!res.ok) return setError(data?.error || "Gagal membuat chat baru.");
    setThreads((prev) => [data.thread, ...prev.filter((thread) => thread.id !== data.thread.id)]);
    setActiveThreadId(data.thread.id);
    await fetchHistory(activeAgent, data.thread.id).catch((err) => setError((err as Error).message));
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || chatLoading || !project) return;
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, role: "user", content: text, createdAt: new Date().toISOString() };
    setInput("");
    setMessages((prev) => [...prev, optimistic]);
    setChatLoading(true);
    setError("");
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent: activeAgent, projectId, threadId: activeThreadId, message: text }) });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data?.error || "Gagal mengirim pesan.");
      setMessages(data.messages || []);
      if (data.threadId) setActiveThreadId(data.threadId);
      if (data.thread) setThreads((prev) => [data.thread, ...prev.filter((thread) => thread.id !== data.thread.id)]);
    } catch (err) {
      setError((err as Error).message);
      setMessages((prev) => prev.filter((message) => message.id !== optimistic.id));
      setInput(text);
    } finally { setChatLoading(false); }
  };

  const clearChat = async () => {
    const qs = new URLSearchParams({ agent: activeAgent, projectId });
    if (activeThreadId) qs.set("threadId", activeThreadId);
    const res = await fetch(`/api/chat?${qs.toString()}`, { method: "DELETE" });
    if (!res.ok) return setError("Gagal reset chat.");
    setMessages([]);
  };

  const fetchMemory = async () => {
    if (!projectId) return;
    const res = await fetch(`/api/chat/memory?projectId=${encodeURIComponent(projectId)}`);
    const data = await readJson(res);
    if (!res.ok) return;
    setMemory(data.memory);
    setMemoryStats(data.index);
  };

  const saveMemory = async () => {
    if (!memory) return;
    const res = await fetch("/api/chat/memory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...memory }),
    });
    const data = await readJson(res);
    if (!res.ok) return setError(data?.error || "Gagal menyimpan memory.");
    setMemory(data.memory);
  };

  const startDeepAnalysis = async () => {
    if (!project || !analysisQuestion.trim()) return;
    setError("");
    const res = await fetch("/api/chat/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, question: analysisQuestion, profile: activeAgent === "corla" || activeAgent === "oca" ? undefined : activeAgent }),
    });
    const data = await readJson(res);
    if (!res.ok) return setError(data?.error || "Gagal memulai deep analysis.");
    setAnalysisJob(data.job);
  };

  const pollAnalysis = async () => {
    if (!analysisJob?.id) return;
    const res = await fetch(`/api/chat/analysis?jobId=${encodeURIComponent(analysisJob.id)}`);
    const data = await readJson(res);
    if (!res.ok) return setError(data?.error || "Gagal cek deep analysis.");
    setAnalysisJob(data.job);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage(event);
    }
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memuat project...</div>;
  if (!project) return <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error || "Project tidak ditemukan."}</div>;

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col gap-4 fade-in-up">
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/project-contexts")} className="mb-2"><ArrowLeft className="mr-2 h-4 w-4" />Project Context</Button>
            <div className="flex flex-wrap items-center gap-2"><FolderKanban className="h-5 w-5 text-primary" /><h1 className="text-xl font-bold md:text-2xl">{project.title}</h1><Badge>{domainLabel(project.domain)}</Badge><Badge variant="outline">{project.status || "active"}</Badge></div>
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">Halaman project ala Claude: context, file, dan chat project disatukan di sini.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={clearChat} disabled={chatLoading || messages.length === 0}><RotateCcw className="mr-2 h-4 w-4" />Reset chat</Button><Button size="sm" onClick={newChat}><Plus className="mr-2 h-4 w-4" />New Chat</Button></div>
        </div>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

        <Card className="shrink-0 border-primary/20 bg-card/80">
          <CardContent className="space-y-3 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" />Project Context <Badge variant="outline">{project.uploadedFiles?.length || 0} file</Badge><Badge variant="secondary">{project.instruction.length + project.knowledge.length} karakter</Badge></div>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{project.instruction || project.knowledge || "Belum ada instruksi/knowledge."}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setContextExpanded((value) => !value)}>{contextExpanded ? "Collapse" : "Expand detail"}</Button><Button size="sm" onClick={saveProject} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}Simpan</Button></div>
            </div>

            {contextExpanded && (
              <div className="grid gap-4 border-t border-border pt-3 xl:grid-cols-[1fr_320px]">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2"><Label>Nama project</Label><Input value={project.title} onChange={(e) => setProject((p) => p ? { ...p, title: e.target.value } : p)} /></div>
                  <div className="space-y-2"><Label>Domain</Label><select value={project.domain} onChange={(e) => setProject((p) => p ? { ...p, domain: e.target.value as ProjectDomain } : p)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="general">General</option><option value="work">Work</option><option value="personal">Personal</option><option value="business">Bisnis</option></select></div>
                  <div className="space-y-2 md:col-span-2"><Label>Instructions</Label><Textarea className="min-h-24" value={project.instruction} onChange={(e) => setProject((p) => p ? { ...p, instruction: e.target.value } : p)} /></div>
                  <div className="space-y-2 md:col-span-2"><Label>Knowledge / context</Label><Textarea className="min-h-32" value={project.knowledge} onChange={(e) => setProject((p) => p ? { ...p, knowledge: e.target.value } : p)} /></div>
                </div>
                <div className="space-y-3">
                  <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file); }} accept=".txt,.md,.markdown,.pdf,.csv,.json,.log,.yaml,.yml,.xml,.html,.png,.jpg,.jpeg,.webp,.tif,.tiff,text/*,application/pdf,image/*" />
                  <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading || project.status === "archived"}>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}Upload file</Button>
                  {(project.uploadedFiles?.length || 0) === 0 ? <p className="text-xs text-muted-foreground">Belum ada file context.</p> : <div className="max-h-48 space-y-2 overflow-y-auto">{project.uploadedFiles?.map((file) => <div key={file.id} className="rounded-md border border-border px-3 py-2 text-xs"><div className="flex items-center gap-2 font-medium"><FileText className="h-3.5 w-3.5" /><span className="truncate">{file.name}</span></div><div className="mt-1 text-muted-foreground">{Math.ceil(file.size / 1024)} KB · {file.extractedChars.toLocaleString()} karakter</div></div>)}</div>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shrink-0 border-sky-500/20 bg-card/80">
          <CardContent className="space-y-3 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold"><FolderKanban className="h-4 w-4 text-sky-400" />Project Memory <Badge variant="outline">{memoryStats?.chunkCount || 0} chunk</Badge><Badge variant="secondary">~{memoryStats?.totalTokensEstimate || 0} token</Badge></div>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{memory?.summary || "Belum ada ringkasan memory project."}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setMemoryExpanded((value) => !value)}>{memoryExpanded ? "Collapse" : "Expand memory"}</Button><Button variant="outline" size="sm" onClick={saveMemory} disabled={!memory}>Simpan memory</Button><Button variant="outline" size="sm" onClick={pollAnalysis} disabled={!analysisJob?.id}>Refresh analysis</Button></div>
            </div>
            {memoryExpanded && (
              <div className="grid gap-4 border-t border-border pt-3 xl:grid-cols-[1fr_320px]">
                <div className="space-y-3">
                  <div className="space-y-2"><Label>Ringkasan memory</Label><Textarea className="min-h-24" value={memory?.summary || ""} onChange={(e) => setMemory((prev) => ({ summary: e.target.value, facts: prev?.facts || [], decisions: prev?.decisions || [], todos: prev?.todos || [], preferences: prev?.preferences || [] }))} /></div>
                  <div className="grid gap-3 md:grid-cols-2 text-xs text-muted-foreground"><div><span className="font-medium text-foreground">Facts:</span><div>{(memory?.facts || []).length} item</div></div><div><span className="font-medium text-foreground">Decisions:</span><div>{(memory?.decisions || []).length} item</div></div><div><span className="font-medium text-foreground">Todos:</span><div>{(memory?.todos || []).length} item</div></div><div><span className="font-medium text-foreground">Sources:</span><div className="line-clamp-2">{(memoryStats?.sources || []).join(", ") || "-"}</div></div></div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2"><Label>Deep analysis</Label><Textarea className="min-h-24" value={analysisQuestion} onChange={(e) => setAnalysisQuestion(e.target.value)} placeholder="Misal: susun PRD lengkap dari seluruh context project ini" /></div>
                  <Button className="w-full" variant="outline" onClick={startDeepAnalysis} disabled={!analysisQuestion.trim()}>Mulai deep analysis async</Button>
                  {analysisJob && <div className="rounded-md border border-border p-3 text-xs"><div><span className="font-medium">Job:</span> {analysisJob.id}</div><div><span className="font-medium">Status:</span> {analysisJob.status}</div>{analysisJob.result && <div className="mt-2 whitespace-pre-wrap text-foreground">{analysisJob.result.slice(0, 1200)}</div>}{analysisJob.error && <div className="mt-2 whitespace-pre-wrap text-destructive">{analysisJob.error}</div>}</div>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950/40">
          <CardHeader className="border-b border-border/70 py-3">
            <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-2"><CurrentIcon className={cn("h-4 w-4", currentAgent.tone)} />{currentAgent.name} · {project.title} · {messages.length ? `${messages.length} pesan` : "Percakapan baru"}</span>
              <select value={activeThreadId} onChange={(event) => { setActiveThreadId(event.target.value); void fetchHistory(activeAgent, event.target.value).catch((err) => setError((err as Error).message)); }} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs md:w-72"><option value="">Current / legacy chat</option>{threads.map((thread) => <option key={thread.id} value={thread.id}>{thread.title}</option>)}</select>
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            {messages.length === 0 ? <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"><CurrentIcon className={cn("h-7 w-7", currentAgent.tone)} /></div><h2 className="text-base font-semibold text-foreground">Mulai chat project {project.title}</h2><p className="mt-2 max-w-md text-sm">Instruksi, knowledge, dan file project ini akan ikut masuk ke prompt.</p></div> : <div className="mx-auto flex max-w-4xl flex-col gap-5">{messages.map((message) => <div key={message.id} className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}>{message.role === "assistant" && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><CurrentIcon className={cn("h-4 w-4", currentAgent.tone)} /></div>}<div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm", message.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-card-foreground")}><div className="whitespace-pre-wrap">{message.content}</div><div className={cn("mt-2 text-[10px] opacity-60", message.role === "user" ? "text-right" : "text-left")}>{new Date(message.createdAt).toLocaleTimeString()}</div></div>{message.role === "user" && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-100"><User className="h-4 w-4" /></div>}</div>)}{chatLoading && <div className="flex items-center gap-3 text-sm text-muted-foreground"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"><CurrentIcon className={cn("h-4 w-4", currentAgent.tone)} /></div><div className="rounded-2xl border border-border bg-card px-4 py-3"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> {currentAgent.name} menjawab...</div></div>}<div ref={bottomRef} /></div>}
          </CardContent>
        </Card>

        <form onSubmit={sendMessage} className="rounded-2xl border border-border bg-card p-3 shadow-lg">
          <div className="flex items-end gap-3"><div className="min-w-0 flex-1"><Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} placeholder={`Tulis pesan untuk project ${project.title}...`} className="max-h-48 min-h-[52px] resize-none border-0 bg-transparent focus-visible:ring-0" disabled={chatLoading} /><p className="px-3 pt-1 text-[10px] text-muted-foreground">Enter untuk kirim · Shift+Enter untuk baris baru</p></div><div className="flex shrink-0 items-end gap-2"><select value={activeAgent} onChange={(event) => setActiveAgent(event.target.value as AgentId)} className="h-11 w-32 rounded-xl border border-input bg-background px-3 text-xs md:w-40" disabled={chatLoading}>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><Button type="submit" size="icon" className="h-11 w-11 rounded-xl" disabled={!input.trim() || chatLoading}>{chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></div></div>
        </form>
      </div>
    </div>
  );
}
