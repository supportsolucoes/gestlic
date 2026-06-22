import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ShieldAlert, Truck, MapPin, ChevronDown, ChevronRight, Paperclip, Upload, Trash2, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import SaldoBar from '../components/SaldoBar'
import { useAuth } from '../context/AuthContext'

export default function Empenhos() {
  const navigate = useNavigate()
  const { ehAdmin } = useAuth()
  const [itens, setItens] = useState([])
  const [empenhos, setEmpenhos] = useState({})
  const [anexos, setAnexos] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [itemExpandido, setItemExpandido] = useState(null)
  const [empenhoExpandido, setEmpenhoExpandido] = useState(null)
  const [modalEntrega, setModalEntrega] = useState(null) // empenho_id
  const [erro, setErro] = useState('')
  const [enviandoAnexo, setEnviandoAnexo] = useState(null) // empenho_id em upload

  const [formEntrega, setFormEntrega] = useState({ data_envio: hoje(), quantidade_entregue: '' })

  function hoje() { return new Date().toISOString().slice(0, 10) }

  async function carregar() {
    setCarregando(true)

    const { data: i } = await supabase.from('vw_saldo_itens').select('*')
    const { data: ic } = await supabase
      .from('itens_contrato')
      .select('id, contrato_id, contratos(numero_ata, processos(id, orgaos(nome, logradouro, numero, bairro, cidade, uf, cep, telefone)))')

    const contextoPorItem = {}
    ;(ic || []).forEach(c => { contextoPorItem[c.id] = c })

    const itensComContexto = (i || []).map(item => ({
      ...item,
      itens_contrato: contextoPorItem[item.item_contrato_id] || null,
    }))
    setItens(itensComContexto)

    const { data: saldoEmp } = await supabase.from('vw_saldo_empenhos').select('*')
    const agrupado = {}
    ;(saldoEmp || []).forEach(em => {
      if (!agrupado[em.item_contrato_id]) agrupado[em.item_contrato_id] = []
      agrupado[em.item_contrato_id].push(em)
    })
    setEmpenhos(agrupado)

    const { data: anexosData } = await supabase.from('anexos_empenho').select('*').order('created_at', { ascending: false })
    const anexosPorEmpenho = {}
    ;(anexosData || []).forEach(a => {
      if (!anexosPorEmpenho[a.empenho_id]) anexosPorEmpenho[a.empenho_id] = []
      anexosPorEmpenho[a.empenho_id].push(a)
    })
    setAnexos(anexosPorEmpenho)

    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function subirArquivoEmpenho(empenhoId, arquivo, tipoDocumento) {
    if (!arquivo) return { error: null }
    if (arquivo.type !== 'application/pdf') {
      return { error: 'Apenas arquivos PDF são aceitos.' }
    }
    if (arquivo.size > 10 * 1024 * 1024) {
      return { error: 'O arquivo precisa ter no máximo 10 MB.' }
    }

    const caminho = `${empenhoId}/${Date.now()}-${arquivo.name}`
    const { error: erroUpload } = await supabase.storage.from('documentos-empenho').upload(caminho, arquivo)
    if (erroUpload) {
      return { error: 'Falha ao enviar ' + arquivo.name + ': ' + erroUpload.message }
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const { error: erroMeta } = await supabase.from('anexos_empenho').insert({
      empenho_id: empenhoId,
      nome_arquivo: arquivo.name,
      caminho_storage: caminho,
      tipo_documento: tipoDocumento,
      tamanho_bytes: arquivo.size,
      enviado_por: sessionData?.session?.user?.id || null,
    })
    if (erroMeta) {
      return { error: 'Falha ao salvar metadados de ' + arquivo.name + ': ' + erroMeta.message }
    }
    return { error: null }
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

  async function enviarAnexo(empenhoId, arquivo, tipoDocumento) {
    if (!arquivo) return
    setEnviandoAnexo(empenhoId)
    setErro('')
    const { error } = await subirArquivoEmpenho(empenhoId, arquivo, tipoDocumento)
    if (error) setErro(error)
    setEnviandoAnexo(null)
    carregar()
  }

  async function abrirAnexo(anexo) {
    const { data, error } = await supabase.storage.from('documentos-empenho').createSignedUrl(anexo.caminho_storage, 60)
    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    } else {
      setErro('Não foi possível abrir o arquivo.')
    }
  }

  async function removerAnexo(anexo) {
    await supabase.storage.from('documentos-empenho').remove([anexo.caminho_storage])
    await supabase.from('anexos_empenho').delete().eq('id', anexo.id)
    carregar()
  }

  const LABELS_TIPO = { nota_empenho: 'Nota de empenho', nota_fiscal: 'Nota fiscal', outro: 'Outro documento' }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatório de empenhos</h1>
          <p className="page-subtitle">Visão consolidada de todos os empenhos. Para lançar um novo, abra o processo correspondente.</p>
        </div>
      </div>

      <div className="table-wrap">
        {carregando ? (
          <div className="empty-state">Carregando...</div>
        ) : itens.length === 0 ? (
          <div className="empty-state">
            <h4>Nenhum item de contrato cadastrado</h4>
            <p>Cadastre um contrato e seus itens dentro de um processo antes de lançar empenhos.</p>
          </div>
        ) : (
          itens.map(i => {
            const empsDoItem = empenhos[i.item_contrato_id] || []
            const aberto = itemExpandido === i.item_contrato_id
            const algumAtrasado = empsDoItem.some(em => em.entrega_atrasada)
            const processoId = i.itens_contrato?.contratos?.processos?.id
            return (
              <div key={i.item_contrato_id} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
                  onClick={() => setItemExpandido(aberto ? null : i.item_contrato_id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    {aberto ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                    <div style={{ minWidth: 140 }}>
                      <div style={{ fontWeight: 600 }}>{i.produto}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        {i.itens_contrato?.contratos?.processos?.orgaos?.nome} · {i.itens_contrato?.contratos?.numero_ata}
                      </div>
                    </div>
                    <div style={{ minWidth: 170, flex: 1, maxWidth: 220 }}>
                      <SaldoBar contratado={Number(i.quantidade_contratada)} usado={Number(i.quantidade_empenhada)} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="badge badge-neutral">{empsDoItem.length} {empsDoItem.length === 1 ? 'empenho' : 'empenhos'}</span>
                    {algumAtrasado && <span className="badge badge-danger"><ShieldAlert size={11} aria-hidden="true" /> Atrasado</span>}
                    {processoId && (
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/processos/${processoId}`) }}>
                        Abrir processo <ArrowUpRight size={12} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {aberto && (
                  <div style={{ padding: '0 18px 16px 44px' }}>
                    {empsDoItem.length === 0 ? (
                      <div className="text-muted" style={{ fontSize: 13, padding: '8px 0' }}>Nenhum empenho lançado ainda.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {empsDoItem.map(em => {
                          const empAberto = empenhoExpandido === em.empenho_id
                          const anexosDoEmpenho = anexos[em.empenho_id] || []
                          return (
                            <div key={em.empenho_id} className="card" style={{ overflow: 'hidden' }}>
                              <div
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}
                                onClick={() => setEmpenhoExpandido(empAberto ? null : em.empenho_id)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {empAberto ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                                  <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{em.numero_empenho || 'NE'}</span>
                                  {em.entrega_atrasada && (
                                    <span className="badge badge-danger"><ShieldAlert size={11} aria-hidden="true" /> Atrasada</span>
                                  )}
                                  {anexosDoEmpenho.length > 0 && (
                                    <span className="badge badge-neutral"><Paperclip size={11} aria-hidden="true" /> {anexosDoEmpenho.length}</span>
                                  )}
                                </div>
                                <div style={{ minWidth: 130 }} onClick={e => e.stopPropagation()}>
                                  <SaldoBar contratado={Number(em.quantidade_empenhada)} usado={Number(em.quantidade_entregue)} labelUsado="entregue" />
                                </div>
                              </div>

                              {empAberto && (
                                <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '12px 0', fontSize: 12 }}>
                                    {em.data_limite_entrega && (
                                      <div className="text-muted">Prazo: {new Date(em.data_limite_entrega).toLocaleDateString('pt-BR')}</div>
                                    )}
                                    {em.local_entrega && (
                                      <div className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <MapPin size={11} aria-hidden="true" /> {em.local_entrega}
                                      </div>
                                    )}
                                  </div>

                                  <button className="btn btn-secondary btn-sm" onClick={() => setModalEntrega(em.empenho_id)}>
                                    <Truck size={12} aria-hidden="true" /> Registrar entrega
                                  </button>

                                  <div style={{ marginTop: 14 }}>
                                    <div className="section-title" style={{ margin: '0 0 8px' }}>Documentos</div>
                                    {anexosDoEmpenho.length === 0 ? (
                                      <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Nenhum documento anexado.</div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                                        {anexosDoEmpenho.map(a => (
                                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                            <FileText size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
                                            <button
                                              onClick={() => abrirAnexo(a)}
                                              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 500, padding: 0, textAlign: 'left' }}
                                            >
                                              {a.nome_arquivo}
                                            </button>
                                            <span className="badge badge-neutral" style={{ fontSize: 10 }}>{LABELS_TIPO[a.tipo_documento] || 'Documento'}</span>
                                            {ehAdmin && (
                                              <button className="icon-btn" onClick={() => removerAnexo(a)} aria-label="Remover documento" title="Remover" style={{ width: 24, height: 24 }}>
                                                <Trash2 size={12} aria-hidden="true" />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                      <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                                        <Upload size={12} aria-hidden="true" />
                                        {enviandoAnexo === em.empenho_id ? 'Enviando...' : 'Anexar nota de empenho'}
                                        <input
                                          type="file"
                                          accept="application/pdf"
                                          style={{ display: 'none' }}
                                          disabled={enviandoAnexo === em.empenho_id}
                                          onChange={ev => enviarAnexo(em.empenho_id, ev.target.files[0], 'nota_empenho')}
                                        />
                                      </label>
                                      <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                                        <Upload size={12} aria-hidden="true" />
                                        {enviandoAnexo === em.empenho_id ? 'Enviando...' : 'Anexar nota fiscal'}
                                        <input
                                          type="file"
                                          accept="application/pdf"
                                          style={{ display: 'none' }}
                                          disabled={enviandoAnexo === em.empenho_id}
                                          onChange={ev => enviarAnexo(em.empenho_id, ev.target.files[0], 'nota_fiscal')}
                                        />
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

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
