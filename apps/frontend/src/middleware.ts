export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Protect every route EXCEPT:
     *  – /signin, /signup, /reset-password, /verification
     *  – /api/auth (NextAuth endpoints)
     *  – _next (static assets), favicon, public images
     */
    "/((?!signin|signup|reset-password|verification|api/auth|_next/static|_next/image|favicon\\.ico).*)",
  ],
}
