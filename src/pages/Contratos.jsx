import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, ArrowUpRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SaldoBar from '../components/SaldoBar'

export default function Contratos() {
  const navigate = useNavigate()
  const [contratos, setContratos] = useState([])
  const [saldos, setSaldos] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [expandido, setExpandido] = useState(null)

  async function carregar() {
    setCarregando(true)
    const { data: c } = await supabase
      .from('contratos')
      .select('*, processos(id, numero_processo, numero_pregao, orgaos(nome, uf))')
      .order('created_at', { ascending: false })
    setContratos(c || [])

    const { data: itensComSaldo } = await supabase.from('vw_saldo_itens').select('*')
    const agrupado = {}
    ;(itensComSaldo || []).forEach(i => {
      if (!agrupado[i.contrato_id]) agrupado[i.contrato_id] = []
      agrupado[i.contrato_id].push(i)
    })
    setSaldos(agrupado)
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  function statusVencimento(dataVenc) {
    if (!dataVenc) return null
    const dias = Math.ceil((new Date(dataVenc) - new Date()) / (1000 * 60 * 60 * 24))
    if (dias < 0) return { cls: 'badge-danger', label: 'Vencido' }
    if (dias <= 30) return { cls: 'badge-warn', label: `Vence em ${dias}d` }
    return { cls: 'badge-ok', label: 'Vigente' }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatório de contratos</h1>
          <p className="page-subtitle">Visão consolidada de todos os contratos. Para criar ou editar, abra o processo correspondente.</p>
        </div>
      </div>

      <div className="table-wrap">
        {carregando ? (
          <div className="empty-state">Carregando...</div>
        ) : contratos.length === 0 ? (
          <div className="empty-state">
            <h4>Nenhum contrato cadastrado</h4>
            <p>Contratos são criados a partir de um processo marcado como "Ganhou" — abra o processo para criar um.</p>
          </div>
        ) : (
          contratos.map(c => {
            const itens = saldos[c.id] || []
            const venc = statusVencimento(c.data_vencimento)
            const aberto = expandido === c.id
            return (
              <div key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
                  onClick={() => setExpandido(aberto ? null : c.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {aberto ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.numero_ata || 'Sem número de ATA'} · {c.processos?.orgaos?.nome}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Processo {c.processos?.numero_processo} · Pregão {c.processos?.numero_pregao} · {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {venc && <span className={`badge ${venc.cls}`}>{venc.label}</span>}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`/processos/${c.processos?.id}`) }}
                    >
                      Abrir processo <ArrowUpRight size={12} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {aberto && (
                  <div style={{ padding: '0 18px 16px 44px' }}>
                    {itens.length === 0 ? (
                      <div className="text-muted" style={{ fontSize: 13, padding: '8px 0' }}>Nenhum item cadastrado ainda.</div>
                    ) : (
                      <table>
                        <thead>
                          <tr><th>Produto</th><th>Saldo a empenhar</th><th>Valor unitário</th><th>Prazo entrega</th></tr>
                        </thead>
                        <tbody>
                          {itens.map(i => (
                            <tr key={i.item_contrato_id}>
                              <td>{i.produto}</td>
                              <td style={{ minWidth: 180 }}>
                                <SaldoBar contratado={Number(i.quantidade_contratada)} usado={Number(i.quantidade_empenhada)} />
                              </td>
                              <td className="mono">R$ {Number(i.valor_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td>{i.prazo_entrega_dias} dias</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
