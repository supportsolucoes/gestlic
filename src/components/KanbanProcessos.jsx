import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { supabase } from '../lib/supabase'

const COLUNAS = [
  { status: 'EM_ANDAMENTO', label: 'Em andamento', accent: 'var(--text-muted)' },
  { status: 'GANHOU', label: 'Ganhou', accent: 'var(--ok)' },
  { status: 'DECLINOU', label: 'Declinou', accent: 'var(--text-muted)' },
  { status: 'DESCLASSIFICADO', label: 'Desclassificado', accent: 'var(--danger)' },
  { status: 'FRACASSADO', label: 'Fracassado', accent: 'var(--warn)' },
  { status: 'REVOGADO', label: 'Revogado', accent: 'var(--text-muted)' },
]

function CartaoProcesso({ processo, ehAdmin }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: processo.id,
    disabled: !ehAdmin,
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 10 : 'auto' }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
        padding: '10px 12px', marginBottom: 8, cursor: ehAdmin ? 'grab' : 'pointer', ...style,
      }}
      {...(ehAdmin ? { ...listeners, ...attributes } : {})}
      onClick={() => !isDragging && navigate(`/processos/${processo.id}`)}
    >
      <div style={{ fontWeight: 600, fontSize: 13 }}>{processo.orgaos?.nome || 'Sem órgão'}</div>
      <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
        {processo.numero_processo} {processo.numero_pregao && `· Pregão ${processo.numero_pregao}`}
      </div>
      {processo.empresa_vencedora && (
        <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>{processo.empresa_vencedora}</div>
      )}
    </div>
  )
}

function ColunaKanban({ coluna, processos, ehAdmin }) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.status })

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? 'var(--bg)' : 'transparent',
        border: '1px solid var(--border)', borderRadius: 10,
        minWidth: 230, width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column',
        maxHeight: 'calc(100vh - 220px)',
      }}
    >
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: coluna.accent, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 12.5 }}>{coluna.label}</span>
        <span className="badge badge-neutral" style={{ marginLeft: 'auto' }}>{processos.length}</span>
      </div>
      <div style={{ padding: 10, overflowY: 'auto', flex: 1 }}>
        {processos.length === 0 ? (
          <div className="text-muted" style={{ fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Nenhum aqui</div>
        ) : (
          processos.map(p => <CartaoProcesso key={p.id} processo={p} ehAdmin={ehAdmin} />)
        )}
      </div>
    </div>
  )
}

export default function KanbanProcessos({ processos, ehAdmin, onAtualizado }) {
  const [processoArrastado, setProcessoArrastado] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function aoIniciarArraste(event) {
    const p = processos.find(p => p.id === event.active.id)
    setProcessoArrastado(p || null)
  }

  async function aoSoltar(event) {
    setProcessoArrastado(null)
    const { active, over } = event
    if (!over) return
    const novoStatus = over.id
    const processo = processos.find(p => p.id === active.id)
    if (!processo || processo.status === novoStatus) return

    await supabase.from('processos').update({ status: novoStatus }).eq('id', processo.id)
    onAtualizado()
  }

  return (
    <DndContext sensors={sensors} onDragStart={aoIniciarArraste} onDragEnd={aoSoltar}>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {COLUNAS.map(coluna => (
          <ColunaKanban
            key={coluna.status}
            coluna={coluna}
            processos={processos.filter(p => p.status === coluna.status)}
            ehAdmin={ehAdmin}
          />
        ))}
      </div>
      <DragOverlay>
        {processoArrastado && (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent)', borderRadius: 8, padding: '10px 12px', width: 210, boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{processoArrastado.orgaos?.nome}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
