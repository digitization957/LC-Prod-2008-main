<%@ Page Title="Compliance Management App — Files" Language="C#" AutoEventWireup="true" CodeBehind="Preview.aspx.cs" Inherits="ComplianceV2._2.Preview" %>
<!DOCTYPE html>
<html lang="en">
<head runat="server">
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Compliance Management App — Files</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Crect width=%2724%27 height=%2724%27 rx=%276%27 fill=%27%238a1f2b%27/%3E%3Cpath d=%27M12 4.5l5.5 2.4v4.6c0 3.8-2.6 6.1-5.5 6.9-2.9-.8-5.5-3.1-5.5-6.9V6.9L12 4.5z%27 fill=%27none%27 stroke=%27white%27 stroke-width=%271.8%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3Cpath d=%27M9.3 12l1.8 1.8 3.4-3.4%27 fill=%27none%27 stroke=%27white%27 stroke-width=%271.8%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E" />
    <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link href="Content/app.css?v=35" rel="stylesheet" />
</head>
<body>
    <div id="previewTopbar" class="preview-topbar">
        <div><h1 id="previewTitle">Loading…</h1><div class="sub" id="previewSub"></div></div>
        <div id="previewActions"></div>
    </div>
    <div id="previewShell" class="preview-shell">
        <div class="preview-empty" style="margin:auto">Loading…</div>
    </div>
    <script src="Scripts/jquery-3.7.0.min.js"></script>
    <script src="Scripts/common.js?v=6"></script>
    <script src="Scripts/preview.js?v=3"></script>
</body>
</html>
