# Compliance Management Portal — Product Requirements Document (PRD)

**Version:** 1.1 (Draft — updated with "visible, but locked" access pattern at all three levels)
**Status:** For Review
**Prepared from:** Founder's handwritten notes

---

## 1. Overview

The Compliance Management Portal is a web application to help organizations track statutory/regulatory compliances across multiple **Plants**, each of which works with multiple **Agencies**, each of which has its own set of recurring **Compliances** (filings, renewals, submissions, etc.) that must be completed on a fixed schedule.

The system has three roles — **Master**, **Owner**, and **Reviewer** — each with a distinct, scoped view of the data.

### 1.1 Goals
- Give a single source of truth for all compliances across all plants and agencies.
- Ensure every compliance has a clear owner responsible for completing/renewing it, and a reviewer who can audit it.
- Automatically track due dates based on configurable frequency, and proactively remind owners before deadlines.
- Give Master a bird's-eye view (all plants/agencies/compliances) and give Owners/Reviewers a narrow, permission-scoped view of only what's relevant to them.

### 1.2 Non-goals (for v1)
- Payment/invoicing tied to compliances.
- Multi-level approval workflows beyond Owner → Reviewer.
- Mobile native app (web-responsive only, assumed).

---

## 2. Roles & Personas

| Role | Description | Core Capability |
|---|---|---|
| **Master** | Admin/super-user of the portal | Full visibility into every Plant, Agency, and Compliance. Creates Agencies and Compliances, assigns Owners and Reviewers, sets schedules and departments. |
| **Owner** | Person responsible for actually fulfilling a compliance | Sees *every* Plant, Agency, and Compliance in the system, but can only open/act on the ones they own — everything else is visible for context but locked. Fills, renews, and closes out the compliances they own; uploads supporting files. |
| **Reviewer** | Person with audit/oversight access | Sees *every* Plant, Agency, and Compliance in the system, but can only open the ones they're assigned to review — everything else is visible for context but locked. View-only access to fulfillment history/attachments on their assigned compliances. Cannot edit. |

> **Assumption (flagged):** Plant creation itself isn't explicitly assigned to a role in the notes — this PRD assumes **Master** also creates/manages Plants, since Master is the only role described as having full administrative capability. Please confirm.

---

## 3. Data Hierarchy

```
Plant
 └── Agency
      └── Compliance
            ├── Owner (fills/renews)
            ├── Reviewer (views only)
            ├── Department (which dept. it concerns)
            ├── Schedule (start date + frequency → next due date)
            ├── Reminders (R1–R4, configurable offsets)
            └── Fulfillment Log (history of completions, with attachments)
```

A Compliance always belongs to exactly one Agency, which always belongs to exactly one Plant. A Compliance has exactly one Owner and at most one Reviewer (see open question in §8).

---

## 4. Functional Requirements

### 4.1 Authentication & Landing
- Authentication is handled entirely by an external, already-deployed system. This app only receives a redirect with a base64-encoded query string containing a token + role.
- This app uses that token as a lookup key (against an external DB, structure TBD) to fetch the real user, then creates a short-lived `local_sessions` row (see §8.2) so it isn't re-querying externally on every request.
- User lands on a role-appropriate landing page:
  - Master → **MasterView**
  - Owner → **Owner View** (navbar item: "Compliances")
  - Reviewer → **Reviewer View**
- Navbar shows the relevant view-switcher/options for that role, plus a **Notification Center** icon (Owner and Master only — see §4.6).

### 4.2 Access Pattern: "Visible, but Locked"

This single pattern governs how Owner and Reviewer navigate through Plant → Agency → Compliance, and is used consistently at all three levels:

