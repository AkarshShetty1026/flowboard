import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays } from 'lucide-react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { CSSProperties } from 'react'
import type { Task } from '../types'

export function TaskCard({ task, onOpen, dragging = false }: { task: Task; onOpen: (task: Task) => void; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { task } })
  const due = task.due_date ? parseISO(task.due_date) : null
  const daysUntilDue = due ? differenceInCalendarDays(due, new Date()) : null
  const late = daysUntilDue !== null && daysUntilDue < 0 && task.status !== 'done'
  const soon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3 && task.status !== 'done'
  return <article ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} {...listeners} {...attributes} onClick={() => onOpen(task)} className={`task-card ${task.status === 'done' ? 'completed' : ''} ${isDragging && !dragging ? 'is-dragging' : ''} ${dragging ? 'drag-preview' : ''}`}>
    <div className="task-top"><span className={`priority ${task.priority}`}><i />{task.priority}</span></div>
    <h3>{task.title}</h3>
    {task.description && <p className="card-description">{task.description}</p>}
    {!!task.labels?.length && <div className="task-label-badges" aria-label="Task labels">{task.labels.slice(0, 2).map(label => <span key={label.id} className="task-label-badge" style={{ '--label-color': label.color } as CSSProperties}>{label.name}</span>)}{task.labels.length > 2 && <span className="task-label-more">+{task.labels.length - 2}</span>}</div>}
    {due && <div className="task-foot"><span className={`due ${late ? 'late' : soon ? 'soon' : ''}`}><CalendarDays size={13}/>{late ? 'Overdue · ' : soon ? 'Due soon · ' : 'Due · '}{format(due, 'MMM d')}</span></div>}
  </article>
}
