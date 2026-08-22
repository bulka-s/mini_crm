import './App.css'
import { useEffect, useState } from 'react'
import { getComputers } from './api/computers'
import type { Computer } from './types/computer'
import ComputersTable from './components/ComputersTable'
import ComputerForm from './components/ComputerForm'


function App() {
  const [computers, setComputers] = useState<Computer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function handleSearch() {
    try {
        const data = await getComputers(search)
        setComputers(data)
      } catch (error) {
        setError(`Не удалось загрузить компьютеры ${error}`)
      }
    
  }

  async function loadComputers() {
    try {
      const data = await getComputers()
      setComputers(data)
    } catch (error) {
      setError(`Не удалось загрузить компьютеры ${error}`)
    }
  }

  useEffect(() => {
    loadComputers()
  }, [])

  return (
    <main className="min-h-screen bg-gray-100 p-8">

      <h1 className="text-3xl font-bold text-gray-900">
        MCHS CRM
      </h1>
      <div>
        <input 
          type="text"
          placeholder='Поиск...'
          className='border-2 rounded-xl p-1.5 my-3'
          value={search}
          onChange={event => setSearch(event.target.value)}/>
        <button 
          className='bg-gray-500 text-white rounded-xl p-2 px-4 m-3'
          onClick={handleSearch}
        >Найти</button>
        <button
          className='rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700'
          onClick={() => setShowForm(true)}
        >
          Добавить компьютер
        </button>
      </div>
      {error && (
        <p className="text-red-500">{error}</p>
      )}

      <p className="mt-2 text-gray-600">
        Найдено компьютеров: {computers.length}
      </p>

      <div className='mt-6'>
        <ComputersTable computers={computers}/>
      </div>

      {showForm && (
        <ComputerForm
          onClose={() => setShowForm(false)}
          onCreated={loadComputers}
        />
      )}
    </main>
  )
}



export default App
