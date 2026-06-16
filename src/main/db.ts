import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'

export type AgentStatus =
  | 'working'
  | 'thinking'
  | 'idle'
  | 'submitted'   // 已交付，待验收（终端挂起等质检/老板）
  | 'done'
  | 'error'
  | 'waiting'
  | 'lost'
  | 'interrupted'

// 9 角色 + 兼容老数据的 manager/worker
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
  | 'manager'   // 兼容旧数据（= pm）
  | 'worker'    // 兼容旧数据（= fullstack）

export type ProjectStatus = 'active' | 'acceptance' | 'archived'

export interface ProjectRow {
  id: string
  name: string
  dir: string
  status: ProjectStatus
  createdAt: number
  updatedAt: number
}

export interface AgentRow {
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

export interface LogRow {
  agentId: string
  ts: number
  level: 'info' | 'warn' | 'error' | 'tool' | 'meta'
  content: string
}

export interface DogDb {
  insertAgent(a: AgentRow): void
  updateAgent(id: string, patch: Partial<AgentRow>): void
  archiveAgent(id: string): void
  appendLog(l: LogRow): void
  listAgents(): AgentRow[]
  listArchived(): AgentRow[]
  getLogs(agentId: string, limit?: number): LogRow[]
  clearArchive(): void
  getAgent(id: string): AgentRow | undefined
  markStaleAgentsInterrupted(now: number): AgentRow[]
  buildHandoff(agentId: string): string | null
  findAgentByName(projectId: string | null, dogName: string): AgentRow | undefined
  listTeam(projectId: string): AgentRow[]
  // projects
  insertProject(p: ProjectRow): void
  updateProject(id: string, patch: Partial<ProjectRow>): void
  listProjects(): ProjectRow[]
  getProject(id: string): ProjectRow | undefined
}

export async function initDatabase(): Promise<DogDb> {
  const userData = app.getPath('userData')
  if (!existsSync(userData)) mkdirSync(userData, { recursive: true })
  const dbPath = join(userData, 'dog-office.db')
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      dogName TEXT NOT NULL,
      taskLabel TEXT NOT NULL,
      tool TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'worker',
      status TEXT NOT NULL,
      currentAction TEXT DEFAULT '',
      progress REAL DEFAULT 0,
      inputTokens INTEGER DEFAULT 0,
      outputTokens INTEGER DEFAULT 0,
      costUsd REAL DEFAULT 0,
      startedAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      endedAt INTEGER,
      archived INTEGER DEFAULT 0,
      accentColor TEXT NOT NULL,
      terminalApp TEXT,
      parentId TEXT,
      terminalMarker TEXT,
      terminalTty TEXT,
      cwd TEXT,
      command TEXT,
      projectId TEXT
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dir TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS logs (
      agentId TEXT NOT NULL,
      ts INTEGER NOT NULL,
      level TEXT NOT NULL,
      content TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_logs_agent ON logs(agentId, ts);
    CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status, archived);
  `)

  // 迁移：老数据库缺列时补上
  const migrations = [
    `ALTER TABLE agents ADD COLUMN role TEXT NOT NULL DEFAULT 'worker'`,
    `ALTER TABLE agents ADD COLUMN terminalApp TEXT`,
    `ALTER TABLE agents ADD COLUMN parentId TEXT`,
    `ALTER TABLE agents ADD COLUMN terminalMarker TEXT`,
    `ALTER TABLE agents ADD COLUMN terminalTty TEXT`,
    `ALTER TABLE agents ADD COLUMN cwd TEXT`,
    `ALTER TABLE agents ADD COLUMN command TEXT`,
    `ALTER TABLE agents ADD COLUMN projectId TEXT`
  ]
  for (const sql of migrations) {
    try {
      sqlite.exec(sql)
    } catch {
      // 列已存在
    }
  }

  // 索引依赖迁移补的列，必须放在迁移之后建
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(projectId, archived)`)

  const insertStmt = sqlite.prepare(`
    INSERT OR REPLACE INTO agents
    (id,dogName,taskLabel,tool,role,status,currentAction,progress,inputTokens,outputTokens,costUsd,startedAt,updatedAt,endedAt,archived,accentColor,terminalApp,parentId,terminalMarker,terminalTty,cwd,command,projectId)
    VALUES (@id,@dogName,@taskLabel,@tool,@role,@status,@currentAction,@progress,@inputTokens,@outputTokens,@costUsd,@startedAt,@updatedAt,@endedAt,@archived,@accentColor,@terminalApp,@parentId,@terminalMarker,@terminalTty,@cwd,@command,@projectId)
  `)

  const insertProjectStmt = sqlite.prepare(`
    INSERT OR REPLACE INTO projects (id,name,dir,status,createdAt,updatedAt)
    VALUES (@id,@name,@dir,@status,@createdAt,@updatedAt)
  `)

  const logStmt = sqlite.prepare(`
    INSERT INTO logs (agentId, ts, level, content) VALUES (?, ?, ?, ?)
  `)

