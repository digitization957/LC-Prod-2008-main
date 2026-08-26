/* Compliance Management App — Training page. Standalone; reuses the app's design tokens. */
(function () {
  "use strict";

  var API = "ComplianceService.asmx/";
  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get("sessionId");
  var role = "owner";
  var trainingCount = 0;
  var ROLE_LABEL = { master: "Master", owner: "Owner", reviewer: "Reviewer" };

  function stripTags(s) { return String(s).replace(/<[^>]*>/g, ""); }
  function icon(name, size) {
    size = size || 16;
    var paths = {
      alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
      check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
      building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/>',
      clip: '<path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h6"/>',
      calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
      bell: '<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>',
      download: '<path d="M12 3v10M8 9l4 4 4-4"/><path d="M4 19h16"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
      pdf: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path d="M9 13h6M9 16.5h4"/>',
      play: '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/>',
      x: '<path d="M6 6l12 12M18 6L6 18"/>',
      arrowL: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
      arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
      lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
      shield: '<path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
      folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z"/>',
      eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
      pencil: '<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/>',
      chevron: '<path d="M9 6l6 6-6 6"/>',
      back: '<path d="M19 12H5M11 18l-6-6 6-6"/>'
    };
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || "") + "</svg>";
  }

  function api(method, data) {
    return $.ajax({ url: API + method, type: "POST", contentType: "application/json; charset=utf-8", data: JSON.stringify(data || {}), dataType: "json" }).then(function (res) { return res.d; });
  }

  function toast(msg, isError) {
    $(".toast").remove();
    var el = $('<div class="toast">' + icon(isError ? "alert" : "check", 16) + "<span>" + esc(msg) + "</span></div>").appendTo("body");
    setTimeout(function () { el.css({ transition: "opacity .25s", opacity: 0 }); setTimeout(function () { el.remove(); }, 250); }, 3000);
  }

  /* ---------------- Content model (shared by page + export) ---------------- */
  function contentModel() {
    var roleBullets = {
      master: [
        "Create agencies and compliances from the <b>+ Create</b> button in the navbar.",
        "See every plant's status on <b>Overview</b>, and the full compliance list on <b>Reports</b>.",
        "Read <b>Recent activity</b> on Overview to see what's been logged across all plants.",
        "Edit an existing compliance's assignment (owner, reviewer, frequency) from its detail view."
      ],
      owner: [
        "Your <b>Schedule</b> page lists what's overdue and what's due soon, in one place.",
        "Open a compliance and use the fulfilment form to mark it done — attach files, add remarks.",
        "Made a mistake? You can <b>revert</b> your most recent fulfilment within 7 days — the reviewer is notified by mail.",
        "Overview/Reports show your full plant's status, not just compliances you personally own.",
        "The bell icon notifies you when something of yours is due or overdue."
      ],
      reviewer: [
        "You have read-only access — browse plants, agencies and compliances to check status.",
        "Overview/Reports show your full plant's status, not just compliances you review.",
        "Open any compliance to see its complete fulfilment history and attachments."
      ]
    };
    return {
      sections: [
        { icon: "check", title: "Quick start", type: "steps", items: [
          { n: 1, title: "Pick a plant", body: "The home screen lists every plant you have access to. Click one to see its agencies." },
          { n: 2, title: "Pick an agency", body: "Each agency (like Pollution Control Board, Labour Department) groups its own compliances." },
          { n: 3, title: "Open a compliance", body: "See its current status, due dates, and full fulfilment history — and act on it if you're the owner." }
        ] },
        { icon: "building", title: "What you can do as " + ROLE_LABEL[role], type: "bullets", items: roleBullets[role] || [] },
        { icon: "clip", title: "Reports & Schedule", type: "bullets", items: [
          "The <b>Reports</b> dropdown in the navbar has two views: <b>Overview</b> (KPIs, owner-wise summary, recent activity) and <b>Reports</b> (every compliance — click one for its full history and to export it)."
        ].concat(role === "owner" ? ["The <b>Schedule</b> page is yours alone — it lists your overdue and upcoming compliances with a date-range filter."] : []) },
        { icon: "alert", title: "Good to know", type: "bullets", items: [
          "<b>Compliant / Due / Overdue</b> are based on the next due date — Overdue means the due date has passed with nothing logged.",
          "Any list with a Download/Export button can save a PDF, an Excel file, or copy a table for email.",
          "The bell icon (top right) shows live notifications for compliances master/owner need to act on."
        ] }
      ]
    };
  }

  /* ---------------- Training-status banner ---------------- */
  function trainingStatusHtml() {
    if (trainingCount > 0) {
      return '<div class="training-status done">' + icon("check", 16) +
        '<span>You have taken this training <b>' + trainingCount + (trainingCount === 1 ? " time" : " times") +
        '</b>. Feel free to take it again anytime for more clarity.</span></div>';
    }
    return '<div class="training-status new">' + icon("shield", 16) +
      "<span>You have not completed this training yet. Welcome aboard — we encourage you to go through it below.</span></div>";
  }

  /* ---------------- Page render ---------------- */
  function render() {
    var m = contentModel();
    var html = trainingStatusHtml();
    html += m.sections.map(function (sec, i) {
      var body;
      if (sec.type === "steps") {
        body = sec.items.map(function (s) {
          return '<div class="tr-step"><div class="tr-step-num">' + s.n + '</div><div><div class="tr-step-title">' + esc(s.title) + '</div><div class="tr-step-body">' + esc(s.body) + "</div></div></div>";
        }).join("");
      } else {
        body = '<ul class="tr-list">' + sec.items.map(function (b) { return "<li>" + b + "</li>"; }).join("") + "</ul>";
      }
      return '<div class="panel"' + (i ? ' style="margin-top:16px"' : "") + "><h3>" + icon(sec.icon, 16) + " " + esc(sec.title) + "</h3>" + body + "</div>";
    }).join("");
    $("#trainingBody").html(html);
    $("#trainingActions").html(actionsHtml());
  }

  function actionsHtml() {
    return '<div class="tr-actions">' +
      '<div class="export-wrap"><button type="button" class="btn btn-outline btn-sm" data-action="toggle-export">' + icon("download", 14) + " Export</button></div>" +
      '<button type="button" class="btn btn-primary btn-sm sop-launch" data-action="go-sop">' + icon("play", 15) + " Go to SOP</button>" +
    "</div>";
  }
  function exportMenuHtml() {
    return '<div class="export-menu">' +
      '<div class="export-menu-item" data-action="export-pdf">' + icon("pdf", 15) + " Export as PDF</div>" +
      '<div class="export-menu-item" data-action="export-mail">' + icon("mail", 15) + " Send via Mail</div>" +
    "</div>";
  }

  /* ---------------- Export: PDF ---------------- */
  var PDF = { headerBg: [33, 28, 26], ink: [35, 32, 30], inkMuted: [112, 104, 100], rule: [212, 204, 200], accentSoft: [242, 226, 228], accent: [138, 31, 43] };

  function exportPdf() {
    if (!window.jspdf) { toast("PDF library did not load", true); return; }
    var m = contentModel();
    var doc = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    var pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), margin = 16;
    var today = new Date();
    var gen = String(today.getDate()).padStart(2, "0") + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + today.getFullYear();

    doc.setFillColor.apply(doc, PDF.headerBg);
    doc.rect(0, 0, pageW, 26, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text("COMPLIANCE MANAGEMENT APP", margin, 10);
    doc.setFontSize(15);
    doc.text("Getting Started Guide", margin, 19);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(ROLE_LABEL[role] + " role", pageW - margin, 10, { align: "right" });
    doc.text("Generated " + gen, pageW - margin, 19, { align: "right" });

    var y = 38;
    function ensure(h) { if (y + h > pageH - 16) { doc.addPage(); y = 22; } }

    m.sections.forEach(function (sec) {
      ensure(14);
      doc.setFillColor.apply(doc, PDF.accentSoft);
      doc.rect(margin, y - 5, pageW - margin * 2, 8, "F");
      doc.setTextColor.apply(doc, PDF.accent);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
      doc.text(sec.title.toUpperCase(), margin + 3, y);
      y += 8;

      doc.setTextColor.apply(doc, PDF.ink);
      sec.items.forEach(function (it) {
        if (sec.type === "steps") {
          doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
          var lead = it.n + ".  " + it.title;
          var leadLines = doc.splitTextToSize(lead, pageW - margin * 2 - 6);
          ensure(leadLines.length * 5 + 2);
          leadLines.forEach(function (ln) { doc.text(ln, margin + 3, y); y += 5; });
          doc.setFont("helvetica", "normal"); doc.setTextColor.apply(doc, PDF.inkMuted);
          var bl = doc.splitTextToSize(it.body, pageW - margin * 2 - 10);
          ensure(bl.length * 4.6 + 2);
          bl.forEach(function (ln) { doc.text(ln, margin + 8, y); y += 4.6; });
          doc.setTextColor.apply(doc, PDF.ink);
        } else {
          doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
          var bullet = "•  " + stripTags(it);
          var bLines = doc.splitTextToSize(bullet, pageW - margin * 2 - 6);
          ensure(bLines.length * 5 + 2);
          bLines.forEach(function (ln) { doc.text(ln, margin + 3, y); y += 5; });
        }
        y += 2.5;
      });
      y += 4;
    });

    var pages = doc.internal.getNumberOfPages();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p);
      var fy = pageH - 10;
      doc.setDrawColor.apply(doc, PDF.rule); doc.line(margin, fy, pageW - margin, fy);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor.apply(doc, PDF.inkMuted);
      doc.text("Compliance Management App — Getting Started", margin, fy + 5);
      doc.text("Page " + p + " of " + pages, pageW - margin, fy + 5, { align: "right" });
    }
    doc.save("Getting_Started_" + ROLE_LABEL[role] + ".pdf");
  }

  /* ---------------- Export: Mail ---------------- */
  function exportMail() {
    var m = contentModel();
    var html = '<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;color:#232019;max-width:640px">' +
      '<div style="background:#211c1a;color:#fff;padding:14px 16px;border-radius:6px 6px 0 0"><div style="font-size:11px;letter-spacing:1px;opacity:.8">COMPLIANCE MANAGEMENT APP</div><div style="font-size:18px;font-weight:bold;margin-top:2px">Getting Started Guide</div><div style="font-size:12px;opacity:.85;margin-top:2px">' + ROLE_LABEL[role] + " role</div></div>";
    m.sections.forEach(function (sec) {
      html += '<div style="margin-top:16px"><div style="background:#f2e2e4;color:#8a1f2b;font-weight:bold;padding:7px 12px;border-radius:4px;text-transform:uppercase;font-size:13px">' + esc(sec.title) + "</div><div style=\"padding:10px 6px\">";
      sec.items.forEach(function (it) {
        if (sec.type === "steps") {
          html += '<p style="margin:0 0 10px"><b>' + it.n + ". " + esc(it.title) + '</b><br><span style="color:#6a635c">' + esc(it.body) + "</span></p>";
        } else {
          html += '<p style="margin:0 0 8px">• ' + it + "</p>";
        }
      });
      html += "</div></div>";
    });
    html += "</div>";

    var plain = "COMPLIANCE MANAGEMENT APP — Getting Started (" + ROLE_LABEL[role] + ")\n\n";
    m.sections.forEach(function (sec) {
      plain += "== " + sec.title.toUpperCase() + " ==\n";
      sec.items.forEach(function (it) {
        plain += sec.type === "steps" ? (it.n + ". " + it.title + " — " + it.body + "\n") : ("• " + stripTags(it) + "\n");
      });
      plain += "\n";
    });

    var subject = encodeURIComponent("Getting Started — Compliance Management App (" + ROLE_LABEL[role] + ")");
    var note = "Paste the copied guide here (Ctrl+V).\n\n";
    function openMail() { window.location.href = "mailto:?subject=" + subject + "&body=" + encodeURIComponent(note); }
    if (navigator.clipboard && window.ClipboardItem) {
      var item = new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) });
      navigator.clipboard.write([item]).then(function () {
        toast("Guide copied — paste it (Ctrl+V) into the email body");
        openMail();
      }, function () { window.prompt("Copy this guide (Ctrl+C), then paste it into your email body:", plain); openMail(); });
    } else { window.prompt("Copy this guide (Ctrl+C), then paste it into your email body:", plain); openMail(); }
  }

  /* ================= Interactive SOP (role-based walkthrough) =================
     Every slide below is built from the real app's own CSS classes (Content/app.css) —
     the exact same markup shapes as app.js/report.js/reports.js/schedule.js render —
     so the walkthrough is a true miniature of the real screens, not a lookalike. */
  function frame(navHtml, bodyHtml) { return '<div class="sop-real-frame">' + navHtml + '<div class="container">' + bodyHtml + "</div></div>"; }

  function realNavbar(userMenuHtml) {
    var actions = '<div class="reports-wrap"><button type="button" class="btn btn-nav btn-sm" data-hl="nav-reports">' + icon("clip", 14) + " Reports</button></div>";
    if (role === "owner") actions += '<span class="btn btn-nav btn-sm" data-hl="nav-schedule">' + icon("calendar", 14) + " Schedule</span>";
    if (role === "master") actions += '<div class="create-wrap"><button type="button" class="btn btn-nav btn-sm" data-hl="create">' + icon("plus", 14) + " Create</button></div>";
    if (role === "master" || role === "owner") {
      actions += '<div class="notif-wrap"><button type="button" class="btn btn-nav btn-sm" data-hl="bell">' + icon("bell", 16) + '<span class="bell-badge">3</span></button></div>';
    }
    actions += '<div class="user-wrap"><button type="button" class="btn btn-nav btn-sm" data-hl="user">' + icon("user", 16) + "</button>" + (userMenuHtml || "") + "</div>";
    return '<div class="navbar"><div class="navbar-inner"><div class="brand"><span class="mark">' + icon("shield", 18) + "</span> Compliance Management App</div><div class=\"spacer\"></div>" + actions + "</div></div>";
  }

  function statRow(o, d, c) {
    var out = "";
    if (o) out += '<span class="stat overdue"><span class="stat-dot"></span>' + o + " overdue</span>";
    if (d) out += '<span class="stat due"><span class="stat-dot"></span>' + d + " due</span>";
    if (c) out += '<span class="stat compliant"><span class="stat-dot"></span>' + c + " compliant</span>";
    return out;
  }
  function pillHtml(status, label) { return '<span class="pill ' + status + '"><span class="dot"></span>' + label + "</span>"; }

  function bodyHome() {
    var head = { master: ["MASTERVIEW", "Compliance Command Center", "A single view across every plant, agency and filing obligation in the organization."],
      owner: ["OWNER WORKSPACE", "My compliance queue", "Every plant is listed below — only plants where you own at least one compliance are open to you."],
      reviewer: ["REVIEWER WORKSPACE", "Compliance review", "Every plant is listed below — only plants with a compliance assigned to you for review are open. Access is read-only."] }[role];
    var secondLocked = role !== "master";
    function card(name, code, loc, o, d, c, locked) {
      var footer = locked ? '<div class="locked-line">' + icon("lock", 13) + " Not assigned to you</div>" : '<div class="footer">' + statRow(o, d, c) + "</div>";
      return '<div class="entity-card' + (locked ? " locked" : "") + '"' + (locked ? "" : ' data-hl="plant"') + ">" +
        '<div class="icon-chip">' + icon("building", 20) + "</div><h3>" + name + '</h3><div class="meta">' + loc + "</div>" +
        (code ? '<div class="code">' + code + "</div>" : "") + footer + '<span class="chevron">' + icon("chevron", 18) + "</span></div>";
    }
    return '<div class="page-head"><div class="eyebrow">' + head[0] + "</div><h1>" + head[1] + "</h1><p>" + head[2] + "</p></div>" +
      '<div class="card-grid">' + card("Chennai Plant", "CHN-01", "Tamil Nadu", 1, 2, 8, false) + card("Pune Plant", "PUN-02", "Maharashtra", 0, 1, 6, secondLocked) + "</div>";
  }

  function bodyAgencies() {
    function card(name, desc, o, d, c, hl) {
      return '<div class="entity-card"' + (hl ? ' data-hl="agency"' : "") + ">" +
        '<div class="icon-chip">' + icon("folder", 20) + "</div><h3>" + name + '</h3><div class="meta">' + desc + '</div><div class="footer">' + statRow(o, d, c) + '</div><span class="chevron">' + icon("chevron", 18) + "</span></div>";
    }
    return '<div class="breadcrumb-row"><button class="back-btn">' + icon("back", 16) + ' Back</button><div class="breadcrumb"><span class="seg">All plants</span><span class="sep">' + icon("chevron", 13) + '</span><span class="seg current">Chennai Plant</span></div></div>' +
      '<div class="page-head"><div class="eyebrow">CHN-01</div><h1>Chennai Plant</h1><p>Tamil Nadu · select an agency to view its compliances.</p></div>' +
      '<div class="card-grid">' + card("Pollution Control Board", "Consent, emissions and effluent filings", 1, 1, 3, true) + card("Labour Department", "PF, ESI and factory act filings", 0, 1, 5, false) + "</div>";
  }

  function bodyDetail() {
    var stamp = '<div class="stamp compliant" data-hl="stamp"><span>Compliant</span></div>';
    var cell = function (label, value) { return '<div class="cell"><div class="label">' + label + '</div><div class="value">' + value + "</div></div>"; };
    var info = '<div class="info">' + (role === "reviewer" ? '<div class="view-only-tag" data-hl="viewonly">' + icon("eye", 13) + " View only</div>" : "") +
      '<h2>PF Monthly Filing</h2><div class="subline">Chennai Plant · Labour Department</div>' +
      '<div class="detail-grid">' + cell("Owner", "Vikram Shah") + cell("Reviewer", "Rahul Gupta") + cell("Frequency", "Every 1 month") + cell("Next due", "24-08-2026") + "</div></div>";
    var fulfil = role === "owner" ? '<div class="panel panel-form"><h3>' + icon("check", 16) + " Fulfilment form</h3>" +
      '<div class="field"><label>Completion date</label><input type="date" value="2026-07-24" readonly /></div>' +
      '<div class="field"><label>Remarks</label><textarea rows="2" readonly>Filed via portal, ref #4521</textarea></div>' +
      '<button type="button" class="btn btn-primary" style="width:100%;justify-content:center" data-hl="markdone">' + icon("check", 16) + " Mark as complete</button></div>" : "";
    var history = '<div class="panel panel-history"><h3>' + icon("clip", 16) + " Fulfilment history</h3><div class=\"history-item\"><div class=\"dot\"></div><div class=\"hdate\">23-07-2026</div><div class=\"hbody\">Filed via portal, ref #4521<div class=\"hby\">Logged by Vikram Shah</div></div></div></div>";
    var body = fulfil ? '<div class="detail-body">' + fulfil + history + "</div>" : '<div class="detail-body single">' + history + "</div>";
    return '<div class="detail-head">' + stamp + info + "</div>" + body;
  }

  function bodyDetailRevert() {
    var stamp = '<div class="stamp compliant"><span>Compliant</span></div>';
    var cell = function (label, value) { return '<div class="cell"><div class="label">' + label + '</div><div class="value">' + value + "</div></div>"; };
    var info = '<div class="info"><h2>PF Monthly Filing</h2><div class="subline">Chennai Plant · Labour Department</div>' +
      '<div class="detail-grid">' + cell("Owner", "Vikram Shah") + cell("Reviewer", "Rahul Gupta") + cell("Frequency", "Every 1 month") + cell("Next due", "24-08-2026") + "</div></div>";
    var actionRow = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:8px">' +
      '<a class="file-chip" style="margin:0">' + icon("download", 12) + "Download 1 file (.zip)</a>" +
      '<button type="button" class="btn btn-outline btn-sm" data-hl="revertbtn">Revert this fulfilment</button></div>';
    var history = '<div class="panel panel-history"><h3>' + icon("clip", 16) + " Fulfilment history</h3><div class=\"history-item\"><div class=\"dot\"></div><div class=\"hdate\">23-07-2026</div><div class=\"hbody\">Filed via portal, ref #4521<div class=\"hby\">Logged by Vikram Shah</div>" + actionRow + "</div></div></div>";
    return '<div class="detail-head">' + stamp + info + "</div>" + '<div class="detail-body single">' + history + "</div>";
  }

  function bodyOverview() {
    function kpi(v, l, c) { return '<div class="kpi-tile' + (c ? " " + c : "") + '"><div class="kpi-value">' + v + '</div><div class="kpi-label">' + l + "</div></div>"; }
    var ownerPanel = '<div class="panel" style="margin-top:16px" data-hl="ownersum"><div class="panel-head"><h3>' + icon("building", 16) + " Summary — owner-wise</h3></div>" +
      '<div class="table-wrap"><table class="owner-summary-table"><thead><tr><th>Owner</th><th>Dept</th><th class="num">Complied</th><th class="num">Non-complied</th><th class="num">Total</th></tr></thead>' +
      "<tbody><tr><td>Vikram Shah</td><td>Safety</td><td class=\"num compliant\">8</td><td class=\"num overdue\">1</td><td class=\"num\">9</td></tr></tbody></table></div></div>";
    var activity = role === "master" ? '<div class="panel" style="margin-top:16px" data-hl="activity"><h3>' + icon("check", 16) + ' Recent activity</h3><div class="history-item"><div class="dot"></div><div class="hdate">24-07-2026</div><div class="hbody"><strong>PF Monthly Filing</strong> — Chennai Plant · Labour Department<div class="hby">Logged by Vikram Shah</div></div></div></div>' : "";
    return '<div class="page-head"><div class="eyebrow">OVERVIEW</div><h1>Compliance health</h1><p>Totals, overdue/due/compliant counts, and owner-wise breakdown.</p></div>' +
      '<div class="kpi-grid">' + kpi("11", "Total compliances") + kpi("1", "Overdue", "kpi-overdue") + kpi("2", "Due this month", "kpi-due") + kpi("8", "Compliant", "kpi-compliant") + "</div>" +
      ownerPanel + activity;
  }

  function bodyReports() {
    function row(name, agency, owner, dept, status, label, hl) {
      return '<div class="crow"' + (hl ? ' data-hl="reprow"' : "") + ">" + icon("chevron", 14) +
        '<div><div class="cname">' + name + "</div></div><div>" + agency + "</div><div>" + owner + "</div><div>" + dept + "</div><div>" + pillHtml(status, label) + "</div></div>";
    }
    return '<div class="page-head"><div class="eyebrow">REPORTS</div><h1>All compliances</h1><p>Every compliance in scope — click one for its full history and to export it.</p></div>' +
      '<div class="panel"><div class="panel-head"><h3>' + icon("clip", 16) + ' All compliances <span class="count-chip">11</span></h3></div>' +
      '<div class="crow-head"><span></span><span>Compliance</span><span>Agency</span><span>Owner</span><span>Dept</span><span>Status</span></div>' +
      row("PF Monthly Filing", "Labour Dept", "Vikram Shah", "Safety", "compliant", "Compliant", true) +
      row("Consent to Operate", "Pollution Control", "Priya Menon", "Environment", "due", "Due", false) + "</div>";
  }

  function bodySchedule() {
    function schedCell(label, value) { return '<div class="cell"><div class="label">' + label + '</div><div class="value">' + value + "</div></div>"; }
    function card(name, cls, label, plant, agency, fy, due, hl) {
      return '<a class="sched-card"' + (hl ? ' data-hl="overduecard"' : "") + '><div class="sched-card-head"><div class="sched-card-name"><span class="sched-srno">1.</span> ' + name + "</div>" + pillHtml(cls, label) + '</div><div class="sched-card-grid">' +
        schedCell("Plant", plant) + schedCell("Agency", agency) + schedCell("Financial Year", fy) + schedCell("Due Date", due) + "</div></a>";
    }
    return '<div class="page-head"><div class="eyebrow">SCHEDULE</div><h1>My schedule</h1><p>Everything overdue at the top, everything due soon below.</p></div>' +
      '<div class="panel"><h3>' + icon("alert", 16) + ' Overdue <span class="count-badge overdue">1</span></h3>' + card("PF Monthly Filing", "overdue", "5d overdue", "Chennai Plant", "Labour Department", "F26", "10-07-2026", true) + "</div>" +
      '<div class="panel" style="margin-top:16px"><div class="panel-head"><h3>' + icon("clock", 16) + ' Due <span class="count-badge due">2</span></h3></div>' + card("Consent to Operate", "due", "23-08-2026", "Chennai Plant", "Pollution Control Board", "F26", "23-08-2026", false) + "</div>";
  }

  function sopSlides() {
    var common1 = [
      { mock: function () { return frame(realNavbar(), bodyHome()); }, hl: null, title: "The navbar", desc: "Your home base. The brand takes you back to the app home; on the right sit your tools — Reports, the notification bell, and your account menu." },
      { mock: function () { return frame(realNavbar(), bodyHome()); }, hl: "plant", title: "Step 1 — Pick a plant", desc: role === "master" ? "The home screen shows every plant, each with a quick count of overdue, due and compliant items. Click a plant to open it." : "The home screen lists every plant, but you only have access to the ones you're linked to — others show as locked. Click your plant to open it." },
      { mock: function () { return frame(realNavbar(), bodyAgencies()); }, hl: "agency", title: "Step 2 — Pick an agency", desc: "Inside a plant, compliances are grouped by the agency they belong to (Pollution Control Board, Labour Department, and so on). Click one." }
    ];
    var detail = { mock: function () { return frame(realNavbar(), bodyDetail()); }, hl: "stamp", title: "Step 3 — Open a compliance", desc: "The detail view shows the big status stamp (Compliant / Due / Overdue), the key dates, and the full fulfilment history below." };

    var reportsSlides = [
      { mock: function () { return frame(realNavbar(), bodyHome()); }, hl: "nav-reports", title: "Reports menu", desc: "The Reports button opens two views: Overview (KPIs and summaries) and Reports (every compliance in a list you can open and export)." },
      { mock: function () { return frame(realNavbar(), bodyOverview()); }, hl: "ownersum", title: "Overview", desc: "A health snapshot for your plant — totals, overdue/due/compliant counts, and an owner-wise summary table." + (role === "master" ? " As master you also see Recent activity across all plants." : "") },
      { mock: function () { return frame(realNavbar(), bodyReports()); }, hl: "reprow", title: "Reports list", desc: "Every compliance, one row each. Click a row to open a big card with the full history — and download it as a polished PDF or send it via mail." }
    ];

    var slides = common1.concat([detail]);

    if (role === "owner") {
      slides = slides.concat([
        { mock: function () { return frame(realNavbar(), bodyDetail()); }, hl: "markdone", title: "Mark a compliance complete", desc: "As the owner, open your compliance, fill the date and remarks, attach proof files, and hit Mark complete. The next due date recalculates automatically." },
        { mock: function () { return frame(realNavbar(), bodyDetailRevert()); }, hl: "revertbtn", title: "Revert a mistaken fulfilment", desc: "Filled it wrong? In the fulfilment history, your latest log shows a <b>Revert this fulfilment</b> button for 7 days — confirm, give a reason, and it's undone. The due date resets and the reviewer gets an email with what was originally filed." },
        { mock: function () { return frame(realNavbar(), bodySchedule()); }, hl: "overduecard", title: "Your Schedule", desc: "The Schedule page is yours alone — everything overdue at the top, everything due soon below (with a date filter). Click a card to jump straight to it and act." }
      ]);
    } else if (role === "master") {
      slides = slides.concat([
        { mock: function () { return frame(realNavbar(), bodyHome()); }, hl: "create", title: "Create agencies & compliances", desc: "As master, the + Create button lets you add a new agency or a new compliance — assigning its plant, owner, reviewer, frequency and due dates." },
        { mock: function () { return frame(realNavbar(), bodyOverview()); }, hl: "activity", title: "Recent activity", desc: "Overview shows a live Recent activity feed of every fulfilment logged across all plants — master-only, so you always know what's moving." }
      ]);
    } else {
      slides = slides.concat([
        { mock: function () { return frame(realNavbar(), bodyDetail()); }, hl: "viewonly", title: "Read-only, by design", desc: "As a reviewer you can open and read any compliance in your plant — status, dates and full history — but the fulfilment form is hidden; only owners log completions." }
      ]);
    }

    slides = slides.concat(reportsSlides);
    return slides;
  }

  var sopIdx = 0, sopList = [];
  function openSop() {
    sopList = sopSlides(); sopIdx = 0;
    $('<div class="overlay sop-overlay"><div class="sop">' +
      '<div class="sop-head"><div class="sop-title">' + icon("play", 16) + ' Walkthrough — ' + ROLE_LABEL[role] + '</div><button class="modal-close" data-action="sop-close">' + icon("x", 16) + "</button></div>" +
      '<div class="sop-main"><div class="sop-stage"><div class="sop-mock" id="sopMock"></div><div class="sop-ring" id="sopRing"></div></div>' +
      '<div class="sop-side"><div class="sop-step" id="sopStep"></div><div class="sop-h" id="sopH"></div><div class="sop-desc" id="sopDesc"></div>' +
      '<div class="sop-outline" id="sopOutline"></div>' +
      '<div class="sop-nav"><button class="btn btn-outline btn-sm" data-action="sop-prev">' + icon("arrowL", 14) + " Back</button><div class=\"sop-dots\" id=\"sopDots\"></div><button class=\"btn btn-primary btn-sm\" data-action=\"sop-next\" id=\"sopNext\">Next " + icon("arrowR", 14) + "</button></div>" +
      "</div></div></div></div>").appendTo("body");
    renderSlide();
  }

  function renderSlide() {
    var s = sopList[sopIdx];
    $("#sopMock").html(s.mock());
    $("#sopStep").text("Step " + (sopIdx + 1) + " of " + sopList.length);
    $("#sopH").text(s.title);
    $("#sopDesc").text(s.desc);
    $("#sopDots").html(sopList.map(function (_, i) { return '<span class="sop-dot' + (i === sopIdx ? " on" : "") + '" data-sop-dot="' + i + '"></span>'; }).join(""));
    $("#sopOutline").html(sopList.map(function (sl, i) {
      return '<div class="sop-outline-item' + (i === sopIdx ? " on" : "") + '" data-sop-jump="' + i + '"><span class="sop-outline-num">' + (i + 1) + "." + '</span><span>' + esc(sl.title.replace(/^Step \d+ — /, "")) + "</span></div>";
    }).join(""));
    $("#sopNext").html(sopIdx === sopList.length - 1 ? "Done " + icon("check", 14) : "Next " + icon("arrowR", 14));
    positionRing(s.hl);
  }

  function positionRing(hl) {
    var $ring = $("#sopRing");
    if (!hl) { $ring.hide(); return; }
    requestAnimationFrame(function () {
      var mock = document.getElementById("sopMock");
      var container = mock ? mock.closest(".sop-stage") : null;
      var el = mock ? mock.querySelector('[data-hl="' + hl + '"]') : null;
      if (!el || !container) { $ring.hide(); return; }
      var sr = container.getBoundingClientRect(), er = el.getBoundingClientRect(), pad = 6;
      $ring.css({ display: "block", left: (er.left - sr.left - pad) + "px", top: (er.top - sr.top - pad) + "px", width: (er.width + pad * 2) + "px", height: (er.height + pad * 2) + "px" });
    });
  }

  function sopGo(i) {
    if (i < 0) { closeSop(); return; }
    if (i >= sopList.length) { completeSop(); return; }
    sopIdx = i; renderSlide();
  }
  function closeSop() { $(".sop-overlay").remove(); }
  function completeSop() {
    closeSop();
    api("LogTrainingComplete", { sessionId: sessionId }).then(function (res) {
      toast("Thank you " + (res.fullName || "") + ", for viewing the SOP and completing the training.");
      trainingCount++;
      render();
    }, function () { toast("Thank you for completing the training."); });
  }

  function showError(xhr) {
    var msg = "Could not load this page.";
    try { msg = JSON.parse(xhr.responseText).Message || msg; } catch (e) { }
    if (xhr.status === 401 || /session/i.test(msg)) { goToSso(); return; }
    $("#trainingBody").html('<div class="empty-state"><div class="icon-chip" style="margin:0 auto 14px">' + icon("alert", 22) + "</div><h3>" + esc(msg) + "</h3></div>");
  }

  /* ---------------- Events ---------------- */
  var exportOpen = false;
  $(document).on("click", "[data-action='toggle-export']", function () { exportOpen = !exportOpen; $(".export-wrap .export-menu").remove(); if (exportOpen) $(".export-wrap").append(exportMenuHtml()); });
  $(document).on("click", "[data-action='export-pdf']", function () { exportOpen = false; $(".export-menu").remove(); exportPdf(); });
  $(document).on("click", "[data-action='export-mail']", function () { exportOpen = false; $(".export-menu").remove(); exportMail(); });
  $(document).on("click", function (e) { if (exportOpen && !$(e.target).closest(".export-wrap").length) { exportOpen = false; $(".export-menu").remove(); } });

  $(document).on("click", "[data-action='go-sop']", openSop);
  $(document).on("click", "[data-action='sop-close']", closeSop);
  $(document).on("click", "[data-action='sop-prev']", function () { sopGo(sopIdx - 1); });
  $(document).on("click", "[data-action='sop-next']", function () { sopGo(sopIdx + 1); });
  $(document).on("click", "[data-sop-dot]", function () { sopGo(parseInt($(this).attr("data-sop-dot"), 10)); });
  $(document).on("click", "[data-sop-jump]", function () { sopGo(parseInt($(this).attr("data-sop-jump"), 10)); });
  $(document).on("click", ".sop-overlay", function (e) { if ($(e.target).hasClass("sop-overlay")) closeSop(); });
  $(document).on("keydown", function (e) {
    if (!$(".sop-overlay").length) return;
    if (e.key === "Escape") closeSop();
    else if (e.key === "ArrowRight") sopGo(sopIdx + 1);
    else if (e.key === "ArrowLeft") sopGo(sopIdx - 1);
  });
  $(window).on("resize", function () { if ($(".sop-overlay").length) positionRing(sopList[sopIdx].hl); });

  $(function () {
    api("ValidateSession", { sessionId: sessionId }).then(function (v) {
      role = v.role || "owner";
      return api("GetTrainingStatus", { sessionId: sessionId });
    }).then(function (t) {
      trainingCount = (t && t.count) || 0;
      render();
    }, showError);
  });
})();
