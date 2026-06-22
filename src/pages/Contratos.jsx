import { useEffect, useState } from 'react'
import { Plus, ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SaldoBar from '../components/SaldoBar'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'

export default function Contratos() {
  const { ehAdmin } = useAuth()
  const [contratos, setContratos] = useState([])
  const [processosGanhos, setProcessosGanhos] = useState([])
  const [saldos, setSaldos] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [expandido, setExpandido] = useState(null)

  const [modalContrato, setModalContrato] = useState(false)
  const [modalItem, setModalItem] = useState(null) // contrato_id ao abrir
  const [erro, setErro] = useState('')

  const [formContrato, setFormContrato] = useState({
    processo_id: '', numero_ata: '', tipo: 'ATA', data_assinatura: '', vigencia_meses: 12,
  })
  const [formItem, setFormItem] = useState({
    produto_nome_livre: '', quantidade_contratada: '', valor_unitario: '', prazo_entrega_dias: 30,
  })

  async function carregar() {
    setCarregando(true)
    const { data: c } = await supabase
      .from('contratos')
      .select('*, processos(numero_processo, numero_pregao, orgaos(nome, uf))')
      .order('created_at', { ascending: false })
    setContratos(c || [])

    const { data: itensComSaldo } = await supabase.from('vw_saldo_itens').select('*')
    const agrupado = {}
    ;(itensComSaldo || []).forEach(i => {
      if (!agrupado[i.contrato_id]) agrupado[i.contrato_id] = []
      agrupado[i.contrato_id].push(i)
    })
    setSaldos(agrupado)

    const { data: pg } = await supabase
      .from('processos')
      .select('id, numero_processo, numero_pregao, orgaos(nome, uf)')
      .eq('status', 'GANHOU')
    setProcessosGanhos(pg || [])

    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function salvarContrato(e) {
    e.preventDefault()
    setErro('')
    const dataAssinatura = formContrato.data_assinatura
    const vencimento = dataAssinatura
      ? new Date(new Date(dataAssinatura).setMonth(new Date(dataAssinatura).getMonth() + Number(formContrato.vigencia_meses))).toISOString().slice(0, 10)
      : null

    const { error } = await supabase.from('contratos').insert({
      processo_id: formContrato.processo_id,
      numero_ata: formContrato.numero_ata,
      tipo: formContrato.tipo,
      data_assinatura: dataAssinatura || null,
      vigencia_meses: formContrato.vigencia_meses,
      data_vencimento: vencimento,
    })
    if (error) { setErro(error.message); return }
    setModalContrato(false)
    setFormContrato({ processo_id: '', numero_ata: '', tipo: 'ATA', data_assinatura: '', vigencia_meses: 12 })
    carregar()
  }

  async function salvarItem(e) {
    e.preventDefault()
    setErro('')
    const { error } = await supabase.from('itens_contrato').insert({
      contrato_id: modalItem,
      produto_nome_livre: formItem.produto_nome_livre,
      quantidade_contratada: Number(formItem.quantidade_contratada),
      valor_unitario: Number(formItem.valor_unitario),
      prazo_entrega_dias: Number(formItem.prazo_entrega_dias),
    })
    if (error) { setErro(error.message); return }
    setModalItem(null)
    setFormItem({ produto_nome_livre: '', quantidade_contratada: '', valor_unitario: '', prazo_entrega_dias: 30 })
    carregar()
  }

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
          <h1 className="page-title">Contratos / ATA</h1>
          <p className="page-subtitle">Saldo de empenho por item — o sistema bloqueia qualquer empenho que ultrapasse o contratado.</p>
        </div>
        {ehAdmin && (
          <button className="btn btn-primary" onClick={() => setModalContrato(true)}>
            <Plus size={15} aria-hidden="true" /> Novo contrato
          </button>
        )}
      </div>

      <div className="table-wrap">
        {carregando ? (
          <div className="empty-state">Carregando...</div>
        ) : contratos.length === 0 ? (
          <div className="empty-state">
            <h4>Nenhum contrato cadastrado</h4>
            <p>Crie um contrato a partir de um processo marcado como "Ganhou".</p>
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
                    {ehAdmin && (
                      <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => setModalItem(c.id)}>
                        <Plus size={13} aria-hidden="true" /> Adicionar item
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {modalContrato && (
        <Modal
          titulo="Novo contrato / ATA"
          onClose={() => setModalContrato(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalContrato(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarContrato}>Salvar</button>
            </>
          }
        >
          {erro && <div className="alert-banner danger">{erro}</div>}
          <form onSubmit={salvarContrato} className="form-grid">
            <div className="form-field full">
              <label>Processo ganho</label>
              <select value={formContrato.processo_id} onChange={e => setFormContrato({ ...formContrato, processo_id: e.target.value })} required>
                <option value="">Selecione...</option>
                {processosGanhos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.orgaos?.nome} — Processo {p.numero_processo} / Pregão {p.numero_pregao}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Número da ATA</label>
              <input value={formContrato.numero_ata} onChange={e => setFormContrato({ ...formContrato, numero_ata: e.target.value })} placeholder="ATA-001/2026" />
            </div>
            <div className="form-field">
              <label>Tipo</label>
              <select value={formContrato.tipo} onChange={e => setFormContrato({ ...formContrato, tipo: e.target.value })}>
                <option value="ATA">ATA de registro de preços</option>
                <option value="EMPENHO_DIRETO">Empenho direto</option>
              </select>
            </div>
            <div className="form-field">
              <label>Data de assinatura</label>
              <input type="date" value={formContrato.data_assinatura} onChange={e => setFormContrato({ ...formContrato, data_assinatura: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Vigência (meses)</label>
              <input type="number" min={1} value={formContrato.vigencia_meses} onChange={e => setFormContrato({ ...formContrato, vigencia_meses: e.target.value })} />
            </div>
          </form>
        </Modal>
      )}

      {modalItem && (
        <Modal
          titulo="Adicionar item ao contrato"
          onClose={() => setModalItem(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalItem(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarItem}>Salvar item</button>
            </>
          }
        >
          {erro && <div className="alert-banner danger">{erro}</div>}
          <form onSubmit={salvarItem} className="form-grid">
            <div className="form-field full">
              <label>Produto</label>
              <input value={formItem.produto_nome_livre} onChange={e => setFormItem({ ...formItem, produto_nome_livre: e.target.value })} required placeholder="Nome do produto" />
            </div>
            <div className="form-field">
              <label>Quantidade contratada</label>
              <input type="number" min={0} step="0.01" value={formItem.quantidade_contratada} onChange={e => setFormItem({ ...formItem, quantidade_contratada: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Valor unitário (R$)</label>
              <input type="number" min={0} step="0.01" value={formItem.valor_unitario} onChange={e => setFormItem({ ...formItem, valor_unitario: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Prazo de entrega (dias)</label>
              <input type="number" min={1} value={formItem.prazo_entrega_dias} onChange={e => setFormItem({ ...formItem, prazo_entrega_dias: e.target.value })} required />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
