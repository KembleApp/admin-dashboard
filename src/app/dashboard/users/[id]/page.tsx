import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1.5 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900">{value ?? "—"}</span>
    </div>
  );
}

type RecentEvent = {
  event_type?: string;
  event_time?: string;
  platform?: string;
  device_type?: string;
};

// Amplitude's event_time is UTC but formatted without a zone
// ("YYYY-MM-DD HH:mm:ss.SSSSSS"), so parse it as UTC explicitly rather
// than letting `new Date()` apply the server's local offset.
function fmtAmplitudeTime(t: string | undefined) {
  if (!t) return "—";
  const iso = t.replace(" ", "T").replace(/(\.\d{3})\d*$/, "$1") + "Z";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? t : d.toLocaleString();
}

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const user = await db.user.findUnique({
    where: { id: params.id },
    include: {
      amplitudeProfile: true,
      wixContact: true,
      typeformResponses: { orderBy: { submittedAt: "desc" } },
    },
  });

  if (!user) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:underline">
        &larr; Back to all users
      </Link>

      <div>
        <h2 className="text-xl font-semibold">{user.name ?? user.email}</h2>
        <p className="text-sm text-slate-500">{user.email}</p>
      </div>

      <Section title="Demographics / PII">
        <Field label="Name" value={user.name} />
        <Field label="Email" value={user.email} />
        <Field label="Phone" value={user.phone} />
        <Field label="Location" value={user.location} />
        <Field label="Company" value={user.company} />
        <Field label="Job title" value={user.jobTitle} />
      </Section>

      <Section title="Amplitude — app behavior">
        {user.amplitudeProfile ? (
          <>
            <Field label="Amplitude user ID" value={user.amplitudeProfile.amplitudeUserId} />
            <Field label="Platform" value={user.amplitudeProfile.platform} />
            <Field label="Device type" value={user.amplitudeProfile.deviceType} />
            <Field
              label="First seen"
              value={user.amplitudeProfile.firstSeenAt?.toLocaleString()}
            />
            <Field label="Last seen" value={user.amplitudeProfile.lastSeenAt?.toLocaleString()} />
            <Field label="Total events" value={user.amplitudeProfile.totalEvents} />
            <Field label="Sessions (session_started)" value={user.amplitudeProfile.sessionCount} />
            <Field
              label="Goals completed (goal_creation_completed)"
              value={user.amplitudeProfile.goalCompletedCount}
            />
            <Field label="Goals shared (goal_card_shared)" value={user.amplitudeProfile.goalSharedCount} />
            <Field
              label="Partner invited (partner_invited)"
              value={user.amplitudeProfile.partnerInvitedCount}
            />
            <Field
              label="Partner accepted (household_canvas_unlocked)"
              value={user.amplitudeProfile.partnerAcceptedAt?.toLocaleString() ?? "Not yet"}
            />
            <Field label="Partner UUID (accepted_by)" value={user.amplitudeProfile.partnerUuid} />

            {(() => {
              const events = (user.amplitudeProfile.recentEvents as RecentEvent[] | null) ?? [];
              if (events.length === 0) return null;
              const top5 = [...events].reverse().slice(0, 5);
              return (
                <div className="mt-4">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Top 5 most recent events
                  </h4>
                  <ul className="space-y-1">
                    {top5.map((e, i) => (
                      <li
                        key={i}
                        className="flex justify-between border-b border-slate-100 py-1.5 text-sm last:border-0"
                      >
                        <span className="font-medium text-slate-900">{e.event_type ?? "—"}</span>
                        <span className="text-slate-400">{fmtAmplitudeTime(e.event_time)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </>
        ) : (
          <p className="text-sm text-slate-400">No Amplitude data synced yet.</p>
        )}
      </Section>

      <Section title="Wix — contact & commerce">
        {user.wixContact ? (
          <>
            <Field label="Wix contact ID" value={user.wixContact.wixContactId} />
            <Field label="Membership" value={user.wixContact.membership} />
          </>
        ) : (
          <p className="text-sm text-slate-400">No Wix contact synced yet.</p>
        )}
      </Section>

      <Section title={`Typeform — ${user.typeformResponses.length} response(s)`}>
        {user.typeformResponses.length > 0 ? (
          <ul className="space-y-2">
            {user.typeformResponses.map((r) => (
              <li key={r.id} className="border-b border-slate-100 pb-2 text-sm last:border-0">
                <div className="flex justify-between">
                  <span className="font-medium">{r.formTitle ?? r.formId}</span>
                  <span className="text-slate-400">{r.submittedAt?.toLocaleDateString() ?? "—"}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No Typeform responses matched yet.</p>
        )}
      </Section>
    </div>
  );
}
