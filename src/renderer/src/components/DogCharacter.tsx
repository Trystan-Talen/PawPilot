import { CSSProperties } from 'react'
import type { AgentStatus } from '@/types/agent'

interface Props {
  status: AgentStatus
  accentColor: string
  size?: number
  furColor?: string
}

/**
 * 一只表情丰富的扁平 SVG 狗。
 * 6 种状态：working / thinking / idle / done / error / waiting (+ lost)
 */
export function DogCharacter({
  status,
  accentColor,
  size = 140,
  furColor = '#d9a679'
}: Props) {
  const furDark = shade(furColor, -18)
  const furLight = shade(furColor, 12)
  const isSleeping = status === 'idle'
  const isCheering = status === 'done'
  const isShaking = status === 'error'
  const isLost = status === 'lost'

  const dogStyle: CSSProperties = isLost
    ? { filter: 'grayscale(1) brightness(0.55)' }
    : {}

  return (
    <div
      className="relative inline-block"
      style={{ width: size, height: size, ...dogStyle }}
    >
      {/* ZZ 气泡 (idle) */}
      {isSleeping && (
        <>
          <span
            className="absolute font-bold text-ink-700 select-none animate-zz-float"
            style={{ left: '62%', top: '18%', fontSize: 14, animationDelay: '0s' }}
          >
            z
          </span>
          <span
            className="absolute font-bold text-ink-500 select-none animate-zz-float"
            style={{ left: '68%', top: '22%', fontSize: 11, animationDelay: '1.4s' }}
          >
            z
          </span>
        </>
      )}

      {/* 完成时的彩带 */}
      {isCheering && (
        <>
          <span
            className="absolute select-none"
            style={{
              left: '20%',
              top: '8%',
              fontSize: 14,
              animation: 'cheer 0.8s ease-in-out infinite',
              animationDelay: '0.1s'
            }}
          >
            ✨
          </span>
          <span
            className="absolute select-none"
            style={{
              right: '18%',
              top: '6%',
              fontSize: 12,
              animation: 'cheer 0.8s ease-in-out infinite',
              animationDelay: '0.3s'
            }}
          >
            🎉
          </span>
        </>
      )}

      {/* 等待时的感叹号气泡 */}
      {status === 'waiting' && (
        <div
          className="absolute"
          style={{
            right: '6%',
            top: '4%',
            width: 26,
            height: 26,
            borderRadius: 13,
            background: '#fbbf24',
            color: '#1a1410',
            fontWeight: 900,
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(251,191,36,0.6)',
            animation: 'breathe 1.6s ease-in-out infinite'
          }}
        >
          !
        </div>
      )}

      <svg
        viewBox="0 0 140 140"
        width={size}
        height={size}
        className={isShaking ? 'animate-shake' : isCheering ? 'animate-cheer' : 'animate-breathe'}
      >
        <defs>
          <radialGradient id={`face-grad-${accentColor.slice(1)}`} cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor={furLight} />
            <stop offset="100%" stopColor={furColor} />
          </radialGradient>
        </defs>

        {/* 身体/胸口 */}
        <ellipse cx="70" cy="118" rx="38" ry="22" fill={furDark} />

        {/* 左耳（垂耳） */}
        <g
          style={{
            transformOrigin: '46px 36px',
            transform: status === 'waiting' ? 'rotate(-30deg)' : 'rotate(-8deg)',
            transition: 'transform 0.4s cubic-bezier(0.2, 0.7, 0.3, 1)'
          }}
        >
          <path
            d="M 38 30 Q 28 32 26 50 Q 26 64 38 66 Q 46 64 48 50 Q 48 36 38 30 Z"
            fill={furDark}
          />
          <path
            d="M 38 36 Q 32 38 31 50 Q 31 60 38 61 Q 44 60 45 50 Q 45 40 38 36 Z"
            fill={shade(furDark, -10)}
            opacity="0.5"
          />
        </g>

        {/* 右耳 */}
        <g
          style={{
            transformOrigin: '94px 36px',
            transform: status === 'waiting' ? 'rotate(30deg)' : 'rotate(8deg)',
            transition: 'transform 0.4s cubic-bezier(0.2, 0.7, 0.3, 1)'
          }}
        >
          <path
            d="M 102 30 Q 112 32 114 50 Q 114 64 102 66 Q 94 64 92 50 Q 92 36 102 30 Z"
            fill={furDark}
          />
          <path
            d="M 102 36 Q 108 38 109 50 Q 109 60 102 61 Q 96 60 95 50 Q 95 40 102 36 Z"
            fill={shade(furDark, -10)}
            opacity="0.5"
          />
        </g>

        {/* 头 */}
        <g
          style={{
            transformOrigin: '70px 60px',
            animation: status === 'thinking' ? 'head-tilt 2.8s ease-in-out infinite' : 'none'
          }}
        >
          <ellipse
            cx="70"
            cy="60"
            rx="34"
            ry="32"
            fill={`url(#face-grad-${accentColor.slice(1)})`}
          />

          {/* 脸颊腮红 */}
          <ellipse cx="46" cy="68" rx="6" ry="4" fill="#ff8da1" opacity="0.35" />
          <ellipse cx="94" cy="68" rx="6" ry="4" fill="#ff8da1" opacity="0.35" />

          {/* 嘴部口鼻凸起 */}
          <ellipse cx="70" cy="72" rx="14" ry="10" fill={furLight} />

          {/* 眼睛 */}
          {renderEyes(status)}

          {/* 鼻子 */}
          <ellipse cx="70" cy="68" rx="4.2" ry="3.2" fill="#1d1410" />
          <ellipse cx="68.6" cy="66.8" rx="1.4" ry="1" fill="#fff" opacity="0.7" />

          {/* 嘴 */}
          {renderMouth(status)}
        </g>

        {/* 项圈 */}
        <g>
          <rect x="46" y="98" width="48" height="7" rx="3.5" fill={accentColor} />
          <circle cx="70" cy="108" r="3.5" fill="#fff8e0" stroke={accentColor} strokeWidth="1" />
        </g>

        {/* 爪子（敲键盘） */}
        <g
          style={{
            animation:
              status === 'working' ? 'paws-type 0.28s steps(2) infinite' : 'none',
            transformOrigin: '70px 130px'
          }}
        >
          <ellipse
            cx="46"
            cy="128"
            rx="9"
            ry="6"
            fill={furDark}
            style={{
              transformOrigin: '46px 128px',
              transform: isCheering ? 'translateY(-16px) rotate(-30deg)' : 'rotate(-6deg)',
              transition: 'transform 0.4s cubic-bezier(0.2, 0.7, 0.3, 1)'
            }}
          />
          <ellipse
            cx="94"
            cy="128"
            rx="9"
            ry="6"
            fill={furDark}
            style={{
              transformOrigin: '94px 128px',
              transform: isCheering ? 'translateY(-16px) rotate(30deg)' : 'rotate(6deg)',
              transition: 'transform 0.4s cubic-bezier(0.2, 0.7, 0.3, 1)'
            }}
          />
        </g>
      </svg>
    </div>
  )
}

