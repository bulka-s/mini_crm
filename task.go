package main

import (
	"database/sql"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	taskStatusNew        = "new"
	taskStatusInProgress = "in_progress"
	taskStatusWaiting    = "waiting"
	taskStatusDone       = "done"
	taskStatusCancelled  = "cancelled"
)

const taskSelect = `
	t.id,
	COALESCE(t.title, ''),
	COALESCE(t.description, ''),
	COALESCE(t.assignee, ''),
	t.building_id,
	COALESCE(b.name, ''),
	t.computer_id,
	COALESCE(c.hostname, ''),
	COALESCE(c.ip_address, ''),
	COALESCE(c.full_name, ''),
	COALESCE(t.status, ''),
	COALESCE(t.due_date, ''),
	COALESCE(t.created_at, '')
`

type Task struct {
	ID               int    `json:"id"`
	Title            string `json:"title"`
	Description      string `json:"description"`
	Assignee         string `json:"assignee"`
	BuildingID       *int   `json:"building_id"`
	BuildingName     string `json:"building_name"`
	ComputerID       *int   `json:"computer_id"`
	ComputerHostname string `json:"computer_hostname"`
	ComputerIP       string `json:"computer_ip"`
	ComputerFullName string `json:"computer_full_name"`
	Status           string `json:"status"`
	StatusLabel      string `json:"status_label"`
	DueDate          string `json:"due_date"`
	CreatedAt        string `json:"created_at"`
}

type taskInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Assignee    string `json:"assignee"`
	BuildingID  *int   `json:"building_id"`
	ComputerID  *int   `json:"computer_id"`
	Status      string `json:"status"`
	DueDate     string `json:"due_date"`
}

type taskFilter struct {
	Search     string
	Status     string
	BuildingID string
}

func taskStatusLabel(status string) string {
	switch status {
	case taskStatusNew:
		return "Новая"
	case taskStatusInProgress:
		return "В работе"
	case taskStatusWaiting:
		return "Ожидание"
	case taskStatusDone:
		return "Выполнена"
	case taskStatusCancelled:
		return "Отменена"
	default:
		return status
	}
}

func validTaskStatus(status string) bool {
	switch status {
	case taskStatusNew, taskStatusInProgress, taskStatusWaiting, taskStatusDone, taskStatusCancelled:
		return true
	default:
		return false
	}
}

func taskStatusRank(status string) int {
	switch status {
	case taskStatusNew:
		return 0
	case taskStatusInProgress:
		return 1
	case taskStatusWaiting:
		return 2
	case taskStatusDone:
		return 3
	case taskStatusCancelled:
		return 4
	default:
		return 5
	}
}

func (in taskInput) toTask() Task {
	status := strings.TrimSpace(in.Status)
	if status == "" {
		status = taskStatusNew
	}
	return Task{
		Title:       strings.TrimSpace(in.Title),
		Description: strings.TrimSpace(in.Description),
		Assignee:    strings.TrimSpace(in.Assignee),
		BuildingID:  in.BuildingID,
		ComputerID:  in.ComputerID,
		Status:      status,
		DueDate:     strings.TrimSpace(in.DueDate),
	}
}

func applyTaskMeta(task *Task) {
	task.StatusLabel = taskStatusLabel(task.Status)
}

func validateTask(task Task) error {
	if task.Title == "" {
		return validationError{"название задачи обязательно"}
	}
	if !validTaskStatus(task.Status) {
		return validationError{"некорректный статус"}
	}
	if task.DueDate != "" {
		if _, err := time.Parse("2006-01-02", task.DueDate); err != nil {
			return validationError{"некорректная дата"}
		}
	}
	return nil
}

func ensureOptionalRecord(db *sql.DB, table string, id *int, missing string) error {
	if id == nil || *id < 1 {
		return nil
	}
	var exists int
	err := db.QueryRow(`SELECT 1 FROM `+table+` WHERE id = ?`, *id).Scan(&exists)
	if err == sql.ErrNoRows {
		return validationError{missing}
	}
	return err
}

func scanTask(scanner interface{ Scan(dest ...any) error }) (Task, error) {
	var task Task
	var buildingID, computerID sql.NullInt64
	err := scanner.Scan(
		&task.ID,
		&task.Title,
		&task.Description,
		&task.Assignee,
		&buildingID,
		&task.BuildingName,
		&computerID,
		&task.ComputerHostname,
		&task.ComputerIP,
		&task.ComputerFullName,
		&task.Status,
		&task.DueDate,
		&task.CreatedAt,
	)
	if err != nil {
		return Task{}, err
	}
	task.BuildingID = intPtr(buildingID)
	task.ComputerID = intPtr(computerID)
	applyTaskMeta(&task)
	return task, nil
}

func getTaskByID(db *sql.DB, id int) (Task, error) {
	row := db.QueryRow(`SELECT `+taskSelect+`
		FROM tasks t
		LEFT JOIN buildings b ON b.id = t.building_id
		LEFT JOIN computers c ON c.id = t.computer_id
		WHERE t.id = ?`, id)
	return scanTask(row)
}

func taskMatches(task Task, search string) bool {
	needle := strings.ToLower(strings.TrimSpace(search))
	if needle == "" {
		return true
	}
	fields := []string{
		strconv.Itoa(task.ID),
		task.Title,
		task.Description,
		task.Assignee,
		task.BuildingName,
		task.ComputerHostname,
		task.ComputerIP,
		task.ComputerFullName,
		task.StatusLabel,
		task.DueDate,
	}
	for _, field := range fields {
		if strings.Contains(strings.ToLower(field), needle) {
			return true
		}
	}
	return false
}

