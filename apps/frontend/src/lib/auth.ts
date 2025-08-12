import { NextAuthOptions, Session, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import axios from "axios";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const res = await axios.post("http://localhost:8080/api/v1/auth/login", {
            email: credentials?.email,
            password: credentials?.password
          });

          const user = res.data;
          if (user && user.token) {
            return {
              ...user,
              accessToken: user.token
            };
          }
          return null;
        } catch (err) {
          if (axios.isAxiosError(err)) {
            console.error("Login failed:", err.response?.data || err.message);
          } else if (err instanceof Error) {
            console.error("Login failed:", err.message);
          } else {
            console.error("An unexpected error occurred");
          }
          return null;
        }
      }
    })
  ],

  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        (token as JWT & { accessToken?: string; user?: User }).accessToken = (user as any).accessToken;
        (token as JWT & { accessToken?: string; user?: User }).user = user;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT & { accessToken?: string; user?: User } }) {
      session.user = token.user as User;
      (session as Session & { accessToken?: string }).accessToken = token.accessToken;
      return session;
    }
  },

  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET
};
