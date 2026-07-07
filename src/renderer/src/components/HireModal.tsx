import { useState, useEffect } from 'react'
import { useAgentStore } from '@/store/agentStore'

type RoleGroup = 'core' | 'quality' | 'specialist'

interface RoleSpec {
  id: string
  name: string
  emoji: string
  duty: string
  group?: RoleGroup
  defaultTool: string
  defaultModel: string | null
  isPm: boolean
}

interface PreflightCheck {
  id: string
  label: string
  level: 'ok' | 'warn' | 'error'
  message: string
}

const GROUP_ORDER: RoleGroup[] = ['core', 'quality', 'specialist']
const GROUP_LABEL: Record<RoleGroup, string> = {
  core: '核心 · 多数项目就这几个',
  quality: '质量 · 把关验收',
  specialist: '专才 · 按需才招'
}

const TOOLS = [
  { id: 'claude', label: 'Claude Code', emoji: '🤖' },
  { id: 'codex', label: 'Codex', emoji: '🧠' },
  { id: 'antigravity', label: 'Anti-Gravity', emoji: '🪐' },
  { id: 'hermes', label: 'Hermes', emoji: '⚡️' },
  { id: 'custom', label: '自定义命令', emoji: '⌨️' }
] as const

const TERMINALS = ['Terminal', 'iTerm', 'Warp'] as const
const PREFLIGHT_TIMEOUT_MS = 8000
const HIRE_TIMEOUT_MS = 18000

