package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const authCookieName = "mchs_session"

type authConfig struct{ username, password string }
type loginPayload struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Remember bool   `json:"remember"`
}

func loadAuthConfig() authConfig {
	// A sidecar file keeps setup simple for a desktop-style server deployment.
	if data, err := os.ReadFile(authConfigPath()); err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			key, value, ok := strings.Cut(strings.TrimSpace(line), "=")
			if !ok {
				continue
			}
			value = strings.Trim(strings.TrimSpace(value), "\"'")
			switch strings.TrimSpace(key) {
			case "AUTH_USERNAME":
				if os.Getenv("AUTH_USERNAME") == "" {
					_ = os.Setenv("AUTH_USERNAME", value)
				}
			case "AUTH_PASSWORD":
				if os.Getenv("AUTH_PASSWORD") == "" {
					_ = os.Setenv("AUTH_PASSWORD", value)
				}
			}
		}
	}
	return authConfig{username: strings.TrimSpace(os.Getenv("AUTH_USERNAME")), password: os.Getenv("AUTH_PASSWORD")}
}

func authConfigPath() string {
	if _, err := os.Stat("mchs-crm.env"); err == nil {
		return "mchs-crm.env"
	}
	if executable, err := os.Executable(); err == nil {
		candidate := filepath.Join(filepath.Dir(executable), "mchs-crm.env")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return "mchs-crm.env"
}

func defaultDatabasePath() string {
	if _, err := os.Stat(authConfigPath()); err == nil {
		return filepath.Join(filepath.Dir(authConfigPath()), "database.db")
	}
	return "database.db"
}

func signSession(secret, username string, expires int64, nonce string) string {
	payload := base64.RawURLEncoding.EncodeToString([]byte(username + "\n" + nonce + "\n" + time.Unix(expires, 0).UTC().Format(time.RFC3339)))
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(payload))
	return payload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func validSession(secret, username, token string) bool {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(parts[0]))
	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || !hmac.Equal(sig, mac.Sum(nil)) {
		return false
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return false
	}
	fields := strings.Split(string(payload), "\n")
	if len(fields) != 3 || fields[0] != username {
		return false
	}
	expires, err := time.Parse(time.RFC3339, fields[2])
	return err == nil && time.Now().Before(expires)
}

func authHandlers(config authConfig) (http.HandlerFunc, http.HandlerFunc) {
	status := func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodDelete {
			http.SetCookie(w, &http.Cookie{Name: authCookieName, Value: "", Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})
			writeJSON(w, http.StatusOK, map[string]bool{"authenticated": false})
			return
		}
		cookie, err := r.Cookie(authCookieName)
		writeJSON(w, http.StatusOK, map[string]bool{"authenticated": err == nil && validSession(config.password, config.username, cookie.Value)})
	}
	login := func(w http.ResponseWriter, r *http.Request) {
		var input loginPayload
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный запрос")
			return
		}
		userOK := hmac.Equal([]byte(input.Username), []byte(config.username))
		passOK := hmac.Equal([]byte(input.Password), []byte(config.password))
		if !userOK || !passOK {
			writeError(w, http.StatusUnauthorized, "Неверный логин или пароль")
			return
		}
		lifetime := 12 * time.Hour
		maxAge := 0
		if input.Remember {
			lifetime = 30 * 24 * time.Hour
			maxAge = int(lifetime.Seconds())
		}
		var nonce [24]byte
		if _, err := rand.Read(nonce[:]); err != nil {
			writeError(w, http.StatusInternalServerError, "Не удалось создать сессию")
			return
		}
		http.SetCookie(w, &http.Cookie{Name: authCookieName, Value: signSession(config.password, config.username, time.Now().Add(lifetime).Unix(), base64.RawURLEncoding.EncodeToString(nonce[:])), Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: maxAge})
		writeJSON(w, http.StatusOK, map[string]bool{"authenticated": true})
	}
	return status, login
}

func authMiddleware(config authConfig, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/auth/session" || r.URL.Path == "/auth/login" {
			next.ServeHTTP(w, r)
			return
		}
		// Leave the app shell available so it can render the login screen; guard API routes.
		if strings.HasPrefix(r.URL.Path, "/api/") || apiPath(r.URL.Path) {
			cookie, err := r.Cookie(authCookieName)
			if err != nil || !validSession(config.password, config.username, cookie.Value) {
				writeError(w, http.StatusUnauthorized, "Требуется войти в приложение")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func apiPath(path string) bool {
	for _, prefix := range []string{"/buildings", "/building-networks", "/computers", "/tasks", "/ping"} {
		if path == prefix || strings.HasPrefix(path, prefix+"/") {
			return true
		}
	}
	return false
}
