/* Compliance Management App — Schedule page. Standalone script, reuses the app's design tokens. */
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
      download: '<path d="M12 3v10M8 9l4 4 4-4"/><path d="M4 19h16"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
      file: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/>',
      pdf: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path d="M9 13h6M9 16.5h4"/>',
      excel: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path d="M9 12.5h6M9 16h6M12 11v7"/>'
    };
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || "") + "</svg>";
  }

  function toast(msg, isError) {
    $(".toast").remove();
    var el = $('<div class="toast">' + icon(isError ? "alert" : "check", 16) + "<span>" + esc(msg) + "</span></div>").appendTo("body");
    setTimeout(function () { el.css({ transition: "opacity .25s", opacity: 0 }); setTimeout(function () { el.remove(); }, 250); }, 2600);
  }

  function api(method, data) {
    return $.ajax({
      url: API + method, type: "POST",
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify(data || {}), dataType: "json"
    }).then(function (res) { return res.d; });
  }

  function isoDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  var items = [];
  var today = new Date();
  var fromDate = isoDate(today);
  var toDate = isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30));
  var agencyId = "";

  function schedCell(label, value) {
    return '<div class="cell"><div class="label">' + esc(label) + '</div><div class="value">' + esc(value) + "</div></div>";
  }

  function itemRow(it, badgeCls, badgeText, srNo) {
    var href = "Default.aspx?complianceId=" + it.complianceId + "&from=schedule";
    return '<a class="sched-card" href="' + href + '">' +
      '<div class="sched-card-head"><div class="sched-card-name"><span class="sched-srno">' + srNo + '.</span> ' + esc(it.name) + '</div>' +
      '<div class="pill ' + badgeCls + '"><span class="dot"></span>' + esc(badgeText) + "</div></div>" +
      '<div class="sched-card-grid">' +
      schedCell("Plant", it.plantName) + schedCell("Agency", it.agencyName) +
      schedCell("Financial Year", it.financialYear) + schedCell("Due Date", fmtDate(it.dueDate)) +
      "</div></a>";
  }
  function emptyRow(label) {
    return '<div class="report-empty">' + esc(label) + "</div>";
  }
  function countBadge(n, cls) {
    return n ? ' <span class="count-badge ' + cls + '">' + n + "</span>" : "";
  }

  function overdueDays(dueDate) {
    return Math.round((today - new Date(dueDate)) / 86400000);
  }

  var STATUS_LABEL = { overdue: "Overdue", due: "Due", compliant: "Compliant" };
  var exportOpen = false;
  var lastOverdue = [];
  var lastDue = [];

  function exportButtonHtml() {
    return '<div class="export-wrap"><button type="button" class="btn btn-outline btn-sm" data-action="toggle-export">' +
      icon("download", 14) + " Export</button></div>";
  }
  function exportMenuHtml() {
    return '<div class="export-menu">' +
      '<div class="export-menu-item" data-action="export-pdf">' + icon("pdf", 15) + " Export as PDF</div>" +
      '<div class="export-menu-item" data-action="export-excel">' + icon("excel", 15) + " Export as Excel</div>" +
      '<div class="export-menu-item" data-action="export-mail">' + icon("mail", 15) + " Send via Mail</div>" +
      "</div>";
  }

  function scheduleExportRows() {
    var cols = ["Compliance", "Plant", "Agency", "Status", "Due Date"];
    var rows = lastOverdue.concat(lastDue).map(function (it) {
      return [it.name, it.plantName, it.agencyName, STATUS_LABEL[it.status], fmtDate(it.dueDate)];
    });
    return { title: "Schedule (" + fmtDate(fromDate) + " to " + fmtDate(toDate) + ")", columns: cols, rows: rows };
  }

  function buildHtmlTable() {
    var cfg = scheduleExportRows();
    var html = '<table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:13px;width:100%">';
    html += '<tr><td colspan="' + cfg.columns.length + '" style="background:#8a1f2b;color:#ffffff;font-weight:bold;font-size:15px;padding:10px;text-align:center">' + esc(cfg.title) + "</td></tr>";
    html += "<tr>" + cfg.columns.map(function (c) {
      return '<th style="background:#f2e2e4;color:#3a0d13;font-weight:bold;padding:8px;border:1px solid #ccc;text-align:left">' + esc(c) + "</th>";
    }).join("") + "</tr>";
    cfg.rows.forEach(function (row, i) {
      var bg = i % 2 === 0 ? "#ffffff" : "#faf5f5";
      html += "<tr>" + row.map(function (cell) {
        return '<td style="padding:7px 8px;border:1px solid #ddd;background:' + bg + '">' + esc(String(cell)) + "</td>";
      }).join("") + "</tr>";
    });
    html += "</table>";
    return html;
  }

  function doExportPdf() {
    if (!window.jspdf) { toast("PDF library did not load", true); return; }
    var cfg = scheduleExportRows();
    var doc = new window.jspdf.jsPDF({ orientation: "landscape" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(138, 31, 43);
    doc.text(cfg.title, 14, 15);
    doc.autoTable({
      head: [cfg.columns],
      body: cfg.rows,
      startY: 20,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3, lineColor: [204, 204, 204], lineWidth: 0.2 },
      headStyles: { fillColor: [138, 31, 43], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 245, 245] }
    });
    doc.save(cfg.title.replace(/[^\w\-]+/g, "_") + ".pdf");
  }

  function doExportExcel() {
    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
      "<head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>" +
      "<x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->" +
      '<meta charset="UTF-8"></head><body>' + buildHtmlTable() + "</body></html>";
    var blob = new Blob(["﻿" + html], { type: "application/vnd.ms-excel" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = scheduleExportRows().title.replace(/[^\w\-]+/g, "_") + ".xls";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function doExportMail() {
    var html = buildHtmlTable();
    var cfg = scheduleExportRows();
    var plain = cfg.columns.join("\t") + "\n" + cfg.rows.map(function (r) { return r.join("\t"); }).join("\n");
    var subject = encodeURIComponent(cfg.title);
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

  function agencyOptionsHtml() {
    var seen = {}, opts = [];
    items.forEach(function (it) {
      if (!seen[it.agencyId]) { seen[it.agencyId] = true; opts.push({ id: it.agencyId, name: it.agencyName }); }
    });
    opts.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    return '<option value="">All agencies</option>' + opts.map(function (o) {
      return '<option value="' + o.id + '"' + (String(o.id) === String(agencyId) ? " selected" : "") + ">" + esc(o.name) + "</option>";
    }).join("");
  }

  function render() {
    var scoped = agencyId ? items.filter(function (it) { return String(it.agencyId) === String(agencyId); }) : items;

    var overdueItems = scoped.filter(function (it) { return it.status === "overdue"; })
      .sort(function (a, b) { return overdueDays(b.dueDate) - overdueDays(a.dueDate); });

    var dueItems = scoped.filter(function (it) {
      return it.status !== "overdue" && it.dueDate >= fromDate && it.dueDate <= toDate;
    }).sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; });

    lastOverdue = overdueItems; lastDue = dueItems;
    $("#scheduleExportWrap").html(exportButtonHtml());
    if (exportOpen) $(".export-wrap").append(exportMenuHtml());

    var html = "";

    html += '<div class="panel"><h3>' + icon("alert", 16) + " Overdue" + countBadge(overdueItems.length, "overdue") + "</h3>" +
      (overdueItems.length ? overdueItems.map(function (it, i) { return itemRow(it, "overdue", overdueDays(it.dueDate) + "d overdue", i + 1); }).join("") : emptyRow("Nothing overdue.")) +
      "</div>";

    html += '<div class="panel" style="margin-top:16px">' +
      '<div class="panel-head"><h3>' + icon("clock", 16) + " Due" + countBadge(dueItems.length, "due") + "</h3>" +
      '<div class="sched-filter">' +
      '<label>Agency ' + ssHtml("agencyFilter", agencyOptionsHtml(), "Search agency...") + "</label>" +
      '<label>From <input type="date" id="fromDate" value="' + fromDate + '" /></label>' +
      '<label>To <input type="date" id="toDate" value="' + toDate + '" /></label>' +
      "</div></div>" +
      (dueItems.length ? dueItems.map(function (it, i) { return itemRow(it, "due", fmtDate(it.dueDate), i + 1); }).join("") : emptyRow("Nothing due in this range.")) +
      "</div>";

    $("#scheduleBody").html(html);
    syncSsel("agencyFilter");
  }

  function showError(xhr) {
    var msg = "Could not load the schedule.";
    try { msg = JSON.parse(xhr.responseText).Message || msg; } catch (e) { }
    if (xhr.status === 401 || /session/i.test(msg)) { goToSso(); return; }
    $("#scheduleBody").html('<div class="empty-state"><div class="icon-chip" style="margin:0 auto 14px">' + icon("alert", 22) + "</div><h3>" + esc(msg) + "</h3></div>");
  }

  $(document).on("change", "#agencyFilter", function () { agencyId = $(this).val(); render(); });
  $(document).on("change", "#fromDate", function () { fromDate = $(this).val(); render(); });
  $(document).on("change", "#toDate", function () { toDate = $(this).val(); render(); });

  $(document).on("click", "[data-action='toggle-export']", function () { exportOpen = !exportOpen; render(); });
  $(document).on("click", "[data-action='export-pdf']", function () { doExportPdf(); exportOpen = false; render(); });
  $(document).on("click", "[data-action='export-excel']", function () { doExportExcel(); exportOpen = false; render(); });
  $(document).on("click", "[data-action='export-mail']", function () { doExportMail(); exportOpen = false; render(); });
  $(document).on("click", function (e) {
    if (exportOpen && !$(e.target).closest(".export-menu,.export-wrap").length) { exportOpen = false; render(); }
  });

  $(function () {
    api("ValidateSession", { sessionId: sessionId }).then(function () {
      return api("GetMySchedule", { sessionId: sessionId });
    }).then(function (list) {
      items = list || [];
      render();
    }, showError);
  });
})();
