using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Services;
using ComplianceV2._2.App_Code;

namespace ComplianceV2._2
{
    public partial class ComplianceService
    {
        // ---------- Compliances (list) ----------

        [WebMethod]
        public List<ComplianceRowDto> GetCompliances(string sessionId, int plantId, int agencyId, string fy)
        {
            var s = RequireSession(sessionId);
            var today = DateTime.Today;

            var rows = Db.Query(
                @"SELECT c.compliance_id, c.name, c.category, c.owner_token, c.reviewer_token, c.next_due_date, c.financial_year,
                         ou.Name AS owner_name, ru.Name AS reviewer_name, dd.Dept_Name AS department_name
                  FROM compliances c
                  JOIN access.login_tokenpass ou ON ou.Token = c.owner_token
                  LEFT JOIN access.login_tokenpass ru ON ru.Token = c.reviewer_token
                  LEFT JOIN plant_master.tbl_dept dd ON dd.Plant_ID = ou.PlantID AND dd.Dept_ID = ou.DeptID
                  WHERE c.plant_id=@p AND c.agency_id=@a AND c.is_active=1
                  ORDER BY c.next_due_date ASC",
                Db.P("@p", plantId), Db.P("@a", agencyId));

            var list = new List<ComplianceRowDto>();
            foreach (var r in rows)
            {
                var financialYear = (string)r["financial_year"];
                if (!string.IsNullOrEmpty(fy) && fy != "all" && financialYear != fy) continue;

                string ownerToken = (string)r["owner_token"];
                string reviewerToken = r["reviewer_token"] as string;
                bool accessible = s.Role == "master"
                    || (s.Role == "owner" && ownerToken == s.Token)
                    || (s.Role == "reviewer" && reviewerToken != null && reviewerToken == s.Token);

                var due = (DateTime)r["next_due_date"];
                list.Add(new ComplianceRowDto
                {
                    complianceId = Convert.ToInt32(r["compliance_id"]),
                    name = (string)r["name"],
                    category = r["category"] as string,
                    ownerName = (string)r["owner_name"],
                    reviewerName = r["reviewer_name"] as string,
                    department = r["department_name"] as string,
                    nextDueDate = due.ToString("yyyy-MM-dd"),
                    status = BizLogic.ComputeStatus(due, today),
                    financialYear = financialYear,
                    accessible = accessible
                });
            }
            return list;
        }

        // ---------- Compliance detail ----------

