Write-Host "============================================"
Write-Host "  Sema - TEI Corpus Explorer"
Write-Host "============================================"
Write-Host ""

# Check Node.js
try {
    node --version | Out-Null
} catch {
    Write-Host "Node.js is required. Please install from https://nodejs.org"
    Read-Host "Press Enter to exit"
    exit 1
}

# Navigate to script directory
Set-Location $PSScriptRoot

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
}

# Build corpus JSON
Write-Host "Building corpus data..."
npm run build-json

# Start dev server and open browser
Write-Host "Starting Sema server..."
Start-Process "http://localhost:3000/admin"
npm run dev
