using System;
using System.IO;
using System.Web.Services;
using ComplianceV2._2.App_Code;

namespace ComplianceV2._2
{
    public partial class ComplianceService
    {
        // Upload itself happens via AgencyLogoUpload.ashx (binary, can't go through [WebMethod]/JSON).
        // This only covers removing a logo so the agency falls back to the app's default icon.
        [WebMethod]
        public object RemoveAgencyLogo(string sessionId, int agencyId)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);

            var row = Db.QuerySingle("SELECT logo_path FROM agency_logos WHERE agency_id=@id", Db.P("@id", agencyId));
            if (row == null) return new { ok = true };

            Db.Execute("DELETE FROM agency_logos WHERE agency_id=@id", Db.P("@id", agencyId));

            try
            {
                var dir = System.Web.HttpContext.Current.Server.MapPath("~/App_Data/AgencyLogos");
                var path = Path.Combine(dir, Path.GetFileName((string)row["logo_path"]));
                if (File.Exists(path)) File.Delete(path);
            }
            catch { }

            Audit(s.Token, "REMOVE_AGENCY_LOGO", "agency", agencyId, null);
            return new { ok = true };
        }
    }
}
