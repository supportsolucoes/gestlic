import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Calendar, Truck, TrendingUp, PackageX, ArrowUpRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import StatusBadge from '../components/StatusBadge'

export default function Painel() {
  const navigate = useNavigate()
  const [kpi, setKpi] = useState({ totalProcessos: 0, ganhos: 0, taxaConversao: 0, contratosVigentes: 0 })
  const [vencimentosProximos, setVencimentosProximos] = useState([])
  const [entregasAtrasadas, setEntregasAtrasadas] = useState([])
  const [itensCriticos, setItensCriticos] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)

      const { data: processos } = await supabase.from('processos').select('status')
      const total = processos?.length || 0
      const ganhos = processos?.filter(p => p.status === 'GANHOU').length || 0

      const { data: contratos } = await supabase
        .from('contratos')
        .select('*, processos(id, orgaos(nome))')
        .eq('ativo', true)
        .order('data_vencimento')

      const hoje = new Date()
      const em30dias = new Date(hoje.getTime() + 30 * 86400000)
      const vencProx = (contratos || []).filter(c => c.data_vencimento && new Date(c.data_vencimento) <= em30dias)

      const { data: saldoEmpenhos } = await supabase.from('vw_saldo_empenhos').select('*').eq('entrega_atrasada', true)

      const { data: saldoItens } = await supabase
        .from('vw_saldo_itens')
        .select('*, itens_contrato(contrato_id, contratos(processo_id))')
      const criticos = (saldoItens || []).filter(i => {
        const pct = i.quantidade_contratada > 0 ? (i.quantidade_empenhada / i.quantidade_contratada) * 100 : 0
        return pct >= 90
      })

      setKpi({
        totalProcessos: total,
        ganhos,
        taxaConversao: total > 0 ? Math.round((ganhos / total) * 100) : 0,
        contratosVigentes: contratos?.length || 0,
      })
      setVencimentosProximos(vencProx)
      setEntregasAtrasadas(saldoEmpenhos || [])
      setItensCriticos(criticos)
      setCarregando(false)
    }
    carregar()
  }, [])

  function diasPara(data) {
    return Math.ceil((new Date(data) - new Date()) / 86400000)
  }

  if (carregando) return <div className="empty-state">Carregando painel...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Painel</h1>
          <p className="page-subtitle">Visão geral de processos, contratos e alertas que precisam de atenção.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{kpi.totalProcessos}</div>
          <div className="kpi-label">Processos cadastrados</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{kpi.ganhos}</div>
          <div className="kpi-label">Processos ganhos</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{kpi.taxaConversao}%</div>
          <div className="kpi-label">Taxa de conversão</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{kpi.contratosVigentes}</div>
          <div className="kpi-label">Contratos vigentes</div>
        </div>
      </div>

      <div className="section-title">Vencimento de ATA (próximos 30 dias)</div>
      <div className="table-wrap" style={{ marginBottom: 24 }}>
        {vencimentosProximos.length === 0 ? (
          <div className="empty-state" style={{ padding: 28 }}>
            <p>Nenhuma ATA vencendo nos próximos 30 dias.</p>
          </div>
        ) : (
          <table>
            <thead><tr><th>Órgão</th><th>ATA</th><th>Vencimento</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {vencimentosProximos.map(c => {
                const dias = diasPara(c.data_vencimento)
                return (
                  <tr key={c.id} onClick={() => c.processos?.id && navigate(`/processos/${c.processos.id}`)} style={{ cursor: c.processos?.id ? 'pointer' : 'default' }}>
                    <td>{c.processos?.orgaos?.nome}</td>
                    <td className="mono">{c.numero_ata}</td>
                    <td className="mono">{new Date(c.data_vencimento).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <span className={`badge ${dias < 0 ? 'badge-danger' : 'badge-warn'}`}>
                        <Calendar size={11} aria-hidden="true" /> {dias < 0 ? `Vencido há ${Math.abs(dias)}d` : `Vence em ${dias}d`}
                      </span>
                    </td>
                    <td><ArrowUpRight size={13} aria-hidden="true" className="text-muted" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-title">Entregas atrasadas</div>
      <div className="table-wrap" style={{ marginBottom: 24 }}>
        {entregasAtrasadas.length === 0 ? (
          <div className="empty-state" style={{ padding: 28 }}>
            <p>Nenhuma entrega atrasada no momento.</p>
          </div>
        ) : (
          <table>
            <thead><tr><th>Empenho</th><th>Data limite</th><th>Saldo a entregar</th></tr></thead>
            <tbody>
              {entregasAtrasadas.map(em => (
                <tr key={em.empenho_id}>
                  <td className="mono">{em.numero_empenho || 'NE'}</td>
                  <td className="mono">{new Date(em.data_limite_entrega).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <span className="badge badge-danger">
                      <Truck size={11} aria-hidden="true" /> {Number(em.saldo_a_entregar).toLocaleString('pt-BR')} pendente
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-title">Itens perto de esgotar o saldo (≥90% empenhado)</div>
      <div className="table-wrap">
        {itensCriticos.length === 0 ? (
          <div className="empty-state" style={{ padding: 28 }}>
            <p>Nenhum item perto de esgotar o saldo contratado.</p>
          </div>
        ) : (
          <table>
            <thead><tr><th>Produto</th><th>Contratado</th><th>Empenhado</th><th>Saldo restante</th><th></th></tr></thead>
            <tbody>
              {itensCriticos.map(i => {
                const processoId = i.itens_contrato?.contratos?.processo_id
                return (
                  <tr key={i.item_contrato_id} onClick={() => processoId && navigate(`/processos/${processoId}`)} style={{ cursor: processoId ? 'pointer' : 'default' }}>
                    <td>{i.produto}</td>
                    <td className="mono">{Number(i.quantidade_contratada).toLocaleString('pt-BR')}</td>
                    <td className="mono">{Number(i.quantidade_empenhada).toLocaleString('pt-BR')}</td>
                    <td>
                      <span className="badge badge-warn">
                        <PackageX size={11} aria-hidden="true" /> {Number(i.saldo_a_empenhar).toLocaleString('pt-BR')} restante
                      </span>
                    </td>
                    <td><ArrowUpRight size={13} aria-hidden="true" className="text-muted" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
