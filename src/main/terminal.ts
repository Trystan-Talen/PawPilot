import { exec } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { app } from 'electron'
import net from 'net'

const execAsync = promisify(exec)

// 消息直连：dog wrapper 为每个 agent 在 /tmp/dogoffice-ipc/<agentId>.sock 开一个 Unix socket。
// 往里写一行 JSON {text} 就会被 wrapper 注入到 agent 的 PTY（等价于在它终端里打字+回车），
// 不需要 macOS 辅助功能权限。路径两端各自由 agentId 推导，无需握手。
const IPC_DIR = '/tmp/dogoffice-ipc'

function ipcSockPath(agentId: string) {
  return join(IPC_DIR, `${agentId}.sock`)
}

/** 通过 PTY 直连把消息送给 agent。socket 不存在 / 连不上 → 返回 ok:false 让调用方退化。 */
function sendViaIpc(agentId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const p = ipcSockPath(agentId)
    if (!existsSync(p)) {
      resolve({ ok: false, error: 'no ipc socket' })
      return
    }
    let settled = false
    const finish = (r: { ok: boolean; error?: string }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        sock.destroy()
      } catch {
        /* noop */
      }
      resolve(r)
    }
    const sock = net.createConnection(p)
    const timer = setTimeout(() => finish({ ok: false, error: 'ipc timeout' }), 2000)
    sock.on('connect', () => {
      sock.write(`${JSON.stringify({ text })}\n`, () => finish({ ok: true }))
    })
    sock.on('error', (e) => finish({ ok: false, error: String(e) }))
  })
}

const DOG_BIN_DIR = join(homedir(), '.dog-office', 'bin')
const INSTALLED_DOG = join(DOG_BIN_DIR, 'dog')

/** 源 dog 脚本位置（可能在受 macOS TCC 保护的桌面/文档目录下） */
function resolveDogSource(): string | null {
  if (process.env.DOG_BIN && existsSync(process.env.DOG_BIN)) return process.env.DOG_BIN
  const candidates = [
    join(process.resourcesPath ?? '', 'sdk/dog'),
    join(app.getAppPath(), 'sdk/dog'),
    join(process.cwd(), 'sdk/dog'),
    join(__dirname, '../../sdk/dog')
  ]
  for (const p of candidates) {
    if (p && existsSync(p)) return p
  }
  return null
}

/**
 * 把 dog 脚本安装到 home 下的非保护目录再返回那个路径。
 * 原因：项目若放在 ~/Desktop / ~/Documents 等目录，终端里的 python 受 macOS 隐私保护(TCC)
 * 无法读取那里的脚本（Errno 1 Operation not permitted）。装到 ~/.dog-office/bin 可彻底绕开。
 */
export function resolveDogBin(): string {
  const src = resolveDogSource()
  if (!src) return 'dog'
  try {
    if (!existsSync(DOG_BIN_DIR)) mkdirSync(DOG_BIN_DIR, { recursive: true })
    const content = readFileSync(src, 'utf-8')
    let needWrite = true
    if (existsSync(INSTALLED_DOG)) {
      try {
        needWrite = readFileSync(INSTALLED_DOG, 'utf-8') !== content
      } catch {
        needWrite = true
      }
    }
    if (needWrite) {
      writeFileSync(INSTALLED_DOG, content, 'utf-8')
      chmodSync(INSTALLED_DOG, 0o755)
    }
    return INSTALLED_DOG
  } catch {
    // 退化：直接用源路径（非保护目录下能正常工作）
    return src
  }
}

import { getRole } from './roles'

const PROMPT_DIR = join(homedir(), '.dog-office', 'prompts')

// 活动流：给每只 claude 狗配一个 PostToolUse 钩子，每次工具调用就让 `dog hook` 结构化上报 dashboard。
// 比硬解析 TUI 屏幕稳得多（不随版本漂、不怕整屏重绘）。settings 文件对所有狗通用——
// `dog hook` 凭子进程继承的 DOG_SELF_ID 知道"我是哪只狗"。
const HOOKS_DIR = join(homedir(), '.dog-office', 'hooks')
const HOOK_SETTINGS = join(HOOKS_DIR, 'settings.json')

