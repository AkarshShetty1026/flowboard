import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCorners, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Activity, AlertCircle, ArrowRight, CheckCircle2, ChevronDown, Circle, CircleHelp, Clock3, Command, Eye, Filter, LayoutGrid, LoaderCircle, Moon, Plus, Search, Settings2, Sparkles, Sun, Tag, Target, X } from 'lucide-react'
import { format } from 'date-fns'
import { supabase, hasSupabaseConfig } from './lib/supabase'
import { createLabel as createTaskLabel, createTask, deleteLabel as deleteTaskLabel, deleteTask, loadLabels, loadTaskLabelAssignments, loadTasks, moveTask, setTaskLabels, updateLabel as updateTaskLabel, updateTask } from './services/tasks'
import { COLUMNS, STATUSES, type Task, type TaskInput, type TaskLabel, type TaskStatus } from './types'
import { TaskCard } from './components/TaskCard'
import { BoardColumn, BoardSkeleton, StatCard } from './components/Board'
import { TaskEditor } from './components/TaskEditor'
import { ManageLabelsDialog } from './components/ManageLabelsDialog'
import flowboardMark from '../favicon.svg'

type Notice = { id: number; text: string; kind: 'success' | 'error' }
type Theme = 'light' | 'dark'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function getInitialTheme(): Theme {
  try { return localStorage.getItem('forma-theme') === 'dark' ? 'dark' : 'light' }
  catch { return 'light' }
}

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [userId, setUserId] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [labels, setLabels] = useState<TaskLabel[]>([])
  const [labelsError, setLabelsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [labelFilter, setLabelFilter] = useState('all')
  const [manageLabelsOpen, setManageLabelsOpen] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [newStatus, setNewStatus] = useState<TaskStatus>('todo')
  const [busy, setBusy] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState('')
  const [notices, setNotices] = useState<Notice[]>([])
  const [dragged, setDragged] = useState<Task | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const pendingMutations = useRef(0)
  const mutationHadError = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))
  const notify = useCallback((text: string, kind: Notice['kind'] = 'success') => { const id = Date.now() + Math.random(); setNotices(n => [...n, { id, text, kind }]); window.setTimeout(() => setNotices(n => n.filter(x => x.id !== id)), 3400) }, [])
  const beginPersist = () => { if (pendingMutations.current === 0) mutationHadError.current = false; pendingMutations.current += 1; setSaveError(''); setSaveStatus('saving') }
  const endPersist = (success: boolean, error?: string) => {
    if (!success) { mutationHadError.current = true; setSaveError(error ?? 'Your changes could not be saved.') }
    pendingMutations.current = Math.max(0, pendingMutations.current - 1)
    if (pendingMutations.current === 0) setSaveStatus(mutationHadError.current ? 'error' : 'saved')
  }

  const initAuth = useCallback(async () => {
    setAuthLoading(true); setAuthError('')
    if (!supabase) { setAuthLoading(false); setLoading(false); setAuthError('Add your Supabase project URL and anon key to get started.'); return }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) { setAuthError(sessionError.message); setAuthLoading(false); return }
    if (session?.user) { setUserId(session.user.id); setAuthLoading(false); return }
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error || !data.user) { setAuthError(error?.message ?? 'Could not start a guest session.'); setAuthLoading(false); return }
    setUserId(data.user.id); setAuthLoading(false)
  }, [])
  useEffect(() => { void initAuth() }, [initAuth])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('forma-theme', theme) } catch { /* Keep the chosen theme for this visit. */ }
  }, [theme])
  useEffect(() => {
    if (!userId || !supabase) return
    let live = true
    setLoading(true); setLoadError(''); setLabelsError('')
    loadTasks().then(async rows => {
      try {
        const [labelRows, assignments] = await Promise.all([loadLabels(), loadTaskLabelAssignments()])
        if (!live) return
        const labelsById = new Map(labelRows.map(label => [label.id, label]))
        const labelsByTask = new Map<string, TaskLabel[]>()
        assignments.forEach(assignment => { const label = labelsById.get(assignment.label_id); if (label) labelsByTask.set(assignment.task_id, [...(labelsByTask.get(assignment.task_id) ?? []), label]) })
        setLabels(labelRows); setTasks(rows.map(task => ({ ...task, labels: labelsByTask.get(task.id) ?? [] })))
      } catch (error) {
        if (!live) return
        const message = error instanceof Error ? error.message : 'Could not load labels.'
        setLabels([]); setTasks(rows.map(task => ({ ...task, labels: [] }))); setLabelsError(message); notify(`Labels could not be loaded: ${message}`, 'error')
      }
    }).catch(error => { if (live) setLoadError(error.message || 'Could not load tasks.') }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [userId, notify])
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus() } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [])

  const today = format(new Date(), 'yyyy-MM-dd')
  const isOverdue = (task: Task) => task.status !== 'done' && Boolean(task.due_date && task.due_date < today)
  const visibleTasks = useMemo(() => tasks.filter(task => task.title.toLowerCase().includes(search.toLowerCase().trim()) && (priorityFilter === 'all' || task.priority === priorityFilter) && (labelFilter === 'all' || task.labels?.some(label => label.id === labelFilter)) && (!overdueOnly || isOverdue(task))), [tasks, search, priorityFilter, labelFilter, overdueOnly, today])
  const overdue = tasks.filter(isOverdue).length
  const openCreate = (status: TaskStatus = 'todo') => { setActiveTask(null); setNewStatus(status); setEditorOpen(true) }
  const saveTask = async (input: TaskInput, labelIds: string[]) => {
    setBusy(true); beginPersist()
    try {
      if (activeTask) {
        const updated = await updateTask(activeTask.id, input)
        setTasks(prev => prev.map(t => t.id === updated.id ? { ...updated, labels: activeTask.labels ?? [] } : t))
        if (!labelsError) await setTaskLabels(updated.id, labelIds)
        const updatedLabels = labelsError ? activeTask.labels ?? [] : labels.filter(label => labelIds.includes(label.id))
        setTasks(prev => prev.map(t => t.id === updated.id ? { ...updated, labels: updatedLabels } : t))
      } else {
        if (!userId) throw new Error('Guest session is not ready.')
        const created = await createTask(input, userId)
        setTasks(prev => [...prev, { ...created, labels: [] }])
        if (labelIds.length) {
          try { await setTaskLabels(created.id, labelIds) }
          catch (error) {
            const message = error instanceof Error ? error.message : 'Task created, but its labels could not be saved.'
            endPersist(false, message); setEditorOpen(false); notify(`Task created, but labels could not be saved: ${message}`, 'error'); return
          }
        }
        const createdLabels = labels.filter(label => labelIds.includes(label.id))
        setTasks(prev => prev.map(t => t.id === created.id ? { ...created, labels: createdLabels } : t))
      }
      endPersist(true)
      setEditorOpen(false)
      notify(activeTask ? 'Task updated' : 'Task created')
    } catch (e) { const message = e instanceof Error ? e.message : 'Could not save task.'; endPersist(false, message); notify(message, 'error') } finally { setBusy(false) }
  }
  const handleCreateLabel = async (name: string, color: string): Promise<TaskLabel> => {
    if (!userId) throw new Error('Guest session is not ready.')
    beginPersist()
    try { const label = await createTaskLabel(name, color, userId); setLabels(current => [...current, label].sort((a, b) => a.name.localeCompare(b.name))); endPersist(true); notify('Label created'); return label }
    catch (error) { const message = error instanceof Error ? error.message : 'Could not create label.'; endPersist(false, message); notify(message, 'error'); throw error }
  }
  const handleUpdateLabel = async (label: TaskLabel, name: string, color: string): Promise<void> => {
    beginPersist()
    try {
      const updated = await updateTaskLabel(label.id, { name, color })
      setLabels(current => current.map(item => item.id === updated.id ? updated : item).sort((a, b) => a.name.localeCompare(b.name)))
      setTasks(current => current.map(task => ({ ...task, labels: task.labels?.map(item => item.id === updated.id ? updated : item) ?? [] })))
      endPersist(true); notify('Label updated')
    } catch (error) { const message = error instanceof Error ? error.message : 'Could not update label.'; endPersist(false, message); notify(message, 'error'); throw error }
  }
  const handleDeleteLabel = async (label: TaskLabel): Promise<void> => {
    beginPersist()
    try {
      await deleteTaskLabel(label.id)
      setLabels(current => current.filter(item => item.id !== label.id))
      setTasks(current => current.map(task => ({ ...task, labels: task.labels?.filter(item => item.id !== label.id) ?? [] })))
      setLabelFilter(current => current === label.id ? 'all' : current)
      endPersist(true); notify('Label deleted')
    } catch (error) { const message = error instanceof Error ? error.message : 'Could not delete label.'; endPersist(false, message); notify(message, 'error'); throw error }
  }
  const removeTask = async (task: Task) => {
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return
    setBusy(true); beginPersist()
    try { await deleteTask(task.id); setTasks(prev => prev.filter(t => t.id !== task.id)); endPersist(true); setEditorOpen(false); notify('Task deleted') }
    catch (e) { const message = e instanceof Error ? e.message : 'Could not delete task.'; endPersist(false, message); notify(message, 'error') } finally { setBusy(false) }
  }
  const onDragStart = (event: DragStartEvent) => setDragged(tasks.find(t => t.id === event.active.id) ?? null)
  const onDragEnd = async (event: DragEndEvent) => {
    setDragged(null)
    const id = String(event.active.id); const moving = tasks.find(t => t.id === id)
    if (!moving || !event.over) return
    const targetId = String(event.over.id)
    const targetTask = tasks.find(t => t.id === targetId)
    const targetStatus = STATUSES.includes(targetId as TaskStatus) ? targetId as TaskStatus : targetTask?.status
    if (!targetStatus || targetStatus === moving.status) return
    const oldStatus = moving.status
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: targetStatus } : t))
    beginPersist()
    try { const updated = await moveTask(id, targetStatus); setTasks(prev => prev.map(t => t.id === id ? { ...updated, labels: moving.labels ?? [] } : t)); endPersist(true) }
    catch (e) { const message = e instanceof Error ? e.message : 'Could not move task.'; setTasks(prev => prev.map(t => t.id === id ? { ...t, status: oldStatus } : t)); endPersist(false, message); notify(message, 'error') }
  }
  const clearFilters = () => { setSearch(''); setPriorityFilter('all'); setLabelFilter('all'); setOverdueOnly(false) }

  if (!hasSupabaseConfig) return <SetupScreen />
  if (authLoading) return <div className="full-loading"><div className="loader-brand"><BrandMark/><span>Flowboard</span></div><LoaderCircle size={24} className="spin loader-icon"/><p>Preparing your workspace…</p></div>
  if (authError) return <div className="full-loading"><div className="error-card"><BrandMark/><h1>We couldn't open your workspace</h1><p>{authError}</p><button className="primary-button" onClick={() => void initAuth()}><ArrowRight size={16}/> Try again</button></div></div>

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
      <div className="sidebar-top"><a href="#board" className="brand"><BrandMark/><span>flowboard</span><span className="brand-dot">.</span></a><button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={17}/></button></div>
      <button className="workspace-switch"><span className="workspace-avatar">P</span><span className="workspace-copy"><b>Personal Workspace</b><small>Free plan</small></span><ChevronDown size={15}/></button>
      <div className="nav-label">WORKSPACE</div><nav className="side-nav"><a className="nav-item selected" href="#board" onClick={() => setMobileNav(false)}><LayoutGrid size={17}/><span>My board</span><span className="nav-count">{tasks.length}</span></a></nav>
      <div className="sidebar-bottom"><div className="sidebar-card"><div className="sidebar-card-icon"><Target size={16}/></div><div><b>Small steps, big impact.</b><span>Keep your focus on what matters.</span></div></div><div className="profile"><div className="profile-avatar">G</div><div className="profile-copy"><b>Guest member</b><span>Personal workspace</span></div><span className="online-dot" title="Session active"/></div></div>
    </aside>
    {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close menu"/>}
    <main className="main-content" id="board">
      <header className="topbar"><div className="breadcrumbs"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Command size={18}/></button><span>Personal Workspace</span><span className="crumb-sep">/</span><b>My board</b></div><div className="top-actions"><span className="date-label">{format(new Date(), 'EEEE, MMMM d')}</span><button className="theme-toggle" type="button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} aria-pressed={theme === 'dark'} onClick={() => setTheme(value => value === 'light' ? 'dark' : 'light')} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={16}/> : <Sun size={16}/>}<span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span></button><span className="top-divider"/><div className="profile-avatar small-avatar" title="Guest member">G</div></div></header>
      <section className="page-heading"><div><div className="eyebrow heading-eyebrow"><span className="live-dot"/> YOUR WORKSPACE</div><h1>Project board</h1></div><button className="primary-button new-task-button" onClick={() => openCreate()}><Plus size={17}/> New task</button></section>
      <section className="stats-row" aria-label="Task counts by workflow status">
        <StatCard icon={<LayoutGrid size={15}/>} label="Total Tasks" value={tasks.length} tone="violet"/>
        <StatCard icon={<Circle size={14}/>} label="To Do" value={tasks.filter(t => t.status === 'todo').length} tone="slate"/>
        <StatCard icon={<Activity size={15}/>} label="In Progress" value={tasks.filter(t => t.status === 'in_progress').length} tone="blue"/>
        <StatCard icon={<Eye size={15}/>} label="In Review" value={tasks.filter(t => t.status === 'in_review').length} tone="amber"/>
        <StatCard icon={<CheckCircle2 size={15}/>} label="Done" value={tasks.filter(t => t.status === 'done').length} tone="green"/>
      </section>
      <section className="board-toolbar"><div className="toolbar-title"><h2>Board</h2><span>{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</span><button type="button" className={`overdue-indicator ${overdue === 0 ? 'is-clear' : ''} ${overdueOnly ? 'active' : ''}`} aria-pressed={overdueOnly} onClick={() => setOverdueOnly(value => !value)}><Clock3 size={12}/>{overdue} overdue</button></div><div className="toolbar-controls"><label className="search-box"><Search size={16}/><input ref={searchRef} aria-label="Search tasks" placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={14}/></button>}<kbd>⌘ K</kbd></label><label className="filter-select"><Filter size={14}/><select aria-label="Filter by priority" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="all">All priorities</option><option value="high">High priority</option><option value="normal">Normal priority</option><option value="low">Low priority</option></select><ChevronDown size={14}/></label><div className="label-filter-controls"><label className="filter-select label-filter"><Tag size={14}/><select aria-label="Filter by label" title={labelsError || undefined} value={labelFilter} onChange={e => setLabelFilter(e.target.value)} disabled={!labels.length}><option value="all">All labels</option>{labels.map(label => <option key={label.id} value={label.id}>{label.name}</option>)}</select><ChevronDown size={14}/></label><button type="button" className="manage-labels-trigger" onClick={() => setManageLabelsOpen(true)}><Settings2 size={14}/><span>Manage</span></button></div>{(search || priorityFilter !== 'all' || labelFilter !== 'all' || overdueOnly) && <button className="clear-filter" onClick={clearFilters}>Clear filter</button>}<SaveIndicator status={saveStatus} error={saveError}/></div></section>
      {loading ? <BoardSkeleton/> : loadError ? <div className="state-card"><div className="state-icon error-state"><X size={19}/></div><h3>Couldn't load your board</h3><p>{loadError}</p><button className="secondary-button" onClick={() => { setUserId(id => id ? `${id}` : null); if (userId) { setLoading(true); loadTasks().then(setTasks).catch(e => setLoadError(e.message)).finally(() => setLoading(false)) } }}>Try again</button></div> : <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragged(null)}>
        <div className="board-scroll"><div className="board-grid">{COLUMNS.map(column => <BoardColumn key={column.id} id={column.id} title={column.title} tone={column.tone} tasks={visibleTasks.filter(t => t.status === column.id)} total={tasks.filter(t => t.status === column.id).length} onAdd={() => openCreate(column.id)} onOpen={task => { setActiveTask(task); setNewStatus(task.status); setEditorOpen(true) }}/>)}</div></div>
        <DragOverlay dropAnimation={null}>{dragged ? <TaskCard task={dragged} onOpen={() => {}} dragging/> : null}</DragOverlay>
      </DndContext>}
      {!loading && !loadError && tasks.length === 0 && <div className="first-task-hint"><span className="hint-sparkle"><Sparkles size={15}/></span><span><b>Your board is ready.</b> Add a task to get your first win.</span><button onClick={() => openCreate()}>Create a task <ArrowRight size={14}/></button></div>}
    </main>
    {editorOpen && <TaskEditor task={activeTask} initialStatus={newStatus} busy={busy} labels={labels} labelsError={labelsError} onClose={() => setEditorOpen(false)} onSave={saveTask} onDelete={removeTask} onCreateLabel={handleCreateLabel} onManageLabels={() => setManageLabelsOpen(true)}/>}
    {manageLabelsOpen && <ManageLabelsDialog labels={labels} labelsError={labelsError} labelUsage={id => tasks.filter(task => task.labels?.some(label => label.id === id)).length} onClose={() => setManageLabelsOpen(false)} onSave={handleUpdateLabel} onDelete={handleDeleteLabel}/>}
    <div className="toast-stack" aria-live="polite">{notices.map(n => <div className={`toast ${n.kind}`} key={n.id}>{n.kind === 'success' ? <CheckCircle2 size={17}/> : <X size={17}/>}<span>{n.text}</span></div>)}</div>
  </div>
}

