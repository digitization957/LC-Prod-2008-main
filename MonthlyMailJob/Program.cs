using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Net;
using System.Text;

namespace MonthlyMailJob
{
    // Runs on the 1st of every month at 8:30 AM (scheduled via Windows Task Scheduler, not a WebJob -
    // this app is not hosted on Azure, only the DB is). Sends each owner one mail with their compliances
    // due this month plus everything still overdue (any past month), CC'd to that owner's reviewers.
    // Emails are not stored anywhere - every token's address is {token}@mahindra.com.
    internal class Row
    {
        public string Name;
        public string PlantName;
        public string AgencyName;
        public string FinancialYear;
        public DateTime NextDueDate;
        public string OwnerToken;
        public string OwnerName;
        public string ReviewerToken;
        public string ReviewerName;
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
            var firstOfMonth = new DateTime(today.Year, today.Month, 1);
            var lastOfMonth = firstOfMonth.AddMonths(1).AddDays(-1);

            Console.WriteLine("MonthlyMailJob starting for " + firstOfMonth.ToString("yyyy-MM") + "...");

            var rows = Db.Query(
                @"SELECT c.name, c.next_due_date, c.financial_year, c.owner_token,
                         pl.Plant_Name AS plant_name, a.name AS agency_name, ot.Name AS owner_name,
                         CASE WHEN rallowed.Token IS NOT NULL AND rrole.Token IS NOT NULL THEN c.reviewer_token ELSE NULL END AS reviewer_token,
                         CASE WHEN rallowed.Token IS NOT NULL AND rrole.Token IS NOT NULL THEN rt.Name ELSE NULL END AS reviewer_name
                  FROM compliances c
                  JOIN plant_master.tbl_plant pl ON pl.Plant_ID = c.plant_id
                  JOIN agencies a ON a.agency_id = c.agency_id
                  JOIN access.login_tokenpass ot ON ot.Token = c.owner_token
                  JOIN access.login_tokenallowed oallowed ON oallowed.Token = ot.Token AND oallowed.LegalCompliance = 1
                  JOIN access.role orole ON orole.Token = ot.Token AND LOWER(orole.LegalCompliance) = 'owner'
                  LEFT JOIN access.login_tokenpass rt ON rt.Token = c.reviewer_token
                  LEFT JOIN access.login_tokenallowed rallowed ON rallowed.Token = rt.Token AND rallowed.LegalCompliance = 1
                  LEFT JOIN access.role rrole ON rrole.Token = rt.Token AND LOWER(rrole.LegalCompliance) = 'reviewer'
                  WHERE c.is_active = 1 AND c.next_due_date <= @lastOfMonth
                  ORDER BY c.owner_token, c.next_due_date ASC",
                Db.P("@lastOfMonth", lastOfMonth));

            var items = rows.Select(r => new Row
            {
                Name = (string)r["name"],
                PlantName = (string)r["plant_name"],
                AgencyName = (string)r["agency_name"],
                FinancialYear = (string)r["financial_year"],
                NextDueDate = (DateTime)r["next_due_date"],
                OwnerToken = (string)r["owner_token"],
                OwnerName = (string)r["owner_name"],
                ReviewerToken = r["reviewer_token"] as string,
                ReviewerName = r["reviewer_name"] as string
            }).ToList();

            var byOwner = items.GroupBy(i => i.OwnerToken);
            int sent = 0, failed = 0;

            foreach (var grp in byOwner)
            {
                var overdue = grp.Where(i => i.NextDueDate < firstOfMonth).OrderBy(i => i.NextDueDate).ToList();
                var dueThisMonth = grp.Where(i => i.NextDueDate >= firstOfMonth).OrderBy(i => i.NextDueDate).ToList();
                var ownerName = grp.First().OwnerName;

                var ccEmails = grp.Select(i => i.ReviewerToken)
                    .Where(t => !string.IsNullOrWhiteSpace(t))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Select(t => t + "@" + MailDomain)
                    .ToList();

                var toEmail = grp.Key + "@" + MailDomain;
                var subject = "Compliance Schedule - " + firstOfMonth.ToString("MMMM yyyy");
                var body = BuildBody(ownerName, firstOfMonth, overdue, dueThisMonth);

                try
                {
                    string error;
                    if (Mailer.TrySend(toEmail, ccEmails, subject, body, out error))
                    {
                        sent++;
                        LogSend(grp.Key, toEmail, string.Join(";", ccEmails), subject, "sent", null, overdue.Count, dueThisMonth.Count);
                        Console.WriteLine("Sent to " + toEmail + " (cc: " + ccEmails.Count + ") - overdue=" + overdue.Count + ", due=" + dueThisMonth.Count);
                    }
                    else
                    {
                        failed++;
                        LogSend(grp.Key, toEmail, string.Join(";", ccEmails), subject, "failed", error, overdue.Count, dueThisMonth.Count);
                        Console.WriteLine("FAILED for " + toEmail + ": " + error);
                    }
                }
                catch (Exception ex)
                {
                    failed++;
                    LogSend(grp.Key, toEmail, string.Join(";", ccEmails), subject, "failed", ex.Message, overdue.Count, dueThisMonth.Count);
                    Console.WriteLine("FAILED for " + toEmail + ": " + ex.Message);
                }
            }