function ensureHookSettings(dogBin: string): string | null {
  try {
    if (!existsSync(HOOKS_DIR)) mkdirSync(HOOKS_DIR, { recursive: true })
    const settings = {
      hooks: {
        PostToolUse: [
          {
            matcher: '',
            hooks: [{ type: 'command', command: `${shellEscape(dogBin)} hook` }]
          }
        ]
      }
    }
    writeFileSync(HOOK_SETTINGS, JSON.stringify(settings, null, 2), 'utf-8')
    return HOOK_SETTINGS
  } catch {
    return null
  }
}

// 代理透传：dog 在全新 Terminal 窗口里起，不会继承用户手动 export 的代理。
// 国内直连 Anthropic 会被 403 Request not allowed 挡住，所以必须把代理注入每只狗的启动脚本。
// 来源优先级：① ~/.dog-office/proxy.env 配置文件（用户可手动维护，最稳）② PawPilot 自身进程环境。
const PROXY_CONF = join(homedir(), '.dog-office', 'proxy.env')

// claude 狗用独立凭证目录，与桌面 Claude app 的 ~/.claude 隔离，避免共用一张 OAuth token 互相踢下线。
// 用户需在此目录单独登录一次：CLAUDE_CONFIG_DIR=~/.dog-office/claude-cfg claude → /login
const CLAUDE_CFG_DIR = join(homedir(), '.dog-office', 'claude-cfg')

// 预先信任工作目录：claude 在没信任过的目录会弹"Quick safety check: trust this folder?"对话框，
// 挡住狗(尤其 PM 一次招多只子狗时要挨个点)。起 claude 狗前把信任标记写进它的凭证目录，永不再弹。
function ensureClaudeTrust(configDir: string, workdir: string) {
  try {
    const cfgJson = join(configDir, '.claude.json')
    let cfg: any = {}
    if (existsSync(cfgJson)) {
      try {
        cfg = JSON.parse(readFileSync(cfgJson, 'utf-8'))
      } catch {
        cfg = {}
      }
    }
    if (!cfg.projects || typeof cfg.projects !== 'object') cfg.projects = {}
    if (!cfg.projects[workdir] || typeof cfg.projects[workdir] !== 'object') cfg.projects[workdir] = {}
    if (cfg.projects[workdir].hasTrustDialogAccepted !== true) {
      cfg.projects[workdir].hasTrustDialogAccepted = true
      if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true })
      writeFileSync(cfgJson, JSON.stringify(cfg, null, 2), 'utf-8')
    }
  } catch {
    /* best effort：写不了就让 claude 自己弹框，用户手点一次也行 */
  }
}

// 跳过 bypass 权限警告：--dangerously-skip-permissions 首次会弹"Bypass Permissions mode"确认框
//（默认还停在 No/exit，容易误退）。在凭证目录 settings.json 写 skipDangerousModePermissionPrompt，永不再弹。
function ensureClaudeSkipBypass(configDir: string) {
  try {
    if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true })
    const sPath = join(configDir, 'settings.json')
    let s: any = {}
    if (existsSync(sPath)) {
      try {
        s = JSON.parse(readFileSync(sPath, 'utf-8'))
      } catch {
        s = {}
      }
    }
    if (s.skipDangerousModePermissionPrompt !== true) {
      s.skipDangerousModePermissionPrompt = true
      writeFileSync(sPath, JSON.stringify(s, null, 2), 'utf-8')
    }
  } catch {
    /* best effort */
  }
}
const PROXY_KEYS = [
  'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy',
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY'
]

