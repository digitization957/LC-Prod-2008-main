/* Compliance Management App — Compliance Portal SPA. One state object, one render(). No framework, no routing. */
(function () {
  "use strict";

  var API = "ComplianceService.asmx/";
  // Mirrors App_Code/BizLogic.cs Categories - "Other" stays last, it's the catch-all.
  // "As and When" is not a category - it's a frequency (see FREQ_ASANDWHEN below).
  var CATEGORIES = [
    "Return", "Inspection", "Compliance", "Renewal", "Reporting", "Submission", "NOC",
    "Approval", "BG Training", "Permission", "License", "Test Certification", "Tax", "Incurrence",
    "Other"
  ];
  var FREQ_ASANDWHEN = "as_and_when";
  var UPLOAD_URL = "Upload.ashx";
  var DOWNLOAD_URL = "Download.ashx";
  var DOWNLOAD_ZIP_URL = "DownloadZip.ashx";

  var state = {
    session: JSON.parse(sessionStorage.getItem("statum.session") || "null"),
    plantId: null, agencyId: null, complianceId: null,
    fy: "all", tempAttachments: [], tempRemarks: "", tempCompletionDate: null, tempManualNextDue: null,
    notifOpen: false, userMenuOpen: false, createMenuOpen: false, reportsMenuOpen: false, modal: null, fromSchedule: false, scheduleRedirecting: false,
    agencyMenuOpenId: null, complianceMenuOpenId: null,
    plants: [], agencies: [], compliances: [], detail: null, notifications: [], lookups: null
  };

  // ---------- API ----------
  function api(method, params) {
    return $.ajax({
      url: API + method, type: "POST",
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify(params || {}), dataType: "json"
    }).then(function (res) { return res.d; }, function (xhr) {
      var msg = "Something went wrong.";
      try { msg = JSON.parse(xhr.responseText).Message || msg; } catch (e) { }
      toast(msg, true);
      if (xhr.status === 401 || /session/i.test(msg)) signOut();
      return $.Deferred().reject(msg).promise();
    });
  }

  // ---------- Helpers ----------
  function fyOptions() {
    var now = new Date();
    var endYear = now.getMonth() + 1 >= 4 ? now.getFullYear() + 1 : now.getFullYear();
    var opts = ["all"];
    for (var i = -3; i <= 3; i++) opts.push("F" + String((endYear + i) % 100).padStart(2, "0"));
    return opts;
  }
  function icon(name, size) {
    size = size || 18;
    var paths = {
      building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/>',
      folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z"/>',
      chevron: '<path d="M9 6l6 6-6 6"/>',
      lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
      bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>',
      x: '<path d="M6 6l12 12M18 6L6 18"/>',
      check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
      clip: '<path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h6"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
      alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/>',
      eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
      pencil: '<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      shield: '<path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/>',
      download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>',
      back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
      dots: '<circle cx="12" cy="5" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.8" fill="currentColor" stroke="none"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'
    };
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || "") + "</svg>";
  }
  function toast(msg, isError) {
    $(".toast").remove();
    var el = $('<div class="toast">' + icon(isError ? "alert" : "check", 16) + "<span>" + esc(msg) + "</span></div>").appendTo("body");
    setTimeout(function () { el.css({ transition: "opacity .25s", opacity: 0 }); setTimeout(function () { el.remove(); }, 250); }, 2600);
  }
  // Client-side mirror of App_Code/BizLogic.cs — used only for the live due-date preview before submit.
  function addInterval(from, num, unit) {
    var d = new Date(from);
    if (unit === "day") d.setDate(d.getDate() + num);
    else if (unit === "week") d.setDate(d.getDate() + num * 7);
    else if (unit === "month") d.setMonth(d.getMonth() + num);
    else if (unit === "year") d.setFullYear(d.getFullYear() + num);
    return d;
  }
  function isoDate(d) { return d.toISOString().slice(0, 10); }
  // Client-side mirror of App_Code/BizLogic.cs FyOf — Indian financial year (Apr-Mar), labeled by its ending year.
  function fyOf(dateStr) {
    var d = new Date(dateStr);
    var endYear = d.getMonth() + 1 >= 4 ? d.getFullYear() + 1 : d.getFullYear();
    return "F" + String(endYear % 100).padStart(2, "0");
  }

  function signOut() {
    goToSso();
  }

  // ---------- Navigation ----------
  function goRoot() {
    state.plantId = state.agencyId = state.complianceId = null; state.fy = "all"; loadPlants();
    if (state.session.role === "master" || state.session.role === "owner") loadNotifications().then(render);
  }
  function backToSchedule() {
    window.location.href = "Schedule.aspx";
  }
  function goPlant(id) {
    if (state.plantId === id) return;
    state.plantId = id; state.agencyId = null; state.complianceId = null;
    loadAgencies();
  }
  function goAgency(id) {
    state.agencyId = id; state.complianceId = null; state.fy = "all";
    loadCompliances();
  }
  function goCompliance(id) {
    state.complianceId = id; state.tempAttachments = []; state.tempRemarks = ""; state.tempCompletionDate = null; state.tempManualNextDue = null;
    state.fromSchedule = false; state.scheduleRedirecting = false;
    loadDetail();
  }

  // ---------- Loaders ----------
  function loadPlants() { api("GetPlants", { sessionId: state.session.sessionId }).then(function (d) { state.plants = d || []; render(); }); }
  function loadAgencies() { api("GetAgencies", { sessionId: state.session.sessionId, plantId: state.plantId }).then(function (d) { state.agencies = d || []; render(); }); }
  function loadCompliances() { api("GetCompliances", { sessionId: state.session.sessionId, plantId: state.plantId, agencyId: state.agencyId, fy: state.fy }).then(function (d) { state.compliances = d || []; render(); }); }
  function loadDetail() { api("GetComplianceDetail", { sessionId: state.session.sessionId, complianceId: state.complianceId }).then(attachPreview).then(function (d) { state.detail = d; render(); }); }

  // Fetches the server-computed "next due date" preview (same BizLogic.ComputeNextDue the real save
  // uses) and attaches it as d.preview, so the fulfilment form never computes this itself. Bypasses the
  // shared api() helper on purpose - this is a cosmetic preview, so a failure here should never toast an
  // error or sign the user out; it just silently falls back to no preview and the form still works.
  function fetchPreview(complianceId, completionDate) {
    return $.ajax({
      url: API + "PreviewNextDue", type: "POST", contentType: "application/json; charset=utf-8",
      data: JSON.stringify({ sessionId: state.session.sessionId, complianceId: complianceId, completionDate: completionDate }), dataType: "json"
    }).then(function (res) { return res.d; }, function () { return null; });
  }
  function attachPreview(d) {
    if (!d || !d.canFulfill || d.frequencyUnit === FREQ_ASANDWHEN) return $.when(d);
    return fetchPreview(d.complianceId, isoDate(new Date())).then(function (p) { d.preview = p; return d; });
  }
  function loadNotifications() { return api("GetNotifications", { sessionId: state.session.sessionId }).then(function (d) { state.notifications = d || []; }); }

  // ---------- Render root ----------
  function render() {
    if (!state.session) { renderLogin(); return; }
    var role = state.session.role;
    var html = "";
    html += navbarHtml(role);
    html += '<div class="container">' + breadcrumbHtml() + mainHtml(role) + "</div>";
    if (state.modal) html += modalHtml();
    $("#app").html(html);
    if (state.notifOpen) $(".notif-wrap").append(notifPanelHtml());
    if (state.userMenuOpen) $(".user-wrap").append(userMenuHtml(role));
    if (state.createMenuOpen) $(".create-wrap").append(createMenuHtml());
    if (state.reportsMenuOpen) $(".reports-wrap").append(reportsMenuHtml());
    if (state.configMenuOpen) $(".config-wrap").append(configMenuHtml());
    if (state.agencyMenuOpenId) {
      var $btn = $(".card-menu-btn[data-id='" + state.agencyMenuOpenId + "']");
      if ($btn.length) {
        var r = $btn[0].getBoundingClientRect();
        var cardRect = $btn.closest(".entity-card")[0].getBoundingClientRect();
        var menuHtml = '<div class="card-menu card-menu-fixed" id="agencyFloatMenu" data-id="' + state.agencyMenuOpenId + '" style="position:fixed;top:' + (cardRect.bottom + 8) + 'px;right:' + (window.innerWidth - r.right) + 'px">' +
          '<div class="card-menu-item" data-action="edit-agency" data-id="' + state.agencyMenuOpenId + '">' + icon("pencil", 14) + " Edit</div>" +
          '<div class="card-menu-item danger" data-action="delete-agency" data-id="' + state.agencyMenuOpenId + '">' + icon("x", 14) + " Delete</div>" +
          "</div>";
        $("#app").append(menuHtml);
      }
    }
    if (state.complianceMenuOpenId) {
      var $rbtn = $(".row-menu-btn[data-id='" + state.complianceMenuOpenId + "']");
      if ($rbtn.length) {
        var rr = $rbtn[0].getBoundingClientRect();
        var menuHtml2 = '<div class="card-menu card-menu-fixed" id="complianceFloatMenu" data-id="' + state.complianceMenuOpenId + '" style="position:fixed;top:' + (rr.bottom + 8) + 'px;right:' + (window.innerWidth - rr.right) + 'px">' +
          '<div class="card-menu-item" data-action="open-compliance-modal" data-edit="' + state.complianceMenuOpenId + '">' + icon("pencil", 14) + " Edit</div>" +
          '<div class="card-menu-item danger" data-action="delete-compliance" data-id="' + state.complianceMenuOpenId + '">' + icon("x", 14) + " Delete</div>" +
          "</div>";
        $("#app").append(menuHtml2);
      }
    }
    bindEvents();
    if (state.modal && state.modal.type === "compliance") {
      populateAgencySelect();
      recomputeDuePreview();
      var d = state.modal.data;
      refreshDeptSelect(d && d.deptId, d && d.ownerToken, d && d.reviewerToken);
      syncSsel("cPlant");
      syncSsel("cFreqUnit");
    }
    $(".ssel").each(function () { syncSsel($(this).data("for")); });
  }

  function screenLevel() { return state.complianceId ? 4 : state.agencyId ? 3 : state.plantId ? 2 : 1; }

  // ---------- Login (dev mock) ----------
  function renderLogin() {
    var html = '<div class="login-wrap"><div class="login-card">' +
      '<span class="dev-badge">DEV LOGIN — simulates the SSO redirect</span>' +
      '<h1>' + icon("shield", 22) + ' Compliance Management App</h1><p>Pick a role and a user to sign in as.</p>' +
      '<div class="field"><label>Role</label>' + ssHtml("devRole", '<option value="master">Master</option><option value="owner">Owner</option><option value="reviewer">Reviewer</option>', "Search role...") + "</div>" +
      '<div class="field"><label>User</label>' + ssHtml("devUser", "", "Search user...") + "</div>" +
      '<button class="btn btn-primary" id="devLoginBtn" style="width:100%;justify-content:center">Sign in</button>' +
      "</div></div>";
    $("#app").html(html);
    // Dev-only stand-in for the real SSO redirect, which will hand us ?token=...&role=... directly.
    var TOKENS = {
      master: [{ token: "TOKEN-ANANYA", name: "Ananya Rao" }],
      owner: [{ token: "TOKEN-VIKRAM", name: "Vikram Shah" }, { token: "TOKEN-PRIYA", name: "Priya Menon" }, { token: "TOKEN-MEERA", name: "Meera Nair" }],
      reviewer: [{ token: "TOKEN-RAHUL", name: "Rahul Gupta" }, { token: "TOKEN-SNEHA", name: "Sneha Iyer" }, { token: "TOKEN-KARTHIK", name: "Karthik Iyer" }]
    };
    function fillUsers() {
      var role = $("#devRole").val();
      $("#devUser").html(TOKENS[role].map(function (u) { return '<option value="' + u.token + '">' + u.name + "</option>"; }).join(""));
      syncSsel("devUser");
    }
    fillUsers();
    syncSsel("devRole");
    $("#devRole").on("change", fillUsers);
    $("#devLoginBtn").on("click", function () {
      loginWithToken($("#devUser").val(), $("#devRole").val());
    });
  }

  function loginWithToken(token, role) {
    return api("DevLogin", { token: token, role: role }).then(function (d) {
      state.session = d;
      sessionStorage.setItem("statum.session", JSON.stringify(d));
      goRoot();
    });
  }

  // Real SSO redirect: Default.aspx?token=<base64>&role=<base64>&method=access - decoding happens
  // server-side (SsoLogin). Scrubs the querystring afterward so the token doesn't linger in history.
  function loginViaSso(token, role) {
    return api("SsoLogin", { token: token, role: role }).then(function (d) {
      state.session = d;
      sessionStorage.setItem("statum.session", JSON.stringify(d));
      window.history.replaceState(null, "", "Default.aspx");
      goRoot();
    });
  }

  // New SSO redirect: Default.aspx?jwt=<base64 pipe-delimited token>. Decoding happens server-side (SsoLoginJwt).
  function loginViaJwt(jwt) {
    return api("SsoLoginJwt", { jwt: jwt }).then(function (d) {
      state.session = d;
      sessionStorage.setItem("statum.session", JSON.stringify(d));
      window.history.replaceState(null, "", "Default.aspx");
      goRoot();
    });
  }

  // ---------- Navbar ----------
  function navbarHtml(role) {
    var actions = "";
    actions += '<div class="reports-wrap"><button class="btn btn-nav btn-sm" data-action="toggle-reports-menu">' + icon("clip", 14) + " Reports</button></div>";
    if (role === "owner") {
      actions += '<a class="btn btn-nav btn-sm" href="Schedule.aspx">' + icon("calendar", 14) + " Schedule</a>";
    }
    if (role === "master") {
      actions += '<div class="create-wrap"><button class="btn btn-nav btn-sm" data-action="toggle-create-menu">' + icon("plus", 14) + " Create</button></div>";
      actions += '<div class="config-wrap"><button class="btn btn-nav btn-sm" data-action="toggle-config-menu">' + icon("mail", 14) + " Config</button></div>";
    }
    if (role === "master" || role === "owner") {
      var unread = state.notifications.length;
      actions += '<div class="notif-wrap"><button class="btn btn-nav btn-sm" data-action="toggle-notif" aria-label="Notifications">' + icon("bell", 16) +
        (unread ? '<span class="bell-badge">' + unread + "</span>" : "") + "</button></div>";
    }
    actions += '<div class="user-wrap"><button class="btn btn-nav btn-sm" data-action="toggle-user-menu" aria-label="Account">' + icon("user", 16) + "</button></div>";
    return '<div class="navbar"><div class="navbar-inner"><div class="brand"><span class="mark">' + icon("shield", 18) + "</span> Compliance Management App</div><div class=\"spacer\"></div>" + actions + "</div></div>";
  }
  function roleLabel(role) { return role === "master" ? "MasterView" : role === "owner" ? "Compliances" : "Compliances · Reviewer"; }

  // ---------- Breadcrumb ----------
  function breadcrumbHtml() {
    if (state.fromSchedule) {
      return '<div class="breadcrumb-row"><button class="back-btn" data-action="go-back">' + icon("back", 16) + ' Back to Schedule</button></div>';
    }
    var segs = ['<span class="seg' + (screenLevel() === 1 ? " current" : "") + '" data-action="crumb-root">All plants</span>'];
    if (state.plantId) {
      var p = findPlant(state.plantId);
      segs.push('<span class="sep">' + icon("chevron", 13) + "</span>");
      segs.push('<span class="seg' + (screenLevel() === 2 ? " current" : "") + '" data-action="crumb-plant">' + esc(p ? p.name : "") + "</span>");
    }
    if (state.agencyId) {
      var a = findAgency(state.agencyId);
      segs.push('<span class="sep">' + icon("chevron", 13) + "</span>");
      segs.push('<span class="seg' + (screenLevel() === 3 ? " current" : "") + '" data-action="crumb-agency">' + esc(a ? a.name : "") + "</span>");
    }
    if (state.complianceId && state.detail) {
      segs.push('<span class="sep">' + icon("chevron", 13) + "</span>");
      segs.push('<span class="seg current">' + esc(state.detail.name) + "</span>");
    }
    var backBtn = screenLevel() > 1 ? '<button class="back-btn" data-action="go-back">' + icon("back", 16) + " Back</button>" : "";
    return '<div class="breadcrumb-row">' + backBtn + '<div class="breadcrumb">' + segs.join("") + "</div></div>";
  }
  function findPlant(id) { return state.plants.filter(function (p) { return p.plantId === id; })[0]; }
  function findAgency(id) { return state.agencies.filter(function (a) { return a.agencyId === id; })[0]; }

  // ---------- Main dispatcher ----------
  function mainHtml(role) {
    var lvl = screenLevel();
    if (lvl === 1) return screenPlants(role);
    if (lvl === 2) return screenAgencies(role);
    if (lvl === 3) return screenCompliances(role);
    return screenDetail(role);
  }

  // ---------- Screen 1: Plants ----------
  function screenPlants(role) {
    var head = { master: ["MASTERVIEW", "Compliance Command Center", "A single view across every plant, agency and filing obligation in the organization."],
      owner: ["OWNER WORKSPACE", "My compliance queue", "Every plant is listed below — only plants where you own at least one compliance are open to you."],
      reviewer: ["REVIEWER WORKSPACE", "Compliance review", "Every plant is listed below — only plants with a compliance assigned to you for review are open. Access is read-only."] }[role];
    var cards = state.plants.map(function (p, i) { return plantCardHtml(p, i); }).join("");
    return pageHead(head) + '<div class="card-grid">' + cards + "</div>";
  }
  function plantCardHtml(p, i) {
    var locked = !p.accessible;
    var stats = statRow(p);
    return '<div class="entity-card' + (locked ? " locked" : "") + '" style="animation-delay:' + (Math.min(i, 5) * 40) + 'ms" ' +
      (locked ? "" : 'data-action="go-plant" data-id="' + p.plantId + '"') + '>' +
      '<div class="icon-chip">' + icon("building", 20) + "</div>" +
      "<h3>" + esc(p.name) + "</h3>" +
      '<div class="meta">' + esc(p.location || "") + "</div>" +
      (p.code ? '<div class="code">' + esc(p.code) + "</div>" : "") +
      (locked ? '<div class="locked-line" style="border-top:1px solid var(--color-rule);margin-top:14px;padding-top:12px">' + icon("lock", 13) + " Not assigned to you</div>" : '<div class="footer">' + stats + "</div>") +
      '<span class="chevron">' + icon("chevron", 18) + "</span></div>";
  }
  function statRow(o) {
    var out = "";
    if (o.overdue) out += '<span class="stat overdue"><span class="stat-dot"></span>' + o.overdue + " overdue</span>";
    if (o.due) out += '<span class="stat due"><span class="stat-dot"></span>' + o.due + " due</span>";
    if (o.compliant) out += '<span class="stat compliant"><span class="stat-dot"></span>' + o.compliant + " compliant</span>";
    return out;
  }

  // ---------- Screen 2: Agencies ----------
  function screenAgencies(role) {
    var p = findPlant(state.plantId) || {};
    var head = ["" + (p.code || ""), p.name || "", (p.location || "") + " · select an agency to view its compliances."];
    var sorted = role === "master" ? state.agencies : state.agencies.slice().sort(function (a, b) { return (b.accessible ? 1 : 0) - (a.accessible ? 1 : 0); });
    var cards = sorted.map(function (a, i) {
      var locked = !a.accessible;
      var menuOpen = state.agencyMenuOpenId === a.agencyId;
      var cardMenu = role === "master" && !locked ? '<div class="card-menu-wrap">' +
        '<button type="button" class="card-menu-btn" data-action="toggle-agency-menu" data-id="' + a.agencyId + '">' + icon("dots", 16) + "</button>" +
        "</div>" : "";
      var logoUrl = "AgencyLogo.ashx?agencyId=" + a.agencyId;
      var logo = a.hasLogo ? '<img src="' + logoUrl + '" alt="" />' : icon("folder", 20);
      var logoBg = a.hasLogo && !locked ? '<div class="card-logo-bg" style="background-image:url(\'' + logoUrl + '\')"></div>' : "";
      return '<div class="entity-card' + (locked ? " locked" : "") + '" style="animation-delay:' + (Math.min(i, 5) * 40) + 'ms" ' +
        (locked ? "" : 'data-action="go-agency" data-id="' + a.agencyId + '"') + '>' +
        logoBg +
        '<div class="icon-chip' + (a.hasLogo && !locked ? " has-logo" : "") + '">' + logo + "</div>" + "<h3>" + esc(a.name) + "</h3>" +
        '<div class="meta">' + esc(a.description || "") + "</div>" +
        (locked ? '<div class="locked-line" style="border-top:1px solid var(--color-rule);margin-top:14px;padding-top:12px">' + icon("lock", 13) + " Not assigned to you</div>" : '<div class="footer">' + statRow(a) + "</div>") +
        '<span class="chevron">' + icon("chevron", 18) + "</span>" + cardMenu + "</div>";
    }).join("");
    return pageHead(head) + '<div class="card-grid">' + cards + "</div>";
  }

  // ---------- Screen 3: Compliance list ----------
  function screenCompliances(role) {
    var a = findAgency(state.agencyId) || {};
    var head = [findPlant(state.plantId) ? findPlant(state.plantId).name : "", a.name || "", (a.description || "Compliances tracked under this agency.")];
    var n = state.compliances.length;
    var toolbar = '<div class="list-toolbar"><div class="fy-filter"><label style="display:inline">Financial year</label> ' +
      ssHtml("fySelect", fyOptions().map(function (v) { return '<option value="' + v + '"' + (v === state.fy ? " selected" : "") + ">" + (v === "all" ? "All years" : v) + "</option>"; }).join(""), "Search year...") +
      '</div><div class="result-count">' + n + (n === 1 ? " compliance" : " compliances") + "</div></div>";

    if (n === 0) {
      return pageHead(head) + toolbar + '<div class="empty-state">' + iconChip("calendar") + "<h3>No compliances found</h3><p>No compliances match this financial year filter for " + esc(a.name) + ". Try switching the filter above.</p></div>";
    }
    var rows = state.compliances.map(complianceRowHtml).join("");
    return pageHead(head) + toolbar + rows;
  }
  function iconChip(name) { return '<div class="icon-chip" style="margin:0 auto 14px">' + icon(name, 22) + "</div>"; }
  function complianceRowHtml(c) {
    var locked = !c.accessible;
    var right = locked ? '<span class="lock-label">' + icon("lock", 13) + " Not yours</span>" : pillHtml(c.status);
    var rowMenu = (state.session.role === "master" && !locked) ? '<div class="row-menu-wrap">' +
      '<button type="button" class="row-menu-btn" data-action="toggle-compliance-menu" data-id="' + c.complianceId + '">' + icon("dots", 16) + "</button>" +
      "</div>" : "";
    return '<div class="compliance-row' + (locked ? " locked" : " status-" + c.status) + '" ' +
      (locked ? "" : 'data-action="go-compliance" data-id="' + c.complianceId + '"') + '>' +
      '<div class="main"><div class="name">' + esc(c.name) + '</div><div class="row-meta">' +
      '<span class="meta-ic">' + icon("user", 13) + " Owner: " + esc(c.ownerName) + "</span>" +
      (c.reviewerName ? '<span class="meta-ic">' + icon("eye", 13) + " Reviewer: " + esc(c.reviewerName) + "</span>" : "") +
      (c.department ? '<span class="meta-ic">' + icon("folder", 13) + " " + esc(c.department) + "</span>" : "") +
      '<span class="fy-tag">' + esc(c.financialYear) + "</span></div></div>" +
      '<div class="due-block"><div class="due-label">Next due</div><div class="due-date">' + esc(fmtDate(c.nextDueDate)) + "</div></div>" + right + rowMenu + "</div>";
  }
  function pillHtml(status) {
    var label = status === "overdue" ? "Overdue" : status === "due" ? "Due this month" : "Compliant";
    return '<span class="pill ' + status + '"><span class="dot"></span>' + label + "</span>";
  }

  // ---------- Screen 4: Compliance detail ----------
  function screenDetail(role) {
    var d = state.detail; if (!d) return "";
    var head = "";
    var stamp = '<div class="stamp ' + d.status + '"><span>' + (d.status === "overdue" ? "Overdue" : d.status === "due" ? "Due" : "Compliant") + "</span></div>";
    var info = '<div class="info">' + (d.isReviewer ? '<div class="view-only-tag">' + icon("eye", 13) + " View only</div>" : "") +
      "<h2>" + esc(d.name) + '</h2><div class="subline">' + esc(d.plantName) + " · " + esc(d.agencyName) + "</div>" +
      '<div class="detail-grid">' +
      cell("Category", d.category || "—") + cell("Owner", d.ownerName) + cell("Reviewer", d.reviewerName || "—") + cell("Department", d.department || "—") +
      cell("Frequency", freqLabel(d.frequencyNumber, d.frequencyUnit)) +
      (role === "master" ? cell("Start date", fmtDate(d.startDate)) : "") + cell("Last done on", d.logs.length ? fmtDate(d.logs[0].actionDate) : "—") +
      cell("Next due", fmtDate(d.nextDueDate)) + cell("Financial year", d.financialYear) +
      "</div>" +
      (d.canEdit ? '<button class="btn btn-outline btn-sm" style="margin-top:16px" data-action="open-compliance-modal" data-edit="' + d.complianceId + '">' + icon("pencil", 14) + " Edit assignment</button>" : "") +
      "</div>";
    var detailHead = '<div class="detail-head">' + stamp + info + "</div>";

    var historyPanel = historyHtml(d);
    var lockedCls = state.scheduleRedirecting ? " is-locked" : "";
    var body;
    if (d.canFulfill) body = '<div class="detail-body' + lockedCls + '">' + fulfillFormHtml(d) + historyPanel + "</div>";
    else body = '<div class="detail-body single' + lockedCls + '">' + historyPanel + "</div>";

    return pageHead(head, true) + detailHead + body;
  }
  function cell(label, value) { return '<div class="cell"><div class="label">' + esc(label) + '</div><div class="value">' + esc(value) + "</div></div>"; }
  function historyHtml(d) {
    if (!d.logs.length) return '<div class="panel panel-history"><h3>' + icon("clip", 16) + " Fulfillment history</h3>" +
      '<div class="empty-state" style="border:none;padding:24px 0">' + iconChip("clock") + "<h3>No fulfillment logged yet</h3><p>Once the owner completes this compliance, the log will appear here.</p></div></div>";
    var items = d.logs.map(function (l) {
      var single = l.attachments.length === 1;
      var downloadUrl = single
        ? DOWNLOAD_URL + "?complianceId=" + d.complianceId + "&file=" + encodeURIComponent(l.attachments[0].fileUrl)
        : DOWNLOAD_ZIP_URL + "?logId=" + l.logId;
      var filesLink = l.attachments.length ? filesChipHtml(l.logId,
        icon("clip", 12) + "Files (" + l.attachments.length + ")",
        "Preview.aspx?logId=" + l.logId + "&sessionId=" + encodeURIComponent(state.session.sessionId),
        downloadUrl, single ? "Download file" : "Download zip") : "";
      var revertBtn = l.canRevert ? '<button type="button" class="btn btn-outline btn-sm" data-action="open-revert" data-log="' + l.logId + '">Revert this fulfilment</button>' : "";
      var actionRow = (filesLink || revertBtn) ? '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:8px">' + (filesLink || "<span></span>") + revertBtn + "</div>" : "";
      return '<div class="history-item"><div class="dot"></div><div class="hdate">' + esc(fmtDate(l.actionDate)) + '</div><div class="hbody">' + esc(l.remarks || "") +
        '<div class="hby">Logged by ' + esc(l.doneBy) + "</div>" + actionRow + "</div></div>";
    }).join("");
    return '<div class="panel panel-history"><h3>' + icon("clip", 16) + " Fulfillment history</h3>" + '<div class="history-scroll">' + items + "</div></div>";
  }
  var MAX_ATTACHMENTS = 3;
  var REMARKS_MAX = 250;
  function fulfillFormHtml(d) {
    var today = state.tempCompletionDate || isoDate(new Date());
    var isReturn = d.category === "Return";
    var isAsWhen = d.frequencyUnit === FREQ_ASANDWHEN;
    var preview = d.preview || null;
    var lastFilableDate = isReturn && preview ? preview.lastFilableDate : null;

    // Return has a hard cutoff - once "today" is past it, the cycle can no longer be filed at all,
    // no matter what completion date they'd pick. Show a blocking notice instead of the form.
    if (isReturn && isoDate(new Date()) > lastFilableDate) {
      return '<div class="panel panel-form"><h3>' + icon("check", 16) + " Fulfillment form</h3>" +
        '<div class="window-closed-notice">' + icon("alert", 16) +
        '<div><b>Filing window closed</b><div>This Return could only be filed up to ' + esc(fmtDate(lastFilableDate)) + '. It can no longer be marked complete for this cycle.</div></div></div></div>';
    }

    var chips = state.tempAttachments.map(function (f, i) { return '<span class="attach-chip">' + icon("clip", 12) + esc(f.fileName) + '<button data-action="remove-attachment" data-idx="' + i + '">' + icon("x", 10) + "</button></span>"; }).join("");
    var atLimit = state.tempAttachments.length >= MAX_ATTACHMENTS;
    var attachBtn = atLimit ? '<span class="lock-label">Maximum ' + MAX_ATTACHMENTS + ' files attached</span>' :
      '<button class="btn btn-outline btn-sm" data-action="attach-file">' + icon("plus", 14) + " Attach file</button>";
    var reminderFields = d.reminders.map(function (r) {
      return '<div><label>' + r.label + " (days before)</label><input type=\"number\" min=\"0\" class=\"rem-days\" data-label=\"" + r.label + '" value="' + r.daysBeforeDue + '" /></div>';
    });
    var reminders = "";
    for (var ri = 0; ri < reminderFields.length; ri += 2) {
      reminders += '<div class="field-row" style="margin-bottom:10px">' + reminderFields[ri] + (reminderFields[ri + 1] || "") + "</div>";
    }
    // Return's next due date is anchored to the old due date + frequency, not to whatever
    // completion date is picked - filing a couple of days late doesn't push the next cycle out.
    // As and When has no frequency at all - the owner types in the next due date themselves.
    var dateWindowNote = isReturn ? '<div class="field-note">Must be filed by <b>' + esc(fmtDate(lastFilableDate)) + '</b> for this cycle.</div>' : "";
    var nextDueField;
    if (isAsWhen) {
      var manualNextDue = state.tempManualNextDue || today;
      nextDueField = '<div class="field"><label>Next due date</label><div class="date-fy-row"><input type="date" id="manualNextDue" value="' + manualNextDue + '" />' +
        '<span class="fy-chip" id="manualNextDueFy">' + esc(fyOf(manualNextDue)) + '</span></div>' +
        '<div class="field-note">No fixed frequency for this category — set the next due date yourself.</div></div>';
    } else {
      // preview comes from the server (PreviewNextDue → BizLogic.ComputeNextDue) - same source as the
      // real save. Blank until it resolves is preferable to a client-computed guess that could disagree.
      var projectedDueIso = preview ? preview.nextDue : "";
      nextDueField = '<div class="field"><label>Projected next due date</label><div class="date-fy-row"><div class="value" id="fulfillDuePreview">' + esc(projectedDueIso ? fmtDate(projectedDueIso) : "—") + '</div>' +
        '<span class="fy-chip" id="fulfillDueFy">' + esc(projectedDueIso ? fyOf(projectedDueIso) : "") + "</span></div></div>";
    }
    return '<div class="panel panel-form"><h3>' + icon("check", 16) + " Fulfillment form</h3>" +
      '<div class="field"><label>Completion date</label><div class="date-fy-row"><input type="date" id="completionDate" value="' + today + '"' + (isReturn && lastFilableDate ? ' max="' + lastFilableDate + '"' : "") + ' />' +
      '<span class="fy-chip" id="completionFy">' + esc(fyOf(today)) + "</span></div>" + dateWindowNote + "</div>" +
      nextDueField +
      '<div class="field"><div class="field-label-row"><label>Remarks</label><span id="remarksCount" class="char-count">' + state.tempRemarks.length + '/' + REMARKS_MAX + '</span></div>' +
      '<textarea id="remarks" rows="3" maxlength="' + REMARKS_MAX + '" placeholder="What was filed / renewed, and any reference number">' + esc(state.tempRemarks) + '</textarea></div>' +
      '<div class="field"><label>Attachments (up to ' + MAX_ATTACHMENTS + ')</label><input type="file" id="attachFileInput" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style="display:none" />' +
      attachBtn + "<div>" + chips + "</div></div>" +
      '<div class="field"><label>Reminders (days before due)</label>' + reminders + "</div>" +
      '<button class="btn btn-primary" style="width:100%;justify-content:center" data-action="mark-complete">' + icon("check", 16) + " Mark as complete</button></div>";
  }

  function pageHead(head, skip) {
    if (skip) return "";
    var eyebrow = head[0] ? '<div class="eyebrow">' + esc(head[0]) + "</div>" : "";
    return '<div class="page-head">' + eyebrow + "<h1>" + esc(head[1]) + "</h1><p>" + esc(head[2]) + "</p></div>";
  }

  // ---------- Notifications ----------
  function notifPanelHtml() {
    var overdue = state.notifications.filter(function (n) { return n.type === "overdue"; });
    var due = state.notifications.filter(function (n) { return n.type === "due_this_month"; });
    var body;
    if (!state.notifications.length) body = '<div class="notif-empty">All caught up — nothing overdue or due this month.</div>';
    else {
      body = "";
      if (overdue.length) body += '<div class="notif-section-label overdue">OVERDUE · ' + overdue.length + "</div>" + overdue.map(notifItem("overdue")).join("");
      if (due.length) body += '<div class="notif-section-label due">DUE THIS MONTH · ' + due.length + "</div>" + due.map(notifItem("due")).join("");
    }
    return '<div class="notif-panel">' +
      '<div class="nh">Notifications <span class="count">' + state.notifications.length + " need attention</span></div>" + body + "</div>";
  }
  function notifItem(cls) {
    return function (n) {
      return '<div class="notif-item ' + cls + '" data-action="notif-goto" data-plant="' + "" + '" data-compliance="' + n.complianceId + '">' +
        '<div class="ic">' + icon(cls === "overdue" ? "alert" : "clock", 15) + "</div>" +
        '<div><div class="nname">' + esc(n.name) + '</div><div class="nmeta">' + esc(n.plantName) + " · " + esc(n.agencyName) + " · Due " + esc(fmtDate(n.dueDate)) + "</div></div></div>";
    };
  }

  // ---------- User menu ----------
  function userMenuHtml(role) {
    var meta = [];
    if (state.session.plantName) meta.push('<div class="um-meta-row">' + icon("building", 12) + '<span>' + esc(state.session.plantName) + "</span></div>");
    if (state.session.deptName) meta.push('<div class="um-meta-row">' + icon("folder", 12) + '<span>' + esc(state.session.deptName) + "</span></div>");
    return '<div class="user-menu">' +
      '<div class="um-head"><div class="um-avatar">' + icon("user", 16) + '</div>' +
      '<div><div class="um-name">' + esc(state.session.fullName) + '</div><div class="um-role">' + esc(roleLabel(role)) + '</div>' +
      (meta.length ? '<div class="um-meta">' + meta.join("") + "</div>" : "") + "</div></div>" +
      '<div class="um-divider"></div>' +
      '<button type="button" class="um-training" data-action="go-training">' + icon("clip", 14) + " Get training</button>" +
      '<div class="um-divider"></div>' +
      '<div class="um-signout" data-action="sign-out">' + icon("back", 15) + ' Sign out</div>' +
      "</div>";
  }

  // ---------- Create menu ----------
  function createMenuHtml() {
    return '<div class="create-menu">' +
      '<div class="create-menu-item" data-action="open-agency-modal">' + icon("folder", 15) + " Create agency</div>" +
      '<div class="create-menu-item" data-action="open-compliance-modal">' + icon("clip", 15) + " Create compliance</div>" +
      "</div>";
  }

  // ---------- Reports menu ----------
  function reportsMenuHtml() {
    return '<div class="create-menu">' +
      '<a class="create-menu-item" href="Report.aspx">' + icon("building", 15) + " Overview</a>" +
      '<a class="create-menu-item" href="Reports.aspx">' + icon("clip", 15) + " Reports</a>" +
      "</div>";
  }

  // ---------- Config menu (master-only) ----------
  function configMenuHtml() {
    return '<div class="create-menu">' +
      '<a class="create-menu-item" href="MailConfig.aspx">' + icon("mail", 15) + " Mail config</a>" +
      '<a class="create-menu-item" href="AgencyLogoConfig.aspx">' + icon("folder", 15) + " Agency logo config</a>" +
      "</div>";
  }

  // ---------- Modals ----------
  function modalHtml() {
    if (state.modal.type === "agency") return agencyModalHtml();
    if (state.modal.type === "compliance") return complianceModalHtml();
    if (state.modal.type === "revert") return revertModalHtml();
    if (state.modal.type === "delete-agency") return deleteAgencyModalHtml();
    if (state.modal.type === "delete-compliance") return deleteComplianceModalHtml();
    return "";
  }
  // Two-step permanent delete: step 1 asks for confirmation, step 2 (once the master says yes) shows
  // exactly what will be removed - every compliance under the agency and its fulfilment count - before
  // the final, irreversible "Delete permanently".
  function deleteAgencyModalHtml() {
    var m = state.modal;
    if (m.step === 1) {
      return '<div class="overlay"><div class="modal">' +
        '<div class="modal-head"><div class="icon-chip">' + icon("alert", 18) + '</div><div class="titles"><h3>Delete this agency?</h3></div>' +
        '<button class="modal-close" data-action="close-modal">' + icon("x", 15) + "</button></div>" +
        '<div class="modal-body"><p style="margin:0">Do you really want to delete the agency <b>' + esc(m.agencyName) + '</b> of plant <b>' + esc(m.plantName) + "</b>?</p></div>" +
        '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-primary" data-action="delete-agency-next">Next</button></div></div></div>';
    }
    var impact = m.impact;
    var body = !impact ? '<p style="margin:0">Loading what this will affect…</p>' :
      ('<p style="margin:0 0 14px">Deleting <b>' + esc(m.agencyName) + '</b> will permanently remove the following. This <strong>cannot be undone</strong>.</p>' +
      (impact.compliances.length
        ? '<div class="table-wrap"><table class="owner-summary-table"><thead><tr><th>Compliance</th><th class="num">Fulfilments</th></tr></thead><tbody>' +
          impact.compliances.map(function (c) { return "<tr><td>" + esc(c.complianceName) + '</td><td class="num">' + c.fulfillmentCount + "</td></tr>"; }).join("") +
          "</tbody></table></div>"
        : '<p style="margin:0;color:var(--color-ink-3)">This agency has no compliances.</p>') +
      '<p style="margin:14px 0 0;font-size:12.5px;color:var(--color-ink-3)">' + impact.compliances.length + " compliance(s), " + impact.totalFulfillments + " fulfilment(s) in total.</p>");
    return '<div class="overlay"><div class="modal">' +
      '<div class="modal-head"><div class="icon-chip">' + icon("alert", 18) + '</div><div class="titles"><h3>Confirm permanent deletion</h3></div>' +
      '<button class="modal-close" data-action="close-modal">' + icon("x", 15) + "</button></div>" +
      '<div class="modal-body">' + body + "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
      '<button class="btn btn-primary" data-action="delete-agency-confirm"' + (impact ? "" : " disabled") + ">Delete permanently</button></div></div></div>";
  }
  // Same two-step pattern as delete-agency, but step 2 shows the compliance's own fulfilment log
  // instead of a list of compliances - there's nothing under a compliance except its fulfilments.
  function deleteComplianceModalHtml() {
    var m = state.modal;
    if (m.step === 1) {
      return '<div class="overlay"><div class="modal">' +
        '<div class="modal-head"><div class="icon-chip">' + icon("alert", 18) + '</div><div class="titles"><h3>Delete this compliance?</h3></div>' +
        '<button class="modal-close" data-action="close-modal">' + icon("x", 15) + "</button></div>" +
        '<div class="modal-body"><p style="margin:0">Do you really want to delete the compliance <b>' + esc(m.complianceName) + '</b> under <b>' + esc(m.agencyName) + "</b>?</p></div>" +
        '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-primary" data-action="delete-compliance-next">Next</button></div></div></div>';
    }
    var impact = m.impact;
    var body = !impact ? '<p style="margin:0">Loading what this will affect…</p>' :
      ('<p style="margin:0 0 14px">Deleting <b>' + esc(m.complianceName) + '</b> will permanently remove the following. This <strong>cannot be undone</strong>.</p>' +
      (impact.logs.length
        ? '<div class="table-wrap"><table class="owner-summary-table"><thead><tr><th>Date</th><th>Done by</th><th>Remarks</th></tr></thead><tbody>' +
          impact.logs.map(function (l) { return "<tr><td>" + esc(fmtDate(l.actionDate)) + "</td><td>" + esc(l.doneBy) + '</td><td>' + esc(l.remarks || "—") + "</td></tr>"; }).join("") +
          "</tbody></table></div>"
        : '<p style="margin:0;color:var(--color-ink-3)">This compliance has no fulfilment history.</p>') +
      '<p style="margin:14px 0 0;font-size:12.5px;color:var(--color-ink-3)">' + impact.logs.length + " fulfilment(s) will be permanently deleted.</p>");
    return '<div class="overlay"><div class="modal">' +
      '<div class="modal-head"><div class="icon-chip">' + icon("alert", 18) + '</div><div class="titles"><h3>Confirm permanent deletion</h3></div>' +
      '<button class="modal-close" data-action="close-modal">' + icon("x", 15) + "</button></div>" +
      '<div class="modal-body">' + body + "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
      '<button class="btn btn-primary" data-action="delete-compliance-confirm"' + (impact ? "" : " disabled") + ">Delete permanently</button></div></div></div>";
  }
  var REVERT_REASON_MAX = 250;
  function revertModalHtml() {
    var confirmed = !!state.modal.confirmed;
    var reasonLen = (state.modal.reason || "").length;
    return '<div class="overlay"><div class="modal">' +
      '<div class="modal-head"><div class="icon-chip">' + icon("alert", 18) + '</div><div class="titles"><h3>Revert this fulfilment?</h3></div>' +
      '<button class="modal-close" data-action="close-modal">' + icon("x", 15) + "</button></div>" +
      '<div class="modal-body">' +
      (!confirmed
        ? '<p style="margin:0">This removes the fulfilment log and puts the compliance back to due. This can only be done within <strong>7 days</strong> of logging it, and <strong>cannot be undone</strong> from here.</p>'
        : '<div class="field"><div class="field-label-row"><label>Reason for reverting</label><span id="revertReasonCount" class="char-count">' + reasonLen + "/" + REVERT_REASON_MAX + '</span></div>' +
          '<textarea id="revertReason" rows="3" maxlength="' + REVERT_REASON_MAX + '" placeholder="Why is this being reverted? (required)">' + esc(state.modal.reason || "") + "</textarea></div>") +
      "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
      (!confirmed
        ? '<button class="btn btn-primary" data-action="revert-confirm-step">Yes, revert</button>'
        : '<button class="btn btn-primary" data-action="revert-submit">Confirm revert</button>') +
      "</div></div></div>";
  }
  function agencyModalHtml() {
    var editing = !!state.modal.data;
    var d = state.modal.data || {};
    var plants = (state.lookups ? state.lookups.plants : []).map(function (p) { return '<option value="' + p.id + '"' + (p.id === d.plantId ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("");
    return '<div class="overlay"><div class="modal">' +
      '<div class="modal-head"><div class="icon-chip">' + icon("folder", 18) + '</div><div class="titles"><h3>' + (editing ? "Edit agency" : "Create agency") + '</h3></div>' +
      '<button class="modal-close" data-action="close-modal">' + icon("x", 15) + "</button></div>" +
      '<div class="modal-body"><div class="field"><label>Plant</label>' + ssHtml("agPlant", plants, "Search plant...") + "</div>" +
      '<div class="field"><label>Agency name</label><input id="agName" value="' + esc(d.name || "") + '" /></div>' +
      '<div class="field"><label>Description (optional)</label><textarea id="agDesc" rows="2">' + esc(d.description || "") + "</textarea></div></div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
      '<button class="btn btn-primary" data-action="submit-agency" data-edit="' + (editing ? d.agencyId : "") + '">' + (editing ? "Save changes" : "Create agency") + "</button></div></div></div>";
  }
  // ssHtml/syncSsel/showSselList now live in common.js (shared by every page).
  function complianceModalHtml() {
    var editing = !!state.modal.data;
    var d = state.modal.data || {};
    var L = state.lookups || { plants: [] };
    return '<div class="overlay"><div class="modal">' +
      '<div class="modal-head"><div class="icon-chip">' + icon("shield", 18) + '</div><div class="titles"><h3>' + (editing ? "Edit compliance" : "Create compliance") + '</h3></div>' +
      '<button class="modal-close" data-action="close-modal">' + icon("x", 15) + "</button></div>" +
      '<div class="modal-body">' +
      '<div class="section-label">Location</div>' +
      '<div class="field-row"><div><label>Plant</label>' + ssHtml("cPlant", L.plants.map(function (p) { return '<option value="' + p.id + '"' + (p.id === d.plantId ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join(""), "Search plant...") + "</div>" +
      '<div><label>Agency</label>' + ssHtml("cAgency", "", "Search agency...") + "</div></div>" +
      '<div class="field"><label>Compliance name</label><input id="cName" value="' + esc(d.name || "") + '" /></div>' +
      '<div class="field combo-wrap"><label>Category</label>' +
      '<input type="text" id="cCategoryInput" autocomplete="off" placeholder="Search category..." value="' + esc(d.category || "") + '" />' +
      '<input type="hidden" id="cCategoryValue" value="' + esc(d.category || "") + '" />' +
      '<div class="combo-list" id="cCategoryList" hidden></div></div>' +
      '<div class="section-label">Assignment</div>' +
      '<div class="field"><label>Department</label>' + ssHtml("cDept", "", "Search department...") + "</div>" +
      '<div class="field-row"><div><label>Owner</label>' + ssHtml("cOwner", "", "Search owner...") + "</div>" +
      '<div><label>Reviewer</label>' + ssHtml("cReviewer", '<option value="">None</option>', "Search reviewer...") + "</div></div>" +
      '<div class="section-label">Schedule</div>' +
      '<div class="field-row"><div><label>Start date</label>' +
      (editing
        ? '<div class="static-field">' + esc(fmtDate(d.startDate)) + '</div><input type="hidden" id="cStart" value="' + esc(d.startDate || isoDate(new Date())) + '" />'
        : '<input type="date" id="cStart" value="' + esc(d.startDate || isoDate(new Date())) + '" />') +
      "</div>" +
      '<div id="cFreqField"><label>Frequency</label>' +
      '<div style="display:flex;gap:8px"><input type="number" min="1" id="cFreqNum" value="' + (d.frequencyNumber || 1) + '" style="width:70px" />' +
      ssHtml("cFreqUnit", freqUnitOptionsHtml(d.category || "", d.frequencyUnit || "month"), "Search frequency...") + "</div>" +
      "</div></div>" +
      (editing ? '<div class="field-note">Start date is locked once a compliance is created. Changing frequency recalculates the next due date.</div>' : "") +
      '<div class="field"><label>Next due date</label><div class="due-preview" id="cDuePreview">—</div></div>' +
      "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
      '<button class="btn btn-primary" data-action="submit-compliance" data-edit="' + (editing ? d.complianceId : "") + '">' + (editing ? "Save changes" : "Create compliance") + "</button></div></div></div>";
  }
  // Agency list only depends on Plant - it's populated separately (on modal open / Plant change),
  // never from here, so editing Start date/Frequency/Category can no longer reset the Agency pick.
  function recomputeDuePreview() {
    var isAsWhen = $("#cFreqUnit").val() === FREQ_ASANDWHEN;
    $("#cFreqNum").toggle(!isAsWhen);

    var d = state.modal.data;
    var editing = d && d.complianceId;

    if (!editing) {
      // Create: brand new compliance, so its first due date really is start date + frequency.
      if (isAsWhen) { $("#cDuePreview").text(fmtDate($("#cStart").val()) + " — owner sets each next due date"); return; }
      var dueNew = addInterval($("#cStart").val(), parseInt($("#cFreqNum").val(), 10) || 1, $("#cFreqUnit").val());
      $("#cDuePreview").text(fmtDate(isoDate(dueNew)));
      return;
    }

    // Edit: never re-derive from Start Date - that would discard real fulfilment progress. Only
    // recompute when something that actually drives scheduling changed (frequency, or - only for a
    // compliance that's never been fulfilled - the start date itself); otherwise show the real,
    // unchanged current due date. When it does recompute, anchor to the last fulfilment (or start
    // date if there isn't one yet), matching exactly what EditCompliance will save.
    var freqNum = parseInt($("#cFreqNum").val(), 10) || 1;
    var freqUnit = $("#cFreqUnit").val();
    var startVal = $("#cStart").val();
    var freqChanged = freqNum !== d.frequencyNumber || freqUnit !== d.frequencyUnit;
    var startChanged = !d.hasFulfillments && startVal !== d.startDate;

    if (!freqChanged && !startChanged) {
      $("#cDuePreview").text(fmtDate(d.nextDueDate) + " — unchanged");
      return;
    }

    var anchor = d.hasFulfillments ? d.anchorDate : startVal;
    if (isAsWhen) { $("#cDuePreview").text(fmtDate(anchor) + " — owner sets each next due date"); return; }
    var dueEdit = addInterval(anchor, freqNum, freqUnit);
    $("#cDuePreview").text(fmtDate(isoDate(dueEdit)) + " — recalculated");
  }
  // Return can't use the As and When frequency (its filing-window cutoff needs a real interval) - the
  // option is left out of the list entirely whenever Category is Return, forcing a real frequency there.
  function freqUnitOptionsHtml(category, selected) {
    var opts = [
      { value: "day", label: "Day(s)" },
      { value: "week", label: "Week(s)" },
      { value: "month", label: "Month(s)" },
      { value: "year", label: "Year(s)" }
    ];
    if (category !== "Return") opts.push({ value: FREQ_ASANDWHEN, label: "As and When" });
    if (selected === FREQ_ASANDWHEN && category === "Return") selected = "month";
    return opts.map(function (o) { return '<option value="' + o.value + '"' + (o.value === selected ? " selected" : "") + ">" + o.label + "</option>"; }).join("");
  }
  // Rebuilds the Frequency dropdown whenever Category changes, so "As and When" appears/disappears
  // as Return is picked/unpicked, without disturbing whatever else the master has already chosen.
  function refreshFreqUnitOptions() {
    var category = $("#cCategoryValue").val();
    $("#cFreqUnit").html(freqUnitOptionsHtml(category, $("#cFreqUnit").val() || "month"));
    syncSsel("cFreqUnit");
  }
  function populateAgencySelect() {
    var plantId = parseInt($("#cPlant").val(), 10);
    var target = state.modal.data && state.modal.data.agencyId;
    api("GetAgencies", { sessionId: state.session.sessionId, plantId: plantId }).then(function (agencies) {
      $("#cAgency").html(agencies.map(function (a) { return '<option value="' + a.agencyId + '"' + (a.agencyId === target ? " selected" : "") + ">" + esc(a.name) + "</option>"; }).join(""));
      syncSsel("cAgency");
    });
  }
  // Owner/Reviewer are picked from the same Plant+Dept, sourced live from the access tables — not stored on the compliance.
  function refreshDeptSelect(prefillDeptId, prefillOwnerToken, prefillReviewerToken) {
    var plantId = parseInt($("#cPlant").val(), 10);
    api("GetDepartmentsForPlant", { sessionId: state.session.sessionId, plantId: plantId }).then(function (depts) {
      $("#cDept").html((depts || []).map(function (d) { return '<option value="' + d.deptId + '"' + (d.deptId === prefillDeptId ? " selected" : "") + ">" + esc(d.name) + "</option>"; }).join(""));
      syncSsel("cDept");
      refreshPeoplePicker(prefillOwnerToken, prefillReviewerToken);
    });
  }
  function refreshPeoplePicker(prefillOwnerToken, prefillReviewerToken) {
    var plantId = parseInt($("#cPlant").val(), 10), deptId = parseInt($("#cDept").val(), 10);
    if (!deptId) { $("#cOwner").html(""); $("#cReviewer").html('<option value="">None</option>'); syncSsel("cOwner"); syncSsel("cReviewer"); return; }
    api("GetPeoplePicker", { sessionId: state.session.sessionId, plantId: plantId, deptId: deptId }).then(function (people) {
      $("#cOwner").html((people.owners || []).map(function (p) { return '<option value="' + p.token + '"' + (p.token === prefillOwnerToken ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join(""));
      $("#cReviewer").html('<option value="">None</option>' + (people.reviewers || []).map(function (p) { return '<option value="' + p.token + '"' + (p.token === prefillReviewerToken ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join(""));
      syncSsel("cOwner");
      syncSsel("cReviewer");
    });
  }
  if (String.prototype.trim && $.fn.on) { /* no-op guard for older browsers */ }
  var setFreqUnit = function (unit) { if (unit) $("#cFreqUnit").val(unit); };

  // ---------- Category combobox (search-as-you-type over a fixed list) ----------
  function showCategoryList(filterText) {
    var q = (filterText || "").trim().toLowerCase();
    var matches = CATEGORIES.filter(function (c) { return c.toLowerCase().indexOf(q) !== -1; });
    if (!matches.length) { $("#cCategoryList").attr("hidden", true).empty(); return; }
    $("#cCategoryList").html(matches.map(function (c) {
      return '<div class="combo-item" data-value="' + esc(c) + '">' + esc(c) + "</div>";
    }).join("")).removeAttr("hidden");
  }
  function pickCategory(value) {
    $("#cCategoryInput").val(value);
    $("#cCategoryValue").val(value);
    $("#cCategoryList").attr("hidden", true).empty();
    refreshFreqUnitOptions();
    recomputeDuePreview();
  }

  // ---------- Event binding ----------
  function bindEvents() {
    $("#app").off("click").on("click", function (e) {
      // Backdrop click closes the modal, but only when the click lands on the backdrop itself,
      // not when it bubbles up from something inside the modal (an input, a blank label, etc).
      if ($(e.target).hasClass("overlay")) { state.modal = null; render(); return; }

      var t = $(e.target).closest("[data-action]");
      if (!t.length) return;
      var action = t.data("action");
      handleAction(action, t, e);
    });
    $("#app").off("click", ".combo-item").on("click", ".combo-item", function () { pickCategory($(this).data("value")); });
    $("#app").off("focus input", "#cCategoryInput").on("focus input", "#cCategoryInput", function (e) {
      if (e.type === "input") $("#cCategoryValue").val("");
      showCategoryList($(this).val());
    });
    $(document).off("click.categoryOutside").on("click.categoryOutside", function (e) {
      if (!$(e.target).closest(".combo-wrap").length) $("#cCategoryList").attr("hidden", true).empty();
    });
    // Generic searchable select interactions (focus/input/select/close) are bound globally in common.js.
    $("#app").off("change", "#fySelect").on("change", "#fySelect", function () { state.fy = $(this).val(); loadCompliances(); });
    $("#app").off("change", "#cPlant").on("change", "#cPlant", function () { populateAgencySelect(); recomputeDuePreview(); refreshDeptSelect(); });
    $("#app").off("change", "#cDept").on("change", "#cDept", function () { refreshPeoplePicker(); });
    $("#app").off("change input", "#cStart,#cFreqNum,#cFreqUnit").on("change input", "#cStart,#cFreqNum,#cFreqUnit", function () { recomputeDuePreview(); });
    $("#app").off("change", "#attachFileInput").on("change", "#attachFileInput", onFileChosen);
    $("#app").off("input", "#remarks").on("input", "#remarks", function () {
      state.tempRemarks = $(this).val();
      $("#remarksCount").text(state.tempRemarks.length + "/" + REMARKS_MAX);
    });
    $("#app").off("change", "#completionDate").on("change", "#completionDate", function () {
      state.tempCompletionDate = $(this).val();
      $("#completionFy").text(fyOf(state.tempCompletionDate));
      var d = state.detail;
      // Return's next due date is anchored to the old due date, not the completion date - the preview never moves.
      // As and When has no computed preview at all - the owner types the next due date in directly.
      if (d && d.category !== "Return" && d.frequencyUnit !== FREQ_ASANDWHEN) {
        fetchPreview(d.complianceId, state.tempCompletionDate).then(function (p) {
          if (!p || $("#completionDate").val() !== state.tempCompletionDate) return; // picker moved again meanwhile
          d.preview = p;
          $("#fulfillDuePreview").text(fmtDate(p.nextDue));
          $("#fulfillDueFy").text(fyOf(p.nextDue));
        });
      }
    });
    $("#app").off("change", "#manualNextDue").on("change", "#manualNextDue", function () {
      state.tempManualNextDue = $(this).val();
      $("#manualNextDueFy").text(fyOf(state.tempManualNextDue));
    });
    $("#app").off("input", "#revertReason").on("input", "#revertReason", function () {
      state.modal.reason = $(this).val();
      $("#revertReasonCount").text(state.modal.reason.length + "/" + REVERT_REASON_MAX);
    });
    $(document).off("click.notifOutside").on("click.notifOutside", function (e) {
      if (state.notifOpen && !$(e.target).closest(".notif-panel,.notif-wrap").length) { state.notifOpen = false; render(); }
      if (state.userMenuOpen && !$(e.target).closest(".user-menu,.user-wrap").length) { state.userMenuOpen = false; render(); }
      if (state.createMenuOpen && !$(e.target).closest(".create-menu,.create-wrap").length) { state.createMenuOpen = false; render(); }
      if (state.reportsMenuOpen && !$(e.target).closest(".reports-wrap").length) { state.reportsMenuOpen = false; render(); }
      if (state.configMenuOpen && !$(e.target).closest(".config-wrap").length) { state.configMenuOpen = false; render(); }
      if (state.agencyMenuOpenId && !$(e.target).closest(".card-menu-wrap,.card-menu-fixed").length) { state.agencyMenuOpenId = null; render(); }
      if (state.complianceMenuOpenId && !$(e.target).closest(".row-menu-wrap,.card-menu-fixed").length) { state.complianceMenuOpenId = null; render(); }
    });
  }

  function handleAction(action, t) {
    var id = t.data("id");
    switch (action) {
      case "crumb-root": goRoot(); break;
      case "crumb-plant": state.agencyId = null; state.complianceId = null; render(); break;
      case "crumb-agency": state.complianceId = null; render(); break;
      case "go-back":
        if (screenLevel() === 4 && state.fromSchedule) { backToSchedule(); }
        else if (screenLevel() === 4) { state.complianceId = null; render(); }
        else if (screenLevel() === 3) { state.agencyId = null; render(); }
        else if (screenLevel() === 2) { goRoot(); }
        break;
      case "go-plant": goPlant(id); break;
      case "go-agency": goAgency(id); break;
      case "go-compliance": goCompliance(id); break;
      case "sign-out": signOut(); break;
      case "go-training": window.location.href = "Training.aspx?sessionId=" + encodeURIComponent(state.session.sessionId); break;
      case "toggle-user-menu":
        state.userMenuOpen = !state.userMenuOpen;
        render();
        break;
      case "toggle-notif":
        state.notifOpen = !state.notifOpen;
        if (state.notifOpen) loadNotifications().then(render); else render();
        break;
      case "notif-goto":
        state.notifOpen = false;
        var cid = t.data("compliance");
        api("GetComplianceDetail", { sessionId: state.session.sessionId, complianceId: cid }).then(attachPreview).then(function (d) {
          state.detail = d; state.complianceId = cid; state.plantId = null; state.agencyId = null; render();
        });
        break;
      case "toggle-create-menu":
        state.createMenuOpen = !state.createMenuOpen;
        render();
        break;
      case "toggle-reports-menu":
        state.reportsMenuOpen = !state.reportsMenuOpen;
        render();
        break;
      case "toggle-config-menu":
        state.configMenuOpen = !state.configMenuOpen;
        render();
        break;
      case "open-agency-modal":
        state.createMenuOpen = false;
        ensureLookups(function () { state.modal = { type: "agency" }; render(); });
        break;
      case "open-compliance-modal":
        state.createMenuOpen = false;
        state.complianceMenuOpenId = null;
        var editId = t.data("edit");
        ensureLookups(function () {
          if (editId) {
            api("GetComplianceDetail", { sessionId: state.session.sessionId, complianceId: editId }).then(function (d) {
              state.modal = { type: "compliance", data: {
                complianceId: editId, name: d.name, category: d.category, startDate: d.startDate, frequencyNumber: d.frequencyNumber, frequencyUnit: d.frequencyUnit,
                plantId: d.plantId, agencyId: d.agencyId, deptId: d.deptId, ownerToken: d.ownerToken, reviewerToken: d.reviewerToken,
                // Editing must never re-derive the next due date from Start Date - that would silently
                // discard everything the compliance already progressed through via real fulfilments.
                // Keep the real current due date, and the right anchor to recompute from if frequency
                // actually changes: the last real fulfilment, or Start Date if it's never been fulfilled.
                nextDueDate: d.nextDueDate, hasFulfillments: d.logs.length > 0, anchorDate: d.logs.length ? d.logs[0].actionDate : d.startDate
              }};
              render(); setFreqUnit(d.frequencyUnit);
            });
          } else { state.modal = { type: "compliance", data: null }; render(); }
        });
        break;
      case "close-modal": state.modal = null; render(); break;
      case "submit-agency": submitAgency(t.data("edit")); break;
      case "submit-compliance": submitCompliance(t.data("edit")); break;
      case "attach-file": $("#attachFileInput").trigger("click"); break;
      case "remove-attachment": state.tempAttachments.splice(t.data("idx"), 1); render(); break;
      case "mark-complete": submitFulfillment(); break;
      case "open-revert": state.modal = { type: "revert", logId: t.data("log"), confirmed: false, reason: "" }; render(); break;
      case "revert-confirm-step": state.modal.confirmed = true; render(); break;
      case "revert-submit": submitRevert(); break;
      case "toggle-agency-menu":
        state.agencyMenuOpenId = state.agencyMenuOpenId === id ? null : id;
        render();
        break;
      case "edit-agency":
        state.agencyMenuOpenId = null;
        var agencyToEdit = findAgency(id);
        ensureLookups(function () {
          state.modal = { type: "agency", data: { agencyId: id, plantId: state.plantId, name: agencyToEdit.name, description: agencyToEdit.description } };
          render();
        });
        break;
      case "delete-agency":
        state.agencyMenuOpenId = null;
        var agencyToDelete = findAgency(id);
        state.modal = { type: "delete-agency", agencyId: id, agencyName: agencyToDelete.name, plantName: findPlant(state.plantId) ? findPlant(state.plantId).name : "", step: 1, impact: null };
        render();
        break;
      case "delete-agency-next":
        state.modal.step = 2;
        render();
        api("GetAgencyDeleteImpact", { sessionId: state.session.sessionId, agencyId: state.modal.agencyId }).then(function (impact) {
          if (state.modal && state.modal.type === "delete-agency") { state.modal.impact = impact; render(); }
        });
        break;
      case "delete-agency-confirm": submitDeleteAgency(); break;
      case "toggle-compliance-menu":
        state.complianceMenuOpenId = state.complianceMenuOpenId === id ? null : id;
        render();
        break;
      case "delete-compliance":
        state.complianceMenuOpenId = null;
        var complianceToDelete = state.compliances.filter(function (c) { return c.complianceId === id; })[0];
        state.modal = { type: "delete-compliance", complianceId: id, complianceName: complianceToDelete ? complianceToDelete.name : "", agencyName: findAgency(state.agencyId) ? findAgency(state.agencyId).name : "", step: 1, impact: null };
        render();
        break;
      case "delete-compliance-next":
        state.modal.step = 2;
        render();
        api("GetComplianceDeleteImpact", { sessionId: state.session.sessionId, complianceId: state.modal.complianceId }).then(function (impact) {
          if (state.modal && state.modal.type === "delete-compliance") { state.modal.impact = impact; render(); }
        });
        break;
      case "delete-compliance-confirm": submitDeleteCompliance(); break;
    }
  }

  function ensureLookups(cb) {
    if (state.lookups) { cb(); return; }
    api("GetLookups", { sessionId: state.session.sessionId }).then(function (d) { state.lookups = d; cb(); });
  }

  function submitAgency(editId) {
    var name = $("#agName").val();
    if (!name || !name.trim()) { toast("Enter an agency name to continue.", true); return; }
    var payload = { sessionId: state.session.sessionId, plantId: parseInt($("#agPlant").val(), 10), name: name, description: $("#agDesc").val() };
    var call;
    if (editId) { payload.agencyId = editId; call = api("EditAgency", payload); }
    else call = api("CreateAgency", payload);
    call.then(function () {
      toast(editId ? "Agency updated" : 'Agency "' + name + '" created');
      state.modal = null;
      if (screenLevel() === 2) loadAgencies(); else render();
    });
  }

  function submitDeleteAgency() {
    var m = state.modal;
    var $btn = $("[data-action='delete-agency-confirm']");
    $btn.prop("disabled", true).html('<span class="btn-spinner"></span> Deleting...');
    api("DeleteAgency", { sessionId: state.session.sessionId, agencyId: m.agencyId }).then(function () {
      toast('Agency "' + m.agencyName + '" and everything under it has been permanently deleted');
      state.modal = null;
      loadAgencies();
    }, function () {
      $btn.prop("disabled", false).html("Delete permanently");
    });
  }

  function submitDeleteCompliance() {
    var m = state.modal;
    var $btn = $("[data-action='delete-compliance-confirm']");
    $btn.prop("disabled", true).html('<span class="btn-spinner"></span> Deleting...');
    api("DeleteCompliance", { sessionId: state.session.sessionId, complianceId: m.complianceId }).then(function () {
      toast('Compliance "' + m.complianceName + '" and its fulfilment history have been permanently deleted');
      state.modal = null;
      if (state.complianceId === m.complianceId) state.complianceId = null;
      loadCompliances();
    }, function () {
      $btn.prop("disabled", false).html("Delete permanently");
    });
  }

  function submitCompliance(editId) {
    var name = $("#cName").val(), start = $("#cStart").val();
    if (!name || !name.trim() || !start) { toast("Fill in the compliance name and start date.", true); return; }
    var ownerToken = $("#cOwner").val();
    if (!ownerToken) { toast("Pick an owner for this compliance.", true); return; }
    var category = $("#cCategoryValue").val();
    if (!category || CATEGORIES.indexOf(category) === -1) { toast("Pick a category from the list.", true); return; }
    var input = {
      agencyId: parseInt($("#cAgency").val(), 10), plantId: parseInt($("#cPlant").val(), 10),
      name: name, category: category, description: "", ownerToken: ownerToken,
      reviewerToken: $("#cReviewer").val() || null,
      startDate: start, frequencyNumber: parseInt($("#cFreqNum").val(), 10) || 1, frequencyUnit: $("#cFreqUnit").val()
    };
    var call = editId ? api("EditCompliance", { sessionId: state.session.sessionId, complianceId: editId, input: input })
                       : api("CreateCompliance", { sessionId: state.session.sessionId, input: input });
    call.then(function () {
      toast(editId ? "Compliance updated" : 'Compliance "' + name + '" created');
      state.modal = null;
      if (state.complianceId) loadDetail(); else if (screenLevel() === 3) loadCompliances(); else render();
    });
  }

  function onFileChosen(e) {
    var file = e.target.files[0]; if (!file) return;
    if (state.tempAttachments.length >= MAX_ATTACHMENTS) { toast("You can attach up to " + MAX_ATTACHMENTS + " files.", true); e.target.value = ""; return; }
    var fd = new FormData();
    fd.append("sessionId", state.session.sessionId);
    fd.append("complianceId", state.complianceId);
    fd.append("file", file);
    $.ajax({ url: UPLOAD_URL, type: "POST", data: fd, processData: false, contentType: false }).then(function (res) {
      if (!res.ok) { toast(res.message, true); return; }
      state.tempAttachments.push(res.data);
      render();
    });
  }

  function submitFulfillment() {
    var d = state.detail;
    var manualNextDueDate = null;
    if (d && d.frequencyUnit === FREQ_ASANDWHEN) {
      manualNextDueDate = $("#manualNextDue").val();
      if (!manualNextDueDate) { toast("Enter the next due date.", true); return; }
    }
    var reminders = [];
    $(".rem-days").each(function () {
      var label = $(this).data("label");
      reminders.push({ label: label, daysBeforeDue: parseInt($(this).val(), 10) || 0 });
    });
    // Lock the whole page and show a spinner on the button until the save fully succeeds (or fails) -
    // the owner shouldn't be able to change anything mid-submit.
    var $btn = $("[data-action='mark-complete']");
    var originalBtnHtml = $btn.html();
    $btn.prop("disabled", true).html('<span class="btn-spinner"></span> Submitting...');
    $(".container").addClass("is-locked");
    api("MarkComplete", {
      sessionId: state.session.sessionId, complianceId: state.complianceId,
      completionDate: $("#completionDate").val(), remarks: $("#remarks").val(),
      attachments: state.tempAttachments.map(function (a) { return { fileName: a.fileName, fileUrl: a.fileUrl }; }), reminders: reminders,
      manualNextDueDate: manualNextDueDate
    }).then(function (res) {
      state.tempAttachments = []; state.tempRemarks = ""; state.tempCompletionDate = null; state.tempManualNextDue = null;
      if (state.fromSchedule) {
        redirectToScheduleAfterComplete(res.nextDueDate);
      } else {
        toast("Compliance marked complete — next due date recalculated to " + fmtDate(res.nextDueDate));
      }
      loadDetail();
      if (state.session.role === "master" || state.session.role === "owner") loadNotifications().then(render);
    }, function () {
      $(".container").removeClass("is-locked");
      $btn.prop("disabled", false).html(originalBtnHtml);
    });
  }

  function submitRevert() {
    var reason = (state.modal.reason || "").trim();
    if (!reason) { toast("Enter a reason to revert.", true); return; }
    var logId = state.modal.logId;
    var $btn = $("[data-action='revert-submit']");
    var originalBtnHtml = $btn.html();
    $btn.prop("disabled", true).html('<span class="btn-spinner"></span> Reverting...');
    $(".modal").addClass("is-locked");
    $(".container").addClass("is-locked");
    api("RevertFulfillment", { sessionId: state.session.sessionId, logId: logId, reason: reason }).then(function (res) {
      state.modal = null;
      toast("Fulfilment reverted — next due date recalculated to " + fmtDate(res.nextDueDate));
      loadDetail();
    }, function () {
      $(".container").removeClass("is-locked");
      $(".modal").removeClass("is-locked");
      $btn.prop("disabled", false).html(originalBtnHtml);
    });
  }

  function redirectToScheduleAfterComplete(nextDueDate) {
    state.scheduleRedirecting = true;
    $(".detail-body").addClass("is-locked");
    $(".toast").remove();
    var n = 5;
    var el = $('<div class="toast toast-redirect">' + icon("check", 16) +
      '<span id="redirectMsg">Compliance marked complete — next due date recalculated to ' + esc(fmtDate(nextDueDate)) +
      '. Taking you back to Schedule in ' + n + '...</span></div>').appendTo("body");
    var timer = setInterval(function () {
      n--;
      if (n <= 0) {
        clearInterval(timer);
        window.location.href = "Schedule.aspx";
        return;
      }
      el.find("#redirectMsg").text("Compliance marked complete — next due date recalculated to " + fmtDate(nextDueDate) + ". Taking you back to Schedule in " + n + "...");
    }, 1000);
  }

  // ---------- Boot ----------
  $(function () {
    var qs = new URLSearchParams(window.location.search);
    var deepLinkId = qs.get("complianceId");
    if (state.session) {
      api("ValidateSession", { sessionId: state.session.sessionId }).then(function (r) {
        if (!r.valid) { signOut(); return; }
        state.session.plantName = r.plantName; state.session.deptName = r.deptName;
        sessionStorage.setItem("statum.session", JSON.stringify(state.session));
        if (deepLinkId) {
          var cid = parseInt(deepLinkId, 10);
          api("GetComplianceDetail", { sessionId: state.session.sessionId, complianceId: cid }).then(attachPreview).then(function (d) {
            state.detail = d; state.complianceId = cid; state.plantId = null; state.agencyId = null;
            state.tempAttachments = []; state.tempRemarks = ""; state.tempCompletionDate = null; state.tempManualNextDue = null;
            state.fromSchedule = qs.get("from") === "schedule";
            loadPlants();
            if (state.session.role === "master" || state.session.role === "owner") loadNotifications().then(render);
            render();
          });
        } else {
          goRoot();
        }
      });
    } else if (qs.get("jwt")) {
      // New SSO redirect: Default.aspx?jwt=<double-url-encoded base64 pipe token>.
      loginViaJwt(decodeURIComponent(qs.get("jwt")));
    } else if (qs.get("token") && qs.get("role")) {
      // Real SSO redirect lands here with token+role (base64-encoded) already decided — no login screen needed.
      loginViaSso(qs.get("token"), qs.get("role"));
    } else render();
  });
})();
