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
  // Also check cookie
  const cookie = request.headers.get("Cookie");
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
