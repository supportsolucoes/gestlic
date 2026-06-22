import { useEffect, useState } from 'react'
import { Plus, Pencil, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'

const ABAS = ['Órgãos', 'Produtos', 'Fornecedores', 'Usuários']

export default function Cadastros() {
  const { criarUsuario } = useAuth()
  const [aba, setAba] = useState('Órgãos')
  const [orgaos, setOrgaos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [perfis, setPerfis] = useState([])
  const [modalAberto, setModalAberto] = useState(false)
  const [editandoOrgao, setEditandoOrgao] = useState(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [cnpjEncontrado, setCnpjEncontrado] = useState(false)
  const [formOrgao, setFormOrgao] = useState({ nome: '', razao_social: '', uf: '', cnpj: '' })
  const [formProduto, setFormProduto] = useState({ nome: '', fornecedor_id: '', preco_custo: '' })
  const [formFornecedor, setFormFornecedor] = useState({ nome: '' })
  const [formUsuario, setFormUsuario] = useState({ nome: '', email: '', senha: '', papel: 'operador' })

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
    setFormOrgao({ nome: '', razao_social: '', uf: '', cnpj: '' })
    setCnpjEncontrado(false)
    setErro('')
    setModalAberto(true)
  }

  function abrirEdicaoOrgao(o) {
    setEditandoOrgao(o)
    setFormOrgao({ nome: o.nome || '', razao_social: o.razao_social || '', uf: o.uf || '', cnpj: o.cnpj || '' })
    setCnpjEncontrado(false)
    setErro('')
    setModalAberto(true)
  }

  async function salvarOrgao(e) {
    e.preventDefault()
    setErro('')
    const payload = {
      nome: formOrgao.nome,
      razao_social: formOrgao.razao_social || null,
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

  async function salvarUsuario(e) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    const { error } = await criarUsuario(formUsuario.email, formUsuario.senha, formUsuario.nome, formUsuario.papel)
    if (error) { setErro(error); return }
    setSucesso(`Conta criada para ${formUsuario.nome}. Envie o e-mail e a senha para a pessoa.`)
    setFormUsuario({ nome: '', email: '', senha: '', papel: 'operador' })
    carregar()
  }

  function gerarSenhaAleatoria() {
    const senha = Math.random().toString(36).slice(-10)
    setFormUsuario({ ...formUsuario, senha })
  }

  function formatarCnpj(valor) {
    const digitos = valor.replace(/\D/g, '').slice(0, 14)
    return digitos
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }

  async function aoMudarCnpjOrgao(valor) {
    const formatado = formatarCnpj(valor)
    setFormOrgao({ ...formOrgao, cnpj: formatado })
    setCnpjEncontrado(false)
    setErro('')

    const digitos = formatado.replace(/\D/g, '')
    if (digitos.length !== 14) return

    setBuscandoCnpj(true)
    try {
      const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`)
      if (resp.ok) {
        const dados = await resp.json()
        const razaoSocial = dados.razao_social || ''
        const nomeFantasia = dados.nome_fantasia || ''
        const uf = dados.uf || ''
        setFormOrgao(prev => ({
          ...prev,
          cnpj: formatado,
          razao_social: razaoSocial,
          // Sugere nome fantasia se existir e o campo "nome de uso" ainda estiver vazio;
          // nunca sobrescreve algo que o usuário já tenha digitado.
          nome: prev.nome ? prev.nome : (nomeFantasia || razaoSocial),
          uf,
        }))
        setCnpjEncontrado(true)
      } else if (resp.status === 404) {
        setErro('CNPJ não encontrado na base da Receita Federal. Preencha os dados manualmente.')
      } else {
        setErro('Não foi possível consultar o CNPJ agora. Preencha os dados manualmente.')
      }
    } catch {
      setErro('Sem conexão com o serviço de consulta. Preencha os dados manualmente.')
    } finally {
      setBuscandoCnpj(false)
    }
  }

  function abrirModalNovo() {
    setErro('')
    setSucesso('')
    if (aba === 'Órgãos') abrirNovoOrgao()
    else setModalAberto(true)
  }

  const labelNovo = { 'Órgãos': 'órgão', 'Produtos': 'produto', 'Fornecedores': 'fornecedor', 'Usuários': 'usuário' }[aba]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cadastros</h1>
          <p className="page-subtitle">Dados de apoio usados em processos e contratos.</p>
        </div>
        <button className="btn btn-primary" onClick={abrirModalNovo}>
          <Plus size={15} aria-hidden="true" /> Novo {labelNovo}
        </button>
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
          {sucesso && <div className="alert-banner warn" style={{ margin: 16, marginBottom: 0 }}>{sucesso}</div>}
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
              <label>CNPJ</label>
              <input
                value={formOrgao.cnpj}
                onChange={e => aoMudarCnpjOrgao(e.target.value)}
                maxLength={18}
                placeholder="00.000.000/0000-00"
              />
              {buscandoCnpj && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Loader2 size={12} className="spin" aria-hidden="true" /> Consultando Receita Federal...
                </span>
              )}
              {cnpjEncontrado && !buscandoCnpj && (
                <span style={{ fontSize: 12, color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <CheckCircle2 size={12} aria-hidden="true" /> CNPJ localizado na Receita Federal
                </span>
              )}
            </div>
            {formOrgao.razao_social && (
              <div className="form-field full">
                <label>Razão social (Receita Federal)</label>
                <input value={formOrgao.razao_social} readOnly style={{ background: 'var(--bg)', color: 'var(--text-muted)' }} />
              </div>
            )}
            <div className="form-field full">
              <label>Nome de uso (como vai aparecer nas telas)</label>
              <input value={formOrgao.nome} onChange={e => setFormOrgao({ ...formOrgao, nome: e.target.value })} required placeholder="Ex: Hospital Regional de Divinolândia" />
            </div>
            <div className="form-field">
              <label>UF</label>
              <input value={formOrgao.uf} onChange={e => setFormOrgao({ ...formOrgao, uf: e.target.value.toUpperCase() })} maxLength={2} placeholder="SP" />
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

      {modalAberto && aba === 'Usuários' && (
        <Modal
          titulo="Novo usuário"
          onClose={() => setModalAberto(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModalAberto(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarUsuario}>Criar conta</button>
          </>}
        >
          {erro && <div className="alert-banner danger">{erro}</div>}
          <form onSubmit={salvarUsuario} className="form-grid">
            <div className="form-field full">
              <label>Nome</label>
              <input value={formUsuario.nome} onChange={e => setFormUsuario({ ...formUsuario, nome: e.target.value })} required />
            </div>
            <div className="form-field full">
              <label>E-mail</label>
              <input type="email" value={formUsuario.email} onChange={e => setFormUsuario({ ...formUsuario, email: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Senha provisória</label>
              <input value={formUsuario.senha} onChange={e => setFormUsuario({ ...formUsuario, senha: e.target.value })} required minLength={6} />
            </div>
            <div className="form-field" style={{ justifyContent: 'flex-end' }}>
              <label>&nbsp;</label>
              <button type="button" className="btn btn-secondary" onClick={gerarSenhaAleatoria}>Gerar senha</button>
            </div>
            <div className="form-field full">
              <label>Papel</label>
              <select value={formUsuario.papel} onChange={e => setFormUsuario({ ...formUsuario, papel: e.target.value })}>
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="form-field full">
              <div className="alert-banner warn">
                Anote essa senha — você precisa enviá-la para a pessoa. Ela poderá trocá-la depois de entrar (em uma futura versão).
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
