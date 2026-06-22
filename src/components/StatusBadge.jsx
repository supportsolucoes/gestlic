import { Trophy, Clock, XCircle, AlertTriangle, RotateCcw } from 'lucide-react'

const MAPA = {
  GANHOU: { cls: 'badge-ok', label: 'Ganhou', Icon: Trophy },
  EM_ANDAMENTO: { cls: 'badge-neutral', label: 'Em andamento', Icon: Clock },
  DECLINOU: { cls: 'badge-neutral', label: 'Declinou', Icon: XCircle },
  DESCLASSIFICADO: { cls: 'badge-danger', label: 'Desclassificado', Icon: XCircle },
  FRACASSADO: { cls: 'badge-warn', label: 'Fracassado', Icon: AlertTriangle },
  REVOGADO: { cls: 'badge-neutral', label: 'Revogado', Icon: RotateCcw },
}

export default function StatusBadge({ status }) {
  const m = MAPA[status] || { cls: 'badge-neutral', label: status, Icon: null }
  const Icon = m.Icon
  return (
    <span className={`badge ${m.cls}`}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {m.label}
    </span>
  )
}
