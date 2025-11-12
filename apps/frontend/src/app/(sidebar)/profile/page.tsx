// app/profile/page.tsx
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import ProfileClient from "@/components/ProfileClient"
import { redirect } from "next/navigation"

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/signin") 
  }

  return <ProfileClient  /> 
}
