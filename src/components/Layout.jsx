import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, FileText, FileSignature, Receipt, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const LINKS = [
  { to: '/', label: 'Painel', Icon: LayoutGrid },
  { to: '/processos', label: 'Processos', Icon: FileText },
  { to: '/contratos', label: 'Contratos / ATA', Icon: FileSignature },
  { to: '/empenhos', label: 'Empenhos', Icon: Receipt },
  { to: '/cadastros', label: 'Cadastros', Icon: Settings, adminOnly: true },
]

export default function Layout() {
  const { perfil, ehAdmin, sair } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          Gestor de Licitações
          <small>Pós-ganho · ATA · Empenho</small>
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
              >
                <Icon size={16} aria-hidden="true" /> {link.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div>
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
