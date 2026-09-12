/* ---------------------------------------------------------------------------
   admin.js — the editor.
   No frameworks, no build step. One file, plain browser JavaScript, so what
   you read here is exactly what runs.

   Three ideas and the whole thing follows from them:
     1. There is one object, `S.draft`, holding the entire site.
     2. Every box on screen reads from it and writes back to it.
     3. Whenever it changes, it is saved as a DRAFT. The live site only
        changes when you press Publish.
   --------------------------------------------------------------------------- */
(function () {
"use strict";

var S = {
  draft: null, published: null, schema: null,
  snapshots: [], media: [],
  selected: null, dirty: false, saving: false, saveTimer: null
};

/* ---------- tiny helpers ---------- */
function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function $(id) { return document.getElementById(id); }
function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

/* The site's picture paths are relative to the site root ("assets/hero.jpg").
   This page lives at /admin/, so a thumbnail using that path as-is looks for
   /admin/assets/hero.jpg and finds nothing. Only the preview is adjusted —
   what gets saved stays exactly as typed. */
function thumbUrl(p) {
  if (!p) return "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  if (/^(https?:|data:|\/)/i.test(p)) return p;
  return "/" + p;
}

function toast(msg, kind) {
  var t = $("toast");
  t.textContent = msg;
  t.dataset.kind = kind || "";
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { t.hidden = true; }, kind === "bad" ? 6000 : 2600);
}

function api(path, opts) {
  opts = opts || {};
  // /admin-api/ and not /api/ — /api/servers on this same Worker is the
  // game's server list and has nothing to do with the website.
  return fetch("/admin-api/" + path, {
    method: opts.method || "GET",
    headers: opts.body && !opts.raw ? { "Content-Type": "application/json" } : (opts.headers || {}),
    body: opts.raw ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined)
  }).then(function (r) {
    if (r.status === 401 && path !== "login") { showGate("Signed out. Sign in again."); throw new Error("signed out"); }
    return r.json().catch(function () { return {}; }).then(function (data) {
      if (!r.ok) throw new Error(data.error || ("Request failed (" + r.status + ")"));
      return data;
    });
  });
}

/* =========================================================================
   SIGN IN
   ========================================================================= */
function showGate(note) {
  $("gate").hidden = false;
  $("app").hidden = true;
  if (note) $("gate-note").textContent = note;
}

$("login-form").addEventListener("submit", function (e) {
  e.preventDefault();
  var note = $("gate-note");
  note.removeAttribute("data-ok");
  note.textContent = "Checking…";
  api("login", { method: "POST", body: { password: $("pw").value } })
    .then(function () {
      note.setAttribute("data-ok", "1");
      note.textContent = "In you go.";
      $("pw").value = "";
      start();
    })
    .catch(function (err) { note.textContent = err.message; });
});

$("btn-logout").addEventListener("click", function () {
  api("logout", { method: "POST" }).then(function () { location.reload(); });
});

/* =========================================================================
   BOOT
   ========================================================================= */
function boot() {
  api("session").then(function (s) {
    if (!s.configured) {
      showGate("This Worker has no ADMIN_PASSWORD secret set yet. Add it in the Cloudflare dashboard, then reload this page.");
      $("login-form").querySelector("button").disabled = true;
      return;
    }
    if (s.signedIn) start(); else showGate("");
  }).catch(function () { showGate("Could not reach the site. Try again in a moment."); });
}

function start() {
  $("gate").hidden = true;
  $("app").hidden = false;
  Promise.all([api("schema"), api("state")]).then(function (r) {
    S.schema = r[0];
    applyState(r[1]);
    buildAll();
    setState(S.dirty ? "dirty" : "live");
    // Load the preview only now. Loaded any earlier it would have been served
    // the live page, without the layer that makes it draggable.
    refreshPreview();
  }).catch(function (err) { toast(err.message, "bad"); });
}

function applyState(st) {
  S.draft = st.draft;
  S.published = st.published;
  S.snapshots = st.snapshots || [];
  S.media = st.media || [];
  S.dirty = st.dirty;
  if (!st.storage) toast("No storage is connected to this Worker yet — nothing you change here can be saved.", "bad");
}

function buildAll() {
  buildSections();
  buildDesign();
  buildSettings();
  buildPictures();
  if (!S.selected && S.draft.content.blocks.length) S.selected = S.draft.content.blocks[0].id;
  buildEditor();
}

/* =========================================================================
   SAVING  — every change lands in the draft. Publish is a separate decision.
   ========================================================================= */
