package main

import (
	"database/sql"
	"encoding/binary"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
)

type Building struct {
	ID             int               `json:"id"`
	Name           string            `json:"name"`
	Address        string            `json:"address"`
	ComputersCount int               `json:"computers_count"`
	Networks       []BuildingNetwork `json:"networks"`
}

type BuildingNetwork struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	CIDR string `json:"cidr"`
}

func validBuildingNetworks(networks []BuildingNetwork) error {
	seen := map[string]bool{}
	for i := range networks {
		networks[i].Name = strings.TrimSpace(networks[i].Name)
		networks[i].CIDR = strings.TrimSpace(networks[i].CIDR)
		if networks[i].Name == "" || networks[i].CIDR == "" {
			return validationError{"укажите для сети название и адрес с маской, например 10.110.1.0/24"}
		}
		ip, subnet, err := net.ParseCIDR(networks[i].CIDR)
		if err != nil || ip.To4() == nil {
			return validationError{fmt.Sprintf("некорректная сеть %q: укажите IPv4-адрес и маску в формате CIDR", networks[i].Name)}
		}
		if ones, bits := subnet.Mask.Size(); bits != 32 || ones < 1 || ones > 32 {
			return validationError{fmt.Sprintf("некорректная маска сети %q", networks[i].Name)}
		}
		if !ip.Equal(ip.To4().Mask(subnet.Mask)) {
			return validationError{fmt.Sprintf("в сети %q укажите адрес сети, например 10.110.1.0/24", networks[i].Name)}
		}
		key := strings.ToLower(networks[i].Name)
		if seen[key] {
			return validationError{"названия сетей в здании должны отличаться"}
		}
		seen[key] = true
	}
	return nil
}

