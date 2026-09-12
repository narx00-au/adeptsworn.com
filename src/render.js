// ---------------------------------------------------------------------------
// render.js — turns content + theme into the finished HTML page.
//
// The public site is built here, on Cloudflare's edge, every time someone
// asks for it. Same markup the hand-written index.html had; the words and the
// colours just arrive from KV now instead of being typed into the file.
// ---------------------------------------------------------------------------

import { buildCss } from "./css.js";

/* Plain text -> safe HTML. Used for anything that should never contain markup. */
export const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/* Attribute value. */
const attr = (s) => esc(s);

/* Rich text. Only the signed-in admin can write these, but a stray <script>
   or an onclick= would still be a bad day, so both are stripped on the way out.
   Belt and braces: this is the last gate before it reaches a visitor. */
export function rich(s) {
  return String(s ?? "")
    // Whole elements that must never appear, contents and all.
    .replace(/<\s*(script|style|iframe|object|embed|template)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    // ...and any stray half of one of those, plus tags that would break the page.
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|template|form|link|meta|base)\b[^>]*>/gi, "")
    // Event handlers: onclick=, onerror=, in any quoting style.
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // Addresses that run code instead of going somewhere.
    .replace(/((?:href|src|xlink:href)\s*=\s*["']?)\s*(?:javascript|vbscript)\s*:/gi, "$1#");
}

const bgClass = (b) => b === "deep" ? "bg-deep" : b === "lift" ? "bg-lift" : "bg-ground";

/* Everything a section wears: its background, how wide it runs, whether it is
   centred, and any spacing dragged onto it in the editor. */
const frame = (b) => {
  const cls = [bgClass(b.background), "w-" + (b.width || "normal")];
  if (b.align === "center") cls.push("align-center");
  const style = [];
  if (b.padTop != null && b.padTop !== "") style.push(`--sec-pt:${Number(b.padTop)}rem`);
  if (b.padBottom != null && b.padBottom !== "") style.push(`--sec-pb:${Number(b.padBottom)}rem`);
  return `class="${cls.join(" ")}" id="${attr(b.id)}"${style.length ? ` style="${style.join(";")}"` : ""}`;
};

const secHead = (b) => {
  const bits = [];
  if (b.eyebrow) bits.push(`<p class="label">${esc(b.eyebrow)}</p>`);
  if (b.heading) bits.push(`<h2>${rich(b.heading)}</h2>`);
  if (b.intro)   bits.push(`<p>${rich(b.intro)}</p>`);
  return bits.length ? `<div class="sec-head">${bits.join("")}</div>` : "";
};

// ---------------------------------------------------------------------------
// One function per block type. Add a type here and in schema.js and the admin
// panel picks it up on its own.
// ---------------------------------------------------------------------------
const BLOCKS = {

  hero(b, opts) {
    const pills = (b.pills || []).map(p =>
      `<span class="pill${p.strong ? " pill--live" : ""}">${esc(p.text)}</span>`).join("\n      ");
    const cls = ["hero", "w-" + (b.width || "normal")];
    if (b.align === "center") cls.push("align-center");
    const style = [];
    if (b.padTop != null && b.padTop !== "") style.push(`--sec-pt:${Number(b.padTop)}rem`);
    if (b.padBottom != null && b.padBottom !== "") style.push(`--sec-pb:${Number(b.padBottom)}rem`);
    return `<header class="${cls.join(" ")}" id="${attr(b.id)}"${style.length ? ` style="${style.join(";")}"` : ""}>
  <div class="shell hero__inner">
    ${opts.accountStrip ? `<!-- Filled in by script once /auth/me answers, so nobody ever sees
         the wrong state for a moment. Stays hidden if the Worker is not
         answering, which is what the site looked like before 8 Sept. -->
    <div class="account" id="account" hidden></div>` : ""}
    ${b.eyebrow ? `<p class="label">${esc(b.eyebrow)}</p>` : ""}
    ${b.image ? `<h1 class="wordmark"><img src="${attr(b.image)}" width="${attr(b.imageWidth || 1600)}" height="${attr(b.imageHeight || 902)}" alt="${attr(b.imageAlt || "")}" fetchpriority="high"></h1>`
              : `<h1>${esc(b.imageAlt || "")}</h1>`}
    ${b.tagline ? `<p class="hero__tagline">${esc(b.tagline)}</p>` : ""}
    ${b.lede ? `<p class="hero__lede">${rich(b.lede)}</p>` : ""}
    ${b.kicker ? `<p class="hero__kicker">${rich(b.kicker)}</p>` : ""}
    ${pills ? `<div class="hero__meta">\n      ${pills}\n    </div>` : ""}
  </div>
</header>`;
  },

  "realms-demo"(b) {
    const realms = (b.realms || []).map(r => `<button class="realm realm--${attr(r.affinity || "none")}" type="button" aria-pressed="false" data-hue="--${attr(r.affinity || "muted")}">
            <span class="realm__art">
              ${r.icon ? `<img class="realm__icon" src="${attr(r.icon)}" alt="">` : ""}
              ${r.image ? `<img class="realm__pic" src="${attr(r.image)}" alt="${attr(r.alt || "")}">` : ""}
            </span>
            <span class="realm__foot">
              <span class="realm__name">${esc(r.name)}</span><br>
              <span class="realm__rule">${esc(r.rule)}</span>
            </span>
          </button>`).join("\n          ");

    return `<section ${frame(b)}>
  <div class="shell">
    ${secHead(b)}
    <div class="rhythm__grid">
      <div class="rhythm__stage">
        <div class="realms" data-realms>
          ${realms}
        </div>
      </div>
      <div>
        <div class="battery">
          <div class="battery__head">
            <span class="label">${esc(b.batteryLabel)}</span>
            <span class="battery__count" data-count>0</span>
          </div>
          <div class="pips" data-pips><span class="pips__empty">${esc(b.emptyText)}</span></div>
        </div>
        <div class="stages">
          <button class="stage-btn" type="button" data-end>
            ${esc(b.buttonEnd)}
            <small>${esc(b.buttonEndNote)}</small>
          </button>
          <button class="stage-btn" type="button" data-restore>
            ${esc(b.buttonRestore)}
            <small>${esc(b.buttonRestoreNote)}</small>
          </button>
        </div>
        ${b.note ? `<p class="rhythm__note">${rich(b.note)}</p>` : ""}
      </div>
    </div>
  </div>
</section>`;
  },

  cards(b) {
    const items = (b.items || []).map(i => `<article class="aff aff--${attr(i.hue || "none")}">
      ${i.image ? `<div class="aff__img">
        ${i.icon ? `<img src="${attr(i.icon)}" alt="" class="aff__sym" width="28" height="28">` : ""}
        <img src="${attr(i.image)}" alt="${attr(i.alt || "")}">
      </div>` : ""}
      <div class="aff__body">
        ${i.eyebrow ? `<p class="aff__name">${esc(i.eyebrow)}</p>` : ""}
        ${i.title ? `<h3 class="aff__adept">${esc(i.title)}</h3>` : ""}
        ${i.subtitle ? `<p class="aff__passive">${esc(i.subtitle)}</p>` : ""}
        ${i.text ? `<p class="aff__text">${rich(i.text)}</p>` : ""}
      </div>
    </article>`).join("\n    ");

    const grid = `<div class="affinities" data-cols="${attr(b.columns || 3)}">
    ${items}
  </div>`;

    return `<section ${frame(b)}>
  <div class="shell">
    ${secHead(b)}
  </div>
  ${b.fullBleed ? grid : `<div class="shell">${grid}</div>`}
</section>`;
  },

  steps(b) {
    const numbered = b.numbered !== false;
    const items = (b.items || []).map((it, n) => `<li class="turn__item">
        ${numbered ? `<span class="turn__n">${String(n + 1).padStart(2, "0")}</span>` : ""}
        <div>
          <h3 class="turn__name">${esc(it.name)}</h3>
          <p class="turn__desc">${rich(it.desc)}</p>
        </div>
      </li>`).join("\n      ");

    return `<section ${frame(b)}>
  <div class="shell">
    ${secHead(b)}
    <ol class="turn__list" data-numbered="${numbered ? "yes" : "no"}">
      ${items}
    </ol>
  </div>
</section>`;
  },

  "split-table"(b) {
    const paras = (b.paragraphs || []).map(p => `<p class="split__p">${rich(p)}</p>`).join("\n        ");
    const head = (b.tableHead || []).map(h => `<th scope="col">${esc(h)}</th>`).join("");
    const rows = (b.tableRows || []).map(r =>
      `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("\n            ");

    return `<section ${frame(b)}>
  <div class="shell split">
    <div>
      ${secHead(b)}
      <div class="prose">
        ${paras}
      </div>
    </div>
    <div>
      ${b.tableLabel ? `<p class="label" style="margin-bottom:1rem">${esc(b.tableLabel)}</p>` : ""}
      <div class="tablewrap">
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
      ${b.tableNote ? `<p class="tablenote">${rich(b.tableNote)}</p>` : ""}
    </div>
  </div>
</section>`;
  },

  status(b) {
    const rows = (b.rows || []).map(r => `<li class="status__row">
        <span class="status__tag${r.tone && r.tone !== "off" ? ` status__tag--${attr(r.tone)}` : ""}">${esc(r.tag)}</span>
        <span class="status__txt">${rich(r.text)}</span>
      </li>`).join("\n      ");

    return `<section ${frame(b)}>
  <div class="shell">
    ${secHead(b)}
    <ul class="status__list">
      ${rows}
    </ul>
  </div>
</section>`;
  },

  prose(b) {
    const paras = (b.paragraphs || []).map(p => `<p>${rich(p)}</p>`).join("\n      ");
    return `<section ${frame(b)}>
  <div class="shell">
    ${secHead(b)}
    <div class="prose pblock">
      ${paras}
    </div>
  </div>
</section>`;
  },

  gallery(b) {
    const figs = (b.items || []).map(i => `<figure>
      <img src="${attr(i.image)}" alt="${attr(i.alt || "")}" loading="lazy">
      ${i.caption ? `<figcaption>${rich(i.caption)}</figcaption>` : ""}
    </figure>`).join("\n    ");
    return `<section ${frame(b)}>
  <div class="shell">
    ${secHead(b)}
  </div>
  <div class="shell"><div class="gallery" data-cols="${attr(b.columns || 3)}">
    ${figs}
  </div></div>
</section>`;
  },

  cta(b) {
    const btns = (b.buttons || []).map(x =>
      `<a class="btn${x.primary ? " btn--primary" : ""}" href="${attr(x.href)}"${/^https?:/i.test(x.href || "") ? ' rel="noopener"' : ""}>${esc(x.label)}</a>`
    ).join("\n      ");
    return `<section ${frame(b)}>
  <div class="shell cta">
    ${secHead(b)}
    ${btns ? `<div class="cta__row">\n      ${btns}\n    </div>` : ""}
  </div>
</section>`;
  },

  contact(b) {
    const forms = (b.forms || []).map((f, fi) => {
      const fields = (f.fields || []).map(fl => {
        const id = `f${fi}-${esc(fl.name)}`;
        const label = `<label class="flabel" for="${id}">${esc(fl.label)}${fl.hint ? ` <span>${esc(fl.hint)}</span>` : ""}</label>`;
        let input;
        if (fl.kind === "select") {
          input = `<select class="finput" id="${id}" name="${attr(fl.name)}">${
            (fl.options || []).map(o => `<option>${esc(o)}</option>`).join("")}</select>`;
        } else if (fl.kind === "textarea") {
          input = `<textarea class="finput" id="${id}" name="${attr(fl.name)}"${fl.required ? " required" : ""} placeholder="${attr(fl.placeholder || "")}"></textarea>`;
        } else {
          const type = fl.kind === "email" ? "email" : "text";
          input = `<input class="finput" id="${id}" type="${type}" name="${attr(fl.name)}"${fl.required ? " required" : ""}${fl.kind === "email" ? ' autocomplete="email"' : fl.name === "name" ? ' autocomplete="name"' : ""} placeholder="${attr(fl.placeholder || "")}">`;
        }
        return `<div class="field">\n          ${label}\n          ${input}\n        </div>`;
      }).join("\n\n        ");

      return `<form class="formcard" novalidate>
        <h3>${esc(f.title)}</h3>
        <p class="formcard__lede">${rich(f.lede)}</p>

        <input type="hidden" name="access_key" value="${attr(f.accessKey)}">
        <input type="hidden" name="subject" value="${attr(f.subject)}">
        <input type="hidden" name="from_name" value="adeptsworn.com">
        <div class="fhp" aria-hidden="true"><label>Leave this empty<input type="text" name="botcheck" tabindex="-1" autocomplete="off"></label></div>

        ${fields}

        <button class="fsend" type="submit">${esc(f.send || "Send")}</button>
        <p class="fnote" role="status" aria-live="polite"></p>
      </form>`;
    }).join("\n\n      ");

    const addrs = (b.addresses || []).map(a =>
      `<li><span class="addrs__what">${esc(a.what)}</span> <a class="link" href="mailto:${attr(a.email)}">${esc(a.email)}</a></li>`).join("\n        ");

    return `<section ${frame(b)}>
  <div class="shell">
    ${secHead(b)}
    <div class="forms" data-count="${(b.forms || []).length}">
      ${forms}
    </div>
    <div class="contact__foot">
      ${b.addressesLede ? `<p>${rich(b.addressesLede)}</p>` : ""}
      <ul class="addrs">
        ${addrs}
      </ul>
      ${b.privacy ? `<p>${rich(b.privacy)}</p>` : ""}
    </div>
  </div>
</section>`;
  },

  canvas(b) {
    // Sorted top-to-bottom then left-to-right, because that DOM order is what
    // a phone gets when the grid collapses into a single column.
    const items = (b.items || []).map((it, i) => ({ it, i }))
      .sort((a, z) => (Number(a.it.y || 1) - Number(z.it.y || 1)) || (Number(a.it.x || 1) - Number(z.it.x || 1)));

    const drawn = items.map(({ it, i }) => {
      const pos = `--x:${Number(it.x) || 1};--y:${Number(it.y) || 1};--w:${Number(it.w) || 3};--h:${Number(it.h) || 2}`;
      let inner = "";
      if (it.kind === "image") {
        inner = it.image ? `<img src="${attr(it.image)}" alt="${attr(it.alt || "")}" style="object-fit:${it.fit === "contain" ? "contain" : "cover"}" loading="lazy">` : "";
      } else if (it.kind === "button") {
        inner = `<a class="btn${it.primary ? " btn--primary" : ""}" href="${attr(it.href || "#")}"${/^https?:/i.test(it.href || "") ? ' rel="noopener"' : ""}>${esc(it.text || "Button")}</a>`;
      } else if (it.kind === "panel") {
        inner = "";
      } else {
        inner = `<div class="ctext">${rich(it.text)}</div>`;
      }
      return `<div class="citem citem--${attr(it.kind || "text")} csize--${attr(it.size || "body")}" data-ci="${i}" style="${pos}">${inner}</div>`;
    }).join("\n      ");

    const rows = (b.items || []).reduce((m, it) => Math.max(m, (Number(it.y) || 1) + (Number(it.h) || 2) - 1), 4);

    return `<section ${frame(b)}>
  <div class="shell">
    ${secHead(b)}
    <div class="canvas" data-canvas style="--canvas-row:${Number(b.rowHeight) || 4}rem;--canvas-gap:${b.gap == null || b.gap === "" ? 1 : Number(b.gap)}rem;--canvas-rows:${rows}">
      ${drawn}
    </div>
  </div>
</section>`;
  },

  html(b) {
    return `<section ${frame(b)}>
  <div class="shell">
    ${secHead(b)}
    ${rich(b.html)}
  </div>
</section>`;
  }
};

