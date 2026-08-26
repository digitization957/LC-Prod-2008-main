# Test Cases — Compliance App

Each test case has: **What it checks**, **Steps**, and **Expected Result**.

---

## 1. Login / SSO

### TC01 - Token+role login (existing SSO)
**What it checks:** The old-style SSO link still logs a user in automatically.
**Steps:**
1. Get a valid base64-encoded token and role for a real person.
2. Open `Default.aspx?token=<base64token>&role=<base64role>&method=access` in browser.
**Expected:** User is logged in immediately (no login screen), lands on the correct role's dashboard (Master/Owner/Reviewer), and the URL in the address bar changes to plain `Default.aspx` (token/role removed from URL/history).

### TC02 - JWT login (new SSO)
**What it checks:** The new `jwt` querystring login works the same as token+role.
**Steps:**
1. Get a valid jwt link, e.g. `Default.aspx?jwt=<encoded value>`.
2. Open it in browser.
**Expected:** Same as TC01 — auto-login, correct role/name shown, URL cleaned to `Default.aspx` after login.

### TC03 - Invalid token / jwt
**What it checks:** App doesn't break on a bad login link.
**Steps:**
1. Open `Default.aspx?jwt=garbage123` (or a broken token/role value).
**Expected:** A clear, friendly error message is shown. App does not crash, does not log the user in, no technical error/stack trace visible.

### TC04 - Unpermitted person
**What it checks:** People not allowed to use this app are blocked even with a valid token.
**Steps:**
1. Use a token belonging to a person marked "not allowed" for this app in the access system.
2. Try to log in.
**Expected:** Error message like "This person is not permitted to use this app." No session created.

### TC05 - Invalid role value
**What it checks:** Role must be one of master/owner/reviewer.
**Steps:**
1. Use a login link where role decodes to something else (e.g. "admin").
**Expected:** "Invalid role" error, login blocked.

### TC06 - Session persists on refresh
**What it checks:** User isn't logged out just by refreshing the page.
**Steps:**
1. Log in normally.
2. Press browser refresh (F5).
**Expected:** Still logged in, same screen/data, no login screen shown again.

### TC07 - Dev login disabled in production
**What it checks:** The internal dev/test login option is not usable outside dev.
**Steps:**
1. On the production/UAT environment, check if a "pick a role and user" dev login screen is reachable.
**Expected:** Dev login is not available (config `DevAuthEnabled` is off); trying it shows an error, not a working login.

### TC08 - "View Detailed Report" email link
**What it checks:** Reviewers can click a report link from email and get straight into the app.
**Steps:**
1. Trigger/receive a compliance report email with a "View Detailed Report" link.
2. Click the link.
**Expected:** Opens the app already logged in as that reviewer, showing the correct compliance directly (no manual login).

### TC09 - Reused / expired report link
**What it checks:** Report links can't be reused or used after expiry.
**Steps:**
1. Click the same report link from TC08 a second time.
2. Separately, try an old link known to be expired.
**Expected:** Second click shows a "already used" message. Expired link shows an "expired" message. Both fall back to the normal sign-in screen instead of crashing.

---

## 2. Role-based access

### TC10 - Master sees everything
**What it checks:** Master role has full visibility.
**Steps:**
1. Log in as Master.
2. Browse plants, agencies, compliances.
**Expected:** All plants and their agencies/compliances are visible. Notifications bell is visible.

### TC11 - Owner sees only their scope
**What it checks:** Owner is restricted to their assigned plant(s).
**Steps:**
1. Log in as Owner.
2. Check plant/agency/compliance list.
**Expected:** Only plants/compliances this owner is responsible for are shown. Owner can create and edit compliances.

### TC12 - Reviewer is read-only
**What it checks:** Reviewer cannot edit anything, only reviews assigned items.
**Steps:**
1. Log in as Reviewer.
2. Browse assigned compliances, try to find any edit/create button.
**Expected:** Only compliances assigned to this reviewer are shown. No create/edit/complete buttons available anywhere.