        [WebMethod]
        public ComplianceDetailDto GetComplianceDetail(string sessionId, int complianceId)
        {
            var s = RequireSession(sessionId);

            var r = Db.QuerySingle(
                @"SELECT c.*, pl.Plant_Name AS plant_name, a.name AS agency_name,
                         ou.Name AS owner_name, ou.PlantID AS owner_plant_id, ou.DeptID AS owner_dept_id,
                         ru.Name AS reviewer_name
                  FROM compliances c
                  JOIN plant_master.tbl_plant pl ON pl.Plant_ID = c.plant_id
                  JOIN agencies a ON a.agency_id = c.agency_id
                  JOIN access.login_tokenpass ou ON ou.Token = c.owner_token
                  LEFT JOIN access.login_tokenpass ru ON ru.Token = c.reviewer_token
                  WHERE c.compliance_id=@id AND c.is_active=1",
                Db.P("@id", complianceId));
            if (r == null) throw new ArgumentException("Compliance not found.");

            string ownerToken = (string)r["owner_token"];
            string reviewerToken = r["reviewer_token"] as string;
            int plantIdVal = Convert.ToInt32(r["plant_id"]);
            // Owner/reviewer can view (read-only) any compliance in a plant they're scoped to - matches
            // the Overview/Reports "full plant" scope - not just compliances they personally own or review.
            bool viewable = IsAccessible(s, ownerToken, reviewerToken) ||
                (s.Role != "master" && ScopedCompliances(s).Any(c => Convert.ToInt32(c["plant_id"]) == plantIdVal));
            if (!viewable) throw new UnauthorizedAccessException("Not yours.");

            var deptRow = Db.QuerySingle("SELECT Dept_Name FROM plant_master.tbl_dept WHERE Plant_ID=@p AND Dept_ID=@d",
                Db.P("@p", Convert.ToInt32(r["owner_plant_id"])), Db.P("@d", Convert.ToInt32(r["owner_dept_id"])));

            var due = (DateTime)r["next_due_date"];
            var dto = new ComplianceDetailDto
            {
                complianceId = complianceId,
                name = (string)r["name"],
                category = r["category"] as string,
                description = r["description"] as string,
                plantId = plantIdVal,
                plantName = (string)r["plant_name"],
                agencyId = Convert.ToInt32(r["agency_id"]),
                agencyName = (string)r["agency_name"],
                deptId = Convert.ToInt32(r["owner_dept_id"]),
                department = deptRow?["Dept_Name"] as string,
                ownerToken = ownerToken,
                ownerName = (string)r["owner_name"],
                reviewerToken = reviewerToken,
                reviewerName = r["reviewer_name"] as string,
                frequencyNumber = Convert.ToInt32(r["frequency_number"]),
                frequencyUnit = (string)r["frequency_unit"],
                startDate = ((DateTime)r["start_date"]).ToString("yyyy-MM-dd"),
                nextDueDate = due.ToString("yyyy-MM-dd"),
                financialYear = (string)r["financial_year"],
                status = BizLogic.ComputeStatus(due, DateTime.Today),
                canEdit = s.Role == "master",
                canFulfill = s.Role == "owner" && ownerToken == s.Token,
                isReviewer = s.Role == "reviewer"
            };

            var logs = Db.Query(
                @"SELECT l.log_id, l.action_date, l.remarks, l.created_at, u.Name AS done_by_name
                  FROM compliance_logs l JOIN access.login_tokenpass u ON u.Token = l.done_by
                  WHERE l.compliance_id=@id ORDER BY l.action_date DESC, l.log_id DESC",
                Db.P("@id", complianceId));
            int latestLogId = logs.Count > 0 ? logs.Max(row => Convert.ToInt32(row["log_id"])) : -1;
            bool ownerCanRevert = s.Role == "owner" && ownerToken == s.Token;

            // One query for every log's attachments instead of one query per log (was N+1).
            var attsByLog = Db.Query("SELECT log_id, file_name, file_url FROM compliance_attachments WHERE compliance_id=@id", Db.P("@id", complianceId))
                .GroupBy(a => Convert.ToInt32(a["log_id"]))
                .ToDictionary(g => g.Key, g => g.ToList());

            foreach (var lg in logs)
            {
                int logId = Convert.ToInt32(lg["log_id"]);
                bool withinWindow = (DateTime.Now - (DateTime)lg["created_at"]).TotalDays <= 7;
                var logDto = new LogDto
                {
                    logId = logId,
                    actionDate = ((DateTime)lg["action_date"]).ToString("yyyy-MM-dd"),
                    doneBy = (string)lg["done_by_name"],
                    remarks = lg["remarks"] as string,
                    canRevert = ownerCanRevert && logId == latestLogId && withinWindow
                };
                if (attsByLog.TryGetValue(logId, out var atts))
                    foreach (var at in atts) logDto.attachments.Add(new AttachmentDto { fileName = (string)at["file_name"], fileUrl = (string)at["file_url"] });
                dto.logs.Add(logDto);
            }

            var reminders = Db.Query(
                @"SELECT r.reminder_label, r.days_before_due, r.recipient_id, u.Name AS recipient_name
                  FROM reminders r LEFT JOIN access.login_tokenpass u ON u.Token = r.recipient_id
                  WHERE r.compliance_id=@id ORDER BY r.reminder_label",
                Db.P("@id", complianceId));
            foreach (var rm in reminders)
                dto.reminders.Add(new ReminderDto
                {
                    label = (string)rm["reminder_label"],
                    daysBeforeDue = Convert.ToInt32(rm["days_before_due"]),
                    recipientToken = rm["recipient_id"] as string,
                    recipientName = rm["recipient_name"] as string
                });

            return dto;
        }

