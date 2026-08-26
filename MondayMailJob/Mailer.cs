using System;
using System.Collections.Generic;
using System.Configuration;
using System.Net;
using System.Net.Mail;

namespace MondayMailJob
{
    // SMTP credentials come from access.ngpdigital (mail, Password, SmtpServer, SmtpPort) -
    // same shared mailbox ComplianceV2.2/App_Code/Mailer.cs uses. Unlike MonthlyMailJob (one owner
    // per mail) this sends to multiple To recipients (all owners+reviewers of a plant) plus CC.
    public static class Mailer
    {
        public static bool TrySend(IEnumerable<string> toEmails, IEnumerable<string> ccEmails, string subject, string htmlBody, out string error)
        {
            error = null;
            var cred = Db.QuerySingle("SELECT mail, Password, SmtpServer, SmtpPort FROM access.ngpdigital LIMIT 1");
            if (cred == null) { error = "SMTP not configured (access.ngpdigital is empty)."; return false; }

            try
            {
                var host = (string)cred["SmtpServer"];
                var port = Convert.ToInt32(cred["SmtpPort"]);
                var user = (string)cred["mail"];
                var pass = (string)cred["Password"];
                var enableSsl = (ConfigurationManager.AppSettings["SmtpEnableSsl"] ?? "true") == "true";

                using (var client = new SmtpClient(host, port) { EnableSsl = enableSsl, Credentials = new NetworkCredential(user, pass) })
                using (var msg = new MailMessage { From = new MailAddress(user), Subject = subject, Body = htmlBody, IsBodyHtml = true })
                {
                    if (toEmails != null)
                        foreach (var to in toEmails)
                            if (!string.IsNullOrWhiteSpace(to)) msg.To.Add(to);
                    if (msg.To.Count == 0) { error = "No recipients."; return false; }

                    if (ccEmails != null)
                        foreach (var cc in ccEmails)
                            if (!string.IsNullOrWhiteSpace(cc)) msg.CC.Add(cc);

                    client.Send(msg);
                }
                return true;
            }
            catch (Exception ex)
            {
                error = ex.Message;
                return false;
            }
        }
    }
}
