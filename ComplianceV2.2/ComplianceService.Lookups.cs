using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Services;
using ComplianceV2._2.App_Code;

namespace ComplianceV2._2
{
    public partial class ComplianceService
    {
        // ---------- Lookups ----------

        [WebMethod]
        public object GetLookups(string sessionId)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);

            var plants = Db.Query("SELECT Plant_ID, Plant_Name FROM plant_master.tbl_plant ORDER BY Plant_Name")
                .Select(r => new { id = r["Plant_ID"], name = r["Plant_Name"] }).ToList();

            return new { plants };
        }

        [WebMethod]
        public List<DeptDto> GetDepartmentsForPlant(string sessionId, int plantId)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);
            return Db.Query("SELECT Dept_ID, Dept_Name FROM plant_master.tbl_dept WHERE Plant_ID=@p ORDER BY Dept_Name", Db.P("@p", plantId))
                .Select(r => new DeptDto { deptId = Convert.ToInt32(r["Dept_ID"]), name = (string)r["Dept_Name"] }).ToList();
        }

        // People eligible to be picked as Owner/Reviewer for a compliance: same plant+dept as each other,
        // must be allowed for this app (login_tokenallowed) and have that role for this app (access.role).
        [WebMethod]
        public PeoplePickerDto GetPeoplePicker(string sessionId, int plantId, int deptId)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);

            // access.role.LegalCompliance is free-text entered elsewhere ("Owner"/"owner"/"OWNER", etc.) -
            // match and branch on it case-insensitively so casing in that table never hides/misfiles people.
            var rows = Db.Query(
                @"SELECT p.Token, p.Name, r.LegalCompliance AS role_value
                  FROM access.login_tokenpass p
                  JOIN access.login_tokenallowed a ON a.Token = p.Token AND a.LegalCompliance = 1
                  JOIN access.role r ON r.Token = p.Token
                  WHERE p.PlantID=@p AND p.DeptID=@d AND LOWER(r.LegalCompliance) IN ('owner','reviewer')",
                Db.P("@p", plantId), Db.P("@d", deptId));

            var dto = new PeoplePickerDto();
            foreach (var r in rows)
            {
                var person = new PersonDto { token = (string)r["Token"], name = (string)r["Name"] };
                if (string.Equals((string)r["role_value"], "Owner", StringComparison.OrdinalIgnoreCase)) dto.owners.Add(person); else dto.reviewers.Add(person);
            }
            return dto;
        }

        // ---------- Plants ----------

        [WebMethod]
        public List<PlantDto> GetPlants(string sessionId)
        {
            var s = RequireSession(sessionId);
            var today = DateTime.Today;

            var plants = Db.Query("SELECT Plant_ID, Plant_Name FROM plant_master.tbl_plant ORDER BY Plant_Name");
            var allCompliances = Db.Query("SELECT plant_id, next_due_date FROM compliances WHERE is_active=1");

            var result = new List<PlantDto>();
            foreach (var p in plants)
            {
                int plantId = Convert.ToInt32(p["Plant_ID"]);
                // A person belongs to exactly one plant (from access.login_tokenpass) — master sees every plant.
                var dto = new PlantDto
                {
                    plantId = plantId,
                    name = (string)p["Plant_Name"],
                    code = null,
                    location = null,
                    accessible = s.Role == "master" || plantId == s.PlantID
                };
                foreach (var c in allCompliances.Where(c => Convert.ToInt32(c["plant_id"]) == plantId))
                {
                    var status = BizLogic.ComputeStatus((DateTime)c["next_due_date"], today);
                    if (status == "overdue") dto.overdue++; else if (status == "due") dto.due++; else dto.compliant++;
                }
                result.Add(dto);
            }
            return result;
        }

        // ---------- Agencies ----------

        [WebMethod]
        public List<AgencyDto> GetAgencies(string sessionId, int plantId)
        {
            var s = RequireSession(sessionId);
            var today = DateTime.Today;

            var agencies = Db.Query(
                @"SELECT a.agency_id, a.name, a.description, (l.agency_id IS NOT NULL) AS has_logo
                  FROM agencies a LEFT JOIN agency_logos l ON l.agency_id = a.agency_id
                  WHERE a.plant_id=@p AND a.is_active=1 ORDER BY a.name", Db.P("@p", plantId));
            var compliances = Db.Query("SELECT agency_id, owner_token, reviewer_token, next_due_date FROM compliances WHERE plant_id=@p AND is_active=1", Db.P("@p", plantId));
            var scopedAgencyIds = s.Role == "master" ? null : new HashSet<int>(
                compliances.Where(c => (s.Role == "owner" ? (string)c["owner_token"] : (c["reviewer_token"] as string)) == s.Token)
                           .Select(c => Convert.ToInt32(c["agency_id"])));

            var result = new List<AgencyDto>();
            foreach (var a in agencies)
            {
                int agencyId = Convert.ToInt32(a["agency_id"]);
                var dto = new AgencyDto
                {
                    agencyId = agencyId,
                    name = (string)a["name"],
                    description = a["description"] as string,
                    accessible = s.Role == "master" || (scopedAgencyIds != null && scopedAgencyIds.Contains(agencyId)),
                    hasLogo = Convert.ToBoolean(a["has_logo"])
                };
                foreach (var c in compliances.Where(c => Convert.ToInt32(c["agency_id"]) == agencyId))
                {
                    var status = BizLogic.ComputeStatus((DateTime)c["next_due_date"], today);
                    if (status == "overdue") dto.overdue++; else if (status == "due") dto.due++; else dto.compliant++;
                }
                result.Add(dto);
            }
            return result;
        }

        [WebMethod]
        public object CreateAgency(string sessionId, int plantId, string name, string description)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Enter an agency name to continue.");

            var id = Db.Execute("INSERT INTO agencies (plant_id, name, description, created_by) VALUES (@p,@n,@d,@u)",
                Db.P("@p", plantId), Db.P("@n", name.Trim()), Db.P("@d", (object)description ?? DBNull.Value), Db.P("@u", s.Token));
            Audit(s.Token, "CREATE_AGENCY", "agency", (int)id, null);
            return new { agencyId = id };
        }

        [WebMethod]
        public object EditAgency(string sessionId, int agencyId, int plantId, string name, string description)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Enter an agency name to continue.");

            var existing = Db.QuerySingle("SELECT agency_id FROM agencies WHERE agency_id=@id AND is_active=1", Db.P("@id", agencyId));
            if (existing == null) throw new ArgumentException("Agency not found.");

            Db.Execute("UPDATE agencies SET plant_id=@p, name=@n, description=@d WHERE agency_id=@id",
                Db.P("@p", plantId), Db.P("@n", name.Trim()), Db.P("@d", (object)description ?? DBNull.Value), Db.P("@id", agencyId));
            Audit(s.Token, "EDIT_AGENCY", "agency", agencyId, null);
            return new { agencyId };
        }

        // ---------- Delete agency (permanent, cascades to its compliances and their fulfilment history) ----------

        // Everything an agency's deletion would take with it, shown to master before they confirm.
        [WebMethod]
        public object GetAgencyDeleteImpact(string sessionId, int agencyId)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);

            var agency = Db.QuerySingle(
                @"SELECT a.name AS agency_name, pl.Plant_Name AS plant_name
                  FROM agencies a JOIN plant_master.tbl_plant pl ON pl.Plant_ID = a.plant_id
                  WHERE a.agency_id=@id AND a.is_active=1", Db.P("@id", agencyId));
            if (agency == null) throw new ArgumentException("Agency not found.");

            var rows = Db.Query(
                @"SELECT c.compliance_id, c.name,
                         (SELECT COUNT(*) FROM compliance_logs l WHERE l.compliance_id = c.compliance_id) AS fulfillment_count
                  FROM compliances c WHERE c.agency_id=@id AND c.is_active=1 ORDER BY c.name",
                Db.P("@id", agencyId));

            var compliances = rows.Select(r => new
            {
                complianceName = (string)r["name"],
                fulfillmentCount = Convert.ToInt32(r["fulfillment_count"])
            }).ToList();

            return new
            {
                agencyName = (string)agency["agency_name"],
                plantName = (string)agency["plant_name"],
                compliances,
                totalFulfillments = compliances.Sum(c => c.fulfillmentCount)
            };
        }

        [WebMethod]
        public object DeleteAgency(string sessionId, int agencyId)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);

            var agency = Db.QuerySingle(
                @"SELECT a.name AS agency_name, a.plant_id, pl.Plant_Name AS plant_name
                  FROM agencies a JOIN plant_master.tbl_plant pl ON pl.Plant_ID = a.plant_id
                  WHERE a.agency_id=@id AND a.is_active=1", Db.P("@id", agencyId));
            if (agency == null) throw new ArgumentException("Agency not found.");

            var complianceRows = Db.Query(
                @"SELECT c.compliance_id, c.name,
                         (SELECT COUNT(*) FROM compliance_logs l WHERE l.compliance_id = c.compliance_id) AS fulfillment_count
                  FROM compliances c WHERE c.agency_id=@id AND c.is_active=1", Db.P("@id", agencyId));
            var complianceIds = complianceRows.Select(r => Convert.ToInt32(r["compliance_id"])).ToList();
            var detailsSnapshot = complianceRows.Select(r => new
            {
                complianceName = (string)r["name"],
                fulfillmentCount = Convert.ToInt32(r["fulfillment_count"])
            }).ToList();
            int fulfillmentCount = detailsSnapshot.Sum(d => d.fulfillmentCount);

            // Attachments are encrypted files on disk (App_Data/Uploads) - collect their names now so
            // they can be removed after the DB transaction commits (a missing file never blocks the delete).
            var fileNames = complianceIds.Count == 0 ? new List<string>() : Db.Query(
                "SELECT file_url FROM compliance_attachments WHERE compliance_id IN (" + InClause(complianceIds) + ")", IdParams(complianceIds))
                .Select(r => (string)r["file_url"]).ToList();

            string detailsJson = Newtonsoft.Json.JsonConvert.SerializeObject(detailsSnapshot);

            Db.Transact((conn, tx) =>
            {
                Db.ExecuteTx(conn, tx,
                    @"INSERT INTO delete_log (entity_type, entity_id, entity_name, plant_id, plant_name, compliance_count, fulfillment_count, details_json, deleted_by)
                      VALUES ('agency',@eid,@en,@pid,@pn,@cc,@fc,@dj,@db)",
                    Db.P("@eid", agencyId), Db.P("@en", (string)agency["agency_name"]), Db.P("@pid", Convert.ToInt32(agency["plant_id"])),
                    Db.P("@pn", (string)agency["plant_name"]), Db.P("@cc", complianceIds.Count), Db.P("@fc", fulfillmentCount),
                    Db.P("@dj", detailsJson), Db.P("@db", s.Token));

                if (complianceIds.Count > 0)
                {
                    var inClause = InClause(complianceIds);
                    foreach (var table in new[] { "compliance_attachments", "compliance_log_reverts", "compliance_history", "compliance_logs", "reminders" })
                        Db.ExecuteTx(conn, tx, "DELETE FROM " + table + " WHERE compliance_id IN (" + inClause + ")", IdParams(complianceIds));
                }
                Db.ExecuteTx(conn, tx, "DELETE FROM compliances WHERE agency_id=@id", Db.P("@id", agencyId));
                Db.ExecuteTx(conn, tx, "DELETE FROM agencies WHERE agency_id=@id", Db.P("@id", agencyId));
            });

            var uploadsDir = System.Web.HttpContext.Current.Server.MapPath("~/App_Data/Uploads");
            foreach (var fileUrl in fileNames)
            {
                try
                {
                    var path = System.IO.Path.Combine(uploadsDir, System.IO.Path.GetFileName(fileUrl));
                    if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
                }
                catch { }
            }

            Audit(s.Token, "DELETE_AGENCY", "agency", agencyId, detailsJson);
            return new { ok = true };
        }

        private static string InClause(List<int> ids)
        {
            return string.Join(",", ids.Select((id, i) => "@id" + i));
        }
        private static MySqlConnector.MySqlParameter[] IdParams(List<int> ids)
        {
            return ids.Select((id, i) => Db.P("@id" + i, id)).ToArray();
        }
    }
}
