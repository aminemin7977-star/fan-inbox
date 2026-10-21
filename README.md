# Fan Inbox

A private-message inbox for a content creator, in an iOS / glassmorphism style.
Fans send a message + photos with no login and track `Received → Read → Replied`.
The creator manages everything from a password-protected dashboard.

**Stack:** Next.js 15 (App Router) · React 19 · Tailwind CSS 3 · Framer Motion · Lucide · Supabase (Postgres + Storage)

## 1. Supabase setup

1. Create a project at supabase.com.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
   This creates the `messages` and `replies` tables, locks them down with RLS, and creates the private `fan-media` bucket.
3. **Project Settings → API** → copy the Project URL, `anon` key and `service_role` key.

## 2. Environment variables

Copy `.env.example` to `.env.local` (locally) or add the same variables in your host (e.g. Vercel → Project → Settings → Environment Variables):

| Variable | What |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public anon key (can only use signed upload URLs) |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret**, server only |
| `ADMIN_PASSWORD` | your dashboard password |
| `ADMIN_SESSION_SECRET` | random string, 32+ chars |
| `NEXT_PUBLIC_CREATOR_NAME` | name shown to fans |

## 3. Run

```bash
npm install
npm run dev        # http://localhost:3000
```

- Fans: `/`  → after sending they land on `/t/<secret-token>` (their private tracking page)
- Creator: `/admin` (redirects to `/admin/login`)

Deploy: push to GitHub and import the repo in Vercel (add the env vars above).

## How privacy works

- RLS is **enabled with no policies** on both tables and public roles have no grants → the public anon key can read nothing.
- All data access runs in server route handlers with the service-role key.
- Each submission gets a random 64-hex `tracking_token`. A fan can only load the thread for the token in their own link, so they can never see anyone else's messages.
- Images are in a **private** bucket. Uploads use one-time signed upload URLs; viewing uses short-lived signed URLs minted server-side.
- Admin auth: password → HMAC-signed, `httpOnly`, `sameSite=lax` cookie (7 days). The `/admin` page and every `/api/admin/*` route re-verify it server-side.
- Extras: honeypot field, per-IP rate limits (best-effort, in-memory), strict input validation, `Referrer-Policy: same-origin`, `noindex` on tracking pages.

## Live updates

Fan tracking pages poll every 4 s and the dashboard every 8 s (only while the tab is visible, and instantly on tab focus). This keeps the anon key powerless. If you later want push-style updates, add Supabase Realtime Broadcast from the API routes.

## Project structure

```
supabase/schema.sql            tables, RLS, storage bucket
src/app/page.tsx               fan submit form
src/app/t/[token]/page.tsx     fan tracking page (status stepper + replies)
src/app/admin/login/page.tsx   creator login
src/app/admin/page.tsx         server-gated dashboard route
src/app/api/…                  upload-url, messages, thread/[token], admin/*
src/components/                Dashboard, MessageSheet, StatusBadge, ImageGrid, Lightbox
src/lib/                       supabase clients, auth, helpers
```