function setState(kind) {
  var chip = $("save-state");
  chip.dataset.state = kind;
  chip.textContent =
    kind === "dirty" ? "Unsaved changes" :
    kind === "saving" ? "Saving…" :
    kind === "saved" ? "Draft saved — not live yet" :
    kind === "live"  ? "Live site is up to date" :
    kind === "bad"   ? "Could not save" : "";
}

function changed(opts) {
  S.dirty = true;
  setState("dirty");
  clearTimeout(S.saveTimer);
  S.saveTimer = setTimeout(function () { saveDraft(opts && opts.quiet); }, 900);
}

function saveDraft(quiet) {
  if (S.saving) { changed({ quiet: quiet }); return; }
  S.saving = true;
  setState("saving");
  api("draft", { method: "PUT", body: S.draft })
    .then(function () {
      S.saving = false;
      setState("saved");
      if (!quiet) refreshPreview(); else tellPreview();
    })
    .catch(function (err) { S.saving = false; setState("bad"); toast(err.message, "bad"); });
}

function refreshPreview() {
  var f = $("preview");
  f.contentWindow.location.replace("/?preview=1&t=" + Date.now());
}
$("btn-refresh").addEventListener("click", refreshPreview);
$("btn-view").addEventListener("click", function () { window.open("/", "_blank", "noopener"); });

/* =========================================================================
   TABS
   ========================================================================= */
$("tabs").addEventListener("click", function (e) {
  var b = e.target.closest(".tab");
  if (!b) return;
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) { t.classList.toggle("is-on", t === b); });
  ["sections", "design", "settings", "pictures"].forEach(function (name) {
    $("pane-" + name).hidden = name !== b.dataset.tab;
  });
});

/* preview width */
$("widths").addEventListener("click", function (e) {
  var b = e.target.closest(".seg__btn");
  if (!b) return;
  Array.prototype.forEach.call($("widths").children, function (x) { x.classList.toggle("is-on", x === b); });
  var stage = $("stage"), f = $("preview");
  if (b.dataset.w === "full") { stage.classList.remove("is-narrow"); f.style.width = "100%"; f.style.maxWidth = ""; }
  else { stage.classList.add("is-narrow"); f.style.width = b.dataset.w + "px"; f.style.maxWidth = "100%"; }
});


/* =========================================================================
   DRAG TO REORDER
   Used by the section list and by every repeating list inside a section.
   Pointer events rather than HTML5 drag-and-drop: it behaves the same with a
   mouse, a trackpad and a finger, and it does not need a drag image.
   ========================================================================= */
function dragSort(container, itemSelector, onDrop) {
  // The lists are cleared and refilled in place, so without this guard a
  // second listener would be added to the SAME element every time — and one
  // drag would then reorder the list once for each rebuild that had happened.
  if (container.dataset.sortable) return;
  container.dataset.sortable = "1";

  var line = null;

  container.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    if (e.target.closest("button,input,textarea,select,a")) return;
    var item = e.target.closest(itemSelector);
    if (!item || item.parentNode !== container) return;

    var items = [].slice.call(container.querySelectorAll(":scope > " + itemSelector));
    var from = items.indexOf(item);
    var startY = e.clientY;
    var moved = false;
    var target = from;

    line = el("div", "droplin");
    function showLine(idx) {
      var ref = items[Math.min(idx, items.length - 1)];
      var r = ref.getBoundingClientRect();
      var cr = container.getBoundingClientRect();
      line.style.top = (idx >= items.length ? r.bottom : r.top) - cr.top + container.scrollTop - 1 + "px";
      line.style.left = "0"; line.style.right = "0";
      if (!line.parentNode) { container.style.position = "relative"; container.appendChild(line); }
    }

    function onMove(ev) {
      if (!moved && Math.abs(ev.clientY - startY) < 4) return;
      if (!moved) { moved = true; item.classList.add("is-lifting"); document.body.style.userSelect = "none"; }
      var idx = items.length;
      for (var i = 0; i < items.length; i++) {
        var r = items[i].getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) { idx = i; break; }
      }
      target = idx;
      showLine(idx);
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      item.classList.remove("is-lifting");
      if (line && line.parentNode) line.parentNode.removeChild(line);
      line = null;
      if (moved && target !== from && target !== from + 1) {
        onDrop(from, target > from ? target - 1 : target);
      }
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  });
}

/* =========================================================================
   SECTION LIST
   ========================================================================= */
function blockLabel(b) {
  var t = S.schema.blockTypes[b.type];
  return b.name || (t ? t.label : b.type);
}

