# Phase 1 setup

## Required environment variables

Set these in Vercel (and locally when testing):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_URL` (recommended for server-side Supabase calls; set this to the same turkanaCredit project URL as `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

## Build troubleshooting

If Vercel build fails with `Missing NEXT_PUBLIC_SUPABASE_URL environment variable` while collecting page data for `/api/auth/[...nextauth]`, ensure the variable is configured in Vercel for the target environment (Production / Preview / Development), then redeploy. If an admin server action or route points at the wrong Supabase project, verify that `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` both target the intended turkanaCredit project.

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` is used only in server-side modules and route handlers.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in browser/client code.
