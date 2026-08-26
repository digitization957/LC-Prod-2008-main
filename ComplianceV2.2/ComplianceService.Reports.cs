using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Services;
using ComplianceV2._2.App_Code;

namespace ComplianceV2._2
{
    public partial class ComplianceService
    {
        // ---------- Notifications ----------

        [WebMethod]
        public List<NotificationItemDto> GetNotifications(string sessionId)
        {
            var s = RequireSession(sessionId);
            if (s.Role == "reviewer") return new List<NotificationItemDto>();

            var sql = @"SELECT c.compliance_id, c.name, pl.Plant_Name AS plant_name, a.name AS agency_name, c.next_due_date
                        FROM compliances c
                        JOIN plant_master.tbl_plant pl ON pl.Plant_ID = c.plant_id
                        JOIN agencies a ON a.agency_id = c.agency_id
                        WHERE c.is_active=1" + (s.Role == "owner" ? " AND c.owner_token=@tok" : "");

            var rows = s.Role == "owner" ? Db.Query(sql, Db.P("@tok", s.Token)) : Db.Query(sql);
            var today = DateTime.Today;
            var result = new List<NotificationItemDto>();
            foreach (var r in rows)
            {
                var due = (DateTime)r["next_due_date"];
                var status = BizLogic.ComputeStatus(due, today);
                if (status != "overdue" && status != "due") continue;
                result.Add(new NotificationItemDto
                {
                    complianceId = Convert.ToInt32(r["compliance_id"]),
                    name = (string)r["name"],
                    plantName = (string)r["plant_name"],
                    agencyName = (string)r["agency_name"],
                    dueDate = due.ToString("yyyy-MM-dd"),
                    type = status == "overdue" ? "overdue" : "due_this_month"
                });
            }
            return result;
        }

        // ---------- Summary / Report ----------

        [WebMethod]
        public SummaryReportDto GetSummaryReport(string sessionId, int plantId = 0)
        {
            var s = RequireSession(sessionId);
            var today = DateTime.Today;

            // Non-master roles see the full summary for every plant they're scoped to (own or review at
            // least one compliance in), not just the compliances they personally own/review.
            var scopeClause = s.Role == "master" ? "" :
                " AND c.plant_id IN (SELECT DISTINCT plant_id FROM compliances WHERE is_active=1 AND (owner_token=@tok OR reviewer_token=@tok))";

            var sql = @"SELECT c.compliance_id, c.name, c.next_due_date, c.financial_year, c.owner_token, pl.Plant_Name AS plant_name, a.name AS agency_name,
                               ou.Name AS owner_name, dd.Dept_Name AS department_name, ll.last_action_date
                        FROM compliances c
                        JOIN plant_master.tbl_plant pl ON pl.Plant_ID = c.plant_id
                        JOIN agencies a ON a.agency_id = c.agency_id
                        JOIN access.login_tokenpass ou ON ou.Token = c.owner_token
                        LEFT JOIN plant_master.tbl_dept dd ON dd.Plant_ID = ou.PlantID AND dd.Dept_ID = ou.DeptID
                        LEFT JOIN (SELECT compliance_id, MAX(action_date) AS last_action_date FROM compliance_logs GROUP BY compliance_id) ll ON ll.compliance_id = c.compliance_id
                        WHERE c.is_active=1" + scopeClause
                        + (plantId > 0 ? " AND c.plant_id=@pid" : "");

            var ps1 = new List<MySqlConnector.MySqlParameter>();
            if (s.Role != "master") ps1.Add(Db.P("@tok", s.Token));
            if (plantId > 0) ps1.Add(Db.P("@pid", plantId));
            var rows = Db.Query(sql, ps1.ToArray());

            var dto = new SummaryReportDto();
            var byPlant = new Dictionary<string, PlantSummaryDto>();
            var byOwner = new Dictionary<string, OwnerSummaryDto>();

            foreach (var r in rows)
            {
                var due = (DateTime)r["next_due_date"];
                var status = BizLogic.ComputeStatus(due, today);
                var plantName = (string)r["plant_name"];
                var ownerName = (string)r["owner_name"];
                var agencyName = (string)r["agency_name"];
                var deptName = r["department_name"] as string;

                dto.total++;
                if (status == "overdue") dto.overdue++; else if (status == "due") dto.due++; else dto.compliant++;

                if (!byPlant.TryGetValue(plantName, out var ps))
                    byPlant[plantName] = ps = new PlantSummaryDto { plantName = plantName };
                ps.total++;
                if (status == "overdue") ps.overdue++; else if (status == "due") ps.due++; else ps.compliant++;

                if (!byOwner.TryGetValue(ownerName, out var os))
                    byOwner[ownerName] = os = new OwnerSummaryDto { ownerName = ownerName, deptName = deptName };
                os.total++;
                if (status == "compliant") os.complied++; else os.nonComplied++;

                DateTime? lastAction = r["last_action_date"] == null ? (DateTime?)null : (DateTime)r["last_action_date"];
                dto.complianceDetails.Add(new ComplianceStatusRowDto
                {
                    complianceId = Convert.ToInt32(r["compliance_id"]),
                    complianceName = (string)r["name"],
                    agencyName = agencyName,
                    ownerToken = (string)r["owner_token"],
                    ownerName = ownerName,
                    deptName = deptName,
                    status = status,
                    dueDate = due.ToString("yyyy-MM-dd"),
                    doneDate = lastAction?.ToString("yyyy-MM-dd"),
                    gapDays = status == "overdue" ? (int?)(today - due).Days : null,
                    financialYear = (string)r["financial_year"]
                });

                var item = new SummaryItemDto
                {
                    complianceId = Convert.ToInt32(r["compliance_id"]),
                    name = (string)r["name"],
                    plantName = plantName,
                    agencyName = agencyName,
                    ownerName = ownerName,
                    nextDueDate = due.ToString("yyyy-MM-dd")
                };

                if (status == "overdue")
                {
                    item.daysOverdue = (today - due).Days;
                    dto.overdueList.Add(item);
                }
                else if (due >= today && due <= today.AddDays(30))
                {
                    dto.upcomingList.Add(item);
                }
            }

            dto.complianceRate = dto.total > 0 ? Math.Round(dto.compliant * 100.0 / dto.total, 1) : 0;
            foreach (var ps in byPlant.Values)
                ps.complianceRate = ps.total > 0 ? Math.Round(ps.compliant * 100.0 / ps.total, 1) : 0;
            dto.byPlant = byPlant.Values.OrderByDescending(p => p.overdue).ThenBy(p => p.plantName).ToList();
            dto.ownerSummary = byOwner.Values.OrderBy(o => o.ownerName).ToList();
            var statusRank = new Dictionary<string, int> { { "overdue", 0 }, { "due", 1 }, { "compliant", 2 } };
            dto.complianceDetails = dto.complianceDetails.OrderBy(x => statusRank[x.status]).ThenBy(x => x.complianceName).ToList();
            dto.overdueList = dto.overdueList.OrderByDescending(i => i.daysOverdue).Take(10).ToList();
            dto.upcomingList = dto.upcomingList.OrderBy(i => i.nextDueDate).Take(10).ToList();

            if (s.Role == "master")
            {
                var activitySql = @"SELECT l.action_date, l.remarks, c.name AS compliance_name, pl.Plant_Name AS plant_name, a.name AS agency_name, u.Name AS done_by
                            FROM compliance_logs l
                            JOIN compliances c ON c.compliance_id = l.compliance_id
                            JOIN plant_master.tbl_plant pl ON pl.Plant_ID = c.plant_id
                            JOIN agencies a ON a.agency_id = c.agency_id
                            JOIN access.login_tokenpass u ON u.Token = l.done_by
                            WHERE 1=1" + (plantId > 0 ? " AND c.plant_id=@pid" : "") +
                            " ORDER BY l.action_date DESC, l.log_id DESC LIMIT 10";

                var activityRows = Db.Query(activitySql, ps1.ToArray());
                foreach (var r in activityRows)
                    dto.recentActivity.Add(new ActivityItemDto
                    {
                        actionDate = ((DateTime)r["action_date"]).ToString("yyyy-MM-dd"),
                        complianceName = (string)r["compliance_name"],
                        plantName = (string)r["plant_name"],
                        agencyName = (string)r["agency_name"],
                        doneBy = (string)r["done_by"],
                        remarks = r["remarks"] as string
                    });
            }

            return dto;
        }

