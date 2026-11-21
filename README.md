# Flowboard

Flowboard is a quiet, focused Kanban workspace for keeping personal project work moving. It starts each visitor in a Supabase anonymous session and stores tasks behind per-user PostgreSQL Row Level Security.

## Features

- Guest session creation and recovery through Supabase Auth.
- Four status columns with drag-and-drop and optimistic persistence.
- Create, edit, delete, and inspect tasks with status, priority, description, and due date.
- Search by title and filter by priority.
- User-created, color-coded labels, multi-label task assignment, and label filtering.
- Database-triggered task history for creation, status changes, priority changes, and title edits.
- Live task counts by workflow status and an overdue indicator.
- Responsive horizontally scrolling board, loading and error states, and action toasts.
- Persistent light and dark themes.
- Database isolation enforced by RLS for every read and write.

## Stack and structure

React 18, Vite, TypeScript, Tailwind CSS 4, dnd-kit, Supabase JS, date-fns, and Lucide React. `src/services/tasks.ts` owns task queries, `src/lib/supabase.ts` validates configuration, `src/components` contains task UI, and `supabase/schema.sql` defines storage and access rules. The app talks directly to Supabase; there is no custom server.

## Supabase setup

1. Create a Supabase project on the free tier.
2. For a new project, run [`supabase/schema.sql`](supabase/schema.sql) in **SQL Editor**.
3. For an existing project with tasks, run [`supabase/migrations/20261120_labels_activity.sql`](supabase/migrations/20261120_labels_activity.sql) in **SQL Editor**. This migration adds label and activity tables, policies, functions, and triggers without deleting or rebuilding task rows. Do not rerun a destructive reset; this migration is additive and safe to rerun.
4. After running either the fresh-project schema or the feature migration, run [`supabase/migrations/20261120_labels_activity_access_repair.sql`](supabase/migrations/20261120_labels_activity_access_repair.sql) in **SQL Editor**. It restores authenticated grants, verifies RLS remains enabled, and asks PostgREST to reload its schema cache. It does not alter rows or policies.
5. In **Authentication → Sign In / Providers**, enable **Anonymous Sign-Ins**. Anonymous accounts use the authenticated role and are isolated with `auth.uid()` policies.
6. Copy the Project URL and publishable/anon key from **Project Settings → API**. The browser key is public by design; RLS is the security boundary. Never use a service-role key in this app.
7. Copy `.env.example` to `.env` and fill the values:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
   ```

## Local development

```sh
npm install
npm run dev
```

The app presents setup guidance if environment values are missing. To check the production bundle:

```sh
npm run build
npm run preview
```

## Deployment

Deploy the repository to Vercel or Netlify using the default Vite build settings (`npm run build`, output directory `dist`). Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting provider's environment settings for the production environment, then redeploy. Configure the Supabase project's allowed redirect/site URL to include the deployed origin if your auth configuration requires it. No live deployment or GitHub repository is claimed by this source tree.

## Security

The client reuses Supabase's persisted session or calls `signInAnonymously()` when none exists. Every task, label, label association, and activity row is tied to the authenticated `user_id`. RLS restricts rows to `auth.uid()`. Composite foreign keys prevent a user from associating a label with another user's task. Activity rows are written by a constrained database trigger; authenticated clients receive read access but no direct write grants for the activity table. User identity is not simulated in local storage and client-side filtering is not the isolation boundary.

## Implemented advanced features

Title and priority filters, due-date indicators, status statistics, custom label creation, renaming, color editing, deletion, multi-label assignment and filtering, and a database-audited activity timeline are implemented. Deleting a label cascades only its task associations; tasks remain. Activity begins when the migration is installed; existing tasks are retained and do not receive synthetic history. Realtime sync is not included.

## Known limitations and future work

This is a single-user guest workspace; anonymous accounts have no account recovery or cross-device identity, so clearing browser storage can strand the guest's data. Reordering within a status column is not persisted; drag-and-drop changes status. Useful next steps are account linking, team workspaces, realtime collaboration, notifications, and richer activity history.
