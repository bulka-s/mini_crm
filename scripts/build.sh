#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v npm >/dev/null 2>&1; then
  echo "Нужен Node.js / npm, чтобы собрать интерфейс." >&2
  exit 1
fi

if ! command -v go >/dev/null 2>&1; then
  echo "Нужен Go, чтобы собрать исполняемый файл." >&2
  exit 1
fi

echo "→ Сборка интерфейса"
cd frontend
npm install
npm run build
cd "$ROOT"

echo "→ Копирование frontend/dist в static/"
rm -rf static/assets
mkdir -p static
cp -R frontend/dist/. static/

mkdir -p dist

echo "→ Сборка Windows (amd64)"
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -o dist/mchs-crm.exe .

echo "→ Сборка Linux (amd64)"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o dist/mchs-crm .

echo
echo "Готово."
echo "Скопируйте dist/mchs-crm.exe на рабочий ПК и запустите."
echo "Откройте http://localhost:8080"
echo "База данных появится рядом с программой: database.db"
