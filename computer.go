package main

import (
	"bytes"
	"database/sql"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"sort"
	"strconv"
	"strings"
)

const computerSelect = `
	c.id,
	COALESCE(c.ip_address, ''),
	COALESCE(c.hostname, ''),
	COALESCE(c.phone, ''),
	COALESCE(c.department_name, ''),
	COALESCE(c.pc_status, ''),
	COALESCE(c.note, ''),
	COALESCE(c.device_type, 'computer'),
	COALESCE(c.operating_system, ''),
	COALESCE(c.mac_address, ''),
	c.building_id,
	COALESCE(b.name, ''),
	COALESCE(b.address, '')
`

type Computer struct {
	ID              int    `json:"id"`
	IPAddress       string `json:"ip_address"`
	Hostname        string `json:"hostname"`
	Phone           string `json:"phone"`
	MACAddress      string `json:"mac_address"`
	DepartmentName  string `json:"department_name"`
	PCStatus        string `json:"pc_status"`
	DeviceType      string `json:"device_type"`
	OperatingSystem string `json:"operating_system"`
	Note            string `json:"note"`
	BuildingID      *int   `json:"building_id"`
	BuildingName    string `json:"building_name"`
	BuildingAddress string `json:"building_address"`
	Network         string `json:"network"`
	NetworkLabel    string `json:"network_label"`
}

type computerInput struct {
	IPAddress       string `json:"ip_address"`
	Hostname        string `json:"hostname"`
	Phone           string `json:"phone"`
	MACAddress      string `json:"mac_address"`
	DepartmentName  string `json:"department_name"`
	PCStatus        string `json:"pc_status"`
	DeviceType      string `json:"device_type"`
	OperatingSystem string `json:"operating_system"`
	Note            string `json:"note"`
	BuildingID      *int   `json:"building_id"`
}

func (in computerInput) toComputer() Computer {
	return Computer{
		IPAddress:       strings.TrimSpace(in.IPAddress),
		Hostname:        strings.TrimSpace(in.Hostname),
		Phone:           strings.TrimSpace(in.Phone),
		MACAddress:      normalizeMACAddress(in.MACAddress),
		DepartmentName:  strings.TrimSpace(in.DepartmentName),
		PCStatus:        strings.TrimSpace(in.PCStatus),
		DeviceType:      defaultString(strings.TrimSpace(in.DeviceType), "computer"),
		OperatingSystem: strings.TrimSpace(in.OperatingSystem),
		Note:            strings.TrimSpace(in.Note),
		BuildingID:      in.BuildingID,
	}
}

func normalizeMACAddress(value string) string {
	value = strings.TrimSpace(value)
	if parsed, err := net.ParseMAC(value); err == nil && len(parsed) == 6 {
		return parsed.String()
	}
	return value
}

