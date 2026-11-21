# Flowboard

**A focused Kanban workspace for organizing tasks and tracking progress.**

Flowboard is a responsive task management web application built with React, TypeScript, and Supabase. It provides an intuitive drag-and-drop board, flexible task organization, and a streamlined interface inspired by modern productivity tools.

Users can create and manage tasks without registering for an account. Supabase anonymous authentication and PostgreSQL Row Level Security (RLS) provide isolated, persistent guest workspaces.

## Live Application

**Live Demo:** [Flowboard](YOUR_VERCEL_URL)

**Source Code:** https://github.com/AkarshShetty1026/flowboard

## Features

### Kanban Task Management

- Four workflow columns: To Do, In Progress, In Review, and Done.
- Drag-and-drop task movement between columns.
- Optimistic UI updates with rollback on database errors.
- Task creation, editing, and deletion.
- Task descriptions, priorities, and due dates.
- Task detail panel for managing individual tasks.

### Labels and Organization

- Create custom color-coded labels.
- Assign multiple labels to tasks.
- Rename labels and change their colors.
- Delete labels without deleting associated tasks.
- Filter tasks by label or priority.
- Search tasks by title.

### Task Activity History

- Automatic recording of task creation.
- History of status transitions.
- Priority and title change tracking.
- Chronological activity timeline.
- Relative timestamps and exact creation times.

Activity events are recorded through PostgreSQL triggers rather than relying on frontend-only logging.

### Dashboard and User Experience

- Dynamic task counts by workflow status.
- Overdue task indicators.
- Responsive layout with horizontally scrollable Kanban columns.
- Light and dark themes.
- Loading states, error feedback, and toast notifications.
- Keyboard-accessible drag-and-drop and alternative status controls.

### Authentication and Security

- Automatic anonymous guest sign-in through Supabase Auth.
- Session persistence across page refreshes.
- User-specific task and label storage.
- PostgreSQL Row Level Security.
- No custom backend server required.
- Public Supabase publishable key with database access governed by RLS.

## Technology Stack

| Technology | Purpose |
|---|---|
| React 18 | Frontend user interface |
| TypeScript | Static typing |
| Vite | Development server and production builds |
| Tailwind CSS 4 | Styling and responsive design |
| dnd-kit | Drag-and-drop interactions |
| Supabase Auth | Anonymous authentication |
| Supabase PostgreSQL | Persistent data storage |
| Supabase JS | Database and authentication client |
| date-fns | Date formatting |
| Lucide React | Interface icons |
| Git & GitHub | Version control |
| Vercel | Frontend hosting |

## Architecture

Flowboard uses a frontend-to-Supabase architecture.

The React frontend communicates directly with Supabase using the Supabase JavaScript client. Supabase Auth manages guest identities, PostgreSQL stores application data, and RLS policies restrict access to records owned by the authenticated user.

No dedicated Node.js or Go backend API is required.

### Project Structure

- `src/App.tsx` — Main application state and orchestration.
- `src/components/` — Kanban board, task cards, task editor, and label management components.
- `src/services/tasks.ts` — Supabase task-related data operations.
- `src/lib/supabase.ts` — Supabase client configuration.
- `src/types.ts` — Shared TypeScript definitions.
- `src/index.css` — Global styling and interface design.
- `supabase/schema.sql` — Complete database schema for new projects.
- `supabase/migrations/` — Incremental database migrations.
- `ASSESSMENT_SUBMISSION.md` — Project submission documentation.

## Getting Started

### Prerequisites

- Node.js and npm
- A free Supabase account
- Git (optional for local development)

### 1. Clone the Repository

```bash
git clone https://github.com/AkarshShetty1026/flowboard.git
cd flowboard
```

If the repository is private, GitHub authentication and repository access are required.

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Supabase

Create a new project at https://supabase.com.

For a fresh database:

1. Open the Supabase SQL Editor.
2. Copy the contents of `supabase/schema.sql`.
3. Execute the SQL to create the required tables, constraints, policies, and triggers.
4. Enable Anonymous Sign-Ins under Authentication → Sign In / Providers.

For an existing database that already contains Flowboard tasks, follow the migration instructions instead of recreating the schema.

The feature migrations are:

- `supabase/migrations/20261120_labels_activity.sql`
- `supabase/migrations/20261120_labels_activity_access_repair.sql`

These provide label management, activity logging, required permissions, and schema-cache refreshes.

### 4. Configure Environment Variables

Create a local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Add the following values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

Use the Supabase project URL and public publishable/anon key.

Never use a Supabase secret or service-role key in the frontend.

### 5. Start the Application

```bash
npm run dev
```

Open the local address printed by Vite, usually:

http://localhost:5173

### 6. Build for Production

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## Database and Security

Flowboard uses four application tables:

- `tasks` — Task information, status, ownership, priority, and due dates.
- `task_labels` — User-owned custom labels.
- `task_label_assignments` — Many-to-many relationships between tasks and labels.
- `task_activity` — Database-generated task activity records.

Every application table uses PostgreSQL Row Level Security.

Policies compare the authenticated user ID returned by `auth.uid()` with each record's `user_id`.

Composite foreign keys prevent cross-user task-label associations.

Task activity is generated by database triggers, and regular authenticated clients cannot directly write activity records.

## Deployment

Flowboard is deployed using Vercel.

To deploy another instance:

1. Import the GitHub repository into Vercel.
2. Select the Vite framework preset.
3. Set the build command to `npm run build`.
4. Set the output directory to `dist`.
5. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
6. Deploy the project.

The deployed application communicates directly with Supabase.

## Design Philosophy

Flowboard emphasizes simplicity, visual clarity, and responsive interaction.

The interface uses a restrained violet accent, neutral background surfaces, consistent typography, and subtle status indicators to make task information easy to scan.

The Kanban board remains the primary focus, while filters, metrics, and task details provide additional context without overwhelming the workspace.

## Current Limitations

- Anonymous accounts do not have account recovery or cross-device identity.
- Task movement between columns is persisted, but manual ordering within a column is not.
- Real-time collaboration is not implemented.
- Multiple workspaces and team assignments are not supported.
- Activity events created before the activity-log migration are not backfilled.

## Future Improvements

Potential enhancements include persistent user accounts, multiple project boards, team collaboration, comments, real-time synchronization, notifications, and configurable workflows.

---

**Flowboard — Organize work, visualize progress.**
