/* Compliance Management App — Reports page. Standalone script, no SPA routing, reuses the app's design tokens. */
(function () {
  "use strict";

  var API = "ComplianceService.asmx/";
  var DOWNLOAD_URL = "Download.ashx";
  var DOWNLOAD_ZIP_URL = "DownloadZip.ashx";
  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get("sessionId");

  function icon(name, size) {
    size = size || 16;
    var paths = {
      alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/>',
      clip: '<path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h6"/>',
      chevron: '<path d="M9 6l6 6-6 6"/>',
      x: '<path d="M6 6l12 12M18 6L6 18"/>',
      download: '<path d="M12 3v10M8 9l4 4 4-4"/><path d="M4 19h16"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
      pdf: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path d="M9 13h6M9 16.5h4"/>'
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

  function toast(msg, isError) {
    $(".toast").remove();
    var el = $('<div class="toast">' + icon(isError ? "alert" : "clip", 16) + "<span>" + esc(msg) + "</span></div>").appendTo("body");
    setTimeout(function () { el.css({ transition: "opacity .25s", opacity: 0 }); setTimeout(function () { el.remove(); }, 250); }, 3000);
  }

  var STATUS_LABEL = { overdue: "Overdue", due: "Due", compliant: "Compliant" };

  var role = null;
  var plants = [];
  var currentPlantId = 0;
  var allRows = [];        // everything the server returned for the current plant scope
  var rows = [];           // allRows after the Financial Year / Owner filters are applied
  var fyFilter = "all";
  var ownerFilter = "";
  var modalId = null;
  var detailCache = {};   // complianceId -> ComplianceDetailDto
  var histLimit = 10;
  var HIST_LIMIT_OPTIONS = [10, 25, 50];

  function pill(status) {
    return '<span class="pill ' + status + '"><span class="dot"></span>' + STATUS_LABEL[status] + "</span>";
  }
  function stampHtml(status) {
    return '<div class="stamp ' + status + '"><span>' + STATUS_LABEL[status] + "</span></div>";
  }

  function renderPlantSelector() {
    var el = $("#plantSelector");
    if (role === "master") {
      el.html('<div class="plant-switch">' + plants.map(function (p) {
        return '<button type="button" class="plant-switch-btn' + (p.plantId === currentPlantId ? " active" : "") + '" data-plant="' + p.plantId + '">' + esc(p.name) + "</button>";
      }).join("") + "</div>");
    } else {
      el.html('<div class="plant-fixed"><span class="dot"></span>' + (plants.length > 1 ? "Your plants" : "Your plant") + " — " + esc(plants.map(function (p) { return p.name; }).join(", ")) + "</div>");
    }
  }

  function cell(label, value, extraClass) {
    return '<div class="cell' + (extraClass ? " " + extraClass : "") + '"><div class="label">' + esc(label) + '</div><div class="value">' + value + "</div></div>";
  }

  function historyHtml(logs, complianceId) {
    if (!logs.length) return '<div class="report-empty">No fulfilment logged yet.</div>';
    return logs.map(function (l) {
      var single = l.attachments.length === 1;
      var downloadUrl = single
        ? DOWNLOAD_URL + "?complianceId=" + complianceId + "&file=" + encodeURIComponent(l.attachments[0].fileUrl)
        : DOWNLOAD_ZIP_URL + "?logId=" + l.logId;
      var filesLink = l.attachments.length ? filesChipHtml(l.logId,
        icon("clip", 15) + "Files (" + l.attachments.length + ")",
        "Preview.aspx?logId=" + l.logId + "&sessionId=" + encodeURIComponent(sessionId),
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

  function modalBodyHtml(row, d) {
    var lastDone = d.logs.length ? fmtDate(d.logs[0].actionDate) : "—";
    var visibleLogs = histLimit === "all" ? d.logs : d.logs.slice(0, histLimit);
    return '<div class="cdetail-inner">' +
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
          (row.gapDays != null ? cell("Days overdue", '<span class="gap-overdue">' + row.gapDays + "d</span>") : "") +
        "</div>" +
      "</div>" +
      '<div>' +
        '<div class="hist-title-row"><div class="hist-title">Fulfilment history (' + d.logs.length + ")</div>" + histLimitSelectHtml(d.logs.length) + "</div>" +
        '<div class="history-scroll">' + historyHtml(visibleLogs, d.complianceId) + "</div>" +
      "</div>" +
    "</div>";
  }

  function modalFootHtml(row) {
    return '<div class="modal-foot modal-foot-left">' +
      '<button class="btn btn-sm btn-accent" data-action="export-pdf" data-id="' + row.complianceId + '">' + icon("pdf", 17) + " Download as PDF</button>" +
      '<button class="btn btn-sm" data-action="export-mail" data-id="' + row.complianceId + '">' + icon("mail", 17) + " Send via mail</button>" +
    "</div>";
  }

  function fyFilterOptionsHtml() {
    var seen = {}, years = [];
    allRows.forEach(function (r) { if (r.financialYear && !seen[r.financialYear]) { seen[r.financialYear] = true; years.push(r.financialYear); } });
    years.sort();
    return '<option value="all"' + (fyFilter === "all" ? " selected" : "") + ">All years</option>" + years.map(function (y) {
      return '<option value="' + esc(y) + '"' + (y === fyFilter ? " selected" : "") + ">" + esc(y) + "</option>";
    }).join("");
  }
  function ownerFilterOptionsHtml() {
    var seen = {}, opts = [];
    allRows.forEach(function (r) {
      if (r.ownerToken && !seen[r.ownerToken]) { seen[r.ownerToken] = true; opts.push({ token: r.ownerToken, name: r.ownerName }); }
    });
    opts.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    return '<option value="">All owners</option>' + opts.map(function (o) {
      return '<option value="' + esc(o.token) + '"' + (o.token === ownerFilter ? " selected" : "") + ">" + esc(o.name) + "</option>";
    }).join("");
  }
  function filterBarHtml() {
    return '<div class="list-toolbar">' +
      '<div class="fy-filter"><label>Financial year</label> ' + ssHtml("fyFilterSelect", fyFilterOptionsHtml(), "Search year...") + "</div>" +
      '<div class="fy-filter"><label>Owner</label> ' + ssHtml("ownerFilterSelect", ownerFilterOptionsHtml(), "Search owner...") + "</div>" +
      "</div>";
  }
  function applyFilters() {
    rows = allRows.filter(function (r) {
      if (fyFilter !== "all" && r.financialYear !== fyFilter) return false;
      if (ownerFilter && r.ownerToken !== ownerFilter) return false;
      return true;
    });
  }

  function rowHtml(row) {
    return '<div class="crow" data-id="' + row.complianceId + '">' +
      icon("chevron", 14) +
      '<div><div class="cname">' + esc(row.complianceName) + "</div></div>" +
      "<div>" + esc(row.agencyName) + "</div>" +
      "<div>" + esc(row.ownerName) + "</div>" +
      "<div>" + esc(row.deptName || "—") + "</div>" +
      "<div>" + pill(row.status) + "</div>" +
    "</div>";
  }

  function render() {
    renderPlantSelector();
    applyFilters();
    $("#filterBar").html(allRows.length ? filterBarHtml() : "");
    syncSsel("fyFilterSelect");
    syncSsel("ownerFilterSelect");
    $("#rowCount").text(rows.length);
    $("#clist").html(rows.map(rowHtml).join("") || "");
    if (!rows.length) $("#clist").html('<div class="report-empty" style="padding:20px">' + (allRows.length ? "No compliances match this filter." : "No compliances in scope.") + "</div>");
    renderModal();
  }

  function renderModal() {
    $(".overlay").remove();
    if (!modalId) return;
    var row = rows.filter(function (r) { return r.complianceId === modalId; })[0];
    if (!row) return;
    var d = detailCache[modalId];
    var body = d ? modalBodyHtml(row, d) : '<div class="report-empty" style="padding:20px 0">Loading…</div>';
    var foot = d ? modalFootHtml(row) : "";
    $('<div class="overlay">' +
      '<div class="modal modal-lg">' +
        '<div class="modal-head"><div class="icon-chip">' + icon("clip", 22) + '</div><div class="titles"><h3>' + esc(row.complianceName) + '</h3><div class="sub">' + esc(row.agencyName) + '</div></div>' +
        '<button class="modal-close" data-action="close-report-modal">' + icon("x", 18) + "</button></div>" +
        '<div class="modal-body">' + body + "</div>" +
        foot +
      "</div></div>").appendTo("body");
    if (d) syncSsel("histLimitSelect");
  }

  function openRow(id) {
    modalId = id;
    histLimit = 10;
    render();
    if (!detailCache[id]) {
      api("GetComplianceDetail", { sessionId: sessionId, complianceId: id }).then(function (d) {
        detailCache[id] = d;
        if (modalId === id) renderModal();
      }, function (xhr) {
        modalId = null;
        renderModal();
        showError(xhr);
      });
    }
  }

  function closeModal() {
    modalId = null;
    renderModal();
  }

  // ---------- Export (PDF / Mail) — per compliance ----------
  function exportTitle(row) { return row.complianceName + " - " + row.agencyName; }

  function exportLogRows(d) {
    return d.logs.map(function (l) { return [fmtDate(l.actionDate), l.doneBy, l.remarks || "", l.attachments.length]; });
  }

  // Neutral, official-document palette. Red/amber/green are reserved for status
  // meaning only (overdue/due/compliant) - never used decoratively elsewhere in the PDF.
  var PDF = {
    headerBg: [33, 28, 26],
    ink: [35, 32, 30],
    inkMuted: [112, 104, 100],
    rule: [212, 204, 200],
    theadBg: [238, 233, 229],
    zebra: [249, 246, 244],
    status: { overdue: [176, 46, 37], due: [163, 110, 18], compliant: [43, 116, 72] }
  };

  // Mirrors the app's .stamp UI component (double ring, rotated status label).
  function drawStamp(doc, cx, cy, r, status) {
    var col = PDF.status[status];
    doc.setDrawColor.apply(doc, col);
    doc.setLineWidth(0.7);
    doc.circle(cx, cy, r, "S");
    doc.circle(cx, cy, r - 2, "S");
    doc.setTextColor.apply(doc, col);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
    doc.text(STATUS_LABEL[status].toUpperCase(), cx, cy + 1.2, { align: "center", angle: 8 });
  }

  function doExportPdf(id) {
    var row = rows.filter(function (r) { return r.complianceId === id; })[0];
    var d = detailCache[id];
    if (!row || !d) return;
    if (!window.jspdf) { toast("PDF library did not load", true); return; }
    var doc = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 14;
    var today = new Date();
    var genOn = String(today.getDate()).padStart(2, "0") + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + today.getFullYear();

    // ---- Header band ----
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

    // ---- Compliance identity (name/meta text is width-capped so it never runs under the stamp) ----
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

    drawStamp(doc, stampCx, stampCy, stampR, d.status);

    y = Math.max(y, stampCy + stampR) + 4;
    doc.setDrawColor.apply(doc, PDF.rule);
    doc.line(margin, y, pageW - margin, y);
    y += 7;

    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.setTextColor.apply(doc, PDF.inkMuted);
    doc.text("COMPLIANCE DETAILS", margin, y);
    y += 3;

    var facts = [
      ["Financial year", d.financialYear],
      ["Frequency", freqLabel(d.frequencyNumber, d.frequencyUnit)],
      ["Start date", fmtDate(d.startDate)],
      ["Next due date", fmtDate(d.nextDueDate)],
      ["Current status", STATUS_LABEL[d.status]],
      ["Last done on", d.logs.length ? fmtDate(d.logs[0].actionDate) : "-"]
    ];
    if (row.gapDays != null) facts.push(["Days overdue", row.gapDays + " day" + (row.gapDays === 1 ? "" : "s")]);

    doc.autoTable({
      startY: y,
      theme: "grid",
      showHead: false,
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
      body: exportLogRows(d),
      startY: y,
      theme: "grid",
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

    doc.save(exportTitle(row).replace(/[^\w\-]+/g, "_") + ".pdf");
  }

  function doExportMail(id) {
    var row = rows.filter(function (r) { return r.complianceId === id; })[0];
    var d = detailCache[id];
    if (!row || !d) return;
    var logRows = exportLogRows(d);
    var html = '<table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:13px;width:100%">' +
      '<tr><td colspan="4" style="background:#8a1f2b;color:#fff;font-weight:bold;font-size:15px;padding:10px;text-align:center">' + esc(exportTitle(row)) + "</td></tr>" +
      '<tr><td style="padding:6px 8px;border:1px solid #ccc"><b>Agency</b></td><td style="padding:6px 8px;border:1px solid #ccc">' + esc(d.agencyName) + '</td><td style="padding:6px 8px;border:1px solid #ccc"><b>Owner</b></td><td style="padding:6px 8px;border:1px solid #ccc">' + esc(d.ownerName) + "</td></tr>" +
      '<tr><td style="padding:6px 8px;border:1px solid #ccc"><b>Status</b></td><td style="padding:6px 8px;border:1px solid #ccc">' + STATUS_LABEL[d.status] + (row.gapDays != null ? " (" + row.gapDays + "d overdue)" : "") + '</td><td style="padding:6px 8px;border:1px solid #ccc"><b>Due date</b></td><td style="padding:6px 8px;border:1px solid #ccc">' + esc(fmtDate(d.nextDueDate)) + "</td></tr>" +
      '<tr><th style="background:#f2e2e4;padding:8px;border:1px solid #ccc">Date</th><th style="background:#f2e2e4;padding:8px;border:1px solid #ccc">Done by</th><th style="background:#f2e2e4;padding:8px;border:1px solid #ccc">Remarks</th><th style="background:#f2e2e4;padding:8px;border:1px solid #ccc">Attachments</th></tr>' +
      logRows.map(function (r, i) {
        var bg = i % 2 === 0 ? "#ffffff" : "#faf5f5";
        return "<tr>" + r.map(function (c) { return '<td style="padding:6px 8px;border:1px solid #ddd;background:' + bg + '">' + esc(String(c)) + "</td>"; }).join("") + "</tr>";
      }).join("") +
      "</table>";
    var plain = "Date\tDone by\tRemarks\tAttachments\n" + logRows.map(function (r) { return r.join("\t"); }).join("\n");
    var subject = encodeURIComponent(exportTitle(row));
    function openMail(bodyNote) { window.location.href = "mailto:?subject=" + subject + "&body=" + encodeURIComponent(bodyNote); }
    if (navigator.clipboard && window.ClipboardItem) {
      var item = new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) });
      navigator.clipboard.write([item]).then(function () {
        toast("Table copied — paste it (Ctrl+V) into the email body");
        openMail("Paste the copied table here (Ctrl+V).\n\n");
      }, function () {
        toast("Couldn't copy the table automatically — try again", true);
      });
    } else {
      openMail("");
    }
  }

  function showError(xhr) {
    var msg = "Could not load the report.";
    try { msg = JSON.parse(xhr.responseText).Message || msg; } catch (e) { }
    if (xhr.status === 401 || /session/i.test(msg)) { goToSso(); return; }
    toast(msg, true);
  }

  function loadRows() {
    api("GetSummaryReport", { sessionId: sessionId, plantId: currentPlantId }).then(function (d) {
      allRows = d.complianceDetails || [];
      fyFilter = "all";
      ownerFilter = "";
      modalId = null;
      detailCache = {};
      render();
    }, function (xhr) {
      $("#reportsBody").html('<div class="empty-state"><div class="icon-chip" style="margin:0 auto 14px">' + icon("alert", 22) + "</div><h3>Could not load.</h3></div>");
      showError(xhr);
    });
  }

  $(document).on("click", ".plant-switch-btn", function () {
    currentPlantId = parseInt($(this).data("plant"), 10) || 0;
    loadRows();
  });

  $(document).on("click", ".crow", function () { openRow(parseInt($(this).data("id"), 10)); });
  $(document).on("click", "[data-action='export-pdf']", function (e) { e.stopPropagation(); doExportPdf(parseInt($(this).data("id"), 10)); });
  $(document).on("click", "[data-action='export-mail']", function (e) { e.stopPropagation(); doExportMail(parseInt($(this).data("id"), 10)); });
  $(document).on("click", "[data-action='close-report-modal']", closeModal);
  $(document).on("change", "#fyFilterSelect", function () { fyFilter = $(this).val(); render(); });
  $(document).on("change", "#ownerFilterSelect", function () { ownerFilter = $(this).val(); render(); });
  $(document).on("change", ".hist-limit-select", function () {
    var v = $(this).val();
    histLimit = v === "all" ? "all" : parseInt(v, 10);
    renderModal();
  });

  $(function () {
    api("ValidateSession", { sessionId: sessionId }).then(function (v) {
      role = v.role;
      return api("GetPlants", { sessionId: sessionId });
    }).then(function (list) {
      plants = (list || []).filter(function (p) { return p.accessible; });
      if (!plants.length) {
        $("#reportsBody").html('<div class="empty-state"><h3>No plants in scope.</h3></div>');
        return;
      }
      $("#reportsBody").html('<div id="plantSelector"></div><div class="panel"><div class="panel-head"><h3>' + icon("clip", 16) + ' All compliances <span class="count-chip" id="rowCount">0</span></h3></div>' +
        '<div id="filterBar"></div>' +
        '<div class="crow-head"><span></span><span>Compliance</span><span>Agency</span><span>Owner</span><span>Dept</span><span>Status</span></div>' +
        '<div class="clist" id="clist"></div></div>');
      currentPlantId = role === "master" ? plants[0].plantId : 0;
      loadRows();
    }, showError);
  });
})();
