package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
)

type validationError struct {
	msg string
}

func (e validationError) Error() string {
	return e.msg
}

func isValidation(err error) bool {
	var v validationError
	return errors.As(err, &v)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("json encode: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func decodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	if err := decoder.Decode(dst); err != nil {
		return err
	}
	return nil
}

func parsePathID(r *http.Request) (int, error) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id < 1 {
		return 0, errors.New("invalid id")
	}
	return id, nil
}

func handleDBError(w http.ResponseWriter, err error, notFoundMessage string) bool {
	if err == nil {
		return false
	}
	if isValidation(err) {
		writeError(w, http.StatusBadRequest, err.Error())
		return true
	}
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, notFoundMessage)
		return true
	}
	log.Printf("database: %v", err)
	writeError(w, http.StatusInternalServerError, "Ошибка работы с БД")
	return true
}