function buildSections() {
  var list = clear($("seclist"));
  S.draft.content.blocks.forEach(function (b, i) {
    var row = el("li", "secrow" + (b.id === S.selected ? " is-on" : "") + (b.hidden ? " is-off" : ""));
    row.appendChild(el("span", "secrow__grip", String(i + 1)));

    var body = el("div", "secrow__body");
    body.appendChild(el("span", "secrow__name", blockLabel(b)));
    body.appendChild(el("span", "secrow__type", (S.schema.blockTypes[b.type] || {}).label || b.type));
    row.appendChild(body);

    var acts = el("div", "secrow__acts");
    acts.appendChild(iconBtn("↑", "Move up", function (e) { e.stopPropagation(); move(i, -1); }, i === 0));
    acts.appendChild(iconBtn("↓", "Move down", function (e) { e.stopPropagation(); move(i, 1); }, i === S.draft.content.blocks.length - 1));
    acts.appendChild(iconBtn(b.hidden ? "Show" : "Hide", b.hidden ? "Put it back on the page" : "Take it off the page without deleting it", function (e) {
      e.stopPropagation(); b.hidden = !b.hidden; buildSections(); changed();
    }));
    acts.appendChild(iconBtn("✕", "Delete this section", function (e) {
      e.stopPropagation();
      confirmBox("Delete “" + blockLabel(b) + "”?",
        "It goes from the draft. The live site keeps it until you press Publish, and History can bring it back after that.",
        "Delete", function () {
          S.draft.content.blocks.splice(i, 1);
          if (S.selected === b.id) S.selected = (S.draft.content.blocks[0] || {}).id || null;
          buildSections(); buildEditor(); changed();
        });
    }));
    row.appendChild(acts);

    row.addEventListener("click", function () { selectBlock(b.id); });
    list.appendChild(row);
  });

  dragSort(list, ".secrow", function (from, to) {
    var arr = S.draft.content.blocks;
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    buildSections();
    saveNow();
  });   // attached once; it reads the live list every time it runs
}

function iconBtn(text, title, fn, disabled) {
  var b = el("button", "btn btn--tiny", text);
  b.type = "button"; b.title = title;
  if (disabled) b.disabled = true;
  b.addEventListener("click", fn);
  return b;
}

function move(i, d) {
  var arr = S.draft.content.blocks, j = i + d;
  if (j < 0 || j >= arr.length) return;
  var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  buildSections(); changed();
}

/* ---------- adding one ---------- */
$("btn-add").addEventListener("click", function () {
  var body = el("div");
  Object.keys(S.schema.blockTypes).forEach(function (type) {
    var def = S.schema.blockTypes[type];
    if (def.unique && S.draft.content.blocks.some(function (b) { return b.type === type; })) return;
    var b = el("button", "pick");
    b.type = "button";
    b.appendChild(el("b", null, def.label));
    b.appendChild(el("span", null, def.blurb));
    b.addEventListener("click", function () { addBlock(type); closeModal(); });
    body.appendChild(b);
  });
  openModal("Add a section", body, [cancelBtn()]);
});

function addBlock(type) {
  var def = S.schema.blockTypes[type];
  var b = { id: type + "-" + Date.now().toString(36), type: type, name: def.label, hidden: false, background: "ground" };
  def.fields.forEach(function (f) {
    if (f.type === "list" || f.type === "table") b[f.key] = [];
    else if (f.type === "bool") b[f.key] = false;
    else if (f.type === "number") b[f.key] = f.min || 3;
    else if (f.key !== "background") b[f.key] = "";
  });
  if (type === "steps") b.numbered = true;
  if (type === "cards") b.columns = 3;
  S.draft.content.blocks.push(b);
  S.selected = b.id;
  buildSections(); buildEditor(); changed();
  toast("Added. It is at the bottom — use ↑ to move it.", "good");
}

/* =========================================================================
   THE EDITING FORM — built from the schema, not hand-written per section
   ========================================================================= */
function buildEditor() {
  var host = clear($("editor"));
  var b = S.draft.content.blocks.find(function (x) { return x.id === S.selected; });
  if (!b) return;
  var def = S.schema.blockTypes[b.type];

  host.appendChild(group("This section", [
    fieldRow({ key: "name", label: "Name in this list", type: "text", help: "Only you see this. It keeps the list readable." }, b),
    fieldRow({ key: "id", label: "Link anchor", type: "text", help: "Lets you link straight to this section, as /#" + b.id }, b)
  ]));

  var rows = def.fields.map(function (f) { return fieldRow(f, b); });
  host.appendChild(group(def.label, rows));
}

