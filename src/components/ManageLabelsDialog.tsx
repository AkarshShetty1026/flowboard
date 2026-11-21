import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Check, LoaderCircle, Pencil, Trash2, X } from 'lucide-react'
import type { TaskLabel } from '../types'

type Props = {
  labels: TaskLabel[]
  labelsError: string
  labelUsage: (labelId: string) => number
  onClose: () => void
  onSave: (label: TaskLabel, name: string, color: string) => Promise<void>
  onDelete: (label: TaskLabel) => Promise<void>
}

export function ManageLabelsDialog({ labels, labelsError, labelUsage, onClose, onSave, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftColor, setDraftColor] = useState('#8b7df6')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busyId) onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busyId, onClose])

  const startEdit = (label: TaskLabel) => {
    setEditingId(label.id); setConfirmingId(null); setDraftName(label.name); setDraftColor(label.color)
    setErrors(current => ({ ...current, [label.id]: '' }))
  }

  const save = async (event: FormEvent, label: TaskLabel) => {
    event.preventDefault()
    const name = draftName.trim()
    if (!name) { setErrors(current => ({ ...current, [label.id]: 'Enter a label name.' })); return }
    if (name.length > 32) { setErrors(current => ({ ...current, [label.id]: 'Label names can be up to 32 characters.' })); return }
    if (labels.some(other => other.id !== label.id && other.name.trim().toLowerCase() === name.toLowerCase())) { setErrors(current => ({ ...current, [label.id]: 'A label with this name already exists.' })); return }
    setBusyId(label.id); setErrors(current => ({ ...current, [label.id]: '' }))
    try { await onSave(label, name, draftColor); setEditingId(null) }
    catch (error) { setErrors(current => ({ ...current, [label.id]: error instanceof Error ? error.message : 'Could not update this label.' })) }
    finally { setBusyId(null) }
  }

  const remove = async (label: TaskLabel) => {
    setBusyId(label.id); setErrors(current => ({ ...current, [label.id]: '' }))
    try { await onDelete(label); setConfirmingId(null); if (editingId === label.id) setEditingId(null) }
    catch (error) { setErrors(current => ({ ...current, [label.id]: error instanceof Error ? error.message : 'Could not delete this label.' })) }
    finally { setBusyId(null) }
  }

  return <div className="manage-labels-scrim" onMouseDown={event => { if (event.target === event.currentTarget && !busyId) onClose() }}>
    <section className="manage-labels-dialog" role="dialog" aria-modal="true" aria-labelledby="manage-labels-title">
      <header className="manage-labels-header"><div><div className="eyebrow">WORKSPACE</div><h2 id="manage-labels-title">Manage labels</h2><p>Rename labels or update their colors. Deleting a label keeps its tasks.</p></div><button type="button" className="icon-button" aria-label="Close label management" onClick={onClose} disabled={Boolean(busyId)}><X size={18}/></button></header>
      {labelsError ? <div className="feature-error manage-labels-error">Labels are unavailable: {labelsError}</div> : labels.length === 0 ? <div className="manage-labels-empty"><span>No labels yet</span><small>Create a label from a task’s Labels section to manage it here.</small></div> : <div className="manage-labels-list">{labels.map(label => {
        const usage = labelUsage(label.id)
        const editing = editingId === label.id
        const confirming = confirmingId === label.id
        const busy = busyId === label.id
        return <article className="manage-label-row" key={label.id}>
          {editing ? <form className="manage-label-edit" onSubmit={event => void save(event, label)}>
            <div className="manage-label-preview"><span className="task-label-badge" style={{ '--label-color': draftColor } as CSSProperties}>{draftName.trim() || 'Label'}</span><span className="label-use-count">Used on {usage} {usage === 1 ? 'task' : 'tasks'}</span></div>
            <div className="manage-label-fields"><input className="text-input" aria-label={`Rename ${label.name}`} maxLength={32} autoFocus value={draftName} onChange={event => setDraftName(event.target.value)}/><input className="label-color-input" type="color" aria-label={`Change ${label.name} color`} value={draftColor} onChange={event => setDraftColor(event.target.value)}/></div>
            {errors[label.id] && <p className="feature-error">{errors[label.id]}</p>}
            <div className="manage-label-actions"><button type="button" className="cancel-button" onClick={() => setEditingId(null)} disabled={busy}>Cancel</button><button className="primary-button" disabled={busy || !draftName.trim()}>{busy ? <LoaderCircle size={14} className="spin"/> : <Check size={14}/>} Save label</button></div>
          </form> : <>
            <div className="manage-label-summary"><span className="task-label-badge" style={{ '--label-color': label.color } as CSSProperties}>{label.name}</span><span className="label-use-count">Used on {usage} {usage === 1 ? 'task' : 'tasks'}</span></div>
            {confirming ? <div className="manage-label-confirm" role="alertdialog" aria-labelledby={`delete-label-${label.id}`}><p id={`delete-label-${label.id}`}>{usage ? `Deleting this label will remove it from ${usage} ${usage === 1 ? 'task' : 'tasks'}. Your tasks will not be deleted.` : 'Delete this unused label?'}</p>{errors[label.id] && <p className="feature-error">{errors[label.id]}</p>}<div><button type="button" className="cancel-button" onClick={() => setConfirmingId(null)} disabled={busy}>Cancel</button><button type="button" className="delete-button confirm-delete-button" onClick={() => void remove(label)} disabled={busy}>{busy ? <LoaderCircle size={14} className="spin"/> : <Trash2 size={14}/>} Delete label</button></div></div> : <div className="manage-label-actions compact"><button type="button" className="label-action-button" onClick={() => startEdit(label)} aria-label={`Edit ${label.name}`} disabled={Boolean(busyId)}><Pencil size={14}/> Edit</button><button type="button" className="label-action-button danger" onClick={() => { setConfirmingId(label.id); setEditingId(null); setErrors(current => ({ ...current, [label.id]: '' })) }} aria-label={`Delete ${label.name}`} disabled={Boolean(busyId)}><Trash2 size={14}/> Delete</button></div>}
          </>}
        </article>
      })}</div>}
      <footer className="manage-labels-footer"><button type="button" className="cancel-button" onClick={onClose} disabled={Boolean(busyId)}>Done</button></footer>
    </section>
  </div>
}
