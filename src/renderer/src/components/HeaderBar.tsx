import { useState } from 'react'
import { useAgentStore } from '@/store/agentStore'
import { isPmRole } from '@/types/agent'

export function HeaderBar() {
  const agents = useAgentStore((s) => s.agents)
  const archived = useAgentStore((s) => s.archived)
  const projects = useAgentStore((s) => s.projects)
  const currentProjectId = useAgentStore((s) => s.currentProjectId)
  const selectProject = useAgentStore((s) => s.selectProject)
  const addProject = useAgentStore((s) => s.addProject)
  const openHire = useAgentStore((s) => s.openHire)
  const openArchive = useAgentStore((s) => s.openArchive)
  const [creating, setCreating] = useState(false)

  // 只统计当前项目的成员
  const list = Object.values(agents).filter(
    (a) => (a.projectId ?? null) === currentProjectId
  )
  const running = list.filter((a) => a.status === 'working' || a.status === 'thinking').length
  const waiting = list.filter((a) => a.status === 'waiting').length
  const submitted = list.filter((a) => a.status === 'submitted').length
  const errored = list.filter((a) => a.status === 'error').length

  const inProject = currentProjectId !== null
  const hasPm = list.some((a) => isPmRole(a.role))

  async function newProject() {
    if (creating) return
    setCreating(true)
    try {
      const picked = await window.dog.pickProjectDir()
      if (!picked.ok || !picked.dir) return
      const res = await window.dog.createProject({
        name: picked.suggestedName || '新项目',
        dir: picked.dir
      })
      if (res.ok && res.project) {
        addProject(res.project)
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <header
      className="relative z-20 flex flex-col"
      style={{
        WebkitAppRegion: 'drag',
        background: 'linear-gradient(180deg, rgba(17,22,32,0.84), rgba(14,16,22,0.64))',
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(255,215,156,0.12)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.16)'
      } as any}
    >
      {/* 第一行：标题 + 统计 + 操作 */}
      <div className="flex items-center justify-between gap-4 px-6 pt-3.5 pb-2">
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
              PawPilot
            </div>
            <div className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,247,232,0.52)' }}>
              {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <Stat label="在岗" value={running} dot="#3aa8ff" />
          <Stat label="等回应" value={waiting} dot="#f59e0b" />
          <Stat label="待验收" value={submitted} dot="#14b8a6" />
          <Stat label="报错" value={errored} dot="#ef4444" />
        </div>

        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={() => openArchive(true)}
            className="text-[12px] px-3 py-1.5 rounded-md transition-colors"
            style={{ color: 'rgba(255,247,232,0.68)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            📁 档案柜
          </button>
          {inProject && !hasPm && (
            <button
              onClick={() => openHire(true, 'pm')}
              className="flex items-center gap-1.5 text-[12px] font-medium text-white px-3.5 py-1.5 rounded-md transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #ffd58a 0%, #f59e0b 100%)',
                boxShadow: '0 8px 22px -6px rgba(245,158,11,0.6)'
              }}
            >
              <span className="text-base leading-none">+</span> 招 PM
            </button>
          )}
          <button
            onClick={() => openHire(true, inProject ? (hasPm ? 'frontend' : 'pm') : 'fullstack')}
            className="flex items-center gap-1.5 text-[12px] font-medium text-white px-3.5 py-1.5 rounded-md transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #4db6ff 0%, #8b8ff6 100%)',
              boxShadow: '0 8px 22px -6px rgba(58,168,255,0.58)'
            }}
          >
            <span className="text-base leading-none">+</span> 招聘
          </button>
        </div>
      </div>

      {/* 第二行：项目标签栏 */}
      <div
        className="flex items-center gap-1.5 px-6 pb-2 overflow-x-auto"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <ProjectTab
          label="⚡ 快速监控"
          active={currentProjectId === null}
          onClick={() => selectProject(null)}
        />
        {projects.map((p) => (
          <ProjectTab
            key={p.id}
            label={p.name}
            active={currentProjectId === p.id}
            onClick={() => selectProject(p.id)}
          />
        ))}
        <button
          onClick={newProject}
          disabled={creating}
          className="flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-md transition-colors flex-shrink-0 disabled:opacity-50"
          style={{ color: 'rgba(255,247,232,0.6)', border: '1px dashed rgba(255,255,255,0.18)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {creating ? '选择中…' : '＋ 新项目'}
        </button>
      </div>
    </header>
  )
}

function ProjectTab({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-[12px] px-3 py-1 rounded-md transition-all flex-shrink-0 max-w-[180px] truncate"
      style={{
        background: active ? 'rgba(255,215,156,0.16)' : 'rgba(255,255,255,0.04)',
        color: active ? '#ffe9be' : 'rgba(255,247,232,0.6)',
        border: active ? '1px solid rgba(255,215,156,0.4)' : '1px solid rgba(255,255,255,0.06)',
        fontWeight: active ? 600 : 400
      }}
    >
      {label}
    </button>
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
        style={{ width: 6, height: 6, background: dot, boxShadow: `0 0 6px ${dot}` }}
      />
      <span className="text-[11px]" style={{ color: 'rgba(255,247,232,0.55)' }}>{label}</span>
      <span className="text-[13px] font-semibold font-mono tabular-nums" style={{ color: '#fff7e8' }}>
        {value}
      </span>
    </div>
  )
}
