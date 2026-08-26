using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Web;
using System.Web.Services;
using ComplianceV2._2.App_Code;
using Newtonsoft.Json;

namespace ComplianceV2._2
{
    public partial class ComplianceService
    {
        // ---------- Fulfillment ----------

        [WebMethod]
        public object MarkComplete(string sessionId, int complianceId, string completionDate, string remarks, List<AttachmentInput> attachments, List<ReminderInput> reminders, string manualNextDueDate = null)
        {
            var s = RequireSession(sessionId);

            var c = Db.QuerySingle("SELECT owner_token, reviewer_token, name, category, frequency_number, frequency_unit, next_due_date FROM compliances WHERE compliance_id=@id AND is_active=1", Db.P("@id", complianceId));
            if (c == null) throw new ArgumentException("Compliance not found.");
            if (s.Role != "owner" || (string)c["owner_token"] != s.Token)
                throw new UnauthorizedAccessException("Not yours.");

            var actionDate = DateTime.Parse(completionDate);
            var category = c["category"] as string;
            var currentDue = (DateTime)c["next_due_date"];
            int freqNum = Convert.ToInt32(c["frequency_number"]);
            string freqUnit = (string)c["frequency_unit"];

            DateTime nextDue;
            if (freqUnit == BizLogic.AsAndWhenUnit)
            {
                // No frequency at all - the owner picks the next due date themselves, every time.
                if (string.IsNullOrWhiteSpace(manualNextDueDate))
                    throw new ArgumentException("Enter the next due date.");
                nextDue = DateTime.Parse(manualNextDueDate);
            }
            else
            {
                nextDue = BizLogic.ComputeNextDue(category, freqUnit, freqNum, currentDue, actionDate);
                if (category == "Return" && actionDate >= nextDue)
                {
                    // Return has a fixed filing window: it can only be filed before the next cycle would
                    // start (old due date + frequency). Filing that late isn't allowed at all - unlike
                    // every other category, which is a rolling schedule based on when it's actually done.
                    throw new InvalidOperationException("The filing window for this Return closed on " + nextDue.AddDays(-1).ToString("dd-MM-yyyy") + ". It can no longer be marked complete for this cycle.");
                }
            }
            var fy = BizLogic.FyOf(nextDue);
            var status = BizLogic.ComputeStatus(nextDue, DateTime.Today);

            var logId = Db.Execute(
                "INSERT INTO compliance_logs (compliance_id, action_date, done_by, remarks, next_due_date_snapshot) VALUES (@c,@d,@u,@r,@n)",
                Db.P("@c", complianceId), Db.P("@d", actionDate), Db.P("@u", s.Token), Db.P("@r", (object)remarks ?? DBNull.Value), Db.P("@n", nextDue));

            if (attachments != null)
                foreach (var att in attachments)
                    Db.Execute("INSERT INTO compliance_attachments (log_id, compliance_id, file_name, file_url, uploaded_by) VALUES (@l,@c,@fn,@fu,@u)",
                        Db.P("@l", (int)logId), Db.P("@c", complianceId), Db.P("@fn", att.fileName), Db.P("@fu", att.fileUrl), Db.P("@u", s.Token));

            Db.Execute("UPDATE compliances SET next_due_date=@n, financial_year=@fy, status=@st WHERE compliance_id=@id",
                Db.P("@n", nextDue), Db.P("@fy", fy), Db.P("@st", status == "compliant" ? "completed" : "pending"), Db.P("@id", complianceId));

            if (reminders != null)
                foreach (var rem in reminders)
                    Db.Execute("UPDATE reminders SET days_before_due=@d WHERE compliance_id=@c AND reminder_label=@l",
                        Db.P("@d", rem.daysBeforeDue), Db.P("@c", complianceId), Db.P("@l", rem.label));

            Audit(s.Token, "MARK_COMPLETE", "compliance", complianceId, null);

            bool mailSent = false;
            string reviewerToken = c["reviewer_token"] as string;
            if (reviewerToken != null)
            {
                var token = ReportLinkToken.Create((int)logId, TimeSpan.FromDays(30));
                var reportUrl = HttpContext.Current.Request.Url.GetLeftPart(UriPartial.Authority) +
                    VirtualPathUtility.ToAbsolute("~/ReportView.aspx") + "?t=" + Uri.EscapeDataString(token);
                var subject = "Compliance fulfilled — " + (string)c["name"];
                var body = BuildCompletionEmailHtml((string)c["name"], actionDate, s.FullName, remarks, nextDue, reportUrl);
                mailSent = Mailer.TrySend(reviewerToken + "@mahindra.com", subject, body, out string mailError);
            }

