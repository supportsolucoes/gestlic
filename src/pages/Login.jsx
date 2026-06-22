import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { entrar, cadastrar } = useAuth()
  const [modo, setModo] = useState('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setAviso('')
    setCarregando(true)

    if (modo === 'entrar') {
      const { error } = await entrar(email, senha)
      if (error) setErro(traduzErro(error.message))
    } else {
      const { error } = await cadastrar(email, senha, nome)
      if (error) {
        setErro(traduzErro(error.message))
      } else {
        setAviso('Conta criada. Verifique seu e-mail para confirmar o acesso, depois entre normalmente.')
        setModo('entrar')
      }
    }
    setCarregando(false)
  }

  function traduzErro(msg) {
    if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
    if (msg.includes('User already registered')) return 'Já existe uma conta com esse e-mail.'
    if (msg.includes('Password should be')) return 'A senha precisa ter pelo menos 6 caracteres.'
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
        {aviso && <div className="alert-banner warn">{aviso}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          {modo === 'cadastrar' && (
            <div className="form-field">
              <label>Nome</label>
              <input value={nome} onChange={e => setNome(e.target.value)} required placeholder="Seu nome" />
            </div>
          )}
          <div className="form-field">
            <label>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="voce@empresa.com" />
          </div>
          <div className="form-field">
            <label>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required minLength={6} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={carregando} style={{ justifyContent: 'center', marginTop: 4 }}>
            {carregando ? 'Aguarde...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="login-toggle">
          {modo === 'entrar' ? (
            <>Ainda não tem conta? <button onClick={() => setModo('cadastrar')}>Criar conta</button></>
          ) : (
            <>Já tem conta? <button onClick={() => setModo('entrar')}>Entrar</button></>
          )}
        </div>
      </div>
    </div>
  )
}
