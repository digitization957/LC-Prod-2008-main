using System;

namespace ComplianceV2._2.App_Code
{
    // Mirrors docs/03-UIUX-Implementation-Spec.md §9 exactly — same formulas, server-side (source of truth).
    public static class BizLogic
    {
        // "Other" stays last by design - it's the catch-all, shown at the bottom of the picker.
        // "As and When" is NOT a category - it's a frequency (see AsAndWhenUnit below), independent of category.
        public static readonly string[] Categories =
        {
            "Return", "Inspection", "Compliance", "Renewal", "Reporting", "Submission", "NOC",
            "Approval", "BG Training", "Permission", "License", "Test Certification", "Tax", "Incurrence",
            "Other"
        };

        public static bool IsValidCategory(string category) => Array.IndexOf(Categories, category) >= 0;

        // A frequency_unit value meaning "no fixed frequency" - the owner picks the next due date
        // themselves at every fulfilment, instead of it being computed from a number+unit interval.
        // "Return" can't use it: Return's filing-window cutoff is computed from a real interval.
        public const string AsAndWhenUnit = "as_and_when";

        public static string ComputeStatus(DateTime nextDue, DateTime today)
        {
            if (nextDue.Date < today.Date) return "overdue";
            if (nextDue.Year == today.Year && nextDue.Month == today.Month) return "due";
            return "compliant";
        }

        public static DateTime AddInterval(DateTime from, int num, string unit)
        {
            switch (unit)
            {
                case "day": return from.AddDays(num);
                case "week": return from.AddDays(num * 7);
                case "month": return from.AddMonths(num);
                case "year": return from.AddYears(num);
                default: throw new ArgumentException("Invalid frequency unit");
            }
        }

        // Single source of truth for "what's the next due date" - used by both MarkComplete (the actual
        // save) and PreviewNextDue (the live UI preview), so the two can never silently disagree.
        // Return is a fixed cycle anchored to the old due date; every other category rolls forward from
        // whenever it's actually done. Caller still owns the AsAndWhen case (no computation - manual entry).
        public static DateTime ComputeNextDue(string category, string freqUnit, int freqNum, DateTime currentDue, DateTime actionDate)
        {
            return category == "Return" ? AddInterval(currentDue, freqNum, freqUnit) : AddInterval(actionDate, freqNum, freqUnit);
        }

        // Indian financial year (Apr-Mar), labeled by its ending year: Apr 2025-Mar 2026 = "F26".
        public static string FyOf(DateTime d)
        {
            int endYear = d.Month >= 4 ? d.Year + 1 : d.Year;
            return $"F{endYear % 100:D2}";
        }
    }
}
