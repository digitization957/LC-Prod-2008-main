using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Text;

namespace MondayMailJob
{
    // Runs every Monday at 8:35 AM (Windows Task Scheduler). One mail per plant, sent to that plant's
    // owners + reviewers (role-checked against access.role, same as MonthlyMailJob), CC'd from that
    // plant's Monday mail-config (mail_config_recipient, mail_type='monday', group_key='cc'). Body has
    // the owner-wise summary grid and the compliance status detail grid (no Done Date / Gap columns -
    // those are export-only on the web app's Overview page, not part of this grid).
    //
    // Every plant gets exactly one row in mail_send_log under one mail_job_run per run - sent, failed
    // (with the error), or skipped (with the reason) - so nothing is ever silently lost and one plant
    // failing never stops the rest of the run. Management can see the full picture in those two tables.
    internal class OwnerAgg
    {
        public string OwnerName;
        public string DeptName;
        public int Complied;
        public int NonComplied;
        public int Total;
    }

    internal class DetailRow
    {
        public string ComplianceName;
        public string AgencyName;
        public string OwnerName;
        public string DeptName;
        public string Status;
        public DateTime DueDate;
    }

    internal class Program
    {
        private static string MailDomain
        {
            get { return ConfigurationManager.AppSettings["MailDomain"] ?? "mahindra.com"; }
        }

        private static readonly Dictionary<string, string> StatusLabel = new Dictionary<string, string>
        {
            { "overdue", "Overdue" }, { "due", "Due" }, { "compliant", "Compliant" }
        };
        private static readonly Dictionary<string, string> StatusColor = new Dictionary<string, string>
        {
            { "overdue", "#c0392b" }, { "due", "#b9770e" }, { "compliant", "#1e7a4c" }
        };
        private static readonly Dictionary<string, string> StatusBg = new Dictionary<string, string>
        {
            { "overdue", "#fdecea" }, { "due", "#fdf3e3" }, { "compliant", "#eafaf1" }
        };
        private static readonly Dictionary<string, int> StatusRank = new Dictionary<string, int>
        {
            { "overdue", 0 }, { "due", 1 }, { "compliant", 2 }
        };

        private static int Main()
        {
            var today = DateTime.Today;
            Console.WriteLine("MondayMailJob starting for " + today.ToString("yyyy-MM-dd") + "...");

            int sent = 0, failed = 0, skipped = 0;

            var plants = Db.Query("SELECT Plant_ID, Plant_Name FROM plant_master.tbl_plant ORDER BY Plant_Name");

            foreach (var plant in plants)
            {
                int plantId = Convert.ToInt32(plant["Plant_ID"]);
                string plantName = (string)plant["Plant_Name"];

                try
                {
                    var outcome = ProcessPlant(plantId, plantName, today);
                    if (outcome == "sent") sent++;
                    else if (outcome == "failed") failed++;
                    else skipped++;
                }
                catch (Exception ex)
                {
                    failed++;
                    LogSend(plantId, "", "", "Compliance Schedule - " + plantName, "failed", null, ex.Message, null, null);
                    Console.WriteLine("FAILED for plant " + plantName + ": " + ex.Message);
                }
            }

            Console.WriteLine("Done. sent=" + sent + ", failed=" + failed + ", skipped=" + skipped);
            return failed > 0 ? 1 : 0;
        }

