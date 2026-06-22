import { useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'

const STATUS_OPCOES = ['EM_ANDAMENTO', 'GANHOU', 'DECLINOU', 'DESCLASSIFICADO', 'FRACASSADO', 'REVOGADO']

export default function Processos() {
  const { ehAdmin } = useAuth()
  const [processos, setProcessos] = useState([])
  const [orgaos, setOrgaos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('TODOS')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(formVazio())

  function formVazio() {
    return {
      orgao_nome: '', uf: '', numero_pregao: '', numero_processo: '',
      modalidade: 'ELETRÔNICO', data_abertura: '', status: 'EM_ANDAMENTO',
      empresa_vencedora: '', motivo_perda: '', observacoes: '',
    }
  }

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase
      .from('processos')
      .select('*, orgaos(nome, uf)')
      .order('created_at', { ascending: false })
    setProcessos(data || [])
    const { data: org } = await supabase.from('orgaos').select('id, nome, uf').order('nome')
    setOrgaos(org || [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm(formVazio())
    setErro('')
    setModalAberto(true)
  }

  function abrirEdicao(p) {
    setEditando(p)
    setForm({
      orgao_nome: p.orgaos?.nome || '',
      uf: p.orgaos?.uf || '',
      numero_pregao: p.numero_pregao || '',
      numero_processo: p.numero_processo || '',
      modalidade: p.modalidade || 'ELETRÔNICO',
      data_abertura: p.data_abertura || '',
      status: p.status,
      empresa_vencedora: p.empresa_vencedora || '',
      motivo_perda: p.motivo_perda || '',
      observacoes: p.observacoes || '',
    })
    setErro('')
    setModalAberto(true)
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')

    let orgaoId
    const { data: orgaoExistente } = await supabase
      .from('orgaos').select('id').eq('nome', form.orgao_nome).eq('uf', form.uf).maybeSingle()

    if (orgaoExistente) {
      orgaoId = orgaoExistente.id
    } else {
      const { data: novoOrgao, error: erroOrgao } = await supabase
        .from('orgaos').insert({ nome: form.orgao_nome, uf: form.uf }).select('id').single()
      if (erroOrgao) { setErro(erroOrgao.message); return }
      orgaoId = novoOrgao.id
    }

    const payload = {
      orgao_id: orgaoId,
      numero_pregao: form.numero_pregao,
      numero_processo: form.numero_processo,
      modalidade: form.modalidade,
      data_abertura: form.data_abertura || null,
      status: form.status,
      empresa_vencedora: form.empresa_vencedora || null,
      motivo_perda: form.motivo_perda || null,
      observacoes: form.observacoes || null,
    }

    if (editando) {
      const { error } = await supabase.from('processos').update(payload).eq('id', editando.id)
      if (error) { setErro(error.message); return }
    } else {
      const { error } = await supabase.from('processos').insert(payload)
      if (error) { setErro(error.message); return }
    }

    setModalAberto(false)
    carregar()
  }

  const listaFiltrada = filtroStatus === 'TODOS' ? processos : processos.filter(p => p.status === filtroStatus)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Processos</h1>
          <p className="page-subtitle">Disputas de licitação — cadastre desde a abertura do edital.</p>
        </div>
        {ehAdmin && <button className="btn btn-primary" onClick={abrirNovo}><Plus size={15} aria-hidden="true" /> Novo processo</button>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['TODOS', ...STATUS_OPCOES].map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className="btn btn-sm"
            style={{
              background: filtroStatus === s ? 'var(--accent)' : 'var(--bg-elevated)',
              color: filtroStatus === s ? '#fff' : 'var(--text)',
              borderColor: 'var(--border)',
            }}
          >
            {s === 'TODOS' ? 'Todos' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        {carregando ? (
          <div className="empty-state">Carregando...</div>
        ) : listaFiltrada.length === 0 ? (
          <div className="empty-state">
            <h4>Nenhum processo encontrado</h4>
            <p>Cadastre o primeiro processo para começar a acompanhar.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Órgão</th><th>UF</th><th>Pregão</th><th>Processo</th>
                <th>Modalidade</th><th>Status</th><th>Vencedora</th><th></th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map(p => (
                <tr key={p.id}>
                  <td>{p.orgaos?.nome}</td>
                  <td>{p.orgaos?.uf}</td>
                  <td className="mono">{p.numero_pregao}</td>
                  <td className="mono">{p.numero_processo}</td>
                  <td>{p.modalidade}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>{p.empresa_vencedora || '—'}</td>
                  <td>
                    {ehAdmin && (
                      <button className="icon-btn" onClick={() => abrirEdicao(p)} aria-label="Editar processo" title="Editar">
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalAberto && (
        <Modal
          titulo={editando ? 'Editar processo' : 'Novo processo'}
          onClose={() => setModalAberto(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalAberto(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar}>Salvar</button>
            </>
          }
        >
          {erro && <div className="alert-banner danger">{erro}</div>}
          <form onSubmit={salvar} className="form-grid">
            <div className="form-field">
              <label>Órgão</label>
              <input value={form.orgao_nome} onChange={e => setForm({ ...form, orgao_nome: e.target.value })} required placeholder="Prefeitura Municipal de..." />
            </div>
            <div className="form-field">
              <label>UF</label>
              <input value={form.uf} onChange={e => setForm({ ...form, uf: e.target.value.toUpperCase() })} maxLength={2} placeholder="SP" />
            </div>
            <div className="form-field">
              <label>Nº do pregão</label>
              <input value={form.numero_pregao} onChange={e => setForm({ ...form, numero_pregao: e.target.value })} placeholder="65/2025" />
            </div>
            <div className="form-field">
              <label>Nº do processo</label>
              <input value={form.numero_processo} onChange={e => setForm({ ...form, numero_processo: e.target.value })} placeholder="3230/2025" />
            </div>
            <div className="form-field">
              <label>Modalidade</label>
              <select value={form.modalidade} onChange={e => setForm({ ...form, modalidade: e.target.value })}>
                <option>ELETRÔNICO</option>
                <option>PRESENCIAL</option>
              </select>
            </div>
            <div className="form-field">
              <label>Data de abertura</label>
              <input type="date" value={form.data_abertura} onChange={e => setForm({ ...form, data_abertura: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPCOES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Empresa vencedora</label>
              <input value={form.empresa_vencedora} onChange={e => setForm({ ...form, empresa_vencedora: e.target.value })} placeholder="Nome da vencedora" />
            </div>
            {(form.status === 'DECLINOU' || form.status === 'DESCLASSIFICADO' || form.status === 'FRACASSADO') && (
              <div className="form-field full">
                <label>Motivo</label>
                <input value={form.motivo_perda} onChange={e => setForm({ ...form, motivo_perda: e.target.value })} placeholder="Preço / Não atende / Acima do referencial..." />
              </div>
            )}
            <div className="form-field full">
              <label>Observações</label>
              <textarea rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            {form.status === 'GANHOU' && (
              <div className="form-field full">
                <div className="alert-banner warn">
                  Após salvar como "Ganhou", vá até <strong>Contratos / ATA</strong> para registrar a ATA, os itens e o prazo de entrega.
                </div>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  )
}
