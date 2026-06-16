import { exec } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { app } from 'electron'

const execAsync = promisify(exec)

function resolveDogBin(): string {
  if (process.env.DOG_BIN && existsSync(process.env.DOG_BIN)) return process.env.DOG_BIN
  const candidates = [
    // 打包后：放在 .app/Contents/Resources/sdk/dog
    join(process.resourcesPath ?? '', 'sdk/dog'),
    // 开发模式
    join(app.getAppPath(), 'sdk/dog'),
    join(process.cwd(), 'sdk/dog'),
    join(__dirname, '../../sdk/dog')
  ]
  for (const p of candidates) {
    if (p && existsSync(p)) return p
  }
  return 'dog'
}

import { getRole } from './roles'

const PROMPT_DIR = join(homedir(), '.dog-office', 'prompts')

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

/** 按工具拼出启动命令。claude 用真 system prompt；其他工具用"先读角色文件"指令 */
function buildToolCommand(
  tool: HirePayload['tool'],
  taskLabel: string,
  promptPath: string | null,
  model: string | null | undefined,
  customCommand?: string
): string {
  const modelFlag = model ? ` --model ${shellEscape(model)}` : ''

  if (tool === 'custom') return customCommand ?? ''

  if (tool === 'claude') {
    const sys = promptPath ? ` --append-system-prompt "$(cat ${shellEscape(promptPath)})"` : ''
    // 交互模式启动（不传任务参数），任务通过初始消息注入由 dog CLI 完成——
    // v1 简化：把任务拼进首条 prompt
    return `claude${modelFlag}${sys} "${escape(taskLabel)}"`
  }

  // codex / antigravity / hermes：没有统一的 system prompt 入口，
  // 用"先读角色文件再干活"的指令注入
  const lead = promptPath
    ? `你的角色规范在文件 ${promptPath} 里，先完整读完再开始工作。然后执行任务：`
    : ''
  return `${tool}${modelFlag} "${escape(lead + taskLabel)}"`
}

export async function openInTerminal(payload: HirePayload) {
  const agentId = randomUUID()
  const roleId = payload.role ?? 'fullstack'
  const spec = getRole(roleId)
  const terminalApp = payload.terminal ?? 'Terminal'

  const promptPath = ensureRolePrompt(roleId)
  const inner = buildToolCommand(
    payload.tool,
    payload.taskLabel,
    promptPath,
    payload.model,
    payload.customCommand
  )

  if (!inner) return { ok: false, error: '空命令' }

  const tool = payload.tool === 'custom' ? 'custom' : payload.tool
  const dogBin = resolveDogBin()
  const marker = markerOf(agentId)

  const envParts = [
    `DOG_AGENT_ID="${agentId}"`,
    `DOG_TASK_LABEL="${escape(payload.taskLabel)}"`,
    `DOG_TOOL="${tool}"`,
    `DOG_ROLE="${spec?.id ?? roleId}"`,
    `DOG_TERMINAL_APP="${terminalApp}"`,
    `DOG_TERMINAL_MARKER="${marker}"`
  ]
  if (payload.projectId) envParts.push(`DOG_PROJECT_ID="${payload.projectId}"`)
  if (payload.parentId) envParts.push(`DOG_PARENT_ID="${payload.parentId}"`)

  const cdPrefix = payload.projectDir ? `cd ${shellEscape(payload.projectDir)} && ` : ''
  const wrapped = `${cdPrefix}${envParts.join(' ')} "${dogBin}" run -- ${inner}`

  const emoji = spec?.emoji ?? '🐕'
  const title = `${emoji} ${payload.taskLabel} [${marker}]`

  const script =
    terminalApp === 'iTerm'
      ? `tell application "iTerm"
  activate
  if (count of windows) = 0 then
    create window with default profile
  end if
  tell current window
    set newTab to (create tab with default profile)
    tell current session of newTab
      set name to "${escape(title)}"
      write text "${escape(wrapped)}"
    end tell
  end tell
end tell`
      : terminalApp === 'Warp'
      ? `tell application "Warp" to activate
delay 0.3
tell application "System Events" to keystroke "t" using {command down}
delay 0.3
tell application "System Events" to keystroke "${escape(wrapped)}"
tell application "System Events" to key code 36`
      : // Terminal.app
      `tell application "Terminal"
  activate
  set newTab to do script "${escape(wrapped)}"
  delay 0.15
  set custom title of newTab to "${escape(title)}"
end tell`

  try {
    await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`)
    return { ok: true, agentId, role: spec?.id ?? roleId }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// === 把消息发到对应终端（通过剪贴板 + Cmd+V + Enter） ===
export async function sendToTerminal(args: {
  agentId: string
  terminalApp: string | null
  terminalMarker?: string | null
  terminalTty?: string | null
  text: string
}) {
  if (!args.terminalApp) return { ok: false, error: '没有终端信息' }
  if (!args.text) return { ok: false, error: '空消息' }

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
