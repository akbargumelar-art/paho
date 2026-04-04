import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/api-auth"

export default async function HomePage() {
  const session = await getAuthSession()

  if (session) {
    redirect("/dashboard")
  }

  redirect("/login")
}
