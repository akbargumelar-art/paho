import { db } from "../src/db";
import { user, account } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../src/lib/auth";

async function createAdmin() {
  console.log("Menghapus user admin lama (jika ada)...");
  await db.delete(account).where(eq(account.userId, "admin-user-001")).execute();
  await db.delete(user).where(eq(user.username, "admin")).execute();
  await db.delete(user).where(eq(user.id, "admin-user-001")).execute();

  console.log("Membuat user admin baru via Better Auth...");
  
  // Create user via Better Auth core API to ensure correct password hashing
  try {
    const response = await auth.api.signUpUsername({
      body: {
        username: "admin",
        password: "admin",
        name: "Admin"
      }
    });
    console.log("✅ Admin berhasil dibuat!", response);
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
       console.log("Admin sudah ada di sistem auth.");
    } else {
       console.error("Gagal membuat admin:", err);
    }
  }
  process.exit(0);
}

createAdmin();
