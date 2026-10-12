import { useEffect, useState } from 'react'
import ComputersPage from './pages/ComputersPage'
import TasksPage from './pages/TasksPage'

type Route = 'computers' | 'tasks'

function currentRoute(): Route {
  return window.location.hash.startsWith('#/tasks') ? 'tasks' : 'computers'
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: string
}) {
  return (
    <a
      href={href}
      className={`px-3 py-3 text-sm ${
        active
          ? 'border-b-2 border-slate-700 font-medium text-slate-900'
          : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </a>
  )
}

function App() {
  const [route, setRoute] = useState<Route>(currentRoute)

  useEffect(() => {
    function onHashChange() {
      setRoute(currentRoute())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center gap-6 border-b border-slate-200 bg-white px-5">
        <p className="text-sm font-semibold text-slate-800">MCHS CRM</p>
        <nav className="flex items-stretch self-stretch">
          <NavLink href="#/" active={route === 'computers'}>
            Компьютеры
          </NavLink>
          <NavLink href="#/tasks" active={route === 'tasks'}>
            Задачи
          </NavLink>
        </nav>
      </header>
      {route === 'tasks' ? <TasksPage /> : <ComputersPage />}
    </div>
  )
}

export default App
