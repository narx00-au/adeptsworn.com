// =====================================================================
//  ADEPTSWORN — sign in with Discord
//
//  This file is the FIRST code that has ever run on adeptsworn.com. Up
//  until now the Cloudflare Worker served files and nothing else.
//
//  It handles four addresses and NOTHING ELSE. Every other request —
//  index.html, assets/, robots.txt — never reaches this file at all:
//  Cloudflare serves a matching static asset first and only calls the
//  Worker when there isn't one. So the site cannot be broken by a bug
//  in here. The worst this file can do is break signing in.
//
//      /auth/login      send the person to Discord
//      /auth/callback   Discord sends them back here
//      /auth/me         "who is signed in?" — this is what lets the
//                       page print a name
//      /auth/logout     forget them
//
//  AND, since 10 September 2026, the Phase 2 server list -- a separate
//  job with its own header further down this file:
//
//      /api/servers            the live list of internet games
//      /api/servers/heartbeat  the Sydney box reporting in
//
//  THREE VALUES REACH THIS CODE AS env.  ONE IS IN THE REPOSITORY AND
//  TWO MUST NEVER BE.  This repo is PUBLIC: a secret committed here is
//  burned the moment it lands, and deleting it afterwards does not help,
//  because the history is public too.
//
//      DISCORD_CLIENT_ID       declared in wrangler.jsonc. It is public
//                              by design — it travels in the address bar
//                              of everyone who signs in. That file says
//                              why it lives there and not in the
//                              dashboard.
//      DISCORD_CLIENT_SECRET   an encrypted SECRET, set on the Worker in
//                              Cloudflare. Never anywhere else.
//      SESSION_SECRET          an encrypted SECRET, ours, any long random
//                              string. It signs our own session cookie.
//
//  Written 8 September 2026. Spec: claude\discord-sign-in.md in the game
//  repo (private). The endpoints below were read off Discord's own
//  documentation that day rather than remembered.
// =====================================================================

// The redirect URI is a CONSTANT on purpose, not built from the incoming
// request. Discord compares it byte for byte against the one registered
// in the developer portal, and it must be identical in two places: the
// redirect we send the person to, and the token exchange afterwards.
// Building it from request.url would silently produce a different string
// on playvoidwizards.com, and the error Discord returns for that does not
// say which of the three copies is the odd one out.
const REDIRECT_URI = "https://adeptsworn.com/auth/callback";

// How long a sign-in lasts before they do it again.
const SESSION_DAYS = 30;

// ---------------------------------------------------------------------
//  COOKIES
//  Small helpers, because getting these attributes wrong is the usual
//  way a login "works locally and not live".
//    HttpOnly  — script on the page cannot read it, so a bad script
//                cannot steal it
//    Secure    — only ever sent over HTTPS
//    SameSite=Lax — survives the return trip from Discord, which is a
//                top-level navigation, but is not sent on requests
//                another site makes on your behalf
// ---------------------------------------------------------------------
function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function setCookie(name, value, seconds) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
}

