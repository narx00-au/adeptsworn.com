// ---------------------------------------------------------------------------
// site.js — the public page, and the editor behind it.
//
// Three jobs:
//   1. Serve the public page at / , built from whatever is in KV.
//   2. Serve /admin-api/* for the admin panel, which nothing can touch
//      without signing in.
//   3. Hand everything else (pictures, /admin) to the static files in this
//      repo, which Cloudflare serves for us.
//
// THIS IS NOT THE FRONT DOOR. src/router.js is, and it sends only the
// addresses above here. Discord sign-in and the game server list live in
// src/index.js and are not touched by anything in this file. The admin API
// is at /admin-api/ and NOT /api/ for exactly that reason: /api/servers is
// already taken by the game.
//
// If KV is empty or missing, the public page falls back to the copy in
// src/seed.js. The site cannot go blank because of a storage problem.
// ---------------------------------------------------------------------------

import { renderPage } from "./render.js";
import { DEFAULT_CONTENT, DEFAULT_THEME } from "./seed.js";
import { BLOCK_TYPES, SITE_FIELDS, FOOTER_FIELDS, THEME_FIELDS } from "./schema.js";
import {
  isSignedIn, issueTicket, cookieHeader, sameSecret,
  loginBlocked, noteFailure, clearFailures
} from "./auth.js";

const K = {
  published: "content:published",
  draft:     "content:draft",
  snapIndex: "snapshots",
  snap:      (ts) => `snapshot:${ts}`,
  mediaIndex:"media:index",
  media:     (name) => `media:${name}`
};

const KEEP_SNAPSHOTS = 20;
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });

const SEED = () => ({ content: structuredClone(DEFAULT_CONTENT), theme: structuredClone(DEFAULT_THEME) });

async function readDoc(env, key) {
  if (!env.SITE) return null;
  try { return await env.SITE.get(key, "json"); } catch { return null; }
}

async function getPublished(env) { return (await readDoc(env, K.published)) || SEED(); }
async function getDraft(env)     { return (await readDoc(env, K.draft)) || (await getPublished(env)); }

/* A saved document must have the shape the renderer expects, or a bad save
   takes the live site down. Anything missing is filled from the seed rather
   than trusted. */
function coerce(doc) {
  const seed = SEED();
  const out = { content: {}, theme: {} };
  out.content.site   = { ...seed.content.site,   ...(doc?.content?.site   || {}) };
  out.content.footer = { ...seed.content.footer, ...(doc?.content?.footer || {}) };
  out.content.blocks = Array.isArray(doc?.content?.blocks) ? doc.content.blocks : seed.content.blocks;
  out.content.blocks = out.content.blocks
    .filter(b => b && typeof b === "object" && BLOCK_TYPES[b.type])
    .map((b, i) => ({ ...b, id: String(b.id || `block-${i + 1}`).replace(/[^a-z0-9-]/gi, "-").toLowerCase() }));
  out.theme = {
    colours: { ...seed.theme.colours, ...(doc?.theme?.colours || {}) },
    fonts:   { ...seed.theme.fonts,   ...(doc?.theme?.fonts   || {}) },
    layout:  { ...seed.theme.layout,  ...(doc?.theme?.layout  || {}) },
    custom:  typeof doc?.theme?.custom === "string" ? doc.theme.custom : ""
  };
  return out;
}

async function snapshotList(env) { return (await readDoc(env, K.snapIndex)) || []; }
async function mediaList(env)    { return (await readDoc(env, K.mediaIndex)) || []; }

// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/index.html") return Response.redirect(new URL("/", url).toString(), 301);
      if (path.startsWith("/admin-api/")) return await api(request, env, url);
      if (path.startsWith("/media/")) return await serveMedia(request, env, path.slice(7));
      if (path === "/" ) return await servePage(request, env, url);
    } catch (err) {
      // Never show a visitor a stack trace, and never let one bad save take
      // the page down: fall back to what is in the repo.
      if (path === "/") {
        const seed = SEED();
        return new Response(renderPage(seed.content, seed.theme), {
          status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
        });
      }
      return json({ error: "Something went wrong at our end.", detail: String(err && err.message || err) }, 500);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  }
};

// ---------------------------------------------------------------------------

async function servePage(request, env, url) {
  const wantsPreview = url.searchParams.has("preview");
  let doc;

  if (wantsPreview && await isSignedIn(request, env)) {
    doc = coerce(await getDraft(env));
    const html = renderPage(doc.content, doc.theme, { preview: true });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }

  doc = coerce(await getPublished(env));
  return new Response(renderPage(doc.content, doc.theme), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Short, so a publish shows up quickly, but not zero, so Cloudflare
      // still absorbs a rush of visitors.
      "Cache-Control": "public, max-age=0, s-maxage=60, must-revalidate"
    }
  });
}