  return {
    insertAgent(a) {
      insertStmt.run(a)
    },
    updateAgent(id, patch) {
      const keys = Object.keys(patch)
      if (keys.length === 0) return
      const setClause = keys.map((k) => `${k} = @${k}`).join(', ')
      const stmt = sqlite.prepare(`UPDATE agents SET ${setClause} WHERE id = @id`)
      stmt.run({ ...patch, id })
    },
    archiveAgent(id) {
      sqlite.prepare(`UPDATE agents SET archived = 1, endedAt = ? WHERE id = ?`).run(Date.now(), id)
    },
    appendLog(l) {
      logStmt.run(l.agentId, l.ts, l.level, l.content)
    },
    listAgents() {
      return sqlite
        .prepare(`SELECT * FROM agents WHERE archived = 0 ORDER BY startedAt ASC`)
        .all() as AgentRow[]
    },
    listArchived() {
      return sqlite
        .prepare(
          `SELECT * FROM agents WHERE archived = 1 ORDER BY endedAt DESC LIMIT 200`
        )
        .all() as AgentRow[]
    },
    getLogs(agentId, limit = 500) {
      return sqlite
        .prepare(
          `SELECT * FROM logs WHERE agentId = ? ORDER BY ts DESC LIMIT ?`
        )
        .all(agentId, limit)
        .reverse() as LogRow[]
    },
    clearArchive() {
      sqlite.prepare(`DELETE FROM agents WHERE archived = 1`).run()
    },
    getAgent(id) {
      return sqlite.prepare(`SELECT * FROM agents WHERE id = ?`).get(id) as AgentRow | undefined
    },
    markStaleAgentsInterrupted(now) {
      const rows = sqlite
        .prepare(
          `SELECT * FROM agents
           WHERE archived = 0
             AND status IN ('working','thinking','waiting','idle','submitted','lost')`
        )
        .all() as AgentRow[]
      const stmt = sqlite.prepare(
        `UPDATE agents
         SET status = 'interrupted', currentAction = '上次运行中断，可生成接手上下文恢复', updatedAt = ?
         WHERE id = ?`
      )
      for (const a of rows) stmt.run(now, a.id)
      return rows.map((a) => ({
        ...a,
        status: 'interrupted' as AgentStatus,
        currentAction: '上次运行中断，可生成接手上下文恢复',
        updatedAt: now
      }))
    },
    buildHandoff(agentId) {
      const agent = sqlite.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as AgentRow | undefined
      if (!agent) return null
      const logs = sqlite
        .prepare(`SELECT * FROM logs WHERE agentId = ? ORDER BY ts DESC LIMIT 120`)
        .all(agentId)
        .reverse() as LogRow[]
      const recent = logs
        .slice(-40)
        .map((l) => {
          const time = new Date(l.ts).toISOString()
          return `${time} [${l.level}] ${l.content}`
        })
        .join('\n')
      return [
        `你正在接手 Dog Office 中断/归档的 Agent 工作。`,
        ``,
        `## Agent`,
        `- 名字：${agent.dogName}`,
        `- 角色：${agent.role}`,
        `- 工具：${agent.tool}`,
        `- 状态：${agent.status}`,
        `- 任务：${agent.taskLabel}`,
        `- 当前动作：${agent.currentAction || '无'}`,
        `- 工作目录：${agent.cwd || '未知'}`,
        `- 启动命令：${agent.command || '未知'}`,
        `- 启动时间：${new Date(agent.startedAt).toISOString()}`,
        `- 最后更新：${new Date(agent.updatedAt).toISOString()}`,
        ``,
        `## 恢复要求`,
        `1. 先完整理解上面的任务目标和最近日志。`,
        `2. 检查工作目录里的实际文件状态，不要假设上一个 Agent 的修改一定完整。`,
        `3. 总结已完成、未完成、风险点，然后继续推进任务。`,
        `4. 如果发现上下文不足，先列出需要用户确认的问题。`,
        ``,
        `## 最近日志`,
        recent || '暂无日志'
      ].join('\n')
    },
    findAgentByName(projectId, dogName) {
      if (projectId) {
        return sqlite
          .prepare(
            `SELECT * FROM agents WHERE projectId = ? AND dogName = ? AND archived = 0 LIMIT 1`
          )
          .get(projectId, dogName) as AgentRow | undefined
      }
      return sqlite
        .prepare(`SELECT * FROM agents WHERE dogName = ? AND archived = 0 LIMIT 1`)
        .get(dogName) as AgentRow | undefined
    },
    listTeam(projectId) {
      return sqlite
        .prepare(
          `SELECT * FROM agents WHERE projectId = ? AND archived = 0 ORDER BY startedAt ASC`
        )
        .all(projectId) as AgentRow[]
    },
    insertProject(p) {
      insertProjectStmt.run(p)
    },
    updateProject(id, patch) {
      const keys = Object.keys(patch)
      if (keys.length === 0) return
      const setClause = keys.map((k) => `${k} = @${k}`).join(', ')
      sqlite.prepare(`UPDATE projects SET ${setClause} WHERE id = @id`).run({ ...patch, id })
    },
    listProjects() {
      return sqlite
        .prepare(`SELECT * FROM projects ORDER BY createdAt DESC`)
        .all() as ProjectRow[]
    },
    getProject(id) {
      return sqlite.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as ProjectRow | undefined
    }
  }
}
