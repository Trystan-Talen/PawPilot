import { useEffect, useState, useRef, KeyboardEvent } from 'react'
import { useAgentStore } from '@/store/agentStore'
import type { LogEntry, Agent } from '@/types/agent'
import { isPmRole } from '@/types/agent'

const STATUS_LABEL: Record<string, string> = {
  working: '工作中',
  thinking: '思考中',
  idle: '摸鱼中',
  submitted: '待验收',
  done: '完成',
  error: '出错',
  waiting: '等回应',
  lost: '失联',
  interrupted: '已中断'
}

const STATUS_DOT: Record<string, string> = {
  working: '#3aa8ff',
  thinking: '#a78bfa',
  idle: '#9aa0a8',
  submitted: '#14b8a6',
  done: '#10b981',
  error: '#ef4444',
  waiting: '#f59e0b',
  lost: '#9aa0a8',
  interrupted: '#f97316'
}

export function DetailPanel() {
  const selectedId = useAgentStore((s) => s.selectedId)
  const select = useAgentStore((s) => s.select)
  const agents = useAgentStore((s) => s.agents)
  const archived = useAgentStore((s) => s.archived)
  const agent =
    (selectedId && (agents[selectedId] ?? archived.find((a) => a.id === selectedId))) || null

  // 找父和子
  const parent =
    agent?.parentId
      ? (agents[agent.parentId] ?? archived.find((a) => a.id === agent.parentId)) ?? null
      : null
  const children = agent
    ? [
        ...Object.values(agents).filter((a) => a.parentId === agent.id),
        ...archived.filter((a) => a.parentId === agent.id)
      ]
    : []

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const logScrollRef = useRef<HTMLDivElement>(null)

  // 新活动进来时，若已在底部附近则自动滚到底（不打断手动往上翻看）
  useEffect(() => {
    const el = logScrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [logs])

  useEffect(() => {
    if (!selectedId) return
    let stop = false
    const load = () => {
      window.dog.getLogs(selectedId).then((rows) => {
        if (!stop) setLogs(rows as LogEntry[])
      })
    }
    load()
    const t = setInterval(load, 1500)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [selectedId])

  const isOpen = !!agent

  return (
    <>
      {/* 遮罩 */}
      <div
        onClick={() => select(null)}
        className="fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: 'rgba(3,5,9,0.62)',
          backdropFilter: isOpen ? 'blur(4px)' : 'none',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none'
        }}
      />

      {/* 面板 */}
      <aside
        className="fixed top-0 right-0 bottom-0 z-40 flex flex-col"
        style={{
          width: 460,
          background: 'linear-gradient(180deg, rgba(28,34,45,0.98) 0%, rgba(13,17,24,0.98) 100%)',
          borderLeft: '1px solid rgba(255,215,156,0.16)',
          boxShadow: isOpen ? '-28px 0 76px -18px rgba(0,0,0,0.62)' : 'none',
          color: '#fff7e8',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          visibility: isOpen ? 'visible' : 'hidden',
          transition: 'transform 0.42s cubic-bezier(0.2, 0.7, 0.3, 1), visibility 0s linear 0.42s'
        }}
      >
        {agent && (
          <>
            {/* 头部 */}
            <div className="flex items-start gap-3 p-5 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div
                className="flex-shrink-0 rounded-xl flex items-center justify-center"
                style={{
                  background: isPmRole(agent.role)
                    ? 'linear-gradient(135deg, #fff0cc 0%, #f5b942 100%)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%)',
                  width: 72,
                  height: 72,
                  boxShadow: 'inset 0 1px rgba(255,255,255,0.22), 0 12px 32px rgba(0,0,0,0.2)'
                }}
              >
                <DogPortrait role={agent.role} size={56} />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-lg font-semibold tracking-wide"
                    style={{ color: agent.accentColor }}
                  >
                    {agent.dogName}
                  </span>
                  <span className="text-[10px] uppercase font-mono tracking-widest" style={{ color: '#8a8e99' }}>
                    {agent.tool}
                  </span>
                </div>
                <div
                  className="text-sm mt-0.5 overflow-y-auto whitespace-pre-wrap break-words"
                  style={{ color: 'rgba(255,247,232,0.72)', maxHeight: 84 }}
                  title={agent.taskLabel}
                >
                  {agent.taskLabel.length > 300 ? agent.taskLabel.slice(0, 300) + '…' : agent.taskLabel}
                </div>
                <div className="mt-2 text-[12px] font-mono" style={{ color: 'rgba(255,247,232,0.44)' }}>
                  {new Date(agent.startedAt).toLocaleTimeString('zh-CN')} 启动
                </div>
              </div>
              <button
                onClick={() => select(null)}
                className="transition-colors p-1"
                style={{ color: 'rgba(255,247,232,0.48)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff7e8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,247,232,0.48)')}
              >
                ✕
              </button>
            </div>

            {/* 归属关系 */}
            {(parent || children.length > 0 || isPmRole(agent.role)) && (
              <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <div className="text-[10px] tracking-widest uppercase text-[#8a8e99] mb-2">
                  归属关系
                </div>

                {parent && (
                  <div className="mb-2">
                    <span className="text-[10px] text-[#8a8e99] mr-2">主管</span>
                    <button
                      onClick={() => select(parent.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[12px] hover:bg-black/[0.04] transition-colors"
                      style={{ color: parent.accentColor }}
                    >
                      👔 {parent.dogName}
                      <span className="text-[#8a8e99] font-normal">
                        · {parent.taskLabel}
                      </span>
                    </button>
                  </div>
                )}

                {!isPmRole(agent.role) && !parent && (
                  <div className="text-[11px] text-[#8a8e99] italic mb-2">
                    无主管 · 你直接招的
                  </div>
                )}

                {children.length > 0 ? (
                  <div>
                    <span className="text-[10px] text-[#8a8e99] mb-1.5 block">
                      手下员工 ({children.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {children.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => select(c.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] hover:bg-black/[0.04] transition-colors"
                          style={{
                            border: `1px solid ${c.accentColor}44`,
                            color: c.accentColor
                          }}
                          title={`${c.taskLabel} · ${STATUS_LABEL[c.status] ?? c.status}`}
                        >
                          <span
                            className="block rounded-full"
                            style={{
                              width: 5,
                              height: 5,
                              background: STATUS_DOT[c.status] ?? c.accentColor
                            }}
                          />
                          {c.dogName}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : isPmRole(agent.role) ? (
                  <div className="text-[11px] text-[#8a8e99] italic">
                    还没派活
                  </div>
                ) : null}
              </div>
            )}

            {/* 当前任务 */}
            <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="text-[10px] tracking-widest uppercase text-[#8a8e99] mb-1.5">
                正在执行
              </div>
              <div className="text-[13px] text-[#fff7e8] font-mono leading-relaxed">
                {agent.currentAction || '—'}
              </div>
              <div className="mt-2.5">
                <div className="h-1 rounded-full bg-[#e2e5ec] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(2, Math.round(agent.progress * 100))}%`,
                      background: agent.accentColor,
                      boxShadow: `0 0 8px ${agent.accentColor}66`
                    }}
                  />
                </div>
                <div className="text-[10px] text-[#8a8e99] mt-1 font-mono">
                  {Math.round(agent.progress * 100)}%
                </div>
              </div>
            </div>

            {/* 统计 */}
            <div className="grid grid-cols-3 gap-2 px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <Stat label="输入" value={fmt(agent.inputTokens)} unit="tok" />
              <Stat label="输出" value={fmt(agent.outputTokens)} unit="tok" />
              <Stat label="花费" value={`$${agent.costUsd.toFixed(3)}`} />
            </div>

            {/* 活动流 */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="px-5 py-2 text-[10px] tracking-widest uppercase text-[#8a8e99] border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <span>活动流 ({logs.length})</span>
                <span className="normal-case tracking-normal text-[9px]" style={{ color: '#6a7080' }}>
                  完整对话点「打开终端」
                </span>
              </div>
              <div
                ref={logScrollRef}
                className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-relaxed"
                style={{ background: 'rgba(5,8,13,0.42)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                {logs.length === 0 && (
                  <div className="text-[#8a8e99] italic py-4">还没有活动…</div>
                )}
                {logs.map((l, i) => (
                  <LogRow key={i} entry={l} />
                ))}
              </div>
            </div>

            {/* 对话输入框 + 底部操作 */}
            <div className="border-t border-black/[0.06]">
              <ChatInput agent={agent} />
              {/* 续接：撞额度暂停/掉线的 claude 狗，额度恢复后带记忆接着干 */}
              {agent.tool === 'claude' &&
                ['paused', 'lost', 'interrupted', 'error'].includes(agent.status) && (
                  <div className="px-4 pt-2">
                    <button
                      onClick={async () => {
                        const r = await window.dog.resumeAgent(agent.id)
                        if (!r.ok) alert('续接失败：' + (r.error ?? '未知'))
                      }}
                      title="用原会话记忆续接，接着把没做完的任务做完（额度恢复后再点）"
                      className="w-full text-[12px] font-semibold px-3 py-2 rounded-md transition-all hover:-translate-y-0.5"
                      style={{
                        background: agent.status === 'paused' ? '#eab308' : 'rgba(234,179,8,0.14)',
                        color: agent.status === 'paused' ? '#1a1410' : '#a07a08',
                        border: '1px solid rgba(234,179,8,0.45)'
                      }}
                    >
                      ▶ 继续{agent.status === 'paused' ? '（额度恢复后接着干）' : '（恢复这只狗的会话）'}
                    </button>
                  </div>
                )}
              <div className="grid grid-cols-3 gap-2 px-4 pb-3 pt-1">
                <button
                  onClick={() => window.dog.killAgent(agent.id)}
                  disabled={agent.archived === 1}
                  title={
                    agent.status === 'done' || agent.status === 'error' ||
                    agent.status === 'interrupted' || agent.status === 'lost'
                      ? '把这只已经停工/失联的狗清出办公室'
                      : '终止进程并送它离场'
                  }
                  className="text-[12px] font-medium px-3 py-2 rounded-md border hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  style={{ color: '#c53b3b', borderColor: 'rgba(197,59,59,0.3)' }}
                >
                  {agent.status === 'done' || agent.status === 'error' ||
                   agent.status === 'interrupted' || agent.status === 'lost'
                    ? '清退'
                    : '终止'}
                </button>
                <button
                  onClick={async () => {
                    const res = await window.dog.getHandoff(agent.id)
                    if (res.ok && res.text) {
                      navigator.clipboard.writeText(res.text)
                      setCopied('handoff')
                      setTimeout(() => setCopied(null), 1600)
                    }
                  }}
                  className="text-[12px] font-medium text-[#f0c36a] px-3 py-2 rounded-md border border-amber-300/20 hover:bg-amber-300/[0.08] transition-colors"
                >
                  {copied === 'handoff' ? '✓ 已复制' : '接手上下文'}
                </button>
                <button
                  onClick={() => {
                    const text = logs.map((l) => `${new Date(l.ts).toISOString()} [${l.level}] ${l.content}`).join('\n')
                    navigator.clipboard.writeText(text)
                    setCopied('logs')
                    setTimeout(() => setCopied(null), 1600)
                  }}
                  className="text-[12px] font-medium text-[#d9cdb9] px-3 py-2 rounded-md border border-white/10 hover:bg-white/[0.06] transition-colors"
                >
                  {copied === 'logs' ? '✓ 已复制' : '复制日志'}
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

// 深色活动流背景上的可读配色
const LOG_COLOR: Record<string, string> = {
  info: '#aeb4c4',
  warn: '#fbbf24',
  error: '#fca5a5',
  tool: '#7fc4ff',
  meta: '#c4b5fd'
}
const LOG_BG: Record<string, string> = {
  warn: 'rgba(251,191,36,0.16)',
  error: 'rgba(239,68,68,0.16)',
  tool: 'rgba(58,168,255,0.16)',
  meta: 'rgba(167,139,250,0.16)'
}

const LOG_TAG: Record<string, string> = {
  info: '动作',
  warn: '等待',
  error: '错误',
  tool: '工具',
  meta: '消息'
}

const LOG_CLAMP = 240   // 单条超过这个长度就折叠

function LogRow({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false)
  const long = entry.content.length > LOG_CLAMP
  const shown = open || !long ? entry.content : entry.content.slice(0, LOG_CLAMP) + '…'
  const color = LOG_COLOR[entry.level] ?? '#aeb4c4'
  return (
    <div className="flex gap-2 py-0.5 group items-start">
      <span className="text-[#6a7080] flex-shrink-0 text-[10px] pt-px">
        {new Date(entry.ts).toLocaleTimeString('zh-CN', { hour12: false })}
      </span>
      <span
        className="flex-shrink-0 px-1 rounded text-[9px] font-bold pt-px"
        style={{ color, background: LOG_BG[entry.level] ?? 'transparent' }}
      >
        {LOG_TAG[entry.level] ?? entry.level}
      </span>
      <span
        className="break-words whitespace-pre-wrap min-w-0 flex-1"
        style={{ color: entry.level === 'error' ? '#fca5a5' : '#d2d8e2' }}
      >
        {shown}
        {long && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-1.5 text-[10px] underline"
            style={{ color: '#7fc4ff' }}
          >
            {open ? '收起' : '展开'}
          </button>
        )}
      </span>
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.065)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[10px] text-[#8a8e99] tracking-wider uppercase">{label}</div>
      <div className="text-[14px] text-[#fff7e8] font-semibold font-mono tabular-nums mt-0.5">
        {value}
        {unit && <span className="text-[10px] text-[#8a8e99] ml-1">{unit}</span>}
      </div>
    </div>
  )
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

// === 小狗头像（背影，跟工位风格一致）===
function DogPortrait({ role, size = 56 }: { role: string; size?: number }) {
  const isManager = isPmRole(role)
  const fur = isManager
    ? { body: '#7d8590', highlight: '#a0a8b2', earOuter: '#4a5260', earInner: '#6a737e' }
    : { body: '#c69a6a', highlight: '#e0bd8e', earOuter: '#7a5230', earInner: '#9a6e44' }

  return (
    <svg viewBox="0 0 140 140" width={size} height={size}>
      {/* 顶部小帽（主管才有） */}
      {isManager && (
        <g>
          <ellipse cx="70" cy="22" rx="22" ry="3.5" fill="#22252f" />
          <path d="M 50 22 L 53 8 Q 53 6 56 6 L 84 6 Q 87 6 87 8 L 90 22 Z" fill="#1a1d28" />
          <rect x="51" y="18" width="38" height="3" fill="#f5b942" />
        </g>
      )}
      {/* 圆头 */}
      <path d="M 38 110 Q 38 36 70 36 Q 102 36 102 110 Z" fill={fur.body} />
      {/* 顶部高光 */}
      <ellipse cx="70" cy="48" rx="18" ry="5" fill={fur.highlight} opacity="0.55" />
      {/* 左耳 */}
      <g transform="rotate(-6 50 50)">
        <path d="M 48 46 Q 30 48 28 76 Q 30 92 46 92 Q 56 76 54 46 Z" fill={fur.earOuter} />
        <path d="M 46 54 Q 34 56 34 76 Q 36 86 44 86 Q 50 70 46 54 Z" fill={fur.earInner} opacity="0.85" />
      </g>
      {/* 右耳 */}
      <g transform="rotate(6 90 50)">
        <path d="M 92 46 Q 110 48 112 76 Q 110 92 94 92 Q 84 76 86 46 Z" fill={fur.earOuter} />
        <path d="M 94 54 Q 106 56 106 76 Q 104 86 96 86 Q 90 70 94 54 Z" fill={fur.earInner} opacity="0.85" />
      </g>
    </svg>
  )
}

// === 对话输入框 ===
function ChatInput({ agent }: { agent: Agent }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  const disabled =
    !agent.terminalApp ||
    agent.archived === 1 ||
    agent.status === 'done' ||
    agent.status === 'error' ||
    agent.status === 'lost' ||
    agent.status === 'interrupted'

  async function send() {
    if (!text.trim() || sending || disabled) return
    setSending(true)
    setHint(null)
    const res = await window.dog.sendToTerminal({
      agentId: agent.id,
      terminalApp: agent.terminalApp,
      terminalMarker: agent.terminalMarker,
      terminalTty: agent.terminalTty,
      text
    })
    setSending(false)
    if (res.ok) {
      setText('')
      setHint('已发送')
      setTimeout(() => setHint(null), 1200)
      ref.current?.focus()
    } else {
      setHint(`失败：${res.error}`)
      setTimeout(() => setHint(null), 3000)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
    // Shift+Enter 自然换行（默认行为）
  }

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="text-[10px] text-[#8a8e99] mb-1.5 flex items-center justify-between">
        <span>
          发送到 <span style={{ color: agent.accentColor }}>{agent.dogName}</span> 的终端
        </span>
        {hint && (
          <span className="text-[10px] font-medium" style={{ color: hint.startsWith('失败') ? '#b91c1c' : '#15803d' }}>
            {hint}
          </span>
        )}
      </div>
      <div
        className="rounded-lg flex items-end gap-2 p-2"
        style={{
          background: disabled ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.08)',
          border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.13)'}`,
          opacity: disabled ? 0.6 : 1
        }}
      >
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={
            disabled
              ? '该 agent 不可输入（已离场 / 无终端）'
              : '输入消息… Enter 发送，Shift+Enter 换行'
          }
          rows={1}
          className="flex-1 bg-transparent text-[12px] resize-none focus:outline-none font-mono leading-relaxed"
          style={{ maxHeight: 120, minHeight: 22, color: '#fff7e8' }}
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending || disabled}
          className="text-[11px] font-medium text-white px-3 py-1.5 rounded-md transition-all disabled:opacity-40"
          style={{
            background: !text.trim() || disabled
              ? '#c8ccd5'
              : `linear-gradient(135deg, ${agent.accentColor} 0%, ${agent.accentColor}dd 100%)`,
            cursor: !text.trim() || disabled ? 'not-allowed' : 'pointer'
          }}
        >
          {sending ? '发送中' : '发送'}
        </button>
      </div>
    </div>
  )
}
