/* ---------------------------------------------------------------------------
   preview.js — the layer that lets you grab the page itself.

   This runs ONLY inside the preview panel in /admin. It is never on the page a
   visitor gets: render.js adds this <script> tag only when the page is being
   previewed by somebody who is signed in.

   What it adds:
     hover a section   -> it lights up and tells you what it is
     click it          -> it is selected, here and in the list on the left
     drag its top or bottom edge -> the space above or below it changes
     drag the move handle        -> it changes place in the page
     the small toolbar -> width, alignment, background, hide, delete

   It never edits the content. It works out what you meant and tells the panel,
   which changes the one object holding the site and saves it.
   --------------------------------------------------------------------------- */
(function () {
"use strict";

var REM = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
var sections = [];
var selectedId = null;
var dragging = null;
var suppressClick = false;

/* ---------- the furniture ---------- */
var style = document.createElement("style");
style.textContent = [
  "#dm-hover,#dm-frame{position:absolute;pointer-events:none;z-index:2147483000}",
  "#dm-hover{border:1px dashed rgba(143,192,221,.75);background:rgba(143,192,221,.06)}",
  "#dm-frame{border:2px solid #8fc0dd}",
  ".dm-tag{position:absolute;top:-1.6rem;left:-2px;background:#8fc0dd;color:#0d0f13;font:600 11px/1.6 system-ui,sans-serif;",
  "  letter-spacing:.08em;text-transform:uppercase;padding:0 .5rem;white-space:nowrap}",
  ".dm-grip{position:absolute;left:0;right:0;height:14px;pointer-events:auto;cursor:ns-resize;z-index:2147483001}",
  ".dm-grip::after{content:'';position:absolute;left:50%;transform:translateX(-50%);width:56px;height:4px;",
  "  background:#8fc0dd;border-radius:2px;top:5px;opacity:.9}",
  ".dm-grip--top{top:-7px} .dm-grip--bottom{bottom:-7px}",
  "#dm-bar{position:absolute;z-index:2147483002;display:flex;gap:2px;background:#1b1e26;border:1px solid #8fc0dd;padding:3px;pointer-events:auto}",
  "#dm-bar button{background:#22262f;border:1px solid #323845;color:#e9e7e1;font:500 11px/1 system-ui,sans-serif;",
  "  padding:.38rem .45rem;cursor:pointer;white-space:nowrap}",
  "#dm-bar button:hover{background:#323845;border-color:#8fc0dd}",
  "#dm-bar button[data-on='1']{background:#8fc0dd;color:#0d0f13;border-color:#8fc0dd}",
  "#dm-bar button[data-bad]{border-color:#d4736a;color:#d4736a}",
  "#dm-bar .dm-move{cursor:grab}",
  "#dm-bar span.dm-sep{width:1px;background:#323845;margin:0 3px}",
  "#dm-readout{position:fixed;z-index:2147483003;background:#8fc0dd;color:#0d0f13;font:600 12px/1 ui-monospace,monospace;",
  "  padding:.4rem .55rem;pointer-events:none;display:none}",
  "#dm-drop{position:absolute;z-index:2147483002;height:4px;background:#9dae66;pointer-events:none;display:none}",
  "body.dm-dragging{cursor:grabbing!important;user-select:none}",
  "body.dm-dragging *{pointer-events:none!important}",
  "body.dm-dragging .dm-grip,body.dm-dragging #dm-bar{pointer-events:auto!important}"
].join("\n");
document.head.appendChild(style);

function mk(id, cls) { var n = document.createElement("div"); if (id) n.id = id; if (cls) n.className = cls; document.body.appendChild(n); return n; }
var hoverBox = mk("dm-hover"); hoverBox.style.display = "none";
var frame    = mk("dm-frame"); frame.style.display = "none";
var tag      = document.createElement("div"); tag.className = "dm-tag"; frame.appendChild(tag);
var gripTop  = document.createElement("div"); gripTop.className = "dm-grip dm-grip--top"; frame.appendChild(gripTop);
var gripBot  = document.createElement("div"); gripBot.className = "dm-grip dm-grip--bottom"; frame.appendChild(gripBot);
var bar      = mk("dm-bar"); bar.style.display = "none";
var readout  = mk("dm-readout");
var dropLine = mk("dm-drop");

/* ---------- who is on the page ---------- */
function scan() {
  sections = [].slice.call(document.querySelectorAll("header.hero[id], main > section[id]"));
}
scan();

function find(id) { return sections.filter(function (s) { return s.id === id; })[0]; }
function rectOf(n) {
  var r = n.getBoundingClientRect();
  return { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height };
}
function place(box, n) {
  var r = rectOf(n);
  box.style.top = r.top + "px"; box.style.left = r.left + "px";
  box.style.width = r.width + "px"; box.style.height = r.height + "px";
  box.style.display = "block";
}

/* ---------- hovering ---------- */
document.addEventListener("mousemove", function (e) {
  if (dragging) return;
  var n = e.target.closest ? e.target.closest("header.hero[id], main > section[id]") : null;
  if (!n || n.id === selectedId) { hoverBox.style.display = "none"; return; }
  place(hoverBox, n);
});
document.addEventListener("mouseleave", function () { hoverBox.style.display = "none"; });

/* ---------- selecting ---------- */
document.addEventListener("click", function (e) {
  if (dragging || suppressClick) return;
  if (e.target.closest("#dm-bar") || e.target.closest(".dm-grip")) return;
  var n = e.target.closest ? e.target.closest("header.hero[id], main > section[id]") : null;
  if (!n) return;
  // Stop a click on a card or a form doing its normal thing while editing.
  if (e.target.closest("a,button,input,select,textarea")) e.preventDefault();
  select(n.id);
  post({ kind: "adeptsworn-pick", id: n.id });
}, true);

function select(id) {
  selectedId = id;
  canvasOff();
  var n = find(id);
  if (!n) { frame.style.display = "none"; bar.style.display = "none"; return; }
  canvasOn(n);
  hoverBox.style.display = "none";
  place(frame, n);
  tag.textContent = (window.__dmNames && window.__dmNames[id]) || id;
  buildBar(n);
}

/* ---------- the toolbar ---------- */
function buildBar(n) {
  bar.textContent = "";
  var state = (window.__dmState && window.__dmState[n.id]) || {};

  bar.appendChild(btn("✥ Move", "Drag me to move this section up or down the page", null, "dm-move"));
  bar.appendChild(btn("↑", "Move up",   function () { post({ kind: "adeptsworn-nudge", id: n.id, d: -1 }); }));
  bar.appendChild(btn("↓", "Move down", function () { post({ kind: "adeptsworn-nudge", id: n.id, d: 1 }); }));
  bar.appendChild(sep());

  [["narrow","Narrow"],["normal","Normal"],["wide","Wide"],["full","Full"]].forEach(function (w) {
    var b = btn(w[1], "How wide this section runs", function () { post({ kind: "adeptsworn-set", id: n.id, key: "width", value: w[0] }); });
    if ((state.width || "normal") === w[0]) b.dataset.on = "1";
    bar.appendChild(b);
  });
  bar.appendChild(sep());

  [["left","Left"],["center","Centre"]].forEach(function (a) {
    var b = btn(a[1], "Alignment", function () { post({ kind: "adeptsworn-set", id: n.id, key: "align", value: a[0] }); });
    if ((state.align || "left") === a[0]) b.dataset.on = "1";
    bar.appendChild(b);
  });
  bar.appendChild(sep());

  bar.appendChild(btn("Shade", "Cycle the background: page colour, darker, lighter", function () {
    var order = ["ground", "deep", "lift"];
    var next = order[(order.indexOf(state.background || "ground") + 1) % 3];
    post({ kind: "adeptsworn-set", id: n.id, key: "background", value: next });
  }));
  bar.appendChild(btn("Hide", "Take it off the page without deleting it", function () {
    post({ kind: "adeptsworn-set", id: n.id, key: "hidden", value: true });
  }));
  var del = btn("Delete", "Delete this section", function () { post({ kind: "adeptsworn-delete", id: n.id }); });
  del.dataset.bad = "1";
  bar.appendChild(del);

  var r = rectOf(n);
  bar.style.display = "flex";
  var barW = bar.getBoundingClientRect().width;
  bar.style.left = Math.max(4, Math.min(r.left + r.width - barW - 4, document.documentElement.scrollWidth - barW - 4)) + "px";
  bar.style.top = (r.top + 6) + "px";
}
function btn(label, title, fn, cls) {
  var b = document.createElement("button");
  b.type = "button"; b.textContent = label; b.title = title;
  if (cls) b.className = cls;
  if (fn) b.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
  return b;
}
function sep() { var s = document.createElement("span"); s.className = "dm-sep"; return s; }

/* ---------- dragging an edge to change the space ---------- */
function edgeDrag(grip, side) {
  grip.addEventListener("mousedown", function (e) {
    e.preventDefault(); e.stopPropagation();
    var n = find(selectedId); if (!n) return;
    var startY = e.clientY;
    var inner = n.classList.contains("hero") ? n.querySelector(".hero__inner") : n;
    var startPx = parseFloat(getComputedStyle(inner)[side === "top" ? "paddingTop" : "paddingBottom"]) || 0;
    dragging = { kind: "pad" };
    document.body.classList.add("dm-dragging");
    readout.style.display = "block";

    function move(ev) {
      // Drag the TOP edge upward and you are asking for more space above it;
      // drag the BOTTOM edge downward and you want more space below. Both of
      // those were the wrong way round first time, and it felt broken.
      var delta = (ev.clientY - startY) * (side === "top" ? -1 : 1);
      var px = Math.max(0, Math.min(320, startPx + delta));
      var rem = Math.round((px / REM) * 4) / 4;
      n.style.setProperty(side === "top" ? "--sec-pt" : "--sec-pb", rem + "rem");
      readout.textContent = (side === "top" ? "space above " : "space below ") + rem + " rem";
      readout.style.left = (ev.clientX + 14) + "px";
      readout.style.top = (ev.clientY - 10) + "px";
      place(frame, n);
      buildBar(n);
      dragging.rem = rem;
    }
    function up() {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.classList.remove("dm-dragging");
      readout.style.display = "none";
      if (dragging && dragging.rem != null) {
        post({ kind: "adeptsworn-set", id: selectedId, key: side === "top" ? "padTop" : "padBottom", value: dragging.rem });
      }
      dragging = null;
    }
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  });
}
edgeDrag(gripTop, "top");
edgeDrag(gripBot, "bottom");

/* ---------- dragging a whole section somewhere else ---------- */
bar.addEventListener("mousedown", function (e) {
  var handle = e.target.closest(".dm-move");
  if (!handle) return;
  e.preventDefault(); e.stopPropagation();
  var n = find(selectedId); if (!n) return;
  var from = sections.indexOf(n);
  var target = from;
  dragging = { kind: "move" };
  document.body.classList.add("dm-dragging");
  dropLine.style.display = "block";
  readout.style.display = "block";
  readout.textContent = "drop to move";

  function move(ev) {
    var y = ev.clientY + window.scrollY;
    var idx = sections.length;
    for (var i = 0; i < sections.length; i++) {
      var r = rectOf(sections[i]);
      if (y < r.top + r.height / 2) { idx = i; break; }
    }
    target = idx;
    var mark = sections[Math.min(idx, sections.length - 1)];
    var mr = rectOf(mark);
    dropLine.style.left = mr.left + "px";
    dropLine.style.width = mr.width + "px";
    dropLine.style.top = (idx >= sections.length ? mr.top + mr.height : mr.top) - 2 + "px";
    readout.style.left = (ev.clientX + 14) + "px";
    readout.style.top = (ev.clientY - 10) + "px";
    // Auto-scroll when you drag near an edge, or long pages are unmovable.
    if (ev.clientY < 60) window.scrollBy(0, -18);
    else if (ev.clientY > window.innerHeight - 60) window.scrollBy(0, 18);
  }
  function up() {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    document.body.classList.remove("dm-dragging");
    dropLine.style.display = "none";
    readout.style.display = "none";
    dragging = null;
    if (target !== from && target !== from + 1) post({ kind: "adeptsworn-move", id: n.id, to: target });
  }
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
});

/* ---------------------------------------------------------------------------
   THE FREEFORM CANVAS
   Only live on the section you have selected, so the rest of the page still
   behaves like a page. Everything snaps to the same twelve-column grid the
   published site uses, which is what stops a dragged layout falling apart on
   a phone.
   --------------------------------------------------------------------------- */
var gridStyle = document.createElement("style");
gridStyle.textContent = [
  ".dm-canvas-on{outline:1px solid rgba(143,192,221,.35);",
  "  background-image:repeating-linear-gradient(to right,rgba(143,192,221,.16) 0 1px,transparent 1px var(--dm-col)),",
  "                   repeating-linear-gradient(to bottom,rgba(143,192,221,.16) 0 1px,transparent 1px var(--dm-row));}",
  ".dm-canvas-on .citem{outline:1px dashed rgba(143,192,221,.5);cursor:grab;position:relative}",
  ".dm-canvas-on .citem:hover{outline-color:#8fc0dd}",
  ".dm-ci-size{position:absolute;right:-6px;bottom:-6px;width:14px;height:14px;background:#8fc0dd;",
  "  border:2px solid #0d0f13;cursor:nwse-resize;z-index:3}",
  ".dm-ci-lift{opacity:.7;outline:2px solid #9dae66!important}"
].join("\n");
document.head.appendChild(gridStyle);

var wiredCanvas = null;

function canvasOff() {
  if (!wiredCanvas) return;
  wiredCanvas.classList.remove("dm-canvas-on");
  [].forEach.call(wiredCanvas.querySelectorAll(".dm-ci-size"), function (h) { h.remove(); });
  wiredCanvas = null;
}

function canvasOn(section) {
  var cv = section.querySelector("[data-canvas]");
  if (!cv) return;
  wiredCanvas = cv;
  cv.classList.add("dm-canvas-on");
  var m = metrics(cv);
  cv.style.setProperty("--dm-col", m.stepX + "px");
  cv.style.setProperty("--dm-row", m.stepY + "px");
  [].forEach.call(cv.querySelectorAll(".citem"), function (item) {
    if (!item.querySelector(".dm-ci-size")) {
      var h = document.createElement("div");
      h.className = "dm-ci-size";
      item.appendChild(h);
    }
  });
}

function metrics(cv) {
  var cs = getComputedStyle(cv);
  var gap = parseFloat(cs.columnGap || cs.gap) || 0;
  var rowGap = parseFloat(cs.rowGap || cs.gap) || 0;
  var rowH = parseFloat(cs.gridAutoRows) || 64;
  var w = cv.clientWidth;
  var cellW = (w - gap * 11) / 12;
  return { cellW: cellW, gap: gap, stepX: cellW + gap, stepY: rowH + rowGap, rowH: rowH };
}

function num(item, name, dflt) {
  var v = parseFloat(item.style.getPropertyValue(name));
  return isNaN(v) ? dflt : v;
}


document.addEventListener("pointerdown", function (e) {
  if (!wiredCanvas) return;
  var item = e.target.closest(".citem");
  if (!item || !wiredCanvas.contains(item)) return;
  if (e.button !== 0) return;
  e.preventDefault();

  var resizing = !!e.target.closest(".dm-ci-size");
  var m = metrics(wiredCanvas);
  var start = { x: e.clientX, y: e.clientY };
  var orig = { x: num(item, "--x", 1), y: num(item, "--y", 1), w: num(item, "--w", 3), h: num(item, "--h", 2) };
  var cur = { x: orig.x, y: orig.y, w: orig.w, h: orig.h };
  var moved = false;

  function onMove(ev) {
    var dx = Math.round((ev.clientX - start.x) / m.stepX);
    var dy = Math.round((ev.clientY - start.y) / m.stepY);
    if (!moved && !dx && !dy && Math.abs(ev.clientY - start.y) < 4 && Math.abs(ev.clientX - start.x) < 4) return;
    if (!moved) { moved = true; item.classList.add("dm-ci-lift"); readout.style.display = "block"; }

    if (resizing) {
      cur.w = Math.max(1, Math.min(13 - orig.x, orig.w + dx));
      cur.h = Math.max(1, orig.h + dy);
    } else {
      cur.x = Math.max(1, Math.min(13 - orig.w, orig.x + dx));
      cur.y = Math.max(1, orig.y + dy);
    }
    item.style.setProperty("--x", cur.x);
    item.style.setProperty("--y", cur.y);
    item.style.setProperty("--w", cur.w);
    item.style.setProperty("--h", cur.h);
    readout.textContent = resizing
      ? cur.w + " of 12 columns × " + cur.h + " rows"
      : "column " + cur.x + ", row " + cur.y;
    readout.style.left = (ev.clientX + 14) + "px";
    readout.style.top = (ev.clientY - 10) + "px";
  }
  function onUp() {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    item.classList.remove("dm-ci-lift");
    readout.style.display = "none";
    if (moved) {
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 120);
      post({ kind: "adeptsworn-canvas", id: selectedId, index: Number(item.dataset.ci),
             x: cur.x, y: cur.y, w: cur.w, h: cur.h });
    }
  }
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}, true);

/* ---------- staying lined up ---------- */
function refit() {
  if (!selectedId) return;
  var n = find(selectedId);
  if (n) {
    place(frame, n);
    buildBar(n);
    if (wiredCanvas) {
      var m = metrics(wiredCanvas);
      wiredCanvas.style.setProperty("--dm-col", m.stepX + "px");
      wiredCanvas.style.setProperty("--dm-row", m.stepY + "px");
    }
  }
}
window.addEventListener("resize", refit);
window.addEventListener("scroll", function () {
  parent.postMessage({ kind: "adeptsworn-scroll", y: window.scrollY }, "*");
}, { passive: true });
new ResizeObserver(refit).observe(document.body);

/* ---------- talking to the panel ---------- */
function post(msg) { parent.postMessage(msg, "*"); }

window.addEventListener("message", function (e) {
  var d = e.data; if (!d) return;
  if (d.kind === "adeptsworn-theme") {
    for (var k in d.vars) document.documentElement.style.setProperty(k, d.vars[k]);
    setTimeout(refit, 30);
  }
  if (d.kind === "adeptsworn-select") { scan(); select(d.id); }
  if (d.kind === "adeptsworn-state") {
    window.__dmState = d.state; window.__dmNames = d.names;
    scan();
    if (selectedId) select(selectedId);
  }
  if (d.kind === "adeptsworn-scrollto") window.scrollTo(0, d.y);
});

post({ kind: "adeptsworn-ready" });
})();
