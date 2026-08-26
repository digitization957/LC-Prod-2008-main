using System.Collections.Generic;

namespace ComplianceV2._2.App_Code
{
    // JavaScriptSerializer (used by [ScriptService] JSON) only picks up public properties, not fields — keep these as properties.
    public class PlantDto
    {
        public int plantId { get; set; }
        public string name { get; set; }
        public string code { get; set; }
        public string location { get; set; }
        public bool accessible { get; set; }
        public int overdue { get; set; }
        public int due { get; set; }
        public int compliant { get; set; }
    }

    public class AgencyDto
    {
        public int agencyId { get; set; }
        public string name { get; set; }
        public string description { get; set; }
        public bool accessible { get; set; }
        public int overdue { get; set; }
        public int due { get; set; }
        public int compliant { get; set; }
        public bool hasLogo { get; set; }
    }

    public class ComplianceRowDto
    {
        public int complianceId { get; set; }
        public string name { get; set; }
        public string category { get; set; }
        public string ownerName { get; set; }
        public string reviewerName { get; set; }
        public string department { get; set; }
        public string nextDueDate { get; set; }
        public string status { get; set; }
        public string financialYear { get; set; }
        public bool accessible { get; set; }
    }

    public class LogDto
    {
        public int logId { get; set; }
        public string actionDate { get; set; }
        public string doneBy { get; set; }
        public string remarks { get; set; }
        public bool canRevert { get; set; }
        public List<AttachmentDto> attachments { get; set; } = new List<AttachmentDto>();
    }

    public class AttachmentDto
    {
        public string fileName { get; set; }
        public string fileUrl { get; set; }
    }

    public class ReminderDto
    {
        public string label { get; set; }
        public int daysBeforeDue { get; set; }
        public string recipientToken { get; set; }
        public string recipientName { get; set; }
    }

    public class ComplianceDetailDto
    {
        public int complianceId { get; set; }
        public string name { get; set; }
        public string category { get; set; }
        public string description { get; set; }
        public int plantId { get; set; }
        public string plantName { get; set; }
        public int agencyId { get; set; }
        public string agencyName { get; set; }
        public int deptId { get; set; }
        public string department { get; set; }
        public string ownerToken { get; set; }
        public string ownerName { get; set; }
        public string reviewerToken { get; set; }
        public string reviewerName { get; set; }
        public int frequencyNumber { get; set; }
        public string frequencyUnit { get; set; }
        public string startDate { get; set; }
        public string nextDueDate { get; set; }
        public string financialYear { get; set; }
        public string status { get; set; }
        public bool canEdit { get; set; }
        public bool canFulfill { get; set; }
        public bool isReviewer { get; set; }
        public List<LogDto> logs { get; set; } = new List<LogDto>();
        public List<ReminderDto> reminders { get; set; } = new List<ReminderDto>();
    }

    public class NotificationItemDto
    {
        public int complianceId { get; set; }
        public string name { get; set; }
        public string plantName { get; set; }
        public string agencyName { get; set; }
        public string dueDate { get; set; }
        public string type { get; set; }
    }

    public class ComplianceInput
    {
        public int agencyId { get; set; }
        public int plantId { get; set; }
        public string name { get; set; }
        public string category { get; set; }
        public string description { get; set; }
        public string ownerToken { get; set; }
        public string reviewerToken { get; set; }
        public string startDate { get; set; }
        public int frequencyNumber { get; set; }
        public string frequencyUnit { get; set; }
    }

    public class DeptDto
    {
        public int deptId { get; set; }
        public string name { get; set; }
    }

    public class PersonDto
    {
        public string token { get; set; }
        public string name { get; set; }
    }

    public class PeoplePickerDto
    {
        public List<PersonDto> owners { get; set; } = new List<PersonDto>();
        public List<PersonDto> reviewers { get; set; } = new List<PersonDto>();
    }

    public class MailRecipientDto
    {
        public string token { get; set; }
        public string name { get; set; }
        public bool manual { get; set; }
    }

    public class ReminderInput
    {
        public string label { get; set; }
        public int daysBeforeDue { get; set; }
    }

    public class AttachmentInput
    {
        public string fileName { get; set; }
        public string fileUrl { get; set; }
    }

    // ---------- Summary / Report ----------

    public class PlantSummaryDto
    {
        public string plantName { get; set; }
        public int total { get; set; }
        public int overdue { get; set; }
        public int due { get; set; }
        public int compliant { get; set; }
        public double complianceRate { get; set; }
    }

    public class OwnerSummaryDto
    {
        public string ownerName { get; set; }
        public string deptName { get; set; }
        public int complied { get; set; }
        public int nonComplied { get; set; }
        public int total { get; set; }
    }

    public class ScheduleItemDto
    {
        public int complianceId { get; set; }
        public string name { get; set; }
        public string plantName { get; set; }
        public int agencyId { get; set; }
        public string agencyName { get; set; }
        public string financialYear { get; set; }
        public string dueDate { get; set; }
        public string status { get; set; }
    }

    public class ComplianceStatusRowDto
    {
        public int complianceId { get; set; }
        public string complianceName { get; set; }
        public string agencyName { get; set; }
        public string ownerToken { get; set; }
        public string ownerName { get; set; }
        public string deptName { get; set; }
        public string status { get; set; }
        public string dueDate { get; set; }
        public string doneDate { get; set; }
        public int? gapDays { get; set; }
        public string financialYear { get; set; }
    }

    public class SummaryItemDto
    {
        public int complianceId { get; set; }
        public string name { get; set; }
        public string plantName { get; set; }
        public string agencyName { get; set; }
        public string ownerName { get; set; }
        public string nextDueDate { get; set; }
        public int daysOverdue { get; set; }
    }

    public class ActivityItemDto
    {
        public string actionDate { get; set; }
        public string complianceName { get; set; }
        public string plantName { get; set; }
        public string agencyName { get; set; }
        public string doneBy { get; set; }
        public string remarks { get; set; }
    }

    public class SummaryReportDto
    {
        public int total { get; set; }
        public int overdue { get; set; }
        public int due { get; set; }
        public int compliant { get; set; }
        public double complianceRate { get; set; }
        public List<PlantSummaryDto> byPlant { get; set; } = new List<PlantSummaryDto>();
        public List<OwnerSummaryDto> ownerSummary { get; set; } = new List<OwnerSummaryDto>();
        public List<ComplianceStatusRowDto> complianceDetails { get; set; } = new List<ComplianceStatusRowDto>();
        public List<SummaryItemDto> overdueList { get; set; } = new List<SummaryItemDto>();
        public List<SummaryItemDto> upcomingList { get; set; } = new List<SummaryItemDto>();
        public List<ActivityItemDto> recentActivity { get; set; } = new List<ActivityItemDto>();
    }
}