// ---------------------------------------------------------------------------

const DEMO_JS = `(function(){
  document.querySelectorAll('[data-realms]').forEach(function(group){
    var scope = group.closest('section');
    var pips = scope.querySelector('[data-pips]');
    var count = scope.querySelector('[data-count]');
    var empty = pips ? pips.innerHTML : '';
    var realms = Array.prototype.slice.call(group.querySelectorAll('.realm'));
    var battery = [];
    function render(){
      if(count) count.textContent = battery.length;
      if(!pips) return;
      if(!battery.length){ pips.innerHTML = empty; return; }
      pips.innerHTML = '';
      battery.forEach(function(hue){
        var p = document.createElement('span');
        p.className = 'pip';
        p.style.setProperty('--pip','var(' + hue + ')');
        pips.appendChild(p);
      });
    }
    realms.forEach(function(btn){
      btn.addEventListener('click', function(){
        if(btn.getAttribute('aria-pressed') === 'true') return;
        btn.setAttribute('aria-pressed','true');
        battery.push(btn.dataset.hue);
        render();
      });
    });
    var end = scope.querySelector('[data-end]');
    var restore = scope.querySelector('[data-restore]');
    if(end) end.addEventListener('click', function(){ battery = []; render(); });
    if(restore) restore.addEventListener('click', function(){
      realms.forEach(function(b){ b.setAttribute('aria-pressed','false'); });
    });
    render();
  });
})();`;

