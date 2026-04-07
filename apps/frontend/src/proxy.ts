import middleware from "next-auth/middleware";

export default function proxy(req: any, event: any) {
  return middleware(req, event);
}

export const config = {
  matcher: [
    /*
     * Protect every route EXCEPT:
     *  – /signin, /signup, /reset-password, /verification, /onboarding
     *  – /api/auth (NextAuth endpoints)
     *  – _next (static assets), favicon, public images
     */
    "/((?!signin|signup|reset-password|verification|onboarding|api/auth|_next/static|_next/image|favicon\\.ico).*)",
  ],
}
