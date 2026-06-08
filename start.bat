@echo off
echo ============================================
echo   Sema - TEI Corpus Explorer
echo ============================================
echo.

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is required. Please install from https://nodejs.org
    pause
    exit /b 1
)

REM Navigate to script directory
cd /d "%~dp0"

REM Install dependencies if needed
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
)

REM Build corpus JSON
echo Building corpus data...
call npm run build-json

REM Start dev server and open browser
echo Starting Sema server...
start http://localhost:3000/admin
call npm run dev
pause
