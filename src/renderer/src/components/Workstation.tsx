import { useEffect, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Agent } from '@/types/agent'
import { isPmRole } from '@/types/agent'
import { useAgentStore } from '@/store/agentStore'

interface Props {
  agent: Agent
  onClick: (e: ReactMouseEvent) => void
  onOpenDetail?: () => void
  walkingOut?: boolean
  dimmed?: boolean
  highlighted?: boolean
}

const STATUS_LABEL: Record<string, string> = {
  working: '工作中',
  thinking: '思考中',
  idle: '摸鱼中',
  submitted: '待验收',
  done: '完成',
  error: '出错',
  waiting: '等你回应',
  lost: '失联',
  interrupted: '已中断',
  paused: '⏸ 等额度'
}

/**
 * v7 - 视角更俯视（桌面纵深加大），狗头做大放回屏幕下方
 * - ViewBox 240×240（高度+30 给纵深）
 * - 桌面 y=110-160（深度 50px，是之前的 2.5x）
 * - 狗头 y=50-118（54×64 大头）放在屏幕底部+桌面上方，部分挡屏幕底部
 * - 屏幕内容（foreignObject）只渲染上半部分避开狗头
 */
export function Workstation({
  agent,
  onClick,
  onOpenDetail,
  walkingOut,
  dimmed,
  highlighted
}: Props) {
  const finishWalkOut = useAgentStore((s) => s.finishWalkOut)
  const [entered, setEntered] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    requestAnimationFrame(() => setEntered(true))
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (walkingOut) {
      const t = setTimeout(() => finishWalkOut(agent.id), 1400)
      return () => clearTimeout(t)
    }
  }, [walkingOut, agent.id, finishWalkOut])

  const elapsed = formatElapsed(Date.now() - agent.startedAt)
  const statusColor = STATUS_COLOR[agent.status] ?? agent.accentColor
  const ax = agent.accentColor

  const headDy =
    agent.status === 'idle' ? 10 :
    agent.status === 'done' ? -6 :
    agent.status === 'waiting' ? -3 : 0
  const earUp = agent.status === 'waiting' || agent.status === 'done'
  const earDown = agent.status === 'idle' || agent.status === 'lost'

  const isError = agent.status === 'error'
  const isLost = agent.status === 'lost'
  const isManager = isPmRole(agent.role)
  const isHelping = !!agent.helpRequest

  // 狗的毛色调色板
  const fur = isManager
    ? {
        body: '#7d8590',        // 哈士奇灰
        highlight: '#a0a8b2',
        bodyShadow: '#5d656e',
        earOuter: '#4a5260',
        earInner: '#6a737e',
        noseShadow: '#3a414c'
      }
    : {
        body: '#c69a6a',        // 金毛色
        highlight: '#e0bd8e',
        bodyShadow: '#a47a4a',
        earOuter: '#7a5230',
        earInner: '#9a6e44',
        noseShadow: '#5a3a1c'
      }

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer select-none relative station-shell ${highlighted ? 'is-highlighted' : ''} ${isHelping ? 'is-helping' : ''} ${walkingOut ? 'walking-out' : ''}`}
      style={{
        opacity: entered && !walkingOut ? (dimmed ? 0.32 : 1) : 0,
        transform: walkingOut
          ? 'translateX(170%) translateY(26px) rotate(4deg) scale(0.78)'
          : entered
          ? `translateX(0) scale(${highlighted ? 1.02 : 1})`
          : 'translateX(-160%) scale(0.88)',
        transition: walkingOut
          ? 'transform 1.4s cubic-bezier(0.6, 0, 0.7, 0.3), opacity 1.4s ease-out, filter 1.4s ease-out'
          : 'transform 0.35s cubic-bezier(0.2, 0.7, 0.3, 1), opacity 0.35s ease-out, filter 0.35s ease-out',
        filter: isLost ? 'grayscale(1) brightness(0.85)' : dimmed ? 'saturate(0.4)' : undefined
      }}
    >
      <div
        className="relative transition-all duration-300 group-hover:-translate-y-0.5"
        style={{
          padding: '4px 4px 6px',
          borderRadius: 16,
          boxShadow: highlighted
            ? `0 0 0 2px ${agent.accentColor}aa, 0 8px 32px -8px ${agent.accentColor}66`
            : 'none',
          transition: 'box-shadow 0.3s ease'
        }}
      >
        {/* === 右上角按钮组（hover 显示）=== */}
        <div
          className="absolute z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5"
          style={{ top: 8, right: 8 }}
        >
          {agent.terminalApp && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.dog.focusTerminal({
                  agentId: agent.id,
                  terminalApp: agent.terminalApp,
                  terminalMarker: agent.terminalMarker,
                  terminalTty: agent.terminalTty
                })
              }}
              title={`打开 ${agent.terminalApp} 窗口`}
              className="transition-all hover:-translate-y-0.5"
              style={{
                padding: '5px 10px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.98)',
                border: '1px solid rgba(0,0,0,0.1)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                fontSize: 11,
                fontWeight: 500,
                color: '#3a3f4f',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: 13 }}>📟</span>
              <span>终端</span>
            </button>
          )}
          {onOpenDetail && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenDetail()
              }}
              title="查看详情、日志、统计"
              className="transition-all hover:-translate-y-0.5"
              style={{
                padding: '5px 10px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.98)',
                border: '1px solid rgba(0,0,0,0.1)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                fontSize: 11,
                fontWeight: 500,
                color: '#3a3f4f',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: 13 }}>ℹ️</span>
              <span>详情</span>
            </button>
          )}
        </div>

        {/* === 主工位 SVG === */}
        <svg
          viewBox="0 0 240 240"
          width="100%"
          style={{ display: 'block', overflow: 'visible', maxWidth: 215, margin: '0 auto' }}
          className={`workstation-svg ${isError ? 'animate-shake' : ''}`}
        >
          <defs>
            <linearGradient id={`desk-top-${agent.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fbf2dd" />
              <stop offset="0.52" stopColor="#d9b985" />
              <stop offset="1" stopColor="#8d6a42" />
            </linearGradient>
            <linearGradient id={`desk-edge-${agent.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6f5032" />
              <stop offset="1" stopColor="#3d2b21" />
            </linearGradient>
            <linearGradient id={`cabinet-${agent.id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#d8c1a0" />
              <stop offset="0.55" stopColor="#b99568" />
              <stop offset="1" stopColor="#755738" />
            </linearGradient>
            <linearGradient id={`backrest-${agent.id}`} x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0" stopColor="#fff5df" />
              <stop offset="0.52" stopColor="#e3d2b5" />
              <stop offset="1" stopColor="#948064" />
            </linearGradient>
            <linearGradient id={`seat-${agent.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={lighten(ax, 15)} />
              <stop offset="0.5" stopColor={ax} />
              <stop offset="1" stopColor={shade(ax, -22)} />
            </linearGradient>
            <linearGradient id={`screen-${agent.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={isError ? '#4f1111' : '#0b253d'} />
              <stop offset="0.48" stopColor={isError ? '#2b0707' : '#0b172a'} />
              <stop offset="1" stopColor={isError ? '#120203' : '#040811'} />
            </linearGradient>
            <linearGradient id={`screen-shine-${agent.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.32)" />
              <stop offset="0.42" stopColor="rgba(255,255,255,0.04)" />
              <stop offset="1" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <radialGradient id={`lamp-${agent.id}`} cx="44%" cy="24%" r="58%">
              <stop offset="0" stopColor="rgba(255,214,148,0.64)" />
              <stop offset="0.48" stopColor="rgba(255,175,85,0.18)" />
              <stop offset="1" stopColor="rgba(255,175,85,0)" />
            </radialGradient>
            <linearGradient id={`fur-body-${agent.id}`} x1="0" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor={fur.highlight} />
              <stop offset="0.42" stopColor={fur.body} />
              <stop offset="1" stopColor={fur.bodyShadow} />
            </linearGradient>
            <linearGradient id={`fur-ear-${agent.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={lighten(fur.earOuter, 8)} />
              <stop offset="1" stopColor={shade(fur.earOuter, -18)} />
            </linearGradient>
            <filter id={`soft-glow-${agent.id}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={`soft-shadow-${agent.id}`} x="-30%" y="-30%" width="160%" height="170%">
              <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000000" floodOpacity="0.24" />
            </filter>
          </defs>

          {/* === 0. 弥散柔和阴影 === */}
          <ellipse
            cx="120"
            cy="220"
            rx="110"
            ry="9"
            fill="rgba(0,0,0,0.32)"
            style={{ filter: 'blur(10px)' }}
          />

          {/* === 暖台灯光锥 === */}
          <g className="desk-lamp-glow" opacity={isLost ? 0.25 : 1}>
            <ellipse cx="118" cy="108" rx="98" ry="74" fill={`url(#lamp-${agent.id})`} />
            <path
              d="M 204 26 L 196 30 L 172 111 L 207 111 Z"
              fill="rgba(255,214,148,0.18)"
            />
            <path d="M 190 29 Q 202 20 214 30 L 208 41 Q 197 36 186 41 Z" fill="#f0b768" />
            <circle cx="200" cy="38" r="4" fill="#ffe2a8" filter={`url(#soft-glow-${agent.id})`} />
          </g>

          {/* === 1. 显示器（最远）=== */}
          <g filter={`url(#soft-shadow-${agent.id})`}>
            <rect
              x="55"
              y="3"
              width="130"
              height="82"
              rx="7"
              fill={isError ? 'rgba(239,68,68,0.24)' : 'rgba(58,168,255,0.2)'}
              opacity={walkingOut ? 0.12 : 1}
              filter={`url(#soft-glow-${agent.id})`}
            />
            <rect
              x="60"
              y="8"
              width="120"
              height="72"
              rx="6"
              fill="#111724"
              stroke="rgba(185,207,232,0.34)"
              strokeWidth="0.8"
            />
            <rect
              x="65"
              y="13"
              width="110"
              height="62"
              rx="3"
              fill={walkingOut ? '#06080c' : `url(#screen-${agent.id})`}
              style={{ animation: isError ? 'screen-pulse 0.7s ease-in-out infinite' : undefined }}
            />
            <path d="M 67 15 L 112 15 L 72 73 L 67 73 Z" fill={`url(#screen-shine-${agent.id})`} opacity={walkingOut ? 0.05 : 0.35} />
            {!walkingOut && (
              <rect className="screen-scan" x="65" y="14" width="110" height="9" fill="rgba(147,211,255,0.14)" />
            )}
            <circle cx="120" cy="11" r="0.8" fill="#8fa5bc" />
            {/* 支架颈 */}
            <rect x="115" y="80" width="10" height="14" fill="#151923" />
            {/* 底盘（坐在桌面 y=110 上） */}
            <ellipse cx="120" cy="108" rx="23" ry="3.6" fill="#151923" />
          </g>

          {/* 屏幕内容：只渲染上半部分，给狗头让位 */}
          <foreignObject x="67" y="15" width="106" height="32">
            <div
              {...({ xmlns: "http://www.w3.org/1999/xhtml" } as any)}
              style={{
                width: '100%',
                height: '100%',
                fontFamily: 'JetBrains Mono, SF Mono, Menlo, monospace',
                fontSize: 7,
                lineHeight: 1.3,
                color: isError ? '#fca5a5' : '#9fd4ff',
                textShadow: isError
                  ? '0 0 3px rgba(239,68,68,0.6)'
                  : '0 0 3px rgba(58,168,255,0.6)',
                padding: '2px 4px',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  opacity: walkingOut ? 0.08 : 0.22,
                  backgroundImage:
                    'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px)'
                }}
              />
              <div style={{ marginBottom: 1, opacity: 0.6, fontSize: 6 }}>
                <span style={{ color: '#6b8aa8' }}>{agent.tool}@dog</span>
              </div>
              <div
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word'
                }}
              >
                <span style={{ color: '#6b8aa8' }}>&gt; </span>
                {walkingOut ? '收工下班…' : agent.currentAction || '等待开始…'}
              </div>
            </div>
          </foreignObject>

          {/* === 2. 桌面（更俯视，纵深 50px）=== */}
          <g>
            <path
              d="M 22 110 L 196 110 L 208 160 L 10 160 Z"
              fill={`url(#desk-top-${agent.id})`}
            />
            <path d="M 28 118 C 64 112, 88 116, 120 113 S 174 112, 196 119" stroke="rgba(90,54,27,0.16)" strokeWidth="1.1" fill="none" />
            <path d="M 18 142 C 58 136, 86 140, 124 136 S 178 137, 204 144" stroke="rgba(255,244,218,0.24)" strokeWidth="0.8" fill="none" />
            {/* 前缘厚度 */}
            <path d="M 10 160 L 208 160 L 208 164 L 10 164 Z" fill={`url(#desk-edge-${agent.id})`} />
            {/* 顶面高光 */}
            <path d="M 28 112 L 196 112" stroke="rgba(255,255,255,0.85)" strokeWidth="0.5" />
          </g>

          {/* 桌面小物件 */}
          <g opacity={walkingOut ? 0.4 : 1}>
            <ellipse cx="43" cy="134" rx="11" ry="4" fill="rgba(0,0,0,0.18)" />
            <path d="M 34 122 L 50 122 L 48 137 Q 42 141 36 137 Z" fill="#5b7767" />
            <ellipse cx="42" cy="122" rx="8" ry="2.7" fill="#86a58d" />
            <path d="M 38 120 Q 31 111 34 104 Q 44 109 41 120" fill="#5da070" />
            <path d="M 45 120 Q 55 111 54 103 Q 44 107 45 120" fill="#79bd82" />
            <rect x="184" y="126" width="11" height="18" rx="2.5" fill="#d6e4ff" opacity="0.88" />
            <path d="M 187 130 L 193 130 M 187 134 L 192 134 M 187 138 L 193 138" stroke="#6d89ad" strokeWidth="0.7" />
          </g>

          {/* === 3. 内嵌文件柜（桌下右侧）=== */}
          <g>
            <rect x="156" y="164" width="50" height="48" fill={`url(#cabinet-${agent.id})`} stroke="rgba(255,241,214,0.22)" strokeWidth="0.4" />
            <path d="M 206 164 L 210 168 L 210 212 L 206 208 Z" fill="#5e432d" />
            <line x1="156" y1="180" x2="206" y2="180" stroke="rgba(65,43,26,0.45)" strokeWidth="0.5" />
            <line x1="156" y1="196" x2="206" y2="196" stroke="rgba(65,43,26,0.45)" strokeWidth="0.5" />
            <rect x="173" y="172" width="14" height="1" rx="0.5" fill="#f6d49a" opacity="0.75" />
            <rect x="173" y="188" width="14" height="1" rx="0.5" fill="#f6d49a" opacity="0.75" />
            <rect x="173" y="204" width="14" height="1" rx="0.5" fill="#f6d49a" opacity="0.75" />
          </g>

          {/* === 4. 桌腿（左侧露空）=== */}
          <rect x="13" y="164" width="3" height="48" fill="#725137" />
          <rect x="13" y="164" width="3" height="1.5" fill="#f2cf94" opacity="0.75" />
          <rect x="24" y="160" width="2.2" height="42" fill="#5d432f" opacity="0.85" />
          {/* 前右（柜旁）*/}
          <rect x="200" y="164" width="3" height="48" fill="#5d432f" />

          {/* === 5. 键盘（桌面上、显示器底盘前）=== */}
          <g>
            <rect x="68" y="118" width="108" height="6" rx="1.5" fill="#2a3040" />
            <rect x="70" y="119.5" width="104" height="3" rx="0.5" fill="#536173" />
            {Array.from({ length: 18 }).map((_, i) => (
              <rect
                key={i}
                x={72 + i * 5.4}
                y={120.2}
                width="3.2"
                height="1.2"
                rx="0.3"
                fill={agent.status === 'working' && i % 5 === 0 ? ax : '#151923'}
                opacity={agent.status === 'working' && i % 5 === 0 ? 0.9 : 1}
              />
            ))}
          </g>

          {/* === 6. 椅子立柱 + 五星脚（桌前下方）=== */}
          <rect x="117" y="204" width="6" height="16" fill="#8a8e99" />
          <g stroke="#8a8e99" strokeWidth="2.2" strokeLinecap="round" fill="none">
            <line x1="120" y1="220" x2="92" y2="232" />
            <line x1="120" y1="220" x2="148" y2="232" />
            <line x1="120" y1="220" x2="120" y2="234" />
            <line x1="120" y1="220" x2="104" y2="228" />
            <line x1="120" y1="220" x2="136" y2="228" />
          </g>
          <ellipse cx="92" cy="233" rx="3" ry="1.6" fill="#6a7080" />
          <ellipse cx="148" cy="233" rx="3" ry="1.6" fill="#6a7080" />
          <ellipse cx="120" cy="235" rx="3" ry="1.6" fill="#6a7080" />

          {/* === 7. 狗背影：完整身形（从背后看，下半身会被椅背挡住）=== */}
          <g
            style={{
              transform: `translateY(${headDy}px)`,
              transformOrigin: '120px 130px',
              transition: 'transform 0.5s cubic-bezier(0.2, 0.7, 0.3, 1)',
              animation:
                agent.status === 'working' ? 'paws-type 0.45s ease-in-out infinite' :
                agent.status === 'thinking' ? 'head-tilt 3s ease-in-out infinite' :
                agent.status === 'idle' ? 'snore 3.6s ease-in-out infinite' :
                agent.status === 'done' ? 'cheer 0.9s ease-in-out infinite' :
                'breathe 3.6s ease-in-out infinite'
            }}
          >
            {/* 脖子 + 肩膀（从头底延伸到椅背彩色带后面）*/}
            <path
              d="M 96 110
                 Q 86 138 80 175
                 L 160 175
                 Q 154 138 144 110 Z"
              fill={`url(#fur-body-${agent.id})`}
            />
            {/* 肩膀两侧高光（暗一层，制造立体）*/}
            <path
              d="M 86 140 Q 84 158 82 175 L 96 175 Q 94 158 92 140 Z"
              fill={fur.bodyShadow}
              opacity="0.45"
            />
            <path
              d="M 154 140 Q 156 158 158 175 L 144 175 Q 146 158 148 140 Z"
              fill={fur.bodyShadow}
              opacity="0.45"
            />

            {/* 大圆头（y=46-118, x=88-152, 64w x 72h）*/}
            <path
              d="M 88 118
                 Q 88 46 120 46
                 Q 152 46 152 118 Z"
              fill={`url(#fur-body-${agent.id})`}
            />
            {/* 顶部高光 */}
            <ellipse cx="120" cy="58" rx="18" ry="5.5" fill="#fff4cf" opacity={isManager ? 0.28 : 0.35} />
            <path d="M 103 70 Q 120 58 138 70" stroke="rgba(255,255,255,0.22)" strokeWidth="1" fill="none" />
            {/* 脖子下巴阴影（头与脖子衔接处的暗影） */}
            <ellipse cx="120" cy="118" rx="28" ry="3" fill={fur.noseShadow} opacity="0.45" />

            {/* 左耳（垂耳） */}
            <g
              style={{
                transformOrigin: '94px 60px',
                transform: earUp
                  ? 'rotate(-22deg) translateY(-4px)'
                  : earDown
                  ? 'rotate(28deg) translateY(6px)'
                  : 'rotate(-7deg)',
                transition: 'transform 0.5s cubic-bezier(0.2, 0.7, 0.3, 1)'
              }}
            >
              <path
                d="M 92 56
                   Q 74 58 72 86
                   Q 74 100 90 100
                   Q 98 84 96 56 Z"
                fill={`url(#fur-ear-${agent.id})`}
              />
              <path
                d="M 90 64
                   Q 78 66 78 86
                   Q 80 94 88 94
                   Q 94 82 90 64 Z"
                fill={fur.earInner}
                opacity="0.85"
              />
            </g>

            {/* 右耳 */}
            <g
              style={{
                transformOrigin: '146px 60px',
                transform: earUp
                  ? 'rotate(22deg) translateY(-4px)'
                  : earDown
                  ? 'rotate(-28deg) translateY(6px)'
                  : 'rotate(7deg)',
                transition: 'transform 0.5s cubic-bezier(0.2, 0.7, 0.3, 1)'
              }}
            >
              <path
                d="M 148 56
                   Q 166 58 168 86
                   Q 166 100 150 100
                   Q 142 84 144 56 Z"
                fill={`url(#fur-ear-${agent.id})`}
              />
              <path
                d="M 150 64
                   Q 162 66 162 86
                   Q 160 94 152 94
                   Q 146 82 150 64 Z"
                fill={fur.earInner}
                opacity="0.85"
              />
            </g>
          </g>

          {/* === 8. 椅背（最近、挡住狗下半身）=== */}
          <g>
            <path
              d="M 76 152
                 Q 76 134, 100 132
                 L 140 132
                 Q 164 134, 164 152
                 L 164 198
                 Q 164 204, 158 204
                 L 82 204
                 Q 76 204, 76 198
                 Z"
              fill={`url(#backrest-${agent.id})`}
              stroke="rgba(255,241,214,0.26)"
              strokeWidth="0.7"
            />
            <path d="M 82 158 Q 119 145 158 158" stroke="rgba(255,255,255,0.24)" strokeWidth="0.7" fill="none" />
            <line x1="120" y1="136" x2="120" y2="200" stroke="#8b775e" strokeWidth="0.4" opacity="0.5" />
          </g>

          {/* === 9. 椅背彩色横带（在椅背最上层）=== */}
          <g>
            <rect x="78" y="156" width="84" height="20" rx="3" fill={`url(#seat-${agent.id})`} />
            <rect x="80" y="157.5" width="80" height="2.5" rx="1.2" fill="#fff" opacity="0.35" />
            <rect x="78" y="156" width="4" height="20" rx="1" fill={shade(ax, -20)} opacity="0.7" />
            <rect x="158" y="156" width="4" height="20" rx="1" fill={shade(ax, -20)} opacity="0.7" />
          </g>

          {/* === 主管帽子徽章 === */}
          {isManager && (
            <g>
              {/* 帽顶 */}
              <ellipse cx="120" cy="36" rx="22" ry="4" fill="#22252f" />
              <path
                d="M 102 36 L 105 22 Q 105 20 108 20 L 132 20 Q 135 20 135 22 L 138 36 Z"
                fill="#1a1d28"
              />
              {/* 金色帽带 */}
              <rect x="103" y="32" width="34" height="3" fill="#f5b942" />
              {/* 高光 */}
              <ellipse cx="115" cy="24" rx="6" ry="1.5" fill="#fff" opacity="0.25" />
            </g>
          )}

          {/* === 10. 状态气泡 === */}
          {agent.status === 'idle' && (
            <g>
              <text
                x="172"
                y="48"
                fontSize="12"
                fontWeight="700"
                fill="#7a8090"
                style={{ animation: 'zz-float 3s ease-out infinite' }}
              >z</text>
              <text
                x="182"
                y="38"
                fontSize="10"
                fontWeight="700"
                fill="#9aa0a8"
                style={{ animation: 'zz-float 3s ease-out infinite', animationDelay: '1.5s' }}
              >z</text>
            </g>
          )}

          {agent.status === 'waiting' && (
            <g style={{ animation: 'breathe 1.4s ease-in-out infinite' }}>
              <circle cx="178" cy="42" r="11" fill="#fbbf24" />
              <text
                x="178"
                y="47"
                fontSize="14"
                fontWeight="900"
                fill="#1a1410"
                textAnchor="middle"
              >!</text>
            </g>
          )}

          {agent.status === 'done' && (
            <g>
              <text
                x="48"
                y="46"
                fontSize="14"
                fill="#f59e0b"
                style={{ animation: 'cheer 0.8s ease-in-out infinite' }}
              >✨</text>
              <text
                x="178"
                y="44"
                fontSize="13"
                fill="#10b981"
                style={{ animation: 'cheer 0.8s ease-in-out infinite', animationDelay: '0.2s' }}
              >✓</text>
            </g>
          )}

          {agent.status === 'error' && (
            <g style={{ animation: 'breathe 1s ease-in-out infinite' }}>
              <circle cx="178" cy="42" r="11" fill="#ef4444" />
              <text
                x="178"
                y="47"
                fontSize="14"
                fontWeight="900"
                fill="#fff"
                textAnchor="middle"
              >!</text>
            </g>
          )}

          {/* === PM 求助信号：举手 + 金色感叹气泡（不放大狗，靠信号收拢注意力）=== */}
          {isHelping && (
            <g>
              {/* 举起的右前爪（绕肩膀根部挥动）*/}
              <g
                style={{
                  transformOrigin: '150px 150px',
                  animation: 'paw-wave 0.9s ease-in-out infinite'
                }}
              >
                <path
                  d="M 148 152 Q 158 130 166 106"
                  stroke={`url(#fur-body-${agent.id})`}
                  strokeWidth="11"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx="167" cy="103" r="8" fill={fur.highlight} stroke={fur.bodyShadow} strokeWidth="0.6" />
                {/* 小肉垫 */}
                <circle cx="167" cy="104" r="3" fill={fur.earOuter} opacity="0.55" />
              </g>
              {/* 金色求助气泡 */}
              <g style={{ animation: 'breathe 1.2s ease-in-out infinite' }}>
                <circle cx="186" cy="34" r="13" fill="#f5b942" stroke="#fff" strokeWidth="1.2" />
                <text
                  x="186"
                  y="40"
                  fontSize="16"
                  fontWeight="900"
                  fill="#1a1410"
                  textAnchor="middle"
                >!</text>
              </g>
            </g>
          )}

          {/* === 进度条（桌沿前缘）=== */}
          <rect x="14" y="161.5" width="192" height="1.4" rx="0.7" fill="rgba(0,0,0,0.18)" />
          <rect
            x="14"
            y="161.5"
            width={Math.max(2, 192 * agent.progress)}
            height="1.4"
            rx="0.7"
            fill={ax}
            style={{
              filter: `drop-shadow(0 0 3px ${ax}aa)`,
              transition: 'width 0.5s ease-out'
            }}
          />
        </svg>

        {/* 名牌 */}
        <div className="flex items-center justify-between gap-2 mt-1.5 px-1">
          <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
            <span
              className="block rounded-full flex-shrink-0"
              style={{
                width: 6,
                height: 6,
                background: statusColor,
                boxShadow: `0 0 6px ${statusColor}`
              }}
            />
            <span
              className="font-semibold text-[12px] tracking-wide flex-shrink-0"
              style={{ color: ax }}
            >
              {agent.dogName}
            </span>
            <span className="text-[10.5px] truncate" style={{ color: '#5a606e' }}>
              {agent.taskLabel}
            </span>
          </div>
          <div className="text-[9.5px] font-mono tabular-nums flex-shrink-0" style={{ color: '#8a8e99' }}>
            {elapsed}
          </div>
        </div>
        <div className="flex items-center justify-between px-1 mt-0.5">
          <span className="text-[9px] font-mono uppercase tracking-widest flex items-center gap-1.5" style={{ color: '#8a8e99' }}>
            {isManager && (
              <span
                className="px-1 py-px rounded text-[8.5px] font-semibold tracking-normal"
                style={{ background: '#f5b9421f', color: '#a06f0a' }}
              >
                MANAGER
              </span>
            )}
            {agent.tool}
          </span>
          {isHelping ? (
            <span
              className="text-[9px] font-semibold px-1.5 py-px rounded-full flex items-center gap-1"
              style={{ background: '#f5b942', color: '#1a1410', animation: 'breathe 1.2s ease-in-out infinite' }}
            >
              🙋 求助老板
            </span>
          ) : (
            <span className="text-[9px]" style={{ color: statusColor }}>
              {STATUS_LABEL[agent.status] ?? agent.status}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

const STATUS_COLOR: Record<string, string> = {
  working: '#3aa8ff',
  thinking: '#a78bfa',
  idle: '#9aa0a8',
  submitted: '#14b8a6',
  done: '#10b981',
  error: '#ef4444',
  waiting: '#f59e0b',
  lost: '#9aa0a8',
  interrupted: '#f97316',
  paused: '#eab308'
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

function lighten(hex: string, percent: number) {
  return shade(hex, percent)
}
