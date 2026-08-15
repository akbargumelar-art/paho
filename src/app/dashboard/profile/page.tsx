"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Lock, Image as ImageIcon, Loader2, Save, Trash2, Upload, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Profile = { id: string; name: string; email: string; username: string; hasAvatar: boolean };
type Branding = { appName: string; hasLogo: boolean; updatedAt: string };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [appName, setAppName] = useState("");
  const [savingIdentity, setSavingIdentity] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [uploading, setUploading] = useState<"avatar" | "logo" | null>(null);
  // Bumped after every image write so the <img> refetches instead of showing
  // the stale cached file (same URL, new bytes).
  const [imageVersion, setImageVersion] = useState(() => Date.now());
  const avatarInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal memuat profil.");
      setProfile(json.profile);
      setBranding(json.branding);
      setName(json.profile.name || "");
      setUsername(json.profile.username || "");
      setAppName(json.branding.appName || "");
      setImageVersion(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const flash = (message: string) => {
    setNotice(message);
    setError("");
    window.setTimeout(() => setNotice(""), 4000);
  };

  const saveIdentity = async () => {
    setSavingIdentity(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, appName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal menyimpan.");
      await load();
      flash("Profil tersimpan.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingIdentity(false);
    }
  };

  const savePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      return;
    }
    setSavingPassword(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal ganti password.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      flash("Password berhasil diganti. Sesi lain di perangkat lain sudah dilogout.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingPassword(false);
    }
  };

  const uploadImage = async (kind: "avatar" | "logo", file: File) => {
    setUploading(kind);
    setError("");
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", file);
      const res = await fetch("/api/profile", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal upload.");
      await load();
      flash(kind === "avatar" ? "Foto profil diperbarui." : "Logo aplikasi diperbarui.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(null);
    }
  };

  const removeImage = async (kind: "avatar" | "logo") => {
    if (!confirm(kind === "avatar" ? "Hapus foto profil?" : "Hapus logo aplikasi?")) return;
    setError("");
    try {
      const res = await fetch(`/api/profile?kind=${kind}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal hapus.");
      await load();
      flash("Gambar dihapus.");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat profil...</div>;
  }

  return (
    <div className="space-y-5 fade-in-up">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">Profil &amp; Aplikasi</h1>
        <p className="mt-1 text-xs text-muted-foreground md:text-sm">Ganti nama, username, password, foto profil, dan logo aplikasi.</p>
      </div>

      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Identity */}
        <Card>
          <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-primary" /> Identitas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nama tampilan</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Akbar Gumelar" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Username login</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="abay" className="text-sm" />
              <p className="text-[10px] text-muted-foreground">Huruf kecil, angka, titik, garis bawah, strip. 3-32 karakter.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nama aplikasi</Label>
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="ASPRI" className="text-sm" />
              <p className="text-[10px] text-muted-foreground">Tampil di sidebar dan halaman login.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={profile?.email || ""} disabled className="text-sm opacity-70" />
              <p className="text-[10px] text-muted-foreground">Email tidak diubah dari sini.</p>
            </div>
            <Button size="sm" onClick={() => void saveIdentity()} disabled={savingIdentity} className="gap-1.5 text-xs">
              {savingIdentity ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan identitas
            </Button>
          </CardContent>
        </Card>

        {/* Password */}
        <Card>
          <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><Lock className="h-4 w-4 text-amber-500" /> Ganti Password</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Password lama</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Password baru</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" className="text-sm" />
              <p className="text-[10px] text-muted-foreground">Minimal 8 karakter.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ulangi password baru</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className={cn("text-sm", confirmPassword && confirmPassword !== newPassword && "border-destructive")}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Setelah ganti password, sesi di perangkat lain otomatis dilogout.</p>
            <Button
              size="sm"
              onClick={() => void savePassword()}
              disabled={savingPassword || !currentPassword || newPassword.length < 8 || newPassword !== confirmPassword}
              className="gap-1.5 text-xs"
            >
              {savingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} Ganti password
            </Button>
          </CardContent>
        </Card>

        {/* Images */}
        <Card className="lg:col-span-2">
          <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><ImageIcon className="h-4 w-4 text-sky-400" /> Foto Profil &amp; Logo Aplikasi</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {([
                { kind: "avatar" as const, label: "Foto profil", hint: "Tampil di kanan atas.", has: Boolean(profile?.hasAvatar), ref: avatarInput, round: true },
                { kind: "logo" as const, label: "Logo aplikasi", hint: "Tampil di sidebar & login.", has: Boolean(branding?.hasLogo), ref: logoInput, round: false },
              ]).map((item) => (
                <div key={item.kind} className="flex flex-col items-start gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
                  <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted", item.round ? "rounded-full" : "rounded-lg")}>
                    {item.has ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/profile/image?kind=${item.kind}&v=${imageVersion}`} alt={item.label} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.hint} PNG/JPG/WEBP/SVG, maks 2 MB.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        ref={item.ref}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadImage(item.kind, file);
                          e.target.value = "";
                        }}
                      />
                      <Button size="sm" variant="outline" onClick={() => item.ref.current?.click()} disabled={uploading === item.kind} className="h-8 gap-1 text-[11px]">
                        {uploading === item.kind ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload
                      </Button>
                      {item.has && (
                        <Button size="sm" variant="outline" onClick={() => void removeImage(item.kind)} className="h-8 gap-1 text-[11px] text-destructive">
                          <Trash2 className="h-3 w-3" /> Hapus
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
