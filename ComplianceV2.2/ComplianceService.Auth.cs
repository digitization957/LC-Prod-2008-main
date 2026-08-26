using System;
using System.Text;
using System.Web.Services;
using ComplianceV2._2.App_Code;

namespace ComplianceV2._2
{
    public partial class ComplianceService
    {
        // ---------- Auth ----------
        // Identity, plant and department all come from the external access/plant_master tables —
        // token + role arrive on Default.aspx's querystring from the real SSO redirect (base64-encoded,
        // handled by SsoLogin below). DevLogin simulates the same outcome for local dev, gated by
        // DevAuthEnabled, without the base64 layer.

        [WebMethod]
        public object DevLogin(string token, string role)
        {
            if (System.Configuration.ConfigurationManager.AppSettings["DevAuthEnabled"] != "true")
                throw new InvalidOperationException("Dev auth is disabled.");
            return CreateSessionForRole(token, role);
        }

        // Real SSO redirect: Default.aspx?token=<base64>&role=<base64>&method=access. method isn't
        // load-bearing here - always "access" for this flow, so it's not validated.
        [WebMethod]
        public object SsoLogin(string token, string role)
        {
            string decodedToken, decodedRole;
            try
            {
                decodedToken = Encoding.UTF8.GetString(Convert.FromBase64String(token)).Trim();
                decodedRole = Encoding.UTF8.GetString(Convert.FromBase64String(role)).Trim();
            }
            catch (FormatException)
            {
                throw new ArgumentException("Invalid login link.");
            }
            return CreateSessionForRole(decodedToken, decodedRole);
        }

        // New SSO redirect: Default.aspx?jwt=<base64 of "EmpCode|Name|Role|...|sig">. EmpCode is the token,
        // Role is field index 2; other fields aren't used here.
        [WebMethod]
        public object SsoLoginJwt(string jwt)
        {
            string decoded;
            try
            {
                decoded = Encoding.UTF8.GetString(Convert.FromBase64String(jwt));
            }
            catch (FormatException)
            {
                throw new ArgumentException("Invalid login link.");
            }
            var parts = decoded.Split('|');
            if (parts.Length < 3) throw new ArgumentException("Invalid login link.");
            return CreateSessionForRole(parts[0].Trim(), parts[2].Trim());
        }

        private object CreateSessionForRole(string token, string role)
        {
            role = (role ?? "").ToLowerInvariant();
            if (role != "master" && role != "owner" && role != "reviewer")
                throw new ArgumentException("Invalid role.");

            var allowed = Db.QuerySingle("SELECT LegalCompliance FROM access.login_tokenallowed WHERE Token=@t", Db.P("@t", token));
            if (allowed == null || Convert.ToInt32(allowed["LegalCompliance"]) != 1)
                throw new ArgumentException("This person is not permitted to use this app.");

            var person = Db.QuerySingle(
                @"SELECT p.Name, pl.Plant_Name, d.Dept_Name FROM access.login_tokenpass p
                  JOIN plant_master.tbl_plant pl ON pl.Plant_ID = p.PlantID
                  LEFT JOIN plant_master.tbl_dept d ON d.Plant_ID = p.PlantID AND d.Dept_ID = p.DeptID
                  WHERE p.Token=@t", Db.P("@t", token));
            if (person == null) throw new ArgumentException("Unknown token.");

            var sessionId = SessionStore.CreateSession(token, role);
            SessionCookie.Set(System.Web.HttpContext.Current, sessionId);
            return new { sessionId, role, fullName = (string)person["Name"], plantName = (string)person["Plant_Name"], deptName = person["Dept_Name"] as string };
        }

        [WebMethod]
        public object ValidateSession(string sessionId)
        {
            var s = SessionStore.Validate(sessionId);
            if (s == null) return new { valid = false };
            var pd = Db.QuerySingle(
                @"SELECT pl.Plant_Name, d.Dept_Name FROM plant_master.tbl_plant pl
                  LEFT JOIN plant_master.tbl_dept d ON d.Plant_ID = pl.Plant_ID AND d.Dept_ID = @dept
                  WHERE pl.Plant_ID=@plant", Db.P("@plant", s.PlantID), Db.P("@dept", s.DeptID));
            return new { valid = true, role = s.Role, fullName = s.FullName, plantName = pd?["Plant_Name"] as string, deptName = pd?["Dept_Name"] as string };
        }

        // ---------- Redeem "View Detailed Report" email link ----------
        // Single-use, signed, no session required to call. Success logs the reviewer straight in
        // (no sign-in screen) and hands back a normal session. A used/expired/invalid link never
        // throws for the expected cases - it returns ok:false with a reason so the client can fall
        // back to the ordinary sign-in screen (still routed to the right compliance where possible).
        [WebMethod]
        public object RedeemReportLink(string token)
        {
            if (!ReportLinkToken.TryParse(token, out int logId, out bool expired))
                return new { ok = false, reason = "invalid", complianceId = (int?)null };

            var log = Db.QuerySingle(
                @"SELECT l.log_id, l.compliance_id, l.report_link_used_at, c.reviewer_token
                  FROM compliance_logs l JOIN compliances c ON c.compliance_id = l.compliance_id
                  WHERE l.log_id=@lid", Db.P("@lid", logId));
            if (log == null) return new { ok = false, reason = "invalid", complianceId = (int?)null };

            int complianceId = Convert.ToInt32(log["compliance_id"]);
            string reviewerToken = log["reviewer_token"] as string;

            if (expired) return new { ok = false, reason = "expired", complianceId };
            if (log["report_link_used_at"] != null) return new { ok = false, reason = "used", complianceId };
            if (reviewerToken == null) return new { ok = false, reason = "invalid", complianceId = (int?)null };

            int claimed = Db.ExecuteRows(
                "UPDATE compliance_logs SET report_link_used_at=@now WHERE log_id=@lid AND report_link_used_at IS NULL",
                Db.P("@now", DateTime.UtcNow), Db.P("@lid", logId));
            if (claimed == 0) return new { ok = false, reason = "used", complianceId };

            var person = Db.QuerySingle(
                @"SELECT p.Name, pl.Plant_Name, d.Dept_Name FROM access.login_tokenpass p
                  JOIN plant_master.tbl_plant pl ON pl.Plant_ID = p.PlantID
                  LEFT JOIN plant_master.tbl_dept d ON d.Plant_ID = p.PlantID AND d.Dept_ID = p.DeptID
                  WHERE p.Token=@t", Db.P("@t", reviewerToken));
            if (person == null) return new { ok = false, reason = "invalid", complianceId = (int?)null };

            var sessionId = SessionStore.CreateSession(reviewerToken, "reviewer");
            SessionCookie.Set(System.Web.HttpContext.Current, sessionId);
            Audit(reviewerToken, "REDEEM_REPORT_LINK", "compliance", complianceId, null);
            return new
            {
                ok = true, sessionId, complianceId,
                fullName = (string)person["Name"], plantName = (string)person["Plant_Name"], deptName = person["Dept_Name"] as string
            };
        }
    }
}
