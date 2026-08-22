import type { Computer } from "../types/computer";

interface ComputersTableProps {
	computers: Computer[]
}

function ComputersTable({ computers }: ComputersTableProps) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full">
				<thead>
					<tr className="text-left">
						<th>IP</th>
						<th>Компьютер</th>
						<th>Пользователь</th>
						<th>Телефон</th>
						<th>Кабинет</th>
						<th>Отдел</th>
						<th>Статус</th>
					</tr>
				</thead>
				<tbody>
					{computers.map(computer => (
						<tr key={computer.id}>
							<td>{computer.ip_address}</td>
							<td>{computer.hostname}</td>
							<td>{computer.last_name} {computer.first_name} {computer.middle_name}</td>
							<td>{computer.phone}</td>
							<td>{computer.cabinet}</td>
							<td>{computer.department_name}</td>
							<td>{computer.pc_status}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

export default ComputersTable