- **Every** Plant, Agency, and Compliance is always shown to Owner and Reviewer — nothing is hidden or filtered out of the list.
- At each level, only the items the person actually owns (or reviews) are **clickable/enterable**. Everything else in that same grid or list renders in a visibly **locked/inactive state** (greyed out, dashed border, lock icon, "Not assigned to you" / "Not yours" label) and does not respond to clicks.
- Access at a given level is **derived automatically**: a Plant is unlocked the moment the person owns/reviews at least one Compliance inside it; an Agency is unlocked the same way, scoped to that Plant; a Compliance is unlocked only if the person is its Owner (or its Reviewer, in Reviewer view).
- This gives Owners and Reviewers full situational awareness of everything happening at a Plant/Agency (who else owns what, how many are overdue) without granting them access to act on or open records that aren't theirs.
- Master is exempt from this pattern — every Plant, Agency, and Compliance is always unlocked for Master.

### 4.3 MasterView

**Layout:** Navbar + Main section.

**Main section (Plant selection):**
- Displays every Plant in the system as a large card. Cards fill all available screen space (i.e., a responsive grid, not a scrollable list of small rows).

**Inside a Plant:**
- Shows all **Agencies** under that Plant as cards (same visual style as Plant cards).

**Inside an Agency:**
- Shows all **Compliances** under that Plant + Agency, with key info (name, owner, reviewer, department, status, due date) visible at a glance.
- A **Financial Year filter** is available to narrow the compliance list to a specific FY.

**Master Navbar Actions:**
- **Create New Agency** (form: select Plant → Agency name/description).
- **Create New Compliance** (form: select Plant → Agency → Compliance name, assign Owner, assign Reviewer, assign Department, set start date + frequency).
- **Notification Center** (see §4.6).

**Compliance creation logic:**
- Master sets **Start Date** and **Frequency** (Number + Unit: Days / Weeks / Months / Years).
- System auto-computes and displays the **Next Due Date** from these two inputs.
- Master assigns **Owner**, **Reviewer**, and **Department** at creation time.

### 4.4 Owner View

- Landing page has a **"Compliances"** navbar option.
- **Plant level:** Every Plant in the system is shown as a card. Only Plant(s) where the Owner owns at least one Compliance are clickable; all other Plants render locked (see §4.2).
- **Agency level:** Inside an unlocked Plant, *every* Agency under that Plant is shown as a card. Only the Agency card(s) under which the Owner owns a Compliance are clickable; the rest render locked.
- **Compliance level:** Inside an unlocked Agency, *every* Compliance under that Plant + Agency is listed — including ones owned by other people, shown with their name, department, and due date for context. Only the row(s) the Owner actually owns are clickable; others render locked ("Not yours") and cannot be opened.
- Opening an owned Compliance shows a fulfillment view:
  - Right side: compliance details/history.
  - Left side: a form where the Owner records fulfillment for that compliance — logs completion, sets/updates reminder recipients, and can view/set the remaining reminder configuration (R1–R4 offsets, e.g. "remind 30/15/7/1 days before due").
- Owner's workflow is intentionally narrow: log in → go to their view → do their work (no admin actions, no editing other people's compliances).

### 4.5 Reviewer View

- Same structural pattern as Owner View — Plant → Agency → Compliance, following the same "visible, but locked" rule at every level (§4.2) — but fully **read-only** at the Compliance level.
- **Plant level:** Every Plant is shown; only Plant(s) containing a Compliance the Reviewer is assigned to are clickable.
- **Agency level:** Every Agency under that Plant is shown; only the Agency/agencies where the Reviewer is actually assigned as reviewer on a Compliance are clickable.
- **Compliance level:** Every Compliance under that Plant + Agency is listed for context (owner, department, due date), but only the one(s) the Reviewer is assigned to are clickable. Opening one shows the compliance name and its **full fulfillment history** — all logs, completion dates, who completed each one, and all attached files — exactly as entered by the Owner, but without edit rights.

### 4.6 Notification Center

- Present in both **MasterView** and **Owner View** navbars, shown as a badge/counter icon.
- Shows count of compliances that are:
  - **Overdue**
  - **Due this month**
- **Master** sees counts across *all* compliances, system-wide.
- **Owner** sees counts only for compliances *they* own.
- *(Reviewer notification center not specified in source notes — assumed out of scope for v1; flagged as open question.)*