const FORMS_JS = `(function(){
  var ENDPOINT = 'https://api.web3forms.com/submit';
  document.querySelectorAll('form.formcard').forEach(function(form){
    var note = form.querySelector('.fnote');
    var send = form.querySelector('.fsend');
    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      var keyEl = form.querySelector('input[name="access_key"]');
      var key = keyEl ? keyEl.value : '';
      if(!key || key.indexOf('REPLACE_WITH') === 0){
        note.dataset.state = 'bad';
        note.textContent = 'This form is not connected yet.';
        return;
      }
      if(!form.checkValidity()){
        note.dataset.state = 'bad';
        note.textContent = 'Something above is missing or not a valid email address.';
        form.reportValidity();
        return;
      }
      var data = {};
      new FormData(form).forEach(function(v,k){ data[k] = v; });
      send.disabled = true;
      note.dataset.state = '';
      note.textContent = 'Sending\\u2026';
      fetch(ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Accept':'application/json'},
        body: JSON.stringify(data)
      })
      .then(function(r){ return r.json(); })
      .then(function(res){
        if(res.success){
          form.reset();
          note.dataset.state = 'ok';
          note.textContent = 'Sent. Thank you \\u2014 I read every one of these.';
        } else {
          note.dataset.state = 'bad';
          note.textContent = 'That did not send. Try again, or email me directly.';
        }
      })
      .catch(function(){
        note.dataset.state = 'bad';
        note.textContent = 'That did not send \\u2014 the connection failed. Try again, or email me directly.';
      })
      .finally(function(){ send.disabled = false; });
    });
  });
})();`;

