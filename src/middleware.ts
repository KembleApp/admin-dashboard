export { default } from "next-auth/middleware";

// Everything under /dashboard requires a signed-in, allowlisted admin.
// Login and NextAuth's own API routes stay open so the auth flow can run.
export const config = {
  matcher: ["/dashboard/:path*"],
};
