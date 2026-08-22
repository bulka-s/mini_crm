package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

type Computer struct {
	ID             int    `json:"id"`
	IPAddress      string `json:"ip_address"`
	Hostname       string `json:"hostname"`
	LastName       string `json:"last_name"`
	FirstName      string `json:"first_name"`
	MiddleName     string `json:"middle_name"`
	Phone          string `json:"phone"`
	Cabinet        string `json:"cabinet"`
	DepartmentName string `json:"department_name"`
	PCStatus       string `json:"pc_status"`
	Note           string `json:"note"`
}

func createComputerHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		if r.Method == http.MethodPost {
			// POST
			var computer Computer

			defer r.Body.Close()
			err := json.NewDecoder(r.Body).Decode(&computer)
			if err != nil {
				http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
				return
			}

			addPCSql := `INSERT INTO computers (
				ip_address,
				hostname,
				last_name,
				first_name,
				middle_name,
				phone,
				cabinet,
				department_name,
				pc_status,
				note
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

			_, err = db.Exec(addPCSql,
				computer.IPAddress,
				computer.Hostname,
				computer.LastName,
				computer.FirstName,
				computer.MiddleName,
				computer.Phone,
				computer.Cabinet,
				computer.DepartmentName,
				computer.PCStatus,
				computer.Note)

			if err != nil {
				http.Error(w, "Ошибка записи в БД", http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]string{
				"message": "Computer created",
			})

		} else if r.Method == http.MethodGet {
			// GET
			search := r.URL.Query().Get("search")

			query := `
				SELECT
					id,
					ip_address,
					hostname,
					last_name,
					first_name,
					middle_name,
					phone,
					cabinet,
					department_name,
					pc_status,
					note
				FROM computers`

			var args []interface{}

			if search != "" {
				query += ` WHERE
				ip_address LIKE ?
				OR hostname LIKE ?
				OR last_name LIKE ?
				OR first_name LIKE ?
				OR middle_name LIKE ?
				OR phone LIKE ?
				OR cabinet LIKE ?
				OR department_name LIKE ?
				OR pc_status LIKE ?
				OR note LIKE ?`

				likePattern := "%" + search + "%"

				args = []interface{}{
					likePattern, likePattern, likePattern,
					likePattern, likePattern, likePattern,
					likePattern, likePattern, likePattern,
					likePattern,
				}
			}

			rows, err := db.Query(query, args...)

			if err != nil {
				http.Error(w, "Ошибка чтения БД", http.StatusInternalServerError)
				return
			}
			defer rows.Close()

			computers := make([]Computer, 0)

			for rows.Next() {
				var computer Computer

				err := rows.Scan(
					&computer.ID,
					&computer.IPAddress,
					&computer.Hostname,
					&computer.LastName,
					&computer.FirstName,
					&computer.MiddleName,
					&computer.Phone,
					&computer.Cabinet,
					&computer.DepartmentName,
					&computer.PCStatus,
					&computer.Note,
				)

				if err != nil {
					http.Error(w, "Ошибка чтения БД", http.StatusInternalServerError)
					return
				}

				computers = append(computers, computer)
			}

			if err := rows.Err(); err != nil {
				http.Error(w, "Ошибка чтения БД", http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(computers)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
	}
}
