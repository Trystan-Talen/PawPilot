import { useMemo } from 'react'

/** 深夜办公室漂浮的粉尘光斑 */
export function DustParticles({ count = 9 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: seeded(i, 17) * 100,
        bottom: seeded(i, 41) * 24 - 12,
        size: 1 + seeded(i, 73) * 2.4,
        delay: seeded(i, 29) * 24,
        dur: 18 + seeded(i, 53) * 16,
        hue: seeded(i, 89) > 0.5 ? '255,184,107' : '170,210,255',
        alpha: 0.18 + seeded(i, 107) * 0.18,
        key: i
      })),
    [count]
  )

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.key}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            bottom: `${p.bottom}%`,
            width: p.size,
            height: p.size,
            background: `rgba(${p.hue}, ${p.alpha})`,
            boxShadow: `0 0 5px rgba(${p.hue}, ${p.alpha})`,
            animation: `dust ${p.dur}s ${p.delay}s linear infinite`
          }}
        />
      ))}
    </div>
  )
}

function seeded(i: number, salt: number) {
  const x = Math.sin(i * 999 + salt * 37) * 10000
  return x - Math.floor(x)
}