// ---------------------------------------------------------------------
//  OUR OWN SESSION
//
//  Discord's access token is a RECEIPT, not a session. We do not keep it
//  and we do not hand it to the browser. What the browser gets is our
//  own note — "this is Discord user 123, called Narx, until this date" —
//  with a signature on it made with SESSION_SECRET.
//
//  The signature is the whole point. Anyone can read the note; nobody can
//  change it without the secret, and we only have to check the signature
//  to trust it. No database lookup, which matters later: the same trick
//  is how the Vultr box will eventually trust a player without ever
//  touching the player database. See "RULE ZERO" in the spec.
// ---------------------------------------------------------------------
const b64url = {
  encode(bytes) {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function makeSession(payload, secret) {
  const body = b64url.encode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${b64url.encode(new Uint8Array(sig))}`;
}

async function readSession(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const key = await hmacKey(secret);
  // crypto.subtle.verify is a constant-time comparison. Doing this with
  // === on two strings leaks how much of the signature was right, one
  // character at a time. It is a real attack and it is free to avoid.
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    b64url.decode(sig),
    new TextEncoder().encode(body)
  );
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64url.decode(body)));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
//  A readable failure, rather than a blank page.
//  A login that fails silently is the worst kind to debug, because the
//  browser shows nothing and the log is somewhere else.
// ---------------------------------------------------------------------
function problem(what, detail) {
  return new Response(
    `Sign-in did not complete.\n\n${what}\n\n${detail || ""}\n\nNothing has been saved. Go back to https://adeptsworn.com and try again.\n`,
    { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}

// ---------------------------------------------------------------------
//  IS THIS ACTUALLY A CLIENT ID?
//
//  Added 8 September 2026, an hour after it would have helped.
//
//  A Discord application ID is a "snowflake" — a long DECIMAL NUMBER,
//  around 18 to 19 digits. A Discord client SECRET is 32 mixed letters
//  and digits. They sit next to each other on the same page in the
//  developer portal, and on 8 September the secret went into the field
//  named DISCORD_CLIENT_ID. Discord answered "Invalid Form Body", which
//  is true and tells you nothing, and by then the secret had travelled
//  in a URL and had to be reset.
//
//  This is the project's own recurring fault wearing another costume:
//  something local guessing on behalf of something that already knew.
//  We KNOW what an application ID looks like. Check it here, before it
//  leaves the building.
//
//  IT NEVER PRINTS THE VALUE. Reporting the shape is the whole job, and
//  a message that echoes a secret to a browser has made things worse.
// ---------------------------------------------------------------------
function checkClientId(value) {
  const v = String(value || "");
  if (/^\d{15,25}$/.test(v)) return null;
  const looksLikeASecret = /^[A-Za-z0-9_-]{30,40}$/.test(v) && /[A-Za-z]/.test(v);
  return problem(
    "The value configured as the Discord Client ID is not a Client ID.",
    "A Discord application ID is a long number, about 18 or 19 digits.\n" +
      `What is configured is ${v.length} characters and is not all digits.\n\n` +
      (looksLikeASecret
        ? "IT HAS THE SHAPE OF A CLIENT SECRET. If that is what it is:\n" +
          "  1. Reset the secret in the Discord developer portal NOW. It has\n" +
          "     just travelled in a URL, so treat it as public.\n" +
          "  2. Delete any DISCORD_CLIENT_ID variable in Cloudflare — the real\n" +
          "     one is declared in wrangler.jsonc and a dashboard entry of the\n" +
          "     same name overrides the file.\n" +
          "  3. Put the new secret in DISCORD_CLIENT_SECRET.\n"
        : "Check DISCORD_CLIENT_ID in wrangler.jsonc, and check nothing in the\n" +
          "Cloudflare dashboard is overriding it with the same name.\n")
  );
}

// =====================================================================
//  THE SERVER LIST -- Phase 2, "THE LOBBY". Added 10 September 2026.
//
//      GET   /api/servers            the live list. Public, read-only.
//      POST  /api/servers/heartbeat  a game server saying "I am here".
//
//  WHY THIS IS HERE AND NOT ON THE BOX
//
//  online-service-plan.md's Phase 2 says "a small web service on the
//  box". Ewen ruled against that on 10 September, using his own words
//  from 8 September: the box is hardened to 22/tcp and 27015/udp, and a
//  status panel should be "an outbound post from the box to a Cloudflare
//  Worker, never an inbound port". So:
//
//    * no new inbound port on a machine that currently has two
//    * no TLS certificate to manage, renew, or forget to renew
//    * no second process on the box to keep alive
//    * THE LIST SURVIVES THE BOX GOING DOWN, which is the case where a
//      player most needs to be told something. A list served by the
//      thing it lists is empty exactly when that matters most.
//
//  WHY ENTRIES EXPIRE INSTEAD OF BEING DELETED
//
//  Each entry is written with a TTL a little over three heartbeats. A
//  server that dies, is killed, loses its network, or has its process
//  reaped VANISHES ON ITS OWN, with nobody having to notice.
//
//  A "finished" message is an optimisation on top of that, never the
//  mechanism. A list that needs a graceful shutdown to be correct is a
//  list that is wrong precisely when something has gone wrong -- and on
//  8 September this project watched a server die without saying a word,
//  when a dropped SSH session took it down 23 turns into a game.
//
//  WHAT IS DELIBERATELY NOT IN AN ENTRY: PLAYER NAMES.
//
//  The plan's wording is "what games are running, WHO IS IN THEM, how do
//  I join one". This ships the counts and not the names, on purpose, and
//  by Ewen's own build-now-or-later test: adding names later invalidates
//  nothing already written down, so they are a feature and can wait.
//  Meanwhile a public endpoint listing the names of everybody currently
//  playing is a privacy and a moderation surface, and cross-cutting rule
//  4 is "collect as little personal data as possible -- data never
//  stored cannot be leaked". Counts answer "is there a game I can join",
//  which is the question the screen is actually asking.
// =====================================================================

// KV keys are prefixed so a list() cannot pick up anything else that
// ever comes to share this namespace.
const SERVER_PREFIX = "srv:";

// A little over three heartbeats: miss one and you stay listed, miss
// three and you are gone. 60 is Cloudflare's floor for expirationTtl.
const SERVER_TTL_SECONDS = 90;
const HEARTBEAT_HINT_SECONDS = 25;

// The match ID alphabet, and it is the SAME set as MatchId.gd in the
// game: no I, L, O, U, 0 or 1. Written out in full rather than loosened
// to [A-Z0-9], because this is a public endpoint and the ID becomes a KV
// key -- a strict shape here is what stops anything else being used as
// one.
const MATCH_ID =
  /^ADS-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}$/;

const SERVER_STATES = ["lobby", "playing", "finished"];

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

// ---------------------------------------------------------------------
//  CLEANING WHAT ARRIVES
//
//  The poster holds a shared secret, so this is not a defence against
//  strangers -- it is a defence against the day that secret leaks, or a
//  bug on the box sends something daft. Whatever leaves here goes
//  STRAIGHT ONTO A LIST INSIDE EVERY PLAYER'S GAME CLIENT, so a 40,000
//  character server name is somebody's afternoon.
//
//  Everything is CLAMPED rather than refused, except the match ID and
//  the state. Those two are identity, and a wrong identity should be
//  refused out loud rather than quietly turned into something else.
// ---------------------------------------------------------------------
function cleanText(value, limit) {
  return String(value ?? "")
    // Control characters, including the newlines that would otherwise let
    // one entry pretend to be two in anything that prints a list.
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, limit);
}

function cleanNumber(value, low, high, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(high, Math.max(low, Math.round(n)));
}

// ---------------------------------------------------------------------
//  IS THE LIST EVEN SWITCHED ON?
//
//  The KV namespace has to be created once by hand and its id pasted
//  into wrangler.jsonc. Until that happens `env.LOBBY` is undefined --
//  and THE SITE MUST NOT CARE. So this answers plainly instead of
//  throwing: a 503 with a sentence in it, and an empty list rather than
//  a stack trace. Same reasoning as problem() above. A blank page is the
//  worst possible answer to "why is the server list empty".
// ---------------------------------------------------------------------
function lobbyMissing(env) {
  if (env.LOBBY) return null;
  return {
    error: "lobby_not_configured",
    detail:
      "This Worker has no LOBBY KV namespace bound. Create one in Cloudflare, " +
      "paste its id into wrangler.jsonc, and publish again.",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---------- /auth/login ----------
    if (url.pathname === "/auth/login") {
      if (!env.DISCORD_CLIENT_ID) {
        return problem(
          "This site has not been told its Discord Client ID.",
          "DISCORD_CLIENT_ID is missing. It is declared in wrangler.jsonc, so either that file lost its vars block or this Worker was deployed from somewhere else."
        );
      }
      // Do not send a wrong ID to Discord and let Discord be the one to
      // notice. Its answer is "Invalid Form Body", which is correct and
      // useless.
      const idFault = checkClientId(env.DISCORD_CLIENT_ID);
      if (idFault) return idFault;
      // state: a random value we hand to Discord and get back. If what
      // comes back is not what we sent, the request did not start here,
      // and we refuse it. This is the whole defence against somebody
      // else's login being pushed through your browser.
      const state = crypto.randomUUID();
      const authorize = new URL("https://discord.com/oauth2/authorize");
      authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
      authorize.searchParams.set("redirect_uri", REDIRECT_URI);
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("scope", "identify");
      authorize.searchParams.set("state", state);
      return new Response(null, {
        status: 302,
        headers: {
          Location: authorize.toString(),
          "Set-Cookie": setCookie("aw_state", state, 600),
        },
      });
    }

    // ---------- /auth/callback ----------
    if (url.pathname === "/auth/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const expected = readCookie(request, "aw_state");

      if (url.searchParams.get("error")) {
        // The person pressed Cancel on Discord's page. Not an error on
        // our side and it should not read like one.
        return Response.redirect("https://adeptsworn.com/", 302);
      }
      if (!code) return problem("Discord did not send a code back.", "");
      if (!state || !expected || state !== expected) {
        return problem(
          "That sign-in did not start on this site.",
          "The state value did not match. If you have been sitting on the Discord page for a while, just start again."
        );
      }
      const idFaultBack = checkClientId(env.DISCORD_CLIENT_ID);
      if (idFaultBack) return idFaultBack;
      if (!env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) {
        return problem(
          "This site is missing a secret.",
          "DISCORD_CLIENT_SECRET or SESSION_SECRET is not set on the Worker in Cloudflare."
        );
      }

      // THE EXCHANGE. Two things here are not negotiable and both are
      // from Discord's own documentation:
      //   - form encoding ONLY. JSON is rejected.
      //   - the client id and secret go in a Basic auth header, not in
      //     the body.
      const form = new URLSearchParams();
      form.set("grant_type", "authorization_code");
      form.set("code", code);
      form.set("redirect_uri", REDIRECT_URI);

      const basic = btoa(`${env.DISCORD_CLIENT_ID}:${env.DISCORD_CLIENT_SECRET}`);
      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basic}`,
        },
        body: form.toString(),
      });

      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        return problem(
          "Discord refused to complete the sign-in.",
          `It said: ${tokenRes.status} ${text}\n\nThe usual cause is the redirect address in the Discord developer portal not matching ${REDIRECT_URI} exactly — a trailing slash counts.`
        );
      }

      const token = await tokenRes.json();
      const meRes = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!meRes.ok) {
        return problem("Discord would not say who you are.", `It said: ${meRes.status}`);
      }
      const me = await meRes.json();

      // What we keep. Deliberately almost nothing: an id, a name to
      // print, and an avatar. No email, no token. We did not ask for
      // the email scope and we do not want it yet — see the "are
      // under-18s welcome" question in the spec, which is not settled.
      const session = await makeSession(
        {
          id: me.id,
          name: me.global_name || me.username,
          avatar: me.avatar,
          exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60,
        },
        env.SESSION_SECRET
      );

      const headers = new Headers({ Location: "https://adeptsworn.com/" });
      headers.append("Set-Cookie", setCookie("aw_session", session, SESSION_DAYS * 24 * 60 * 60));
      headers.append("Set-Cookie", setCookie("aw_state", "", 0)); // used once, done
      return new Response(null, { status: 302, headers });
    }

    // ---------- /auth/me ----------
    // The page asks this on load. It is the only reason the page can say
    // a name without a rebuild.
    if (url.pathname === "/auth/me") {
      const payload = env.SESSION_SECRET
        ? await readSession(readCookie(request, "aw_session"), env.SESSION_SECRET)
        : null;
      const body = payload
        ? { signedIn: true, id: payload.id, name: payload.name, avatar: payload.avatar }
        : { signedIn: false };
      return new Response(JSON.stringify(body), {
        headers: {
          "Content-Type": "application/json",
          // Never let a CDN or a browser keep this. It is per-person.
          "Cache-Control": "no-store",
        },
      });
    }

    // ---------- /auth/logout ----------
    if (url.pathname === "/auth/logout") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "https://adeptsworn.com/",
          "Set-Cookie": setCookie("aw_session", "", 0),
        },
      });
    }

    // ---------- POST /api/servers/heartbeat ----------
    //
    // The ONE writing endpoint, and all that stands in front of it is a
    // shared secret. That is proportionate: the worst a forger can do is
    // advertise a game that is not there, which a player discovers in
    // four seconds by failing to connect. It is emphatically NOT a login
    // and nothing past this point is trusted with anything.
    if (url.pathname === "/api/servers/heartbeat") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "post_only" }, 405);
      }
      if (!env.LOBBY_SECRET) {
        return jsonResponse(
          {
            error: "no_lobby_secret",
            detail:
              "LOBBY_SECRET is not set on this Worker. Set it as an encrypted " +
              "secret in Cloudflare. It must never appear in this repository.",
          },
          503
        );
      }
      // A BARE STRING COMPARE, and that is fine here where it would not
      // be in readSession() above. The difference is worth knowing: a
      // timing attack needs many thousands of quiet attempts to read a
      // secret one character at a time, and reading a public list of game
      // servers is not worth that to anybody. readSession guards WHO YOU
      // ARE; this guards addresses that are public the moment they work.
      const offered = (request.headers.get("Authorization") || "").replace(
        /^Bearer\s+/i,
        ""
      );
      if (offered !== env.LOBBY_SECRET) {
        // No detail, on purpose. An error that explains how close you got
        // is an error doing the attacker's work for him.
        return jsonResponse({ error: "not_authorised" }, 401);
      }
      const missingForWrite = lobbyMissing(env);
      if (missingForWrite) return jsonResponse(missingForWrite, 503);

      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "bad_json" }, 400);
      }

      const match = cleanText(body.match, 20).toUpperCase();
      if (!MATCH_ID.test(match)) {
        return jsonResponse(
          { error: "bad_match_id", detail: "Expected the shape ADS-7K2M-9QX4." },
          400
        );
      }
      const state = cleanText(body.state, 12).toLowerCase();
      if (!SERVER_STATES.includes(state)) {
        return jsonResponse(
          {
            error: "bad_state",
            detail: "Expected one of " + SERVER_STATES.join(", ") + ".",
          },
          400
        );
      }

      // A FINISHED MATCH GOES NOW rather than waiting out its TTL. This is
      // the optimisation, not the mechanism -- see the note at the top of
      // this section on why expiry has to be what actually removes it.
      if (state === "finished") {
        await env.LOBBY.delete(SERVER_PREFIX + match);
        return jsonResponse({ ok: true, match, removed: true });
      }

      // THE ADDRESS COMES FROM THE CONNECTION, NOT FROM THE MESSAGE.
      //
      // The box does not get to name itself. CF-Connecting-IP is where the
      // packet actually came from, so it cannot be mistyped into a config
      // file, cannot go stale when the box is rebuilt on a new IP, and
      // cannot be used to point a lobby full of players at somebody else's
      // machine. It is also the address that is genuinely routable back,
      // which is the only one worth publishing.
      const host = request.headers.get("CF-Connecting-IP") || "";
      if (!host) {
        return jsonResponse(
          { error: "no_source_address", detail: "CF-Connecting-IP was absent." },
          400
        );
      }

      const seats = cleanNumber(body.seats, 1, 16, 5);
      const entry = {
        match,
        // The SERVER's name for itself. Not a person's name.
        name: cleanText(body.name, 40) || "Adeptsworn",
        host,
        port: cleanNumber(body.port, 1, 65535, 27015),
        // A CLIENT FILTERS ON THIS. PROTOCOL_VERSION is the gate, and a
        // list that offers a game you will be refused from is a list that
        // wastes your time -- so it travels, and the Internet tab can grey
        // a row out AND SAY WHY, instead of letting the refusal be a
        // surprise at the socket.
        protocol: cleanNumber(body.protocol, 0, 9999, 0),
        seats,
        taken: cleanNumber(body.taken, 0, seats, 0),
        humans: cleanNumber(body.humans, 0, seats, 0),
        state,
        version: cleanText(body.version, 24),
        seen: Math.floor(Date.now() / 1000),
      };

      // WRITTEN INTO THE KEY'S METADATA AS WELL AS ITS VALUE, and that is
      // not belt-and-braces -- it is what makes the read cheap. list()
      // hands back metadata with every key, so GET /api/servers is ONE KV
      // operation however many servers there are. Fetching each value in
      // turn would be one call per server, which is the shape that quietly
      // stops working at the point it begins to matter.
      await env.LOBBY.put(SERVER_PREFIX + match, JSON.stringify(entry), {
        expirationTtl: SERVER_TTL_SECONDS,
        metadata: entry,
      });

      return jsonResponse({
        ok: true,
        match,
        host,
        // TOLD, not assumed. The box prints this, so a heartbeat that is
        // too slow is visible from the box's own console rather than only
        // by watching rows vanish from a list somewhere else.
        heartbeat_within: SERVER_TTL_SECONDS,
        heartbeat_hint: HEARTBEAT_HINT_SECONDS,
      });
    }

    // ---------- GET /api/servers ----------
    // Public and read-only. This is what the game's Internet tab asks, and
    // a browser pointed at it sees exactly the same thing.
    if (url.pathname === "/api/servers") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return jsonResponse({ error: "get_only" }, 405);
      }
      const missingForRead = lobbyMissing(env);
      if (missingForRead) {
        return jsonResponse({ ...missingForRead, servers: [], count: 0 }, 503);
      }

      const listed = await env.LOBBY.list({ prefix: SERVER_PREFIX, limit: 200 });
      const now = Math.floor(Date.now() / 1000);
      const servers = [];
      for (const key of listed.keys) {
        const entry = key.metadata;
        // A key with no metadata was written by an older version of this
        // Worker. Skipped rather than half-drawn: an entry with no address
        // is not joinable, and a row a player cannot click is worse than a
        // row that was never there.
        if (!entry || !entry.host) continue;
        servers.push({
          ...entry,
          seen_seconds_ago: Math.max(0, now - (entry.seen || now)),
        });
      }
      // Newest first. Somebody scanning this wants the game that just
      // opened, and "whatever order KV felt like" is not an order.
      servers.sort((a, b) => (b.seen || 0) - (a.seen || 0));

      return jsonResponse({ servers, count: servers.length }, 200, {
        // FIVE SECONDS. Not none, not a minute. It stops a room full of
        // players each costing a KV read, and five seconds is less than
        // the time it takes to read a list and click a row.
        "Cache-Control": "public, max-age=5",
        // A public read-only list, so the website can show the same thing
        // the game shows without needing a second endpoint for it.
        "Access-Control-Allow-Origin": "*",
      });
    }

    // ---------- everything else ----------
    // Should be unreachable: Cloudflare serves a matching file before
    // calling this Worker at all, so we only get here for an address
    // that is neither a file nor one of ours.
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
  },
};
