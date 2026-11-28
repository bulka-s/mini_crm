import { useEffect, useState, type FormEvent } from 'react'
import { UNAUTHORIZED_EVENT } from './api/http'
import { LogoutIcon, MoonIcon, SunIcon } from './components/Icons'
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
      className={`relative flex items-center px-3.5 text-sm font-medium transition-colors ${
        active
          ? 'text-slate-900'
          : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-slate-800" />
      )}
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
    function onUnauthorized() {
      setAuthenticated(false)
    }
    window.addEventListener('hashchange', onHashChange)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    }
  }, [])

  useEffect(() => {
    void fetch('/auth/session')
      .then((response) => response.json())
      .then((data: { authenticated: boolean }) => setAuthenticated(data.authenticated))
      .catch(() => setAuthenticated(false))
  }, [])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    setAuthBusy(true)
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember }),
      })
      const data = (await response.json()) as { error?: string; authenticated?: boolean }
      if (!response.ok) throw new Error(data.error ?? 'Не удалось войти')
      setAuthenticated(true)
      setPassword('')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Не удалось войти')
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleLogout() {
    await fetch('/auth/session', { method: 'DELETE' })
    setAuthenticated(false)
  }

  if (authenticated === null) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-500">
        Проверка доступа…
      </div>
    )
  }

  if (!authenticated) {
    return (
      <main className="relative grid min-h-screen place-items-center p-4">
        <button
          type="button"
          onClick={() => setDarkTheme((value) => !value)}
          className="icon-btn fixed right-4 top-4"
          aria-label={darkTheme ? 'Включить светлую тему' : 'Включить тёмную тему'}
          title={darkTheme ? 'Светлая тема' : 'Тёмная тема'}
        >
          {darkTheme ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </button>
        <form onSubmit={handleLogin} className="surface-card w-full max-w-sm space-y-4 p-7">
          <div className="mb-5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">MCHS CRM</h1>
            <p className="mt-1 text-sm text-slate-500">Общий реестр устройств и задач</p>
          </div>
          {authError && (
            <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {authError}
            </p>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Логин
            <input
              required
              autoFocus
              autoComplete="username"
              className="field mt-1"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Пароль
            <input
              required
              type="password"
              autoComplete="current-password"
              className="field mt-1"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-slate-700"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Запомнить меня на этом компьютере
          </label>
          <button disabled={authBusy} className="btn btn-primary w-full py-2.5" type="submit">
            {authBusy ? 'Входим…' : 'Войти'}
          </button>
        </form>
      </main>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-5 border-b border-slate-200 bg-white px-4 md:px-5">
        <a href="#/" className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-900">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-[11px] font-bold text-white">
            М
          </span>
          <span>MCHS CRM</span>
        </a>
        <nav className="flex h-full items-stretch">
          <NavLink href="#/" active={route === 'computers'}>
            Устройства
          </NavLink>
          <NavLink href="#/tasks" active={route === 'tasks'}>
            Задачи
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDarkTheme((value) => !value)}
            className="icon-btn"
            aria-label={darkTheme ? 'Включить светлую тему' : 'Включить тёмную тему'}
            title={darkTheme ? 'Светлая тема' : 'Тёмная тема'}
          >
            {darkTheme ? <SunIcon size={17} /> : <MoonIcon size={17} />}
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="icon-btn gap-1.5 px-2.5 text-xs font-medium"
            title="Выйти из учётной записи"
          >
            <LogoutIcon size={15} />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </header>
      {route === 'tasks' ? <TasksPage /> : <ComputersPage />}
    </div>
  )
}

export default App