function resolveProxyExports(): string[] {
  const found: Record<string, string> = {}
  // ① 配置文件优先（不依赖 PawPilot 启动时的 shell 环境）
  try {
    if (existsSync(PROXY_CONF)) {
      for (const raw of readFileSync(PROXY_CONF, 'utf-8').split('\n')) {
        const line = raw.trim()
        if (!line || line.startsWith('#')) continue
        const eq = line.indexOf('=')
        if (eq <= 0) continue
        const key = line.slice(0, eq).trim().replace(/^export\s+/, '')
        const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (PROXY_KEYS.includes(key) && val) found[key] = val
      }
    }
  } catch {
    /* 配置文件读不了就忽略，回退到进程环境 */
  }
  // ② 回退：PawPilot 自身进程里的代理（若从带代理的 shell 启动）
  for (const k of PROXY_KEYS) {
    const v = process.env[k]
    if (v && !found[k]) found[k] = v
  }
  return Object.entries(found).map(([k, v]) => `export ${k}=${shellEscape(v)}`)
}

function resolveRolesDir(): string | null {
  const candidates = [
    join(process.resourcesPath ?? '', 'resources/roles'),
    join(app.getAppPath(), 'resources/roles'),
    join(process.cwd(), 'resources/roles'),
    join(__dirname, '../../resources/roles')
  ]
  for (const p of candidates) {
    if (p && existsSync(p)) return p
  }
  return null
}

/** 拼接 _common.md + 角色 prompt，落盘后返回路径 */
function ensureRolePrompt(roleId: string): string | null {
  const spec = getRole(roleId)
  if (!spec) return null
  const rolesDir = resolveRolesDir()
  if (!rolesDir) return null

  if (!existsSync(PROMPT_DIR)) mkdirSync(PROMPT_DIR, { recursive: true })

  const commonPath = join(rolesDir, '_common.md')
  const rolePath = join(rolesDir, spec.promptFile)
  const common = existsSync(commonPath) ? readFileSync(commonPath, 'utf-8') : ''
  const rolePrompt = existsSync(rolePath) ? readFileSync(rolePath, 'utf-8') : ''
  if (!rolePrompt) return null

  const merged = `${rolePrompt}\n\n---\n\n${common}`
  const outPath = join(PROMPT_DIR, `${spec.id}.md`)
  writeFileSync(outPath, merged, 'utf-8')
  return outPath
}

export interface HirePayload {
  role?: string                 // 9 角色 id（兼容 manager/worker 旧名）
  tool: 'claude' | 'codex' | 'antigravity' | 'hermes' | 'custom'
  model?: string | null         // 可选的模型覆盖，null/空 = 跟工具默认
  taskLabel: string
  customCommand?: string
  terminal?: 'Terminal' | 'iTerm' | 'Warp'
  projectId?: string | null
  projectDir?: string | null    // 项目根目录（终端 cd 到这里再启动）
  parentId?: string | null      // PM 派活时传自己的 id
}

