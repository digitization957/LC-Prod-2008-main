/* Compliance Management App — shared helpers used by every page script.
   Load this before any page-specific script (app.js, report.js, reports.js, schedule.js, training.js, reportview.js). */
function esc(s) { return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function fmtDate(iso) {
  if (!iso) return "";
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? m[3] + "-" + m[2] + "-" + m[1] : iso;
}
// "As and When" is a frequency_unit value (no fixed interval - owner sets the next due date each
// time), not a category. Every place that renders "Every N unit(s)" should go through this instead.
function freqLabel(num, unit) {
  if (unit === "as_and_when") return "As and When";
  return "Every " + num + " " + unit + (num > 1 ? "(s)" : "");
}

/* Shared searchable dropdown: wraps a hidden <select> with a search-as-you-type text input,
   styled to match the app (Content/app.css .combo-.ssel). Every page includes this file, so
   any <select> in the app should be built with ssHtml() instead of a raw <select>. */
function ssHtml(id, optionsHtml, placeholder) {
  return '<div class="combo-wrap ssel" data-for="' + id + '">' +
    '<input type="text" class="ssel-input" id="' + id + '_q" autocomplete="off" placeholder="' + esc(placeholder || "Search...") + '" />' +
    '<div class="combo-list ssel-list" id="' + id + '_list" hidden></div>' +
    '<select id="' + id + '" hidden>' + optionsHtml + "</select></div>";
}
function syncSsel(id) {
  $("#" + id + "_q").val($("#" + id + " option:selected").text() || "");
}
function showSselList($input, forceAll) {
  var id = $input.closest(".ssel").data("for");
  var q = forceAll ? "" : ($input.val() || "").trim().toLowerCase();
  var matches = $("#" + id + " option").filter(function () { return !q || $(this).text().toLowerCase().indexOf(q) !== -1; })
    .map(function () { return { value: $(this).val(), label: $(this).text() }; }).get();
  var $list = $("#" + id + "_list");
  if (!matches.length) { $list.attr("hidden", true).empty(); return; }
  $list.html(matches.map(function (m) { return '<div class="combo-item" data-value="' + esc(m.value) + '">' + esc(m.label) + "</div>"; }).join("")).removeAttr("hidden");
}
$(function () {
  // focusin/click (not focus) + delegated on document so it works across every page's dynamic markup.
  // Opening the list (focus/click) always shows every option, even if one is already selected;
  // typing afterward filters it down.
  $(document).on("focusin click", ".ssel-input", function () { showSselList($(this), true); });
  $(document).on("input", ".ssel-input", function () { showSselList($(this), false); });
  // mousedown (not click) + preventDefault so the input never blurs before the selection registers.
  $(document).on("mousedown", ".ssel-list .combo-item", function (e) {
    e.preventDefault();
    var $wrap = $(this).closest(".ssel");
    var id = $wrap.data("for");
    $("#" + id).val($(this).data("value")).trigger("change");
    syncSsel(id);
    $wrap.find(".ssel-list").attr("hidden", true).empty();
  });
  $(document).on("focusout", ".ssel-input", function () {
    var id = $(this).closest(".ssel").data("for");
    syncSsel(id);
    $("#" + id + "_list").attr("hidden", true).empty();
  });
  // Keyboard navigation: Up/Down move a highlighted item, Enter picks it, Escape closes.
  $(document).on("keydown", ".ssel-input", function (e) {
    var $wrap = $(this).closest(".ssel");
    var $list = $wrap.find(".ssel-list");
    if (e.key === "Escape") { $list.attr("hidden", true).empty(); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
    if ($list.is(":hidden") || !$list.children().length) return;
    e.preventDefault();
    var $items = $list.children(".combo-item");
    var $active = $items.filter(".is-active");
    if (e.key === "Enter") {
      if ($active.length) $active.trigger("mousedown");
      return;
    }
    var idx = $active.length ? $items.index($active) : -1;
    idx = e.key === "ArrowDown" ? Math.min(idx + 1, $items.length - 1) : Math.max(idx - 1, 0);
    $items.removeClass("is-active").eq(idx).addClass("is-active")[0].scrollIntoView({ block: "nearest" });
  });
});

/* Shared "kicked out" redirect: session expired/invalid, or explicit sign-out, always leaves
   the app entirely and lands on the real SSO portal - never the local dev-login screen. */
function goToSso() {
  try { sessionStorage.removeItem("statum.session"); } catch (e) { }
  window.location.href = "https://access.mahindra.com";
}

/* Shared "Files" control for a fulfilment log: replaces the old bare "Download zip" link with a
   chip that opens a small menu - Preview (opens Preview.aspx in a new tab) or Download. labelHtml
   is caller-supplied (icon + text) since each page renders its own icon() set; previewUrl/downloadUrl
   are pre-built by the caller (it knows its own sessionId). A single attachment downloads directly
   (no point zipping one file) - the caller passes downloadLabel/downloadUrl accordingly ("Download
   file" -> Download.ashx for one file, "Download zip" -> DownloadZip.ashx for more than one). */
function filesChipHtml(logId, labelHtml, previewUrl, downloadUrl, downloadLabel) {
  return '<div class="files-wrap" data-log="' + logId + '">' +
    '<button type="button" class="file-chip files-chip-btn" data-action="toggle-files-menu" data-log="' + logId + '">' + labelHtml + "</button>" +
    '<div class="files-menu" id="filesMenu' + logId + '" hidden>' +
      '<a class="files-menu-item" href="' + previewUrl + '" target="_blank" rel="noopener">Preview</a>' +
      '<a class="files-menu-item" href="' + downloadUrl + '">' + esc(downloadLabel || "Download") + "</a>" +
    "</div></div>";
}
$(function () {
  // The real menu stays hidden in place (it's just a template); on open, a fixed-position clone is
  // appended straight to <body> at the button's on-screen coordinates - so it always floats above
  // whatever scrolling/clipping ancestor it's inside (modal-body, history-scroll, etc.) instead of
  // being trapped there and needing the whole panel scrolled to reach it.
  $(document).on("click", ".files-chip-btn", function (e) {
    e.stopPropagation();
    var logId = $(this).data("log");
    var wasOpen = $("#filesMenuFloat" + logId).length > 0;
    $(".files-menu-fixed").remove();
    if (wasOpen) return;
    var r = this.getBoundingClientRect();
    var $float = $("#filesMenu" + logId).clone().removeAttr("hidden").attr("id", "filesMenuFloat" + logId).addClass("files-menu-fixed");
    $("body").append($float);
    var menuW = $float.outerWidth();
    var left = Math.min(r.left, window.innerWidth - menuW - 8);
    $float.css({ top: (r.bottom + 6) + "px", left: Math.max(8, left) + "px" });
  });
  $(document).on("click", function (e) {
    if (!$(e.target).closest(".files-wrap,.files-menu-fixed").length) $(".files-menu-fixed").remove();
  });
});
