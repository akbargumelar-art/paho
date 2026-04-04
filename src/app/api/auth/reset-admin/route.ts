import { NextResponse } from "next/server";
import { db } from "@/db";
import { user, account } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    // 1. Hapus akun admin yang lama (sebab hashing yang lama tidak cocok dengan Better Auth Core)
    await db.delete(account).where(eq(account.userId, "admin-user-001"));
    await db.delete(user).where(eq(user.username, "admin"));
    await db.delete(user).where(eq(user.id, "admin-user-001"));

    // 2. Buat akun admin baru dengan fungsi native dari Better Auth
    await auth.api.signUpUsername({
      body: {
        username: "admin",
        password: "admin",
        name: "Admin"
      }
    });

    return NextResponse.json({ success: true, message: "Admin berhasil direset. Silakan kembali ke /login" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