function group(title, rows) {
  var g = el("div", "fgroup");
  g.appendChild(el("div", "fgroup__head", title));
  var body = el("div", "fgroup__body");
  rows.forEach(function (r) { if (r) body.appendChild(r); });
  g.appendChild(body);
  return g;
}

/* One field. `obj` is the thing being edited; `def.key` is the property. */
function fieldRow(def, obj) {
  var wrap = el("div", "f");
  if (def.type === "bool") {
    var lab = el("label", "tick");
    var cb = el("input"); cb.type = "checkbox"; cb.checked = !!obj[def.key];
    cb.addEventListener("change", function () { obj[def.key] = cb.checked; changed(); });
    lab.appendChild(cb);
    lab.appendChild(el("span", null, def.label));
    wrap.appendChild(lab);
    if (def.help) wrap.appendChild(el("p", "help", def.help));
    return wrap;
  }

  wrap.appendChild(el("label", "lbl", def.label));

  if (def.type === "text" || def.type === "number") {
    var i = el("input", "in");
    i.type = def.type === "number" ? "number" : "text";
    if (def.min != null) i.min = def.min;
    if (def.max != null) i.max = def.max;
    i.value = obj[def.key] == null ? "" : obj[def.key];
    i.addEventListener("input", function () {
      obj[def.key] = def.type === "number" ? Number(i.value) : i.value;
      if (def.key === "name" || def.key === "id") buildSections();
      changed();
    });
    wrap.appendChild(i);

  } else if (def.type === "rich") {
    var t = el("textarea", "in");
    t.rows = def.rows || 4;
    t.value = obj[def.key] || "";
    t.addEventListener("input", function () { obj[def.key] = t.value; changed(); });
    wrap.appendChild(t);
    if (!def.help) wrap.appendChild(el("p", "help", "You can use <em>slanted</em>, <b>bold</b> and <a href=\"…\">links</a> in here."));

  } else if (def.type === "select") {
    var s = el("select", "in");
    (def.options || []).forEach(function (o) {
      var op = el("option", null, o.label);
      op.value = o.value;
      if (obj[def.key] === o.value) op.selected = true;
      s.appendChild(op);
    });
    s.addEventListener("change", function () { obj[def.key] = s.value; changed(); });
    wrap.appendChild(s);

  } else if (def.type === "image") {
    wrap.appendChild(imagePicker(obj, def.key));

  } else if (def.type === "list") {
    wrap.appendChild(listEditor(obj, def));

  } else if (def.type === "table") {
    wrap.appendChild(tableEditor(obj, def));
  }

  if (def.help) wrap.appendChild(el("p", "help", def.help));
  return wrap;
}

/* ---------- pictures ---------- */
function imagePicker(obj, key) {
  var box = el("div", "pic");
  var img = el("img", "pic__thumb");
  img.alt = "";
  img.src = thumbUrl(obj[key]);
  var side = el("div", "pic__side");
  var path = el("input", "in");
  path.value = obj[key] || "";
  path.placeholder = "assets/something.jpg";
  path.addEventListener("input", function () { obj[key] = path.value; img.src = thumbUrl(path.value); changed(); });
  var choose = el("button", "btn btn--tiny", "Choose a picture");
  choose.type = "button";
  choose.addEventListener("click", function () {
    pickPicture(function (url) { obj[key] = url; path.value = url; img.src = thumbUrl(url); changed(); });
  });
  side.appendChild(path);
  side.appendChild(choose);
  box.appendChild(img);
  box.appendChild(side);
  return box;
}

function pickPicture(onPick) {
  var body = el("div");
  var grid = el("div", "medialist");

  // Pictures already in the repo, plus anything uploaded here.
  var repo = ["assets/hero.jpg", "assets/favicon.png", "assets/apple-touch-icon.png",
    "assets/adept_light.jpg", "assets/adept_dark.jpg", "assets/adept_solar.jpg",
    "assets/adept_frost.jpg", "assets/adept_earthen.jpg",
    "assets/realm_light.jpg", "assets/realm_frost.jpg", "assets/realm_earthen.jpg",
    "assets/icon_light.png", "assets/icon_dark.png", "assets/icon_solar.png",
    "assets/icon_frost.png", "assets/icon_earthen.png"];
  var all = S.media.map(function (m) { return "/media/" + m.name; }).concat(repo);

  all.forEach(function (url) {
    var card = el("button", "mediacard");
    card.type = "button";
    var im = el("img"); im.src = thumbUrl(url); im.alt = "";
    card.appendChild(im);
    card.appendChild(el("code", null, url));
    card.addEventListener("click", function () { onPick(url); closeModal(); });
    grid.appendChild(card);
  });
  body.appendChild(grid);
  openModal("Choose a picture", body, [cancelBtn()]);
}