func defaultString(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func applyNetwork(computer *Computer) {
	computer.Network = classifyNetwork(computer.IPAddress)
	computer.NetworkLabel = networkLabel(computer.Network)
}

func applyBuildingNetworkLabel(db *sql.DB, computer *Computer) {
	if computer.BuildingID == nil || computer.IPAddress == "" {
		return
	}
	rows, err := db.Query(`SELECT name, cidr FROM building_networks WHERE building_id = ? AND cidr != '' ORDER BY id`, *computer.BuildingID)
	if err != nil {
		return
	}
	defer rows.Close()
	ip := net.ParseIP(computer.IPAddress)
	for rows.Next() {
		var name, cidr string
		if rows.Scan(&name, &cidr) != nil {
			continue
		}
		_, subnet, err := net.ParseCIDR(cidr)
		if err == nil && subnet.Contains(ip) {
			computer.NetworkLabel = name
			return
		}
	}
}

func validateComputer(c Computer) error {
	if c.Hostname == "" && c.IPAddress == "" {
		return validationError{"укажите IP-адрес или имя устройства"}
	}
	if c.IPAddress != "" && net.ParseIP(c.IPAddress) == nil {
		return validationError{"некорректный IP-адрес"}
	}
	if c.MACAddress != "" {
		mac, err := net.ParseMAC(c.MACAddress)
		if err != nil || len(mac) != 6 {
			return validationError{"некорректный MAC-адрес, используйте формат AA:BB:CC:DD:EE:FF"}
		}
	}
	return nil
}

func nullInt(id *int) any {
	if id == nil || *id < 1 {
		return nil
	}
	return *id
}

func intPtr(value sql.NullInt64) *int {
	if !value.Valid {
		return nil
	}
	id := int(value.Int64)
	return &id
}

func scanComputer(scanner interface{ Scan(dest ...any) error }) (Computer, error) {
	var computer Computer
	var buildingID sql.NullInt64
	err := scanner.Scan(
		&computer.ID,
		&computer.IPAddress,
		&computer.Hostname,
		&computer.Phone,
		&computer.DepartmentName,
		&computer.PCStatus,
		&computer.Note,
		&computer.DeviceType,
		&computer.OperatingSystem,
		&computer.MACAddress,
		&buildingID,
		&computer.BuildingName,
		&computer.BuildingAddress,
	)
	if err != nil {
		return Computer{}, err
	}
	computer.BuildingID = intPtr(buildingID)
	applyNetwork(&computer)
	return computer, nil
}

func getComputerByID(db *sql.DB, id int) (Computer, error) {
	row := db.QueryRow(`SELECT `+computerSelect+`
		FROM computers c
		LEFT JOIN buildings b ON b.id = c.building_id
		WHERE c.id = ?`, id)
	computer, err := scanComputer(row)
	if err != nil {
		return Computer{}, err
	}
	applyBuildingNetworkLabel(db, &computer)
	return computer, nil
}

func computerMatches(computer Computer, search string) bool {
	needle := strings.ToLower(strings.TrimSpace(search))
	if needle == "" {
		return true
	}

	fields := []string{
		strconv.Itoa(computer.ID),
		computer.IPAddress,
		computer.Hostname,
		computer.MACAddress,
		computer.Phone,
		computer.DepartmentName,
		computer.DeviceType,
		computer.OperatingSystem,
		computer.PCStatus,
		computer.Note,
		computer.BuildingName,
		computer.BuildingAddress,
		computer.NetworkLabel,
	}
	for _, field := range fields {
		if strings.Contains(strings.ToLower(field), needle) {
			return true
		}
	}
	return false
}

func sortComputers(computers []Computer) {
	sort.SliceStable(computers, func(i, j int) bool {
		left, right := computers[i], computers[j]
		if left.Network != right.Network {
			return networkRank(left.Network) < networkRank(right.Network)
		}
		if left.IPAddress != right.IPAddress {
			return lessByIP(left.IPAddress, right.IPAddress)
		}
		if left.Hostname != right.Hostname {
			return strings.ToLower(left.Hostname) < strings.ToLower(right.Hostname)
		}
		return left.ID < right.ID
	})
}

type computerFilter struct {
	Search     string
	BuildingID string
	Network    string
}

func listComputers(db *sql.DB, filter computerFilter) ([]Computer, error) {
	query := `SELECT ` + computerSelect + `
		FROM computers c
		LEFT JOIN buildings b ON b.id = c.building_id`
	args := make([]any, 0, 1)

	switch strings.TrimSpace(filter.BuildingID) {
	case "", "all":
	case "0", "none", "unassigned":
		query += ` WHERE c.building_id IS NULL`
	default:
		id, err := strconv.Atoi(filter.BuildingID)
		if err != nil || id < 1 {
			return nil, validationError{"некорректный идентификатор здания"}
		}
		query += ` WHERE c.building_id = ?`
		args = append(args, id)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	computers := make([]Computer, 0)
	for rows.Next() {
		computer, err := scanComputer(rows)
		if err != nil {
			return nil, err
		}
		applyBuildingNetworkLabel(db, &computer)
		computers = append(computers, computer)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	search := strings.TrimSpace(filter.Search)
	network := strings.TrimSpace(filter.Network)
	filtered := make([]Computer, 0, len(computers))
	for _, computer := range computers {
		if search != "" && !computerMatches(computer, search) {
			continue
		}
		if network != "" && network != "all" && computer.Network != network {
			continue
		}
		filtered = append(filtered, computer)
	}
	sortComputers(filtered)
	return filtered, nil
}

func insertComputer(db *sql.DB, computer Computer) (Computer, error) {
	computer.MACAddress = normalizeMACAddress(computer.MACAddress)
	if err := validateComputer(computer); err != nil {
		return Computer{}, err
	}
	if err := ensureUniqueComputerIP(db, computer, 0); err != nil {
		return Computer{}, err
	}

	result, err := db.Exec(`INSERT INTO computers (
		ip_address, hostname, full_name, last_name, first_name, middle_name,
		phone, cabinet, department_name, pc_status, note, device_type, operating_system, mac_address, building_id
	) VALUES (?, ?, '', '', '', '', ?, '', ?, ?, ?, ?, ?, ?, ?)`,
		computer.IPAddress,
		computer.Hostname,
		computer.Phone,
		computer.DepartmentName,
		computer.PCStatus,
		computer.Note,
		computer.DeviceType,
		computer.OperatingSystem,
		computer.MACAddress,
		nullInt(computer.BuildingID),
	)
	if err != nil {
		return Computer{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return Computer{}, err
	}
	return getComputerByID(db, int(id))
}

func updateComputer(db *sql.DB, id int, computer Computer) (Computer, error) {
	computer.MACAddress = normalizeMACAddress(computer.MACAddress)
	if err := validateComputer(computer); err != nil {
		return Computer{}, err
	}
	if err := ensureUniqueComputerIP(db, computer, id); err != nil {
		return Computer{}, err
	}

	result, err := db.Exec(`UPDATE computers SET
		ip_address = ?,
		hostname = ?,
		full_name = '',
		last_name = '',
		first_name = '',
		middle_name = '',
		phone = ?,
		cabinet = '',
		department_name = ?,
		pc_status = ?,
		note = ?,
		device_type = ?,
		operating_system = ?,
		mac_address = ?,
		building_id = ?
		WHERE id = ?`,
		computer.IPAddress,
		computer.Hostname,
		computer.Phone,
		computer.DepartmentName,
		computer.PCStatus,
		computer.Note,
		computer.DeviceType,
		computer.OperatingSystem,
		computer.MACAddress,
		nullInt(computer.BuildingID),
		id,
	)
	if err != nil {
		return Computer{}, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return Computer{}, err
	}
	if affected == 0 {
		return Computer{}, sql.ErrNoRows
	}
	return getComputerByID(db, id)
}

func ensureUniqueComputerIP(db *sql.DB, computer Computer, exceptID int) error {
	if computer.IPAddress == "" {
		return nil
	}
	var exists int
	err := db.QueryRow(`SELECT 1 FROM computers WHERE building_id IS ? AND ip_address = ? AND id != ? LIMIT 1`, nullInt(computer.BuildingID), computer.IPAddress, exceptID).Scan(&exists)
	if err == sql.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	return validationError{"этот IP-адрес уже занят в выбранном здании"}
}

func deleteComputer(db *sql.DB, id int) error {
	if _, err := db.Exec(`UPDATE tasks SET computer_id = NULL WHERE computer_id = ?`, id); err != nil {
		return err
	}
	result, err := db.Exec(`DELETE FROM computers WHERE id = ?`, id)
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

func decodeComputer(r *http.Request) (Computer, error) {
	var input computerInput
	if err := decodeJSON(r, &input); err != nil {
		return Computer{}, err
	}
	return input.toComputer(), nil
}

func filterFromRequest(r *http.Request) computerFilter {
	return computerFilter{
		Search:     r.URL.Query().Get("search"),
		BuildingID: r.URL.Query().Get("building_id"),
		Network:    r.URL.Query().Get("network"),
	}
}

func listComputersHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		computers, err := listComputers(db, filterFromRequest(r))
		if handleDBError(w, err, "Компьютер не найден") {
			return
		}
		writeJSON(w, http.StatusOK, computers)
	}
}

func createComputerHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		computer, err := decodeComputer(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный JSON")
			return
		}
		created, err := insertComputer(db, computer)
		if handleDBError(w, err, "Компьютер не найден") {
			return
		}
		writeJSON(w, http.StatusCreated, created)
	}
}

func getComputerHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := parsePathID(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
			return
		}
		computer, err := getComputerByID(db, id)
		if handleDBError(w, err, "Компьютер не найден") {
			return
		}
		writeJSON(w, http.StatusOK, computer)
	}
}

func updateComputerHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := parsePathID(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
			return
		}
		computer, err := decodeComputer(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный JSON")
			return
		}
		updated, err := updateComputer(db, id, computer)
		if handleDBError(w, err, "Компьютер не найден") {
			return
		}
		writeJSON(w, http.StatusOK, updated)
	}
}

func deleteComputerHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := parsePathID(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
			return
		}
		if err := deleteComputer(db, id); handleDBError(w, err, "Компьютер не найден") {
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

var csvHeaders = []string{
	"ID",
	"IP-адрес",
	"Сеть",
	"Имя компьютера",
	"MAC-адрес",
	"Телефон",
	"Отдел",
	"Тип устройства",
	"Операционная система",
	"Примечание",
	"Здание",
	"Адрес здания",
}

func exportComputersHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		computers, err := listComputers(db, filterFromRequest(r))
		if handleDBError(w, err, "Компьютер не найден") {
			return
		}

		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", `attachment; filename="computers.csv"`)
		if _, err := w.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
			log.Printf("csv bom: %v", err)
			return
		}

		writer := csv.NewWriter(w)
		writer.Comma = ';'
		if err := writer.Write(csvHeaders); err != nil {
			log.Printf("csv header: %v", err)
			return
		}

		for _, computer := range computers {
			record := []string{
				strconv.Itoa(computer.ID),
				computer.IPAddress,
				computer.NetworkLabel,
				computer.Hostname,
				computer.MACAddress,
				computer.Phone,
				computer.DepartmentName,
				computer.DeviceType,
				computer.OperatingSystem,
				computer.Note,
				computer.BuildingName,
				computer.BuildingAddress,
			}
			if err := writer.Write(record); err != nil {
				log.Printf("csv row: %v", err)
				return
			}
		}
		writer.Flush()
		if err := writer.Error(); err != nil {
			log.Printf("csv flush: %v", err)
		}
	}
}

func importComputersHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			writeError(w, http.StatusBadRequest, "Не удалось прочитать файл")
			return
		}

		file, _, err := r.FormFile("file")
		if err != nil {
			writeError(w, http.StatusBadRequest, "Выберите CSV-файл")
			return
		}
		defer file.Close()

		payload, err := io.ReadAll(file)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Не удалось прочитать файл")
			return
		}
		payload = bytes.TrimPrefix(payload, []byte{0xEF, 0xBB, 0xBF})

		content := string(payload)
		firstLine, _, _ := strings.Cut(content, "\n")
		comma := ';'
		if strings.Count(firstLine, ",") > strings.Count(firstLine, ";") {
			comma = ','
		}

		reader := csv.NewReader(strings.NewReader(content))
		reader.Comma = comma
		reader.LazyQuotes = true
		reader.FieldsPerRecord = -1
		reader.TrimLeadingSpace = true

		records, err := reader.ReadAll()
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный CSV")
			return
		}
		if len(records) < 2 {
			writeError(w, http.StatusBadRequest, "В файле нет строк данных")
			return
		}

		mapping := mapCSVHeaders(records[0])
		if mapping["ip_address"] < 0 && mapping["hostname"] < 0 {
			writeError(w, http.StatusBadRequest, "Не найдены столбцы «IP-адрес» или «Имя компьютера»")
			return
		}

		created := 0
		skipped := 0
		importErrors := make([]string, 0)

		for i, record := range records[1:] {
			rowNumber := i + 2
			computer, err := computerFromCSV(db, record, mapping)
			if err != nil {
				skipped++
				importErrors = append(importErrors, fmt.Sprintf("строка %d: %v", rowNumber, err))
				continue
			}
			if computer.Hostname == "" && computer.IPAddress == "" {
				skipped++
				continue
			}
			if _, err := insertComputer(db, computer); err != nil {
				skipped++
				importErrors = append(importErrors, fmt.Sprintf("строка %d: %v", rowNumber, err))
				continue
			}
			created++
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"created": created,
			"skipped": skipped,
			"errors":  importErrors,
		})
	}
}

