import { env } from "cloudflare:workers";

const encoder = new TextEncoder();
const PASSWORD_ITERATIONS = 210_000;
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function secret() {
  const runtime = env as unknown as { AUTH_SECRET?: string; ENVIRONMENT?: string };
  if (runtime.AUTH_SECRET) return runtime.AUTH_SECRET;
  if (runtime.ENVIRONMENT === "production") {
    throw new Error("AUTH_SECRET must be configured in production.");
  }
  return "local-development-only-change-me";
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS },
    keyMaterial,
    256,
  );
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, iterationsText, saltText, expectedText] = encoded.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationsText || !saltText || !expectedText) return false;
  const iterations = Number(iterationsText);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000) return false;
  const salt = base64UrlToBytes(saltText);
  const expected = base64UrlToBytes(expectedText);
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const actualBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    expected.byteLength * 8,
  );
  const actual = new Uint8Array(actualBits);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export interface SessionPayload {
  userId: string;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
}

export async function createSessionToken(userId: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId,
    sessionId: crypto.randomUUID(),
    issuedAt,
    expiresAt: issuedAt + SESSION_TTL_SECONDS,
  };
  const encoded = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${await sign(encoded)}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || (await sign(encoded)) !== signature) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded))) as SessionPayload;
    if (!payload.userId || !payload.sessionId || payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, secure = true) {
  return `ramk_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(secure = true) {
  return `ramk_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const requestUrl = new URL(request.url);
  if (new URL(origin).host !== requestUrl.host) throw new Error("CSRF_ORIGIN_MISMATCH");
}

export function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

export async function sha256Hex(bytes: ArrayBuffer) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