            Console.WriteLine("Done. sent=" + sent + ", failed=" + failed);
            return failed > 0 ? 1 : 0;
        }

        private static void LogSend(string ownerToken, string toEmail, string ccEmails, string subject,
            string status, string errorMessage, int overdueCount, int dueCount)
        {
            Db.Execute(
                @"INSERT INTO mail_send_log (job_name, owner_token, to_emails, cc_emails, subject, status, error_message, overdue_count, due_count)
                  VALUES ('MonthlyMailJob',@ot,@to,@cc,@sub,@st,@em,@oc,@dc)",
                Db.P("@ot", ownerToken), Db.P("@to", toEmail), Db.P("@cc", ccEmails ?? ""),
                Db.P("@sub", subject), Db.P("@st", status), Db.P("@em", errorMessage),
                Db.P("@oc", overdueCount), Db.P("@dc", dueCount));
        }

        // Table-based, all-inline-style markup on purpose - this has to render identically in the
        // Word-engine Outlook builds (2016/2019/365 desktop) and the new Chromium-based Outlook, which
        // between them support neither CSS floats/flexbox, background-images, nor <style> cascading
        // reliably. Every color/font/spacing is set directly on the element that needs it.
        private static string BuildBody(string ownerName, DateTime monthStart, List<Row> overdue, List<Row> dueThisMonth)
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

            // header band - thin accent rule on top, then the title bar
            sb.Append("<tr><td style='background-color:#3a6ea5;height:5px;line-height:5px;font-size:0;'>&nbsp;</td></tr>");
            sb.Append("<tr><td style='background-color:#1f3a5f;padding:22px 32px;'>");
            sb.Append("<span style='font-family:" + font + ";font-size:19px;font-weight:bold;color:#ffffff;letter-spacing:0.01em;'>Compliance Portal</span><br>");
            sb.Append("<span style='font-family:" + font + ";font-size:12.5px;color:#c3d0e0;'>Monthly Compliance Schedule &ndash; " + Enc(monthStart.ToString("MMMM yyyy")) + "</span>");
            sb.Append("</td></tr>");

            // greeting
            sb.Append("<tr><td style='padding:26px 32px 6px;'>");
            sb.Append("<p style='margin:0 0 12px;font-family:" + font + ";font-size:15px;color:#1c2430;'>Dear " + Enc(ownerName) + ",</p>");
            sb.Append("<p style='margin:0 0 20px;font-family:" + font + ";font-size:13px;line-height:1.6;color:#3c4757;'>"
                + "Here is your compliance schedule for <b>" + Enc(monthStart.ToString("MMMM yyyy")) + "</b> &mdash; everything overdue, and everything due this month.</p>");
            sb.Append("</td></tr>");

            if (overdue.Count > 0)
            {
                sb.Append("<tr><td style='padding:0 32px;'>");
                AppendSectionHeader(sb, font, "Overdue", "#c0392b", "#fdecea");
                AppendTable(sb, font, overdue);
                sb.Append("</td></tr>");
            }
            if (dueThisMonth.Count > 0)
            {
                sb.Append("<tr><td style='padding:0 32px;'>");
                AppendSectionHeader(sb, font, "Due This Month", "#2c3e50", "#eaf1fb");
                AppendTable(sb, font, dueThisMonth);
                sb.Append("</td></tr>");
            }

            // footer
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

        private static void AppendTable(StringBuilder sb, string font, List<Row> rows)
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

            for (int i = 0; i < rows.Count; i++)
            {
                var r = rows[i];
                var bg = (i % 2 == 0) ? "#ffffff" : "#f7f8fa";
                sb.Append("<tr style='background-color:" + bg + ";'>");
                AppendCell(sb, font, Enc(r.Name));
                AppendCell(sb, font, Enc(r.PlantName));
                AppendCell(sb, font, Enc(r.AgencyName));
                AppendCell(sb, font, Enc(r.FinancialYear));
                AppendCell(sb, font, r.NextDueDate.ToString("yyyy-MM-dd"));
                AppendCell(sb, font, Enc(string.IsNullOrWhiteSpace(r.ReviewerName) ? "-" : r.ReviewerName));
                sb.Append("</tr>");
            }
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