func getBuildingNetworks(db *sql.DB, buildingID int) ([]BuildingNetwork, error) {
	rows, err := db.Query(`SELECT id, name, cidr FROM building_networks WHERE building_id = ? ORDER BY id`, buildingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []BuildingNetwork{}
	for rows.Next() {
		var n BuildingNetwork
		if err := rows.Scan(&n.ID, &n.Name, &n.CIDR); err != nil {
			return nil, err
		}
		items = append(items, n)
	}
	return items, rows.Err()
}

func saveBuildingNetworksTx(tx *sql.Tx, buildingID int, networks []BuildingNetwork) error {
	if _, err := tx.Exec(`DELETE FROM building_networks WHERE building_id = ?`, buildingID); err != nil {
		return err
	}
	for _, n := range networks {
		if _, err := tx.Exec(`INSERT INTO building_networks (building_id, name, cidr) VALUES (?, ?, ?)`, buildingID, n.Name, n.CIDR); err != nil {
			return err
		}
	}
	return nil
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
	return validBuildingNetworks(b.Networks)
}

func scanBuilding(id int, name, address string, count int) Building {
	return Building{
		ID:             id,
		Name:           name,
		Address:        address,
		ComputersCount: count,
	}
}

func listBuildings(db *sql.DB) (buildingsOverview, error) {
	rows, err := db.Query(`
		SELECT
			b.id,
			COALESCE(b.name, ''),
			COALESCE(b.address, ''),
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
		var id, count int
		var name, address string
		if err := rows.Scan(&id, &name, &address, &count); err != nil {
			return buildingsOverview{}, err
		}
		building := scanBuilding(id, name, address, count)
		building.Networks, err = getBuildingNetworks(db, id)
		if err != nil {
			return buildingsOverview{}, err
		}
		items = append(items, building)
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
			COUNT(c.id)
		FROM buildings b
		LEFT JOIN computers c ON c.building_id = b.id
		WHERE b.id = ?
		GROUP BY b.id
	`, id)

	var buildingID, count int
	var name, address string
	if err := row.Scan(&buildingID, &name, &address, &count); err != nil {
		return Building{}, err
	}
	b := scanBuilding(buildingID, name, address, count)
	networks, err := getBuildingNetworks(db, id)
	b.Networks = networks
	return b, err
}

func insertBuilding(db *sql.DB, building Building) (Building, error) {
	trimBuilding(&building)
	if err := validateBuilding(building); err != nil {
		return Building{}, err
	}

	tx, err := db.Begin()
	if err != nil {
		return Building{}, err
	}
	result, err := tx.Exec(
		`INSERT INTO buildings (name, address) VALUES (?, ?)`,
		building.Name,
		building.Address,
	)
	if err != nil {
		_ = tx.Rollback()
		return Building{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		_ = tx.Rollback()
		return Building{}, err
	}
	if err := saveBuildingNetworksTx(tx, int(id), building.Networks); err != nil {
		_ = tx.Rollback()
		return Building{}, err
	}
	if err := tx.Commit(); err != nil {
		return Building{}, err
	}
	return getBuildingByID(db, int(id))
}

func updateBuilding(db *sql.DB, id int, building Building) (Building, error) {
	trimBuilding(&building)
	if err := validateBuilding(building); err != nil {
		return Building{}, err
	}

	tx, err := db.Begin()
	if err != nil {
		return Building{}, err
	}
	result, err := tx.Exec(
		`UPDATE buildings SET name = ?, address = ? WHERE id = ?`,
		building.Name,
		building.Address,
		id,
	)
	if err != nil {
		_ = tx.Rollback()
		return Building{}, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		_ = tx.Rollback()
		return Building{}, err
	}
	if affected == 0 {
		_ = tx.Rollback()
		return Building{}, sql.ErrNoRows
	}
	if err := saveBuildingNetworksTx(tx, id, building.Networks); err != nil {
		_ = tx.Rollback()
		return Building{}, err
	}
	if err := tx.Commit(); err != nil {
		return Building{}, err
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

func buildingMatches(b Building, search string) bool {
	needle := strings.ToLower(strings.TrimSpace(search))
	if needle == "" {
		return true
	}
	if strings.Contains(strings.ToLower(b.Name), needle) || strings.Contains(strings.ToLower(b.Address), needle) {
		return true
	}
	for _, n := range b.Networks {
		if strings.Contains(strings.ToLower(n.Name), needle) || strings.Contains(strings.ToLower(n.CIDR), needle) {
			return true
		}
	}
	return false
}

func listBuildingsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		overview, err := listBuildings(db)
		if handleDBError(w, err, "Здание не найдено") {
			return
		}
		if search := strings.TrimSpace(r.URL.Query().Get("search")); search != "" {
			filtered := make([]Building, 0, len(overview.Items))
			for _, item := range overview.Items {
				if buildingMatches(item, search) {
					filtered = append(filtered, item)
				}
			}
			overview.Items = filtered
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

func availableIPsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.PathValue("id"))
		if err != nil || id < 1 {
			writeError(w, http.StatusBadRequest, "Некорректный идентификатор сети")
			return
		}
		var buildingID int
		var cidr string
		if err := db.QueryRow(`SELECT building_id, cidr FROM building_networks WHERE id = ?`, id).Scan(&buildingID, &cidr); err != nil {
			if err == sql.ErrNoRows {
				writeError(w, http.StatusNotFound, "Сеть не найдена")
			} else {
				writeError(w, http.StatusInternalServerError, "Не удалось загрузить сеть")
			}
			return
		}
		ip, subnet, err := net.ParseCIDR(cidr)
		if err != nil || ip.To4() == nil {
			writeError(w, http.StatusBadRequest, "Поддерживаются только сети IPv4")
			return
		}
		base := ip.To4().Mask(subnet.Mask)
		bits, _ := subnet.Mask.Size()
		start := binary.BigEndian.Uint32(base)
		count := uint64(1) << uint(32-bits)
		first, last := uint64(start), uint64(start)+count-1
		if bits < 31 {
			first++
			last--
		}
		rows, err := db.Query(`SELECT ip_address FROM computers WHERE building_id = ? AND TRIM(ip_address) != ''`, buildingID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Не удалось загрузить занятые адреса")
			return
		}
		used := map[uint32]bool{}
		for rows.Next() {
			var value string
			if rows.Scan(&value) == nil {
				if parsed := net.ParseIP(value).To4(); parsed != nil {
					used[binary.BigEndian.Uint32(parsed)] = true
				}
			}
		}
		_ = rows.Close()
		ips := make([]string, 0, 512)
		for value := first; value <= last && len(ips) < 4096; value++ {
			if !used[uint32(value)] {
				var bytes [4]byte
				binary.BigEndian.PutUint32(bytes[:], uint32(value))
				ips = append(ips, net.IP(bytes[:]).String())
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": ips, "truncated": uint64(len(ips)) < last-first+1 && len(ips) == 4096})
	}
}