        // ---------- Schedule ----------

        [WebMethod]
        public List<ScheduleItemDto> GetMySchedule(string sessionId)
        {
            var s = RequireSession(sessionId);
            var today = DateTime.Today;

            var rows = Db.Query(
                @"SELECT c.compliance_id, c.name, c.next_due_date, c.financial_year, c.agency_id,
                         pl.Plant_Name AS plant_name, a.name AS agency_name
                  FROM compliances c
                  JOIN plant_master.tbl_plant pl ON pl.Plant_ID = c.plant_id
                  JOIN agencies a ON a.agency_id = c.agency_id
                  WHERE c.is_active=1 AND c.owner_token=@tok
                  ORDER BY c.next_due_date ASC", Db.P("@tok", s.Token));

            var list = new List<ScheduleItemDto>();
            foreach (var r in rows)
            {
                var due = (DateTime)r["next_due_date"];
                list.Add(new ScheduleItemDto
                {
                    complianceId = Convert.ToInt32(r["compliance_id"]),
                    name = (string)r["name"],
                    plantName = (string)r["plant_name"],
                    agencyId = Convert.ToInt32(r["agency_id"]),
                    financialYear = (string)r["financial_year"],
                    agencyName = (string)r["agency_name"],
                    dueDate = due.ToString("yyyy-MM-dd"),
                    status = BizLogic.ComputeStatus(due, today)
                });
            }
            return list;
        }

        // ---------- Training ----------

        [WebMethod]
        public object LogTrainingComplete(string sessionId)
        {
            var s = RequireSession(sessionId);
            Db.Execute("INSERT INTO training_completions (token, plant_id) VALUES (@t,@p)",
                Db.P("@t", s.Token), Db.P("@p", s.PlantID));
            return new { ok = true, fullName = s.FullName };
        }

        [WebMethod]
        public object GetTrainingStatus(string sessionId)
        {
            var s = RequireSession(sessionId);
            var row = Db.QuerySingle("SELECT COUNT(*) AS cnt FROM training_completions WHERE token=@t", Db.P("@t", s.Token));
            int count = row != null ? Convert.ToInt32(row["cnt"]) : 0;
            return new { count };
        }
    }
}
