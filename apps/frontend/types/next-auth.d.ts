import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      user?: {
        email?: string;
        first_name?: string;
        // Add other custom fields
      };
      accessToken?: string;
    } & DefaultSession["user"];
  }
}