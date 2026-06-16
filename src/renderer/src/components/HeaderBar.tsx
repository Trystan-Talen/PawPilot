import { useAgentStore } from '@/store/agentStore'

export function HeaderBar() {
  const agents = useAgentStore((s) => s.agents)
  const archived = useAgentStore((s) => s.archived)
  const openHire = useAgentStore((s) => s.openHire)
  const openArchive = useAgentStore((s) => s.openArchive)

  const list = Object.values(agents)
  const running = list.filter(
    (a) => a.status === 'working' || a.status === 'thinking'
  ).length
  const waiting = list.filter((a) => a.status === 'waiting').length
  const errored = list.filter((a) => a.status === 'error').length
  const todayDone = archived.filter(
    (a) => a.endedAt && Date.now() - a.endedAt < 86_400_000
  ).length
  const todayCost = [
    ...list,
    ...archived.filter((a) => a.endedAt && Date.now() - a.endedAt < 86_400_000)
  ].reduce((sum, a) => sum + (a.costUsd ?? 0), 0)

  return (
    <header
      className="relative z-20 flex items-center justify-between gap-4 px-6 py-3.5"
      style={{
        WebkitAppRegion: 'drag',
        background: 'linear-gradient(180deg, rgba(17,22,32,0.84), rgba(14,16,22,0.64))',
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(255,215,156,0.12)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.16)'
      } as any}
    >
      {/* 标题 */}
      <div className="flex items-center gap-3 pl-16">
        <div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, #ffd58a 0%, #ff7c5d 100%)',
            boxShadow: '0 8px 22px rgba(255,138,61,0.35), inset 0 1px rgba(255,255,255,0.35)'
          }}
        >
          <span style={{ fontSize: 18 }}>🐕</span>
        </div>
        <div className="leading-tight">
          <div className="font-semibold tracking-wide text-[15px]" style={{ color: '#fff7e8' }}>
            Dog Office
          </div>
          <div className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,247,232,0.52)' }}>
            day shift · {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* 中间统计 */}
      <div className="flex items-center gap-6">
        <Stat label="在岗" value={running} dot="#3aa8ff" />
        <Stat label="等回应" value={waiting} dot="#f59e0b" />
        <Stat label="报错" value={errored} dot="#ef4444" />
        <div className="w-px h-6" style={{ background: 'rgba(255,255,255,0.12)' }} />
        <Stat label="今日完成" value={todayDone} dot="#10b981" />
        <Stat label="今日花费" value={`$${todayCost.toFixed(2)}`} dot="#a78bfa" />
      </div>

      {/* 右侧操作 */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <button
          onClick={() => openArchive(true)}
          className="text-[12px] px-3 py-1.5 rounded-md transition-colors"
          style={{ color: 'rgba(255,247,232,0.68)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          📁 档案柜
        </button>
        <button
          onClick={() => openHire(true, 'manager')}
          className="flex items-center gap-1.5 text-[12px] font-medium text-white px-3.5 py-1.5 rounded-md transition-all hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, #ffd58a 0%, #f59e0b 100%)',
            boxShadow: '0 8px 22px -6px rgba(245,158,11,0.6)'
          }}
        >
          <span className="text-base leading-none">+</span> 主管
        </button>
        <button
          onClick={() => openHire(true, 'worker')}
          className="flex items-center gap-1.5 text-[12px] font-medium text-white px-3.5 py-1.5 rounded-md transition-all hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, #4db6ff 0%, #8b8ff6 100%)',
            boxShadow: '0 8px 22px -6px rgba(58,168,255,0.58)'
          }}
        >
          <span className="text-base leading-none">+</span> 员工
        </button>
      </div>
    </header>
  )
}

function Stat({
  label,
  value,
  dot
}: {
  label: string
  value: number | string
  dot: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="block rounded-full"
        style={{
          width: 6,
          height: 6,
          background: dot,
          boxShadow: `0 0 6px ${dot}`
        }}
      />
      <span className="text-[11px]" style={{ color: 'rgba(255,247,232,0.55)' }}>{label}</span>
      <span className="text-[13px] font-semibold font-mono tabular-nums" style={{ color: '#fff7e8' }}>
        {value}
      </span>
    </div>
  )
}
