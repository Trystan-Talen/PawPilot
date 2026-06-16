import { useState, useEffect } from 'react'
import { useAgentStore } from '@/store/agentStore'

type Role = 'manager' | 'worker'

const TOOLS = [
  { id: 'claude', label: 'Claude Code', desc: 'Anthropic 出品', emoji: '🤖' },
  { id: 'codex', label: 'Codex', desc: 'OpenAI 的 CLI agent', emoji: '🧠' },
  { id: 'antigravity', label: 'Anti-Gravity', desc: 'Google 反重力', emoji: '🪐' },
  { id: 'hermes', label: 'Hermes', desc: '其他 CLI agent', emoji: '⚡️' },
  { id: 'custom', label: '自定义命令', desc: '自己输完整命令', emoji: '⌨️' }
] as const

const TERMINALS = ['Terminal', 'iTerm', 'Warp'] as const

export function HireModal() {
  const open = useAgentStore((s) => s.hireOpen)
  const setOpen = useAgentStore((s) => s.openHire)
  const initialRole = useAgentStore((s) => s.hireInitialRole)
  const [role, setRole] = useState<Role>(initialRole ?? 'worker')
  const [tool, setTool] = useState<(typeof TOOLS)[number]['id']>('claude')
  const [taskLabel, setTaskLabel] = useState('')
  const [customCommand, setCustomCommand] = useState('')
  const [terminal, setTerminal] = useState<(typeof TERMINALS)[number]>('Terminal')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  // 当外部触发 (招聘主管 vs 招聘员工)，同步 role
  useEffect(() => {
    if (open) setRole(initialRole ?? 'worker')
  }, [open, initialRole])

  if (!open) return null

  async function submit() {
    setErr('')
    if (role === 'worker') {
      if (tool !== 'custom' && !taskLabel.trim()) {
        setErr('任务描述不能为空')
        return
      }
      if (tool === 'custom' && !customCommand.trim()) {
        setErr('自定义命令不能为空')
        return
      }
    } else {
      if (!taskLabel.trim()) {
        setErr('项目名称不能为空')
        return
      }
    }

    setSubmitting(true)
    const res = await window.dog.hireAgent({
      role,
      tool: role === 'manager' ? 'claude' : tool,
      taskLabel: taskLabel.trim() || customCommand.trim(),
      customCommand: tool === 'custom' ? customCommand.trim() : undefined,
      terminal
    })
    setSubmitting(false)
    if (!res.ok) {
      setErr(res.error ?? '失败')
      return
    }
    setTaskLabel('')
    setCustomCommand('')
    setOpen(false)
  }

  const isManager = role === 'manager'

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(3,5,9,0.66)', backdropFilter: 'blur(10px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-6"
        style={{
          background:
            'linear-gradient(180deg, rgba(28,34,45,0.98), rgba(14,18,26,0.98))',
          border: '1px solid rgba(255,215,156,0.16)',
          boxShadow: '0 34px 90px -22px rgba(0,0,0,0.75), inset 0 1px rgba(255,255,255,0.12)'
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 40,
              height: 40,
              background: isManager
                ? 'linear-gradient(135deg, #ffd58a 0%, #f59e0b 100%)'
                : 'linear-gradient(135deg, #4db6ff 0%, #8b8ff6 100%)',
              boxShadow: isManager
                ? '0 0 28px rgba(245,185,66,0.38), inset 0 1px rgba(255,255,255,0.35)'
                : '0 0 28px rgba(58,168,255,0.36), inset 0 1px rgba(255,255,255,0.35)'
            }}
          >
            <span style={{ fontSize: 20 }}>{isManager ? '👔' : '🐕'}</span>
          </div>
          <div>
            <div className="font-semibold text-base" style={{ color: '#fff7e8' }}>
              {isManager ? '招聘主管' : '招聘员工'}
            </div>
            <div className="text-[11px]" style={{ color: 'rgba(255,247,232,0.56)' }}>
              {isManager
                ? '一只 Claude Code 实例，负责拆任务派活'
                : '起一只员工 agent，进入办公室干活'}
            </div>
          </div>
        </div>

        {/* 角色切换 */}
        <div className="mb-5">
          <div className="text-[11px] tracking-widest uppercase mb-2" style={{ color: 'rgba(255,247,232,0.5)' }}>
            角色
          </div>
          <div className="flex gap-2 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.065)' }}>
            <button
              onClick={() => setRole('worker')}
              className="flex-1 text-[13px] font-medium py-2 rounded-md transition-all"
              style={{
                background: role === 'worker' ? 'rgba(255,255,255,0.14)' : 'transparent',
                color: role === 'worker' ? '#fff7e8' : 'rgba(255,247,232,0.52)',
                boxShadow: role === 'worker' ? '0 8px 20px rgba(0,0,0,0.16)' : 'none'
              }}
            >
              🐕 员工
            </button>
            <button
              onClick={() => setRole('manager')}
              className="flex-1 text-[13px] font-medium py-2 rounded-md transition-all"
              style={{
                background: role === 'manager' ? 'rgba(255,255,255,0.14)' : 'transparent',
                color: role === 'manager' ? '#fff7e8' : 'rgba(255,247,232,0.52)',
                boxShadow: role === 'manager' ? '0 8px 20px rgba(0,0,0,0.16)' : 'none'
              }}
            >
              👔 主管
            </button>
          </div>
        </div>

        {/* 员工：工具选择 */}
        {!isManager && (
          <div className="mb-4">
            <div className="text-[11px] tracking-widest uppercase mb-2" style={{ color: 'rgba(255,247,232,0.5)' }}>
              选工具
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  className="text-left rounded-lg p-2.5 transition-all"
                  style={{
                    background:
                      tool === t.id
                        ? 'linear-gradient(135deg, rgba(77,182,255,0.2) 0%, rgba(139,143,246,0.16) 100%)'
                        : 'rgba(255,255,255,0.055)',
                    border:
                      tool === t.id
                        ? '1px solid rgba(96,190,255,0.48)'
                        : '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 16 }}>{t.emoji}</span>
                    <span className="text-[13px] font-medium" style={{ color: '#fff7e8' }}>
                      {t.label}
                    </span>
                  </div>
                  <div className="text-[10px] mt-0.5 ml-6" style={{ color: 'rgba(255,247,232,0.5)' }}>
                    {t.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 主管说明 */}
        {isManager && (
          <div className="mb-4">
            <div
              className="text-[12px] p-3 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(245,185,66,0.08), rgba(245,158,11,0.08))',
                color: '#7a5a10',
                border: '1px solid rgba(245,158,11,0.2)'
              }}
            >
              主管会用你 <strong>Claude Code 默认配置的模型</strong> 启动，带主管系统提示词。
              <br />在终端里跟他对话，他会拆任务、列计划等你审批，然后用{' '}
              <code className="text-[11px] px-1 rounded" style={{ background: 'rgba(255,255,255,0.1)' }}>
                dog run
              </code>{' '}
              派活。
            </div>
          </div>
        )}

        {/* 任务描述 / 项目名称 */}
        {tool !== 'custom' || isManager ? (
          <div className="mb-4">
            <div className="text-[11px] tracking-widest uppercase mb-2" style={{ color: 'rgba(255,247,232,0.5)' }}>
              {isManager ? '项目名称' : '任务描述'}
            </div>
            <textarea
              value={taskLabel}
              onChange={(e) => setTaskLabel(e.target.value)}
              placeholder={
                isManager
                  ? '例：登录注册系统'
                  : '例：修复登录页面的样式 bug'
              }
              className="w-full rounded-lg px-3 py-2.5 text-[13px] resize-none focus:outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.065)',
                color: '#fff7e8',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
              rows={2}
            />
          </div>
        ) : null}

        {!isManager && tool === 'custom' && (
          <div className="mb-4">
            <div className="text-[11px] tracking-widest uppercase mb-2" style={{ color: 'rgba(255,247,232,0.5)' }}>
              完整命令
            </div>
            <input
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              placeholder="例：my-agent run --task 'xxx'"
              className="w-full rounded-lg px-3 py-2.5 text-[13px] font-mono focus:outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.065)',
                color: '#fff7e8',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
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
                  background:
                    terminal === t ? 'rgba(77,182,255,0.16)' : 'rgba(255,255,255,0.055)',
                  color: terminal === t ? '#9fd4ff' : 'rgba(255,247,232,0.58)',
                  border:
                    terminal === t
                      ? '1px solid rgba(58,168,255,0.42)'
                      : '1px solid rgba(255,255,255,0.08)'
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {err && (
          <div className="mb-3 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {err}
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
              background: isManager
                ? 'linear-gradient(135deg, #ffd58a 0%, #f59e0b 100%)'
                : 'linear-gradient(135deg, #4db6ff 0%, #8b8ff6 100%)',
              boxShadow: isManager
                ? '0 4px 14px -2px rgba(245,158,11,0.5)'
                : '0 4px 14px -2px rgba(58,168,255,0.5)'
            }}
          >
            {submitting ? '招聘中…' : isManager ? '入职' : '开始干活'}
          </button>
        </div>
      </div>
    </div>
  )
}
