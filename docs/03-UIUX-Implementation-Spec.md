# Statum — UI/UX Implementation Specification

**Purpose:** This document specifies the interface, behavior, and logic of the Statum Compliance Operations Platform in enough detail that it can be rebuilt to match exactly — same layout, same states, same copy, same interactions — without needing to see the reference prototype.

**How to use this document (for an AI coding agent):** Treat every section below as a requirement, not a suggestion. Where exact values (px, hex, copy text) are given, use them verbatim. Where logic is given as pseudocode, implement it exactly as described — the app's correctness depends on this logic (especially §5 Access Control and §9 Business Logic), not just its visuals. If a company builds a real backend for this, §5 and §9 are the rules that must be enforced server-side too, not just in the UI.

**Companion documents:** `Compliance_Management_Portal_PRD.md` (product requirements + MySQL schema), `Statum_Design_System.md` (design rationale/token reference). This document is the implementation-level detail layer on top of both.

---

## 1. Tech Assumptions

The reference build is a single-page app (no routing library — one root view swapped by JS state), vanilla HTML/CSS/JS, no backend (in-memory data, reset on reload). If rebuilding with a framework (React/Vue/etc.), preserve:
- The same **client-side state shape** (§4.1) driving a single render function
- The same **derived-access-control functions** (§5.2) — access is *always* computed from ownership/review relationships, never stored as a separate "canAccess" flag
- The same **component boundaries** (§7) so state changes re-render predictably

---

## 2. Global Design Tokens

(Full rationale in `Statum_Design_System.md` — this is the condensed reference to implement against.)

```css
/* Color */
--paper:#F5F6F8;        --surface:#FFFFFF;      --surface-alt:#EEF1F5;
--ink:#161B22;           --ink-soft:#57616F;      --ink-faint:#8B93A1;
--navy-950:#0E1A2E;      --navy-800:#16273F;      --navy-700:#1E3654;
--navy-600:#28496E;      --navy-100:#E7ECF3;
--brass:#A9701F;         --brass-ink:#8A5B18;     --brass-soft:#F6ECD9;
--rust:#9C3B2E;          --rust-soft:#F5DFDB;
--moss:#2E6B4F;          --moss-soft:#DFEBE3;
--line:#E2E5EB;          --line-strong:#C9CFD9;

/* Elevation */
--shadow-sm: 0 1px 2px rgba(14,26,46,.07);
--shadow-hover: 0 10px 28px rgba(14,26,46,.12), 0 2px 6px rgba(14,26,46,.07);
--shadow-lg: 0 20px 48px rgba(14,26,46,.18), 0 4px 12px rgba(14,26,46,.08);

/* Radius */
--radius-sm:7px; --radius-md:11px; --radius-lg:16px;

/* Gradients */
--grad-navy: linear-gradient(180deg, #16273F 0%, #0E1A2E 100%);
--grad-navy-btn: linear-gradient(180deg, #223f63 0%, #16273F 100%);

/* Type */
--font-display:'Fraunces', Georgia, serif;      /* headings only */
--font-body:'Public Sans', -apple-system, sans-serif; /* everything else */
--font-mono:'IBM Plex Mono', monospace;         /* dates, codes, stamp text, FY tags */
```

**Body background:** `var(--paper)` + a fixed, low-opacity dot-grid texture: `radial-gradient(circle at 1px 1px, rgba(14,26,46,.05) 1px, transparent 0)`, `background-size: 22px 22px`.

**Base type:** 15px / 1.5 line-height, Public Sans, color `--ink`.

**Container:** max-width `1180px`, centered, `padding: 36px 28px 80px`.

---

## 3. Screen Inventory

There are exactly **4 navigation depths**, reused by all three roles, plus a small set of overlays:

| # | Screen | Applies to |
|---|---|---|
| 1 | Plant grid (root) | Master, Owner, Reviewer |
| 2 | Agency grid (inside a plant) | Master, Owner, Reviewer |
| 3 | Compliance list (inside an agency) | Master, Owner, Reviewer |
| 4 | Compliance detail | Master (read+edit), Owner (fulfillment form), Reviewer (read-only) |
| — | Create Agency modal | Master only |
| — | Create/Edit Compliance modal | Master only |
| — | Notification panel (dropdown) | Master, Owner |

