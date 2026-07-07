import { create } from 'zustand'
import type { Agent, AgentStatus, Project } from '@/types/agent'

interface State {
  agents: Record<string, Agent>
  archived: Agent[]
  projects: Project[]
  currentProjectId: string | null   // null = "快速监控"（无项目归属的临时 agent）
  walkingOut: Set<string>
  selectedId: string | null
  focusedId: string | null  // 点击聚焦的 agent（高亮它和它的关系网）
  hireOpen: boolean
  hireInitialRole: string
  archiveOpen: boolean
  setAgents: (rows: Agent[]) => void
  setArchived: (rows: Agent[]) => void
  setProjects: (rows: Project[]) => void
  addProject: (p: Project) => void
  selectProject: (id: string | null) => void
  applyEvent: (e: any) => void
  select: (id: string | null) => void
  focus: (id: string | null) => void
  openHire: (open: boolean, initialRole?: string) => void
  openArchive: (open: boolean) => void
  startWalkOut: (id: string) => void
  finishWalkOut: (id: string) => void
}

export const useAgentStore = create<State>((set, get) => ({
  agents: {},
  archived: [],
  projects: [],
  currentProjectId: null,
  walkingOut: new Set(),
  selectedId: null,
  focusedId: null,
  hireOpen: false,
  hireInitialRole: 'pm',
  archiveOpen: false,

  setAgents: (rows) => {
    const m: Record<string, Agent> = {}
    for (const r of rows) m[r.id] = r
    set({ agents: m })
  },

  setArchived: (rows) => set({ archived: rows }),

  setProjects: (rows) => set({ projects: rows }),

  addProject: (p) =>
    set((s) => ({
      projects: [p, ...s.projects.filter((x) => x.id !== p.id)],
      currentProjectId: p.id
    })),

  selectProject: (id) => set({ currentProjectId: id }),

  applyEvent: (e) => {
    const { agents } = get()
    const id = e.agentId
    if (!id) return

    if (e.type === 'started') {
      const newAgent: Agent = {
        id,
        dogName: e.dogName ?? 'Agent',
        taskLabel: e.taskLabel ?? '',
        tool: e.tool ?? 'unknown',
        role: e.role ?? 'fullstack',
        status: (e.status as AgentStatus) ?? 'working',
        currentAction: e.currentAction ?? '正在启动…',
        progress: e.progress ?? 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        startedAt: Date.now(),
        updatedAt: Date.now(),
        endedAt: null,
        archived: 0,
        accentColor: e.accentColor ?? '#4ecdc4',
        terminalApp: e.terminalApp ?? null,
        parentId: e.parentId ?? null,
        terminalMarker: e.terminalMarker ?? null,
        terminalTty: e.terminalTty ?? null,
        cwd: e.cwd ?? null,
        command: e.command ?? null,
        projectId: e.projectId ?? null
      }
      set({ agents: { ...agents, [id]: newAgent } })
      return
    }

    // PM 求助：点亮举手信号（瞬态，不改 status），老板看一眼即清除
    if (e.type === 'help_request') {
      const cur = agents[id]
      if (!cur) return
      set({
        agents: {
          ...agents,
          [id]: { ...cur, helpRequest: true, helpText: e.messageText ?? '', updatedAt: Date.now() }
        }
      })
      return
    }

    const cur = agents[id]
    if (!cur) return
    const next: Agent = { ...cur, updatedAt: Date.now() }

    if (e.status) next.status = e.status
    if (e.currentAction !== undefined) next.currentAction = e.currentAction
    if (e.progress !== undefined) next.progress = e.progress
    if (e.inputTokens !== undefined) next.inputTokens = e.inputTokens
    if (e.outputTokens !== undefined) next.outputTokens = e.outputTokens
    if (e.costUsd !== undefined) next.costUsd = e.costUsd

    if (e.type === 'completed') {
      next.status = 'done'
      next.progress = 1
      next.endedAt = Date.now()
      // 3 秒后开始走出动画
      setTimeout(() => get().startWalkOut(id), 3000)
    }
    if (e.type === 'error') {
      next.status = 'error'
      next.endedAt = Date.now()
    }

    set({ agents: { ...agents, [id]: next } })
  },

  select: (id) => {
    // 老板查看某只狗 → 清除它的求助信号（已被看见）
    if (id) {
      const { agents } = get()
      const a = agents[id]
      if (a?.helpRequest) {
        set({ agents: { ...agents, [id]: { ...a, helpRequest: false } } })
      }
    }
    set({ selectedId: id })
  },
  focus: (id) => set({ focusedId: id }),
  openHire: (open, initialRole) =>
    set({ hireOpen: open, hireInitialRole: initialRole ?? 'pm' }),
  openArchive: (open) => set({ archiveOpen: open }),

  startWalkOut: (id) => {
    const s = new Set(get().walkingOut)
    s.add(id)
    set({ walkingOut: s })
  },

  finishWalkOut: (id) => {
    const { agents, walkingOut } = get()
    const a = agents[id]
    const next = { ...agents }
    delete next[id]
    const s = new Set(walkingOut)
    s.delete(id)
    const archived = a ? [a, ...get().archived] : get().archived
    set({ agents: next, walkingOut: s, archived })
  }
}))
