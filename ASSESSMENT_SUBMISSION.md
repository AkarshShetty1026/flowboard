# Flowboard
## Task Management Application — Software Development Assessment

**Submitted by:** Akarsh Shetty

**Live Application:** https://flowboard-9l86.vercel.app

**GitHub Repository:** https://github.com/AkarshShetty1026/flowboard

---

## 1. Project Overview

Flowboard is a responsive Kanban task management application designed to help users organize work and track progress visually.

The application provides four workflow stages: To Do, In Progress, In Review, and Done. Users can create, edit, delete, and organize tasks, move them between stages using drag-and-drop, assign priorities and due dates, and track changes through an activity timeline.

Flowboard uses Supabase anonymous authentication to automatically create a personal workspace without requiring registration. Task data is stored in PostgreSQL and protected through Row Level Security (RLS), ensuring that authenticated guest users can only access their own records.

The application is built using React, TypeScript, and Supabase and is hosted using Vercel.

## 2. Technology Stack

| Technology | Purpose |
|---|---|
| React 18 | Component-based frontend |
| TypeScript | Type safety and maintainability |
| Vite | Development tooling and production builds |
| Tailwind CSS 4 | Styling and responsive layouts |
| dnd-kit | Kanban drag-and-drop functionality |
| Supabase Auth | Anonymous guest authentication |
| Supabase PostgreSQL | Persistent relational database |
| Supabase JS | Database and authentication integration |
| date-fns | Date formatting and relative timestamps |
| Lucide React | Interface icons |
| Git and GitHub | Version control and source-code hosting |
| Vercel | Frontend deployment |

### Application Architecture

Flowboard follows a frontend-to-Supabase architecture.

The React application communicates directly with Supabase through the Supabase JavaScript client.

Supabase handles anonymous user authentication, database operations, and access control. PostgreSQL triggers also record important task changes in an activity-history table.

This architecture avoids the complexity of a separate backend server while retaining secure data persistence and relational database functionality.

## 3. Design Decisions

### Visual Design

Flowboard uses a minimal, productivity-focused design inspired by modern project management interfaces.

The design combines a neutral surface palette with a restrained violet accent color. Muted status indicators distinguish workflow stages without overwhelming the interface.

Manrope is used for prominent headings, while DM Sans supports readable interface text.

The visual hierarchy emphasizes the board, task cards, and primary actions, with secondary information displayed using subdued text and compact metadata.

### Layout and Navigation

The main interface includes a workspace header, task summary metrics, search and filtering controls, and the four-column Kanban board.

Task cards display essential information such as titles, priorities, due dates, and assigned labels.

Clicking a task opens a slide-over detail panel containing editing controls and its activity history.

### Interaction Design

Drag-and-drop interactions use dnd-kit, with optimistic UI updates to provide immediate visual feedback.

Database updates occur when a task is moved. If persistence fails, the previous state is restored and the user receives an error notification.

A status selector in the task editor provides an alternative to dragging.

### Responsive Design

The interface adapts to smaller screens through collapsible navigation and horizontally scrollable board columns.

Task cards retain usable dimensions, and the application supports both light and dark themes.

Loading states, empty states, and error notifications provide feedback throughout common workflows.

## 4. Core Functionality

### Task Management

Users can create, edit, inspect, and delete tasks.

Each task supports:

- Title
- Description
- Workflow status
- Priority
- Due date
- Creation timestamp
- User ownership

Tasks persist in Supabase and remain available when the authenticated guest session is restored.

### Kanban Board

Flowboard provides four workflow stages:

1. To Do
2. In Progress
3. In Review
4. Done

Tasks can be moved between these columns using drag-and-drop.

Changes are reflected immediately in the interface and persisted in PostgreSQL.

### Guest Authentication

On application startup, Flowboard checks for an existing Supabase Auth session.

If no session exists, it automatically authenticates the visitor anonymously.

Each task is associated with the authenticated user's UUID.

RLS policies enforce ownership checks for database access.

## 5. Additional Features

### Search and Filtering

Users can search tasks by title and filter them by priority or assigned labels.

Filtering updates the displayed board without changing stored task data.

### Due Date Indicators

Tasks display due-date information, including visual indicators for overdue or upcoming deadlines.

Completed tasks are excluded from the overdue count.

### Board Statistics

The dashboard displays task counts for the workflow stages and provides overdue-task information.