Only one role is "active" at a time (this is a role-switching prototype, not simultaneous multi-user), selected via the top demo bar in this reference build. **When wiring real authentication, remove the role-switcher UI and derive `role` + `actingUserId` from the logged-in session instead — every other rule in this document still applies unchanged.**

---

## 4. State & Navigation Model

### 4.1 State shape

```js
state = {
  role: 'master' | 'owner' | 'reviewer',
  actingUserId: string | null,   // which owner/reviewer is "logged in" (n/a for master)
  plantId: string | null,        // current drill-down position
  agencyId: string | null,
  complianceId: string | null,   // set only when viewing compliance detail
  fy: 'all' | 'FY 2025-26' | 'FY 2026-27' | 'FY 2027-28',
  tempAttachments: string[]      // in-progress attachment chips on the open fulfillment form
}
```

### 4.2 Navigation rules

- Switching **role** resets `plantId`, `agencyId`, `complianceId`, and `fy` to their defaults, and sets `actingUserId` to the first user in the relevant list (owner or reviewer).
- Clicking an **accessible** Plant card sets `plantId`, clears `agencyId`/`complianceId`.
- Clicking an **accessible** Agency card sets `agencyId`, clears `complianceId`.
- Clicking an **accessible** Compliance row sets `complianceId` and resets `tempAttachments` to `[]`.
- Clicking a **breadcrumb** segment clears everything below that level (see §7.11).
- Locked cards/rows carry no click handler at all — they are not simply visually disabled, they have no interactive affordance in the DOM.
- The single render function re-derives the entire visible screen from `state` on every change — there is no separate "screen" state; the screen shown is a pure function of `{role, plantId, agencyId, complianceId}`.

---

## 5. Access Control — "Visible, but Locked"

This is the single most important behavioral rule in the product. It must be implemented exactly as described, at all three navigation levels, for both Owner and Reviewer.

### 5.1 Rule

> Every Plant, Agency, and Compliance is **always shown** to Owner and Reviewer. Only the ones the acting user actually owns (Owner role) or is assigned to review (Reviewer role) are **clickable**. Everything else in the same grid/list renders in a locked, non-interactive state. Master is exempt — everything is always accessible.

### 5.2 Access functions (implement exactly)

```js
function scopedComplianceIds(role, actingUserId) {
  if (role === 'master') return ALL_COMPLIANCE_IDS;
  if (role === 'owner')  return compliances.filter(c => c.ownerId === actingUserId).map(c => c.id);
  if (role === 'reviewer') return compliances.filter(c => c.reviewerId === actingUserId).map(c => c.id);
}

function isPlantAccessible(plantId, role, actingUserId) {
  if (role === 'master') return true;
  const ids = scopedComplianceIds(role, actingUserId);
  return compliances.some(c => ids.includes(c.id) && c.plantId === plantId);
}

function isAgencyAccessible(agencyId, role, actingUserId) {
  if (role === 'master') return true;
  const ids = scopedComplianceIds(role, actingUserId);
  return compliances.some(c => ids.includes(c.id) && c.agencyId === agencyId);
}

function isComplianceAccessible(complianceId, role, actingUserId) {
  if (role === 'master') return true;
  return scopedComplianceIds(role, actingUserId).includes(complianceId);
}
```

A Plant is unlocked the moment the acting user owns/reviews **at least one** compliance anywhere inside it — regardless of which Agency that compliance sits under. Same logic scoped one level down for Agency.

### 5.3 What a locked item shows

It must still be informative — the point is situational awareness without action rights:

- **Locked Plant/Agency card:** icon, name, meta info exactly as an unlocked card, but no stat row — replaced with a single line: lock icon + `Not assigned to you`.
- **Locked Compliance row:** full row content (name, owner, reviewer, department, FY, due date) rendered exactly as an unlocked row would — the only difference is the trailing status pill is replaced with lock icon + `Not yours`, and the row is not clickable.

