using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Net;
using System.Text;

namespace ReminderMailJob
{
    // Runs every day at 9:00 AM (Windows Task Scheduler). For every active compliance, checks its
    // active reminders (R1-R4, each with its own days_before_due). A reminder is eligible once
    // today >= next_due_date - days_before_due - not just on the exact day, so a missed run (server
    // down, etc.) catches up automatically next time the job runs. Before sending, it checks
    // mail_send_log for an existing 'sent' row for the same compliance + reminder_label + due_date,
    // so a same-day rerun never sends a duplicate. Once the owner fulfills a compliance, next_due_date
    // moves to the next cycle, so the due_date on file changes and every stage becomes eligible again
    // fresh for that new cycle.
    //
    // To = owner + reviewer (role-checked against access.role, same as the other two jobs).
    // Cc = that compliance's plant's mail-config for that stage (mail_config_recipient,
    // mail_type='reminders', group_key='r1'/'r2'/'r3'/'r4').
    internal class ReminderRow
    {
        public int ComplianceId;
        public string ComplianceName;
        public string PlantName;
        public string AgencyName;
        public string FinancialYear;
        public DateTime NextDueDate;
        public int PlantId;
        public string OwnerToken;
        public string OwnerName;
        public string ReviewerToken;
        public string ReviewerName;
        public string ReminderLabel;
        public int DaysBeforeDue;
    }

    internal class Program
    {
        private static string MailDomain
        {
            get { return ConfigurationManager.AppSettings["MailDomain"] ?? "mahindra.com"; }
        }

        private static int Main()
        {
            var today = DateTime.Today;
            Console.WriteLine("ReminderMailJob starting for " + today.ToString("yyyy-MM-dd") + "...");

            var rows = Db.Query(
                @"SELECT c.compliance_id, c.name, c.next_due_date, c.plant_id, c.financial_year, c.owner_token,
                         pl.Plant_Name AS plant_name, a.name AS agency_name, ot.Name AS owner_name,
                         r.reminder_label, r.days_before_due,
                         CASE WHEN rvallowed.Token IS NOT NULL AND rvrole.Token IS NOT NULL THEN c.reviewer_token ELSE NULL END AS reviewer_token,
                         CASE WHEN rvallowed.Token IS NOT NULL AND rvrole.Token IS NOT NULL THEN rvt.Name ELSE NULL END AS reviewer_name
                  FROM compliances c
                  JOIN reminders r ON r.compliance_id = c.compliance_id AND r.is_active = 1
                  JOIN plant_master.tbl_plant pl ON pl.Plant_ID = c.plant_id
                  JOIN agencies a ON a.agency_id = c.agency_id
                  JOIN access.login_tokenpass ot ON ot.Token = c.owner_token
                  JOIN access.login_tokenallowed oallowed ON oallowed.Token = ot.Token AND oallowed.LegalCompliance = 1
                  JOIN access.role orole ON orole.Token = ot.Token AND LOWER(orole.LegalCompliance) = 'owner'
                  LEFT JOIN access.login_tokenpass rvt ON rvt.Token = c.reviewer_token
                  LEFT JOIN access.login_tokenallowed rvallowed ON rvallowed.Token = rvt.Token AND rvallowed.LegalCompliance = 1
                  LEFT JOIN access.role rvrole ON rvrole.Token = rvt.Token AND LOWER(rvrole.LegalCompliance) = 'reviewer'
                  WHERE c.is_active = 1 AND DATEDIFF(c.next_due_date, @today) <= r.days_before_due
                  ORDER BY c.compliance_id, r.reminder_label",
                Db.P("@today", today));

            var items = rows.Select(r => new ReminderRow
            {
                ComplianceId = Convert.ToInt32(r["compliance_id"]),
                ComplianceName = (string)r["name"],
                PlantName = (string)r["plant_name"],
                AgencyName = (string)r["agency_name"],
                FinancialYear = r["financial_year"] as string,
                NextDueDate = (DateTime)r["next_due_date"],
                PlantId = Convert.ToInt32(r["plant_id"]),
                OwnerToken = (string)r["owner_token"],
                OwnerName = (string)r["owner_name"],
                ReviewerToken = r["reviewer_token"] as string,
                ReviewerName = r["reviewer_name"] as string,
                ReminderLabel = (string)r["reminder_label"],
                DaysBeforeDue = Convert.ToInt32(r["days_before_due"])
            }).ToList();

            int sent = 0, failed = 0, skipped = 0;

            foreach (var item in items)
            {
                try
                {
                    var outcome = ProcessReminder(item, today);
                    if (outcome == "sent") sent++;
                    else if (outcome == "failed") failed++;
                    else skipped++;
                }
                catch (Exception ex)
                {
                    failed++;
                    LogSend(item, "", "", "Compliance Reminder [" + item.ReminderLabel + "] - " + item.ComplianceName, "failed", null, ex.Message);
                    Console.WriteLine("FAILED for compliance " + item.ComplianceId + " (" + item.ReminderLabel + "): " + ex.Message);
                }
            }

            Console.WriteLine("Done. sent=" + sent + ", failed=" + failed + ", skipped(already sent)=" + skipped);
            return failed > 0 ? 1 : 0;
        }