/* ---------- a list of things ---------- */
function listEditor(obj, def) {
  var host = el("div", "items");
  if (!Array.isArray(obj[def.key])) obj[def.key] = [];
  var arr = obj[def.key];

  function redraw() {
    clear(host);
    arr.forEach(function (entry, i) {
      var item = el("div", "item");
      var head = el("div", "item__head");
      head.appendChild(el("span", "item__n", (i + 1) + (def.simple ? "" : " · " + (entry.title || entry.name || entry.label || entry.tag || entry.what || ""))));
      head.appendChild(iconBtn("↑", "Move up", function () { swap(i, -1); }, i === 0));
      head.appendChild(iconBtn("↓", "Move down", function () { swap(i, 1); }, i === arr.length - 1));
      head.appendChild(iconBtn("✕", "Remove", function () { arr.splice(i, 1); redraw(); changed(); }));
      item.appendChild(head);

      var body = el("div", "item__body");
      if (def.simple) {
        var holder = { v: entry };
        var row = fieldRow({ key: "v", label: "", type: def.simple }, holder);
        row.querySelector("label").remove();
        var ctl = row.querySelector("input,textarea");
        ctl.addEventListener("input", function () { arr[i] = ctl.value; changed(); });
        body.appendChild(row);
      } else {
        def.of.forEach(function (f) { body.appendChild(fieldRow(f, entry)); });
      }
      item.appendChild(body);
      host.appendChild(item);
    });

    dragSort(host, ".item", function (from, to) {
      arr.splice(to, 0, arr.splice(from, 1)[0]);
      redraw(); changed();
    });

    var add = el("button", "btn btn--tiny", "+ Add");
    add.type = "button";
    add.addEventListener("click", function () {
      if (def.simple) arr.push("");
      else {
        var fresh = {};
        def.of.forEach(function (f) {
          if (f.default === "nextRow") {
            // Drop a new canvas item on the first empty row rather than on top
            // of something already there.
            fresh[f.key] = arr.reduce(function (m, it) { return Math.max(m, (Number(it.y) || 1) + (Number(it.h) || 2) - 1); }, 0) + 1;
          } else if (f.default !== undefined) fresh[f.key] = f.default;
          else fresh[f.key] = f.type === "list" ? [] : f.type === "bool" ? false : f.type === "select" ? (f.options[0] || {}).value : "";
        });
        arr.push(fresh);
      }
      redraw(); changed();
    });
    host.appendChild(add);
  }

  function swap(i, d) {
    var j = i + d; if (j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    redraw(); changed();
  }

  redraw();
  return host;
}

/* ---------- a grid of cells ---------- */
function tableEditor(obj, def) {
  var host = el("div");
  if (!Array.isArray(obj[def.key])) obj[def.key] = [];
  var rows = obj[def.key];

  function redraw() {
    clear(host);
    var cols = (obj[def.columnsFrom] || []).length || (rows[0] || []).length || 3;
    var table = el("table", "tbl");
    rows.forEach(function (row, ri) {
      var tr = el("tr");
      for (var ci = 0; ci < cols; ci++) {
        (function (ci) {
          var td = el("td");
          var i = el("input", "in");
          i.value = row[ci] == null ? "" : row[ci];
          i.addEventListener("input", function () { row[ci] = i.value; changed(); });
          td.appendChild(i);
          tr.appendChild(td);
        })(ci);
      }
      var td = el("td");
      td.appendChild(iconBtn("✕", "Remove this row", function () { rows.splice(ri, 1); redraw(); changed(); }));
      tr.appendChild(td);
      table.appendChild(tr);
    });
    host.appendChild(table);

    var foot = el("div", "tblfoot");
    var add = el("button", "btn btn--tiny", "+ Add a row");
    add.type = "button";
    add.addEventListener("click", function () {
      var n = (obj[def.columnsFrom] || []).length || (rows[0] || []).length || 3;
      rows.push(new Array(n).fill(""));
      redraw(); changed();
    });
    foot.appendChild(add);
    host.appendChild(foot);
  }
  redraw();
  return host;
}

/* =========================================================================
   DESIGN TAB
   ========================================================================= */
function buildDesign() {
  var pane = clear($("pane-design"));
  var tf = S.schema.themeFields;

  pane.appendChild(group("Colours", tf.colours.map(function (c) {
    return swatch(S.draft.theme.colours, c);
  })));

  pane.appendChild(group("Type", tf.fonts.map(function (f) {
    return themeText(S.draft.theme.fonts, f);
  })));

  pane.appendChild(group("Layout", tf.layout.map(function (f) {
    return themeText(S.draft.theme.layout, f);
  })));

  var cssRow = el("div", "f");
  cssRow.appendChild(el("label", "lbl", "Extra CSS"));
  var ta = el("textarea", "in code");
  ta.rows = 8;
  ta.value = S.draft.theme.custom || "";
  ta.addEventListener("input", function () { S.draft.theme.custom = ta.value; changed(); });
  cssRow.appendChild(ta);
  cssRow.appendChild(el("p", "help", "Added last, so anything here beats everything above. Changes here need a Refresh of the preview."));
  pane.appendChild(group("Advanced", [cssRow]));

  var reset = el("button", "btn btn--wide", "Put the original design back");
  reset.type = "button";
  reset.addEventListener("click", function () {
    confirmBox("Restore the original design?",
      "Colours, type and layout go back to how the site looked before you started. Your words and sections are untouched.",
      "Restore", function () {
        api("seed", { method: "POST" }).then(function () { return api("state"); }).then(function (st) {
          var fresh = st.draft.theme;
          S.draft.theme = fresh;
          return api("draft", { method: "PUT", body: S.draft });
        }).then(function () { buildDesign(); refreshPreview(); toast("Original design restored.", "good"); });
      });
  });
  pane.appendChild(reset);
}

function swatch(store, def) {
  var wrap = el("div", "f");
  wrap.appendChild(el("label", "lbl", def.label));
  var row = el("div", "swatchrow");
  var col = el("input"); col.type = "color";
  var hex = el("input", "in");
  var value = store[def.key] || "#000000";
  col.value = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  hex.value = value;
  function push(v) {
    store[def.key] = v;
    if (def.var) pushVar(def.var, v);
    changed({ quiet: true });
  }
  col.addEventListener("input", function () { hex.value = col.value; push(col.value); });
  hex.addEventListener("input", function () {
    if (/^#[0-9a-f]{6}$/i.test(hex.value)) col.value = hex.value;
    push(hex.value);
  });
  row.appendChild(col); row.appendChild(hex);
  wrap.appendChild(row);
  if (def.help) wrap.appendChild(el("p", "help", def.help));
  return wrap;
}

function themeText(store, def) {
  var wrap = el("div", "f");
  wrap.appendChild(el("label", "lbl", def.label));
  var i = el("input", "in");
  i.value = store[def.key] == null ? "" : store[def.key];
  i.addEventListener("input", function () {
    store[def.key] = i.value;
    if (def.var) pushVar(def.var, i.value); else changed();
    if (def.var) changed({ quiet: true });
  });
  wrap.appendChild(i);
  if (def.help) wrap.appendChild(el("p", "help", def.help));
  return wrap;
}

/* Recolour the preview straight away, without waiting for a save. */
function pushVar(name, value) {
  var f = $("preview");
  if (!f.contentWindow) return;
  var vars = {}; vars[name] = value;
  f.contentWindow.postMessage({ kind: "adeptsworn-theme", vars: vars }, "*");
}

/* =========================================================================
   SETTINGS TAB
   ========================================================================= */
function buildSettings() {
  var pane = clear($("pane-settings"));
  pane.appendChild(group("The page itself", S.schema.siteFields.map(function (f) {
    return fieldRow(f, S.draft.content.site);
  })));
  pane.appendChild(group("Footer", S.schema.footerFields.map(function (f) {
    return fieldRow(f, S.draft.content.footer);
  })));

  var exp = el("button", "btn btn--wide", "Download a backup of everything");
  exp.type = "button";
  exp.addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(S.draft, null, 2)], { type: "application/json" });
    var a = el("a");
    a.href = URL.createObjectURL(blob);
    a.download = "adeptsworn-site-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  pane.appendChild(exp);
}

