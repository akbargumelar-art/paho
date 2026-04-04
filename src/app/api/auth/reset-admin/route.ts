import { NextResponse } from "next/server";
import { db } from "@/db";
import { user, account } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    // 1. Hapus akun admin yang lama (sebab hashing yang lama tidak cocok dengan Better Auth Core)
    await db.delete(account).where(eq(account.userId, "admin-user-001"));
    await db.delete(user).where(eq(user.username, "admin"));
    await db.delete(user).where(eq(user.id, "admin-user-001"));

    // 2. Buat akun admin baru via HTTP request internal ke Better Auth endpoint
    const res = await fetch("http://localhost:3000/api/auth/sign-up/username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        password: "admin",
        name: "Admin",
      }),
    });
    
    if (!res.ok) {
       const text = await res.text();
       throw new Error(`Gagal membuat uesr ` + text);
    }

    return NextResponse.json({ success: true, message: "Admin berhasil direset. Silakan kembali ke /login" });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err.message });
  }
}
