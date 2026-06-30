@echo off
setlocal enabledelayedexpansion
echo ============================================
echo   Sema - TEI Corpus Explorer
echo ============================================
echo.

REM Check Node.js
node --version >nul 2>&1
if !errorlevel! neq 0 (
    echo Node.js is required. Please install from https://nodejs.org
    pause
    exit /b 1
)

REM Navigate to script directory
cd /d "%~dp0"

REM ── Install dependencies ──
echo Checking dependencies...
call npm ci --prefer-offline 2>nul
if !errorlevel! neq 0 (
    echo [INFO] npm ci failed — lockfile may be missing or outdated. Falling back to npm install...
    call npm install
)

REM ── Git configuration ──
echo.
where git >nul 2>&1
if !errorlevel! neq 0 (
    echo [INFO] Git not found in PATH. Skipping git configuration.
    echo       Install Git for Windows from https://git-scm.com to enable commit/push.
) else (
    call git config user.name >nul 2>&1
    if !errorlevel! neq 0 (
        echo === Git Configuration ===
        echo Git user is not configured yet. Set your name and email for this repository
        echo to enable commit and push from the admin panel.
        echo.
        set /p "GIT_NAME=Enter your git display name (e.g., Mario Rossi): "
        set /p "GIT_EMAIL=Enter your git email address: "
        if not "!GIT_NAME!"=="" call git config user.name "!GIT_NAME!"
        if not "!GIT_EMAIL!"=="" call git config user.email "!GIT_EMAIL!"
        if not "!GIT_NAME!"=="" if not "!GIT_EMAIL!"=="" (
            echo Git configuration saved locally for this repository.
        )
    ) else (
        set "GIT_NAME="
        set "GIT_EMAIL="
        for /f "usebackq tokens=*" %%a in (`call git config user.name`) do set "GIT_NAME=%%a"
        for /f "usebackq tokens=*" %%b in (`call git config user.email`) do set "GIT_EMAIL=%%b"
        if not "!GIT_NAME!"=="" if not "!GIT_EMAIL!"=="" (
            echo Git user: !GIT_NAME! ^< !GIT_EMAIL! ^>
        ) else (
            echo [WARNING] Git user.name or user.email is set but empty.
            echo           Run the script again or configure them manually:
            echo           git config user.name "Your Name"
            echo           git config user.email "your@email.com"
        )
    )
)
echo.

REM ── Git repository settings (conflict prevention) ──
where git >nul 2>&1
if !errorlevel! equ 0 (
    call git config --local pull.rebase true
    call git config --local rerere.enabled true
    call git config --local rerere.autoupdate true
    call git config --local merge.conflictstyle zdiff3
    call git config --local push.autoSetupRemote true

    REM Switch remote to HTTPS if currently SSH
    for /f "usebackq tokens=*" %%a in (`git remote get-url origin 2^>nul`) do set "REMOTE_URL=%%a"
    echo !REMOTE_URL! | findstr /c:"https://" >nul
    if !errorlevel! neq 0 (
        if not "!REMOTE_URL!"=="" (
            echo Switching remote to HTTPS for Git Credential Manager...
            call git remote set-url origin https://github.com/manueldiagostino/sema.git
        )
    )
)
echo.

REM Build corpus JSON
echo Building corpus data...
call npm run build-json

REM Build Next.js production app (skip if already built)
if not exist ".next" (
    echo First run detected — building Next.js app...
    call npm run build
)

REM Start server (production mode) and open browser
echo Starting Sema server (production mode)...
start /B "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000/admin"
call npm run start
