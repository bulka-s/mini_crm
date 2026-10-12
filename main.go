package main

import (
	"database/sql"
	"embed"
	"encoding/json"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

//go:embed static
var embeddedStatic embed.FS

const fallbackHTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCHS CRM</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 64px auto; padding: 0 24px; color: #1e293b; }
    code, pre { background: #f1f5f9; padding: 2px 6px; }
    pre { padding: 12px 16px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>MCHS CRM</h1>
  <p>Сервер запущен. Интерфейс ещё не встроен. Соберите приложение:</p>
  <pre>./scripts/build.sh</pre>
  <p>Либо для разработки: <code>cd frontend && npm run dev</code>.</p>
</body>
</html>`

func pingHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "pong"})
}

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.RequestURI())
		next.ServeHTTP(w, r)
	})
}

func contentTypeFor(name string) string {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".js", ".mjs":
		return "application/javascript; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".svg":
		return "image/svg+xml"
	case ".html":
		return "text/html; charset=utf-8"
	case ".json":
		return "application/json; charset=utf-8"
	}
	if t := mime.TypeByExtension(ext); t != "" {
		return t
	}
	return "application/octet-stream"
}

func hasBuiltFrontend(fsys fs.FS) bool {
	if _, err := fs.Stat(fsys, "assets"); err == nil {
		return true
	}
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return false
	}
	for _, entry := range entries {
		name := strings.ToLower(entry.Name())
		if strings.HasSuffix(name, ".js") || strings.HasSuffix(name, ".css") {
			return true
		}
	}
	return false
}

func serveFSFile(w http.ResponseWriter, fsys fs.FS, name string) bool {
	file, err := fsys.Open(name)
	if err != nil {
		return false
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || info.IsDir() {
		return false
	}
	w.Header().Set("Content-Type", contentTypeFor(name))
	_, _ = io.Copy(w, file)
	return true
}

func spaHandler() http.Handler {
	embedded, err := fs.Sub(embeddedStatic, "static")
	if err != nil {
		embedded = embeddedStatic
	}
	distDir := "./frontend/dist"

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requested := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if requested == "" || requested == "." {
			requested = "index.html"
		}

		if hasBuiltFrontend(embedded) {
			if serveFSFile(w, embedded, requested) {
				return
			}
			if serveFSFile(w, embedded, "index.html") {
				return
			}
		}

		if info, err := os.Stat(distDir); err == nil && info.IsDir() {
			localPath := filepath.Join(distDir, filepath.Clean("/"+r.URL.Path))
			fileInfo, err := os.Stat(localPath)
			if err == nil && !fileInfo.IsDir() {
				http.ServeFile(w, r, localPath)
				return
			}
			index := filepath.Join(distDir, "index.html")
			if _, err := os.Stat(index); err == nil {
				http.ServeFile(w, r, index)
				return
			}
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(fallbackHTML))
	})
}

func registerRoutes(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /ping", pingHandler)
	mux.HandleFunc("GET /buildings", listBuildingsHandler(db))
	mux.HandleFunc("POST /buildings", createBuildingHandler(db))
	mux.HandleFunc("GET /buildings/{id}", getBuildingHandler(db))
	mux.HandleFunc("PUT /buildings/{id}", updateBuildingHandler(db))
	mux.HandleFunc("DELETE /buildings/{id}", deleteBuildingHandler(db))
	mux.HandleFunc("GET /computers", listComputersHandler(db))
	mux.HandleFunc("POST /computers", createComputerHandler(db))
	mux.HandleFunc("GET /computers/export", exportComputersHandler(db))
	mux.HandleFunc("POST /computers/import", importComputersHandler(db))
	mux.HandleFunc("GET /computers/{id}", getComputerHandler(db))
	mux.HandleFunc("PUT /computers/{id}", updateComputerHandler(db))
	mux.HandleFunc("DELETE /computers/{id}", deleteComputerHandler(db))
	mux.HandleFunc("GET /tasks", listTasksHandler(db))
	mux.HandleFunc("POST /tasks", createTaskHandler(db))
	mux.HandleFunc("GET /tasks/{id}", getTaskHandler(db))
	mux.HandleFunc("PUT /tasks/{id}", updateTaskHandler(db))
	mux.HandleFunc("DELETE /tasks/{id}", deleteTaskHandler(db))
	mux.Handle("/", spaHandler())
}

func getenv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func main() {
	addr := getenv("PORT", "8080")
	if !strings.Contains(addr, ":") {
		addr = ":" + addr
	}

	dbPath := getenv("DATABASE_PATH", "database.db")
	db, err := openDB(dbPath)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()

	mux := http.NewServeMux()
	registerRoutes(mux, db)

	log.Printf("Server is running on http://localhost%s", addr)
	if err := http.ListenAndServe(addr, logging(mux)); err != nil {
		log.Fatal(err)
	}
}
