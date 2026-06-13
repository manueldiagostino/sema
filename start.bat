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

REM ── Pull latest changes from remote ──
echo.
echo Pulling latest changes from remote...
git pull --rebase --autostash
if %errorlevel% neq 0 (
    echo [WARNING] git pull failed. You may have uncommitted local changes.
    echo           To fix: git stash  (to temporarily set them aside)
    echo           or:     git commit -m "message"  (to commit them)
    echo.
    choice /c YN /n /m "Continue anyway? [Y/N] "
    if errorlevel 2 exit /b 1
    echo.
)

REM Always ensure dependencies are installed
echo Checking dependencies...
if not exist "node_modules\.package-lock.json" (
    echo Installing dependencies...
    call npm install
) else (
    call npm install --prefer-offline
)

REM ── Git configuration ──
echo.
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Git not found in PATH. Skipping git configuration.
    echo       Install Git for Windows from https://git-scm.com to enable commit/push.
) else (
    git config user.name >nul 2>&1
    if %errorlevel% neq 0 (
        echo === Git Configuration ===
        echo Git user is not configured yet. Set your name and email for this repository
        echo to enable commit and push from the admin panel.
        echo.
        set /p "GIT_NAME=Enter your git display name (e.g., Mario Rossi): "
        set /p "GIT_EMAIL=Enter your git email address: "
        if not "%GIT_NAME%"=="" git config user.name "%GIT_NAME%"
        if not "%GIT_EMAIL%"=="" git config user.email "%GIT_EMAIL%"
        if not "%GIT_NAME%"=="" if not "%GIT_EMAIL%"=="" (
            echo Git configuration saved locally for this repository.
        )
    ) else (
        for /f "usebackq tokens=*" %%a in (`git config user.name`) do set "GIT_NAME=%%a"
        for /f "usebackq tokens=*" %%b in (`git config user.email`) do set "GIT_EMAIL=%%b"
        echo Git user: %GIT_NAME% ^< %GIT_EMAIL% ^>
    )
)
echo.

REM Build corpus JSON
echo Building corpus data...
call npm run build-json

REM Start dev server and open browser
echo Starting Sema server...
start http://localhost:3000/admin
call npm run dev
pause