/* Copied verbatim from the hand-written page of 8 September. It asks the
   Discord sign-in Worker who you are and fills the strip at the top of the
   hero. Left exactly as it was: it is working code that somebody thought
   carefully about, and the reasoning is in its own comment. */
const ACCOUNT_JS = `/* ---------------------------------------------------------------
   WHO IS SIGNED IN.
   Asks the Worker at /auth/me and fills the strip at the top. If
   anything at all goes wrong -- no Worker deployed, no answer, an
   answer that is not JSON -- the strip simply stays hidden and the
   page is exactly what it was before sign-in existed. A site that
   half-works is worse than one that does not mention the feature.
   --------------------------------------------------------------- */
(async function () {
  var el = document.getElementById("account");
  if (!el) return;
  try {
    var r = await fetch("/auth/me", { headers: { Accept: "application/json" } });
    if (!r.ok) return;
    var me = await r.json();
    if (me.signedIn) {
      var who = document.createElement("span");
      who.className = "account__who";
      who.appendChild(document.createTextNode("Signed in as "));
      var name = document.createElement("strong");
      // textContent, NEVER innerHTML. A Discord display name is somebody
      // else's text and they choose every character of it.
      name.textContent = me.name || "you";
      who.appendChild(name);
      var out = document.createElement("a");
      out.className = "account__out";
      out.href = "/auth/logout";
      out.textContent = "Sign out";
      el.appendChild(who);
      el.appendChild(out);
    } else {
      var into = document.createElement("a");
      into.className = "account__in";
      into.href = "/auth/login";
      into.textContent = "Sign in with Discord";
      el.appendChild(into);
    }
    el.hidden = false;
  } catch (e) {
    /* leave it hidden */
  }
})();`;

