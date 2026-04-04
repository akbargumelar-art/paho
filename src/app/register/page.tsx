"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"

export default function RegisterAdmin() {
  const [msg, setMsg] = useState("");

  const handleRegister = async () => {
    setMsg("Mendaftarkan admin...");
    try {
      const result = await authClient.signUp.username({
          username: "admin",
          password: "admin",
          name: "Administrator"
      });
      
      if (result.error) {
         setMsg("Error: " + result.error.message);
      } else {
         setMsg("Sukses! Anda sekarang bisa login.");
      }
    } catch (e: any) {
      setMsg("Error fatal: " + e.message);
    }
  }

  return (
    <div className="p-10 font-mono">
       <h1 className="text-xl mb-4">Setup Admin Reset</h1>
       <p className="mb-4">Klik tombol di bawah ini langsung dari browser Anda untuk melewati proteksi keamanan Better Auth.</p>
       <button onClick={handleRegister} className="bg-blue-500 text-white px-4 py-2 rounded">
         Buat Akun Admin
       </button>
       <p className="mt-4 text-red-500 font-bold">{msg}</p>
    </div>
  )
}