            return new { nextDueDate = nextDue.ToString("yyyy-MM-dd"), mailSent };
        }

        // Read-only mirror of MarkComplete's date logic, for the live "Projected next due date" preview
        // on the fulfilment form. Goes through the same BizLogic.ComputeNextDue as the actual save, so
        // the preview and the real save can never drift apart.
        [WebMethod]
        public object PreviewNextDue(string sessionId, int complianceId, string completionDate)
        {
            var s = RequireSession(sessionId);

            var c = Db.QuerySingle("SELECT owner_token, category, frequency_number, frequency_unit, next_due_date FROM compliances WHERE compliance_id=@id AND is_active=1", Db.P("@id", complianceId));
            if (c == null) throw new ArgumentException("Compliance not found.");
            if (s.Role != "owner" || (string)c["owner_token"] != s.Token)
                throw new UnauthorizedAccessException("Not yours.");

            var category = c["category"] as string;
            var currentDue = (DateTime)c["next_due_date"];
            int freqNum = Convert.ToInt32(c["frequency_number"]);
            string freqUnit = (string)c["frequency_unit"];

            if (freqUnit == BizLogic.AsAndWhenUnit)
                return new { mode = "manual" };

            var nextDue = BizLogic.ComputeNextDue(category, freqUnit, freqNum, currentDue, DateTime.Parse(completionDate));

            if (category == "Return")
                return new { mode = "return", nextDue = nextDue.ToString("yyyy-MM-dd"), lastFilableDate = nextDue.AddDays(-1).ToString("yyyy-MM-dd") };
            return new { mode = "rolling", nextDue = nextDue.ToString("yyyy-MM-dd") };
        }

        private string BuildCompletionEmailHtml(string complianceName, DateTime actionDate, string ownerName, string remarks, DateTime nextDue, string reportUrl)
        {
            string Esc(string s) => WebUtility.HtmlEncode(s ?? "");
            var remarksHtml = string.IsNullOrEmpty(remarks) ? "<span style=\"color:#9a938c\">None</span>" : Esc(remarks);
            return
                "<div style=\"font-family:Calibri,Arial,sans-serif;font-size:14px;color:#232019;max-width:640px;border:1px solid #e0d8d6;border-radius:6px;overflow:hidden\">" +
                "<div style=\"background:#211c1a;color:#fff;padding:16px 20px\">" +
                "<div style=\"font-size:11px;letter-spacing:1px;opacity:.8\">COMPLIANCE MANAGEMENT APP</div>" +
                "<div style=\"font-size:19px;font-weight:bold;margin-top:3px\">Compliance Fulfilled</div></div>" +
                "<div style=\"padding:20px\">" +
                "<p style=\"margin:0 0 14px\"><b>" + Esc(complianceName) + "</b> has been marked complete by its owner, <b>" + Esc(ownerName) + "</b>.</p>" +
                "<div style=\"background:#f7f3f2;border-radius:6px;padding:14px 16px;margin-bottom:14px\">" +
                "<table style=\"width:100%;font-size:13.5px;border-collapse:collapse\">" +
                "<tr><td style=\"padding:4px 0;color:#6a635c;width:140px;vertical-align:top\">Completion date</td><td style=\"padding:4px 0\"><b>" + actionDate.ToString("dd-MM-yyyy") + "</b></td></tr>" +
                "<tr><td style=\"padding:4px 0;color:#6a635c;vertical-align:top\">Remarks</td><td style=\"padding:4px 0\">" + remarksHtml + "</td></tr>" +
                "<tr><td style=\"padding:4px 0;color:#6a635c;vertical-align:top\">Next due date</td><td style=\"padding:4px 0\"><b>" + nextDue.ToString("dd-MM-yyyy") + "</b></td></tr>" +
                "</table></div>" +
                "<div style=\"text-align:center;margin:18px 0 6px\">" +
                "<a href=\"" + Esc(reportUrl) + "\" style=\"display:inline-block;background:#8a1f2b;color:#fff;text-decoration:none;font-weight:bold;font-size:13.5px;padding:11px 22px;border-radius:6px\">View Detailed Report</a></div>" +
                "<p style=\"margin:10px 0 0;font-size:12px;color:#9a938c;text-align:center\">This link works once and only for you — if it's already been opened, you'll be asked to sign in instead.</p>" +
                "</div>" +
                "<div style=\"background:#f7f3f2;padding:10px 20px;font-size:11.5px;color:#8a8078\">This is an automated notification from the Compliance Management App.</div>" +
                "</div>";
        }