/* =========================================================================
   PICTURES TAB
   ========================================================================= */
function buildPictures() {
  var pane = clear($("pane-pictures"));

  var drop = el("div", "drop", "Drop a picture here, or click to choose one. JPG or PNG, up to 8 MB.");
  var input = el("input"); input.type = "file"; input.accept = "image/*"; input.multiple = true; input.hidden = true;
  drop.addEventListener("click", function () { input.click(); });
  input.addEventListener("change", function () { upload(input.files); });
  ["dragenter", "dragover"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-over"); });
  });
  drop.addEventListener("drop", function (e) { upload(e.dataTransfer.files); });
  pane.appendChild(drop);
  pane.appendChild(input);

  var grid = el("div", "medialist");
  S.media.forEach(function (m) {
    var card = el("div", "mediacard");
    var im = el("img"); im.src = "/media/" + m.name; im.alt = "";
    card.appendChild(im);
    card.appendChild(el("code", null, "/media/" + m.name));
    var del = el("button", "btn btn--tiny btn--bad", "Delete");
    del.type = "button";
    del.addEventListener("click", function () {
      confirmBox("Delete " + m.name + "?", "Anywhere on the site still using it will show a broken picture.", "Delete", function () {
        api("media/" + encodeURIComponent(m.name), { method: "DELETE" })
          .then(function () { S.media = S.media.filter(function (x) { return x.name !== m.name; }); buildPictures(); });
      });
    });
    card.appendChild(del);
    grid.appendChild(card);
  });
  pane.appendChild(grid);
  if (!S.media.length) pane.appendChild(el("p", "help", "Nothing uploaded yet. The pictures already in the repo are still available from any Choose a picture button."));
}

