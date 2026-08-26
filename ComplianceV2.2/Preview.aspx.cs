using System;
using System.Web.UI;

namespace ComplianceV2._2
{
    // File preview for one fulfilment log, opened from the "Files" chip in the fulfilment history
    // (Default.aspx, Reports.aspx, ReportView.aspx). No navbar links elsewhere - access checks
    // happen entirely client-side (preview.js) against GetLogFiles' own authorization.
    public partial class Preview : Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
        }
    }
}
