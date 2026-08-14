"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, FileText, FolderKanban, Loader2, MessageSquare, Paperclip, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ProjectDomain = "general" | "work" | "personal" | "business";
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
};

type ProjectForm = Pick<ChatProject, "title" | "domain" | "instruction" | "knowledge"> & { id?: string };

const emptyForm: ProjectForm = { title: "", domain: "general", instruction: "", knowledge: "" };

function domainLabel(domain: ProjectDomain) {
  return domain === "work" ? "Work" : domain === "personal" ? "Personal" : domain === "business" ? "Bisnis" : "General";
}

export default function ProjectContextsPage() {
  const [projects, setProjects] = useState<ChatProject[]>([]);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingProjectId, setUploadingProjectId] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetUploadProjectId = useRef("");

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/projects${showArchived ? "?includeArchived=true" : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat project.");
      setProjects(data.projects || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchProjects(); }, [showArchived]);

  const editProject = (project: ChatProject) => setForm({ id: project.id, title: project.title, domain: project.domain, instruction: project.instruction, knowledge: project.knowledge });

  const saveProject = async () => {
    if (!form.title.trim()) return setError("Nama project wajib diisi.");
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/chat/projects", { method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan project.");
      setProjects(data.projects || []);
      setForm(emptyForm);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (project: ChatProject, status: "active" | "archived") => {
    if (!confirm(`${status === "archived" ? "Arsipkan" : "Restore"} project ${project.title}?`)) return;
    const res = await fetch("/api/chat/projects", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...project, status }) });
    const data = await res.json();
    if (!res.ok) return setError(data?.error || "Gagal update project.");
    setProjects(data.projects || []);
  };

  const deleteProject = async (project: ChatProject) => {
    if (!confirm(`Delete permanen project ${project.title} beserta file upload-nya?`)) return;
    const res = await fetch(`/api/chat/projects?id=${encodeURIComponent(project.id)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setError(data?.error || "Gagal delete project.");
    setProjects(data.projects || []);
  };

  const openChat = (project: ChatProject) => {
    window.location.href = `/dashboard/project-contexts/${encodeURIComponent(project.id)}`;
  };

  const chooseFile = (project: ChatProject) => {
    targetUploadProjectId.current = project.id;
    fileInputRef.current?.click();
  };

  const uploadFile = async (file: File) => {
    const projectId = targetUploadProjectId.current;
    if (!projectId) return;
    setUploadingProjectId(projectId);
    setError("");
    try {
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("file", file);
      const res = await fetch("/api/chat/projects/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal upload file context.");
      setProjects((prev) => prev.map((project) => project.id === data.project.id ? data.project : project));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingProjectId("");
      targetUploadProjectId.current = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Project Context</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-1">Ruang khusus untuk project ala Claude: instruksi, knowledge, dan daftar file upload dipisah dari Chat.</p>
        </div>
        <Button variant="outline" onClick={() => setShowArchived(v => !v)}><Archive className="mr-2 h-4 w-4" />{showArchived ? "Sembunyikan arsip" : "Tampilkan arsip"}</Button>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file); }} accept=".txt,.md,.markdown,.pdf,.csv,.json,.log,.yaml,.yml,.xml,.html,.png,.jpg,.jpeg,.webp,.tif,.tiff,text/*,application/pdf,image/*" />

      <Card>
        <CardHeader><CardTitle className="text-base">{form.id ? "Edit Project" : "Project Baru"}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-2"><Label>Nama project</Label><Input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Domain</Label><select value={form.domain} onChange={(e) => setForm(p => ({ ...p, domain: e.target.value as ProjectDomain }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="general">General</option><option value="work">Work</option><option value="personal">Personal</option><option value="business">Bisnis</option></select></div>
          </div>
          <div className="space-y-3">
            <div className="space-y-2"><Label>Instruksi project</Label><Textarea className="min-h-24" value={form.instruction} onChange={(e) => setForm(p => ({ ...p, instruction: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Knowledge / context</Label><Textarea className="min-h-24" value={form.knowledge} onChange={(e) => setForm(p => ({ ...p, knowledge: e.target.value }))} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(emptyForm)}>Reset</Button><Button onClick={saveProject} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Simpan</Button></div>
          </div>
        </CardContent>
      </Card>

      {loading ? <div className="text-sm text-muted-foreground">Memuat project...</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => <Card key={project.id} className={project.status === "archived" ? "opacity-60" : ""}>
          <CardHeader><CardTitle className="flex items-start justify-between gap-2 text-base"><span className="flex items-center gap-2"><FolderKanban className="h-4 w-4 text-primary" />{project.title}</span><Badge variant="outline">{project.status || "active"}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-2"><Badge>{domainLabel(project.domain)}</Badge><Badge variant="outline"><FileText className="mr-1 h-3 w-3" />{project.uploadedFiles?.length || 0} file</Badge></div>
            <p className="line-clamp-3 text-muted-foreground">{project.instruction || project.knowledge || "Belum ada instruksi/knowledge."}</p>
            {(project.uploadedFiles?.length || 0) > 0 && <div className="space-y-1">{project.uploadedFiles?.slice(0, 4).map(file => <div key={file.id} className="truncate rounded border px-2 py-1 text-xs text-muted-foreground">{file.name} · {Math.ceil(file.size / 1024)} KB</div>)}</div>}
            <div className="flex flex-wrap justify-end gap-2"><Button size="sm" onClick={() => openChat(project)}><MessageSquare className="mr-2 h-4 w-4" />Chat</Button><Button size="sm" variant="outline" onClick={() => chooseFile(project)} disabled={uploadingProjectId === project.id || project.status === "archived"}>{uploadingProjectId === project.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}Upload</Button><Button size="sm" variant="outline" onClick={() => editProject(project)}>Edit</Button><Button size="sm" variant="outline" onClick={() => void setStatus(project, project.status === "archived" ? "active" : "archived")}>{project.status === "archived" ? "Restore" : "Archive"}</Button><Button size="icon" variant="ghost" onClick={() => void deleteProject(project)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
          </CardContent>
        </Card>)}
      </div>}
    </div>
  );
}
