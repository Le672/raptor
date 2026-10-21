// Cloudflare Pages Function: API authentication utilities
// Handles JWT generation, verification, and password hashing

function getJwtSecret(env: any): string {
  if (typeof env?.JWT_SECRET !== "string" || !env.JWT_SECRET ||
      env.JWT_SECRET === "dev-only-never-use-in-production-change-me") {
    throw new Error("JWT_SECRET is not configured");
  }
  return env.JWT_SECRET;
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

function base64UrlEncode(data: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(data)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
}

function signatureBytes(data: string): Uint8Array {
  return Uint8Array.from(atob(data.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}

export async function signJWT(
  payload: {
    userId: number;
    email: string;
    role: string;
    name: string;
  },
  env: any,
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 days
  };

  const headerStr = base64UrlEncode(JSON.stringify(header));
  const payloadStr = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${headerStr}.${payloadStr}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getJwtSecret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signatureInput),
  );
  const signatureStr = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${signatureInput}.${signatureStr}`;
}

export async function verifyJWT(
  token: string,
  env: any,
): Promise<{ userId: number; email: string; role: string; name: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerStr, payloadStr, signatureStr] = parts;
    const header = JSON.parse(base64UrlDecode(headerStr));
    if (header.alg !== "HS256" || header.typ !== "JWT") return null;
    const signatureInput = `${headerStr}.${payloadStr}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(getJwtSecret(env)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signature = signatureBytes(signatureStr);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(signatureInput),
    );

    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadStr));
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(payload.exp) || payload.exp <= now ||
        !Number.isSafeInteger(payload.userId) || payload.userId <= 0 ||
        typeof payload.email !== "string" || typeof payload.name !== "string" ||
        !["admin", "user"].includes(payload.role)) return null;

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

export function getAuthToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // Reject duplicate session cookies rather than relying on their path/order.
  const cookie = request.headers.get("Cookie");
  if (cookie) {
    const sessions = cookie.split(";").map(value => value.trim()).filter(value => value.startsWith(`${SHARED_SESSION_COOKIE}=`));
    if (sessions.length) return sessions.length === 1 ? sessions[0].slice(SHARED_SESSION_COOKIE.length + 1) : null;
    const match = cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

export const SHARED_SESSION_COOKIE = "__Secure-yukino_session";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export function sameOriginMutation(request: Request, requireOrigin = false): boolean {
  const origin = request.headers.get("Origin"), site = request.headers.get("Sec-Fetch-Site");
  // Packaged clients deliberately omit browser cookies. Their explicit,
  // non-simple header keeps this exception unavailable to cross-site forms.
  if (!requireOrigin && request.headers.get("X-Yukino-Native") === "1" && !request.headers.has("Cookie") &&
      ["null", "capacitor://localhost", "http://localhost", "https://localhost"].includes(origin || "")) return true;
  if (origin && origin !== new URL(request.url).origin) return false;
  if (site && site !== "same-origin" && site !== "none") return false;
  return !requireOrigin || origin === new URL(request.url).origin;
}
export function safeCookieMutation(request: Request): boolean {
  return !UNSAFE_METHODS.has(request.method) || request.headers.get("Authorization")?.startsWith("Bearer ") === true || sameOriginMutation(request, true);
}
function cookieDomain(request: Request): string | null {
  const url = new URL(request.url);
  return url.protocol === "https:" && (url.hostname === "yukino.bond" || url.hostname.endsWith(".yukino.bond")) ? "yukino.bond" : null;
}
export async function attachSharedSession(response: Response, request: Request, token: string, env: any): Promise<Response> {
  const domain = cookieDomain(request);
  if (!domain || !await verifyJWT(token, env)) return response;
  const payload = JSON.parse(base64UrlDecode(token.split(".")[1]));
  const seconds = Math.min(7 * 86400, payload.exp - Math.floor(Date.now() / 1000));
  if (seconds > 0) response.headers.append("Set-Cookie", `${SHARED_SESSION_COOKIE}=${token}; Domain=${domain}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Lax`);
  return response;
}
export function clearSharedSession(response: Response, request: Request): Response {
  const domain = cookieDomain(request);
  if (domain) response.headers.append("Set-Cookie", `${SHARED_SESSION_COOKIE}=; Domain=${domain}; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  // Old host-only sessions must not authenticate after logout either.
  response.headers.append("Set-Cookie", "auth_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
  return response;
}

export async function getCurrentUser(
  request: Request,
  env: any,
): Promise<{ userId: number; email: string; role: string; name: string } | null> {
  if (!safeCookieMutation(request)) return null;
  const token = getAuthToken(request);
  if (!token) return null;
  const claims = await verifyJWT(token, env);
  if (!claims) return null;
  // Check the current database role rather than the role cached in the JWT.
  const user = await env.DB.prepare("SELECT id, email, name, role FROM users WHERE id = ?")
    .bind(claims.userId).first();
  if (!user || !["admin", "user"].includes(user.role)) return null;
  return { userId: user.id, email: user.email, name: user.name, role: user.role };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Yukino-Native",
    },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
