@echo off
rem Double-click to run the portfolio locally. Opens in your browser.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies, first run only...
  call npm install || (pause & exit /b 1)
)

call npm run dev
pause
