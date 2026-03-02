import { NextAuthOptions, Session, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import axios from "axios";

/**
 * Decode the backend JWT (without verification) and check whether its `exp`
 * claim is in the past.  Returns `true` when the token is expired or
 * un-parseable so the caller treats it as invalid.
 */
function isBackendTokenExpired(accessToken?: string): boolean {
  if (!accessToken) return true;
  try {
    const payloadBase64 = accessToken.split(".")[1];
    if (!payloadBase64) return true;
    const payload = JSON.parse(
      Buffer.from(payloadBase64, "base64").toString("utf-8")
    );
    if (typeof payload.exp !== "number") return false; // no exp → assume valid
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true; // malformed → treat as expired
  }
}

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
    async jwt({ token, user }: { token: JWT & { accessToken?: string; user?: User; error?: string }; user?: User }) {
      if (user) {
        token.accessToken = (user as any).accessToken;
        token.user = user;
      }

      // On every subsequent call, verify the backend token hasn't expired
      if (isBackendTokenExpired(token.accessToken)) {
        token.error = "TokenExpired";
      }

      return token;
    },
    async session({ session, token }: { session: Session & { error?: string }; token: JWT & { accessToken?: string; user?: User; error?: string } }) {
      session.user = token.user as User;
      (session as Session & { accessToken?: string }).accessToken = token.accessToken;

      // Propagate token-level errors so the client can react
      if (token.error) {
        session.error = token.error;
      }

      return session;
    }
  },

  session: { strategy: "jwt", maxAge: 24 * 60 * 60 /* 24 hours */ },
  secret: process.env.NEXTAUTH_SECRET
};