function upload(files) {
  var queue = Array.prototype.slice.call(files || []);
  if (!queue.length) return;
  toast("Uploading " + queue.length + "…");
  var done = 0;
  queue.reduce(function (chain, file) {
    return chain.then(function () {
      return file.arrayBuffer().then(function (buf) {
        return api("media", {
          method: "POST", raw: true, body: buf,
          headers: { "Content-Type": file.type, "X-Filename": file.name }
        }).then(function (r) {
          done++;
          S.media.unshift({ name: r.name, type: file.type, size: buf.byteLength, ts: Date.now() });
        });
      });
    }).catch(function (err) { toast(err.message, "bad"); });
  }, Promise.resolve()).then(function () {
    buildPictures();
    if (done) toast(done + " uploaded.", "good");
  });
}

/* =========================================================================
   PUBLISH AND HISTORY
   ========================================================================= */
$("btn-publish").addEventListener("click", function () {
  clearTimeout(S.saveTimer);
  saveDraft(true);
  confirmBox("Publish to adeptsworn.com?",
    "Everyone sees this within about a minute. The version that is live now is kept, so History can put it back.",
    "Publish", function () {
      api("publish", { method: "POST", body: {} })
        .then(function () { return api("state"); })
        .then(function (st) { applyState(st); setState("live"); toast("Published. Give it a minute, then check on your phone — the PC will cache the old one.", "good"); })
        .catch(function (err) { toast(err.message, "bad"); });
    });
});

$("btn-history").addEventListener("click", function () {
  api("state").then(function (st) {
    applyState(st);
    var body = el("div");
    if (S.dirty) {
      var d = el("div", "histrow");
      d.appendChild(el("time", null, "Your unpublished draft"));
      var drop = el("button", "btn btn--tiny btn--bad", "Throw it away");
      drop.type = "button";
      drop.addEventListener("click", function () {
        api("revert", { method: "POST" }).then(function () { closeModal(); location.reload(); });
      });
      d.appendChild(drop);
      body.appendChild(d);
    }
    if (!S.snapshots.length) {
      body.appendChild(el("p", "help", "Nothing published yet, so there is nothing to go back to. Every Publish from now on saves the version it replaced."));
    }
    S.snapshots.forEach(function (s) {
      var row = el("div", "histrow");
      row.appendChild(el("time", null, new Date(s.ts).toLocaleString()));
      var use = el("button", "btn btn--tiny", "Load this one");
      use.type = "button";
      use.addEventListener("click", function () {
        api("restore", { method: "POST", body: { ts: s.ts } }).then(function () {
          closeModal();
          toast("Loaded into your draft. Look it over, then Publish.", "good");
          location.reload();
        });
      });
      row.appendChild(use);
      body.appendChild(row);
    });
    openModal("History", body, [cancelBtn("Close")]);
  });
});

/* =========================================================================
   POP-UPS
   ========================================================================= */
