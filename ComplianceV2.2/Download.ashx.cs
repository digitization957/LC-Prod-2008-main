using System;
using System.IO;
using System.Web;
using ComplianceV2._2.App_Code;

namespace ComplianceV2._2
{
    public class Download : IHttpHandler
    {
        public void ProcessRequest(HttpContext ctx)
        {
            var sessionId = SessionCookie.Resolve(ctx.Request);
            var fileToken = ctx.Request.QueryString["file"];
            if (!int.TryParse(ctx.Request.QueryString["complianceId"], out int complianceId))
            {
                ctx.Response.StatusCode = 400; return;
            }

            var session = SessionStore.Validate(sessionId);
            if (session == null) { ctx.Response.StatusCode = 401; return; }

            var c = Db.QuerySingle("SELECT owner_token, reviewer_token FROM compliances WHERE compliance_id=@id AND is_active=1", Db.P("@id", complianceId));
            if (c == null) { ctx.Response.StatusCode = 404; return; }

            string ownerToken = (string)c["owner_token"];
            string reviewerToken = c["reviewer_token"] as string;
            bool accessible = session.Role == "master" || (session.Role == "owner" && ownerToken == session.Token)
                               || (session.Role == "reviewer" && reviewerToken != null && reviewerToken == session.Token);
            if (!accessible) { ctx.Response.StatusCode = 403; return; }

            var att = Db.QuerySingle("SELECT file_name, file_url FROM compliance_attachments WHERE compliance_id=@c AND file_url=@f",
                Db.P("@c", complianceId), Db.P("@f", fileToken));
            if (att == null) { ctx.Response.StatusCode = 404; return; }

            // file_url is always a bare GUID+extension we generated at upload time — GetFileName strips any path segments defensively.
            var storedName = Path.GetFileName((string)att["file_url"]);
            var uploadsDir = ctx.Server.MapPath("~/App_Data/Uploads");
            if (!Directory.Exists(uploadsDir)) Directory.CreateDirectory(uploadsDir);
            var fullPath = Path.Combine(uploadsDir, storedName);
            if (!File.Exists(fullPath)) { ctx.Response.StatusCode = 404; return; }

            var ext = Path.GetExtension(storedName).ToLowerInvariant();
            ctx.Response.ContentType = ext == ".pdf" ? "application/pdf" : ext == ".png" ? "image/png" : "image/jpeg";
            var disposition = ctx.Request.QueryString["mode"] == "preview" ? "inline" : "attachment";
            ctx.Response.AddHeader("Content-Disposition", disposition + "; filename=\"" + Uri.EscapeDataString((string)att["file_name"]) + "\"");
            FileCrypto.DecryptToStream(fullPath, ctx.Response.OutputStream);
        }

        public bool IsReusable => false;
    }
}
