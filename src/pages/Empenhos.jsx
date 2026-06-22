import { useEffect, useState } from 'react'
import { Plus, ShieldAlert, Truck, MapPin, ChevronDown, ChevronRight, Paperclip, Upload, Trash2, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import SaldoBar from '../components/SaldoBar'
import { useAuth } from '../context/AuthContext'

export default function Empenhos() {
  const { ehAdmin } = useAuth()
  const [itens, setItens] = useState([])
  const [empenhos, setEmpenhos] = useState({})
  const [anexos, setAnexos] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [itemExpandido, setItemExpandido] = useState(null)
  const [empenhoExpandido, setEmpenhoExpandido] = useState(null)
  const [modalEmpenho, setModalEmpenho] = useState(null) // item_contrato_id
  const [modalEntrega, setModalEntrega] = useState(null) // empenho_id
  const [erro, setErro] = useState('')
  const [enviandoAnexo, setEnviandoAnexo] = useState(null) // empenho_id em upload

  const [formEmpenho, setFormEmpenho] = useState({
    numero_empenho: '', data_emissao: hoje(), quantidade_empenhada: '',
    local_entrega: '', endereco_entrega: '', cidade_entrega: '', uf_entrega: '',
    responsavel_recebimento: '', telefone_entrega: '',
  })
  const [formEntrega, setFormEntrega] = useState({ data_envio: hoje(), quantidade_entregue: '' })

  function hoje() { return new Date().toISOString().slice(0, 10) }

  async function carregar() {
    setCarregando(true)

    const { data: i } = await supabase.from('vw_saldo_itens').select('*')
    const { data: ic } = await supabase
      .from('itens_contrato')
      .select('id, contrato_id, contratos(numero_ata, processos(orgaos(nome, logradouro, numero, bairro, cidade, uf, cep, telefone)))')

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

  function abrirModalEmpenho(item) {
    const orgao = item.itens_contrato?.contratos?.processos?.orgaos
    const enderecoSugerido = orgao
      ? [orgao.logradouro, orgao.numero, orgao.bairro, orgao.cidade].filter(Boolean).join(', ')
      : ''
    setFormEmpenho({
      numero_empenho: '', data_emissao: hoje(), quantidade_empenhada: '',
      local_entrega: orgao?.nome || '',
      endereco_entrega: enderecoSugerido,
      cidade_entrega: orgao?.cidade || '',
      uf_entrega: orgao?.uf || '',
      responsavel_recebimento: '',
      telefone_entrega: orgao?.telefone || '',
    })
    setErro('')
    setModalEmpenho(item.item_contrato_id)
  }

  async function salvarEmpenho(e) {
    e.preventDefault()
    setErro('')
    const { error } = await supabase.from('empenhos').insert({
      item_contrato_id: modalEmpenho,
      numero_empenho: formEmpenho.numero_empenho,
      data_emissao: formEmpenho.data_emissao,
      quantidade_empenhada: Number(formEmpenho.quantidade_empenhada),
      local_entrega: formEmpenho.local_entrega || null,
      endereco_entrega: formEmpenho.endereco_entrega || null,
      cidade_entrega: formEmpenho.cidade_entrega || null,
      uf_entrega: formEmpenho.uf_entrega || null,
      responsavel_recebimento: formEmpenho.responsavel_recebimento || null,
      telefone_entrega: formEmpenho.telefone_entrega || null,
    })
    if (error) {
      setErro(limparMensagemBloqueio(error.message))
      return
    }
    setModalEmpenho(null)
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

  async function enviarAnexo(empenhoId, arquivo, tipoDocumento) {
    if (!arquivo) return
    if (arquivo.type !== 'application/pdf') {
      setErro('Apenas arquivos PDF são aceitos.')
      return
    }
    if (arquivo.size > 10 * 1024 * 1024) {
      setErro('O arquivo precisa ter no máximo 10 MB.')
      return
    }
    setEnviandoAnexo(empenhoId)
    setErro('')

    const caminho = `${empenhoId}/${Date.now()}-${arquivo.name}`
    const { error: erroUpload } = await supabase.storage.from('documentos-empenho').upload(caminho, arquivo)
    if (erroUpload) {
      setErro('Falha ao enviar o arquivo: ' + erroUpload.message)
      setEnviandoAnexo(null)
      return
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
      setErro('Falha ao salvar o anexo: ' + erroMeta.message)
    }
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
          itens.map(i => {
            const empsDoItem = empenhos[i.item_contrato_id] || []
            const aberto = itemExpandido === i.item_contrato_id
            const algumAtrasado = empsDoItem.some(em => em.entrega_atrasada)
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
                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); abrirModalEmpenho(i) }}>
                      <Plus size={13} aria-hidden="true" /> Empenho
                    </button>
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

            <div className="form-field full" style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
              <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Local de entrega</label>
            </div>
            <div className="form-field full">
              <label>Local / unidade de destino</label>
              <input value={formEmpenho.local_entrega} onChange={e => setFormEmpenho({ ...formEmpenho, local_entrega: e.target.value })} placeholder="Ex: Hospital Municipal, Almoxarifado Central" />
            </div>
            <div className="form-field full">
              <label>Endereço</label>
              <input value={formEmpenho.endereco_entrega} onChange={e => setFormEmpenho({ ...formEmpenho, endereco_entrega: e.target.value })} placeholder="Rua, número, bairro" />
            </div>
            <div className="form-field">
              <label>Cidade</label>
              <input value={formEmpenho.cidade_entrega} onChange={e => setFormEmpenho({ ...formEmpenho, cidade_entrega: e.target.value })} />
            </div>
            <div className="form-field">
              <label>UF</label>
              <input value={formEmpenho.uf_entrega} onChange={e => setFormEmpenho({ ...formEmpenho, uf_entrega: e.target.value.toUpperCase() })} maxLength={2} />
            </div>
            <div className="form-field">
              <label>Responsável pelo recebimento</label>
              <input value={formEmpenho.responsavel_recebimento} onChange={e => setFormEmpenho({ ...formEmpenho, responsavel_recebimento: e.target.value })} placeholder="Nome de quem recebe" />
            </div>
            <div className="form-field">
              <label>Telefone de contato</label>
              <input value={formEmpenho.telefone_entrega} onChange={e => setFormEmpenho({ ...formEmpenho, telefone_entrega: e.target.value })} placeholder="(00) 0000-0000" />
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
