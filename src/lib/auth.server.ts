import crypto from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { dbExecute, dbQuery, getTableColumns, tableExists } from "./db.server";

export const SESSION_COOKIE_NAME = "fitlytix_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type UserRole = "athlete" | "coach" | "head_coach" | "admin";

export interface AuthenticatedUser {
  id: string;
  athleteId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  primarySport: string;
}

export class AuthHttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function getSessionSecret(): string {
  return (
    process.env["SESSION_SECRET"] ??
    process.env["AUTH_SECRET"] ??
    process.env["DB_PASSWORD"] ??
    "fitlytix-server-session-secret-change-in-env"
  );
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== "string") return false;

  try {
    if (storedHash.startsWith("scrypt$")) {
      const parts = storedHash.split("$");
      if (parts.length !== 3) return false;
      const [, salt, hashHex] = parts;
      if (!salt || !hashHex) return false;
      const expected = Buffer.from(hashHex, "hex");
      const actual = crypto.scryptSync(password, salt, expected.length);
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    }

    // Support colon-separated salt:hash scrypt format if present in existing DB rows
    if (storedHash.includes(":") && !storedHash.startsWith("$2")) {
      const [salt, hashHex] = storedHash.split(":");
      if (!salt || !hashHex) return false;
      const expected = Buffer.from(hashHex, "hex");
      const actual = crypto.scryptSync(password, salt, expected.length);
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    }

    // Support sha256$<salt>$<hash> or 64-char sha256 hex if legacy rows exist
    if (storedHash.startsWith("sha256$")) {
      const [, salt = "", hashHex = ""] = storedHash.split("$");
      const expected = Buffer.from(hashHex, "hex");
      const actual = crypto.createHash("sha256").update(`${salt}:${password}`).digest();
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    }

    if (/^[a-f0-9]{64}$/i.test(storedHash)) {
      const expected = Buffer.from(storedHash, "hex");
      const actual = crypto.createHash("sha256").update(password).digest();
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    }
  } catch {
    return false;
  }

  return false;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function signTokenPayload(userId: string, rawRandom: string, expiresAtMs: number): string {
  const payload = `${userId}.${expiresAtMs}.${rawRandom}`;
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

function verifySignedTokenPayload(token: string): { userId: string; expiresAtMs: number } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, sig] = parts;
  if (!encodedPayload || !sig) return null;

  try {
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const expectedSig = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const [userId, expiresStr] = payload.split(".");
    const expiresAtMs = Number(expiresStr);
    if (!userId || !Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
      return null;
    }
    return { userId, expiresAtMs };
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

function isSecureRequest(request?: Request): boolean {
  if (process.env["NODE_ENV"] === "production") return true;
  if (!request) return false;
  const proto = request.headers.get("x-forwarded-proto");
  if (proto && proto.toLowerCase().includes("https")) return true;
  return request.url.startsWith("https://");
}

export function buildSessionCookie(token: string, request?: Request, maxAgeSeconds = SESSION_TTL_SECONDS): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecureRequest(request)) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

export function buildClearSessionCookie(request?: Request): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (isSecureRequest(request)) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

async function resolveAthleteIdentityForUser(userId: string): Promise<{ athleteId: string; primarySport: string }> {
  try {
    if (await tableExists("athlete_profiles")) {
      const cols = await getTableColumns("athlete_profiles");
      const userCol = cols.has("user_id") ? "user_id" : cols.has("athlete_user_id") ? "athlete_user_id" : "id";
      const rows = await dbQuery<RowDataPacket[]>(
        `SELECT * FROM athlete_profiles WHERE ${userCol} = ? LIMIT 1`,
        [userId],
      );
      if (rows[0]) {
        return {
          athleteId: String(rows[0]["id"] ?? userId),
          primarySport: String(rows[0]["primary_sport_slug"] ?? rows[0]["primary_sport"] ?? "crossfit"),
        };
      }
    }

    if (await tableExists("athletes")) {
      const cols = await getTableColumns("athletes");
      const userCol = cols.has("user_id") ? "user_id" : "id";
      const rows = await dbQuery<RowDataPacket[]>(
        `SELECT * FROM athletes WHERE ${userCol} = ? LIMIT 1`,
        [userId],
      );
      if (rows[0]) {
        return {
          athleteId: String(rows[0]["id"] ?? userId),
          primarySport: String(rows[0]["primary_sport"] ?? "crossfit"),
        };
      }
    }
  } catch {
    // Fallback to userId if profile table is not yet populated
  }

  return { athleteId: userId, primarySport: "crossfit" };
}

async function loadUserById(userId: string): Promise<AuthenticatedUser | null> {
  if (!(await tableExists("users"))) return null;
  const rows = await dbQuery<RowDataPacket[]>(`SELECT * FROM users WHERE id = ? LIMIT 1`, [userId]);
  const row = rows[0];
  if (!row) return null;

  if (row["status"] && String(row["status"]).toLowerCase() === "disabled") {
    return null;
  }

  const fullName = String(row["full_name"] ?? row["name"] ?? "").trim();
  const firstName = String(row["first_name"] ?? (fullName.split(" ")[0] || "ورزشکار"));
  const lastName = String(row["last_name"] ?? fullName.split(" ").slice(1).join(" ") ?? "");
  const phone = String(row["phone"] ?? row["mobile"] ?? "");
  const roleRaw = String(row["role"] ?? "athlete").toLowerCase();
  const role: UserRole =
    roleRaw === "coach" || roleRaw === "head_coach" || roleRaw === "admin" ? (roleRaw as UserRole) : "athlete";

  const { athleteId, primarySport } = await resolveAthleteIdentityForUser(String(row["id"]));

  return {
    id: String(row["id"]),
    athleteId,
    email: String(row["email"] ?? ""),
    firstName,
    lastName,
    phone,
    role,
    primarySport,
  };
}

