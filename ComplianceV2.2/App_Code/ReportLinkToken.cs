using System;
using System.Configuration;
using System.Security.Cryptography;
using System.Text;

namespace ComplianceV2._2.App_Code
{
    // Signs the log_id + expiry into an opaque, tamper-proof token for the "View Detailed Report"
    // email link. Whether it's still redeemable (unused, unexpired) is checked separately against
    // compliance_logs.report_link_used_at - the signature alone only proves it wasn't forged.
    public static class ReportLinkToken
    {
        public static string Create(int logId, TimeSpan validFor)
        {
            var expiry = DateTimeOffset.UtcNow.Add(validFor).ToUnixTimeSeconds();
            var payload = logId + "." + expiry;
            return B64(Encoding.UTF8.GetBytes(payload)) + "." + B64(Sign(payload));
        }

        public static bool TryParse(string token, out int logId, out bool expired)
        {
            logId = 0;
            expired = false;
            if (string.IsNullOrEmpty(token)) return false;

            var parts = token.Split('.');
            if (parts.Length != 2) return false;

            byte[] payloadBytes, sigBytes;
            try { payloadBytes = UnB64(parts[0]); sigBytes = UnB64(parts[1]); }
            catch { return false; }

            var payload = Encoding.UTF8.GetString(payloadBytes);
            if (!FixedTimeEquals(sigBytes, Sign(payload))) return false;

            var segs = payload.Split('.');
            if (segs.Length != 2) return false;
            if (!int.TryParse(segs[0], out logId)) return false;
            if (!long.TryParse(segs[1], out long expiry)) return false;

            expired = DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expiry;
            return true;
        }

        private static byte[] Sign(string payload)
        {
            var key = ConfigurationManager.AppSettings["ReportLinkKey"];
            using (var h = new HMACSHA256(Encoding.UTF8.GetBytes(key)))
                return h.ComputeHash(Encoding.UTF8.GetBytes(payload));
        }

        private static bool FixedTimeEquals(byte[] a, byte[] b)
        {
            if (a.Length != b.Length) return false;
            int diff = 0;
            for (int i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
            return diff == 0;
        }

        private static string B64(byte[] b) => Convert.ToBase64String(b).Replace("+", "-").Replace("/", "_").Replace("=", "");
        private static byte[] UnB64(string s)
        {
            s = s.Replace("-", "+").Replace("_", "/");
            switch (s.Length % 4) { case 2: s += "=="; break; case 3: s += "="; break; }
            return Convert.FromBase64String(s);
        }
    }
}
