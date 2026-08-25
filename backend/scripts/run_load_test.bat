@echo off
REM Run this from a cmd.exe (not PowerShell) to avoid execution policy issues.
cd %~dp0\..
echo Installing dependencies (socket.io-client)...
npm install socket.io-client@4.7.0 --no-audit --no-fund
if %ERRORLEVEL% neq 0 (
  echo npm install failed. Please run the command manually.
  exit /b %ERRORLEVEL%
)

echo Running migrations and seed (if needed)...
npm run migrate
REM Uncomment next line if you want to seed characters
REM npm run seed

echo Starting backend in background (dev)...
start cmd /k "npm run dev"

timeout /t 2 >nul

echo Running load test (4 clients against character 1)...
node scripts/load_test.js loadtest-room 1 4

pause
