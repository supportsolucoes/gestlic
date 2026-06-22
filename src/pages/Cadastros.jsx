import { useEffect, useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const ABAS = ['Órgãos', 'Produtos', 'Fornecedores', 'Usuários']

export default function Cadastros() {
  const [aba, setAba] = useState('Órgãos')
  const [orgaos, setOrgaos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [perfis, setPerfis] = useState([])
  const [modalAberto, setModalAberto] = useState(false)
  const [editandoOrgao, setEditandoOrgao] = useState(null)
  const [erro, setErro] = useState('')
  const [formOrgao, setFormOrgao] = useState({ nome: '', uf: '', cnpj: '' })
  const [formProduto, setFormProduto] = useState({ nome: '', fornecedor_id: '', preco_custo: '' })
  const [formFornecedor, setFormFornecedor] = useState({ nome: '' })

  async function carregar() {
    const { data: o } = await supabase
      .from('orgaos')
      .select('*, processos(id)')
      .order('nome')
    setOrgaos(o || [])
    const { data: p } = await supabase.from('produtos').select('*, fornecedores_referencia(nome)').order('nome')
    setProdutos(p || [])
    const { data: f } = await supabase.from('fornecedores_referencia').select('*').order('nome')
    setFornecedores(f || [])
    const { data: u } = await supabase.from('perfis').select('*').order('nome')
    setPerfis(u || [])
  }

  useEffect(() => { carregar() }, [])

  function abrirNovoOrgao() {
    setEditandoOrgao(null)
    setFormOrgao({ nome: '', uf: '', cnpj: '' })
    setErro('')
    setModalAberto(true)
  }

  function abrirEdicaoOrgao(o) {
    setEditandoOrgao(o)
    setFormOrgao({ nome: o.nome || '', uf: o.uf || '', cnpj: o.cnpj || '' })
    setErro('')
    setModalAberto(true)
  }

  async function salvarOrgao(e) {
    e.preventDefault()
    setErro('')
    const payload = {
      nome: formOrgao.nome,
      uf: formOrgao.uf || null,
      cnpj: formOrgao.cnpj || null,
    }
    const { error } = editandoOrgao
      ? await supabase.from('orgaos').update(payload).eq('id', editandoOrgao.id)
      : await supabase.from('orgaos').insert(payload)
    if (error) { setErro(error.message); return }
    setModalAberto(false)
    carregar()
  }

  async function salvarProduto(e) {
    e.preventDefault()
    setErro('')
    const { error } = await supabase.from('produtos').insert({
      nome: formProduto.nome,
      fornecedor_id: formProduto.fornecedor_id || null,
      preco_custo: formProduto.preco_custo ? Number(formProduto.preco_custo) : null,
    })
    if (error) { setErro(error.message); return }
    setModalAberto(false)
    setFormProduto({ nome: '', fornecedor_id: '', preco_custo: '' })
    carregar()
  }

  async function salvarFornecedor(e) {
    e.preventDefault()
    setErro('')
    const { error } = await supabase.from('fornecedores_referencia').insert({ nome: formFornecedor.nome })
    if (error) { setErro(error.message); return }
    setModalAberto(false)
    setFormFornecedor({ nome: '' })
    carregar()
  }

  async function mudarPapel(userId, papel) {
    await supabase.from('perfis').update({ papel }).eq('id', userId)
    carregar()
  }

  function formatarCnpj(valor) {
    const digitos = valor.replace(/\D/g, '').slice(0, 14)
    return digitos
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }

  function abrirModalNovo() {
    setErro('')
    if (aba === 'Órgãos') abrirNovoOrgao()
    else setModalAberto(true)
  }

  const labelNovo = { 'Órgãos': 'órgão', 'Produtos': 'produto', 'Fornecedores': 'fornecedor' }[aba]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cadastros</h1>
          <p className="page-subtitle">Dados de apoio usados em processos e contratos.</p>
        </div>
        {aba !== 'Usuários' && (
          <button className="btn btn-primary" onClick={abrirModalNovo}>
            <Plus size={15} aria-hidden="true" /> Novo {labelNovo}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {ABAS.map(a => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className="btn btn-sm"
            style={{
              background: aba === a ? 'var(--accent)' : 'var(--bg-elevated)',
              color: aba === a ? '#fff' : 'var(--text)',
              borderColor: 'var(--border)',
            }}
          >
            {a}
          </button>
        ))}
      </div>

      {aba === 'Órgãos' && (
        <div className="table-wrap">
          {orgaos.length === 0 ? (
            <div className="empty-state">
              <h4>Nenhum órgão cadastrado</h4>
              <p>Órgãos também são criados automaticamente ao cadastrar um processo — mas você pode adicionar ou completar os dados aqui.</p>
            </div>
          ) : (
            <table>
              <thead><tr><th>Órgão</th><th>UF</th><th>CNPJ</th><th>Processos</th><th></th></tr></thead>
              <tbody>
                {orgaos.map(o => (
                  <tr key={o.id}>
                    <td>{o.nome}</td>
                    <td>{o.uf || '—'}</td>
                    <td className="mono">{o.cnpj || '—'}</td>
                    <td>{o.processos?.length || 0}</td>
                    <td>
                      <button className="icon-btn" onClick={() => abrirEdicaoOrgao(o)} aria-label="Editar órgão" title="Editar">
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {aba === 'Produtos' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Produto</th><th>Fornecedor</th><th>Preço de custo</th></tr></thead>
            <tbody>
              {produtos.map(p => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{p.fornecedores_referencia?.nome || '—'}</td>
                  <td className="mono">{p.preco_custo ? `R$ ${Number(p.preco_custo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === 'Fornecedores' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fornecedor</th></tr></thead>
            <tbody>
              {fornecedores.map(f => <tr key={f.id}><td>{f.nome}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {aba === 'Usuários' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Papel</th></tr></thead>
            <tbody>
              {perfis.map(u => (
                <tr key={u.id}>
                  <td>{u.nome}</td>
                  <td>
                    <select value={u.papel} onChange={e => mudarPapel(u.id, e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <option value="operador">Operador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && aba === 'Órgãos' && (
        <Modal
          titulo={editandoOrgao ? 'Editar órgão' : 'Novo órgão'}
          onClose={() => setModalAberto(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModalAberto(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarOrgao}>Salvar</button>
          </>}
        >
          {erro && <div className="alert-banner danger">{erro}</div>}
          <form onSubmit={salvarOrgao} className="form-grid">
            <div className="form-field full">
              <label>Nome do órgão</label>
              <input value={formOrgao.nome} onChange={e => setFormOrgao({ ...formOrgao, nome: e.target.value })} required placeholder="Prefeitura Municipal de..." />
            </div>
            <div className="form-field">
              <label>UF</label>
              <input value={formOrgao.uf} onChange={e => setFormOrgao({ ...formOrgao, uf: e.target.value.toUpperCase() })} maxLength={2} placeholder="SP" />
            </div>
            <div className="form-field">
              <label>CNPJ</label>
              <input value={formOrgao.cnpj} onChange={e => setFormOrgao({ ...formOrgao, cnpj: formatarCnpj(e.target.value) })} maxLength={18} placeholder="00.000.000/0000-00" />
            </div>
          </form>
        </Modal>
      )}

      {modalAberto && aba === 'Produtos' && (
        <Modal
          titulo="Novo produto"
          onClose={() => setModalAberto(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModalAberto(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarProduto}>Salvar</button>
          </>}
        >
          {erro && <div className="alert-banner danger">{erro}</div>}
          <form onSubmit={salvarProduto} className="form-grid">
            <div className="form-field full">
              <label>Nome do produto</label>
              <input value={formProduto.nome} onChange={e => setFormProduto({ ...formProduto, nome: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Fornecedor</label>
              <select value={formProduto.fornecedor_id} onChange={e => setFormProduto({ ...formProduto, fornecedor_id: e.target.value })}>
                <option value="">Nenhum</option>
                {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Preço de custo (R$)</label>
              <input type="number" step="0.01" value={formProduto.preco_custo} onChange={e => setFormProduto({ ...formProduto, preco_custo: e.target.value })} />
            </div>
          </form>
        </Modal>
      )}

      {modalAberto && aba === 'Fornecedores' && (
        <Modal
          titulo="Novo fornecedor"
          onClose={() => setModalAberto(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModalAberto(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarFornecedor}>Salvar</button>
          </>}
        >
          {erro && <div className="alert-banner danger">{erro}</div>}
          <form onSubmit={salvarFornecedor} className="form-grid">
            <div className="form-field full">
              <label>Nome do fornecedor</label>
              <input value={formFornecedor.nome} onChange={e => setFormFornecedor({ ...formFornecedor, nome: e.target.value })} required />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
