/* Compliance Management App — Summary / Report page. Standalone script, no SPA routing, reuses the app's design tokens. */
(function () {
  "use strict";

  var API = "ComplianceService.asmx/";
  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get("sessionId");

  function icon(name, size) {
    size = size || 16;
    var paths = {
      alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
      check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
      building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/>',
      clip: '<path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h6"/>',
      download: '<path d="M12 3v10M8 9l4 4 4-4"/><path d="M4 19h16"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
      file: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/>',
      pdf: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path d="M9 13h6M9 16.5h4"/>',
      excel: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path d="M9 12.5h6M9 16h6M12 11v7"/>'
    };
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || "") + "</svg>";
  }

  function api(method, data) {
    return $.ajax({
      url: API + method, type: "POST",
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify(data || {}), dataType: "json"
    }).then(function (res) { return res.d; });
  }

  function kpiTile(label, value, cls) {
    return '<div class="kpi-tile' + (cls ? " " + cls : "") + '"><div class="kpi-value">' + value + '</div><div class="kpi-label">' + esc(label) + "</div></div>";
  }

  function ownerSummaryTableHtml(rows) {
    var body = rows.map(function (o) {
      return "<tr><td>" + esc(o.ownerName) + "</td><td>" + esc(o.deptName) + '</td><td class="num compliant">' + o.complied +
        '</td><td class="num overdue">' + o.nonComplied + '</td><td class="num">' + o.total + "</td></tr>";
    }).join("");
    var totals = rows.reduce(function (acc, o) {
      acc.complied += o.complied; acc.nonComplied += o.nonComplied; acc.total += o.total;
      return acc;
    }, { complied: 0, nonComplied: 0, total: 0 });
    var totalRow = "<tr class=\"total-row\"><td>Total</td><td></td><td class=\"num compliant\">" + totals.complied +
      '</td><td class="num overdue">' + totals.nonComplied + '</td><td class="num">' + totals.total + "</td></tr>";
    return '<div class="table-wrap"><table class="owner-summary-table">' +
      "<thead><tr><th>Owner</th><th>Dept</th><th class=\"num\">Complied</th><th class=\"num\">Non-complied</th><th class=\"num\">Total</th></tr></thead>" +
      "<tbody>" + body + totalRow + "</tbody></table></div>";
  }

  var STATUS_LABEL = { overdue: "Overdue", due: "Due", compliant: "Compliant" };

  function complianceDetailTableHtml(rows) {
    var body = rows.map(function (row) {
      return "<tr><td>" + esc(row.complianceName) + "</td><td>" + esc(row.agencyName) + "</td><td>" + esc(row.ownerName) + "</td><td>" + esc(row.deptName) +
        '</td><td><div class="pill ' + row.status + '"><span class="dot"></span>' + STATUS_LABEL[row.status] + "</div></td>" +
        "<td>" + fmtDate(row.dueDate) + "</td></tr>";
    }).join("");
    return '<div class="table-wrap"><table class="owner-summary-table">' +
      "<thead><tr><th>Compliance</th><th>Agency</th><th>Owner</th><th>Dept</th><th>Status</th><th>Due Date</th></tr></thead>" +
      "<tbody>" + body + "</tbody></table></div>";
  }

  function itemRow(it, badgeCls, badgeText) {
    var href = "Default.aspx?complianceId=" + it.complianceId;
    return '<a class="report-item" href="' + href + '" style="text-decoration:none;color:inherit">' +
      '<div class="report-item-main"><div class="report-item-name">' + esc(it.name) + '</div>' +
      '<div class="report-item-meta">' + esc(it.plantName) + " · " + esc(it.agencyName) + " · Owner: " + esc(it.ownerName) + "</div></div>" +
      '<div class="pill ' + badgeCls + '"><span class="dot"></span>' + esc(badgeText) + "</div></a>";
  }

  function activityRow(a) {
    return '<div class="history-item"><div class="dot"></div><div class="hdate">' + fmtDate(a.actionDate) + '</div>' +
      '<div class="hbody"><strong>' + esc(a.complianceName) + '</strong> — ' + esc(a.plantName) + " · " + esc(a.agencyName) +
      (a.remarks ? '<div class="hby">' + esc(a.remarks) + "</div>" : "") +
      '<div class="hby">Logged by ' + esc(a.doneBy) + "</div></div></div>";
  }

  function emptyRow(label) {
    return '<div class="report-empty">' + esc(label) + "</div>";
  }

  function toast(msg, isError) {
    $(".toast").remove();
    var el = $('<div class="toast">' + icon(isError ? "alert" : "check", 16) + "<span>" + esc(msg) + "</span></div>").appendTo("body");
    setTimeout(function () { el.css({ transition: "opacity .25s", opacity: 0 }); setTimeout(function () { el.remove(); }, 250); }, 2600);
  }

  var plants = [];
  var currentPlantId = 0;
  var role = null;
  var lastData = null;
  var exportOpenFor = null;

  function currentPlantLabel() {
    if (!currentPlantId) return plants.length === 1 ? plants[0].name : "All plants";
    var p = plants.filter(function (x) { return x.plantId === currentPlantId; })[0];
    return p ? p.name : "";
  }

  // ---------- Export (PDF / Excel / Mail) ----------
  var EXPORT_CONFIG = {
    owner: {
      title: "Summary - Owner-wise",
      columns: ["Owner", "Dept", "Complied", "Non-complied", "Total"],
      rows: function (d) { return d.ownerSummary.map(function (o) { return [o.ownerName, o.deptName, o.complied, o.nonComplied, o.total]; }); }
    },
    detail: {
      title: "Compliance Status - Detail",
      columns: ["Compliance", "Agency", "Owner", "Dept", "Status", "Due Date", "Done Date", "Gap (days)"],
      rows: function (d) {
        return d.complianceDetails.map(function (r) {
          return [r.complianceName, r.agencyName, r.ownerName, r.deptName, STATUS_LABEL[r.status], fmtDate(r.dueDate), r.doneDate ? fmtDate(r.doneDate) : "-", r.gapDays == null ? "-" : r.gapDays];
        });
      }
    }
  };

  function exportButtonHtml(key) {
    return '<div class="export-wrap" data-key="' + key + '"><button type="button" class="btn btn-outline btn-sm" data-action="toggle-export" data-export-key="' + key + '">' +
      icon("download", 14) + " Export</button></div>";
  }

  function exportMenuHtml() {
    return '<div class="export-menu">' +
      '<div class="export-menu-item" data-action="export-pdf">' + icon("pdf", 15) + " Export as PDF</div>" +
      '<div class="export-menu-item" data-action="export-excel">' + icon("excel", 15) + " Export as Excel</div>" +
      '<div class="export-menu-item" data-action="export-mail">' + icon("mail", 15) + " Send via Mail</div>" +
      "</div>";
  }

  function buildExportTitle(key) {
    return EXPORT_CONFIG[key].title + " - " + currentPlantLabel();
  }

  function buildHtmlTable(key) {
    var cfg = EXPORT_CONFIG[key];
    var rows = cfg.rows(lastData);
    var html = '<table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:13px;width:100%">';
    html += '<tr><td colspan="' + cfg.columns.length + '" style="background:#8a1f2b;color:#ffffff;font-weight:bold;font-size:15px;padding:10px;text-align:center">' +
      esc(buildExportTitle(key)) + "</td></tr>";
    html += "<tr>" + cfg.columns.map(function (c) {
      return '<th style="background:#f2e2e4;color:#3a0d13;font-weight:bold;padding:8px;border:1px solid #ccc;text-align:left">' + esc(c) + "</th>";
    }).join("") + "</tr>";
    rows.forEach(function (row, i) {
      var bg = i % 2 === 0 ? "#ffffff" : "#faf5f5";
      html += "<tr>" + row.map(function (cell) {
        return '<td style="padding:7px 8px;border:1px solid #ddd;background:' + bg + '">' + esc(String(cell)) + "</td>";
      }).join("") + "</tr>";
    });
    html += "</table>";
    return html;
  }

  function doExportPdf(key) {
    if (!window.jspdf) { toast("PDF library did not load", true); return; }
    var cfg = EXPORT_CONFIG[key];
    var rows = cfg.rows(lastData);
    var title = buildExportTitle(key);
    var doc = new window.jspdf.jsPDF({ orientation: cfg.columns.length > 5 ? "landscape" : "portrait" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(138, 31, 43);
    doc.text(title, 14, 15);
    doc.autoTable({
      head: [cfg.columns],
      body: rows,
      startY: 20,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3, lineColor: [204, 204, 204], lineWidth: 0.2 },
      headStyles: { fillColor: [138, 31, 43], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 245, 245] }
    });
    doc.save(title.replace(/[^\w\-]+/g, "_") + ".pdf");
  }

  function doExportExcel(key) {
    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
      "<head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>" +
      "<x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->" +
      '<meta charset="UTF-8"></head><body>' + buildHtmlTable(key) + "</body></html>";
    var blob = new Blob(["﻿" + html], { type: "application/vnd.ms-excel" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = buildExportTitle(key).replace(/[^\w\-]+/g, "_") + ".xls";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function doExportMail(key) {
    var html = buildHtmlTable(key);
    var plain = EXPORT_CONFIG[key].columns.join("\t") + "\n" +
      EXPORT_CONFIG[key].rows(lastData).map(function (r) { return r.join("\t"); }).join("\n");
    var subject = encodeURIComponent(buildExportTitle(key));
    function openMail(bodyNote) {
      window.location.href = "mailto:?subject=" + subject + "&body=" + encodeURIComponent(bodyNote);
    }
    if (navigator.clipboard && window.ClipboardItem) {
      var item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" })
      });
      navigator.clipboard.write([item]).then(function () {
        toast("Table copied — paste it (Ctrl+V) into the email body");
        openMail("Paste the copied table here (Ctrl+V).\n\n");
      }, function () {
        toast("Couldn't copy the table automatically — try Export as Excel instead", true);
        openMail("");
      });
    } else {
      openMail("");
    }
  }

  function renderPlantSwitch() {
    if (role !== "master" || !plants.length) return "";
    return '<div class="plant-switch">' + plants.map(function (p) {
      return '<button type="button" class="plant-switch-btn' + (p.plantId === currentPlantId ? " active" : "") + '" data-plant="' + p.plantId + '">' + esc(p.name) + "</button>";
    }).join("") + "</div>";
  }

  function render(d) {
    lastData = d;
    var html = "";

    html += renderPlantSwitch();

    html += '<div class="kpi-grid">' +
      kpiTile("Total compliances", d.total) +
      kpiTile("Overdue", d.overdue, "kpi-overdue") +
      kpiTile("Due this month", d.due, "kpi-due") +
      kpiTile("Compliant", d.compliant, "kpi-compliant") +
      kpiTile("Compliance rate", d.complianceRate + "%") +
      "</div>";

    html += '<div class="detail-body" style="align-items:start">' +
      '<div class="panel"><h3>' + icon("alert", 16) + " Overdue" + (d.overdueList.length ? ' <span class="report-count">' + d.overdue + '</span>' : "") + '</h3><div class="report-list-scroll">' +
      (d.overdueList.length ? d.overdueList.map(function (it) { return itemRow(it, "overdue", it.daysOverdue + "d overdue"); }).join("") : emptyRow("Nothing overdue.")) + "</div></div>" +
      '<div class="panel"><h3>' + icon("clock", 16) + ' Due in next 30 days</h3><div class="report-list-scroll">' +
      (d.upcomingList.length ? d.upcomingList.map(function (it) { return itemRow(it, "due", fmtDate(it.nextDueDate)); }).join("") : emptyRow("Nothing due in the next 30 days.")) + "</div></div>" +
      "</div>";

    html += '<div class="panel" style="margin-top:16px"><div class="panel-head"><h3>' + icon("building", 16) + " Summary — owner-wise</h3>" + exportButtonHtml("owner") + "</div>" +
      (d.ownerSummary.length ? ownerSummaryTableHtml(d.ownerSummary) : emptyRow("No compliances in scope.")) + "</div>";

    html += '<div class="panel" style="margin-top:16px"><div class="panel-head"><h3>' + icon("clip", 16) + " Compliance status — detail</h3>" + exportButtonHtml("detail") + "</div>" +
      (d.complianceDetails.length ? complianceDetailTableHtml(d.complianceDetails) : emptyRow("No compliances in scope.")) + "</div>";

    if (role === "master") {
      html += '<div class="panel" style="margin-top:16px"><h3>' + icon("check", 16) + " Recent activity</h3>" +
        (d.recentActivity.length ? d.recentActivity.map(activityRow).join("") : emptyRow("No fulfillments logged yet.")) + "</div>";
    }

    $("#reportBody").html(html);
    if (exportOpenFor) $('.export-wrap[data-key="' + exportOpenFor + '"]').append(exportMenuHtml());
  }

  function showError(xhr) {
    var msg = "Could not load the report.";
    try { msg = JSON.parse(xhr.responseText).Message || msg; } catch (e) { }
    if (xhr.status === 401 || /session/i.test(msg)) { goToSso(); return; }
    $("#reportBody").html('<div class="empty-state"><div class="icon-chip" style="margin:0 auto 14px">' + icon("alert", 22) + "</div><h3>" + esc(msg) + "</h3></div>");
  }

  function loadSummary() {
    api("GetSummaryReport", { sessionId: sessionId, plantId: currentPlantId }).then(render, showError);
  }

  $(document).on("click", ".plant-switch-btn", function () {
    currentPlantId = parseInt($(this).data("plant"), 10) || 0;
    loadSummary();
  });

  $(document).on("click", "[data-action='toggle-export']", function () {
    var key = $(this).data("export-key");
    exportOpenFor = exportOpenFor === key ? null : key;
    render(lastData);
  });
  $(document).on("click", "[data-action='export-pdf']", function () { doExportPdf(exportOpenFor); exportOpenFor = null; render(lastData); });
  $(document).on("click", "[data-action='export-excel']", function () { doExportExcel(exportOpenFor); exportOpenFor = null; render(lastData); });
  $(document).on("click", "[data-action='export-mail']", function () { doExportMail(exportOpenFor); exportOpenFor = null; render(lastData); });
  $(document).on("click", function (e) {
    if (exportOpenFor && !$(e.target).closest(".export-menu,.export-wrap").length) { exportOpenFor = null; render(lastData); }
  });

  $(function () {
    api("ValidateSession", { sessionId: sessionId }).then(function (v) {
      role = v.role;
      return api("GetPlants", { sessionId: sessionId });
    }).then(function (list) {
      plants = (list || []).filter(function (p) { return p.accessible; });
      if (!plants.length) { $("#reportBody").html('<div class="empty-state"><h3>No plants in scope.</h3></div>'); return; }

      if (role === "master") {
        currentPlantId = plants[0].plantId;
      } else {
        currentPlantId = 0; // scoped server-side to this user's own compliances
        $("#pageTitle").text("Overview - " + plants.map(function (p) { return p.name; }).join(", "));
      }
      loadSummary();
    }, showError);
  });
})();