        private static string ProcessPlant(int plantId, string plantName, DateTime today)
        {
            var subject = "Compliance Schedule - " + plantName + " - Week of " + today.ToString("dd MMM yyyy");

            var recipientRows = Db.Query(
                @"SELECT DISTINCT p.Token
                  FROM access.login_tokenpass p
                  JOIN access.login_tokenallowed a ON a.Token = p.Token AND a.LegalCompliance = 1
                  JOIN access.role r ON r.Token = p.Token
                  WHERE p.PlantID = @p AND LOWER(r.LegalCompliance) IN ('owner','reviewer')",
                Db.P("@p", plantId));

            var toEmails = recipientRows.Select(r => ResolveEmail((string)r["Token"]))
                .Distinct(StringComparer.OrdinalIgnoreCase).ToList();

            if (toEmails.Count == 0)
            {
                LogSend(plantId, "", "", subject, "skipped", "no owners/reviewers for this plant", null, null, null);
                return "skipped";
            }

            var complianceRows = Db.Query(
                @"SELECT c.name, c.next_due_date, a.name AS agency_name, ot.Name AS owner_name, dd.Dept_Name AS dept_name
                  FROM compliances c
                  JOIN agencies a ON a.agency_id = c.agency_id
                  JOIN access.login_tokenpass ot ON ot.Token = c.owner_token
                  JOIN access.login_tokenallowed oallowed ON oallowed.Token = ot.Token AND oallowed.LegalCompliance = 1
                  JOIN access.role orole ON orole.Token = ot.Token AND LOWER(orole.LegalCompliance) = 'owner'
                  LEFT JOIN plant_master.tbl_dept dd ON dd.Plant_ID = ot.PlantID AND dd.Dept_ID = ot.DeptID
                  WHERE c.is_active = 1 AND c.plant_id = @p
                  ORDER BY c.owner_token, c.next_due_date ASC",
                Db.P("@p", plantId));

            if (complianceRows.Count == 0)
            {
                LogSend(plantId, string.Join(";", toEmails), "", subject, "skipped", "no active compliances for this plant", null, null, null);
                return "skipped";
            }

            var details = complianceRows.Select(r => new DetailRow
            {
                ComplianceName = (string)r["name"],
                AgencyName = (string)r["agency_name"],
                OwnerName = (string)r["owner_name"],
                DeptName = r["dept_name"] as string,
                DueDate = (DateTime)r["next_due_date"],
                Status = ComputeStatus((DateTime)r["next_due_date"], today)
            }).OrderBy(d => StatusRank[d.Status]).ThenBy(d => d.ComplianceName).ToList();

            var ownerAgg = details
                .GroupBy(d => d.OwnerName)
                .Select(g => new OwnerAgg
                {
                    OwnerName = g.Key,
                    DeptName = g.First().DeptName,
                    Complied = g.Count(x => x.Status == "compliant"),
                    NonComplied = g.Count(x => x.Status != "compliant"),
                    Total = g.Count()
                })
                .OrderBy(o => o.OwnerName)
                .ToList();

            int overdueCount = details.Count(d => d.Status == "overdue");
            int dueCount = details.Count(d => d.Status == "due");

            var ccRows = Db.Query(
                "SELECT token FROM mail_config_recipient WHERE plant_id=@p AND mail_type='monday' AND group_key='cc'",
                Db.P("@p", plantId));
            var ccEmails = ccRows.Select(r => ResolveEmail((string)r["token"]))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Except(toEmails, StringComparer.OrdinalIgnoreCase).ToList();

            var body = BuildBody(plantName, today, ownerAgg, details);

            string error;
            if (Mailer.TrySend(toEmails, ccEmails, subject, body, out error))
            {
                LogSend(plantId, string.Join(";", toEmails), string.Join(";", ccEmails), subject, "sent", null, null, overdueCount, dueCount);
                Console.WriteLine("Sent for " + plantName + " (to=" + toEmails.Count + ", cc=" + ccEmails.Count + ") - overdue=" + overdueCount + ", due=" + dueCount);
                return "sent";
            }
            else
            {
                LogSend(plantId, string.Join(";", toEmails), string.Join(";", ccEmails), subject, "failed", null, error, overdueCount, dueCount);
                Console.WriteLine("FAILED for " + plantName + ": " + error);
                return "failed";
            }
        }

        // Manual entries in mail_config_recipient may already be a full email; regular tokens never
        // contain '@', so this covers both without needing the is_manual flag.
        private static string ResolveEmail(string tokenOrEmail)
        {
            return tokenOrEmail.Contains("@") ? tokenOrEmail : tokenOrEmail + "@" + MailDomain;
        }

        private static string ComputeStatus(DateTime nextDue, DateTime today)
        {
            if (nextDue.Date < today.Date) return "overdue";
            if (nextDue.Year == today.Year && nextDue.Month == today.Month) return "due";
            return "compliant";
        }

        private static void LogSend(int plantId, string toEmails, string ccEmails, string subject,
            string status, string skipReason, string errorMessage, int? overdueCount, int? dueCount)
        {
            Db.Execute(
                @"INSERT INTO mail_send_log (job_name, plant_id, to_emails, cc_emails, subject, status, skip_reason, error_message, overdue_count, due_count)
                  VALUES ('MondayMailJob',@p,@to,@cc,@sub,@st,@sr,@em,@oc,@dc)",
                Db.P("@p", plantId), Db.P("@to", toEmails ?? ""), Db.P("@cc", ccEmails ?? ""),
                Db.P("@sub", subject), Db.P("@st", status), Db.P("@sr", skipReason), Db.P("@em", errorMessage),
                Db.P("@oc", overdueCount), Db.P("@dc", dueCount));
        }

