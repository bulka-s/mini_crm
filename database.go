package main

import (
	"database/sql"
	"fmt"
	"strings"

	_ "modernc.org/sqlite"
)

func openDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, err
	}

	pragmas := []string{
		"PRAGMA foreign_keys = ON",
		"PRAGMA journal_mode = WAL",
		"PRAGMA busy_timeout = 5000",
	}
	for _, pragma := range pragmas {
		if _, err := db.Exec(pragma); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("pragma: %w", err)
		}
	}

	if err := ensureSchema(db); err != nil {
		_ = db.Close()
		return nil, err
	}

	return db, nil
}

func ensureSchema(db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS computers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ip_address TEXT,
			hostname TEXT,
			last_name TEXT NOT NULL,
			first_name TEXT NOT NULL,
			middle_name TEXT,
			phone TEXT,
			cabinet TEXT,
			department_name TEXT,
			pc_status TEXT,
			note TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS buildings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			address TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS building_networks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			building_id INTEGER NOT NULL,
			name TEXT NOT NULL,
			cidr TEXT NOT NULL,
			FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS tasks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			description TEXT,
			assignee TEXT,
			building_id INTEGER,
			computer_id INTEGER,
			status TEXT NOT NULL,
			due_date TEXT,
			created_at TEXT
		)`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return fmt.Errorf("create table: %w", err)
		}
	}

	if err := addColumnIfMissing(db, "computers", "full_name", "TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "computers", "building_id", "INTEGER"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "computers", "device_type", "TEXT NOT NULL DEFAULT 'computer'"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "computers", "operating_system", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "computers", "mac_address", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	_, err := db.Exec(`
		UPDATE computers
		SET last_name = '', first_name = '', middle_name = '', cabinet = ''
	`)
	if err != nil {
		return fmt.Errorf("remove retired personal and cabinet fields: %w", err)
	}

	return nil
}

func addColumnIfMissing(db *sql.DB, table, column, definition string) error {
	exists, err := hasColumn(db, table, column)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	_, err = db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, definition))
	if err != nil {
		return fmt.Errorf("add column %s.%s: %w", table, column, err)
	}
	return nil
}

func hasColumn(db *sql.DB, table, column string) (bool, error) {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name, ctype string
		var notNull int
		var dflt sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &ctype, &notNull, &dflt, &pk); err != nil {
			return false, err
		}
		if strings.EqualFold(name, column) {
			return true, nil
		}
	}
	return false, rows.Err()
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}
