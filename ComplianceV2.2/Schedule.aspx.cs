using System;
using System.Web.UI;
using ComplianceV2._2.App_Code;

namespace ComplianceV2._2
{
    public partial class Schedule : Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            var sessionId = SessionCookie.Resolve(Request);
            if (SessionStore.Validate(sessionId) == null) Response.Redirect("Default.aspx");
        }
    }
}
