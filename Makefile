.PHONY: all build frontend run clean

APP_NAME := mchs-crm
DIST_DIR := dist

all: build

# Build the frontend and copy it into static/ so Go embeds it in the binary.
frontend:
	cd frontend && npm ci && npm run build
	mkdir -p static
	rm -rf static/assets
	cp -R frontend/dist/. static/

# Native Linux build when run on Linux; the resulting executable is self-contained.
build: frontend
	mkdir -p $(DIST_DIR)
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o $(DIST_DIR)/$(APP_NAME) .

run:
	go run .

clean:
	rm -rf $(DIST_DIR)