function renderEyes(status: AgentStatus) {
  if (status === 'idle') {
    // 闭眼弧线
    return (
      <>
        <path
          d="M 50 58 Q 56 62 62 58"
          stroke="#1d1410"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 78 58 Q 84 62 90 58"
          stroke="#1d1410"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
      </>
    )
  }
  if (status === 'done') {
    return (
      <>
        <path d="M 50 58 Q 56 52 62 58" stroke="#1d1410" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d="M 78 58 Q 84 52 90 58" stroke="#1d1410" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      </>
    )
  }
  if (status === 'error') {
    return (
      <>
        <path d="M 50 54 L 60 62 M 60 54 L 50 62" stroke="#1d1410" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M 78 54 L 88 62 M 88 54 L 78 62" stroke="#1d1410" strokeWidth="2.4" strokeLinecap="round" />
      </>
    )
  }
  if (status === 'thinking') {
    return (
      <>
        <circle cx="58" cy="58" r="3.6" fill="#1d1410" />
        <circle cx="59.5" cy="56.8" r="1.1" fill="#fff" />
        <circle cx="82" cy="58" r="3.6" fill="#1d1410" />
        <circle cx="83.5" cy="56.8" r="1.1" fill="#fff" />
      </>
    )
  }
  if (status === 'waiting') {
    // 大眼睛、专注
    return (
      <>
        <ellipse cx="56" cy="58" rx="4.4" ry="4.6" fill="#1d1410" />
        <circle cx="57.8" cy="56.4" r="1.5" fill="#fff" />
        <ellipse cx="84" cy="58" rx="4.4" ry="4.6" fill="#1d1410" />
        <circle cx="85.8" cy="56.4" r="1.5" fill="#fff" />
      </>
    )
  }
  // working / default
  return (
    <>
      <ellipse cx="56" cy="59" rx="3.4" ry="4.2" fill="#1d1410" />
      <circle cx="57.4" cy="57.6" r="1.2" fill="#fff" />
      <ellipse cx="84" cy="59" rx="3.4" ry="4.2" fill="#1d1410" />
      <circle cx="85.4" cy="57.6" r="1.2" fill="#fff" />
    </>
  )
}

function renderMouth(status: AgentStatus) {
  if (status === 'done') {
    // 张嘴笑 + 舌头
    return (
      <>
        <path
          d="M 62 78 Q 70 86 78 78"
          stroke="#1d1410"
          strokeWidth="1.8"
          fill="#3a1a1a"
          strokeLinecap="round"
        />
        <path d="M 66 81 Q 70 86 74 81 Q 72 85 70 85 Q 68 85 66 81 Z" fill="#ff7b9b" />
      </>
    )
  }
  if (status === 'error') {
    return (
      <path
        d="M 62 80 Q 70 76 78 80"
        stroke="#1d1410"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    )
  }
  if (status === 'idle') {
    return (
      <path
        d="M 64 78 Q 70 76 76 78"
        stroke="#1d1410"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    )
  }
  if (status === 'waiting') {
    return (
      <path
        d="M 64 78 L 76 78"
        stroke="#1d1410"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    )
  }
  return (
    <path
      d="M 62 78 Q 66 82 70 78 Q 74 82 78 78"
      stroke="#1d1410"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  )
}

function shade(hex: string, percent: number) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, Math.min(255, (num >> 16) + Math.round(255 * (percent / 100))))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * (percent / 100))))
  const b = Math.max(0, Math.min(255, (num & 0xff) + Math.round(255 * (percent / 100))))
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
}
