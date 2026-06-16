import { useEffect } from 'react'
import { useAgentStore } from '@/store/agentStore'

export function ArchiveCabinet() {
  const open = useAgentStore((s) => s.archiveOpen)
  const setOpen = useAgentStore((s) => s.openArchive)
  const archived = useAgentStore((s) => s.archived)
  const setArchived = useAgentStore((s) => s.setArchived)
  const select = useAgentStore((s) => s.select)

  useEffect(() => {
    if (open) {
      window.dog.listArchived().then((rows) => setArchived(rows as any))
    }
  }, [open, setArchived])

  if (!open) return null

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-40 flex items-start justify-center pt-20 px-6"
      style={{ background: 'rgba(3,5,9,0.68)', backdropFilter: 'blur(10px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-2xl p-6 max-h-[70vh] flex flex-col"
        style={{
          background: 'linear-gradient(180deg, rgba(28,34,45,0.98) 0%, rgba(13,17,24,0.98) 100%)',
          border: '1px solid rgba(255,215,156,0.16)',
          boxShadow: '0 34px 90px -22px rgba(0,0,0,0.78), inset 0 1px rgba(255,255,255,0.1)'
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 22 }}>📁</span>
            <div>
              <div className="text-ink-900 font-semibold">档案柜</div>
              <div className="text-ink-500 text-[11px]">
                历史任务 · 共 {archived.length} 条
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {archived.length > 0 && (
              <button
                onClick={async () => {
                  await window.dog.clearArchive()
                  setArchived([])
                }}
                className="text-[12px] text-ink-500 hover:text-red-300 px-3 py-1.5 rounded-md hover:bg-red-500/10 transition-colors"
              >
                清空
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-ink-500 hover:text-ink-900 transition-colors p-1"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {archived.length === 0 ? (
            <div className="text-center py-12 text-ink-500 text-sm">
              还没有归档记录。完成的任务会自动留在这里。
            </div>
          ) : (
            <div className="space-y-2">
              {archived.map((a) => (
                <div
                  key={a.id}
                  onClick={() => {
                    select(a.id)
                    setOpen(false)
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.075), rgba(255,255,255,0.03))',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: 'inset 0 1px rgba(255,255,255,0.08)'
                  }}
                >
                  <span
                    className="block rounded-full flex-shrink-0"
                    style={{
                      width: 10,
                      height: 10,
                      background: a.status === 'done' ? '#34d399' : '#ef4444',
                      boxShadow: `0 0 8px ${a.status === 'done' ? '#34d399' : '#ef4444'}`
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="font-semibold text-[13px]"
                        style={{ color: a.accentColor }}
                      >
                        {a.dogName}
                      </span>
                      <span className="text-[12px] text-ink-700 truncate">
                        {a.taskLabel}
                      </span>
                      <span className="text-[10px] text-ink-500 uppercase font-mono ml-auto flex-shrink-0">
                        {a.tool}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-ink-500 font-mono">
                      <span>
                        {new Date(a.startedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {a.endedAt && (
                        <span>
                          耗时 {Math.round((a.endedAt - a.startedAt) / 1000)}s
                        </span>
                      )}
                      <span>${a.costUsd.toFixed(3)}</span>
                      <span>
                        {(a.inputTokens + a.outputTokens).toLocaleString()} tok
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
