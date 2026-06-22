import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const { error } = await entrar(email, senha)
    if (error) setErro(traduzErro(error.message))
    setCarregando(false)
  }

  function traduzErro(msg) {
    if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
    return msg
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <h1>Gestor de Licitações</h1>
          <p>Controle de processo, ATA e empenho</p>
        </div>

        {erro && <div className="alert-banner danger">{erro}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="voce@empresa.com" />
          </div>
          <div className="form-field">
            <label>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required minLength={6} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={carregando} style={{ justifyContent: 'center', marginTop: 4 }}>
            {carregando ? 'Aguarde...' : 'Entrar'}
          </button>
        </form>

        <div className="login-toggle">
          Sem acesso ainda? Peça ao administrador para criar sua conta.
        </div>
      </div>
    </div>
  )
}
