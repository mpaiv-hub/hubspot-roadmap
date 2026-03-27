export type TaskStatus = 'not-started' | 'in-progress' | 'complete' | 'blocked'

export interface Subtask {
  id: string
  text: string
  completed?: boolean
  order: number
}

export interface Task {
  id: string
  title: string
  description: string
  owner: string
  team?: string
  dependency?: string
  subtasks: Subtask[]
  status: TaskStatus
  notes: string
  order: number
}

export interface Phase {
  id: string
  label: string
  title: string
  subtitle: string
  duration: string
  color: 'teal' | 'blue' | 'amber' | 'pink' | 'purple' | 'yellow' | 'gray'
  tasks: Task[]
  order: number
}