export function HireModal() {
  const open = useAgentStore((s) => s.hireOpen)
  const setOpen = useAgentStore((s) => s.openHire)
  const initialRole = useAgentStore((s) => s.hireInitialRole)
  const currentProjectId = useAgentStore((s) => s.currentProjectId)
  const projects = useAgentStore((s) => s.projects)
  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null

  const [roles, setRoles] = useState<RoleSpec[]>([])
  const [roleId, setRoleId] = useState<string>(initialRole ?? 'pm')
  const [tool, setTool] = useState<string>('claude')
  const [model, setModel] = useState('')
  const [taskLabel, setTaskLabel] = useState('')
  const [customCommand, setCustomCommand] = useState('')
  const [terminal, setTerminal] = useState<(typeof TERMINALS)[number]>('Terminal')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [preflight, setPreflight] = useState<PreflightCheck[]>([])

  // 加载角色注册表
  useEffect(() => {
    if (open && roles.length === 0) {
      window.dog.listRoles().then(setRoles).catch(() => {})
    }
  }, [open, roles.length])

  // 打开时同步初始角色 + 按角色填默认工具
  useEffect(() => {
    if (!open) return
    const rid = initialRole ?? 'pm'
    setRoleId(rid)
    const spec = roles.find((r) => r.id === rid)
    if (spec) {
      setTool(spec.defaultTool)
      setModel(spec.defaultModel ?? '')
    }
  }, [open, initialRole, roles])

  if (!open) return null

  const role = roles.find((r) => r.id === roleId)
  const isPm = role?.isPm ?? roleId === 'pm'

  function pickRole(r: RoleSpec) {
    setRoleId(r.id)
    setTool(r.defaultTool)
    setModel(r.defaultModel ?? '')
  }

  async function submit() {
    setErr('')
    setPreflight([])
    if (tool !== 'custom' && !taskLabel.trim()) {
      setErr(isPm ? '项目目标不能为空' : '任务描述不能为空')
      return
    }
    if (tool === 'custom' && !customCommand.trim()) {
      setErr('自定义命令不能为空')
      return
    }

    setSubmitting(true)
    const payload = {
      role: roleId,
      tool: tool as any,
      model: model.trim() || null,
      taskLabel: taskLabel.trim() || customCommand.trim(),
      customCommand: tool === 'custom' ? customCommand.trim() : undefined,
      terminal,
      projectId: currentProjectId,
      projectDir: currentProject?.dir ?? null
    }
    try {
      const checked = await withTimeout(
        window.dog.preflightHire(payload),
        PREFLIGHT_TIMEOUT_MS,
        '预检超时：主进程没有及时返回，请确认 PawPilot 没有卡住'
      )
      setPreflight(checked.checks ?? [])
      if (!checked.ok) {
        setErr('预检未通过，先处理红色项再招聘')
        return
      }

      const res = await withTimeout(
        window.dog.hireAgent(payload),
        HIRE_TIMEOUT_MS,
        '招聘超时：终端启动脚本没有及时返回，请检查 Terminal/iTerm/Warp 是否弹窗或卡住'
      )
      if (!res.ok) {
        setErr(res.error ?? '失败')
        return
      }
      setTaskLabel('')
      setCustomCommand('')
      setPreflight([])
      setOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const accent = isPm ? '#f59e0b' : '#4db6ff'

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(3,5,9,0.66)', backdropFilter: 'blur(10px)' }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col p-2"
        style={{
          maxHeight: '88vh',
          background: 'linear-gradient(180deg, rgba(28,34,45,0.98), rgba(14,18,26,0.98))',
          border: '1px solid rgba(255,215,156,0.16)',
          boxShadow: '0 34px 90px -22px rgba(0,0,0,0.75), inset 0 1px rgba(255,255,255,0.12)'
        }}
      >
        <div
          className="overflow-y-auto min-h-0 px-4 py-4"
          style={{
            borderRadius: 12,
            scrollbarGutter: 'stable',
            scrollPaddingBlock: 16
          }}
        >
          {/* 头部 */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{
                width: 40,
                height: 40,
                background: isPm
                  ? 'linear-gradient(135deg, #ffd58a 0%, #f59e0b 100%)'
                  : 'linear-gradient(135deg, #4db6ff 0%, #8b8ff6 100%)',
                boxShadow: `0 0 28px ${accent}60, inset 0 1px rgba(255,255,255,0.35)`
              }}
            >
              <span style={{ fontSize: 20 }}>{role?.emoji ?? '🐕'}</span>
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-base" style={{ color: '#fff7e8' }}>
                招聘 · {role?.name ?? '成员'}
              </div>
              <div className="text-[11px] truncate" style={{ color: 'rgba(255,247,232,0.56)' }}>
                {currentProject ? `项目：${currentProject.name}` : '快速监控（不归属任何项目）'}
              </div>
            </div>
          </div>

          {/* 角色选择（按 核心/质量/专才 分组） */}
          <div className="mb-4">
          {GROUP_ORDER.map((g) => {
            const groupRoles = roles.filter((r) => (r.group ?? 'specialist') === g)
            if (groupRoles.length === 0) return null
            return (
              <div key={g} className="mb-3 last:mb-0">
                <div className="text-[10px] tracking-wider mb-1.5" style={{ color: 'rgba(255,247,232,0.42)' }}>
                  {GROUP_LABEL[g]}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {groupRoles.map((r) => {
                    const sel = r.id === roleId
                    return (
                      <button
                        key={r.id}
                        onClick={() => pickRole(r)}
                        className="text-left rounded-lg p-2 transition-all"
                        style={{
                          background: sel
                            ? `linear-gradient(135deg, ${r.isPm ? 'rgba(245,185,66,0.2)' : 'rgba(77,182,255,0.2)'}, rgba(139,143,246,0.12))`
                            : 'rgba(255,255,255,0.05)',
                          border: sel
                            ? `1px solid ${r.isPm ? 'rgba(245,185,66,0.5)' : 'rgba(96,190,255,0.48)'}`
                            : '1px solid rgba(255,255,255,0.08)',
                          opacity: g === 'specialist' && !sel ? 0.72 : 1
                        }}
                        title={r.duty}
                      >
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: 14 }}>{r.emoji}</span>
                          <span className="text-[12px] font-medium truncate" style={{ color: '#fff7e8' }}>
                            {r.name}
                          </span>
                        </div>
                        <div className="text-[9.5px] mt-0.5 leading-tight line-clamp-2" style={{ color: 'rgba(255,247,232,0.46)' }}>
                          {r.duty}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* PM 说明 */}
        {isPm && (
          <div
            className="text-[12px] p-3 rounded-lg mb-4"
            style={{
              background: 'linear-gradient(135deg, rgba(245,185,66,0.1), rgba(245,158,11,0.08))',
              color: 'rgba(255,233,190,0.9)',
              border: '1px solid rgba(245,158,11,0.24)'
            }}
          >
            PM 会拆任务、写接口契约、等你审批后用{' '}
            <code className="text-[11px] px-1 rounded" style={{ background: 'rgba(255,255,255,0.1)' }}>
              dog hire
            </code>{' '}
            自动招齐团队。在它的终端里跟它对话。
          </div>
        )}

        {/* 工具 + 模型 */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] tracking-widest uppercase mb-2" style={{ color: 'rgba(255,247,232,0.5)' }}>
              工具
            </div>
            <select
              value={tool}
              onChange={(e) => setTool(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.065)', color: '#fff7e8', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {TOOLS.map((t) => (
                <option key={t.id} value={t.id} style={{ background: '#1c2230' }}>
                  {t.emoji} {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[11px] tracking-widest uppercase mb-2" style={{ color: 'rgba(255,247,232,0.5)' }}>
              模型（可选）
            </div>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="默认配置"
              className="w-full rounded-lg px-3 py-2 text-[13px] font-mono focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.065)', color: '#fff7e8', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>

        {/* 任务描述 / 自定义命令 */}
        {tool === 'custom' ? (
          <div className="mb-4">
            <div className="text-[11px] tracking-widest uppercase mb-2" style={{ color: 'rgba(255,247,232,0.5)' }}>
              完整命令
            </div>
            <input
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              placeholder="例：my-agent run --task 'xxx'"
              className="w-full rounded-lg px-3 py-2.5 text-[13px] font-mono focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.065)', color: '#fff7e8', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
        ) : (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] tracking-widest uppercase" style={{ color: 'rgba(255,247,232,0.5)' }}>
                {isPm ? '项目目标' : '任务描述'}
              </div>
              {isPm && (
                <button
                  onClick={() =>
                    setTaskLabel(
                      '接手已有项目：前面已经跑了一部分，代码就在当前项目目录里。请先按「接手模式」勘察现状——读 docs/PROJECT_STATE.md（没有就看现有文件 + git status/diff + 读 PRD），搞清楚已经做到哪了，然后接着把没做完的部分做完，已完成的别推倒重来。\n需求/PRD 文件路径：（在这里填，例如 /Users/trystan/Desktop/ms/杭州具身/具身智能大脑_Demo_PRD_v1.md）'
                    )
                  }
                  className="text-[10.5px] px-2 py-0.5 rounded transition-colors"
                  style={{ color: '#f0c36a', border: '1px solid rgba(245,185,66,0.3)' }}
                  title="把任务填成接手模板，让新 PM 续接而不是重来"
                >
                  ↻ 接手已有项目
                </button>
              )}
            </div>
            <textarea
              value={taskLabel}
              onChange={(e) => setTaskLabel(e.target.value)}
              placeholder={isPm ? '例：做一个登录注册系统' : '例：实现登录页 UI'}
              className="w-full rounded-lg px-3 py-2.5 text-[13px] resize-none focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.065)', color: '#fff7e8', border: '1px solid rgba(255,255,255,0.1)' }}
              rows={taskLabel.length > 60 ? 5 : 2}
            />
          </div>
        )}

        {/* 终端选择 */}
        <div className="mb-5">
          <div className="text-[11px] tracking-widest uppercase mb-2" style={{ color: 'rgba(255,247,232,0.5)' }}>
            在哪个终端打开
          </div>
          <div className="flex gap-2">
            {TERMINALS.map((t) => (
              <button
                key={t}
                onClick={() => setTerminal(t)}
                className="flex-1 text-[12px] py-1.5 rounded-md transition-colors"
                style={{
                  background: terminal === t ? 'rgba(77,182,255,0.16)' : 'rgba(255,255,255,0.055)',
                  color: terminal === t ? '#9fd4ff' : 'rgba(255,247,232,0.58)',
                  border: terminal === t ? '1px solid rgba(58,168,255,0.42)' : '1px solid rgba(255,255,255,0.08)'
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {err && (
          <div className="mb-3 text-[12px] rounded-md px-3 py-2" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
            {err}
          </div>
        )}

        {preflight.length > 0 && (
          <div
            className="mb-4 rounded-lg overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.055)',
              border: '1px solid rgba(255,255,255,0.09)'
            }}
          >
            <div
              className="px-3 py-2 text-[10px] tracking-widest uppercase flex items-center justify-between"
              style={{ color: 'rgba(255,247,232,0.5)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span>招聘前预检</span>
              <span style={{ color: preflight.some((c) => c.level === 'error') ? '#fca5a5' : '#86efac' }}>
                {preflight.some((c) => c.level === 'error') ? '需处理' : '可启动'}
              </span>
            </div>
            <div className="p-2 space-y-1">
              {preflight.map((c) => (
                <div
                  key={c.id}
                  className="grid gap-2 rounded-md px-2.5 py-2"
                  style={{
                    gridTemplateColumns: '76px 1fr',
                    background:
                      c.level === 'error' ? 'rgba(239,68,68,0.12)' :
                      c.level === 'warn' ? 'rgba(245,158,11,0.12)' :
                      'rgba(34,197,94,0.1)'
                  }}
                >
                  <div className="text-[11px] font-semibold" style={{ color: levelColor(c.level) }}>
                    {levelLabel(c.level)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium" style={{ color: '#fff7e8' }}>{c.label}</div>
                    <div className="text-[10.5px] leading-relaxed break-words" style={{ color: 'rgba(255,247,232,0.58)' }}>
                      {c.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="text-[13px] px-4 py-2 rounded-md transition-colors"
            style={{ color: 'rgba(255,247,232,0.62)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="text-[13px] font-medium text-white px-5 py-2 rounded-md disabled:opacity-50 transition-all hover:-translate-y-0.5"
            style={{
              background: isPm
                ? 'linear-gradient(135deg, #ffd58a 0%, #f59e0b 100%)'
                : 'linear-gradient(135deg, #4db6ff 0%, #8b8ff6 100%)',
              boxShadow: `0 4px 14px -2px ${accent}80`
            }}
          >
            {submitting ? '招聘中…' : isPm ? '入职' : '开始干活'}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

function levelLabel(level: PreflightCheck['level']) {
  if (level === 'error') return '错误'
  if (level === 'warn') return '提醒'
  return '通过'
}

function levelColor(level: PreflightCheck['level']) {
  if (level === 'error') return '#fca5a5'
  if (level === 'warn') return '#fbbf24'
  return '#86efac'
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      }
    )
  })
}