This is deliberate: a locked compliance row still tells the Owner/Reviewer *who* owns it and *when* it's due, so they have full context on their Agency, they just can't open or act on it.

---

## 6. Screen Specifications

### 6.1 Screen 1 — Plant Grid (root)

**Header block** (`.page-head`):
- Eyebrow (mono, uppercase, brass, with a 14×2px brass tick before it):
  - Master: `MASTERVIEW`
  - Owner: `OWNER WORKSPACE`
  - Reviewer: `REVIEWER WORKSPACE`
- H1 (Fraunces 30px):
  - Master: `Compliance Command Center`
  - Owner: `My compliance queue`
  - Reviewer: `Compliance review`
- Description line (`--ink-soft`, 14.5px):
  - Master: `A single view across every plant, agency and filing obligation in the organization.`
  - Owner: `Every plant is listed below — only plants where you own at least one compliance are open to you.`
  - Reviewer: `Every plant is listed below — only plants with a compliance assigned to you for review are open. Access is read-only.`

**Breadcrumb:** single segment, label `All plants`, non-clickable (already at root) — same label for all three roles.

**Body:** card grid, `minmax(270px, 1fr)`, gap 16px. One card per Plant, **all Plants always rendered**, in fixed dataset order (no accessible-first sorting). See §7.1 for card anatomy.

### 6.2 Screen 2 — Agency Grid

**Header block:**
- Eyebrow = the plant's code (e.g. `CH-01`)
- H1 = plant name
- Description = `{plant.location} · select an agency to view its compliances.`

**Breadcrumb:** `All plants  ›  {Plant Name}` — first segment clickable (returns to Screen 1), second is current/bold.

**Body:** card grid, same layout rules as Screen 1. One card per Agency **belonging to this plant**, all agencies always rendered regardless of accessibility.

### 6.3 Screen 3 — Compliance List

**Header block:**
- Eyebrow = plant name
- H1 = agency name
- Description = `{agency.department} compliances tracked under this agency.`

**Breadcrumb:** `All plants  ›  {Plant Name}  ›  {Agency Name}` — first two segments clickable.

**Toolbar row** (`.list-toolbar`, flex space-between):
- Left: Financial Year filter — label `Financial year` + a `<select>` with options `All years` (value `all`, default), `FY 2025-26`, `FY 2026-27`, `FY 2027-28`.
- Right: result count, right-aligned, faint — `{n} compliance` / `{n} compliances` (singular/plural exact match on count === 1).

**Body:** vertical list, one row per Compliance under this Plant+Agency (filtered by FY if not "all"), sorted ascending by `next_due_date`. **All compliances always rendered** — see §5.3 for the locked-row treatment of ones the acting user doesn't own/review. See §7.2 for row anatomy.

**Empty state** (only when the FY filter excludes everything — never happens for "All years" since an accessible agency always has ≥1 compliance): icon `calendar`, title `No compliances found`, body `No compliances match this financial year filter for {agency name}. Try switching the filter above.`

### 6.4 Screen 4 — Compliance Detail

**Breadcrumb:** `All plants › {Plant} › {Agency} › {Compliance name}` — first three clickable, name is current.

**Detail head** (`.detail-head`, white card, flex row, gap 24px):
- Left: the ink-stamp badge (§7.4), status-colored.
- Right (`.info`):
  - If **Reviewer**: a small tag above the title — lock-adjacent styling but using the `eye` icon — text `View only`.
  - H2 (Fraunces 21px) = compliance name.
  - Subline (`--ink-soft`, 13.5px) = `{Plant name} · {Agency name}`.
  - **Detail grid** (`auto-fit, minmax(150px,1fr)`, gap 16px), each cell = small uppercase faint label + value:
    - Owner · Reviewer · Department · Frequency (`Every {n} {unit}(s)`) · Start date · Next due · Financial year
  - If **Master**: an `Edit assignment` outline button below the grid (pencil icon), opens the Compliance modal in edit mode (§8.4).

**Below the detail head**, role-dependent body:

