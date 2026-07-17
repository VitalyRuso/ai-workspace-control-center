import crypto from "node:crypto";

const SESSION_SECONDS = 7 * 24 * 60 * 60;
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const signature = (value, secret) => crypto.createHmac("sha256", secret).update(value).digest("base64url");
const signed = (value, secret) => `${value}.${signature(value, secret)}`;

function verified(token, secret) {
  if (!token || !secret) return null;
  const split = token.lastIndexOf(".");
  if (split < 1) return null;
  const value = token.slice(0, split);
  const actual = Buffer.from(token.slice(split + 1));
  const expected = Buffer.from(signature(value, secret));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) ? value : null;
}

export function parseCookies(request) {
  return Object.fromEntries(String(request.headers.cookie || "").split(";").flatMap((part) => {
    const index = part.indexOf("=");
    return index < 1 ? [] : [[part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]];
  }));
}

export function cookie(name, value, { maxAge = SESSION_SECONDS } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function createSession(user, secret, now = Date.now()) {
  return signed(encode({ id: String(user.id), login: String(user.login), avatarUrl: String(user.avatarUrl || ""), exp: now + SESSION_SECONDS * 1000 }), secret);
}

export function readSession(request, secret, now = Date.now()) {
  try {
    const value = verified(parseCookies(request).cc_session, secret);
    if (!value) return null;
    const user = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return user.exp > now && user.id && user.login ? user : null;
  } catch { return null; }
}

export function createOAuthState(secret, now = Date.now()) {
  return signed(encode({ nonce: crypto.randomBytes(24).toString("base64url"), exp: now + 10 * 60_000 }), secret);
}

export function verifyOAuthState(value, cookieValue, secret, now = Date.now()) {
  if (!value || value !== cookieValue) return false;
  try {
    const payload = JSON.parse(Buffer.from(verified(value, secret), "base64url").toString("utf8"));
    return payload.exp > now && Boolean(payload.nonce);
  } catch { return false; }
}

export async function exchangeGitHubCode({ code, clientId, clientSecret }) {
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "ai-workspace-control-center" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
  });
  const tokenPayload = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error("GitHub OAuth token exchange failed.");
  const profileResponse = await fetch("https://api.github.com/user", {
    headers: { accept: "application/vnd.github+json", authorization: `Bearer ${tokenPayload.access_token}`, "user-agent": "ai-workspace-control-center" }
  });
  const profile = await profileResponse.json();
  if (!profileResponse.ok || !profile.id || !profile.login) throw new Error("GitHub profile request failed.");
  return { id: String(profile.id), login: String(profile.login), avatarUrl: String(profile.avatar_url || "") };
}

export function validBrowserMutation(request, publicBaseUrl) {
  const origin = request.headers.origin;
  if (!origin || !publicBaseUrl || !String(request.headers["content-type"] || "").startsWith("application/json")) return false;
  try { return new URL(origin).origin === new URL(publicBaseUrl).origin; } catch { return false; }
}
