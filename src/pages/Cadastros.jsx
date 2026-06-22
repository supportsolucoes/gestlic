import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const ABAS = ['Produtos', 'Fornecedores', 'Usuários']

export default function Cadastros() {
  const [aba, setAba] = useState('Produtos')
  const [produtos, setProdutos] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [perfis, setPerfis] = useState([])
  const [modalAberto, setModalAberto] = useState(false)
  const [erro, setErro] = useState('')
  const [formProduto, setFormProduto] = useState({ nome: '', fornecedor_id: '', preco_custo: '' })
  const [formFornecedor, setFormFornecedor] = useState({ nome: '' })

  async function carregar() {
    const { data: p } = await supabase.from('produtos').select('*, fornecedores_referencia(nome)').order('nome')
    setProdutos(p || [])
    const { data: f } = await supabase.from('fornecedores_referencia').select('*').order('nome')
    setFornecedores(f || [])
    const { data: u } = await supabase.from('perfis').select('*').order('nome')
    setPerfis(u || [])
  }

  useEffect(() => { carregar() }, [])

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cadastros</h1>
          <p className="page-subtitle">Dados de apoio usados em processos e contratos.</p>
        </div>
        {aba !== 'Usuários' && (
          <button className="btn btn-primary" onClick={() => { setErro(''); setModalAberto(true) }}>
            <Plus size={15} aria-hidden="true" /> Novo {aba === 'Produtos' ? 'produto' : 'fornecedor'}
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
