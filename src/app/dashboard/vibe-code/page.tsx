"use client";

import { useEffect, useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import { Folder, File, ChevronRight, ChevronDown, Save, Terminal, Play, FolderTree, FolderPlus, RefreshCw, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type FSItem = { name: string; path: string; isDirectory: boolean; children?: FSItem[]; isOpen?: boolean };
type Message = { role: "user" | "assistant"; content: string; id: string };

export default function VibeCodePage() {
  // IDE State
  const [rootPath, setRootPath] = useState("/root/paho");
  const [root, setRoot] = useState<FSItem | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [code, setCode] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchCmd, setLaunchCmd] = useState("npx serve -l $PORT .");
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "assistant", content: "Halo abay! Mau dibikinkan aplikasi apa hari ini? Sebutkan nama file atau instruksinya di sini." }
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
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
        body: JSON.stringify({ path: rootPath, command: launchCmd.replace("$PORT", "3000") })
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

  const handleSendChat = async () => {
    if (!input.trim() || sending) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      // Connect to Paho's existing generic chat API
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          // Add system prompt context so agent knows it's vibe coding
          systemOverride: `Kamu adalah asisten Vibe Coding yang dijalankan dari Paho IDE. Workspace aktif user saat ini: ${rootPath}. Jika user meminta kamu membuat/mengedit file, kamu harus membalas dengan OK lalu menggunakan terminal (via Hermes) di belakang layar (jika ini terhubung dengan agent nyata). Untuk saat ini, Paho Chat sekadar simulasi chat antarmuka, sampaikan bahwa kamu mengerti instruksi.`,
          model: "hermes"
        })
      });

      if (!res.ok) throw new Error("Failed to send message");

      // Handle streaming response if applicable, or plain json
      // For simplicity in MVP, assuming a JSON reply or simple text stream
      // Since standard /api/chat might be stream, let's just read it simply
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = "";
      
      const msgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: msgId, role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          // Parse basic chunk if needed, assuming plain text chunks for now 
          // or standard vercel ai sdk stream data format (0:"text")
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('0:')) {
              try {
                const text = JSON.parse(line.substring(2));
                assistantMsg += text;
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: assistantMsg } : m));
              } catch (e) {}
            }
          }
        }
      }
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "Maaf, koneksi ke Agent gagal." }]);
    } finally {
      setSending(false);
      // Refresh file tree in case agent created files
      setTimeout(() => initTree(), 2000);
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
          placeholder="npx serve -l $PORT ."
        />
        <Button size="sm" onClick={launchApp} disabled={launching} className="h-8 text-xs bg-emerald-900 hover:bg-emerald-800 text-emerald-100 gap-1.5 mr-2">
          <Play className="w-3.5 h-3.5" /> {launching ? "Mencari Port..." : "Auto Launch & Preview"}
        </Button>
      </div>

      {/* IDE Body */}
      <div className="flex flex-1 border border-t-0 border-border rounded-b-lg overflow-hidden bg-black">
        
        {/* Sidebar File Tree */}
        <div className="w-56 border-r border-border bg-[#0d0d0d] flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
            {root ? renderTree([root]) : (
              <div className="text-center p-4 text-muted-foreground text-xs">
                Folder tidak ditemukan.<br/>Klik &quot;Buat Folder&quot;.
              </div>
            )}
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
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

        {/* Right Sidebar - AI Chat */}
        <div className="w-80 border-l border-border bg-[#0a0a0a] flex flex-col shrink-0">
          <div className="h-10 border-b border-border bg-[#111] flex items-center px-4">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Agent Vibe Chat</span>
          </div>
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin text-sm">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-3 py-2 rounded-lg max-w-[90%] whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border'}`}>
                  {m.content}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 mx-1 opacity-50">
                  {m.role === 'user' ? 'You' : 'Agent'}
                </span>
              </div>
            ))}
            {sending && (
              <div className="flex items-start">
                <div className="px-3 py-2 rounded-lg bg-muted border border-border flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Mengetik...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-3 bg-[#111] border-t border-border">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder="Instruksikan perubahan..."
                className="flex-1 bg-black border border-border rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-primary resize-none h-10 scrollbar-none"
                rows={1}
              />
              <Button size="icon" onClick={handleSendChat} disabled={sending || !input.trim()} className="h-10 w-10 shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground text-center mt-2">
              Tekan Enter untuk kirim. Perubahan file otomatis terlihat.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