        // Table-based, all-inline-style markup on purpose - has to render identically in the Word-engine
        // Outlook builds (2016/2019/365 desktop) and the new Chromium-based Outlook, which between them
        // support neither CSS floats/flexbox, background-images, nor <style> cascading reliably.
        private static string BuildBody(string plantName, DateTime today, List<OwnerAgg> ownerAgg, List<DetailRow> details)
        {
            const string font = "Segoe UI, Arial, sans-serif";
            var sb = new StringBuilder();

            sb.Append("<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office'>");
            sb.Append("<head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>");
            sb.Append("<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->");
            sb.Append("</head>");
            sb.Append("<body style='margin:0;padding:0;background-color:#eef1f5;'>");

            sb.Append("<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' style='background-color:#eef1f5;'><tr><td align='center' style='padding:28px 12px;'>");
            sb.Append("<!--[if mso]><table role='presentation' width='860' cellpadding='0' cellspacing='0' border='0'><tr><td><![endif]-->");
            sb.Append("<table role='presentation' width='860' cellpadding='0' cellspacing='0' border='0' style='width:860px;max-width:860px;background-color:#ffffff;border:1px solid #dde1e7;'>");

            sb.Append("<tr><td style='background-color:#3a6ea5;height:5px;line-height:5px;font-size:0;'>&nbsp;</td></tr>");
            sb.Append("<tr><td style='background-color:#1f3a5f;padding:22px 32px;'>");
            sb.Append("<span style='font-family:" + font + ";font-size:19px;font-weight:bold;color:#ffffff;letter-spacing:0.01em;'>Compliance Portal</span><br>");
            sb.Append("<span style='font-family:" + font + ";font-size:12.5px;color:#c3d0e0;'>Weekly Compliance Schedule &ndash; " + Enc(today.ToString("dd MMM yyyy")) + "</span>");
            sb.Append("</td></tr>");

            sb.Append("<tr><td style='padding:26px 32px 6px;'>");
            sb.Append("<p style='margin:0 0 12px;font-family:" + font + ";font-size:15px;color:#1c2430;'>Dear " + Enc(plantName) + " Team,</p>");
            sb.Append("<p style='margin:0 0 20px;font-family:" + font + ";font-size:13px;line-height:1.6;color:#3c4757;'>"
                + "Here is your compliance snapshot for <b>" + Enc(plantName) + "</b> as of <b>" + today.ToString("dd MMM yyyy")
                + "</b> &mdash; the owner-wise summary, followed by the full status detail.</p>");
            sb.Append("</td></tr>");

            sb.Append("<tr><td style='padding:0 32px;'>");
            AppendSectionHeader(sb, font, "Summary - Owner-wise", "#2c3e50", "#eaf1fb");
            AppendOwnerTable(sb, font, ownerAgg);
            sb.Append("</td></tr>");

            sb.Append("<tr><td style='padding:0 32px;'>");
            AppendSectionHeader(sb, font, "Compliance Status - Detail", "#2c3e50", "#eaf1fb");
            AppendDetailTable(sb, font, details);
            sb.Append("</td></tr>");

            sb.Append("<tr><td style='padding:20px 32px 28px;border-top:1px solid #eceef2;'>");
            sb.Append("<p style='margin:0;font-family:" + font + ";font-size:11px;color:#8b93a2;'>This is an automated mail from the Compliance Portal. Please do not reply to this email.</p>");
            sb.Append("</td></tr>");

            sb.Append("</table>");
            sb.Append("<!--[if mso]></td></tr></table><![endif]-->");
            sb.Append("</td></tr></table>");
            sb.Append("</body></html>");
            return sb.ToString();
        }

        private static void AppendSectionHeader(StringBuilder sb, string font, string title, string fg, string bg)
        {
            sb.Append("<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' style='margin:8px 0 12px;'><tr>");
            sb.Append("<td style='background-color:" + bg + ";border-left:4px solid " + fg + ";padding:10px 14px;'>");
            sb.Append("<span style='font-family:" + font + ";font-size:13px;font-weight:bold;color:" + fg + ";letter-spacing:0.03em;text-transform:uppercase;'>" + Enc(title) + "</span>");
            sb.Append("</td></tr></table>");
        }