### 4.7 Reminders & Scheduling

- Each compliance supports up to 4 configurable reminders: **R1, R2, R3, R4** (e.g., days-before-due offsets).
- Recipients for each reminder ("whom to send") are configurable — noted in source as "to be added later," so v1 should support assigning a recipient per reminder slot, defaulting to the Owner.
- Reminders are dispatched via a background notification/scheduling service (source notes reference "Windows Services" — see §7 for a cloud-native recommendation).
- Next due date recalculates automatically after each fulfillment, based on the compliance's frequency.

---

## 5. Access Control Summary

| Data Level | Master | Owner | Reviewer |
|---|---|---|---|
| Plants | All, full access | All visible; only Plant(s) with an owned Compliance are clickable — rest locked | All visible; only Plant(s) with an assigned Compliance are clickable — rest locked |
| Agencies | All, full access | All visible (within an unlocked Plant); only Agency card(s) with an owned Compliance are clickable — rest locked | All visible (within an unlocked Plant); only Agency card(s) with an assigned Compliance are clickable — rest locked |
| Compliances | All, full access (create/edit/assign) | All visible (within an unlocked Agency), for context; only the ones they own are clickable/actionable — others locked, read-blocked | All visible (within an unlocked Agency), for context; only the ones they review are clickable — others locked, read-blocked |
| Create Agency/Compliance | Yes | No | No |
| Notification Center | All compliances | Own compliances only | Not specified (assumed none, v1) |

This "visible, but locked" behavior (§4.2) is the same rule applied at every level — Owners and Reviewers always see the full picture of a Plant or Agency they have a foothold in, but can only act on what's actually theirs.

---

## 6. Non-Functional Requirements (Recommended — not in source notes, flagged for confirmation)

- **Security:** Role-based access control (RBAC) enforced at API layer, not just UI. Auth is external SSO (token+role via base64 query string, resolved against a shared DB table — see §4.1); `users.password_hash` unused. HTTPS everywhere. VAPT-clean is a hard requirement — no known OWASP-class vulnerabilities at release.
- **Auditability:** All create/edit/fulfillment actions logged with user + timestamp in `audit_log`. Field-level changes to a compliance's owner/reviewer/schedule are additionally logged with old→new values in `compliance_history` (see §8.2) so every reassignment/edit is individually accountable, not just a generic blob.
- **File storage:** Attachments (proof of filing, etc.) restricted to PDF/JPG/PNG, max 5MB, stored in Azure Blob Storage, referenced by URL in the database.
- **Scalability:** Should support multiple plants (dozens to hundreds), each with multiple agencies and compliances, without performance degradation on card-grid views (pagination or lazy loading recommended).
- **Availability:** Standard business-hours-plus SLA; reminder dispatch should be resilient to service restarts (durable queue/scheduler, not in-memory timers).

---

## 7. Notes, Assumptions & Open Questions

These are points either underspecified in the original notes or reinterpreted for clarity — please confirm before build:

1. **Plant creation** — assumed to be a Master-only action (not explicitly stated).
2. **Reviewer assignment** — notes suggest one Reviewer per compliance; confirm if multiple reviewers per compliance should be supported.
3. **Reminder recipients** — "whom to send" was noted as "to be added later"; v1 plan defaults recipient to the Owner, with ability to override.
4. **Notification Center for Reviewer** — not mentioned in source notes; assumed excluded from v1.
5. **"Windows Services"** for sending reminders — this reads like a background service/scheduler concept rather than a literal requirement to use Windows OS services. Recommend implementing as an Azure-native scheduled job (Azure Functions Timer Trigger, or Logic Apps) for portability, rather than a literal Windows Service — flagging for your confirmation since the source notes specifically say "Windows Services."
5. **Financial Year definition** — assumed configurable (e.g., Apr–Mar or Jan–Dec); needs confirmation of your organization's FY convention.
6. **Departments** — treated as a lookup/reference list assigned per compliance at creation; assumed Master manages this list.

---

