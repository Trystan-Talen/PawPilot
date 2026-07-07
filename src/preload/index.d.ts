export interface DogApi {
  hireAgent: (payload: {
    role?: string                // 9 角色 id（兼容 manager/worker 旧名）
    tool: 'claude' | 'codex' | 'antigravity' | 'hermes' | 'custom'
    model?: string | null
    taskLabel: string
    customCommand?: string
    terminal?: 'Terminal' | 'iTerm' | 'Warp'
    projectId?: string | null
    projectDir?: string | null
    parentId?: string | null
  }) => Promise<{ ok: boolean; agentId?: string; role?: string; error?: string }>
  focusTerminal: (args: {
    agentId: string
    terminalApp: string | null
    terminalMarker?: string | null
    terminalTty?: string | null
  }) => Promise<{ ok: boolean; error?: string }>
  sendToTerminal: (args: {
    agentId: string
    terminalApp: string | null
    terminalMarker?: string | null
    terminalTty?: string | null
    text: string
  }) => Promise<{ ok: boolean; error?: string }>
  listAgents: () => Promise<any[]>
  listArchived: () => Promise<any[]>
  getLogs: (agentId: string) => Promise<any[]>
  getHandoff: (agentId: string) => Promise<{ ok: boolean; text?: string; error?: string }>
  killAgent: (agentId: string) => Promise<{ ok: boolean; error?: string }>
  resumeAgent: (agentId: string) => Promise<{ ok: boolean; error?: string }>
  clearArchive: () => Promise<void>
  listRoles: () => Promise<
    {
      id: string
      name: string
      emoji: string
      duty: string
      defaultTool: string
      defaultModel: string | null
      isPm: boolean
    }[]
  >
  listProjects: () => Promise<any[]>
  pickProjectDir: () => Promise<{
    ok: boolean
    dir?: string
    suggestedName?: string
    canceled?: boolean
    error?: string
  }>
  createProject: (payload: {
    name: string
    dir: string
  }) => Promise<{ ok: boolean; project?: any; error?: string }>
  updateProject: (payload: { id: string; patch: any }) => Promise<{ ok: boolean; error?: string }>
  onAgentEvent: (cb: (e: any) => void) => () => void
  onSelectAgent: (cb: (agentId: string) => void) => () => void
}

declare global {
  interface Window {
    dog: DogApi
  }
}
