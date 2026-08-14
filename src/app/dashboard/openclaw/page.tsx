"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { confirmGuardedAction } from "@/lib/guardrails";
import { ActionToast, type ActionToastState } from "@/components/shared/action-toast";

export default function OpenClawDashboard() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<ActionToastState>(null);

  const currentItem = (value: Record<string, unknown> | undefined) => value || {};

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/openclaw");
      const data = await res.json();
      setItems(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (index: number) => {
    const item = currentItem(items[index]);
    const guard = confirmGuardedAction("approve-guardrail", { riskLevel: String(item?.risk_level || item?.riskLevel || "medium") });
    if (!guard.ok) return;
    setBusyIndex(index);
    const updated = [...items];
    updated[index].status = "APPROVED";
    setItems(updated);
    try {
      await fetch("/api/openclaw", {
        method: "POST",
        body: JSON.stringify({ data: updated }),
      });
      setToast({ type: "success", message: "OpenClaw item berhasil di-approve." });
    } catch {
      setToast({ type: "error", message: "Gagal approve item OpenClaw." });
    } finally {
      setBusyIndex(null);
    }
  };

  const handleReject = async (index: number) => {
    const item = currentItem(items[index]);
    const guard = confirmGuardedAction("reject-guardrail", { riskLevel: String(item?.risk_level || item?.riskLevel || "medium") });
    if (!guard.ok) return;
    setBusyIndex(index);
    const updated = [...items];
    updated[index].status = "REJECTED";
    setItems(updated);
    try {
      await fetch("/api/openclaw", {
        method: "POST",
        body: JSON.stringify({ data: updated }),
      });
      setToast({ type: "success", message: "OpenClaw item berhasil di-reject." });
    } catch {
      setToast({ type: "error", message: "Gagal reject item OpenClaw." });
    } finally {
      setBusyIndex(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] space-x-6 animate-in fade-in zoom-in-95">
      <Card className="flex-1 overflow-auto bg-slate-900/50 backdrop-blur-xl border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
             <span className="text-green-400">🕷️ OpenClaw</span> JSON Execution Hooks
          </CardTitle>
          <CardDescription>Live Reading: /root/.openclaw/exec-approvals.json</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
             <div className="text-center py-10 text-slate-500">Membaca file JSON...</div>
          ) : items.length === 0 ? (
             <div className="text-center py-10 text-slate-500">File Exec-Approvals kosong atau tidak ada.</div>
          ) : (
            items.map((item, i) => (
              <div key={i} className="p-4 bg-slate-800/40 rounded-lg border border-slate-700/50 flex justify-between items-start">
                 <div className="flex-1">
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">
                      {JSON.stringify(item, null, 2)}
                    </pre>
                 </div>
                 <div className="flex flex-col gap-2 ml-4">
                    <Button variant="default" disabled={busyIndex === i} className="bg-green-600/20 text-green-400 hover:bg-green-600/40" onClick={() => handleApprove(i)}>
                       Approve
                    </Button>
                    <Button variant="destructive" disabled={busyIndex === i} className="bg-red-600/20 text-red-500 hover:bg-red-600/40" onClick={() => handleReject(i)}>
                       Reject
                    </Button>
                 </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <ActionToast toast={toast} />
    </div>
  );
}