        // ---------- File preview (list files for one fulfilment log) ----------
        // Same access rule as DownloadZip.ashx (master, or the compliance's own owner/reviewer).
        // Individual files are then streamed by Download.ashx?complianceId=&file=&mode=preview,
        // using the fileUrl tokens returned here - Preview.aspx never touches disk itself.

        [WebMethod]
        public object GetLogFiles(string sessionId, int logId)
        {
            var s = RequireSession(sessionId);

            var log = Db.QuerySingle(
                @"SELECT c.compliance_id, c.owner_token, c.reviewer_token, c.name AS compliance_name, l.action_date
                  FROM compliance_logs l JOIN compliances c ON c.compliance_id = l.compliance_id
                  WHERE l.log_id=@lid", Db.P("@lid", logId));
            if (log == null) throw new ArgumentException("Fulfilment log not found.");

            string ownerToken = (string)log["owner_token"];
            string reviewerToken = log["reviewer_token"] as string;
            bool accessible = s.Role == "master" || (s.Role == "owner" && ownerToken == s.Token)
                               || (s.Role == "reviewer" && reviewerToken != null && reviewerToken == s.Token);
            if (!accessible) throw new UnauthorizedAccessException("Not yours.");

            var atts = Db.Query("SELECT file_name, file_url FROM compliance_attachments WHERE log_id=@lid ORDER BY attachment_id", Db.P("@lid", logId));
            return new
            {
                complianceId = Convert.ToInt32(log["compliance_id"]),
                complianceName = (string)log["compliance_name"],
                actionDate = ((DateTime)log["action_date"]).ToString("yyyy-MM-dd"),
                files = atts.Select(a => new { fileName = (string)a["file_name"], fileUrl = (string)a["file_url"] }).ToList()
            };
        }

        // ---------- Revert fulfilment ----------
        // Only the most recent log, only within 7 days of when it was actually logged, only by its own
        // owner. The log + its attachments are deleted so the app shows nothing (as if it never happened),
        // but every detail is copied into compliance_log_reverts first - a permanent, DB-only audit trail.

        [WebMethod]
        public object RevertFulfillment(string sessionId, int logId, string reason)
        {
            var s = RequireSession(sessionId);
            if (s.Role != "owner") throw new UnauthorizedAccessException("Only the owner can revert a fulfilment.");
            reason = (reason ?? "").Trim();
            if (reason.Length == 0) throw new ArgumentException("A reason is required to revert.");
            if (reason.Length > 250) throw new ArgumentException("Reason must be 250 characters or less.");

