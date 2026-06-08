# Sema — Windows Setup

## Prerequisites

1. Install **Node.js** from [https://nodejs.org](https://nodejs.org)
   - Download the **LTS** version
   - Run the installer and follow the prompts

## Quick Start

1. Download and extract the Sema project folder
2. Double-click **`start.bat`**
3. Wait for the browser to open at `http://localhost:3000/admin`

The script will:
- Check that Node.js is installed
- Install dependencies (first time only)
- Build the corpus data
- Start the server
- Open the browser

## Manual Setup

If the batch script doesn't work (restricted PowerShell execution policy), right-click `start.ps1` and select **"Run with PowerShell"**, or open PowerShell and run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start.ps1
```

## Admin Access

The admin area is password-protected. Set the password by creating a `.env.local` file in the project folder:

```
ADMIN_PASSWORD=your-password-here
```

Then restart the server.

## Troubleshooting

- **"Node.js is required"**: Install Node.js from https://nodejs.org
- **Port 3000 already in use**: Close other programs using port 3000, or change the port in `package.json`
- **Blank page**: Make sure `npm run build-json` ran successfully
