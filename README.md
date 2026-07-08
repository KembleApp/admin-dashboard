# User Admin Dashboard

Internal-only dashboard unifying users across Amplitude (behavior), Wix
(contacts/commerce) and Typeform (form responses), matched by email into a
single profile per person.

**Access model:** authenticated admins only (Google SSO + email allowlist).
There is no public/anonymous access — see the security notes below before
deploying anywhere.

## About the Typeform token in this repo

`.env.local` currently contains a real Typeform personal access token that
was pasted directly into a Claude chat. Two things to do before this goes
anywhere near production:

1. **Rotate it.** Anything shared in a chat session should be treated as
   potentially exposed — generate a fresh token in Typeform (Account →
   Personal tokens), put the new one in `.env.local`, revoke the old one.
2. **Never commit `.env.local`.** It's already in `.gitignore`; keep it
   that way. Use your host's secret manager (Vercel env vars, etc.) for
   deployed environments instead of shipping the file.

## What's implemented vs. stubbed

| Source    | Status | Notes |
|-----------|--------|-------|
| Typeform  | Working, untested | Code is complete and calls the real API, but this sandbox has no network access to Typeform, so it's never actually been run. Run `npm run sync:typeform` yourself first. |
| Amplitude | Stub | Needs `AMPLITUDE_API_KEY` / `AMPLITUDE_SECRET_KEY` (direct API creds from Amplitude project settings — separate from any Amplitude connector authorized inside Cowork/Claude, which a deployed app can't reuse). The Export API returns gzipped/zipped NDJSON; unzip/gunzip parsing is left as a TODO in `src/lib/sync/amplitude.ts`. |
| Wix       | Stub | Needs `WIX_API_KEY` / `WIX_SITE_ID` from the Wix Developers Center (separate from any Wix connector in Cowork/Claude, same reasoning as above). Response field names are best-effort from docs — verify against a real API response. |

## Setup

1. `npm install`
2. Provision a Postgres database (Supabase, Neon, RDS, local — anything),
   set `DATABASE_URL` in `.env.local`.
3. `npx prisma migrate dev --name init` to create the schema.
4. Create a Google OAuth client (console.cloud.google.com → APIs &
   Credentials) with a redirect URI of
   `http://localhost:3000/api/auth/callback/google` for local dev. Put the
   client ID/secret in `.env.local`. Generate `NEXTAUTH_SECRET` with
   `openssl rand -base64 32`.
5. Set `ADMIN_EMAILS` to a comma-separated allowlist of who's allowed in.
6. Rotate and re-set `TYPEFORM_TOKEN` (see above).
7. `npm run dev`, sign in, click "Sync now" to pull Typeform data.
8. Fill in Amplitude/Wix creds and finish the TODOs in
   `src/lib/sync/amplitude.ts` and `src/lib/sync/wix.ts` when ready.

## Deploying

Any Next.js host works (Vercel is the path of least resistance). Set all
`.env.local` values as environment variables on the host — do not bake
secrets into the build. Point `NEXTAUTH_URL` at the real domain and add
its `/api/auth/callback/google` URL to the Google OAuth client's
authorized redirects.

For keeping data fresh, replace manual "Sync now" clicks with a scheduled
job (Vercel Cron, GitHub Actions, etc.) that POSTs to `/api/sync` — that
route currently only checks for *any* valid admin session, so if you
automate it, add a separate secret-header check rather than relying on a
browser session.

## Security notes (read before making this reachable outside localhost)

- This app is intentionally **not** public. If requirements change and it
  needs to be reachable by non-admins, that's a different design (data
  masking, per-field access control, audit logging, rate limiting) — flag
  it before deploying, don't just remove the auth check.
- PII fields (email, phone, address, name) are stored in plaintext in
  Postgres. If your compliance posture requires encryption at rest, use
  your DB host's built-in encryption (most managed Postgres providers
  offer this) or add field-level encryption.
- There's no audit log yet of which admin viewed which user. Add one
  (e.g. a `AdminAccessLog` table written on each `/dashboard/users/[id]`
  view) if that's a requirement for your data handling policy.
- No rate limiting or CSRF protection beyond what NextAuth provides by
  default — fine for an internal tool behind SSO, worth revisiting if
  exposure changes.
