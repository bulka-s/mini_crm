import type { Computer, ComputerFormData } from "../types/computer"

async function getComputers(search: string = ""): Promise<Computer[]> {
    const url = `/computers?search=${encodeURIComponent(search)}`

    const response = await fetch(url)

    if (!response.ok) {
        throw new Error("Ошибка загрузки компьютеров")
    }

    const computers: Computer[] | null = await response.json()

    return computers ?? []
}

async function createComputer(data:ComputerFormData): Promise<void> {
    const response = await fetch("/computers", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    })

    if (!response.ok) {
        throw new Error("Ошибка добаления записи")
    }
}

export default {getComputers, createComputer}