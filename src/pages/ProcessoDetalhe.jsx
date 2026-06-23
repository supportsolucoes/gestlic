import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, ChevronDown, ChevronRight, Pencil, ShieldAlert, Truck,
  MapPin, Paperclip, Upload, Trash2, FileText, FileSignature, ScrollText,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import SaldoBar from '../components/SaldoBar'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'

const STATUS_OPCOES = ['EM_ANDAMENTO', 'GANHOU', 'DECLINOU', 'DESCLASSIFICADO', 'FRACASSADO', 'REVOGADO']
const LABELS_TIPO = { nota_empenho: 'Nota de empenho', nota_fiscal: 'Nota fiscal', outro: 'Outro documento' }

function hoje() { return new Date().toISOString().slice(0, 10) }
function novoItemLinha() {
  return { _key: Math.random().toString(36).slice(2), produto_nome_livre: '', marca: '', modelo: '', unidade: 'UN', quantidade_contratada: '', valor_unitario: '', prazo_entrega_dias: 30 }
}

export default function ProcessoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ehAdmin } = useAuth()

  const [processo, setProcesso] = useState(null)
  const [contratos, setContratos] = useState([])
  const [itens, setItens] = useState([])
  const [empenhosPorItem, setEmpenhosPorItem] = useState({})
  const [anexosPorEmpenho, setAnexosPorEmpenho] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [itemExpandido, setItemExpandido] = useState(null)
  const [empenhoExpandido, setEmpenhoExpandido] = useState(null)

  const [modalProcesso, setModalProcesso] = useState(false)
  const [modalAtaContrato, setModalAtaContrato] = useState(null) // 'ATA' | 'EMPENHO_DIRETO' | null
  const [modalItem, setModalItem] = useState(null) // contrato_id de destino, ou null se fechado
  const [modalEmpenho, setModalEmpenho] = useState(null) // item_contrato_id
  const [modalEntrega, setModalEntrega] = useState(null) // empenho_id
  const [salvandoEmpenho, setSalvandoEmpenho] = useState(false)
  const [salvandoAtaContrato, setSalvandoAtaContrato] = useState(false)
  const [enviandoAnexo, setEnviandoAnexo] = useState(null)
  const [arquivoNotaEmpenho, setArquivoNotaEmpenho] = useState(null)
  const [arquivoNotaFiscal, setArquivoNotaFiscal] = useState(null)
  const [arquivoAtaContrato, setArquivoAtaContrato] = useState(null)

  const [formProcesso, setFormProcesso] = useState({})
  const [formContrato, setFormContrato] = useState({
    numero_ata: '', data_assinatura: '', data_inicio_vigencia: '', vigencia_meses: 12,
    viabilidade: '', observacoes: '',
    prazo_entrega_dias: '', prazo_entrega_uteis: false,
    prazo_pagamento_dias: '', prazo_pagamento_uteis: false,
    telefone_contato: '', email_contato: '',
  })
  const [itensForm, setItensForm] = useState([novoItemLinha()])
  const [formItem, setFormItem] = useState({ produto_nome_livre: '', quantidade_contratada: '', valor_unitario: '', prazo_entrega_dias: 30 })
  const [formEmpenho, setFormEmpenho] = useState({
    numero_empenho: '', data_emissao: hoje(), quantidade_empenhada: '',
    local_entrega: '', endereco_entrega: '', cidade_entrega: '', uf_entrega: '',
    responsavel_recebimento: '', telefone_entrega: '',
  })
  const [formEntrega, setFormEntrega] = useState({ data_envio: hoje(), quantidade_entregue: '' })

  async function carregar() {
    setCarregando(true)

    const { data: p } = await supabase
      .from('processos')
      .select('*, orgaos(id, nome, uf, logradouro, numero, bairro, cidade, telefone)')
      .eq('id', id)
      .single()
    setProcesso(p)

    const { data: listaContratos } = await supabase
      .from('contratos')
      .select('*')
      .eq('processo_id', id)
      .order('created_at', { ascending: true })
    setContratos(listaContratos || [])

    if (listaContratos && listaContratos.length > 0) {
      const contratoIds = listaContratos.map(c => c.id)
      const { data: itensComSaldo } = await supabase.from('vw_saldo_itens').select('*').in('contrato_id', contratoIds)
      setItens(itensComSaldo || [])

      const itemIds = (itensComSaldo || []).map(i => i.item_contrato_id)
      if (itemIds.length > 0) {
        const { data: saldoEmp } = await supabase.from('vw_saldo_empenhos').select('*').in('item_contrato_id', itemIds)
        const agrupado = {}
        ;(saldoEmp || []).forEach(em => {
          if (!agrupado[em.item_contrato_id]) agrupado[em.item_contrato_id] = []
          agrupado[em.item_contrato_id].push(em)
        })
        setEmpenhosPorItem(agrupado)

        const empenhoIds = (saldoEmp || []).map(em => em.empenho_id)
        if (empenhoIds.length > 0) {
          const { data: anexosData } = await supabase.from('anexos_empenho').select('*').in('empenho_id', empenhoIds).order('created_at', { ascending: false })
          const anexosAgrupados = {}
          ;(anexosData || []).forEach(a => {
            if (!anexosAgrupados[a.empenho_id]) anexosAgrupados[a.empenho_id] = []
            anexosAgrupados[a.empenho_id].push(a)
          })
          setAnexosPorEmpenho(anexosAgrupados)
        } else {
          setAnexosPorEmpenho({})
        }
      } else {
        setEmpenhosPorItem({})
        setAnexosPorEmpenho({})
      }
    } else {
      setItens([])
      setEmpenhosPorItem({})
      setAnexosPorEmpenho({})
    }

    setCarregando(false)
  }

  useEffect(() => { carregar() }, [id])

  // ---------- Processo ----------
  function abrirEdicaoProcesso() {
    setFormProcesso({
      orgao_nome: processo.orgaos?.nome || '', uf: processo.orgaos?.uf || '',
      numero_pregao: processo.numero_pregao || '', numero_processo: processo.numero_processo || '',
      modalidade: processo.modalidade || 'ELETRÔNICO', data_abertura: processo.data_abertura || '',
      status: processo.status, empresa_vencedora: processo.empresa_vencedora || '',
      motivo_perda: processo.motivo_perda || '', observacoes: processo.observacoes || '',
    })
    setErro('')
    setModalProcesso(true)
  }

  async function salvarProcesso(e) {
    e.preventDefault()
    setErro('')
    const { error } = await supabase.from('processos').update({
      numero_pregao: formProcesso.numero_pregao,
      numero_processo: formProcesso.numero_processo,
      modalidade: formProcesso.modalidade,
      data_abertura: formProcesso.data_abertura || null,
      status: formProcesso.status,
      empresa_vencedora: formProcesso.empresa_vencedora || null,
      motivo_perda: formProcesso.motivo_perda || null,
      observacoes: formProcesso.observacoes || null,
    }).eq('id', id)
    if (error) { setErro(error.message); return }
    setModalProcesso(false)
    carregar()
  }

  // ---------- Contrato ----------
  function abrirModalAtaContrato(tipo) {
    setErro('')
    setFormContrato({
      numero_ata: '', data_assinatura: '', data_inicio_vigencia: '', vigencia_meses: 12,
      viabilidade: '', observacoes: '',
      prazo_entrega_dias: '', prazo_entrega_uteis: false,
      prazo_pagamento_dias: '', prazo_pagamento_uteis: false,
      telefone_contato: '', email_contato: '',
    })
    setItensForm([novoItemLinha()])
    setArquivoAtaContrato(null)
    setModalAtaContrato(tipo)
  }

  function adicionarLinhaItem() {
    setItensForm(prev => [...prev, novoItemLinha()])
  }

  function removerLinhaItem(key) {
    setItensForm(prev => prev.length > 1 ? prev.filter(l => l._key !== key) : prev)
  }

  function atualizarLinhaItem(key, campo, valor) {
    setItensForm(prev => prev.map(l => l._key === key ? { ...l, [campo]: valor } : l))
  }

  const totalItensForm = itensForm.reduce((soma, l) => {
    const qtd = Number(l.quantidade_contratada) || 0
    const valor = Number(l.valor_unitario) || 0
    return soma + qtd * valor
  }, 0)

  async function salvarAtaContrato(e) {
    e.preventDefault()
    setErro('')

    const linhasValidas = itensForm.filter(l => l.produto_nome_livre.trim() && l.quantidade_contratada !== '' && l.valor_unitario !== '')
    if (linhasValidas.length === 0) {
      setErro('Adicione pelo menos um item com descrição, quantidade e valor unitário preenchidos.')
      return
    }

    setSalvandoAtaContrato(true)
    const dataAssinatura = formContrato.data_assinatura
    const vencimento = dataAssinatura
      ? new Date(new Date(dataAssinatura).setMonth(new Date(dataAssinatura).getMonth() + Number(formContrato.vigencia_meses))).toISOString().slice(0, 10)
      : null

    const { data: novoContrato, error } = await supabase.from('contratos').insert({
      processo_id: id,
      numero_ata: formContrato.numero_ata,
      tipo: modalAtaContrato,
      data_assinatura: dataAssinatura || null,
      data_inicio_vigencia: formContrato.data_inicio_vigencia || null,
      vigencia_meses: formContrato.vigencia_meses,
      data_vencimento: vencimento,
      viabilidade: formContrato.viabilidade || null,
      observacoes: formContrato.observacoes || null,
      prazo_entrega_dias: formContrato.prazo_entrega_dias ? Number(formContrato.prazo_entrega_dias) : null,
      prazo_entrega_uteis: formContrato.prazo_entrega_uteis,
      prazo_pagamento_dias: formContrato.prazo_pagamento_dias ? Number(formContrato.prazo_pagamento_dias) : null,
      prazo_pagamento_uteis: formContrato.prazo_pagamento_uteis,
      telefone_contato: formContrato.telefone_contato || null,
      email_contato: formContrato.email_contato || null,
    }).select().single()

    if (error) { setErro(error.message); setSalvandoAtaContrato(false); return }

    if (arquivoAtaContrato) {
      const caminho = `${novoContrato.id}/${Date.now()}-${arquivoAtaContrato.name}`
      const { error: erroUpload } = await supabase.storage.from('documentos-empenho').upload(caminho, arquivoAtaContrato)
      if (!erroUpload) {
        await supabase.from('contratos').update({ caminho_arquivo: caminho }).eq('id', novoContrato.id)
      }
    }

    const itensParaInserir = linhasValidas.map(l => ({
      contrato_id: novoContrato.id,
      produto_nome_livre: l.produto_nome_livre,
      marca: l.marca || null,
      modelo: l.modelo || null,
      quantidade_contratada: Number(l.quantidade_contratada),
      valor_unitario: Number(l.valor_unitario),
      prazo_entrega_dias: Number(l.prazo_entrega_dias) || 30,
    }))
    const { error: erroItens } = await supabase.from('itens_contrato').insert(itensParaInserir)
    if (erroItens) { setErro('Ata/contrato criado, mas houve um problema ao salvar os itens: ' + erroItens.message) }

    setSalvandoAtaContrato(false)
    setModalAtaContrato(null)
    carregar()
  }

  function statusVencimento(dataVenc) {
    if (!dataVenc) return null
    const dias = Math.ceil((new Date(dataVenc) - new Date()) / 86400000)
    if (dias < 0) return { cls: 'badge-danger', label: 'Vencido' }
    if (dias <= 30) return { cls: 'badge-warn', label: `Vence em ${dias}d` }
    return { cls: 'badge-ok', label: 'Vigente' }
  }

  // ---------- Item ----------
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

  // ---------- Empenho ----------
  function abrirModalEmpenho(item) {
    const orgao = processo?.orgaos
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
    setArquivoNotaEmpenho(null)
    setArquivoNotaFiscal(null)
    setErro('')
    setModalEmpenho(item.item_contrato_id)
  }

  async function subirArquivoEmpenho(empenhoId, arquivo, tipoDocumento) {
    if (!arquivo) return { error: null }
    if (arquivo.type !== 'application/pdf') return { error: 'Apenas arquivos PDF são aceitos.' }
    if (arquivo.size > 10 * 1024 * 1024) return { error: 'O arquivo precisa ter no máximo 10 MB.' }

    const caminho = `${empenhoId}/${Date.now()}-${arquivo.name}`
    const { error: erroUpload } = await supabase.storage.from('documentos-empenho').upload(caminho, arquivo)
    if (erroUpload) return { error: 'Falha ao enviar ' + arquivo.name + ': ' + erroUpload.message }

    const { data: sessionData } = await supabase.auth.getSession()
    const { error: erroMeta } = await supabase.from('anexos_empenho').insert({
      empenho_id: empenhoId, nome_arquivo: arquivo.name, caminho_storage: caminho,
      tipo_documento: tipoDocumento, tamanho_bytes: arquivo.size,
      enviado_por: sessionData?.session?.user?.id || null,
    })
    if (erroMeta) return { error: 'Falha ao salvar metadados de ' + arquivo.name + ': ' + erroMeta.message }
    return { error: null }
  }

  async function salvarEmpenho(e) {
    e.preventDefault()
    setErro('')
    setSalvandoEmpenho(true)

    const { data: novoEmpenho, error } = await supabase.from('empenhos').insert({
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
    }).select('id').single()

    if (error) {
      setErro(limparMensagemBloqueio(error.message))
      setSalvandoEmpenho(false)
      return
    }

    const erros = []
    if (arquivoNotaEmpenho) {
      const r = await subirArquivoEmpenho(novoEmpenho.id, arquivoNotaEmpenho, 'nota_empenho')
      if (r.error) erros.push(r.error)
    }
    if (arquivoNotaFiscal) {
      const r = await subirArquivoEmpenho(novoEmpenho.id, arquivoNotaFiscal, 'nota_fiscal')
      if (r.error) erros.push(r.error)
    }

    setSalvandoEmpenho(false)
    if (erros.length > 0) {
      setErro('Empenho lançado, mas houve problema com anexos: ' + erros.join(' '))
      carregar()
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
    if (error) { setErro(limparMensagemBloqueio(error.message)); return }
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
    if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank')
    else setErro('Não foi possível abrir o arquivo.')
  }

  async function removerAnexo(anexo) {
    await supabase.storage.from('documentos-empenho').remove([anexo.caminho_storage])
    await supabase.from('anexos_empenho').delete().eq('id', anexo.id)
    carregar()
  }

  if (carregando) return <div className="empty-state">Carregando...</div>
  if (!processo) return <div className="empty-state"><h4>Processo não encontrado</h4></div>

  return (
    <div>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/processos')} style={{ marginBottom: 16 }}>
        <ArrowLeft size={13} aria-hidden="true" /> Voltar para processos
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">{processo.orgaos?.nome}</h1>
          <p className="page-subtitle">
            Processo {processo.numero_processo} · Pregão {processo.numero_pregao} · {processo.modalidade}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusBadge status={processo.status} />
          {ehAdmin && (
            <button className="icon-btn" onClick={abrirEdicaoProcesso} aria-label="Editar processo" title="Editar processo">
              <Pencil size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="alert-banner danger">
          <ShieldAlert size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{erro}</span>
        </div>
      )}

      {processo.status !== 'GANHOU' && contratos.length === 0 && (
        <div className="empty-state">
          <h4>Sem contrato</h4>
          <p>Contratos só podem ser criados para processos marcados como "Ganhou". Edite o processo para atualizar o status.</p>
        </div>
      )}

      {processo.status === 'GANHOU' && ehAdmin && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={() => abrirModalAtaContrato('ATA')}>
            <ScrollText size={15} aria-hidden="true" /> Adicionar Ata
          </button>
          <button className="btn btn-secondary" onClick={() => abrirModalAtaContrato('EMPENHO_DIRETO')}>
            <FileSignature size={15} aria-hidden="true" /> Adicionar Contrato
          </button>
        </div>
      )}

      {processo.status === 'GANHOU' && contratos.length === 0 && (
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <p className="text-muted" style={{ margin: 0 }}>Este processo ainda não tem contrato/ATA cadastrado. Use os botões acima para adicionar.</p>
        </div>
      )}

      {contratos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {contratos.map(c => {
            const vencContrato = statusVencimento(c.data_vencimento)
            const itensDoContrato = itens.filter(i => i.contrato_id === c.id)
            return (
              <div key={c.id} className="card card-pad">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {c.tipo === 'ATA' ? <ScrollText size={16} aria-hidden="true" className="text-muted" /> : <FileText size={16} aria-hidden="true" className="text-muted" />}
                    <span style={{ fontWeight: 600 }}>
                      {c.numero_ata || 'Sem número'} <span className="text-muted" style={{ fontWeight: 500, fontSize: 12 }}>({c.tipo === 'ATA' ? 'Ata' : 'Contrato'})</span>
                    </span>
                    {vencContrato && <span className={`badge ${vencContrato.cls}`}>{vencContrato.label}</span>}
                    {c.viabilidade && <span className="badge badge-neutral">Viabilidade: {c.viabilidade === 'ALTA' ? 'Alta' : c.viabilidade === 'MEDIA' ? 'Média' : 'Baixa'}</span>}
                  </div>
                  {ehAdmin && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setModalItem(c.id)}>
                      <Plus size={13} aria-hidden="true" /> Adicionar item
                    </button>
                  )}
                </div>

                {itensDoContrato.length === 0 ? (
                  <div className="text-muted" style={{ fontSize: 13 }}>Nenhum item cadastrado ainda.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {itensDoContrato.map(i => {
                      const empsDoItem = empenhosPorItem[i.item_contrato_id] || []
                      const aberto = itemExpandido === i.item_contrato_id
                      const algumAtrasado = empsDoItem.some(em => em.entrega_atrasada)
                      return (
                        <div key={i.item_contrato_id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer' }}
                            onClick={() => setItemExpandido(aberto ? null : i.item_contrato_id)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                              {aberto ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                              <span style={{ fontWeight: 500, fontSize: 13 }}>
                                {i.produto}
                                {(i.marca || i.modelo) && (
                                  <span className="text-muted" style={{ fontWeight: 400, fontSize: 12 }}>
                                    {' '}— {[i.marca, i.modelo].filter(Boolean).join(' / ')}
                                  </span>
                                )}
                              </span>
                              <div style={{ minWidth: 150, maxWidth: 200, flex: 1 }}>
                                <SaldoBar contratado={Number(i.quantidade_contratada)} usado={Number(i.quantidade_empenhada)} />
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="badge badge-neutral">{empsDoItem.length} {empsDoItem.length === 1 ? 'empenho' : 'empenhos'}</span>
                              {algumAtrasado && <span className="badge badge-danger"><ShieldAlert size={11} aria-hidden="true" /> Atrasado</span>}
                              {ehAdmin && (
                                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); abrirModalEmpenho(i) }}>
                                  <Plus size={12} aria-hidden="true" /> Empenho
                                </button>
                              )}
                            </div>
                          </div>

                          {aberto && (
                            <div style={{ padding: '0 14px 14px 38px', borderTop: '1px solid var(--border)' }}>
                              {empsDoItem.length === 0 ? (
                                <div className="text-muted" style={{ fontSize: 12, padding: '10px 0' }}>Nenhum empenho lançado ainda.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                                  {empsDoItem.map(em => {
                                    const empAberto = empenhoExpandido === em.empenho_id
                                    const anexosDoEmpenho = anexosPorEmpenho[em.empenho_id] || []
                                    return (
                                      <div key={em.empenho_id} style={{ background: 'var(--bg)', borderRadius: 6, overflow: 'hidden' }}>
                                        <div
                                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', cursor: 'pointer' }}
                                          onClick={() => setEmpenhoExpandido(empAberto ? null : em.empenho_id)}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {empAberto ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                                            <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{em.numero_empenho || 'NE'}</span>
                                            {em.entrega_atrasada && <span className="badge badge-danger"><ShieldAlert size={10} aria-hidden="true" /> Atrasada</span>}
                                            {anexosDoEmpenho.length > 0 && <span className="badge badge-neutral"><Paperclip size={10} aria-hidden="true" /> {anexosDoEmpenho.length}</span>}
                                          </div>
                                          <div style={{ minWidth: 120 }} onClick={e => e.stopPropagation()}>
                                            <SaldoBar contratado={Number(em.quantidade_empenhada)} usado={Number(em.quantidade_entregue)} labelUsado="entregue" />
                                          </div>
                                        </div>

                                        {empAberto && (
                                          <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '10px 0', fontSize: 12 }}>
                                              {em.data_limite_entrega && <div className="text-muted">Prazo: {new Date(em.data_limite_entrega).toLocaleDateString('pt-BR')}</div>}
                                              {em.local_entrega && <div className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} aria-hidden="true" /> {em.local_entrega}</div>}
                                            </div>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setModalEntrega(em.empenho_id)}>
                                              <Truck size={12} aria-hidden="true" /> Registrar entrega
                                            </button>
                                            <div style={{ marginTop: 12 }}>
                                              <div className="section-title" style={{ margin: '0 0 8px' }}>Documentos</div>
                                              {anexosDoEmpenho.length === 0 ? (
                                                <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Nenhum documento anexado.</div>
                                              ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                                                  {anexosDoEmpenho.map(a => (
                                                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                                      <FileText size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
                                                      <button onClick={() => abrirAnexo(a)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 500, padding: 0, textAlign: 'left' }}>
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
                                                  <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={enviandoAnexo === em.empenho_id} onChange={ev => enviarAnexo(em.empenho_id, ev.target.files[0], 'nota_empenho')} />
                                                </label>
                                                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                                                  <Upload size={12} aria-hidden="true" />
                                                  {enviandoAnexo === em.empenho_id ? 'Enviando...' : 'Anexar nota fiscal'}
                                                  <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={enviandoAnexo === em.empenho_id} onChange={ev => enviarAnexo(em.empenho_id, ev.target.files[0], 'nota_fiscal')} />
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
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: editar processo */}
      {modalProcesso && (
        <Modal
          titulo="Editar processo"
          onClose={() => setModalProcesso(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModalProcesso(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarProcesso}>Salvar</button>
          </>}
        >
          {erro && <div className="alert-banner danger">{erro}</div>}
          <form onSubmit={salvarProcesso} className="form-grid">
            <div className="form-field">
              <label>Nº do pregão</label>
              <input value={formProcesso.numero_pregao} onChange={e => setFormProcesso({ ...formProcesso, numero_pregao: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Nº do processo</label>
              <input value={formProcesso.numero_processo} onChange={e => setFormProcesso({ ...formProcesso, numero_processo: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Modalidade</label>
              <select value={formProcesso.modalidade} onChange={e => setFormProcesso({ ...formProcesso, modalidade: e.target.value })}>
                <option>ELETRÔNICO</option>
                <option>PRESENCIAL</option>
              </select>
            </div>
            <div className="form-field">
              <label>Data de abertura</label>
              <input type="date" value={formProcesso.data_abertura} onChange={e => setFormProcesso({ ...formProcesso, data_abertura: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Status</label>
              <select value={formProcesso.status} onChange={e => setFormProcesso({ ...formProcesso, status: e.target.value })}>
                {STATUS_OPCOES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Empresa vencedora</label>
              <input value={formProcesso.empresa_vencedora} onChange={e => setFormProcesso({ ...formProcesso, empresa_vencedora: e.target.value })} />
            </div>
            <div className="form-field full">
              <label>Observações</label>
              <textarea rows={2} value={formProcesso.observacoes} onChange={e => setFormProcesso({ ...formProcesso, observacoes: e.target.value })} />
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: nova Ata ou novo Contrato */}
      {modalAtaContrato && (
        <Modal
          largo
          titulo={modalAtaContrato === 'ATA' ? 'Adicionar Ata' : 'Adicionar Contrato'}
          onClose={() => { if (!salvandoAtaContrato) { setModalAtaContrato(null); setErro('') } }}
          footer={<>
            <button className="btn btn-secondary" onClick={() => { setModalAtaContrato(null); setErro('') }} disabled={salvandoAtaContrato}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarAtaContrato} disabled={salvandoAtaContrato}>
              {salvandoAtaContrato ? 'Salvando...' : 'Salvar'}
            </button>
          </>}
        >
          {erro && (
            <div className="alert-banner danger" style={{ marginBottom: 16 }}>
              <ShieldAlert size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={salvarAtaContrato}>
            <div className="form-grid">
              <div className="form-field">
                <label>{modalAtaContrato === 'ATA' ? 'Nº da ata' : 'Nº do contrato'} *</label>
                <input value={formContrato.numero_ata} onChange={e => setFormContrato({ ...formContrato, numero_ata: e.target.value })} required placeholder="Ex: 001/2026" />
              </div>
              <div className="form-field">
                <label>Arquivo {modalAtaContrato === 'ATA' ? 'da ata' : 'do contrato'} (PDF)</label>
                <input type="file" accept="application/pdf" onChange={e => setArquivoAtaContrato(e.target.files[0] || null)} />
              </div>

              <div className="form-field">
                <label>Data de assinatura</label>
                <input type="date" value={formContrato.data_assinatura} onChange={e => setFormContrato({ ...formContrato, data_assinatura: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Vigência início</label>
                <input type="date" value={formContrato.data_inicio_vigencia} onChange={e => setFormContrato({ ...formContrato, data_inicio_vigencia: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Vigência (meses, a partir da assinatura)</label>
                <input type="number" min={1} value={formContrato.vigencia_meses} onChange={e => setFormContrato({ ...formContrato, vigencia_meses: e.target.value })} />
              </div>

              <div className="form-field">
                <label>Viabilidade</label>
                <select value={formContrato.viabilidade} onChange={e => setFormContrato({ ...formContrato, viabilidade: e.target.value })}>
                  <option value="">Selecione</option>
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Média</option>
                  <option value="BAIXA">Baixa</option>
                </select>
              </div>
              <div className="form-field full">
                <label>Observações</label>
                <textarea rows={2} value={formContrato.observacoes} onChange={e => setFormContrato({ ...formContrato, observacoes: e.target.value })} placeholder={`Observações sobre ${modalAtaContrato === 'ATA' ? 'a ata' : 'o contrato'}...`} />
              </div>

              <div className="form-field">
                <label>Prazo de entrega</label>
                <input type="number" min={1} value={formContrato.prazo_entrega_dias} onChange={e => setFormContrato({ ...formContrato, prazo_entrega_dias: e.target.value })} placeholder="Ex: 15 dias" />
                <label className="checkbox-inline">
                  <input type="checkbox" checked={formContrato.prazo_entrega_uteis} onChange={e => setFormContrato({ ...formContrato, prazo_entrega_uteis: e.target.checked })} />
                  Dias úteis
                </label>
              </div>
              <div className="form-field">
                <label>Prazo de pagamento</label>
                <input type="number" min={1} value={formContrato.prazo_pagamento_dias} onChange={e => setFormContrato({ ...formContrato, prazo_pagamento_dias: e.target.value })} placeholder="Ex: 30 dias" />
                <label className="checkbox-inline">
                  <input type="checkbox" checked={formContrato.prazo_pagamento_uteis} onChange={e => setFormContrato({ ...formContrato, prazo_pagamento_uteis: e.target.checked })} />
                  Dias úteis
                </label>
              </div>

              <div className="form-field">
                <label>Telefone de contato</label>
                <input value={formContrato.telefone_contato} onChange={e => setFormContrato({ ...formContrato, telefone_contato: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
              <div className="form-field">
                <label>Email</label>
                <input type="email" value={formContrato.email_contato} onChange={e => setFormContrato({ ...formContrato, email_contato: e.target.value })} placeholder="email@exemplo.com" />
              </div>
            </div>

            <div className="section-title" style={{ marginTop: 18 }}>Itens {modalAtaContrato === 'ATA' ? 'da ata' : 'do contrato'}</div>
            <div className="itens-form-table-wrap">
              <table className="itens-form-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Descrição</th>
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th className="col-unidade">Unidade</th>
                    <th className="col-qtd">Qtd. total</th>
                    <th className="col-valor">Valor unitário</th>
                    <th className="col-valor">Valor total</th>
                    <th className="col-acoes">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {itensForm.map((l, idx) => {
                    const totalLinha = (Number(l.quantidade_contratada) || 0) * (Number(l.valor_unitario) || 0)
                    return (
                      <tr key={l._key}>
                        <td>{idx + 1}</td>
                        <td><input value={l.produto_nome_livre} onChange={e => atualizarLinhaItem(l._key, 'produto_nome_livre', e.target.value)} placeholder="Descrição do item" /></td>
                        <td><input value={l.marca} onChange={e => atualizarLinhaItem(l._key, 'marca', e.target.value)} placeholder="Marca" /></td>
                        <td><input value={l.modelo} onChange={e => atualizarLinhaItem(l._key, 'modelo', e.target.value)} placeholder="Modelo" /></td>
                        <td className="col-unidade"><input value={l.unidade} onChange={e => atualizarLinhaItem(l._key, 'unidade', e.target.value)} /></td>
                        <td className="col-qtd"><input type="number" min={0} step="0.01" value={l.quantidade_contratada} onChange={e => atualizarLinhaItem(l._key, 'quantidade_contratada', e.target.value)} /></td>
                        <td className="col-valor"><input type="number" min={0} step="0.01" value={l.valor_unitario} onChange={e => atualizarLinhaItem(l._key, 'valor_unitario', e.target.value)} /></td>
                        <td className="col-total">{totalLinha.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="col-acoes">
                          <button type="button" className="itens-form-remover" onClick={() => removerLinhaItem(l._key)} aria-label="Remover item" title="Remover item">
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="itens-form-rodape">
              <button type="button" className="btn btn-secondary btn-sm" onClick={adicionarLinhaItem}>
                <Plus size={13} aria-hidden="true" /> Adicionar item
              </button>
              <span className="itens-form-total">
                Valor total {modalAtaContrato === 'ATA' ? 'da ata' : 'do contrato'}: {totalItensForm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: novo item */}
      {modalItem && (
        <Modal
          titulo="Adicionar item ao contrato"
          onClose={() => setModalItem(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModalItem(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarItem}>Salvar item</button>
          </>}
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

      {/* Modal: novo empenho */}
      {modalEmpenho && (
        <Modal
          titulo="Lançar empenho"
          onClose={() => { setModalEmpenho(null); setErro('') }}
          footer={<>
            <button className="btn btn-secondary" onClick={() => { setModalEmpenho(null); setErro('') }} disabled={salvandoEmpenho}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarEmpenho} disabled={salvandoEmpenho}>{salvandoEmpenho ? 'Lançando...' : 'Lançar empenho'}</button>
          </>}
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
              <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Documentos (PDF, opcional)</label>
            </div>
            <div className="form-field">
              <label>Nota de empenho</label>
              <input type="file" accept="application/pdf" onChange={e => setArquivoNotaEmpenho(e.target.files[0] || null)} />
              {arquivoNotaEmpenho && <span className="text-muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={11} aria-hidden="true" /> {arquivoNotaEmpenho.name}</span>}
            </div>
            <div className="form-field">
              <label>Nota fiscal</label>
              <input type="file" accept="application/pdf" onChange={e => setArquivoNotaFiscal(e.target.files[0] || null)} />
              {arquivoNotaFiscal && <span className="text-muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={11} aria-hidden="true" /> {arquivoNotaFiscal.name}</span>}
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

      {/* Modal: registrar entrega */}
      {modalEntrega && (
        <Modal
          titulo="Registrar entrega"
          onClose={() => { setModalEntrega(null); setErro('') }}
          footer={<>
            <button className="btn btn-secondary" onClick={() => { setModalEntrega(null); setErro('') }}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarEntrega}>Registrar entrega</button>
          </>}
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
