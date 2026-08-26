using System;
using System.Collections.Generic;
using System.Web;
using System.Web.Script.Services;
using System.Web.Services;
using ComplianceV2._2.App_Code;

namespace ComplianceV2._2
{
    // Split into partial files by area: this file holds only the WebService declaration and the
    // helpers shared across all of them. See ComplianceService.Auth.cs, .Lookups.cs, .Compliances.cs,
    // .Fulfilment.cs and .Reports.cs for the actual [WebMethod]s.
    [WebService(Namespace = "http://compliance.local/")]
    [WebServiceBinding(ConformsTo = WsiProfiles.BasicProfile1_1)]
    [ScriptService]
    public partial class ComplianceService : System.Web.Services.WebService
    {
        // sessionId normally arrives in the POST body (never logged in a URL). Falls back to the
        // HttpOnly cookie so callers that stop sending it explicitly keep working unchanged.
        private SessionInfo RequireSession(string sessionId)
        {
            var resolved = string.IsNullOrEmpty(sessionId) ? SessionCookie.Resolve(HttpContext.Current.Request) : sessionId;
            var s = SessionStore.Validate(resolved);
            if (s == null) throw new UnauthorizedAccessException("Session expired or invalid. Please sign in again.");
            return s;
        }

        private void RequireMaster(SessionInfo s)
        {
            if (s.Role != "master") throw new UnauthorizedAccessException("Master role required.");
        }

        // ---------- Access helpers ----------

        private List<Dictionary<string, object>> ScopedCompliances(SessionInfo s)
        {
            if (s.Role == "master") return Db.Query("SELECT compliance_id, plant_id, agency_id, owner_token, reviewer_token, next_due_date FROM compliances WHERE is_active=1");
            var field = s.Role == "owner" ? "owner_token" : "reviewer_token";
            return Db.Query($"SELECT compliance_id, plant_id, agency_id, owner_token, reviewer_token, next_due_date FROM compliances WHERE is_active=1 AND {field}=@tok", Db.P("@tok", s.Token));
        }

        private bool IsAccessible(SessionInfo s, string ownerToken, string reviewerToken)
        {
            if (s.Role == "master") return true;
            if (s.Role == "owner") return ownerToken == s.Token;
            if (s.Role == "reviewer") return reviewerToken != null && reviewerToken == s.Token;
            return false;
        }

        // ---------- Audit ----------

        private void Audit(string userToken, string action, string entityType, int entityId, string detailsJson)
        {
            Db.Execute("INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES (@u,@a,@t,@e,@d)",
                Db.P("@u", userToken), Db.P("@a", action), Db.P("@t", entityType), Db.P("@e", entityId), Db.P("@d", (object)detailsJson ?? DBNull.Value));
        }
    }
}
