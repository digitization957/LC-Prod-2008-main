/* Compliance Management App — Agency Logo Configuration (master-only). Standalone; reuses the app's design tokens. */
(function () {
  "use strict";

  var API = "ComplianceService.asmx/";
  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get("sessionId");

  var plants = [];
  var agencies = [];
  var currentPlantId = 0;
  var pendingAgencyId = null;

  function icon(name, size) {
    size = size || 16;
    var paths = {
      alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/>',
      check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
      image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-4 4-3-3-5 5"/>',
      upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
      trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12z"/>'
    };
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || "") + "</svg>";
  }

  function api(method, payload) {
    var body = { sessionId: sessionId };
    for (var k in payload) if (payload.hasOwnProperty(k)) body[k] = payload[k];
    return $.ajax({ url: API + method, type: "POST", contentType: "application/json; charset=utf-8", data: JSON.stringify(body), dataType: "json" }).then(function (res) { return res.d; });
  }

  function toast(msg, isError) {
    $(".toast").remove();
    var el = $('<div class="toast">' + icon(isError ? "alert" : "check", 16) + "<span>" + esc(msg) + "</span></div>").appendTo("body");
    setTimeout(function () { el.css({ transition: "opacity .25s", opacity: 0 }); setTimeout(function () { el.remove(); }, 250); }, 3000);
  }

  function showError(xhr) {
    if (xhr.status === 401) { goToSso(); return; }
    var msg = "Something went wrong.";
    try { msg = JSON.parse(xhr.responseText).Message || msg; } catch (e) { }
    toast(msg, true);
  }

  function logoUrl(agencyId) {
    return "AgencyLogo.ashx?agencyId=" + agencyId + "&t=" + Date.now();
  }

  /* ---------------- Render ---------------- */

  function renderPlantSwitch() {
    $("#logoPlantSwitch").html(plants.map(function (p) {
      return '<button type="button" class="plant-switch-btn' + (p.plantId === currentPlantId ? " active" : "") + '" data-plant="' + p.plantId + '">' + esc(p.name) + "</button>";
    }).join(""));
  }

  function renderAgencies() {
    if (!agencies.length) { $("#logoAgencyGrid").html('<div class="report-empty">No agencies in this plant yet.</div>'); return; }
    $("#logoAgencyGrid").html(agencies.map(function (a) {
      return '<div class="logo-card">' +
        '<div class="logo-preview' + (a.hasLogo ? " has-logo" : " default") + '">' +
          (a.hasLogo ? '<img src="' + logoUrl(a.agencyId) + '" alt="' + esc(a.name) + ' logo" />' : icon("image", 26)) +
        "</div>" +
        '<div class="logo-card-body">' +
          "<h3>" + esc(a.name) + "</h3>" +
          '<div class="meta">' + esc(a.description || "No description") + "</div>" +
          '<div class="logo-card-actions">' +
            '<button type="button" class="btn btn-outline btn-sm" data-replace="' + a.agencyId + '">' + icon("upload", 14) + (a.hasLogo ? " Replace logo" : " Add logo") + "</button>" +
            (a.hasLogo ? '<button type="button" class="btn btn-outline btn-sm btn-danger-outline" data-remove="' + a.agencyId + '">' + icon("trash", 14) + " Remove</button>" : "") +
          "</div>" +
        "</div>" +
      "</div>";
    }).join(""));
  }

  /* ---------------- Events ---------------- */

  $(document).on("click", "[data-plant]", function () {
    var plantId = parseInt($(this).data("plant"), 10);
    if (plantId === currentPlantId) return;
    currentPlantId = plantId;
    loadAgencies();
  });

  $(document).on("click", "[data-replace]", function () {
    pendingAgencyId = parseInt($(this).data("replace"), 10);
    $("#logoFileInput").val("").trigger("click");
  });

  $(document).on("click", "[data-remove]", function () {
    var agencyId = parseInt($(this).data("remove"), 10);
    api("RemoveAgencyLogo", { agencyId: agencyId }).then(function () {
      toast("Logo removed — showing default icon.");
      loadAgencies();
    }, showError);
  });

  $("#logoFileInput").on("change", function () {
    var file = this.files && this.files[0];
    if (!file || pendingAgencyId == null) return;
    if (file.type !== "image/png") { toast("Only PNG files are allowed.", true); return; }
    if (file.size > 2 * 1024 * 1024) { toast("File exceeds 2MB limit.", true); return; }

    var fd = new FormData();
    fd.append("sessionId", sessionId);
    fd.append("agencyId", pendingAgencyId);
    fd.append("file", file);

    $.ajax({ url: "AgencyLogoUpload.ashx", type: "POST", data: fd, contentType: false, processData: false, dataType: "json" })
      .then(function () {
        toast("Logo saved.");
        loadAgencies();
      }, showError);
  });

  /* ---------------- Boot ---------------- */

  function loadAgencies() {
    renderPlantSwitch();
    api("GetAgencies", { plantId: currentPlantId }).then(function (list) {
      agencies = list || [];
      renderAgencies();
    }, showError);
  }

  $(function () {
    api("ValidateSession", {}).then(function (v) {
      if (!v.valid) { goToSso(); return; }
      if (v.role !== "master") { window.location.href = "Default.aspx"; return; }
      return api("GetPlants", {});
    }).then(function (list) {
      if (!list) return;
      plants = (list || []).filter(function (p) { return p.accessible; });
      if (!plants.length) { $("#logoAgencyGrid").html('<div class="report-empty">No plants in scope.</div>'); return; }
      currentPlantId = plants[0].plantId;
      loadAgencies();
    }, showError);
  });
})();
