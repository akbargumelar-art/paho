"use client";

import { useEffect, useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import { Folder, File, ChevronRight, ChevronDown, Save, Terminal, Play, FolderTree, FolderPlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type FSItem = { name: string; path: string; isDirectory: boolean; children?: FSItem[]; isOpen?: boolean };

export default function VibeCodePage() {
  const [rootPath, setRootPath] = useState("/root/paho");
  const [root, setRoot] = useState<FSItem | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [code, setCode] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchCmd, setLaunchCmd] = useState("npx serve -p $PORT .");
  
  const loadDir = async (path: string) => {
    const res = await fetch(`/api/vibe/files?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.items as FSItem[];
  };

  const initTree = async () => {
    try {
      const items = await loadDir(rootPath);
      const rootName = rootPath.split("/").pop() || rootPath;
      setRoot({ name: rootName, path: rootPath, isDirectory: true, isOpen: true, children: items });
    } catch (e) {
      setRoot(null);
    }
  };

  useEffect(() => { initTree(); }, [rootPath]);

  const toggleFolder = async (node: FSItem, currentTree: FSItem): Promise<FSItem> => {
    if (currentTree.path === node.path) {
      if (!currentTree.isOpen && (!currentTree.children || currentTree.children.length === 0)) {
        currentTree.children = await loadDir(currentTree.path);
      }
      return { ...currentTree, isOpen: !currentTree.isOpen };
    }
    if (currentTree.children) {
      return { ...currentTree, children: await Promise.all(currentTree.children.map(c => toggleFolder(node, c))) };
    }
    return currentTree;
  };

  const handleFolderClick = async (node: FSItem) => {
    if (!root) return;
    const newRoot = await toggleFolder(node, root);
    setRoot(newRoot);
  };

  const handleFileClick = async (path: string) => {
    const res = await fetch(`/api/vibe/files?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    setActiveFile(path);
    setCode(data.content || "");
  };

  const saveFile = async () => {
    if (!activeFile) return;
    setSaving(true);
    await fetch("/api/vibe/files", {
      method: "POST",
      body: JSON.stringify({ path: activeFile, content: code })
    });
    setSaving(false);
  };

  const createFolder = async () => {
    setSaving(true);
    try {
      await fetch("/api/vibe/files", {
        method: "POST",
        body: JSON.stringify({ action: "mkdir", path: rootPath })
      });
      initTree();
    } finally {
      setSaving(false);
    }
  };

  const launchApp = async () => {
    setLaunching(true);
    try {
      const res = await fetch("/api/vibe/run", {
        method: "POST",
        body: JSON.stringify({ path: rootPath, command: launchCmd.replace("$PORT", "3000") }) // Port will be replaced by backend
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        alert(data.error || "Failed to launch");
      }
    } finally {
      setLaunching(false);
    }
  };

  const getLanguage = (filename: string) => {
    if (filename.endsWith(".tsx") || filename.endsWith(".ts")) return "typescript";
    if (filename.endsWith(".js") || filename.endsWith(".jsx")) return "javascript";
    if (filename.endsWith(".json")) return "json";
    if (filename.endsWith(".css")) return "css";
    if (filename.endsWith(".html")) return "html";
    if (filename.endsWith(".md")) return "markdown";
    if (filename.endsWith(".py")) return "python";
    return "plaintext";
  };

  const renderTree = (nodes: FSItem[], depth = 0) => {
    return nodes.map(node => (
      <div key={node.path}>
        <div 
          className={`flex items-center py-1 px-2 cursor-pointer hover:bg-white/10 text-xs ${activeFile === node.path ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => node.isDirectory ? handleFolderClick(node) : handleFileClick(node.path)}
        >
          {node.isDirectory ? (
            <>
              {node.isOpen ? <ChevronDown className="w-3.5 h-3.5 mr-1" /> : <ChevronRight className="w-3.5 h-3.5 mr-1" />}
              <Folder className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
            </>
          ) : (
            <>
              <div className="w-4 h-4 mr-1"></div>
              <File className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
            </>
          )}
          <span className="truncate">{node.name}</span>
        </div>
        {node.isDirectory && node.isOpen && node.children && renderTree(node.children, depth + 1)}
      </div>
    ));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] w-full overflow-hidden fade-in-up">
      {/* Top Workspace Config */}
      <div className="bg-[#111] border border-border rounded-t-lg p-2 flex items-center gap-3">
        <FolderTree className="w-4 h-4 text-muted-foreground ml-2" />
        <input 
          type="text" 
          value={rootPath}
          onChange={e => setRootPath(e.target.value)}
          className="bg-black border border-border rounded px-3 py-1.5 text-sm text-white w-64 focus:outline-none focus:border-primary"
          placeholder="/root/project-name"
        />
        <Button size="sm" variant="ghost" onClick={initTree} className="h-8 px-2 text-muted-foreground hover:text-white">
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={createFolder} disabled={saving} className="h-8 text-xs gap-1.5">
          <FolderPlus className="w-3.5 h-3.5" /> Buat Folder
        </Button>
        <div className="flex-1"></div>
        <input 
          type="text" 
          value={launchCmd}
          onChange={e => setLaunchCmd(e.target.value)}
          className="bg-black border border-border rounded px-3 py-1.5 text-xs text-white w-48 focus:outline-none focus:border-primary hidden md:block"
          placeholder="npx serve -p $PORT ."
        />
        <Button size="sm" onClick={launchApp} disabled={launching} className="h-8 text-xs bg-emerald-900 hover:bg-emerald-800 text-emerald-100 gap-1.5 mr-2">
          <Play className="w-3.5 h-3.5" /> {launching ? "Mencari Port..." : "Auto Launch & Preview"}
        </Button>
      </div>

      {/* IDE Body */}
      <div className="flex flex-1 border border-t-0 border-border rounded-b-lg overflow-hidden bg-black">
        {/* Sidebar File Tree */}
        <div className="w-64 border-r border-border bg-[#0d0d0d] flex flex-col">
          <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
            {root ? renderTree([root]) : (
              <div className="text-center p-4 text-muted-foreground text-xs">
                Folder tidak ditemukan.<br/>Klik &quot;Buat Folder&quot;.
              </div>
            )}
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col">
          {/* Editor Top Bar */}
          <div className="h-10 border-b border-border bg-[#111] flex items-center justify-between px-4">
            <div className="text-sm font-medium text-white/70 truncate flex-1">
              {activeFile || "Select a file to edit"}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveFile} disabled={!activeFile || saving} className="h-7 text-xs gap-1.5">
                <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1">
            {activeFile ? (
               <Editor
                 height="100%"
                 language={getLanguage(activeFile)}
                 theme="vs-dark"
                 value={code}
                 onChange={(val) => setCode(val || "")}
                 options={{
                   minimap: { enabled: false },
                   fontSize: 13,
                   fontFamily: "JetBrains Mono, monospace",
                   wordWrap: "on",
                   padding: { top: 16 }
                 }}
               />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                <div className="text-center">
                  <Terminal className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Welcome to Hermes Vibe Coding</p>
                  <p className="text-xs mt-2 opacity-60">Pilih file atau minta agent untuk menulis kode.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
