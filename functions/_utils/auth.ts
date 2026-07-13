// Cloudflare Pages Function: API authentication utilities
// Handles JWT generation, verification, and password hashing

// Fallback ONLY for local dev when JWT_SECRET is not configured.
// Production MUST set JWT_SECRET via `wrangler secret put JWT_SECRET`.
const DEV_FALLBACK_SECRET = "dev-only-never-use-in-production-change-me";

function getJwtSecret(env: any): string {
  return (env && env.JWT_SECRET) || DEV_FALLBACK_SECRET;
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
  return btoa(data)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded);
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
  const signatureStr = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature)),
  );

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
    const signatureInput = `${headerStr}.${payloadStr}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(getJwtSecret(env)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signature = Uint8Array.from(
      base64UrlDecode(signatureStr),
      (c) => c.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(signatureInput),
    );

    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadStr));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

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
  // Also check cookie
  const cookie = request.headers.get("Cookie");
  if (cookie) {
    const match = cookie.match(/auth_token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

export async function getCurrentUser(
  request: Request,
  env: any,
): Promise<{ userId: number; email: string; role: string; name: string } | null> {
  const token = getAuthToken(request);
  if (!token) return null;
  return await verifyJWT(token, env);
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
