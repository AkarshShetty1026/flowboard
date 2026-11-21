# Flowboard — Task Manager Assessment

## Project Overview

Flowboard is a responsive Kanban task board for a personal project workspace. Visitors enter through Supabase anonymous authentication, then create and manage tasks across To Do, In Progress, In Review, and Done. Search, priority and label filters, due dates, color-coded labels, workflow metrics, and database-audited task history help users keep track of work.

## Design Decisions

The interface uses a cool, low-contrast neutral foundation with a restrained violet accent and muted status and priority colors, with a persistent light/dark theme toggle. Manrope headings and DM Sans interface text establish hierarchy without crowding the board. Task details open in a slide-over editor with label assignment and an activity timeline; columns accept pointer or keyboard drag-and-drop, while the editor's status selector offers an accessible alternative. On small screens, the sidebar becomes a drawer and the board scrolls horizontally so cards remain usable.

## Live Demo

Not deployed yet. Add the real deployment URL here after publishing.

## GitHub Repository

Not published yet. Add the real repository URL here after pushing.

## Database Schema

Complete fresh-project schema (also in `supabase/schema.sql`):

``sql
-- Flowboard task board schema. Run in the Supabase SQL Editor on a fresh project.
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'in_review', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date,
  position integer not null default 0,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_status_position_idx on public.tasks (user_id, status, position);
create index if not exists tasks_user_due_date_idx on public.tasks (user_id, due_date) where due_date is not null;
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
alter table public.tasks enable row level security;
revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;
drop policy if exists "Users can read their own tasks" on public.tasks;
drop policy if exists "Users can create their own tasks" on public.tasks;
drop policy if exists "Users can update their own tasks" on public.tasks;
drop policy if exists "Users can delete their own tasks" on public.tasks;
create policy "Users can read their own tasks" on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own tasks" on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own tasks" on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own tasks" on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);

-- User-owned labels and task-label associations. Existing task rows are untouched.
create unique index if not exists tasks_id_user_id_uidx on public.tasks (id, user_id);

create table if not exists public.task_labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 32),
  color text not null default '#8b7df6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index if not exists task_labels_user_name_uidx on public.task_labels (user_id, lower(name));

create table if not exists public.task_label_assignments (
  task_id uuid not null,
  label_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, label_id),
  foreign key (task_id, user_id) references public.tasks(id, user_id) on delete cascade,
  foreign key (label_id, user_id) references public.task_labels(id, user_id) on delete cascade
);
create index if not exists task_label_assignments_label_idx on public.task_label_assignments (label_id, user_id);

alter table public.task_labels enable row level security;
alter table public.task_label_assignments enable row level security;
revoke all on public.task_labels, public.task_label_assignments from public, anon;
grant select, insert, update, delete on public.task_labels to authenticated;
grant select, insert, delete on public.task_label_assignments to authenticated;
drop policy if exists "Users can read their own labels" on public.task_labels;
drop policy if exists "Users can create their own labels" on public.task_labels;
drop policy if exists "Users can update their own labels" on public.task_labels;
drop policy if exists "Users can delete their own labels" on public.task_labels;
create policy "Users can read their own labels" on public.task_labels for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own labels" on public.task_labels for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own labels" on public.task_labels for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own labels" on public.task_labels for delete to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can read their own task labels" on public.task_label_assignments;
drop policy if exists "Users can create their own task labels" on public.task_label_assignments;
drop policy if exists "Users can delete their own task labels" on public.task_label_assignments;
create policy "Users can read their own task labels" on public.task_label_assignments for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own task labels" on public.task_label_assignments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can delete their own task labels" on public.task_label_assignments for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.set_task_labels(p_task_id uuid, p_label_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.tasks where id = p_task_id and user_id = current_user_id) then raise exception 'Task not found'; end if;
  if exists (
    select requested.id from unnest(coalesce(p_label_ids, array[]::uuid[])) as requested(id)
    left join public.task_labels labels on labels.id = requested.id and labels.user_id = current_user_id
    where labels.id is null
  ) then raise exception 'One or more labels are unavailable'; end if;
  delete from public.task_label_assignments where task_id = p_task_id and user_id = current_user_id;
  insert into public.task_label_assignments (task_id, label_id, user_id)
    select p_task_id, selected.id, current_user_id
    from (select distinct unnest(coalesce(p_label_ids, array[]::uuid[])) as id) selected;
