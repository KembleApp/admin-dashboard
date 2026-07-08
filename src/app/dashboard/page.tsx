import Link from "next/link";
import { db } from "@/lib/db";
import ImportAmplitudeEmails from "@/components/ImportAmplitudeEmails";

export const dynamic = "force-dynamic"; // always show fresh data, never statically cache PII

function fmtDate(d: Date | null | undefined) {
  return d ? new Date(d).toLocaleString() : "—";
}

export default async function DashboardPage() {
  const users = await db.user.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      amplitudeProfile: true,
      wixContact: true,
      _count: { select: { typeformResponses: true } },
    },
  });

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-slate-600">
          {users.length} unified user{users.length === 1 ? "" : "s"}
        </h2>
        <ImportAmplitudeEmails />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Company / Title</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Amplitude last seen</th>
              <th className="px-4 py-3">Wix membership</th>
              <th className="px-4 py-3">Typeform responses</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/users/${u.id}`} className="font-medium text-slate-900 hover:underline">
                    {u.name ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3 text-slate-600">
                  {[u.jobTitle, u.company].filter(Boolean).join(" @ ") || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{u.location ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{fmtDate(u.amplitudeProfile?.lastSeenAt)}</td>
                <td className="px-4 py-3 text-slate-600">{u.wixContact?.membership ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{u._count.typeformResponses}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No users yet. Run a sync (top right) once your data sources are connected.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