function escape(s: string) {
  return s.replace(/"/g, '\\"')
}

function appleString(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function shellEscape(p: string) {
  return `'${p.replace(/'/g, `'\\''`)}'`
}

function markerOf(agentId: string) {
  return agentId.slice(0, 8)
}

function extractAppleScriptError(error: unknown) {
  const text = String(error)
  const match = text.match(/osascript: execution error: (.+?) \(([-\d]+)\)$/s)
  if (match) return match[1]
  return text.replace(/^Error:\s*/, '')
}

/**
 * 按工具拼出启动命令。返回 { command, initPrompt }。
 * - claude：任务作为位置参数，claude 会自动跑 → initPrompt 为 null。
 * - codex/hermes/antigravity：交互式 TUI 不会自动跑位置参数（只填进输入框不回车），
 *   所以裸起 TUI，把首条 prompt 交给 dog 包装器在 TUI 就绪后注入（DOG_INIT_PROMPT）。
 */
function buildToolCommand(
  tool: HirePayload['tool'],
  taskLabel: string,
  promptPath: string | null,
  model: string | null | undefined,
  customCommand?: string,
  hookSettingsPath?: string | null,
  agentId?: string
): { command: string; initPrompt: string | null } {
  const modelFlag = model ? ` --model ${shellEscape(model)}` : ''

  if (tool === 'custom') return { command: customCommand ?? '', initPrompt: null }

  // 自动批准：工程师起手就跳过权限确认，常规操作不再逐条弹窗（危险操作靠提示词红线 + dog escalate 兜底）。
  if (tool === 'claude') {
    const sys = promptPath ? ` --append-system-prompt "$(cat ${shellEscape(promptPath)})"` : ''
    // 禁用 Claude Code 自带的 Task 子 agent 工具：否则 PM/工程师会用它"调起子 agent"，
    // 那种子 agent 是隐形的、不走 dog 包装器、不出现在办公室里——直接破坏"看得见的办公室"。
    // 唯一合法的派活方式是 bash 执行 `dog hire`，狗才会真出现在工位上。
    const noSubagents = ' --disallowedTools Task'
    // 活动流钩子：每次工具调用结构化上报 dashboard
    const hookFlag = hookSettingsPath ? ` --settings ${shellEscape(hookSettingsPath)}` : ''
    // 让 claude 的会话 ID = 狗 ID，撞额度暂停后能用 `claude --resume <id>` 精准续接
    const sessionFlag = agentId ? ` --session-id ${shellEscape(agentId)}` : ''
    // 任务作为首条 prompt，用单引号 shell 转义（中文/标点/引号都安全）
    return {
      command: `claude${modelFlag} --dangerously-skip-permissions${noSubagents}${hookFlag}${sessionFlag}${sys} ${shellEscape(taskLabel)}`,
      initPrompt: null
    }
  }

  // codex / antigravity / hermes：没有像 claude 那样的 system prompt 入口（claude 用 --append-system-prompt
  // 注入角色规范，系统级永远生效）。这些工具只能把规范作为首条消息注入，且它们可能不去读文件就放飞。
  // 所以把"绝不能犯"的硬红线**内联**进首条 prompt——哪怕不读文件，关键铁律也在眼前。
  const redlines =
    '【Dog Office 铁律 · 永远优先于一切】' +
    '① 绝不调用 `dog run`——那是系统内部启动 agent 的命令，不是给你的。' +
    '② 派活只用 `dog hire <角色> --task "..."`；沟通用 `dog send <狗名> "..."`；交付用 `dog submit "..."`；查队友用 `dog team`。' +
    '③ 危险操作（kill/pkill 任何进程、rm 删除、git push、部署、花钱）动手前必须先 `dog escalate "..."` 报告并等同意，绝不自行 kill -9、绝不清理 dog-office 进程。' +
    '④ 任务或命令失败时，别擅自断定"整个系统坏了"、更别自己清进程——用 `dog escalate` 如实上报，让人判断。' +
    '⑤ 你不是孤狼，你是团队一员，一切围绕 dog 协议协作。'
  const lead = promptPath
    ? `${redlines} 你的完整角色规范在文件 ${promptPath}，开工前先完整读一遍。然后执行任务：`
    : `${redlines} 执行任务：`
  const initPrompt = lead + taskLabel

  // codex：交互式会自动跑「位置参数 prompt」（已用 pyte 渲染验证：自动提交 + YOLO 生效），
  // 所以照旧用位置参数，不走注入。
  if (tool === 'codex') {
    return {
      command: `codex${modelFlag} --dangerously-bypass-approvals-and-sandbox ${shellEscape(initPrompt)}`,
      initPrompt: null
    }
  }
  // hermes：位置参数会被当成子命令报错；裸起 `hermes --yolo` 进交互 TUI，首条 prompt 由包装器注入
  //（已用 pyte 渲染验证：注入后 hermes 立即 analyzing）。
  if (tool === 'hermes') {
    return { command: `hermes${modelFlag} --yolo`, initPrompt }
  }
  // antigravity 等其他：best-effort 裸起 + 注入
  return { command: `${tool}${modelFlag}`, initPrompt }
}

export async function openInTerminal(payload: HirePayload) {
  const agentId = randomUUID()
  const roleId = payload.role ?? 'fullstack'
  const spec = getRole(roleId)
  const terminalApp = payload.terminal ?? 'Terminal'

  const dogBin = resolveDogBin()
  const hookSettings = ensureHookSettings(dogBin)
  const promptPath = ensureRolePrompt(roleId)
  const { command: inner, initPrompt } = buildToolCommand(
    payload.tool,
    payload.taskLabel,
    promptPath,
    payload.model,
    payload.customCommand,
    hookSettings,
    agentId
  )

  if (!inner) return { ok: false, error: '空命令' }

  const tool = payload.tool === 'custom' ? 'custom' : payload.tool
  const emoji = spec?.emoji ?? '🐕'
  const title = `${emoji} ${payload.taskLabel.slice(0, 40)} [${markerOf(agentId)}]`

  const res = await writeLaunchAndOpen({
    agentId,
    taskLabel: payload.taskLabel,
    roleId: spec?.id ?? roleId,
    tool,
    terminalApp,
    projectId: payload.projectId,
    parentId: payload.parentId,
    projectDir: payload.projectDir,
    inner,
    initPrompt,
    title
  })
  return res.ok ? { ok: true, agentId, role: spec?.id ?? roleId } : res
}

// 写启动脚本 + osascript 拉起终端。openInTerminal 与 resumeInTerminal 共用。
async function writeLaunchAndOpen(opts: {
  agentId: string
  dogName?: string | null
  taskLabel: string
  roleId: string
  tool: string
  terminalApp: 'Terminal' | 'iTerm' | 'Warp'
  projectId?: string | null
  parentId?: string | null
  projectDir?: string | null
  inner: string
  initPrompt?: string | null
  title: string
}): Promise<{ ok: boolean; error?: string }> {
  const dogBin = resolveDogBin()
  const marker = markerOf(opts.agentId)
  const dogDir = dogBin.includes('/') ? dogBin.slice(0, dogBin.lastIndexOf('/')) : ''

  // === 把启动命令写成一个 sh 脚本文件 ===
  // 关键：所有变量在 Node 里用单引号 shell 转义写进文件，避免 osascript→shell→env→arg 四层引号嵌套。
  const envLines: string[] = [
    `export DOG_AGENT_ID=${shellEscape(opts.agentId)}`,
    `export DOG_TASK_LABEL=${shellEscape(opts.taskLabel)}`,
    `export DOG_TOOL=${shellEscape(opts.tool)}`,
    `export DOG_ROLE=${shellEscape(opts.roleId)}`,
    `export DOG_TERMINAL_APP=${shellEscape(opts.terminalApp)}`,
    `export DOG_TERMINAL_MARKER=${shellEscape(marker)}`
  ]
  if (opts.dogName) envLines.push(`export DOG_NAME=${shellEscape(opts.dogName)}`)
  if (opts.projectId) envLines.push(`export DOG_PROJECT_ID=${shellEscape(opts.projectId)}`)
  if (opts.parentId) envLines.push(`export DOG_PARENT_ID=${shellEscape(opts.parentId)}`)
  // 交互式工具（codex/hermes）/ 续接的首条 prompt 交给包装器在 TUI 就绪后注入
  if (opts.initPrompt) envLines.push(`export DOG_INIT_PROMPT=${shellEscape(opts.initPrompt)}`)
  // claude 狗用独立凭证目录，跟桌面 app 互不踢（前提：用户已在该目录 /login 过一次）
  if (opts.tool === 'claude') {
    envLines.push(`export CLAUDE_CONFIG_DIR=${shellEscape(CLAUDE_CFG_DIR)}`)
    ensureClaudeTrust(CLAUDE_CFG_DIR, opts.projectDir || homedir())
    ensureClaudeSkipBypass(CLAUDE_CFG_DIR)
  }

  const scriptLines = [
    '#!/bin/bash',
    dogDir ? `export PATH=${shellEscape(dogDir)}:"$PATH"` : '',
    // 代理透传：国内必须走代理，否则狗直连 Anthropic 会 403 Request not allowed
    ...resolveProxyExports(),
    opts.projectDir ? `cd ${shellEscape(opts.projectDir)} || true` : '',
    ...envLines,
    `exec ${shellEscape(dogBin)} run -- ${opts.inner}`,
    ''
  ].filter((l) => l !== '')

  const launchDir = join(homedir(), '.dog-office', 'launch')
  if (!existsSync(launchDir)) mkdirSync(launchDir, { recursive: true })
  const launchPath = join(launchDir, `${opts.agentId}.sh`)
  writeFileSync(launchPath, scriptLines.join('\n'), 'utf-8')
  chmodSync(launchPath, 0o755)

  const runCmd = `bash ${shellEscape(launchPath)}`
  const title = opts.title

  const script =
    opts.terminalApp === 'iTerm'
      ? `tell application "iTerm"
  activate
  if (count of windows) = 0 then
    create window with default profile
  end if
  tell current window
    set newTab to (create tab with default profile)
    tell current session of newTab
      set name to "${escape(title)}"
      write text "${escape(runCmd)}"
    end tell
  end tell
end tell`
      : opts.terminalApp === 'Warp'
      ? `tell application "Warp" to activate
delay 0.3
tell application "System Events" to keystroke "t" using {command down}
delay 0.3
tell application "System Events" to keystroke "${escape(runCmd)}"
tell application "System Events" to key code 36`
      : // Terminal.app
      `tell application "Terminal"
  activate
  set newTab to do script "${escape(runCmd)}"
  delay 0.15
  set custom title of newTab to "${escape(title)}"
end tell`

  try {
    await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: extractAppleScriptError(e) }
  }
}

// === 续接一只暂停/掉线的 claude 狗（撞额度后恢复用）===
// 用 `claude --resume <agentId>` 恢复原会话（会话 ID = 狗 ID），再注入"继续"提示让它接着干。
export async function resumeInTerminal(agent: {
  id: string
  dogName: string
  taskLabel: string
  role: string
  tool: string
  cwd: string | null
  projectId: string | null
  parentId: string | null
  terminalApp: string | null
}) {
  if (agent.tool !== 'claude') {
    return { ok: false, error: '续接目前只支持 claude 狗（它有会话恢复能力）' }
  }
  const spec = getRole(agent.role)
  const terminalApp = (agent.terminalApp as 'Terminal' | 'iTerm' | 'Warp') || 'Terminal'
  const hookSettings = ensureHookSettings(resolveDogBin())
  const hookFlag = hookSettings ? ` --settings ${shellEscape(hookSettings)}` : ''
  // --resume <id> 恢复原会话；不再传任务（会话历史里都有），靠注入的 prompt 推动继续
  const inner =
    `claude --dangerously-skip-permissions --disallowedTools Task${hookFlag} --resume ${shellEscape(agent.id)}`
  const initPrompt =
    '你之前执行任务时撞到用量上限被暂停了。现在额度恢复了，请先 dog team 看看团队现状，然后接着把没做完的任务继续做完，别从头重来。'

  const emoji = spec?.emoji ?? '🐕'
  const title = `${emoji} ▶续 ${(agent.taskLabel || '').slice(0, 36)} [${markerOf(agent.id)}]`

  return writeLaunchAndOpen({
    agentId: agent.id,
    dogName: agent.dogName,
    taskLabel: agent.taskLabel || '续接任务',
    roleId: spec?.id ?? agent.role,
    tool: 'claude',
    terminalApp,
    projectId: agent.projectId,
    parentId: agent.parentId,
    projectDir: agent.cwd,
    inner,
    initPrompt,
    title
  })
}

// === 把消息发到对应 agent ===
// 优先 PTY 直连（不需要辅助功能权限）；socket 不在 → 退化到老的 osascript 模拟键盘。
export async function sendToTerminal(args: {
  agentId: string
  terminalApp: string | null
  terminalMarker?: string | null
  terminalTty?: string | null
  text: string
}) {
  if (!args.text) return { ok: false, error: '空消息' }

  // 1) PTY 直连
  const ipc = await sendViaIpc(args.agentId, args.text)
  if (ipc.ok) return { ok: true, via: 'pty' as const }

  // 2) 退化：osascript（需要辅助功能权限）
  if (!args.terminalApp) return { ok: false, error: '没有终端信息（且 PTY 直连不可用）' }

  const markerKey = args.terminalMarker || args.agentId.slice(0, 8)
  const marker = `[${markerKey}]`
  const ttyName = args.terminalTty?.replace(/^\/dev\//, '')
  const appName = app.name || 'Dog Office'

  // 把消息写进剪贴板（用 base64 避免特殊字符 / 引号转义噩梦）
  const base64 = Buffer.from(args.text, 'utf-8').toString('base64')

  // 先定位 + 聚焦目标窗口
  let focusBlock = ''
  if (args.terminalApp === 'iTerm') {
    focusBlock = `set dogTargetFound to false
tell application "iTerm"
  activate
  repeat with w in windows
    repeat with t in tabs of w
      tell t
        repeat with s in sessions
          if name of s contains "${marker}" then
            select w
            select t
            tell s to select
            set dogTargetFound to true
            exit repeat
          ${ttyName ? `else if tty of s is "${appleString(ttyName)}" then
            select w
            select t
            tell s to select
            set dogTargetFound to true
            exit repeat` : ''}
          end if
        end repeat
      end tell
      if dogTargetFound then exit repeat
    end repeat
    if dogTargetFound then exit repeat
  end repeat
end tell
if dogTargetFound is false then error "找不到目标 iTerm 会话"`
  } else if (args.terminalApp === 'Warp') {
    focusBlock = `set dogTargetFound to true
tell application "Warp" to activate`
  } else {
    focusBlock = `set dogTargetFound to false
tell application "Terminal"
  activate
  repeat with w in windows
    repeat with t in tabs of w
      if custom title of t contains "${marker}"${ttyName ? ` or tty of t is "${appleString(ttyName)}"` : ''} then
        set selected tab of w to t
        set index of w to 1
        set dogTargetFound to true
        exit repeat
      end if
    end repeat
    if dogTargetFound then exit repeat
  end repeat
end tell
if dogTargetFound is false then error "找不到目标 Terminal 标签页"`
  }

  // 整套：写剪贴板 → 聚焦终端 → 粘贴 → 回车 → 焦点回 Electron
  const script = `do shell script "echo ${base64} | base64 --decode | pbcopy"
${focusBlock}
delay 0.12
tell application "System Events"
  keystroke "v" using {command down}
  delay 0.05
  key code 36
end tell
delay 0.12
try
  tell application "${appleString(appName)}" to activate
end try`

  try {
    await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: extractAppleScriptError(e) }
  }
}

// === 聚焦已存在的终端窗口 ===
export async function focusTerminal(args: {
  agentId: string
  terminalApp: string | null
  terminalMarker?: string | null
  terminalTty?: string | null
}) {
  if (!args.terminalApp) return { ok: false, error: '没有终端信息' }
  // 优先用 marker（子狗用的是根狗 marker），其次用 agent id 短码
  const markerKey = args.terminalMarker || args.agentId.slice(0, 8)
  const marker = `[${markerKey}]`
  const ttyName = args.terminalTty?.replace(/^\/dev\//, '')

  let script = ''

  if (args.terminalApp === 'iTerm') {
    script = `tell application "iTerm"
  activate
  repeat with w in windows
    repeat with t in tabs of w
      tell t
        repeat with s in sessions
          if name of s contains "${marker}" then
            select w
            select t
            tell s to select
            return
          ${ttyName ? `else if tty of s is "${appleString(ttyName)}" then
            select w
            select t
            tell s to select
            return` : ''}
          end if
        end repeat
      end tell
    end repeat
  end repeat
end tell`
  } else if (args.terminalApp === 'Warp') {
    // Warp AppleScript 支持有限，只能 activate 整个 app
    script = `tell application "Warp" to activate`
  } else {
    // Terminal.app
    script = `tell application "Terminal"
  activate
  repeat with w in windows
    repeat with t in tabs of w
      if custom title of t contains "${marker}"${ttyName ? ` or tty of t is "${appleString(ttyName)}"` : ''} then
        set selected tab of w to t
        set index of w to 1
        return
      end if
    end repeat
  end repeat
end tell`
  }

  try {
    await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: extractAppleScriptError(e) }
  }
}