end;
$$;
revoke all on function public.set_task_labels(uuid, uuid[]) from public;
revoke all on function public.set_task_labels(uuid, uuid[]) from anon;
grant execute on function public.set_task_labels(uuid, uuid[]) to authenticated;

-- Database-side task audit log. No activity is backfilled for pre-existing tasks.
create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('task_created', 'status_changed', 'priority_changed', 'title_changed')),
  old_value text,
  new_value text,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (task_id, user_id) references public.tasks(id, user_id) on delete cascade
);
create index if not exists task_activity_task_created_idx on public.task_activity (task_id, created_at desc);
create index if not exists task_activity_user_created_idx on public.task_activity (user_id, created_at desc);

alter table public.task_activity enable row level security;
revoke all on public.task_activity from public, anon, authenticated;
grant select on public.task_activity to authenticated;
drop policy if exists "Users can read their own task activity" on public.task_activity;
create policy "Users can read their own task activity" on public.task_activity for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.record_task_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity (task_id, user_id, event_type, new_value, created_at)
      values (new.id, new.user_id, 'task_created', new.title, clock_timestamp());
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.task_activity (task_id, user_id, event_type, old_value, new_value, created_at)
      values (new.id, new.user_id, 'status_changed', old.status, new.status, clock_timestamp());
  end if;
  if new.priority is distinct from old.priority then
    insert into public.task_activity (task_id, user_id, event_type, old_value, new_value, created_at)
      values (new.id, new.user_id, 'priority_changed', old.priority, new.priority, clock_timestamp());
  end if;
  if new.title is distinct from old.title then
    insert into public.task_activity (task_id, user_id, event_type, old_value, new_value, created_at)
      values (new.id, new.user_id, 'title_changed', old.title, new.title, clock_timestamp());
  end if;
  return new;
end;
$$;
revoke all on function public.record_task_activity() from public, anon, authenticated;
grant execute on function public.record_task_activity() to authenticated;
drop trigger if exists tasks_record_activity_after_insert on public.tasks;
drop trigger if exists tasks_record_activity_after_update on public.tasks;
create trigger tasks_record_activity_after_insert after insert on public.tasks
for each row execute function public.record_task_activity();
create trigger tasks_record_activity_after_update after update on public.tasks
for each row execute function public.record_task_activity();

notify pgrst, 'reload schema';
``n
## Local Setup

1. For a fresh project, run `supabase/schema.sql`. For an existing project with tasks, run `supabase/migrations/20261120_labels_activity.sql` in Supabase SQL Editor. This migration is additive and does not delete or recreate tasks.
2. Run `supabase/migrations/20261120_labels_activity_access_repair.sql` in SQL Editor to ensure authenticated grants and PostgREST's schema cache are current. If the feature migration was already run, apply only this access repair migration.
3. Enable **Anonymous Sign-Ins** under Authentication → Sign In / Providers.
4. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the project URL and public anon/publishable key.
5. Run `npm install`, then `npm run dev`.
6. Run `npm run build` to create the production bundle.

## Advanced Features

Implemented in source: title search; priority and label filtering; custom colored labels with multiple labels per task; due-date warnings; counts for total tasks and each workflow status; and a relative-time task history for creation, status changes, priority changes, and title edits. Activity is recorded by PostgreSQL triggers. Live database behavior requires running the included migration in a configured Supabase project.

## Security

Supabase's built-in anonymous sign-in creates a real authenticated user. The application associates each insert with that user's UUID and reuses the persisted Auth session. RLS restricts task, label, association, and activity rows to `auth.uid()`. Composite foreign keys prevent cross-user task-label associations. The activity trigger writes audit events in the database; authenticated clients have read access only to their own history and no direct activity write grant. The app uses only the browser-safe anon/publishable key; a service-role key is never included.

## Tradeoffs

The scope prioritizes single-user secure CRUD and a polished four-column board. Status movement is persisted with optimistic UI and rollback on errors. Position is recorded for future ordering support, but within-column reordering is not implemented. Labels can be created, renamed, recolored, assigned, removed from tasks, and deleted; deleting a label cascades only its assignments. Comments, realtime sync, account recovery, and team collaboration are deferred. The migration does not synthesize history for tasks created before it is applied.

## Future Improvements

Account linking and recovery, shared team workspaces, realtime synchronization, notifications, configurable labels, richer activity history, and persisted ordering would extend this foundation.
