import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Check, ChevronDown, LoaderCircle, Plus, Settings2, Trash2, X } from 'lucide-react'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import type { Task, TaskActivityEvent, TaskInput, TaskStatus, Priority, TaskLabel } from '../types'
import { COLUMNS } from '../types'
import { loadTaskActivity } from '../services/tasks'

type Props = { task: Task | null; initialStatus: TaskStatus; busy: boolean; labels: TaskLabel[]; labelsError: string; onClose: () => void; onSave: (value: TaskInput, labelIds: string[]) => void; onDelete: (task: Task) => void; onCreateLabel: (name: string, color: string) => Promise<TaskLabel>; onManageLabels: () => void }
export function TaskEditor({ task, initialStatus, busy, labels, labelsError, onClose, onSave, onDelete, onCreateLabel, onManageLabels }: Props) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? initialStatus)
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'normal')
  const [due, setDue] = useState(task?.due_date ?? '')
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(task?.labels?.map(label => label.id) ?? [])
  const [labelName, setLabelName] = useState('')
  const [labelColor, setLabelColor] = useState('#8b7df6')
  const [labelBusy, setLabelBusy] = useState(false)
  const [labelFormError, setLabelFormError] = useState('')
  useEffect(() => { setTitle(task?.title ?? ''); setDescription(task?.description ?? ''); setStatus(task?.status ?? initialStatus); setPriority(task?.priority ?? 'normal'); setDue(task?.due_date ?? ''); setSelectedLabelIds(task?.labels?.map(label => label.id) ?? []) }, [task, initialStatus])
  useEffect(() => { setSelectedLabelIds(ids => ids.filter(id => labels.some(label => label.id === id))) }, [labels])
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown) }, [onClose])
  const submit = (e: FormEvent) => { e.preventDefault(); if (!title.trim()) return; onSave({ title: title.trim(), description: description.trim() || null, status, priority, due_date: due || null }, selectedLabelIds) }
  const addLabel = async () => { if (!labelName.trim()) return; setLabelBusy(true); setLabelFormError(''); try { const created = await onCreateLabel(labelName.trim(), labelColor); setSelectedLabelIds(ids => ids.includes(created.id) ? ids : [...ids, created.id]); setLabelName('') } catch (error) { setLabelFormError(error instanceof Error ? error.message : 'Could not create label.') } finally { setLabelBusy(false) } }
  return <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="editor-title" className="editor-panel">
    <div className="editor-head"><div><div className="eyebrow">{task ? 'TASK DETAILS' : 'NEW TASK'}</div><h2 id="editor-title">{task ? 'Edit task' : 'Create a task'}</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
    <form onSubmit={submit} className="editor-form"><label className="field-label" htmlFor="task-title">Task name <span>Required</span></label><input id="task-title" className="text-input title-input" autoFocus placeholder="What needs to get done?" value={title} onChange={e => setTitle(e.target.value)} maxLength={180} required />
      <label className="field-label" htmlFor="task-desc">Description <span>Optional</span></label><textarea id="task-desc" className="text-input description-input" placeholder="Add a little more context..." value={description} onChange={e => setDescription(e.target.value)} rows={5} />
      <div className="field-grid"><div><label className="field-label" htmlFor="task-status">Status</label><div className="select-wrap"><select id="task-status" className="text-input" value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>{COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select><ChevronDown size={15}/></div></div>
        <div><label className="field-label" htmlFor="task-priority">Priority</label><div className="select-wrap"><select id="task-priority" className="text-input" value={priority} onChange={e => setPriority(e.target.value as Priority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select><ChevronDown size={15}/></div></div></div>
      <label className="field-label" htmlFor="task-due">Due date <span>Optional</span></label><div className="date-wrap"><input id="task-due" className="text-input" type="date" value={due} onChange={e => setDue(e.target.value)}/></div>
      <section className="task-labels-field" aria-labelledby="task-labels-title"><div className="task-labels-heading"><div className="field-label" id="task-labels-title">Labels <span>Select any that apply</span></div><button type="button" className="manage-labels-inline" onClick={onManageLabels}><Settings2 size={12}/>Manage labels</button></div>{labelsError ? <p className="feature-error">Labels need setup: {labelsError}</p> : <><div className="label-options">{labels.map(label => { const selected = selectedLabelIds.includes(label.id); return <button key={label.id} type="button" className={`label-option ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => setSelectedLabelIds(ids => selected ? ids.filter(id => id !== label.id) : [...ids, label.id])}><i style={{ '--label-color': label.color } as CSSProperties}/>{label.name}</button> })}{labels.length === 0 && <span className="no-labels">No labels yet. Create one below.</span>}</div><div className="new-label-form"><input className="text-input label-name-input" aria-label="New label name" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addLabel() } }} placeholder="Create a label…" maxLength={32} value={labelName} onChange={e => setLabelName(e.target.value)}/><input className="label-color-input" type="color" aria-label="Label color" value={labelColor} onChange={e => setLabelColor(e.target.value)}/><button className="label-create-button" type="button" onClick={() => void addLabel()} disabled={labelBusy || !labelName.trim()} aria-label="Create label">{labelBusy ? <LoaderCircle size={14} className="spin"/> : <Plus size={15}/>}</button></div>{labelFormError && <p className="feature-error">{labelFormError}</p>}</>}</section>
      <div className="editor-actions">{task && <button type="button" className="delete-button" onClick={() => onDelete(task)}><Trash2 size={15}/> Delete task</button>}<button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button className="primary-button save-button" disabled={busy || !title.trim()}>{busy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>} {task ? 'Save changes' : 'Create task'}</button></div>
    </form>
    {task && <TaskActivity taskId={task.id}/>}
  </section></div>
}

function TaskActivity({ taskId }: { taskId: string }) {
  const [events, setEvents] = useState<TaskActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; setLoading(true); loadTaskActivity(taskId).then(rows => { if (active) setEvents(rows) }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load activity.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [taskId])
  return <section className="activity-section" aria-labelledby="activity-title"><div className="activity-heading"><div><div className="eyebrow">HISTORY</div><h3 id="activity-title">Activity</h3></div><span>{events.length}</span></div>{loading ? <p className="activity-empty">Loading activity…</p> : error ? <p className="feature-error">Activity needs setup: {error}</p> : events.length === 0 ? <p className="activity-empty">No activity recorded yet.</p> : <ol className="activity-list">{events.map(event => <li key={event.id}><span className={`activity-marker ${event.event_type}`}/><div className="activity-copy"><p>{describeActivity(event)}</p><time dateTime={event.created_at} title={format(parseISO(event.created_at), 'PPpp')}>{formatDistanceToNow(parseISO(event.created_at), { addSuffix: true })}</time></div></li>)}</ol>}</section>
}

function describeActivity(event: TaskActivityEvent) {
  if (event.event_type === 'task_created') return 'Created this task'
  if (event.event_type === 'status_changed') { const oldStatus = COLUMNS.find(column => column.id === event.old_value)?.title ?? event.old_value; const newStatus = COLUMNS.find(column => column.id === event.new_value)?.title ?? event.new_value; return `Moved from ${oldStatus} to ${newStatus}` }
  if (event.event_type === 'priority_changed') { const pretty = (value: string | null) => value ? value[0].toUpperCase() + value.slice(1) : 'none'; return `Changed priority from ${pretty(event.old_value)} to ${pretty(event.new_value)}` }
  return `Renamed “${event.old_value ?? ''}” to “${event.new_value ?? ''}”`
}