### TC13 - Backend blocks unauthorized actions (not just hidden buttons)
**What it checks:** Security is enforced on the server, not just hidden in the UI. This is the most important VAPT-related test.
**Steps:**
1. Log in as Reviewer, get their sessionId (via browser dev tools/network tab).
2. Using a tool like Postman, directly call an owner-only action (e.g. CreateCompliance) using the reviewer's sessionId.
**Expected:** Server rejects the request with an error. Data is NOT created/changed even though the UI button doesn't exist for reviewers.

---

## 3. Navigation

### TC14 - Plant → Agencies
**Steps:** Log in, click any plant from the list.
**Expected:** Shows the list of agencies under that plant.

### TC15 - Agency → Compliances
**Steps:** From an agency, click into it.
**Expected:** Shows the list of compliances for that agency.

### TC16 - Compliance → Detail
**Steps:** Click any compliance from the list.
**Expected:** Opens the compliance detail screen with all fields, history, attachments.

### TC17 - Breadcrumb navigation
**Steps:** From the detail screen, click each breadcrumb level (Agency, Plant) going back up.
**Expected:** Each click takes you to the correct level's list, with correct data (no mixing plants/agencies).

---

## 4. Compliance CRUD (Owner)

### TC18 - Create a compliance (happy path)
**Steps:**
1. As Owner, go to an agency, click "Create Compliance".
2. Fill all fields correctly (title, category, frequency, owner, reviewer, due date, etc).
3. Submit.
**Expected:** New compliance appears in the list immediately with correct details.

### TC19 - Create with missing required fields
**Steps:** Leave a required field (e.g. title) blank, try to submit.
**Expected:** Form shows validation error, does not save, no partial/broken record created.

### TC20 - Edit an existing compliance
**Steps:**
1. Open an existing compliance, click Edit.
2. Change a field (e.g. reviewer or due date), save.
**Expected:** Change is reflected both in the list view and the detail view immediately.

### TC21 - Create a new agency
**Steps:**
1. As Owner/Master, add a new agency under a plant with name + description.
**Expected:** New agency shows up in the agency list right away, can be clicked into (empty compliance list).

### TC22 - "As and When" category has no fixed frequency
**What it checks:** This category type doesn't auto-calculate due dates like normal frequencies (monthly/yearly) do.
**Steps:**
1. Create/open a compliance with category "As and When".
2. Mark it complete.
**Expected:** No frequency dropdown forces a fixed cycle. After marking complete, the NEXT due date is NOT auto-calculated — owner has to manually enter it each time.

---

## 5. Fulfilment (mark complete / revert)

### TC23 - Mark a compliance complete
**Steps:**
1. Open a pending compliance.
2. Enter completion date, remarks, attach a file, submit.
**Expected:** Status changes to Completed. A log entry is created with date/remarks/attachment. If frequency-based, next due date auto-calculates correctly (e.g. monthly = +1 month).

### TC24 - Manual next due date override
**Steps:** For a compliance/category that allows manual next-due-date, set a custom date instead of the auto-calculated one.
**Expected:** The custom date is saved and shown as next due, overriding the automatic calculation.

### TC25 - Valid attachment upload
**Steps:** Upload a normal file (PDF/image) under the allowed size limit.
**Expected:** File uploads successfully, is listed under the compliance, and can be downloaded/opened correctly (same file, not corrupted).

### TC26 - Invalid attachment upload (security)
**What it checks:** Server blocks dangerous or oversized files — important for VAPT.
**Steps:**
1. Try uploading a file larger than the allowed limit.
2. Try uploading a disallowed type, e.g. `.exe`, `.aspx`, `.php`.
**Expected:** Both are rejected with a clear error message. Nothing gets saved to the server/executed.

