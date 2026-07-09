import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import EditableField from "@/components/EditableField";
import CustomFieldRow from "@/components/CustomFieldRow";
import AddCustomField from "@/components/AddCustomField";

const userInclude = {
  amplitudeProfile: true,
  wixContact: true,
  typeformResponses: { orderBy: { submittedAt: "desc" as const } },
  customFieldValues: { include: { field: true } },
} satisfies Prisma.UserInclude;

type UserWithRelations = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-kemble-ink/10 bg-white p-5">
      <h3 className="font-display mb-3 text-base italic text-kemble-navy">{title}</h3>
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

type TypeformAnswer = {
  field?: { id?: string; type?: string; ref?: string };
  type?: string;
  text?: string;
  email?: string;
  choice?: { label?: string };
  choices?: { labels?: string[] };
  number?: number;
  boolean?: boolean;
  date?: string;
  url?: string;
  // The actual question text, resolved at sync time from the form's field
  // definitions (see fetchFieldTitles in lib/sync/typeform.ts). Answers
  // synced before that existed won't have it - re-run Sync now to backfill.
  question?: string;
};

function fmtTypeformAnswer(a: TypeformAnswer): string {
  if (a.text != null) return a.text;
  if (a.email != null) return a.email;
  if (a.choice?.label != null) return a.choice.label;
  if (a.choices?.labels?.length) return a.choices.labels.join(", ");
  if (a.number != null) return String(a.number);
  if (a.boolean != null) return a.boolean ? "Yes" : "No";
  if (a.date != null) return a.date;
  if (a.url != null) return a.url;
  return "—";
}