            var log = Db.QuerySingle(
                @"SELECT l.log_id, l.compliance_id, l.action_date, l.done_by, l.remarks, l.created_at, l.next_due_date_snapshot,
                         c.owner_token, c.reviewer_token, c.name, c.start_date, c.frequency_number, c.frequency_unit
                  FROM compliance_logs l JOIN compliances c ON c.compliance_id = l.compliance_id
                  WHERE l.log_id=@lid", Db.P("@lid", logId));
            if (log == null) throw new ArgumentException("Fulfilment log not found.");

            string ownerToken = (string)log["owner_token"];
            if (ownerToken != s.Token) throw new UnauthorizedAccessException("Not yours.");

            int complianceId = Convert.ToInt32(log["compliance_id"]);
            var createdAt = (DateTime)log["created_at"];
            if ((DateTime.Now - createdAt).TotalDays > 7)
                throw new InvalidOperationException("This fulfilment can no longer be reverted (past the 7-day window).");

            var latest = Db.QuerySingle("SELECT log_id FROM compliance_logs WHERE compliance_id=@c ORDER BY log_id DESC LIMIT 1", Db.P("@c", complianceId));
            if (latest == null || Convert.ToInt32(latest["log_id"]) != logId)
                throw new InvalidOperationException("Only the most recent fulfilment can be reverted.");

            var prior = Db.QuerySingle(
                "SELECT next_due_date_snapshot FROM compliance_logs WHERE compliance_id=@c AND log_id<@lid ORDER BY log_id DESC LIMIT 1",
                Db.P("@c", complianceId), Db.P("@lid", logId));
            var logFreqUnit = (string)log["frequency_unit"];
            DateTime restoredDue = prior != null && prior["next_due_date_snapshot"] != null
                ? (DateTime)prior["next_due_date_snapshot"]
                : logFreqUnit == BizLogic.AsAndWhenUnit
                    ? (DateTime)log["start_date"]
                    : BizLogic.AddInterval((DateTime)log["start_date"], Convert.ToInt32(log["frequency_number"]), logFreqUnit);
            var restoredFy = BizLogic.FyOf(restoredDue);
            var restoredStatusCalc = BizLogic.ComputeStatus(restoredDue, DateTime.Today);
            var restoredDbStatus = restoredStatusCalc == "compliant" ? "completed" : "pending";
            var beforeDue = log["next_due_date_snapshot"] != null ? (DateTime)log["next_due_date_snapshot"] : restoredDue;

            var atts = Db.Query("SELECT file_name, file_url FROM compliance_attachments WHERE log_id=@lid", Db.P("@lid", logId));
            var attachmentNames = atts.Select(a => (string)a["file_name"]).ToList();
            var attachmentsJson = JsonConvert.SerializeObject(atts.Select(a => new { fileName = (string)a["file_name"], fileUrl = (string)a["file_url"] }));

            string reviewerToken = log["reviewer_token"] as string;
            string reviewerEmail = reviewerToken != null ? reviewerToken + "@mahindra.com" : null;

            int revertId = 0;
            Db.Transact((conn, tx) =>
            {
                revertId = (int)Db.ExecuteTx(conn, tx,
                    @"INSERT INTO compliance_log_reverts
                        (compliance_id, original_log_id, action_date, done_by, remarks, attachments_json, logged_at,
                         next_due_date_before_revert, next_due_date_after_revert, reverted_by, revert_reason, reviewer_token, reviewer_email)
                      VALUES (@cid,@lid,@ad,@db,@rm,@aj,@la,@bd,@ad2,@rb,@rr,@rt,@re)",
                    Db.P("@cid", complianceId), Db.P("@lid", logId), Db.P("@ad", (DateTime)log["action_date"]),
                    Db.P("@db", (string)log["done_by"]), Db.P("@rm", log["remarks"] as string), Db.P("@aj", attachmentsJson),
                    Db.P("@la", createdAt), Db.P("@bd", beforeDue), Db.P("@ad2", restoredDue), Db.P("@rb", s.Token),
                    Db.P("@rr", reason), Db.P("@rt", (object)reviewerToken ?? DBNull.Value), Db.P("@re", (object)reviewerEmail ?? DBNull.Value));

                Db.ExecuteTx(conn, tx, "DELETE FROM compliance_attachments WHERE log_id=@lid", Db.P("@lid", logId));
                Db.ExecuteTx(conn, tx, "DELETE FROM compliance_logs WHERE log_id=@lid", Db.P("@lid", logId));
                Db.ExecuteTx(conn, tx, "UPDATE compliances SET next_due_date=@n, financial_year=@fy, status=@st WHERE compliance_id=@id",
                    Db.P("@n", restoredDue), Db.P("@fy", restoredFy), Db.P("@st", restoredDbStatus), Db.P("@id", complianceId));
                Db.ExecuteTx(conn, tx, "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES (@u,@a,@t,@e,@d)",
                    Db.P("@u", s.Token), Db.P("@a", "REVERT_FULFILLMENT"), Db.P("@t", "compliance"), Db.P("@e", complianceId), Db.P("@d", DBNull.Value));
            });

            // Revert already succeeded in the DB above - a file that's already missing on disk
            // shouldn't turn a successful revert into an error response.
            var uploadsDir = HttpContext.Current.Server.MapPath("~/App_Data/Uploads");
            foreach (var att in atts)
            {
                try
                {
                    var path = Path.Combine(uploadsDir, Path.GetFileName((string)att["file_url"]));
                    if (File.Exists(path)) File.Delete(path);
                }
                catch { }
            }

            bool mailSent = false;
            if (reviewerEmail != null)
            {
                var subject = "Fulfilment reverted — " + (string)log["name"];
                var body = BuildRevertEmailHtml((string)log["name"], (DateTime)log["action_date"], s.FullName, log["remarks"] as string, attachmentNames, reason, restoredDue);
                mailSent = Mailer.TrySend(reviewerEmail, subject, body, out string mailError);
                Db.Execute("UPDATE compliance_log_reverts SET mail_sent=@m, mail_error=@e WHERE revert_id=@id",
                    Db.P("@m", mailSent), Db.P("@e", (object)mailError ?? DBNull.Value), Db.P("@id", revertId));
            }

            return new { ok = true, nextDueDate = restoredDue.ToString("yyyy-MM-dd"), mailSent };
        }

