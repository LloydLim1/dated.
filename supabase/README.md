# Supabase migration boundary

Supabase is not connected to the local pilot. The active, additive schema is in `src/server/db.ts`; it is SQLite SQL and must not be pasted into Supabase.

The repository conversion and RLS/Storage acceptance gates are specified in `docs/production-plan.md`. No unexecuted PostgreSQL migration is presented as production-verified. Implement and validate that conversion against an actual Supabase project before deploying to Vercel.
