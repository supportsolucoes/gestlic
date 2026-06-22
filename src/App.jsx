import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Painel from './pages/Painel'
import Processos from './pages/Processos'
import Contratos from './pages/Contratos'
import Empenhos from './pages/Empenhos'
import Cadastros from './pages/Cadastros'

function Rotas() {
  const { session, ehAdmin, carregando } = useAuth()

  if (carregando) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>Carregando...</div>
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Painel />} />
        <Route path="/processos" element={<Processos />} />
        <Route path="/contratos" element={<Contratos />} />
        <Route path="/empenhos" element={<Empenhos />} />
        <Route path="/cadastros" element={ehAdmin ? <Cadastros /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Rotas />
      </AuthProvider>
    </BrowserRouter>
  )
}
