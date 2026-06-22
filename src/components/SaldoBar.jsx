import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'

// Paleta validada com o usuário: verde (em dia) / âmbar (saldo baixo, >=70%) / vermelho (esgotado, >=95% ou estourou)
export default function SaldoBar({ contratado, usado, labelUsado = 'empenhado' }) {
  const pct = contratado > 0 ? Math.min((usado / contratado) * 100, 100) : 0
  const estourou = usado > contratado

  let cor = '#1D9E75'      // verde — em dia
  let StatusIcon = CheckCircle2
  let statusLabel = 'Em dia'

  if (pct >= 95 || estourou) {
    cor = '#A32D2D'         // vermelho — esgotado
    StatusIcon = AlertCircle
    statusLabel = estourou ? 'Saldo excedido' : 'Esgotado'
  } else if (pct >= 70) {
    cor = '#BA7517'         // âmbar — saldo baixo
    StatusIcon = AlertTriangle
    statusLabel = 'Saldo baixo'
  }

  return (
    <div>
      <div className="saldo-bar-track">
        <div className="saldo-bar-fill" style={{ width: `${pct}%`, background: cor }} />
      </div>
      <div className="saldo-label mono" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <StatusIcon size={11} color={cor} aria-hidden="true" />
        <span>{usado.toLocaleString('pt-BR')} / {contratado.toLocaleString('pt-BR')} {labelUsado}</span>
      </div>
    </div>
  )
}
