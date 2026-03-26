'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Phase, Task, TaskStatus } from '@/lib/data'
import { supabase } from '@/lib/supabase'
import styles from './page.module.css'

type RoadmapState = Record<string, { status: TaskStatus; notes: string }>
type StepStatusState = Record<string, boolean>

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; dot: string }> = {
  'not-started': { label: 'Not started', color: styles.statusNotStarted, dot: '#C4C2BC' },
  'in-progress':  { label: 'In progress',  color: styles.statusInProgress,  dot: '#185FA5' },
  'complete':     { label: 'Complete',      color: styles.statusComplete,    dot: '#0F6E56' },
  'blocked':      { label: 'Blocked',       color: styles.statusBlocked,     dot: '#A32D2D' },
}

const PHASE_COLORS = {
  teal:  { bg: 'var(--teal-50)',  border: 'var(--teal-100)', accent: 'var(--teal-600)', text: 'var(--teal-900)', pill: 'var(--teal-800)' },
  blue:  { bg: 'var(--blue-50)',  border: 'var(--blue-100)', accent: 'var(--blue-600)', text: 'var(--blue-900)', pill: 'var(--blue-800)' },
  amber: { bg: 'var(--amber-50)', border: 'var(--amber-100)', accent: 'var(--amber-600)', text: 'var(--amber-900)', pill: 'var(--amber-800)' },
  pink:  { bg: 'var(--pink-50)',  border: 'var(--pink-100)', accent: 'var(--pink-600)', text: 'var(--pink-900)', pill: 'var(--pink-800)' },
}

function phaseProgress(phase: Phase, state: RoadmapState) {
  const done = phase.tasks.filter(t => state[t.id]?.status === 'complete').length
  return { done, total: phase.tasks.length, pct: Math.round((done / phase.tasks.length) * 100) }
}

function overallProgress(phases: Phase[], state: RoadmapState) {
  const total = phases.flatMap(p => p.tasks).length
  const done  = phases.flatMap(p => p.tasks).filter(t => state[t.id]?.status === 'complete').length
  return { done, total, pct: Math.round((done / total) * 100) }
}

