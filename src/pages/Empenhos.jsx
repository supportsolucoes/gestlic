import { useEffect, useState } from 'react'
import { Plus, ShieldAlert, Truck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import SaldoBar from '../components/SaldoBar'

export default function Empenhos() {
  const [itens, setItens] = useState([])
  const [empenhos, setEmpenhos] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [modalEmpenho, setModalEmpenho] = useState(null) // item_contrato_id
  const [modalEntrega, setModalEntrega] = useState(null) // empenho_id
  const [erro, setErro] = useState('')

  const [formEmpenho, setFormEmpenho] = useState({ numero_empenho: '', data_emissao: hoje(), quantidade_empenhada: '' })
  const [formEntrega, setFormEntrega] = useState({ data_envio: hoje(), quantidade_entregue: '' })

  function hoje() { return new Date().toISOString().slice(0, 10) }

  async function carregar() {
    setCarregando(true)
    const { data: i } = await supabase
      .from('vw_saldo_itens')
      .select('*, itens_contrato(contrato_id, contratos(numero_ata, processos(orgaos(nome))))')
    setItens(i || [])

    const { data: e } = await supabase
      .from('empenhos')
      .select('*, vw_saldo_empenhos(*)')
      .order('data_emissao', { ascending: false })

    const { data: saldoEmp } = await supabase.from('vw_saldo_empenhos').select('*')
    const agrupado = {}
    ;(saldoEmp || []).forEach(em => {
      if (!agrupado[em.item_contrato_id]) agrupado[em.item_contrato_id] = []
      agrupado[em.item_contrato_id].push(em)
    })
    setEmpenhos(agrupado)
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function salvarEmpenho(e) {
    e.preventDefault()
    setErro('')
    const { error } = await supabase.from('empenhos').insert({
      item_contrato_id: modalEmpenho,
      numero_empenho: formEmpenho.numero_empenho,
      data_emissao: formEmpenho.data_emissao,
      quantidade_empenhada: Number(formEmpenho.quantidade_empenhada),
    })
    if (error) {
      setErro(limparMensagemBloqueio(error.message))
      return
    }
    setModalEmpenho(null)
    setFormEmpenho({ numero_empenho: '', data_emissao: hoje(), quantidade_empenhada: '' })
    carregar()
  }

  async function salvarEntrega(e) {
    e.preventDefault()
    setErro('')
    const { error } = await supabase.from('entregas').insert({
      empenho_id: modalEntrega,
      data_envio: formEntrega.data_envio,
      quantidade_entregue: Number(formEntrega.quantidade_entregue),
    })
    if (error) {
      setErro(limparMensagemBloqueio(error.message))
      return
    }
    setModalEntrega(null)
    setFormEntrega({ data_envio: hoje(), quantidade_entregue: '' })
    carregar()
  }

  function limparMensagemBloqueio(msg) {
    const m = msg.match(/BLOQUEADO:.*/)
    return m ? m[0] : msg
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Empenhos</h1>
          <p className="page-subtitle">Lance empenhos por item de contrato. Tentativas acima do saldo são bloqueadas automaticamente.</p>
        </div>
      </div>

      <div className="table-wrap">
        {carregando ? (
          <div className="empty-state">Carregando...</div>
        ) : itens.length === 0 ? (
          <div className="empty-state">
            <h4>Nenhum item de contrato cadastrado</h4>
            <p>Cadastre um contrato e seus itens na página "Contratos / ATA" antes de lançar empenhos.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Produto</th><th>Órgão / ATA</th><th>Saldo a empenhar</th><th>Empenhos lançados</th><th></th>
              </tr>
            </thead>
            <tbody>
              {itens.map(i => {
                const empsDoItem = empenhos[i.item_contrato_id] || []
                return (
                  <tr key={i.item_contrato_id}>
                    <td>{i.produto}</td>
                    <td>
                      {i.itens_contrato?.contratos?.processos?.orgaos?.nome}
                      <div className="text-muted" style={{ fontSize: 11 }}>{i.itens_contrato?.contratos?.numero_ata}</div>
                    </td>
                    <td style={{ minWidth: 170 }}>
                      <SaldoBar contratado={Number(i.quantidade_contratada)} usado={Number(i.quantidade_empenhada)} />
                    </td>
                    <td>
                      {empsDoItem.length === 0 ? (
                        <span className="text-muted" style={{ fontSize: 12 }}>Nenhum ainda</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {empsDoItem.map(em => (
                            <div key={em.empenho_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="mono" style={{ fontSize: 12 }}>{em.numero_empenho || 'NE'}</span>
                              {em.entrega_atrasada && (
                                <span className="badge badge-danger"><ShieldAlert size={11} aria-hidden="true" /> Entrega atrasada</span>
                              )}
                              <button className="btn btn-secondary btn-sm" onClick={() => setModalEntrega(em.empenho_id)}>
                                <Truck size={12} aria-hidden="true" /> Registrar entrega
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => setModalEmpenho(i.item_contrato_id)}>
                        <Plus size={13} aria-hidden="true" /> Empenho
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalEmpenho && (
        <Modal
          titulo="Lançar empenho"
          onClose={() => { setModalEmpenho(null); setErro('') }}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setModalEmpenho(null); setErro('') }}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarEmpenho}>Lançar empenho</button>
            </>
          }
        >
          {erro && (
            <div className="alert-banner danger">
              <ShieldAlert size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{erro}</span>
            </div>
          )}
          <form onSubmit={salvarEmpenho} className="form-grid">
            <div className="form-field">
              <label>Número do empenho (NE)</label>
              <input value={formEmpenho.numero_empenho} onChange={e => setFormEmpenho({ ...formEmpenho, numero_empenho: e.target.value })} placeholder="NE-2026-001" />
            </div>
            <div className="form-field">
              <label>Data de emissão</label>
              <input type="date" value={formEmpenho.data_emissao} onChange={e => setFormEmpenho({ ...formEmpenho, data_emissao: e.target.value })} required />
            </div>
            <div className="form-field full">
              <label>Quantidade empenhada</label>
              <input type="number" min={0.01} step="0.01" value={formEmpenho.quantidade_empenhada} onChange={e => setFormEmpenho({ ...formEmpenho, quantidade_empenhada: e.target.value })} required />
            </div>
          </form>
        </Modal>
      )}

      {modalEntrega && (
        <Modal
          titulo="Registrar entrega"
          onClose={() => { setModalEntrega(null); setErro('') }}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setModalEntrega(null); setErro('') }}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarEntrega}>Registrar entrega</button>
            </>
          }
        >
          {erro && (
            <div className="alert-banner danger">
              <ShieldAlert size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{erro}</span>
            </div>
          )}
          <form onSubmit={salvarEntrega} className="form-grid">
            <div className="form-field">
              <label>Data de envio</label>
              <input type="date" value={formEntrega.data_envio} onChange={e => setFormEntrega({ ...formEntrega, data_envio: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Quantidade entregue</label>
              <input type="number" min={0.01} step="0.01" value={formEntrega.quantidade_entregue} onChange={e => setFormEntrega({ ...formEntrega, quantidade_entregue: e.target.value })} required />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