### TC27 - Revert a completed fulfilment
**Steps:**
1. As Owner/Master, open a completed compliance, choose "Revert", enter a reason.
**Expected:** Status goes back to pending/incomplete, the reason is stored, and it's visible in audit/history.

### TC28 - Reminders
**Steps:** Add one or more reminders to a compliance (e.g. 7 days before due).
**Expected:** Reminder is saved and shows up correctly (in "My Schedule" or notifications) as the due date approaches.

---

## 6. Reports & Notifications

### TC29 - Summary report
**Steps:**
1. Generate the summary report for "All Plants".
2. Generate it again filtered to a single plant.
**Expected:** Counts (pending/overdue/completed) are accurate and match what's actually in the compliance lists for that scope.

### TC30 - My Schedule
**Steps:** As any role, open "My Schedule".
**Expected:** Only shows compliances relevant to the logged-in user (their own upcoming/overdue items), not everyone else's.

### TC31 - Notifications bell
**Steps:** Check notification bell as Master, Owner, and Reviewer.
**Expected:** Master/Owner see overdue/upcoming alerts. Reviewer does not see a notifications bell at all.

### TC32 - Training completion logging
**Steps:** Trigger the training-complete action once, then try triggering it again in the same period.
**Expected:** First trigger logs successfully. It should not be possible to log duplicate completions for the same required period.

---

## 7. Session / Security (VAPT checklist)

### TC33 - Session expiry
**Steps:**
1. Log in, stay idle past the session timeout.
2. Try to perform an action (e.g. click into a compliance).
**Expected:** User is forced back to login/sign-in, no old data or actions go through with the expired session.

### TC34 - Tampered/random sessionId
**Steps:** Using Postman/browser dev tools, call any WebMethod (e.g. GetCompliances) with a made-up random sessionId.
**Expected:** Clean rejection (e.g. "invalid session"), no data returned, no exception/stack trace exposed in the response.

### TC35 - SQL injection
**Steps:** In login fields, search boxes, and any text input, try values like `' OR '1'='1`, `'; DROP TABLE--`.
**Expected:** No database error shown, no unauthorized data returned, no data altered/deleted.

### TC36 - XSS (script injection)
**Steps:** In remarks, name, or description fields, enter `<script>alert(1)</script>` and save.
**Expected:** When viewed later, it displays as plain text (harmless), the script does NOT execute/pop up an alert.

### TC37 - IDOR (accessing someone else's data)
**Steps:** As Owner A, note a complianceId belonging to Owner B. Call GetComplianceDetail directly with Owner A's session but Owner B's complianceId.
**Expected:** Access denied / error — Owner A cannot view or modify Owner B's compliance.

### TC38 - HTTPS & no token leakage
**Steps:**
1. Confirm the app is only accessible via HTTPS (not plain HTTP).
2. After SSO login (TC01/TC02), check browser history/URL bar.
**Expected:** HTTP requests redirect to HTTPS or are blocked. After login, URL no longer shows the token/jwt (already cleaned per TC01/TC02).

### TC39 - File upload path traversal
**Steps:** Attempt to upload a file with a crafted name like `../../evil.aspx` or `..\..\web.config`.
**Expected:** Filename is sanitized or the upload is rejected; file cannot be written outside the intended upload folder.

### TC40 - Generic error messages
**Steps:** Force a server-side error (e.g. malformed request, invalid data type).
**Expected:** User sees a generic, friendly error message. No SQL text, stack trace, file paths, or internal exception details are shown.

---

## 8. Cross-browser / Responsive

### TC41 - Cross-browser check
**Steps:** Repeat login, create compliance, and mark-complete flows on Chrome, Edge, and Firefox.
**Expected:** All flows work identically with no layout breakage or JS errors in any browser.

### TC42 - Mobile/tablet responsiveness
**Steps:** Open the app on a mobile device or resize browser to mobile/tablet width.
**Expected:** Layout adjusts cleanly (no horizontal scroll, buttons/text readable, forms usable) — no broken UI elements.