        private static void AppendOwnerTable(StringBuilder sb, string font, List<OwnerAgg> rows)
        {
            sb.Append("<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' style='border-collapse:collapse;margin-bottom:22px;'>");
            sb.Append("<tr>");
            AppendHeaderCell(sb, font, "Owner");
            AppendHeaderCell(sb, font, "Dept");
            AppendHeaderCell(sb, font, "Complied");
            AppendHeaderCell(sb, font, "Non-complied");
            AppendHeaderCell(sb, font, "Total");
            sb.Append("</tr>");

            int totalComplied = 0, totalNonComplied = 0, totalAll = 0;
            for (int i = 0; i < rows.Count; i++)
            {
                var r = rows[i];
                totalComplied += r.Complied; totalNonComplied += r.NonComplied; totalAll += r.Total;
                var bg = (i % 2 == 0) ? "#ffffff" : "#f7f8fa";
                sb.Append("<tr style='background-color:" + bg + ";'>");
                AppendCell(sb, font, Enc(r.OwnerName), null);
                AppendCell(sb, font, Enc(string.IsNullOrWhiteSpace(r.DeptName) ? "-" : r.DeptName), null);
                AppendCell(sb, font, r.Complied.ToString(), "#1e7a4c");
                AppendCell(sb, font, r.NonComplied.ToString(), r.NonComplied > 0 ? "#c0392b" : null);
                AppendCell(sb, font, r.Total.ToString(), null);
                sb.Append("</tr>");
            }
            sb.Append("<tr style='background-color:#eaf1fb;'>");
            AppendCell(sb, font, "<b>Total</b>", null);
            AppendCell(sb, font, "", null);
            AppendCell(sb, font, "<b>" + totalComplied + "</b>", "#1e7a4c");
            AppendCell(sb, font, "<b>" + totalNonComplied + "</b>", totalNonComplied > 0 ? "#c0392b" : null);
            AppendCell(sb, font, "<b>" + totalAll + "</b>", null);
            sb.Append("</tr>");
            sb.Append("</table>");
        }

        private static void AppendDetailTable(StringBuilder sb, string font, List<DetailRow> rows)
        {
            sb.Append("<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' style='border-collapse:collapse;margin-bottom:22px;'>");
            sb.Append("<tr>");
            AppendHeaderCell(sb, font, "Compliance");
            AppendHeaderCell(sb, font, "Agency");
            AppendHeaderCell(sb, font, "Owner");
            AppendHeaderCell(sb, font, "Dept");
            AppendHeaderCell(sb, font, "Status");
            AppendHeaderCell(sb, font, "Due Date");
            sb.Append("</tr>");

            for (int i = 0; i < rows.Count; i++)
            {
                var r = rows[i];
                var bg = (i % 2 == 0) ? "#ffffff" : "#f7f8fa";
                sb.Append("<tr style='background-color:" + bg + ";'>");
                AppendCell(sb, font, Enc(r.ComplianceName), null);
                AppendCell(sb, font, Enc(r.AgencyName), null);
                AppendCell(sb, font, Enc(r.OwnerName), null);
                AppendCell(sb, font, Enc(string.IsNullOrWhiteSpace(r.DeptName) ? "-" : r.DeptName), null);
                sb.Append("<td style='font-family:" + font + ";font-size:12px;border-bottom:1px solid #eceef2;padding:10px 12px;'>" +
                    "<span style='display:inline-block;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:bold;background-color:"
                    + StatusBg[r.Status] + ";color:" + StatusColor[r.Status] + ";'>" + StatusLabel[r.Status] + "</span></td>");
                AppendCell(sb, font, r.DueDate.ToString("yyyy-MM-dd"), null);
                sb.Append("</tr>");
            }
            sb.Append("</table>");
        }

        private static void AppendHeaderCell(StringBuilder sb, string font, string text)
        {
            sb.Append("<th align='left' style='font-family:" + font + ";font-size:11px;font-weight:bold;color:#5b6577;white-space:nowrap;"
                + "text-transform:uppercase;letter-spacing:0.03em;background-color:#f0f2f5;border-bottom:2px solid #dde1e7;padding:10px 12px;'>" + Enc(text) + "</th>");
        }

        private static void AppendCell(StringBuilder sb, string font, string text, string color)
        {
            var colorStyle = color != null ? "color:" + color + ";" : "color:#1c2430;";
            sb.Append("<td style='font-family:" + font + ";font-size:12.5px;" + colorStyle + "border-bottom:1px solid #eceef2;padding:10px 12px;'>" + text + "</td>");
        }

        private static string Enc(string s)
        {
            return System.Net.WebUtility.HtmlEncode(s ?? "");
        }
    }
}
