import { app, BrowserWindow, ipcMain, Notification, shell, dialog } from 'electron'
import { join, basename } from 'path'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { startServer } from './server'
import { initDatabase } from './db'
import { openInTerminal, focusTerminal, sendToTerminal } from './terminal'
import { ROLES } from './roles'

let mainWindow: BrowserWindow | null = null

// 记录每个 agent 最后通知过的状态类型，避免同一事件被重复通知
const lastNotifiedType = new Map<string, string>()

function resolveIconPath(): string | undefined {
  const candidates = [
    join(process.resourcesPath ?? '', 'build/icon.png'),
    join(app.getAppPath(), 'build/icon.png'),
    join(process.cwd(), 'build/icon.png'),
    join(__dirname, '../../build/icon.png')
  ]
  for (const p of candidates) {
    if (p && existsSync(p)) return p
  }
  return undefined
}

function focusMainWindow(selectAgentId?: string) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  if (selectAgentId) {
    mainWindow.webContents.send('select-agent', selectAgentId)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#07080c',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 单实例锁：同时只能跑一个 Dog Office
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  // 已经有实例在跑，直接退出
  app.quit()
} else {
  app.on('second-instance', () => {
    // 用户又打开了一次 → 把已有窗口拉到前台
    focusMainWindow()
  })
}

app.whenReady().then(async () => {
  if (!gotLock) return
  const db = await initDatabase()
  const interrupted = db.markStaleAgentsInterrupted(Date.now())
  if (interrupted.length > 0) {
    console.log(`[dog-office] marked ${interrupted.length} stale agents interrupted`)
  }
  const iconPath = resolveIconPath()

  const server = startServer(db, (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent-event', event)
    }

    const notifiable = ['completed', 'error', 'waiting']
    if (!notifiable.includes(event.type)) return

    // 同一 agent 同一类型只通知一次（避免重复弹窗）
    if (lastNotifiedType.get(event.agentId) === event.type) return
    lastNotifiedType.set(event.agentId, event.type)

    const title =
      event.type === 'completed' ? '✅ 任务完成' :
      event.type === 'error' ? '⛔️ 任务报错' :
      '⏳ 在等你回应'

    const body = `${event.dogName ?? 'Agent'} · ${event.taskLabel ?? ''}`

    const n = new Notification({
      title,
      body,
      silent: event.type === 'completed',  // 完成不响声音，报错和等待响
      icon: iconPath
    })
    n.on('click', () => focusMainWindow(event.agentId))
    n.show()
  })

  ipcMain.handle('focus-window', () => {
    focusMainWindow()
    return { ok: true }
  })

  ipcMain.handle('hire-agent', async (_e, payload) => {
    return openInTerminal(payload)
  })

  ipcMain.handle('focus-terminal', async (_e, args) => {
    return focusTerminal(args)
  })

  ipcMain.handle('send-to-terminal', async (_e, args) => {
    return sendToTerminal(args)
  })

  ipcMain.handle('list-agents', async () => db.listAgents())
  ipcMain.handle('list-archived', async () => db.listArchived())
  ipcMain.handle('get-logs', async (_e, agentId: string) => db.getLogs(agentId))
  ipcMain.handle('kill-agent', async (_e, agentId: string) => server.killAgent(agentId))
  ipcMain.handle('clear-archive', async () => db.clearArchive())
  ipcMain.handle('get-handoff', async (_e, agentId: string) => server.getHandoff(agentId))

  // === 角色注册表（给招聘弹窗渲染 9 角色卡片）===
  ipcMain.handle('list-roles', async () => ROLES)

  // === 项目管理 ===
  ipcMain.handle('list-projects', async () => db.listProjects())

  ipcMain.handle('pick-project-dir', async () => {
    if (!mainWindow) return { ok: false, error: '窗口不存在' }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择项目文件夹',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, canceled: true }
    }
    const dir = result.filePaths[0]
    return { ok: true, dir, suggestedName: basename(dir) }
  })

  ipcMain.handle('create-project', async (_e, payload: { name: string; dir: string }) => {
    if (!payload?.name || !payload?.dir) return { ok: false, error: '缺少名称或目录' }
    const now = Date.now()
    const project = {
      id: randomUUID(),
      name: payload.name,
      dir: payload.dir,
      status: 'active' as const,
      createdAt: now,
      updatedAt: now
    }
    db.insertProject(project)
    return { ok: true, project }
  })

  ipcMain.handle('update-project', async (_e, payload: { id: string; patch: any }) => {
    if (!payload?.id) return { ok: false, error: '缺少项目 id' }
    db.updateProject(payload.id, { ...payload.patch, updatedAt: Date.now() })
    return { ok: true }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
