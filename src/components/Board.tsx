import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { COLUMNS, type Task, type TaskStatus } from '../types'
import { TaskCard } from './TaskCard'

export function StatCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: string }) {
  return <div className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><span className="stat-info"><span>{label}</span><b>{value}</b></span></div>
}

export function BoardColumn({ id, title, tone, tasks, total, onAdd, onOpen }: { id: TaskStatus; title: string; tone: string; tasks: Task[]; total: number; onAdd: () => void; onOpen: (task: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return <section ref={setNodeRef} className={`board-column ${isOver ? 'is-over' : ''}`} aria-label={`${title}, ${total} tasks`}>
    <header className="column-head"><div className="column-name"><span className={`column-dot ${tone}`}/><h3>{title}</h3><span className="column-count">{total}</span></div><button className="column-add" onClick={onAdd} aria-label={`Add task to ${title}`}><Plus size={16}/></button></header>
    <div className="column-body">{tasks.map(task => <TaskCard task={task} onOpen={onOpen} key={task.id}/>)}{tasks.length === 0 && <div className="empty-column" aria-label={total > 0 ? 'No matching tasks' : `Drop tasks into ${title}`}><span>{total > 0 ? 'No matching tasks' : 'Drop tasks here'}</span></div>}</div>
  </section>
}

export function BoardSkeleton() {
  return <div className="board-scroll"><div className="board-grid">{COLUMNS.map(c => <div className="skeleton-column" key={c.id}><div className="skeleton-line short"/><div className="skeleton-card"/><div className="skeleton-card smaller"/></div>)}</div></div>
}
