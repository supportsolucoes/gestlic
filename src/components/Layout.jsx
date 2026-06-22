import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, FileText, FileSignature, Receipt, Settings, LogOut, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const LINKS = [
  { to: '/', label: 'Painel', Icon: LayoutGrid },
  { to: '/processos', label: 'Processos', Icon: FileText },
  { to: '/contratos', label: 'Relatório de contratos', Icon: FileSignature },
  { to: '/empenhos', label: 'Relatório de empenhos', Icon: Receipt },
  { to: '/cadastros', label: 'Cadastros', Icon: Settings, adminOnly: true },
]

const CHAVE_RECOLHIDO = 'sidebar-recolhido'

export default function Layout() {
  const { perfil, ehAdmin, sair } = useAuth()
  const [recolhido, setRecolhido] = useState(() => {
    try { return localStorage.getItem(CHAVE_RECOLHIDO) === '1' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem(CHAVE_RECOLHIDO, recolhido ? '1' : '0') } catch { /* ignora ambiente sem storage */ }
  }, [recolhido])

  return (
    <div className="app-shell">
      <aside className={'sidebar' + (recolhido ? ' sidebar-recolhido' : '')}>
        <div className="sidebar-brand">
          <span className="sidebar-link-texto">
            Gestor de Licitações
            <small>Pós-ganho · ATA · Empenho</small>
          </span>
        </div>
        <nav className="sidebar-nav">
          {LINKS.filter(l => !l.adminOnly || ehAdmin).map(link => {
            const Icon = link.Icon
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
                title={recolhido ? link.label : undefined}
              >
                <Icon size={16} aria-hidden="true" className="sidebar-link-icon" />
                <span className="sidebar-link-texto">{link.label}</span>
              </NavLink>
            )
          })}
        </nav>
        <button
          className="sidebar-toggle"
          onClick={() => setRecolhido(r => !r)}
          aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
          title={recolhido ? 'Expandir menu' : 'Recolher menu'}
        >
          {recolhido ? <ChevronsRight size={15} aria-hidden="true" /> : <ChevronsLeft size={15} aria-hidden="true" />}
          <span className="sidebar-link-texto">Recolher menu</span>
        </button>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-link-texto">
              <div className="sidebar-user-name">{perfil?.nome || '...'}</div>
              <div className="sidebar-user-role">{perfil?.papel === 'admin' ? 'Administrador' : 'Operador'}</div>
            </div>
            <button className="btn-logout" onClick={sair} aria-label="Sair da conta" title="Sair">
              <LogOut size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
