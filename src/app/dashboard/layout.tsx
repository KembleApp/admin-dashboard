import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";
import SyncButton from "@/components/SyncButton";

// Belt-and-suspenders alongside middleware.ts: also check the session
// server-side so this layout never renders PII without a valid admin.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-base font-semibold">User Admin Dashboard</h1>
          <p className="text-xs text-slate-500">Internal use only &middot; contains PII</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{session.user?.email}</span>
          <SyncButton />
          <SignOutButton />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