- **Master & Reviewer:** single full-width panel — `Fulfillment history` (§6.5).
- **Owner:** two-column layout (`1.1fr / 1.5fr`, collapsing to one column ≤860px) — left: fulfillment form (§7.6 / §8.5), right: `Fulfillment history` panel.

### 6.5 Fulfillment History panel

White card, header = `paper-text` icon + `Fulfillment history` (Fraunces 15.5px). Body: reverse-chronological list of log entries (`.history-item`), each:
- A small moss-colored dot (fixed color regardless of overall compliance status — history entries represent completed actions)
- Date, mono, bold, navy, fixed 92px column
- Remarks text
- `Logged by {name}`
- If files attached: row of file chips (paperclip icon + filename, navy-tinted background)

If no logs exist yet: empty state, icon `clock`, title `No fulfillment logged yet`, body `Once the owner completes this compliance, the log will appear here.`

---

## 7. Component Specifications

### 7.1 Entity Card (Plant / Agency)

**Anatomy (top to bottom):**
1. Icon chip — 42×42px, `radius-md`, `--navy-100` bg, `--navy-700` icon (`building` for Plant, `folder` for Agency), 20px icon
2. Title — Fraunces 17px, `--navy-950`
3. Meta line — 12.5px, `--ink-soft` (Plant: location; Agency: `{department} · {plant name}`)
4. Code line (Plant only) — mono, 11px, `--ink-faint`
5. Divider (`--line`, 1px) + stat row: up to 3 mini-stats, each a colored dot (7px) + count + label (`overdue`/`due`/`compliant`), 12px bold — **omit any stat whose count is 0**
6. Chevron-right icon, absolute top-right, `--ink-faint`

**Container:** white surface, 1px `--line` border, `radius-lg` (16px), 20px padding, `shadow-sm` resting.
**Hover:** `translateY(-3px)`, `shadow-hover`, border → `--line-strong`, transition `.2s cubic-bezier(.2,.8,.3,1)`.
**Entrance animation:** `riseIn` (10px rise + fade), staggered `~40ms` per card up to the 5th, capped after.

**Locked variant** (`.entity-card.locked`):
- `background: var(--surface-alt)`, `border-style: dashed`, no hover transform/shadow, `cursor: not-allowed`
- Icon chip background → `--line`, icon color → `--ink-faint`
- Title color → `--ink-soft`
- Steps 5–6 above (stats + chevron) replaced by a single line: lock icon (13px) + `Not assigned to you`, top-bordered, same position as the stat row
- No click handler, no `data-plant-id`/`data-agency-id` attribute

### 7.2 Compliance Row

**Container:** white surface, 1px `--line` border, **3px colored left border** matching status (`--rust`/`--brass`/`--moss`), `radius-md` (11px), padding `16px 18px`, flex row, gap 18px, `margin-bottom: 10px`.
**Hover:** `translateY(-1px)`, `shadow-hover`, border → `--line-strong`.

**Anatomy (left to right):**
1. Main block (flex:1): compliance name (14.5px bold) → meta row below it, 12px `--ink-soft`, wrapping flex: `👤 Owner: {name}` · `👁 Reviewer: {name}` · `📁 {department}` · `{FY tag, mono}`
2. Due block: right-aligned, label `NEXT DUE` (10.5px, faint, uppercase) over date (mono, 13px bold)
3. Status pill (§7.3)

**Locked variant** (`.compliance-row.locked`): dashed border, left border becomes neutral `--line-strong` (no status color — locked rows don't broadcast status color since the user can't act on it), `background: var(--surface-alt)`, title muted, due-date block at 60% opacity, status pill replaced with lock icon + `Not yours`. No `data-compliance-id` attribute.

### 7.3 Status Pill

Rounded-pill (20px radius), `4px 10px` padding, mono, 11.5px, bold, uppercase, small 6px dot + label:
| Status | Background | Text | Label |
|---|---|---|---|
| overdue | `--rust-soft` | `--rust` | `Overdue` |
| due | `--brass-soft` | `--brass-ink` | `Due this month` |
| compliant | `--moss-soft` | `--moss` | `Compliant` |

