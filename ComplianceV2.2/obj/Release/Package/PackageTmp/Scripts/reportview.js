/* Compliance Management App — confined single-compliance report, reached from the fulfilment email.
   Standalone script: no navbar links, no routing, login happens inline on this same page. */
(function () {
  "use strict";

  var API = "ComplianceService.asmx/";
  var DOWNLOAD_URL = "Download.ashx";
  var DOWNLOAD_ZIP_URL = "DownloadZip.ashx";
  var params = new URLSearchParams(window.location.search);
  var linkToken = params.get("t");
  var complianceId = null;
  var session = JSON.parse(sessionStorage.getItem("statum.session") || "null");
  var detail = null;
  var histLimit = 10;
  var HIST_LIMIT_OPTIONS = [10, 25, 50];
  var STATUS_LABEL = { overdue: "Overdue", due: "Due", compliant: "Compliant" };

  function icon(name, size) {
    size = size || 16;
    var paths = {
      shield: '<path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
      alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/>',
      download: '<path d="M12 3v10M8 9l4 4 4-4"/><path d="M4 19h16"/>',
      pdf: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path d="M9 13h6M9 16.5h4"/>',
      back: '<path d="M19 12H5M11 18l-6-6 6-6"/>'
    };
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || "") + "</svg>";
  }

  function api(method, data) {
    return $.ajax({
      url: API + method, type: "POST",
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify(data || {}), dataType: "json"
    }).then(function (res) { return res.d; }, function (xhr) {
      var msg = "Something went wrong.";
      try { msg = JSON.parse(xhr.responseText).Message || msg; } catch (e) { }
      return $.Deferred().reject(msg).promise();
    });
  }

  function toast(msg, isError) {
    $(".toast").remove();
    var el = $('<div class="toast">' + icon("alert", 16) + "<span>" + esc(msg) + "</span></div>").appendTo("body");
    setTimeout(function () { el.css({ transition: "opacity .25s", opacity: 0 }); setTimeout(function () { el.remove(); }, 250); }, 3000);
  }

  function cell(label, value, extraClass) {
    return '<div class="cell' + (extraClass ? " " + extraClass : "") + '"><div class="label">' + esc(label) + '</div><div class="value">' + value + "</div></div>";
  }
  function stampHtml(status) {
    return '<div class="stamp ' + status + '"><span>' + STATUS_LABEL[status] + "</span></div>";
  }

  function historyHtml(logs) {
    if (!logs.length) return '<div class="report-empty">No fulfilment logged yet.</div>';
    return logs.map(function (l) {
      var single = l.attachments.length === 1;
      var downloadUrl = single
        ? DOWNLOAD_URL + "?complianceId=" + complianceId + "&file=" + encodeURIComponent(l.attachments[0].fileUrl)
        : DOWNLOAD_ZIP_URL + "?logId=" + l.logId;
      var filesLink = l.attachments.length ? filesChipHtml(l.logId,
        icon("download", 15) + "Files (" + l.attachments.length + ")",
        "Preview.aspx?logId=" + l.logId,
        downloadUrl, single ? "Download file" : "Download zip") : "";
      return '<div class="history-item"><div class="dot"></div><div class="hdate">' + esc(fmtDate(l.actionDate)) + '</div><div class="hbody">' + esc(l.remarks || "") +
        '<div class="hby">Logged by ' + esc(l.doneBy) + "</div>" + (filesLink ? "<div>" + filesLink + "</div>" : "") + "</div></div>";
    }).join("");
  }

  function histLimitSelectHtml(total) {
    if (total <= HIST_LIMIT_OPTIONS[0]) return "";
    var opts = HIST_LIMIT_OPTIONS.filter(function (n) { return n < total; }).map(function (n) {
      return '<option value="' + n + '"' + (histLimit === n ? " selected" : "") + ">Latest " + n + "</option>";
    }).join("");
    opts += '<option value="all"' + (histLimit === "all" ? " selected" : "") + ">All (" + total + ")</option>";
    return '<div class="combo-wrap ssel" data-for="histLimitSelect">' +
      '<input type="text" class="ssel-input" id="histLimitSelect_q" autocomplete="off" placeholder="Search..." />' +
      '<div class="combo-list ssel-list" id="histLimitSelect_list" hidden></div>' +
      '<select id="histLimitSelect" class="hist-limit-select" hidden>' + opts + "</select></div>";
  }

  function gapDays(d) {
    if (d.status !== "overdue") return null;
    var due = new Date(d.nextDueDate), today = new Date(new Date().toISOString().slice(0, 10));
    return Math.max(1, Math.round((today - due) / 86400000));
  }

  function reportHtml(d) {
    var lastDone = d.logs.length ? fmtDate(d.logs[0].actionDate) : "—";
    var visibleLogs = histLimit === "all" ? d.logs : d.logs.slice(0, histLimit);
    var gd = gapDays(d);
    return '<div class="page-head"><div class="eyebrow">' + esc(d.plantName) + '</div><h1>' + esc(d.name) + '</h1><p>' + esc(d.agencyName) + '</p></div>' +
      '<div class="modal modal-lg" style="max-height:none;width:auto">' +
      '<div class="modal-body">' +
      '<div class="cdetail-inner">' +
        '<div>' +
          '<div class="detail-grid">' +
            cell("Category", esc(d.category || "—")) +
            cell("Agency", esc(d.agencyName)) +
            cell("Owner", esc(d.ownerName)) +
            cell("Department", esc(d.department || "—")) +
            cell("Financial year", esc(d.financialYear)) +
            cell("Frequency", freqLabel(d.frequencyNumber, d.frequencyUnit)) +
            cell("Next due date", esc(fmtDate(d.nextDueDate))) +
            cell("Last done on", lastDone) +
            cell("Current status", stampHtml(d.status), "cell-stamp") +
            (gd != null ? cell("Days overdue", '<span class="gap-overdue">' + gd + "d</span>") : "") +
          "</div>" +
        "</div>" +
        '<div>' +
          '<div class="hist-title-row"><div class="hist-title">Fulfilment history (' + d.logs.length + ")</div>" + histLimitSelectHtml(d.logs.length) + "</div>" +
          '<div class="history-scroll">' + historyHtml(visibleLogs) + "</div>" +
        "</div>" +
      "</div>" +
      "</div>" +
      '<div class="modal-foot modal-foot-left">' +
        '<button class="btn btn-sm btn-accent" id="exportPdfBtn">' + icon("pdf", 17) + " Download as PDF</button>" +
      "</div>" +
      "</div>";
  }

  function loginHtml(banner) {
    return '<div class="login-wrap"><div class="login-card">' +
      '<span class="dev-badge">DEV LOGIN — simulates the SSO redirect</span>' +
      '<h1>' + icon("shield", 22) + ' Compliance Management App</h1>' +
      (banner ? '<p style="color:var(--color-danger,#b02e25);font-weight:600">' + esc(banner) + "</p>" : "") +
      "<p>Sign in to view this compliance's report.</p>" +
      '<div class="field"><label>Role</label>' + ssHtml("devRole", '<option value="master">Master</option><option value="owner">Owner</option><option value="reviewer">Reviewer</option>', "Search role...") + "</div>" +
      '<div class="field"><label>User</label>' + ssHtml("devUser", "", "Search user...") + "</div>" +
      '<button class="btn btn-primary" id="devLoginBtn" style="width:100%;justify-content:center">Sign in</button>' +
      "</div></div>";
  }

  var TOKENS = {
    master: [{ token: "TOKEN-ANANYA", name: "Ananya Rao" }],
    owner: [{ token: "TOKEN-VIKRAM", name: "Vikram Shah" }, { token: "TOKEN-PRIYA", name: "Priya Menon" }, { token: "TOKEN-MEERA", name: "Meera Nair" }],
    reviewer: [{ token: "TOKEN-RAHUL", name: "Rahul Gupta" }, { token: "TOKEN-SNEHA", name: "Sneha Iyer" }, { token: "TOKEN-KARTHIK", name: "Karthik Iyer" }]
  };

  function renderLogin(banner) {
    $("#reportBody").html(loginHtml(banner));
    $("#signOutWrap").empty();
    function fillUsers() {
      var role = $("#devRole").val();
      $("#devUser").html(TOKENS[role].map(function (u) { return '<option value="' + u.token + '">' + u.name + "</option>"; }).join(""));
      syncSsel("devUser");
    }
    fillUsers();
    syncSsel("devRole");
    $("#devRole").on("change", fillUsers);
    $("#devLoginBtn").on("click", function () {
      api("DevLogin", { token: $("#devUser").val(), role: $("#devRole").val() }).then(function (d) {
        session = d;
        sessionStorage.setItem("statum.session", JSON.stringify(d));
        loadAndRender();
      }, function (msg) { toast(msg, true); });
    });
  }

  function renderError(msg) {
    $("#reportBody").html('<div class="empty-state"><div class="icon-chip" style="margin:0 auto 14px">' + icon("alert", 22) + '</div><h3>' + esc(msg) + "</h3></div>");
  }

  function renderSignOut() {
    $("#signOutWrap").html('<button class="btn btn-nav btn-sm" id="signOutBtn">' + icon("back", 15) + " Sign out</button>");
    $("#signOutBtn").on("click", function () { goToSso(); });
  }

  function exportPdf(d) {
    if (!window.jspdf) { toast("PDF library did not load", true); return; }
    var doc = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 14;
    var today = new Date();
    var genOn = String(today.getDate()).padStart(2, "0") + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + today.getFullYear();
    var PDF = {
      headerBg: [33, 28, 26], ink: [35, 32, 30], inkMuted: [112, 104, 100], rule: [212, 204, 200],
      theadBg: [238, 233, 229], zebra: [249, 246, 244],
      status: { overdue: [176, 46, 37], due: [163, 110, 18], compliant: [43, 116, 72] }
    };

    doc.setFillColor.apply(doc, PDF.headerBg);
    doc.rect(0, 0, pageW, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text("COMPLIANCE MANAGEMENT APP", margin, 9);
    doc.setFontSize(14);
    doc.text("Compliance Fulfilment Record", margin, 18);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("Generated " + genOn, pageW - margin, 9, { align: "right" });
    doc.text(d.plantName, pageW - margin, 18, { align: "right" });

    var stampCx = pageW - margin - 16, stampCy = 40, stampR = 13;
    var textMaxWidth = pageW - margin * 2 - 40;
    var y = 34;
    doc.setTextColor.apply(doc, PDF.ink);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.splitTextToSize(d.name, textMaxWidth).forEach(function (line) { doc.text(line, margin, y); y += 5.5; });
    y += 1;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.setTextColor.apply(doc, PDF.inkMuted);
    doc.splitTextToSize(d.agencyName + "  ·  Owner: " + d.ownerName + (d.department ? "  ·  " + d.department : ""), textMaxWidth)
      .forEach(function (line) { doc.text(line, margin, y); y += 4.5; });

    var col = PDF.status[d.status];
    doc.setDrawColor.apply(doc, col);
    doc.setLineWidth(0.7);
    doc.circle(stampCx, stampCy, stampR, "S");
    doc.circle(stampCx, stampCy, stampR - 2, "S");
    doc.setTextColor.apply(doc, col);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
    doc.text(STATUS_LABEL[d.status].toUpperCase(), stampCx, stampCy + 1.2, { align: "center", angle: 8 });

    y = Math.max(y, stampCy + stampR) + 4;
    doc.setDrawColor.apply(doc, PDF.rule);
    doc.line(margin, y, pageW - margin, y);
    y += 7;

    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.setTextColor.apply(doc, PDF.inkMuted);
    doc.text("COMPLIANCE DETAILS", margin, y);
    y += 3;

    var gd = gapDays(d);
    var facts = [
      ["Financial year", d.financialYear],
      ["Frequency", freqLabel(d.frequencyNumber, d.frequencyUnit)],
      ["Start date", fmtDate(d.startDate)],
      ["Next due date", fmtDate(d.nextDueDate)],
      ["Current status", STATUS_LABEL[d.status]],
      ["Last done on", d.logs.length ? fmtDate(d.logs[0].actionDate) : "-"]
    ];
    if (gd != null) facts.push(["Days overdue", gd + " day" + (gd === 1 ? "" : "s")]);

    doc.autoTable({
      startY: y, theme: "grid", showHead: false,
      margin: { left: margin, right: margin },
      body: facts,
      styles: { fontSize: 9.5, cellPadding: 3.2, lineColor: PDF.rule, lineWidth: 0.15, textColor: PDF.ink },
      columnStyles: { 0: { fontStyle: "bold", textColor: PDF.inkMuted, cellWidth: 55 }, 1: { fontStyle: "bold" } },
      didParseCell: function (data) {
        if (data.column.index !== 1) return;
        var label = facts[data.row.index][0];
        if (label === "Current status") data.cell.styles.textColor = PDF.status[d.status];
        if (label === "Days overdue") data.cell.styles.textColor = PDF.status.overdue;
      }
    });

    y = doc.lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.setTextColor.apply(doc, PDF.inkMuted);
    doc.text("FULFILMENT HISTORY", margin, y);
    y += 3;

    doc.autoTable({
      head: [["Date", "Done by", "Remarks", "Files"]],
      body: d.logs.map(function (l) { return [fmtDate(l.actionDate), l.doneBy, l.remarks || "", l.attachments.length]; }),
      startY: y, theme: "grid",
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3.2, lineColor: PDF.rule, lineWidth: 0.15, textColor: PDF.ink },
      headStyles: { fillColor: PDF.theadBg, textColor: PDF.ink, fontStyle: "bold", lineColor: PDF.rule, lineWidth: 0.15 },
      alternateRowStyles: { fillColor: PDF.zebra }
    });

    var pageCount = doc.internal.getNumberOfPages();
    for (var p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      var footY = doc.internal.pageSize.getHeight() - 10;
      doc.setDrawColor.apply(doc, PDF.rule);
      doc.line(margin, footY, pageW - margin, footY);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      doc.setTextColor.apply(doc, PDF.inkMuted);
      doc.text("Compliance Management App — Official Record", margin, footY + 5);
      doc.text("Page " + p + " of " + pageCount, pageW - margin, footY + 5, { align: "right" });
    }

    doc.save((d.name + "_" + d.agencyName).replace(/[^\w\-]+/g, "_") + ".pdf");
  }

  function renderReport() {
    $("#reportBody").html(reportHtml(detail));
    syncSsel("histLimitSelect");
    renderSignOut();
    $("#exportPdfBtn").on("click", function () { exportPdf(detail); });
    $(document).off("change", ".hist-limit-select").on("change", ".hist-limit-select", function () {
      var v = $(this).val();
      histLimit = v === "all" ? "all" : parseInt(v, 10);
      renderReport();
    });
  }

  function loadAndRender() {
    $("#reportBody").html('<div class="empty-state"><div class="icon-chip" style="margin:0 auto 14px">' + icon("shield", 22) + '</div><h3>Loading...</h3></div>');
    api("ValidateSession", { sessionId: session.sessionId }).then(function (v) {
      if (!v.valid) { goToSso(); return; }
      return api("GetComplianceDetail", { sessionId: session.sessionId, complianceId: complianceId }).then(function (d) {
        detail = d;
        renderReport();
      }, function (msg) { renderSignOut(); renderError("You don't have access to view this compliance."); });
    }, function () { goToSso(); });
  }

  var REASON_MESSAGE = {
    used: "This report link has already been opened once.",
    expired: "This report link has expired.",
    invalid: "This report link is not valid."
  };

  function boot() {
    if (!linkToken) { renderError("No report link provided."); return; }
    $("#reportBody").html('<div class="empty-state"><div class="icon-chip" style="margin:0 auto 14px">' + icon("shield", 22) + '</div><h3>Verifying link...</h3></div>');
    api("RedeemReportLink", { token: linkToken }).then(function (r) {
      if (r.ok) {
        session = { sessionId: r.sessionId, role: "reviewer", fullName: r.fullName, plantName: r.plantName, deptName: r.deptName };
        sessionStorage.setItem("statum.session", JSON.stringify(session));
        complianceId = r.complianceId;
        loadAndRender();
        return;
      }
      complianceId = r.complianceId || null;
      if (session && complianceId) { loadAndRender(); return; }
      if (complianceId) renderLogin(REASON_MESSAGE[r.reason]);
      else renderError(REASON_MESSAGE[r.reason] || "This report link is not valid.");
    }, function (msg) { renderError(msg); });
  }

  $(function () { boot(); });
})();