Metrics are calculated from task data rather than hardcoded values.

### Custom Labels and Tags

Users can create labels with custom names and colors.

Multiple labels can be assigned to a task.

A dedicated label management interface supports renaming labels, updating colors, and deleting labels.

Deleting a label removes its task associations without deleting the underlying tasks.

Labels can also be used to filter the Kanban board.

### Task Activity History

Flowboard maintains an activity timeline for each task.

The activity log records:

- Task creation
- Workflow status changes
- Priority changes
- Title changes

Activity events are generated through PostgreSQL triggers and stored in a separate table.

The task detail panel displays the history chronologically with relative timestamps.

Activity tracking begins when the relevant database migration is installed; earlier changes are not reconstructed.

### Theme Preferences

Flowboard supports light and dark themes, allowing users to choose their preferred appearance.

## 6. Database Design and SQL Schema

The database uses PostgreSQL through Supabase.

The main application tables are:

| Table | Responsibility |
|---|---|
| `tasks` | Stores task details and ownership |
| `task_labels` | Stores user-created labels |
| `task_label_assignments` | Associates labels with tasks |
| `task_activity` | Records task changes |

All application tables have Row Level Security enabled.

### Complete Fresh-Project SQL Schema

The following SQL defines the database structure, access policies, helper functions, and activity triggers.

