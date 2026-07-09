import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import ImportAmplitudeEmails from "@/components/ImportAmplitudeEmails";
import SearchBox from "@/components/SearchBox";

export const dynamic = "force-dynamic"; // always show fresh data, never statically cache PII

function fmtDate(d: Date | null | undefined) {
  return d ? new Date(d).toLocaleString() : "—";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q?.trim();
  const where: Prisma.UserWhereInput | undefined = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }
    : undefined;

  const users = await db.user.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      amplitudeProfile: true,
      _count: { select: { typeformResponses: true } },
    },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-kemble-ink/70 whitespace-nowrap">
          {users.length} unified user{users.length === 1 ? "" : "s"}
          {q && <span className="text-kemble-ink/40"> matching &quot;{q}&quot;</span>}
        </h2>
        <div className="flex items-center gap-3">
          <SearchBox />
          <ImportAmplitudeEmails />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-kemble-ink/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-kemble-ink/10 bg-kemble-cream text-xs uppercase tracking-wide text-kemble-ink/50">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Amplitude last seen</th>
              <th className="px-4 py-3">Typeform responses</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="group relative border-b border-kemble-ink/5 last:border-0 hover:bg-kemble-cream">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/users/${u.id}`} className="font-medium text-kemble-ink hover:underline">
                    {u.name ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-kemble-ink/60">{u.email}</td>
                <td className="px-4 py-3 text-kemble-ink/60">{fmtDate(u.amplitudeProfile?.lastSeenAt)}</td>
                <td className="px-4 py-3 text-kemble-ink/60">{u._count.typeformResponses}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/dashboard/users/${u.id}`}
                    className="opacity-0 transition-opacity group-hover:opacity-100 text-sm font-medium text-kemble-ink hover:underline whitespace-nowrap"
                  >
                    View details →
                  </Link>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-kemble-ink/40">
                  {q
                    ? `No users match "${q}".`
                    : "No users yet. Run a sync (top right) once your data sources are connected."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