### 7.4 Ink-Stamp Badge

92×92px circle, 2.5px solid border in the status color (`currentColor`), rotated `-7deg`, centered mono uppercase bold text (11px, the status label from §7.3), a second concentric ring 5px inset at 45% opacity, `filter: drop-shadow(0 3px 6px rgba(14,26,46,.1))`. **Use only once per screen** (compliance detail header) — do not reuse at list density.

### 7.5 Buttons

| Variant | Fill | Text | Border | Hover |
|---|---|---|---|---|
| `.btn-primary` | `--grad-navy-btn` | white | none | `translateY(-1px)`, deeper shadow |
| `.btn-outline` | white | `--navy-950` | `--line-strong` | bg → `--surface-alt`, border → `--navy-600` |
| `.btn-ghost` | transparent | `--ink-soft` | none | bg → `--surface-alt` |

Base: `8px` radius, `13.5px` font, weight 600, `8px 15px` padding (`.btn-sm`: `6px 12px`, `12.5px`), `7px` icon gap, transition `.18s cubic-bezier(.2,.8,.3,1)`.

### 7.6 Form Fields

Inputs/selects/textareas: `--line-strong` 1px border, `8px` radius, `9px 11px` padding, white bg.
**Focus:** border → `--navy-600`, `box-shadow: 0 0 0 3px rgba(30,54,84,.1)` (soft glow, not just a color swap).
Labels: 12.5px bold, `6px` bottom margin. Field groups spaced `16px` apart. Two-field rows use `.field-row` (`1fr 1fr` grid, collapses to 1 column ≤720px).

### 7.7 Modals

Centered overlay (`rgba(14,26,46,.45)`), modal card max-width `560px`, `radius-lg`, `shadow-lg`.
**Header:** icon chip (38×38px, `--navy-100`/`--navy-700`, `radius-md`) + title (Fraunces 18px) + subtitle (12.5px, `--ink-soft`), close button top-right (30×30px, `x` icon).
**Body:** scrollable if tall (`max-height: 60vh`), fields grouped under uppercase mono section labels with a bottom border (e.g. `LOCATION`, `ASSIGNMENT`, `SCHEDULE` in the compliance modal).
**Footer:** right-aligned `Cancel` (ghost) + primary action button.

**Create Agency modal fields, in order:** Plant (select) → Agency name (text, required) → Description (textarea, optional).

**Create/Edit Compliance modal fields, in order, grouped:**
- *Location:* Plant (select) → Agency (select, options filtered live by chosen Plant) → Compliance name (text, required)
- *Assignment:* Owner (select) → Reviewer (select) → Department (select: Environment / Human Resources / Safety / Engineering / Finance / Safety & Operations)
- *Schedule:* Start date (date, required) → Frequency (number input, default `1`, min `1` + unit select: Day(s)/Week(s)/Month(s) default-selected/Year(s)) → **Next due date preview** (read-only highlighted box, mono, recalculated live on every change to start date or frequency)

Modal title/button text: `Create agency` / `Create compliance` when creating; `Edit compliance` / `Save changes` when editing (button text must switch — this was a bug in an earlier build, verify it explicitly).

### 7.8 Notification Panel

Anchored dropdown below the bell icon, 360px wide, `radius-lg`, `shadow-lg`.
**Header:** `Notifications` + `{n} need attention` count.
**Body:** grouped into two sections, **overdue first**, each with a sticky-style label row (`--surface-alt` bg, colored text): `OVERDUE · {n}` (rust) and `DUE THIS MONTH · {n}` (brass-ink). A section is omitted entirely if its count is 0. Each item: colored icon chip (alert-triangle for overdue / clock for due) + compliance name (13px bold) + `{Plant} · {Agency} · Due {date}` (11.5px, `--ink-soft`).
**Empty state:** if nothing overdue/due, single centered line: `All caught up — nothing overdue or due this month.`
**Bell badge:** small red circle, top-right of the bell icon, count = overdue + due, **hidden entirely if count is 0**.
**Scope:** Master = counted across all compliances. Owner = counted across only their own. **Not shown at all for Reviewer** (no bell icon rendered in Reviewer navbar).

