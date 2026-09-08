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

    // ---------- everything else ----------
    // Should be unreachable: Cloudflare serves a matching file before
    // calling this Worker at all, so we only get here for an address
    // that is neither a file nor one of ours.
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
  },
};