```sql
-- Flowboard database schema

CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL
        CHECK (length(trim(title)) > 0),
    description text,
    status text NOT NULL DEFAULT 'todo'
        CHECK (status IN (
            'todo',
            'in_progress',
            'in_review',
            'done'
        )),
    priority text NOT NULL DEFAULT 'normal'
        CHECK (priority IN (
            'low',
            'normal',
            'high'
        )),
    due_date date,
    position integer NOT NULL DEFAULT 0,
    user_id uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_user_status_position_idx
    ON public.tasks (user_id, status, position);

CREATE INDEX IF NOT EXISTS tasks_user_due_date_idx
    ON public.tasks (user_id, due_date)
    WHERE due_date IS NOT NULL;

-- Automatically maintain updated_at

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_set_updated_at
ON public.tasks;

CREATE TRIGGER tasks_set_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Task access control

ALTER TABLE public.tasks
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tasks FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.tasks TO authenticated;

DROP POLICY IF EXISTS "Users can read their own tasks"
ON public.tasks;

DROP POLICY IF EXISTS "Users can create their own tasks"
ON public.tasks;

DROP POLICY IF EXISTS "Users can update their own tasks"
ON public.tasks;

DROP POLICY IF EXISTS "Users can delete their own tasks"
ON public.tasks;

CREATE POLICY "Users can read their own tasks"
ON public.tasks
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own tasks"
ON public.tasks
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own tasks"
ON public.tasks
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own tasks"
ON public.tasks
FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Required for user-matched composite foreign keys

CREATE UNIQUE INDEX IF NOT EXISTS tasks_id_user_id_uidx
ON public.tasks (id, user_id);

-- User-created labels

CREATE TABLE IF NOT EXISTS public.task_labels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 32),
    color text NOT NULL DEFAULT '#8b7df6'
        CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS task_labels_user_name_uidx
ON public.task_labels (user_id, lower(name));

-- Many-to-many task and label relationships

CREATE TABLE IF NOT EXISTS public.task_label_assignments (
    task_id uuid NOT NULL,
    label_id uuid NOT NULL,
    user_id uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (task_id, label_id),

    FOREIGN KEY (task_id, user_id)
        REFERENCES public.tasks(id, user_id)
        ON DELETE CASCADE,

    FOREIGN KEY (label_id, user_id)
        REFERENCES public.task_labels(id, user_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS task_label_assignments_label_idx
ON public.task_label_assignments (label_id, user_id);

-- Label and assignment security

ALTER TABLE public.task_labels
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.task_label_assignments
ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON public.task_labels, public.task_label_assignments
FROM public, anon;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.task_labels TO authenticated;

GRANT SELECT, INSERT, DELETE
ON public.task_label_assignments TO authenticated;

DROP POLICY IF EXISTS "Users can read their own labels"
ON public.task_labels;

DROP POLICY IF EXISTS "Users can create their own labels"
ON public.task_labels;

DROP POLICY IF EXISTS "Users can update their own labels"
ON public.task_labels;

DROP POLICY IF EXISTS "Users can delete their own labels"
ON public.task_labels;

CREATE POLICY "Users can read their own labels"
ON public.task_labels
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own labels"
ON public.task_labels
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own labels"
ON public.task_labels
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own labels"
ON public.task_labels
FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can read their own task labels"
ON public.task_label_assignments;

DROP POLICY IF EXISTS "Users can create their own task labels"
ON public.task_label_assignments;

DROP POLICY IF EXISTS "Users can delete their own task labels"
ON public.task_label_assignments;

CREATE POLICY "Users can read their own task labels"
ON public.task_label_assignments
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own task labels"
ON public.task_label_assignments
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own task labels"
ON public.task_label_assignments
FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Secure label assignment function

CREATE OR REPLACE FUNCTION public.set_task_labels(
    p_task_id uuid,
    p_label_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    current_user_id uuid := auth.uid();
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.tasks
        WHERE id = p_task_id
          AND user_id = current_user_id
    ) THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    IF EXISTS (
        SELECT requested.id
        FROM unnest(
            coalesce(p_label_ids, array[]::uuid[])
        ) AS requested(id)
        LEFT JOIN public.task_labels labels
          ON labels.id = requested.id
         AND labels.user_id = current_user_id
        WHERE labels.id IS NULL
    ) THEN
        RAISE EXCEPTION 'One or more labels are unavailable';
    END IF;

    DELETE FROM public.task_label_assignments
    WHERE task_id = p_task_id
      AND user_id = current_user_id;

    INSERT INTO public.task_label_assignments (
        task_id,
        label_id,
        user_id
    )
    SELECT
        p_task_id,
        selected.id,
        current_user_id
    FROM (
        SELECT DISTINCT unnest(
            coalesce(p_label_ids, array[]::uuid[])
        ) AS id
    ) selected;
END;
$$;

REVOKE ALL
ON FUNCTION public.set_task_labels(uuid, uuid[])
FROM public;

REVOKE ALL
ON FUNCTION public.set_task_labels(uuid, uuid[])
FROM anon;

GRANT EXECUTE
ON FUNCTION public.set_task_labels(uuid, uuid[])
TO authenticated;

-- Task activity audit table

CREATE TABLE IF NOT EXISTS public.task_activity (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL,
    user_id uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type text NOT NULL
        CHECK (event_type IN (
            'task_created',
            'status_changed',
            'priority_changed',
            'title_changed'
        )),
    old_value text,
    new_value text,
    created_at timestamptz NOT NULL
        DEFAULT clock_timestamp(),

    FOREIGN KEY (task_id, user_id)
        REFERENCES public.tasks(id, user_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS task_activity_task_created_idx
ON public.task_activity (task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS task_activity_user_created_idx
ON public.task_activity (user_id, created_at DESC);

-- Activity table security

ALTER TABLE public.task_activity
ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON public.task_activity
FROM public, anon, authenticated;

GRANT SELECT
ON public.task_activity TO authenticated;

DROP POLICY IF EXISTS "Users can read their own task activity"
ON public.task_activity;

CREATE POLICY "Users can read their own task activity"
ON public.task_activity
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Database-side activity trigger

CREATE OR REPLACE FUNCTION public.record_task_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF tg_op = 'INSERT' THEN
        INSERT INTO public.task_activity (
            task_id,
            user_id,
            event_type,
            new_value,
            created_at
        )
        VALUES (
            NEW.id,
            NEW.user_id,
            'task_created',
            NEW.title,
            clock_timestamp()
        );

        RETURN NEW;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO public.task_activity (
            task_id,
            user_id,
            event_type,
            old_value,
            new_value,
            created_at
        )
        VALUES (
            NEW.id,
            NEW.user_id,
            'status_changed',
            OLD.status,
            NEW.status,
            clock_timestamp()
        );
    END IF;

    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
        INSERT INTO public.task_activity (
            task_id,
            user_id,
            event_type,
            old_value,
            new_value,
            created_at
        )
        VALUES (
            NEW.id,
            NEW.user_id,
            'priority_changed',
            OLD.priority,
            NEW.priority,
            clock_timestamp()
        );
    END IF;

    IF NEW.title IS DISTINCT FROM OLD.title THEN
        INSERT INTO public.task_activity (
            task_id,
            user_id,
            event_type,
            old_value,
            new_value,
            created_at
        )
        VALUES (
            NEW.id,
            NEW.user_id,
            'title_changed',
            OLD.title,
            NEW.title,
            clock_timestamp()
        );
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL
ON FUNCTION public.record_task_activity()
FROM public, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.record_task_activity()
TO authenticated;

DROP TRIGGER IF EXISTS tasks_record_activity_after_insert
ON public.tasks;

DROP TRIGGER IF EXISTS tasks_record_activity_after_update
ON public.tasks;

CREATE TRIGGER tasks_record_activity_after_insert
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.record_task_activity();

CREATE TRIGGER tasks_record_activity_after_update
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.record_task_activity();

-- Refresh Supabase's PostgREST schema cache

NOTIFY pgrst, 'reload schema';
```

