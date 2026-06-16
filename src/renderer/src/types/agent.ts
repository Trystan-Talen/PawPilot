export type AgentStatus =
  | 'working'
  | 'thinking'
  | 'idle'
  | 'submitted'   // 已交付，待验收
  | 'done'
  | 'error'
  | 'waiting'
  | 'lost'
  | 'interrupted'

export type AgentRole =
  | 'pm'
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'qa'
  | 'tester'
  | 'ui-designer'
  | 'docs-engineer'
  | 'devops'
  | 'manager'   // 兼容旧数据
  | 'worker'    // 兼容旧数据

export type ProjectStatus = 'active' | 'acceptance' | 'archived'

export interface Project {
  id: string
  name: string
  dir: string
  status: ProjectStatus
  createdAt: number
  updatedAt: number
}

export interface Agent {
  id: string
  dogName: string
  taskLabel: string
  tool: string
  role: AgentRole
  status: AgentStatus
  currentAction: string
  progress: number
  inputTokens: number
  outputTokens: number
  costUsd: number
  startedAt: number
  updatedAt: number
  endedAt: number | null
  archived: number
  accentColor: string
  terminalApp: string | null
  parentId: string | null
  terminalMarker: string | null
  terminalTty: string | null
  cwd: string | null
  command: string | null
  projectId: string | null
}

export interface LogEntry {
  agentId: string
  ts: number
  level: 'info' | 'warn' | 'error' | 'tool' | 'meta'
  content: string
}

export const isPmRole = (r: AgentRole | string) => r === 'pm' || r === 'manager'
