export const STATUSES = ['todo', 'in_progress', 'in_review', 'done'] as const
export type TaskStatus = typeof STATUSES[number]
export type Priority = 'low' | 'normal' | 'high'
export type TaskLabel = { id: string; name: string; color: string; user_id: string; created_at: string }
export type TaskActivityEvent = { id: string; task_id: string; user_id: string; event_type: 'task_created' | 'status_changed' | 'priority_changed' | 'title_changed'; old_value: string | null; new_value: string | null; created_at: string }
export type Task = { id: string; title: string; description: string | null; status: TaskStatus; priority: Priority; due_date: string | null; position: number; user_id: string; created_at: string; updated_at: string; labels?: TaskLabel[] }
export type TaskInput = Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'due_date'>
export const COLUMNS: { id: TaskStatus; title: string; tone: string }[] = [
  { id: 'todo', title: 'To Do', tone: 'slate' }, { id: 'in_progress', title: 'In Progress', tone: 'blue' }, { id: 'in_review', title: 'In Review', tone: 'amber' }, { id: 'done', title: 'Done', tone: 'green' },
]
