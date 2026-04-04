import { LoginScreen } from "@/components/auth/login-screen"
import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/api-auth"

export default async function LoginPage() {
  const session = await getAuthSession()

  if (session) {
    redirect("/dashboard")
  }

  return <LoginScreen />
}