func mapCSVHeaders(headers []string) map[string]int {
	aliases := map[string]string{
		"ip":               "ip_address",
		"ip address":       "ip_address",
		"ip адрес":         "ip_address",
		"ip-адрес":         "ip_address",
		"hostname":         "hostname",
		"имя компьютера":   "hostname",
		"компьютер":        "hostname",
		"mac":              "mac_address",
		"mac address":      "mac_address",
		"mac адрес":        "mac_address",
		"phone":            "phone",
		"телефон":          "phone",
		"department name":  "department_name",
		"department":       "department_name",
		"отдел":            "department_name",
		"device type":      "device_type",
		"тип устройства":   "device_type",
		"operating system": "operating_system",
		"os":               "operating_system",
		"операционная система": "operating_system",
		"pc status":    "pc_status",
		"status":       "pc_status",
		"статус":       "pc_status",
		"note":         "note",
		"примечание":   "note",
		"building":     "building_name",
		"здание":       "building_name",
		"address":      "building_address",
		"адрес":        "building_address",
		"адрес здания": "building_address",
	}

	mapping := map[string]int{
		"ip_address":       -1,
		"hostname":         -1,
		"mac_address":      -1,
		"phone":            -1,
		"department_name":  -1,
		"device_type":      -1,
		"operating_system": -1,
		"pc_status":        -1,
		"note":             -1,
		"building_name":    -1,
		"building_address": -1,
	}

	for index, header := range headers {
		normalized := normalizeHeader(header)
		field, ok := aliases[normalized]
		if !ok {
			continue
		}
		if mapping[field] == -1 {
			mapping[field] = index
		}
	}
	return mapping
}

func normalizeHeader(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "\ufeff")
	value = strings.ToLower(value)
	value = strings.ReplaceAll(value, "_", " ")
	value = strings.ReplaceAll(value, "-", " ")
	return strings.Join(strings.Fields(value), " ")
}

func computerFromCSV(db *sql.DB, record []string, mapping map[string]int) (Computer, error) {
	cell := func(field string) string {
		index := mapping[field]
		if index < 0 || index >= len(record) {
			return ""
		}
		return strings.TrimSpace(record[index])
	}

	buildingID, err := findOrCreateBuilding(db, cell("building_name"), cell("building_address"))
	if err != nil {
		return Computer{}, err
	}

	return Computer{
		IPAddress:       cell("ip_address"),
		Hostname:        cell("hostname"),
		Phone:           cell("phone"),
		MACAddress:      cell("mac_address"),
		DepartmentName:  cell("department_name"),
		DeviceType:      defaultString(cell("device_type"), "computer"),
		OperatingSystem: cell("operating_system"),
		PCStatus:        cell("pc_status"),
		Note:            cell("note"),
		BuildingID:      buildingID,
	}, nil
}
