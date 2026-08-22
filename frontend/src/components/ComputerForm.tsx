import { useState } from "react"
import type { ComputerFormData } from "../types/computer"
import { createComputer } from "../api/computers"

function ComputerForm() {
  const [formData, setFormData] = useState<ComputerFormData>({
    ip_address: "",
    hostname: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    phone: "",
    cabinet: "",
    department_name: "",
    pc_status: "",
    note: "",

  })

  const labels = {
    ip_address: "IP адрес",
    hostname: "Hostname",
    last_name: "Фамилия",
    first_name: "Имя",
    middle_name: "Отчество",
    phone: "Телефон",
    cabinet: "Кабинет",
    department_name: "Отдел",
    pc_status: "Статус",
    note: "Примечание",
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
        await createComputer(formData)

        console.log("Компьютер создан")
    } catch (error) {
        console.error(error)
    }
}

  return (
    <div className="fixed inset-0 bg-black/30">
      {/* Панель */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">

        {/* Заголовок */}
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-xl font-bold">
            Добавить компьютер
          </h2>

          <button
            type="button"
            className="text-2xl text-gray-500 hover:text-gray-900"
          >
            ×
          </button>
        </div>

        {/* Прокручиваемая область */}
        <div className="h-[calc(100%-73px)] overflow-y-auto p-5">
          <form
            onSubmit={handleSubmit}>
            {Object.entries(labels).map(([name, label]) => (
              <div key={name} className="mb-4 flex flex-col">
                <label
                  htmlFor={name}
                  className="mb-1 font-medium text-gray-700"
                >
                  {label}
                </label>

                <input
                  id={name}
                  name={name}
                  type="text"
                  value={formData[name as keyof ComputerFormData]}
                  onChange={event => {
                    setFormData({
                      ...formData,
                      [name]: event.target.value
                    })
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>
            ))}

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700"
            >
              Сохранить
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}



export default ComputerForm