import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";
import SyncButton from "@/components/SyncButton";
import AiChatWidget from "@/components/AiChatWidget";

// Belt-and-suspenders alongside middleware.ts: also check the session
// server-side so this layout never renders PII without a valid admin.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-kemble-ink/10 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Image src="/kemble-mark.png" alt="" width={28} height={28} priority />
          <div>
            <h1 className="font-display text-lg italic text-kemble-ink">User Admin Dashboard</h1>
            <p className="text-xs text-kemble-ink/50">Internal use only &middot; contains PII</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-kemble-ink/60">{session.user?.email}</span>
          <SyncButton />
          <SignOutButton />
        </div>
      </header>
      <main className="p-6">{children}</main>
      <AiChatWidget />
    </div>
  );
}
