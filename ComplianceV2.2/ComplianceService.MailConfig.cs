using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Services;
using ComplianceV2._2.App_Code;

namespace ComplianceV2._2
{
    public partial class ComplianceService
    {
        // Which group keys are valid under each automated mail type.
        private static readonly Dictionary<string, string[]> MailGroups = new Dictionary<string, string[]>
        {
            { "monday", new[] { "cc" } },
            { "reminders", new[] { "r1", "r2", "r3", "r4" } }
        };

        [WebMethod]
        public object GetMailConfig(string sessionId, int plantId)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);

            var rows = Db.Query(
                "SELECT mail_type, group_key, token, name, is_manual FROM mail_config_recipient WHERE plant_id=@p ORDER BY added_at",
                Db.P("@p", plantId));

            var result = new Dictionary<string, Dictionary<string, List<object>>>();
            foreach (var mailType in MailGroups.Keys)
            {
                result[mailType] = new Dictionary<string, List<object>>();
                foreach (var g in MailGroups[mailType]) result[mailType][g] = new List<object>();
            }
            foreach (var r in rows)
            {
                var mt = (string)r["mail_type"];
                var gk = (string)r["group_key"];
                if (!result.ContainsKey(mt) || !result[mt].ContainsKey(gk)) continue;
                result[mt][gk].Add(new { token = (string)r["token"], name = (string)r["name"], manual = Convert.ToBoolean(r["is_manual"]) });
            }
            return result;
        }

        // Directory search used by the mail-config recipient pickers - any app-allowed person, any plant.
        [WebMethod]
        public List<PersonDto> SearchMailPeople(string sessionId, string query)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);

            var q = (query ?? "").Trim();
            var rows = Db.Query(
                @"SELECT p.Token, p.Name FROM access.login_tokenpass p
                  JOIN access.login_tokenallowed a ON a.Token = p.Token AND a.LegalCompliance = 1
                  WHERE (@q = '' OR p.Name LIKE CONCAT('%',@q,'%') OR p.Token LIKE CONCAT('%',@q,'%'))
                  ORDER BY p.Name LIMIT 20",
                Db.P("@q", q));
            return rows.Select(r => new PersonDto { token = (string)r["Token"], name = (string)r["Name"] }).ToList();
        }

        // Replaces the full recipient list for one mail type + group in a single transaction, diffing
        // against what's currently saved so only the actual adds/removes get written to the log table.
        [WebMethod]
        public object SaveMailGroup(string sessionId, int plantId, string mailType, string groupKey, List<MailRecipientDto> recipients)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);

            if (!MailGroups.ContainsKey(mailType ?? "") || !MailGroups[mailType].Contains(groupKey ?? ""))
                throw new ArgumentException("Unknown mail type or group.");

            recipients = recipients ?? new List<MailRecipientDto>();
            foreach (var r in recipients)
                if (string.IsNullOrWhiteSpace(r.token)) throw new ArgumentException("Every recipient needs a token or email.");

            var existing = Db.Query(
                "SELECT token, name, is_manual FROM mail_config_recipient WHERE plant_id=@p AND mail_type=@mt AND group_key=@gk",
                Db.P("@p", plantId), Db.P("@mt", mailType), Db.P("@gk", groupKey));
            var existingTokens = new HashSet<string>(existing.Select(r => (string)r["token"]), StringComparer.OrdinalIgnoreCase);
            var newTokens = new HashSet<string>(recipients.Select(r => r.token), StringComparer.OrdinalIgnoreCase);

            var toAdd = recipients.Where(r => !existingTokens.Contains(r.token)).ToList();
            var toRemove = existing.Where(r => !newTokens.Contains((string)r["token"])).ToList();

            Db.Transact((conn, tx) =>
            {
                foreach (var r in toRemove)
                {
                    var token = (string)r["token"];
                    var name = (string)r["name"];
                    var manual = Convert.ToBoolean(r["is_manual"]);

                    Db.ExecuteTx(conn, tx, "DELETE FROM mail_config_recipient WHERE plant_id=@p AND mail_type=@mt AND group_key=@gk AND token=@tok",
                        Db.P("@p", plantId), Db.P("@mt", mailType), Db.P("@gk", groupKey), Db.P("@tok", token));

                    Db.ExecuteTx(conn, tx,
                        @"INSERT INTO mail_config_log (plant_id, mail_type, group_key, action, token, name, is_manual, performed_by)
                          VALUES (@p,@mt,@gk,'remove',@tok,@n,@m,@pb)",
                        Db.P("@p", plantId), Db.P("@mt", mailType), Db.P("@gk", groupKey), Db.P("@tok", token),
                        Db.P("@n", name), Db.P("@m", manual ? 1 : 0), Db.P("@pb", s.Token));
                }
                foreach (var r in toAdd)
                {
                    var name = string.IsNullOrWhiteSpace(r.name) ? r.token : r.name;

                    Db.ExecuteTx(conn, tx,
                        @"INSERT INTO mail_config_recipient (plant_id, mail_type, group_key, token, name, is_manual, added_by)
                          VALUES (@p,@mt,@gk,@tok,@n,@m,@ab)",
                        Db.P("@p", plantId), Db.P("@mt", mailType), Db.P("@gk", groupKey), Db.P("@tok", r.token),
                        Db.P("@n", name), Db.P("@m", r.manual ? 1 : 0), Db.P("@ab", s.Token));

                    Db.ExecuteTx(conn, tx,
                        @"INSERT INTO mail_config_log (plant_id, mail_type, group_key, action, token, name, is_manual, performed_by)
                          VALUES (@p,@mt,@gk,'add',@tok,@n,@m,@pb)",
                        Db.P("@p", plantId), Db.P("@mt", mailType), Db.P("@gk", groupKey), Db.P("@tok", r.token),
                        Db.P("@n", name), Db.P("@m", r.manual ? 1 : 0), Db.P("@pb", s.Token));
                }
            });

            Audit(s.Token, "SAVE_MAIL_GROUP", "mail_config", plantId, mailType + "/" + groupKey);
            return new { ok = true, added = toAdd.Count, removed = toRemove.Count };
        }

        [WebMethod]
        public List<object> GetMailConfigLogs(string sessionId, int plantId, string mailType)
        {
            var s = RequireSession(sessionId);
            RequireMaster(s);

            var rows = string.IsNullOrEmpty(mailType)
                ? Db.Query("SELECT mail_type, group_key, action, token, name, is_manual, performed_by, performed_at FROM mail_config_log WHERE plant_id=@p ORDER BY performed_at DESC LIMIT 100",
                    Db.P("@p", plantId))
                : Db.Query("SELECT mail_type, group_key, action, token, name, is_manual, performed_by, performed_at FROM mail_config_log WHERE plant_id=@p AND mail_type=@mt ORDER BY performed_at DESC LIMIT 100",
                    Db.P("@p", plantId), Db.P("@mt", mailType));

            return rows.Select(r => (object)new
            {
                mailType = (string)r["mail_type"],
                groupKey = (string)r["group_key"],
                action = (string)r["action"],
                token = (string)r["token"],
                name = (string)r["name"],
                manual = Convert.ToBoolean(r["is_manual"]),
                performedBy = (string)r["performed_by"],
                performedAt = ((DateTime)r["performed_at"]).ToString("yyyy-MM-dd HH:mm")
            }).ToList();
        }
    }
}
