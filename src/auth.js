// ---------------------------------------------------------------------------
// auth.js — who is allowed to change the site.
//
// One password, kept as a Cloudflare SECRET (never in this repo, which is
// public). You type it once at /admin; the Worker hands back a signed ticket
// in a cookie and checks that ticket on every save. The password itself is
// never stored in the cookie and never leaves Cloudflare.
// ---------------------------------------------------------------------------

const COOKIE   = "as_admin";
const TTL_DAYS = 14;

const enc = new TextEncoder();

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sessionKey(password) {
  // The signing key is derived from the password, so changing the password
  // instantly invalidates every ticket already issued. That is the logout.
  const base = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HKDF" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("adeptsworn-admin"), info: enc.encode("session-v1") },
    base, 256
  );
  return crypto.subtle.importKey("raw", bits, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/* Two strings compared in a way that takes the same time whether they match
   on the first character or the last. Comparing them the ordinary way leaks
   how much of a guess was right. */
function sameSecret(a, b) {
  const A = enc.encode(a), B = enc.encode(b);
  let diff = A.length ^ B.length;
  for (let i = 0; i < Math.max(A.length, B.length); i++) diff |= (A[i] ?? 0) ^ (B[i] ?? 0);
  return diff === 0;
}

export async function issueTicket(password) {
  const payload = b64url(enc.encode(JSON.stringify({ exp: Date.now() + TTL_DAYS * 864e5 })));
  const key = await sessionKey(password);
  const sig = b64url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return `${payload}.${sig}`;
}

export async function ticketValid(token, password) {
  if (!token || !password) return false;
  const [payload, sig] = String(token).split(".");
  if (!payload || !sig) return false;
  const key = await sessionKey(password);
  const expect = b64url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  if (!sameSecret(sig, expect)) return false;
  try {
    const data = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch { return false; }
}

export function readCookie(request, name = COOKIE) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function cookieHeader(token) {
  return token
    ? `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TTL_DAYS * 86400}`
    : `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function isSignedIn(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  return ticketValid(readCookie(request), env.ADMIN_PASSWORD);
}

export { sameSecret };

// ---------------------------------------------------------------------------
// Slowing down guesswork. Ten wrong passwords from one address in fifteen
// minutes and that address is out for the rest of the window.
// ---------------------------------------------------------------------------
const WINDOW_S = 900, MAX_FAILS = 10;

export async function loginBlocked(env, ip) {
  if (!env.SITE) return false;
  const n = Number(await env.SITE.get(`rl:${ip}`)) || 0;
  return n >= MAX_FAILS;
}

export async function noteFailure(env, ip) {
  if (!env.SITE) return;
  const n = (Number(await env.SITE.get(`rl:${ip}`)) || 0) + 1;
  await env.SITE.put(`rl:${ip}`, String(n), { expirationTtl: WINDOW_S });
}

export async function clearFailures(env, ip) {
  if (!env.SITE) return;
  await env.SITE.delete(`rl:${ip}`);
}
