// ---------------------------------------------------------------------------
// router.js — the front door. Every request to this Worker arrives here.
//
// This Worker now does three separate jobs, written by different people at
// different times, and the whole point of this file is that they cannot tread
// on each other:
//
//   /                    the public page          -> site.js
//   /index.html          (redirected to /)        -> site.js
//   /admin-api/*         the website editor       -> site.js
//   /media/*             pictures uploaded in it  -> site.js
//
//   /auth/login          sign in with Discord     -> index.js
//   /auth/callback       "                        -> index.js
//   /auth/me             "                        -> index.js
//   /auth/logout         "                        -> index.js
//   /api/servers         the game's server list   -> index.js
//   /api/servers/heartbeat "                      -> index.js
//
//   everything else      a file in this repo      -> index.js, which hands it
//                                                   to Cloudflare's file server
//
// index.js is NOT modified by any of this. It is the code that signs people in
// with Discord and keeps the game's server list, it works, and nothing here
// reaches inside it. Anything this file does not claim goes straight to it,
// exactly as if this file were not here.
//
// THE WEBSITE EDITOR IS AT /admin-api/ AND NOT /api/ ON PURPOSE. /api/servers
// was here first and belongs to the game.
// ---------------------------------------------------------------------------

import lobby from "./index.js";
import site from "./site.js";

const SITE_PATHS = ["/", "/index.html"];
const SITE_PREFIXES = ["/admin-api/", "/media/"];

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;

    const mine = SITE_PATHS.includes(path) || SITE_PREFIXES.some((p) => path.startsWith(p));
    if (mine) return site.fetch(request, env, ctx);

    return lobby.fetch(request, env, ctx);
  }
};