        private static string ProcessReminder(ReminderRow item, DateTime today)
        {
            var already = Db.QuerySingle(
                @"SELECT 1 FROM mail_send_log
                  WHERE job_name='ReminderMailJob' AND compliance_id=@c AND reminder_label=@l AND due_date=@d AND status='sent' LIMIT 1",
                Db.P("@c", item.ComplianceId), Db.P("@l", item.ReminderLabel), Db.P("@d", item.NextDueDate));

            if (already != null) return "skipped";

            var subject = "Compliance Reminder [" + item.ReminderLabel + "] - " + item.ComplianceName;

            var toEmails = new List<string> { item.OwnerToken + "@" + MailDomain };
            if (!string.IsNullOrWhiteSpace(item.ReviewerToken))
                toEmails.Add(item.ReviewerToken + "@" + MailDomain);
            toEmails = toEmails.Distinct(StringComparer.OrdinalIgnoreCase).ToList();

            var groupKey = item.ReminderLabel.ToLowerInvariant();
            var ccRows = Db.Query(
                "SELECT token FROM mail_config_recipient WHERE plant_id=@p AND mail_type='reminders' AND group_key=@g",
                Db.P("@p", item.PlantId), Db.P("@g", groupKey));
            var ccEmails = ccRows.Select(r => ResolveEmail((string)r["token"]))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Except(toEmails, StringComparer.OrdinalIgnoreCase).ToList();

            var body = BuildBody(item, today);

            string error;
            if (Mailer.TrySend(toEmails, ccEmails, subject, body, out error))
            {
                LogSend(item, string.Join(";", toEmails), string.Join(";", ccEmails), subject, "sent", null, null);
                Console.WriteLine("Sent " + item.ReminderLabel + " for compliance " + item.ComplianceId + " (" + item.ComplianceName + ")");
                return "sent";
            }
            else
            {
                LogSend(item, string.Join(";", toEmails), string.Join(";", ccEmails), subject, "failed", null, error);
                Console.WriteLine("FAILED for compliance " + item.ComplianceId + " (" + item.ReminderLabel + "): " + error);
                return "failed";
            }
        }

        // Manual entries in mail_config_recipient may already be a full email; regular tokens never
        // contain '@', so this covers both without needing the is_manual flag.
        private static string ResolveEmail(string tokenOrEmail)
        {
            return tokenOrEmail.Contains("@") ? tokenOrEmail : tokenOrEmail + "@" + MailDomain;
        }

        private static void LogSend(ReminderRow item, string toEmails, string ccEmails, string subject,
            string status, string skipReason, string errorMessage)
        {
            Db.Execute(
                @"INSERT INTO mail_send_log (job_name, plant_id, owner_token, compliance_id, reminder_label, due_date, to_emails, cc_emails, subject, status, skip_reason, error_message)
                  VALUES ('ReminderMailJob',@p,@ot,@c,@l,@d,@to,@cc,@sub,@st,@sr,@em)",
                Db.P("@p", item.PlantId), Db.P("@ot", item.OwnerToken), Db.P("@c", item.ComplianceId), Db.P("@l", item.ReminderLabel),
                Db.P("@d", item.NextDueDate), Db.P("@to", toEmails ?? ""), Db.P("@cc", ccEmails ?? ""),
                Db.P("@sub", subject), Db.P("@st", status), Db.P("@sr", skipReason), Db.P("@em", errorMessage));
        }

