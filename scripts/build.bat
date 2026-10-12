@echo off
setlocal

cd /d "%~dp0\.."

where npm >nul 2>nul
if errorlevel 1 (
  echo Нужен Node.js / npm, чтобы собрать интерфейс.
  exit /b 1
)

where go >nul 2>nul
if errorlevel 1 (
  echo Нужен Go, чтобы собрать исполняемый файл.
  exit /b 1
)

echo - Сборка интерфейса
cd frontend
call npm install
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
cd ..

echo - Копирование frontend\dist в static\
if exist static\assets rmdir /s /q static\assets
if not exist static mkdir static
xcopy /e /y /q frontend\dist\* static\ >nul

if not exist dist mkdir dist

echo - Сборка Windows
set CGO_ENABLED=0
go build -o dist\mchs-crm.exe .
if errorlevel 1 exit /b 1

echo.
echo Готово.
echo Скопируйте dist\mchs-crm.exe на рабочий ПК и запустите.
echo Откройте http://localhost:8080
echo База данных появится рядом с программой: database.db