        // ---------- Create / Edit compliance ----------

        [WebMethod]
        public object CreateCompliance(string sessionId, ComplianceInput input)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);
            if (input == null || string.IsNullOrWhiteSpace(input.name) || string.IsNullOrWhiteSpace(input.startDate) || string.IsNullOrWhiteSpace(input.ownerToken))
                throw new ArgumentException("Fill in the compliance name, start date and owner.");
            if (!BizLogic.IsValidCategory(input.category))
                throw new ArgumentException("Pick a valid category.");
            if (input.category == "Return" && input.frequencyUnit == BizLogic.AsAndWhenUnit)
                throw new ArgumentException("Return compliances can't use the As and When frequency.");

            var startDate = DateTime.Parse(input.startDate);
            // As and When has no frequency - the first due date is just the start date, and every
            // due date after that is whatever the owner types in at fulfilment time.
            var nextDue = input.frequencyUnit == BizLogic.AsAndWhenUnit ? startDate : BizLogic.AddInterval(startDate, input.frequencyNumber, input.frequencyUnit);
            var fy = BizLogic.FyOf(nextDue);

            var id = Db.Execute(
                @"INSERT INTO compliances (agency_id, plant_id, name, category, description, owner_token, reviewer_token,
                    start_date, frequency_number, frequency_unit, next_due_date, financial_year, created_by)
                  VALUES (@ag,@pl,@nm,@cat,@ds,@ow,@rv,@sd,@fn,@fu,@nd,@fy,@cb)",
                Db.P("@ag", input.agencyId), Db.P("@pl", input.plantId),
                Db.P("@nm", input.name.Trim()), Db.P("@cat", input.category), Db.P("@ds", (object)input.description ?? DBNull.Value),
                Db.P("@ow", input.ownerToken), Db.P("@rv", (object)input.reviewerToken ?? DBNull.Value),
                Db.P("@sd", startDate), Db.P("@fn", input.frequencyNumber), Db.P("@fu", input.frequencyUnit),
                Db.P("@nd", nextDue), Db.P("@fy", fy), Db.P("@cb", s.Token));

            int complianceId = (int)id;
            foreach (var (label, days) in new[] { ("R1", 30), ("R2", 15), ("R3", 7), ("R4", 1) })
                Db.Execute("INSERT INTO reminders (compliance_id, reminder_label, days_before_due, recipient_id) VALUES (@c,@l,@d,@r)",
                    Db.P("@c", complianceId), Db.P("@l", label), Db.P("@d", days), Db.P("@r", input.ownerToken));

            Audit(s.Token, "CREATE_COMPLIANCE", "compliance", complianceId, null);
            return new { complianceId, nextDueDate = nextDue.ToString("yyyy-MM-dd") };
        }

        // Start date stays fixed once a compliance is created. Frequency can be edited - the next due
        // date is then recomputed from the last real fulfilment (or Start Date if never fulfilled), so
        // changing frequency never silently discards fulfilment progress already made.
        [WebMethod]
        public object EditCompliance(string sessionId, int complianceId, ComplianceInput input)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);
            if (input == null || string.IsNullOrWhiteSpace(input.name) || string.IsNullOrWhiteSpace(input.ownerToken))
                throw new ArgumentException("Fill in the compliance name and owner.");
            if (!BizLogic.IsValidCategory(input.category))
                throw new ArgumentException("Pick a valid category.");

            var old = Db.QuerySingle("SELECT * FROM compliances WHERE compliance_id=@id AND is_active=1", Db.P("@id", complianceId));
            if (old == null) throw new ArgumentException("Compliance not found.");
            if (input.category == "Return" && input.frequencyUnit == BizLogic.AsAndWhenUnit)
                throw new ArgumentException("Return compliances can't use the As and When frequency.");

            int oldFreqNum = Convert.ToInt32(old["frequency_number"]);
            string oldFreqUnit = (string)old["frequency_unit"];
            var oldDue = (DateTime)old["next_due_date"];
            bool freqChanged = input.frequencyNumber != oldFreqNum || input.frequencyUnit != oldFreqUnit;

            // Frequency drives the next due date; recompute it from the same anchor the live UI preview
            // uses - the last real fulfilment if there is one, otherwise Start Date - so changing
            // frequency never silently discards fulfilment progress already made under the old cadence.
            var nextDue = oldDue;
            if (freqChanged)
            {
                var lastLog = Db.QuerySingle(
                    "SELECT action_date FROM compliance_logs WHERE compliance_id=@id ORDER BY action_date DESC, log_id DESC LIMIT 1",
                    Db.P("@id", complianceId));
                var anchor = lastLog != null ? (DateTime)lastLog["action_date"] : (DateTime)old["start_date"];
                nextDue = input.frequencyUnit == BizLogic.AsAndWhenUnit ? anchor : BizLogic.AddInterval(anchor, input.frequencyNumber, input.frequencyUnit);
            }
            var fy = BizLogic.FyOf(nextDue);

            LogFieldChange(complianceId, s.Token, "category", old["category"], input.category);
            LogFieldChange(complianceId, s.Token, "owner_token", old["owner_token"], input.ownerToken);
            LogFieldChange(complianceId, s.Token, "reviewer_token", old["reviewer_token"], input.reviewerToken);
            LogFieldChange(complianceId, s.Token, "frequency_number", oldFreqNum, input.frequencyNumber);
            LogFieldChange(complianceId, s.Token, "frequency_unit", oldFreqUnit, input.frequencyUnit);

            Db.Execute(
                @"UPDATE compliances SET agency_id=@ag, plant_id=@pl, name=@nm, category=@cat, description=@ds,
                    owner_token=@ow, reviewer_token=@rv, frequency_number=@fn, frequency_unit=@fu,
                    next_due_date=@nd, financial_year=@fy WHERE compliance_id=@id",
                Db.P("@ag", input.agencyId), Db.P("@pl", input.plantId),
                Db.P("@nm", input.name.Trim()), Db.P("@cat", input.category), Db.P("@ds", (object)input.description ?? DBNull.Value),
                Db.P("@ow", input.ownerToken), Db.P("@rv", (object)input.reviewerToken ?? DBNull.Value),
                Db.P("@fn", input.frequencyNumber), Db.P("@fu", input.frequencyUnit),
                Db.P("@nd", nextDue), Db.P("@fy", fy), Db.P("@id", complianceId));

            Audit(s.Token, "EDIT_COMPLIANCE", "compliance", complianceId, null);
            return new { complianceId, nextDueDate = nextDue.ToString("yyyy-MM-dd") };
        }

        private void LogFieldChange(int complianceId, string userToken, string field, object oldVal, object newVal)
        {
            var o = oldVal?.ToString() ?? "";
            var n = newVal?.ToString() ?? "";
            if (o == n) return;
            Db.Execute("INSERT INTO compliance_history (compliance_id, field_name, old_value, new_value, changed_by) VALUES (@c,@f,@o,@n,@u)",
                Db.P("@c", complianceId), Db.P("@f", field), Db.P("@o", o), Db.P("@n", n), Db.P("@u", userToken));
        }

        // ---------- Delete compliance (permanent, cascades to its fulfilment history) ----------

        // Everything a compliance's deletion would take with it, shown to master before they confirm.
        [WebMethod]
        public object GetComplianceDeleteImpact(string sessionId, int complianceId)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);

            var c = Db.QuerySingle(
                @"SELECT c.name, a.name AS agency_name, pl.Plant_Name AS plant_name
                  FROM compliances c JOIN agencies a ON a.agency_id = c.agency_id
                  JOIN plant_master.tbl_plant pl ON pl.Plant_ID = c.plant_id
                  WHERE c.compliance_id=@id AND c.is_active=1", Db.P("@id", complianceId));
            if (c == null) throw new ArgumentException("Compliance not found.");

            var logRows = Db.Query(
                @"SELECT l.log_id, l.action_date, l.remarks, u.Name AS done_by_name,
                         (SELECT COUNT(*) FROM compliance_attachments at WHERE at.log_id = l.log_id) AS attachment_count
                  FROM compliance_logs l JOIN access.login_tokenpass u ON u.Token = l.done_by
                  WHERE l.compliance_id=@id ORDER BY l.action_date DESC, l.log_id DESC", Db.P("@id", complianceId));

            var logs = logRows.Select(r => new
            {
                actionDate = ((DateTime)r["action_date"]).ToString("yyyy-MM-dd"),
                doneBy = (string)r["done_by_name"],
                remarks = r["remarks"] as string,
                attachmentCount = Convert.ToInt32(r["attachment_count"])
            }).ToList();

            return new
            {
                complianceName = (string)c["name"],
                agencyName = (string)c["agency_name"],
                plantName = (string)c["plant_name"],
                logs,
                totalFulfillments = logs.Count
            };
        }

        [WebMethod]
        public object DeleteCompliance(string sessionId, int complianceId)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);

            var c = Db.QuerySingle(
                @"SELECT c.name, c.plant_id, a.name AS agency_name, pl.Plant_Name AS plant_name
                  FROM compliances c JOIN agencies a ON a.agency_id = c.agency_id
                  JOIN plant_master.tbl_plant pl ON pl.Plant_ID = c.plant_id
                  WHERE c.compliance_id=@id AND c.is_active=1", Db.P("@id", complianceId));
            if (c == null) throw new ArgumentException("Compliance not found.");

            int fulfillmentCount = Convert.ToInt32(Db.QuerySingle(
                "SELECT COUNT(*) AS cnt FROM compliance_logs WHERE compliance_id=@id", Db.P("@id", complianceId))["cnt"]);

            // Attachments are encrypted files on disk (App_Data/Uploads) - collect their names now so
            // they can be removed after the DB transaction commits (a missing file never blocks the delete).
            var fileNames = Db.Query("SELECT file_url FROM compliance_attachments WHERE compliance_id=@id", Db.P("@id", complianceId))
                .Select(r => (string)r["file_url"]).ToList();

            var detailsSnapshot = new { complianceName = (string)c["name"], fulfillmentCount };
            string detailsJson = Newtonsoft.Json.JsonConvert.SerializeObject(detailsSnapshot);

            Db.Transact((conn, tx) =>
            {
                Db.ExecuteTx(conn, tx,
                    @"INSERT INTO delete_log (entity_type, entity_id, entity_name, plant_id, plant_name, compliance_count, fulfillment_count, details_json, deleted_by)
                      VALUES ('compliance',@eid,@en,@pid,@pn,1,@fc,@dj,@db)",
                    Db.P("@eid", complianceId), Db.P("@en", (string)c["name"]), Db.P("@pid", Convert.ToInt32(c["plant_id"])),
                    Db.P("@pn", (string)c["plant_name"]), Db.P("@fc", fulfillmentCount), Db.P("@dj", detailsJson), Db.P("@db", s.Token));

                foreach (var table in new[] { "compliance_attachments", "compliance_log_reverts", "compliance_history", "compliance_logs", "reminders" })
                    Db.ExecuteTx(conn, tx, "DELETE FROM " + table + " WHERE compliance_id=@id", Db.P("@id", complianceId));
                Db.ExecuteTx(conn, tx, "DELETE FROM compliances WHERE compliance_id=@id", Db.P("@id", complianceId));
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

            Audit(s.Token, "DELETE_COMPLIANCE", "compliance", complianceId, detailsJson);
            return new { ok = true };
        }
    }
}