        // Table-based, all-inline-style markup on purpose - has to render identically in the Word-engine
        // Outlook builds (2016/2019/365 desktop) and the new Chromium-based Outlook. Same visual family
        // (860px, header band, colors, footer) as MonthlyMailJob and MondayMailJob.
        private static string BuildBody(ReminderRow item, DateTime today)
        {
            const string font = "Segoe UI, Arial, sans-serif";
            int daysRemaining = (item.NextDueDate - today).Days;
            bool isOverdue = daysRemaining < 0;
            var stageText = isOverdue
                ? "Overdue by " + (-daysRemaining) + (Math.Abs(daysRemaining) == 1 ? " day" : " days")
                : daysRemaining == 0 ? "Due today" : (daysRemaining + (daysRemaining == 1 ? " day" : " days") + " remaining");
            var accentFg = isOverdue ? "#c0392b" : "#2c3e50";
            var accentBg = isOverdue ? "#fdecea" : "#eaf1fb";

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
            sb.Append("<span style='font-family:" + font + ";font-size:12.5px;color:#c3d0e0;'>Reminder " + Enc(item.ReminderLabel) + " &ndash; " + Enc(stageText) + "</span>");
            sb.Append("</td></tr>");

            sb.Append("<tr><td style='padding:26px 32px 6px;'>");
            sb.Append("<p style='margin:0 0 12px;font-family:" + font + ";font-size:15px;color:#1c2430;'>Dear " + Enc(item.OwnerName) + ",</p>");
            sb.Append("<p style='margin:0 0 20px;font-family:" + font + ";font-size:13px;line-height:1.6;color:#3c4757;'>"
                + "This is reminder <b>" + Enc(item.ReminderLabel) + "</b> for <b>" + Enc(item.ComplianceName) + "</b> at "
                + Enc(item.PlantName) + ", due on <b>" + item.NextDueDate.ToString("dd MMM yyyy") + "</b>.</p>");
            sb.Append("</td></tr>");

            sb.Append("<tr><td style='padding:0 32px;'>");
            AppendSectionHeader(sb, font, stageText, accentFg, accentBg);
            AppendDetailTable(sb, font, item);
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

        private static void AppendDetailTable(StringBuilder sb, string font, ReminderRow item)
        {
            sb.Append("<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' style='border-collapse:collapse;margin-bottom:22px;'>");
            sb.Append("<tr>");
            AppendHeaderCell(sb, font, "Compliance");
            AppendHeaderCell(sb, font, "Plant");
            AppendHeaderCell(sb, font, "Agency");
            AppendHeaderCell(sb, font, "Financial Year");
            AppendHeaderCell(sb, font, "Due Date");
            AppendHeaderCell(sb, font, "Reviewer");
            sb.Append("</tr>");

            sb.Append("<tr style='background-color:#ffffff;'>");
            AppendCell(sb, font, Enc(item.ComplianceName));
            AppendCell(sb, font, Enc(item.PlantName));
            AppendCell(sb, font, Enc(item.AgencyName));
            AppendCell(sb, font, Enc(item.FinancialYear));
            AppendCell(sb, font, item.NextDueDate.ToString("yyyy-MM-dd"));
            AppendCell(sb, font, Enc(string.IsNullOrWhiteSpace(item.ReviewerName) ? "-" : item.ReviewerName));
            sb.Append("</tr>");
            sb.Append("</table>");
        }

        private static void AppendHeaderCell(StringBuilder sb, string font, string text)
        {
            sb.Append("<th align='left' style='font-family:" + font + ";font-size:11px;font-weight:bold;color:#5b6577;white-space:nowrap;"
                + "text-transform:uppercase;letter-spacing:0.03em;background-color:#f0f2f5;border-bottom:2px solid #dde1e7;padding:10px 12px;'>" + Enc(text) + "</th>");
        }

        private static void AppendCell(StringBuilder sb, string font, string text)
        {
            sb.Append("<td style='font-family:" + font + ";font-size:12.5px;color:#1c2430;border-bottom:1px solid #eceef2;padding:10px 12px;'>" + text + "</td>");
        }

        private static string Enc(string s)
        {
            return WebUtility.HtmlEncode(s ?? "");
        }
    }
}
