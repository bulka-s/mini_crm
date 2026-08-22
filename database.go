package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

func initDB() *sql.DB {
	db, err := sql.Open("sqlite", "database.db")
	if err != nil {
		log.Fatal(err)
	}

	createTableSQL := `CREATE TABLE IF NOT EXISTS computers (
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
	);`

	_, err = db.Exec(createTableSQL)
	if err != nil {
		log.Fatalf("Failed to create table: %v", err)
	}
	fmt.Println("Table created successful.")

	return db
}
