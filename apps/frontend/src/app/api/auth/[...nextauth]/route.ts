import NextAuth from "next-auth"
import { authOptions as baseAuthOptions } from "@/lib/auth"

const authOptions = {
  ...baseAuthOptions,
  pages: {
    signIn: "/signin",
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
