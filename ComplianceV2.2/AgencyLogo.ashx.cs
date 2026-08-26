using System;
using System.IO;
using System.Web;
using ComplianceV2._2.App_Code;

namespace ComplianceV2._2
{
    // Serves a set agency logo to any authenticated role (master/owner/reviewer all see the same
    // branding). Never exposes a raw file path - always looked up by agencyId through the DB.
    public class AgencyLogo : IHttpHandler
    {
        public void ProcessRequest(HttpContext ctx)
        {
            var sessionId = SessionCookie.Resolve(ctx.Request);
            var session = SessionStore.Validate(sessionId);
            if (session == null) { ctx.Response.StatusCode = 401; return; }

            if (!int.TryParse(ctx.Request.QueryString["agencyId"], out int agencyId)) { ctx.Response.StatusCode = 400; return; }

            var row = Db.QuerySingle("SELECT logo_path FROM agency_logos WHERE agency_id=@id", Db.P("@id", agencyId));
            if (row == null) { ctx.Response.StatusCode = 404; return; }

            var storedName = Path.GetFileName((string)row["logo_path"]);
            var dir = ctx.Server.MapPath("~/App_Data/AgencyLogos");
            var fullPath = Path.Combine(dir, storedName);
            if (!File.Exists(fullPath)) { ctx.Response.StatusCode = 404; return; }

            ctx.Response.ContentType = "image/png";
            ctx.Response.Cache.SetCacheability(HttpCacheability.Private);
            FileCrypto.DecryptToStream(fullPath, ctx.Response.OutputStream);
        }

        public bool IsReusable => false;
    }
}
