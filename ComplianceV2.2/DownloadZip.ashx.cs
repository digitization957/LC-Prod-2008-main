using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Web;
using ComplianceV2._2.App_Code;

namespace ComplianceV2._2
{
    public class DownloadZip : IHttpHandler
    {
        public void ProcessRequest(HttpContext ctx)
        {
            var sessionId = SessionCookie.Resolve(ctx.Request);
            if (!int.TryParse(ctx.Request.QueryString["logId"], out int logId))
            {
                ctx.Response.StatusCode = 400; return;
            }

            var session = SessionStore.Validate(sessionId);
            if (session == null) { ctx.Response.StatusCode = 401; return; }

            var log = Db.QuerySingle(
                @"SELECT c.compliance_id, c.owner_token, c.reviewer_token, c.name AS compliance_name, l.action_date
                  FROM compliance_logs l JOIN compliances c ON c.compliance_id = l.compliance_id
                  WHERE l.log_id=@lid", Db.P("@lid", logId));
            if (log == null) { ctx.Response.StatusCode = 404; return; }

            string ownerToken = (string)log["owner_token"];
            string reviewerToken = log["reviewer_token"] as string;
            bool accessible = session.Role == "master" || (session.Role == "owner" && ownerToken == session.Token)
                               || (session.Role == "reviewer" && reviewerToken != null && reviewerToken == session.Token);
            if (!accessible) { ctx.Response.StatusCode = 403; return; }

            var atts = Db.Query("SELECT file_name, file_url FROM compliance_attachments WHERE log_id=@lid", Db.P("@lid", logId));
            if (atts.Count == 0) { ctx.Response.StatusCode = 404; return; }

            var uploadsDir = ctx.Server.MapPath("~/App_Data/Uploads");
            using (var mem = new MemoryStream())
            {
                using (var zip = new ZipArchive(mem, ZipArchiveMode.Create, true))
                {
                    var usedNames = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    foreach (var att in atts)
                    {
                        var storedName = Path.GetFileName((string)att["file_url"]);
                        var fullPath = Path.Combine(uploadsDir, storedName);
                        if (!File.Exists(fullPath)) continue;

                        var entryName = (string)att["file_name"];
                        var baseName = Path.GetFileNameWithoutExtension(entryName);
                        var ext = Path.GetExtension(entryName);
                        var n = 1;
                        while (!usedNames.Add(entryName)) entryName = baseName + " (" + (++n) + ")" + ext;

                        var entry = zip.CreateEntry(entryName, CompressionLevel.Fastest);
                        using (var entryStream = entry.Open())
                            FileCrypto.DecryptToStream(fullPath, entryStream);
                    }
                }

                var loggedDate = ((DateTime)log["action_date"]).ToString("yyyy-MM-dd");
                var complianceName = (string)log["compliance_name"];
                var zipName = SanitizeFileName(complianceName + " - " + loggedDate) + ".zip";

                var bytes = mem.ToArray();
                ctx.Response.ContentType = "application/zip";
                ctx.Response.AddHeader("Content-Disposition", "attachment; filename=\"" + zipName + "\"");
                ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
            }
        }

        private static string SanitizeFileName(string name)
        {
            var invalid = Path.GetInvalidFileNameChars();
            var clean = new string(name.Where(c => Array.IndexOf(invalid, c) < 0 && c != '"').ToArray()).Trim();
            return string.IsNullOrEmpty(clean) ? "fulfillment" : clean;
        }

        public bool IsReusable => false;
    }
}
