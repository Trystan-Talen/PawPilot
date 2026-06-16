import { useEffect, useState } from 'react'
import type { Agent } from '@/types/agent'
import { DogCharacter } from './DogCharacter'
import { useAgentStore } from '@/store/agentStore'

interface Props {
  agent: Agent
  onClick: () => void
  walkingOut?: boolean
}

const STATUS_LABEL: Record<string, string> = {
  working: '工作中',
  thinking: '思考中',
  idle: '摸鱼中',
  done: '完成',
  error: '出错',
  waiting: '等你回应',
  lost: '失联',
  interrupted: '已中断'
}

export function WorkstationCard({ agent, onClick, walkingOut }: Props) {
  const finishWalkOut = useAgentStore((s) => s.finishWalkOut)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setEntered(true))
  }, [])

  useEffect(() => {
    if (walkingOut) {
      const t = setTimeout(() => finishWalkOut(agent.id), 1400)
      return () => clearTimeout(t)
    }
  }, [walkingOut, agent.id, finishWalkOut])

  const elapsed = formatElapsed(Date.now() - agent.startedAt)
  const statusColor =
    agent.status === 'error'
      ? '#ef4444'
      : agent.status === 'waiting'
      ? '#fbbf24'
      : agent.status === 'done'
      ? '#34d399'
      : agent.status === 'idle' || agent.status === 'lost' || agent.status === 'interrupted'
      ? '#6b7388'
      : agent.accentColor

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer select-none"
      style={{
        opacity: entered && !walkingOut ? 1 : 0,
        transform: walkingOut
          ? 'translateX(220%) scale(0.85)'
          : entered
          ? 'translateX(0) scale(1)'
          : 'translateX(-160%) scale(0.85)',
        transition: walkingOut
          ? 'transform 1.4s cubic-bezier(0.6, 0, 0.7, 0.3), opacity 1.4s ease-out'
          : 'transform 1.2s cubic-bezier(0.2, 0.7, 0.3, 1), opacity 0.6s ease-out'
      }}
    >
      {/* 卡片主体 */}
      <div
        className="relative rounded-2xl bg-floor-700 shadow-card transition-all duration-300 group-hover:shadow-card-hover group-hover:-translate-y-0.5"
        style={{
          padding: '14px 14px 16px',
          minHeight: 280
        }}
      >
        {/* 台灯发光 */}
        <div
          className="pointer-events-none absolute -top-3 -right-3 rounded-full animate-lamp-flicker"
          style={{
            width: 70,
            height: 70,
            background:
              'radial-gradient(circle, rgba(255,184,107,0.45) 0%, rgba(255,138,61,0.18) 40%, transparent 70%)',
            filter: 'blur(2px)'
          }}
        />

        {/* 状态徽章 */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
          <span
            className="block rounded-full"
            style={{
              width: 8,
              height: 8,
              background: statusColor,
              boxShadow: `0 0 8px ${statusColor}`
            }}
          />
          <span className="text-[11px] text-ink-500 font-medium">
            {STATUS_LABEL[agent.status] ?? agent.status}
          </span>
        </div>

        {/* 工具徽标 */}
        <div className="absolute top-3 right-3 text-[10px] text-ink-500 px-1.5 py-0.5 rounded bg-floor-600/80 font-mono uppercase tracking-wider">
          {agent.tool}
        </div>

        {/* 显示器屏幕 */}
        <div className="mt-7 relative">
          <div
            className="relative rounded-md overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #0d1c2e 0%, #0a1422 100%)',
              border: '1px solid rgba(58,168,255,0.25)',
              boxShadow:
                agent.status === 'error'
                  ? '0 0 24px 2px rgba(239,68,68,0.45)'
                  : '0 0 18px 1px rgba(58,168,255,0.3)',
              padding: '10px 10px',
              minHeight: 56
            }}
          >
            {/* 扫描线 */}
            <div
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 3px)'
              }}
            />
            <div
              className="text-[12px] font-mono leading-snug"
              style={{
                color: agent.status === 'error' ? '#fca5a5' : '#9fd4ff',
                textShadow:
                  agent.status === 'error'
                    ? '0 0 6px rgba(239,68,68,0.6)'
                    : '0 0 6px rgba(58,168,255,0.5)',
                animation:
                  agent.status === 'error' ? 'screen-pulse 0.8s ease-in-out infinite' : 'none'
              }}
            >
              <span className="text-ink-500">&gt;</span>{' '}
              <span className="line-clamp-2">
                {agent.currentAction || '等待开始…'}
              </span>
            </div>
          </div>

          {/* 显示器底座阴影 */}
          <div
            className="mx-auto"
            style={{
              width: '40%',
              height: 4,
              background:
                'radial-gradient(ellipse at center, rgba(58,168,255,0.15) 0%, transparent 70%)',
              marginTop: 2
            }}
          />
        </div>

        {/* 狗 */}
        <div className="flex justify-center mt-1 mb-2 relative">
          <DogCharacter
            status={agent.status}
            accentColor={agent.accentColor}
            size={120}
          />
        </div>

        {/* 进度条 */}
        <div className="mt-2 mb-2">
          <div className="h-1.5 rounded-full bg-floor-600 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(2, Math.round(agent.progress * 100))}%`,
                background: `linear-gradient(90deg, ${agent.accentColor} 0%, ${shade(
                  agent.accentColor,
                  -20
                )} 100%)`,
                boxShadow: `0 0 8px ${agent.accentColor}66`
              }}
            />
          </div>
        </div>

        {/* 名字 + 任务 + 时间 */}
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span
                className="font-semibold text-ink-900 text-sm tracking-wide"
                style={{ color: agent.accentColor }}
              >
                {agent.dogName}
              </span>
              <span className="text-[11px] text-ink-700 truncate">
                {agent.taskLabel}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-ink-500 font-mono">{elapsed}</div>
        </div>
      </div>
    </div>
  )
}

function formatElapsed(ms: number) {
  if (ms < 0) ms = 0
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function shade(hex: string, percent: number) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, Math.min(255, (num >> 16) + Math.round(255 * (percent / 100))))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * (percent / 100))))
  const b = Math.max(0, Math.min(255, (num & 0xff) + Math.round(255 * (percent / 100))))
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
}