function BrandMark() { return <img className="brand-symbol" src={flowboardMark} alt="Flowboard logo"/> }

function SetupScreen() { return <div className="setup-screen"><div className="setup-card"><a className="brand" href="#"><BrandMark/><span>flowboard</span><span className="brand-dot">.</span></a><div className="setup-pill"><span className="live-dot"/> QUICK SETUP</div><h1>Your workspace is almost ready.</h1><p>Connect a free Supabase project to enable secure guest sessions and save your tasks across visits.</p><ol className="setup-steps"><li><span>1</span><div><b>Create a Supabase project</b><small>Free tier is all you need.</small></div></li><li><span>2</span><div><b>Run the database schema</b><small>Paste <code>supabase/schema.sql</code> into SQL Editor and run.</small></div></li><li><span>3</span><div><b>Enable anonymous sign-ins</b><small>Authentication → Sign In / Providers → enable Anonymous Sign-Ins.</small></div></li><li><span>4</span><div><b>Add your project keys</b><small>Copy <code>.env.example</code> to <code>.env</code> and fill in URL + anon key.</small></div></li></ol><div className="setup-note"><CircleHelp size={16}/><span>Then restart <code>npm run dev</code>. Your guest workspace will open automatically.</span></div><a className="setup-doc-link" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Open Supabase dashboard <ArrowRight size={14}/></a></div></div> }

function SaveIndicator({ status, error }: { status: SaveStatus; error: string }) {
  if (status === 'idle') return null
  if (status === 'saving') return <span className="save-indicator saving" role="status"><LoaderCircle size={13} className="spin"/>Saving…</span>
  if (status === 'error') return <span className="save-indicator failed" role="alert" title={error}><AlertCircle size={13}/><span>Save failed</span></span>
  return <span className="save-indicator saved" role="status"><CheckCircle2 size={13}/>All changes saved</span>
}

export default App