## 8. Database Schema — MySQL on Azure (Azure Database for MySQL – Flexible Server)

### 8.1 Entity-Relationship Summary

```
users ──< plants (created_by)
users ──< agencies (created_by)
plants ──< agencies
agencies ──< compliances
plants ──< compliances (denormalized for fast filtering)
departments ──< compliances
users ──< compliances (owner_id)
users ──< compliances (reviewer_id)
compliances ──< compliance_logs
compliance_logs ──< compliance_attachments
compliances ──< reminders
reminders ──< reminder_dispatch_log
users ──< notifications
compliances ──< notifications
```

### 8.2 Table Definitions

#### `users`
| Column | Type | Constraints |
|---|---|---|
| user_id | INT | PK, AUTO_INCREMENT |
| full_name | VARCHAR(150) | NOT NULL |
| email | VARCHAR(150) | NOT NULL, UNIQUE |
| phone | VARCHAR(20) | NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| is_master | BOOLEAN | DEFAULT FALSE |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

> Note: `is_master` is a global flag. Owner/Reviewer are **not** global roles — they're contextual, derived from whether a user is referenced as `owner_id`/`reviewer_id` on a given compliance row. This matches the notes: "master will only put who is owner, who is Reviewer" per compliance.

#### `departments`
| Column | Type | Constraints |
|---|---|---|
| department_id | INT | PK, AUTO_INCREMENT |
| name | VARCHAR(100) | NOT NULL, UNIQUE |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `plants`
| Column | Type | Constraints |
|---|---|---|
| plant_id | INT | PK, AUTO_INCREMENT |
| name | VARCHAR(150) | NOT NULL |
| code | VARCHAR(50) | UNIQUE |
| location | VARCHAR(255) | NULL |
| created_by | INT | FK → users(user_id) |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

#### `agencies`
| Column | Type | Constraints |
|---|---|---|
| agency_id | INT | PK, AUTO_INCREMENT |
| plant_id | INT | NOT NULL, FK → plants(plant_id) |
| name | VARCHAR(150) | NOT NULL |
| description | TEXT | NULL |
| created_by | INT | FK → users(user_id) |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

Constraint: `UNIQUE (plant_id, name)`

#### `compliances`
| Column | Type | Constraints |
|---|---|---|
| compliance_id | INT | PK, AUTO_INCREMENT |
| agency_id | INT | NOT NULL, FK → agencies(agency_id) |
| plant_id | INT | NOT NULL, FK → plants(plant_id) *(denormalized)* |
| department_id | INT | FK → departments(department_id) |
| name | VARCHAR(200) | NOT NULL |
| description | TEXT | NULL |
| owner_id | INT | NOT NULL, FK → users(user_id) |
| reviewer_id | INT | NULL, FK → users(user_id) |
| start_date | DATE | NOT NULL |
| frequency_number | INT | NOT NULL |
| frequency_unit | ENUM('day','week','month','year') | NOT NULL |
| next_due_date | DATE | NOT NULL |
| status | ENUM('pending','completed','overdue') | DEFAULT 'pending' |
| financial_year | VARCHAR(12) | e.g. 'FY 2026-27' |
| created_by | INT | FK → users(user_id) |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

Indexes: `INDEX (owner_id)`, `INDEX (reviewer_id)`, `INDEX (plant_id, agency_id)`, `INDEX (next_due_date)`, `INDEX (financial_year)`