func sortTasks(tasks []Task) {
	sort.SliceStable(tasks, func(i, j int) bool {
		left, right := tasks[i], tasks[j]
		if left.Status != right.Status {
			return taskStatusRank(left.Status) < taskStatusRank(right.Status)
		}
		if left.DueDate != right.DueDate {
			if left.DueDate == "" {
				return false
			}
			if right.DueDate == "" {
				return true
			}
			return left.DueDate < right.DueDate
		}
		if left.CreatedAt != right.CreatedAt {
			return left.CreatedAt > right.CreatedAt
		}
		return left.ID > right.ID
	})
}

func listTasks(db *sql.DB, filter taskFilter) ([]Task, error) {
	query := `SELECT ` + taskSelect + `
		FROM tasks t
		LEFT JOIN buildings b ON b.id = t.building_id
		LEFT JOIN computers c ON c.id = t.computer_id`
	args := make([]any, 0, 1)

	switch strings.TrimSpace(filter.BuildingID) {
	case "", "all":
	case "0", "none", "unassigned":
		query += ` WHERE t.building_id IS NULL`
	default:
		id, err := strconv.Atoi(filter.BuildingID)
		if err != nil || id < 1 {
			return nil, validationError{"некорректный идентификатор здания"}
		}
		query += ` WHERE t.building_id = ?`
		args = append(args, id)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]Task, 0)
	for rows.Next() {
		task, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	status := strings.TrimSpace(filter.Status)
	search := strings.TrimSpace(filter.Search)
	filtered := make([]Task, 0, len(tasks))
	for _, task := range tasks {
		if status != "" && status != "all" && task.Status != status {
			continue
		}
		if search != "" && !taskMatches(task, search) {
			continue
		}
		filtered = append(filtered, task)
	}
	sortTasks(filtered)
	return filtered, nil
}

func insertTask(db *sql.DB, task Task) (Task, error) {
	if err := validateTask(task); err != nil {
		return Task{}, err
	}
	if err := ensureOptionalRecord(db, "buildings", task.BuildingID, "здание не найдено"); err != nil {
		return Task{}, err
	}
	if err := ensureOptionalRecord(db, "computers", task.ComputerID, "компьютер не найден"); err != nil {
		return Task{}, err
	}

	createdAt := time.Now().UTC().Format(time.RFC3339)
	result, err := db.Exec(`INSERT INTO tasks (
		title, description, assignee, building_id, computer_id, status, due_date, created_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		task.Title,
		task.Description,
		task.Assignee,
		nullInt(task.BuildingID),
		nullInt(task.ComputerID),
		task.Status,
		task.DueDate,
		createdAt,
	)
	if err != nil {
		return Task{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return Task{}, err
	}
	return getTaskByID(db, int(id))
}

func updateTask(db *sql.DB, id int, task Task) (Task, error) {
	if err := validateTask(task); err != nil {
		return Task{}, err
	}
	if err := ensureOptionalRecord(db, "buildings", task.BuildingID, "здание не найдено"); err != nil {
		return Task{}, err
	}
	if err := ensureOptionalRecord(db, "computers", task.ComputerID, "компьютер не найден"); err != nil {
		return Task{}, err
	}

	result, err := db.Exec(`UPDATE tasks SET
		title = ?,
		description = ?,
		assignee = ?,
		building_id = ?,
		computer_id = ?,
		status = ?,
		due_date = ?
		WHERE id = ?`,
		task.Title,
		task.Description,
		task.Assignee,
		nullInt(task.BuildingID),
		nullInt(task.ComputerID),
		task.Status,
		task.DueDate,
		id,
	)
	if err != nil {
		return Task{}, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return Task{}, err
	}
	if affected == 0 {
		return Task{}, sql.ErrNoRows
	}
	return getTaskByID(db, id)
}

func deleteTask(db *sql.DB, id int) error {
	result, err := db.Exec(`DELETE FROM tasks WHERE id = ?`, id)
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

func decodeTask(r *http.Request) (Task, error) {
	var input taskInput
	if err := decodeJSON(r, &input); err != nil {
		return Task{}, err
	}
	return input.toTask(), nil
}

func taskFilterFromRequest(r *http.Request) taskFilter {
	return taskFilter{
		Search:     r.URL.Query().Get("search"),
		Status:     r.URL.Query().Get("status"),
		BuildingID: r.URL.Query().Get("building_id"),
	}
}

func listTasksHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tasks, err := listTasks(db, taskFilterFromRequest(r))
		if handleDBError(w, err, "Задача не найдена") {
			return
		}
		writeJSON(w, http.StatusOK, tasks)
	}
}

func createTaskHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		task, err := decodeTask(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный JSON")
			return
		}
		created, err := insertTask(db, task)
		if handleDBError(w, err, "Задача не найдена") {
			return
		}
		writeJSON(w, http.StatusCreated, created)
	}
}

func getTaskHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := parsePathID(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
			return
		}
		task, err := getTaskByID(db, id)
		if handleDBError(w, err, "Задача не найдена") {
			return
		}
		writeJSON(w, http.StatusOK, task)
	}
}

func updateTaskHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := parsePathID(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
			return
		}
		task, err := decodeTask(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный JSON")
			return
		}
		updated, err := updateTask(db, id, task)
		if handleDBError(w, err, "Задача не найдена") {
			return
		}
		writeJSON(w, http.StatusOK, updated)
	}
}

func deleteTaskHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := parsePathID(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
			return
		}
		if err := deleteTask(db, id); handleDBError(w, err, "Задача не найдена") {
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
