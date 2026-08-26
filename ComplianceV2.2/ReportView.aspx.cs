using System;
using System.Web.UI;

namespace ComplianceV2._2
{
    // Confined single-compliance report, reached from the "View Detailed Report" link in the
    // fulfilment email. Deliberately has no navbar links elsewhere - login and access checks
    // happen entirely client-side (reportview.js) against GetComplianceDetail's own authorization.
    public partial class ReportView : Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
        }
    }
}
