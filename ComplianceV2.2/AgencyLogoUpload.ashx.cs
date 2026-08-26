using System;
using System.IO;
using System.Web;
using ComplianceV2._2.App_Code;

namespace ComplianceV2._2
{
    // Master-only. Not a [WebMethod] because JSON can't carry binary file bodies (same reasoning as Upload.ashx).
    public class AgencyLogoUpload : IHttpHandler
    {
        private const long MaxBytes = 2 * 1024 * 1024; // 2MB - logos only

        public void ProcessRequest(HttpContext ctx)
        {
            ctx.Response.ContentType = "application/json";
            try
            {
                var sessionId = ctx.Request.Form["sessionId"];
                var agencyIdRaw = ctx.Request.Form["agencyId"];
                var session = SessionStore.Validate(sessionId);
                if (session == null) throw new UnauthorizedAccessException("Session expired.");
                if (session.Role != "master") throw new UnauthorizedAccessException("Master role required.");
                if (!int.TryParse(agencyIdRaw, out int agencyId)) throw new ArgumentException("Invalid agency id.");

                var agency = Db.QuerySingle("SELECT agency_id FROM agencies WHERE agency_id=@id AND is_active=1", Db.P("@id", agencyId));
                if (agency == null) throw new ArgumentException("Agency not found.");

                var file = ctx.Request.Files["file"];
                if (file == null || file.ContentLength == 0) throw new ArgumentException("No file uploaded.");
                if (file.ContentLength > MaxBytes) throw new ArgumentException("File exceeds 2MB limit.");
                if (!IsPng(file)) throw new ArgumentException("Only PNG files are allowed.");

                var dir = ctx.Server.MapPath("~/App_Data/AgencyLogos");
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

                var storedName = Guid.NewGuid().ToString("N") + ".png";
                var fullPath = Path.Combine(dir, storedName);
                FileCrypto.EncryptToFile(file.InputStream, fullPath);

                var existing = Db.QuerySingle("SELECT logo_path FROM agency_logos WHERE agency_id=@id", Db.P("@id", agencyId));
                Db.Execute(
                    @"INSERT INTO agency_logos (agency_id, logo_path, uploaded_by) VALUES (@id,@p,@u)
                      ON DUPLICATE KEY UPDATE logo_path=@p, uploaded_by=@u, updated_at=CURRENT_TIMESTAMP",
                    Db.P("@id", agencyId), Db.P("@p", storedName), Db.P("@u", session.Token));

                if (existing != null)
                {
                    try
                    {
                        var oldPath = Path.Combine(dir, Path.GetFileName((string)existing["logo_path"]));
                        if (oldPath != fullPath && File.Exists(oldPath)) File.Delete(oldPath);
                    }
                    catch { }
                }

                Db.Execute("INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES (@u,@a,@t,@e,@d)",
                    Db.P("@u", session.Token), Db.P("@a", "SET_AGENCY_LOGO"), Db.P("@t", "agency"), Db.P("@e", agencyId), Db.P("@d", DBNull.Value));

                ctx.Response.Write(Json.Ok(new { agencyId = agencyId }));
            }
            catch (UnauthorizedAccessException ex)
            {
                ctx.Response.StatusCode = 403;
                ctx.Response.Write(Json.Err(ex.Message));
            }
            catch (Exception ex)
            {
                ctx.Response.StatusCode = 400;
                ctx.Response.Write(Json.Err(ex.Message));
            }
        }

        // Validates magic bytes match a real PNG - extension alone can be spoofed.
        private static bool IsPng(HttpPostedFile file)
        {
            var header = new byte[8];
            var s = file.InputStream;
            s.Position = 0;
            s.Read(header, 0, 8);
            s.Position = 0;
            return header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47;
        }

        public bool IsReusable => false;
    }
}
