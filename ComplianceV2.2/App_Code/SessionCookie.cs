using System;
using System.Web;

namespace ComplianceV2._2.App_Code
{
    // Mirrors the sessionId into an HttpOnly cookie so page navigation and file-serving handlers never
    // need to carry it as a URL query parameter (browser history / server access logs). WebMethod calls
    // still send sessionId in the POST body as before - that was never the exposure, only URLs were.
    public static class SessionCookie
    {
        public const string Name = "sid";

        public static void Set(HttpContext ctx, string sessionId)
        {
            var cookie = new HttpCookie(Name, sessionId)
            {
                HttpOnly = true,
                Secure = ctx.Request.IsSecureConnection,
                Path = "/",
                Expires = DateTime.UtcNow.AddMinutes(SessionStore.ExpiryMinutes)
            };
            cookie.SameSite = SameSiteMode.Lax;
            ctx.Response.Cookies.Add(cookie);
        }

        public static void Clear(HttpContext ctx)
        {
            var cookie = new HttpCookie(Name, "") { Path = "/", Expires = DateTime.UtcNow.AddDays(-1) };
            ctx.Response.Cookies.Add(cookie);
        }

        // Cookie first; falls back to the query string so any old/bookmarked link with ?sessionId= still works.
        public static string Resolve(HttpRequest req)
        {
            var fromCookie = req.Cookies[Name] != null ? req.Cookies[Name].Value : null;
            return !string.IsNullOrEmpty(fromCookie) ? fromCookie : req.QueryString["sessionId"];
        }
    }
}