export function renderPage(content, theme, opts = {}) {
  const s = content.site || {};
  const visible = (content.blocks || []).filter(b => !b.hidden);
  const body = visible.map(b => {
    const fn = BLOCKS[b.type];
    if (!fn) return `<!-- unknown block type: ${esc(b.type)} -->`;
    try { return fn(b, { accountStrip: s.accountStrip !== false }); }
    catch (err) { return `<!-- block ${esc(b.id)} failed: ${esc(err.message)} -->`; }
  });

  // The hero is a <header>; everything after it belongs inside <main>.
  const heroHtml = visible[0] && visible[0].type === "hero" ? body.shift() : "";

  const f = content.footer || {};
  const footer = `<footer>
  <div class="shell foot">
    ${f.mark ? `<span class="foot__mark">${esc(f.mark)}</span>` : ""}
    ${(f.lines || []).map(l => `<p>${rich(l)}</p>`).join("\n    ")}
  </div>
</footer>`;

  const needsDemo = visible.some(b => b.type === "realms-demo");
  const needsForms = visible.some(b => b.type === "contact");

  return `<!doctype html>
<html lang="${attr(s.lang || "en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.title)}</title>
<meta name="description" content="${attr(s.description)}">
<meta property="og:title" content="${attr(s.ogTitle || s.title)}">
<meta property="og:description" content="${attr(s.ogDescription || s.description)}">
<meta property="og:type" content="website">
${s.ogImage ? `<meta property="og:image" content="${attr(s.ogImage)}">` : ""}
${s.url ? `<meta property="og:url" content="${attr(s.url)}">` : ""}
${s.url ? `<link rel="canonical" href="${attr(s.url)}">` : ""}
${s.favicon ? `<link rel="icon" href="${attr(s.favicon)}" sizes="32x32">` : ""}
${s.appleIcon ? `<link rel="apple-touch-icon" href="${attr(s.appleIcon)}">` : ""}
${theme.fonts && theme.fonts.webfontHref ? `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${attr(theme.fonts.webfontHref)}">` : ""}
<style>${buildCss(theme)}</style>
</head>
<body${opts.preview ? ' data-preview="1"' : ""}>
${heroHtml}

<main>
${body.join("\n\n")}
</main>

${footer}

${needsDemo ? `<script>\n${DEMO_JS}\n</script>` : ""}
${needsForms ? `<script>\n${FORMS_JS}\n</script>` : ""}
${s.accountStrip !== false ? `<script>\n${ACCOUNT_JS}\n</script>` : ""}
${opts.preview ? `<script src="/admin/preview.js"></script>` : ""}
</body>
</html>`;
}