export default function RoadmapPage() {
  const [activePhase, setActivePhase] = useState(0)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [roadmapData, setRoadmapData] = useState<Phase[]>([])
  const [roadmapState, setRoadmapState] = useState<RoadmapState>({})
  const [stepStatusState, setStepStatusState] = useState<StepStatusState>({})
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editingPhase, setEditingPhase] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [editingSubtask, setEditingSubtask] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, any>>({})
  const [addingTaskToPhase, setAddingTaskToPhase] = useState<string | null>(null)
  const [newTask, setNewTask] = useState({ title: '', description: '', owner: '', output: '', dependency: '' })
  const [addingStepToTask, setAddingStepToTask] = useState<string | null>(null)
  const [newStepText, setNewStepText] = useState('')
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Load from Supabase and subscribe to real-time updates
  useEffect(() => {
    const loadState = async () => {
      try {
        // Load roadmap data
        const { data: phasesData, error: phasesError } = await supabase
          .from('roadmap_phases')
          .select('*')
          .order('order')

        if (phasesError) throw phasesError

        const phases: Phase[] = []
        for (const phase of phasesData) {
          const { data: tasksData, error: tasksError } = await supabase
            .from('roadmap_tasks')
            .select('*')
            .eq('phase_id', phase.id)
            .order('order')

          if (tasksError) throw tasksError

          const tasks: Task[] = []
          for (const task of tasksData) {
            const { data: subtasksData, error: subtasksError } = await supabase
              .from('roadmap_subtasks')
              .select('*')
              .eq('task_id', task.id)
              .order('order')

            if (subtasksError) throw subtasksError

            tasks.push({
              id: task.id,
              title: task.title,
              description: task.description,
              owner: task.owner,
              output: task.output,
              dependency: task.dependency,
              subtasks: subtasksData.map(s => ({
                id: s.id,
                text: s.text,
                order: s.order,
              })),
              status: 'not-started',
              notes: '',
              order: task.order,
            })
          }

          phases.push({
            id: phase.id,
            label: `Phase ${phase.id}`,
            title: phase.title,
            subtitle: phase.subtitle,
            duration: phase.duration,
            color: phase.color as Phase['color'],
            tasks,
            order: phase.order,
          })
        }

        setRoadmapData(phases)

        // Load roadmap state
        const { data: stateData, error: stateError } = await supabase
          .from('roadmap_state')
          .select('*')

        if (stateError) throw stateError

        const state: RoadmapState = {}
        stateData.forEach(item => {
          state[item.id] = { status: item.status, notes: item.notes }
        })
        setRoadmapState(state)

        // Load step status
        const { data: stepData, error: stepError } = await supabase
          .from('step_status')
          .select('*')

        if (stepError) throw stepError

        const stepState: StepStatusState = {}
        stepData.forEach(item => {
          stepState[item.id] = item.completed
        })
        setStepStatusState(stepState)

        setIsLoading(false)
      } catch (error) {
        console.error('Error loading data:', error)
        setIsLoading(false)
      }
    }

    loadState()

    // Set up real-time subscriptions
    const roadmapChannel = supabase.channel('roadmap_state_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roadmap_state' },
        (payload) => {
          const { new: newRecord, old: oldRecord } = payload
          if (newRecord && payload.eventType !== 'DELETE') {
            const record = newRecord as { id: string; status: TaskStatus; notes: string; updated_at: string }
            setRoadmapState((prev) => ({
              ...prev,
              [record.id]: { status: record.status, notes: record.notes },
            }))
            setLastUpdated(record.updated_at)
          } else if (payload.eventType === 'DELETE' && oldRecord) {
            const record = oldRecord as { id: string }
            setRoadmapState((prev) => {
              const updated = { ...prev }
              delete updated[record.id]
              return updated
            })
          }
        }
      )
      .subscribe()

    const stepChannel = supabase.channel('step_status_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'step_status' },
        (payload) => {
          const { new: newRecord, old: oldRecord } = payload
          if (newRecord && payload.eventType !== 'DELETE') {
            const record = newRecord as { id: string; completed: boolean }
            setStepStatusState((prev) => ({
              ...prev,
              [record.id]: record.completed,
            }))
          } else if (payload.eventType === 'DELETE' && oldRecord) {
            const record = oldRecord as { id: string }
            setStepStatusState((prev) => {
              const updated = { ...prev }
              delete updated[record.id]
              return updated
            })
          }
        }
      )
      .subscribe()

    unsubscribeRef.current = () => {
      roadmapChannel.unsubscribe()
      stepChannel.unsubscribe()
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [])

  const saveState = useCallback(async (newState: RoadmapState) => {
    const now = new Date().toISOString()
    try {
      // For each task in newState, upsert into Supabase
      for (const [taskId, taskState] of Object.entries(newState)) {
        await supabase
          .from('roadmap_state')
          .upsert(
            {
              id: taskId,
              status: taskState.status,
              notes: taskState.notes,
              updated_at: now,
            },
            { onConflict: 'id' }
          )
      }
      setLastUpdated(now)
      setRoadmapState(newState)
    } catch (error) {
      console.error('Error saving roadmap state:', error)
    }
  }, [])

  const toggleStepStatus = useCallback(async (stepId: string) => {
    const currentStatus = stepStatusState[stepId] || false
    const newStatus = !currentStatus

    try {
      await supabase
        .from('step_status')
        .upsert(
          {
            id: stepId,
            completed: newStatus,
          },
          { onConflict: 'id' }
        )
      setStepStatusState((prev) => ({
        ...prev,
        [stepId]: newStatus,
      }))
    } catch (error) {
      console.error('Error toggling step status:', error)
    }
  }, [stepStatusState])

  const getTaskState = (taskId: string) => ({
    status: roadmapState[taskId]?.status ?? 'not-started' as TaskStatus,
    notes: roadmapState[taskId]?.notes ?? '',
  })

  const updateStatus = (taskId: string, status: TaskStatus) => {
    const next = { ...roadmapState, [taskId]: { ...getTaskState(taskId), status } }
    saveState(next)
  }

  const saveNotes = (taskId: string) => {
    const next = { ...roadmapState, [taskId]: { ...getTaskState(taskId), notes: notesValue } }
    saveState(next)
    setEditingNotes(null)
  }

  const startEditPhase = (phaseId: string) => {
    const phase = roadmapData.find(p => p.id === phaseId)
    if (phase) {
      setEditValues({ ...editValues, [phaseId]: { title: phase.title, subtitle: phase.subtitle, duration: phase.duration } })
      setEditingPhase(phaseId)
    }
  }

  const savePhase = async (phaseId: string) => {
    const values = editValues[phaseId]
    if (!values) return

    try {
      await supabase
        .from('roadmap_phases')
        .update({
          title: values.title,
          subtitle: values.subtitle,
          duration: values.duration,
          updated_at: new Date().toISOString(),
        })
        .eq('id', phaseId)

      setRoadmapData(prev => prev.map(p => p.id === phaseId ? { ...p, ...values } : p))
      setEditingPhase(null)
      setEditValues(prev => { const updated = { ...prev }; delete updated[phaseId]; return updated })
    } catch (error) {
      console.error('Error saving phase:', error)
    }
  }

  const cancelEditPhase = (phaseId: string) => {
    setEditingPhase(null)
    setEditValues(prev => { const updated = { ...prev }; delete updated[phaseId]; return updated })
  }

  const startEditTask = (taskId: string) => {
    const task = roadmapData.flatMap(p => p.tasks).find(t => t.id === taskId)
    if (task) {
      setEditValues({ ...editValues, [taskId]: {
        title: task.title,
        description: task.description,
        owner: task.owner,
        output: task.output,
        dependency: task.dependency
      } })
      setEditingTask(taskId)
    }
  }

  const saveTask = async (taskId: string) => {
    const values = editValues[taskId]
    if (!values) return

    try {
      await supabase
        .from('roadmap_tasks')
        .update({
          title: values.title,
          description: values.description,
          owner: values.owner,
          output: values.output,
          dependency: values.dependency,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)

      setRoadmapData(prev => prev.map(p => ({
        ...p,
        tasks: p.tasks.map(t => t.id === taskId ? { ...t, ...values } : t)
      })))
      setEditingTask(null)
      setEditValues(prev => { const updated = { ...prev }; delete updated[taskId]; return updated })
    } catch (error) {
      console.error('Error saving task:', error)
    }
  }

  const cancelEditTask = (taskId: string) => {
    setEditingTask(null)
    setEditValues(prev => { const updated = { ...prev }; delete updated[taskId]; return updated })
  }

  const startEditSubtask = (subtaskId: string) => {
    const subtask = roadmapData.flatMap(p => p.tasks).flatMap(t => t.subtasks).find(s => s.id === subtaskId)
    if (subtask) {
      setEditValues({ ...editValues, [subtaskId]: { text: subtask.text } })
      setEditingSubtask(subtaskId)
    }
  }

  const saveSubtask = async (subtaskId: string) => {
    const values = editValues[subtaskId]
    if (!values) return

    try {
      await supabase
        .from('roadmap_subtasks')
        .update({
          text: values.text,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subtaskId)

      setRoadmapData(prev => prev.map(p => ({
        ...p,
        tasks: p.tasks.map(t => ({
          ...t,
          subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, text: values.text } : s)
        }))
      })))
      setEditingSubtask(null)
      setEditValues(prev => { const updated = { ...prev }; delete updated[subtaskId]; return updated })
    } catch (error) {
      console.error('Error saving subtask:', error)
    }
  }

  const cancelEditSubtask = (subtaskId: string) => {
    setEditingSubtask(null)
    setEditValues(prev => { const updated = { ...prev }; delete updated[subtaskId]; return updated })
  }

  const addTask = async (phaseId: string) => {
    if (!newTask.title.trim()) return
    const phase = roadmapData.find(p => p.id === phaseId)
    const nextOrder = phase ? Math.max(0, ...phase.tasks.map(t => t.order)) + 1 : 0
    const id = `${phaseId}-task-${Date.now()}`

    try {
      await supabase.from('roadmap_tasks').insert({
        id,
        phase_id: phaseId,
        title: newTask.title,
        description: newTask.description,
        owner: newTask.owner,
        output: newTask.output || null,
        dependency: newTask.dependency || null,
        order: nextOrder,
      })

      setRoadmapData(prev => prev.map(p => p.id === phaseId ? {
        ...p,
        tasks: [...p.tasks, {
          id,
          title: newTask.title,
          description: newTask.description,
          owner: newTask.owner,
          output: newTask.output,
          dependency: newTask.dependency,
          subtasks: [],
          status: 'not-started' as TaskStatus,
          notes: '',
          order: nextOrder,
        }]
      } : p))
      setAddingTaskToPhase(null)
      setNewTask({ title: '', description: '', owner: '', output: '', dependency: '' })
    } catch (error) {
      console.error('Error adding task:', error)
    }
  }

  const addStep = async (taskId: string) => {
    if (!newStepText.trim()) return
    const task = roadmapData.flatMap(p => p.tasks).find(t => t.id === taskId)
    const nextOrder = task ? Math.max(0, ...task.subtasks.map(s => s.order)) + 1 : 0
    const id = `${taskId}-step-${Date.now()}`

    try {
      await supabase.from('roadmap_subtasks').insert({
        id,
        task_id: taskId,
        text: newStepText,
        order: nextOrder,
      })

      setRoadmapData(prev => prev.map(p => ({
        ...p,
        tasks: p.tasks.map(t => t.id === taskId ? {
          ...t,
          subtasks: [...t.subtasks, { id, text: newStepText, order: nextOrder }]
        } : t)
      })))
      setAddingStepToTask(null)
      setNewStepText('')
    } catch (error) {
      console.error('Error adding step:', error)
    }
  }

  const deleteSubtask = async (subtaskId: string) => {
    try {
      await supabase.from('roadmap_subtasks').delete().eq('id', subtaskId)
      await supabase.from('step_status').delete().eq('id', subtaskId)
      setRoadmapData(prev => prev.map(p => ({
        ...p,
        tasks: p.tasks.map(t => ({
          ...t,
          subtasks: t.subtasks.filter(s => s.id !== subtaskId)
        }))
      })))
      setStepStatusState(prev => {
        const updated = { ...prev }
        delete updated[subtaskId]
        return updated
      })
    } catch (error) {
      console.error('Error deleting subtask:', error)
    }
  }

  const overall = overallProgress(roadmapData, roadmapState)
  const phase = roadmapData[activePhase]
  const colors = PHASE_COLORS[phase?.color || 'teal']

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={styles.page}>
      {isLoading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontSize: '16px',
          color: '#666'
        }}>
          Loading roadmap...
        </div>
      )}
      {!isLoading && (
      <>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerProgress}>
          <div className={styles.headerProgressInner}>
            <div className={styles.overallProgress}>
              <div className={styles.progressLabel}>
                <span>{overall.done} of {overall.total} tasks complete</span>
                <span className={styles.progressPct}>{overall.pct}%</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${overall.pct}%` }} />
              </div>
              <div className={styles.dateRuler}>
                {(() => {
                  const start = new Date('2026-03-23')
                  const end = new Date('2026-04-29')
                  const totalMs = end.getTime() - start.getTime()
                  const numTicks = 5
                  const ticks = Array.from({ length: numTicks }, (_, i) =>
                    new Date(start.getTime() + (totalMs * i) / (numTicks - 1))
                  )
                  return ticks.map((d, i) => {
                    const pct = ((d.getTime() - start.getTime()) / totalMs) * 100
                    return (
                      <span
                        key={i}
                        className={styles.dateRulerLabel}
                        style={{ left: `${pct}%` }}
                      >
                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )
                  })
                })()}
              </div>
            </div>
          </div>
        </div>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <div className={styles.headerEyebrow}>Clutch RevOps</div>
            <h1 className={styles.headerTitle}>2026 HubSpot Roadmap</h1>
            <p className={styles.headerSubtitle}>HubSpot project roadmap</p>
          </div>
          <div className={styles.headerRight}>
            {lastUpdated && (
              <p className={styles.lastUpdated}>Updated {formatDate(lastUpdated)}</p>
            )}
            <button
              className={styles.signOutBtn}
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Phase nav */}
      <nav className={styles.phaseNav}>
        <div className={styles.phaseNavInner}>
          {roadmapData.map((p, i) => {
            const prog = phaseProgress(p, roadmapState)
            const c = PHASE_COLORS[p.color]
            const isActive = i === activePhase
            return (
              <button
                key={p.id}
                className={`${styles.phasePill} ${isActive ? styles.phasePillActive : ''}`}
                style={isActive ? {
                  background: c.bg,
                  borderColor: c.accent,
                  color: c.text,
                } : {}}
                onClick={() => { setActivePhase(i); setExpandedTask(null) }}
              >
                <span className={styles.pillLabel}>{p.label}</span>
                <span className={styles.pillTitle}>{p.title}</span>
                <div className={styles.pillMeta}>
                  <span className={styles.pillDuration}>{p.duration}</span>
                  <span className={styles.pillProgress} style={isActive ? { color: c.accent } : {}}>
                    {prog.done}/{prog.total}
                  </span>
                </div>
                {isActive && (
                  <div className={styles.pillProgressBar}>
                    <div style={{ width: `${prog.pct}%`, background: c.accent, height: '100%', borderRadius: '2px', transition: 'width 0.4s ease' }} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Phase content */}
      <main className={styles.main}>
        <div className={styles.phaseHeader} style={{ borderLeftColor: colors.accent }}>
          <div>
            {editingPhase === phase.id ? (
              <div className={styles.editForm}>
                <input
                  type="text"
                  value={editValues[phase.id]?.title || ''}
                  onChange={(e) => setEditValues(prev => ({ ...prev, [phase.id]: { ...prev[phase.id], title: e.target.value } }))}
                  placeholder="Phase title"
                  className={styles.editInput}
                />
                <input
                  type="text"
                  value={editValues[phase.id]?.subtitle || ''}
                  onChange={(e) => setEditValues(prev => ({ ...prev, [phase.id]: { ...prev[phase.id], subtitle: e.target.value } }))}
                  placeholder="Phase subtitle"
                  className={styles.editInput}
                />
                <input
                  type="text"
                  value={editValues[phase.id]?.duration || ''}
                  onChange={(e) => setEditValues(prev => ({ ...prev, [phase.id]: { ...prev[phase.id], duration: e.target.value } }))}
                  placeholder="Duration"
                  className={styles.editInput}
                />
                <div className={styles.editActions}>
                  <button onClick={() => savePhase(phase.id)} className={styles.saveBtn}>Save</button>
                  <button onClick={() => cancelEditPhase(phase.id)} className={styles.cancelBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h2 className={styles.phaseTitle}>
                  {phase.title}
                  <button onClick={() => startEditPhase(phase.id)} className={styles.editIcon}><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg></button>
                </h2>
                <p className={styles.phaseSubtitle}>{phase.subtitle}</p>
              </>
            )}
          </div>
          <span className={styles.phaseDurationBadge} style={{ background: colors.bg, color: colors.pill, border: `1px solid ${colors.border}` }}>
            {phase.duration}
          </span>
        </div>

        <div className={styles.taskList}>
          {phase.tasks.map((task, taskIdx) => {
            const tState = getTaskState(task.id)
            const isExpanded = expandedTask === task.id
            const statusCfg = STATUS_CONFIG[tState.status]

            return (
              <div
                key={task.id}
                className={`${styles.taskCard} ${isExpanded ? styles.taskCardExpanded : ''}`}
              >
                {/* Task header */}
                <div
                  className={styles.taskHeader}
                  onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                >
                  <div className={styles.taskIndex} style={{ background: colors.bg, color: colors.accent, border: `1px solid ${colors.border}` }}>
                    {taskIdx + 1}
                  </div>
                  <div className={styles.taskInfo}>
                    <div className={styles.taskTitleRow}>
                      <span className={styles.taskTitle}>
                        {editingTask === task.id ? (
                          <input
                            type="text"
                            value={editValues[task.id]?.title || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, [task.id]: { ...prev[task.id], title: e.target.value } }))}
                            placeholder="Task title"
                            className={styles.editInput}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            {task.title}
                            <button onClick={(e) => { e.stopPropagation(); startEditTask(task.id) }} className={styles.editIcon}><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg></button>
                          </>
                        )}
                      </span>
                      <span className={`${styles.statusBadge} ${statusCfg.color}`}>
                        <span className={styles.statusDot} style={{ background: statusCfg.dot }} />
                        {statusCfg.label}
                      </span>
                    </div>
                    {editingTask === task.id ? (
                      <div className={styles.editForm} onClick={(e) => e.stopPropagation()}>
                        <textarea
                          value={editValues[task.id]?.description || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, [task.id]: { ...prev[task.id], description: e.target.value } }))}
                          placeholder="Task description"
                          className={styles.editTextarea}
                          rows={2}
                        />
                        <input
                          type="text"
                          value={editValues[task.id]?.owner || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, [task.id]: { ...prev[task.id], owner: e.target.value } }))}
                          placeholder="Owner"
                          className={styles.editInput}
                        />
                        <input
                          type="text"
                          value={editValues[task.id]?.output || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, [task.id]: { ...prev[task.id], output: e.target.value } }))}
                          placeholder="Output"
                          className={styles.editInput}
                        />
                        <input
                          type="text"
                          value={editValues[task.id]?.dependency || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, [task.id]: { ...prev[task.id], dependency: e.target.value } }))}
                          placeholder="Dependency"
                          className={styles.editInput}
                        />
                        <div className={styles.editActions}>
                          <button onClick={() => saveTask(task.id)} className={styles.saveBtn}>Save</button>
                          <button onClick={() => cancelEditTask(task.id)} className={styles.cancelBtn}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <p className={styles.taskDesc}>{task.description}</p>
                    )}
                    <div className={styles.taskTags}>
                      <span className={styles.tag}>{task.owner}</span>
                      {task.output && <span className={`${styles.tag} ${styles.tagBlue}`}>{task.output}</span>}
                      {task.dependency && <span className={`${styles.tag} ${styles.tagAmber}`}>{task.dependency}</span>}
                    </div>
                  </div>
                  <span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>›</span>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div className={styles.taskBody}>
                    {/* Status selector */}
                    <div className={styles.statusSelector}>
                      <span className={styles.selectorLabel}>Status</span>
                      <div className={styles.statusOptions}>
                        {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map(s => (
                          <button
                            key={s}
                            className={`${styles.statusOption} ${tState.status === s ? styles.statusOptionActive : ''}`}
                            style={tState.status === s ? { borderColor: STATUS_CONFIG[s].dot, background: `${STATUS_CONFIG[s].dot}14` } : {}}
                            onClick={() => updateStatus(task.id, s)}
                          >
                            <span className={styles.statusDot} style={{ background: STATUS_CONFIG[s].dot }} />
                            {STATUS_CONFIG[s].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Subtasks */}
                    <div className={styles.subtaskSection}>
                      <span className={styles.sectionLabel}>Steps</span>
                      <ul className={styles.subtaskList}>
                        {task.subtasks.map(sub => (
                          <li key={sub.id} className={styles.subtaskItem}>
                            <input
                              type="checkbox"
                              className={styles.subtaskCheckbox}
                              checked={stepStatusState[sub.id] || false}
                              onChange={() => toggleStepStatus(sub.id)}
                            />
                            <span className={styles.subtaskDash}>—</span>
                            {editingSubtask === sub.id ? (
                              <div className={styles.editForm} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="text"
                                  value={editValues[sub.id]?.text || ''}
                                  onChange={(e) => setEditValues(prev => ({ ...prev, [sub.id]: { ...prev[sub.id], text: e.target.value } }))}
                                  placeholder="Step text"
                                  className={styles.editInput}
                                  style={{ flex: 1 }}
                                />
                                <button onClick={() => saveSubtask(sub.id)} className={styles.saveBtn}>Save</button>
                                <button onClick={() => cancelEditSubtask(sub.id)} className={styles.cancelBtn}>Cancel</button>
                              </div>
                            ) : (
                              <>
                                <span className={stepStatusState[sub.id] ? styles.subtaskCompleted : ''}>{sub.text}</span>
                                <button onClick={() => startEditSubtask(sub.id)} className={styles.editIcon}><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg></button>
                                <button onClick={() => deleteSubtask(sub.id)} className={styles.deleteIcon}><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                      {addingStepToTask === task.id ? (
                        <div className={styles.addStepForm}>
                          <input
                            type="text"
                            value={newStepText}
                            onChange={(e) => setNewStepText(e.target.value)}
                            placeholder="Step description"
                            className={styles.editInput}
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') addStep(task.id); if (e.key === 'Escape') { setAddingStepToTask(null); setNewStepText('') } }}
                          />
                          <div className={styles.editActions}>
                            <button onClick={() => addStep(task.id)} className={styles.saveBtn}>Add</button>
                            <button onClick={() => { setAddingStepToTask(null); setNewStepText('') }} className={styles.cancelBtn}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button className={styles.addBtn} onClick={() => setAddingStepToTask(task.id)}>+ Add step</button>
                      )}
                    </div>

                    {/* Notes */}
                    <div className={styles.notesSection}>
                      <span className={styles.sectionLabel}>Notes</span>
                      {editingNotes === task.id ? (
                        <div className={styles.notesEditor}>
                          <textarea
                            className={styles.notesTextarea}
                            value={notesValue}
                            onChange={e => setNotesValue(e.target.value)}
                            placeholder="Add notes, blockers, or context…"
                            rows={3}
                            autoFocus
                          />
                          <div className={styles.notesActions}>
                            <button className={styles.notesSave} onClick={() => saveNotes(task.id)}>Save</button>
                            <button className={styles.notesCancel} onClick={() => setEditingNotes(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`${styles.notesDisplay} ${styles.notesDisplayEditable}`}
                          onClick={() => {
                            setEditingNotes(task.id)
                            setNotesValue(tState.notes)
                          }}
                        >
                          {tState.notes || <span className={styles.notesEmpty}>Click to add notes…</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Add task form */}
          {addingTaskToPhase === phase.id ? (
            <div className={styles.taskCard}>
              <div className={styles.addTaskForm}>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Task title"
                  className={styles.editInput}
                  autoFocus
                />
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Task description"
                  className={styles.editTextarea}
                  rows={2}
                />
                <input
                  type="text"
                  value={newTask.owner}
                  onChange={(e) => setNewTask(prev => ({ ...prev, owner: e.target.value }))}
                  placeholder="Owner"
                  className={styles.editInput}
                />
                <input
                  type="text"
                  value={newTask.output}
                  onChange={(e) => setNewTask(prev => ({ ...prev, output: e.target.value }))}
                  placeholder="Output (optional)"
                  className={styles.editInput}
                />
                <input
                  type="text"
                  value={newTask.dependency}
                  onChange={(e) => setNewTask(prev => ({ ...prev, dependency: e.target.value }))}
                  placeholder="Dependency (optional)"
                  className={styles.editInput}
                />
                <div className={styles.editActions}>
                  <button onClick={() => addTask(phase.id)} className={styles.saveBtn}>Add Task</button>
                  <button onClick={() => { setAddingTaskToPhase(null); setNewTask({ title: '', description: '', owner: '', output: '', dependency: '' }) }} className={styles.cancelBtn}>Cancel</button>
                </div>
              </div>
            </div>
          ) : (
            <button className={styles.addTaskBtn} onClick={() => setAddingTaskToPhase(phase.id)}>+ Add task</button>
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <span>Clutch RevOps · SMS Migration · {new Date().getFullYear()}</span>
      </footer>
      </>
      )}
    </div>
  )
}