async function serveMedia(request, env, name) {
  if (!env.SITE) return new Response("Not found", { status: 404 });
  const safe = decodeURIComponent(name).replace(/[^A-Za-z0-9._-]/g, "");
  const entry = (await mediaList(env)).find(m => m.name === safe);
  if (!entry) return new Response("Not found", { status: 404 });
  const body = await env.SITE.get(K.media(safe), "arrayBuffer");
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, {
    headers: {
      "Content-Type": entry.type || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}

// ---------------------------------------------------------------------------
// The admin API. Everything except session and login needs the cookie.
// ---------------------------------------------------------------------------

async function api(request, env, url) {
  const path = url.pathname.replace(/^\/admin-api\//, "");
  const method = request.method;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  if (path === "session" && method === "GET") {
    return json({
      signedIn: await isSignedIn(request, env),
      configured: Boolean(env.ADMIN_PASSWORD),
      storage: Boolean(env.SITE)
    });
  }

  if (path === "login" && method === "POST") {
    if (!env.ADMIN_PASSWORD) {
      return json({ error: "No admin password has been set on this Worker yet. Add a secret called ADMIN_PASSWORD in the Cloudflare dashboard." }, 503);
    }
    if (await loginBlocked(env, ip)) {
      return json({ error: "Too many wrong passwords. Wait fifteen minutes and try again." }, 429);
    }
    const body = await request.json().catch(() => ({}));
    if (!sameSecret(String(body.password || ""), env.ADMIN_PASSWORD)) {
      await noteFailure(env, ip);
      return json({ error: "Wrong password." }, 401);
    }
    await clearFailures(env, ip);
    const ticket = await issueTicket(env.ADMIN_PASSWORD);
    return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(ticket) });
  }

  if (path === "logout" && method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(null) });
  }

  // ---- everything below is for signed-in eyes only ----
  if (!await isSignedIn(request, env)) return json({ error: "Not signed in." }, 401);

  if (path === "schema" && method === "GET") {
    return json({ blockTypes: BLOCK_TYPES, siteFields: SITE_FIELDS, footerFields: FOOTER_FIELDS, themeFields: THEME_FIELDS });
  }

  if (path === "state" && method === "GET") {
    const [published, draftRaw, snaps, media] = await Promise.all([
      getPublished(env), readDoc(env, K.draft), snapshotList(env), mediaList(env)
    ]);
    const draft = coerce(draftRaw || published);
    return json({
      draft,
      published: coerce(published),
      hasDraft: Boolean(draftRaw),
      dirty: Boolean(draftRaw) && JSON.stringify(draft) !== JSON.stringify(coerce(published)),
      snapshots: snaps,
      media,
      storage: Boolean(env.SITE)
    });
  }

  if (!env.SITE) {
    return json({ error: "No storage is connected to this Worker. Add the KV namespace binding called SITE and deploy again." }, 503);
  }

  if (path === "draft" && method === "PUT") {
    const doc = coerce(await request.json());
    await env.SITE.put(K.draft, JSON.stringify(doc));
    return json({ ok: true, savedAt: Date.now() });
  }

  if (path === "publish" && method === "POST") {
    const draft = coerce(await getDraft(env));

    // Snapshot what is about to be replaced, so "put it back" is always
    // possible. On the very first publish that is the version in the repo,
    // which is exactly the one worth being able to get back to.
    const previous = (await readDoc(env, K.published)) || SEED();
    const ts = Date.now();
    const label = (await request.json().catch(() => ({}))).label || "";
    const older = await snapshotList(env);
    await env.SITE.put(K.snap(ts), JSON.stringify(previous));
    await env.SITE.put(K.snapIndex, JSON.stringify([{ ts, label }, ...older].slice(0, KEEP_SNAPSHOTS)));
    for (const d of older.slice(KEEP_SNAPSHOTS - 1)) await env.SITE.delete(K.snap(d.ts));

    await env.SITE.put(K.published, JSON.stringify(draft));
    return json({ ok: true, publishedAt: Date.now() });
  }

  if (path === "revert" && method === "POST") {
    await env.SITE.delete(K.draft);
    return json({ ok: true });
  }

  if (path === "restore" && method === "POST") {
    const { ts } = await request.json().catch(() => ({}));
    const snap = await readDoc(env, K.snap(ts));
    if (!snap) return json({ error: "That version is no longer stored." }, 404);
    await env.SITE.put(K.draft, JSON.stringify(coerce(snap)));
    return json({ ok: true });
  }

  if (path === "seed" && method === "POST") {
    await env.SITE.put(K.draft, JSON.stringify(SEED()));
    return json({ ok: true });
  }

  if (path === "media" && method === "POST") {
    const rawName = request.headers.get("X-Filename") || "upload";
    const name = rawName.toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 60);
    const type = request.headers.get("Content-Type") || "application/octet-stream";
    if (!/^image\//.test(type)) return json({ error: "Only pictures can be uploaded." }, 415);
    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_MEDIA_BYTES) {
      return json({ error: `That picture is ${(body.byteLength / 1048576).toFixed(1)} MB. The limit is 8 MB — shrink it and try again.` }, 413);
    }
    await env.SITE.put(K.media(name), body);
    const list = (await mediaList(env)).filter(m => m.name !== name);
    list.unshift({ name, type, size: body.byteLength, ts: Date.now() });
    await env.SITE.put(K.mediaIndex, JSON.stringify(list));
    return json({ ok: true, name, url: `/media/${name}` });
  }

  if (path.startsWith("media/") && method === "DELETE") {
    const name = decodeURIComponent(path.slice(6)).replace(/[^A-Za-z0-9._-]/g, "");
    await env.SITE.delete(K.media(name));
    await env.SITE.put(K.mediaIndex, JSON.stringify((await mediaList(env)).filter(m => m.name !== name)));
    return json({ ok: true });
  }

  return json({ error: "Unknown request." }, 404);
}
