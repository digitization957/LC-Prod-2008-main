# Statum — Compliance Operations Platform (Mahindra & Mahindra Ltd, Internal)

This package contains the latest working mockups and full documentation for the Statum Compliance Operations Platform.

## Contents

- **`Statum-Employee-Home.html`** — the post-login home screen an employee lands on: their own overdue/due/compliant snapshot, the items needing their attention, and quick links into the app. Open directly in any browser.

- **`Statum-Prototype.html`** — the working interactive app. Open directly in any browser, no install needed. Use the "Prototype" bar at the top to switch between Master, Owner, and Reviewer roles and try each one live (create agencies/compliances, mark items complete, view locked vs. accessible plants/agencies/compliances, notifications, etc.).

- **`docs/01-PRD-and-Database-Schema.md`** — the product requirements document: roles, functional requirements, the "visible but locked" access control rules, and the full MySQL-on-Azure database schema.

- **`docs/02-Design-System.md`** — the visual design system: color tokens, typography, component patterns, and the rationale behind the key design decisions.

- **`docs/03-UIUX-Implementation-Spec.md`** — a detailed, literal implementation spec for a coding agent (or developer) to rebuild the UI/UX exactly as designed — exact copy text, component anatomy, state logic, interaction flows, and an acceptance checklist.

## Suggested reading order

1. Open `Statum-Employee-Home.html` first — this is the front door.
2. Open `Statum-Prototype.html` and switch roles to see the actual workspace.
3. Read the PRD for the "what and why."
4. Read the Design System for the visual language.
5. Hand the Implementation Spec to whoever (or whatever) is building the real thing.

## Branding note

Both HTML files load the official Mahindra & Mahindra logo directly from `mahindra.com` at view-time (not a stored copy) — an internet connection is needed for it to display; otherwise it falls back to a text label automatically.
