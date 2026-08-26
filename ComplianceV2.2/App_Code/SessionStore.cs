using System;
using System.Security.Cryptography;

namespace ComplianceV2._2.App_Code
{
    public class SessionInfo
    {
        public string Token;  // external access.login_tokenpass.Token — the person's real identity
        public string Role;   // master | owner | reviewer — handed to us at login, never looked up
        public string FullName;
        public int PlantID;
        public int DeptID;
    }

    public static class SessionStore
    {
        public const int ExpiryMinutes = 30;

        public static string CreateSession(string token, string role)
        {
            var sessionId = NewToken();
            Db.Execute(
                "INSERT INTO local_sessions (session_id, token, role, expires_at) VALUES (@id,@tok,@role,@exp)",
                Db.P("@id", sessionId), Db.P("@tok", token), Db.P("@role", role),
                Db.P("@exp", DateTime.UtcNow.AddMinutes(ExpiryMinutes)));
            return sessionId;
        }

        public static SessionInfo Validate(string sessionId)
        {
            if (string.IsNullOrWhiteSpace(sessionId)) return null;

            var row = Db.QuerySingle(
                @"SELECT s.token, s.role, s.expires_at, p.Name AS full_name, p.PlantID, p.DeptID
                  FROM local_sessions s JOIN access.login_tokenpass p ON p.Token = s.token
                  WHERE s.session_id = @id",
                Db.P("@id", sessionId));

            if (row == null) return null;
            if ((DateTime)row["expires_at"] < DateTime.UtcNow) return null;

            return new SessionInfo
            {
                Token = (string)row["token"],
                Role = (string)row["role"],
                FullName = (string)row["full_name"],
                PlantID = Convert.ToInt32(row["PlantID"]),
                DeptID = Convert.ToInt32(row["DeptID"])
            };
        }

        private static string NewToken()
        {
            var bytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").Replace("=", "");
        }
    }
}
