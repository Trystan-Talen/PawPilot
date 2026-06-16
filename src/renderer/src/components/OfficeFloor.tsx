import { useAgentStore } from '@/store/agentStore'
import { Workstation } from './Workstation'
import type { Agent } from '@/types/agent'
import { isPmRole } from '@/types/agent'

export function OfficeFloor() {
  const agents = useAgentStore((s) => s.agents)
  const select = useAgentStore((s) => s.select)
  const focusedId = useAgentStore((s) => s.focusedId)
  const focus = useAgentStore((s) => s.focus)
  const walkingOut = useAgentStore((s) => s.walkingOut)
  const openHire = useAgentStore((s) => s.openHire)

  const list = Object.values(agents).sort((a, b) => a.startedAt - b.startedAt)
  const managers = list.filter((a) => isPmRole(a.role))
  const workers = list.filter((a) => !isPmRole(a.role))

  // 计算"相关 ids"——focusedId 自己 + 它的父 + 它的所有子 + 它的兄弟
  const relatedIds = computeRelated(focusedId, agents)

  // 单击工位卡片：聚焦 / 取消聚焦
  // 双击或点详情按钮：打开详情
  const handleCardClick = (id: string) => {
    if (focusedId === id) {
      focus(null) // 再点一次取消
    } else {
      focus(id)
    }
  }

  const handleEmptyClick = () => {
    if (focusedId) focus(null)
  }

  if (list.length === 0) {
    return (
      <div
        className="relative flex-1 flex flex-col items-center justify-center text-center px-6"
        onClick={() => openHire(true, 'manager')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openHire(true, 'manager')
          }
        }}
        aria-label="招聘主管"
        style={{ cursor: 'pointer' }}
      >
        <div
          className="absolute w-[620px] max-w-[86vw] aspect-[2] rounded-full"
          style={{
            background:
              'radial-gradient(ellipse, rgba(255,191,115,0.13), rgba(91,151,211,0.055) 42%, transparent 72%)',
            filter: 'blur(22px)',
            top: '32%'
          }}
        />
        <div
          className="relative mb-6 flex items-center justify-center"
          style={{
            width: 136,
            height: 118,
            borderRadius: 20,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.026))',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow:
              '0 24px 70px rgba(0,0,0,0.32), inset 0 1px rgba(255,255,255,0.14)'
          }}
        >
          <EmptyOfficeMark />
        </div>
        <div className="relative text-xl font-semibold mb-2 tracking-wide" style={{ color: '#fff7e8' }}>
          办公室还没人，安静得能听见心跳。
        </div>
        <div className="relative text-sm max-w-sm leading-7" style={{ color: 'rgba(255,247,232,0.58)' }}>
          点击这里招一只<strong style={{ color: '#f59e0b' }}>主管</strong>来拆任务派活，
          <br />
          或者直接招<strong style={{ color: '#3aa8ff' }}>员工</strong>开干。
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation()
              openHire(true, 'manager')
            }}
            className="flex items-center gap-2 text-sm font-medium text-white px-5 py-2.5 rounded-lg transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #f2bf64 0%, #e79522 100%)',
              boxShadow: '0 12px 28px -10px rgba(245,158,11,0.62), inset 0 1px rgba(255,255,255,0.28)'
            }}
          >
            <span className="text-lg leading-none">+</span> 招聘主管
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              openHire(true, 'worker')
            }}
            className="flex items-center gap-2 text-sm font-medium text-white px-5 py-2.5 rounded-lg transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #479de5 0%, #6c75df 100%)',
              boxShadow: '0 12px 28px -10px rgba(58,168,255,0.56), inset 0 1px rgba(255,255,255,0.25)'
            }}
          >
            <span className="text-lg leading-none">+</span> 招聘员工
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative flex-1 overflow-y-auto"
      onClick={handleEmptyClick}
    >
      <div className="mx-auto" style={{ maxWidth: 1540, padding: '24px 22px 34px' }}>
        {/* 主管行 */}
        {managers.length > 0 && (
          <div
            className="mb-7 rounded-2xl"
            style={{
              padding: '16px 18px 18px',
              background:
                'linear-gradient(180deg, rgba(255,213,138,0.105), rgba(255,255,255,0.035))',
              border: '1px solid rgba(255,213,138,0.16)',
              boxShadow: 'inset 0 1px rgba(255,255,255,0.12), 0 18px 50px rgba(0,0,0,0.16)'
            }}
          >
            <SectionLabel label="主管室" color="#f59e0b" count={managers.length} accent="👔" />
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${Math.max(managers.length, 1)}, minmax(220px, 280px))`,
                justifyContent: 'center'
              }}
            >
              {managers.map((agent) => (
                <Workstation
                  key={agent.id}
                  agent={agent}
                  walkingOut={walkingOut.has(agent.id)}
                  dimmed={focusedId !== null && !relatedIds.has(agent.id)}
                  highlighted={focusedId === agent.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCardClick(agent.id)
                  }}
                  onOpenDetail={() => select(agent.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 员工区 */}
        {workers.length > 0 && (
          <div
            className="rounded-2xl"
            style={{
              padding: managers.length > 0 ? '14px 14px 18px' : '0',
              background: managers.length > 0
                ? 'linear-gradient(180deg, rgba(92,173,255,0.075), rgba(255,255,255,0.02))'
                : 'transparent',
              border: managers.length > 0 ? '1px solid rgba(134,194,255,0.12)' : 'none'
            }}
          >
            {managers.length > 0 && (
              <SectionLabel label="员工区" color="#3aa8ff" count={workers.length} accent="🐕" />
            )}
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 260px))',
                justifyContent: 'center'
              }}
            >
              {workers.map((agent) => (
                <Workstation
                  key={agent.id}
                  agent={agent}
                  walkingOut={walkingOut.has(agent.id)}
                  dimmed={focusedId !== null && !relatedIds.has(agent.id)}
                  highlighted={focusedId === agent.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCardClick(agent.id)
                  }}
                  onOpenDetail={() => select(agent.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 聚焦时显示提示 */}
        {focusedId && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full text-[12px] flex items-center gap-2 transition-all"
            style={{
              background: 'rgba(13, 17, 24, 0.88)',
              color: '#fff7e8',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 16px 42px rgba(0,0,0,0.28)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <span>已聚焦 {agents[focusedId]?.dogName ?? ''} 的关系网</span>
            <button
              onClick={() => focus(null)}
              className="ml-1 px-2 py-0.5 rounded-full text-[11px] hover:bg-white/10 transition-colors"
            >
              退出 ✕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyOfficeMark() {
  return (
    <svg viewBox="0 0 136 118" width="136" height="118" aria-hidden="true">
      <defs>
        <linearGradient id="empty-desk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d7b782" />
          <stop offset="1" stopColor="#7b5839" />
        </linearGradient>
        <linearGradient id="empty-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14324f" />
          <stop offset="1" stopColor="#07101d" />
        </linearGradient>
        <radialGradient id="empty-warm" cx="50%" cy="38%" r="60%">
          <stop offset="0" stopColor="rgba(255,209,139,0.42)" />
          <stop offset="1" stopColor="rgba(255,209,139,0)" />
        </radialGradient>
      </defs>
      <ellipse cx="68" cy="96" rx="48" ry="7" fill="rgba(0,0,0,0.24)" />
      <ellipse cx="68" cy="57" rx="58" ry="45" fill="url(#empty-warm)" />
      <rect x="42" y="20" width="52" height="34" rx="5" fill="#111824" stroke="rgba(196,218,242,0.24)" />
      <rect x="46" y="24" width="44" height="25" rx="2.5" fill="url(#empty-screen)" />
      <path d="M 49 28 H 68 M 49 33 H 78 M 49 38 H 64" stroke="#82c9ff" strokeWidth="1.1" strokeLinecap="round" opacity="0.58" />
      <rect x="64" y="54" width="8" height="10" fill="#151923" />
      <ellipse cx="68" cy="65" rx="15" ry="3" fill="#151923" />
      <path d="M 25 68 L 108 68 L 116 91 L 18 91 Z" fill="url(#empty-desk)" />
      <path d="M 25 70 H 107" stroke="rgba(255,244,218,0.32)" />
      <path d="M 18 91 H 116 V 94 H 18 Z" fill="#493225" />
      <rect x="41" y="72" width="54" height="5" rx="1.5" fill="#2b3140" />
      <rect x="32" y="94" width="3" height="15" fill="#5d432f" />
      <rect x="101" y="94" width="3" height="15" fill="#5d432f" />
      <path d="M 89 63 Q 96 53 107 58" stroke="#f0b768" strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="107" cy="58" r="4" fill="#ffe0a4" opacity="0.95" />
    </svg>
  )
}

/** 计算与 focusedId 相关的 agent ids（自己 + 父 + 兄弟 + 子） */
function computeRelated(
  focusedId: string | null,
  agents: Record<string, Agent>
): Set<string> {
  const set = new Set<string>()
  if (!focusedId) return set

  const focused = agents[focusedId]
  if (!focused) return set
  set.add(focused.id)

  // 添加父
  if (focused.parentId && agents[focused.parentId]) {
    set.add(focused.parentId)
    // 兄弟（父的所有其他子）
    for (const a of Object.values(agents)) {
      if (a.parentId === focused.parentId) set.add(a.id)
    }
  }

  // 添加所有子
  for (const a of Object.values(agents)) {
    if (a.parentId === focused.id) set.add(a.id)
  }

  return set
}

function SectionLabel({
  label,
  color,
  count,
  accent
}: {
  label: string
  color: string
  count: number
  accent: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <span style={{ fontSize: 14 }}>{accent}</span>
      <span className="text-[12px] font-semibold tracking-wide" style={{ color: '#fff7e8' }}>
        {label}
      </span>
      <span
        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
        style={{
          color,
          background: `${color}20`,
          border: `1px solid ${color}30`
        }}
      >
        {count}
      </span>
      <span
        className="flex-1 h-px"
        style={{ background: `linear-gradient(90deg, ${color}40 0%, transparent 100%)` }}
      />
    </div>
  )
}
