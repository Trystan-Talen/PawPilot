import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import type { DogDb, AgentRow, AgentStatus, AgentRole } from './db'
import { getRole } from './roles'
import { openInTerminal, sendToTerminal, resumeInTerminal } from './terminal'

const PORT = 17890

const DOG_NAMES = [
  'Mochi', 'Bagel', 'Pixel', 'Cookie', 'Tofu', 'Mango', 'Soba', 'Nori',
  'Pudding', 'Mocha', 'Biscuit', 'Peanut', 'Pepper', 'Latte', 'Yuzu', 'Miso',
  'Dumpling', 'Pickle', 'Brownie', 'Cinnamon'
]

const ACCENT_COLORS = [
  '#ff6b6b', '#4ecdc4', '#a78bfa', '#fbbf24', '#34d399',
  '#f472b6', '#60a5fa', '#fb923c', '#22d3ee', '#c084fc'
]

interface AgentEvent {
  type:
    | 'started' | 'log' | 'status' | 'metrics' | 'completed' | 'error'
    | 'waiting' | 'heartbeat'
    | 'submitted'     // 工程师交付，进入待验收
    | 'escalation'    // 质检上报 PM（红线触发）
    | 'help_request'  // PM 向人类老板求助/请示（触发桌面通知 + 工位举手信号）
    | 'message'       // 狗间消息（仅用于 dashboard 展示）
  agentId: string
  dogName?: string
  taskLabel?: string
  tool?: string
  role?: AgentRole
  status?: AgentStatus
  currentAction?: string
  progress?: number
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  log?: { level: 'info' | 'warn' | 'error' | 'tool' | 'meta'; content: string }
  accentColor?: string
  terminalApp?: string
  parentId?: string | null
  terminalMarker?: string | null
  terminalTty?: string | null
  cwd?: string | null
  command?: string | null
  projectId?: string | null
  targetDogName?: string   // message 事件的接收方
  messageText?: string
}

const MANAGER_GOLD = '#f5b942'

interface AgentRuntime {
  lastHeartbeat: number
  pid?: number
}

