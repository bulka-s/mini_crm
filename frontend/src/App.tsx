import { useEffect, useState, type FormEvent } from 'react'
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
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [darkTheme, setDarkTheme] = useState(() => localStorage.getItem('mchs-theme') === 'dark')

  useEffect(() => {
    document.documentElement.dataset.theme = darkTheme ? 'dark' : 'light'
    localStorage.setItem('mchs-theme', darkTheme ? 'dark' : 'light')
  }, [darkTheme])

  useEffect(() => {
    function onHashChange() {
      setRoute(currentRoute())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    void fetch('/auth/session').then((response) => response.json()).then((data: { authenticated: boolean }) => setAuthenticated(data.authenticated)).catch(() => setAuthenticated(false))
  }, [])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthError(''); setAuthBusy(true)
    try {
      const response = await fetch('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, remember }) })
      const data = await response.json() as { error?: string; authenticated?: boolean }
      if (!response.ok) throw new Error(data.error ?? 'Не удалось войти')
      setAuthenticated(true); setPassword('')
    } catch (err) { setAuthError(err instanceof Error ? err.message : 'Не удалось войти') }
    finally { setAuthBusy(false) }
  }

  if (authenticated === null) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Проверка доступа…</div>
  if (!authenticated) return (
    <main className="grid min-h-screen place-items-center p-4">
      <form onSubmit={handleLogin} className="surface-card w-full max-w-sm space-y-4 p-7">
        <div className="mb-5"><h1 className="text-xl font-bold text-slate-900">MCHS CRM</h1><p className="mt-0.5 text-sm text-slate-500">Общий реестр устройств</p></div>
        {authError && <p role="alert" className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{authError}</p>}
        <label className="block text-sm font-medium text-slate-700">Логин<input required autoComplete="username" className="field mt-1" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label className="block text-sm font-medium text-slate-700">Пароль<input required type="password" autoComplete="current-password" className="field mt-1" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />Запомнить меня на этом компьютере</label>
        <button disabled={authBusy} className="btn btn-primary w-full" type="submit">{authBusy ? 'Входим…' : 'Войти'}</button>
      </form>
    </main>
  )

  async function handleLogout() {
    await fetch('/auth/session', { method: 'DELETE' }); setAuthenticated(false)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-6 border-b border-slate-200 bg-white px-5">
        <p className="text-sm font-semibold text-slate-800">MCHS CRM</p>
        <nav className="flex h-full items-stretch">
          <NavLink href="#/" active={route === 'computers'}>
            Устройства
          </NavLink>
          <NavLink href="#/tasks" active={route === 'tasks'}>
            Задачи
          </NavLink>
        </nav>
        <button type="button" onClick={() => void handleLogout()} className="ml-auto text-sm text-slate-500 hover:text-slate-800">Выйти</button>
        <button type="button" onClick={() => setDarkTheme((value) => !value)} className="text-sm text-slate-500 hover:text-slate-800" aria-label={darkTheme ? 'Включить светлую тему' : 'Включить тёмную тему'} title={darkTheme ? 'Светлая тема' : 'Тёмная тема'}>{darkTheme ? '☀' : '◐'}</button>
      </header>
      {route === 'tasks' ? <TasksPage /> : <ComputersPage />}
    </div>
  )
}

export default App
