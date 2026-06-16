import { useEffect } from 'react'
import { useAgentStore } from '@/store/agentStore'
import { HeaderBar } from '@/components/HeaderBar'
import { OfficeFloor } from '@/components/OfficeFloor'
import { DetailPanel } from '@/components/DetailPanel'
import { HireModal } from '@/components/HireModal'
import { ArchiveCabinet } from '@/components/ArchiveCabinet'
import { DustParticles } from '@/components/effects/DustParticles'

export default function App() {
  const setAgents = useAgentStore((s) => s.setAgents)
  const setArchived = useAgentStore((s) => s.setArchived)
  const applyEvent = useAgentStore((s) => s.applyEvent)
  const select = useAgentStore((s) => s.select)

  useEffect(() => {
    if (!window.dog) {
      console.error('[dog-office] preload bridge missing — window.dog is undefined')
      return
    }
    window.dog.listAgents().then((rows) => setAgents(rows as any)).catch(console.error)
    window.dog.listArchived().then((rows) => setArchived(rows as any)).catch(console.error)
    const offEvent = window.dog.onAgentEvent((e) => applyEvent(e))
    // 通知点击 → 打开对应 agent 的详情
    const offSelect = window.dog.onSelectAgent((id) => select(id))
    return () => {
      offEvent()
      offSelect()
    }
  }, [setAgents, setArchived, applyEvent, select])

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden app-shell" style={{ color: '#f7f2e8' }}>
      <div className="office-backdrop" />
      <div className="office-window-glow" />
      <div className="office-floor-grid" />
      <DustParticles />

      <HeaderBar />
      <main className="flex-1 min-h-0 flex">
        <OfficeFloor />
      </main>

      <DetailPanel />
      <HireModal />
      <ArchiveCabinet />
    </div>
  )
}
