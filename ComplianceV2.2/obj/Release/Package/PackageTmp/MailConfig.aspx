<%@ Page Title="Compliance Management App — Mail Configuration" Language="C#" AutoEventWireup="true" CodeBehind="MailConfig.aspx.cs" Inherits="ComplianceV2._2.MailConfig" %>
<!DOCTYPE html>
<html lang="en">
<head runat="server">
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Compliance Management App — Mail Configuration</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Crect width=%2724%27 height=%2724%27 rx=%276%27 fill=%27%238a1f2b%27/%3E%3Cpath d=%27M12 4.5l5.5 2.4v4.6c0 3.8-2.6 6.1-5.5 6.9-2.9-.8-5.5-3.1-5.5-6.9V6.9L12 4.5z%27 fill=%27none%27 stroke=%27white%27 stroke-width=%271.8%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3Cpath d=%27M9.3 12l1.8 1.8 3.4-3.4%27 fill=%27none%27 stroke=%27white%27 stroke-width=%271.8%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E" />
    <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link href="Content/app.css?v=35" rel="stylesheet" />
</head>
<body>
    <div class="navbar">
        <div class="navbar-inner">
            <a href="Default.aspx" class="brand" style="text-decoration:none">
                <span class="mark"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg></span>
                Compliance Management App
            </a>
            <div class="spacer"></div>
            <a class="btn btn-nav btn-sm" href="Default.aspx"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg> Back to app</a>
        </div>
    </div>
    <div class="container">
        <div class="page-head">
            <div class="eyebrow">MASTER · AUTOMATED MAIL</div>
            <h1>Mail configuration</h1>
            <p>Choose who's Cc'd on each automated mail the system sends, per plant. Search by name or token, or add someone manually if they're not in the directory.</p>
        </div>

        <div class="training-status new">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>
            <span><b>To</b> is always the compliance's Owner and Reviewer — set automatically, not configurable here. Everything on this page only controls who's <b>Cc</b>'d.</span>
        </div>

        <div class="plant-switch" id="plantSwitch"></div>
        <div class="mail-tabs" id="mailTabs"></div>
        <div class="tab-desc" id="mailTabDesc"></div>

        <div class="recipient-grid" id="recipientGrid"></div>

        <div class="savebar" id="mailSaveBar"></div>

        <button class="mail-log-toggle" id="mailLogToggle" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
            Show recent changes
        </button>
        <div class="mail-log" id="mailLog" hidden></div>
    </div>
    <script src="Scripts/jquery-3.7.0.min.js"></script>
    <script src="Scripts/common.js?v=6"></script>
    <script src="Scripts/mailconfig.js?v=3"></script>
</body>
</html>
