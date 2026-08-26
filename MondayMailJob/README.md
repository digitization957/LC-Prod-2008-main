# MondayMailJob — Deployment

Standalone console app. Not hosted on Azure (only the DB is). Runs **every Monday at 8:35 AM**
via **Windows Task Scheduler** — not a Windows Service, not an Azure WebJob.

One mail per plant: To = that plant's owners + reviewers, CC = that plant's Monday mail-config
(`mail_config_recipient`, `mail_type='monday'`). Body = owner-wise summary grid + compliance status
detail grid. Every plant's outcome (sent/failed/skipped) is logged to `mail_send_log` under one
`mail_job_run` row per run — see `schema.md` at the repo root.

## 1. Build

```
"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\MSBuild.exe" MondayMailJob.csproj /p:Configuration=Release
```

Output: `MondayMailJob\bin\Release\MondayMailJob.exe` (+ its `.dll`/`.config` files in the same folder).

## 2. Copy to the server

```
C:\Apps\MondayMailJob\
```

Copy the entire contents of `bin\Release\` into that folder. Do not run it from a temp or user
Downloads folder.

## 3. Create the Scheduled Task

1. Open **Task Scheduler** (`taskschd.msc`) on the server.
2. **Action → Create Task...** (not "Create Basic Task").
3. **General tab:**
   - Name: `MondayMailJob`
   - Select **"Run whether user is logged on or not"**
   - Check **"Run with highest privileges"**
   - Configure for: match the server's Windows version
4. **Triggers tab → New:**
   - Begin the task: **On a schedule**
   - Settings: **Weekly**
   - Recur every: **1 week**, Day: **Monday**
   - Start time: **08:35:00**
   - Check **"Enabled"**
5. **Actions tab → New:**
   - Action: **Start a program**
   - Program/script: `C:\Apps\MondayMailJob\MondayMailJob.exe`
   - Start in (optional): `C:\Apps\MondayMailJob\`
6. **Conditions tab:**
   - Uncheck **"Start the task only if the computer is on AC power"**
7. **Settings tab:**
   - Check **"Run task as soon as possible after a scheduled start is missed"**
   - Check **"If the task fails, restart every"** → 10 minutes, up to 3 attempts
8. Click **OK**, then enter the credentials of an account with permission to run tasks on that server.

## 4. Confirm it survives reboot

Automatic — Task Scheduler tasks are stored in the Windows Task Scheduler database, not tied to a
logged-in session. After any reboot, the task is still there and fires next Monday 8:35 AM.

## 5. Test it manually

Right-click the task → **Run**. Check:
- Task Scheduler → task → **History** tab for success/failure.
- The `mail_job_run` / `mail_send_log` tables for the actual per-plant outcome.
- Run the `.exe` directly from a command prompt once to see `Console.WriteLine` output live.

## 6. What it needs to actually work

- Network access from the server to `mazpngpappmysql01.mysql.database.azure.com` (the DB).
- SMTP credentials are read from the `access.ngpdigital` table at runtime.
- If the DB connection string or `MailDomain` ever changes, edit `MondayMailJob.exe.config` on the
  server directly (no rebuild needed for config-only changes).