## 7. Local Setup Instructions

### Prerequisites

- Node.js and npm
- A Supabase project
- Git

### Clone and Install

```bash
git clone https://github.com/AkarshShetty1026/flowboard.git
cd flowboard
npm install
```

### Configure the Database

For a new Supabase project, execute `supabase/schema.sql` in the Supabase SQL Editor.

For an existing project containing earlier Flowboard tasks, use the provided incremental migrations rather than recreating the database:

1. `supabase/migrations/20261120_labels_activity.sql`
2. `supabase/migrations/20261120_labels_activity_access_repair.sql`

Enable Anonymous Sign-Ins under Supabase Authentication settings.

### Environment Configuration

Copy `.env.example` to `.env`.

Configure:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

### Run Locally

```bash
npm run dev
```

### Verify the Production Build

```bash
npm run build
```

The application can be deployed through Vercel with the same environment variables and the Vite output directory set to `dist`.

## 8. Security Considerations

### Anonymous Authentication

Flowboard uses Supabase's built-in anonymous authentication instead of a custom guest identifier.

Anonymous accounts receive authenticated sessions associated with unique user IDs.

### Row Level Security

All application tables have RLS enabled.

Read and write policies compare each row's ownership field with `auth.uid()`.

These policies enforce data isolation at the database level rather than relying on frontend filtering.

### Secure Relationships

Composite foreign keys ensure that task-label associations reference records belonging to the same user.

### Activity Integrity

PostgreSQL triggers generate activity events when tasks are created or modified.

Regular authenticated clients have read access to their permitted activity records but cannot directly insert activity events.

### Credential Handling

The frontend uses the browser-safe Supabase publishable key.

Service-role and secret keys are not included in the frontend.

Environment configuration files containing local credentials are excluded from Git.

## 9. Testing and Verification

The project has passed TypeScript checks and the production build.

The application has also been run locally with a configured Supabase project and deployed to Vercel.

Functionality exercised during development includes task management, drag-and-drop, label creation and assignment, label filtering, activity history, and persistence.

Database migrations were applied incrementally to preserve existing task records.

The application provides error notifications for failed operations and rollback behavior for unsuccessful optimistic task updates.

Independent automated integration tests and a complete security penetration test have not been implemented.

## 10. Tradeoffs and Limitations

### Direct Supabase Integration

Using Supabase directly from the frontend reduced infrastructure complexity and development time.

The tradeoff is that more advanced server-side business logic would require additional database functions, Edge Functions, or a dedicated backend.

### Anonymous Guest Accounts

Anonymous authentication removes the friction of traditional registration.

However, anonymous sessions do not offer built-in account recovery or cross-device identity.

### Task Ordering

Tasks can move between workflow stages, but custom within-column ordering is not currently persisted.

### Activity History

The database records selected important task events.

Changes made before activity logging was installed are not reconstructed.

### Collaboration

The current application focuses on individual guest workspaces.

Shared projects, team assignments, comments, and real-time collaboration are outside the current scope.

## 11. Future Improvements

Potential future enhancements include:

- Permanent accounts and guest-to-account linking.
- Multiple project boards.
- Shared team workspaces and assignees.
- Task comments and mentions.
- Real-time collaboration.
- Notifications and reminders.
- Persistent within-column task ordering.
- Expanded audit history and additional task metadata.
- Automated integration and security testing.

## 12. Conclusion

Flowboard demonstrates a complete task management workflow with a responsive user interface, persistent data storage, secure anonymous authentication, and database-enforced access control.

Its design focuses on clarity and usability, while features such as custom labels, task filtering, and database-audited activity history extend the core Kanban experience.

The project uses a lightweight frontend-to-Supabase architecture, providing a foundation for future collaboration and workflow features.