function openModal(title, bodyNode, footButtons) {
  $("modal-title").textContent = title;
  clear($("modal-body")).appendChild(bodyNode);
  var foot = clear($("modal-foot"));
  (footButtons || []).forEach(function (b) { foot.appendChild(b); });
  $("modal").hidden = false;
}
function closeModal() { $("modal").hidden = true; }
function cancelBtn(label) {
  var b = el("button", "btn", label || "Cancel");
  b.type = "button";
  b.addEventListener("click", closeModal);
  return b;
}
function confirmBox(title, text, goLabel, onGo) {
  var body = el("div");
  body.appendChild(el("p", null, text));
  var go = el("button", "btn btn--go", goLabel);
  go.type = "button";
  go.addEventListener("click", function () { closeModal(); onGo(); });
  openModal(title, body, [cancelBtn(), go]);
}
$("modal").addEventListener("click", function (e) { if (e.target === $("modal")) closeModal(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

/* =========================================================================
   TALKING TO THE PREVIEW
   The preview is a real page with a thin editing layer on top of it. It never
   changes anything itself — it works out what you meant and says so, and the
   decisions are all made here.
   ========================================================================= */
var previewScroll = 0;

function blockById(id) {
  return S.draft.content.blocks.filter(function (b) { return b.id === id; })[0];
}

/* What the preview needs to draw its toolbar correctly. */
function tellPreview() {
  var f = $("preview");
  if (!f || !f.contentWindow || !S.draft) return;
  var state = {}, names = {};
  S.draft.content.blocks.forEach(function (b) {
    state[b.id] = { width: b.width, align: b.align, background: b.background, hidden: b.hidden };
    names[b.id] = blockLabel(b);
  });
  f.contentWindow.postMessage({ kind: "adeptsworn-state", state: state, names: names }, "*");
  if (S.selected) f.contentWindow.postMessage({ kind: "adeptsworn-select", id: S.selected }, "*");
}

function selectBlock(id) {
  S.selected = id;
  document.querySelector('.tab[data-tab="sections"]').click();
  buildSections(); buildEditor();
  var f = $("preview");
  if (f.contentWindow) f.contentWindow.postMessage({ kind: "adeptsworn-select", id: id }, "*");
}

window.addEventListener("message", function (e) {
  var d = e.data;
  if (!d || !S.draft) return;

  if (d.kind === "adeptsworn-scroll") { previewScroll = d.y; return; }

  if (d.kind === "adeptsworn-ready") {
    tellPreview();
    if (previewScroll) $("preview").contentWindow.postMessage({ kind: "adeptsworn-scrollto", y: previewScroll }, "*");
    return;
  }

  if (d.kind === "adeptsworn-pick") {
    if (blockById(d.id)) selectBlock(d.id);
    return;
  }

  if (d.kind === "adeptsworn-nudge") {
    var i = S.draft.content.blocks.indexOf(blockById(d.id));
    if (i < 0) return;
    move(i, d.d);
    saveNow();
    return;
  }

  if (d.kind === "adeptsworn-move") {
    var arr = S.draft.content.blocks;
    var from = arr.indexOf(blockById(d.id));
    if (from < 0) return;
    var to = d.to > from ? d.to - 1 : d.to;
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    buildSections();
    saveNow();
    return;
  }

  if (d.kind === "adeptsworn-set") {
    var b = blockById(d.id);
    if (!b) return;
    b[d.key] = d.value;
    buildSections();
    if (S.selected === d.id) buildEditor();
    // Spacing is already showing in the preview — save it, but do not make the
    // page flash by reloading it underneath you.
    if (d.key === "padTop" || d.key === "padBottom") changed({ quiet: true });
    else saveNow();
    return;
  }

  if (d.kind === "adeptsworn-canvas") {
    var cb = blockById(d.id);
    if (!cb || !cb.items || !cb.items[d.index]) return;
    var it = cb.items[d.index];
    it.x = d.x; it.y = d.y; it.w = d.w; it.h = d.h;
    if (S.selected === d.id) buildEditor();
    // The preview already shows it where you dropped it. Save quietly so the
    // page does not jump out from under your hand.
    changed({ quiet: true });
    return;
  }

  if (d.kind === "adeptsworn-delete") {
    var blk = blockById(d.id);
    if (!blk) return;
    confirmBox("Delete “" + blockLabel(blk) + "”?",
      "It goes from the draft. The live site keeps it until you press Publish, and History can bring it back after that.",
      "Delete", function () {
        var idx = S.draft.content.blocks.indexOf(blk);
        S.draft.content.blocks.splice(idx, 1);
        if (S.selected === d.id) S.selected = (S.draft.content.blocks[0] || {}).id || null;
        buildSections(); buildEditor(); saveNow();
      });
    return;
  }
});

/* Save straight away and show the result, for changes made by dragging —
   waiting the usual second would feel like the page had ignored you. */
function saveNow() {
  clearTimeout(S.saveTimer);
  S.dirty = true;
  setState("saving");
  api("draft", { method: "PUT", body: S.draft })
    .then(function () { setState("saved"); refreshPreview(); })
    .catch(function (err) { setState("bad"); toast(err.message, "bad"); });
}

window.addEventListener("beforeunload", function (e) {
  if (S.dirty && S.saving) { e.preventDefault(); e.returnValue = ""; }
});

boot();
})();