### 7.9 Toast

Bottom-center, dark navy pill, white text, check-circle icon (moss), `shadow-lg`, slides up + fades in, auto-dismisses after **2.6s** with a 250ms fade-out.

### 7.10 Avatar

28×28px circle, initials (mono, bold, white), background = one of 5 fixed duotone gradients, deterministically chosen by hashing the person's name (so the same person always gets the same color):
```js
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#1E3654,#0E1A2E)',
  'linear-gradient(135deg,#A9701F,#7A5316)',
  'linear-gradient(135deg,#2E6B4F,#1F4A37)',
  'linear-gradient(135deg,#9C3B2E,#6E2A20)',
  'linear-gradient(135deg,#28496E,#152B45)'
];
function avatarGradient(name){
  let h = 0;
  for (let i=0;i<name.length;i++) h = (h*31 + name.charCodeAt(i)) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[Math.abs(h)];
}
```

### 7.11 Breadcrumb

Flex row, 13px, `chevron-right` (13px, faint) between segments. Clickable segments are navy/medium-weight with hover underline; the current (final) segment is `--ink`/bold, non-interactive. Clicking a segment clears all state below that level (e.g. clicking the Plant segment clears `agencyId` and `complianceId` but keeps `plantId`).

### 7.12 Empty States

Centered, dashed-border card, `radius-lg`, `56px 20px` padding: 48×48px icon chip (`--surface-alt`/`--ink-faint`) → title (15.5px bold) → description (13px, `--ink-soft`, max-width 360px, centered).

---

## 8. Interaction Flows

### 8.1 Drill-down navigation
Plant card click → if accessible, set `plantId`, render Screen 2. Agency card click → if accessible, set `agencyId`, render Screen 3. Compliance row click → if accessible, set `complianceId`, reset `tempAttachments`, render Screen 4. Locked items: no-op (nothing happens on click).

### 8.2 Create Agency (Master)
1. Click `+ Create agency` in navbar → modal opens, Plant select defaults to first plant, other fields empty.
2. Submit validates Agency name is non-empty (toast `Enter an agency name to continue` if blank, modal stays open).
3. On valid submit: push new agency record, close modal, toast `Agency "{name}" created`, re-render current screen.

### 8.3 Create Compliance (Master)
1. Click `+ Create compliance` in navbar → modal opens in create mode. Plant defaults to first plant; Agency options refresh to that plant's agencies; Start date defaults to today; Frequency defaults to `1` / `Month(s)`; Due-date preview computes immediately.
2. Changing Plant select → re-populate Agency select from scratch (previous Agency selection is not preserved across a Plant change).
3. Changing Start date, Frequency number, or Frequency unit → recompute and redisplay the due-date preview immediately (no submit needed).
4. Submit validates Compliance name and Start date are non-empty (toast `Fill in the compliance name and start date` otherwise).
5. On valid submit: compute `nextDue = addInterval(startDate, freqNum, freqUnit)`, create the record with default reminders `R1:30, R2:15, R3:7, R4:1` (days before due) and empty log history, close modal, toast `Compliance "{name}" created`, re-render.

### 8.4 Edit Compliance (Master)
Opened via `Edit assignment` button on Screen 4. Same modal as 8.3, pre-filled with the compliance's current values, title = `Edit compliance`, submit button = `Save changes`. On submit: mutate the existing record in place (do not create a new id), toast `Compliance updated`, re-render.

