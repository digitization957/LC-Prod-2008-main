/* Compliance Management App — Mail Configuration (master-only). Standalone; reuses the app's design tokens. */
(function () {
  "use strict";

  var API = "ComplianceService.asmx/";
  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get("sessionId");

  var TABS = [
    {
      id: "monday", label: "Monday",
      desc: "<b>Monday summary</b> — the weekly status roundup sent every Monday morning, for {plant}.",
      groups: [{ key: "cc", label: "Cc" }]
    },
    {
      id: "reminders", label: "Reminders",
      desc: "<b>Reminders</b> — sent whenever a compliance turns Due or Overdue, for {plant}. Each stage escalates to its own Cc list.",
      groups: [
        { key: "r1", label: "R1", sub: "First reminder" },
        { key: "r2", label: "R2", sub: "Second reminder" },
        { key: "r3", label: "R3", sub: "Third reminder" },
        { key: "r4", label: "R4", sub: "Final reminder" }
      ]
    }
  ];

  var plants = [];          // [{plantId, name, ...}]
  var currentPlantId = 0;
  var data = {};            // keyed [plantId][tab][group] -> [{token,name,manual}]
  var saved = {};           // last-saved snapshot per plant, used by Cancel
  var activeTab = "monday";
  var dirty = {};           // keyed "plantId:tab" -> bool
  var searchTimer = null;

  function icon(name, size) {
    size = size || 16;
    var paths = {
      alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/>',
      check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'
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

  function currentTab() { return TABS.filter(function (t) { return t.id === activeTab; })[0]; }
  function cloneData(d) { return JSON.parse(JSON.stringify(d)); }
  function plantName(id) { var p = plants.filter(function (x) { return x.plantId === id; })[0]; return p ? p.name : ""; }
  function dirtyKey(plantId, tabId) { return plantId + ":" + tabId; }
  function isDirty(plantId, tabId) { return !!dirty[dirtyKey(plantId, tabId)]; }
  function setDirty(plantId, tabId, v) { dirty[dirtyKey(plantId, tabId)] = v; }

  /* ---------------- Render ---------------- */

  function renderPlantSwitch() {
    $("#plantSwitch").html(plants.map(function (p) {
      return '<button type="button" class="plant-switch-btn' + (p.plantId === currentPlantId ? " active" : "") + '" data-plant="' + p.plantId + '">' + esc(p.name) + "</button>";
    }).join(""));
  }

  function renderTabs() {
    var html = TABS.map(function (t) {
      var n = t.groups.reduce(function (sum, g) { return sum + data[currentPlantId][t.id][g.key].length; }, 0);
      return '<button type="button" class="mail-tab' + (t.id === activeTab ? " active" : "") + '" data-tab="' + t.id + '">' +
        esc(t.label) + ' <span class="tcount">' + n + "</span></button>";
    }).join("");
    $("#mailTabs").html(html);
    $("#mailTabDesc").html(currentTab().desc.replace("{plant}", esc(plantName(currentPlantId))));
  }

  function renderPanels() {
    var groups = currentTab().groups;
    var $grid = $("#recipientGrid").attr("class", "recipient-grid" + (groups.length === 1 ? " single" : ""));
    $grid.html(groups.map(function (g) {
      return '<div class="panel" data-group="' + g.key + '">' +
        '<div class="panel-head"><h3><span class="field-tag">CC</span> ' + esc(g.label) +
          (g.sub ? ' <span class="group-sub">· ' + esc(g.sub) + "</span>" : "") + '</h3>' +
          '<span class="count-chip" data-count="' + g.key + '">0 added</span></div>' +
        '<div class="combo-wrap">' +
          '<input class="ssel-input mail-search" data-search="' + g.key + '" type="text" placeholder="Search by name or token…" autocomplete="off" />' +
          '<div class="combo-list" data-list="' + g.key + '" hidden></div>' +
        "</div>" +
        '<button type="button" class="manual-toggle" data-manual-toggle="' + g.key + '">+ Add token manually</button>' +
        '<div class="manual-row" data-manual-row="' + g.key + '">' +
          '<input type="text" data-manual-input="' + g.key + '" placeholder="Type a token or email…" />' +
          '<button type="button" data-manual-add="' + g.key + '">Add</button>' +
        "</div>" +
        '<div class="mail-chips" data-chips="' + g.key + '"></div>' +
      "</div>";
    }).join(""));

    renderChips();
    renderSaveBar();
  }

  function renderChips() {
    currentTab().groups.forEach(function (g) {
      var key = g.key;
      var list = data[currentPlantId][activeTab][key];
      $('[data-count="' + key + '"]').text(list.length + " added");
      var $c = $('[data-chips="' + key + '"]');
      if (!list.length) { $c.html('<span class="mail-chip-empty">No recipients added yet</span>'); return; }
      $c.html(list.map(function (p, i) {
        return '<span class="mail-chip' + (p.manual ? " manual" : "") + '">' +
          '<span class="cname">' + esc(p.name) + "</span>" +
          (p.manual ? '<span class="manual-flag">manual</span>' : '<span class="ctok">' + esc(p.token) + "</span>") +
          '<button type="button" class="rm" data-rm="' + key + '" data-idx="' + i + '" title="Remove">×</button>' +
        "</span>";
      }).join(""));
    });
  }

  function renderSaveBar() {
    var dirtyNow = isDirty(currentPlantId, activeTab);
    $("#mailSaveBar").html(
      '<span class="status' + (dirtyNow ? " dirty" : "") + '">' + (dirtyNow ? "Unsaved changes" : "All changes saved") + " · " + esc(currentTab().label) + " · " + esc(plantName(currentPlantId)) + "</span>" +
      '<button type="button" class="btn btn-outline" id="mailCancelBtn">Cancel</button>' +
      '<button type="button" class="btn btn-primary" id="mailSaveBtn">Save ' + esc(currentTab().label) + " config</button>"
    );
  }

  function markDirty() { setDirty(currentPlantId, activeTab, true); renderTabs(); renderSaveBar(); }

  /* ---------------- Search / manual add / remove ---------------- */

  function closeAllLists() { $(".combo-list").attr("hidden", true).empty(); }

  function doSearch(key, q) {
    api("SearchMailPeople", { query: q }).then(function (people) {
      var already = {};
      data[currentPlantId][activeTab][key].forEach(function (p) { already[p.token.toLowerCase()] = true; });
      var matches = (people || []).filter(function (p) { return !already[p.token.toLowerCase()]; });
      var $list = $('[data-list="' + key + '"]');
      $list.html(matches.length
        ? matches.map(function (p) {
            return '<div class="combo-item" data-token="' + esc(p.token) + '" data-name="' + esc(p.name) + '"><span class="cn">' + esc(p.name) + '</span><span class="ct">' + esc(p.token) + "</span></div>";
          }).join("")
        : '<div class="combo-empty">No match in directory — try “Add token manually” below</div>'
      ).removeAttr("hidden");
    }, showError);
  }

  $(document).on("input focus", ".mail-search", function () {
    var $input = $(this), key = $input.data("search"), q = ($input.val() || "").trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { doSearch(key, q); }, 180);
  });

  $(document).on("mousedown", ".combo-list .combo-item", function (e) {
    e.preventDefault();
    var key = $(this).closest(".combo-list").data("list");
    data[currentPlantId][activeTab][key].push({ token: $(this).data("token"), name: $(this).data("name"), manual: false });
    $('[data-search="' + key + '"]').val("");
    closeAllLists(); markDirty(); renderChips();
  });

  $(document).on("mousedown", function (e) {
    if (!$(e.target).closest(".combo-wrap").length) closeAllLists();
  });

  $(document).on("click", "[data-manual-toggle]", function () {
    var key = $(this).data("manual-toggle");
    var $row = $('[data-manual-row="' + key + '"]').toggleClass("show");
    if ($row.hasClass("show")) $('[data-manual-input="' + key + '"]').focus();
  });

  function addManual(key) {
    var $input = $('[data-manual-input="' + key + '"]');
    var v = ($input.val() || "").trim();
    if (!v) return;
    var exists = data[currentPlantId][activeTab][key].some(function (p) { return p.token.toLowerCase() === v.toLowerCase(); });
    if (exists) { $input.val(""); return; }
    data[currentPlantId][activeTab][key].push({ token: v, name: v, manual: true });
    $input.val("");
    markDirty(); renderChips();
  }
  $(document).on("click", "[data-manual-add]", function () { addManual($(this).data("manual-add")); });
  $(document).on("keydown", "[data-manual-input]", function (e) {
    if (e.key === "Enter") { e.preventDefault(); addManual($(this).data("manual-input")); }
  });

  $(document).on("click", "[data-rm]", function () {
    var key = $(this).data("rm"), idx = $(this).data("idx");
    data[currentPlantId][activeTab][key].splice(idx, 1);
    markDirty(); renderChips();
  });

  /* ---------------- Plant / Tabs / Save / Cancel ---------------- */

  function ensurePlantLoaded(plantId, cb) {
    if (data[plantId]) { cb(); return; }
    api("GetMailConfig", { plantId: plantId }).then(function (cfg) {
      data[plantId] = cfg;
      saved[plantId] = cloneData(cfg);
      cb();
    }, showError);
  }

  $(document).on("click", "[data-plant]", function () {
    var plantId = parseInt($(this).data("plant"), 10);
    if (plantId === currentPlantId) return;
    currentPlantId = plantId;
    closeAllLists();
    ensurePlantLoaded(currentPlantId, function () {
      renderPlantSwitch(); renderTabs(); renderPanels();
      if (!$("#mailLog").is("[hidden]")) loadLog();
    });
  });

  $(document).on("click", "[data-tab]", function () {
    activeTab = $(this).data("tab");
    closeAllLists(); renderTabs(); renderPanels();
    if (!$("#mailLog").is("[hidden]")) loadLog();
  });

  $(document).on("click", "#mailSaveBtn", function () {
    var plantId = currentPlantId, tabId = activeTab, $btn = $(this).prop("disabled", true).text("Saving…");
    var groups = currentTab().groups;
    var calls = groups.map(function (g) {
      return api("SaveMailGroup", {
        plantId: plantId, mailType: tabId, groupKey: g.key,
        recipients: data[plantId][tabId][g.key].map(function (p) { return { token: p.token, name: p.name, manual: p.manual }; })
      });
    });
    $.when.apply($, calls).then(function () {
      saved[plantId][tabId] = cloneData(data[plantId][tabId]);
      setDirty(plantId, tabId, false);
      $btn.prop("disabled", false);
      renderTabs(); renderSaveBar();
      toast(currentTab().label + " configuration saved for " + plantName(plantId));
      if (!$("#mailLog").is("[hidden]")) loadLog();
    }, function (xhr) { $btn.prop("disabled", false).text("Save " + currentTab().label + " config"); showError(xhr); });
  });

  $(document).on("click", "#mailCancelBtn", function () {
    data[currentPlantId][activeTab] = cloneData(saved[currentPlantId][activeTab]);
    setDirty(currentPlantId, activeTab, false);
    renderTabs(); renderPanels();
  });

  /* ---------------- Recent changes log ---------------- */

  function loadLog() {
    api("GetMailConfigLogs", { plantId: currentPlantId, mailType: activeTab }).then(function (rows) {
      if (!rows || !rows.length) { $("#mailLog").html('<div class="mail-log-empty">No changes logged yet for ' + esc(currentTab().label) + ' at ' + esc(plantName(currentPlantId)) + '.</div>'); return; }
      $("#mailLog").html(rows.map(function (r) {
        var groupLabel = r.groupKey.toUpperCase();
        return '<div class="mail-log-row">' +
          '<span class="act ' + r.action + '">' + esc(r.action) + '</span>' +
          '<span>' + esc(r.name) + (r.manual ? ' <span class="manual-flag">manual</span>' : ' <span class="ctok">' + esc(r.token) + '</span>') + '</span>' +
          '<span>' + esc(groupLabel) + ' · by <span class="who">' + esc(r.performedBy) + '</span></span>' +
          '<span class="who">' + esc(r.performedAt) + '</span>' +
        '</div>';
      }).join(""));
    }, showError);
  }

  $("#mailLogToggle").on("click", function () {
    var $log = $("#mailLog");
    var show = $log.is("[hidden]");
    $log.attr("hidden", !show);
    $(this).html(icon("clock", 14) + (show ? " Hide recent changes" : " Show recent changes"));
    if (show) loadLog();
  });

  /* ---------------- Boot ---------------- */

  $(function () {
    api("ValidateSession", {}).then(function (v) {
      if (!v.valid) { goToSso(); return; }
      if (v.role !== "master") { window.location.href = "Default.aspx"; return; }
      return api("GetPlants", {});
    }).then(function (list) {
      if (!list) return;
      plants = (list || []).filter(function (p) { return p.accessible; });
      if (!plants.length) { $("#recipientGrid").html('<div class="report-empty">No plants in scope.</div>'); return; }
      currentPlantId = plants[0].plantId;
      ensurePlantLoaded(currentPlantId, function () {
        renderPlantSwitch(); renderTabs(); renderPanels();
      });
    }, showError);
  });
})();
