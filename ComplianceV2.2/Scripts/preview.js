/* Compliance Management App — File preview for one fulfilment log.
   Standalone page: left sidebar lists every file attached to the log, right pane previews the
   selected one (PDF/JPG/PNG render inline; anything else just offers a direct download). */
(function () {
  "use strict";

  var API = "ComplianceService.asmx/";
  var DOWNLOAD_URL = "Download.ashx";
  var DOWNLOAD_ZIP_URL = "DownloadZip.ashx";
  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get("sessionId");
  var logId = parseInt(params.get("logId"), 10);

  var PREVIEWABLE = { pdf: true, jpg: true, jpeg: true, png: true };
  var WORD_TYPES = { doc: true, docx: true };
  var complianceId = null;
  var files = [];
  var activeIdx = 0;

  function icon(name, size) {
    size = size || 16;
    var paths = {
      alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/>',
      pdf: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path d="M9 13h6M9 16.5h4"/>',
      image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
      file: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/>',
      download: '<path d="M12 3v10M8 9l4 4 4-4"/><path d="M4 19h16"/>'
    };
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || "") + "</svg>";
  }

  function extOf(fileUrl) {
    var m = /\.([a-z0-9]+)$/i.exec(fileUrl || "");
    return m ? m[1].toLowerCase() : "";
  }
  function fileIcon(ext) {
    if (ext === "pdf") return icon("pdf", 16);
    if (PREVIEWABLE[ext]) return icon("image", 16);
    return icon("file", 16);
  }
  function fileUrlFor(f, mode) {
    return DOWNLOAD_URL + "?complianceId=" + complianceId +
      "&file=" + encodeURIComponent(f.fileUrl) + (mode ? "&mode=" + mode : "");
  }

  function renderSidebar() {
    var html = files.map(function (f, i) {
      return '<div class="preview-file-item' + (i === activeIdx ? " active" : "") + '" data-idx="' + i + '">' +
        fileIcon(extOf(f.fileUrl)) + "<span>" + esc(f.fileName) + "</span></div>";
    }).join("");
    return '<div class="preview-sidebar">' + html + "</div>";
  }

  function renderMain() {
    var f = files[activeIdx];
    if (!f) return '<div class="preview-main"><div class="preview-empty">No files.</div></div>';
    var ext = extOf(f.fileUrl);
    var body;
    if (ext === "pdf") {
      body = '<iframe src="' + fileUrlFor(f, "preview") + '" title="' + esc(f.fileName) + '"></iframe>';
    } else if (PREVIEWABLE[ext]) {
      body = '<img src="' + fileUrlFor(f, "preview") + '" alt="' + esc(f.fileName) + '" />';
    } else if (WORD_TYPES[ext]) {
      body = '<div class="preview-nopreview"><div class="icon-chip">' + icon("file", 20) + "</div>" +
        "<div><b>" + esc(f.fileName) + '</b><div style="margin-top:6px">Word files cannot be previewed in the browser.</div><div style="margin-top:2px;font-size:12px;color:#888">Please download the file to view it.</div></div>' +
        '<a class="btn btn-outline btn-sm" href="' + fileUrlFor(f) + '">' + icon("download", 14) + " Download file</a></div>";
    } else {
      body = '<div class="preview-nopreview"><div class="icon-chip">' + icon("file", 20) + "</div>" +
        "<div><b>" + esc(f.fileName) + '</b><div style="margin-top:4px">No preview available for this file type.</div></div>' +
        '<a class="btn btn-outline btn-sm" href="' + fileUrlFor(f) + '">' + icon("download", 14) + " Download this file</a></div>";
    }
    return '<div class="preview-main">' + body + "</div>";
  }

  function render() {
    $("#previewShell").html(renderSidebar() + renderMain());
  }

  function renderTopbar(complianceName, actionDate) {
    $("#previewTitle").text(complianceName || "Files");
    $("#previewSub").text("Fulfilment logged " + fmtDate(actionDate) + " · " + files.length + (files.length === 1 ? " file" : " files"));
    var downloadAllUrl = files.length === 1
      ? fileUrlFor(files[0])
      : DOWNLOAD_ZIP_URL + "?logId=" + logId;
    var downloadAllLabel = files.length === 1 ? "Download file" : "Download all (.zip)";
    $("#previewActions").html(files.length
      ? '<a class="btn btn-outline btn-sm" href="' + downloadAllUrl + '">' + icon("download", 14) + " " + downloadAllLabel + "</a>"
      : "");
  }

  function showError(msg) {
    $("#previewTitle").text("Couldn't load files");
    $("#previewSub").text("");
    $("#previewActions").empty();
    $("#previewShell").html('<div class="preview-empty" style="margin:auto">' + esc(msg) + "</div>");
  }

  $(document).on("click", ".preview-file-item", function () {
    activeIdx = parseInt($(this).data("idx"), 10);
    render();
  });

  $(function () {
    if (!logId) { window.location.href = "Default.aspx"; return; }
    $.ajax({
      url: API + "ValidateSession", type: "POST", contentType: "application/json; charset=utf-8",
      data: JSON.stringify({ sessionId: sessionId }), dataType: "json"
    }).then(function (res) { return res.d; }).then(function (v) {
      if (!v.valid) { goToSso(); return $.Deferred().reject().promise(); }
      return $.ajax({
        url: API + "GetLogFiles", type: "POST", contentType: "application/json; charset=utf-8",
        data: JSON.stringify({ sessionId: sessionId, logId: logId }), dataType: "json"
      });
    }).then(function (res) {
      var d = res.d;
      complianceId = d.complianceId;
      files = d.files || [];
      if (!files.length) { showError("This fulfilment has no attached files."); return; }
      renderTopbar(d.complianceName, d.actionDate);
      render();
    }, function (xhr) {
      if (xhr && xhr.status === 401) { goToSso(); return; }
      var msg = "Could not load these files.";
      try { msg = JSON.parse(xhr.responseText).Message || msg; } catch (e) { }
      showError(msg);
    });
  });
})();
