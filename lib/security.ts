import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { runtimeEnv } from "./runtime-env";

const encoder = new TextEncoder();
export const PASSWORD_ITERATIONS = 210_000;
export const SESSION_DURATION_DAYS = 90;
const SESSION_TTL_SECONDS = SESSION_DURATION_DAYS * 24 * 60 * 60;
const OLD_SESSION_TTL_SECONDS = 12 * 60 * 60;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function encodePbkdf2PasswordHash(salt: Uint8Array, derived: Uint8Array, iterations = PASSWORD_ITERATIONS) {
  return `pbkdf2_sha256$${iterations}$${bytesToBase64Url(salt)}$${bytesToBase64Url(derived)}`;
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function parsePbkdf2PasswordHash(encoded: string) {
  const [algorithm, iterationsText, saltText, expectedText] = encoded.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationsText || !saltText || !expectedText) return null;
  const iterations = Number(iterationsText);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return null;
  try {
    const salt = base64UrlToBytes(saltText);
    const expected = base64UrlToBytes(expectedText);
    if (salt.byteLength < 8 || expected.byteLength !== 32) return null;
    return { iterations, salt, expected };
  } catch {
    return null;
  }
}

async function derivePasswordBytes(password: string, salt: Uint8Array, iterations: number, length: number) {
  return pbkdf2(sha256, encoder.encode(password), salt, { c: iterations, dkLen: length });
}

function secret() {
  const value = runtimeEnv("AUTH_SECRET");
  if (value) return value;
  if (runtimeEnv("ENVIRONMENT") === "production") {
    throw new Error("AUTH_SECRET must be configured in production.");
  }
  return "local-development-only-change-me";
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePasswordBytes(password, salt, PASSWORD_ITERATIONS, 32);
  return encodePbkdf2PasswordHash(salt, derived);
}

export async function verifyPassword(password: string, encoded: string) {
  const parsed = parsePbkdf2PasswordHash(encoded);
  if (!parsed) return false;
  const actual = await derivePasswordBytes(password, parsed.salt, parsed.iterations, parsed.expected.byteLength);
  if (actual.length !== parsed.expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ parsed.expected[index];
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
  credentialTag?: string;
}

export function sessionCredentialTag(passwordHash: string) {
  return sign(`session-credential:${passwordHash}`);
}

export async function createSessionToken(userId: string, passwordHash: string, previous?: SessionPayload) {
  const issuedAt = previous?.issuedAt ?? Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId,
    sessionId: previous?.sessionId ?? crypto.randomUUID(),
    issuedAt,
    expiresAt: issuedAt + SESSION_TTL_SECONDS,
    credentialTag: await sessionCredentialTag(passwordHash),
  };
  const message = `v2.${bytesToBase64Url(encoder.encode(JSON.stringify(payload)))}`;
  return `${message}.${await sign(message)}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const current = token.startsWith("v2.");
  const parts = (current ? token.slice(3) : token).split(".");
  const [encoded, signature] = parts;
  if (parts.length !== 2 || !encoded || !signature || (await sign(current ? `v2.${encoded}` : encoded)) !== signature) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded))) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    const lifetime = current ? SESSION_TTL_SECONDS : OLD_SESSION_TTL_SECONDS;
    if (!payload.userId || !payload.sessionId || !Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt)) return null;
    if (payload.issuedAt > now || payload.expiresAt <= now || payload.expiresAt - payload.issuedAt !== lifetime) return null;
    if (current !== (typeof payload.credentialTag === "string")) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, secure = true, maxAge = SESSION_TTL_SECONDS) {
  return `phase1_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export async function upgradeSessionCookie(previous: SessionPayload, passwordHash: string, secure: boolean) {
  const token = await createSessionToken(previous.userId, passwordHash, previous);
  const maxAge = previous.issuedAt + SESSION_TTL_SECONDS - Math.floor(Date.now() / 1000);
  return sessionCookie(token, secure, maxAge);
}

export function clearSessionCookie(secure = true) {
  return `phase1_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
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
