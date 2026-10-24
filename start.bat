@echo off
cd /d "%~dp0"
if not exist "bin\tectonic.exe" (
  echo First run: downloading the LaTeX engine and editor libraries...
  node scripts\setup.js || (pause & exit /b 1)
)
start "" http://localhost:5173
node server.js
pause
