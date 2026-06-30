# Windows Setup Guide — Sema TEI Corpus Explorer

## Prerequisites

- **Node.js 20+** — [Download](https://nodejs.org)
- **Git for Windows** — [Download](https://git-scm.com/download/win)
  - During installation, choose: "Git from the command line and also from 3rd-party software"
  - Ensure **Git Credential Manager** is checked (it is by default)

## First-Time Setup

1. **Clone the repository**
   ```cmd
   git clone https://github.com/manueldiagostino/sema.git
   cd sema
   ```

2. **Install the post-merge hook**
   ```cmd
   copy scripts\hooks\post-merge .git\hooks\post-merge
   ```
   This hooks auto-runs `npm run build-json` after every `git pull`, so corpus artifacts stay fresh.

3. **Install dependencies and build**
   ```cmd
   npm install
   npm run build
   ```

4. **Configure GitHub authentication** (one-time)
   
   The app uses **Git Credential Manager** (GCM) for publishing. When you first click "Publish" in the admin panel, GCM will open a browser window for GitHub OAuth login. After that, all git operations work transparently.

   > You can also pre-configure: `git credential-manager github login`

5. **Set your git identity** (if not already configured)
   ```cmd
   git config user.name "Your Name"
   git config user.email "your@email.com"
   ```

## Running the App

Double-click `start.bat`, or run from a command prompt:
```cmd
start.bat
```

The script will:
- Install/update dependencies
- Prompt for git user configuration (first time)
- Configure git settings for conflict prevention
- Build corpus data from XML sources
- Start the server in production mode
- Open `http://localhost:3000/admin` in your browser

The server runs on **port 3000**. To stop it, press `Ctrl+C` in the terminal window.

## Updating the App

When new code or XML files are pushed to the repository:

1. Pull the latest changes:
   ```cmd
   git pull
   ```

2. If source files changed (XML, TypeScript), rebuild:
   ```cmd
   npm run build
   ```

3. If only XML files changed, just rebuild corpus data:
   ```cmd
   npm run build-json
   ```

4. Restart the server (close the terminal and run `start.bat` again).

> The post-merge hook automatically runs `build-json` after every `git pull`, so step 3 happens automatically.

## Publishing Changes

The admin panel auto-commits every form submission. To push those commits to GitHub:

1. Go to `http://localhost:3000/admin`
2. Click the **Publish** button in the toolbar
3. If it's your first publish, GCM will prompt for GitHub authentication

## Troubleshooting

### "Connection refused" when browser opens
The browser opened before the server was ready. Wait a few seconds and refresh.

### "Git not found in PATH"
Git is not installed or not in PATH. Reinstall Git for Windows with "Git from the command line" option.

### "Push failed — verify write permissions"
- Ensure you have write access to the GitHub repository
- Check that Git Credential Manager is working: `git credential-manager github list`
- Try: `git push origin main` manually to trigger the credential prompt

### Merge conflicts after git pull
If you get conflicts when pulling:
```cmd
git stash
git pull --rebase
git stash pop
```
The app's conflict-prevention settings (`rerere.enabled`) will remember manual conflict resolutions for future pulls.

## Optional: Auto-Start on Boot

To have the Sema server start automatically when Windows boots:

### Using Windows Task Scheduler
1. Open Task Scheduler
2. Create Basic Task → name "Sema Server"
3. Trigger: "When computer starts" or "When I log on"
4. Action: Start a program → `cmd.exe`
5. Arguments: `/c cd /d C:\path\to\sema && start.bat`

### Using PM2 (for crash recovery)
```cmd
npm install -g pm2
cd C:\path\to\sema
pm2 start ecosystem.config.cjs
pm2 save
npm install -g pm2-windows-service
pm2-startup install
```