function PersonSections({ user }: { user: UserWithRelations }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl italic text-kemble-ink">{user.name ?? user.email}</h2>
        <p className="text-sm text-kemble-ink/50">{user.email}</p>
      </div>

      <Section title="Demographics / PII">
        <EditableField label="Name" value={user.name} userId={user.id} model="user" field="name" kind="string" />
        <Field label="Email" value={user.email} />
        <EditableField label="Phone" value={user.phone} userId={user.id} model="user" field="phone" kind="string" />
        <EditableField
          label="Location"
          value={user.location}
          userId={user.id}
          model="user"
          field="location"
          kind="string"
        />
        <EditableField
          label="Company"
          value={user.company}
          userId={user.id}
          model="user"
          field="company"
          kind="string"
        />
        <EditableField
          label="Job title"
          value={user.jobTitle}
          userId={user.id}
          model="user"
          field="jobTitle"
          kind="string"
        />
      </Section>

      <Section title="Custom fields">
        {user.customFieldValues.map((v) => (
          <CustomFieldRow
            key={v.fieldId}
            userId={user.id}
            fieldId={v.fieldId}
            fieldName={v.field.name}
            fieldType={v.field.type}
            labelOptions={v.field.labelOptions}
            value={v.value}
            labelValues={v.labelValues}
          />
        ))}
        <div className="mt-2">
          <AddCustomField userId={user.id} existingFieldIds={user.customFieldValues.map((v) => v.fieldId)} />
        </div>
      </Section>

      <Section title="Amplitude — app behavior">
        {user.amplitudeProfile ? (
          <>
            <Field label="Amplitude user ID" value={user.amplitudeProfile.amplitudeUserId} />
            <EditableField
              label="Platform"
              value={user.amplitudeProfile.platform}
              userId={user.id}
              model="amplitudeProfile"
              field="platform"
              kind="string"
            />
            <EditableField
              label="Device type"
              value={user.amplitudeProfile.deviceType}
              userId={user.id}
              model="amplitudeProfile"
              field="deviceType"
              kind="string"
            />
            <Field label="First seen" value={user.amplitudeProfile.firstSeenAt?.toLocaleString()} />
            <Field label="Last seen" value={user.amplitudeProfile.lastSeenAt?.toLocaleString()} />
            <EditableField
              label="Total events"
              value={user.amplitudeProfile.totalEvents}
              userId={user.id}
              model="amplitudeProfile"
              field="totalEvents"
              kind="number"
            />
            <EditableField
              label="Sessions (session_started)"
              value={user.amplitudeProfile.sessionCount}
              userId={user.id}
              model="amplitudeProfile"
              field="sessionCount"
              kind="number"
            />
            <EditableField
              label="Goals completed (goal_creation_completed)"
              value={user.amplitudeProfile.goalCompletedCount}
              userId={user.id}
              model="amplitudeProfile"
              field="goalCompletedCount"
              kind="number"
            />
            <EditableField
              label="Goals shared (goal_card_shared)"
              value={user.amplitudeProfile.goalSharedCount}
              userId={user.id}
              model="amplitudeProfile"
              field="goalSharedCount"
              kind="number"
            />
            <EditableField
              label="Partner invited (partner_invited)"
              value={user.amplitudeProfile.partnerInvitedCount}
              userId={user.id}
              model="amplitudeProfile"
              field="partnerInvitedCount"
              kind="number"
            />
            <Field
              label="Partner accepted (household_canvas_unlocked)"
              value={user.amplitudeProfile.partnerAcceptedAt?.toLocaleString() ?? "Not yet"}
            />
            <EditableField
              label="Partner UUID (accepted_by)"
              value={user.amplitudeProfile.partnerUuid}
              userId={user.id}
              model="amplitudeProfile"
              field="partnerUuid"
              kind="string"
            />

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
            <EditableField
              label="Source"
              value={user.wixContact.source}
              userId={user.id}
              model="wixContact"
              field="source"
              kind="string"
            />
            <Field label="Wix created date" value={user.wixContact.wixCreatedDate?.toLocaleDateString()} />
            <Field label="Last activity" value={user.wixContact.lastActivityAt?.toLocaleString()} />
            <EditableField
              label="Last activity type"
              value={user.wixContact.lastActivityType}
              userId={user.id}
              model="wixContact"
              field="lastActivityType"
              kind="string"
            />
            <EditableField
              label="Birthdate"
              value={user.wixContact.birthdate}
              userId={user.id}
              model="wixContact"
              field="birthdate"
              kind="string"
            />
            <EditableField
              label="Locale"
              value={user.wixContact.locale}
              userId={user.id}
              model="wixContact"
              field="locale"
              kind="string"
            />
            <EditableField
              label="Email subscription"
              value={user.wixContact.subscriptionStatus}
              userId={user.id}
              model="wixContact"
              field="subscriptionStatus"
              kind="string"
            />
            <Field
              label="Labels"
              value={
                Array.isArray(user.wixContact.labels) && user.wixContact.labels.length > 0
                  ? (user.wixContact.labels as string[]).join(", ")
                  : null
              }
            />

            {user.wixContact.extendedFields &&
              typeof user.wixContact.extendedFields === "object" &&
              Object.keys(user.wixContact.extendedFields as object).length > 0 && (
                <div className="mt-4">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Custom fields
                  </h4>
                  {Object.entries(user.wixContact.extendedFields as Record<string, unknown>).map(
                    ([key, value]) => (
                      <Field
                        key={key}
                        label={key}
                        value={typeof value === "object" ? JSON.stringify(value) : String(value)}
                      />
                    )
                  )}
                </div>
              )}
          </>
        ) : (
          <p className="text-sm text-slate-400">No Wix contact synced yet.</p>
        )}
      </Section>

      <Section title={`Typeform — ${user.typeformResponses.length} response(s)`}>
        {user.typeformResponses.length > 0 ? (
          <ul className="space-y-4">
            {user.typeformResponses.map((r) => {
              const answers = (r.answers as TypeformAnswer[] | null) ?? [];
              return (
                <li key={r.id} className="border-b border-slate-100 pb-3 last:border-0">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{r.formTitle ?? r.formId}</span>
                    <span className="text-slate-400">{r.submittedAt?.toLocaleDateString() ?? "—"}</span>
                  </div>
                  {/* Typeform has no per-response link - this opens the whole
                      form's results dashboard (requires Typeform login). */}
                  <a
                    href={`https://admin.typeform.com/form/${r.formId}/results`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 hover:underline"
                  >
                    View form results (Typeform login required) ↗
                  </a>
                  {answers.length > 0 && (
                    <ul className="mt-2 space-y-3">
                      {answers.map((a, i) => (
                        <li key={i} className="text-sm">
                          <p className="text-slate-500">
                            {a.question ?? a.field?.ref ?? a.field?.type ?? a.type ?? "—"}
                          </p>
                          <p className="text-slate-900">{fmtTypeformAnswer(a)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No Typeform responses matched yet.</p>
        )}
      </Section>
    </div>
  );
}

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const user = await db.user.findUnique({
    where: { id: params.id },
    include: {
      ...userInclude,
      partner: { include: userInclude },
    },
  });

  if (!user) notFound();

  return (
    <div className={`mx-auto space-y-4 ${user.partner ? "max-w-6xl" : "max-w-3xl"}`}>
      <Link href="/dashboard" className="text-sm text-kemble-ink/50 hover:underline">
        &larr; Back to all users
      </Link>

      {user.partner ? (
        <>
          <h1 className="font-display text-xl italic text-kemble-navy">
            Household: {user.name ?? user.email} &amp; {user.partner.name ?? user.partner.email}
          </h1>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PersonSections user={user} />
            <PersonSections user={user.partner} />
          </div>
        </>
      ) : (
        <PersonSections user={user} />
      )}
    </div>
  );
}
