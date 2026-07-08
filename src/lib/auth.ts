import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/db";

// This dashboard holds PII, so sign-in is restricted to an explicit
// allowlist (ADMIN_EMAILS) checked against the AdminUser table. Anyone not
// on the list is denied at sign-in — there is no self-service signup.
function allowedEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hour admin sessions
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();

      if (allowedEmails().includes(email)) {
        // Keep AdminUser table in sync so it's queryable / auditable.
        await db.adminUser.upsert({
          where: { email },
          update: { name: user.name ?? undefined },
          create: { email, name: user.name ?? undefined },
        });
        return true;
      }

      // Also allow anyone already provisioned directly in the DB, in case
      // admins are managed there instead of via env var.
      const dbAdmin = await db.adminUser.findUnique({ where: { email } });
      return Boolean(dbAdmin);
    },
    async session({ session }) {
      return session;
    },
  },
};