#### `compliance_logs` (fulfillment history)
| Column | Type | Constraints |
|---|---|---|
| log_id | INT | PK, AUTO_INCREMENT |
| compliance_id | INT | NOT NULL, FK → compliances(compliance_id) |
| action_date | DATE | NOT NULL |
| done_by | INT | NOT NULL, FK → users(user_id) |
| remarks | TEXT | NULL |
| next_due_date_snapshot | DATE | Due date at time of this entry |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `compliance_attachments`
| Column | Type | Constraints |
|---|---|---|
| attachment_id | INT | PK, AUTO_INCREMENT |
| log_id | INT | FK → compliance_logs(log_id) |
| compliance_id | INT | FK → compliances(compliance_id) |
| file_name | VARCHAR(255) | NOT NULL |
| file_url | VARCHAR(500) | NOT NULL *(Azure Blob Storage URL)* |
| file_size_kb | INT | NULL |
| uploaded_by | INT | FK → users(user_id) |
| uploaded_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `reminders`
| Column | Type | Constraints |
|---|---|---|
| reminder_id | INT | PK, AUTO_INCREMENT |
| compliance_id | INT | NOT NULL, FK → compliances(compliance_id) |
| reminder_label | ENUM('R1','R2','R3','R4') | NOT NULL |
| days_before_due | INT | NOT NULL |
| recipient_id | INT | FK → users(user_id) |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

Constraint: `UNIQUE (compliance_id, reminder_label)`

#### `reminder_dispatch_log`
| Column | Type | Constraints |
|---|---|---|
| dispatch_id | INT | PK, AUTO_INCREMENT |
| reminder_id | INT | FK → reminders(reminder_id) |
| compliance_id | INT | FK → compliances(compliance_id) |
| scheduled_date | DATE | NOT NULL |
| sent_at | DATETIME | NULL |
| sent_status | ENUM('pending','sent','failed') | DEFAULT 'pending' |
| channel | ENUM('email','sms','push','in_app') | DEFAULT 'email' |

#### `notifications` (in-app notification center)
| Column | Type | Constraints |
|---|---|---|
| notification_id | INT | PK, AUTO_INCREMENT |
| user_id | INT | NOT NULL, FK → users(user_id) |
| compliance_id | INT | FK → compliances(compliance_id) |
| notification_type | ENUM('overdue','due_this_month') | NOT NULL |
| message | VARCHAR(500) | NULL |
| is_read | BOOLEAN | DEFAULT FALSE |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `compliance_history` (field-level edit accountability)
| Column | Type | Constraints |
|---|---|---|
| history_id | INT | PK, AUTO_INCREMENT |
| compliance_id | INT | NOT NULL, FK → compliances(compliance_id) |
| field_name | VARCHAR(50) | NOT NULL, e.g. 'owner_id','reviewer_id','start_date','frequency' |
| old_value | VARCHAR(255) | NULL |
| new_value | VARCHAR(255) | NULL |
| changed_by | INT | NOT NULL, FK → users(user_id) |
| changed_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `local_sessions` (cached SSO session)
| Column | Type | Constraints |
|---|---|---|
| session_id | VARCHAR(64) | PK |
| user_id | INT | NOT NULL, FK → users(user_id) |
| role | ENUM('master','owner','reviewer') | NOT NULL |
| source_token | VARCHAR(500) | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| expires_at | DATETIME | NOT NULL, short-lived (e.g. 30 min) regardless of source app's own expiry |

#### `audit_log` (recommended, not in source notes)
| Column | Type | Constraints |
|---|---|---|
| audit_id | BIGINT | PK, AUTO_INCREMENT |
| user_id | INT | FK → users(user_id) |
| action | VARCHAR(100) | e.g. 'CREATE_COMPLIANCE' |
| entity_type | VARCHAR(50) | e.g. 'compliance' |
| entity_id | INT | NULL |
| details | JSON | NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### 8.3 Azure-Specific Notes

- **Service:** Azure Database for MySQL – Flexible Server (supports auto-scaling, scheduled backups, and zone redundancy).
- **File storage:** Attachments should live in Azure Blob Storage (not in MySQL); only the URL/path is stored in `compliance_attachments.file_url`.
- **Reminder scheduling:** Recommend Azure Functions (Timer Trigger) or Azure Logic Apps to compute due reminders daily and populate `reminder_dispatch_log`, rather than a literal Windows Service — see open question in §7.
- **Connection security:** Enforce SSL/TLS connections to the MySQL server; restrict access via Azure VNET/firewall rules to app-tier only.

---

*End of draft. Flagged assumptions in §7 should be confirmed before development begins.*
