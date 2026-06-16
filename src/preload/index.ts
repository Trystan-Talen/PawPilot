import { contextBridge, ipcRenderer } from 'electron'

const api = {
  hireAgent: (payload: any) => ipcRenderer.invoke('hire-agent', payload),
  focusTerminal: (args: {
    agentId: string
    terminalApp: string | null
    terminalMarker?: string | null
    terminalTty?: string | null
  }) =>
    ipcRenderer.invoke('focus-terminal', args),
  sendToTerminal: (args: {
    agentId: string
    terminalApp: string | null
    terminalMarker?: string | null
    terminalTty?: string | null
    text: string
  }) => ipcRenderer.invoke('send-to-terminal', args),
  listAgents: () => ipcRenderer.invoke('list-agents'),
  listArchived: () => ipcRenderer.invoke('list-archived'),
  getLogs: (agentId: string) => ipcRenderer.invoke('get-logs', agentId),
  getHandoff: (agentId: string) => ipcRenderer.invoke('get-handoff', agentId),
  killAgent: (agentId: string) => ipcRenderer.invoke('kill-agent', agentId),
  clearArchive: () => ipcRenderer.invoke('clear-archive'),
  listRoles: () => ipcRenderer.invoke('list-roles'),
  listProjects: () => ipcRenderer.invoke('list-projects'),
  pickProjectDir: () => ipcRenderer.invoke('pick-project-dir'),
  createProject: (payload: { name: string; dir: string }) =>
    ipcRenderer.invoke('create-project', payload),
  updateProject: (payload: { id: string; patch: any }) =>
    ipcRenderer.invoke('update-project', payload),
  onAgentEvent: (cb: (e: any) => void) => {
    const handler = (_: unknown, e: any) => cb(e)
    ipcRenderer.on('agent-event', handler)
    return () => ipcRenderer.off('agent-event', handler)
  },
  onSelectAgent: (cb: (agentId: string) => void) => {
    const handler = (_: unknown, id: string) => cb(id)
    ipcRenderer.on('select-agent', handler)
    return () => ipcRenderer.off('select-agent', handler)
  }
}

contextBridge.exposeInMainWorld('dog', api)
