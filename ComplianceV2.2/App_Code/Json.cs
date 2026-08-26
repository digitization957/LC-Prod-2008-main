using Newtonsoft.Json;

namespace ComplianceV2._2.App_Code
{
    public static class Json
    {
        public static string Ok(object data) => JsonConvert.SerializeObject(new { ok = true, data });
        public static string Err(string message) => JsonConvert.SerializeObject(new { ok = false, message });
    }
}
