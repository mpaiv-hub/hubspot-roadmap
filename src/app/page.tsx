'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Phase, Task, TaskStatus } from '@/lib/data'
import { supabase } from '@/lib/supabase'
import styles from './page.module.css'

type RoadmapState = Record<string, { status: TaskStatus; notes: string }>
type StepStatusState = Record<string, boolean>
type Comment = { id: string; task_id: string; author: string; content: string; created_at: string }

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`
}

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
  gray:  { bg: 'var(--gray-100)', border: 'var(--gray-200)', accent: 'var(--gray-600)', text: 'var(--gray-800)', pill: 'var(--gray-600)' },
}

function phaseStatus(phase: Phase, state: RoadmapState): TaskStatus {
  const statuses = phase.tasks.map(t => state[t.id]?.status ?? 'not-started')
  if (statuses.length === 0) return 'not-started'
  if (statuses.some(s => s === 'blocked')) return 'blocked'
  if (statuses.every(s => s === 'complete')) return 'complete'
  if (statuses.some(s => s === 'in-progress' || s === 'complete')) return 'in-progress'
  return 'not-started'
}

function phaseProgress(phase: Phase, state: RoadmapState) {
  if (phase.tasks.length === 0) return { done: 0, total: 0, pct: 0 }
  const done = phase.tasks.filter(t => state[t.id]?.status === 'complete').length
  return { done, total: phase.tasks.length, pct: Math.round((done / phase.tasks.length) * 100) }
}

function overallProgress(phases: Phase[], state: RoadmapState) {
  const total = phases.flatMap(p => p.tasks).length
  if (total === 0) return { done: 0, total: 0, pct: 0 }
  const done  = phases.flatMap(p => p.tasks).filter(t => state[t.id]?.status === 'complete').length
  return { done, total, pct: Math.round((done / total) * 100) }
}

export default function RoadmapPage() {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null)
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
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [newComment, setNewComment] = useState<{ author: string; content: string }>({ author: '', content: '' })
  const [commentFormOpen, setCommentFormOpen] = useState<string | null>(null)
  const [addingWorkstream, setAddingWorkstream] = useState(false)
  const [newWorkstream, setNewWorkstream] = useState({ title: '', subtitle: '', duration: '', color: 'teal' as Phase['color'] })
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

        // Load comments
        const { data: commentsData, error: commentsError } = await supabase
          .from('roadmap_comments')
          .select('*')
          .order('created_at', { ascending: false })

        if (commentsError) throw commentsError

        const commentsMap: Record<string, Comment[]> = {}
        commentsData.forEach((c: any) => {
          if (!commentsMap[c.task_id]) commentsMap[c.task_id] = []
          commentsMap[c.task_id].push({ id: c.id, task_id: c.task_id, author: c.author, content: c.content, created_at: c.created_at })
        })
        setComments(commentsMap)

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

    const commentsChannel = supabase.channel('roadmap_comments_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roadmap_comments' },
        (payload) => {
          const { new: newRecord, old: oldRecord } = payload
          if (payload.eventType === 'INSERT' && newRecord) {
            const c = newRecord as Comment
            setComments(prev => {
              const list = prev[c.task_id] ? [...prev[c.task_id]] : []
              if (!list.find(x => x.id === c.id)) list.unshift(c)
              return { ...prev, [c.task_id]: list }
            })
          } else if (payload.eventType === 'DELETE' && oldRecord) {
            const c = oldRecord as Comment
            setComments(prev => {
              const list = (prev[c.task_id] || []).filter(x => x.id !== c.id)
              return { ...prev, [c.task_id]: list }
            })
          }
        }
      )
      .subscribe()

    unsubscribeRef.current = () => {
      roadmapChannel.unsubscribe()
      stepChannel.unsubscribe()
      commentsChannel.unsubscribe()
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

  const deleteTask = async (taskId: string, phaseId: string) => {
    if (!window.confirm('Delete this task and all its subtasks?')) return
    try {
      const task = roadmapData.flatMap(p => p.tasks).find(t => t.id === taskId)
      const subtaskIds = task ? task.subtasks.map(s => s.id) : []
      if (subtaskIds.length > 0) {
        await supabase.from('step_status').delete().in('id', subtaskIds)
        await supabase.from('roadmap_subtasks').delete().eq('task_id', taskId)
      }
      await supabase.from('roadmap_state').delete().eq('id', taskId)
      await supabase.from('roadmap_comments').delete().eq('task_id', taskId)
      await supabase.from('roadmap_tasks').delete().eq('id', taskId)

      setRoadmapData(prev => prev.map(p => p.id === phaseId ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) } : p))
      setRoadmapState(prev => { const u = { ...prev }; delete u[taskId]; return u })
      setStepStatusState(prev => { const u = { ...prev }; subtaskIds.forEach(id => delete u[id]); return u })
      setComments(prev => { const u = { ...prev }; delete u[taskId]; return u })
      if (expandedTask === taskId) setExpandedTask(null)
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const deletePhase = async (phaseId: string) => {
    if (!window.confirm('Delete this workstream and all its tasks?')) return
    try {
      const phase = roadmapData.find(p => p.id === phaseId)
      if (!phase) return
      const taskIds = phase.tasks.map(t => t.id)
      const subtaskIds = phase.tasks.flatMap(t => t.subtasks.map(s => s.id))

      if (subtaskIds.length > 0) {
        await supabase.from('step_status').delete().in('id', subtaskIds)
      }
      for (const tid of taskIds) {
        await supabase.from('roadmap_subtasks').delete().eq('task_id', tid)
        await supabase.from('roadmap_state').delete().eq('id', tid)
        await supabase.from('roadmap_comments').delete().eq('task_id', tid)
      }
      if (taskIds.length > 0) {
        await supabase.from('roadmap_tasks').delete().eq('phase_id', phaseId)
      }
      await supabase.from('roadmap_phases').delete().eq('id', phaseId)

      setRoadmapData(prev => prev.filter(p => p.id !== phaseId))
      setRoadmapState(prev => { const u = { ...prev }; taskIds.forEach(id => delete u[id]); return u })
      setStepStatusState(prev => { const u = { ...prev }; subtaskIds.forEach(id => delete u[id]); return u })
      setComments(prev => { const u = { ...prev }; taskIds.forEach(id => delete u[id]); return u })
      if (expandedPhase === phaseId) setExpandedPhase(null)
    } catch (error) {
      console.error('Error deleting phase:', error)
    }
  }

  const addWorkstream = async () => {
    if (!newWorkstream.title.trim()) return
    const nextOrder = roadmapData.length > 0 ? Math.max(...roadmapData.map(p => p.order)) + 1 : 0
    const id = `phase-${Date.now()}`

    try {
      await supabase.from('roadmap_phases').insert({
        id,
        title: newWorkstream.title,
        subtitle: newWorkstream.subtitle,
        duration: newWorkstream.duration,
        color: newWorkstream.color,
        order: nextOrder,
      })

      setRoadmapData(prev => [...prev, {
        id,
        label: `Phase ${id}`,
        title: newWorkstream.title,
        subtitle: newWorkstream.subtitle,
        duration: newWorkstream.duration,
        color: newWorkstream.color,
        tasks: [],
        order: nextOrder,
      }])
      setAddingWorkstream(false)
      setNewWorkstream({ title: '', subtitle: '', duration: '', color: 'teal' })
    } catch (error) {
      console.error('Error adding workstream:', error)
    }
  }

  const addCommentToTask = async (taskId: string) => {
    if (!newComment.content.trim() || !newComment.author.trim()) return
    const id = `comment-${Date.now()}`
    const created_at = new Date().toISOString()

    try {
      await supabase.from('roadmap_comments').insert({
        id,
        task_id: taskId,
        author: newComment.author,
        content: newComment.content,
        created_at,
      })

      const comment: Comment = { id, task_id: taskId, author: newComment.author, content: newComment.content, created_at }
      setComments(prev => ({
        ...prev,
        [taskId]: [comment, ...(prev[taskId] || [])],
      }))
      setNewComment({ author: '', content: '' })
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  const deleteComment = async (commentId: string, taskId: string) => {
    if (!window.confirm('Delete this comment?')) return
    try {
      await supabase.from('roadmap_comments').delete().eq('id', commentId)
      setComments(prev => ({
        ...prev,
        [taskId]: (prev[taskId] || []).filter(c => c.id !== commentId),
      }))
    } catch (error) {
      console.error('Error deleting comment:', error)
    }
  }

  // Computed stats
  const overall = overallProgress(roadmapData, roadmapState)

  const statusCounts = useMemo(() => {
    const allTasks = roadmapData.flatMap(p => p.tasks)
    return {
      total: allTasks.length,
      complete: allTasks.filter(t => roadmapState[t.id]?.status === 'complete').length,
      inProgress: allTasks.filter(t => roadmapState[t.id]?.status === 'in-progress').length,
      blocked: allTasks.filter(t => roadmapState[t.id]?.status === 'blocked').length,
      notStarted: allTasks.filter(t => !roadmapState[t.id] || roadmapState[t.id]?.status === 'not-started').length,
    }
  }, [roadmapData, roadmapState])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // Timeline date config
  const timelineStart = new Date('2026-04-01')
  const timelineEnd = new Date('2026-06-30')
  const timelineMonths = ['Apr', 'May', 'Jun']
  const totalMs = timelineEnd.getTime() - timelineStart.getTime()

  // Parse "Apr 1 - May 5" duration into date positions on the timeline
  const parseDate = (str: string) => {
    const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
    const match = str.trim().match(/([A-Za-z]+)\s+(\d+)/)
    if (!match) return null
    return new Date(2026, months[match[1]] ?? 0, parseInt(match[2]))
  }
  const parseDuration = (duration: string) => {
    const parts = duration.split('-').map(s => s.trim())
    if (parts.length !== 2) return { startPct: 0, widthPct: 100 }
    const startDate = parseDate(parts[0])
    const endDate = parseDate(parts[1])
    if (!startDate || !endDate) return { startPct: 0, widthPct: 100 }
    const startPct = Math.max(0, ((startDate.getTime() - timelineStart.getTime()) / totalMs) * 100)
    const widthPct = Math.min(100 - startPct, ((endDate.getTime() - startDate.getTime()) / totalMs) * 100)
    return { startPct, widthPct: Math.max(widthPct, 2) }
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

      {/* Gantt Timeline */}
      <section className={styles.timelineHero}>
        <div className={styles.timelineInner}>
          <div className={styles.timelineHeader}>
            <span className={styles.timelineTitle}>Q2 2026 Timeline</span>
            <span className={styles.timelinePct}>{overall.pct}% complete</span>
          </div>

          <div className={styles.ganttChart}>
            {/* Month header row */}
            <div className={styles.ganttHeader}>
              <div className={styles.ganttLabelCol} />
              <div className={styles.ganttTrackCol}>
                <div className={styles.monthLabels}>
                  {timelineMonths.map((m, i) => (
                    <span key={m} className={styles.monthLabel} style={{ left: `${(i / 3) * 100}%`, width: `${100 / 3}%` }}>
                      {m} 2026
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Workstream rows */}
            {roadmapData.filter(p => p.duration && p.duration.includes('-')).map((p) => {
              const c = PHASE_COLORS[p.color] || PHASE_COLORS.teal
              const prog = phaseProgress(p, roadmapState)
              const { startPct, widthPct } = parseDuration(p.duration)
              return (
                <div
                  key={p.id}
                  className={styles.ganttRow}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setExpandedPhase(expandedPhase === p.id ? null : p.id)
                    setExpandedTask(null)
                    setTimeout(() => {
                      document.getElementById(`workstream-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }, 100)
                  }}
                >
                  <div className={styles.ganttLabelCol}>
                    <span className={styles.ganttLabel}>{p.title}</span>
                  </div>
                  <div className={styles.ganttTrackCol}>
                    {/* Grid lines */}
                    <div className={styles.ganttGridLines}>
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className={styles.ganttGridLine} style={{ left: `${(i / 3) * 100}%` }} />
                      ))}
                      {/* Today marker */}
                      {(() => {
                        const now = new Date()
                        if (now >= timelineStart && now <= timelineEnd) {
                          const pct = ((now.getTime() - timelineStart.getTime()) / totalMs) * 100
                          return <div className={styles.ganttTodayLine} style={{ left: `${pct}%` }} />
                        }
                        return null
                      })()}
                    </div>
                    {/* Bar */}
                    <div
                      className={styles.ganttBar}
                      style={{
                        left: `${startPct}%`,
                        width: `${widthPct}%`,
                        background: c.border,
                      }}
                      title={`${p.title}: ${prog.done}/${prog.total} complete`}
                    >
                      <div
                        className={styles.ganttBarFill}
                        style={{ width: `${prog.pct}%`, background: c.accent }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}

          </div>
        </div>
      </section>

      {/* Summary Stats */}
      <section className={styles.statsRow}>
        <div className={styles.statsInner}>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{statusCounts.total}</span>
            <span className={styles.statLabel}>Total Tasks</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statDot} style={{ background: '#0F6E56' }} />
            <span className={styles.statNumber} style={{ color: 'var(--teal-800)' }}>{statusCounts.complete}</span>
            <span className={styles.statLabel}>Complete</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statDot} style={{ background: '#185FA5' }} />
            <span className={styles.statNumber} style={{ color: 'var(--blue-800)' }}>{statusCounts.inProgress}</span>
            <span className={styles.statLabel}>In Progress</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statDot} style={{ background: '#A32D2D' }} />
            <span className={styles.statNumber} style={{ color: '#791F1F' }}>{statusCounts.blocked}</span>
            <span className={styles.statLabel}>Blocked</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statDot} style={{ background: '#C4C2BC' }} />
            <span className={styles.statNumber}>{statusCounts.notStarted}</span>
            <span className={styles.statLabel}>Not Started</span>
          </div>
        </div>
      </section>

      {/* Workstream Rows */}
      <main className={styles.main}>
        {roadmapData.map((phase) => {
          const prog = phaseProgress(phase, roadmapState)
          const c = PHASE_COLORS[phase.color]
          const isExpanded = expandedPhase === phase.id
          const phaseTaskStatuses = phase.tasks.map(t => roadmapState[t.id]?.status ?? 'not-started')
          const wsStatus = phaseStatus(phase, roadmapState)
          const wsStatusCfg = STATUS_CONFIG[wsStatus]

          return (
            <div key={phase.id} id={`workstream-${phase.id}`} className={`${styles.workstreamCard} ${isExpanded ? styles.workstreamCardExpanded : ''}`}>
              {/* Workstream header row */}
              <div
                className={styles.workstreamHeader}
                onClick={() => { setExpandedPhase(isExpanded ? null : phase.id); setExpandedTask(null) }}
              >
                <div className={styles.workstreamColorBar} style={{ background: c.accent }} />
                <div className={styles.workstreamInfo}>
                  <div className={styles.workstreamTitleRow}>
                    <h3 className={styles.workstreamTitle}>{phase.title}</h3>
                    {phase.duration && (
                      <span className={styles.workstreamDates} style={{ color: c.accent }}>{phase.duration}</span>
                    )}
                    <span className={`${styles.statusBadge} ${wsStatusCfg.color}`}>
                      <span className={styles.statusDot} style={{ background: wsStatusCfg.dot }} />
                      {wsStatusCfg.label}
                    </span>
                  </div>
                  <p className={styles.workstreamSubtitle}>{phase.subtitle}</p>
                </div>

                <div className={styles.workstreamMeta}>
                  {/* Mini progress bar */}
                  <div className={styles.miniProgressWrap}>
                    <div className={styles.miniProgressTrack}>
                      <div className={styles.miniProgressFill} style={{ width: `${prog.pct}%`, background: c.accent }} />
                    </div>
                    <span className={styles.miniProgressLabel} style={{ color: c.accent }}>{prog.done}/{prog.total}</span>
                  </div>

                  {/* Status dots */}
                  <div className={styles.statusDots}>
                    {phaseTaskStatuses.map((s, i) => (
                      <span
                        key={i}
                        className={styles.statusDotSmall}
                        style={{ background: STATUS_CONFIG[s].dot }}
                        title={STATUS_CONFIG[s].label}
                      />
                    ))}
                  </div>
                </div>

                <span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>&#8250;</span>
              </div>

              {/* Expanded: tasks list */}
              {isExpanded && (
                <div className={styles.workstreamBody}>
                  {/* Phase editing */}
                  {editingPhase === phase.id ? (
                    <div className={styles.phaseEditSection}>
                      <div className={styles.editForm}>
                        <input
                          type="text"
                          value={editValues[phase.id]?.title || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, [phase.id]: { ...prev[phase.id], title: e.target.value } }))}
                          placeholder="Workstream title"
                          className={styles.editInput}
                        />
                        <input
                          type="text"
                          value={editValues[phase.id]?.subtitle || ''}
                          onChange={(e) => setEditValues(prev => ({ ...prev, [phase.id]: { ...prev[phase.id], subtitle: e.target.value } }))}
                          placeholder="Workstream subtitle"
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
                    </div>
                  ) : (
                    <div className={styles.phaseEditTrigger}>
                      <button onClick={() => startEditPhase(phase.id)} className={styles.editPhaseBtn}>
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="12" height="12"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>
                        Edit workstream
                      </button>
                      <button onClick={() => deletePhase(phase.id)} className={styles.deletePhaseBtn}>
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="12" height="12"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        Delete workstream
                      </button>
                    </div>
                  )}

                  {/* Tasks */}
                  <div className={styles.taskList}>
                    {phase.tasks.map((task, taskIdx) => {
                      const tState = getTaskState(task.id)
                      const isTaskExpanded = expandedTask === task.id
                      const statusCfg = STATUS_CONFIG[tState.status]

                      return (
                        <div
                          key={task.id}
                          className={`${styles.taskCard} ${isTaskExpanded ? styles.taskCardExpanded : ''}`}
                        >
                          {/* Task header */}
                          <div
                            className={styles.taskHeader}
                            onClick={() => setExpandedTask(isTaskExpanded ? null : task.id)}
                          >
                            <div className={styles.taskIndex} style={{ background: c.bg, color: c.accent, border: `1px solid ${c.border}` }}>
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
                                      <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id, phase.id) }} className={styles.deleteIcon}><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
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
                            <span className={`${styles.chevron} ${isTaskExpanded ? styles.chevronOpen : ''}`}>&#8250;</span>
                          </div>

                          {/* Expanded body */}
                          {isTaskExpanded && (
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
                                      <span className={styles.subtaskDash}>&mdash;</span>
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
                                      placeholder="Add notes, blockers, or context..."
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
                                    {tState.notes || <span className={styles.notesEmpty}>Click to add notes...</span>}
                                  </div>
                                )}
                              </div>

                              {/* Comments */}
                              <div className={styles.commentsSection}>
                                <div className={styles.commentHeaderRow}>
                                  <span className={styles.sectionLabel}>Comments</span>
                                  <button
                                    className={styles.addBtn}
                                    onClick={() => setCommentFormOpen(commentFormOpen === task.id ? null : task.id)}
                                  >
                                    {commentFormOpen === task.id ? '- Cancel' : '+ Add comment'}
                                  </button>
                                </div>
                                {commentFormOpen === task.id && (
                                  <div className={styles.commentForm}>
                                    <input
                                      type="text"
                                      value={newComment.author}
                                      onChange={(e) => setNewComment(prev => ({ ...prev, author: e.target.value }))}
                                      placeholder="Your name"
                                      className={styles.editInput}
                                      autoFocus
                                    />
                                    <textarea
                                      value={newComment.content}
                                      onChange={(e) => setNewComment(prev => ({ ...prev, content: e.target.value }))}
                                      placeholder="Write a comment..."
                                      className={styles.editTextarea}
                                      rows={2}
                                    />
                                    <button onClick={() => { addCommentToTask(task.id); setCommentFormOpen(null) }} className={styles.saveBtn}>Submit</button>
                                  </div>
                                )}
                                <div className={styles.commentList}>
                                  {(comments[task.id] || []).map(comment => (
                                    <div key={comment.id} className={styles.commentItem}>
                                      <div className={styles.commentMeta}>
                                        <span className={styles.commentAuthor}>{comment.author}</span>
                                        <span className={styles.commentTime}>{relativeTime(comment.created_at)}</span>
                                        <button onClick={() => deleteComment(comment.id, task.id)} className={styles.deleteIcon}><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                                      </div>
                                      <p className={styles.commentContent}>{comment.content}</p>
                                    </div>
                                  ))}
                                </div>
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
                </div>
              )}
            </div>
          )
        })}

        {/* Add workstream */}
        {addingWorkstream ? (
          <div className={styles.workstreamCard}>
            <div className={styles.addTaskForm}>
              <input
                type="text"
                value={newWorkstream.title}
                onChange={(e) => setNewWorkstream(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Workstream title"
                className={styles.editInput}
                autoFocus
              />
              <input
                type="text"
                value={newWorkstream.subtitle}
                onChange={(e) => setNewWorkstream(prev => ({ ...prev, subtitle: e.target.value }))}
                placeholder="Workstream subtitle"
                className={styles.editInput}
              />
              <input
                type="text"
                value={newWorkstream.duration}
                onChange={(e) => setNewWorkstream(prev => ({ ...prev, duration: e.target.value }))}
                placeholder="Duration (e.g. Apr – Jun 2026)"
                className={styles.editInput}
              />
              <div className={styles.colorPicker}>
                <span className={styles.sectionLabel}>Color</span>
                <div className={styles.colorOptions}>
                  {(Object.keys(PHASE_COLORS) as Phase['color'][]).map(color => (
                    <button
                      key={color}
                      className={`${styles.colorOption} ${newWorkstream.color === color ? styles.colorOptionActive : ''}`}
                      style={{ background: PHASE_COLORS[color].accent }}
                      onClick={() => setNewWorkstream(prev => ({ ...prev, color }))}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.editActions}>
                <button onClick={() => addWorkstream()} className={styles.saveBtn}>Add Workstream</button>
                <button onClick={() => { setAddingWorkstream(false); setNewWorkstream({ title: '', subtitle: '', duration: '', color: 'teal' }) }} className={styles.cancelBtn}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <button className={styles.addTaskBtn} onClick={() => setAddingWorkstream(true)}>+ Add workstream</button>
        )}
      </main>

      <footer className={styles.footer}>
        <span>Clutch RevOps &middot; HubSpot Roadmap &middot; 2026</span>
      </footer>
      </>
      )}
    </div>
  )
}
