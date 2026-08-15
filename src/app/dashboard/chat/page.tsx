"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Bot, BriefcaseBusiness, FileText, FolderKanban, Heart, Loader2, MessageSquare, Paperclip, Pencil, Plus, RotateCcw, Send, Sparkles, Trash2, User, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AttachmentViewer } from "@/components/attachment-viewer";

type AgentId = "corla" | "oca" | "gadis" | "priska" | "bunga";
type ProjectDomain = "general" | "work" | "personal" | "business";

type Agent = { id: AgentId; name: string; label: string; domain: string; tone: string };
type ChatAttachment = { id: string; name: string; type: string; size: number; path: string; createdAt: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string; attachments?: ChatAttachment[] };
type UploadedFile = { id: string; name: string; type: string; size: number; path: string; uploadedAt: string; extractedChars: number };
type ChatProject = {
  id: string;
  title: string;
  domain: ProjectDomain;
  status?: "active" | "archived";
  instruction: string;
  knowledge: string;
  uploadedFiles?: UploadedFile[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

type ChatThread = {
  id: string;
  title: string;
  agentId: AgentId;
  projectId: string;
  status?: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

type ProjectForm = Pick<ChatProject, "title" | "domain" | "instruction" | "knowledge"> & { id?: string };

const fallbackAgents: Agent[] = [
  { id: "corla", name: "Corla", label: "Core coordinator", domain: "Lintas domain", tone: "text-hermes" },
  { id: "oca", name: "Oca", label: "OpenClaw support", domain: "Backend worker", tone: "text-openclaw" },
  { id: "gadis", name: "Gadis", label: "Work Agrabudi", domain: "Work", tone: "text-blue-500" },
  { id: "priska", name: "Priska", label: "Personal", domain: "Personal", tone: "text-rose-500" },
  { id: "bunga", name: "Bunga", label: "Business / SJNet", domain: "Bisnis", tone: "text-emerald-500" },
];

const emptyForm: ProjectForm = { title: "", domain: "general", instruction: "", knowledge: "" };

const agentIcons: Record<AgentId, typeof Bot> = {
  corla: Bot,
  oca: Zap,
  gadis: BriefcaseBusiness,
  priska: Heart,
  bunga: Sparkles,
};

function normalizeAgent(value: string | null): AgentId {
  if (value === "oca" || value === "gadis" || value === "priska" || value === "bunga" || value === "corla") return value;
  return "corla";
}

function normalizeProject(value: string | null) {
  return value && value !== "null" && value !== "undefined" ? value : "none";
}

function domainLabel(domain: ProjectDomain) {
  return domain === "work" ? "Work" : domain === "personal" ? "Personal" : domain === "business" ? "Bisnis" : "General";
}
function attachmentUrl(id: string) { return `/api/chat/attachments/${encodeURIComponent(id)}`; }
type ViewerFile = { id: string; name: string; size: number };

export default function ChatPage() {
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);
  const [activeAgent, setActiveAgent] = useState<AgentId>("corla");
  const [projects, setProjects] = useState<ChatProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("none");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewerFile, setViewerFile] = useState<ViewerFile | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [projectLoading, setProjectLoading] = useState(true);
  const [error, setError] = useState("");
  const [model, setModel] = useState("hermes");
  const [backend, setBackend] = useState("hermes-cli");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectForm>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentAgent = useMemo(() => agents.find((agent) => agent.id === activeAgent) || fallbackAgents[0], [activeAgent, agents]);
  const currentProject = useMemo(() => projects.find((project) => project.id === activeProjectId) || null, [activeProjectId, projects]);
  const CurrentIcon = agentIcons[currentAgent.id] || Bot;

  useEffect(() => {
    const savedAgent = normalizeAgent(window.localStorage.getItem("paho-chat-agent"));
    const savedProject = "none";
    setActiveAgent(savedAgent);
    setActiveProjectId(savedProject);
    void fetchProjects(savedProject);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("paho-chat-agent", activeAgent);
    window.localStorage.setItem("paho-chat-project", activeProjectId);
    setActiveThreadId("");
    void fetchThreads(activeAgent, activeProjectId);
    void fetchHistory(activeAgent, activeProjectId, "");
  }, [activeAgent, activeProjectId, showArchivedChats]);

  useEffect(() => {
    void fetchProjects(activeProjectId);
  }, [showArchivedProjects]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchProjects = async (preferredId?: string) => {
    setProjectLoading(true);
    try {
      const res = await fetch(`/api/chat/projects${showArchivedProjects ? "?includeArchived=true" : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat project.");
      const loaded = data.projects || [];
      setProjects(loaded);
      if (preferredId && preferredId !== "none" && !loaded.some((project: ChatProject) => project.id === preferredId)) {
        setActiveProjectId("none");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProjectLoading(false);
    }
  };

  const fetchThreads = async (agent: AgentId, projectId: string) => {
    try {
      const res = await fetch(`/api/chat/threads?agent=${agent}&projectId=${encodeURIComponent(projectId)}${showArchivedChats ? "&includeArchived=true" : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat daftar chat.");
      setThreads(data.threads || []);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const fetchHistory = async (agent: AgentId, projectId: string, threadId = "") => {
    setInitialLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ agent, projectId });
      if (threadId) qs.set("threadId", threadId);
      const res = await fetch(`/api/chat?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat chat.");
      setMessages(data.messages || []);
      setAgents(data.agents || fallbackAgents);
      setModel(data.model || "hermes");
      setBackend(data.backend || "hermes-cli");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setInitialLoading(false);
    }
  };

  const startCreateProject = () => {
    setProjectForm(emptyForm);
    setShowProjectForm(true);
  };

  const startEditProject = () => {
    if (!currentProject) return;
    setProjectForm({
      id: currentProject.id,
      title: currentProject.title,
      domain: currentProject.domain,
      instruction: currentProject.instruction,
      knowledge: currentProject.knowledge,
    });
    setShowProjectForm(true);
  };

  const saveProject = async () => {
    const title = projectForm.title.trim();
    if (!title) {
      setError("Nama project wajib diisi.");
      return;
    }
    setError("");
    try {
      const method = projectForm.id ? "PUT" : "POST";
      const res = await fetch("/api/chat/projects", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan project.");
      setProjects(data.projects || []);
      setActiveProjectId(data.project.id);
      setShowProjectForm(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const setProjectStatus = async (status: "active" | "archived") => {
    if (!currentProject) return;
    if (!confirm(`${status === "archived" ? "Arsipkan" : "Restore"} project ${currentProject.title}?`)) return;
    try {
      const res = await fetch("/api/chat/projects", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...currentProject, status }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal update status project.");
      setProjects(data.projects || []);
      if (status === "archived" && !showArchivedProjects) setActiveProjectId("none");
    } catch (err) { setError((err as Error).message); }
  };

  const deleteProject = async () => {
    if (!currentProject || !confirm(`Delete permanen project ${currentProject.title} beserta file upload-nya?`)) return;
    try {
      const res = await fetch(`/api/chat/projects?id=${encodeURIComponent(currentProject.id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal delete project.");
      setProjects(data.projects || []);
      setActiveProjectId("none");
    } catch (err) { setError((err as Error).message); }
  };

  const newChat = async () => {
    setError("");
    try {
      const res = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: activeAgent, projectId: activeProjectId, title: "Chat baru" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal membuat chat baru.");
      setThreads((prev) => [data.thread, ...prev.filter((thread) => thread.id !== data.thread.id)]);
      setActiveThreadId(data.thread.id);
      await fetchHistory(activeAgent, activeProjectId, data.thread.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openThread = async (threadId: string) => {
    setActiveThreadId(threadId);
    await fetchHistory(activeAgent, activeProjectId, threadId);
  };

  const renameThread = async () => {
    if (!activeThreadId) return;
    const current = threads.find((thread) => thread.id === activeThreadId);
    const title = prompt("Judul chat", current?.title || "Chat baru")?.trim();
    if (!title) return;
    try {
      const res = await fetch("/api/chat/threads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeThreadId, title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal rename chat.");
      setThreads((prev) => prev.map((thread) => (thread.id === data.thread.id ? data.thread : thread)));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const setThreadStatus = async (status: "active" | "archived") => {
    if (!activeThreadId) return;
    const current = threads.find((thread) => thread.id === activeThreadId);
    if (!confirm(`${status === "archived" ? "Arsipkan" : "Restore"} ${current?.title || "chat ini"}?`)) return;
    try {
      const res = await fetch("/api/chat/threads", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeThreadId, status }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal update chat.");
      setThreads((prev) => prev.map((thread) => thread.id === data.thread.id ? data.thread : thread).filter((thread) => showArchivedChats || thread.status !== "archived"));
      if (status === "archived" && !showArchivedChats) { setActiveThreadId(""); setMessages([]); }
    } catch (err) { setError((err as Error).message); }
  };

  const deleteThread = async () => {
    if (!activeThreadId) return;
    const current = threads.find((thread) => thread.id === activeThreadId);
    if (!confirm(`Delete permanen ${current?.title || "chat ini"}?`)) return;
    try {
      const res = await fetch(`/api/chat/threads?id=${encodeURIComponent(activeThreadId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal delete chat.");
      setThreads((data.threads || []).filter((thread: ChatThread) => thread.agentId === activeAgent && thread.projectId === activeProjectId));
      setActiveThreadId("");
      setMessages([]);
    } catch (err) { setError((err as Error).message); }
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const optimistic: ChatMessage = { id: `local-${Date.now()}`, role: "user", content: text, createdAt: new Date().toISOString() };
    setInput("");
    setError("");
    setLoading(true);
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: activeAgent, projectId: activeProjectId, threadId: activeThreadId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal mengirim pesan.");
      setMessages(data.messages || []);
      if (data.threadId) setActiveThreadId(data.threadId);
      if (data.thread) setThreads((prev) => [data.thread, ...prev.filter((thread) => thread.id !== data.thread.id)]);
    } catch (err) {
      setError((err as Error).message);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    const target = `${currentAgent.name}${currentProject ? ` / ${currentProject.title}` : " / Tanpa Project"}`;
    if (!confirm(`Hapus riwayat chat ${target}?`)) return;
    setError("");
    try {
      const qs = new URLSearchParams({ agent: activeAgent, projectId: activeProjectId });
      if (activeThreadId) qs.set("threadId", activeThreadId);
      const res = await fetch(`/api/chat?${qs.toString()}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal hapus chat.");
      setMessages([]);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const uploadContextFile = async (file: File) => {
    if (!currentProject) {
      setError("Pilih atau buat Project Context dulu sebelum upload file.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("projectId", currentProject.id);
      form.append("file", file);
      const res = await fetch("/api/chat/projects/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal upload file context.");
      setProjects((prev) => prev.map((project) => (project.id === data.project.id ? data.project : project)));
      setInput((prev) => prev || `Ringkas file yang baru saya upload di project ${data.project.title}.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void uploadContextFile(file);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage(event);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-80px)] min-h-0 flex-col gap-4 fade-in-up max-md:h-auto max-md:min-h-[calc(100dvh-80px)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">Chat</h1>
            <Badge variant="outline" className="text-[11px]">{model}</Badge>
            <Badge variant="secondary" className="text-[11px]">{backend}</Badge>
            <Badge className="text-[11px]">Umum</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">
            Chat umum tanpa Project Context. Chat berbasis project dibuka dari halaman Project Context masing-masing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={clearChat} disabled={loading || messages.length === 0}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset chat
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Chats</span>
            <Button size="sm" variant="outline" onClick={newChat}><Plus className="mr-2 h-4 w-4" /> New Chat</Button>
            <Button size="sm" variant="outline" onClick={renameThread} disabled={!activeThreadId}><Pencil className="mr-2 h-4 w-4" /> Rename</Button>
            <Button size="sm" variant="outline" onClick={() => void setThreadStatus(threads.find((thread) => thread.id === activeThreadId)?.status === "archived" ? "active" : "archived")} disabled={!activeThreadId}><Archive className="mr-2 h-4 w-4" /> {threads.find((thread) => thread.id === activeThreadId)?.status === "archived" ? "Restore" : "Archive"}</Button>
            <Button size="icon" variant="ghost" onClick={() => void deleteThread()} disabled={!activeThreadId} title="Delete chat"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setShowArchivedChats((value) => !value)}>{showArchivedChats ? "Sembunyikan arsip" : "Arsip"}</Button>
          </div>
          <select
            value={activeThreadId}
            onChange={(event) => void openThread(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm md:w-80"
          >
            <option value="">Current / legacy chat</option>
            {threads.map((thread) => (
              <option key={thread.id} value={thread.id}>{thread.title}{thread.status === "archived" ? " · Archived" : ""}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {showProjectForm && (
        <Card className="border-primary/30">
          <CardHeader className="py-3">
            <CardTitle className="text-base">{projectForm.id ? "Edit Project Context" : "Project Context Baru"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nama project</Label>
                <Input value={projectForm.title} onChange={(event) => setProjectForm((p) => ({ ...p, title: event.target.value }))} placeholder="Contoh: Claude-like Project Paho" />
              </div>
              <div className="space-y-2">
                <Label>Domain</Label>
                <select
                  value={projectForm.domain}
                  onChange={(event) => setProjectForm((p) => ({ ...p, domain: event.target.value as ProjectDomain }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="general">General</option>
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                  <option value="business">Bisnis</option>
                </select>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Instruksi project</Label>
                <Textarea className="min-h-24" value={projectForm.instruction} onChange={(event) => setProjectForm((p) => ({ ...p, instruction: event.target.value }))} placeholder="Instruksi gaya jawab, batasan, tujuan project..." />
              </div>
              <div className="space-y-2">
                <Label>Knowledge / context</Label>
                <Textarea className="min-h-24" value={projectForm.knowledge} onChange={(event) => setProjectForm((p) => ({ ...p, knowledge: event.target.value }))} placeholder="Catatan penting, referensi, aturan, data yang harus diingat dalam project ini..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowProjectForm(false)}>Batal</Button>
                <Button onClick={saveProject}>Simpan project</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950/40">
        <CardHeader className="border-b border-border/70 py-3">
          <CardTitle className="flex items-center justify-between gap-3 text-sm font-medium text-muted-foreground">
            <span className="flex items-center gap-2"><CurrentIcon className={cn("h-4 w-4", currentAgent.tone)} />{currentAgent.name} {currentProject ? `· ${currentProject.title}` : "· Tanpa Project"} · {messages.length ? `${messages.length} pesan` : "Percakapan baru"}</span>
            <span className="hidden text-[11px] md:inline">{currentProject ? domainLabel(currentProject.domain) : currentAgent.domain}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          {initialLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat chat...</div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"><CurrentIcon className={cn("h-7 w-7", currentAgent.tone)} /></div>
              <h2 className="text-base font-semibold text-foreground">Mulai chat dengan {currentAgent.name}</h2>
              <p className="mt-2 max-w-md text-sm">{currentProject ? `Context project "${currentProject.title}" akan ikut masuk ke prompt.` : "Belum memakai context project khusus."}</p>
            </div>
          ) : (
            <div className="mx-auto flex max-w-4xl flex-col gap-5">
              {messages.map((message) => (
                <div key={message.id} className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
                  {message.role === "assistant" && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><CurrentIcon className={cn("h-4 w-4", currentAgent.tone)} /></div>}
                  <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm", message.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-card-foreground")}>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {Boolean(message.attachments?.length) && <div className="mt-3 flex flex-col gap-2">{message.attachments?.map((file) => <div key={file.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs"><span className="min-w-0 flex-1 truncate font-medium text-foreground">{file.name}</span><span className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span><button type="button" onClick={() => setViewerFile({ id: file.id, name: file.name, size: file.size })} className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90">Lihat</button><a href={attachmentUrl(file.id)} download={file.name} className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-primary hover:bg-background">Download</a></div>)}</div>}
                    <div className={cn("mt-2 text-[10px] opacity-60", message.role === "user" ? "text-right" : "text-left")}>{new Date(message.createdAt).toLocaleTimeString()}</div>
                  </div>
                  {message.role === "user" && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-100"><User className="h-4 w-4" /></div>}
                </div>
              ))}
              {loading && <div className="flex items-center gap-3 text-sm text-muted-foreground"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"><CurrentIcon className={cn("h-4 w-4", currentAgent.tone)} /></div><div className="rounded-2xl border border-border bg-card px-4 py-3"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> {currentAgent.name} menjawab...</div></div>}
              <div ref={bottomRef} />
            </div>
          )}
        </CardContent>
      </Card>

      <form onSubmit={sendMessage} className="rounded-2xl border border-border bg-card p-3 shadow-lg">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
          <div className="min-w-0 flex-1">
            <Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} placeholder={`Tulis pesan untuk ${currentAgent.name}${currentProject ? ` di project ${currentProject.title}` : ""}...`} className="max-h-48 min-h-[52px] w-full resize-none border-0 bg-transparent focus-visible:ring-0" disabled={loading} />
            <p className="px-3 pt-1 text-[10px] text-muted-foreground">Enter untuk kirim · Shift+Enter untuk baris baru</p>
          </div>
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:items-end">
            <select
              value={activeAgent}
              onChange={(event) => setActiveAgent(event.target.value as AgentId)}
              className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-xs sm:w-32 sm:flex-none md:w-40"
              disabled={loading}
              title="Pilih agent"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-xl" disabled={!input.trim() || loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
          </div>
        </div>
      </form>
      {viewerFile && <AttachmentViewer id={viewerFile.id} name={viewerFile.name} size={viewerFile.size} onClose={() => setViewerFile(null)} />}
    </div>
  );
}
