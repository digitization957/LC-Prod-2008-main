# ReminderMailJob — Deployment

Standalone console app. Not hosted on Azure (only the DB is). Runs **every day at 9:00 AM** via
**Windows Task Scheduler** — not a Windows Service, not an Azure WebJob.

For every active compliance, checks its active reminders (`reminders` table, R1-R4, each with its
own `days_before_due`). A stage is eligible once `today >= next_due_date - days_before_due` (catches
up if a run was missed). Before sending it checks `mail_send_log` for an existing `sent` row for the
same compliance + stage + due date, so a same-day rerun never duplicates. To = owner + reviewer,
Cc = that plant's mail-config for that stage (`mail_config_recipient`, `mail_type='reminders'`,
`group_key` = `r1`/`r2`/`r3`/`r4`). See `schema.md` at the repo root.

## 1. Build

```
"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\MSBuild.exe" ReminderMailJob.csproj /p:Configuration=Release
```

Output: `ReminderMailJob\bin\Release\ReminderMailJob.exe` (+ its `.dll`/`.config` files in the same folder).

## 2. Copy to the server

```
C:\Apps\ReminderMailJob\
```

Copy the entire contents of `bin\Release\` into that folder. Do not run it from a temp or user
Downloads folder.

## 3. Create the Scheduled Task

1. Open **Task Scheduler** (`taskschd.msc`) on the server.
2. **Action → Create Task...** (not "Create Basic Task").
3. **General tab:**
   - Name: `ReminderMailJob`
   - Select **"Run whether user is logged on or not"**
   - Check **"Run with highest privileges"**
   - Configure for: match the server's Windows version
4. **Triggers tab → New:**
   - Begin the task: **On a schedule**
   - Settings: **Daily**
   - Start time: **09:00:00**
   - Check **"Enabled"**
5. **Actions tab → New:**
   - Action: **Start a program**
   - Program/script: `C:\Apps\ReminderMailJob\ReminderMailJob.exe`
   - Start in (optional): `C:\Apps\ReminderMailJob\`
6. **Conditions tab:**
   - Uncheck **"Start the task only if the computer is on AC power"**
7. **Settings tab:**
   - Check **"Run task as soon as possible after a scheduled start is missed"** — this plus the
     `days_before_due` catch-up logic means a missed day never permanently skips a reminder.
   - Check **"If the task fails, restart every"** → 10 minutes, up to 3 attempts
8. Click **OK**, then enter the credentials of an account with permission to run tasks on that server.

## 4. Confirm it survives reboot

Automatic — Task Scheduler tasks are stored in the Windows Task Scheduler database, not tied to a
logged-in session. After any reboot, the task is still there and fires next 9:00 AM.

## 5. Test it manually

Right-click the task → **Run**. Check:
- Task Scheduler → task → **History** tab for success/failure.
- The `mail_send_log` table (`job_name='ReminderMailJob'`) for the actual per-compliance outcome.
- Run the `.exe` directly from a command prompt once to see `Console.WriteLine` output live.

## 6. What it needs to actually work

- Network access from the server to `mazpngpappmysql01.mysql.database.azure.com` (the DB).
- SMTP credentials are read from the `access.ngpdigital` table at runtime.
- If the DB connection string or `MailDomain` ever changes, edit `ReminderMailJob.exe.config` on the
  server directly (no rebuild needed for config-only changes).