        private string BuildRevertEmailHtml(string complianceName, DateTime actionDate, string ownerName, string remarks, List<string> attachmentNames, string reason, DateTime restoredDue)
        {
            string Esc(string s) => WebUtility.HtmlEncode(s ?? "");
            var attHtml = attachmentNames != null && attachmentNames.Count > 0
                ? string.Join("", attachmentNames.Select(f => "<li>" + Esc(f) + "</li>"))
                : "<li style=\"color:#9a938c\">No attachments</li>";
            var remarksHtml = string.IsNullOrEmpty(remarks) ? "<span style=\"color:#9a938c\">None</span>" : Esc(remarks);
            return
                "<div style=\"font-family:Calibri,Arial,sans-serif;font-size:14px;color:#232019;max-width:640px;border:1px solid #e0d8d6;border-radius:6px;overflow:hidden\">" +
                "<div style=\"background:#211c1a;color:#fff;padding:16px 20px\">" +
                "<div style=\"font-size:11px;letter-spacing:1px;opacity:.8\">COMPLIANCE MANAGEMENT APP</div>" +
                "<div style=\"font-size:19px;font-weight:bold;margin-top:3px\">Fulfilment Reverted</div></div>" +
                "<div style=\"padding:20px\">" +
                "<p style=\"margin:0 0 14px\">A previously logged fulfilment for <b>" + Esc(complianceName) + "</b> has been reverted by its owner, <b>" + Esc(ownerName) + "</b>. This compliance is now due again.</p>" +
                "<div style=\"background:#f7f3f2;border-radius:6px;padding:14px 16px;margin-bottom:14px\">" +
                "<div style=\"font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#8a1f2b;font-weight:bold;margin-bottom:8px\">What was originally filed</div>" +
                "<table style=\"width:100%;font-size:13.5px;border-collapse:collapse\">" +
                "<tr><td style=\"padding:4px 0;color:#6a635c;width:140px;vertical-align:top\">Completion date</td><td style=\"padding:4px 0\"><b>" + actionDate.ToString("dd-MM-yyyy") + "</b></td></tr>" +
                "<tr><td style=\"padding:4px 0;color:#6a635c;vertical-align:top\">Remarks</td><td style=\"padding:4px 0\">" + remarksHtml + "</td></tr>" +
                "<tr><td style=\"padding:4px 0;color:#6a635c;vertical-align:top\">Attachments</td><td style=\"padding:4px 0\"><ul style=\"margin:0;padding-left:18px\">" + attHtml + "</ul></td></tr>" +
                "</table></div>" +
                "<div style=\"background:#fdf2ee;border-left:3px solid #8a1f2b;border-radius:0 6px 6px 0;padding:14px 16px;margin-bottom:14px\">" +
                "<div style=\"font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#8a1f2b;font-weight:bold;margin-bottom:6px\">Reason for revert</div>" +
                "<div style=\"font-size:13.5px\">" + Esc(reason) + "</div></div>" +
                "<p style=\"margin:0;font-size:13px;color:#6a635c\">Next due date is now <b style=\"color:#232019\">" + restoredDue.ToString("dd-MM-yyyy") + "</b>. Please review the compliance again in the app.</p>" +
                "</div>" +
                "<div style=\"background:#f7f3f2;padding:10px 20px;font-size:11.5px;color:#8a8078\">This is an automated notification from the Compliance Management App.</div>" +
                "</div>";
        }
    }
}