export function startServer(db: DogDb, onEvent: (e: AgentEvent) => void) {
  const wss = new WebSocketServer({ noServer: true })
  const clients = new Set<WebSocket>()
  const runtime = new Map<string, AgentRuntime>()
  let nameIdx = 0
  let colorIdx = 0

  function broadcast(e: AgentEvent) {
    const msg = JSON.stringify(e)
    for (const c of clients) {
      if (c.readyState === WebSocket.OPEN) c.send(msg)
    }
    onEvent(e)
  }

  function pickName() {
    const n = DOG_NAMES[nameIdx % DOG_NAMES.length]
    nameIdx++
    return n
  }

  function pickColor() {
    const c = ACCENT_COLORS[colorIdx % ACCENT_COLORS.length]
    colorIdx++
    return c
  }

  const app = express()
  app.use(express.json({ limit: '2mb' }))

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.post('/api/events', (req, res) => {
    const ev: AgentEvent = req.body
    const now = Date.now()

    if (ev.type === 'started') {
      const role: AgentRole = (ev.role as AgentRole) ?? 'fullstack'
      const isPm = role === 'pm' || role === 'manager'
      const dogName = ev.dogName ?? pickName()
      // PM 固定金色，员工按队列分配
      const accentColor = ev.accentColor ?? (isPm ? MANAGER_GOLD : pickColor())
      // taskLabel 只是显示标签，夹短防止超长任务（如接手档案）刷爆面板；完整任务已在启动命令里给了 agent
      const rawLabel = ev.taskLabel ?? '未命名任务'
      const taskLabel = rawLabel.length > 200 ? rawLabel.slice(0, 200) + '…' : rawLabel
      const row: AgentRow = {
        id: ev.agentId,
        dogName,
        taskLabel,
        tool: ev.tool ?? 'unknown',
        role,
        status: ev.status ?? 'working',
        currentAction: ev.currentAction ?? '',
        progress: ev.progress ?? 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        startedAt: now,
        updatedAt: now,
        endedAt: null,
        archived: 0,
        accentColor,
        terminalApp: ev.terminalApp ?? null,
        parentId: ev.parentId ?? null,
        terminalMarker: ev.terminalMarker ?? null,
        terminalTty: ev.terminalTty ?? null,
        cwd: ev.cwd ?? null,
        command: ev.command ?? null,
        projectId: ev.projectId ?? null
      }
      db.insertAgent(row)
      runtime.set(ev.agentId, { lastHeartbeat: now })
      broadcast({ ...ev, dogName, accentColor, role })
      return res.json({ ok: true, dogName, accentColor, role })
    }

    if (ev.type === 'submitted') {
      // 交付待验收：状态变更但绝不归档，狗继续挂着
      db.updateAgent(ev.agentId, {
        status: 'submitted',
        currentAction: ev.currentAction ?? '已交付，等待验收',
        progress: 1,
        updatedAt: now
      })
      const rt = runtime.get(ev.agentId)
      if (rt) rt.lastHeartbeat = now
      broadcast({ ...ev, status: 'submitted' })
      return res.json({ ok: true })
    }

    if (ev.type === 'escalation') {
      // 质检上报：转发到 PM 终端 + dashboard 通知
      const agent = db.getAgent(ev.agentId)
      const projectId = agent?.projectId ?? ev.projectId ?? null
      let delivered = false
      if (projectId) {
        const team = db.listTeam(projectId)
        const pm = team.find((a) => a.role === 'pm' || a.role === 'manager')
        if (pm && pm.terminalApp) {
          sendToTerminal({
            agentId: pm.id,
            terminalApp: pm.terminalApp,
            terminalMarker: pm.terminalMarker,
            terminalTty: pm.terminalTty,
            text: `【升级上报】来自 ${agent?.dogName ?? ev.agentId}：\n${ev.messageText ?? ''}`
          }).catch(() => {})
          delivered = true
        }
      }
      broadcast(ev)
      return res.json({ ok: true, delivered })
    }

    if (ev.type === 'help_request') {
      // PM 向人类老板求助：记一条日志 + 广播（前端举手+光晕，主进程弹通知）
      const agent = db.getAgent(ev.agentId)
      db.appendLog({
        agentId: ev.agentId,
        ts: now,
        level: 'warn',
        content: `🙋 求助老板：${(ev.messageText ?? '').slice(0, 300)}`
      })
      const rt = runtime.get(ev.agentId)
      if (rt) rt.lastHeartbeat = now
      broadcast({
        ...ev,
        dogName: agent?.dogName,
        taskLabel: agent?.taskLabel,
        role: agent?.role
      })
      return res.json({ ok: true })
    }

    if (ev.type === 'log' && ev.log) {
      db.appendLog({
        agentId: ev.agentId,
        ts: now,
        level: ev.log.level,
        content: ev.log.content
      })
      broadcast(ev)
      return res.json({ ok: true })
    }

    if (ev.type === 'status' || ev.type === 'metrics' || ev.type === 'waiting') {
      // 待验收保护：交付后 agent 仍会打印输出，wrapper 会自动推送 working/thinking/idle，
      // 这些是空闲噪音，不能把"待验收"冲回"工作中"。只有真正返工（收到 dog send 反馈）才会转回。
      const cur = db.getAgent(ev.agentId)
      if (
        cur?.status === 'submitted' &&
        (ev.status === 'working' || ev.status === 'thinking' || ev.status === 'idle')
      ) {
        const rt = runtime.get(ev.agentId)
        if (rt) rt.lastHeartbeat = now
        return res.json({ ok: true, held: 'submitted' })
      }

      const patch: Partial<AgentRow> = { updatedAt: now }
      if (ev.status) patch.status = ev.status
      if (ev.currentAction !== undefined) patch.currentAction = ev.currentAction
      if (ev.progress !== undefined) patch.progress = ev.progress
      if (ev.inputTokens !== undefined) patch.inputTokens = ev.inputTokens
      if (ev.outputTokens !== undefined) patch.outputTokens = ev.outputTokens
      if (ev.costUsd !== undefined) patch.costUsd = ev.costUsd
      if (ev.type === 'waiting') patch.status = 'waiting'
      db.updateAgent(ev.agentId, patch)
      const rt = runtime.get(ev.agentId)
      if (rt) rt.lastHeartbeat = now
      broadcast(ev)
      return res.json({ ok: true })
    }

    if (ev.type === 'heartbeat') {
      const rt = runtime.get(ev.agentId)
      if (rt) rt.lastHeartbeat = now
      return res.json({ ok: true })
    }

    if (ev.type === 'completed' || ev.type === 'error') {
      db.updateAgent(ev.agentId, {
        status: ev.type === 'completed' ? 'done' : 'error',
        currentAction: ev.currentAction ?? (ev.type === 'completed' ? '完成' : '出错'),
        progress: ev.type === 'completed' ? 1 : ev.progress ?? 0,
        updatedAt: now,
        endedAt: now
      })
      broadcast(ev)
      // 完成 30 秒后归档（让动画走完）
      if (ev.type === 'completed') {
        setTimeout(() => {
          db.archiveAgent(ev.agentId)
          runtime.delete(ev.agentId)
          broadcast({ type: 'status', agentId: ev.agentId, status: 'done', currentAction: 'archived' })
        }, 30_000)
      }
      return res.json({ ok: true })
    }

    res.status(400).json({ error: 'unknown event type' })
  })

  app.post('/api/register-pid', (req, res) => {
    const { agentId, pid } = req.body
    const rt = runtime.get(agentId)
    if (rt) rt.pid = pid
    res.json({ ok: true })
  })

  // === dog team：查同项目在岗成员 ===
  app.get('/api/team', (req, res) => {
    const projectId = String(req.query.projectId ?? '')
    if (!projectId) {
      // 没项目维度时退化为全部在岗
      return res.json({ ok: true, team: db.listAgents() })
    }
    res.json({ ok: true, team: db.listTeam(projectId) })
  })

  // === dog send：狗间点对点消息 ===
  app.post('/api/send', async (req, res) => {
    const { fromAgentId, targetDogName, text, projectId } = req.body as {
      fromAgentId?: string
      targetDogName?: string
      text?: string
      projectId?: string
    }
    if (!targetDogName || !text) {
      return res.status(400).json({ ok: false, error: '缺少 targetDogName 或 text' })
    }
    const sender = fromAgentId ? db.getAgent(fromAgentId) : undefined
    const pid = projectId ?? sender?.projectId ?? null
    const target = db.findAgentByName(pid, targetDogName)
    if (!target) {
      return res.status(404).json({ ok: false, error: `找不到名叫 ${targetDogName} 的在岗成员` })
    }
    if (!target.terminalApp) {
      return res.status(409).json({ ok: false, error: `${targetDogName} 没有可用终端` })
    }
    const header = sender ? `【来自 ${sender.dogName}（${sender.role}）】` : '【团队消息】'
    const result = await sendToTerminal({
      agentId: target.id,
      terminalApp: target.terminalApp,
      terminalMarker: target.terminalMarker,
      terminalTty: target.terminalTty,
      text: `${header}\n${text}`
    })
    if (result.ok) {
      broadcast({
        type: 'message',
        agentId: fromAgentId ?? 'system',
        targetDogName,
        messageText: text.slice(0, 200),
        projectId: pid
      })
      db.appendLog({
        agentId: target.id,
        ts: Date.now(),
        level: 'meta',
        content: `收到消息：${text.slice(0, 200)}`
      })
      // 收到反馈即返工：待验收的成员被打回，转回工作中
      if (target.status === 'submitted') {
        db.updateAgent(target.id, {
          status: 'working',
          currentAction: '收到反馈，返工中',
          updatedAt: Date.now()
        })
        broadcast({
          type: 'status',
          agentId: target.id,
          status: 'working',
          currentAction: '收到反馈，返工中'
        })
      }
    }
    res.json(result)
  })

  // === dog hire：PM 招聘入口 ===
  app.post('/api/hire', async (req, res) => {
    const { fromAgentId, role, task, tool, model } = req.body as {
      fromAgentId?: string
      role?: string
      task?: string
      tool?: string
      model?: string
    }
    if (!role || !task) {
      return res.status(400).json({ ok: false, error: '缺少 role 或 task' })
    }
    const spec = getRole(role)
    if (!spec) {
      return res.status(400).json({ ok: false, error: `未知角色 ${role}` })
    }
    const sender = fromAgentId ? db.getAgent(fromAgentId) : undefined
    // 只有 PM 可以招人
    if (sender && sender.role !== 'pm' && sender.role !== 'manager') {
      return res.status(403).json({ ok: false, error: '只有 PM 可以招聘' })
    }
    const project = sender?.projectId ? db.getProject(sender.projectId) : undefined
    const result = await openInTerminal({
      role: spec.id,
      tool: (tool as any) ?? spec.defaultTool,
      model: model ?? spec.defaultModel,
      taskLabel: task,
      terminal: (sender?.terminalApp as any) ?? 'Terminal',
      projectId: sender?.projectId ?? null,
      projectDir: project?.dir ?? null,
      parentId: sender?.id ?? null
    })
    res.json(result)
  })

  const httpServer = app.listen(PORT, '127.0.0.1', () => {
    console.log(`[dog-office] server on http://127.0.0.1:${PORT}`)
  })

  httpServer.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      clients.add(ws)
      ws.on('close', () => clients.delete(ws))
    })
  })

  // 心跳检测：12s 无心跳 → 标 lost，30s 无心跳 → 归档
  setInterval(() => {
    const now = Date.now()
    for (const [id, rt] of runtime) {
      // 撞额度暂停的狗：进程可能已退出（无心跳），但绝不能归档——要挂着等续接
      if (db.getAgent(id)?.status === 'paused') {
        continue
      }
      const gap = now - rt.lastHeartbeat
      if (gap > 30_000) {
        // 长时间没心跳，认为狗已经死了，归档
        db.updateAgent(id, { status: 'lost', updatedAt: now })
        db.archiveAgent(id)
        runtime.delete(id)
        broadcast({ type: 'completed', agentId: id, status: 'done', currentAction: 'archived' })
      } else if (gap > 12_000) {
        // 短暂没心跳，先标记 lost（可能只是网络抖动）
        db.updateAgent(id, { status: 'lost', updatedAt: now })
        broadcast({ type: 'status', agentId: id, status: 'lost' })
      }
    }
  }, 4_000)

  function forceArchive(agentId: string, reason: string) {
    const now = Date.now()
    db.updateAgent(agentId, {
      status: 'error',
      currentAction: reason,
      updatedAt: now,
      endedAt: now
    })
    // 触发前端的"完成"流程，狗会播完成动画并走出办公室
    broadcast({
      type: 'completed',
      agentId,
      status: 'done',
      currentAction: reason
    })
    // 3 秒后从 DB 归档
    setTimeout(() => {
      db.archiveAgent(agentId)
      runtime.delete(agentId)
    }, 3000)
  }

  return {
    killAgent(agentId: string) {
      const rt = runtime.get(agentId)
      if (rt?.pid) {
        try {
          process.kill(rt.pid, 'SIGTERM')
          // 进程在，让 dog wrapper 的 finally 自己上报完成
          return { ok: true }
        } catch (e: any) {
          // 进程不存在了（ESRCH）→ 跳到强制归档
          if (e?.code !== 'ESRCH') {
            return { ok: false, error: String(e) }
          }
        }
      }
      // 没 PID（服务器重启后丢了）或进程早死 → 强制归档
      forceArchive(agentId, '被强制清理（进程已不在）')
      return { ok: true, archived: true }
    },
    getHandoff(agentId: string) {
      const text = db.buildHandoff(agentId)
      return text ? { ok: true, text } : { ok: false, error: '找不到该 agent' }
    },
    async resumeAgent(agentId: string) {
      const agent = db.getAgent(agentId)
      if (!agent) return { ok: false, error: '找不到该狗' }
      const res = await resumeInTerminal({
        id: agent.id,
        dogName: agent.dogName,
        taskLabel: agent.taskLabel,
        role: agent.role,
        tool: agent.tool,
        cwd: agent.cwd,
        projectId: agent.projectId,
        parentId: agent.parentId,
        terminalApp: agent.terminalApp
      })
      if (res.ok) {
        const now = Date.now()
        // 续接拉起后取消归档、回到工作态；wrapper 重连会再 upsert
        db.updateAgent(agentId, { status: 'working', currentAction: '续接中…', archived: 0, updatedAt: now })
        runtime.set(agentId, { lastHeartbeat: now })
        broadcast({ type: 'status', agentId, status: 'working', currentAction: '续接中…' })
      }
      return res
    }
  }
}