### 8.5 Mark Compliance Complete (Owner, on an owned compliance only)
1. Owner fills Completion date (defaults to today), Remarks (placeholder `What was filed / renewed, and any reference number`), optionally attaches files (8.6), optionally edits the R1–R4 day offsets inline.
2. Click `Mark as complete` (full-width primary button, check-circle icon):
   - Persist any edited reminder day values back onto the compliance's reminder config.
   - Append a new log entry: `{date: completionDate, by: ownerId, remarks, files: [...tempAttachments]}`.
   - **Recalculate `nextDue`** = `addInterval(completionDate, freqNum, freqUnit)` — i.e., the next cycle is computed from the date it was actually completed, not from the old due date.
   - Clear `tempAttachments`.
   - Re-render Screen 4 (stamp flips to the new status, detail grid's "Next due" updates, history list gets the new entry at the top).
   - Toast: `Compliance marked complete — next due date recalculated to {new date}`.

### 8.6 Attach File (Owner, simulated — no real file system in this prototype)
Click `+ Attach file` → appends a placeholder filename `supporting_doc_{n}.pdf` to `tempAttachments` and re-renders the chip list. Each chip has an `×` remove button that splices it back out. **When wiring a real backend, replace this with an actual file input + upload to blob storage; keep the same chip UI.**

### 8.7 Notification bell → deep link
Click bell → toggle the panel open/closed (click-outside also closes it). Click a notification item → set `plantId`/`agencyId` to that compliance's location, close the panel, re-render Screen 3, then scroll the matching row into view and apply a 1.6s highlight flash (background briefly tints `--brass-soft` then fades back to white). Note: this deep-links to the **list**, not directly into the detail screen.

### 8.8 Role switching (demo-only affordance)
Switching the role pill resets navigation to root and defaults `actingUserId`. Switching the "Viewing as" dropdown (Owner/Reviewer only) keeps role but changes `actingUserId` and resets navigation to root (since accessible plants/agencies differ per person). `Reset demo` returns to Master role, root navigation, and shows toast `Demo reset to MasterView`.

### 8.9 Financial Year filter
Changing the FY select on Screen 3 re-filters the compliance list by `fyOf(c.nextDue) === selectedFY` (or shows all if `all`) and updates the result count. Does not affect locked/unlocked status of any row.

---

## 9. Business Logic Reference

```js
// Status is derived, never stored as an independent field.
function computeStatus(nextDueIso, today) {
  const due = new Date(nextDueIso);
  if (due < today) return 'overdue';
  if (due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth()) return 'due';
  return 'compliant';
}

// Next due date after a fulfillment or at creation.
function addInterval(fromDate, num, unit) {
  const d = new Date(fromDate);
  if (unit === 'day')   d.setDate(d.getDate() + num);
  if (unit === 'week')  d.setDate(d.getDate() + num * 7);
  if (unit === 'month') d.setMonth(d.getMonth() + num);
  if (unit === 'year')  d.setFullYear(d.getFullYear() + num);
  return d;
}

// Indian financial year (Apr–Mar), derived from a date, never stored redundantly.
function fyOf(iso) {
  const d = new Date(iso);
  const y = d.getFullYear(), m = d.getMonth() + 1;
  if (m >= 4) return `FY ${y}-${String(y+1).slice(2)}`;
  return `FY ${y-1}-${String(y).slice(2)}`;
}

// Aggregate counts for card stat rows / notification badges.
function statBreakdown(complianceList) {
  const out = { overdue: 0, due: 0, compliant: 0 };
  complianceList.forEach(c => out[computeStatus(c.nextDue)]++);
  return out;
}
```

**Rule of thumb:** status, next-due-date-at-creation, and financial year are all *computed*, not manually entered by Master — Master only ever enters `start_date` + `frequency`. This must hold true in the real backend as well (see PRD DB schema — `status` and `financial_year` columns exist for query performance, but should be kept in sync by the same formulas above, e.g. via a scheduled job or computed column, not by manual UI input).

---

## 10. Responsive Specification

| Breakpoint | Change |
|---|---|
| `≤ 860px` | Compliance-detail two-column layout (form / history) collapses to a single stacked column; detail-head switches from row to column layout |
| `≤ 720px` | Navbar wraps to multiple lines; container padding reduces to `24px 16px 60px`; modal `.field-row` collapses to one column; detail-grid becomes a 2-column grid instead of auto-fit |
| `≤ 520px` | Notification panel becomes full-width (`calc(100vw - 20px)`), anchored near the right edge |

Card grids use `auto-fill, minmax(270px, 1fr)` throughout, so they reflow naturally without explicit breakpoints down to roughly 300px viewport width.

---

## 11. Accessibility Requirements

- Never encode status by color alone — pill/stamp always carry a text label; rows additionally carry the colored left border as a third redundant cue.
- Locked cards/rows are genuinely non-interactive elements (no `tabindex`, no click handler, `aria-disabled="true"`), not merely visually dimmed clickable ones.
- All interactive elements get a visible focus ring: `2px solid var(--navy-600)`, `2px` offset.
- Respect `prefers-reduced-motion: reduce` globally — collapse all animation/transition durations near-zero in one rule, not per-component.
- Form fields always have an associated `<label>`; icon-only buttons (bell, modal close) need an accessible name even though this reference build relies on their icon alone — add `aria-label` when implementing for real.

---

## 12. Full Copy Reference

Use this list verbatim — consistent microcopy matters as much as consistent color.

**Navbar / section labels:** `MasterView` · `Compliances` (Owner) · `Compliances · Reviewer`

**Buttons:** `Create agency` · `Create compliance` · `Save changes` · `Cancel` · `Edit assignment` · `Mark as complete` · `+ Attach file` · `Reset demo`

**Toasts:** `Agency "{name}" created` · `Compliance "{name}" created` · `Compliance updated` · `Compliance marked complete — next due date recalculated to {date}` · `Enter an agency name to continue` · `Fill in the compliance name and start date` · `Demo reset to MasterView`

**Empty states:** `No plants assigned yet` *(unused in current build since Plants are always shown — retained for a future filtered view)* · `No compliances found` / `No compliances match this financial year filter for {agency}. Try switching the filter above.` · `No fulfillment logged yet` / `Once the owner completes this compliance, the log will appear here.` · `All caught up — nothing overdue or due this month.`

**Locked-state labels:** `Not assigned to you` (Plant/Agency cards) · `Not yours` (Compliance rows)

**Field labels (Compliance modal):** `Plant` · `Agency` · `Compliance name` · `Owner` · `Reviewer` · `Department` · `Start date` · `Frequency` · `Next due date (auto-calculated)`

**Field labels (Agency modal):** `Plant` · `Agency name` · `Description (optional)`

**Field labels (Fulfillment form):** `Completion date` · `Remarks` · `Attachments` · `Reminders (days before due)` — with hint text `Defaults to the owner. Custom recipients can be layered in later.`

**Footer:** `Interactive prototype · All names, plants and filings are illustrative sample data`

---

## 13. Acceptance Checklist

Use this to verify a rebuild matches spec before calling it done:

- [ ] Master sees every Plant/Agency/Compliance as fully accessible, no locked states anywhere
- [ ] Owner sees **all** Plants, but only ones with an owned compliance are clickable — others show the lock state
- [ ] Same rule holds one level down for Agencies within an accessible Plant
- [ ] Same rule holds one level down for Compliances within an accessible Agency — including compliances owned by *other* people in the same agency, which must still be visible (with their real owner name) but locked
- [ ] Reviewer follows the identical three-level pattern, scoped by `reviewerId` instead of `ownerId`, and the Compliance detail screen is fully read-only for Reviewer
- [ ] Clicking a locked card/row does nothing
- [ ] Breadcrumb always reflects current depth and each segment correctly truncates state when clicked
- [ ] Creating a Compliance live-recalculates the due-date preview on every relevant field change, before submit
- [ ] Editing a Compliance pre-fills all fields and the button reads "Save changes," not "Create compliance"
- [ ] Marking a compliance complete appends a history entry, recalculates `next_due_date` from the completion date (not the old due date), and updates the stamp/status immediately
- [ ] Notification badge count = overdue + due-this-month, scoped correctly per role, hidden when zero, and **absent entirely** for Reviewer
- [ ] FY filter narrows the compliance list correctly and shows the defined empty state when a filter yields zero results
- [ ] All status color-coding (pill, stamp, row border) agrees with the same `computeStatus()` output — never shows conflicting statuses for the same compliance in different components
- [ ] Reduced-motion users get near-instant transitions everywhere, not just in some components
