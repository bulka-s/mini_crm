package main

import (
	"database/sql"
	"net/http"
	"strings"
)

type Building struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	Address        string `json:"address"`
	ShowFullName   bool   `json:"show_full_name"`
	ComputersCount int    `json:"computers_count"`
}

type buildingsOverview struct {
	Items      []Building `json:"items"`
	Unassigned int        `json:"unassigned"`
	Total      int        `json:"total"`
}

func trimBuilding(b *Building) {
	b.Name = strings.TrimSpace(b.Name)
	b.Address = strings.TrimSpace(b.Address)
}

func validateBuilding(b Building) error {
	if b.Name == "" {
		return validationError{"название здания обязательно"}
	}
	return nil
}

func scanBuilding(id int, name, address string, showFullName int, count int) Building {
	return Building{
		ID:             id,
		Name:           name,
		Address:        address,
		ShowFullName:   showFullName != 0,
		ComputersCount: count,
	}
}

func listBuildings(db *sql.DB) (buildingsOverview, error) {
	rows, err := db.Query(`
		SELECT
			b.id,
			COALESCE(b.name, ''),
			COALESCE(b.address, ''),
			COALESCE(b.show_full_name, 0),
			COUNT(c.id)
		FROM buildings b
		LEFT JOIN computers c ON c.building_id = b.id
		GROUP BY b.id
		ORDER BY b.name COLLATE NOCASE, b.id
	`)
	if err != nil {
		return buildingsOverview{}, err
	}
	defer rows.Close()

	items := make([]Building, 0)
	for rows.Next() {
		var id, showFullName, count int
		var name, address string
		if err := rows.Scan(&id, &name, &address, &showFullName, &count); err != nil {
			return buildingsOverview{}, err
		}
		items = append(items, scanBuilding(id, name, address, showFullName, count))
	}
	if err := rows.Err(); err != nil {
		return buildingsOverview{}, err
	}

	var unassigned, total int
	if err := db.QueryRow(`SELECT COUNT(*) FROM computers WHERE building_id IS NULL`).Scan(&unassigned); err != nil {
		return buildingsOverview{}, err
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM computers`).Scan(&total); err != nil {
		return buildingsOverview{}, err
	}

	return buildingsOverview{Items: items, Unassigned: unassigned, Total: total}, nil
}

func getBuildingByID(db *sql.DB, id int) (Building, error) {
	row := db.QueryRow(`
		SELECT
			b.id,
			COALESCE(b.name, ''),
			COALESCE(b.address, ''),
			COALESCE(b.show_full_name, 0),
			COUNT(c.id)
		FROM buildings b
		LEFT JOIN computers c ON c.building_id = b.id
		WHERE b.id = ?
		GROUP BY b.id
	`, id)

	var buildingID, showFullName, count int
	var name, address string
	if err := row.Scan(&buildingID, &name, &address, &showFullName, &count); err != nil {
		return Building{}, err
	}
	return scanBuilding(buildingID, name, address, showFullName, count), nil
}

func insertBuilding(db *sql.DB, building Building) (Building, error) {
	trimBuilding(&building)
	if err := validateBuilding(building); err != nil {
		return Building{}, err
	}

	result, err := db.Exec(
		`INSERT INTO buildings (name, address, show_full_name) VALUES (?, ?, ?)`,
		building.Name,
		building.Address,
		boolToInt(building.ShowFullName),
	)
	if err != nil {
		return Building{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return Building{}, err
	}
	return getBuildingByID(db, int(id))
}

func updateBuilding(db *sql.DB, id int, building Building) (Building, error) {
	trimBuilding(&building)
	if err := validateBuilding(building); err != nil {
		return Building{}, err
	}

	result, err := db.Exec(
		`UPDATE buildings SET name = ?, address = ?, show_full_name = ? WHERE id = ?`,
		building.Name,
		building.Address,
		boolToInt(building.ShowFullName),
		id,
	)
	if err != nil {
		return Building{}, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return Building{}, err
	}
	if affected == 0 {
		return Building{}, sql.ErrNoRows
	}
	return getBuildingByID(db, id)
}

func deleteBuilding(db *sql.DB, id int) error {
	if _, err := db.Exec(`UPDATE computers SET building_id = NULL WHERE building_id = ?`, id); err != nil {
		return err
	}
	if _, err := db.Exec(`UPDATE tasks SET building_id = NULL WHERE building_id = ?`, id); err != nil {
		return err
	}
	result, err := db.Exec(`DELETE FROM buildings WHERE id = ?`, id)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func findOrCreateBuilding(db *sql.DB, name, address string) (*int, error) {
	name = strings.TrimSpace(name)
	address = strings.TrimSpace(address)
	if name == "" {
		return nil, nil
	}

	var id int
	err := db.QueryRow(`SELECT id FROM buildings WHERE name = ? COLLATE NOCASE LIMIT 1`, name).Scan(&id)
	if err == nil {
		if address != "" {
			_, _ = db.Exec(`UPDATE buildings SET address = CASE WHEN TRIM(COALESCE(address, '')) = '' THEN ? ELSE address END WHERE id = ?`, address, id)
		}
		return &id, nil
	}
	if err != sql.ErrNoRows {
		return nil, err
	}

	created, err := insertBuilding(db, Building{Name: name, Address: address})
	if err != nil {
		return nil, err
	}
	return &created.ID, nil
}

func listBuildingsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		overview, err := listBuildings(db)
		if handleDBError(w, err, "Здание не найдено") {
			return
		}
		writeJSON(w, http.StatusOK, overview)
	}
}

func createBuildingHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var building Building
		if err := decodeJSON(r, &building); err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный JSON")
			return
		}
		created, err := insertBuilding(db, building)
		if handleDBError(w, err, "Здание не найдено") {
			return
		}
		writeJSON(w, http.StatusCreated, created)
	}
}

func getBuildingHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := parsePathID(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
			return
		}
		building, err := getBuildingByID(db, id)
		if handleDBError(w, err, "Здание не найдено") {
			return
		}
		writeJSON(w, http.StatusOK, building)
	}
}

func updateBuildingHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := parsePathID(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
			return
		}
		var building Building
		if err := decodeJSON(r, &building); err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный JSON")
			return
		}
		updated, err := updateBuilding(db, id, building)
		if handleDBError(w, err, "Здание не найдено") {
			return
		}
		writeJSON(w, http.StatusOK, updated)
	}
}

func deleteBuildingHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := parsePathID(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
			return
		}
		if err := deleteBuilding(db, id); handleDBError(w, err, "Здание не найдено") {
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
