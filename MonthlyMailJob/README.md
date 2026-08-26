# MonthlyMailJob — Deployment

Standalone console app. Not hosted on Azure (only the DB is). Runs on the 1st of every
month at 8:30 AM via **Windows Task Scheduler** — not a Windows Service, not an Azure WebJob.
Task Scheduler tasks survive reboots on their own, so once set up this keeps running forever
without any extra step.

## 1. Build

```
"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\MSBuild.exe" MonthlyMailJob.csproj /p:Configuration=Release
```

Output: `MonthlyMailJob\bin\Release\MonthlyMailJob.exe` (+ its `.dll`/`.config` files in the same folder).

## 2. Copy to the server

Create a folder on the server that will run the job, e.g.:

```
C:\Apps\MonthlyMailJob\
```

Copy the entire contents of `bin\Release\` into that folder (the `.exe`, all `.dll` files, and
`MonthlyMailJob.exe.config`). Do not run it from a temp or user Downloads folder.

## 3. Create the Scheduled Task

1. Open **Task Scheduler** (`taskschd.msc`) on the server.
2. **Action → Create Task...** (not "Create Basic Task" — need the extra options below).
3. **General tab:**
   - Name: `MonthlyMailJob`
   - Select **"Run whether user is logged on or not"**
   - Check **"Run with highest privileges"**
   - Configure for: match the server's Windows version
4. **Triggers tab → New:**
   - Begin the task: **On a schedule**
   - Settings: **Monthly**
   - Months: **All**
   - Days: **1**
   - Start time: **08:30:00**
   - Check **"Enabled"**
5. **Actions tab → New:**
   - Action: **Start a program**
   - Program/script: `C:\Apps\MonthlyMailJob\MonthlyMailJob.exe`
   - Start in (optional): `C:\Apps\MonthlyMailJob\`
6. **Conditions tab:**
   - Uncheck **"Start the task only if the computer is on AC power"** (servers are always on AC, but uncheck anyway to be safe)
7. **Settings tab:**
   - Check **"Run task as soon as possible after a scheduled start is missed"** — covers the case where the server was rebooting/down exactly at 8:30 AM on the 1st
   - Check **"If the task fails, restart every"** → 10 minutes, up to 3 attempts
   - Do **not** check "Stop the task if it runs longer than..." unless you want a safety cap
8. Click **OK**, then enter the credentials of an account with permission to run tasks on that server (a service account or admin login). This account's password is what lets it run "whether logged on or not."

## 4. Confirm it survives reboot

This is automatic — Task Scheduler tasks are stored in the Windows Task Scheduler database, not
tied to a logged-in session or the Startup folder. After any server reboot, the task is still
there and will fire on the next 1st-of-month 8:30 AM. Nothing else to configure.

## 5. Test it manually

Right-click the task → **Run**. Check:
- Task Scheduler → task → **History** tab for success/failure.
- Console output isn't visible when run this way; check the exit code in History, or run the
  `.exe` directly from a command prompt once to see the `Console.WriteLine` output live.

## 6. What it needs to actually work

- Network access from the server to `mazpngpappmysql01.mysql.database.azure.com` (the DB).
- SMTP credentials are read from the `access.ngpdigital` table at runtime — nothing to configure
  on the server for that.
- If the DB connection string or `MailDomain` ever changes, edit
  `MonthlyMailJob.exe.config` on the server directly (no rebuild needed for config-only changes).