export async function createServerSession(userId: string, request?: Request): Promise<string> {
  const rawRandom = crypto.randomBytes(24).toString("hex");
  const expiresAtMs = Date.now() + SESSION_TTL_SECONDS * 1000;
  const token = signTokenPayload(userId, rawRandom, expiresAtMs);
  const tokenHash = sha256Hex(token);
  const expiresAtSql = new Date(expiresAtMs).toISOString().slice(0, 19).replace("T", " ");

  const forwardedFor = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ipHash = forwardedFor ? sha256Hex(forwardedFor) : null;
  const userAgent = request?.headers.get("user-agent")?.slice(0, 250) ?? null;

  const sessionTables = ["user_sessions", "sessions", "auth_sessions"];
  for (const tbl of sessionTables) {
    if (await tableExists(tbl)) {
      const cols = await getTableColumns(tbl);
      const insertCols: string[] = [];
      const insertVals: unknown[] = [];

      if (cols.has("id")) {
        insertCols.push("id");
        insertVals.push(crypto.randomUUID());
      }
      if (cols.has("user_id")) {
        insertCols.push("user_id");
        insertVals.push(userId);
      }
      if (cols.has("token_hash")) {
        insertCols.push("token_hash");
        insertVals.push(tokenHash);
      } else if (cols.has("session_token")) {
        insertCols.push("session_token");
        insertVals.push(tokenHash);
      } else if (cols.has("token")) {
        insertCols.push("token");
        insertVals.push(tokenHash);
      }
      if (cols.has("ip_hash")) {
        insertCols.push("ip_hash");
        insertVals.push(ipHash);
      }
      if (cols.has("user_agent")) {
        insertCols.push("user_agent");
        insertVals.push(userAgent);
      }
      if (cols.has("expires_at")) {
        insertCols.push("expires_at");
        insertVals.push(expiresAtSql);
      }

      if (insertCols.length >= 2) {
        const placeholders = insertCols.map(() => "?").join(", ");
        await dbExecute(`INSERT INTO ${tbl} (${insertCols.join(", ")}) VALUES (${placeholders})`, insertVals);
      }
      break;
    }
  }

  return token;
}

export async function getSessionUser(request: Request): Promise<AuthenticatedUser | null> {
  const cookies = parseCookies(request.headers.get("cookie"));
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) return null;

  const tokenHash = sha256Hex(rawToken);
  const sessionTables = ["user_sessions", "sessions", "auth_sessions"];

  for (const tbl of sessionTables) {
    if (await tableExists(tbl)) {
      const cols = await getTableColumns(tbl);
      const tokenCol = cols.has("token_hash")
        ? "token_hash"
        : cols.has("session_token")
          ? "session_token"
          : cols.has("token")
            ? "token"
            : null;

      if (tokenCol && cols.has("user_id")) {
        const rows = await dbQuery<RowDataPacket[]>(
          `SELECT * FROM ${tbl} WHERE (${tokenCol} = ? OR ${tokenCol} = ?) LIMIT 1`,
          [tokenHash, rawToken],
        );
        const sessionRow = rows[0];
        if (sessionRow) {
          if (sessionRow["revoked_at"]) return null;
          if (sessionRow["expires_at"]) {
            const exp = new Date(String(sessionRow["expires_at"])).getTime();
            if (Number.isFinite(exp) && Date.now() > exp) return null;
          }
          return await loadUserById(String(sessionRow["user_id"]));
        }
      }
    }
  }

  // Fallback verification if token was signed by this server
  const verified = verifySignedTokenPayload(rawToken);
  if (verified) {
    return await loadUserById(verified.userId);
  }

  return null;
}

export async function destroySession(request: Request): Promise<void> {
  const cookies = parseCookies(request.headers.get("cookie"));
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) return;

  const tokenHash = sha256Hex(rawToken);
  const sessionTables = ["user_sessions", "sessions", "auth_sessions"];

  for (const tbl of sessionTables) {
    if (await tableExists(tbl)) {
      const cols = await getTableColumns(tbl);
      const tokenCol = cols.has("token_hash")
        ? "token_hash"
        : cols.has("session_token")
          ? "session_token"
          : cols.has("token")
            ? "token"
            : null;
      if (!tokenCol) continue;

      if (cols.has("revoked_at")) {
        await dbExecute(
          `UPDATE ${tbl} SET revoked_at = CURRENT_TIMESTAMP WHERE ${tokenCol} = ? OR ${tokenCol} = ?`,
          [tokenHash, rawToken],
        );
      } else {
        await dbExecute(`DELETE FROM ${tbl} WHERE ${tokenCol} = ? OR ${tokenCol} = ?`, [tokenHash, rawToken]);
      }
      break;
    }
  }
}

export async function requireAuthenticatedUser(request: Request): Promise<AuthenticatedUser> {
  const user = await getSessionUser(request);
  if (!user) {
    throw new AuthHttpError(401, "برای ادامه لازم است وارد حساب کاربری خود شوید.");
  }
  return user;
}

export async function requireRole(request: Request, allowedRoles: UserRole[]): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser(request);
  if (!allowedRoles.includes(user.role)) {
    throw new AuthHttpError(403, "شما مجوز دسترسی به این بخش را ندارید.");
  }
  return user;
}
