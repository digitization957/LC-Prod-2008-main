# Agency Logo Config — Plan

Master-only feature. Owner and reviewer have no access, no nav entry, no APIs reachable by them.

## Scope
- Navbar (master only): new **Config** dropdown replacing the standalone "Mail config" link → items: "Mail config", "Agency logo config".
- New page `AgencyLogoConfig.aspx` (master-only guard like `MailConfig.aspx.cs`).
- Selection UX: **Plant selector** (dropdown) → **Agency list** for that plant (grid/list of agency cards, searchable). Click an agency to open its logo panel: current logo preview (or default placeholder), "Replace logo" file picker (PNG only), Save.
- Any place agency name is currently rendered app-wide: fetch logo via agency_id, fallback to default logo asset if none set.

## Backend
- New empty schema file `docs/schema_agency_logo.sql` with table `agency_logos` (agency_id PK/FK, logo_path, uploaded_by, updated_at).
- Storage: `App_Data/AgencyLogos/{agency_id}.png` (encrypted at rest like `Upload.ashx.cs` via `FileCrypto`), served through an authenticated handler (no direct static path).
- New `ComplianceService.AgencyLogo.cs`: `GetPlants`, `GetAgenciesByPlant`, `GetAgencyLogo`, `SaveAgencyLogo` (RequireMaster), reuse `Upload.ashx` validation pattern (magic-byte PNG check, max size, GUID-safe filename, no path traversal).
- Reads (`GetAgencyLogo`) allowed for all authenticated roles (needed to render logos app-wide); writes strictly `RequireMaster`.

## VAPT
- Server-side role check on every write WebMethod + handler.
- PNG magic-byte validation, size cap, fixed extension, no user-controlled filename/path.
- Auth check on logo-serving handler (session validated, no anonymous access).

## Explicitly excluded
- No owner/reviewer UI, no plant-level restriction on owner for this feature.
